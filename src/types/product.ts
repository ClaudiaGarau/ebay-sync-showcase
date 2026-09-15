import type { Id, IsoDateString, Money } from "./common";

export type ProductStatus = "draft" | "active" | "archived";

export interface ProductVariant {
  id: Id;
  sku: string;
  attributes: Record<string, string>;
  priceOverride?: Money;
}

export interface Product {
  id: Id;
  title: string;
  description?: string;
  sku: string;
  status: ProductStatus;
  category?: string;
  brand?: string;
  images?: string[];
  basePrice: Money;
  cost?: Money;
  supplierId?: Id;
  variants?: ProductVariant[];
  tags?: string[];
  sourceUrl?: string;
  sourceLabel?: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}
