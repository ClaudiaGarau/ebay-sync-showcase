import { inventory, listings, marketplaces, products, suppliers } from "@/mocks";
import type {
  Id,
  Inventory,
  Listing,
  ListingStatus,
  Marketplace,
  MarketplaceType,
  Money,
  Product,
  ProductStatus,
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

function marginPercent(product: Product): number | undefined {
  if (!product.cost || product.basePrice.amount <= 0) return undefined;
  return (
    ((product.basePrice.amount - product.cost.amount) / product.basePrice.amount) *
    100
  );
}

export interface ProductMarketplaceStatus {
  marketplaceId: Id;
  marketplaceName: string;
  marketplaceType: MarketplaceType;
  listingId?: Id;
  listingStatus?: ListingStatus;
  price?: Money;
  quantity?: number;
  lastSyncedAt?: string;
  syncError?: string;
  url?: string;
}

function marketplaceStatusesFor(productId: Id): ProductMarketplaceStatus[] {
  return marketplaces.map((marketplace) => {
    const listing = listings.find(
      (l) => l.productId === productId && l.marketplaceId === marketplace.id,
    );

    return {
      marketplaceId: marketplace.id,
      marketplaceName: marketplace.name,
      marketplaceType: marketplace.type,
      listingId: listing?.id,
      listingStatus: listing?.status,
      price: listing?.price,
      quantity: listing?.quantity,
      lastSyncedAt: listing?.lastSyncedAt,
      syncError: listing?.syncError,
      url: listing?.url,
    };
  });
}

export interface ProductListItemView {
  product: Product;
  supplierName?: string;
  inventory?: Inventory;
  listingCount: number;
  activeListingCount: number;
  marginPercent?: number;
  marketplaceStatuses: ProductMarketplaceStatus[];
  syncErrorCount: number;
}

function toListItemView(product: Product): ProductListItemView {
  const productListings = listings.filter((l) => l.productId === product.id);
  const marketplaceStatuses = marketplaceStatusesFor(product.id);

  return {
    product,
    supplierName: suppliers.find((s) => s.id === product.supplierId)?.name,
    inventory: inventory.find((i) => i.productId === product.id),
    listingCount: productListings.length,
    activeListingCount: productListings.filter((l) => l.status === "active")
      .length,
    marginPercent: marginPercent(product),
    marketplaceStatuses,
    syncErrorCount: marketplaceStatuses.filter((m) => m.syncError).length,
  };
}

export async function getProducts(): Promise<ProductListItemView[]> {
  await simulateLatency();
  return products.map(toListItemView);
}

export interface ProductStats {
  total: number;
  active: number;
  draft: number;
  archived: number;
  lowStockCount: number;
  syncErrorCount: number;
  inventoryValue: Money;
}

export async function getProductStats(): Promise<ProductStats> {
  await simulateLatency();

  const byStatus = (status: ProductStatus) =>
    products.filter((p) => p.status === status).length;

  const lowStockCount = inventory.filter(
    (i) => i.reorderPoint !== undefined && i.quantityAvailable <= i.reorderPoint,
  ).length;

  const inventoryValue = products.reduce((total, product) => {
    const productInventory = inventory.find((i) => i.productId === product.id);
    const unitCost = product.cost?.amount ?? product.basePrice.amount;
    return total + unitCost * (productInventory?.quantityAvailable ?? 0);
  }, 0);

  const productIdsWithSyncError = new Set(
    listings.filter((l) => l.syncError).map((l) => l.productId),
  );

  return {
    total: products.length,
    active: byStatus("active"),
    draft: byStatus("draft"),
    archived: byStatus("archived"),
    lowStockCount,
    syncErrorCount: productIdsWithSyncError.size,
    inventoryValue: { amount: inventoryValue, currency: "EUR" },
  };
}

function requireProducts(productIds: Id[]): Product[] {
  const ids = new Set(productIds);
  return products.filter((p) => ids.has(p.id));
}

export async function bulkUpdateStatus(
  productIds: Id[],
  status: ProductStatus,
): Promise<void> {
  await simulateLatency();
  for (const product of requireProducts(productIds)) {
    product.status = status;
    product.updatedAt = nowIso();
  }
}

export type PriceChange =
  | { mode: "set"; value: number }
  | { mode: "increase_amount" | "decrease_amount"; value: number }
  | { mode: "increase_percent" | "decrease_percent"; value: number };

function applyPriceChange(currentAmount: number, change: PriceChange): number {
  switch (change.mode) {
    case "set":
      return change.value;
    case "increase_amount":
      return currentAmount + change.value;
    case "decrease_amount":
      return Math.max(0, currentAmount - change.value);
    case "increase_percent":
      return currentAmount * (1 + change.value / 100);
    case "decrease_percent":
      return Math.max(0, currentAmount * (1 - change.value / 100));
  }
}

export async function updateProductCost(productId: Id, amount: number): Promise<void> {
  await simulateLatency();
  const product = products.find((p) => p.id === productId);
  if (!product) return;
  const currency = product.cost?.currency ?? product.basePrice.currency;
  product.cost = { amount, currency };
  product.updatedAt = nowIso();
}

export async function bulkUpdatePrice(
  productIds: Id[],
  change: PriceChange,
): Promise<void> {
  await simulateLatency();
  for (const product of requireProducts(productIds)) {
    const rounded = Math.round(applyPriceChange(product.basePrice.amount, change) * 100) / 100;
    product.basePrice = { ...product.basePrice, amount: rounded };
    product.updatedAt = nowIso();
  }
}

export async function bulkSetMarginTarget(
  productIds: Id[],
  targetMarginPercent: number,
): Promise<void> {
  await simulateLatency();
  for (const product of requireProducts(productIds)) {
    if (!product.cost || targetMarginPercent >= 100) continue;
    const price = product.cost.amount / (1 - targetMarginPercent / 100);
    product.basePrice = { ...product.basePrice, amount: Math.round(price * 100) / 100 };
    product.updatedAt = nowIso();
  }
}

export async function bulkAssignSupplier(
  productIds: Id[],
  supplierId: Id | undefined,
): Promise<void> {
  await simulateLatency();
  for (const product of requireProducts(productIds)) {
    product.supplierId = supplierId;
    product.updatedAt = nowIso();
  }
}

export async function bulkAddTags(productIds: Id[], tags: string[]): Promise<void> {
  await simulateLatency();
  for (const product of requireProducts(productIds)) {
    const existing = new Set(product.tags ?? []);
    tags.forEach((t) => existing.add(t));
    product.tags = Array.from(existing);
    product.updatedAt = nowIso();
  }
}

export async function bulkRemoveTags(productIds: Id[], tags: string[]): Promise<void> {
  await simulateLatency();
  const toRemove = new Set(tags);
  for (const product of requireProducts(productIds)) {
    product.tags = (product.tags ?? []).filter((t) => !toRemove.has(t));
    product.updatedAt = nowIso();
  }
}

export interface DeletedProductsSnapshot {
  products: Product[];
  listings: Listing[];
  inventory: Inventory[];
}

export async function bulkDelete(productIds: Id[]): Promise<DeletedProductsSnapshot> {
  await simulateLatency();
  const ids = new Set(productIds);

  const removedProducts = products.filter((p) => ids.has(p.id));
  const removedListings = listings.filter((l) => ids.has(l.productId));
  const removedInventory = inventory.filter((i) => ids.has(i.productId));

  removedProducts.forEach((p) => products.splice(products.indexOf(p), 1));
  removedListings.forEach((l) => listings.splice(listings.indexOf(l), 1));
  removedInventory.forEach((i) => inventory.splice(inventory.indexOf(i), 1));

  return {
    products: removedProducts,
    listings: removedListings,
    inventory: removedInventory,
  };
}

export async function restoreProducts(
  snapshot: DeletedProductsSnapshot,
): Promise<void> {
  await simulateLatency(0);
  products.push(...snapshot.products);
  listings.push(...snapshot.listings);
  inventory.push(...snapshot.inventory);
}

export async function syncListing(listingId: Id): Promise<void> {
  await simulateLatency(500);
  const listing = listings.find((l) => l.id === listingId);
  if (!listing) return;
  listing.status = "active";
  listing.syncError = undefined;
  listing.lastSyncedAt = nowIso();
}

export async function syncProductListings(productId: Id): Promise<void> {
  await simulateLatency(500);
  for (const listing of listings.filter((l) => l.productId === productId)) {
    listing.status = listing.status === "ended" ? "ended" : "active";
    listing.syncError = undefined;
    listing.lastSyncedAt = nowIso();
  }
}

export async function bulkSyncListings(productIds: Id[]): Promise<void> {
  await simulateLatency(600);
  const ids = new Set(productIds);
  for (const listing of listings.filter((l) => ids.has(l.productId))) {
    listing.status = listing.status === "ended" ? "ended" : "active";
    listing.syncError = undefined;
    listing.lastSyncedAt = nowIso();
  }
}

export function availableMarketplaces(): Marketplace[] {
  return marketplaces;
}

let duplicateCounter = 0;

export async function duplicateProducts(productIds: Id[]): Promise<Product[]> {
  await simulateLatency();
  const created: Product[] = [];

  for (const source of requireProducts(productIds)) {
    duplicateCounter += 1;
    const copy: Product = {
      ...source,
      id: `${source.id}_copy_${duplicateCounter}`,
      title: `${source.title} (copia)`,
      sku: `${source.sku}-COPY${duplicateCounter}`,
      status: "draft",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    products.push(copy);
    created.push(copy);
  }

  return created;
}
