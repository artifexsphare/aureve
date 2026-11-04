import { collection, getDocs, query, where } from 'firebase/firestore';
import { ChevronDown, ChevronUp, Download, LogOut, MapPin, Package, Shield, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { ATELIER_IMAGE_URL, PAKISTAN_CITIES } from '../data/initialCatalog';
import { OperationType, db, handleFirestoreError } from '../firebase';
import { OrderItemRecord, OrderRecord } from '../types';

// --- Login & Register Pages ---
export const AuthPage: React.FC<{ initialMode?: 'login' | 'register' }> = ({
  initialMode = 'login',
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/account';

  const { loginWithGoogle, loginWithEmail, registerWithEmail, resetPassword, notify } = useStore();

  const [mode, setMode] = useState<'login' | 'register' | 'reset'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+92 300 ');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [authErr, setAuthErr] = useState('');

  const handleGoogle = async () => {
    setAuthErr('');
    setBusy(true);
    try {
      await loginWithGoogle();
      navigate(redirectTo);
    } catch (err) {
      setAuthErr(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErr('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
        navigate(redirectTo);
      } else if (mode === 'register') {
        await registerWithEmail(name, email, password, phone);
        navigate(redirectTo);
      } else {
        await resetPassword(email);
        setMode('login');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication error.';
      if (msg.includes('operation-not-allowed')) {
        setAuthErr(
          'Email/Password sign-in is currently disabled in Firebase Console -> Authentication -> Sign-in method. Use "Continue with Google" above for instant verified access, or enable Email/Password in Firebase Console.'
        );
      } else {
        setAuthErr(msg);
      }
      notify('Authentication Notice', msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-16 space-y-8">
      <div className="text-center space-y-2">
        <div className="text-xs text-[#737b86]">AUREVÉ Client Portal</div>
        <h1 className="wide text-xl tracking-[0.15em]">
          {mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Password Recovery'}
        </h1>
      </div>

      {/* Primary Verified Google Authentication */}
      {mode !== 'reset' && (
        <button
          type="button"
          disabled={busy}
          onClick={handleGoogle}
          className="w-full py-3.5 bg-[#16191f] text-white wide text-[10px] tracking-[0.15em] hover:opacity-90 transition-opacity"
        >
          Continue with Google (Verified Access)
        </button>
      )}

      {mode !== 'reset' && (
        <div className="flex items-center gap-3 text-xs text-[#a4adb8]">
          <div className="flex-1 h-px bg-[#e6ebf0]" />
          <span>OR EMAIL CREDENTIALS</span>
          <div className="flex-1 h-px bg-[#e6ebf0]" />
        </div>
      )}

      <form onSubmit={handleEmailSubmit} className="space-y-4">
        {mode === 'register' && (
          <>
            <div>
              <label className="block text-xs text-[#737b86] mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-[#e6ebf0] px-3.5 py-2.5 text-xs outline-none focus:border-[#16191f]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#737b86] mb-1">Mobile Number</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border border-[#e6ebf0] px-3.5 py-2.5 text-xs outline-none focus:border-[#16191f]"
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-xs text-[#737b86] mb-1">Email Address</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-[#e6ebf0] px-3.5 py-2.5 text-xs outline-none focus:border-[#16191f]"
          />
        </div>

        {mode !== 'reset' && (
          <div>
            <label className="block text-xs text-[#737b86] mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-[#e6ebf0] px-3.5 py-2.5 text-xs outline-none focus:border-[#16191f]"
            />
          </div>
        )}

        {authErr && (
          <div className="p-3.5 bg-[#f3f6fa] border border-[#16191f] text-xs text-[#16191f] leading-relaxed">
            {authErr}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full py-3.5 border border-[#16191f] text-[#16191f] wide text-[10px] tracking-[0.15em] hover:bg-[#f3f6fa]"
        >
          {mode === 'login' ? 'Sign In with Email' : mode === 'register' ? 'Register Account' : 'Send Recovery Link'}
        </button>
      </form>

      <div className="flex items-center justify-between text-xs text-[#737b86] pt-2 border-t border-[#e6ebf0]">
        {mode === 'login' ? (
          <>
            <button type="button" onClick={() => setMode('register')} className="underline hover:text-[#16191f]">
              Create an account
            </button>
            <button type="button" onClick={() => setMode('reset')} className="underline hover:text-[#16191f]">
              Forgot password?
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setMode('login')} className="underline hover:text-[#16191f]">
            Back to Sign In
          </button>
        )}
      </div>
    </div>
  );
};

// --- Customer Account & My Orders Dashboard ---
export const AccountPage: React.FC<{ initialTab?: 'profile' | 'orders' | 'addresses' | 'security' }> = ({
  initialTab = 'profile',
}) => {
  const navigate = useNavigate();
  const {
    user,
    authReady,
    isAdmin,
    loyaltyPoints,
    userPhone,
    whatsappOptIn,
    savedAddresses,
    myOrders,
    logout,
    updateCustomerProfile,
    saveAddressRecord,
    deleteAddressRecord,
    cancelCustomerOrder,
    requestCustomerReturn,
    resetPassword,
  } = useStore();

  const [tab, setTab] = useState<'profile' | 'orders' | 'addresses' | 'security'>(initialTab);

  // Profile form
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [phone, setPhone] = useState(userPhone || '');
  const [optIn, setOptIn] = useState(whatsappOptIn);

  // Address form
  const [addrLabel, setAddrLabel] = useState('Residence');
  const [addrName, setAddrName] = useState(user?.displayName || '');
  const [addrPhone, setAddrPhone] = useState(userPhone || '+92 300 ');
  const [addrCity, setAddrCity] = useState('Karachi');
  const [addrArea, setAddrArea] = useState('');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrHouse, setAddrHouse] = useState('');

  // Return modal & expanded order items state
  const [returningOrder, setReturningOrder] = useState<OrderRecord | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [orderItemsByOrder, setOrderItemsByOrder] = useState<Record<string, OrderItemRecord[]>>({});
  const [loadingOrderItemsId, setLoadingOrderItemsId] = useState<string | null>(null);

  if (!authReady) {
    return <div className="max-w-4xl mx-auto px-6 py-20 text-xs text-[#737b86]">Loading account...</div>;
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-6 py-20 text-center space-y-4">
        <h1 className="wide text-lg tracking-[0.15em]">Sign In Required</h1>
        <p className="text-xs text-[#737b86]">
          Access your orders, saved Pakistani addresses, invoices, and AUREVÉ Loyalty Points.
        </p>
        <Link
          to="/login"
          className="inline-block px-6 py-3 bg-[#16191f] text-white wide text-[10px] tracking-[0.15em]"
        >
          Sign In
        </Link>
      </div>
    );
  }

  const toggleOrderDetails = async (ord: OrderRecord) => {
    if (expandedOrderId === ord.id) {
      setExpandedOrderId(null);
      return;
    }
    setExpandedOrderId(ord.id);
    if (orderItemsByOrder[ord.id]) return;

    setLoadingOrderItemsId(ord.id);
    const itemsPath = `orders/${ord.id}/items`;
    try {
      const q = query(collection(db, 'orders', ord.id, 'items'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const items: OrderItemRecord[] = [];
      snap.forEach((d) => items.push({ id: d.id, ...(d.data() as Omit<OrderItemRecord, 'id'>) }));
      setOrderItemsByOrder((prev) => ({ ...prev, [ord.id]: items }));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, itemsPath);
    } finally {
      setLoadingOrderItemsId(null);
    }
  };

  const downloadOrderInvoice = (ord: OrderRecord) => {
    const lineItems = orderItemsByOrder[ord.id];
    const itemsHtml =
      lineItems && lineItems.length > 0
        ? lineItems
            .map(
              (li) => `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e6ebf0;">
              <strong>${li.name}</strong><br/>
              <span style="color:#737b86;font-size:11px;">SKU: ${li.sku} · Size: ${li.size} · Color: ${li.color}</span>
            </td>
            <td style="padding:10px 0;border-bottom:1px solid #e6ebf0;text-align:center;">${li.quantity}</td>
            <td style="padding:10px 0;border-bottom:1px solid #e6ebf0;text-align:right;">$${(li.unitPrice * li.quantity).toLocaleString()}</td>
          </tr>`
            )
            .join('')
        : `
          <tr>
            <td colspan="2" style="padding:10px 0;border-bottom:1px solid #e6ebf0;">${ord.itemSummary}</td>
            <td style="padding:10px 0;border-bottom:1px solid #e6ebf0;text-align:right;">$${ord.subtotal.toLocaleString()}</td>
          </tr>`;

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>AUREVÉ Invoice — ${ord.orderNumber}</title>
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; color: #16191f; max-width: 760px; margin: 48px auto; padding: 0 24px; line-height: 1.6; }
    .brand { letter-spacing: 0.24em; text-transform: uppercase; font-size: 16px; font-weight: 600; }
    .muted { color: #737b86; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 13px; font-variant-numeric: tabular-nums; }
    .totals { margin-top: 24px; border-top: 2px solid #16191f; padding-top: 16px; font-size: 13px; font-variant-numeric: tabular-nums; }
    .row { display: flex; justify-content: space-between; margin-bottom: 6px; }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #e6ebf0;padding-bottom:20px;">
    <div>
      <div class="brand">AUREVÉ</div>
      <div class="muted">Official Client Tax Invoice · Paris & Pakistan Flagship</div>
    </div>
    <div style="text-align:right;">
      <div style="font-weight:600;font-size:14px;">${ord.orderNumber}</div>
      <div class="muted">Status: ${ord.status} · ${ord.paymentMethod.toUpperCase()} (${ord.paymentStatus})</div>
    </div>
  </div>
  <div style="margin-top:20px;font-size:13px;">
    <strong>Deliver To:</strong> ${ord.customerName} (${ord.customerPhone})<br/>
    <span class="muted">${ord.houseNumber}, ${ord.street}, ${ord.area}, ${ord.city}, Pakistan</span>
  </div>
  <table>
    <thead>
      <tr style="text-align:left;color:#737b86;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">
        <th style="padding-bottom:8px;border-bottom:1px solid #16191f;">Piece</th>
        <th style="padding-bottom:8px;border-bottom:1px solid #16191f;text-align:center;">Qty</th>
        <th style="padding-bottom:8px;border-bottom:1px solid #16191f;text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Subtotal</span><span>$${ord.subtotal.toLocaleString()}</span></div>
    <div class="row"><span>Promotional Privilege</span><span>-$${ord.discountTotal.toLocaleString()}</span></div>
    <div class="row"><span>Insured Shipping</span><span>$${ord.shippingFee.toLocaleString()}</span></div>
    <div class="row" style="font-weight:600;font-size:15px;margin-top:8px;"><span>Grand Total</span><span>$${ord.grandTotal.toLocaleString()}</span></div>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AUREVE_Invoice_${ord.orderNumber}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-[1380px] mx-auto px-4 sm:px-6 md:px-12 py-8 sm:py-12 space-y-8 sm:space-y-10 w-full max-w-full overflow-hidden min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#e6ebf0] pb-6">
        <div>
          <div className="text-xs text-[#737b86]">
            {user.email} · Loyalty Balance: <strong className="text-[#16191f] tabular-nums">{loyaltyPoints} pts</strong>
          </div>
          <h1 className="wide text-2xl tracking-[0.14em] mt-1">
            Bonjour, {user.displayName || 'Aurevé Client'}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {isAdmin && (
            <Link
              to="/admin"
              className="px-4 py-2.5 bg-[#16191f] text-white wide text-[10px] tracking-[0.14em] active:opacity-90 touch-manipulation"
            >
              Open Admin Dashboard
            </Link>
          )}
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            className="inline-flex items-center gap-1.5 text-xs text-[#737b86] hover:text-[#16191f] touch-manipulation"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </div>

      {/* Navigation Tabs (Smooth horizontal swipe on mobile, stable height) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none sm:flex-wrap w-full shrink-0">
        {(
          [
            ['profile', 'Profile & Loyalty'],
            ['orders', `My Orders (${myOrders.length})`],
            ['addresses', `Saved Addresses (${savedAddresses.length})`],
            ['security', 'Account Security'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`h-9 px-4 flex items-center justify-center text-xs whitespace-nowrap shrink-0 transition-colors touch-manipulation active:scale-95 ${
              tab === key ? 'bg-[#16191f] text-white' : 'bg-[#f3f6fa] text-[#737b86] hover:text-[#16191f]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab 1: Profile */}
      {tab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateCustomerProfile(displayName || user.displayName || 'Client', phone, optIn);
            }}
            className="lg:col-span-7 space-y-4 border border-[#e6ebf0] p-7"
          >
            <h2 className="wide text-xs tracking-[0.15em]">Personal Details</h2>
            <div>
              <label className="block text-xs text-[#737b86] mb-1">Full Name</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={user.displayName || ''}
                className="w-full border border-[#e6ebf0] px-3.5 py-2.5 text-xs outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-[#737b86] mb-1">Pakistani Mobile (Isolated PII)</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+92 300 1234567"
                className="w-full border border-[#e6ebf0] px-3.5 py-2.5 text-xs outline-none"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-[#737b86] cursor-pointer">
              <input
                type="checkbox"
                checked={optIn}
                onChange={(e) => setOptIn(e.target.checked)}
                className="accent-[#16191f]"
              />
              <span>Receive WhatsApp order & runway dispatches</span>
            </label>
            <div>
              <button
                type="submit"
                className="px-6 py-3 bg-[#16191f] text-white wide text-[10px] tracking-[0.14em]"
              >
                Save Profile
              </button>
            </div>
          </form>

          <div className="lg:col-span-5 bg-[#f3f6fa] p-7 space-y-3">
            <div className="wide text-xs tracking-[0.15em]">AUREVÉ Loyalty Circle</div>
            <div className="text-3xl font-medium tabular-nums pt-2">{loyaltyPoints} Points</div>
            <p className="text-xs text-[#737b86] leading-relaxed">
              Earn 1 AUREVÉ Point for every $10 invested in seasonal couture and accessories. Points
              unlock private trunk show invitations and complimentary tailoring alterations.
            </p>
          </div>
        </div>
      )}

      {/* Tab 2: Orders, Cancellation, Return Requests, Invoice Download */}
      {tab === 'orders' && (
        <div className="space-y-5">
          {myOrders.length === 0 ? (
            <div className="p-14 bg-[#f3f6fa] text-center space-y-3">
              <Package className="w-8 h-8 mx-auto text-[#a4adb8]" />
              <div className="text-xs text-[#737b86]">You have not placed any orders under this account yet.</div>
              <Link to="/shop" className="inline-block px-5 py-2.5 bg-[#16191f] text-white wide text-[10px] tracking-[0.14em]">
                Explore Shop
              </Link>
            </div>
          ) : (
            myOrders.map((ord) => (
              <div key={ord.id} className="border border-[#e6ebf0] p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#f3f6fa] pb-4">
                  <div>
                    <div className="wide text-xs tracking-[0.14em]">{ord.orderNumber}</div>
                    <div className="text-xs text-[#737b86] mt-0.5">
                      {ord.city}, Pakistan · {ord.paymentMethod.toUpperCase()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-medium">{ord.status}</div>
                    <div className="text-sm font-medium tabular-nums mt-0.5">
                      ${ord.grandTotal.toLocaleString()}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-[#737b86]">{ord.itemSummary}</p>

                {expandedOrderId === ord.id && (
                  <div className="bg-[#f3f6fa] p-4 space-y-2 text-xs">
                    <div className="font-medium">
                      Delivery Destination: {ord.houseNumber}, {ord.street}, {ord.area}, {ord.city} ({ord.customerPhone})
                    </div>
                    {loadingOrderItemsId === ord.id ? (
                      <div className="text-[#737b86]">Loading itemized pieces...</div>
                    ) : orderItemsByOrder[ord.id]?.length ? (
                      <div className="divide-y divide-[#e6ebf0] pt-1">
                        {orderItemsByOrder[ord.id].map((li, i) => (
                          <div key={`${li.sku}-${i}`} className="py-2 flex items-center justify-between gap-4">
                            <div>
                              <span className="font-medium">{li.name}</span>
                              <span className="text-[#737b86]">
                                {' '}
                                · {li.sku} · {li.size} · {li.color} · Qty {li.quantity}
                              </span>
                            </div>
                            <span className="tabular-nums font-medium">
                              ${(li.unitPrice * li.quantity).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}

                {ord.returnReason && (
                  <div className="text-xs text-[#737b86] bg-[#f3f6fa] p-3">
                    Return Note: {ord.returnReason}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-4 pt-2 text-xs">
                  <button
                    type="button"
                    onClick={() => toggleOrderDetails(ord)}
                    className="inline-flex items-center gap-1 underline text-[#16191f]"
                  >
                    {expandedOrderId === ord.id ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" /> Hide Details
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" /> Order Details
                      </>
                    )}
                  </button>
                  <Link
                    to={`/track-order?order=${encodeURIComponent(ord.orderNumber)}`}
                    className="underline text-[#16191f]"
                  >
                    Live Tracking
                  </Link>
                  <button
                    type="button"
                    onClick={() => downloadOrderInvoice(ord)}
                    className="inline-flex items-center gap-1 underline text-[#16191f]"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Invoice
                  </button>

                  {ord.status === 'Pending' && (
                    <button
                      type="button"
                      onClick={() => cancelCustomerOrder(ord)}
                      className="underline text-[#737b86] hover:text-[#16191f]"
                    >
                      Cancel Order
                    </button>
                  )}

                  {ord.status === 'Delivered' && (
                    <button
                      type="button"
                      onClick={() => setReturningOrder(ord)}
                      className="underline text-[#16191f]"
                    >
                      Request Return / Exchange
                    </button>
                  )}
                </div>
              </div>
            ))
          )}

          {returningOrder && (
            <div className="border border-[#16191f] p-6 bg-[#f3f6fa] space-y-4">
              <div className="wide text-xs tracking-[0.14em]">
                Return / Exchange Request — {returningOrder.orderNumber}
              </div>
              <textarea
                rows={3}
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Describe reason for return, size exchange, or refund preference..."
                className="w-full bg-white border border-[#e6ebf0] p-3 text-xs outline-none"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    if (!returnReason.trim()) return;
                    await requestCustomerReturn(returningOrder, returnReason);
                    setReturningOrder(null);
                    setReturnReason('');
                  }}
                  className="px-5 py-2.5 bg-[#16191f] text-white wide text-[10px] tracking-[0.14em]"
                >
                  Submit Return Request
                </button>
                <button
                  type="button"
                  onClick={() => setReturningOrder(null)}
                  className="px-4 py-2.5 border border-[#e6ebf0] bg-white text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Saved Addresses */}
      {tab === 'addresses' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-6 space-y-4">
            <h2 className="wide text-xs tracking-[0.15em]">Saved Destinations</h2>
            {savedAddresses.length === 0 ? (
              <p className="text-xs text-[#737b86]">No saved addresses yet.</p>
            ) : (
              savedAddresses.map((addr) => (
                <div key={addr.id} className="border border-[#e6ebf0] p-5 flex justify-between items-start">
                  <div className="text-xs space-y-1">
                    <div className="font-medium flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> {addr.label} — {addr.city}
                    </div>
                    <div className="text-[#737b86]">
                      {addr.recipientName} · {addr.phone}
                    </div>
                    <div className="text-[#737b86]">
                      {addr.houseNumber}, {addr.street}, {addr.area}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteAddressRecord(addr.id)}
                    aria-label="Delete address"
                    className="text-[#737b86] hover:text-[#16191f]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await saveAddressRecord({
                label: addrLabel,
                recipientName: addrName,
                phone: addrPhone,
                city: addrCity,
                area: addrArea,
                street: addrStreet,
                houseNumber: addrHouse,
                isDefault: savedAddresses.length === 0,
              });
              setAddrArea('');
              setAddrStreet('');
              setAddrHouse('');
            }}
            className="lg:col-span-6 border border-[#e6ebf0] p-6 space-y-3"
          >
            <h2 className="wide text-xs tracking-[0.15em]">Add Pakistani Address</h2>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={addrLabel}
                onChange={(e) => setAddrLabel(e.target.value)}
                placeholder="Label (Residence / Office)"
                className="border border-[#e6ebf0] px-3 py-2 text-xs"
              />
              <select
                value={addrCity}
                onChange={(e) => setAddrCity(e.target.value)}
                className="border border-[#e6ebf0] px-3 py-2 text-xs bg-white"
              >
                {PAKISTAN_CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                type="text"
                required
                value={addrName}
                onChange={(e) => setAddrName(e.target.value)}
                placeholder="Recipient Name"
                className="border border-[#e6ebf0] px-3 py-2 text-xs"
              />
              <input
                type="tel"
                required
                value={addrPhone}
                onChange={(e) => setAddrPhone(e.target.value)}
                placeholder="+92 300 1234567"
                className="border border-[#e6ebf0] px-3 py-2 text-xs"
              />
              <input
                type="text"
                required
                value={addrArea}
                onChange={(e) => setAddrArea(e.target.value)}
                placeholder="Area / Phase"
                className="border border-[#e6ebf0] px-3 py-2 text-xs"
              />
              <input
                type="text"
                required
                value={addrHouse}
                onChange={(e) => setAddrHouse(e.target.value)}
                placeholder="House / Apt No."
                className="border border-[#e6ebf0] px-3 py-2 text-xs"
              />
              <input
                type="text"
                required
                value={addrStreet}
                onChange={(e) => setAddrStreet(e.target.value)}
                placeholder="Street / Sector"
                className="col-span-2 border border-[#e6ebf0] px-3 py-2 text-xs"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#16191f] text-white wide text-[10px] tracking-[0.14em]"
            >
              Save Address
            </button>
          </form>
        </div>
      )}

      {/* Tab 4: Security */}
      {tab === 'security' && (
        <div className="max-w-xl border border-[#e6ebf0] p-7 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            <h2 className="wide text-xs tracking-[0.15em]">Zero-Trust Account Security</h2>
          </div>
          <p className="text-xs text-[#737b86] leading-relaxed">
            Email Verified Status: <strong>{user.emailVerified ? 'Verified' : 'Unverified'}</strong>.
            Your contact details and delivery addresses are isolated in a split private Firestore
            subcollection protected by strict owner-only rules.
          </p>
          {user.email && (
            <button
              type="button"
              onClick={() => resetPassword(user.email!)}
              className="px-5 py-2.5 border border-[#16191f] text-xs wide tracking-[0.13em]"
            >
              Send Password Reset Email
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// --- Brand, Contact, FAQ & Policy Pages ---
// --- Brand, Contact, FAQ & Policy Pages ---
export const AboutPage: React.FC = () => (
  <div className="max-w-[1380px] mx-auto px-4 sm:px-6 md:px-12 py-10 sm:py-14 space-y-10 sm:space-y-14 w-full max-w-full overflow-hidden min-w-0">
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
      <div className="lg:col-span-6 space-y-5">
        <div className="text-xs text-[#737b86]">The Atelier · Paris & Pakistan Flagship</div>
        <h1 className="wide text-2xl md:text-3xl tracking-[0.14em] leading-snug">
          A Study in Softness and Architectural Strength
        </h1>
        <p className="text-sm text-[#737b86] leading-relaxed">
          Founded as a contemporary couture house, AUREVÉ unites luminous Italian silks,
          sunburst plisse georgette, and double-faced cashmere with effortless modern proportion.
          Every garment is pattern-cut for fluid movement from runway depth to intimate evening
          gatherings.
        </p>
        <p className="text-sm text-[#737b86] leading-relaxed">
          Our official digital flagship provides insured express delivery to Karachi, Lahore,
          Islamabad, and nationwide across Pakistan with white-glove Cash on Delivery and concierge
          fitting guidance.
        </p>
        <div className="pt-2 flex flex-wrap gap-4">
          <Link to="/" className="px-6 py-3 bg-[#16191f] text-white wide text-[10px] tracking-[0.15em] active:opacity-90 touch-manipulation">
            Experience Runway
          </Link>
          <Link to="/shop" className="px-6 py-3 border border-[#16191f] wide text-[10px] tracking-[0.15em] active:bg-[#f3f6fa] touch-manipulation">
            Browse Boutique
          </Link>
        </div>
      </div>
      <div className="lg:col-span-6 bg-[#f3f6fa] overflow-hidden">
        <img
          src={ATELIER_IMAGE_URL}
          alt="AUREVÉ Parisian Atelier"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover aspect-[4/3]"
        />
      </div>
    </div>
  </div>
);

export const ContactPage: React.FC = () => {
  const { notify } = useStore();
  const [sent, setSent] = useState(false);

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8 min-w-0">
      <div>
        <div className="text-xs text-[#737b86]">Client Concierge</div>
        <h1 className="wide text-2xl tracking-[0.14em] mt-2">Contact AUREVÉ</h1>
        <p className="text-sm text-[#737b86] mt-2">
          Direct WhatsApp Atelier Support: +92 311 2281180 · Email: concierge@aureve.com
        </p>
      </div>

      {sent ? (
        <div className="p-8 bg-[#f3f6fa] text-xs space-y-2">
          <div className="wide tracking-[0.14em]">Inquiry Received</div>
          <p className="text-[#737b86]">An AUREVÉ advisor will respond within 4 business hours.</p>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
            notify('Message Dispatched', 'Our Client Care team has received your note.', 'success');
          }}
          className="space-y-4 border border-[#e6ebf0] p-5 sm:p-7 bg-white"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input required placeholder="Full Name" className="border border-[#e6ebf0] px-3.5 py-2.5 text-xs outline-none focus:border-[#16191f]" />
            <input required type="email" placeholder="Email Address" className="border border-[#e6ebf0] px-3.5 py-2.5 text-xs outline-none focus:border-[#16191f]" />
          </div>
          <input required placeholder="Subject / Order Number" className="w-full border border-[#e6ebf0] px-3.5 py-2.5 text-xs outline-none focus:border-[#16191f]" />
          <textarea required rows={4} placeholder="How may our atelier assist you?" className="w-full border border-[#e6ebf0] px-3.5 py-2.5 text-xs outline-none focus:border-[#16191f]" />
          <button type="submit" className="w-full sm:w-auto px-6 py-3 bg-[#16191f] text-white wide text-[10px] tracking-[0.15em] active:opacity-90 touch-manipulation">
            Send Inquiry
          </button>
        </form>
      )}
    </div>
  );
};

export const PolicyDocumentPage: React.FC<{
  kicker: string;
  title: string;
  sections: { heading: string; body: string }[];
}> = ({ kicker, title, sections }) => (
  <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8 min-w-0">
    <div className="border-b border-[#e6ebf0] pb-6">
      <div className="text-xs text-[#737b86]">{kicker}</div>
      <h1 className="wide text-2xl tracking-[0.14em] mt-2">{title}</h1>
    </div>
    <div className="space-y-6">
      {sections.map((s) => (
        <section key={s.heading} className="space-y-2">
          <h2 className="text-sm font-semibold">{s.heading}</h2>
          <p className="text-xs text-[#737b86] leading-relaxed">{s.body}</p>
        </section>
      ))}
    </div>
  </div>
);
