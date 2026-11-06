import { User, onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  INITIAL_BANNERS,
  INITIAL_CATEGORIES,
  INITIAL_COUPONS,
  INITIAL_PRODUCTS,
  INITIAL_SHIPPING_ZONES,
} from '../data/initialCatalog';
import {
  OperationType,
  auth,
  createUserWithEmailAndPassword,
  db,
  googleProvider,
  handleFirestoreError,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from '../firebase';
import {
  Banner,
  CartEntry,
  Category,
  Coupon,
  OrderRecord,
  OrderStatus,
  OrderStatusHistoryRecord,
  PaymentMethod,
  Product,
  SavedAddress,
  ShippingZone,
  StockHistoryRecord,
} from '../types';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  tone?: 'default' | 'error' | 'success';
}

interface PlaceOrderInput {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  city: string;
  area: string;
  street: string;
  houseNumber: string;
  instructions?: string;
  paymentMethod: PaymentMethod;
  couponCode?: string;
  saveAddress?: boolean;
}

interface StoreContextValue {
  user: User | null;
  authReady: boolean;
  isAdmin: boolean;
  loyaltyPoints: number;
  userPhone: string;
  whatsappOptIn: boolean;
  products: Product[];
  catalogLoading: boolean;
  categories: Category[];
  banners: Banner[];
  shippingZones: ShippingZone[];
  cart: CartEntry[];
  wishlist: string[];
  compareIds: string[];
  recentlyViewedIds: string[];
  savedAddresses: SavedAddress[];
  myOrders: OrderRecord[];
  cartDrawerOpen: boolean;
  setCartDrawerOpen: (open: boolean) => void;
  searchDrawerOpen: boolean;
  setSearchDrawerOpen: (open: boolean) => void;
  toasts: ToastMessage[];
  notify: (title: string, description?: string, tone?: 'default' | 'error' | 'success') => void;
  dismissToast: (id: string) => void;
  // Cart & Wishlist
  addToCart: (productId: string, quantity?: number, size?: string, color?: string) => Promise<void>;
  updateCartQuantity: (entryId: string, quantity: number) => Promise<void>;
  toggleSaveForLater: (entryId: string) => Promise<void>;
  removeFromCart: (entryId: string) => Promise<void>;
  clearActiveCart: () => Promise<void>;
  toggleWishlist: (productId: string) => Promise<void>;
  toggleCompare: (productId: string) => void;
  recordRecentlyViewed: (productId: string) => void;
  // Pricing helpers
  activeCartItems: (CartEntry & { product: Product; unitPrice: number })[];
  savedForLaterItems: (CartEntry & { product: Product; unitPrice: number })[];
  cartCount: number;
  cartSubtotal: number;
  calculateShipping: (city: string, subtotalAfterDiscount: number) => number;
  validateCouponCode: (code: string, subtotal: number) => Promise<{ valid: boolean; discount: number; coupon?: Coupon; message: string }>;
  // Auth
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, password: string, phone: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateCustomerProfile: (displayName: string, phone: string, whatsappOptIn: boolean) => Promise<void>;
  saveAddressRecord: (addr: Omit<SavedAddress, 'id'>) => Promise<void>;
  deleteAddressRecord: (id: string) => Promise<void>;
  // Orders
  placeOrder: (
    input: PlaceOrderInput
  ) => Promise<{
    orderNumber: string;
    orderId: string;
    stripeRedirectUrl?: string;
    stripeSessionId?: string;
    grandTotal: number;
  }>;
  cancelCustomerOrder: (order: OrderRecord) => Promise<void>;
  requestCustomerReturn: (order: OrderRecord, reason: string) => Promise<void>;
  updateOrderStatusAuthoritative: (order: OrderRecord, newStatus: OrderStatus, note?: string, cancellationReason?: string) => Promise<void>;
  adjustProductStock: (productId: string, adjustment: number, changeType: StockHistoryRecord['changeType'], reason: string, variantKey?: string) => Promise<void>;
  addAdminOrderNote: (orderId: string, note: string) => Promise<void>;
  seedCatalogToFirestore: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

const LOCAL_CART_KEY = 'mv_cart_v1';
const LOCAL_WISHLIST_KEY = 'mv_wishlist_v1';
const LOCAL_COMPARE_KEY = 'mv_compare_v1';
const LOCAL_RECENT_KEY = 'mv_recent_v1';
const BOOTSTRAP_ADMIN_EMAIL = 'razasphare@gmail.com';

function readJsonStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getEffectivePrice(product: Product): number {
  if (typeof product.salePrice === 'number' && product.salePrice > 0 && product.salePrice < product.price) {
    return product.salePrice;
  }
  return product.price;
}

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [userPhone, setUserPhone] = useState('');
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);

  const [dbProducts, setDbProducts] = useState<Product[]>([]);
  const [catalogLoading, setCatalogLoading] = useState<boolean>(true);
  const [dbCategories, setDbCategories] = useState<Category[]>([]);
  const [dbBanners, setDbBanners] = useState<Banner[]>([]);
  const [dbZones, setDbZones] = useState<ShippingZone[]>([]);

  const [cart, setCart] = useState<CartEntry[]>(() => readJsonStorage<CartEntry[]>(LOCAL_CART_KEY, []));
  const [wishlist, setWishlist] = useState<string[]>(() => readJsonStorage<string[]>(LOCAL_WISHLIST_KEY, []));
  const [compareIds, setCompareIds] = useState<string[]>(() => readJsonStorage<string[]>(LOCAL_COMPARE_KEY, []));
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>(() =>
    readJsonStorage<string[]>(LOCAL_RECENT_KEY, [])
  );

  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [myOrders, setMyOrders] = useState<OrderRecord[]>([]);

  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [searchDrawerOpen, setSearchDrawerOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback(
    (title: string, description?: string, tone: 'default' | 'error' | 'success' = 'default') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, title, description, tone }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Merge Firestore products over initial catalog so storefront always has the 12 runway pieces + admin additions
  const products = useMemo(() => {
    if (dbProducts.length === 0) return INITIAL_PRODUCTS;
    const map = new Map<string, Product>();
    INITIAL_PRODUCTS.forEach((p) => map.set(p.id, p));
    dbProducts.forEach((p) => map.set(p.id, p));
    return Array.from(map.values());
  }, [dbProducts]);

  const categories = useMemo(
    () => (dbCategories.length > 0 ? dbCategories : INITIAL_CATEGORIES),
    [dbCategories]
  );

  const banners = useMemo(() => (dbBanners.length > 0 ? dbBanners : INITIAL_BANNERS), [dbBanners]);
  const shippingZones = useMemo(
    () => (dbZones.length > 0 ? dbZones : INITIAL_SHIPPING_ZONES),
    [dbZones]
  );

  // Public listeners: Published products, categories, banners, shipping zones
  useEffect(() => {
    const prodQ = query(collection(db, 'products'), where('published', '==', true));
    const unsubProd = onSnapshot(
      prodQ,
      (snap) => {
        const list: Product[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<Product, 'id'>) }));
        setDbProducts(list);
        setCatalogLoading(false);
      },
      (err) => {
        console.warn('Public products snapshot error:', err);
        setCatalogLoading(false);
      }
    );

    const catQ = query(collection(db, 'categories'), where('sortOrder', '>=', 0));
    const unsubCat = onSnapshot(
      catQ,
      (snap) => {
        const list: Category[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<Category, 'id'>) }));
        list.sort((a, b) => a.sortOrder - b.sortOrder);
        setDbCategories(list);
      },
      () => {}
    );

    const banQ = query(collection(db, 'banners'), where('active', '==', true));
    const unsubBan = onSnapshot(
      banQ,
      (snap) => {
        const list: Banner[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<Banner, 'id'>) }));
        setDbBanners(list);
      },
      () => {}
    );

    const zoneQ = query(collection(db, 'shipping_zones'), where('active', '==', true));
    const unsubZone = onSnapshot(
      zoneQ,
      (snap) => {
        const list: ShippingZone[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<ShippingZone, 'id'>) }));
        setDbZones(list);
      },
      () => {}
    );

    return () => {
      unsubProd();
      unsubCat();
      unsubBan();
      unsubZone();
    };
  }, []);

  // Auth state listener + user profile/cart/wishlist/orders sync
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (current) => {
      setUser(current);
      setAuthReady(true);

      if (!current) {
        setIsAdmin(false);
        setLoyaltyPoints(0);
        setUserPhone('');
        setSavedAddresses([]);
        setMyOrders([]);
        setCart(readJsonStorage<CartEntry[]>(LOCAL_CART_KEY, []));
        setWishlist(readJsonStorage<string[]>(LOCAL_WISHLIST_KEY, []));
        return;
      }

      // Verify Admin Role via Bootstrap Email + Firestore /admins/{uid}
      const emailMatch = current.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;
      let adminDocExists = false;
      try {
        const adminSnap = await getDoc(doc(db, 'admins', current.uid));
        adminDocExists = adminSnap.exists();
      } catch {
        adminDocExists = false;
      }
      const verifiedAdmin = emailMatch || adminDocExists;
      setIsAdmin(verifiedAdmin);

      // Ensure user public + split private profile documents exist
      if (current.uid) {
        try {
          const userRef = doc(db, 'users', current.uid);
          const privRef = doc(db, 'users', current.uid, 'private', 'info');
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            const batch = writeBatch(db);
            batch.set(userRef, {
              uid: current.uid,
              displayName: (current.displayName || current.email?.split('@')[0] || 'Client').slice(0, 80),
              loyaltyPoints: 0,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            batch.set(privRef, {
              uid: current.uid,
              email: (current.email || '').slice(0, 160),
              phone: '',
              whatsappOptIn: true,
              updatedAt: serverTimestamp(),
            });
            await batch.commit();
          } else {
            setLoyaltyPoints(Number(userSnap.data()?.loyaltyPoints || 0));
            const privSnap = await getDoc(privRef);
            if (privSnap.exists()) {
              setUserPhone(String(privSnap.data()?.phone || ''));
              setWhatsappOptIn(Boolean(privSnap.data()?.whatsappOptIn ?? true));
            }
          }

          // Merge any guest localStorage cart items into Firestore user cart
          const guestCart = readJsonStorage<CartEntry[]>(LOCAL_CART_KEY, []);
          if (guestCart.length > 0) {
            for (const item of guestCart) {
              const itemRef = doc(db, 'users', current.uid, 'cart', item.id);
              await setDoc(itemRef, {
                uid: current.uid,
                productId: item.productId,
                quantity: Math.min(50, Math.max(1, item.quantity)),
                size: item.size.slice(0, 30),
                color: item.color.slice(0, 40),
                savedForLater: Boolean(item.savedForLater),
                updatedAt: serverTimestamp(),
              });
            }
            localStorage.removeItem(LOCAL_CART_KEY);
          }
        } catch (e) {
          console.warn('Profile bootstrap warning:', e);
        }
      }
    });

    return () => unsubAuth();
  }, []);

  // Auto-seed Firestore catalog when verified Admin signs in and Firestore products collection is empty
  const seedCatalogToFirestore = useCallback(async () => {
    if (!user || !isAdmin) return;
    try {
      const existingSnap = await getDocs(query(collection(db, 'products'), where('published', '==', true)));
      if (!existingSnap.empty) return;

      const batch = writeBatch(db);
      for (const p of INITIAL_PRODUCTS) {
        const ref = doc(db, 'products', p.id);
        const payload: Record<string, unknown> = {
          name: p.name,
          slug: p.slug,
          sku: p.sku,
          category: p.category,
          price: p.price,
          stock: p.stock,
          published: p.published,
          description: p.description,
          sizes: p.sizes,
          colors: p.colors,
          images: p.images,
          ratingAvg: p.ratingAvg || 4.9,
          ratingCount: p.ratingCount || 10,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (p.subcategory) payload.subcategory = p.subcategory;
        if (typeof p.lookNumber === 'number') payload.lookNumber = p.lookNumber;
        if (typeof p.salePrice === 'number') payload.salePrice = p.salePrice;
        if (typeof p.lowStockThreshold === 'number') payload.lowStockThreshold = p.lowStockThreshold;
        if (typeof p.featured === 'boolean') payload.featured = p.featured;
        if (typeof p.bestSeller === 'boolean') payload.bestSeller = p.bestSeller;
        if (typeof p.flashSale === 'boolean') payload.flashSale = p.flashSale;
        if (p.material) payload.material = p.material;
        if (p.care) payload.care = p.care;
        if (p.origin) payload.origin = p.origin;
        if (p.spriteBox) payload.spriteBox = p.spriteBox;
        batch.set(ref, payload);
      }

      for (const c of INITIAL_CATEGORIES) {
        batch.set(doc(db, 'categories', c.id), {
          name: c.name,
          slug: c.slug,
          description: c.description || '',
          subcategories: c.subcategories,
          sortOrder: c.sortOrder,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      for (const cp of INITIAL_COUPONS) {
        const cpPayload: Record<string, unknown> = {
          code: cp.code,
          discountType: cp.discountType,
          discountValue: cp.discountValue,
          minOrderAmount: cp.minOrderAmount,
          active: cp.active,
          description: cp.description || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (typeof cp.maxDiscount === 'number') cpPayload.maxDiscount = cp.maxDiscount;
        batch.set(doc(db, 'coupons', cp.code), cpPayload);
      }

      for (const zn of INITIAL_SHIPPING_ZONES) {
        batch.set(doc(db, 'shipping_zones', zn.id), {
          name: zn.name,
          cities: zn.cities,
          fee: zn.fee,
          freeThreshold: zn.freeThreshold,
          estimatedDays: zn.estimatedDays,
          active: zn.active,
          updatedAt: serverTimestamp(),
        });
      }

      for (const bn of INITIAL_BANNERS) {
        batch.set(doc(db, 'banners', bn.id), {
          title: bn.title,
          subtitle: bn.subtitle || '',
          ctaLabel: bn.ctaLabel,
          ctaLink: bn.ctaLink,
          active: bn.active,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();
      notify('Firestore Initialized', 'AUREVÉ SS27 catalog, coupons, and zones persisted to Firestore.', 'success');
    } catch (err) {
      console.warn('Auto-seed skipped or failed:', err);
    }
  }, [user, isAdmin, notify]);

  useEffect(() => {
    if (authReady && user && isAdmin && dbProducts.length === 0) {
      seedCatalogToFirestore();
    }
  }, [authReady, user, isAdmin, dbProducts.length, seedCatalogToFirestore]);

  // Authenticated User Real-Time Subscriptions (Cart, Wishlist, Addresses, Orders, Profile)
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) return;

    const cartQ = query(collection(db, 'users', user.uid, 'cart'), where('uid', '==', user.uid));
    const unsubCart = onSnapshot(
      cartQ,
      (snap) => {
        const items: CartEntry[] = [];
        snap.forEach((d) => {
          const data = d.data();
          items.push({
            id: d.id,
            productId: data.productId,
            quantity: data.quantity,
            size: data.size,
            color: data.color,
            savedForLater: Boolean(data.savedForLater),
          });
        });
        setCart(items);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/cart`)
    );

    const wishQ = query(collection(db, 'users', user.uid, 'wishlist'), where('uid', '==', user.uid));
    const unsubWish = onSnapshot(
      wishQ,
      (snap) => {
        const ids: string[] = [];
        snap.forEach((d) => ids.push(d.id));
        setWishlist(ids);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/wishlist`)
    );

    const addrQ = query(collection(db, 'users', user.uid, 'addresses'), where('uid', '==', user.uid));
    const unsubAddr = onSnapshot(
      addrQ,
      (snap) => {
        const addrs: SavedAddress[] = [];
        snap.forEach((d) => addrs.push({ id: d.id, ...(d.data() as Omit<SavedAddress, 'id'>) }));
        setSavedAddresses(addrs);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/addresses`)
    );

    const ordQ = query(collection(db, 'orders'), where('userId', '==', user.uid));
    const unsubOrd = onSnapshot(
      ordQ,
      (snap) => {
        const list: OrderRecord[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<OrderRecord, 'id'>) }));
        list.sort((a, b) => String(b.orderNumber).localeCompare(String(a.orderNumber)));
        setMyOrders(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'orders')
    );

    const unsubUser = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          setLoyaltyPoints(Number(snap.data()?.loyaltyPoints || 0));
        }
      },
      () => {}
    );

    return () => {
      unsubCart();
      unsubWish();
      unsubAddr();
      unsubOrd();
      unsubUser();
    };
  }, [authReady, user]);

  // Persist guest states to localStorage when unauthenticated or unverified
  useEffect(() => {
    if (!user || !user.emailVerified) {
      localStorage.setItem(LOCAL_CART_KEY, JSON.stringify(cart));
    }
  }, [cart, user]);

  useEffect(() => {
    if (!user || !user.emailVerified) {
      localStorage.setItem(LOCAL_WISHLIST_KEY, JSON.stringify(wishlist));
    }
  }, [wishlist, user]);

  useEffect(() => {
    localStorage.setItem(LOCAL_COMPARE_KEY, JSON.stringify(compareIds));
  }, [compareIds]);

  useEffect(() => {
    localStorage.setItem(LOCAL_RECENT_KEY, JSON.stringify(recentlyViewedIds));
  }, [recentlyViewedIds]);

  // Cart & Wishlist Operations
  const addToCart = useCallback(
    async (productId: string, quantity = 1, size?: string, color?: string) => {
      const prod = products.find((p) => p.id === productId);
      if (!prod) return;
      if (prod.stock <= 0) {
        notify('Out of Stock', `${prod.name} is currently unavailable.`, 'error');
        return;
      }

      const chosenSize = (size || prod.sizes[0] || 'One Size').slice(0, 30);
      const chosenColor = (color || prod.colors[0] || 'Signature').slice(0, 40);
      const safeId = `${productId}_${chosenSize}_${chosenColor}`.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120);

      const existingEntry = cart.find((c) => c.id === safeId);
      const nextQty = Math.min(prod.stock, Math.min(50, (existingEntry?.quantity || 0) + quantity));

      if (user && user.emailVerified && dbProducts.some((p) => p.id === productId)) {
        const ref = doc(db, 'users', user.uid, 'cart', safeId);
        try {
          if (existingEntry) {
            await updateDoc(ref, {
              quantity: nextQty,
              size: chosenSize,
              color: chosenColor,
              savedForLater: false,
              updatedAt: serverTimestamp(),
            });
          } else {
            await setDoc(ref, {
              uid: user.uid,
              productId,
              quantity: nextQty,
              size: chosenSize,
              color: chosenColor,
              savedForLater: false,
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/cart/${safeId}`);
        }
      } else {
        setCart((prev) => {
          const idx = prev.findIndex((c) => c.id === safeId);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], quantity: nextQty, savedForLater: false };
            return copy;
          }
          return [
            ...prev,
            { id: safeId, productId, quantity: nextQty, size: chosenSize, color: chosenColor, savedForLater: false },
          ];
        });
      }

      notify('Added to Bag', `${prod.name} (${chosenSize})`, 'success');
    },
    [products, cart, user, dbProducts, notify]
  );

  const updateCartQuantity = useCallback(
    async (entryId: string, quantity: number) => {
      const target = cart.find((c) => c.id === entryId);
      if (!target) return;
      const prod = products.find((p) => p.id === target.productId);
      const maxAllowed = prod ? Math.min(50, prod.stock) : 50;

      if (quantity <= 0) {
        if (user && user.emailVerified && dbProducts.some((p) => p.id === target.productId)) {
          await deleteDoc(doc(db, 'users', user.uid, 'cart', entryId));
        } else {
          setCart((prev) => prev.filter((c) => c.id !== entryId));
        }
        return;
      }

      const clamped = Math.min(maxAllowed, Math.max(1, quantity));
      if (user && user.emailVerified && dbProducts.some((p) => p.id === target.productId)) {
        try {
          await updateDoc(doc(db, 'users', user.uid, 'cart', entryId), {
            quantity: clamped,
            size: target.size,
            color: target.color,
            savedForLater: target.savedForLater,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/cart/${entryId}`);
        }
      } else {
        setCart((prev) => prev.map((c) => (c.id === entryId ? { ...c, quantity: clamped } : c)));
      }
    },
    [cart, products, user, dbProducts]
  );

  const toggleSaveForLater = useCallback(
    async (entryId: string) => {
      const target = cart.find((c) => c.id === entryId);
      if (!target) return;
      const nextSaved = !target.savedForLater;

      if (user && user.emailVerified && dbProducts.some((p) => p.id === target.productId)) {
        try {
          await updateDoc(doc(db, 'users', user.uid, 'cart', entryId), {
            quantity: target.quantity,
            size: target.size,
            color: target.color,
            savedForLater: nextSaved,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/cart/${entryId}`);
        }
      } else {
        setCart((prev) => prev.map((c) => (c.id === entryId ? { ...c, savedForLater: nextSaved } : c)));
      }
      notify(nextSaved ? 'Saved for Later' : 'Moved to Active Bag');
    },
    [cart, user, dbProducts, notify]
  );

  const removeFromCart = useCallback(
    async (entryId: string) => {
      const target = cart.find((c) => c.id === entryId);
      if (user && user.emailVerified && target && dbProducts.some((p) => p.id === target.productId)) {
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'cart', entryId));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/cart/${entryId}`);
        }
      } else {
        setCart((prev) => prev.filter((c) => c.id !== entryId));
      }
    },
    [cart, user, dbProducts]
  );

  const clearActiveCart = useCallback(async () => {
    const active = cart.filter((c) => !c.savedForLater);
    if (user && user.emailVerified) {
      for (const item of active) {
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'cart', item.id));
        } catch {
          // ignore if local-only
        }
      }
    }
    setCart((prev) => prev.filter((c) => c.savedForLater));
  }, [cart, user]);

  const toggleWishlist = useCallback(
    async (productId: string) => {
      const existsInWish = wishlist.includes(productId);
      if (user && user.emailVerified && dbProducts.some((p) => p.id === productId)) {
        const ref = doc(db, 'users', user.uid, 'wishlist', productId);
        try {
          if (existsInWish) {
            await deleteDoc(ref);
          } else {
            await setDoc(ref, {
              uid: user.uid,
              productId,
              createdAt: serverTimestamp(),
            });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/wishlist/${productId}`);
        }
      } else {
        setWishlist((prev) => (existsInWish ? prev.filter((id) => id !== productId) : [...prev, productId]));
      }
      const prod = products.find((p) => p.id === productId);
      notify(existsInWish ? 'Removed from Saved' : 'Saved to Wishlist', prod?.name);
    },
    [wishlist, user, dbProducts, products, notify]
  );

  const toggleCompare = useCallback(
    (productId: string) => {
      setCompareIds((prev) => {
        if (prev.includes(productId)) {
          return prev.filter((id) => id !== productId);
        }
        if (prev.length >= 4) {
          notify('Compare Limit Reached', 'You can compare up to 4 pieces simultaneously.', 'error');
          return prev;
        }
        notify('Added to Comparison');
        return [...prev, productId];
      });
    },
    [notify]
  );

  const recordRecentlyViewed = useCallback((productId: string) => {
    setRecentlyViewedIds((prev) => [productId, ...prev.filter((id) => id !== productId)].slice(0, 8));
  }, []);

  // Derived Cart Totals
  const enrichedCart = useMemo(() => {
    return cart
      .map((c) => {
        const product = products.find((p) => p.id === c.productId);
        if (!product) return null;
        return { ...c, product, unitPrice: getEffectivePrice(product) };
      })
      .filter((x): x is CartEntry & { product: Product; unitPrice: number } => Boolean(x));
  }, [cart, products]);

  const activeCartItems = useMemo(() => enrichedCart.filter((c) => !c.savedForLater), [enrichedCart]);
  const savedForLaterItems = useMemo(() => enrichedCart.filter((c) => c.savedForLater), [enrichedCart]);

  const cartCount = useMemo(
    () => activeCartItems.reduce((sum, item) => sum + item.quantity, 0),
    [activeCartItems]
  );

  const cartSubtotal = useMemo(
    () => activeCartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [activeCartItems]
  );

  const calculateShipping = useCallback(
    (_city: string, _subtotalAfterDiscount: number): number => {
      // Flat delivery fee of Rs. 200 for EVERY order, including Karachi
      return 200;
    },
    []
  );

  const validateCouponCode = useCallback(
    async (code: string, subtotal: number) => {
      const clean = code.trim().toUpperCase();
      if (!clean) {
        return { valid: false, discount: 0, message: 'Enter a promotional code.' };
      }

      let found: Coupon | undefined = INITIAL_COUPONS.find((c) => c.code === clean && c.active);
      try {
        const snap = await getDoc(doc(db, 'coupons', clean));
        if (snap.exists()) {
          const d = snap.data() as Coupon;
          found = d.active ? d : undefined;
        }
      } catch {
        // Fallback to initial coupons if not seeded yet
      }

      if (!found) {
        return { valid: false, discount: 0, message: 'Invalid or expired coupon code.' };
      }

      if (subtotal < found.minOrderAmount) {
        return {
          valid: false,
          discount: 0,
          message: `Minimum order of Rs. ${found.minOrderAmount.toLocaleString()} required for ${clean}.`,
        };
      }

      let discount =
        found.discountType === 'percentage'
          ? Math.round((subtotal * found.discountValue) / 100)
          : Math.min(subtotal, found.discountValue);
      if (found.maxDiscount && discount > found.maxDiscount) {
        discount = found.maxDiscount;
      }

      return {
        valid: true,
        discount,
        coupon: found,
        message: `${clean} applied — -Rs. ${discount.toLocaleString()}`,
      };
    },
    []
  );

  // Auth Actions
  const loginWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
    notify('Signed in with Google', 'Welcome back to AUREVÉ.', 'success');
  }, [notify]);

  const loginWithEmail = useCallback(
    async (email: string, password: string) => {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      notify('Welcome Back', 'Signed into your AUREVÉ account.', 'success');
    },
    [notify]
  );

  const registerWithEmail = useCallback(
    async (name: string, email: string, password: string, phone: string) => {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: name.trim().slice(0, 80) });
      setUserPhone(phone.trim().slice(0, 30));
      notify('Account Created', 'Welcome to AUREVÉ.', 'success');
    },
    [notify]
  );

  const resetPassword = useCallback(
    async (email: string) => {
      await sendPasswordResetEmail(auth, email.trim());
      notify('Password Reset Sent', `Instructions dispatched to ${email.trim()}.`, 'success');
    },
    [notify]
  );

  const logout = useCallback(async () => {
    await signOut(auth);
    notify('Signed Out', 'You have signed out safely.');
  }, [notify]);

  const updateCustomerProfile = useCallback(
    async (displayName: string, phone: string, optIn: boolean) => {
      if (!user) return;
      await updateProfile(user, { displayName: displayName.trim().slice(0, 80) });
      if (user.emailVerified) {
        const batch = writeBatch(db);
        batch.update(doc(db, 'users', user.uid), {
          displayName: displayName.trim().slice(0, 80),
          updatedAt: serverTimestamp(),
        });
        batch.set(
          doc(db, 'users', user.uid, 'private', 'info'),
          {
            uid: user.uid,
            email: (user.email || '').slice(0, 160),
            phone: phone.trim().slice(0, 30),
            whatsappOptIn: optIn,
            updatedAt: serverTimestamp(),
          }
        );
        await batch.commit();
      }
      setUserPhone(phone.trim());
      setWhatsappOptIn(optIn);
      notify('Profile Saved', 'Your AUREVÉ preferences have been updated.', 'success');
    },
    [user, notify]
  );

  const saveAddressRecord = useCallback(
    async (addr: Omit<SavedAddress, 'id'>) => {
      if (!user || !user.emailVerified) {
        notify('Verified Account Required', 'Sign in with a verified Google account to save addresses.', 'error');
        return;
      }
      const id = `addr_${Date.now()}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'addresses', id), {
          uid: user.uid,
          label: addr.label.trim().slice(0, 40),
          recipientName: addr.recipientName.trim().slice(0, 80),
          phone: addr.phone.trim().slice(0, 30),
          city: addr.city.trim().slice(0, 60),
          area: addr.area.trim().slice(0, 80),
          street: addr.street.trim().slice(0, 120),
          houseNumber: addr.houseNumber.trim().slice(0, 50),
          ...(addr.instructions ? { instructions: addr.instructions.trim().slice(0, 240) } : {}),
          isDefault: Boolean(addr.isDefault),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        notify('Address Saved', `${addr.label} (${addr.city})`, 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/addresses/${id}`);
      }
    },
    [user, notify]
  );

  const deleteAddressRecord = useCallback(
    async (id: string) => {
      if (!user || !user.emailVerified) return;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'addresses', id));
        notify('Address Removed');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/addresses/${id}`);
      }
    },
    [user, notify]
  );

  // Authoritative Order Placement (Server Quote + Atomic Firestore Batch + Stock Decrement + Payment Gateway)
  const placeOrder = useCallback(
    async (input: PlaceOrderInput) => {
      if (activeCartItems.length === 0) {
        throw new Error('Your shopping bag is empty.');
      }

      // Check stock prevent overselling
      for (const item of activeCartItems) {
        if (item.quantity > item.product.stock) {
          throw new Error(`Insufficient stock for ${item.product.name} (only ${item.product.stock} left).`);
        }
      }

      // Check custom coupon from Firestore if any
      let customCoupon: Coupon | null = null;
      if (input.couponCode) {
        const res = await validateCouponCode(input.couponCode, cartSubtotal);
        if (res.valid && res.coupon) {
          customCoupon = res.coupon;
        }
      }

      // 1. Request authoritative quote and unique orderNumber from Express backend
      const quoteRes = await fetch('/api/checkout/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: activeCartItems.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            name: i.product.name,
          })),
          city: input.city,
          couponCode: input.couponCode,
          customCoupon,
        }),
      });

      if (!quoteRes.ok) {
        const errBody = await quoteRes.json().catch(() => ({}));
        throw new Error(
          errBody.error ||
          `Failed to calculate authoritative order total (Server responded with HTTP ${quoteRes.status}).`
        );
      }

      const quote = await quoteRes.json();
      const orderNumber: string = quote.orderNumber;
      const orderId = `ord_${orderNumber.replace(/[^a-zA-Z0-9_-]/g, '')}`;

      // Cash on Delivery, Easypaisa & JazzCash are coming soon — selection and processing are disabled
      if (input.paymentMethod === 'cod') {
        throw new Error('Cash on Delivery is coming soon and currently disabled. Please pay securely with Card.');
      }
      if (input.paymentMethod === 'easypaisa' || input.paymentMethod === 'jazzcash') {
        throw new Error(
          `${input.paymentMethod === 'easypaisa' ? 'Easypaisa' : 'JazzCash'} payment is coming soon and currently disabled. Please select Card payment.`
        );
      }

      // Determine owner userId ('guest' for unauthenticated/unverified, uid for verified user)
      const ownerId = user && user.emailVerified ? user.uid : 'guest';
      const itemSummary = activeCartItems
        .map((i) => `${i.product.name} (${i.size}) x${i.quantity}`)
        .join(', ')
        .slice(0, 600);
      const totalUnits = activeCartItems.reduce((s, i) => s + i.quantity, 0);

      // If Stripe is selected, check that server can create session before committing order
      let stripeSessionUrl: string | undefined;
      let stripeSessionId: string | undefined;
      if (input.paymentMethod === 'stripe') {
        const stripeRes = await fetch('/api/checkout/stripe-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: activeCartItems.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              name: i.product.name,
            })),
            city: input.city,
            couponCode: input.couponCode,
            customCoupon,
            orderId,
            orderNumber,
            customerEmail: input.customerEmail.trim(),
            idempotencyKey: `${ownerId}_${orderNumber}`,
            clientOrigin: window.location.origin,
            fullOrderPayload: {
              orderId,
              orderNumber,
              customerName: input.customerName.trim(),
              customerEmail: input.customerEmail.trim(),
              customerPhone: input.customerPhone.trim(),
              city: input.city.trim(),
              area: input.area.trim(),
              street: input.street.trim(),
              houseNumber: input.houseNumber.trim(),
              instructions: input.instructions?.trim(),
              paymentMethod: 'stripe',
              paymentStatus: 'pending',
              status: 'Pending',
              subtotal: quote.subtotal,
              discountTotal: quote.discountTotal,
              shippingFee: quote.shippingFee,
              grandTotal: quote.grandTotal,
              couponCode: quote.appliedCoupon,
              items: activeCartItems.map((i) => ({
                name: i.product.name,
                size: i.size,
                color: i.color,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
              })),
              createdAt: new Date().toISOString(),
            },
          }),
        });
        const stripeData = await stripeRes.json().catch(() => ({}));
        if (!stripeRes.ok || !stripeData.url) {
          throw new Error(
            stripeData.error ||
              'Stripe checkout session could not be initialized. Configure STRIPE_SECRET_KEY in AI Studio Secrets.'
          );
        }
        stripeSessionUrl = stripeData.url;
        stripeSessionId = String(stripeData.sessionId || '').slice(0, 140);
      }

      // 2. Atomic Firestore writeBatch: Order + OrderItems + Sanitized OrderLookup + Stock Decrement
      const batch = writeBatch(db);

      const initialStatus: OrderStatus = input.paymentMethod === 'stripe' ? 'Pending' : 'New Order';

      const orderDocData: Record<string, unknown> = {
        orderNumber,
        userId: ownerId,
        customerName: input.customerName.trim().slice(0, 100),
        customerEmail: input.customerEmail.trim().slice(0, 160),
        customerPhone: input.customerPhone.trim().slice(0, 30),
        city: input.city.trim().slice(0, 60),
        area: input.area.trim().slice(0, 80),
        street: input.street.trim().slice(0, 120),
        houseNumber: input.houseNumber.trim().slice(0, 50),
        paymentMethod: input.paymentMethod,
        paymentStatus: 'pending',
        status: initialStatus,
        subtotal: quote.subtotal,
        discountTotal: quote.discountTotal,
        shippingFee: quote.shippingFee,
        grandTotal: quote.grandTotal,
        itemSummary,
        itemCount: totalUnits,
        statusHistory: [
          {
            orderId,
            previousStatus: 'None',
            newStatus: initialStatus,
            changedBy: ownerId === 'guest' ? 'guest_checkout' : (user?.email || 'customer'),
            note: 'Order submitted by customer',
            timestamp: new Date().toISOString(),
          },
        ],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (stripeSessionId) {
        orderDocData.paymentRef = stripeSessionId;
      }
      if (input.instructions?.trim()) {
        orderDocData.instructions = input.instructions.trim().slice(0, 240);
      }
      if (quote.appliedCoupon) {
        orderDocData.couponCode = quote.appliedCoupon;
      }

      batch.set(doc(db, 'orders', orderId), orderDocData);

      // Sanitized public tracking lookup
      const lookupDocData: Record<string, unknown> = {
        orderNumber,
        orderId,
        status: initialStatus,
        paymentMethod: input.paymentMethod,
        paymentStatus: 'pending',
        itemSummary,
        city: input.city.trim().slice(0, 60),
        grandTotal: quote.grandTotal,
        itemCount: totalUnits,
        updatedAt: serverTimestamp(),
      };
      if (stripeSessionId) {
        lookupDocData.stripeSessionId = stripeSessionId;
      }
      batch.set(doc(db, 'order_lookup', orderNumber), lookupDocData);

      // Subcollection line items + stock decrement on Firestore products + stock history
      activeCartItems.forEach((item, idx) => {
        const itemId = `item_${idx + 1}`;
        batch.set(doc(db, 'orders', orderId, 'items', itemId), {
          orderId,
          userId: ownerId,
          productId: item.productId,
          name: item.product.name.slice(0, 120),
          sku: item.product.sku.slice(0, 40),
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          size: item.size.slice(0, 30),
          color: item.color.slice(0, 40),
          createdAt: serverTimestamp(),
        });

        if (dbProducts.some((p) => p.id === item.productId)) {
          const nextStock = Math.max(0, item.product.stock - item.quantity);
          batch.update(doc(db, 'products', item.productId), {
            stock: nextStock,
            updatedAt: serverTimestamp(),
          });

          // Stock History Audit Record
          const histId = `stk_ord_${orderNumber}_${item.productId}_${idx}`;
          batch.set(doc(db, 'stockHistory', histId), {
            id: histId,
            productId: item.productId,
            productName: item.product.name,
            sku: item.product.sku,
            variantKey: `${item.size} / ${item.color}`,
            previousStock: item.product.stock,
            newStock: nextStock,
            changeAmount: -item.quantity,
            changeType: 'order_placement',
            reason: `Order placed #${orderNumber}`,
            changedBy: ownerId === 'guest' ? 'guest_checkout' : (user?.email || 'customer'),
            timestamp: new Date().toISOString(),
          });
        }
      });

      // Award loyalty points (1 point per Rs. 100 spent) if verified user document exists
      if (ownerId !== 'guest') {
        const earned = Math.min(5000, Math.floor(quote.grandTotal / 10));
        if (earned > 0) {
          const userSnap = await getDoc(doc(db, 'users', ownerId)).catch(() => null);
          if (userSnap && userSnap.exists()) {
            batch.update(doc(db, 'users', ownerId), {
              loyaltyPoints: loyaltyPoints + earned,
              updatedAt: serverTimestamp(),
            });
          }
        }
      }

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `orders/${orderId}`);
      }

      // Automatically dispatch WhatsApp notification upon successful order placement
      if (input.paymentMethod !== 'stripe') {
        fetch('/api/order/notify-whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            orderNumber,
            customerName: input.customerName.trim(),
            customerEmail: input.customerEmail.trim(),
            customerPhone: input.customerPhone.trim(),
            city: input.city.trim(),
            area: input.area.trim(),
            street: input.street.trim(),
            houseNumber: input.houseNumber.trim(),
            instructions: input.instructions?.trim(),
            paymentMethod: input.paymentMethod,
            paymentStatus: 'pending',
            status: input.paymentMethod === 'cod' ? 'Confirmed' : 'Pending',
            subtotal: quote.subtotal,
            discountTotal: quote.discountTotal,
            shippingFee: quote.shippingFee,
            grandTotal: quote.grandTotal,
            couponCode: quote.appliedCoupon,
            items: activeCartItems.map((i) => ({
              name: i.product.name,
              size: i.size,
              color: i.color,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
            })),
            createdAt: new Date().toISOString(),
          }),
        }).catch((err) => console.warn('[StoreContext] WhatsApp dispatch notice:', err));
      }

      if (input.saveAddress && ownerId !== 'guest') {
        await saveAddressRecord({
          label: 'Primary Delivery',
          recipientName: input.customerName,
          phone: input.customerPhone,
          city: input.city,
          area: input.area,
          street: input.street,
          houseNumber: input.houseNumber,
          instructions: input.instructions,
          isDefault: true,
        });
      }

      // Only clear the active bag immediately for non-redirect orders (e.g. COD);
      // for Stripe Hosted Checkout, keep items until payment completes so cancellation or iframe handoff never shows an empty bag.
      if (input.paymentMethod !== 'stripe') {
        await clearActiveCart();
      }

      return {
        orderNumber,
        orderId,
        stripeRedirectUrl: stripeSessionUrl,
        stripeSessionId,
        grandTotal: quote.grandTotal,
      };
    },
    [
      activeCartItems,
      cartSubtotal,
      validateCouponCode,
      user,
      dbProducts,
      loyaltyPoints,
      saveAddressRecord,
      clearActiveCart,
    ]
  );

  const cancelCustomerOrder = useCallback(
    async (order: OrderRecord) => {
      if (order.status !== 'Pending') {
        notify('Cannot Cancel Order', 'Only Pending orders can be cancelled directly.', 'error');
        return;
      }
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'orders', order.id), {
          status: 'Cancelled',
          updatedAt: serverTimestamp(),
        });
        batch.update(doc(db, 'order_lookup', order.orderNumber), {
          status: 'Cancelled',
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
        notify('Order Cancelled', `Order ${order.orderNumber} has been cancelled.`, 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `orders/${order.id}`);
      }
    },
    [notify]
  );

  const requestCustomerReturn = useCallback(
    async (order: OrderRecord, reason: string) => {
      if (order.status !== 'Delivered') {
        notify('Not Eligible Yet', 'Returns can be requested once an order is Delivered.', 'error');
        return;
      }
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'orders', order.id), {
          status: 'Return Requested',
          returnReason: reason.trim().slice(0, 300),
          updatedAt: serverTimestamp(),
        });
        batch.update(doc(db, 'order_lookup', order.orderNumber), {
          status: 'Return Requested',
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
        notify('Return Requested', `Atelier Client Care received your request for ${order.orderNumber}.`, 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `orders/${order.id}`);
      }
    },
    [notify]
  );

  const updateOrderStatusAuthoritative = useCallback(
    async (order: OrderRecord, newStatus: OrderStatus, note?: string, cancellationReason?: string) => {
      const batch = writeBatch(db);
      const orderRef = doc(db, 'orders', order.id);
      const lookupRef = doc(db, 'order_lookup', order.orderNumber);

      const histEntry: OrderStatusHistoryRecord = {
        orderId: order.id,
        previousStatus: order.status,
        newStatus,
        changedBy: user?.email || 'razasphare@gmail.com',
        note: note || '',
        timestamp: new Date().toISOString(),
      };

      const nextPaymentStatus =
        newStatus === 'Delivered' && order.paymentMethod === 'cod'
          ? 'paid'
          : newStatus === 'Refunded'
          ? 'refunded'
          : order.paymentStatus;

      const existingHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
      const nextHistory = [...existingHistory, histEntry];

      const orderUpdate: Record<string, unknown> = {
        status: newStatus,
        paymentStatus: nextPaymentStatus,
        statusHistory: nextHistory,
        updatedAt: serverTimestamp(),
      };

      if (note?.trim()) {
        orderUpdate.adminNotes = note.trim();
      }
      if (cancellationReason?.trim()) {
        orderUpdate.cancellationReason = cancellationReason.trim();
      }

      batch.update(orderRef, orderUpdate);
      batch.update(lookupRef, {
        status: newStatus,
        paymentStatus: nextPaymentStatus,
        updatedAt: serverTimestamp(),
      });

      // If order is cancelled, restore stock for eligible cancelled orders!
      if (newStatus === 'Cancelled' && order.status !== 'Cancelled') {
        try {
          const itemsSnap = await getDocs(collection(db, 'orders', order.id, 'items'));
          itemsSnap.forEach((itemDoc) => {
            const itemData = itemDoc.data();
            const targetProd = products.find((p) => p.id === itemData.productId);
            if (targetProd) {
              const restoredStock = targetProd.stock + (Number(itemData.quantity) || 1);
              batch.update(doc(db, 'products', itemData.productId), {
                stock: restoredStock,
                updatedAt: serverTimestamp(),
              });

              const histId = `stk_cancel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              batch.set(doc(db, 'stockHistory', histId), {
                id: histId,
                productId: itemData.productId,
                productName: itemData.name || targetProd.name,
                sku: itemData.sku || targetProd.sku,
                variantKey: `${itemData.size} / ${itemData.color}`,
                previousStock: targetProd.stock,
                newStock: restoredStock,
                changeAmount: Number(itemData.quantity) || 1,
                changeType: 'order_cancellation',
                reason: `Stock restored from cancelled order #${order.orderNumber}. Reason: ${cancellationReason || 'Admin cancellation'}`,
                changedBy: user?.email || 'razasphare@gmail.com',
                timestamp: new Date().toISOString(),
              });
            }
          });
        } catch (e) {
          console.warn('Could not read line items for restoration:', e);
        }
      }

      await batch.commit();
      notify('Order Updated', `${order.orderNumber} is now ${newStatus}`, 'success');

      // Dispatch customer notification through WhatsApp / Notification API
      fetch('/api/order/notify-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          city: order.city,
          grandTotal: order.grandTotal,
          paymentMethod: order.paymentMethod,
          paymentStatus: nextPaymentStatus,
          status: newStatus,
          itemSummary: order.itemSummary,
        }),
      }).catch((err) => console.warn('[Admin WhatsApp update notice]:', err));
    },
    [user, products, notify]
  );

  const adjustProductStock = useCallback(
    async (
      productId: string,
      adjustment: number,
      changeType: StockHistoryRecord['changeType'],
      reason: string,
      variantKey?: string
    ) => {
      const prod = products.find((p) => p.id === productId);
      if (!prod) return;
      const currentStock = prod.stock || 0;
      const nextStock = Math.max(0, currentStock + adjustment);

      const batch = writeBatch(db);
      const prodRef = doc(db, 'products', productId);

      const updatePayload: Record<string, unknown> = {
        stock: nextStock,
        updatedAt: serverTimestamp(),
      };

      if (variantKey && prod.variantStock) {
        const currentVar = prod.variantStock[variantKey] || 0;
        updatePayload[`variantStock.${variantKey}`] = Math.max(0, currentVar + adjustment);
      }

      batch.update(prodRef, updatePayload);

      const histId = `stk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const histRef = doc(db, 'stockHistory', histId);
      batch.set(histRef, {
        id: histId,
        productId,
        productName: prod.name,
        sku: prod.sku,
        variantKey: variantKey || 'Standard',
        previousStock: currentStock,
        newStock: nextStock,
        changeAmount: adjustment,
        changeType,
        reason: reason.trim() || 'Manual adjustment by Atelier Admin',
        changedBy: user?.email || 'razasphare@gmail.com',
        timestamp: new Date().toISOString(),
      });

      await batch.commit();
      notify('Stock Updated', `${prod.name}: ${currentStock} → ${nextStock}`, 'success');
    },
    [products, user, notify]
  );

  const addAdminOrderNote = useCallback(
    async (orderId: string, note: string) => {
      try {
        await updateDoc(doc(db, 'orders', orderId), {
          adminNotes: note.trim(),
          updatedAt: serverTimestamp(),
        });
        notify('Admin Note Saved', undefined, 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
      }
    },
    [notify]
  );

  const value: StoreContextValue = {
    user,
    authReady,
    isAdmin,
    loyaltyPoints,
    userPhone,
    whatsappOptIn,
    products,
    catalogLoading,
    categories,
    banners,
    shippingZones,
    cart,
    wishlist,
    compareIds,
    recentlyViewedIds,
    savedAddresses,
    myOrders,
    cartDrawerOpen,
    setCartDrawerOpen,
    searchDrawerOpen,
    setSearchDrawerOpen,
    toasts,
    notify,
    dismissToast,
    addToCart,
    updateCartQuantity,
    toggleSaveForLater,
    removeFromCart,
    clearActiveCart,
    toggleWishlist,
    toggleCompare,
    recordRecentlyViewed,
    activeCartItems,
    savedForLaterItems,
    cartCount,
    cartSubtotal,
    calculateShipping,
    validateCouponCode,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    resetPassword,
    logout,
    updateCustomerProfile,
    saveAddressRecord,
    deleteAddressRecord,
    placeOrder,
    cancelCustomerOrder,
    requestCustomerReturn,
    updateOrderStatusAuthoritative,
    adjustProductStock,
    addAdminOrderNote,
    seedCatalogToFirestore,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
