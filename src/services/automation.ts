import { automationRules, automationRuns, listings, products } from "@/mocks";
import type {
  AutomationAction,
  AutomationCondition,
  AutomationRule,
  AutomationRuleStatus,
  AutomationRunLog,
  AutomationSchedule,
  AutomationScope,
  AutomationTrigger,
  Id,
  Product,
} from "@/types";

/**
 * This module currently reads from and writes to local mock data held in
 * memory. It is the seam where real API/Tauri calls will replace the mock
 * reads/writes later — callers should keep depending only on the exported
 * function signatures below.
 */

function simulateLatency(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso(): string {
  return new Date().toISOString();
}

function matchesScope(product: Product, scope: AutomationScope): boolean {
  if (scope.mode === "all") return true;

  if (
    scope.categories.length &&
    (!product.category || !scope.categories.includes(product.category))
  )
    return false;

  if (
    scope.supplierIds.length &&
    (!product.supplierId || !scope.supplierIds.includes(product.supplierId))
  )
    return false;

  if (scope.tags.length && !(product.tags ?? []).some((t) => scope.tags.includes(t)))
    return false;

  if (scope.marketplaceIds.length) {
    const listedOnScope = listings.some(
      (l) => l.productId === product.id && scope.marketplaceIds.includes(l.marketplaceId),
    );
    if (!listedOnScope) return false;
  }

  return true;
}

export function countMatchingProducts(scope: AutomationScope): number {
  return products.filter((p) => p.status === "active" && matchesScope(p, scope)).length;
}

export interface RuleListItemView {
  rule: AutomationRule;
  matchingProductCount: number;
  lastRun?: AutomationRunLog;
  runCount: number;
  errorRunCount: number;
}

function sortByStartedAtDesc(runs: AutomationRunLog[]): AutomationRunLog[] {
  return runs.slice().sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function getAutomationRules(): Promise<RuleListItemView[]> {
  await simulateLatency();

  return automationRules.map((rule) => {
    const runs = automationRuns.filter((r) => r.ruleId === rule.id);
    return {
      rule,
      matchingProductCount: countMatchingProducts(rule.scope),
      lastRun: sortByStartedAtDesc(runs)[0],
      runCount: runs.length,
      errorRunCount: runs.filter((r) => r.status === "error").length,
    };
  });
}

export interface AutomationStats {
  active: number;
  paused: number;
  draft: number;
  runsLast24h: number;
  errorsToReview: number;
}

export async function getAutomationStats(): Promise<AutomationStats> {
  await simulateLatency();

  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();

  const byStatus = (status: AutomationRuleStatus) =>
    automationRules.filter((r) => r.status === status).length;

  return {
    active: byStatus("active"),
    paused: byStatus("paused"),
    draft: byStatus("draft"),
    runsLast24h: automationRuns.filter((r) => now - new Date(r.startedAt).getTime() <= dayMs).length,
    errorsToReview: automationRuns.filter((r) => r.status === "error").length,
  };
}

export async function getRuleRunHistory(ruleId: Id): Promise<AutomationRunLog[]> {
  await simulateLatency();
  return sortByStartedAtDesc(automationRuns.filter((r) => r.ruleId === ruleId));
}

export interface RunLogView extends AutomationRunLog {
  ruleName: string;
}

export async function getAllRunLogs(limit = 50): Promise<RunLogView[]> {
  await simulateLatency();
  return sortByStartedAtDesc(automationRuns)
    .slice(0, limit)
    .map((log) => ({
      ...log,
      ruleName: automationRules.find((r) => r.id === log.ruleId)?.name ?? "Regola eliminata",
    }));
}

export interface RuleInput {
  name: string;
  description?: string;
  trigger: AutomationTrigger;
  schedule?: AutomationSchedule;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  scope: AutomationScope;
  status: AutomationRuleStatus;
}

let ruleIdCounter = automationRules.length;

export async function createRule(input: RuleInput): Promise<AutomationRule> {
  await simulateLatency();
  ruleIdCounter += 1;
  const rule: AutomationRule = {
    id: `rule_${Date.now()}_${ruleIdCounter}`,
    createdAt: nowIso(),
    ...input,
  };
  automationRules.push(rule);
  return rule;
}

export async function updateRule(id: Id, input: RuleInput): Promise<void> {
  await simulateLatency();
  const rule = automationRules.find((r) => r.id === id);
  if (!rule) return;
  Object.assign(rule, input);
}

export async function deleteRule(id: Id): Promise<void> {
  await simulateLatency();
  const index = automationRules.findIndex((r) => r.id === id);
  if (index >= 0) automationRules.splice(index, 1);
}

export async function duplicateRule(id: Id): Promise<AutomationRule | undefined> {
  await simulateLatency();
  const source = automationRules.find((r) => r.id === id);
  if (!source) return undefined;

  ruleIdCounter += 1;
  const copy: AutomationRule = {
    ...source,
    id: `${source.id}_copy_${ruleIdCounter}`,
    name: `${source.name} (copia)`,
    status: "draft",
    createdAt: nowIso(),
    lastRunAt: undefined,
  };
  automationRules.push(copy);
  return copy;
}

export async function setRuleStatus(id: Id, status: AutomationRuleStatus): Promise<void> {
  await simulateLatency();
  const rule = automationRules.find((r) => r.id === id);
  if (rule) rule.status = status;
}

export async function getRule(id: Id): Promise<AutomationRule | undefined> {
  await simulateLatency();
  return automationRules.find((r) => r.id === id);
}

export async function runRuleNow(
  id: Id,
  options: { dryRun?: boolean } = {},
): Promise<AutomationRunLog> {
  await simulateLatency(500);

  const rule = automationRules.find((r) => r.id === id);
  const log: AutomationRunLog = {
    id: `run_${Date.now()}`,
    ruleId: id,
    startedAt: nowIso(),
    status: "success",
    affectedProductCount: 0,
    dryRun: options.dryRun,
  };

  if (!rule) {
    log.status = "error";
    log.errorMessage = "Regola non trovata.";
    return log;
  }

  log.affectedProductCount = countMatchingProducts(rule.scope);
  if (log.affectedProductCount === 0) {
    log.status = "error";
    log.errorMessage = "Nessun prodotto corrisponde all'ambito della regola.";
  }

  if (!options.dryRun) {
    automationRuns.push(log);
    rule.lastRunAt = log.startedAt;
  }

  return log;
}
