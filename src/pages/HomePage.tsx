import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  Heart,
  MessageCircle,
  Minus,
  Plus,
  RotateCcw,
  Shield,
  ShoppingBag,
  Sparkles,
  Truck,
  X,
} from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RunwayPage } from '../components/RunwayPage';
import { ModelSpriteSvg, ProductVisual } from '../components/SpriteCrop';
import { getEffectivePrice, useStore } from '../context/StoreContext';
import {
  ATELIER_IMAGE_URL,
  INITIAL_COUPONS,
  MODELS_SHEET_URL,
  MULE_IMAGE_URL,
  PARFUM_IMAGE_URL,
  RUNWAY_LOOKS,
  SCARF_IMAGE_URL,
} from '../data/initialCatalog';
import { Product } from '../types';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const {
    products,
    wishlist,
    toggleWishlist,
    addToCart,
    setCartDrawerOpen,
    recentlyViewedIds,
    recordRecentlyViewed,
    notify,
  } = useStore();

  // Quick View Modal State
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [addingToBag, setAddingToBag] = useState<boolean>(false);

  // New Arrivals Active Tab
  const [arrivalsTab, setArrivalsTab] = useState<'All' | 'Clothing' | 'Accessories' | 'Beauty'>('All');

  // Featured Capsule Look Switcher
  const [activeLookIndex, setActiveLookIndex] = useState<number>(0);

  // Trending Carousel Ref
  const carouselRef = useRef<HTMLDivElement | null>(null);

  // Coupon copy state
  const [copiedCoupon, setCopiedCoupon] = useState<boolean>(false);

  // Newsletter state
  const [newsletterEmail, setNewsletterEmail] = useState<string>('');
  const [subscribing, setSubscribing] = useState<boolean>(false);
  const [newsletterDone, setNewsletterDone] = useState<boolean>(false);

  const published = useMemo(() => products.filter((p) => p.published), [products]);

  // Section 3: New Arrivals (filtered by tab)
  const newArrivals = useMemo(() => {
    return published
      .filter((p) => {
        if (arrivalsTab === 'All') return true;
        return p.category === arrivalsTab;
      })
      .slice(0, 8);
  }, [published, arrivalsTab]);

  // Section 4: Best Sellers
  const bestSellers = useMemo(() => {
    return published.filter((p) => p.bestSeller);
  }, [published]);

  const spotlightBestSeller = bestSellers[0] || published[0];
  const sideBestSellers = bestSellers.slice(1, 5);

  // Section 6: Trending Products
  const trendingProducts = useMemo(() => {
    return published.slice(4, 12);
  }, [published]);

  // Section 8: Special Offers / Sale Products
  const saleProducts = useMemo(() => {
    return published.filter((p) => p.flashSale || (p.salePrice && p.salePrice < p.price));
  }, [published]);

  // Section 9: Recently Viewed or Curated
  const recentlyViewedProducts = useMemo(() => {
    if (recentlyViewedIds && recentlyViewedIds.length > 0) {
      const found = recentlyViewedIds
        .map((id) => published.find((p) => p.id === id))
        .filter((p): p is Product => Boolean(p));
      if (found.length > 0) return found.slice(0, 4);
    }
    // Fallback: curated editorial suggestions
    return published.filter((p) => p.featured).slice(0, 4);
  }, [recentlyViewedIds, published]);

  // Active Look for Capsule section
  const activeLook = RUNWAY_LOOKS[activeLookIndex] || RUNWAY_LOOKS[0];
  const lookProducts = useMemo(() => {
    return activeLook.productIds
      .map((id) => published.find((p) => p.id === id))
      .filter((p): p is Product => Boolean(p));
  }, [activeLook, published]);

  // Handle opening Quick View
  const handleOpenQuickView = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    setQuickViewProduct(product);
    setSelectedSize(product.sizes[0] || '');
    setSelectedColor(product.colors?.[0] || '');
    setQuantity(1);
    recordRecentlyViewed(product.id);
  };

  // Handle Quick View Add to Bag
  const handleQuickAdd = async () => {
    if (!quickViewProduct) return;
    setAddingToBag(true);
    try {
      await addToCart(quickViewProduct.id, quantity, selectedSize, selectedColor);
      setQuickViewProduct(null);
      setCartDrawerOpen(true);
    } catch {
      // error handled in StoreContext notify
    } finally {
      setAddingToBag(false);
    }
  };

  // 1-Click Card Add to Bag
  const handleDirectAdd = async (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    recordRecentlyViewed(product.id);
    await addToCart(product.id, 1, product.sizes[0], product.colors?.[0]);
  };

  // Carousel scroll controls
  const handleScrollCarousel = (direction: 'left' | 'right') => {
    if (!carouselRef.current) return;
    const amount = direction === 'left' ? -340 : 340;
    carouselRef.current.scrollBy({ left: amount, behavior: 'smooth' });
  };

  // Copy Coupon Code
  const handleCopyCoupon = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCoupon(true);
    notify('Coupon Copied', `Code ${code} copied to clipboard.`, 'success');
    setTimeout(() => setCopiedCoupon(false), 2500);
  };

  // Newsletter Submit
  const handleNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setSubscribing(true);
    try {
      const { doc, serverTimestamp, setDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const subId = `sub_${Date.now()}`;
      await setDoc(doc(db, 'newsletter', subId), {
        email: newsletterEmail.trim().toLowerCase().slice(0, 160),
        createdAt: serverTimestamp(),
      });
      setNewsletterDone(true);
      notify('Private Invitation Dispatched', 'Welcome to the AUREVÉ client registry.', 'success');
      setNewsletterEmail('');
    } catch {
      notify('Subscribed', 'Thank you for joining AUREVÉ private dispatches.', 'success');
      setNewsletterDone(true);
      setNewsletterEmail('');
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden bg-white text-[#16191f]">
      {/* =========================================================================
          ORIGINAL AUREVÉ RUNWAY STARTUP / INTRO ANIMATION & DEPTH STAGE
         ========================================================================= */}
      <RunwayPage />

      {/* =========================================================================
          SECTION 1: HERO BANNER (Full-width editorial fashion hero)
         ========================================================================= */}
      <section className="relative w-full bg-[#f6f8fb] border-t border-b border-[#e6ebf0] overflow-hidden">
        {/* Subtle Luxury Atmospheric Background */}
        <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_20%_30%,#eef2f7_0%,transparent_60%)]" />

        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 md:px-12 pt-10 sm:pt-14 pb-10 sm:pb-14 relative z-10">
          <div className="max-w-3xl space-y-6 sm:space-y-8">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2.5 text-xs text-[#737b86]">
                <span className="wide tracking-[0.2em] font-medium text-[#16191f]">
                  SPRING / SUMMER 2027
                </span>
                <span aria-hidden="true">·</span>
                <span className="tracking-wide">PARISIAN ATELIER EDITION</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-normal tracking-[0.06em] text-[#16191f] leading-[1.12]">
                The Architecture of Softness
              </h1>

              <p className="text-sm sm:text-base text-[#57606d] max-w-xl leading-relaxed">
                Weightless silk organza, natural ostrich plumage, and precision-creased Italian
                tailoring. Engineered for fluid modern silhouettes, crafted for a more beautiful
                tomorrow.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-2">
              <Link
                to="/shop"
                className="px-8 py-4 bg-[#16191f] text-white wide text-[11px] tracking-[0.18em] text-center hover:bg-[#282d37] active:scale-[0.99] transition-all touch-manipulation"
              >
                Shop the Collection
              </Link>

              <Link
                to="/lookbook"
                className="px-8 py-4 border border-[#16191f] text-[#16191f] wide text-[11px] tracking-[0.18em] text-center hover:bg-white active:scale-[0.99] transition-all touch-manipulation"
              >
                Explore Lookbook
              </Link>

              <Link
                to="/categories"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-3 text-xs text-[#737b86] hover:text-[#16191f] transition-colors"
              >
                <span>All Categories</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Editorial Highlights Row */}
            <div className="pt-6 sm:pt-8 border-t border-[#e6ebf0] grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs text-[#57606d]">
              <div>
                <div className="wide text-[10px] tracking-[0.14em] text-[#16191f] font-medium">
                  100% MULBERRY SILK
                </div>
                <div className="text-[11px] text-[#737b86] mt-0.5">Heavy Italian Duchesse</div>
              </div>
              <div>
                <div className="wide text-[10px] tracking-[0.14em] text-[#16191f] font-medium">
                  FLAT RS. 200 DELIVERY
                </div>
                <div className="text-[11px] text-[#737b86] mt-0.5">Insured Across Pakistan</div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <div className="wide text-[10px] tracking-[0.14em] text-[#16191f] font-medium">
                  PARIS ATELIER
                </div>
                <div className="text-[11px] text-[#737b86] mt-0.5">Authentic Editions</div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Micro-Bar */}
        <div className="bg-[#16191f] text-white py-3 px-4 text-xs tracking-wider border-t border-white/10">
          <div className="max-w-[1380px] mx-auto flex flex-wrap items-center justify-around gap-4 text-center">
            <span className="flex items-center gap-2 text-[11px] text-white/90">
              <Truck className="w-3.5 h-3.5 text-white/70" />
              <span>Insured Courier Nationwide Delivery — Flat Rs. 200 on All Orders</span>
            </span>
            <span className="hidden md:inline text-white/30">|</span>
            <span className="flex items-center gap-2 text-[11px] text-white/90">
              <Shield className="w-3.5 h-3.5 text-white/70" />
              <span>100% Guaranteed Authentic Atelier Editions</span>
            </span>
            <span className="hidden lg:inline text-white/30">|</span>
            <span className="flex items-center gap-2 text-[11px] text-white/90">
              <RotateCcw className="w-3.5 h-3.5 text-white/70" />
              <span>14-Day Complimentary Return Window</span>
            </span>
            <span className="hidden xl:inline text-white/30">|</span>
            <a
              href="https://wa.me/923112281180?text=Hello%20AUREV%C3%89%20Client%20Care"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-[11px] text-white/90 hover:underline"
            >
              <MessageCircle className="w-3.5 h-3.5 text-[#25d366]" />
              <span>WhatsApp Concierge: +92 311 2281180</span>
            </a>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: SHOP BY CATEGORY (Attractive image-based category cards)
         ========================================================================= */}
      <section className="max-w-[1380px] mx-auto px-4 sm:px-6 md:px-12 py-16 sm:py-20 border-b border-[#e6ebf0]">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <div className="text-xs text-[#737b86]">Atelier Taxonomy</div>
            <h2 className="wide text-xl sm:text-2xl tracking-[0.14em] text-[#16191f] mt-1.5">
              Shop by Category
            </h2>
          </div>
          <Link
            to="/categories"
            className="wide text-[10px] tracking-[0.16em] text-[#16191f] border-b border-[#16191f] pb-0.5 hover:text-[#737b86] self-start sm:self-auto transition-colors"
          >
            Explore All Departments
          </Link>
        </div>

        {/* 3 Main Department Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {/* Card 1: Ready-to-Wear (Clothing) */}
          <Link
            to="/shop?category=Clothing"
            className="group relative bg-[#f3f6fa] border border-[#e6ebf0] overflow-hidden flex flex-col justify-between p-7 sm:p-8 min-h-[380px] hover:border-[#16191f] transition-all"
          >
            <div className="relative z-10 space-y-2">
              <span className="wide text-[9px] tracking-[0.2em] text-[#737b86]">DEPARTMENT 01</span>
              <h3 className="text-xl sm:text-2xl font-medium tracking-wide text-[#16191f]">
                Ready-to-Wear
              </h3>
              <p className="text-xs text-[#57606d] max-w-xs leading-relaxed">
                Sunburst plisse gowns, double-faced wool coats, fluid satin trousers, and sculpted tops.
              </p>
            </div>

            {/* Visual Preview */}
            <div className="my-6 h-48 flex items-center justify-center relative">
              <div className="w-36 h-44 bg-white p-3 border border-[#e6ebf0] group-hover:scale-105 transition-transform duration-300 flex items-center justify-center">
                {published.find((p) => p.id === 'mv-16-1') && (
                  <ProductVisual product={published.find((p) => p.id === 'mv-16-1')!} />
                )}
              </div>
            </div>

            <div className="relative z-10 flex items-center justify-between text-xs pt-4 border-t border-[#e6ebf0]">
              <span className="wide text-[10px] tracking-[0.14em] text-[#16191f]">
                Shop Clothing (8 Silhouettes)
              </span>
              <ArrowRight className="w-4 h-4 text-[#16191f] group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 2: Accessories & Leather Goods */}
          <Link
            to="/shop?category=Accessories"
            className="group relative bg-[#f3f6fa] border border-[#e6ebf0] overflow-hidden flex flex-col justify-between p-7 sm:p-8 min-h-[380px] hover:border-[#16191f] transition-all"
          >
            <div className="relative z-10 space-y-2">
              <span className="wide text-[9px] tracking-[0.2em] text-[#737b86]">DEPARTMENT 02</span>
              <h3 className="text-xl sm:text-2xl font-medium tracking-wide text-[#16191f]">
                Leather &amp; Accessories
              </h3>
              <p className="text-xs text-[#57606d] max-w-xs leading-relaxed">
                Full-grain box calfskin bags, 24k gold-plated brass cinchers, hand-rolled silk scarves, and footwear.
              </p>
            </div>

            {/* Visual Preview */}
            <div className="my-6 h-48 flex items-center justify-center relative">
              <div className="w-36 h-44 bg-white p-3 border border-[#e6ebf0] group-hover:scale-105 transition-transform duration-300 flex items-center justify-center">
                {published.find((p) => p.id === 'mv-17-2') && (
                  <ProductVisual product={published.find((p) => p.id === 'mv-17-2')!} />
                )}
              </div>
            </div>

            <div className="relative z-10 flex items-center justify-between text-xs pt-4 border-t border-[#e6ebf0]">
              <span className="wide text-[10px] tracking-[0.14em] text-[#16191f]">
                Shop Accessories (4 Pieces)
              </span>
              <ArrowRight className="w-4 h-4 text-[#16191f] group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 3: Beauty & Haute Parfumerie */}
          <Link
            to="/shop?category=Beauty"
            className="group relative bg-[#f3f6fa] border border-[#e6ebf0] overflow-hidden flex flex-col justify-between p-7 sm:p-8 min-h-[380px] hover:border-[#16191f] transition-all"
          >
            <div className="relative z-10 space-y-2">
              <span className="wide text-[9px] tracking-[0.2em] text-[#737b86]">DEPARTMENT 03</span>
              <h3 className="text-xl sm:text-2xl font-medium tracking-wide text-[#16191f]">
                Haute Parfumerie
              </h3>
              <p className="text-xs text-[#57606d] max-w-xs leading-relaxed">
                Olfactory editions compounded in Grasse with Florentine iris, cold-pressed Calabrian bergamot, and cedar.
              </p>
            </div>

            {/* Visual Preview */}
            <div className="my-6 h-48 flex items-center justify-center relative">
              <div className="w-36 h-44 bg-white p-3 border border-[#e6ebf0] group-hover:scale-105 transition-transform duration-300 flex items-center justify-center">
                <img
                  src={PARFUM_IMAGE_URL}
                  alt="Lumiere Blanche Eau de Parfum"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div className="relative z-10 flex items-center justify-between text-xs pt-4 border-t border-[#e6ebf0]">
              <span className="wide text-[10px] tracking-[0.14em] text-[#16191f]">
                Discover Fragrance
              </span>
              <ArrowRight className="w-4 h-4 text-[#16191f] group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>

        {/* Subcategory Quick Links Bar */}
        <div className="mt-8 pt-6 border-t border-[#f0f3f6] flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs">
          <span className="text-[#737b86] mr-2">Quick Navigation:</span>
          {['Outerwear', 'Dresses', 'Trousers', 'Tops', 'Skirts', 'Handbags', 'Footwear', 'Fragrance'].map(
            (sub) => (
              <Link
                key={sub}
                to={`/shop?sub=${encodeURIComponent(sub)}`}
                className="px-3.5 py-1.5 bg-[#f6f8fb] border border-[#e6ebf0] text-[#16191f] hover:bg-[#16191f] hover:text-white transition-colors"
              >
                {sub}
              </Link>
            )
          )}
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: NEW ARRIVALS PRODUCT GRID (Real products, hover effects, quick view)
         ========================================================================= */}
      <section className="max-w-[1380px] mx-auto px-4 sm:px-6 md:px-12 py-16 sm:py-20 border-b border-[#e6ebf0]">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="text-xs text-[#737b86]">Spring Summer 2027</div>
            <h2 className="wide text-xl sm:text-2xl tracking-[0.14em] text-[#16191f] mt-1.5">
              New Season Arrivals
            </h2>
          </div>

          {/* Department Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#f3f6fa] border border-[#e6ebf0]">
            {(['All', 'Clothing', 'Accessories', 'Beauty'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setArrivalsTab(tab)}
                className={`px-4 py-2 text-xs font-medium transition-colors ${
                  arrivalsTab === tab
                    ? 'bg-white text-[#16191f] shadow-xs'
                    : 'text-[#737b86] hover:text-[#16191f]'
                }`}
              >
                {tab === 'All' ? 'All Pieces' : tab}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-7">
          {newArrivals.map((prod) => {
            const isSaved = wishlist.includes(prod.id);
            const effPrice = getEffectivePrice(prod);
            const hasSale = effPrice < prod.price;

            return (
              <article
                key={prod.id}
                className="group flex flex-col bg-white border border-[#e6ebf0] hover:border-[#16191f] transition-all"
              >
                {/* Visual Frame */}
                <div className="relative aspect-[3/4] bg-[#f7f9fb] p-6 overflow-hidden flex items-center justify-center">
                  {/* Floating Wishlist Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      toggleWishlist(prod.id);
                    }}
                    aria-label={`Save ${prod.name}`}
                    className="absolute top-3 left-3 z-20 w-8 h-8 rounded-full bg-white/90 backdrop-blur-xs border border-[#e6ebf0] flex items-center justify-center text-[#16191f] hover:bg-white active:scale-90 transition-transform"
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        isSaved ? 'fill-[#d8a7a0] stroke-[#b98179]' : 'stroke-current'
                      }`}
                    />
                  </button>

                  {/* Quick View Button (Desktop hover / mobile available) */}
                  <button
                    type="button"
                    onClick={(e) => handleOpenQuickView(e, prod)}
                    aria-label={`Quick View ${prod.name}`}
                    className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-white/90 backdrop-blur-xs border border-[#e6ebf0] flex items-center justify-center text-[#16191f] hover:bg-white active:scale-90 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                    title="Quick View"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  {/* Product Click Link */}
                  <Link
                    to={`/product/${prod.slug}`}
                    className="w-full h-full flex items-center justify-center"
                  >
                    <div className="w-full h-full flex items-center justify-center transform group-hover:scale-105 transition-transform duration-500">
                      <ProductVisual product={prod} className="w-full h-full max-h-[280px]" />
                    </div>
                  </Link>

                  {/* Stock or Sale Badge */}
                  {prod.stock <= 0 ? (
                    <span className="absolute bottom-3 left-3 z-10 px-2 py-0.5 text-[9px] tracking-[0.14em] font-semibold bg-[#16191f] text-white uppercase">
                      Out of Stock
                    </span>
                  ) : hasSale ? (
                    <span className="absolute bottom-3 left-3 z-10 px-2 py-0.5 text-[9px] tracking-[0.12em] font-medium bg-[#16191f] text-white uppercase">
                      Privilege Offer
                    </span>
                  ) : prod.stock <= (prod.lowStockThreshold || 4) ? (
                    <span className="absolute bottom-3 left-3 z-10 px-2 py-0.5 text-[9px] tracking-[0.12em] font-medium bg-amber-100 text-amber-900 border border-amber-300 uppercase">
                      Low Stock ({prod.stock})
                    </span>
                  ) : null}
                </div>

                {/* Card Meta */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <div className="text-[11px] text-[#737b86] flex items-center gap-1.5">
                      <span>{prod.category}</span>
                      {prod.subcategory && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{prod.subcategory}</span>
                        </>
                      )}
                    </div>
                    <Link
                      to={`/product/${prod.slug}`}
                      className="mt-1 block text-sm font-medium text-[#16191f] hover:underline truncate"
                    >
                      {prod.name}
                    </Link>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#f0f3f6]">
                    <div className="text-sm tabular-nums flex items-baseline gap-2">
                      <span className="font-medium text-[#16191f]">
                        Rs. {effPrice.toLocaleString()}
                      </span>
                      {hasSale && (
                        <span className="text-xs text-[#a4adb8] line-through">
                          Rs. {prod.price.toLocaleString()}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={prod.stock <= 0}
                      onClick={(e) => handleDirectAdd(e, prod)}
                      aria-label={`Add ${prod.name} to cart`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-[#16191f] text-[#16191f] hover:bg-[#16191f] hover:text-white disabled:opacity-30 transition-colors text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-medium">Add</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* View All Bottom CTA */}
        <div className="mt-12 text-center">
          <Link
            to="/shop"
            className="inline-block px-10 py-3.5 border border-[#16191f] text-[#16191f] wide text-[11px] tracking-[0.18em] hover:bg-[#16191f] hover:text-white transition-colors"
          >
            Explore Complete Boutique ({published.length} Pieces)
          </Link>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4: BEST SELLERS (Spotlight product + side cards)
         ========================================================================= */}
      <section className="max-w-[1380px] mx-auto px-4 sm:px-6 md:px-12 py-16 sm:py-20 border-b border-[#e6ebf0]">
        <div className="space-y-2 mb-10 text-center sm:text-left">
          <div className="text-xs text-[#737b86]">Client Favorites</div>
          <h2 className="wide text-xl sm:text-2xl tracking-[0.14em] text-[#16191f]">
            Best Sellers &amp; Archival Icons
          </h2>
          <p className="text-xs text-[#737b86] max-w-xl">
            Pieces that represent the core of AUREVÉ—treasured for their timeless draping and unmatched craftsmanship.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Large Spotlight Card */}
          {spotlightBestSeller && (
            <div className="lg:col-span-5 bg-[#f6f8fb] border border-[#e6ebf0] p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <span className="wide text-[9px] tracking-[0.2em] text-[#737b86]">
                  ICONIC SIGNATURE
                </span>
                <h3 className="text-2xl font-medium tracking-wide mt-1.5">
                  {spotlightBestSeller.name}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-[#737b86] uppercase tracking-wider">
                  <span>{spotlightBestSeller.sku}</span>
                  {spotlightBestSeller.material && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{spotlightBestSeller.material}</span>
                    </>
                  )}
                  {spotlightBestSeller.origin && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{spotlightBestSeller.origin}</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-[#57606d] mt-3 leading-relaxed">
                  {spotlightBestSeller.description}
                </p>
              </div>

              {/* Spotlight Product Image */}
              <div className="my-6 aspect-[4/3] bg-white p-6 border border-[#e6ebf0] flex items-center justify-center overflow-hidden">
                <ProductVisual product={spotlightBestSeller} className="h-full w-auto max-h-[260px]" />
              </div>

              <div className="pt-4 border-t border-[#e6ebf0] flex items-center justify-between">
                <div>
                  <div className="text-xs text-[#737b86]">Exclusive Atelier Price</div>
                  <div className="text-lg font-medium tabular-nums text-[#16191f]">
                    Rs. {getEffectivePrice(spotlightBestSeller).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleOpenQuickView(e, spotlightBestSeller)}
                    className="px-4 py-2.5 border border-[#16191f] text-[#16191f] text-xs font-medium hover:bg-white transition-colors"
                  >
                    Quick View
                  </button>
                  <button
                    type="button"
                    disabled={spotlightBestSeller.stock <= 0}
                    onClick={(e) => handleDirectAdd(e, spotlightBestSeller)}
                    className="px-5 py-2.5 bg-[#16191f] text-white wide text-[10px] tracking-[0.14em] hover:bg-[#282d37] transition-colors"
                  >
                    Add to Bag
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 4 Side Best Sellers Grid */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {sideBestSellers.map((prod) => {
              const effPrice = getEffectivePrice(prod);
              return (
                <article
                  key={prod.id}
                  className="bg-white border border-[#e6ebf0] p-4 flex flex-col justify-between hover:border-[#16191f] transition-all"
                >
                  <div className="relative aspect-square bg-[#f7f9fb] p-4 flex items-center justify-center mb-3">
                    <Link to={`/product/${prod.slug}`} className="w-full h-full flex items-center justify-center">
                      <ProductVisual product={prod} className="w-full h-full max-h-[160px]" />
                    </Link>
                    <button
                      type="button"
                      onClick={(e) => handleOpenQuickView(e, prod)}
                      className="absolute bottom-2 right-2 p-1.5 bg-white/90 border border-[#e6ebf0] text-xs hover:bg-[#16191f] hover:text-white transition-colors"
                      title="Quick View"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div>
                    <div className="text-[10px] text-[#737b86] uppercase tracking-wider">{prod.category}</div>
                    <Link
                      to={`/product/${prod.slug}`}
                      className="block text-xs font-medium text-[#16191f] hover:underline truncate mt-0.5"
                    >
                      {prod.name}
                    </Link>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#f0f3f6] mt-3">
                    <span className="text-xs font-medium tabular-nums">
                      Rs. {effPrice.toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleDirectAdd(e, prod)}
                      className="text-[11px] underline text-[#16191f] hover:opacity-75"
                    >
                      Add to Bag
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 5: BRAND STORY & CRAFTSMANSHIP (Editorial Atelier Narrative)
         ========================================================================= */}
      <section className="relative w-full bg-[#16191f] text-white py-20 sm:py-28 overflow-hidden">
        {/* Background Atmospheric Image with Vignette */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-luminosity filter blur-[1px]"
          style={{ backgroundImage: `url(${ATELIER_IMAGE_URL})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#16191f] via-[#16191f]/90 to-[#16191f]/75" />

        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 md:px-12 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="wide text-[10px] tracking-[0.25em] text-white/70">
                BRAND STORY &amp; ATELIER CRAFTSMANSHIP
              </div>

              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-light tracking-[0.05em] leading-[1.18]">
                Where French Couture Meets Contemporary Grace
              </h2>

              <p className="text-xs sm:text-sm text-white/80 leading-relaxed max-w-xl">
                We believe true luxury is tactile and enduring. Every AUREVÉ garment begins with noble
                natural materials—weightless mulberry silk organza, double-faced virgin wool, and
                full-grain box calfskin—cut and draped by master patternmakers with surgical geometric
                intent.
              </p>

              <div className="pt-4 flex flex-wrap items-center gap-4">
                <Link
                  to="/about"
                  className="px-8 py-3.5 bg-white text-[#16191f] wide text-[11px] tracking-[0.16em] hover:bg-[#e9f0f7] transition-colors"
                >
                  Read The Atelier Story
                </Link>
                <Link
                  to="/lookbook"
                  className="px-8 py-3.5 border border-white text-white wide text-[11px] tracking-[0.16em] hover:bg-white/10 transition-colors"
                >
                  View Runway Lookbook
                </Link>
              </div>
            </div>

            {/* Savoir-Faire Craftsmanship Pillars */}
            <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4">
              <div className="p-5 border border-white/15 bg-white/5 backdrop-blur-xs space-y-1.5">
                <div className="wide text-[9px] tracking-[0.2em] text-white/60">01 · SAVOIR-FAIRE</div>
                <div className="text-sm font-medium tracking-wide text-white">Architectural Draping</div>
                <p className="text-xs text-white/70 leading-relaxed">
                  Each silhouette is sculpted directly on custom atelier forms to achieve fluid movement without rigid boning.
                </p>
              </div>
              <div className="p-5 border border-white/15 bg-white/5 backdrop-blur-xs space-y-1.5">
                <div className="wide text-[9px] tracking-[0.2em] text-white/60">02 · NOBLE TEXTILES</div>
                <div className="text-sm font-medium tracking-wide text-white">Traceable Mill Origins</div>
                <p className="text-xs text-white/70 leading-relaxed">
                  Woven exclusively in historic Como, Lyon, and Biella mills using 100% mulberry silk and virgin wool.
                </p>
              </div>
              <div className="p-5 border border-white/15 bg-white/5 backdrop-blur-xs space-y-1.5">
                <div className="wide text-[9px] tracking-[0.2em] text-white/60">03 · ATELIER FINISH</div>
                <div className="text-sm font-medium tracking-wide text-white">Hand-Rolled &amp; Pressed</div>
                <p className="text-xs text-white/70 leading-relaxed">
                  Finished with hand-rolled edges, custom 24k gold-plated brass hardware, and individual archival numbering.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 6: TRENDING NOW HORIZONTAL PRODUCT CAROUSEL
         ========================================================================= */}
      <section className="max-w-[1380px] mx-auto px-4 sm:px-6 md:px-12 py-16 sm:py-20 border-b border-[#e6ebf0]">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-xs text-[#737b86]">Curated Edit</div>
            <h2 className="wide text-xl sm:text-2xl tracking-[0.14em] text-[#16191f] mt-1">
              Trending Now
            </h2>
          </div>

          {/* Carousel Left/Right Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleScrollCarousel('left')}
              aria-label="Scroll left"
              className="w-9 h-9 border border-[#e6ebf0] hover:border-[#16191f] flex items-center justify-center text-[#16191f] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleScrollCarousel('right')}
              aria-label="Scroll right"
              className="w-9 h-9 border border-[#e6ebf0] hover:border-[#16191f] flex items-center justify-center text-[#16191f] transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Carousel Track */}
        <div
          ref={carouselRef}
          className="flex gap-6 overflow-x-auto pb-4 scrollbar-none snap-x snap-mandatory"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {trendingProducts.map((prod) => {
            const effPrice = getEffectivePrice(prod);
            const isSaved = wishlist.includes(prod.id);

            return (
              <div
                key={prod.id}
                className="w-[260px] sm:w-[290px] shrink-0 snap-start bg-white border border-[#e6ebf0] hover:border-[#16191f] transition-all flex flex-col justify-between"
              >
                <div className="relative aspect-[3/4] bg-[#f7f9fb] p-5 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      toggleWishlist(prod.id);
                    }}
                    aria-label={`Save ${prod.name}`}
                    className="absolute top-2.5 left-2.5 z-10 w-7 h-7 rounded-full bg-white/90 border border-[#e6ebf0] flex items-center justify-center text-[#16191f]"
                  >
                    <Heart
                      className={`w-3.5 h-3.5 ${
                        isSaved ? 'fill-[#d8a7a0] stroke-[#b98179]' : 'stroke-current'
                      }`}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleOpenQuickView(e, prod)}
                    className="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full bg-white/90 border border-[#e6ebf0] flex items-center justify-center text-[#16191f]"
                    title="Quick View"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>

                  <Link to={`/product/${prod.slug}`} className="w-full h-full flex items-center justify-center">
                    <ProductVisual product={prod} className="max-h-[200px]" />
                  </Link>
                </div>

                <div className="p-4 space-y-2">
                  <div className="text-[10px] text-[#737b86] uppercase tracking-wider">
                    {prod.category} · {prod.subcategory || 'Atelier'}
                  </div>
                  <Link
                    to={`/product/${prod.slug}`}
                    className="block text-xs font-medium text-[#16191f] hover:underline truncate"
                  >
                    {prod.name}
                  </Link>
                  <div className="flex items-center justify-between pt-2 border-t border-[#f0f3f6]">
                    <span className="text-xs font-medium tabular-nums">
                      Rs. {effPrice.toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleDirectAdd(e, prod)}
                      className="text-[11px] font-medium text-[#16191f] underline hover:opacity-75"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* =========================================================================
          SECTION 7: FEATURED COLLECTION (Interactive Runway Look Switcher)
         ========================================================================= */}
      <section className="max-w-[1380px] mx-auto px-4 sm:px-6 md:px-12 py-16 sm:py-20 border-b border-[#e6ebf0]">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-xs text-[#737b86]">Runway Capsule</div>
            <h2 className="wide text-xl sm:text-2xl tracking-[0.14em] text-[#16191f] mt-1">
              The Runway Series: Spring Summer 2027
            </h2>
            <p className="text-xs text-[#737b86] max-w-lg mt-1">
              Select a look below to explore the complete runway ensemble and constituent atelier garments.
            </p>
          </div>

          <Link
            to="/lookbook"
            className="wide text-[10px] tracking-[0.16em] text-[#16191f] border-b border-[#16191f] pb-0.5 hover:text-[#737b86] self-start sm:self-auto transition-colors"
          >
            Complete Lookbook Archive
          </Link>
        </div>

        {/* Look Switcher Tab Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-8 scrollbar-none">
          {RUNWAY_LOOKS.map((lk, idx) => (
            <button
              key={lk.lookNumber}
              type="button"
              onClick={() => setActiveLookIndex(idx)}
              className={`px-4 py-2 text-xs transition-all whitespace-nowrap border ${
                activeLookIndex === idx
                  ? 'bg-[#16191f] text-white border-[#16191f]'
                  : 'bg-[#f6f8fb] text-[#737b86] border-[#e6ebf0] hover:text-[#16191f]'
              }`}
            >
              <span className="wide tracking-[0.12em]">Look {lk.lookNumber}</span>
              <span className="ml-2 opacity-70">({lk.title.split(' ')[0]})</span>
            </button>
          ))}
        </div>

        {/* Active Look Ensemble Display */}
        <div className="bg-[#f7f9fb] border border-[#e6ebf0] p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left: Model Silhouette Preview */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center bg-white p-6 border border-[#e6ebf0] min-h-[380px]">
            <ModelSpriteSvg x0={activeLook.x0} x1={activeLook.x1} className="h-80 w-auto" />
            <div className="mt-4 text-center">
              <span className="wide text-[10px] tracking-[0.18em] text-[#737b86]">
                OFFICIAL RUNWAY LOOK {activeLook.lookNumber}
              </span>
              <h3 className="text-sm font-medium text-[#16191f] mt-1">{activeLook.title}</h3>
            </div>
          </div>

          {/* Right: The 2 Component Pieces */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-2">
              <span className="wide text-[10px] tracking-[0.18em] text-[#737b86]">
                STYLING NOTES
              </span>
              <h3 className="text-xl font-medium tracking-wide">{activeLook.title}</h3>
              <p className="text-xs text-[#57606d] leading-relaxed max-w-xl">
                {activeLook.notes}
              </p>
            </div>

            <div className="border-t border-[#e6ebf0] pt-6 space-y-4">
              <div className="wide text-[10px] tracking-[0.16em] text-[#16191f]">
                CONSTITUENT PIECES IN THIS LOOK
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {lookProducts.map((piece) => {
                  const effPrice = getEffectivePrice(piece);
                  return (
                    <div
                      key={piece.id}
                      className="bg-white border border-[#e6ebf0] p-4 flex gap-3.5 items-center justify-between"
                    >
                      <div className="w-16 h-20 bg-[#f7f9fb] p-1.5 shrink-0 flex items-center justify-center">
                        <ProductVisual product={piece} className="max-h-[70px]" />
                      </div>

                      <div className="flex-1 min-w-0 pr-2">
                        <Link
                          to={`/product/${piece.slug}`}
                          className="block text-xs font-medium text-[#16191f] hover:underline truncate"
                        >
                          {piece.name}
                        </Link>
                        <div className="text-[11px] text-[#737b86] mt-0.5">{piece.category}</div>
                        <div className="text-xs font-medium tabular-nums mt-1">
                          Rs. {effPrice.toLocaleString()}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDirectAdd(e, piece)}
                        className="px-3 py-1.5 bg-[#16191f] text-white text-[10px] wide tracking-wider hover:bg-[#282d37] transition-colors shrink-0"
                      >
                        + Bag
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2">
              <Link
                to={`/shop?look=${activeLook.lookNumber}`}
                className="inline-flex items-center gap-2 text-xs text-[#16191f] font-medium underline hover:text-[#737b86]"
              >
                <span>Shop All Items from Look {activeLook.lookNumber}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 8: SPECIAL OFFERS / SALE COLLECTION & PRIVILEGE VOUCHER
         ========================================================================= */}
      <section className="max-w-[1380px] mx-auto px-4 sm:px-6 md:px-12 py-16 sm:py-20 border-b border-[#e6ebf0]">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div>
            <div className="text-xs text-[#737b86]">Curated Reductions</div>
            <h2 className="wide text-xl sm:text-2xl tracking-[0.14em] text-[#16191f] mt-1">
              Private Seasonal Offers
            </h2>
          </div>

          {/* Promotional Coupon Callout */}
          <div className="bg-[#f6f8fb] border border-[#e6ebf0] px-4 py-2.5 flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-[#9c6a1e]" />
            <span className="text-xs text-[#57606d]">
              Privilege Code: <strong className="text-[#16191f] font-mono">MAISON10</strong> (10% off &gt; Rs. 500)
            </span>
            <button
              type="button"
              onClick={() => handleCopyCoupon('MAISON10')}
              className="px-2.5 py-1 bg-[#16191f] text-white text-[10px] wide tracking-wider hover:opacity-90 flex items-center gap-1"
            >
              {copiedCoupon ? <Check className="w-3 h-3 text-[#58d68d]" /> : <Copy className="w-3 h-3" />}
              <span>{copiedCoupon ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Sale Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {saleProducts.map((prod) => {
            const effPrice = getEffectivePrice(prod);
            const savings = prod.price - effPrice;

            return (
              <article
                key={prod.id}
                className="bg-white border border-[#e6ebf0] hover:border-[#16191f] transition-all flex flex-col justify-between"
              >
                <div className="relative aspect-[4/3] bg-[#f7f9fb] p-6 flex items-center justify-center">
                  <span className="absolute top-3 left-3 px-2 py-0.5 text-[9px] tracking-wider font-semibold bg-[#16191f] text-white uppercase">
                    Save Rs. {savings.toLocaleString()}
                  </span>

                  <Link to={`/product/${prod.slug}`} className="w-full h-full flex items-center justify-center">
                    <ProductVisual product={prod} className="max-h-[190px]" />
                  </Link>

                  <button
                    type="button"
                    onClick={(e) => handleOpenQuickView(e, prod)}
                    className="absolute top-3 right-3 p-1.5 bg-white border border-[#e6ebf0] text-xs hover:bg-[#16191f] hover:text-white transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-5 space-y-3">
                  <div>
                    <div className="text-[10px] text-[#737b86] uppercase tracking-wider">{prod.category}</div>
                    <Link
                      to={`/product/${prod.slug}`}
                      className="block text-sm font-medium text-[#16191f] hover:underline truncate mt-0.5"
                    >
                      {prod.name}
                    </Link>
                  </div>

                  <div className="flex items-baseline gap-2 tabular-nums">
                    <span className="text-base font-semibold text-[#16191f]">
                      Rs. {effPrice.toLocaleString()}
                    </span>
                    <span className="text-xs text-[#a4adb8] line-through">
                      Rs. {prod.price.toLocaleString()}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleDirectAdd(e, prod)}
                    className="w-full py-2.5 border border-[#16191f] text-[#16191f] wide text-[10px] tracking-[0.14em] hover:bg-[#16191f] hover:text-white transition-colors"
                  >
                    Add to Bag
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* =========================================================================
          SECTION 9: RECENTLY VIEWED PRODUCTS
         ========================================================================= */}
      <section className="max-w-[1380px] mx-auto px-4 sm:px-6 md:px-12 py-16 sm:py-20 border-b border-[#e6ebf0]">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="text-xs text-[#737b86]">Personalized Atelier History</div>
            <h2 className="wide text-lg sm:text-xl tracking-[0.14em] text-[#16191f] mt-1">
              Recently Viewed &amp; Recommendations
            </h2>
          </div>
          <Link to="/shop" className="text-xs underline text-[#737b86] hover:text-[#16191f]">
            Browse All
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          {recentlyViewedProducts.map((prod) => (
            <article
              key={prod.id}
              className="bg-white border border-[#e6ebf0] p-3 sm:p-4 flex flex-col justify-between hover:border-[#16191f] transition-all"
            >
              <Link
                to={`/product/${prod.slug}`}
                className="aspect-square bg-[#f7f9fb] p-3 flex items-center justify-center mb-2.5"
              >
                <ProductVisual product={prod} className="max-h-[140px]" />
              </Link>

              <div>
                <Link
                  to={`/product/${prod.slug}`}
                  className="block text-xs font-medium text-[#16191f] hover:underline truncate"
                >
                  {prod.name}
                </Link>
                <div className="text-xs text-[#57606d] mt-1 tabular-nums">
                  Rs. {getEffectivePrice(prod).toLocaleString()}
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => handleDirectAdd(e, prod)}
                className="mt-3 w-full py-1.5 border border-[#e6ebf0] text-[#16191f] text-[10px] wide tracking-wider hover:border-[#16191f] transition-colors"
              >
                + Add
              </button>
            </article>
          ))}
        </div>
      </section>

      {/* =========================================================================
          SECTION 10: NEWSLETTER SUBSCRIPTION SECTION
         ========================================================================= */}
      <section className="bg-[#f6f8fb] border-b border-[#e6ebf0] py-16 sm:py-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center space-y-4">
          <div className="wide text-[10px] tracking-[0.25em] text-[#737b86]">
            PRIVATE CLIENT REGISTRY
          </div>

          <h2 className="text-2xl sm:text-3xl font-light tracking-[0.06em] text-[#16191f]">
            AUREVÉ Private Dispatches
          </h2>

          <p className="text-xs sm:text-sm text-[#57606d] leading-relaxed">
            Receive first invitations to runway capsules, private atelier trunk shows, and seasonal
            privilege dispatches directly to your inbox.
          </p>

          {newsletterDone ? (
            <div className="p-4 bg-white border border-[#2d7a4d] text-xs text-[#1e5636] flex items-center justify-center gap-2">
              <Check className="w-4 h-4 text-[#2d7a4d]" />
              <span>Thank you. Your email is registered for private AUREVÉ invitations.</span>
            </div>
          ) : (
            <form onSubmit={handleNewsletter} className="mt-6 flex flex-col sm:flex-row gap-2.5 max-w-md mx-auto">
              <input
                type="email"
                required
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder="Enter your email address"
                className="flex-1 px-4 py-3 bg-white border border-[#e6ebf0] text-xs outline-none focus:border-[#16191f]"
              />
              <button
                type="submit"
                disabled={subscribing}
                className="px-7 py-3 bg-[#16191f] text-white wide text-[10px] tracking-[0.16em] hover:bg-[#282d37] transition-colors"
              >
                {subscribing ? 'Subscribing...' : 'Join Dispatches'}
              </button>
            </form>
          )}

          <div className="pt-4 flex items-center justify-center gap-6 text-[11px] text-[#737b86]">
            <span>✓ Private Trunk Show Access</span>
            <span>✓ Complied PII Isolation</span>
            <span>✓ Unsubscribe Anytime</span>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 11: QUICK VIEW MODAL (Luxury interactive inspection & bag addition)
         ========================================================================= */}
      {quickViewProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white border border-[#e6ebf0] w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 shadow-2xl">
            {/* Close Modal Button */}
            <button
              type="button"
              onClick={() => setQuickViewProduct(null)}
              aria-label="Close modal"
              className="absolute top-4 right-4 p-2 text-[#737b86] hover:text-[#16191f] hover:bg-[#f3f6fa] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              {/* Product Visual */}
              <div className="aspect-[3/4] bg-[#f7f9fb] p-6 border border-[#e6ebf0] flex items-center justify-center">
                <ProductVisual product={quickViewProduct} className="max-h-[340px]" />
              </div>

              {/* Product Specification & Purchase */}
              <div className="space-y-5">
                <div>
                  <div className="text-[11px] text-[#737b86] uppercase tracking-wider">
                    {quickViewProduct.category} · {quickViewProduct.sku}
                  </div>
                  <h3 className="text-xl sm:text-2xl font-medium tracking-wide mt-1 text-[#16191f]">
                    {quickViewProduct.name}
                  </h3>
                  <div className="text-base font-semibold tabular-nums mt-2 text-[#16191f]">
                    Rs. {getEffectivePrice(quickViewProduct).toLocaleString()}
                    {getEffectivePrice(quickViewProduct) < quickViewProduct.price && (
                      <span className="ml-2 text-xs text-[#a4adb8] line-through font-normal">
                        Rs. {quickViewProduct.price.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-[#57606d] leading-relaxed">
                  {quickViewProduct.description}
                </p>

                {/* Stock Indicator */}
                <div className="text-xs">
                  {quickViewProduct.stock > 0 ? (
                    <span className="text-[#2d7a4d] flex items-center gap-1.5 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2d7a4d]" />
                      In Stock ({quickViewProduct.stock} pieces available)
                    </span>
                  ) : (
                    <span className="text-[#e04343] font-medium">Out of Stock</span>
                  )}
                </div>

                {/* Size Selector */}
                {quickViewProduct.sizes && quickViewProduct.sizes.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-xs text-[#737b86]">Select Size</label>
                    <div className="flex flex-wrap gap-2">
                      {quickViewProduct.sizes.map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setSelectedSize(sz)}
                          className={`px-3 py-1.5 text-xs border transition-colors ${
                            selectedSize === sz
                              ? 'bg-[#16191f] text-white border-[#16191f]'
                              : 'bg-white border-[#e6ebf0] text-[#16191f] hover:border-[#16191f]'
                          }`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quantity and Add to Bag */}
                <div className="pt-2 space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center border border-[#e6ebf0]">
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="p-2 hover:bg-[#f3f6fa]"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-3 text-xs tabular-nums">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.min(quickViewProduct.stock, q + 1))}
                        className="p-2 hover:bg-[#f3f6fa]"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={quickViewProduct.stock <= 0 || addingToBag}
                      onClick={handleQuickAdd}
                      className="flex-1 py-3 bg-[#16191f] text-white wide text-[10px] tracking-[0.16em] hover:bg-[#282d37] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>{addingToBag ? 'Adding...' : 'Add to Shopping Bag'}</span>
                    </button>
                  </div>

                  <Link
                    to={`/product/${quickViewProduct.slug}`}
                    onClick={() => setQuickViewProduct(null)}
                    className="block text-center text-xs underline text-[#737b86] hover:text-[#16191f]"
                  >
                    View Full Product Specifications &amp; Reviews →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
