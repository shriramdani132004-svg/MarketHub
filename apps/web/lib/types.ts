export type Role = 'CUSTOMER' | 'SELLER' | 'ADMIN';

export interface SellerSummary {
  id: string;
  storeName: string;
  storeSlug: string;
  logoUrl?: string | null;
  description?: string | null;
  approvalStatus?: string;
  approvedAt?: string | null;
  createdAt?: string;
  productCount?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string | null;
  status: string;
  createdAt: string;
  sellerProfile?: SellerSummary | null;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  parentId?: string | null;
  isActive?: boolean;
  productCount?: number;
  children?: Category[];
}

export interface ProductCard {
  id: string;
  name: string;
  slug: string;
  description: string;
  brand?: string | null;
  sku: string;
  price: string;
  compareAtPrice?: string | null;
  imageUrl?: string | null;
  status: string;
  available: number;
  lowStock: boolean;
  reviewCount: number;
  category: { id: string; name: string; slug: string };
  seller: {
    id: string;
    storeName: string;
    storeSlug: string;
    logoUrl?: string | null;
  };
  createdAt: string;
}

export interface ProductDetail extends ProductCard {
  updatedAt: string;
  rating: number | null;
  soldCount: number;
  seller: ProductCard['seller'] & { description?: string | null; approvalStatus?: string };
  reviews: Review[];
}

export interface Review {
  id: string;
  rating: number;
  title?: string | null;
  comment?: string | null;
  createdAt: string;
  customer?: { name: string };
}

export interface CartProduct {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  price: string;
  status: string;
  seller: {
    id: string;
    storeName: string;
    storeSlug: string;
    logoUrl?: string | null;
  };
  category: { id: string; name: string; slug: string };
}

export interface CartItem {
  id: string;
  quantity: number;
  quantityLimit: number;
  available: number;
  unitPrice: string;
  lineTotal: string;
  issue: string | null;
  product: CartProduct;
}

export interface Cart {
  id: string | null;
  items: CartItem[];
  itemCount: number;
  subtotal: string;
  shippingEstimate: string;
  grandTotal: string;
  hasIssues: boolean;
}

export interface Address {
  id: string;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt?: string;
}

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PROCESSING'
  | 'PARTIALLY_SHIPPED'
  | 'SHIPPED'
  | 'PARTIALLY_DELIVERED'
  | 'DELIVERED'
  | 'CANCELLED';

export interface PaymentEvent {
  id: string;
  eventType: string;
  details?: Record<string, unknown> | null;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  sku: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
  product?: { id: string; name: string; slug: string; imageUrl?: string | null; status?: string };
  canReview: boolean;
  myReview: { id: string; rating: number } | null;
}

export interface SellerOrder {
  id: string;
  status: string;
  subtotal: string;
  shippingAmount: string;
  trackingReference?: string | null;
  trackingUrl?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  updatedAt: string;
  seller: {
    id: string;
    storeName: string;
    storeSlug: string;
    logoUrl?: string | null;
    businessContact?: string | null;
  };
  items: OrderItem[];
}

export interface Order {
  id: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  paymentStatus: string;
  currency: string;
  subtotal: string;
  shippingTotal: string;
  discountTotal: string;
  grandTotal: string;
  shippingAddress: Record<string, string>;
  billingAddress: Record<string, string>;
  reservationExpiresAt?: string | null;
  paidAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
  canCancel: boolean;
  customer?: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    createdAt: string;
  };
  payment: {
    id: string;
    paymentReference: string;
    provider: string;
    method: string;
    amount: string;
    currency: string;
    status: string;
    createdAt: string;
    events: PaymentEvent[];
  } | null;
  sellerOrders: SellerOrder[];
  timeline: Array<{ label: string; status: string; at: string | null }>;
}

export interface PaymentDetail {
  id: string;
  paymentReference: string;
  provider: string;
  method: string;
  amount: string;
  currency: string;
  status: string;
  simulated: boolean;
  createdAt: string;
  events: PaymentEvent[];
  order: {
    id: string;
    orderNumber: string;
    orderStatus: string;
    paymentStatus: string;
    grandTotal: string;
    currency: string;
    reservationExpiresAt: string | null;
    sellerOrders: Array<{
      id: string;
      status: string;
      subtotal: string;
      sellerName: string;
      items: Array<{ id: string; name: string; quantity: number; lineTotal: string }>;
    }>;
  };
}

export interface CheckoutSummary {
  orderId: string;
  orderNumber: string;
  paymentId: string;
  paymentReference: string;
  grandTotal: string;
  currency: string;
  reservationExpiresAt: string;
  sellerOrderCount: number;
  idempotent?: boolean;
}

export interface SellerProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  brand?: string | null;
  sku: string;
  price: string;
  compareAtPrice?: string | null;
  stockOnHand: number;
  reservedStock: number;
  imageUrl?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string; slug: string };
  available: number;
  lowStock: boolean;
  orderItemCount: number;
}

export interface SellerOrderGroup {
  id: string;
  status: string;
  subtotal: string;
  shippingAmount: string;
  trackingReference?: string | null;
  trackingUrl?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  updatedAt: string;
  seller: SellerOrder['seller'];
  items: Array<{
    id: string;
    productId: string;
    name: string;
    sku: string;
    unitPrice: string;
    quantity: number;
    lineTotal: string;
    product?: { id: string; name: string; slug: string; imageUrl?: string | null };
  }>;
  order: {
    id: string;
    orderNumber: string;
    orderStatus: string;
    paymentStatus: string;
    grandTotal: string;
    currency: string;
    createdAt: string;
    paidAt?: string | null;
    shippingAddress: Record<string, string>;
    customer: { id: string; name: string; email: string; phone?: string | null };
    payment?: { id: string; status: string; paymentReference: string } | null;
  };
}

export interface AdminDashboard {
  customers: number;
  sellers: number;
  pendingSellers: number;
  approvedSellers: number;
  activeProducts: number;
  outOfStock: number;
  lowStock: number;
  totalOrders: number;
  failedPayments: number;
  simulatedRevenue: string;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    orderStatus: string;
    paymentStatus: string;
    grandTotal: string;
    createdAt: string;
    customer: { name: string; email: string };
    sellerCount: number;
  }>;
  recentApplications: Array<{
    id: string;
    storeName: string;
    storeSlug: string;
    approvalStatus: string;
    createdAt: string;
    user: { name: string; email: string };
  }>;
  orderStatusDistribution: Array<{ status: string; count: number }>;
  salesTrend: Array<{ date: string; amount: number; count: number }>;
  note: string;
}

export interface SellerAnalytics {
  store: { id: string; storeName: string; storeSlug: string; approvalStatus: string };
  products: {
    total: number;
    published: number;
    draft: number;
    outOfStock: number;
    archived: number;
    lowStock: number;
  };
  orders: {
    pendingPayment: number;
    paid: number;
    processing: number;
    shipped: number;
    delivered: number;
    cancelled: number;
  };
  simulatedSales: {
    orders: number;
    merchandise: string;
    shipping: string;
    gross: string;
    note: string;
  };
  productPerformance: Array<{
    productId: string;
    product: { id: string; name: string; sku: string; imageUrl?: string | null } | null;
    units: number;
    revenue: string;
  }>;
  inventoryMovements: Array<{
    id: string;
    movementType: string;
    quantity: number;
    reference?: string | null;
    createdAt: string;
    product: { id: string; name: string; sku: string };
  }>;
  recentOrders: Array<{
    id: string;
    status: string;
    subtotal: string;
    createdAt: string;
    unitCount: number;
    order: { id: string; orderNumber: string; orderStatus: string; customer: { name: string } };
  }>;
  salesTrend: Array<{ date: string; amount: number; orders: number }>;
}

export interface CustomerAnalytics {
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    orderStatus: string;
    paymentStatus: string;
    grandTotal: string;
    createdAt: string;
  }>;
  orderCount: number;
  delivered: number;
  pendingPayment: number;
  cancelled: number;
  simulatedSpend: string;
  note: string;
}

export interface AdminSeller {
  id: string;
  storeName: string;
  storeSlug: string;
  description?: string | null;
  logoUrl?: string | null;
  approvalStatus: string;
  rejectionReason?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  productCount: number;
  orderCount: number;
  user: { id: string; name: string; email: string; status: string };
}

export interface AdminPayment {
  id: string;
  paymentReference: string;
  provider: string;
  method: string;
  amount: string;
  currency: string;
  status: string;
  simulated: boolean;
  createdAt: string;
  eventCount: number;
  order: {
    id: string;
    orderNumber: string;
    orderStatus: string;
    customer: { name: string; email: string };
  };
}

export interface InventoryMovement {
  id: string;
  movementType: string;
  quantity: number;
  reference?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  product: { id: string; name: string; sku: string };
  seller: { id: string; storeName: string };
}

export interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: string;
  stockOnHand: number;
  reservedStock: number;
  status: string;
  imageUrl?: string | null;
  createdAt: string;
  category: { id: string; name: string; slug: string };
  seller: {
    id: string;
    storeName: string;
    storeSlug: string;
    approvalStatus: string;
  };
  available: number;
  lowStock: boolean;
}

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  parentId?: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { products: number; children: number };
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string | null;
  status: string;
  createdAt: string;
  orderCount: number;
  sellerProfile?: { id: string; storeName: string; storeSlug: string; approvalStatus: string } | null;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  link?: string | null;
  createdAt: string;
}
