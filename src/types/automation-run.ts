import type { Id, IsoDateString } from "./common";

export type AutomationRunStatus = "success" | "partial" | "error";

export interface AutomationRunLog {
  id: Id;
  ruleId: Id;
  startedAt: IsoDateString;
  status: AutomationRunStatus;
  affectedProductCount: number;
  errorMessage?: string;
  dryRun?: boolean;
}
