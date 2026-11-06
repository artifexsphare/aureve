import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { ArrowLeftRight, Check, Heart, Plus, Search, SlidersHorizontal, Star, ZoomIn } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ModelSpriteSvg, ProductVisual } from '../components/SpriteCrop';
import { getEffectivePrice, useStore } from '../context/StoreContext';
import { RUNWAY_LOOKS } from '../data/initialCatalog';
import { OperationType, db, handleFirestoreError } from '../firebase';
import { Product, ReviewRecord } from '../types';

export const ProductCard: React.FC<{ product: Product }> = ({ product }) => {
  const { wishlist, toggleWishlist, addToCart, compareIds, toggleCompare } = useStore();
  const isSaved = wishlist.includes(product.id);
  const isCompared = compareIds.includes(product.id);
  const effectivePrice = getEffectivePrice(product);
  const hasDiscount = effectivePrice < product.price;

  return (
    <article className="group flex flex-col bg-white border border-[#e6ebf0] md:transition-transform md:duration-200 md:hover:-translate-y-0.5">
      <div className="relative aspect-[3/4] bg-[#f3f6fa] p-5 sm:p-6 overflow-hidden flex items-center justify-center">
        <button
          type="button"
          onClick={() => toggleWishlist(product.id)}
          aria-pressed={isSaved}
          aria-label={`Save ${product.name}`}
          className="absolute top-3 left-3 z-10 w-9 h-9 flex items-center justify-center text-[#16191f] hover:opacity-75 active:scale-90 transition-transform touch-manipulation"
        >
          <Heart
            className={`w-4 h-4 ${isSaved ? 'fill-[#d8a7a0] stroke-[#b98179]' : 'stroke-current'}`}
          />
        </button>

        <button
          type="button"
          onClick={() => toggleCompare(product.id)}
          aria-label={`Compare ${product.name}`}
          title="Compare specifications"
          className={`absolute top-3 right-3 z-10 w-9 h-9 flex items-center justify-center text-xs active:scale-90 transition-transform touch-manipulation ${
            isCompared ? 'opacity-100 text-[#16191f]' : 'opacity-80 md:opacity-0 md:group-hover:opacity-80 text-[#737b86]'
          }`}
        >
          <ArrowLeftRight className="w-4 h-4" />
        </button>

        <Link to={`/product/${product.slug}`} className="w-full h-full flex items-center justify-center">
          <ProductVisual product={product} className="w-full h-full max-h-[300px]" />
        </Link>

        {product.stock <= 0 ? (
          <span className="absolute top-3 right-3 z-10 px-2.5 py-1 text-[10px] tracking-[0.14em] font-semibold bg-[#16191f] text-white uppercase shadow-sm">
            Out of Stock
          </span>
        ) : product.stock <= (product.lowStockThreshold || 5) ? (
          <span className="absolute top-3 right-3 z-10 px-2 py-0.5 text-[9px] tracking-[0.12em] font-semibold bg-amber-100 text-amber-900 uppercase border border-amber-300">
            Low Stock ({product.stock})
          </span>
        ) : product.flashSale ? (
          <span className="absolute bottom-3 left-4 text-[11px] text-[#16191f]">
            Private Seasonal Offer
          </span>
        ) : null}
      </div>

      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3">
        <div>
          <div className="text-[11px] text-[#737b86] flex items-center gap-1.5 flex-wrap">
            <span>{product.category}</span>
            {product.subcategory && (
              <>
                <span aria-hidden="true">·</span>
                <span>{product.subcategory}</span>
              </>
            )}
            {product.lookNumber && (
              <>
                <span aria-hidden="true">·</span>
                <span>Look {product.lookNumber}</span>
              </>
            )}
          </div>
          <Link
            to={`/product/${product.slug}`}
            className="mt-1.5 block text-sm font-medium text-[#16191f] hover:underline"
          >
            {product.name}
          </Link>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#f3f6fa]">
          <div className="text-sm tabular-nums flex items-center gap-2">
            <span className="font-medium text-[#16191f]">Rs. {effectivePrice.toLocaleString()}</span>
            {hasDiscount && (
              <span className="text-xs text-[#a4adb8] line-through">
                Rs. {product.price.toLocaleString()}
              </span>
            )}
          </div>
          <button
            type="button"
            disabled={product.stock <= 0}
            onClick={() => addToCart(product.id, 1)}
            aria-label={`Add ${product.name} to bag`}
            className="w-9 h-9 flex items-center justify-center text-[#16191f] hover:bg-[#f3f6fa] active:bg-[#e9f0f7] active:scale-90 disabled:opacity-30 transition-all touch-manipulation"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </article>
  );
};

// --- Shop Catalog Page ---
export const ShopPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { products, catalogLoading, categories, compareIds } = useStore();

  const initialCat = searchParams.get('category') || 'All';
  const initialSub = searchParams.get('sub') || 'All';
  const initialLook = searchParams.get('look') || '';
  const initialQ = searchParams.get('q') || '';

  const [selectedCategory, setSelectedCategory] = useState(initialCat);
  const [selectedSub, setSelectedSub] = useState(initialSub);
  const [lookFilter, setLookFilter] = useState(initialLook);
  const [searchQuery, setSearchQuery] = useState(initialQ);
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'rating'>('featured');
  const [onlyOffers, setOnlyOffers] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number>(3500);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setSelectedCategory(searchParams.get('category') || 'All');
    setSelectedSub(searchParams.get('sub') || 'All');
    setLookFilter(searchParams.get('look') || '');
    setSearchQuery(searchParams.get('q') || '');
    setPage(1);
  }, [searchParams]);

  const publishedProducts = useMemo(() => products.filter((p) => p.published), [products]);

  const filtered = useMemo(() => {
    return publishedProducts
      .filter((p) => {
        if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;
        if (selectedSub !== 'All' && p.subcategory !== selectedSub) return false;
        if (lookFilter && String(p.lookNumber || '') !== lookFilter) return false;
        if (onlyOffers && !p.flashSale && !(p.salePrice && p.salePrice < p.price)) return false;
        const eff = getEffectivePrice(p);
        if (eff > maxPrice) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const match =
            p.name.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q) ||
            (p.subcategory || '').toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return getEffectivePrice(a) - getEffectivePrice(b);
        if (sortBy === 'price-desc') return getEffectivePrice(b) - getEffectivePrice(a);
        if (sortBy === 'rating') return (b.ratingAvg || 0) - (a.ratingAvg || 0);
        return Number(Boolean(b.featured)) - Number(Boolean(a.featured));
      });
  }, [publishedProducts, selectedCategory, selectedSub, lookFilter, onlyOffers, maxPrice, searchQuery, sortBy]);

  const PAGE_SIZE = 9;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeCategoryObj = categories.find((c) => c.name === selectedCategory);

  return (
    <div className="max-w-[1380px] mx-auto px-4 sm:px-6 md:px-12 py-8 sm:py-10 w-full max-w-full overflow-hidden min-w-0">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 sm:pb-8 border-b border-[#e6ebf0]">
        <div>
          <div className="text-xs text-[#737b86]">Spring Summer 2027 · Digital Boutique</div>
          <h1 className="wide text-xl md:text-2xl tracking-[0.14em] mt-2">
            {lookFilter ? `Runway Look ${lookFilter}` : selectedCategory === 'All' ? 'All Pieces' : selectedCategory}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center border border-[#e6ebf0] px-3 py-2 bg-white w-full sm:w-auto">
            <Search className="w-3.5 h-3.5 text-[#737b86] mr-2 shrink-0" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Filter pieces or SKU..."
              className="text-xs outline-none w-full sm:w-44"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            aria-label="Sort products"
            className="text-xs border border-[#e6ebf0] px-3 py-2 bg-white outline-none"
          >
            <option value="featured">Featured Order</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="rating">Client Rating</option>
          </select>

          {compareIds.length > 0 && (
            <Link
              to="/compare"
              className="px-3.5 py-2 bg-[#16191f] text-white text-xs whitespace-nowrap active:opacity-90 touch-manipulation"
            >
              Compare ({compareIds.length})
            </Link>
          )}
        </div>
      </div>

      {/* Interactive Filter Controls */}
      <div className="py-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#f3f6fa]">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none sm:flex-wrap w-full">
          {['All', ...categories.map((c) => c.name)].map((catName) => (
            <button
              key={catName}
              type="button"
              onClick={() => {
                setSelectedCategory(catName);
                setSelectedSub('All');
                setLookFilter('');
                setSearchParams(catName === 'All' ? {} : { category: catName });
              }}
              className={`h-8 px-3.5 flex items-center justify-center text-xs transition-colors whitespace-nowrap shrink-0 touch-manipulation active:scale-95 ${
                selectedCategory === catName
                  ? 'bg-[#16191f] text-white'
                  : 'bg-[#f3f6fa] text-[#737b86] hover:text-[#16191f]'
              }`}
            >
              {catName}
            </button>
          ))}

          {activeCategoryObj &&
            activeCategoryObj.subcategories.map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => setSelectedSub(selectedSub === sub ? 'All' : sub)}
                className={`h-8 px-3 flex items-center justify-center text-xs border transition-colors whitespace-nowrap shrink-0 touch-manipulation active:scale-95 ${
                  selectedSub === sub
                    ? 'border-[#16191f] text-[#16191f]'
                    : 'border-[#e6ebf0] text-[#737b86] hover:text-[#16191f]'
                }`}
              >
                {sub}
              </button>
            ))}
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:gap-5 text-xs text-[#737b86]">
          <label className="inline-flex items-center gap-2 cursor-pointer touch-manipulation">
            <input
              type="checkbox"
              checked={onlyOffers}
              onChange={(e) => {
                setOnlyOffers(e.target.checked);
                setPage(1);
              }}
              className="accent-[#16191f]"
            />
            <span className="whitespace-nowrap">Seasonal Privileges Only</span>
          </label>

          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">Max Rs. {maxPrice.toLocaleString()}</span>
            <input
              type="range"
              min={300}
              max={3500}
              step={100}
              value={maxPrice}
              onChange={(e) => {
                setMaxPrice(Number(e.target.value));
                setPage(1);
              }}
              className="w-20 sm:w-24 accent-[#16191f]"
            />
          </div>

          {(lookFilter || searchQuery || selectedCategory !== 'All' || onlyOffers || maxPrice < 3500) && (
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('All');
                setSelectedSub('All');
                setLookFilter('');
                setSearchQuery('');
                setOnlyOffers(false);
                setMaxPrice(3500);
                setSearchParams({});
              }}
              className="underline text-[#16191f] touch-manipulation"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Grid with Loading Skeletons */}
      {catalogLoading && products.length === 0 ? (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border border-[#e6ebf0] bg-white animate-pulse">
              <div className="aspect-[3/4] bg-[#f3f6fa]" />
              <div className="p-5 space-y-3">
                <div className="h-3 w-24 bg-[#f3f6fa]" />
                <div className="h-4 w-48 bg-[#e6ebf0]" />
                <div className="h-4 w-20 bg-[#f3f6fa]" />
              </div>
            </div>
          ))}
        </div>
      ) : paginated.length === 0 ? (
        <div className="py-20 text-center space-y-3">
          <p className="text-sm text-[#737b86]">No pieces match your current selection.</p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('All');
              setSelectedSub('All');
              setLookFilter('');
              setSearchQuery('');
              setOnlyOffers(false);
              setMaxPrice(3500);
              setSearchParams({});
            }}
            className="px-5 py-2.5 bg-[#16191f] text-white wide text-[10px] tracking-[0.14em]"
          >
            Show Entire Collection
          </button>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
          {paginated.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-12 flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }).map((_, idx) => {
            const pNum = idx + 1;
            return (
              <button
                key={pNum}
                type="button"
                onClick={() => setPage(pNum)}
                className={`w-9 h-9 text-xs tabular-nums border ${
                  page === pNum
                    ? 'bg-[#16191f] text-white border-[#16191f]'
                    : 'border-[#e6ebf0] text-[#737b86] hover:text-[#16191f]'
                }`}
              >
                {pNum}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// --- Categories & Editorial Lookbook Pages ---
export const CategoriesPage: React.FC = () => {
  const { categories, products } = useStore();

  return (
    <div className="max-w-[1380px] mx-auto px-4 sm:px-6 md:px-12 py-8 sm:py-12 space-y-10 sm:space-y-14 w-full max-w-full overflow-hidden min-w-0">
      <div className="max-w-2xl">
        <div className="text-xs text-[#737b86]">Departments & Silos</div>
        <h1 className="wide text-2xl tracking-[0.14em] mt-2">Collections & Categories</h1>
        <p className="text-sm text-[#737b86] mt-3 leading-relaxed">
          Explore AUREVÉ across tailored ready-to-wear, hand-stitched Italian leather
          accessories, and olfactory compositions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
        {categories.map((cat) => {
          const sample = products.find((p) => p.category === cat.name && p.published) || products[0];
          const count = products.filter((p) => p.category === cat.name && p.published).length;
          return (
            <div
              key={cat.id}
              className="border border-[#e6ebf0] bg-white flex flex-col justify-between p-5 sm:p-7"
            >
              <div>
                <div className="aspect-[4/3] bg-[#f3f6fa] p-5 sm:p-6 flex items-center justify-center mb-6">
                  {sample && <ProductVisual product={sample} className="w-full h-full max-h-56" />}
                </div>
                <div className="text-xs text-[#737b86]">{count} Pieces</div>
                <h2 className="wide text-base tracking-[0.14em] mt-1">{cat.name}</h2>
                <p className="text-xs text-[#737b86] mt-2 leading-relaxed">{cat.description}</p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#16191f]">
                  {cat.subcategories.map((sub) => (
                    <Link
                      key={sub}
                      to={`/shop?category=${encodeURIComponent(cat.name)}&sub=${encodeURIComponent(sub)}`}
                      className="underline text-[#737b86] hover:text-[#16191f] touch-manipulation"
                    >
                      {sub}
                    </Link>
                  ))}
                </div>
              </div>

              <Link
                to={`/shop?category=${encodeURIComponent(cat.name)}`}
                className="mt-6 sm:mt-7 inline-block py-3 text-center bg-[#16191f] text-white wide text-[10px] tracking-[0.15em] active:opacity-90 touch-manipulation"
              >
                Explore {cat.name}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const LookbookGridPage: React.FC = () => {
  const { products, addToCart } = useStore();

  return (
    <div className="max-w-[1380px] mx-auto px-4 sm:px-6 md:px-12 py-8 sm:py-12 space-y-8 sm:space-y-12 w-full max-w-full overflow-hidden min-w-0">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#e6ebf0] pb-6 sm:pb-8">
        <div>
          <div className="text-xs text-[#737b86]">Spring Summer 2027 Archive</div>
          <h1 className="wide text-2xl tracking-[0.14em] mt-2">Complete Runway Lookbook</h1>
        </div>
        <Link
          to="/"
          className="wide text-[10px] tracking-[0.15em] border-b border-[#16191f] pb-1 self-start touch-manipulation"
        >
          Enter Interactive 3D Depth Stage
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {RUNWAY_LOOKS.map((lk) => {
          const lookPieces = lk.productIds
            .map((pid) => products.find((p) => p.id === pid))
            .filter((x): x is Product => Boolean(x));

          return (
            <section
              key={lk.lookNumber}
              className="border border-[#e6ebf0] bg-white grid grid-cols-1 sm:grid-cols-12"
            >
              <div className="sm:col-span-5 bg-gradient-to-b from-[#eef4f9] to-[#f6f9fc] p-6 flex items-center justify-center min-h-[340px]">
                <ModelSpriteSvg x0={lk.x0} x1={lk.x1} className="h-72 w-auto" />
              </div>
              <div className="sm:col-span-7 p-6 flex flex-col justify-between">
                <div>
                  <div className="wide text-xs tracking-[0.16em] text-[#737b86]">
                    Look {lk.lookNumber}
                  </div>
                  <h2 className="text-base font-medium mt-1">{lk.title}</h2>
                  <p className="text-xs text-[#737b86] mt-2 leading-relaxed">{lk.notes}</p>

                  <div className="mt-6 space-y-3 border-t border-[#f3f6fa] pt-4">
                    {lookPieces.map((piece) => (
                      <div key={piece.id} className="flex items-center justify-between gap-3 text-xs">
                        <Link to={`/product/${piece.slug}`} className="hover:underline font-medium">
                          {piece.name}
                        </Link>
                        <div className="flex items-center gap-3">
                          <span className="tabular-nums text-[#737b86]">
                            Rs. {getEffectivePrice(piece).toLocaleString()}
                          </span>
                          <button
                            type="button"
                            onClick={() => addToCart(piece.id, 1)}
                            className="underline text-[#16191f]"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    lookPieces.forEach((p) => addToCart(p.id, 1));
                  }}
                  className="mt-6 w-full py-2.5 bg-[#16191f] text-white wide text-[10px] tracking-[0.14em]"
                >
                  Acquire Full Look {lk.lookNumber}
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

// --- Product Detail Page (PDP) ---
export const ProductDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const {
    products,
    user,
    wishlist,
    toggleWishlist,
    addToCart,
    recordRecentlyViewed,
    recentlyViewedIds,
    notify,
  } = useStore();

  const product = products.find((p) => p.slug === slug);

  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [qty, setQty] = useState(1);
  const [zoomActive, setZoomActive] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const [viewMode, setViewMode] = useState<'piece' | 'runway'>('piece');
  const [selectedImgIdx, setSelectedImgIdx] = useState(0);

  // Reviews state
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [ratingInput, setRatingInput] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (!product) return;
    setSelectedSize(product.sizes[0] || 'One Size');
    setSelectedColor(product.colors[0] || 'Signature');
    setQty(1);
    setViewMode('piece');
    setSelectedImgIdx(0);
    recordRecentlyViewed(product.id);
  }, [product?.id, recordRecentlyViewed]);

  useEffect(() => {
    if (!product) return;
    const revQ = query(
      collection(db, 'products', product.id, 'reviews'),
      where('productId', '==', product.id)
    );
    const unsub = onSnapshot(
      revQ,
      (snap) => {
        const list: ReviewRecord[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<ReviewRecord, 'id'>) }));
        setReviews(list);
      },
      () => {}
    );
    return () => unsub();
  }, [product?.id]);

  if (!product) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center space-y-4">
        <h1 className="wide text-lg tracking-[0.15em]">Piece Not Found</h1>
        <Link to="/shop" className="inline-block px-6 py-3 bg-[#16191f] text-white wide text-[10px] tracking-[0.14em]">
          Return to Shop
        </Link>
      </div>
    );
  }

  const effectivePrice = getEffectivePrice(product);
  const isSaved = wishlist.includes(product.id);
  const associatedLook = RUNWAY_LOOKS.find((lk) => lk.lookNumber === product.lookNumber);

  // Frequently Bought Together: companion piece from the same Runway Look or category
  const companionPiece = products.find(
    (p) =>
      p.id !== product.id &&
      p.published &&
      ((product.lookNumber && p.lookNumber === product.lookNumber) || p.category !== product.category)
  );

  const relatedProducts = products
    .filter((p) => p.id !== product.id && p.published && p.category === product.category)
    .slice(0, 3);

  const recentProducts = recentlyViewedIds
    .filter((id) => id !== product.id)
    .map((id) => products.find((p) => p.id === id))
    .filter((x): x is Product => Boolean(x))
    .slice(0, 3);

  const handleBuyNow = async () => {
    await addToCart(product.id, qty, selectedSize, selectedColor);
    navigate('/checkout');
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.emailVerified) {
      notify('Verified Sign-In Required', 'Sign in with Google to publish a verified client review.', 'error');
      return;
    }
    if (!reviewTitle.trim() || !reviewComment.trim()) return;
    setSubmittingReview(true);
    const revId = `rev_${user.uid}_${Date.now()}`;
    try {
      await setDoc(doc(db, 'products', product.id, 'reviews', revId), {
        productId: product.id,
        userId: user.uid,
        authorName: (user.displayName || 'Aurevé Client').slice(0, 80),
        rating: ratingInput,
        title: reviewTitle.trim().slice(0, 120),
        comment: reviewComment.trim().slice(0, 1000),
        createdAt: serverTimestamp(),
      });

      const nextCount = (product.ratingCount || 0) + 1;
      const nextAvg = Number(
        (((product.ratingAvg || 5) * (product.ratingCount || 0) + ratingInput) / nextCount).toFixed(2)
      );
      await updateDoc(doc(db, 'products', product.id), {
        ratingAvg: Math.min(5, Math.max(1, nextAvg)),
        ratingCount: nextCount,
        updatedAt: serverTimestamp(),
      }).catch(() => {});

      setReviewTitle('');
      setReviewComment('');
      notify('Review Published', 'Thank you for sharing your impressions.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `products/${product.id}/reviews/${revId}`);
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="max-w-[1380px] mx-auto px-4 sm:px-6 md:px-12 py-8 sm:py-10 space-y-12 sm:space-y-20 w-full max-w-full overflow-hidden min-w-0">
      {/* Breadcrumb */}
      <nav className="text-xs text-[#737b86] flex flex-wrap items-center gap-1.5 min-w-0 break-words">
        <Link to="/shop" className="hover:text-[#16191f]">Shop</Link>
        <span>/</span>
        <Link to={`/shop?category=${encodeURIComponent(product.category)}`} className="hover:text-[#16191f]">
          {product.category}
        </Link>
        <span>/</span>
        <span className="text-[#16191f] truncate max-w-xs">{product.name}</span>
      </nav>

      {/* Contiguous Purchase Module: Sticky Gallery Left + Purchase Column Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start w-full">
        <div className="lg:col-span-7 space-y-4 w-full min-w-0">
          <div
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setZoomOrigin({
                x: ((e.clientX - rect.left) / rect.width) * 100,
                y: ((e.clientY - rect.top) / rect.height) * 100,
              });
            }}
            onMouseEnter={() => setZoomActive(true)}
            onMouseLeave={() => setZoomActive(false)}
            className="relative aspect-[4/5] bg-[#f3f6fa] overflow-hidden flex items-center justify-center p-6 sm:p-10 cursor-zoom-in w-full"
          >
            <div
              className="w-full h-full flex items-center justify-center transition-transform duration-200"
              style={{
                transform: zoomActive ? 'scale(1.65)' : 'scale(1)',
                transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
              }}
            >
              {viewMode === 'runway' && associatedLook ? (
                <ModelSpriteSvg x0={associatedLook.x0} x1={associatedLook.x1} className="w-full h-full" />
              ) : (
                <ProductVisual product={product} imageIndex={selectedImgIdx} className="w-full h-full" />
              )}
            </div>
            <div className="absolute bottom-4 right-4 flex items-center gap-1.5 text-[11px] text-[#737b86] bg-white/80 px-2.5 py-1 pointer-events-none">
              <ZoomIn className="w-3.5 h-3.5" /> Hover to inspect weave
            </div>
          </div>

          {/* Multi-angle / Runway Look Switcher */}
          <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1 scrollbar-none w-full shrink-0">
            <button
              type="button"
              onClick={() => {
                setViewMode('piece');
                setSelectedImgIdx(0);
              }}
              className={`h-10 px-4 flex items-center justify-center text-xs border whitespace-nowrap shrink-0 touch-manipulation active:scale-95 ${
                viewMode === 'piece' && selectedImgIdx === 0
                  ? 'border-[#16191f] text-[#16191f]'
                  : 'border-[#e6ebf0] text-[#737b86]'
              }`}
            >
              Studio Garment View
            </button>

            {product.images.length > 1 &&
              product.images.slice(1).map((_, idx) => (
                <button
                  key={idx + 1}
                  type="button"
                  onClick={() => {
                    setViewMode('piece');
                    setSelectedImgIdx(idx + 1);
                  }}
                  className={`h-10 px-4 flex items-center justify-center text-xs border whitespace-nowrap shrink-0 touch-manipulation active:scale-95 ${
                    viewMode === 'piece' && selectedImgIdx === idx + 1
                      ? 'border-[#16191f] text-[#16191f]'
                      : 'border-[#e6ebf0] text-[#737b86]'
                  }`}
                >
                  Alternate Angle {idx + 2}
                </button>
              ))}

            {associatedLook && (
              <button
                type="button"
                onClick={() => setViewMode('runway')}
                className={`h-10 px-4 flex items-center justify-center text-xs border whitespace-nowrap shrink-0 touch-manipulation active:scale-95 ${
                  viewMode === 'runway'
                    ? 'border-[#16191f] text-[#16191f]'
                    : 'border-[#e6ebf0] text-[#737b86]'
                }`}
              >
                Runway Look {associatedLook.lookNumber} Silhouette
              </button>
            )}
          </div>
        </div>

        {/* Sticky Purchase Column */}
        <div className="lg:col-span-5 lg:sticky lg:top-28 space-y-6 w-full min-w-0">
          <div>
            <div className="text-xs text-[#737b86] flex items-center gap-2 flex-wrap">
              <span>SKU: {product.sku}</span>
              <span>·</span>
              <span>
                {product.stock <= 0 ? (
                  <span className="font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 border border-rose-200 uppercase text-[10px] tracking-wider">
                    Out of Stock
                  </span>
                ) : product.stock <= (product.lowStockThreshold || 5) ? (
                  <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 border border-amber-200 uppercase text-[10px] tracking-wider">
                    Low Stock — Only {product.stock} available
                  </span>
                ) : (
                  <span className="text-emerald-700 font-medium">
                    In Stock ({product.stock} available)
                  </span>
                )}
              </span>
            </div>
            <h1 className="wide text-xl md:text-2xl tracking-[0.14em] mt-2">{product.name}</h1>

            <div className="mt-3 flex items-baseline gap-3 tabular-nums">
              <span className="text-xl font-medium">Rs. {effectivePrice.toLocaleString()}</span>
              {effectivePrice < product.price && (
                <span className="text-sm text-[#a4adb8] line-through">
                  Rs. {product.price.toLocaleString()}
                </span>
              )}
              {product.ratingAvg && (
                <span className="ml-auto text-xs text-[#737b86] inline-flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-[#16191f] text-[#16191f]" />
                  {product.ratingAvg.toFixed(1)} ({(product.ratingCount || 0) + reviews.length})
                </span>
              )}
            </div>
          </div>

          <p className="text-sm text-[#737b86] leading-relaxed">{product.description}</p>

          {/* Color Variant Selector */}
          <div className="space-y-2">
            <div className="text-xs text-[#737b86]">
              Shade: <span className="text-[#16191f] font-medium">{selectedColor}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedColor(c)}
                  className={`h-10 min-w-[44px] px-3.5 flex items-center justify-center text-xs border transition-colors touch-manipulation active:scale-95 ${
                    selectedColor === c
                      ? 'border-[#16191f] bg-[#16191f] text-white'
                      : 'border-[#e6ebf0] hover:border-[#16191f]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Size Variant Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#737b86]">
                Size: <span className="text-[#16191f] font-medium">{selectedSize}</span>
              </span>
              <Link to="/faq" className="underline text-[#737b86] hover:text-[#16191f]">
                Size Guide
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setSelectedSize(sz)}
                  className={`h-10 min-w-[44px] px-3.5 flex items-center justify-center text-xs border transition-colors touch-manipulation active:scale-95 ${
                    selectedSize === sz
                      ? 'border-[#16191f] bg-[#16191f] text-white'
                      : 'border-[#e6ebf0] hover:border-[#16191f]'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity & Primary Actions (Rock-solid dimensions, zero jumping) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3 w-full">
              <div className="inline-flex items-center border border-[#e6ebf0] h-12 shrink-0">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="w-11 h-full flex items-center justify-center text-sm font-medium hover:bg-[#f3f6fa] active:bg-[#e9f0f7] transition-colors touch-manipulation"
                >
                  −
                </button>
                <span className="w-10 text-center text-xs tabular-nums select-none">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.min(product.stock || 1, q + 1))}
                  aria-label="Increase quantity"
                  className="w-11 h-full flex items-center justify-center text-sm font-medium hover:bg-[#f3f6fa] active:bg-[#e9f0f7] transition-colors touch-manipulation"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                disabled={product.stock <= 0}
                onClick={() => addToCart(product.id, qty, selectedSize, selectedColor)}
                className="flex-1 h-12 px-4 bg-[#16191f] text-white wide text-[10px] tracking-[0.16em] hover:opacity-90 active:scale-[0.99] transition-transform disabled:opacity-40 touch-manipulation flex items-center justify-center"
              >
                {product.stock > 0 ? 'Add to Bag' : 'Out of Stock'}
              </button>

              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
                aria-label="Save to wishlist"
                className="w-12 h-12 flex items-center justify-center border border-[#e6ebf0] hover:border-[#16191f] active:bg-[#f3f6fa] touch-manipulation shrink-0"
              >
                <Heart
                  className={`w-4 h-4 ${isSaved ? 'fill-[#d8a7a0] stroke-[#b98179]' : ''}`}
                />
              </button>
            </div>

            <button
              type="button"
              disabled={product.stock <= 0}
              onClick={handleBuyNow}
              className="w-full h-12 border border-[#16191f] text-[#16191f] wide text-[10px] tracking-[0.16em] hover:bg-[#f3f6fa] active:scale-[0.99] transition-transform disabled:opacity-40 touch-manipulation flex items-center justify-center"
            >
              Buy Now — Express Checkout
            </button>
          </div>

          {/* Specifications */}
          <div className="border-t border-[#e6ebf0] pt-5 space-y-2.5 text-xs">
            {product.material && (
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4">
                <span className="text-[#737b86]">Composition</span>
                <span className="sm:text-right">{product.material}</span>
              </div>
            )}
            {product.origin && (
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4">
                <span className="text-[#737b86]">Origin</span>
                <span className="sm:text-right">{product.origin}</span>
              </div>
            )}
            {product.care && (
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4">
                <span className="text-[#737b86]">Care</span>
                <span className="sm:text-right">{product.care}</span>
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4">
              <span className="text-[#737b86]">Pakistan Delivery</span>
              <span className="sm:text-right">2–4 Business Days · Cash on Delivery Available</span>
            </div>
          </div>
        </div>
      </div>

      {/* Frequently Bought Together */}
      {companionPiece && (
        <section className="border-t border-[#e6ebf0] pt-12 sm:pt-14 w-full">
          <h2 className="wide text-sm tracking-[0.16em]">Complete the Silhouette</h2>
          <div className="mt-6 p-4 sm:p-6 bg-[#f3f6fa] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6 w-full">
            <div className="flex flex-wrap items-center gap-3 sm:gap-6 min-w-0">
              <div className="w-16 sm:w-20 h-20 sm:h-24 bg-white p-2 shrink-0">
                <ProductVisual product={product} />
              </div>
              <span className="text-lg text-[#737b86]">+</span>
              <div className="w-16 sm:w-20 h-20 sm:h-24 bg-white p-2 shrink-0">
                <ProductVisual product={companionPiece} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {product.name} + {companionPiece.name}
                </div>
                <div className="text-xs text-[#737b86] mt-1 tabular-nums">
                  Combined Total: Rs.{' '}
                  {(effectivePrice + getEffectivePrice(companionPiece)).toLocaleString()}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                await addToCart(product.id, 1, selectedSize, selectedColor);
                await addToCart(companionPiece.id, 1);
              }}
              className="w-full sm:w-auto px-6 py-3 bg-[#16191f] text-white wide text-[10px] tracking-[0.15em] whitespace-nowrap active:scale-[0.99] touch-manipulation"
            >
              Add Both Pieces
            </button>
          </div>
        </section>
      )}

      {/* Client Ratings & Reviews */}
      <section className="border-t border-[#e6ebf0] pt-14 grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-5 space-y-4">
          <h2 className="wide text-sm tracking-[0.16em]">Client Impressions</h2>
          <p className="text-xs text-[#737b86] leading-relaxed">
            Verified clients may record notes on tailoring, drape, and sizing.
          </p>

          <form onSubmit={handleReviewSubmit} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs text-[#737b86] mb-1">Rating</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRatingInput(n)}
                    className={`px-3 py-1.5 text-xs border ${
                      ratingInput >= n ? 'bg-[#16191f] text-white border-[#16191f]' : 'border-[#e6ebf0]'
                    }`}
                  >
                    {n} ★
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              required
              maxLength={120}
              value={reviewTitle}
              onChange={(e) => setReviewTitle(e.target.value)}
              placeholder="Headline (e.g., Impeccable drape and weight)"
              className="w-full border border-[#e6ebf0] px-3.5 py-2.5 text-xs outline-none"
            />
            <textarea
              required
              maxLength={1000}
              rows={3}
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Share fit, fabric feel, and styling impressions..."
              className="w-full border border-[#e6ebf0] px-3.5 py-2.5 text-xs outline-none"
            />
            <button
              type="submit"
              disabled={submittingReview}
              className="px-6 py-3 bg-[#16191f] text-white wide text-[10px] tracking-[0.14em]"
            >
              {submittingReview ? 'Submitting...' : 'Submit Review'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 space-y-5">
          {reviews.length === 0 ? (
            <div className="p-8 bg-[#f3f6fa] text-xs text-[#737b86]">
              No public client notes posted for this piece yet. Be the first to review.
            </div>
          ) : (
            reviews.map((rev) => (
              <div key={rev.id} className="border-b border-[#e6ebf0] pb-5 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{rev.title}</span>
                  <span className="tabular-nums">{'★'.repeat(rev.rating)}</span>
                </div>
                <p className="text-xs text-[#737b86] leading-relaxed">{rev.comment}</p>
                <div className="text-[11px] text-[#a4adb8] flex items-center gap-1.5">
                  <Check className="w-3 h-3" /> Verified Client — {rev.authorName}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Related, Recommended & Recently Viewed */}
      {relatedProducts.length > 0 && (
        <section className="border-t border-[#e6ebf0] pt-14 space-y-6">
          <h2 className="wide text-sm tracking-[0.16em]">Related Pieces</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-7">
            {relatedProducts.map((rp) => (
              <ProductCard key={rp.id} product={rp} />
            ))}
          </div>
        </section>
      )}

      <section className="border-t border-[#e6ebf0] pt-14 space-y-6">
        <h2 className="wide text-sm tracking-[0.16em]">Recommended by AUREVÉ Stylists</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-7">
          {products
            .filter((p) => p.id !== product.id && p.published && p.bestSeller)
            .slice(0, 3)
            .map((rp) => (
              <ProductCard key={rp.id} product={rp} />
            ))}
        </div>
      </section>

      {recentProducts.length > 0 && (
        <section className="border-t border-[#e6ebf0] pt-14 space-y-6">
          <h2 className="wide text-sm tracking-[0.16em]">Recently Viewed</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-7">
            {recentProducts.map((rp) => (
              <ProductCard key={rp.id} product={rp} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

// --- Product Comparison Page ---
export const ComparePage: React.FC = () => {
  const { products, compareIds, toggleCompare, addToCart } = useStore();
  const compared = compareIds
    .map((id) => products.find((p) => p.id === id))
    .filter((x): x is Product => Boolean(x));

  return (
    <div className="max-w-[1380px] mx-auto px-4 sm:px-6 md:px-12 py-8 sm:py-12 space-y-6 sm:space-y-8 w-full max-w-full overflow-hidden min-w-0">
      <div>
        <div className="text-xs text-[#737b86]">Side-by-Side Atelier Inspection</div>
        <h1 className="wide text-2xl tracking-[0.14em] mt-2">Product Comparison</h1>
      </div>

      {compared.length === 0 ? (
        <div className="py-16 bg-[#f3f6fa] text-center space-y-4">
          <p className="text-sm text-[#737b86]">Select up to 4 pieces in the Shop to compare specifications.</p>
          <Link to="/shop" className="inline-block px-6 py-3 bg-[#16191f] text-white wide text-[10px] tracking-[0.14em] active:opacity-90 touch-manipulation">
            Browse Shop
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto border border-[#e6ebf0] w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full text-left text-xs border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-[#e6ebf0] bg-[#f3f6fa]">
                <th className="p-4 w-44 font-medium text-[#737b86]">Specification</th>
                {compared.map((p) => (
                  <th key={p.id} className="p-4 min-w-[200px]">
                    <div className="h-36 bg-white p-3 mb-3 flex items-center justify-center">
                      <ProductVisual product={p} />
                    </div>
                    <Link to={`/product/${p.slug}`} className="wide text-[11px] tracking-[0.13em] hover:underline touch-manipulation">
                      {p.name}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6ebf0]">
              <tr>
                <td className="p-4 text-[#737b86]">Price</td>
                {compared.map((p) => (
                  <td key={p.id} className="p-4 font-medium tabular-nums">
                    Rs. {getEffectivePrice(p).toLocaleString()}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 text-[#737b86]">SKU</td>
                {compared.map((p) => (
                  <td key={p.id} className="p-4">{p.sku}</td>
                ))}
              </tr>
              <tr>
                <td className="p-4 text-[#737b86]">Material</td>
                {compared.map((p) => (
                  <td key={p.id} className="p-4">{p.material || 'Couture Silk / Wool'}</td>
                ))}
              </tr>
              <tr>
                <td className="p-4 text-[#737b86]">Origin</td>
                {compared.map((p) => (
                  <td key={p.id} className="p-4">{p.origin || 'France / Italy'}</td>
                ))}
              </tr>
              <tr>
                <td className="p-4 text-[#737b86]">Sizes</td>
                {compared.map((p) => (
                  <td key={p.id} className="p-4">{p.sizes.join(', ')}</td>
                ))}
              </tr>
              <tr>
                <td className="p-4 text-[#737b86]">Actions</td>
                {compared.map((p) => (
                  <td key={p.id} className="p-4 space-x-3">
                    <button
                      type="button"
                      onClick={() => addToCart(p.id, 1)}
                      className="px-3.5 py-2 bg-[#16191f] text-white wide text-[9px] tracking-[0.14em] active:scale-95 touch-manipulation"
                    >
                      Add to Bag
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleCompare(p.id)}
                      className="underline text-[#737b86] hover:text-[#16191f] touch-manipulation"
                    >
                      Remove
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
