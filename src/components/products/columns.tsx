import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InlineEditCell } from "@/components/inline-edit-cell";
import { formatMoney, formatPercent, formatRelativeDate } from "@/lib/format";
import type { ProductListItemView } from "@/services/products";
import type { Id, ProductStatus } from "@/types";
import { MarketplaceStatusChip } from "./MarketplaceStatusChip";

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

function marginTone(percent: number | undefined): string {
  if (percent === undefined) return "text-muted-foreground";
  if (percent < 10) return "text-destructive";
  if (percent < 20) return "text-warning-foreground";
  return "text-success";
}

export interface ProductColumnHandlers {
  isSelected: (id: Id) => boolean;
  onToggleSelect: (id: Id) => void;
  headerCheckboxState: boolean | "indeterminate";
  onToggleSelectAll: () => void;
  onCommitPrice: (productId: Id, amount: number) => void;
  onCommitCost: (productId: Id, amount: number) => void;
  onSyncListing: (listingId: Id) => void;
  onPreview: (item: ProductListItemView) => void;
  onDuplicate: (item: ProductListItemView) => void;
  onArchive: (item: ProductListItemView) => void;
  onDelete: (item: ProductListItemView) => void;
}

export function buildProductColumns(
  handlers: ProductColumnHandlers,
): ColumnDef<ProductListItemView>[] {
  return [
    {
      id: "select",
      size: 36,
      enableResizing: false,
      enableSorting: false,
      meta: { draggable: false, resizable: false },
      header: () => (
        <Checkbox
          checked={handlers.headerCheckboxState}
          onCheckedChange={() => handlers.onToggleSelectAll()}
          aria-label="Seleziona tutti"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={handlers.isSelected(row.original.product.id)}
          onCheckedChange={() => handlers.onToggleSelect(row.original.product.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Seleziona ${row.original.product.title}`}
        />
      ),
    },
    {
      id: "product",
      accessorFn: (row) => row.product.title,
      size: 280,
      minSize: 180,
      meta: { label: "Prodotto" },
      header: "Prodotto",
      cell: ({ row }) => {
        const { product } = row.original;
        return (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{product.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {product.sku}
              {product.category ? ` · ${product.category}` : ""}
            </p>
          </div>
        );
      },
    },
    {
      id: "supplier",
      accessorFn: (row) => row.supplierName ?? "",
      size: 160,
      minSize: 100,
      meta: { label: "Fornitore" },
      header: "Fornitore",
      cell: ({ row }) => (
        <span className="truncate text-muted-foreground">{row.original.supplierName ?? "—"}</span>
      ),
    },
    {
      id: "cost",
      accessorFn: (row) => row.product.cost?.amount ?? -1,
      size: 100,
      minSize: 80,
      meta: { label: "Costo", align: "right" },
      header: "Costo",
      cell: ({ row }) => {
        const { product } = row.original;
        if (!product.cost) {
          return <span className="text-xs text-muted-foreground">mancante</span>;
        }
        return (
          <InlineEditCell
            value={product.cost.amount}
            formatDisplay={(v) => formatMoney({ amount: v, currency: product.cost!.currency })}
            onCommit={(v) => handlers.onCommitCost(product.id, v)}
          />
        );
      },
    },
    {
      id: "price",
      accessorFn: (row) => row.product.basePrice.amount,
      size: 100,
      minSize: 80,
      meta: { label: "Prezzo", align: "right" },
      header: "Prezzo",
      cell: ({ row }) => {
        const { product } = row.original;
        return (
          <InlineEditCell
            value={product.basePrice.amount}
            formatDisplay={(v) => formatMoney({ amount: v, currency: product.basePrice.currency })}
            onCommit={(v) => handlers.onCommitPrice(product.id, v)}
          />
        );
      },
    },
    {
      id: "margin",
      accessorFn: (row) => row.marginPercent ?? -1,
      size: 90,
      minSize: 70,
      meta: { label: "Margine", align: "right" },
      header: "Margine",
      cell: ({ row }) => {
        const { marginPercent } = row.original;
        return (
          <span className={marginTone(marginPercent)}>
            {marginPercent !== undefined ? formatPercent(marginPercent) : "—"}
          </span>
        );
      },
    },
    {
      id: "stock",
      accessorFn: (row) => row.inventory?.quantityAvailable ?? -1,
      size: 90,
      minSize: 70,
      meta: { label: "Scorte", align: "right" },
      header: "Scorte",
      cell: ({ row }) => {
        const { inventory } = row.original;
        const lowStock =
          inventory?.reorderPoint !== undefined && inventory.quantityAvailable <= inventory.reorderPoint;
        return (
          <span className={lowStock ? "font-medium text-warning-foreground" : "text-foreground"}>
            {inventory?.quantityAvailable ?? "—"}
          </span>
        );
      },
    },
    {
      id: "marketplaces",
      size: 190,
      minSize: 120,
      meta: { label: "Marketplace" },
      header: "Marketplace",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {row.original.marketplaceStatuses.map((status) => (
            <MarketplaceStatusChip
              key={status.marketplaceId}
              status={status}
              onSync={handlers.onSyncListing}
            />
          ))}
        </div>
      ),
    },
    {
      id: "status",
      accessorFn: (row) => row.product.status,
      size: 110,
      minSize: 90,
      meta: { label: "Stato" },
      header: "Stato",
      cell: ({ row }) => {
        const status = row.original.product.status;
        return <Badge variant={statusVariant[status]}>{statusLabel[status]}</Badge>;
      },
    },
    {
      id: "updatedAt",
      accessorFn: (row) => row.product.updatedAt,
      size: 110,
      minSize: 90,
      meta: { label: "Modificato" },
      header: "Modificato",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {formatRelativeDate(row.original.product.updatedAt)}
        </span>
      ),
    },
    {
      id: "actions",
      size: 44,
      enableResizing: false,
      enableSorting: false,
      meta: { draggable: false, resizable: false },
      header: "",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => e.stopPropagation()}
              aria-label="Azioni prodotto"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => handlers.onPreview(row.original)}>
              Anteprima
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handlers.onDuplicate(row.original)}>
              Duplica
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handlers.onArchive(row.original)}>
              Archivia
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => handlers.onDelete(row.original)}>
              Elimina
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];
}

export const DEFAULT_PRODUCT_COLUMN_ORDER = [
  "product",
  "supplier",
  "cost",
  "price",
  "margin",
  "stock",
  "marketplaces",
  "status",
  "updatedAt",
];

export const PRODUCT_COLUMN_LABELS = [
  { id: "product", label: "Prodotto" },
  { id: "supplier", label: "Fornitore" },
  { id: "cost", label: "Costo" },
  { id: "price", label: "Prezzo" },
  { id: "margin", label: "Margine" },
  { id: "stock", label: "Scorte" },
  { id: "marketplaces", label: "Marketplace" },
  { id: "status", label: "Stato" },
  { id: "updatedAt", label: "Modificato" },
];
