import type { Id, Money } from "./common";

export interface ImportVariantDraft {
  id: Id;
  attributes: Record<string, string>;
  priceOverride?: number;
}

export interface ProductImportDraft {
  sourceUrl: string;
  sourceLabel: string;
  title: string;
  description?: string;
  images: string[];
  category?: string;
  brand?: string;
  basePrice: Money;
  cost?: Money;
  supplierId?: Id;
  tags: string[];
  variants: ImportVariantDraft[];
}
