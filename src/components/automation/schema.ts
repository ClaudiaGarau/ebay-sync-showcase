import {
  Calendar,
  CircleDollarSign,
  PackageX,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";
import type {
  AutomationAction,
  AutomationActionType,
  AutomationCondition,
  AutomationConditionOperator,
  AutomationRunStatus,
  AutomationScope,
  AutomationTrigger,
} from "@/types";

export const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  price_below_competitor: "Prezzo competitor più basso",
  stock_low: "Scorte sotto soglia",
  scheduled: "Pianificata",
  order_placed: "Ordine ricevuto",
};

export const TRIGGER_DESCRIPTIONS: Record<AutomationTrigger, string> = {
  price_below_competitor:
    "Si attiva quando un competitor vende lo stesso prodotto a un prezzo più basso.",
  stock_low: "Si attiva quando le scorte disponibili scendono sotto una soglia.",
  scheduled: "Si esegue a intervalli regolari (ogni ora, ogni giorno, un orario specifico).",
  order_placed: "Si attiva quando arriva un nuovo ordine.",
};

export const TRIGGER_ICONS: Record<AutomationTrigger, LucideIcon> = {
  price_below_competitor: CircleDollarSign,
  stock_low: PackageX,
  scheduled: Calendar,
  order_placed: ShoppingCart,
};

export interface ConditionFieldOption {
  field: string;
  label: string;
  type: "number" | "boolean" | "string";
  operators: AutomationConditionOperator[];
  options?: { value: string; label: string }[];
}

export const CONDITION_FIELDS_BY_TRIGGER: Record<AutomationTrigger, ConditionFieldOption[]> = {
  price_below_competitor: [
    {
      field: "competitorPrice",
      label: "Differenza dal prezzo del competitor",
      type: "number",
      operators: ["lt", "lte", "gt", "gte"],
    },
  ],
  stock_low: [
    {
      field: "quantityAvailable",
      label: "Scorte disponibili",
      type: "number",
      operators: ["lt", "lte", "eq"],
    },
    {
      field: "reorderPoint",
      label: "Soglia di riordino",
      type: "number",
      operators: ["lt", "lte", "eq"],
    },
  ],
  scheduled: [
    {
      field: "syncError",
      label: "Ha un errore di sincronizzazione",
      type: "boolean",
      operators: ["eq", "neq"],
      options: [
        { value: "true", label: "Sì" },
        { value: "false", label: "No" },
      ],
    },
  ],
  order_placed: [
    {
      field: "marketplaceId",
      label: "Marketplace",
      type: "string",
      operators: ["eq", "neq"],
      options: [
        { value: "mp_ebay", label: "eBay" },
        { value: "mp_amazon", label: "Amazon" },
        { value: "mp_shopify", label: "Shopify Store" },
        { value: "mp_etsy", label: "Etsy" },
      ],
    },
    {
      field: "orderTotal",
      label: "Totale ordine",
      type: "number",
      operators: ["gt", "gte", "lt", "lte"],
    },
  ],
};

export const OPERATOR_LABELS: Record<AutomationConditionOperator, string> = {
  eq: "è uguale a",
  neq: "è diverso da",
  gt: "è maggiore di",
  lt: "è minore di",
  gte: "è maggiore o uguale a",
  lte: "è minore o uguale a",
};

export interface ActionParamField {
  key: string;
  label: string;
  type: "number" | "text" | "select";
  options?: { value: string; label: string }[];
  suffix?: string;
  optional?: boolean;
  placeholder?: string;
}

export const ACTION_LABELS: Record<AutomationActionType, string> = {
  adjust_price: "Adegua prezzo",
  pause_listing: "Metti in pausa inserzione",
  reorder_stock: "Riordina scorte",
  send_notification: "Invia notifica",
};

export const ACTION_DESCRIPTIONS: Record<AutomationActionType, string> = {
  adjust_price: "Modifica il prezzo di listino entro i limiti di sicurezza indicati.",
  pause_listing: "Sospende l'inserzione sul marketplace senza eliminarla.",
  reorder_stock: "Crea una richiesta di riordino al fornitore collegato.",
  send_notification: "Avvisa il team senza modificare nulla sul prodotto.",
};

export const ACTION_PARAM_FIELDS: Record<AutomationActionType, ActionParamField[]> = {
  adjust_price: [
    {
      key: "mode",
      label: "Modalità",
      type: "select",
      options: [
        { value: "match_competitor", label: "Allinea al prezzo del competitor" },
        { value: "decrease_percent", label: "Riduci del %" },
        { value: "increase_percent", label: "Aumenta del %" },
      ],
    },
    { key: "value", label: "Valore", type: "number", optional: true, suffix: "%" },
    { key: "minPrice", label: "Prezzo minimo di sicurezza", type: "number", optional: true, suffix: "€" },
    { key: "maxPrice", label: "Prezzo massimo di sicurezza", type: "number", optional: true, suffix: "€" },
  ],
  pause_listing: [],
  reorder_stock: [
    { key: "quantity", label: "Quantità da riordinare", type: "number" },
  ],
  send_notification: [
    {
      key: "channel",
      label: "Canale",
      type: "select",
      options: [
        { value: "in_app", label: "Notifica in-app" },
        { value: "email", label: "Email" },
      ],
    },
    { key: "message", label: "Messaggio", type: "text", placeholder: "Testo della notifica…" },
  ],
};

export const RUN_STATUS_LABELS: Record<AutomationRunStatus, string> = {
  success: "Completata",
  partial: "Parziale",
  error: "Fallita",
};

export const RUN_STATUS_TONE: Record<AutomationRunStatus, "success" | "warning" | "destructive"> = {
  success: "success",
  partial: "warning",
  error: "destructive",
};

function formatConditionValue(
  field: ConditionFieldOption | undefined,
  value: AutomationCondition["value"],
): string {
  if (value === null) return "nessuno";
  if (field?.options) {
    return field.options.find((o) => o.value === String(value))?.label ?? String(value);
  }
  if (typeof value === "boolean") return value ? "Sì" : "No";
  return String(value);
}

export function summarizeCondition(condition: AutomationCondition, trigger: AutomationTrigger): string {
  const fieldMeta = CONDITION_FIELDS_BY_TRIGGER[trigger].find((f) => f.field === condition.field);
  const label = fieldMeta?.label ?? condition.field;
  const opLabel = OPERATOR_LABELS[condition.operator];
  return `${label} ${opLabel} ${formatConditionValue(fieldMeta, condition.value)}`;
}

export function summarizeAction(action: AutomationAction): string {
  const params = action.params ?? {};
  switch (action.type) {
    case "adjust_price":
      if (params.mode === "match_competitor") return "Allinea il prezzo al competitor";
      if (params.mode === "decrease_percent") return `Riduci il prezzo del ${params.value ?? "?"}%`;
      if (params.mode === "increase_percent") return `Aumenta il prezzo del ${params.value ?? "?"}%`;
      return ACTION_LABELS.adjust_price;
    case "pause_listing":
      return "Metti in pausa l'inserzione";
    case "reorder_stock":
      return `Riordina ${params.quantity ?? "N"} unità`;
    case "send_notification":
      return `Invia notifica${params.channel === "email" ? " via email" : " in-app"}`;
  }
}

export function summarizeScope(scope: AutomationScope): string {
  if (scope.mode === "all") return "Tutti i prodotti attivi";
  const parts: string[] = [];
  if (scope.categories.length) parts.push(scope.categories.join(", "));
  if (scope.tags.length) parts.push(scope.tags.map((t) => `#${t}`).join(", "));
  if (scope.marketplaceIds.length) parts.push(`${scope.marketplaceIds.length} marketplace`);
  if (scope.supplierIds.length) parts.push(`${scope.supplierIds.length} fornitori`);
  return parts.length ? parts.join(" · ") : "Nessun prodotto selezionato";
}

export function summarizeSchedule(rule: {
  trigger: AutomationTrigger;
  schedule?: { frequency: string; timeOfDay?: string; customDescription?: string };
}): string | undefined {
  if (rule.trigger !== "scheduled" || !rule.schedule) return undefined;
  if (rule.schedule.frequency === "hourly") return "Ogni ora";
  if (rule.schedule.frequency === "daily") return `Ogni giorno alle ${rule.schedule.timeOfDay ?? "--:--"}`;
  return rule.schedule.customDescription ?? "Pianificazione personalizzata";
}
