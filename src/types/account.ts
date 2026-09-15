import type { Id, IsoDateString } from "./common";

export type AccountPlan = "free" | "pro" | "business";

export interface Account {
  id: Id;
  name: string;
  email: string;
  avatarUrl?: string;
  plan: AccountPlan;
  createdAt: IsoDateString;
}
