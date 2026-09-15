import { ExternalLink, RefreshCw, SquareArrowOutUpRight } from "lucide-react";
import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineEditCell } from "@/components/inline-edit-cell";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { formatMoney, formatPercent, formatRelativeDate } from "@/lib/format";
import type { ProductListItemView } from "@/services/products";
import type { Id, ProductStatus } from "@/types";

const statusVariant: Record<ProductStatus, "success" | "secondary" | "outline"> = {
  active: "success",
  draft: "secondary",
  archived: "outline",
};

const statusLabel: Record<ProductStatus, string> = {
  active: "Attivo",
  draft: "Bozza",
  archived: "Archiviato",
};

const listingDotClass: Record<string, string> = {
  active: "bg-success",
  paused: "bg-warning",
  error: "bg-destructive",
  draft: "bg-muted-foreground",
  ended: "bg-muted-foreground",
  none: "bg-border",
};

const listingStatusLabel: Record<string, string> = {
  active: "Attivo",
  paused: "In pausa",
  error: "Errore",
  draft: "Bozza",
  ended: "Terminato",
  none: "Non pubblicato",
};

interface ProductDetailSheetProps {
  item: ProductListItemView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdatePrice: (productId: Id, amount: number) => void;
  onUpdateCost: (productId: Id, amount: number) => void;
  onSyncListing: (listingId: Id) => void;
  onOpenFullPage: (productId: Id) => void;
}

export function ProductDetailSheet({
  item,
  open,
  onOpenChange,
  onUpdatePrice,
  onUpdateCost,
  onSyncListing,
  onOpenFullPage,
}: ProductDetailSheetProps) {
  if (!item) return null;
  const { product, supplierName, inventory, marginPercent, marketplaceStatuses } = item;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle>{product.title}</SheetTitle>
            <Badge variant={statusVariant[product.status]}>{statusLabel[product.status]}</Badge>
          </div>
          <SheetDescription>
            {product.sku}
            {product.category ? ` · ${product.category}` : ""}
            {supplierName ? ` · ${supplierName}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Prezzo</p>
              <InlineEditCell
                value={product.basePrice.amount}
                formatDisplay={(v) => formatMoney({ amount: v, currency: product.basePrice.currency })}
                onCommit={(v) => onUpdatePrice(product.id, v)}
                align="left"
                className="text-base font-semibold text-foreground"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Costo</p>
              <InlineEditCell
                value={product.cost?.amount ?? 0}
                formatDisplay={(v) =>
                  product.cost ? formatMoney({ amount: v, currency: product.cost.currency }) : "—"
                }
                onCommit={(v) => onUpdateCost(product.id, v)}
                align="left"
                className="text-base font-semibold text-foreground"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Margine</p>
              <p className="text-base font-semibold text-foreground">
                {marginPercent !== undefined ? formatPercent(marginPercent) : "—"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Scorte disponibili</p>
              <p className="font-medium text-foreground">{inventory?.quantityAvailable ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Magazzino</p>
              <p className="font-medium text-foreground">{inventory?.warehouse ?? "—"}</p>
            </div>
          </div>

          {product.tags && product.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {product.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <Separator />

          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">Marketplace</p>
            <div className="space-y-1.5">
              {marketplaceStatuses.map((status) => {
                const key = status.listingStatus ?? "none";
                return (
                  <div
                    key={status.marketplaceId}
                    className="flex items-center gap-2.5 rounded-lg border border-border p-2"
                  >
                    <Avatar size="sm">
                      <AvatarFallback className="text-[10px] font-medium">
                        {status.marketplaceName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                      <AvatarBadge className={listingDotClass[key]} />
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {status.marketplaceName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {status.syncError
                          ? status.syncError
                          : status.lastSyncedAt
                            ? `${listingStatusLabel[key]} · sincronizzato ${formatRelativeDate(status.lastSyncedAt)}`
                            : listingStatusLabel[key]}
                      </p>
                    </div>
                    {status.listingId && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Risincronizza"
                        onClick={() => onSyncListing(status.listingId!)}
                      >
                        <RefreshCw className="size-3.5" />
                      </Button>
                    )}
                    {status.url && (
                      <Button size="icon-sm" variant="ghost" asChild>
                        <a href={status.url} target="_blank" rel="noreferrer" aria-label="Apri sul marketplace">
                          <ExternalLink className="size-3.5" />
                        </a>
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" className="w-full" onClick={() => onOpenFullPage(product.id)}>
            <SquareArrowOutUpRight className="size-3.5" />
            Apri scheda completa
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
