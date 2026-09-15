import type { ProductListItemView } from "@/services/products";

export interface ProductFilters {
  status: "all" | "active" | "draft" | "archived";
  supplierIds: string[];
  categories: string[];
  marketplaceIds: string[];
  tags: string[];
  priceRange: [number, number] | null;
  marginRange: [number, number] | null;
  stockRange: [number, number] | null;
  onlyIssues: boolean;
  lowStockOnly: boolean;
  syncErrorOnly: boolean;
}

export const defaultFilters: ProductFilters = {
  status: "all",
  supplierIds: [],
  categories: [],
  marketplaceIds: [],
  tags: [],
  priceRange: null,
  marginRange: null,
  stockRange: null,
  onlyIssues: false,
  lowStockOnly: false,
  syncErrorOnly: false,
};

export function countActiveAdvancedFilters(filters: ProductFilters): number {
  let count = 0;
  if (filters.supplierIds.length) count += 1;
  if (filters.categories.length) count += 1;
  if (filters.marketplaceIds.length) count += 1;
  if (filters.tags.length) count += 1;
  if (filters.priceRange) count += 1;
  if (filters.marginRange) count += 1;
  if (filters.stockRange) count += 1;
  if (filters.onlyIssues) count += 1;
  return count;
}

export function hasProductIssue(item: ProductListItemView): boolean {
  const lowStock =
    item.inventory?.reorderPoint !== undefined &&
    item.inventory.quantityAvailable <= item.inventory.reorderPoint;
  const missingCost = item.product.cost === undefined;
  return item.syncErrorCount > 0 || lowStock || missingCost;
}

export function matchesFilters(
  item: ProductListItemView,
  filters: ProductFilters,
  query: string,
): boolean {
  const { product, marginPercent, inventory, marketplaceStatuses } = item;

  if (filters.status !== "all" && product.status !== filters.status) return false;

  if (
    filters.supplierIds.length &&
    (!product.supplierId || !filters.supplierIds.includes(product.supplierId))
  )
    return false;

  if (
    filters.categories.length &&
    (!product.category || !filters.categories.includes(product.category))
  )
    return false;

  if (filters.tags.length && !(product.tags ?? []).some((t) => filters.tags.includes(t)))
    return false;

  if (filters.marketplaceIds.length) {
    const listedOnAny = marketplaceStatuses.some(
      (m) => filters.marketplaceIds.includes(m.marketplaceId) && m.listingId,
    );
    if (!listedOnAny) return false;
  }

  if (filters.priceRange) {
    const [min, max] = filters.priceRange;
    if (product.basePrice.amount < min || product.basePrice.amount > max) return false;
  }

  if (filters.marginRange) {
    const [min, max] = filters.marginRange;
    if (marginPercent === undefined || marginPercent < min || marginPercent > max) return false;
  }

  if (filters.stockRange) {
    const [min, max] = filters.stockRange;
    const qty = inventory?.quantityAvailable ?? 0;
    if (qty < min || qty > max) return false;
  }

  if (filters.onlyIssues && !hasProductIssue(item)) return false;

  if (filters.lowStockOnly) {
    const lowStock =
      inventory?.reorderPoint !== undefined && inventory.quantityAvailable <= inventory.reorderPoint;
    if (!lowStock) return false;
  }

  if (filters.syncErrorOnly && item.syncErrorCount === 0) return false;

  const q = query.trim().toLowerCase();
  if (q) {
    const haystack = `${product.title} ${product.sku} ${(product.tags ?? []).join(" ")} ${item.supplierName ?? ""}`.toLowerCase();
    if (!haystack.includes(q)) return false;
  }

  return true;
}
