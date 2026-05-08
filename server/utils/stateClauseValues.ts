import { db } from '../db';
import { stateClauseValues } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface CachedClauseValue {
  value: number | null;
  valueText: string | null;
  unit: string | null;
  statuteCitation: string | null;
  needsReview: boolean;
}

type StateMap = Map<string, CachedClauseValue>;

let cache: Map<string, StateMap> | null = null;
let warmupPromise: Promise<void> | null = null;
// Generation counter — bumped on every cache invalidation. An in-flight warmup
// records the generation it started under and refuses to commit a stale result.
let cacheGeneration = 0;

async function warmup(): Promise<void> {
  const startedAt = cacheGeneration;
  const rows = await db.select().from(stateClauseValues);
  if (startedAt !== cacheGeneration) {
    // Cache was invalidated mid-flight; discard this read.
    return;
  }
  const next: Map<string, StateMap> = new Map();
  for (const row of rows) {
    const stateMap = next.get(row.stateId) ?? new Map<string, CachedClauseValue>();
    stateMap.set(row.clauseKey, {
      value: row.valueNumeric ?? null,
      valueText: row.valueText ?? null,
      unit: row.unit ?? null,
      statuteCitation: row.statuteCitation ?? null,
      needsReview: row.needsReview ?? false,
    });
    next.set(row.stateId, stateMap);
  }
  cache = next;
}

async function ensureWarm(): Promise<void> {
  if (cache) return;
  if (!warmupPromise) {
    warmupPromise = warmup().catch((err) => {
      console.error('[stateClauseValues] cache warmup failed:', err);
      if (!cache) cache = new Map();
    }).finally(() => {
      warmupPromise = null;
    });
  }
  await warmupPromise;
  // If a concurrent invalidation discarded our warmup, retry once.
  if (!cache) {
    await ensureWarm();
  }
}

export function clearStateClauseValueCache(): void {
  cacheGeneration += 1;
  cache = null;
}

export async function getStateClauseValues(stateId: string): Promise<Map<string, CachedClauseValue>> {
  await ensureWarm();
  return cache?.get(stateId) ?? new Map();
}

export async function getStateClauseValue(stateId: string, clauseKey: string): Promise<CachedClauseValue | null> {
  const map = await getStateClauseValues(stateId);
  return map.get(clauseKey) ?? null;
}

/**
 * Synchronous read for hot paths (lease generator). Returns null if cache is
 * cold; callers should pre-warm with `getStateClauseValues(stateId)` first.
 */
export function getStateClauseValueSync(stateId: string, clauseKey: string): CachedClauseValue | null {
  if (!cache) return null;
  return cache.get(stateId)?.get(clauseKey) ?? null;
}
