// Record types and fixed lists shared by the UI and the mock backend.
// Kept free of faker and seed data so importing them doesn't pull the whole
// mock dataset into the UI bundle.

export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Ticket {
  id: string;
  ref: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string;
  customerId: string;
  customerName: string;
  assignee: string;
  tags: string[];
  attachments: number;
  createdAt: string;
  updatedAt: string;
  dueDate: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  company: string;
  plan: 'free' | 'pro' | 'enterprise';
  country: string;
  status: 'active' | 'trial' | 'churned';
  totalTickets: number;
  createdAt: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  reorderLevel: number;
  warehouse: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
}

export interface Activity {
  id: string;
  actor: string;
  action: string;
  target: string;
  time: string;
}

export interface Comment {
  id: string;
  ticketId: string;
  author: string;
  body: string;
  createdAt: string;
  internal: boolean;
}

export const CATEGORIES = ['Billing', 'Technical', 'Account', 'Shipping', 'Feature Request', 'Bug'];
export const ASSIGNEES = [
  'Maya Chen',
  'Liam Novak',
  'Priya Nair',
  'Noah Fischer',
  'Sofia Marino',
  'Ethan Brooks',
  'Aisha Khan',
  'Diego Alvarez',
];

export const CURRENT_USER = 'Alex Vance';
export const WAREHOUSES = ['Amsterdam', 'Rotterdam', 'Berlin', 'Utrecht'];
export const PRODUCT_CATEGORIES = ['Accessories', 'Peripherals', 'Networking', 'Storage', 'Displays'];

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type ShipmentStage =
  | 'label_created'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'exception';
export type ReturnStatus = 'requested' | 'approved' | 'rejected' | 'received' | 'refunded';
export type OrderChannel = 'web' | 'phone' | 'email' | 'partner';

export interface OrderLine {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  ref: string;
  customerId: string;
  customerName: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  channel: OrderChannel;
  items: OrderLine[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
  shippingAddress: string;
  carrier?: string;
  trackingNumber?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentEvent {
  id: string;
  orderId: string;
  orderRef: string;
  stage: ShipmentStage;
  carrier: string;
  trackingNumber: string;
  location: string;
  note: string;
  at: string;
}

export interface ReturnRequest {
  id: string;
  ref: string;
  orderId: string;
  orderRef: string;
  customerName: string;
  reason: string;
  status: ReturnStatus;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
];
export const PAYMENT_STATUSES: PaymentStatus[] = ['pending', 'paid', 'failed', 'refunded'];
export const SHIPMENT_STAGES: ShipmentStage[] = [
  'label_created',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'exception',
];
export const SHIPMENT_FLOW: ShipmentStage[] = [
  'label_created',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
];
export const RETURN_STATUSES: ReturnStatus[] = [
  'requested',
  'approved',
  'rejected',
  'received',
  'refunded',
];
export const ORDER_CHANNELS: OrderChannel[] = ['web', 'phone', 'email', 'partner'];
export const CARRIERS = ['ParcelPal', 'SwiftShip', 'Northline', 'EuroFreight'];
export const RETURN_REASONS = [
  'Damaged on arrival',
  'Wrong item shipped',
  'No longer needed',
  'Not as described',
  'Arrived too late',
];
