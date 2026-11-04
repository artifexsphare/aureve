import { doc, getDoc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { ArrowUpRight, CheckCircle2, CreditCard, Download, Heart, Loader2, MessageCircle, ShieldCheck, ShoppingBag, Trash2, Truck } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ProductVisual } from '../components/SpriteCrop';
import { getEffectivePrice, useStore } from '../context/StoreContext';
import { PAKISTAN_CITIES } from '../data/initialCatalog';
import { db } from '../firebase';
import { PaymentMethod } from '../types';
import { ProductCard } from './ShopPages';

// --- Full Cart Page ---
export const CartPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    products,
    activeCartItems,
    savedForLaterItems,
    cartSubtotal,
    updateCartQuantity,
    toggleSaveForLater,
    removeFromCart,
    calculateShipping,
    validateCouponCode,
  } = useStore();

  const [city, setCity] = useState('Lahore');
  const [couponInput, setCouponInput] = useState('');
  const [discount, setDiscount] = useState(0);
  const [couponMessage, setCouponMessage] = useState('');

  const shipping = activeCartItems.length > 0 ? calculateShipping(city, cartSubtotal - discount) : 0;
  const grandTotal = Math.max(0, cartSubtotal - discount + shipping);

  const bestSellers = products.filter((p) => p.bestSeller && p.published).slice(0, 3);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await validateCouponCode(couponInput, cartSubtotal);
    setDiscount(res.discount);
    setCouponMessage(res.message);
  };

  return (
    <div className="max-w-[1380px] mx-auto px-4 sm:px-6 md:px-12 py-8 sm:py-12 space-y-12 sm:space-y-16 w-full max-w-full overflow-hidden min-w-0">
      <div>
        <div className="text-xs text-[#737b86]">Persistent Atelier Selection</div>
        <h1 className="wide text-2xl tracking-[0.14em] mt-2">Shopping Bag</h1>
      </div>

      {activeCartItems.length === 0 ? (
        <div className="py-16 sm:py-20 bg-[#f3f6fa] text-center space-y-4 px-4">
          <ShoppingBag className="w-10 h-10 mx-auto text-[#a4adb8] stroke-[1.25]" />
          <h2 className="wide text-sm tracking-[0.15em]">Your Shopping Bag Is Empty</h2>
          <p className="text-xs text-[#737b86] max-w-md mx-auto">
            Your bag automatically syncs across sessions when signed in. Discover our Spring Summer
            2027 runway pieces below.
          </p>
          <Link
            to="/shop"
            className="inline-block px-7 py-3.5 bg-[#16191f] text-white wide text-[10px] tracking-[0.15em] active:opacity-90 touch-manipulation"
          >
            Continue Shopping
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start w-full">
          <div className="lg:col-span-8 divide-y divide-[#e6ebf0] border-t border-b border-[#e6ebf0] w-full min-w-0">
            {activeCartItems.map((item) => (
              <div key={item.id} className="py-6 flex flex-col sm:flex-row gap-5 sm:gap-6">
                <Link to={`/product/${item.product.slug}`} className="w-24 sm:w-28 h-32 sm:h-36 bg-[#f3f6fa] p-3 shrink-0 self-center sm:self-start">
                  <ProductVisual product={item.product} />
                </Link>
                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Link
                        to={`/product/${item.product.slug}`}
                        className="wide text-xs tracking-[0.14em] hover:underline block truncate"
                      >
                        {item.product.name}
                      </Link>
                      <div className="text-xs text-[#737b86] mt-1">
                        SKU: {item.product.sku} · Size: {item.size} · Shade: {item.color}
                      </div>
                    </div>
                    <div className="text-sm font-medium tabular-nums whitespace-nowrap">
                      ${(item.unitPrice * item.quantity).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
                    <div className="inline-flex items-center border border-[#e6ebf0] h-10 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                        aria-label="Decrease quantity"
                        className="w-10 h-full flex items-center justify-center text-sm font-medium hover:bg-[#f3f6fa] active:bg-[#e9f0f7] transition-colors touch-manipulation"
                      >
                        −
                      </button>
                      <span className="w-10 text-center text-xs tabular-nums select-none">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                        aria-label="Increase quantity"
                        className="w-10 h-full flex items-center justify-center text-sm font-medium hover:bg-[#f3f6fa] active:bg-[#e9f0f7] transition-colors touch-manipulation"
                      >
                        +
                      </button>
                    </div>

                    <div className="flex items-center gap-5 text-xs text-[#737b86]">
                      <button
                        type="button"
                        onClick={() => toggleSaveForLater(item.id)}
                        className="underline hover:text-[#16191f] touch-manipulation"
                      >
                        Save for Later
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="inline-flex items-center gap-1 hover:text-[#16191f] touch-manipulation"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary Box */}
          <aside className="lg:col-span-4 bg-[#f3f6fa] p-7 space-y-5">
            <h2 className="wide text-xs tracking-[0.16em]">Order Summary</h2>

            <div className="space-y-2">
              <label className="block text-xs text-[#737b86]">Estimate Delivery City (Pakistan)</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-white border border-[#e6ebf0] px-3 py-2.5 text-xs outline-none"
              >
                {PAKISTAN_CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <form onSubmit={handleApplyCoupon} className="space-y-2">
              <label className="block text-xs text-[#737b86]">Privilege / Coupon Code</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="MAISON10"
                  className="flex-1 bg-white border border-[#e6ebf0] px-3 py-2 text-xs uppercase outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16191f] text-white wide text-[9px] tracking-[0.14em]"
                >
                  Apply
                </button>
              </div>
              {couponMessage && <p className="text-[11px] text-[#737b86]">{couponMessage}</p>}
            </form>

            <div className="border-t border-[#e6ebf0] pt-4 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#737b86]">Subtotal</span>
                <span className="tabular-nums">${cartSubtotal.toLocaleString()}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-[#16191f]">
                  <span>Promotional Reduction</span>
                  <span className="tabular-nums">−${discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#737b86]">Insured Courier ({city})</span>
                <span className="tabular-nums">
                  {shipping === 0 ? 'Complimentary' : `$${shipping.toLocaleString()}`}
                </span>
              </div>
              <div className="flex justify-between pt-3 border-t border-[#e6ebf0] text-sm font-medium">
                <span>Grand Total</span>
                <span className="tabular-nums">${grandTotal.toLocaleString()}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate(
                  `/checkout${
                    discount > 0 && couponInput.trim()
                      ? `?coupon=${encodeURIComponent(couponInput.trim().toUpperCase())}`
                      : ''
                  }`
                )
              }
              className="w-full py-4 bg-[#16191f] text-white wide text-[10px] tracking-[0.16em] hover:opacity-90"
            >
              Proceed to Checkout
            </button>
          </aside>
        </div>
      )}

      {/* Saved for Later */}
      {savedForLaterItems.length > 0 && (
        <section className="space-y-5">
          <h2 className="wide text-sm tracking-[0.16em]">Saved for Later</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedForLaterItems.map((entry) => (
              <div key={entry.id} className="border border-[#e6ebf0] p-4 flex items-center gap-4">
                <div className="w-16 h-20 bg-[#f3f6fa] p-2">
                  <ProductVisual product={entry.product} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{entry.product.name}</div>
                  <div className="text-xs text-[#737b86] mt-0.5">{entry.size} · {entry.color}</div>
                  <div className="mt-2 flex gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => toggleSaveForLater(entry.id)}
                      className="underline text-[#16191f]"
                    >
                      Move to Bag
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromCart(entry.id)}
                      className="text-[#737b86] hover:text-[#16191f]"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Best Sellers */}
      <section className="space-y-6 pt-6 border-t border-[#e6ebf0]">
        <h2 className="wide text-sm tracking-[0.16em]">AUREVÉ Best Sellers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-7">
          {bestSellers.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
};

// --- Wishlist Page ---
export const WishlistPage: React.FC = () => {
  const { products, wishlist } = useStore();
  const savedProducts = wishlist
    .map((id) => products.find((p) => p.id === id))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  return (
    <div className="max-w-[1380px] mx-auto px-4 sm:px-6 md:px-12 py-8 sm:py-12 space-y-8 sm:space-y-10 w-full max-w-full overflow-hidden min-w-0">
      <div>
        <div className="text-xs text-[#737b86]">Curated Personal Archive</div>
        <h1 className="wide text-2xl tracking-[0.14em] mt-2">Saved Wishlist ({savedProducts.length})</h1>
      </div>

      {savedProducts.length === 0 ? (
        <div className="py-16 sm:py-20 bg-[#f3f6fa] text-center space-y-4 px-4">
          <Heart className="w-9 h-9 mx-auto text-[#a4adb8] stroke-[1.25]" />
          <div className="wide text-xs tracking-[0.16em]">No Saved Pieces Yet</div>
          <p className="text-xs text-[#737b86] max-w-sm mx-auto leading-relaxed">
            Tap the heart icon on the Runway product rail or any boutique card to curate your
            personal archive.
          </p>
          <Link
            to="/shop"
            className="inline-block px-6 py-3 bg-[#16191f] text-white wide text-[10px] tracking-[0.15em] active:opacity-90 touch-manipulation"
          >
            Explore Collection
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
          {savedProducts.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
};

// --- Complete Checkout Page ---
export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    user,
    userPhone,
    savedAddresses,
    activeCartItems,
    cartSubtotal,
    calculateShipping,
    validateCouponCode,
    placeOrder,
    clearActiveCart,
    notify,
  } = useStore();

  const [customerName, setCustomerName] = useState(user?.displayName || '');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [customerPhone, setCustomerPhone] = useState(userPhone || '+92 300 ');
  const [city, setCity] = useState('Lahore');
  const [area, setArea] = useState('');
  const [street, setStreet] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [instructions, setInstructions] = useState('');
  const [saveAddress, setSaveAddress] = useState(false);

  const [couponCode, setCouponCode] = useState(searchParams.get('coupon') || '');
  const [discount, setDiscount] = useState(0);
  const [couponNotice, setCouponNotice] = useState('');

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('stripe');
  const [gatewayStatus, setGatewayStatus] = useState<{
    stripe?: { enabled: boolean; setupHint: string };
    easypaisa?: { enabled: boolean; setupHint: string };
    jazzcash?: { enabled: boolean; setupHint: string };
  }>({});

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [pendingStripeCheckout, setPendingStripeCheckout] = useState<{
    orderNumber: string;
    orderId: string;
    url: string;
    sessionId?: string;
    grandTotal: number;
  } | null>(null);

  useEffect(() => {
    if (user?.displayName && !customerName) setCustomerName(user.displayName);
    if (user?.email && !customerEmail) setCustomerEmail(user.email);
    if (userPhone && customerPhone === '+92 300 ') setCustomerPhone(userPhone);
  }, [user, userPhone]);

  useEffect(() => {
    const def = savedAddresses.find((a) => a.isDefault) || savedAddresses[0];
    if (def && !area && !street) {
      setCustomerName(def.recipientName);
      setCustomerPhone(def.phone);
      setCity(def.city);
      setArea(def.area);
      setStreet(def.street);
      setHouseNumber(def.houseNumber);
      setInstructions(def.instructions || '');
    }
  }, [savedAddresses]);

  useEffect(() => {
    fetch('/api/payment-gateways/status')
      .then((r) => r.json())
      .then((data) => setGatewayStatus(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const initialC = searchParams.get('coupon');
    if (initialC && cartSubtotal > 0) {
      validateCouponCode(initialC, cartSubtotal).then((res) => {
        setDiscount(res.discount);
        setCouponNotice(res.message);
      });
    }
  }, [searchParams, cartSubtotal, validateCouponCode]);

  const shippingFee = activeCartItems.length > 0 ? calculateShipping(city, cartSubtotal - discount) : 0;
  const grandTotal = Math.max(0, cartSubtotal - discount + shippingFee);

  const handleCouponCheck = async () => {
    const res = await validateCouponCode(couponCode, cartSubtotal);
    setDiscount(res.discount);
    setCouponNotice(res.message);
  };

  // Poll Stripe session status while awaiting completion from an embedded preview tab
  useEffect(() => {
    if (!pendingStripeCheckout?.sessionId) return;
    let cancelled = false;

    const timer = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/checkout/verify-stripe?session_id=${encodeURIComponent(pendingStripeCheckout.sessionId!)}`
        );
        const data = await res.json();
        if (!cancelled && data.verified) {
          clearInterval(timer);
          try {
            const batch = writeBatch(db);
            batch.update(doc(db, 'orders', pendingStripeCheckout.orderId), {
              paymentStatus: 'paid',
              status: 'Confirmed',
              updatedAt: serverTimestamp(),
            });
            batch.update(doc(db, 'order_lookup', pendingStripeCheckout.orderNumber), {
              paymentStatus: 'paid',
              status: 'Confirmed',
              updatedAt: serverTimestamp(),
            });
            await batch.commit();
          } catch {
            // Already transitioned in return tab
          }
          await clearActiveCart();
          notify('Card Payment Verified', `Reference ${pendingStripeCheckout.orderNumber}`, 'success');
          navigate(
            `/order-success/${encodeURIComponent(pendingStripeCheckout.orderNumber)}?session_id=${encodeURIComponent(
              pendingStripeCheckout.sessionId!
            )}`
          );
        }
      } catch {
        // Continue polling quietly
      }
    }, 2500);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pendingStripeCheckout, clearActiveCart, notify, navigate]);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    try {
      const result = await placeOrder({
        customerName,
        customerEmail,
        customerPhone,
        city,
        area,
        street,
        houseNumber,
        instructions,
        paymentMethod,
        couponCode: discount > 0 ? couponCode.trim().toUpperCase() : undefined,
        saveAddress,
      });

      if (result.stripeRedirectUrl) {
        let isEmbeddedIframe = false;
        try {
          isEmbeddedIframe = window.self !== window.top;
        } catch {
          isEmbeddedIframe = true;
        }

        if (!isEmbeddedIframe) {
          // Top-level browser window: redirect straight to Stripe Hosted Checkout
          window.location.assign(result.stripeRedirectUrl);
          return;
        }

        // Embedded preview iframe: Stripe blocks X-Frame-Options framing on checkout.stripe.com,
        // so surface a direct user-activated target="_blank" link + automatic live completion polling.
        setPendingStripeCheckout({
          orderNumber: result.orderNumber,
          orderId: result.orderId,
          url: result.stripeRedirectUrl,
          sessionId: result.stripeSessionId,
          grandTotal: result.grandTotal,
        });
        notify(
          'Stripe Session Created',
          'Click "Proceed to Stripe Card Form" to complete card payment.',
          'success'
        );
        return;
      }

      notify('Order Confirmed', `Reference ${result.orderNumber}`, 'success');
      navigate(`/order-success/${encodeURIComponent(result.orderNumber)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to place order.';
      setErrorMsg(msg);
      notify('Checkout Notice', msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (pendingStripeCheckout) {
    return (
      <div className="w-full max-w-xl mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-6">
        <div className="border border-[#16191f] bg-[#f3f6fa] p-5 sm:p-8 space-y-6">
          <div className="space-y-2">
            <div className="text-xs text-[#737b86]">
              Stripe Hosted Checkout Ready · Reference{' '}
              <strong className="text-[#16191f] tabular-nums">{pendingStripeCheckout.orderNumber}</strong>
            </div>
            <h1 className="wide text-xl tracking-[0.14em]">Complete Card Payment on Stripe</h1>
            <p className="text-xs text-[#737b86] leading-relaxed">
              For PCI-DSS security, Stripe Hosted Checkout opens in a dedicated browser tab when
              previewing inside an embedded frame. Keep this page open — your order will confirm
              here automatically as soon as payment succeeds.
            </p>
          </div>

          <div className="bg-white border border-[#e6ebf0] p-4 flex items-center justify-between text-xs">
            <span className="text-[#737b86]">Authoritative Amount Due</span>
            <span className="text-base font-medium tabular-nums">
              ${pendingStripeCheckout.grandTotal.toLocaleString()}
            </span>
          </div>

          <a
            href={pendingStripeCheckout.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-4 bg-[#16191f] text-white wide text-[10px] tracking-[0.16em] hover:opacity-90 active:scale-[0.99] transition-transform flex items-center justify-center gap-2 touch-manipulation"
          >
            <span>Proceed to Stripe Card Form</span>
            <ArrowUpRight className="w-4 h-4" />
          </a>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-[#e6ebf0] text-xs text-[#737b86]">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#16191f]" />
              Waiting for Stripe payment confirmation...
            </span>
            <button
              type="button"
              onClick={() => setPendingStripeCheckout(null)}
              className="underline text-[#16191f] touch-manipulation"
            >
              Change Payment Method
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activeCartItems.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-20 sm:py-24 text-center space-y-4">
        <h1 className="wide text-lg tracking-[0.15em]">No Items in Bag</h1>
        <Link to="/shop" className="inline-block px-6 py-3 bg-[#16191f] text-white wide text-[10px] tracking-[0.15em] active:opacity-90 touch-manipulation">
          Return to Boutique
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1380px] mx-auto px-4 sm:px-6 md:px-12 py-8 sm:py-10 w-full max-w-full overflow-hidden min-w-0">
      <div className="pb-6 sm:pb-8 border-b border-[#e6ebf0] flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-xs text-[#737b86]">
            {user ? `Authenticated Checkout · ${user.email}` : 'Guest Checkout (Or Sign In for Loyalty Points)'}
          </div>
          <h1 className="wide text-xl sm:text-2xl tracking-[0.14em] mt-1">Pakistan & International Checkout</h1>
        </div>
        {!user && (
          <Link to="/login?redirect=/checkout" className="text-xs underline text-[#16191f] touch-manipulation">
            Have an account? Sign in
          </Link>
        )}
      </div>

      {searchParams.get('cancelled') === '1' && (
        <div className="mt-6 p-4 bg-[#f3f6fa] border border-[#16191f] text-xs text-[#16191f]">
          Card payment session was cancelled prior to completion. You may retry Stripe Checkout or select Cash on Delivery below.
        </div>
      )}

      <form onSubmit={handleSubmitOrder} className="mt-8 sm:mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start w-full">
        <div className="lg:col-span-7 space-y-10">
          {/* Saved Address Quick Selector */}
          {savedAddresses.length > 0 && (
            <div className="space-y-3">
              <div className="wide text-xs tracking-[0.14em]">Saved Delivery Addresses</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {savedAddresses.map((addr) => (
                  <button
                    key={addr.id}
                    type="button"
                    onClick={() => {
                      setCustomerName(addr.recipientName);
                      setCustomerPhone(addr.phone);
                      setCity(addr.city);
                      setArea(addr.area);
                      setStreet(addr.street);
                      setHouseNumber(addr.houseNumber);
                      setInstructions(addr.instructions || '');
                    }}
                    className="p-3.5 border border-[#e6ebf0] hover:border-[#16191f] text-left text-xs space-y-1"
                  >
                    <div className="font-medium">{addr.label} — {addr.city}</div>
                    <div className="text-[#737b86] truncate">
                      {addr.houseNumber}, {addr.street}, {addr.area}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Contact & Pakistani Delivery Address */}
          <section className="space-y-4">
            <h2 className="wide text-xs tracking-[0.16em]">01. Recipient & Delivery Address</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[#737b86] mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ayesha Khan"
                  className="w-full border border-[#e6ebf0] px-3.5 py-2.5 text-xs outline-none focus:border-[#16191f]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#737b86] mb-1">Pakistani Mobile Number *</label>
                <input
                  type="tel"
                  required
                  minLength={7}
                  maxLength={30}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+92 300 1234567"
                  className="w-full border border-[#e6ebf0] px-3.5 py-2.5 text-xs outline-none focus:border-[#16191f]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-[#737b86] mb-1">Email Address (For Order & Invoice) *</label>
                <input
                  type="email"
                  required
                  maxLength={160}
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="client@domain.com"
                  className="w-full border border-[#e6ebf0] px-3.5 py-2.5 text-xs outline-none focus:border-[#16191f]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#737b86] mb-1">City *</label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full border border-[#e6ebf0] px-3.5 py-2.5 text-xs bg-white outline-none focus:border-[#16191f]"
                >
                  {PAKISTAN_CITIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#737b86] mb-1">Area / Sector / Phase *</label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="DHA Phase 6 / Gulberg III / F-7"
                  className="w-full border border-[#e6ebf0] px-3.5 py-2.5 text-xs outline-none focus:border-[#16191f]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#737b86] mb-1">Street / Khayaban / Block *</label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Street 14, Block C"
                  className="w-full border border-[#e6ebf0] px-3.5 py-2.5 text-xs outline-none focus:border-[#16191f]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#737b86] mb-1">House / Apartment Number *</label>
                <input
                  type="text"
                  required
                  maxLength={50}
                  value={houseNumber}
                  onChange={(e) => setHouseNumber(e.target.value)}
                  placeholder="House 42-B"
                  className="w-full border border-[#e6ebf0] px-3.5 py-2.5 text-xs outline-none focus:border-[#16191f]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-[#737b86] mb-1">Optional Delivery Instructions</label>
                <input
                  type="text"
                  maxLength={240}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Call prior to arrival / Leave with residence security"
                  className="w-full border border-[#e6ebf0] px-3.5 py-2.5 text-xs outline-none focus:border-[#16191f]"
                />
              </div>
            </div>

            {user?.emailVerified && (
              <label className="inline-flex items-center gap-2 text-xs text-[#737b86] pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveAddress}
                  onChange={(e) => setSaveAddress(e.target.checked)}
                  className="accent-[#16191f]"
                />
                <span>Save this address to my AUREVÉ profile</span>
              </label>
            )}
          </section>

          {/* Payment Method Architecture */}
          <section className="space-y-4 border-t border-[#e6ebf0] pt-8">
            <h2 className="wide text-xs tracking-[0.16em]">02. Payment Method</h2>
            <div className="space-y-3">
              {/* Cash on Delivery */}
              <label
                className={`block p-4 border cursor-pointer transition-colors ${
                  paymentMethod === 'cod' ? 'border-[#16191f] bg-[#f3f6fa]' : 'border-[#e6ebf0]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === 'cod'}
                      onChange={() => setPaymentMethod('cod')}
                      className="accent-[#16191f]"
                    />
                    <span className="text-xs font-medium">Cash on Delivery (Pakistan Insured Courier)</span>
                  </div>
                  <Truck className="w-4 h-4 text-[#737b86]" />
                </div>
                <p className="text-[11px] text-[#737b86] mt-1.5 pl-6">
                  Settle upon physical inspection at your doorstep in Karachi, Lahore, Islamabad, and nationwide.
                </p>
              </label>

              {/* Stripe Card Gateway */}
              <label
                className={`block p-4 border cursor-pointer transition-colors ${
                  paymentMethod === 'stripe' ? 'border-[#16191f] bg-[#f3f6fa]' : 'border-[#e6ebf0]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === 'stripe'}
                      onChange={() => setPaymentMethod('stripe')}
                      className="accent-[#16191f]"
                    />
                    <span className="text-xs font-medium">Credit / Debit Card (Stripe Hosted Checkout)</span>
                  </div>
                  <CreditCard className="w-4 h-4 text-[#737b86]" />
                </div>
                <p className="text-[11px] text-[#737b86] mt-1.5 pl-6">
                  {gatewayStatus.stripe?.enabled
                    ? 'Live server-side Stripe Checkout active — redirects securely to Stripe.'
                    : 'Server integration active. Set STRIPE_SECRET_KEY in AI Studio Secrets to enable live card redirection.'}
                </p>
              </label>

              {/* Easypaisa */}
              <label
                className={`block p-4 border cursor-pointer transition-colors ${
                  paymentMethod === 'easypaisa' ? 'border-[#16191f] bg-[#f3f6fa]' : 'border-[#e6ebf0]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === 'easypaisa'}
                      onChange={() => setPaymentMethod('easypaisa')}
                      className="accent-[#16191f]"
                    />
                    <span className="text-xs font-medium">Easypaisa Mobile Account</span>
                  </div>
                  <span className="text-[11px] text-[#737b86]">PK Mobile Wallet</span>
                </div>
                <p className="text-[11px] text-[#737b86] mt-1.5 pl-6">
                  {gatewayStatus.easypaisa?.enabled
                    ? 'Easypaisa Merchant HMAC integration ready.'
                    : 'Requires EASYPAISA_STORE_ID & EASYPAISA_HASH_KEY in server environment secrets.'}
                </p>
              </label>

              {/* JazzCash */}
              <label
                className={`block p-4 border cursor-pointer transition-colors ${
                  paymentMethod === 'jazzcash' ? 'border-[#16191f] bg-[#f3f6fa]' : 'border-[#e6ebf0]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === 'jazzcash'}
                      onChange={() => setPaymentMethod('jazzcash')}
                      className="accent-[#16191f]"
                    />
                    <span className="text-xs font-medium">JazzCash Wallet / Voucher</span>
                  </div>
                  <span className="text-[11px] text-[#737b86]">HMAC-SHA256</span>
                </div>
                <p className="text-[11px] text-[#737b86] mt-1.5 pl-6">
                  {gatewayStatus.jazzcash?.enabled
                    ? 'JazzCash Merchant gateway active.'
                    : 'Requires JAZZCASH_MERCHANT_ID, JAZZCASH_PASSWORD & JAZZCASH_INTEGRITY_SALT in server secrets.'}
                </p>
              </label>
            </div>
          </section>

          {errorMsg && (
            <div className="p-4 bg-[#16191f] text-white text-xs leading-relaxed">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Order Review & Confirmation Sidebar */}
        <aside className="lg:col-span-5 bg-[#f3f6fa] p-7 space-y-6 lg:sticky lg:top-28">
          <h2 className="wide text-xs tracking-[0.16em]">03. Order Review</h2>

          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {activeCartItems.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-14 bg-white p-1 shrink-0">
                    <ProductVisual product={entry.product} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{entry.product.name}</div>
                    <div className="text-[#737b86]">
                      {entry.size} · {entry.color} × {entry.quantity}
                    </div>
                  </div>
                </div>
                <span className="tabular-nums font-medium">
                  ${(entry.unitPrice * entry.quantity).toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-2 border-t border-[#e6ebf0] pt-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                placeholder="Coupon code (e.g. MAISON10)"
                className="flex-1 bg-white border border-[#e6ebf0] px-3 py-2 text-xs uppercase outline-none"
              />
              <button
                type="button"
                onClick={handleCouponCheck}
                className="px-4 py-2 border border-[#16191f] text-xs"
              >
                Validate
              </button>
            </div>
            {couponNotice && <p className="text-[11px] text-[#737b86]">{couponNotice}</p>}
          </div>

          <div className="border-t border-[#e6ebf0] pt-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[#737b86]">Subtotal</span>
              <span className="tabular-nums">${cartSubtotal.toLocaleString()}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between">
                <span>Privilege Discount</span>
                <span className="tabular-nums">−${discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[#737b86]">Delivery ({city})</span>
              <span className="tabular-nums">
                {shippingFee === 0 ? 'Complimentary' : `$${shippingFee.toLocaleString()}`}
              </span>
            </div>
            <div className="flex justify-between pt-3 border-t border-[#e6ebf0] text-base font-medium">
              <span>Authoritative Total</span>
              <span className="tabular-nums">${grandTotal.toLocaleString()}</span>
            </div>
          </div>

          {customerName && area && (
            <div className="p-4 bg-white border border-[#e6ebf0] text-xs space-y-1">
              <div className="wide text-[10px] tracking-[0.14em]">Dispatch Summary</div>
              <p className="text-[#737b86]">
                Delivering to <strong>{customerName}</strong> ({customerPhone}) at {houseNumber || '—'},{' '}
                {street || '—'}, {area}, {city} via <strong>{paymentMethod.toUpperCase()}</strong>.
              </p>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 bg-[#16191f] text-white text-xs leading-relaxed">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-[#16191f] text-white wide text-[10px] tracking-[0.16em] hover:opacity-90 disabled:opacity-50"
          >
            {submitting
              ? paymentMethod === 'stripe'
                ? 'Initializing Stripe Checkout...'
                : 'Processing Authoritative Order...'
              : paymentMethod === 'stripe'
              ? `Confirm & Pay with Stripe ($${grandTotal.toLocaleString()})`
              : `Confirm & Place Order ($${grandTotal.toLocaleString()})`}
          </button>

          <div className="flex items-center gap-2 text-[11px] text-[#737b86]">
            <ShieldCheck className="w-4 h-4 shrink-0 text-[#16191f]" />
            <span>Totals verified server-side · Zero duplicate order protection</span>
          </div>
        </aside>
      </form>
    </div>
  );
};

// --- Order Success & Printable Invoice Page ---
export const OrderSuccessPage: React.FC = () => {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const [searchParams] = useSearchParams();
  const { clearActiveCart } = useStore();
  const [lookupData, setLookupData] = useState<Record<string, unknown> | null>(null);
  const [stripeVerified, setStripeVerified] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<{
    notified: boolean;
    directWhatsAppUrl?: string;
    recipient?: string;
  } | null>(null);

  useEffect(() => {
    if (!orderNumber) return;
    getDoc(doc(db, 'order_lookup', orderNumber))
      .then((snap) => {
        if (snap.exists()) setLookupData(snap.data());
      })
      .catch(() => {});

    // Check WhatsApp notification status
    fetch(`/api/order/whatsapp-status/${encodeURIComponent(orderNumber)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && (data.notified || data.status)) {
          setWhatsappStatus({
            notified: Boolean(data.notified),
            directWhatsAppUrl: data.status?.directWhatsAppUrl,
            recipient: data.status?.recipient || '03112281180',
          });
        }
      })
      .catch(() => {});

    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      fetch(`/api/checkout/verify-stripe?session_id=${encodeURIComponent(sessionId)}`)
        .then((r) => r.json())
        .then(async (res) => {
          if (res.verified && res.orderId) {
            setStripeVerified(true);
            await clearActiveCart();
            try {
              const batch = writeBatch(db);
              batch.update(doc(db, 'orders', res.orderId), {
                paymentStatus: 'paid',
                status: 'Confirmed',
                updatedAt: serverTimestamp(),
              });
              batch.update(doc(db, 'order_lookup', orderNumber), {
                paymentStatus: 'paid',
                status: 'Confirmed',
                updatedAt: serverTimestamp(),
              });
              await batch.commit();
            } catch {
              // If already transitioned, refresh lookup data
            }
            const refreshed = await getDoc(doc(db, 'order_lookup', orderNumber)).catch(() => null);
            if (refreshed && refreshed.exists()) setLookupData(refreshed.data());

            // Refresh WhatsApp notification state post-stripe verification
            fetch(`/api/order/whatsapp-status/${encodeURIComponent(orderNumber)}`)
              .then((r) => r.json())
              .then((data) => {
                if (data && (data.notified || data.status)) {
                  setWhatsappStatus({
                    notified: Boolean(data.notified),
                    directWhatsAppUrl: data.status?.directWhatsAppUrl,
                    recipient: data.status?.recipient || '03112281180',
                  });
                }
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
    }
  }, [orderNumber, searchParams, clearActiveCart]);

  const downloadInvoiceHtml = () => {
    const statusText = stripeVerified ? 'Confirmed (Paid via Stripe)' : String(lookupData?.status || 'Confirmed');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>AUREVÉ Invoice ${orderNumber}</title>
    <style>body{font-family:Inter,Arial,sans-serif;color:#16191f;max-width:720px;margin:48px auto;padding:24px;border:1px solid #e6ebf0}
    h1{font-size:18px;letter-spacing:.2em;text-transform:uppercase;margin:0 0 8px}
    .meta{font-size:12px;color:#737b86;margin-bottom:28px}
    table{width:100%;border-collapse:collapse;font-size:13px;margin:20px 0}
    th,td{padding:12px 8px;border-bottom:1px solid #e6ebf0;text-align:left}
    .tot{font-size:16px;font-weight:600;text-align:right;padding-top:16px}</style></head>
    <body><h1>AUREVÉ</h1><div class="meta">Official Tax & Dispatch Invoice · Digital Flagship</div>
    <table>
      <tr><th>Order Reference</th><td>${orderNumber}</td></tr>
      <tr><th>Issue Date</th><td>${new Date().toISOString().slice(0, 10)}</td></tr>
      <tr><th>Order Milestone</th><td>${statusText}</td></tr>
      <tr><th>Payment Method</th><td>${String(lookupData?.paymentMethod || 'COD').toUpperCase()}</td></tr>
      <tr><th>Destination City</th><td>${String(lookupData?.city || 'Pakistan')}</td></tr>
      <tr><th>Selection</th><td>${String(lookupData?.itemSummary || `${lookupData?.itemCount || 1} piece(s)`)}</td></tr>
    </table>
    <div class="tot">Authoritative Grand Total: $${Number(lookupData?.grandTotal || 0).toLocaleString()}</div>
    </body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AUREVE_Invoice_${orderNumber}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const recipientDisplay = whatsappStatus?.recipient === '923112281180' ? '03112281180' : (whatsappStatus?.recipient || '03112281180');

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center space-y-6 min-w-0">
      <CheckCircle2 className="w-12 h-12 mx-auto text-[#16191f] stroke-[1.25]" />
      <div className="text-xs text-[#737b86]">Atelier Dispatch Confirmation</div>
      <h1 className="wide text-2xl tracking-[0.15em]">Order Confirmed</h1>
      <p className="text-sm text-[#737b86]">
        Your unique AUREVÉ order reference is{' '}
        <strong className="text-[#16191f] tabular-nums">{orderNumber}</strong>.
      </p>

      {/* WhatsApp Atelier Notification Status Banner */}
      <div className="bg-[#16191f] text-white p-4 sm:p-5 text-left border border-[#16191f] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="wide text-[10px] tracking-[0.16em] uppercase text-emerald-400 font-semibold">
              WhatsApp Order Notification Dispatched
            </span>
          </div>
          <p className="text-xs text-[#a4adb8]">
            Complete order specs, customer details, and delivery address sent to Atelier Concierge:{' '}
            <strong className="text-white font-medium">{recipientDisplay}</strong> (+92 311 2281180).
          </p>
        </div>
        <a
          href={
            whatsappStatus?.directWhatsAppUrl ||
            `https://wa.me/923112281180?text=${encodeURIComponent(
              `⚜️ *AUREVÉ ORDER QUERY*\nRef: ${orderNumber}\nStatus: Confirmed`
            )}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs wide tracking-[0.12em] transition-colors shrink-0 active:scale-95 touch-manipulation"
        >
          <MessageCircle className="w-4 h-4" /> Open WhatsApp
        </a>
      </div>

      {lookupData && (
        <div className="bg-[#f3f6fa] p-5 sm:p-6 text-left text-xs space-y-2.5 border border-[#e6ebf0]">
          <div className="flex justify-between">
            <span className="text-[#737b86]">Order Status</span>
            <span className="font-medium">
              {stripeVerified ? 'Confirmed' : String(lookupData.status)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#737b86]">Payment Method</span>
            <span className="uppercase">{String(lookupData.paymentMethod)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#737b86]">Delivery City</span>
            <span>{String(lookupData.city)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-[#e6ebf0] text-sm font-medium">
            <span>Total</span>
            <span className="tabular-nums">${Number(lookupData.grandTotal || 0).toLocaleString()}</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 pt-4">
        <button
          type="button"
          onClick={downloadInvoiceHtml}
          className="inline-flex items-center gap-2 px-5 py-3 border border-[#16191f] text-xs wide tracking-[0.14em] hover:bg-[#f3f6fa] active:scale-95 touch-manipulation"
        >
          <Download className="w-3.5 h-3.5" /> Download Invoice
        </button>
        <Link
          to={`/track-order?order=${encodeURIComponent(orderNumber || '')}`}
          className="px-6 py-3 bg-[#16191f] text-white wide text-[10px] tracking-[0.15em] active:opacity-90 touch-manipulation"
        >
          Track Order Live
        </Link>
      </div>
    </div>
  );
};

// --- Public Order Tracking Page ---
export const TrackOrderPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [orderNum, setOrderNum] = useState(searchParams.get('order') || '');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);

  const steps = ['Pending', 'Confirmed', 'Processing', 'Packed', 'Shipped', 'Delivered'];

  const handleTrack = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = orderNum.trim().toUpperCase();
    if (!clean) return;
    setLoading(true);
    setNotFound(false);
    try {
      const snap = await getDoc(doc(db, 'order_lookup', clean));
      if (snap.exists()) {
        setResult(snap.data());
      } else {
        setResult(null);
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchParams.get('order')) {
      handleTrack();
    }
  }, []);

  const currentStepIdx = result ? steps.indexOf(String(result.status)) : -1;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8 sm:space-y-10 min-w-0">
      <div>
        <div className="text-xs text-[#737b86]">Real-Time Courier & Atelier Milestone</div>
        <h1 className="wide text-2xl tracking-[0.14em] mt-2">Track Your Order</h1>
      </div>

      <form onSubmit={handleTrack} className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          required
          value={orderNum}
          onChange={(e) => setOrderNum(e.target.value)}
          placeholder="Enter Order Number (e.g. MV-261104-A1B2C3)"
          className="flex-1 border border-[#e6ebf0] px-4 py-3 text-xs uppercase outline-none focus:border-[#16191f]"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-7 py-3 bg-[#16191f] text-white wide text-[10px] tracking-[0.15em] active:opacity-90 touch-manipulation"
        >
          {loading ? 'Locating...' : 'Track Status'}
        </button>
      </form>

      {notFound && (
        <div className="p-6 bg-[#f3f6fa] text-xs text-[#737b86]">
          No dispatch found matching <strong>{orderNum.toUpperCase()}</strong>. Verify the reference
          on your confirmation receipt.
        </div>
      )}

      {result && (
        <div className="border border-[#e6ebf0] p-7 space-y-8 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e6ebf0] pb-5">
            <div>
              <div className="text-xs text-[#737b86]">Order Reference</div>
              <div className="wide text-sm tracking-[0.14em] mt-1">{String(result.orderNumber)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-[#737b86]">Current Milestone</div>
              <div className="text-sm font-medium mt-0.5">{String(result.status)}</div>
            </div>
          </div>

          {currentStepIdx >= 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              {steps.map((st, idx) => {
                const done = idx <= currentStepIdx;
                return (
                  <div
                    key={st}
                    className={`p-3 border text-center text-xs ${
                      done
                        ? 'border-[#16191f] bg-[#16191f] text-white'
                        : 'border-[#e6ebf0] text-[#a4adb8]'
                    }`}
                  >
                    <div className="tabular-nums text-[10px]">0{idx + 1}</div>
                    <div className="mt-1 font-medium">{st}</div>
                  </div>
                );
              })}
            </div>
          )}

          {Boolean(result.itemSummary) && (
            <div className="text-xs text-[#737b86] border-t border-[#f3f6fa] pt-4">
              Pieces: <span className="text-[#16191f]">{String(result.itemSummary)}</span>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-2">
            <div>
              <span className="text-[#737b86] block">Destination</span>
              <span className="font-medium">{String(result.city)}</span>
            </div>
            <div>
              <span className="text-[#737b86] block">Items</span>
              <span className="font-medium tabular-nums">{String(result.itemCount)}</span>
            </div>
            <div>
              <span className="text-[#737b86] block">Payment</span>
              <span className="font-medium uppercase">{String(result.paymentMethod)} ({String(result.paymentStatus || 'pending')})</span>
            </div>
            <div>
              <span className="text-[#737b86] block">Grand Total</span>
              <span className="font-medium tabular-nums">
                ${Number(result.grandTotal || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
