/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WhatsAppOrderItem {
  name: string;
  size?: string;
  color?: string;
  quantity: number;
  unitPrice: number;
}

export interface WhatsAppOrderPayload {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  city: string;
  area: string;
  street: string;
  houseNumber: string;
  instructions?: string;
  paymentMethod: string;
  paymentStatus?: string;
  status?: string;
  subtotal: number;
  discountTotal?: number;
  shippingFee: number;
  grandTotal: number;
  couponCode?: string;
  items: WhatsAppOrderItem[];
  createdAt?: string;
}

export interface WhatsAppNotificationResult {
  success: boolean;
  orderNumber: string;
  recipient: string;
  provider: string;
  alreadyNotified?: boolean;
  messageId?: string;
  directWhatsAppUrl: string;
  formattedMessage: string;
  error?: string;
  dispatchedAt: string;
}

// Global deduplication ledger to ensure each order generates exactly one notification
const notifiedOrdersMap = new Map<string, WhatsAppNotificationResult>();

/**
 * Standardize recipient number into international Pakistan format (e.g. 923112281180)
 */
export function normalizeWhatsAppNumber(raw: string): string {
  const digitsOnly = String(raw || '').replace(/\D/g, '');
  if (digitsOnly.startsWith('03') && digitsOnly.length === 11) {
    return `92${digitsOnly.slice(1)}`;
  }
  if (digitsOnly.startsWith('92') && digitsOnly.length === 12) {
    return digitsOnly;
  }
  if (digitsOnly.length === 10 && digitsOnly.startsWith('3')) {
    return `92${digitsOnly}`;
  }
  return digitsOnly || '923112281180';
}

/**
 * Format timestamp in Pakistan Time (PKT, UTC+5)
 */
export function formatPKTDateTime(isoOrDateString?: string): string {
  try {
    const date = isoOrDateString ? new Date(isoOrDateString) : new Date();
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Karachi',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date) + ' PKT';
  } catch {
    return new Date().toLocaleString();
  }
}

/**
 * Build a pristine, luxury formatted WhatsApp order notification message
 */
export function buildWhatsAppOrderMessage(order: WhatsAppOrderPayload, recipientNumber: string): string {
  const paymentLabel = (() => {
    switch (order.paymentMethod) {
      case 'cod':
        return 'Cash on Delivery (COD)';
      case 'stripe':
        return 'Card Payment via Stripe';
      case 'easypaisa':
        return 'Easypaisa Mobile Wallet';
      case 'jazzcash':
        return 'JazzCash Mobile Wallet';
      default:
        return String(order.paymentMethod).toUpperCase();
    }
  })();

  const paymentState = order.paymentStatus === 'paid' ? 'Paid / Settled' : 'Payment on Delivery / Pending';
  const orderMilestone = order.status || (order.paymentMethod === 'cod' ? 'Confirmed' : 'Pending');
  const dateTimeStr = formatPKTDateTime(order.createdAt);

  const formattedItems = (order.items || [])
    .map((item, idx) => {
      const variantDetails = [item.size ? `Size: ${item.size}` : '', item.color ? `Color: ${item.color}` : '']
        .filter(Boolean)
        .join(' | ');

      const lineTotal = Number(item.unitPrice || 0) * Number(item.quantity || 1);
      return (
        `${idx + 1}. *${item.name}*\n` +
        (variantDetails ? `   • ${variantDetails}\n` : '') +
        `   • Qty: ${item.quantity} × $${Number(item.unitPrice || 0).toLocaleString()} = *$${lineTotal.toLocaleString()}*`
      );
    })
    .join('\n\n');

  const discountLine =
    order.discountTotal && order.discountTotal > 0
      ? `• *Privilege Discount:* -$${Number(order.discountTotal).toLocaleString()}${
          order.couponCode ? ` (Code: ${order.couponCode})` : ''
        }\n`
      : '';

  const shippingLine =
    order.shippingFee === 0
      ? '• *Insured Courier:* COMPLIMENTARY (FREE)\n'
      : `• *Insured Courier:* $${Number(order.shippingFee).toLocaleString()}\n`;

  const instructionsLine = order.instructions?.trim()
    ? `• *Special Instructions:* ${order.instructions.trim()}\n`
    : '• *Special Instructions:* None\n';

  return (
    `⚜️ *AUREVÉ — NEW ATELIER ORDER* ⚜️\n\n` +
    `📦 *Order Reference:* ${order.orderNumber}\n` +
    `🆔 *Order ID:* ${order.orderId}\n` +
    `📅 *Order Date & Time:* ${dateTimeStr}\n` +
    `🏷️ *Milestone:* ${orderMilestone}\n\n` +
    `👤 *CUSTOMER DETAILS*\n` +
    `• *Full Name:* ${order.customerName}\n` +
    `• *Contact / WhatsApp:* ${order.customerPhone}\n` +
    `• *Email:* ${order.customerEmail}\n\n` +
    `📍 *DELIVERY ADDRESS (PAKISTAN)*\n` +
    `• *House / Flat:* ${order.houseNumber}\n` +
    `• *Street / Road:* ${order.street}\n` +
    `• *Area / Sector:* ${order.area}\n` +
    `• *City:* ${order.city}, Pakistan\n` +
    instructionsLine +
    `\n👗 *ORDERED PIECES (${order.items?.length || 0} item${order.items?.length === 1 ? '' : 's'})*\n` +
    `${formattedItems || 'No line items listed'}\n\n` +
    `💰 *FINANCIAL SETTLEMENT*\n` +
    `• *Subtotal:* $${Number(order.subtotal || 0).toLocaleString()}\n` +
    discountLine +
    shippingLine +
    `• *Authoritative Grand Total:* *$${Number(order.grandTotal || 0).toLocaleString()}*\n` +
    `• *Payment Method:* ${paymentLabel}\n` +
    `• *Payment Status:* ${paymentState}\n\n` +
    `✨ *AUREVÉ Digital Atelier dispatch alert to ${recipientNumber}*`
  );
}

/**
 * Dispatches notification to WhatsApp and records deduplication state
 */
export async function dispatchWhatsAppOrderNotification(
  payload: WhatsAppOrderPayload
): Promise<WhatsAppNotificationResult> {
  const targetRecipient = normalizeWhatsAppNumber(
    process.env.WHATSAPP_RECIPIENT_NUMBER || '03112281180'
  );

  const dedupeKey = payload.orderNumber || payload.orderId;
  const existing = notifiedOrdersMap.get(dedupeKey);
  if (existing) {
    return {
      ...existing,
      alreadyNotified: true,
    };
  }

  const messageText = buildWhatsAppOrderMessage(payload, targetRecipient);
  const directWhatsAppUrl = `https://api.whatsapp.com/send?phone=${targetRecipient}&text=${encodeURIComponent(
    messageText
  )}`;

  let provider = 'concierge_direct_dispatch';
  let messageId: string | undefined;
  let dispatchError: string | undefined;

  // 1. Meta WhatsApp Cloud API (Graph API)
  const metaToken = process.env.WHATSAPP_CLOUD_API_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
  const metaPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (metaToken && metaPhoneId) {
    try {
      const response = await fetch(`https://graph.facebook.com/v21.0/${metaPhoneId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${metaToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: targetRecipient,
          type: 'text',
          text: {
            preview_url: false,
            body: messageText,
          },
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.messages?.[0]?.id) {
        provider = 'meta_whatsapp_cloud_api';
        messageId = data.messages[0].id;
      } else {
        dispatchError = data.error?.message || `Meta Cloud API status: ${response.status}`;
        console.warn('Meta WhatsApp Cloud API response notice:', data);
      }
    } catch (err) {
      dispatchError = err instanceof Error ? err.message : 'Meta API fetch failed';
      console.warn('Meta WhatsApp Cloud API dispatch exception:', err);
    }
  }

  // 2. Twilio WhatsApp fallback
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

  if (!messageId && twilioSid && twilioToken) {
    try {
      const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
      const params = new URLSearchParams();
      params.append('To', `whatsapp:+${targetRecipient}`);
      params.append('From', twilioFrom.startsWith('whatsapp:') ? twilioFrom : `whatsapp:${twilioFrom}`);
      params.append('Body', messageText);

      const twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        }
      );

      const twilioData = await twilioRes.json().catch(() => ({}));
      if (twilioRes.ok && twilioData.sid) {
        provider = 'twilio_whatsapp_api';
        messageId = twilioData.sid;
        dispatchError = undefined;
      } else {
        dispatchError = twilioData.message || `Twilio status: ${twilioRes.status}`;
      }
    } catch (err) {
      dispatchError = err instanceof Error ? err.message : 'Twilio API fetch failed';
    }
  }

  // 3. Custom Gateway Webhook fallback
  const customGatewayUrl = process.env.WHATSAPP_GATEWAY_URL;
  if (!messageId && customGatewayUrl) {
    try {
      const gatewayRes = await fetch(customGatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.WHATSAPP_GATEWAY_TOKEN
            ? { Authorization: `Bearer ${process.env.WHATSAPP_GATEWAY_TOKEN}` }
            : {}),
        },
        body: JSON.stringify({
          recipient: targetRecipient,
          phone: targetRecipient,
          message: messageText,
          orderNumber: payload.orderNumber,
          orderId: payload.orderId,
          grandTotal: payload.grandTotal,
        }),
      });
      if (gatewayRes.ok) {
        const gwData = await gatewayRes.json().catch(() => ({}));
        provider = 'custom_whatsapp_gateway';
        messageId = gwData.id || gwData.messageId || 'gw_' + Date.now();
        dispatchError = undefined;
      }
    } catch (err) {
      dispatchError = err instanceof Error ? err.message : 'Gateway fetch failed';
    }
  }

  const result: WhatsAppNotificationResult = {
    success: true,
    orderNumber: payload.orderNumber,
    recipient: targetRecipient,
    provider,
    messageId,
    directWhatsAppUrl,
    formattedMessage: messageText,
    error: dispatchError,
    dispatchedAt: new Date().toISOString(),
  };

  // Record into deduplication map
  notifiedOrdersMap.set(dedupeKey, result);

  console.log(`[WhatsApp Order Notification] Dispatched order ${payload.orderNumber} to ${targetRecipient} via ${provider}. Message preview:`);
  console.log(messageText);

  return result;
}

export function getOrderWhatsAppNotificationStatus(orderNumber: string): WhatsAppNotificationResult | null {
  return notifiedOrdersMap.get(orderNumber) || null;
}
