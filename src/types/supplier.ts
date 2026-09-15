import type { Id, IsoDateString } from "./common";

export type SupplierStatus = "active" | "inactive" | "pending_review";

export interface Supplier {
  id: Id;
  name: string;
  website?: string;
  country?: string;
  status: SupplierStatus;
  contactEmail?: string;
  rating?: number;
  leadTimeDays?: number;
  notes?: string;
  createdAt: IsoDateString;
}
