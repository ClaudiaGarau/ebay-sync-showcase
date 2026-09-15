import type { Id, IsoDateString } from "./common";

export interface Inventory {
  id: Id;
  productId: Id;
  warehouse?: string;
  quantityAvailable: number;
  quantityReserved: number;
  reorderPoint?: number;
  updatedAt: IsoDateString;
}
