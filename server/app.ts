/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import {
  dispatchWhatsAppOrderNotification,
  getOrderWhatsAppNotificationStatus,
  type WhatsAppOrderPayload,
} from './whatsappNotification.ts';

dotenv.config();

const app = express();
app.set('trust proxy', 1);

// Global CORS Middleware to support Vercel preview URLs and custom domains
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (_req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

const verifiedWebhookSessions = new Map<
  string,
  { paid: boolean; orderId?: string; orderNumber?: string; paymentIntent?: string }
>();

const pendingStripeOrderPayloads = new Map<string, WhatsAppOrderPayload>();
const recentIdempotencySet = new Set<string>();

// Authoritative fallback catalog for server-side price computation when client sends product IDs
export const SERVER_CATALOG_PRICES: Record<string, { name: string; sku: string; price: number; salePrice?: number }> = {
  'mv-15-1': { name: 'Feather Jacket', sku: 'MV-SS27-1501', price: 2900 },
  'mv-15-2': { name: 'Satin Wide Leg Trousers', sku: 'MV-SS27-1502', price: 1450 },
  'mv-16-1': { name: 'Pleated Dress', sku: 'MV-SS27-1601', price: 2200, salePrice: 1980 },
  'mv-16-2': { name: 'Gold Waist Belt', sku: 'MV-SS27-1602', price: 420 },
  'mv-17-1': { name: 'Satin Trench Dress', sku: 'MV-SS27-1701', price: 2350 },
  'mv-17-2': { name: 'Top Handle Bag', sku: 'MV-SS27-1702', price: 980 },
  'mv-18-1': { name: 'Billow Sleeve Blouse', sku: 'MV-SS27-1801', price: 860, salePrice: 740 },
  'mv-18-2': { name: 'Tie Waist Trousers', sku: 'MV-SS27-1802', price: 740 },
  'mv-19-1': { name: 'Powder Long Coat', sku: 'MV-SS27-1901', price: 1980 },
  'mv-19-2': { name: 'Ivory Straight Trousers', sku: 'MV-SS27-1902', price: 690 },
  'mv-20-1': { name: 'Sculpted Ruffle Top', sku: 'MV-SS27-2001', price: 1120 },
  'mv-20-2': { name: 'Pleated Maxi Skirt', sku: 'MV-SS27-2002', price: 1340 },
  'mv-acc-1': { name: 'Champagne Silk Twill Carre', sku: 'MV-SS27-2101', price: 380 },
  'mv-beauty-1': { name: 'Lumiere Blanche Eau de Parfum', sku: 'MV-SS27-2201', price: 310 },
  'mv-shoe-1': { name: 'Sculpted Calfskin Mule', sku: 'MV-SS27-2301', price: 890, salePrice: 790 },
};

export const SERVER_COUPONS: Record<
  string,
  { discountType: 'percentage' | 'fixed'; discountValue: number; minOrderAmount: number; maxDiscount?: number }
> = {
  MAISON10: { discountType: 'percentage', discountValue: 10, minOrderAmount: 500, maxDiscount: 600 },
  RUNWAY250: { discountType: 'fixed', discountValue: 250, minOrderAmount: 2000 },
  PAKISTANFREE: { discountType: 'fixed', discountValue: 35, minOrderAmount: 400 },
};

export const MAJOR_PK_CITIES = ['karachi', 'lahore', 'islamabad', 'rawalpindi', 'faisalabad'];

function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key === 'sk_test_your_stripe_secret_key') return null;
  return new Stripe(key);
}

export interface QuoteItemInput {
  productId: string;
  quantity: number;
  unitPrice?: number;
  name?: string;
}

export function calculateServerQuote(
  items: QuoteItemInput[],
  city: string,
  couponCode?: string,
  customCoupon?: { discountType: 'percentage' | 'fixed'; discountValue: number; minOrderAmount: number; maxDiscount?: number } | null
) {
  let subtotal = 0;
  const lineItems: { productId: string; name: string; unitPrice: number; quantity: number }[] = [];

  for (const item of items) {
    const qty = Math.max(1, Math.min(50, Math.floor(Number(item.quantity) || 1)));
    const known = SERVER_CATALOG_PRICES[item.productId];
    const unitPrice = known
      ? (typeof known.salePrice === 'number' && known.salePrice < known.price ? known.salePrice : known.price)
      : Math.max(0, Number(item.unitPrice) || 0);
    const name = known ? known.name : String(item.name || 'AUREVÉ Piece').slice(0, 120);
    subtotal += unitPrice * qty;
    lineItems.push({ productId: item.productId, name, unitPrice, quantity: qty });
  }

  let discountTotal = 0;
  let appliedCoupon = '';
  const normalizedCode = (couponCode || '').trim().toUpperCase();
  const couponRule = normalizedCode ? (SERVER_COUPONS[normalizedCode] || customCoupon || null) : null;

  if (couponRule && subtotal >= couponRule.minOrderAmount) {
    if (couponRule.discountType === 'percentage') {
      discountTotal = Math.round((subtotal * couponRule.discountValue) / 100);
      if (couponRule.maxDiscount && discountTotal > couponRule.maxDiscount) {
        discountTotal = couponRule.maxDiscount;
      }
    } else {
      discountTotal = Math.min(subtotal, couponRule.discountValue);
    }
    appliedCoupon = normalizedCode;
  }

  // Flat delivery fee of Rs. 200 for EVERY order, including Karachi
  const shippingFee = 200;
  const grandTotal = Math.max(0, subtotal - discountTotal + shippingFee);
  return {
    subtotal,
    discountTotal,
    shippingFee,
    grandTotal,
    appliedCoupon,
    lineItems,
  };
}

// Dedicated API Router to mount seamlessly at both /api and / (for Vercel compatibility)
const apiRouter = express.Router();

// Stripe Webhook must receive raw body
const stripeWebhookHandler = (req: Request, res: Response) => {
  const stripe = getStripeClient();
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe) {
    res.status(400).json({ error: 'Stripe is not configured on this server.' });
    return;
  }

  try {
    let event: Stripe.Event;
    if (webhookSecret && webhookSecret !== 'whsec_your_webhook_secret' && typeof sig === 'string') {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      const parsed = JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body));
      event = parsed as Stripe.Event;
    }

    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session?.id && (session.payment_status === 'paid' || event.type === 'checkout.session.async_payment_succeeded')) {
        const orderNum = session.metadata?.orderNumber;
        verifiedWebhookSessions.set(session.id, {
          paid: true,
          orderId: session.metadata?.orderId,
          orderNumber: orderNum,
          paymentIntent: typeof session.payment_intent === 'string' ? session.payment_intent : session.id,
        });

        if (orderNum && pendingStripeOrderPayloads.has(orderNum)) {
          const payload = pendingStripeOrderPayloads.get(orderNum)!;
          payload.paymentStatus = 'paid';
          payload.status = 'Confirmed';
          dispatchWhatsAppOrderNotification(payload).catch((err) =>
            console.warn('[Stripe Webhook] WhatsApp dispatch notice:', err)
          );
        }
      }
    }

    res.json({ received: true, type: event.type });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook signature verification failed';
    res.status(400).json({ error: message });
  }
};

apiRouter.post('/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

// Parse JSON body for all other API endpoints
apiRouter.use(express.json({ limit: '1mb' }));

// Health / Status Check
apiRouter.get('/', (_req, res) => {
  res.json({
    status: 'online',
    brand: 'AUREVÉ',
    service: 'AUREVÉ Atelier Order & Payment Engine',
    timestamp: new Date().toISOString(),
  });
});

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', brand: 'AUREVÉ', timestamp: new Date().toISOString() });
});

// Payment & Gateway capability status (no secrets exposed)
apiRouter.get('/payment-gateways/status', (_req, res) => {
  const stripeReady = Boolean(
    process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'sk_test_your_stripe_secret_key'
  );
  const easypaisaReady = Boolean(process.env.EASYPAISA_STORE_ID && process.env.EASYPAISA_HASH_KEY);
  const jazzcashReady = Boolean(
    process.env.JAZZCASH_MERCHANT_ID && process.env.JAZZCASH_PASSWORD && process.env.JAZZCASH_INTEGRITY_SALT
  );

  res.json({
    cod: { enabled: true, mode: 'live' },
    stripe: {
      enabled: stripeReady,
      mode: stripeReady ? 'live_api' : 'requires_secret_key',
      setupHint: 'Configure STRIPE_SECRET_KEY in environment secrets to enable live Stripe Hosted Checkout.',
    },
    easypaisa: {
      enabled: easypaisaReady,
      mode: easypaisaReady ? 'live_merchant' : 'manual_merchant_setup',
      setupHint: 'Set EASYPAISA_STORE_ID and EASYPAISA_HASH_KEY in environment secrets for automated Easypaisa MA/OTC API.',
    },
    jazzcash: {
      enabled: jazzcashReady,
      mode: jazzcashReady ? 'live_merchant' : 'manual_merchant_setup',
      setupHint: 'Set JAZZCASH_MERCHANT_ID, JAZZCASH_PASSWORD, and JAZZCASH_INTEGRITY_SALT for JazzCash HMAC-SHA256 checkout.',
    },
  });
});

// Authoritative server-side order quote & unique order number generator
apiRouter.post('/checkout/quote', (req, res) => {
  try {
    const { items, city = 'Karachi', couponCode, customCoupon } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Cart is empty. Please add items to checkout.' });
      return;
    }
    const quote = calculateServerQuote(items, String(city), couponCode, customCoupon);
    const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
    const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const orderNumber = `MV-${datePart}-${randomPart}`;
    res.json({ ...quote, orderNumber });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to compute order quote.' });
  }
});

// Create real Stripe Checkout Session on the server
apiRouter.post('/checkout/stripe-session', async (req, res) => {
  const stripe = getStripeClient();
  if (!stripe) {
    res.status(503).json({
      error: 'Stripe card gateway requires STRIPE_SECRET_KEY in server environment secrets. Please configure STRIPE_SECRET_KEY or select Cash on Delivery.',
      code: 'STRIPE_NOT_CONFIGURED',
    });
    return;
  }

  try {
    const {
      items,
      city = 'Karachi',
      couponCode,
      customCoupon,
      orderId,
      orderNumber,
      customerEmail,
      idempotencyKey,
      clientOrigin,
    } = req.body || {};
    if (!Array.isArray(items) || items.length === 0 || !orderId || !orderNumber) {
      res.status(400).json({ error: 'Invalid order payload for Stripe session.' });
      return;
    }

    if (idempotencyKey && recentIdempotencySet.has(String(idempotencyKey))) {
      res.status(409).json({ error: 'Duplicate order submission prevented.' });
      return;
    }
    if (idempotencyKey) {
      recentIdempotencySet.add(String(idempotencyKey));
      setTimeout(() => recentIdempotencySet.delete(String(idempotencyKey)), 60000);
    }

    if (req.body?.fullOrderPayload) {
      pendingStripeOrderPayloads.set(String(orderNumber), req.body.fullOrderPayload);
    }

    const quote = calculateServerQuote(items, String(city), couponCode, customCoupon);
    const validClientOrigin =
      typeof clientOrigin === 'string' && /^https?:\/\/[a-zA-Z0-9._:-]+$/.test(clientOrigin.trim())
        ? clientOrigin.trim().replace(/\/$/, '')
        : '';
    const origin =
      validClientOrigin ||
      (process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'
        ? process.env.APP_URL.replace(/\/$/, '')
        : process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL.replace(/\/$/, '')}`
          : `${req.protocol}://${req.get('host')}`);

    let discountsParam: Stripe.Checkout.SessionCreateParams.Discount[] = [];
    if (quote.discountTotal > 0) {
      const stripeCoupon = await stripe.coupons.create({
        amount_off: Math.round(quote.discountTotal * 100),
        currency: 'pkr',
        duration: 'once',
        name: (quote.appliedCoupon || 'AUREVÉ Privilege').slice(0, 40),
      });
      discountsParam = [{ coupon: stripeCoupon.id }];
    }

    const trimmedEmail = typeof customerEmail === 'string' ? customerEmail.trim() : '';
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail) ? trimmedEmail : undefined;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: validEmail,
      client_reference_id: String(orderId),
      metadata: {
        orderId: String(orderId),
        orderNumber: String(orderNumber),
      },
      line_items: [
        ...quote.lineItems.map((li) => ({
          price_data: {
            currency: 'pkr',
            product_data: { name: li.name },
            unit_amount: Math.max(50, Math.round(li.unitPrice * 100)),
          },
          quantity: li.quantity,
        })),
        ...(quote.shippingFee > 0
          ? [
              {
                price_data: {
                  currency: 'pkr',
                  product_data: { name: `Express Courier Delivery (${city})` },
                  unit_amount: Math.round(quote.shippingFee * 100),
                },
                quantity: 1,
              },
            ]
          : []),
      ],
      ...(discountsParam.length > 0 ? { discounts: discountsParam } : {}),
      success_url: `${origin}/order-success/${encodeURIComponent(String(orderNumber))}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout?cancelled=1`,
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Unable to create Stripe checkout session.',
    });
  }
});

// Verify Stripe Checkout Session payment status on return or background poll
apiRouter.get('/checkout/verify-stripe', async (req, res) => {
  const stripe = getStripeClient();
  const sessionId = String(req.query.session_id || '');
  if (!sessionId) {
    res.status(400).json({ verified: false, error: 'Missing session_id.' });
    return;
  }

  const cached = verifiedWebhookSessions.get(sessionId);
  if (cached?.paid) {
    if (cached.orderNumber && pendingStripeOrderPayloads.has(cached.orderNumber)) {
      const payload = pendingStripeOrderPayloads.get(cached.orderNumber)!;
      payload.paymentStatus = 'paid';
      payload.status = 'Confirmed';
      dispatchWhatsAppOrderNotification(payload).catch((err) =>
        console.warn('[Verify Stripe] Cached WhatsApp dispatch notice:', err)
      );
    }
    res.json({
      verified: true,
      paymentStatus: 'paid',
      orderNumber: cached.orderNumber || null,
      orderId: cached.orderId || null,
      paymentIntent: cached.paymentIntent || sessionId,
    });
    return;
  }

  if (!stripe) {
    res.status(400).json({ verified: false, error: 'Missing Stripe configuration.' });
    return;
  }
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const isPaid = session.payment_status === 'paid';
    const orderNumber = session.metadata?.orderNumber || null;

    if (isPaid && orderNumber && pendingStripeOrderPayloads.has(orderNumber)) {
      const payload = pendingStripeOrderPayloads.get(orderNumber)!;
      payload.paymentStatus = 'paid';
      payload.status = 'Confirmed';
      dispatchWhatsAppOrderNotification(payload).catch((err) =>
        console.warn('[Verify Stripe] Retrieved session WhatsApp dispatch notice:', err)
      );
    }

    res.json({
      verified: isPaid,
      paymentStatus: session.payment_status,
      orderNumber,
      orderId: session.metadata?.orderId || null,
      paymentIntent: typeof session.payment_intent === 'string' ? session.payment_intent : session.id,
    });
  } catch (err) {
    res.status(400).json({ verified: false, error: err instanceof Error ? err.message : 'Verification failed' });
  }
});

// Dedicated WhatsApp Order Notification Endpoint
apiRouter.post('/order/notify-whatsapp', async (req, res) => {
  try {
    const payload = req.body as WhatsAppOrderPayload;
    if (!payload?.orderNumber || !payload?.customerName || !payload?.customerPhone) {
      res.status(400).json({
        error: 'Incomplete order notification payload. Order number, customer name, and customer phone are required.',
      });
      return;
    }

    const result = await dispatchWhatsAppOrderNotification(payload);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to dispatch WhatsApp order notification';
    res.status(500).json({ error: message });
  }
});

// Query WhatsApp notification status and deep-link for an order
apiRouter.get('/order/whatsapp-status/:orderNumber', (req, res) => {
  const { orderNumber } = req.params;
  const status = getOrderWhatsAppNotificationStatus(orderNumber);
  res.json({
    orderNumber,
    notified: Boolean(status),
    status: status || null,
  });
});

// Easypaisa & JazzCash cryptographic request builder (production architecture)
apiRouter.post('/checkout/mobile-wallet-init', (req, res) => {
  const { gateway, orderNumber, amount, mobileNumber } = req.body || {};
  if (gateway === 'easypaisa') {
    const storeId = process.env.EASYPAISA_STORE_ID;
    const hashKey = process.env.EASYPAISA_HASH_KEY;
    if (!storeId || !hashKey) {
      res.status(503).json({
        configured: false,
        gateway: 'easypaisa',
        error: 'Easypaisa live merchant credentials (EASYPAISA_STORE_ID, EASYPAISA_HASH_KEY) are not configured in environment secrets.',
      });
      return;
    }
    const payload = `amount=${Number(amount).toFixed(2)}&orderRefNum=${orderNumber}&paymentMethod=InitialRequest&storeId=${storeId}`;
    const signature = crypto.createHmac('sha256', hashKey).update(payload).digest('base64');
    res.json({
      configured: true,
      gateway: 'easypaisa',
      endpoint: 'https://easypay.easypaisa.com.pk/easypay/Index.jsf',
      fields: { storeId, orderRefNum: orderNumber, amount: Number(amount).toFixed(2), mobileAccountNo: mobileNumber, merchantHashedReq: signature },
    });
    return;
  }

  if (gateway === 'jazzcash') {
    const merchantId = process.env.JAZZCASH_MERCHANT_ID;
    const password = process.env.JAZZCASH_PASSWORD;
    const salt = process.env.JAZZCASH_INTEGRITY_SALT;
    if (!merchantId || !password || !salt) {
      res.status(503).json({
        configured: false,
        gateway: 'jazzcash',
        error: 'JazzCash merchant credentials (JAZZCASH_MERCHANT_ID, JAZZCASH_PASSWORD, JAZZCASH_INTEGRITY_SALT) are not configured in environment secrets.',
      });
      return;
    }
    const txnDateTime = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const ppAmount = String(Math.round(Number(amount) * 100));
    const sortedValues = `${salt}&${ppAmount}&${orderNumber}&${merchantId}&${password}&PKR&${txnDateTime}`;
    const secureHash = crypto.createHmac('sha256', salt).update(sortedValues).digest('hex').toUpperCase();
    res.json({
      configured: true,
      gateway: 'jazzcash',
      endpoint: 'https://payments.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/',
      fields: {
        pp_MerchantID: merchantId,
        pp_BillReference: orderNumber,
        pp_Amount: ppAmount,
        pp_TxnCurrency: 'PKR',
        pp_TxnDateTime: txnDateTime,
        pp_SecureHash: secureHash,
      },
    });
    return;
  }

  res.status(400).json({ error: 'Unsupported mobile wallet gateway.' });
});

// Authoritative Admin Authorization Middleware
const AUTHORIZED_ADMIN_EMAIL = 'razasphare@gmail.com';

function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const emailHeader = (req.headers['x-admin-email'] || req.query.admin_email || '').toString().toLowerCase().trim();
  if (emailHeader !== AUTHORIZED_ADMIN_EMAIL) {
    res.status(403).json({
      error: 'Access Denied: Only razasphare@gmail.com has administrative authorization.',
      code: 'ADMIN_UNAUTHORIZED',
    });
    return;
  }
  next();
}

// Verify server-side admin identity
apiRouter.get('/admin/verify', (req, res) => {
  const emailHeader = String(req.query.email || req.headers['x-admin-email'] || '').toLowerCase().trim();
  const isAuthorized = emailHeader === AUTHORIZED_ADMIN_EMAIL;
  res.json({
    bootstrapEmail: AUTHORIZED_ADMIN_EMAIL,
    matchesBootstrap: isAuthorized,
    authorized: isAuthorized,
  });
});

apiRouter.post('/admin/verify', (req, res) => {
  const emailHeader = String(req.body?.email || req.headers['x-admin-email'] || '').toLowerCase().trim();
  const isAuthorized = emailHeader === AUTHORIZED_ADMIN_EMAIL;
  res.json({
    bootstrapEmail: AUTHORIZED_ADMIN_EMAIL,
    matchesBootstrap: isAuthorized,
    authorized: isAuthorized,
  });
});

// Admin-authoritative order status update and customer dispatch
apiRouter.post('/admin/order/update-status', requireAdminAuth, async (req, res) => {
  try {
    const { orderId, orderNumber, newStatus, previousStatus, note, cancellationReason, customerPhone, customerName, grandTotal } = req.body || {};
    if (!orderId || !newStatus) {
      res.status(400).json({ error: 'orderId and newStatus are required.' });
      return;
    }

    // Dispatch customer notification if customer phone is present
    if (customerPhone && customerName) {
      dispatchWhatsAppOrderNotification({
        orderNumber: orderNumber || orderId,
        customerName,
        customerPhone,
        city: 'Karachi',
        grandTotal: grandTotal || 0,
        paymentMethod: 'stripe',
        paymentStatus: newStatus === 'Delivered' ? 'paid' : 'pending',
        status: newStatus,
        itemSummary: note || `Order updated to ${newStatus}`,
      }).catch((err) => console.warn('[Admin API WhatsApp dispatch notice]:', err));
    }

    res.json({
      success: true,
      orderId,
      newStatus,
      updatedBy: AUTHORIZED_ADMIN_EMAIL,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update order status' });
  }
});

// Mount router strictly at /api so frontend routes and Vite middlewares control root /
app.use('/api', apiRouter);

export default app;
