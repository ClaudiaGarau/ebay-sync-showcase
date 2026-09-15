import type { Money } from "@/types";

export function formatMoney({ amount, currency }: Money): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatRelativeDate(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60_000);

  if (Math.abs(diffMin) < 60) return `${diffMin} min fa`;

  const diffHours = Math.round(diffMin / 60);
  if (Math.abs(diffHours) < 24) return `${diffHours} h fa`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} g fa`;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatPercent(value: number, decimals = 0): string {
  return new Intl.NumberFormat("it-IT", {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
}
