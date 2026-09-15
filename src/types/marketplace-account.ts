import type { Id, IsoDateString } from "./common";
import type { MarketplaceType } from "./marketplace";

export type MarketplaceAccountStatus =
  | "connected"
  | "syncing"
  | "token_expired"
  | "error";

export interface MarketplaceAccount {
  id: Id;
  marketplaceType: MarketplaceType;
  /** eBay: "sandbox" | "production". Amazon: region code ("na" | "eu" | "fe"). */
  environment: string;
  nickname: string;
  externalAccountId?: string;
  status: MarketplaceAccountStatus;
  connectedAt: IsoDateString;
  lastSyncProductsAt?: IsoDateString;
  lastSyncOrdersAt?: IsoDateString;
  lastError?: string;
}
