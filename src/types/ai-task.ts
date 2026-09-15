import type { Id, IsoDateString } from "./common";

export type AiTaskType =
  | "generate_description"
  | "optimize_title"
  | "suggest_price"
  | "categorize_product"
  | "answer_question";

export type AiTaskStatus = "queued" | "running" | "completed" | "failed";

export interface AiTask {
  id: Id;
  type: AiTaskType;
  status: AiTaskStatus;
  productId?: Id;
  summary: string;
  errorMessage?: string;
  createdAt: IsoDateString;
  completedAt?: IsoDateString;
}
