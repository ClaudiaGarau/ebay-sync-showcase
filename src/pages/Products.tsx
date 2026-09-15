import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  Boxes,
  Download,
  Layers,
  Package,
  PackageSearch,
  Plus,
  RefreshCw,
  Upload,
} from "lucide-react";
import type { SortingState, VisibilityState } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TableToolbar } from "@/components/table-toolbar";
import { DataTable, ColumnManagerPopover, useRowSelection, useSavedViews } from "@/components/data-table";
import type { ColumnLayoutState, SavedView } from "@/components/data-table";
import { BulkActionBar } from "@/components/products/BulkActionBar";
import { FilterPanel } from "@/components/products/FilterPanel";
import { SavedViewsBar } from "@/components/products/SavedViewsBar";
import { ProductDetailSheet } from "@/components/products/ProductDetailSheet";
import {
  buildProductColumns,
  DEFAULT_PRODUCT_COLUMN_ORDER,
  PRODUCT_COLUMN_LABELS,
} from "@/components/products/columns";
import {
  defaultFilters,
  matchesFilters,
  type ProductFilters,
} from "@/components/products/filters";
import {
  availableMarketplaces,
  bulkAddTags,
  bulkAssignSupplier,
  bulkDelete,
  bulkSetMarginTarget,
  bulkSyncListings,
  bulkUpdatePrice,
  bulkUpdateStatus,
  duplicateProducts,
  getProductStats,
  getProducts,
  restoreProducts,
  syncListing,
  updateProductCost,
  type DeletedProductsSnapshot,
  type ProductListItemView,
  type ProductStats,
} from "@/services/products";
import { getSuppliers } from "@/services/suppliers";
import { formatMoney } from "@/lib/format";

const SAVED_VIEWS_KEY = "ebaysync.products.savedViews";

const defaultColumnLayout: ColumnLayoutState = {
  columnVisibility: {},
  columnOrder: DEFAULT_PRODUCT_COLUMN_ORDER,
  columnSizing: {},
  sorting: [],
};

function exportCsv(rows: ProductListItemView[]) {
  const header = ["Titolo", "SKU", "Categoria", "Fornitore", "Prezzo", "Costo", "Margine %", "Scorte", "Stato"];
  const lines = rows.map((r) =>
    [
      r.product.title,
      r.product.sku,
      r.product.category ?? "",
      r.supplierName ?? "",
      r.product.basePrice.amount,
      r.product.cost?.amount ?? "",
      r.marginPercent !== undefined ? r.marginPercent.toFixed(1) : "",
      r.inventory?.quantityAvailable ?? "",
      r.product.status,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `prodotti-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Products() {
  const navigate = useNavigate();

  const [items, setItems] = useState<ProductListItemView[] | null>(null);
  const [stats, setStats] = useState<ProductStats | null>(null);
  const [suppliers, setSuppliers] = useState<{ id: string; label: string }[]>([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ProductFilters>(defaultFilters);
  const [busy, setBusy] = useState(false);

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    defaultColumnLayout.columnVisibility,
  );
  const [columnOrder, setColumnOrder] = useState<string[]>(defaultColumnLayout.columnOrder);
  const [columnSizing, setColumnSizing] = useState<Record<string, number>>(
    defaultColumnLayout.columnSizing,
  );
  const [sorting, setSorting] = useState<SortingState>(defaultColumnLayout.sorting);
  const [activeSavedViewId, setActiveSavedViewId] = useState<string | undefined>();

  const [detailItem, setDetailItem] = useState<ProductListItemView | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const selection = useRowSelection();
  const savedViewsApi = useSavedViews<ProductFilters>(SAVED_VIEWS_KEY);

  async function reload() {
    const [productsData, statsData] = await Promise.all([getProducts(), getProductStats()]);
    setItems(productsData);
    setStats(statsData);
  }

  useEffect(() => {
    let cancelled = false;

    Promise.all([getProducts(), getProductStats(), getSuppliers()]).then(
      ([productsData, statsData, suppliersData]) => {
        if (cancelled) return;
        setItems(productsData);
        setStats(statsData);
        setSuppliers(suppliersData.map((s) => ({ id: s.supplier.id, label: s.supplier.name })));
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    selection.clear();
    setActiveSavedViewId(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, query]);

  useEffect(() => {
    if (!detailItem || !items) return;
    const fresh = items.find((i) => i.product.id === detailItem.product.id);
    if (fresh && fresh !== detailItem) setDetailItem(fresh);
    if (!fresh) setDetailOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return null;
    return items.filter((item) => matchesFilters(item, filters, query));
  }, [items, filters, query]);

  const filteredIds = useMemo(() => filtered?.map((i) => i.product.id) ?? [], [filtered]);
  const selectedIds = useMemo(
    () => filteredIds.filter((id) => selection.isSelected(id)),
    [filteredIds, selection],
  );

  const categories = useMemo(() => {
    if (!items) return [];
    return Array.from(new Set(items.map((i) => i.product.category).filter((c): c is string => !!c)));
  }, [items]);

  const tags = useMemo(() => {
    if (!items) return [];
    return Array.from(new Set(items.flatMap((i) => i.product.tags ?? [])));
  }, [items]);

  const marketplaces = useMemo(
    () => availableMarketplaces().map((m) => ({ id: m.id, label: m.name })),
    [],
  );

  const priceBounds: [number, number] = useMemo(() => {
    if (!items || items.length === 0) return [0, 100];
    const amounts = items.map((i) => i.product.basePrice.amount);
    return [0, Math.ceil(Math.max(...amounts) * 1.1)];
  }, [items]);

  const marginBounds: [number, number] = [0, 100];

  const stockBounds: [number, number] = useMemo(() => {
    if (!items || items.length === 0) return [0, 100];
    const qty = items.map((i) => i.inventory?.quantityAvailable ?? 0);
    return [0, Math.ceil(Math.max(...qty) * 1.1) || 100];
  }, [items]);

  async function runBulk(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      await reload();
      selection.clear();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    const ids = selectedIds;
    setBusy(true);
    let snapshot: DeletedProductsSnapshot;
    try {
      snapshot = await bulkDelete(ids);
      await reload();
      selection.clear();
    } finally {
      setBusy(false);
    }
    toast.success(`${ids.length} prodotti eliminati`, {
      action: {
        label: "Annulla",
        onClick: async () => {
          await restoreProducts(snapshot);
          await reload();
        },
      },
    });
  }

  const headerCheckboxState: boolean | "indeterminate" =
    filteredIds.length === 0
      ? false
      : selectedIds.length === filteredIds.length
        ? true
        : selectedIds.length === 0
          ? false
          : "indeterminate";

  function toggleSelectAll() {
    if (headerCheckboxState === true) selection.deselectIds(filteredIds);
    else selection.selectIds(filteredIds);
  }

  const columns = buildProductColumns({
    isSelected: selection.isSelected,
    onToggleSelect: selection.toggle,
    headerCheckboxState,
    onToggleSelectAll: toggleSelectAll,
    onCommitPrice: (productId, amount) =>
      runBulk(() => bulkUpdatePrice([productId], { mode: "set", value: amount })),
    onCommitCost: (productId, amount) => runBulk(() => updateProductCost(productId, amount)),
    onSyncListing: (listingId) => runBulk(() => syncListing(listingId)),
    onPreview: (item) => {
      setDetailItem(item);
      setDetailOpen(true);
    },
    onDuplicate: (item) => runBulk(() => duplicateProducts([item.product.id])),
    onArchive: (item) => runBulk(() => bulkUpdateStatus([item.product.id], "archived")),
    onDelete: (item) =>
      runBulk(async () => {
        const snapshot = await bulkDelete([item.product.id]);
        toast.success("Prodotto eliminato", {
          action: {
            label: "Annulla",
            onClick: async () => {
              await restoreProducts(snapshot);
              await reload();
            },
          },
        });
      }),
  });

  function saveCurrentView(name: string) {
    const view = savedViewsApi.saveView(name, filters, {
      columnVisibility,
      columnOrder,
      columnSizing,
      sorting,
    });
    setActiveSavedViewId(view.id);
    toast.success(`Vista "${name}" salvata`);
  }

  function applySavedView(view: SavedView<ProductFilters>) {
    setFilters(view.filters);
    setColumnVisibility(view.columnLayout.columnVisibility);
    setColumnOrder(view.columnLayout.columnOrder);
    setColumnSizing(view.columnLayout.columnSizing);
    setSorting(view.columnLayout.sorting);
    setActiveSavedViewId(view.id);
  }

  function resetColumnLayout() {
    setColumnVisibility(defaultColumnLayout.columnVisibility);
    setColumnOrder(defaultColumnLayout.columnOrder);
    setColumnSizing(defaultColumnLayout.columnSizing);
  }

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        title="Prodotti"
        description="Catalogo prodotti collegato a fornitori, scorte e inserzioni."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/import")}>
              <Upload className="size-3.5" />
              Importa
            </Button>
            <Button
              onClick={() =>
                toast("Creazione manuale in arrivo", {
                  description: "Per ora usa Importa per aggiungere prodotti al catalogo.",
                })
              }
            >
              <Plus className="size-3.5" />
              Aggiungi prodotto
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <MetricCard
          icon={Package}
          label="Totale prodotti"
          value={stats?.total.toString()}
          hint={stats ? `${stats.active} attivi · ${stats.draft} bozze` : ""}
        />
        <MetricCard
          icon={Layers}
          label="Archiviati"
          value={stats?.archived.toString()}
          hint="Non più in vendita"
          onClick={() => setFilters((f) => ({ ...f, status: f.status === "archived" ? "all" : "archived" }))}
          active={filters.status === "archived"}
        />
        <MetricCard
          icon={AlertTriangle}
          label="Scorte basse"
          value={stats?.lowStockCount.toString()}
          hint="Sotto la soglia di riordino"
          tone={stats && stats.lowStockCount > 0 ? "warning" : undefined}
          onClick={() => setFilters((f) => ({ ...f, lowStockOnly: !f.lowStockOnly }))}
          active={filters.lowStockOnly}
        />
        <MetricCard
          icon={RefreshCw}
          label="Errori di sync"
          value={stats?.syncErrorCount.toString()}
          hint="Inserzioni da correggere"
          tone={stats && stats.syncErrorCount > 0 ? "warning" : undefined}
          onClick={() => setFilters((f) => ({ ...f, syncErrorOnly: !f.syncErrorOnly }))}
          active={filters.syncErrorOnly}
        />
        <MetricCard
          icon={Boxes}
          label="Valore magazzino"
          value={stats ? formatMoney(stats.inventoryValue) : undefined}
          hint="Basato sul costo unitario"
        />
      </div>

      <Card className="overflow-hidden p-0">
        <CardHeader className="gap-3 px-5 pt-5 pb-0">
          <div className="flex flex-col gap-3">
            <SavedViewsBar
              statusFilter={filters.status}
              onStatusFilterChange={(status) => setFilters((f) => ({ ...f, status }))}
              savedViews={savedViewsApi.views}
              activeSavedViewId={activeSavedViewId}
              onApplySavedView={applySavedView}
              onSaveCurrentView={saveCurrentView}
              onDeleteSavedView={savedViewsApi.deleteView}
            />
            <TableToolbar
              search={{ value: query, onChange: setQuery, placeholder: "Cerca per nome, SKU o tag…" }}
              filters={
                <div className="flex flex-wrap items-center gap-2">
                  <FilterPanel
                    filters={filters}
                    onChange={setFilters}
                    suppliers={suppliers}
                    categories={categories}
                    marketplaces={marketplaces}
                    tags={tags}
                    priceBounds={priceBounds}
                    marginBounds={marginBounds}
                    stockBounds={stockBounds}
                  />
                  <ColumnManagerPopover
                    columns={PRODUCT_COLUMN_LABELS}
                    columnVisibility={columnVisibility}
                    onColumnVisibilityChange={setColumnVisibility}
                    columnOrder={columnOrder}
                    onColumnOrderChange={setColumnOrder}
                    onReset={resetColumnLayout}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => filtered && exportCsv(filtered)}
                  >
                    <Download className="size-3.5" />
                    Esporta
                  </Button>
                </div>
              }
            />
          </div>
        </CardHeader>

        <BulkActionBar
          selectedCount={selectedIds.length}
          onClear={selection.clear}
          suppliers={suppliers}
          busy={busy}
          onChangeStatus={(status) => runBulk(() => bulkUpdateStatus(selectedIds, status))}
          onPriceChange={(change) => runBulk(() => bulkUpdatePrice(selectedIds, change))}
          onMarginTarget={(pct) => runBulk(() => bulkSetMarginTarget(selectedIds, pct))}
          onAssignSupplier={(supplierId) => runBulk(() => bulkAssignSupplier(selectedIds, supplierId))}
          onAddTags={(tagsToAdd) => runBulk(() => bulkAddTags(selectedIds, tagsToAdd))}
          onSync={() => runBulk(() => bulkSyncListings(selectedIds))}
          onDuplicate={() => runBulk(() => duplicateProducts(selectedIds))}
          onExportCsv={() => exportCsv(filtered?.filter((i) => selectedIds.includes(i.product.id)) ?? [])}
          onArchive={() => runBulk(() => bulkUpdateStatus(selectedIds, "archived"))}
          onDelete={handleDelete}
        />

        <CardContent className="p-0">
          {!filtered ? (
            <div className="space-y-2 p-5">
              <div className="h-8 w-full animate-pulse rounded-md bg-muted" />
              <div className="h-8 w-full animate-pulse rounded-md bg-muted" />
              <div className="h-8 w-full animate-pulse rounded-md bg-muted" />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={filtered}
              getRowId={(row) => row.product.id}
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={setColumnVisibility}
              columnOrder={columnOrder}
              onColumnOrderChange={setColumnOrder}
              columnSizing={columnSizing}
              onColumnSizingChange={setColumnSizing}
              sorting={sorting}
              onSortingChange={setSorting}
              pinnedLeftColumnIds={["select"]}
              pinnedRightColumnIds={["actions"]}
              className="h-[60vh]"
              onRowClick={(row) => {
                setDetailItem(row);
                setDetailOpen(true);
              }}
              isRowSelected={(row) => selection.isSelected(row.product.id)}
              emptyState={
                <EmptyState
                  icon={PackageSearch}
                  title="Nessun prodotto trovato"
                  description="Prova a modificare la ricerca o i filtri attivi."
                  className="py-16"
                />
              }
            />
          )}
        </CardContent>
      </Card>

      <ProductDetailSheet
        item={detailItem}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdatePrice={(productId, amount) =>
          runBulk(() => bulkUpdatePrice([productId], { mode: "set", value: amount }))
        }
        onUpdateCost={(productId, amount) => runBulk(() => updateProductCost(productId, amount))}
        onSyncListing={(listingId) => runBulk(() => syncListing(listingId))}
        onOpenFullPage={(productId) => navigate(`/products/${productId}`)}
      />
    </div>
  );
}
