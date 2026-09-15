import type { Id, IsoDateString, Money } from "./common";

export type OrderStatus =
  | "pending"
  | "paid"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export interface OrderItem {
  id: Id;
  productId: Id;
  listingId?: Id;
  title: string;
  quantity: number;
  unitPrice: Money;
}

export interface Order {
  id: Id;
  marketplaceId: Id;
  externalOrderId?: string;
  status: OrderStatus;
  items: OrderItem[];
  total: Money;
  buyerName?: string;
  shippingAddress?: string;
  placedAt: IsoDateString;
  updatedAt: IsoDateString;
}
