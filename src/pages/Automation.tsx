import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bot,
  History,
  Pause,
  Play,
  Plus,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RuleCard } from "@/components/automation/RuleCard";
import { RuleHistorySheet } from "@/components/automation/RuleHistorySheet";
import { ExecutionLogSheet } from "@/components/automation/ExecutionLogSheet";
import { TRIGGER_LABELS } from "@/components/automation/schema";
import {
  deleteRule,
  duplicateRule,
  getAutomationRules,
  getAutomationStats,
  runRuleNow,
  setRuleStatus,
  type AutomationStats,
  type RuleListItemView,
} from "@/services/automation";
import type { AutomationRule, AutomationRuleStatus, AutomationTrigger } from "@/types";

type StatusFilter = "all" | AutomationRuleStatus;

export default function Automation() {
  const navigate = useNavigate();

  const [items, setItems] = useState<RuleListItemView[] | null>(null);
  const [stats, setStats] = useState<AutomationStats | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [triggerFilter, setTriggerFilter] = useState<AutomationTrigger | "all">("all");
  const [errorsOnly, setErrorsOnly] = useState(false);

  const [historyRule, setHistoryRule] = useState<AutomationRule | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RuleListItemView | null>(null);

  async function reload(signal?: { cancelled: boolean }) {
    const [rulesData, statsData] = await Promise.all([getAutomationRules(), getAutomationStats()]);
    if (signal?.cancelled) return;
    setItems(rulesData);
    setStats(statsData);
  }

  useEffect(() => {
    const signal = { cancelled: false };
    reload(signal);
    return () => {
      signal.cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!items) return null;
    const q = query.trim().toLowerCase();

    return items.filter((item) => {
      if (statusFilter !== "all" && item.rule.status !== statusFilter) return false;
      if (triggerFilter !== "all" && item.rule.trigger !== triggerFilter) return false;
      if (errorsOnly && item.errorRunCount === 0) return false;
      if (q && !item.rule.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, query, statusFilter, triggerFilter, errorsOnly]);

  async function handleTogglePause(item: RuleListItemView, checked: boolean) {
    await setRuleStatus(item.rule.id, checked ? "active" : "paused");
    await reload();
    toast.success(checked ? "Regola attivata" : "Regola messa in pausa");
  }

  async function handleDuplicate(item: RuleListItemView) {
    await duplicateRule(item.rule.id);
    await reload();
    toast.success("Regola duplicata come bozza");
  }

  async function handleRunNow(item: RuleListItemView) {
    const log = await runRuleNow(item.rule.id);
    await reload();
    if (log.status === "error") {
      toast.error("Esecuzione fallita", { description: log.errorMessage });
    } else {
      toast.success(`Esecuzione completata · ${log.affectedProductCount} prodotti interessati`);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteRule(deleteTarget.rule.id);
    setDeleteTarget(null);
    await reload();
    toast.success("Regola eliminata");
  }

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        title="Automazioni"
        description="Regole che agiscono in automatico su prezzi, scorte e inserzioni."
        actions={
          <>
            <Button variant="outline" onClick={() => setLogOpen(true)}>
              <History className="size-3.5" />
              Registro esecuzioni
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast("Galleria modelli in arrivo", {
                  description: "Per ora crea una regola da zero con \"Nuova regola\".",
                })
              }
            >
              <Sparkles className="size-3.5" />
              Modelli
            </Button>
            <Button onClick={() => navigate("/automation/new")}>
              <Plus className="size-3.5" />
              Nuova regola
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <MetricCard
          icon={Zap}
          label="Regole attive"
          value={stats?.active.toString()}
          hint="In esecuzione automatica"
          onClick={() => setStatusFilter((s) => (s === "active" ? "all" : "active"))}
          active={statusFilter === "active"}
        />
        <MetricCard
          icon={Pause}
          label="In pausa"
          value={stats?.paused.toString()}
          hint="Sospese manualmente"
          onClick={() => setStatusFilter((s) => (s === "paused" ? "all" : "paused"))}
          active={statusFilter === "paused"}
        />
        <MetricCard
          icon={Bot}
          label="Bozze"
          value={stats?.draft.toString()}
          hint="Non ancora attivate"
          onClick={() => setStatusFilter((s) => (s === "draft" ? "all" : "draft"))}
          active={statusFilter === "draft"}
        />
        <MetricCard
          icon={Play}
          label="Esecuzioni 24h"
          value={stats?.runsLast24h.toString()}
          hint="Ultime 24 ore"
        />
        <MetricCard
          icon={AlertTriangle}
          label="Errori da controllare"
          value={stats?.errorsToReview.toString()}
          hint="Esecuzioni fallite"
          tone={stats && stats.errorsToReview > 0 ? "warning" : undefined}
          onClick={() => setErrorsOnly((v) => !v)}
          active={errorsOnly}
        />
      </div>

      <Card className="overflow-hidden p-0">
        <CardHeader className="gap-3 px-5 pt-5 pb-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <TabsList>
                <TabsTrigger value="all">Tutte</TabsTrigger>
                <TabsTrigger value="active">Attive</TabsTrigger>
                <TabsTrigger value="paused">In pausa</TabsTrigger>
                <TabsTrigger value="draft">Bozze</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cerca per nome…"
                className="sm:w-56"
              />
              <Select
                value={triggerFilter}
                onValueChange={(v) => setTriggerFilter(v as AutomationTrigger | "all")}
              >
                <SelectTrigger className="sm:w-48">
                  <SelectValue placeholder="Trigger" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i trigger</SelectItem>
                  {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          {!filtered ? (
            <div className="space-y-3">
              <div className="h-28 w-full animate-pulse rounded-xl bg-muted" />
              <div className="h-28 w-full animate-pulse rounded-xl bg-muted" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Bot}
              title="Nessuna regola trovata"
              description="Prova a modificare la ricerca o i filtri attivi, oppure crea la prima regola."
              action={
                <Button onClick={() => navigate("/automation/new")}>
                  <Plus className="size-3.5" />
                  Nuova regola
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((item) => (
                <RuleCard
                  key={item.rule.id}
                  item={item}
                  onTogglePause={(checked) => handleTogglePause(item, checked)}
                  onEdit={() => navigate(`/automation/${item.rule.id}`)}
                  onDuplicate={() => handleDuplicate(item)}
                  onDelete={() => setDeleteTarget(item)}
                  onRunNow={() => handleRunNow(item)}
                  onViewHistory={() => {
                    setHistoryRule(item.rule);
                    setHistoryOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RuleHistorySheet rule={historyRule} open={historyOpen} onOpenChange={setHistoryOpen} />
      <ExecutionLogSheet open={logOpen} onOpenChange={setLogOpen} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={deleteTarget ? `Eliminare "${deleteTarget.rule.name}"?` : ""}
        description="La regola smetterà immediatamente di essere eseguita. La cronologia delle esecuzioni passate resterà consultabile nel registro."
        confirmLabel="Elimina"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
