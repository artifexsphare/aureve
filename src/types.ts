export interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string;
  category: string;
  subcategory?: string;
  lookNumber?: number;
  price: number;
  salePrice?: number;
  stock: number;
  lowStockThreshold?: number;
  variantStock?: Record<string, number>;
  published: boolean;
  featured?: boolean;
  bestSeller?: boolean;
  flashSale?: boolean;
  description: string;
  material?: string;
  care?: string;
  origin?: string;
  sizes: string[];
  colors: string[];
  images: string[];
  /** [x0, x1, y0, y1] on the 960x720 PIECES sheet when using the runway sprite */
  spriteBox?: [number, number, number, number];
  ratingAvg?: number;
  ratingCount?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  subcategories: string[];
  sortOrder: number;
}

export interface Coupon {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  maxDiscount?: number;
  active: boolean;
  description?: string;
}

export interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  ctaLabel: string;
  ctaLink: string;
  active: boolean;
}

export interface ShippingZone {
  id: string;
  name: string;
  cities: string[];
  fee: number;
  freeThreshold: number;
  estimatedDays: string;
  active: boolean;
}

export interface CartEntry {
  id: string;
  productId: string;
  quantity: number;
  size: string;
  color: string;
  savedForLater: boolean;
}

export interface SavedAddress {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  city: string;
  area: string;
  street: string;
  houseNumber: string;
  instructions?: string;
  isDefault: boolean;
}

export type OrderStatus =
  | 'New Order'
  | 'Pending Confirmation'
  | 'Confirmed'
  | 'Processing'
  | 'Packed'
  | 'Ready for Dispatch'
  | 'Shipped'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancelled'
  | 'Return Requested'
  | 'Returned'
  | 'Refunded'
  | 'Pending';

export type PaymentMethod = 'cod' | 'stripe' | 'easypaisa' | 'jazzcash';

export interface OrderStatusHistoryRecord {
  id?: string;
  orderId: string;
  previousStatus: OrderStatus | string;
  newStatus: OrderStatus;
  changedBy: string;
  note?: string;
  timestamp: string;
}

export interface StockHistoryRecord {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  variantKey?: string;
  previousStock: number;
  newStock: number;
  changeAmount: number;
  changeType: 'manual_add' | 'manual_reduce' | 'order_placement' | 'order_cancellation' | 'inventory_reset' | 'out_of_stock';
  reason: string;
  changedBy: string;
  timestamp: string;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  city: string;
  area: string;
  street: string;
  houseNumber: string;
  instructions?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentRef?: string;
  status: OrderStatus;
  couponCode?: string;
  subtotal: number;
  discountTotal: number;
  shippingFee: number;
  grandTotal: number;
  itemSummary: string;
  itemCount: number;
  adminNotes?: string;
  cancellationReason?: string;
  trackingNumber?: string;
  courier?: string;
  statusHistory?: OrderStatusHistoryRecord[];
  returnReason?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface OrderItemRecord {
  id: string;
  orderId: string;
  userId: string;
  productId: string;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  size: string;
  color: string;
}

export interface ReviewRecord {
  id: string;
  productId: string;
  userId: string;
  authorName: string;
  rating: number;
  title: string;
  comment: string;
  createdAt?: unknown;
}

export interface AdminMemberRecord {
  uid: string;
  email: string;
  role: 'super_admin' | 'manager' | 'fulfillment';
}

