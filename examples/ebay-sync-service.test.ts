import { planSync } from './ebay-sync-service';

describe('planSync', () => {
  it('creates a listing when no remote record exists', () => {
    expect(planSync({ sku: 'SKU-1', remoteUpdatedAt: '2026-01-01', checksum: 'a' }, undefined))
      .toEqual({ kind: 'create', sku: 'SKU-1' });
  });

  it('is idempotent when checksums match', () => {
    const snapshot = { sku: 'SKU-1', remoteUpdatedAt: '2026-01-01', checksum: 'a' };
    expect(planSync(snapshot, snapshot)).toEqual({ kind: 'skip', sku: 'SKU-1', reason: 'already in sync' });
  });
});
