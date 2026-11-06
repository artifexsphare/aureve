import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle,
  Clock,
  Download,
  Edit3,
  Eye,
  FileText,
  Filter,
  MessageSquare,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
  Truck,
  Upload,
  X,
} from 'lucide-react';
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
  OrderStatusHistoryRecord,
  Product,
  ShippingZone,
  StockHistoryRecord,
} from '../types';

export const CANONICAL_ORDER_STATUSES: OrderStatus[] = [
  'New Order',
  'Pending Confirmation',
  'Confirmed',
  'Processing',
  'Packed',
  'Ready for Dispatch',
  'Shipped',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
  'Return Requested',
  'Returned',
  'Refunded',
];

const STATUS_BADGE_STYLES: Record<string, string> = {
  'New Order': 'bg-blue-50 text-blue-700 border-blue-200',
  'Pending Confirmation': 'bg-amber-50 text-amber-700 border-amber-200',
  'Pending': 'bg-amber-50 text-amber-700 border-amber-200',
  'Confirmed': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Processing': 'bg-purple-50 text-purple-700 border-purple-200',
  'Packed': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Ready for Dispatch': 'bg-teal-50 text-teal-700 border-teal-200',
  'Shipped': 'bg-sky-50 text-sky-700 border-sky-200',
  'Out for Delivery': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'Delivered': 'bg-green-50 text-green-700 border-green-200',
  'Cancelled': 'bg-rose-50 text-rose-700 border-rose-200',
  'Return Requested': 'bg-orange-50 text-orange-700 border-orange-200',
  'Returned': 'bg-stone-100 text-stone-700 border-stone-300',
  'Refunded': 'bg-zinc-100 text-zinc-700 border-zinc-300',
};

export const AdminDashboardPage: React.FC = () => {
  const {
    user,
    authReady,
    isAdmin,
    products,
    categories,
    banners,
    shippingZones,
    notify,
    seedCatalogToFirestore,
    updateOrderStatusAuthoritative,
    adjustProductStock,
    addAdminOrderNote,
  } = useStore();

  const [activeTab, setActiveTab] = useState<
    'analytics' | 'orders' | 'inventory' | 'products' | 'categories' | 'coupons' | 'shipping' | 'banners' | 'customers' | 'admins'
  >('analytics');

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allOrders, setAllOrders] = useState<OrderRecord[]>([]);
  const [allCoupons, setAllCoupons] = useState<Coupon[]>([]);
  const [allCustomers, setAllCustomers] = useState<{ uid: string; displayName: string; loyaltyPoints: number }[]>([]);
  const [allAdmins, setAllAdmins] = useState<AdminMemberRecord[]>([]);
  const [stockHistoryList, setStockHistoryList] = useState<StockHistoryRecord[]>([]);

  // Orders State & Filters
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);

  // Order Action Modals
  const [statusModalOrder, setStatusModalOrder] = useState<OrderRecord | null>(null);
  const [targetStatus, setTargetStatus] = useState<OrderStatus>('Confirmed');
  const [statusNote, setStatusNote] = useState('');
  const [notifyCustomerOnStatus, setNotifyCustomerOnStatus] = useState(true);
  const [submittingStatus, setSubmittingStatus] = useState(false);

  // Cancellation Modal
  const [cancelModalOrder, setCancelModalOrder] = useState<OrderRecord | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // Admin Note Input inside detail drawer
  const [internalNoteInput, setInternalNoteInput] = useState('');

  // Inventory State & Filters
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryStockFilter, setInventoryStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [stockAdjustProduct, setStockAdjustProduct] = useState<Product | null>(null);
  const [stockAdjustmentAmount, setStockAdjustmentAmount] = useState<number>(5);
  const [stockAdjustMode, setStockAdjustMode] = useState<'add' | 'reduce' | 'exact'>('add');
  const [stockAdjustReason, setStockAdjustReason] = useState('Restocked from Atelier production');
  const [stockAdjustVariant, setStockAdjustVariant] = useState('');
  const [thresholdModalProduct, setThresholdModalProduct] = useState<Product | null>(null);
  const [newThresholdInput, setNewThresholdInput] = useState<number>(5);

  // Product Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pName, setPName] = useState('');
  const [pSku, setPSku] = useState('');
  const [pCategory, setPCategory] = useState('Clothing');
  const [pSubcategory, setPSubcategory] = useState('Dresses');
  const [pPrice, setPPrice] = useState(1200);
  const [pSalePrice, setPSalePrice] = useState<string>('');
  const [pStock, setPStock] = useState(15);
  const [pLowStock, setPLowStock] = useState(5);
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
  const [znCities, setZnCities] = useState('Karachi');
  const [znFee, setZnFee] = useState(200);
  const [znFree, setZnFree] = useState(25000);

  // Admin Role Form
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'super_admin' | 'manager' | 'fulfillment'>('manager');

  const isSuperAdminEmail = user?.email?.toLowerCase() === 'razasphare@gmail.com';

  useEffect(() => {
    if (!authReady || !user || !isSuperAdminEmail) return;

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
      collection(db, 'coupons'),
      (snap) => {
        const list: Coupon[] = [];
        snap.forEach((d) => list.push(d.data() as Coupon));
        setAllCoupons(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'coupons')
    );

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
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
      collection(db, 'admins'),
      (snap) => {
        const list: AdminMemberRecord[] = [];
        snap.forEach((d) => list.push(d.data() as AdminMemberRecord));
        setAllAdmins(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'admins')
    );

    // Stock History Audit Ledger
    const unsubStockHist = onSnapshot(
      collection(db, 'stockHistory'),
      (snap) => {
        const list: StockHistoryRecord[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<StockHistoryRecord, 'id'>) }));
        list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        setStockHistoryList(list.slice(0, 100));
      },
      () => {
        // Fallback gracefully if index is building
      }
    );

    return () => {
      unsubProds();
      unsubOrders();
      unsubCoupons();
      unsubUsers();
      unsubAdmins();
      unsubStockHist();
    };
  }, [authReady, user, isSuperAdminEmail]);

  const effectiveProducts = allProducts.length > 0 ? allProducts : products;

  // Analytics Computation
  const analytics = useMemo(() => {
    const validOrders = allOrders.filter((o) => o.status !== 'Cancelled' && o.paymentStatus !== 'refunded');
    const totalRevenue = validOrders.reduce((s, o) => s + (o.grandTotal || 0), 0);

    const statusCounts: Record<string, number> = {};
    CANONICAL_ORDER_STATUSES.forEach((st) => {
      statusCounts[st] = 0;
    });
    allOrders.forEach((o) => {
      const st = o.status || 'New Order';
      statusCounts[st] = (statusCounts[st] || 0) + 1;
    });

    const lowStockProducts = effectiveProducts.filter((p) => p.stock > 0 && p.stock <= (p.lowStockThreshold || 5));
    const outOfStockProducts = effectiveProducts.filter((p) => p.stock <= 0);

    return {
      totalOrders: allOrders.length,
      totalRevenue,
      statusCounts,
      lowStockProducts,
      outOfStockProducts,
      recentOrders: allOrders.slice(0, 8),
    };
  }, [allOrders, effectiveProducts]);

  // Orders Filtering
  const filteredOrders = useMemo(() => {
    return allOrders.filter((ord) => {
      if (orderStatusFilter !== 'all') {
        if (orderStatusFilter === 'Pending') {
          if (ord.status !== 'Pending' && ord.status !== 'Pending Confirmation') return false;
        } else if (ord.status !== orderStatusFilter) {
          return false;
        }
      }

      if (orderSearch.trim()) {
        const q = orderSearch.toLowerCase().trim();
        const matchNumber = ord.orderNumber.toLowerCase().includes(q);
        const matchName = (ord.customerName || '').toLowerCase().includes(q);
        const matchPhone = (ord.customerPhone || '').toLowerCase().includes(q);
        const matchEmail = (ord.customerEmail || '').toLowerCase().includes(q);
        const matchCity = (ord.city || '').toLowerCase().includes(q);
        if (!matchNumber && !matchName && !matchPhone && !matchEmail && !matchCity) {
          return false;
        }
      }

      return true;
    });
  }, [allOrders, orderStatusFilter, orderSearch]);

  // Inventory Filtering
  const filteredInventory = useMemo(() => {
    return effectiveProducts.filter((p) => {
      const threshold = p.lowStockThreshold || 5;
      if (inventoryStockFilter === 'in_stock' && p.stock <= threshold) return false;
      if (inventoryStockFilter === 'low_stock' && (p.stock <= 0 || p.stock > threshold)) return false;
      if (inventoryStockFilter === 'out_of_stock' && p.stock > 0) return false;

      if (inventorySearch.trim()) {
        const q = inventorySearch.toLowerCase().trim();
        const matchName = p.name.toLowerCase().includes(q);
        const matchSku = p.sku.toLowerCase().includes(q);
        const matchCat = p.category.toLowerCase().includes(q);
        if (!matchName && !matchSku && !matchCat) return false;
      }
      return true;
    });
  }, [effectiveProducts, inventoryStockFilter, inventorySearch]);

  // Access Control Screen
  if (!authReady) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center space-y-4">
        <div className="text-xs text-[#737b86]">Authenticating Atelier Executive Clearance...</div>
      </div>
    );
  }

  if (!user || !isSuperAdminEmail) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center space-y-6">
        <ShieldAlert className="w-14 h-14 mx-auto text-[#e04343] stroke-[1.25]" />
        <div className="space-y-2">
          <div className="wide text-xs tracking-[0.2em] text-[#e04343] uppercase font-semibold">Access Denied</div>
          <h1 className="wide text-xl tracking-[0.14em] text-[#16191f]">AUREVÉ Atelier Executive Command</h1>
        </div>
        <p className="text-xs text-[#737b86] leading-relaxed max-w-md mx-auto">
          Administrative controls, order fulfillment, and inventory ledgers are strictly restricted to authorized executive administration (<span className="font-mono text-[#16191f] font-medium">razasphare@gmail.com</span>).
          {user ? ` Your current session (${user.email}) does not possess administrative privileges.` : ' Please authenticate with the executive administrator account to proceed.'}
        </p>
        <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
          <Link
            to="/login?redirect=/admin"
            className="px-6 py-3 bg-[#16191f] text-white wide text-[10px] tracking-[0.15em] hover:opacity-90 transition-opacity"
          >
            Sign In as Executive Admin
          </Link>
          <Link
            to="/"
            className="px-6 py-3 border border-[#16191f] text-[#16191f] wide text-[10px] tracking-[0.15em] hover:bg-[#f3f6fa] transition-colors"
          >
            Return to Boutique
          </Link>
        </div>
      </div>
    );
  }

  // --- Invoice Print / Download Generator ---
  const handlePrintInvoice = (ord: OrderRecord) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      notify('Pop-up Blocked', 'Please allow pop-ups to open the official invoice printable view.', 'error');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>AUREVÉ Invoice - ${ord.orderNumber}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #16191f; padding: 40px; margin: 0; background: #fff; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #16191f; padding-bottom: 20px; }
            .brand { font-size: 24px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; }
            .subtitle { font-size: 11px; color: #737b86; margin-top: 4px; letter-spacing: 0.1em; }
            .meta { text-align: right; font-size: 12px; }
            .meta h2 { margin: 0 0 6px 0; font-size: 16px; font-weight: 600; }
            .parties { display: flex; justify-content: space-between; margin: 30px 0; font-size: 12px; }
            .party-box { width: 48%; }
            .party-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; color: #737b86; margin-bottom: 8px; font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th { text-align: left; padding: 10px; border-bottom: 1px solid #16191f; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; }
            td { padding: 12px 10px; border-bottom: 1px solid #e6ebf0; }
            .totals { margin-top: 24px; width: 300px; margin-left: auto; font-size: 12px; }
            .totals-row { display: flex; justify-content: space-between; padding: 6px 0; }
            .totals-row.grand { border-top: 2px solid #16191f; font-size: 14px; font-weight: 700; padding-top: 10px; margin-top: 6px; }
            .footer { margin-top: 60px; text-align: center; font-size: 11px; color: #737b86; border-top: 1px solid #e6ebf0; padding-top: 20px; }
            @media print {
              .no-print { display: none; }
              body { padding: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 20px; text-align: right;">
            <button onclick="window.print()" style="padding: 10px 20px; background: #16191f; color: #fff; border: none; cursor: pointer; font-size: 12px; font-weight: 600; letter-spacing: 0.1em;">PRINT OFFICIAL INVOICE</button>
          </div>
          <div class="header">
            <div>
              <div class="brand">AUREVÉ</div>
              <div class="subtitle">HAUTE COUTURE & READY-TO-WEAR · KARACHI ATELIER</div>
            </div>
            <div class="meta">
              <h2>INVOICE #${ord.orderNumber}</h2>
              <div>Date: ${new Date().toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              <div>Status: <strong>${ord.status}</strong></div>
              <div>Payment: <strong>${ord.paymentMethod.toUpperCase()} (${ord.paymentStatus.toUpperCase()})</strong></div>
            </div>
          </div>

          <div class="parties">
            <div class="party-box">
              <div class="party-title">Billed & Delivered To</div>
              <div style="font-size: 14px; font-weight: 600; margin-bottom: 4px;">${ord.customerName}</div>
              <div>${ord.houseNumber}, ${ord.street}</div>
              <div>${ord.area}, ${ord.city}, Pakistan</div>
              <div style="margin-top: 6px;">Phone: ${ord.customerPhone}</div>
              <div>Email: ${ord.customerEmail}</div>
            </div>
            <div class="party-box" style="text-align: right;">
              <div class="party-title">Atelier Dispatch Center</div>
              <div style="font-size: 14px; font-weight: 600; margin-bottom: 4px;">AUREVÉ Maison Couture</div>
              <div>Clifton Block 4, Karachi</div>
              <div>Sindh 75600, Pakistan</div>
              <div style="margin-top: 6px;">Client Concierge: concierge@aureve.com</div>
              <div>Official Verification: razasphare@gmail.com</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Piece Description</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Currency & Price</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${ord.itemSummary}</td>
                <td style="text-align: center;">${ord.itemCount}</td>
                <td style="text-align: right;">Rs. ${ord.subtotal.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <div class="totals">
            <div class="totals-row">
              <span>Bag Subtotal:</span>
              <span>Rs. ${ord.subtotal.toLocaleString()}</span>
            </div>
            ${ord.discountTotal > 0 ? `
              <div class="totals-row" style="color: #0d8a4f;">
                <span>Privilege Discount:</span>
                <span>-Rs. ${ord.discountTotal.toLocaleString()}</span>
              </div>
            ` : ''}
            <div class="totals-row">
              <span>Karachi Express Insured Delivery:</span>
              <span>Rs. ${ord.shippingFee.toLocaleString()}</span>
            </div>
            <div class="totals-row grand">
              <span>Authoritative Total:</span>
              <span>Rs. ${ord.grandTotal.toLocaleString()}</span>
            </div>
          </div>

          <div class="footer">
            Thank you for patronizing AUREVÉ Maison. All orders are insured under executive seal. For inquiries or sizing adjustments, contact your dedicated atelier concierge.
          </div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Status Change Submit
  const handleConfirmStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModalOrder) return;
    setSubmittingStatus(true);
    try {
      await updateOrderStatusAuthoritative(
        statusModalOrder,
        targetStatus,
        statusNote.trim(),
        undefined
      );
      setStatusModalOrder(null);
      setStatusNote('');
      if (selectedOrder?.id === statusModalOrder.id) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: targetStatus } : null));
      }
    } catch (err) {
      notify('Status Update Error', err instanceof Error ? err.message : 'Failed to update order', 'error');
    } finally {
      setSubmittingStatus(false);
    }
  };

  // Cancellation Submit
  const handleConfirmCancellation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalOrder) return;
    if (!cancellationReason.trim()) {
      notify('Reason Required', 'Please provide a formal cancellation reason.', 'error');
      return;
    }
    setSubmittingCancel(true);
    try {
      await updateOrderStatusAuthoritative(
        cancelModalOrder,
        'Cancelled',
        `Cancelled by Executive Admin: ${cancellationReason.trim()}`,
        cancellationReason.trim()
      );
      setCancelModalOrder(null);
      setCancellationReason('');
      if (selectedOrder?.id === cancelModalOrder.id) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: 'Cancelled' } : null));
      }
    } catch (err) {
      notify('Cancellation Error', err instanceof Error ? err.message : 'Failed to cancel order', 'error');
    } finally {
      setSubmittingCancel(false);
    }
  };

  // Stock Adjustment Submit
  const handleExecuteStockAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockAdjustProduct) return;
    try {
      let delta = stockAdjustmentAmount;
      let changeType: StockHistoryRecord['changeType'] = 'manual_add';

      if (stockAdjustMode === 'reduce') {
        delta = -Math.abs(stockAdjustmentAmount);
        changeType = 'manual_reduce';
      } else if (stockAdjustMode === 'exact') {
        delta = stockAdjustmentAmount - stockAdjustProduct.stock;
        changeType = 'inventory_reset';
      }

      await adjustProductStock(
        stockAdjustProduct.id,
        delta,
        changeType,
        stockAdjustReason.trim(),
        stockAdjustVariant || undefined
      );

      setStockAdjustProduct(null);
      setStockAdjustmentAmount(5);
      setStockAdjustVariant('');
      setStockAdjustReason('Restocked from Atelier production');
    } catch (err) {
      notify('Stock Adjustment Error', err instanceof Error ? err.message : 'Failed to adjust stock', 'error');
    }
  };

  // Threshold Adjustment Submit
  const handleExecuteThresholdAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thresholdModalProduct) return;
    try {
      await updateDoc(doc(db, 'products', thresholdModalProduct.id), {
        lowStockThreshold: Math.max(0, newThresholdInput),
        updatedAt: serverTimestamp(),
      });
      notify('Threshold Updated', `${thresholdModalProduct.name} low-stock threshold set to ${newThresholdInput}`, 'success');
      setThresholdModalProduct(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${thresholdModalProduct.id}`);
    }
  };

  // Mark Product Out of Stock
  const handleMarkOutOfStock = async (product: Product) => {
    if (!window.confirm(`Mark ${product.name} as OUT OF STOCK? This will set stock to 0 and disable checkout.`)) return;
    try {
      await adjustProductStock(
        product.id,
        -product.stock,
        'out_of_stock',
        'Marked Out of Stock by Executive Admin',
        undefined
      );
    } catch (err) {
      notify('Error', err instanceof Error ? err.message : 'Failed to mark out of stock', 'error');
    }
  };

  // Save Internal Admin Note on Order
  const handleSaveInternalNote = async (orderId: string) => {
    if (!internalNoteInput.trim()) return;
    try {
      await addAdminOrderNote(orderId, internalNoteInput.trim());
      if (selectedOrder) {
        setSelectedOrder((prev) => (prev ? { ...prev, adminNotes: internalNoteInput.trim() } : null));
      }
      setInternalNoteInput('');
    } catch (err) {
      notify('Error', 'Failed to save admin note', 'error');
    }
  };

  // Product Catalog Save
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = editingId || `mv_${Date.now()}`;
    const existingProd = allProducts.find((x) => x.id === id);

    const payload: Partial<Product> = {
      name: pName.trim(),
      slug: pName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 140),
      sku: pSku.trim(),
      category: pCategory,
      subcategory: pSubcategory.trim(),
      price: Number(pPrice),
      stock: Number(pStock),
      lowStockThreshold: Number(pLowStock) || 5,
      published: pPublished,
      featured: false,
      bestSeller: pBestSeller,
      flashSale: pFlashSale,
      description: pDesc.trim(),
      material: pMaterial.trim(),
      care: pCare.trim(),
      origin: pOrigin.trim(),
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
    if (existingProd?.spriteBox) payload.spriteBox = existingProd.spriteBox;
    if (existingProd?.lookNumber) payload.lookNumber = existingProd.lookNumber;

    try {
      const docRef = doc(db, 'products', id);
      if (editingId && allProducts.some((x) => x.id === editingId)) {
        const current = allProducts.find((x) => x.id === editingId)!;
        await setDoc(docRef, { ...payload, createdAt: current.createdAt || serverTimestamp() });
      } else {
        await setDoc(docRef, { ...payload, createdAt: serverTimestamp() });
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
      'Subtotal_PKR',
      'Discount_PKR',
      'Shipping_PKR',
      'GrandTotal_PKR',
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
      {/* Top Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#e6ebf0] pb-6">
        <div>
          <div className="text-xs text-[#737b86]">Executive Atelier Authority · {user.email}</div>
          <h1 className="wide text-2xl tracking-[0.14em] mt-1 text-[#16191f]">AUREVÉ Atelier Command</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          {allProducts.length === 0 && (
            <button
              type="button"
              onClick={seedCatalogToFirestore}
              className="px-4 py-2.5 border border-[#16191f] text-xs wide tracking-[0.13em] active:bg-[#f3f6fa] touch-manipulation"
            >
              Sync Initial SS27 Catalog
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

      {/* Admin Module Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none sm:flex-wrap w-full shrink-0">
        {(
          [
            ['analytics', 'Dashboard Overview'],
            ['orders', `Orders (${allOrders.length})`],
            ['inventory', `Inventory & Stock (${effectiveProducts.length})`],
            ['products', 'Catalog Editor'],
            ['categories', 'Categories'],
            ['coupons', 'Coupons'],
            ['shipping', 'Delivery Zones'],
            ['banners', 'Banners'],
            ['customers', `Customers (${allCustomers.length})`],
            ['admins', 'Admin RBAC'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`h-9 px-4 flex items-center justify-center text-xs whitespace-nowrap shrink-0 transition-colors touch-manipulation active:scale-95 ${
              activeTab === key
                ? 'bg-[#16191f] text-white font-medium'
                : 'bg-[#f3f6fa] text-[#737b86] hover:text-[#16191f]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* =========================================================================
          TAB 1: DASHBOARD OVERVIEW & STATUS METRICS
          ========================================================================= */}
      {activeTab === 'analytics' && (
        <div className="space-y-8">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="border border-[#e6ebf0] p-6 bg-white">
              <div className="text-xs text-[#737b86]">Total Atelier Sales</div>
              <div className="text-2xl font-medium tabular-nums mt-2 text-[#16191f]">
                Rs. {analytics.totalRevenue.toLocaleString()}
              </div>
              <div className="text-[11px] text-[#737b86] mt-1">Confirmed & settled client orders</div>
            </div>

            <div className="border border-[#e6ebf0] p-6 bg-white">
              <div className="text-xs text-[#737b86]">Total Orders Logged</div>
              <div className="text-2xl font-medium tabular-nums mt-2 text-[#16191f]">
                {analytics.totalOrders}
              </div>
              <div className="text-[11px] text-[#737b86] mt-1">Across all 13 fulfillment stages</div>
            </div>

            <div
              onClick={() => {
                setActiveTab('inventory');
                setInventoryStockFilter('low_stock');
              }}
              className="border border-[#e6ebf0] p-6 bg-white cursor-pointer hover:border-[#16191f] transition-colors"
            >
              <div className="text-xs text-amber-700 flex items-center justify-between">
                <span>Low-Stock Warnings</span>
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              <div className="text-2xl font-medium tabular-nums mt-2 text-amber-900">
                {analytics.lowStockProducts.length}
              </div>
              <div className="text-[11px] text-amber-700 mt-1">Stock ≤ threshold (Click to inspect)</div>
            </div>

            <div
              onClick={() => {
                setActiveTab('inventory');
                setInventoryStockFilter('out_of_stock');
              }}
              className="border border-[#e6ebf0] p-6 bg-white cursor-pointer hover:border-[#16191f] transition-colors"
            >
              <div className="text-xs text-rose-700 flex items-center justify-between">
                <span>Out of Stock</span>
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              <div className="text-2xl font-medium tabular-nums mt-2 text-rose-900">
                {analytics.outOfStockProducts.length}
              </div>
              <div className="text-[11px] text-rose-700 mt-1">Sold out SKUs (Disabled in checkout)</div>
            </div>
          </div>

          {/* 13-Stage Order Status Breakdown */}
          <div className="border border-[#e6ebf0] p-6 bg-white space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e6ebf0] pb-4">
              <div>
                <h2 className="wide text-xs tracking-[0.16em] uppercase">13-Stage Order Lifecycle Breakdown</h2>
                <p className="text-[11px] text-[#737b86] mt-0.5">Real-time status tracking across complete luxury fulfillment workflow</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                className="text-xs underline text-[#16191f] self-start sm:self-auto"
              >
                View Complete Orders Table →
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 pt-2">
              {CANONICAL_ORDER_STATUSES.map((status) => {
                const count = analytics.statusCounts[status] || 0;
                const badgeStyle = STATUS_BADGE_STYLES[status] || 'bg-gray-50 text-gray-700 border-gray-200';
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      setOrderStatusFilter(status);
                      setActiveTab('orders');
                    }}
                    className={`p-3 border text-left transition-transform active:scale-95 ${badgeStyle}`}
                  >
                    <div className="text-[11px] font-medium truncate">{status}</div>
                    <div className="text-lg font-bold tabular-nums mt-1">{count}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent Orders & Stock Watch Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Recent Orders */}
            <div className="lg:col-span-7 border border-[#e6ebf0] p-6 bg-white space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="wide text-xs tracking-[0.16em] uppercase">Recent Client Orders</h3>
                <span className="text-[11px] text-[#737b86]">Latest submissions</span>
              </div>

              {analytics.recentOrders.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#737b86]">No orders placed yet.</div>
              ) : (
                <div className="divide-y divide-[#e6ebf0] text-xs">
                  {analytics.recentOrders.map((ord) => (
                    <div key={ord.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-[#16191f]">{ord.orderNumber}</div>
                        <div className="text-[#737b86] text-[11px]">
                          {ord.customerName} · {ord.city} · {ord.paymentMethod.toUpperCase()}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 text-[10px] font-medium border ${STATUS_BADGE_STYLES[ord.status] || ''}`}>
                          {ord.status}
                        </span>
                        <span className="tabular-nums font-semibold text-[#16191f]">
                          Rs. {ord.grandTotal.toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOrder(ord);
                            setActiveTab('orders');
                          }}
                          className="p-1 hover:text-[#16191f] text-[#737b86]"
                          title="Inspect Order"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Low Stock Watch */}
            <div className="lg:col-span-5 border border-[#e6ebf0] p-6 bg-white space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <h3 className="wide text-xs tracking-[0.16em] uppercase">Critical Stock Attention</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('inventory')}
                  className="text-[11px] underline text-[#16191f]"
                >
                  Manage All Inventory
                </button>
              </div>

              {analytics.lowStockProducts.length === 0 && analytics.outOfStockProducts.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#737b86]">All products have healthy inventory levels.</div>
              ) : (
                <div className="divide-y divide-[#e6ebf0] text-xs">
                  {analytics.outOfStockProducts.map((p) => (
                    <div key={p.id} className="py-2.5 flex items-center justify-between gap-3 text-rose-900 bg-rose-50/50 px-2">
                      <div>
                        <span className="font-semibold">{p.name}</span> ({p.sku})
                        <div className="text-[10px] text-rose-700">Out of Stock · Checkout disabled</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setStockAdjustProduct(p);
                          setStockAdjustMode('add');
                          setStockAdjustmentAmount(10);
                        }}
                        className="px-2 py-1 bg-rose-900 text-white text-[10px] font-medium"
                      >
                        + Restock
                      </button>
                    </div>
                  ))}
                  {analytics.lowStockProducts.map((p) => (
                    <div key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <span className="font-medium text-[#16191f]">{p.name}</span> ({p.sku})
                        <div className="text-[10px] text-amber-700">Only {p.stock} units left (Threshold: {p.lowStockThreshold || 5})</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setStockAdjustProduct(p);
                          setStockAdjustMode('add');
                          setStockAdjustmentAmount(5);
                        }}
                        className="px-2 py-1 border border-[#16191f] text-[10px]"
                      >
                        + Add Stock
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: ORDER MANAGEMENT SYSTEM (Section C)
          ========================================================================= */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          {/* Search & Filter Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-[#e6ebf0] p-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#737b86] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Search by Order #, Customer Name, Phone, or City..."
                className="w-full pl-9 pr-4 py-2 border border-[#e6ebf0] text-xs outline-none focus:border-[#16191f]"
              />
              {orderSearch && (
                <button
                  type="button"
                  onClick={() => setOrderSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#737b86]"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 overflow-x-auto pb-1 max-w-full">
              <span className="text-xs text-[#737b86] whitespace-nowrap">Filter Status:</span>
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="border border-[#16191f] px-3 py-1.5 text-xs bg-white outline-none"
              >
                <option value="all">All Orders ({allOrders.length})</option>
                {CANONICAL_ORDER_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st} ({allOrders.filter((o) => o.status === st).length})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Orders Table */}
          {filteredOrders.length === 0 ? (
            <div className="p-16 bg-[#f3f6fa] border border-[#e6ebf0] text-xs text-[#737b86] text-center space-y-2">
              <div className="font-medium text-[#16191f]">No orders matching your query</div>
              <p>Try clearing filters or search parameters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-[#e6ebf0] bg-white w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full text-left text-xs border-collapse min-w-[850px]">
                <thead className="bg-[#f3f6fa] border-b border-[#e6ebf0]">
                  <tr>
                    <th className="p-4">Order #</th>
                    <th className="p-4">Customer & City</th>
                    <th className="p-4">Items Summary</th>
                    <th className="p-4 text-right">Total (PKR)</th>
                    <th className="p-4">Payment</th>
                    <th className="p-4">Order Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6ebf0]">
                  {filteredOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-[#fafbfc] transition-colors">
                      <td className="p-4 font-mono font-medium whitespace-nowrap">{ord.orderNumber}</td>
                      <td className="p-4">
                        <div className="font-semibold text-[#16191f]">{ord.customerName}</div>
                        <div className="text-[#737b86] text-[11px]">{ord.customerPhone}</div>
                        <div className="text-[#737b86] text-[11px]">{ord.city}</div>
                      </td>
                      <td className="p-4 max-w-xs truncate" title={ord.itemSummary}>
                        {ord.itemSummary}
                      </td>
                      <td className="p-4 text-right tabular-nums font-semibold whitespace-nowrap">
                        Rs. {ord.grandTotal.toLocaleString()}
                        <div className="text-[10px] text-[#737b86] font-normal">Incl. Rs. {ord.shippingFee} Delivery</div>
                      </td>
                      <td className="p-4">
                        <div className="uppercase font-medium text-[11px]">{ord.paymentMethod}</div>
                        <span className={`inline-block px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                          ord.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {ord.paymentStatus}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-block px-2 py-1 text-[10px] font-medium border ${STATUS_BADGE_STYLES[ord.status] || ''}`}>
                          {ord.status}
                        </span>
                      </td>
                      <td className="p-4 text-right whitespace-nowrap space-x-2">
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(ord)}
                          className="px-2.5 py-1.5 bg-[#f3f6fa] hover:bg-[#e6ebf0] text-[#16191f] text-xs font-medium"
                          title="View complete order details"
                        >
                          Details
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setStatusModalOrder(ord);
                            setTargetStatus(ord.status);
                            setStatusNote('');
                          }}
                          className="px-2.5 py-1.5 bg-[#16191f] text-white text-xs font-medium hover:opacity-90"
                          title="Change status"
                        >
                          Update
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePrintInvoice(ord)}
                          className="p-1.5 border border-[#e6ebf0] hover:border-[#16191f] inline-flex items-center justify-center text-[#16191f]"
                          title="Print / Download Invoice"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* =========================================================================
              ORDER DETAILS MODAL / DRAWER
              ========================================================================= */}
          {selectedOrder && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <div className="bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#16191f] shadow-2xl p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-[#e6ebf0] pb-4">
                  <div>
                    <div className="text-xs text-[#737b86]">Atelier Order Dossier</div>
                    <h2 className="wide text-lg tracking-[0.14em] font-semibold text-[#16191f]">
                      Order #{selectedOrder.orderNumber}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(null)}
                    className="p-2 text-[#737b86] hover:text-[#16191f]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Recipient Details & Shipping */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-[#f3f6fa] p-4">
                  <div>
                    <div className="wide text-[10px] tracking-[0.15em] text-[#737b86] uppercase mb-1">Customer Details</div>
                    <div className="font-semibold text-sm">{selectedOrder.customerName}</div>
                    <div className="mt-1 text-[#737b86]">Phone: {selectedOrder.customerPhone}</div>
                    <div className="text-[#737b86]">Email: {selectedOrder.customerEmail}</div>
                  </div>
                  <div>
                    <div className="wide text-[10px] tracking-[0.15em] text-[#737b86] uppercase mb-1">Insured Delivery Address</div>
                    <div>{selectedOrder.houseNumber}, {selectedOrder.street}</div>
                    <div>{selectedOrder.area}, {selectedOrder.city}</div>
                    {selectedOrder.instructions && (
                      <div className="mt-1 text-[#737b86] italic">Note: "{selectedOrder.instructions}"</div>
                    )}
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="border border-[#e6ebf0] p-4 text-xs space-y-2">
                  <div className="wide text-[10px] tracking-[0.15em] text-[#737b86] uppercase mb-2">Itemized Financial Breakdown</div>
                  <div className="text-[#16191f] pb-2 border-b border-[#e6ebf0]">{selectedOrder.itemSummary}</div>
                  <div className="flex justify-between pt-1">
                    <span className="text-[#737b86]">Subtotal:</span>
                    <span className="tabular-nums font-medium">Rs. {selectedOrder.subtotal.toLocaleString()}</span>
                  </div>
                  {selectedOrder.discountTotal > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Privilege Discount ({selectedOrder.couponCode || 'PROMO'}):</span>
                      <span className="tabular-nums">-Rs. {selectedOrder.discountTotal.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-[#737b86]">Karachi Courier Delivery Fee:</span>
                    <span className="tabular-nums font-medium">Rs. {selectedOrder.shippingFee.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#16191f] text-sm font-bold">
                    <span>Authoritative Grand Total:</span>
                    <span className="tabular-nums">Rs. {selectedOrder.grandTotal.toLocaleString()}</span>
                  </div>
                </div>

                {/* Status & Payment Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#fafbfc] border border-[#e6ebf0] text-xs">
                  <div>
                    <span className="text-[#737b86]">Current Status:</span>{' '}
                    <span className={`inline-block px-2 py-0.5 font-medium border ${STATUS_BADGE_STYLES[selectedOrder.status] || ''}`}>
                      {selectedOrder.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#737b86]">Payment:</span>{' '}
                    <span className="font-semibold uppercase">{selectedOrder.paymentMethod}</span> ({selectedOrder.paymentStatus})
                  </div>
                </div>

                {/* Status Audit Trail History */}
                <div className="space-y-2 text-xs">
                  <div className="wide text-[10px] tracking-[0.15em] text-[#737b86] uppercase">Status Lifecycle Audit History</div>
                  {(!selectedOrder.statusHistory || selectedOrder.statusHistory.length === 0) ? (
                    <div className="p-3 bg-[#f3f6fa] text-[#737b86]">Initial submission state logged. No further transitions yet.</div>
                  ) : (
                    <div className="space-y-2 max-h-44 overflow-y-auto">
                      {selectedOrder.statusHistory.map((h, i) => (
                        <div key={i} className="p-2.5 border border-[#e6ebf0] bg-white flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold">
                              {h.previousStatus} → <span className="text-[#16191f]">{h.newStatus}</span>
                            </div>
                            {h.note && <div className="text-[#737b86] text-[11px] mt-0.5">{h.note}</div>}
                          </div>
                          <div className="text-right text-[10px] text-[#737b86] whitespace-nowrap">
                            <div>{h.changedBy}</div>
                            <div>{new Date(h.timestamp).toLocaleString()}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Admin Internal Notes */}
                <div className="space-y-2 text-xs border-t border-[#e6ebf0] pt-4">
                  <div className="wide text-[10px] tracking-[0.15em] text-[#737b86] uppercase">Executive Internal Notes</div>
                  {selectedOrder.adminNotes && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-sm">
                      {selectedOrder.adminNotes}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={internalNoteInput}
                      onChange={(e) => setInternalNoteInput(e.target.value)}
                      placeholder="Add an internal administrator note (e.g. Courier tracking #, client requested delayed delivery)..."
                      className="flex-1 border border-[#e6ebf0] px-3 py-2 text-xs outline-none focus:border-[#16191f]"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveInternalNote(selectedOrder.id)}
                      className="px-4 py-2 bg-[#16191f] text-white text-xs whitespace-nowrap"
                    >
                      Save Note
                    </button>
                  </div>
                </div>

                {/* Footer Modal Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e6ebf0] pt-4">
                  <button
                    type="button"
                    onClick={() => handlePrintInvoice(selectedOrder)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-[#16191f] text-xs wide tracking-[0.12em]"
                  >
                    <Download className="w-3.5 h-3.5" /> Print / Download Invoice
                  </button>

                  <div className="flex gap-2">
                    {selectedOrder.status !== 'Cancelled' && (
                      <button
                        type="button"
                        onClick={() => {
                          setCancelModalOrder(selectedOrder);
                          setCancellationReason('');
                        }}
                        className="px-4 py-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium hover:bg-rose-100"
                      >
                        Cancel Order
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setStatusModalOrder(selectedOrder);
                        setTargetStatus(selectedOrder.status);
                        setStatusNote('');
                      }}
                      className="px-5 py-2.5 bg-[#16191f] text-white text-xs wide tracking-[0.14em]"
                    >
                      Change Status
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              STATUS UPDATE CONFIRMATION MODAL
              ========================================================================= */}
          {statusModalOrder && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <form
                onSubmit={handleConfirmStatusChange}
                className="bg-white max-w-md w-full border border-[#16191f] shadow-2xl p-6 space-y-5"
              >
                <div className="flex items-center justify-between border-b border-[#e6ebf0] pb-3">
                  <h3 className="wide text-xs tracking-[0.16em] uppercase font-semibold">
                    Update Order Status
                  </h3>
                  <button type="button" onClick={() => setStatusModalOrder(null)}>
                    <X className="w-4 h-4 text-[#737b86]" />
                  </button>
                </div>

                <div className="text-xs space-y-1">
                  <div>Order Reference: <strong className="font-mono">{statusModalOrder.orderNumber}</strong></div>
                  <div>Customer: <strong>{statusModalOrder.customerName}</strong> ({statusModalOrder.customerPhone})</div>
                  <div>Current Status: <span className="font-medium text-[#16191f]">{statusModalOrder.status}</span></div>
                </div>

                <div className="space-y-1 text-xs">
                  <label className="block font-medium">New Status *</label>
                  <select
                    value={targetStatus}
                    onChange={(e) => setTargetStatus(e.target.value as OrderStatus)}
                    className="w-full border border-[#16191f] px-3 py-2 text-xs bg-white outline-none"
                  >
                    {CANONICAL_ORDER_STATUSES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1 text-xs">
                  <label className="block font-medium">Status Change Note / Audit Memo</label>
                  <textarea
                    rows={2}
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="e.g. Dispatched via TCS courier / Tracking #TC-88912"
                    className="w-full border border-[#e6ebf0] p-2 text-xs outline-none focus:border-[#16191f]"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-[#16191f] cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={notifyCustomerOnStatus}
                    onChange={(e) => setNotifyCustomerOnStatus(e.target.checked)}
                    className="accent-[#16191f]"
                  />
                  <span>Dispatch customer notification via WhatsApp</span>
                </label>

                <div className="flex justify-end gap-3 pt-3 border-t border-[#e6ebf0]">
                  <button
                    type="button"
                    onClick={() => setStatusModalOrder(null)}
                    className="px-4 py-2 border border-[#e6ebf0] text-xs text-[#737b86]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingStatus}
                    className="px-5 py-2 bg-[#16191f] text-white text-xs wide tracking-[0.14em]"
                  >
                    {submittingStatus ? 'Updating...' : 'Confirm Status Update'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* =========================================================================
              ORDER CANCELLATION MODAL
              ========================================================================= */}
          {cancelModalOrder && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <form
                onSubmit={handleConfirmCancellation}
                className="bg-white max-w-md w-full border border-rose-900 shadow-2xl p-6 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-[#e6ebf0] pb-3">
                  <h3 className="wide text-xs tracking-[0.16em] uppercase font-semibold text-rose-800">
                    Cancel Order #{cancelModalOrder.orderNumber}
                  </h3>
                  <button type="button" onClick={() => setCancelModalOrder(null)}>
                    <X className="w-4 h-4 text-[#737b86]" />
                  </button>
                </div>

                <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-900 leading-relaxed">
                  <strong>Automatic Stock Restoration:</strong> Cancelling this order will automatically restore reserved stock units back to your atelier catalog inventory.
                </div>

                <div className="space-y-1 text-xs">
                  <label className="block font-medium">Cancellation Reason *</label>
                  <textarea
                    required
                    rows={3}
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                    placeholder="Specify the reason for cancellation (e.g. Customer requested cancellation / Duplicate submission / Payment dispute)..."
                    className="w-full border border-rose-300 p-2 text-xs outline-none focus:border-rose-700"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-[#e6ebf0]">
                  <button
                    type="button"
                    onClick={() => setCancelModalOrder(null)}
                    className="px-4 py-2 border border-[#e6ebf0] text-xs text-[#737b86]"
                  >
                    Keep Order
                  </button>
                  <button
                    type="submit"
                    disabled={submittingCancel}
                    className="px-5 py-2 bg-rose-800 text-white text-xs font-semibold"
                  >
                    {submittingCancel ? 'Cancelling...' : 'Confirm Cancellation & Restore Stock'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: INVENTORY & STOCK MANAGEMENT SYSTEM (Section D)
          ========================================================================= */}
      {activeTab === 'inventory' && (
        <div className="space-y-8">
          {/* Inventory Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="border border-[#e6ebf0] p-5 bg-white">
              <div className="text-xs text-[#737b86]">Total Catalog SKUs</div>
              <div className="text-2xl font-semibold tabular-nums mt-1">{effectiveProducts.length}</div>
            </div>
            <div className="border border-[#e6ebf0] p-5 bg-white">
              <div className="text-xs text-[#737b86]">Total Units in Stock</div>
              <div className="text-2xl font-semibold tabular-nums mt-1">
                {effectiveProducts.reduce((s, p) => s + (p.stock || 0), 0)}
              </div>
            </div>
            <div className="border border-amber-200 bg-amber-50/40 p-5">
              <div className="text-xs text-amber-800 font-medium">Low-Stock Warnings</div>
              <div className="text-2xl font-semibold tabular-nums mt-1 text-amber-900">
                {analytics.lowStockProducts.length}
              </div>
            </div>
            <div className="border border-rose-200 bg-rose-50/40 p-5">
              <div className="text-xs text-rose-800 font-medium">Out-of-Stock SKUs</div>
              <div className="text-2xl font-semibold tabular-nums mt-1 text-rose-900">
                {analytics.outOfStockProducts.length}
              </div>
            </div>
          </div>

          {/* Search & Stock Filter Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-[#e6ebf0] p-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#737b86] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                placeholder="Search inventory by product name, SKU, or category..."
                className="w-full pl-9 pr-4 py-2 border border-[#e6ebf0] text-xs outline-none focus:border-[#16191f]"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#737b86]">Stock Status:</span>
              {(
                [
                  ['all', 'All'],
                  ['in_stock', 'In Stock'],
                  ['low_stock', `Low Stock (${analytics.lowStockProducts.length})`],
                  ['out_of_stock', `Out of Stock (${analytics.outOfStockProducts.length})`],
                ] as const
              ).map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setInventoryStockFilter(k)}
                  className={`px-3 py-1.5 text-xs transition-colors ${
                    inventoryStockFilter === k
                      ? 'bg-[#16191f] text-white'
                      : 'bg-[#f3f6fa] text-[#737b86] hover:text-[#16191f]'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Products Stock Table */}
          <div className="border border-[#e6ebf0] bg-white overflow-x-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full text-left text-xs border-collapse min-w-[800px]">
              <thead className="bg-[#f3f6fa] border-b border-[#e6ebf0]">
                <tr>
                  <th className="p-4">Product Name & SKU</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Price (PKR)</th>
                  <th className="p-4 text-center">Available Stock</th>
                  <th className="p-4 text-center">Low-Stock Alert</th>
                  <th className="p-4">Inventory Status</th>
                  <th className="p-4 text-right">Stock Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6ebf0]">
                {filteredInventory.map((p) => {
                  const threshold = p.lowStockThreshold || 5;
                  const isOut = p.stock <= 0;
                  const isLow = !isOut && p.stock <= threshold;

                  return (
                    <tr key={p.id} className="hover:bg-[#fafbfc] transition-colors">
                      <td className="p-4">
                        <div className="font-semibold text-[#16191f]">{p.name}</div>
                        <div className="text-[11px] text-[#737b86] font-mono">{p.sku}</div>
                      </td>
                      <td className="p-4 text-[#737b86]">{p.category}</td>
                      <td className="p-4 tabular-nums font-medium">Rs. {p.price.toLocaleString()}</td>
                      <td className="p-4 text-center tabular-nums font-bold text-sm">
                        <span className={isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-[#16191f]'}>
                          {p.stock}
                        </span>
                      </td>
                      <td className="p-4 text-center tabular-nums">
                        <button
                          type="button"
                          onClick={() => {
                            setThresholdModalProduct(p);
                            setNewThresholdInput(threshold);
                          }}
                          className="hover:underline text-[#737b86] flex items-center justify-center gap-1 mx-auto"
                          title="Click to edit threshold"
                        >
                          <span>≤ {threshold}</span>
                          <Edit3 className="w-3 h-3 text-[#16191f]" />
                        </button>
                      </td>
                      <td className="p-4">
                        {isOut ? (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-semibold uppercase bg-rose-100 text-rose-800 border border-rose-300">
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-semibold uppercase bg-amber-100 text-amber-800 border border-amber-300">
                            Low Stock Warning
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-medium uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                            In Stock ({p.stock})
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setStockAdjustProduct(p);
                            setStockAdjustMode('add');
                            setStockAdjustmentAmount(5);
                          }}
                          className="px-3 py-1.5 bg-[#16191f] text-white text-xs font-medium hover:opacity-90"
                        >
                          Adjust Stock
                        </button>
                        {!isOut && (
                          <button
                            type="button"
                            onClick={() => handleMarkOutOfStock(p)}
                            className="px-2.5 py-1.5 border border-rose-300 text-rose-800 text-xs hover:bg-rose-50"
                          >
                            Mark Out
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Stock History Audit Ledger */}
          <div className="border border-[#e6ebf0] bg-white p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#e6ebf0] pb-3">
              <div>
                <h3 className="wide text-xs tracking-[0.16em] uppercase font-semibold">
                  Inventory Stock Audit History Ledger
                </h3>
                <p className="text-[11px] text-[#737b86] mt-0.5">
                  Complete immutable ledger tracking all stock adjustments, order reservations, and cancellations
                </p>
              </div>
              <span className="text-xs text-[#737b86]">Showing recent adjustments</span>
            </div>

            {stockHistoryList.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#737b86]">No stock changes logged yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#f3f6fa] border-b border-[#e6ebf0]">
                    <tr>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Product & SKU</th>
                      <th className="p-3">Change Type</th>
                      <th className="p-3 text-center">Adjustment</th>
                      <th className="p-3 text-center">Stock Transition</th>
                      <th className="p-3">Reason / Memo</th>
                      <th className="p-3">Operator</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e6ebf0]">
                    {stockHistoryList.map((h) => (
                      <tr key={h.id} className="hover:bg-[#fafbfc]">
                        <td className="p-3 text-[11px] text-[#737b86] whitespace-nowrap">
                          {new Date(h.timestamp).toLocaleString()}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold">{h.productName}</div>
                          <div className="text-[10px] text-[#737b86] font-mono">{h.sku}</div>
                        </td>
                        <td className="p-3 uppercase text-[10px] font-medium text-[#737b86]">
                          {h.changeType.replace(/_/g, ' ')}
                        </td>
                        <td className="p-3 text-center font-bold tabular-nums">
                          {h.changeAmount > 0 ? (
                            <span className="text-emerald-700">+{h.changeAmount}</span>
                          ) : (
                            <span className="text-rose-700">{h.changeAmount}</span>
                          )}
                        </td>
                        <td className="p-3 text-center font-mono tabular-nums text-[11px]">
                          {h.previousStock} → <strong>{h.newStock}</strong>
                        </td>
                        <td className="p-3 text-[11px] text-[#737b86] max-w-xs">{h.reason}</td>
                        <td className="p-3 text-[11px] text-[#737b86] font-mono">{h.changedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* =========================================================================
              STOCK ADJUST MODAL
              ========================================================================= */}
          {stockAdjustProduct && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <form
                onSubmit={handleExecuteStockAdjust}
                className="bg-white max-w-md w-full border border-[#16191f] shadow-2xl p-6 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-[#e6ebf0] pb-3">
                  <h3 className="wide text-xs tracking-[0.16em] uppercase font-semibold">
                    Adjust Stock: {stockAdjustProduct.name}
                  </h3>
                  <button type="button" onClick={() => setStockAdjustProduct(null)}>
                    <X className="w-4 h-4 text-[#737b86]" />
                  </button>
                </div>

                <div className="text-xs space-y-1">
                  <div>SKU: <strong className="font-mono">{stockAdjustProduct.sku}</strong></div>
                  <div>Current Stock: <strong className="text-base text-[#16191f]">{stockAdjustProduct.stock}</strong> units</div>
                </div>

                {/* Adjust Mode Selector */}
                <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setStockAdjustMode('add')}
                    className={`py-2 text-center border font-medium ${
                      stockAdjustMode === 'add' ? 'bg-[#16191f] text-white border-[#16191f]' : 'border-[#e6ebf0] hover:bg-[#f3f6fa]'
                    }`}
                  >
                    + Add Units
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockAdjustMode('reduce')}
                    className={`py-2 text-center border font-medium ${
                      stockAdjustMode === 'reduce' ? 'bg-[#16191f] text-white border-[#16191f]' : 'border-[#e6ebf0] hover:bg-[#f3f6fa]'
                    }`}
                  >
                    - Reduce Units
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStockAdjustMode('exact');
                      setStockAdjustmentAmount(stockAdjustProduct.stock);
                    }}
                    className={`py-2 text-center border font-medium ${
                      stockAdjustMode === 'exact' ? 'bg-[#16191f] text-white border-[#16191f]' : 'border-[#e6ebf0] hover:bg-[#f3f6fa]'
                    }`}
                  >
                    Set Exact
                  </button>
                </div>

                <div className="space-y-1 text-xs">
                  <label className="block font-medium">
                    {stockAdjustMode === 'exact' ? 'New Total Stock Count' : 'Quantity to Adjust'} *
                  </label>
                  <input
                    type="number"
                    min={stockAdjustMode === 'exact' ? 0 : 1}
                    max={10000}
                    value={stockAdjustmentAmount}
                    onChange={(e) => setStockAdjustmentAmount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full border border-[#16191f] px-3 py-2 text-sm font-semibold outline-none"
                  />
                </div>

                {/* Quick Presets */}
                {stockAdjustMode !== 'exact' && (
                  <div className="flex gap-2 text-xs">
                    {[1, 5, 10, 25, 50].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setStockAdjustmentAmount(num)}
                        className="flex-1 py-1 bg-[#f3f6fa] border border-[#e6ebf0] hover:border-[#16191f]"
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                )}

                <div className="space-y-1 text-xs">
                  <label className="block font-medium">Reason for Inventory Adjustment *</label>
                  <input
                    type="text"
                    required
                    value={stockAdjustReason}
                    onChange={(e) => setStockAdjustReason(e.target.value)}
                    placeholder="e.g. Received new shipment from atelier, factory count adjustment"
                    className="w-full border border-[#e6ebf0] px-3 py-2 text-xs outline-none focus:border-[#16191f]"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-[#e6ebf0]">
                  <button
                    type="button"
                    onClick={() => setStockAdjustProduct(null)}
                    className="px-4 py-2 border border-[#e6ebf0] text-xs text-[#737b86]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#16191f] text-white text-xs wide tracking-[0.14em]"
                  >
                    Confirm Stock Update
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* =========================================================================
              THRESHOLD ADJUST MODAL
              ========================================================================= */}
          {thresholdModalProduct && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <form
                onSubmit={handleExecuteThresholdAdjust}
                className="bg-white max-w-sm w-full border border-[#16191f] shadow-2xl p-6 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-[#e6ebf0] pb-3">
                  <h3 className="wide text-xs tracking-[0.16em] uppercase font-semibold">
                    Set Low-Stock Alert
                  </h3>
                  <button type="button" onClick={() => setThresholdModalProduct(null)}>
                    <X className="w-4 h-4 text-[#737b86]" />
                  </button>
                </div>

                <div className="text-xs space-y-1">
                  <div>Piece: <strong>{thresholdModalProduct.name}</strong></div>
                  <div>Current Warning Threshold: ≤ {thresholdModalProduct.lowStockThreshold || 5} units</div>
                </div>

                <div className="space-y-1 text-xs">
                  <label className="block font-medium">New Threshold Limit</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={newThresholdInput}
                    onChange={(e) => setNewThresholdInput(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full border border-[#16191f] px-3 py-2 text-sm font-semibold outline-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-[#e6ebf0]">
                  <button
                    type="button"
                    onClick={() => setThresholdModalProduct(null)}
                    className="px-4 py-2 border border-[#e6ebf0] text-xs text-[#737b86]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#16191f] text-white text-xs wide tracking-[0.14em]"
                  >
                    Save Threshold
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: CATALOG PRODUCTS EDITOR
          ========================================================================= */}
      {activeTab === 'products' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <form onSubmit={handleSaveProduct} className="lg:col-span-5 border border-[#e6ebf0] bg-white p-6 space-y-3">
            <h2 className="wide text-xs tracking-[0.15em] font-semibold">
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
                placeholder="SKU (e.g. MV-SS27-99)"
                className="w-full border border-[#e6ebf0] px-3 py-2 text-xs"
              />
              <select
                value={pCategory}
                onChange={(e) => setPCategory(e.target.value)}
                className="w-full border border-[#e6ebf0] px-3 py-2 text-xs bg-white"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input
                type="number"
                required
                value={pPrice}
                onChange={(e) => setPPrice(Number(e.target.value))}
                placeholder="Price (Rs.)"
                className="w-full border border-[#e6ebf0] px-3 py-2 text-xs"
              />
              <input
                type="number"
                value={pSalePrice}
                onChange={(e) => setPSalePrice(e.target.value)}
                placeholder="Sale (Rs.)"
                className="w-full border border-[#e6ebf0] px-3 py-2 text-xs"
              />
              <input
                type="number"
                required
                value={pStock}
                onChange={(e) => setPStock(Number(e.target.value))}
                placeholder="Stock"
                className="w-full border border-[#e6ebf0] px-3 py-2 text-xs"
              />
            </div>
            <textarea
              rows={3}
              required
              value={pDesc}
              onChange={(e) => setPDesc(e.target.value)}
              placeholder="Couture description..."
              className="w-full border border-[#e6ebf0] px-3 py-2 text-xs"
            />
            <button
              type="submit"
              className="w-full py-2.5 bg-[#16191f] text-white wide text-[10px] tracking-[0.14em]"
            >
              {editingId ? 'Update Piece' : 'Create Piece'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setPName('');
                  setPSku('');
                  setPDesc('');
                }}
                className="w-full py-2 border border-[#e6ebf0] text-xs text-[#737b86]"
              >
                Cancel Editing
              </button>
            )}
          </form>

          <div className="lg:col-span-7 border border-[#e6ebf0] bg-white p-6 space-y-4">
            <h2 className="wide text-xs tracking-[0.15em] font-semibold">Catalog Inventory ({effectiveProducts.length})</h2>
            <div className="divide-y divide-[#e6ebf0] max-h-[600px] overflow-y-auto">
              {effectiveProducts.map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <div className="font-semibold">{p.name} ({p.sku})</div>
                    <div className="text-[#737b86]">
                      Rs. {p.price.toLocaleString()} · Stock: <strong>{p.stock}</strong> · {p.category}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(p.id);
                      setPName(p.name);
                      setPSku(p.sku);
                      setPCategory(p.category);
                      setPPrice(p.price);
                      setPStock(p.stock);
                      setPDesc(p.description);
                    }}
                    className="px-3 py-1 border border-[#16191f] text-xs"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: CATEGORIES
          ========================================================================= */}
      {activeTab === 'categories' && (
        <div className="border border-[#e6ebf0] bg-white p-6 space-y-4">
          <h2 className="wide text-xs tracking-[0.15em] uppercase font-semibold">Storefront Categories</h2>
          <div className="divide-y divide-[#e6ebf0] text-xs">
            {categories.map((c) => (
              <div key={c.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm">{c.name}</div>
                  <div className="text-[#737b86] mt-0.5">Subcategories: {c.subcategories.join(', ')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 6: COUPONS
          ========================================================================= */}
      {activeTab === 'coupons' && (
        <div className="border border-[#e6ebf0] bg-white p-6 space-y-4">
          <h2 className="wide text-xs tracking-[0.15em] uppercase font-semibold">Active Coupons & Privileges</h2>
          <div className="divide-y divide-[#e6ebf0] text-xs">
            {allCoupons.map((cp) => (
              <div key={cp.code} className="py-3 flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-sm bg-[#f3f6fa] px-2 py-1">{cp.code}</span>
                  <span className="ml-3 text-[#737b86]">
                    {cp.discountType === 'percentage' ? `${cp.discountValue}% off` : `Rs. ${cp.discountValue} off`} (Min: Rs. {cp.minOrderAmount})
                  </span>
                </div>
                <span className="text-emerald-700 font-medium">Active</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 7: DELIVERY ZONES
          ========================================================================= */}
      {activeTab === 'shipping' && (
        <div className="border border-[#e6ebf0] bg-white p-6 space-y-4">
          <h2 className="wide text-xs tracking-[0.16em] uppercase font-semibold">Insured Delivery Rates</h2>
          <div className="p-4 bg-[#f3f6fa] border border-[#e6ebf0] text-xs leading-relaxed">
            <strong>Authoritative Flat Rate:</strong> Rs. 200 flat delivery charges apply to all orders across Karachi and Pakistan with insured priority courier.
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 8: BANNERS
          ========================================================================= */}
      {activeTab === 'banners' && (
        <div className="border border-[#e6ebf0] bg-white p-6 space-y-4">
          <h2 className="wide text-xs tracking-[0.16em] uppercase font-semibold">Editorial Banners</h2>
          <div className="divide-y divide-[#e6ebf0] text-xs">
            {banners.map((b) => (
              <div key={b.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm">{b.title}</div>
                  <div className="text-[#737b86]">{b.subtitle}</div>
                </div>
                <span className="text-emerald-700 font-medium">Active</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 9: CUSTOMERS
          ========================================================================= */}
      {activeTab === 'customers' && (
        <div className="border border-[#e6ebf0] bg-white p-6 space-y-4">
          <h2 className="wide text-xs tracking-[0.16em] uppercase font-semibold">Registered Client Profiles ({allCustomers.length})</h2>
          <div className="divide-y divide-[#e6ebf0] text-xs">
            {allCustomers.map((cust) => (
              <div key={cust.uid} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{cust.displayName}</div>
                  <div className="text-[11px] text-[#737b86] font-mono">{cust.uid}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{cust.loyaltyPoints} Privilege Points</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 10: ADMIN RBAC
          ========================================================================= */}
      {activeTab === 'admins' && (
        <div className="border border-[#e6ebf0] bg-white p-6 space-y-4">
          <h2 className="wide text-xs tracking-[0.16em] uppercase font-semibold">Executive Authorization & Security</h2>
          <div className="p-4 bg-[#f3f6fa] border border-[#e6ebf0] text-xs space-y-2">
            <div>
              Primary Executive Administrator: <strong className="font-mono text-[#16191f]">razasphare@gmail.com</strong>
            </div>
            <p className="text-[#737b86]">
              Zero-Trust Firestore security rules guarantee that only this designated executive address has permissions to view orders, update status, mutate inventory records, and create audit entries.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
