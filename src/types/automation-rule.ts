import type { Id, IsoDateString } from "./common";

export type AutomationTrigger =
  | "price_below_competitor"
  | "stock_low"
  | "scheduled"
  | "order_placed";

export type AutomationActionType =
  | "adjust_price"
  | "pause_listing"
  | "reorder_stock"
  | "send_notification";

export type AutomationRuleStatus = "active" | "paused" | "draft";

export type AutomationConditionOperator =
  | "eq"
  | "neq"
  | "gt"
  | "lt"
  | "gte"
  | "lte";

export interface AutomationCondition {
  field: string;
  operator: AutomationConditionOperator;
  value: string | number | boolean | null;
}

export interface AutomationAction {
  type: AutomationActionType;
  params?: Record<string, unknown>;
}

export type AutomationScheduleFrequency = "hourly" | "daily" | "custom";

export interface AutomationSchedule {
  frequency: AutomationScheduleFrequency;
  /** "HH:mm", used when frequency is "daily". */
  timeOfDay?: string;
  /** Free-form description, used when frequency is "custom" (e.g. "ogni 6 ore"). */
  customDescription?: string;
}

export interface AutomationScope {
  mode: "all" | "filtered";
  categories: string[];
  supplierIds: Id[];
  tags: string[];
  marketplaceIds: Id[];
}

export interface AutomationRule {
  id: Id;
  name: string;
  description?: string;
  trigger: AutomationTrigger;
  schedule?: AutomationSchedule;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  scope: AutomationScope;
  status: AutomationRuleStatus;
  productIds?: Id[];
  lastRunAt?: IsoDateString;
  createdAt: IsoDateString;
}
