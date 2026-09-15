import type { Id, IsoDateString, Money } from "./common";

export type ListingStatus = "draft" | "active" | "paused" | "ended" | "error";

export interface Listing {
  id: Id;
  productId: Id;
  marketplaceId: Id;
  externalId?: string;
  title: string;
  price: Money;
  quantity: number;
  status: ListingStatus;
  url?: string;
  lastSyncedAt?: IsoDateString;
  syncError?: string;
  createdAt: IsoDateString;
}
