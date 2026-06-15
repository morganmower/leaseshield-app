---
name: State clause values framework
description: How per-state numeric legal clause values flow into the lease generator, and the invariants that keep it safe.
---

# State clause values framework

Admin-editable numeric legal values (late fees, deposits, notices) that auto-patch
the lease generator without engineering. Flow: admin edits a value per state →
stored in `state_clause_values` (unique on state_id+clause_key) → in-memory cache →
lease generator reads it at render time and emits a compliance footnote next to the
affected clause. Clause keys/categories/units live in `shared/clauseRegistry.ts`
(single source of truth, shared client+server). 8 clauses × supported states.

**Invariants to preserve (each had a concrete failure mode):**

- The cache (`server/utils/stateClauseValues.ts`) must NOT persist an empty map on
  a DB warmup error. **Why:** a transient DB blip would otherwise leave a
  process-wide "successfully empty" cache, silently dropping every state's
  compliance notes/overrides until the next invalidation. Leave `cache` null on
  error so the next read retries; callers treat null as "no overrides" and fall
  back to legacy defaults.
- Do NOT recurse/retry warmup synchronously on failure — that hammers the DB on a
  persistent outage. One read degrades gracefully; the cache self-heals next read.
- Numeric values must be bounds-checked server-side before they reach the lease
  generator. **Why:** a legal document must never render nonsensical values
  (negative grace days, 5000% late-fee cap). Bounds live in `CLAUSE_BOUNDS` in
  `clauseRegistry.ts` and are enforced in the PATCH route via
  `validateClauseNumericValue`. Add new clauses' bounds there too.
- The lease generator must keep the legacy hardcoded `DEPOSIT_RETURN_DAYS` map as a
  fallback when the DB value is null — never regress existing output.

**How to apply:** when extending clauses, update `clauseRegistry.ts` (key, def,
bounds), the seed script, and wire the value into the generator with a null-safe
fallback. Cache is invalidated on every upsert (`clearStateClauseValueCache`).
