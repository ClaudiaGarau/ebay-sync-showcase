import { ExternalLink, RefreshCw } from "lucide-react";
import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatMoney, formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProductMarketplaceStatus } from "@/services/products";

const dotClass: Record<"active" | "paused" | "error" | "draft" | "ended" | "none", string> = {
  active: "bg-success",
  paused: "bg-warning",
  error: "bg-destructive",
  draft: "bg-muted-foreground",
  ended: "bg-muted-foreground",
  none: "bg-border",
};

const statusLabel: Record<"active" | "paused" | "error" | "draft" | "ended" | "none", string> = {
  active: "Attivo",
  paused: "In pausa",
  error: "Errore",
  draft: "Bozza",
  ended: "Terminato",
  none: "Non pubblicato",
};

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

export function MarketplaceStatusChip({
  status,
  onSync,
}: {
  status: ProductMarketplaceStatus;
  onSync?: (listingId: string) => void;
}) {
  const key = status.listingStatus ?? "none";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="rounded-full outline-none transition-transform focus-visible:ring-3 focus-visible:ring-ring/50 hover:scale-105"
          aria-label={`${status.marketplaceName}: ${statusLabel[key]}`}
        >
          <Avatar size="sm" className={cn(key === "none" && "opacity-40")}>
            <AvatarFallback className="text-[10px] font-medium">
              {initials(status.marketplaceName)}
            </AvatarFallback>
            <AvatarBadge className={dotClass[key]} />
          </Avatar>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">{status.marketplaceName}</p>
          <span className="text-xs text-muted-foreground">{statusLabel[key]}</span>
        </div>

        {status.listingId ? (
          <>
            <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
              {status.price && <span>Prezzo: {formatMoney(status.price)}</span>}
              {status.quantity !== undefined && <span>Qtà: {status.quantity}</span>}
            </div>
            {status.syncError ? (
              <p className="rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
                {status.syncError}
              </p>
            ) : status.lastSyncedAt ? (
              <p className="text-xs text-muted-foreground">
                Sincronizzato {formatRelativeDate(status.lastSyncedAt)}
              </p>
            ) : null}
            <div className="flex gap-1.5">
              {onSync && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => onSync(status.listingId!)}
                >
                  <RefreshCw className="size-3.5" />
                  Risincronizza
                </Button>
              )}
              {status.url && (
                <Button size="icon-sm" variant="outline" asChild>
                  <a href={status.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-3.5" />
                  </a>
                </Button>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Prodotto non ancora pubblicato su questo marketplace.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
