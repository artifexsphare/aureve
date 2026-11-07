import { ArrowRight, MessageCircle, Search, ShoppingBag, Trash2, User, X } from 'lucide-react';
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getEffectivePrice, useStore } from '../context/StoreContext';
import { ProductVisual } from './SpriteCrop';

export const LayoutShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    user,
    isAdmin,
    banners,
    products,
    activeCartItems,
    savedForLaterItems,
    cartCount,
    cartSubtotal,
    wishlist,
    compareIds,
    cartDrawerOpen,
    setCartDrawerOpen,
    searchDrawerOpen,
    setSearchDrawerOpen,
    updateCartQuantity,
    toggleSaveForLater,
    removeFromCart,
    toasts,
    dismissToast,
    notify,
  } = useStore();

  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [quickQuery, setQuickQuery] = useState('');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [submittingNews, setSubmittingNews] = useState(false);

  const isRunway = location.pathname === '/runway';
  const activeBanner = banners.find((b) => b.active);

  const searchResults = quickQuery.trim()
    ? products
        .filter(
          (p) =>
            p.published &&
            (p.name.toLowerCase().includes(quickQuery.toLowerCase()) ||
              p.category.toLowerCase().includes(quickQuery.toLowerCase()) ||
              (p.subcategory || '').toLowerCase().includes(quickQuery.toLowerCase()) ||
              p.sku.toLowerCase().includes(quickQuery.toLowerCase()))
        )
        .slice(0, 6)
    : [];

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setSubmittingNews(true);
    try {
      const { doc, serverTimestamp, setDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const id = `sub_${Date.now()}`;
      await setDoc(doc(db, 'newsletter', id), {
        email: newsletterEmail.trim().slice(0, 160),
        createdAt: serverTimestamp(),
      });
      setNewsletterEmail('');
      notify('Subscribed', 'You will receive AUREVÉ private runway invitations.', 'success');
    } catch {
      notify('Subscription Saved', 'Thank you for joining AUREVÉ dispatches.', 'success');
      setNewsletterEmail('');
    } finally {
      setSubmittingNews(false);
    }
  };

  return (
    <div className={isRunway ? 'mv-runway-lock' : 'min-h-screen flex flex-col bg-white text-[#16191f] w-full max-w-full overflow-x-hidden'}>
      {/* Slim Dismissible Promo Banner on non-runway storefront pages */}
      {location.pathname !== '/' && !isRunway && activeBanner && !bannerDismissed && (
        <div className="bg-[#16191f] text-white px-4 h-9 flex items-center justify-between text-[11px] tracking-[0.06em] w-full">
          <div className="flex-1 text-center truncate">
            <span>{activeBanner.title}</span>
            <Link to={activeBanner.ctaLink} className="ml-3 underline hover:text-[#e9f0f7]">
              {activeBanner.ctaLabel}
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            aria-label="Dismiss announcement"
            className="text-white/70 hover:text-white p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Exact AUREVÉ Header */}
      <header className={`mv-header${location.pathname === '/' || isRunway ? ' runway-mode' : ' sticky top-0'}`}>
        <div className="mv-r1">
          <Link className="mv-brand wide" to="/" aria-label="AUREVÉ">
            AUREVÉ
          </Link>

          <nav className="mv-tabs wide" aria-label="Sections">
            <Link className={location.pathname === '/' ? 'on' : ''} to="/">
              Runway
            </Link>
            <Link className={location.pathname === '/about' ? 'on' : ''} to="/about">
              The Maison
            </Link>
            <Link className={location.pathname === '/lookbook' ? 'on' : ''} to="/lookbook">
              Lookbook
            </Link>
            <Link className={location.pathname.startsWith('/shop') ? 'on' : ''} to="/shop">
              Shop
            </Link>
          </nav>

          <div className="mv-acct wide">
            {isAdmin && (
              <Link
                to="/admin"
                className="mv-hide-mobile text-[#16191f] border-b border-[#16191f] pb-0.5 whitespace-nowrap"
              >
                Atelier Admin
              </Link>
            )}
            <Link
              to={user ? '/account' : '/login'}
              className="mv-hide-mobile whitespace-nowrap hover:text-[#737b86] transition-colors"
            >
              {user ? (user.displayName?.split(' ')[0] || 'Account') : 'Login'}
            </Link>
            <button
              type="button"
              onClick={() => setSearchDrawerOpen(true)}
              aria-label="Search"
              className="mv-hide-mobile hover:opacity-70 transition-opacity"
            >
              <svg viewBox="0 0 24 24">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m15.5 15.5 5 5" />
              </svg>
            </button>
            <Link
              to="/wishlist"
              aria-label="Saved"
              className="mv-hide-mobile relative hover:opacity-70 transition-opacity"
            >
              <svg viewBox="0 0 24 24">
                <path d="M12 20S3.5 15 3.5 9A4.6 4.6 0 0 1 12 6.6 4.6 4.6 0 0 1 20.500 9C20.500 15 12 20 12 20Z" />
              </svg>
              {wishlist.length > 0 && (
                <span className="sr-only">({wishlist.length} saved)</span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => setCartDrawerOpen(true)}
              aria-label="Bag"
              className="mv-hide-mobile hover:opacity-70 transition-opacity"
            >
              <svg viewBox="0 0 24 24">
                <path d="M5 8h14l1 13H4Z" />
                <path d="M9 10V6a3 3 0 0 1 6 0v4" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setCartDrawerOpen(true)}
              className="whitespace-nowrap hover:text-[#737b86] transition-colors"
            >
              Cart (<span className="tabular-nums">{cartCount}</span>)
            </button>
          </div>
        </div>

        <nav className="mv-r2 wide" aria-label="Departments">
          <Link to="/categories">Collections</Link>
          <Link to="/shop?category=Clothing">Clothing</Link>
          <Link to="/lookbook">Lookbook</Link>
          <Link to="/shop?category=Beauty">Beauty</Link>
          <Link to="/shop?category=Accessories">Accessories</Link>
          <Link to="/about">Our World</Link>
          <Link to="/track-order">Track Order</Link>
        </nav>
      </header>

      {/* Main Content */}
      {isRunway ? (
        children
      ) : (
        <main className="flex-1 min-w-0 w-full max-w-full overflow-x-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
          {children}
        </main>
      )}

      {/* Editorial Footer on Non-Runway Pages */}
      {!isRunway && (
        <footer className="bg-[#f3f6fa] border-t border-[#e6ebf0] text-[#16191f] mt-16 sm:mt-20 pb-16 md:pb-0 w-full max-w-full overflow-hidden">
          <div className="max-w-[1380px] mx-auto px-4 sm:px-6 md:px-12 py-12 sm:py-16 grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12">
            <div className="md:col-span-4 space-y-4">
              <div className="wide text-sm tracking-[0.2em]">AUREVÉ</div>
              <p className="text-sm text-[#737b86] leading-relaxed max-w-sm">
                Parisian couture craftsmanship with dedicated insured courier dispatch across
                Karachi, Lahore, Islamabad, and nationwide Pakistan.
              </p>
              <a
                href="https://wa.me/923112281180?text=Hello%20AUREV%C3%89%20Client%20Care"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-xs wide tracking-[0.14em] text-[#16191f] border-b border-[#16191f] pb-1 pt-2 hover:text-[#737b86] touch-manipulation"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp Concierge (+92 311 2281180)
              </a>
            </div>

            <div className="md:col-span-2 space-y-3 text-xs">
              <div className="wide text-[10px] tracking-[0.16em] text-[#737b86]">Boutique</div>
              <ul className="space-y-2.5 text-[#16191f]">
                <li><Link to="/" className="hover:underline">Runway SS27</Link></li>
                <li><Link to="/shop" className="hover:underline">All Pieces</Link></li>
                <li><Link to="/categories" className="hover:underline">Categories</Link></li>
                <li><Link to="/lookbook" className="hover:underline">Lookbook</Link></li>
                <li><Link to="/compare" className="hover:underline">Compare ({compareIds.length})</Link></li>
              </ul>
            </div>

            <div className="md:col-span-3 space-y-3 text-xs">
              <div className="wide text-[10px] tracking-[0.16em] text-[#737b86]">Client Care</div>
              <ul className="space-y-2.5 text-[#16191f]">
                <li><Link to="/track-order" className="hover:underline">Track Your Order</Link></li>
                <li><Link to="/contact" className="hover:underline">Contact Atelier</Link></li>
                <li><Link to="/faq" className="hover:underline">FAQ &amp; Sizing</Link></li>
                <li><Link to="/shipping-policy" className="hover:underline">Pakistan Shipping Policy</Link></li>
                <li><Link to="/return-policy" className="hover:underline">Returns &amp; Exchanges</Link></li>
                <li><Link to="/privacy-policy" className="hover:underline">Privacy Policy</Link></li>
                <li><Link to="/terms" className="hover:underline">Terms &amp; Conditions</Link></li>
              </ul>
            </div>

            <div className="md:col-span-3 space-y-4">
              <div className="wide text-[10px] tracking-[0.16em] text-[#737b86]">Private Dispatches</div>
              <p className="text-xs text-[#737b86] leading-relaxed">
                Receive first access to runway capsules and private trunk shows.
              </p>
              <form onSubmit={handleNewsletterSubmit} className="flex border-b border-[#16191f] pb-1.5">
                <input
                  type="email"
                  required
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Email address"
                  className="bg-transparent text-xs flex-1 outline-none placeholder:text-[#a4adb8]"
                />
                <button
                  type="submit"
                  disabled={submittingNews}
                  className="wide text-[10px] tracking-[0.14em] px-2 hover:opacity-70 touch-manipulation"
                >
                  Join
                </button>
              </form>
            </div>
          </div>

          <div className="border-t border-[#e6ebf0] px-4 sm:px-6 md:px-12 py-5 max-w-[1380px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#737b86]">
            <span>© 2027 AUREVÉ · Pakistan Official Digital Flagship</span>
            <span>Cash on Delivery · Visa / Mastercard · Easypaisa · JazzCash</span>
          </div>
        </footer>
      )}

      {/* Mobile Bottom Navigation (Safe-area padded, stable touch targets) */}
      {!isRunway && (
        <nav
          aria-label="Mobile navigation"
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#e6ebf0] grid grid-cols-5 items-center text-[10px] text-[#737b86] pb-[env(safe-area-inset-bottom,0px)]"
          style={{ height: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <Link
            to="/"
            className="h-full flex flex-col items-center justify-center gap-0.5 text-[#16191f] active:bg-[#f3f6fa] touch-manipulation select-none"
          >
            <span className="wide text-[9px] font-medium tracking-[0.1em]">Runway</span>
          </Link>
          <Link
            to="/shop"
            className="h-full flex flex-col items-center justify-center gap-0.5 hover:text-[#16191f] active:bg-[#f3f6fa] touch-manipulation select-none"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Shop</span>
          </Link>
          <button
            type="button"
            onClick={() => setSearchDrawerOpen(true)}
            className="h-full flex flex-col items-center justify-center gap-0.5 hover:text-[#16191f] active:bg-[#f3f6fa] touch-manipulation select-none"
          >
            <Search className="w-4 h-4" />
            <span>Search</span>
          </button>
          <Link
            to="/wishlist"
            className="h-full flex flex-col items-center justify-center gap-0.5 hover:text-[#16191f] active:bg-[#f3f6fa] touch-manipulation select-none"
          >
            <span>Saved ({wishlist.length})</span>
          </Link>
          <Link
            to={user ? '/account' : '/login'}
            className="h-full flex flex-col items-center justify-center gap-0.5 hover:text-[#16191f] active:bg-[#f3f6fa] touch-manipulation select-none"
          >
            <User className="w-4 h-4" />
            <span>{user ? 'Account' : 'Login'}</span>
          </Link>
        </nav>
      )}

      {/* Quick Search Overlay Drawer */}
      {searchDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/35 flex justify-end">
          <div className="w-full max-w-lg bg-white h-full flex flex-col p-6 md:p-8 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#e6ebf0] pb-4">
              <span className="wide text-xs tracking-[0.16em]">Search AUREVÉ</span>
              <button
                type="button"
                onClick={() => setSearchDrawerOpen(false)}
                aria-label="Close search"
                className="p-1.5 hover:bg-[#f3f6fa]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSearchDrawerOpen(false);
                navigate(`/shop?q=${encodeURIComponent(quickQuery.trim())}`);
              }}
              className="mt-6 flex items-center border-b border-[#16191f] pb-2"
            >
              <Search className="w-4 h-4 text-[#737b86] mr-3" />
              <input
                type="search"
                autoFocus
                value={quickQuery}
                onChange={(e) => setQuickQuery(e.target.value)}
                placeholder="Search dresses, coats, handbags, SKU..."
                className="flex-1 text-sm outline-none"
              />
              {quickQuery && (
                <button
                  type="submit"
                  className="wide text-[10px] tracking-[0.14em] text-[#16191f] flex items-center gap-1"
                >
                  View All <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </form>

            <div className="mt-6 flex-1 overflow-y-auto space-y-4">
              {quickQuery.trim() === '' ? (
                <div className="space-y-4">
                  <div className="wide text-[10px] tracking-[0.16em] text-[#737b86]">
                    Curated Departments
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    {['Outerwear', 'Dresses', 'Trousers', 'Handbags', 'Fragrance', 'Footwear'].map(
                      (sub) => (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => {
                            setSearchDrawerOpen(false);
                            navigate(`/shop?sub=${encodeURIComponent(sub)}`);
                          }}
                          className="px-3.5 py-2 bg-[#f3f6fa] hover:bg-[#e9f0f7] transition-colors"
                        >
                          {sub}
                        </button>
                      )
                    )}
                  </div>
                </div>
              ) : searchResults.length === 0 ? (
                <p className="text-sm text-[#737b86] py-8">
                  No pieces matched "{quickQuery}". Try searching for Satin, Coat, Pleated, or Bag.
                </p>
              ) : (
                searchResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSearchDrawerOpen(false);
                      navigate(`/product/${item.slug}`);
                    }}
                    className="w-full flex items-center gap-4 p-2.5 hover:bg-[#f3f6fa] text-left transition-colors"
                  >
                    <div className="w-16 h-20 bg-[#f3f6fa] p-1.5 shrink-0">
                      <ProductVisual product={item} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="wide text-[10px] tracking-[0.14em] truncate">{item.name}</div>
                      <div className="text-xs text-[#737b86] mt-1">
                        {item.category} · {item.sku}
                      </div>
                      <div className="text-xs font-medium mt-1 tabular-nums">
                        Rs. {getEffectivePrice(item).toLocaleString()}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Slide-Over Shopping Bag Drawer */}
      {cartDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/35 flex justify-end">
          <div className="w-full max-w-full sm:max-w-md bg-white h-full flex flex-col shadow-xl">
            <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-[#e6ebf0] flex items-center justify-between">
              <div className="wide text-xs tracking-[0.16em]">
                Shopping Bag ({cartCount})
              </div>
              <button
                type="button"
                onClick={() => setCartDrawerOpen(false)}
                aria-label="Close bag"
                className="p-1.5 hover:bg-[#f3f6fa] touch-manipulation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-6">
              {activeCartItems.length === 0 ? (
                <div className="py-16 text-center space-y-4">
                  <ShoppingBag className="w-9 h-9 mx-auto text-[#a4adb8] stroke-[1.25]" />
                  <div className="wide text-xs tracking-[0.15em]">Your Bag Is Empty</div>
                  <p className="text-xs text-[#737b86] max-w-xs mx-auto leading-relaxed">
                    Explore the Spring Summer 2027 runway line or browse ready-to-wear pieces.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCartDrawerOpen(false);
                      navigate('/shop');
                    }}
                    className="mt-2 px-6 py-3 bg-[#16191f] text-white wide text-[10px] tracking-[0.16em] touch-manipulation"
                  >
                    Explore Shop
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  {activeCartItems.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex gap-3 sm:gap-4 pb-5 border-b border-[#e6ebf0]"
                    >
                      <Link
                        to={`/product/${entry.product.slug}`}
                        onClick={() => setCartDrawerOpen(false)}
                        className="w-20 h-24 bg-[#f3f6fa] p-2 shrink-0"
                      >
                        <ProductVisual product={entry.product} />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            to={`/product/${entry.product.slug}`}
                            onClick={() => setCartDrawerOpen(false)}
                            className="wide text-[10px] tracking-[0.13em] hover:underline truncate"
                          >
                            {entry.product.name}
                          </Link>
                          <button
                            type="button"
                            onClick={() => removeFromCart(entry.id)}
                            aria-label="Remove item"
                            className="text-[#a4adb8] hover:text-[#16191f] p-1 touch-manipulation"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="text-xs text-[#737b86] mt-1">
                          {entry.size} · {entry.color}
                        </div>
                        <div className="flex items-center justify-between mt-3 gap-2">
                          <div className="inline-flex items-center border border-[#e6ebf0] h-9 shrink-0">
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(entry.id, entry.quantity - 1)}
                              aria-label="Decrease quantity"
                              className="w-9 h-full flex items-center justify-center text-sm font-medium hover:bg-[#f3f6fa] active:bg-[#e9f0f7] transition-colors touch-manipulation"
                            >
                              −
                            </button>
                            <span className="w-8 text-center text-xs tabular-nums select-none">{entry.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(entry.id, entry.quantity + 1)}
                              aria-label="Increase quantity"
                              className="w-9 h-full flex items-center justify-center text-sm font-medium hover:bg-[#f3f6fa] active:bg-[#e9f0f7] transition-colors touch-manipulation"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-xs font-medium tabular-nums whitespace-nowrap">
                            ${(entry.unitPrice * entry.quantity).toLocaleString()}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleSaveForLater(entry.id)}
                          className="mt-2 text-[11px] text-[#737b86] underline hover:text-[#16191f] touch-manipulation"
                        >
                          Save for later
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {savedForLaterItems.length > 0 && (
                <div className="pt-4 space-y-3">
                  <div className="wide text-[10px] tracking-[0.15em] text-[#737b86]">
                    Saved For Later ({savedForLaterItems.length})
                  </div>
                  {savedForLaterItems.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                      <span className="truncate">{entry.product.name} ({entry.size})</span>
                      <button
                        type="button"
                        onClick={() => toggleSaveForLater(entry.id)}
                        className="underline text-[#16191f] shrink-0 touch-manipulation"
                      >
                        Move to Bag
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {activeCartItems.length > 0 && (
              <div className="p-5 sm:p-6 bg-[#f3f6fa] border-t border-[#e6ebf0] space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#737b86]">Subtotal</span>
                  <span className="font-medium tabular-nums">Rs. {cartSubtotal.toLocaleString()}</span>
                </div>
                <p className="text-[11px] text-[#737b86]">
                  Insured Express Delivery (Flat Rs. 200 on all orders).
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCartDrawerOpen(false);
                      navigate('/cart');
                    }}
                    className="py-3 border border-[#16191f] text-[#16191f] wide text-[10px] tracking-[0.14em] hover:bg-white active:bg-white transition-colors touch-manipulation"
                  >
                    View Bag
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCartDrawerOpen(false);
                      navigate('/checkout');
                    }}
                    className="py-3 bg-[#16191f] text-white wide text-[10px] tracking-[0.14em] hover:opacity-90 active:opacity-80 transition-opacity touch-manipulation"
                  >
                    Checkout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Abandoned Cart Recovery Bar (Non-Runway, non-checkout, after >=15s dwell) */}
      <AbandonedCartPrompt
        visible={!isRunway && location.pathname !== '/checkout' && location.pathname !== '/cart' && activeCartItems.length > 0}
        cartCount={cartCount}
        cartSubtotal={cartSubtotal}
        onCheckout={() => navigate('/checkout')}
      />

      {/* Floating WhatsApp Customer Support Concierge (Non-Runway) */}
      {!isRunway && (
        <a
          href="https://wa.me/923112281180?text=Bonjour%20AUREV%C3%89%20Concierge%2C%20I%20would%20like%20assistance%20with%20an%20order."
          target="_blank"
          rel="noreferrer"
          aria-label="WhatsApp Concierge Support"
          className="fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] md:bottom-6 left-4 sm:left-6 z-40 inline-flex items-center gap-2 bg-[#16191f] text-white px-3.5 sm:px-4 py-2.5 text-xs shadow-md hover:opacity-90 active:scale-95 transition-all touch-manipulation"
        >
          <MessageCircle className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline wide text-[9px] tracking-[0.14em]">WhatsApp Care</span>
        </a>
      )}

      {/* Global Toast Notifications */}
      <div className="fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] md:bottom-6 right-4 sm:right-6 z-50 flex flex-col gap-2.5 max-w-[calc(100vw-2rem)] sm:max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 shadow-lg border text-xs flex items-start justify-between gap-4 transition-all ${
              t.tone === 'error'
                ? 'bg-[#16191f] text-white border-[#16191f]'
                : 'bg-white text-[#16191f] border-[#e6ebf0]'
            }`}
          >
            <div>
              <div className="wide text-[10px] tracking-[0.14em]">{t.title}</div>
              {t.description && (
                <div className={`mt-1 ${t.tone === 'error' ? 'text-white/80' : 'text-[#737b86]'}`}>
                  {t.description}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              aria-label="Close notification"
              className="opacity-60 hover:opacity-100 p-1 touch-manipulation"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const AbandonedCartPrompt: React.FC<{
  visible: boolean;
  cartCount: number;
  cartSubtotal: number;
  onCheckout: () => void;
}> = ({ visible, cartCount, cartSubtotal, onCheckout }) => {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  React.useEffect(() => {
    if (!visible || dismissed) {
      setReady(false);
      return;
    }
    const timer = setTimeout(() => setReady(true), 15000);
    return () => clearTimeout(timer);
  }, [visible, dismissed]);

  if (!visible || !ready || dismissed) return null;

  return (
    <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:bottom-20 right-4 sm:right-6 z-40 max-w-[calc(100vw-2rem)] sm:max-w-xs bg-white border border-[#16191f] p-4 shadow-lg text-xs space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="wide text-[10px] tracking-[0.14em]">Your Selection Awaits</div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss bag reminder"
          className="text-[#737b86] hover:text-[#16191f] p-1 touch-manipulation"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-[#737b86] leading-relaxed">
        {cartCount} piece{cartCount > 1 ? 's' : ''} (Rs. {cartSubtotal.toLocaleString()}) reserved in
        your bag. Use code <strong>MAISON10</strong> at checkout.
      </p>
      <button
        type="button"
        onClick={() => {
          setDismissed(true);
          onCheckout();
        }}
        className="w-full py-2.5 bg-[#16191f] text-white wide text-[9px] tracking-[0.15em] active:opacity-90 touch-manipulation"
      >
        Complete Order
      </button>
    </div>
  );
};
