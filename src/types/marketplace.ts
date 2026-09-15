import type { Id, IsoDateString } from "./common";

export type MarketplaceType = "ebay" | "amazon" | "shopify" | "etsy" | "manual";

export type MarketplaceConnectionStatus =
  | "connected"
  | "disconnected"
  | "error"
  | "pending";

export interface Marketplace {
  id: Id;
  type: MarketplaceType;
  name: string;
  storeUrl?: string;
  status: MarketplaceConnectionStatus;
  connectedAt?: IsoDateString;
  lastSyncAt?: IsoDateString;
}
