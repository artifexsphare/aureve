import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { AlertTriangle, Download, Plus, ShieldAlert, Trash2, Upload } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { OperationType, db, handleFirestoreError, storage } from '../firebase';
import {
  AdminMemberRecord,
  Banner,
  Category,
  Coupon,
  OrderRecord,
  OrderStatus,
  Product,
  ShippingZone,
} from '../types';

const ALL_ORDER_STATUSES: OrderStatus[] = [
  'Pending',
  'Confirmed',
  'Processing',
  'Packed',
  'Shipped',
  'Delivered',
  'Cancelled',
  'Return Requested',
];

export const AdminDashboardPage: React.FC = () => {
  const { user, authReady, isAdmin, products, categories, banners, shippingZones, notify, seedCatalogToFirestore } =
    useStore();

  const [activeTab, setActiveTab] = useState<
    'analytics' | 'orders' | 'products' | 'categories' | 'coupons' | 'shipping' | 'banners' | 'customers' | 'admins'
  >('analytics');

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allOrders, setAllOrders] = useState<OrderRecord[]>([]);
  const [allCoupons, setAllCoupons] = useState<Coupon[]>([]);
  const [allCustomers, setAllCustomers] = useState<{ uid: string; displayName: string; loyaltyPoints: number }[]>([]);
  const [allAdmins, setAllAdmins] = useState<AdminMemberRecord[]>([]);

  // Orders Filter State
  const [orderFilter, setOrderFilter] = useState<'all' | 'active' | 'returns' | 'delivered' | 'cancelled'>('all');

  // Product Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pName, setPName] = useState('');
  const [pSku, setPSku] = useState('');
  const [pCategory, setPCategory] = useState('Clothing');
  const [pSubcategory, setPSubcategory] = useState('Dresses');
  const [pPrice, setPPrice] = useState(1200);
  const [pSalePrice, setPSalePrice] = useState<string>('');
  const [pStock, setPStock] = useState(15);
  const [pSizes, setPSizes] = useState('FR 34, FR 36, FR 38, FR 40');
  const [pColors, setPColors] = useState('Ivory, Blush');
  const [pMaterial, setPMaterial] = useState('100% Mulberry Silk');
  const [pCare, setPCare] = useState('Specialist dry clean only');
  const [pOrigin, setPOrigin] = useState('Made in France & Italy');
  const [pDesc, setPDesc] = useState('');
  const [pPublished, setPPublished] = useState(true);
  const [pBestSeller, setPBestSeller] = useState(false);
  const [pFlashSale, setPFlashSale] = useState(false);
  const [pImages, setPImages] = useState<string[]>([]);
  const [uploadingImg, setUploadingImg] = useState(false);

  // Category Form
  const [catName, setCatName] = useState('');
  const [catSubs, setCatSubs] = useState('Dresses, Outerwear');

  // Coupon Form
  const [cpCode, setCpCode] = useState('');
  const [cpType, setCpType] = useState<'percentage' | 'fixed'>('percentage');
  const [cpValue, setCpValue] = useState(15);
  const [cpMin, setCpMin] = useState(500);

  // Banner Form
  const [bnTitle, setBnTitle] = useState('');
  const [bnCta, setBnCta] = useState('Explore Shop');
  const [bnLink, setBnLink] = useState('/shop');

  // Shipping Zone Form
  const [znName, setZnName] = useState('');
  const [znCities, setZnCities] = useState('Karachi, Lahore');
  const [znFee, setZnFee] = useState(20);
  const [znFree, setZnFree] = useState(2500);

  // Admin Role Form
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'super_admin' | 'manager' | 'fulfillment'>('manager');

  useEffect(() => {
    if (!authReady || !user || !isAdmin) return;

    const unsubProds = onSnapshot(
      collection(db, 'products'),
      (snap) => {
        const list: Product[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<Product, 'id'>) }));
        setAllProducts(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'products')
    );

    const unsubOrders = onSnapshot(
      collection(db, 'orders'),
      (snap) => {
        const list: OrderRecord[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<OrderRecord, 'id'>) }));
        list.sort((a, b) => String(b.orderNumber).localeCompare(String(a.orderNumber)));
        setAllOrders(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'orders')
    );

    const unsubCoupons = onSnapshot(
      query(collection(db, 'coupons'), where('code', '>=', '')),
      (snap) => {
        const list: Coupon[] = [];
        snap.forEach((d) => list.push(d.data() as Coupon));
        setAllCoupons(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'coupons')
    );

    const unsubUsers = onSnapshot(
      query(collection(db, 'users'), where('uid', '>=', '')),
      (snap) => {
        const list: { uid: string; displayName: string; loyaltyPoints: number }[] = [];
        snap.forEach((d) => {
          const dt = d.data();
          list.push({ uid: dt.uid, displayName: dt.displayName, loyaltyPoints: dt.loyaltyPoints || 0 });
        });
        setAllCustomers(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    const unsubAdmins = onSnapshot(
      query(collection(db, 'admins'), where('uid', '>=', '')),
      (snap) => {
        const list: AdminMemberRecord[] = [];
        snap.forEach((d) => list.push(d.data() as AdminMemberRecord));
        setAllAdmins(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'admins')
    );

    return () => {
      unsubProds();
      unsubOrders();
      unsubCoupons();
      unsubUsers();
      unsubAdmins();
    };
  }, [authReady, user, isAdmin]);

  const effectiveProducts = allProducts.length > 0 ? allProducts : products;

  const analytics = useMemo(() => {
    const validOrders = allOrders.filter((o) => o.status !== 'Cancelled' && o.paymentStatus !== 'refunded');
    const totalRevenue = validOrders.reduce((s, o) => s + o.grandTotal, 0);
    const deliveredCount = allOrders.filter((o) => o.status === 'Delivered').length;
    const returnRequests = allOrders.filter((o) => o.status === 'Return Requested');
    const lowStock = effectiveProducts.filter((p) => p.stock <= (p.lowStockThreshold || 5));

    // Compute Best-Selling Products from confirmed orders + catalog performance
    const unitSalesMap = new Map<string, number>();
    for (const ord of validOrders) {
      for (const prod of effectiveProducts) {
        if (ord.itemSummary.includes(prod.name)) {
          const escaped = prod.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const match = ord.itemSummary.match(new RegExp(`${escaped}[^,]*×(\\d+)`));
          const qty = match ? Number(match[1]) : 1;
          unitSalesMap.set(prod.id, (unitSalesMap.get(prod.id) || 0) + qty);
        }
      }
    }

    const bestSellingProducts = [...effectiveProducts]
      .map((prod) => {
        const unitsSold = unitSalesMap.get(prod.id) || 0;
        const unitPrice = prod.salePrice && prod.salePrice < prod.price ? prod.salePrice : prod.price;
        return {
          product: prod,
          unitsSold,
          estimatedRevenue: unitsSold * unitPrice,
        };
      })
      .sort((a, b) => {
        if (b.unitsSold !== a.unitsSold) return b.unitsSold - a.unitsSold;
        if (Boolean(b.product.bestSeller) !== Boolean(a.product.bestSeller)) {
          return b.product.bestSeller ? 1 : -1;
        }
        return (b.product.ratingCount || 0) - (a.product.ratingCount || 0);
      })
      .slice(0, 6);

    return {
      totalRevenue,
      validOrdersCount: validOrders.length,
      deliveredCount,
      returnRequests,
      lowStock,
      bestSellingProducts,
    };
  }, [allOrders, effectiveProducts]);

  const filteredOrders = useMemo(() => {
    if (orderFilter === 'returns') return allOrders.filter((o) => o.status === 'Return Requested' || o.paymentStatus === 'refunded');
    if (orderFilter === 'delivered') return allOrders.filter((o) => o.status === 'Delivered');
    if (orderFilter === 'cancelled') return allOrders.filter((o) => o.status === 'Cancelled');
    if (orderFilter === 'active') {
      return allOrders.filter((o) => !['Delivered', 'Cancelled'].includes(o.status));
    }
    return allOrders;
  }, [allOrders, orderFilter]);

  if (!authReady) {
    return <div className="p-12 text-xs text-[#737b86]">Verifying administrator authorization...</div>;
  }

  if (!user || !isAdmin) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center space-y-4">
        <ShieldAlert className="w-10 h-10 mx-auto text-[#16191f]" />
        <h1 className="wide text-lg tracking-[0.15em]">Restricted Atelier Administration</h1>
        <p className="text-xs text-[#737b86] leading-relaxed">
          Access is strictly enforced via Zero-Trust Firestore RBAC rules. Sign in with an
          authorized verified administrator account.
        </p>
        <Link to="/login?redirect=/admin" className="inline-block px-6 py-3 bg-[#16191f] text-white wide text-[10px] tracking-[0.15em]">
          Administrator Sign In
        </Link>
      </div>
    );
  }

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingImg(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, 4)) {
        const path = `products/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
        const sRef = storageRef(storage, path);
        await uploadBytes(sRef, file);
        const downloadUrl = await getDownloadURL(sRef);
        urls.push(downloadUrl);
      }
      setPImages((prev) => [...prev, ...urls].slice(0, 10));
      notify('Images Uploaded', `${urls.length} image(s) stored in Firebase Storage.`, 'success');
    } catch (err) {
      notify('Upload Failed', err instanceof Error ? err.message : 'Check Storage permissions.', 'error');
    } finally {
      setUploadingImg(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const slug = pName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 130);
    const id = editingId || `mv-custom-${Date.now()}`;
    const existingProd = effectiveProducts.find((x) => x.id === id);

    const payload: Record<string, unknown> = {
      name: pName.trim().slice(0, 120),
      slug: slug || `piece-${Date.now()}`,
      sku: pSku.trim().slice(0, 40),
      category: pCategory.trim().slice(0, 60),
      subcategory: pSubcategory.trim().slice(0, 60),
      price: Number(pPrice) || 0,
      stock: Number(pStock) || 0,
      lowStockThreshold: 5,
      published: pPublished,
      flashSale: pFlashSale,
      featured: true,
      bestSeller: pBestSeller,
      description: pDesc.trim().slice(0, 2000),
      material: pMaterial.trim().slice(0, 200),
      care: pCare.trim().slice(0, 300),
      origin: pOrigin.trim().slice(0, 100),
      sizes: pSizes
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 12),
      colors: pColors
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
        .slice(0, 12),
      images: pImages.slice(0, 10),
      updatedAt: serverTimestamp(),
    };
    if (pSalePrice.trim() && Number(pSalePrice) > 0) {
      payload.salePrice = Number(pSalePrice);
    }
    if (existingProd?.spriteBox) {
      payload.spriteBox = existingProd.spriteBox;
    }
    if (existingProd?.lookNumber) {
      payload.lookNumber = existingProd.lookNumber;
    }
    if (existingProd?.ratingAvg !== undefined) {
      payload.ratingAvg = existingProd.ratingAvg;
    }
    if (existingProd?.ratingCount !== undefined) {
      payload.ratingCount = existingProd.ratingCount;
    }

    try {
      const docRef = doc(db, 'products', id);
      if (editingId && allProducts.some((x) => x.id === editingId)) {
        const current = allProducts.find((x) => x.id === editingId)!;
        await setDoc(docRef, {
          ...payload,
          createdAt: current.createdAt || serverTimestamp(),
        });
      } else {
        await setDoc(docRef, {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }
      notify(editingId ? 'Product Updated' : 'Product Created', pName, 'success');
      setEditingId(null);
      setPName('');
      setPSku('');
      setPDesc('');
      setPSalePrice('');
      setPBestSeller(false);
      setPFlashSale(false);
      setPImages([]);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `products/${id}`);
    }
  };

  const handleUpdateOrderStatus = async (ord: OrderRecord, nextStatus: OrderStatus) => {
    try {
      const batch = writeBatch(db);
      const nextPaymentStatus =
        nextStatus === 'Delivered' && ord.paymentMethod === 'cod' ? 'paid' : ord.paymentStatus;
      batch.update(doc(db, 'orders', ord.id), {
        status: nextStatus,
        paymentStatus: nextPaymentStatus,
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'order_lookup', ord.orderNumber), {
        status: nextStatus,
        paymentStatus: nextPaymentStatus,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      notify('Order Status Updated', `${ord.orderNumber} → ${nextStatus}`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${ord.id}`);
    }
  };

  const handleApproveRefund = async (ord: OrderRecord) => {
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'orders', ord.id), {
        status: 'Cancelled',
        paymentStatus: 'refunded',
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'order_lookup', ord.orderNumber), {
        status: 'Cancelled',
        paymentStatus: 'refunded',
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      notify('Return Approved & Refunded', `${ord.orderNumber} marked refunded`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${ord.id}`);
    }
  };

  const exportOrdersCsv = () => {
    const header = [
      'OrderNumber',
      'CustomerName',
      'Phone',
      'Email',
      'City',
      'Area',
      'PaymentMethod',
      'PaymentStatus',
      'Status',
      'Subtotal',
      'Discount',
      'Shipping',
      'GrandTotal',
    ];
    const rows = allOrders.map((o) =>
      [
        o.orderNumber,
        `"${o.customerName.replace(/"/g, '""')}"`,
        `"${o.customerPhone}"`,
        o.customerEmail,
        o.city,
        `"${o.area.replace(/"/g, '""')}"`,
        o.paymentMethod,
        o.paymentStatus,
        o.status,
        o.subtotal,
        o.discountTotal,
        o.shippingFee,
        o.grandTotal,
      ].join(',')
    );
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AUREVE_Orders_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-12 py-8 sm:py-10 space-y-6 sm:space-y-8 w-full max-w-full overflow-hidden min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#e6ebf0] pb-6">
        <div>
          <div className="text-xs text-[#737b86]">Verified Administrator · {user.email}</div>
          <h1 className="wide text-2xl tracking-[0.14em] mt-1">AUREVÉ Atelier Command</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          {allProducts.length === 0 && (
            <button
              type="button"
              onClick={seedCatalogToFirestore}
              className="px-4 py-2.5 border border-[#16191f] text-xs wide tracking-[0.13em] active:bg-[#f3f6fa] touch-manipulation"
            >
              Sync Initial SS27 Catalog to Firestore
            </button>
          )}
          <button
            type="button"
            onClick={exportOrdersCsv}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#16191f] text-white wide text-[10px] tracking-[0.14em] active:opacity-90 touch-manipulation"
          >
            <Download className="w-3.5 h-3.5" /> Export Orders CSV
          </button>
        </div>
      </div>

      {/* Admin Module Switcher (Horizontal scrollable bar on mobile, stable height) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none sm:flex-wrap w-full shrink-0">
        {(
          [
            ['analytics', 'Reports & Low Stock'],
            ['orders', `Orders & Returns (${allOrders.length})`],
            ['products', `Products (${effectiveProducts.length})`],
            ['categories', 'Categories'],
            ['coupons', 'Coupons'],
            ['shipping', 'Shipping Zones'],
            ['banners', 'Banners'],
            ['customers', `Customers (${allCustomers.length})`],
            ['admins', 'Admin Roles'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`h-9 px-3.5 flex items-center justify-center text-xs whitespace-nowrap shrink-0 transition-colors touch-manipulation active:scale-95 ${
              activeTab === key
                ? 'bg-[#16191f] text-white'
                : 'bg-[#f3f6fa] text-[#737b86] hover:text-[#16191f]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 1. Sales Analytics, Best-Selling Products & Low Stock Alerts */}
      {activeTab === 'analytics' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            <div className="border border-[#e6ebf0] p-6">
              <div className="text-xs text-[#737b86]">Net Confirmed Revenue</div>
              <div className="text-2xl font-medium tabular-nums mt-2">
                Rs. {analytics.totalRevenue.toLocaleString()}
              </div>
            </div>
            <div className="border border-[#e6ebf0] p-6">
              <div className="text-xs text-[#737b86]">Active Orders</div>
              <div className="text-2xl font-medium tabular-nums mt-2">{analytics.validOrdersCount}</div>
            </div>
            <div className="border border-[#e6ebf0] p-6">
              <div className="text-xs text-[#737b86]">Delivered Dispatches</div>
              <div className="text-2xl font-medium tabular-nums mt-2">{analytics.deliveredCount}</div>
            </div>
            <div className="border border-[#e6ebf0] p-6">
              <div className="text-xs text-[#737b86]">Open Return Requests</div>
              <div className="text-2xl font-medium tabular-nums mt-2">{analytics.returnRequests.length}</div>
            </div>
            <div className="border border-[#e6ebf0] p-6">
              <div className="text-xs text-[#737b86]">Low-Stock Alerts</div>
              <div className="text-2xl font-medium tabular-nums mt-2">{analytics.lowStock.length}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Best-Selling Products Performance */}
            <div className="lg:col-span-7 border border-[#e6ebf0] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="wide text-xs tracking-[0.15em]">Best-Selling Pieces & Demand</h2>
                <span className="text-[11px] text-[#737b86]">Ranked by confirmed units & house demand</span>
              </div>
              <div className="divide-y divide-[#e6ebf0] text-xs">
                {analytics.bestSellingProducts.map(({ product: p, unitsSold, estimatedRevenue }, idx) => (
                  <div key={p.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium">
                        {idx + 1}. {p.name}{' '}
                        {p.bestSeller && <span className="text-[#737b86]">· House Best Seller</span>}
                      </div>
                      <div className="text-[#737b86] mt-0.5">
                        {p.sku} · {p.category} · Stock: <span className="tabular-nums">{p.stock}</span>
                      </div>
                    </div>
                    <div className="text-right tabular-nums whitespace-nowrap">
                      <div className="font-medium">
                        {unitsSold > 0 ? `${unitsSold} sold` : `Rs. ${p.price.toLocaleString()}`}
                      </div>
                      <div className="text-[#737b86]">
                        {unitsSold > 0
                          ? `Rs. ${estimatedRevenue.toLocaleString()} rev`
                          : `${p.ratingCount || 0} client reviews`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Low Stock Table */}
            <div className="lg:col-span-5 border border-[#e6ebf0] p-6 space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#16191f]" />
                <h2 className="wide text-xs tracking-[0.15em]">Low-Stock Inventory Watch</h2>
              </div>
              {analytics.lowStock.length === 0 ? (
                <p className="text-xs text-[#737b86]">All catalog SKUs have healthy stock reserves.</p>
              ) : (
                <div className="divide-y divide-[#e6ebf0] text-xs">
                  {analytics.lowStock.map((p) => (
                    <div key={p.id} className="py-3 flex items-center justify-between gap-3">
                      <span>
                        <strong>{p.name}</strong> ({p.sku})
                      </span>
                      <span className="tabular-nums font-medium whitespace-nowrap">
                        {p.stock} units left
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Orders & Returns Management */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {(
              [
                ['all', `All (${allOrders.length})`],
                ['active', 'Active / Fulfillment'],
                ['returns', `Returns & Refunds (${analytics.returnRequests.length})`],
                ['delivered', 'Delivered'],
                ['cancelled', 'Cancelled'],
              ] as const
            ).map(([k, lbl]) => (
              <button
                key={k}
                type="button"
                onClick={() => setOrderFilter(k)}
                className={`px-3 py-1.5 transition-colors ${
                  orderFilter === k
                    ? 'bg-[#16191f] text-white'
                    : 'bg-[#f3f6fa] text-[#737b86] hover:text-[#16191f]'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          {filteredOrders.length === 0 ? (
            <div className="p-12 bg-[#f3f6fa] text-xs text-[#737b86] text-center">
              No orders match this filter.
            </div>
          ) : (
            <div className="overflow-x-auto border border-[#e6ebf0] w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full text-left text-xs border-collapse min-w-[760px]">
                <thead className="bg-[#f3f6fa] border-b border-[#e6ebf0]">
                  <tr>
                    <th className="p-4">Order #</th>
                    <th className="p-4">Customer & Address</th>
                    <th className="p-4">Items</th>
                    <th className="p-4">Total</th>
                    <th className="p-4">Payment</th>
                    <th className="p-4">Lifecycle & Return Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6ebf0]">
                  {filteredOrders.map((ord) => (
                    <tr key={ord.id}>
                      <td className="p-4 font-medium whitespace-nowrap tabular-nums">{ord.orderNumber}</td>
                      <td className="p-4">
                        <div className="font-medium">{ord.customerName}</div>
                        <div className="text-[#737b86]">{ord.customerPhone} · {ord.customerEmail}</div>
                        <div className="text-[#737b86]">
                          {ord.houseNumber}, {ord.street}, {ord.area}, {ord.city}
                        </div>
                        {ord.returnReason && (
                          <div className="mt-1.5 p-2 bg-[#f3f6fa] text-[#16191f] font-medium">
                            Return / Exchange Note: {ord.returnReason}
                          </div>
                        )}
                      </td>
                      <td className="p-4 max-w-xs">{ord.itemSummary}</td>
                      <td className="p-4 tabular-nums font-medium">Rs. {ord.grandTotal.toLocaleString()}</td>
                      <td className="p-4 uppercase whitespace-nowrap">
                        {ord.paymentMethod} · {ord.paymentStatus}
                      </td>
                      <td className="p-4 space-y-2">
                        <select
                          value={ord.status}
                          onChange={(e) => handleUpdateOrderStatus(ord, e.target.value as OrderStatus)}
                          className="border border-[#16191f] px-2.5 py-1.5 bg-white text-xs block w-full"
                        >
                          {ALL_ORDER_STATUSES.map((st) => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                        {ord.status === 'Return Requested' && ord.paymentStatus !== 'refunded' && (
                          <button
                            type="button"
                            onClick={() => handleApproveRefund(ord)}
                            className="w-full px-2.5 py-1.5 bg-[#16191f] text-white text-[11px] hover:opacity-90"
                          >
                            Approve Return & Issue Refund
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. Product Catalog & Firebase Storage Multi-Image Upload */}
      {activeTab === 'products' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <form onSubmit={handleSaveProduct} className="lg:col-span-5 border border-[#e6ebf0] p-6 space-y-3">
            <h2 className="wide text-xs tracking-[0.15em]">
              {editingId ? 'Edit Product' : 'Add New Product'}
            </h2>
            <input
              required
              value={pName}
              onChange={(e) => setPName(e.target.value)}
              placeholder="Product Name"
              className="w-full border border-[#e6ebf0] px-3 py-2 text-xs"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                required
                value={pSku}
                onChange={(e) => setPSku(e.target.value)}
                placeholder="SKU (e.g. MV-SS27-3001)"
                className="border border-[#e6ebf0] px-3 py-2 text-xs"
              />
              <select
                value={pCategory}
                onChange={(e) => setPCategory(e.target.value)}
                className="border border-[#e6ebf0] px-3 py-2 text-xs bg-white"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
              <input
                value={pSubcategory}
                onChange={(e) => setPSubcategory(e.target.value)}
                placeholder="Subcategory"
                className="border border-[#e6ebf0] px-3 py-2 text-xs"
              />
              <input
                type="number"
                required
                value={pStock}
                onChange={(e) => setPStock(Number(e.target.value))}
                placeholder="Stock"
                className="border border-[#e6ebf0] px-3 py-2 text-xs"
              />
              <input
                type="number"
                required
                value={pPrice}
                onChange={(e) => setPPrice(Number(e.target.value))}
                placeholder="Price (Rs.)"
                className="border border-[#e6ebf0] px-3 py-2 text-xs"
              />
              <input
                type="number"
                value={pSalePrice}
                onChange={(e) => setPSalePrice(e.target.value)}
                placeholder="Sale Price (optional)"
                className="border border-[#e6ebf0] px-3 py-2 text-xs"
              />
            </div>
            <input
              value={pSizes}
              onChange={(e) => setPSizes(e.target.value)}
              placeholder="Sizes comma-separated"
              className="w-full border border-[#e6ebf0] px-3 py-2 text-xs"
            />
            <input
              value={pColors}
              onChange={(e) => setPColors(e.target.value)}
              placeholder="Colors comma-separated"
              className="w-full border border-[#e6ebf0] px-3 py-2 text-xs"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                value={pMaterial}
                onChange={(e) => setPMaterial(e.target.value)}
                placeholder="Material"
                className="border border-[#e6ebf0] px-3 py-2 text-xs"
              />
              <input
                value={pCare}
                onChange={(e) => setPCare(e.target.value)}
                placeholder="Care Guide"
                className="border border-[#e6ebf0] px-3 py-2 text-xs"
              />
              <input
                value={pOrigin}
                onChange={(e) => setPOrigin(e.target.value)}
                placeholder="Origin"
                className="border border-[#e6ebf0] px-3 py-2 text-xs"
              />
            </div>
            <textarea
              required
              rows={3}
              value={pDesc}
              onChange={(e) => setPDesc(e.target.value)}
              placeholder="Editorial description..."
              className="w-full border border-[#e6ebf0] px-3 py-2 text-xs"
            />

            {/* Firebase Storage Upload */}
            <div className="border border-dashed border-[#a4adb8] p-3 text-xs space-y-2">
              <label className="inline-flex items-center gap-2 cursor-pointer font-medium">
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingImg ? 'Uploading to Firebase Storage...' : 'Upload Product Images'}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleImageUpload(e.target.files)}
                  className="hidden"
                />
              </label>
              {pImages.length > 0 && (
                <div className="text-[11px] text-[#737b86]">{pImages.length} image URL(s) attached</div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-5 text-xs">
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={pPublished}
                  onChange={(e) => setPPublished(e.target.checked)}
                />
                <span>Published</span>
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={pBestSeller}
                  onChange={(e) => setPBestSeller(e.target.checked)}
                />
                <span>Best Seller</span>
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={pFlashSale}
                  onChange={(e) => setPFlashSale(e.target.checked)}
                />
                <span>Seasonal Flash Offer</span>
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-3 bg-[#16191f] text-white wide text-[10px] tracking-[0.14em]"
              >
                {editingId ? 'Save Changes' : 'Publish Product'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="px-4 py-3 border border-[#e6ebf0] text-xs"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="lg:col-span-7 divide-y divide-[#e6ebf0] border border-[#e6ebf0] max-h-[680px] overflow-y-auto">
            {effectiveProducts.map((prod) => (
              <div key={prod.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                <div>
                  <div className="font-medium">
                    {prod.name} {!prod.published && <span className="text-[#a4adb8]">(Draft)</span>}
                  </div>
                  <div className="text-[#737b86] tabular-nums">
                    {prod.sku} · {prod.category} · Stock: {prod.stock} · Rs. {prod.price.toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(prod.id);
                      setPName(prod.name);
                      setPSku(prod.sku);
                      setPCategory(prod.category);
                      setPSubcategory(prod.subcategory || '');
                      setPPrice(prod.price);
                      setPSalePrice(prod.salePrice ? String(prod.salePrice) : '');
                      setPStock(prod.stock);
                      setPSizes(prod.sizes.join(', '));
                      setPColors(prod.colors.join(', '));
                      setPMaterial(prod.material || '100% Mulberry Silk');
                      setPCare(prod.care || 'Specialist dry clean only');
                      setPOrigin(prod.origin || 'Made in France & Italy');
                      setPDesc(prod.description);
                      setPPublished(prod.published);
                      setPBestSeller(Boolean(prod.bestSeller));
                      setPFlashSale(Boolean(prod.flashSale));
                      setPImages(prod.images || []);
                    }}
                    className="underline text-[#16191f]"
                  >
                    Edit
                  </button>
                  {allProducts.some((x) => x.id === prod.id) && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await deleteDoc(doc(db, 'products', prod.id));
                          notify('Product Deleted', prod.name);
                        } catch (err) {
                          handleFirestoreError(err, OperationType.DELETE, `products/${prod.id}`);
                        }
                      }}
                      className="text-[#737b86] hover:text-[#16191f]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Categories */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const slug = catName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
              const id = `cat-${slug}`;
              try {
                await setDoc(doc(db, 'categories', id), {
                  name: catName.trim().slice(0, 80),
                  slug,
                  description: `${catName} collection`,
                  subcategories: catSubs
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .slice(0, 20),
                  sortOrder: categories.length + 1,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
                setCatName('');
                notify('Category Saved', catName, 'success');
              } catch (err) {
                handleFirestoreError(err, OperationType.WRITE, `categories/${id}`);
              }
            }}
            className="border border-[#e6ebf0] p-6 space-y-3"
          >
            <h2 className="wide text-xs tracking-[0.15em]">Add / Update Category</h2>
            <input
              required
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="Category Name"
              className="w-full border border-[#e6ebf0] px-3 py-2 text-xs"
            />
            <input
              value={catSubs}
              onChange={(e) => setCatSubs(e.target.value)}
              placeholder="Subcategories (comma-separated)"
              className="w-full border border-[#e6ebf0] px-3 py-2 text-xs"
            />
            <button type="submit" className="px-5 py-2.5 bg-[#16191f] text-white wide text-[10px] tracking-[0.14em]">
              Save Category
            </button>
          </form>

          <div className="space-y-3">
            {categories.map((c: Category) => (
              <div key={c.id} className="border border-[#e6ebf0] p-4 text-xs">
                <div className="font-medium">{c.name}</div>
                <div className="text-[#737b86] mt-1">{c.subcategories.join(' · ')}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Coupons */}
      {activeTab === 'coupons' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const clean = cpCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
              if (clean.length < 2) return;
              try {
                await setDoc(doc(db, 'coupons', clean), {
                  code: clean,
                  discountType: cpType,
                  discountValue: Number(cpValue),
                  minOrderAmount: Number(cpMin),
                  active: true,
                  description: `${cpValue}${cpType === 'percentage' ? '%' : '$'} privilege`,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
                setCpCode('');
                notify('Coupon Published', clean, 'success');
              } catch (err) {
                handleFirestoreError(err, OperationType.WRITE, `coupons/${clean}`);
              }
            }}
            className="border border-[#e6ebf0] p-6 space-y-3"
          >
            <h2 className="wide text-xs tracking-[0.15em]">Create Promotional Coupon</h2>
            <input
              required
              value={cpCode}
              onChange={(e) => setCpCode(e.target.value)}
              placeholder="CODE (e.g. EID20)"
              className="w-full border border-[#e6ebf0] px-3 py-2 text-xs uppercase"
            />
            <div className="grid grid-cols-3 gap-2">
              <select
                value={cpType}
                onChange={(e) => setCpType(e.target.value as 'percentage' | 'fixed')}
                className="border border-[#e6ebf0] px-2 py-2 text-xs bg-white"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed (Rs.)</option>
              </select>
              <input
                type="number"
                required
                value={cpValue}
                onChange={(e) => setCpValue(Number(e.target.value))}
                placeholder="Value"
                className="border border-[#e6ebf0] px-3 py-2 text-xs"
              />
              <input
                type="number"
                required
                value={cpMin}
                onChange={(e) => setCpMin(Number(e.target.value))}
                placeholder="Min Order"
                className="border border-[#e6ebf0] px-3 py-2 text-xs"
              />
            </div>
            <button type="submit" className="px-5 py-2.5 bg-[#16191f] text-white wide text-[10px] tracking-[0.14em]">
              Save Coupon
            </button>
          </form>

          <div className="space-y-3">
            {allCoupons.map((cp) => (
              <div key={cp.code} className="border border-[#e6ebf0] p-4 flex justify-between items-center text-xs">
                <div>
                  <div className="font-medium">{cp.code}</div>
                  <div className="text-[#737b86] tabular-nums">
                    {cp.discountType === 'percentage' ? `${cp.discountValue}%` : `Rs. ${cp.discountValue}`} off orders ≥ Rs.{' '}
                    {cp.minOrderAmount}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await deleteDoc(doc(db, 'coupons', cp.code));
                    } catch (err) {
                      handleFirestoreError(err, OperationType.DELETE, `coupons/${cp.code}`);
                    }
                  }}
                  className="text-[#737b86] hover:text-[#16191f]"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Shipping Zones */}
      {activeTab === 'shipping' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const id = `zone-${Date.now()}`;
              try {
                await setDoc(doc(db, 'shipping_zones', id), {
                  name: znName.trim().slice(0, 80),
                  cities: znCities
                    .split(',')
                    .map((c) => c.trim())
                    .filter(Boolean)
                    .slice(0, 40),
                  fee: Number(znFee),
                  freeThreshold: Number(znFree),
                  estimatedDays: '2-4 Business Days',
                  active: true,
                  updatedAt: serverTimestamp(),
                });
                setZnName('');
                notify('Shipping Zone Saved', znName, 'success');
              } catch (err) {
                handleFirestoreError(err, OperationType.WRITE, `shipping_zones/${id}`);
              }
            }}
            className="border border-[#e6ebf0] p-6 space-y-3"
          >
            <h2 className="wide text-xs tracking-[0.15em]">Configure Delivery Zone</h2>
            <input
              required
              value={znName}
              onChange={(e) => setZnName(e.target.value)}
              placeholder="Zone Name (e.g. Punjab Express)"
              className="w-full border border-[#e6ebf0] px-3 py-2 text-xs"
            />
            <input
              required
              value={znCities}
              onChange={(e) => setZnCities(e.target.value)}
              placeholder="Cities comma-separated"
              className="w-full border border-[#e6ebf0] px-3 py-2 text-xs"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                required
                value={znFee}
                onChange={(e) => setZnFee(Number(e.target.value))}
                placeholder="Fee (Rs.)"
                className="border border-[#e6ebf0] px-3 py-2 text-xs"
              />
              <input
                type="number"
                required
                value={znFree}
                onChange={(e) => setZnFree(Number(e.target.value))}
                placeholder="Free Threshold (Rs.)"
                className="border border-[#e6ebf0] px-3 py-2 text-xs"
              />
            </div>
            <button type="submit" className="px-5 py-2.5 bg-[#16191f] text-white wide text-[10px] tracking-[0.14em]">
              Save Zone
            </button>
          </form>

          <div className="space-y-3">
            {shippingZones.map((z: ShippingZone) => (
              <div key={z.id} className="border border-[#e6ebf0] p-4 text-xs">
                <div className="font-medium">{z.name}</div>
                <div className="text-[#737b86] mt-1 tabular-nums">
                  Fee: Rs. {z.fee} · Cities: {z.cities.join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Storefront Banners */}
      {activeTab === 'banners' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await setDoc(doc(db, 'banners', 'banner-ss27'), {
                  title: bnTitle.trim().slice(0, 140),
                  subtitle: 'AUREVÉ Announcement',
                  ctaLabel: bnCta.trim().slice(0, 50),
                  ctaLink: bnLink.trim().slice(0, 140),
                  active: true,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
                setBnTitle('');
                notify('Announcement Updated', undefined, 'success');
              } catch (err) {
                handleFirestoreError(err, OperationType.WRITE, 'banners/banner-ss27');
              }
            }}
            className="border border-[#e6ebf0] p-6 space-y-3"
          >
            <h2 className="wide text-xs tracking-[0.15em]">Update Storefront Banner</h2>
            <input
              required
              value={bnTitle}
              onChange={(e) => setBnTitle(e.target.value)}
              placeholder="Announcement text..."
              className="w-full border border-[#e6ebf0] px-3 py-2 text-xs"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                required
                value={bnCta}
                onChange={(e) => setBnCta(e.target.value)}
                placeholder="CTA Label"
                className="border border-[#e6ebf0] px-3 py-2 text-xs"
              />
              <input
                required
                value={bnLink}
                onChange={(e) => setBnLink(e.target.value)}
                placeholder="/shop"
                className="border border-[#e6ebf0] px-3 py-2 text-xs"
              />
            </div>
            <button type="submit" className="px-5 py-2.5 bg-[#16191f] text-white wide text-[10px] tracking-[0.14em]">
              Publish Banner
            </button>
          </form>

          <div className="space-y-3">
            {banners.map((b: Banner) => (
              <div key={b.id} className="border border-[#e6ebf0] p-4 text-xs">
                <div className="font-medium">{b.title}</div>
                <div className="text-[#737b86] mt-1">
                  CTA: {b.ctaLabel} → {b.ctaLink}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. Customers Directory */}
      {activeTab === 'customers' && (
        <div className="border border-[#e6ebf0] divide-y divide-[#e6ebf0] text-xs">
          {allCustomers.length === 0 ? (
            <div className="p-8 text-[#737b86]">No registered customer profiles yet.</div>
          ) : (
            allCustomers.map((c) => (
              <div key={c.uid} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{c.displayName}</div>
                  <div className="text-[#737b86]">UID: {c.uid}</div>
                </div>
                <div className="tabular-nums">{c.loyaltyPoints} Loyalty Points</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 9. Admin Role Management */}
      {activeTab === 'admins' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const uid = newAdminUid.trim();
              if (!uid) return;
              try {
                await setDoc(doc(db, 'admins', uid), {
                  uid,
                  email: newAdminEmail.trim().slice(0, 160),
                  role: newAdminRole,
                  createdAt: serverTimestamp(),
                });
                setNewAdminUid('');
                setNewAdminEmail('');
                notify('Admin Role Granted', newAdminEmail, 'success');
              } catch (err) {
                handleFirestoreError(err, OperationType.CREATE, `admins/${uid}`);
              }
            }}
            className="border border-[#e6ebf0] p-6 space-y-3"
          >
            <h2 className="wide text-xs tracking-[0.15em]">Grant Administrator Role</h2>
            <input
              required
              value={newAdminUid}
              onChange={(e) => setNewAdminUid(e.target.value)}
              placeholder="Firebase User UID"
              className="w-full border border-[#e6ebf0] px-3 py-2 text-xs"
            />
            <input
              required
              type="email"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              placeholder="Admin Email"
              className="w-full border border-[#e6ebf0] px-3 py-2 text-xs"
            />
            <select
              value={newAdminRole}
              onChange={(e) => setNewAdminRole(e.target.value as typeof newAdminRole)}
              className="w-full border border-[#e6ebf0] px-3 py-2 text-xs bg-white"
            >
              <option value="super_admin">Super Admin</option>
              <option value="manager">Catalog Manager</option>
              <option value="fulfillment">Fulfillment Specialist</option>
            </select>
            <button type="submit" className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#16191f] text-white wide text-[10px] tracking-[0.14em]">
              <Plus className="w-3.5 h-3.5" /> Assign Role
            </button>
          </form>

          <div className="space-y-3 text-xs">
            <div className="border border-[#e6ebf0] p-4 bg-[#f3f6fa]">
              <div className="font-medium">Primary Bootstrap Administrator</div>
              <div className="text-[#737b86] mt-1">razasphare@gmail.com (Verified Runtime Super Admin)</div>
            </div>
            {allAdmins.map((adm) => (
              <div key={adm.uid} className="border border-[#e6ebf0] p-4 flex justify-between items-center">
                <div>
                  <div className="font-medium">{adm.email}</div>
                  <div className="text-[#737b86]">Role: {adm.role} · UID: {adm.uid}</div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await deleteDoc(doc(db, 'admins', adm.uid));
                    } catch (err) {
                      handleFirestoreError(err, OperationType.DELETE, `admins/${adm.uid}`);
                    }
                  }}
                  className="text-[#737b86] hover:text-[#16191f]"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
