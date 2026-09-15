import type { Id, IsoDateString, Money } from "./common";

export type PriceChangeReason =
  | "manual"
  | "automation_rule"
  | "competitor_match"
  | "supplier_cost_change";

export interface PriceHistory {
  id: Id;
  productId: Id;
  listingId?: Id;
  price: Money;
  previousPrice?: Money;
  reason: PriceChangeReason;
  changedAt: IsoDateString;
}
