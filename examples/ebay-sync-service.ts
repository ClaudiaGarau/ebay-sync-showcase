/**
 * Portfolio-safe excerpt: deterministic eBay listing synchronisation.
 * Production adapters, credentials and marketplace payloads remain private.
 */
export type SyncAction =
  | { kind: 'create'; sku: string }
  | { kind: 'update'; sku: string; changedFields: string[] }
  | { kind: 'skip'; sku: string; reason: string };

export interface ListingSnapshot {
  sku: string;
  remoteUpdatedAt: string;
  checksum: string;
}

export function planSync(local: ListingSnapshot, remote: ListingSnapshot | undefined): SyncAction {
  if (!remote) return { kind: 'create', sku: local.sku };
  if (remote.checksum === local.checksum) return { kind: 'skip', sku: local.sku, reason: 'already in sync' };
  return { kind: 'update', sku: local.sku, changedFields: ['title', 'price', 'inventory'] };
}

export async function withRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try { return await operation(); }
    catch (error) { lastError = error; if (attempt === attempts) throw error; await new Promise(r => setTimeout(r, 2 ** attempt * 100)); }
  }
  throw lastError;
}
