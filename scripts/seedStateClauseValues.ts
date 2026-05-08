/**
 * Seed empty rows in state_clause_values for every (active state x clause) pair.
 * Pre-existing rows are never touched (onConflictDoNothing).
 *
 * Additionally, populate deposit_return_days from the legacy hardcoded map in
 * leaseAgreementGenerator.ts so we don't regress the existing lease output.
 *
 * Idempotent — safe to re-run.
 *
 * Usage: tsx scripts/seedStateClauseValues.ts
 */
import { db } from "../server/db";
import { stateClauseValues, states } from "@shared/schema";
import { CLAUSE_DEFINITIONS, CLAUSE_KEYS } from "@shared/clauseRegistry";
import { eq, and, isNull } from "drizzle-orm";

// Mirror of the legacy hardcoded map in server/utils/leaseAgreementGenerator.ts.
// Only entries with a single integer day count are auto-populated; ranges
// (e.g. "14-45") stay NULL and remain admin-review tasks.
const LEGACY_DEPOSIT_RETURN_DAYS: Record<string, number> = {
  UT: 30,
  TX: 30,
  ND: 30,
  NC: 30,
  OH: 30,
  MI: 30,
  CA: 21,
  VA: 45,
  NV: 30,
  AZ: 14,
  NM: 30,
  // SD ('14-45'), ID ('21-30'), WY ('15-30'), FL ('15-60'), IL ('30-45') -> NULL
};

async function main() {
  const allStates = await db.select().from(states).where(eq(states.isActive, true));
  console.log(`Found ${allStates.length} active states.`);

  const existing = await db
    .select({ stateId: stateClauseValues.stateId, clauseKey: stateClauseValues.clauseKey })
    .from(stateClauseValues);
  const have = new Set(existing.map((r) => `${r.stateId}::${r.clauseKey}`));

  type InsertRow = typeof stateClauseValues.$inferInsert;
  const toInsert: InsertRow[] = [];

  for (const state of allStates) {
    for (const def of CLAUSE_DEFINITIONS) {
      const key = `${state.id}::${def.key}`;
      if (have.has(key)) continue;

      const isDepositReturn = def.key === CLAUSE_KEYS.DEPOSIT_RETURN_DAYS;
      const seedValue = isDepositReturn ? LEGACY_DEPOSIT_RETURN_DAYS[state.id] : undefined;
      const hasSeed = typeof seedValue === "number";

      toInsert.push({
        stateId: state.id,
        clauseKey: def.key,
        valueNumeric: hasSeed ? seedValue! : null,
        unit: def.unit,
        needsReview: !hasSeed,
        notes: hasSeed ? "Seeded from legacy DEPOSIT_RETURN_DAYS map" : null,
      });
    }
  }

  if (toInsert.length > 0) {
    console.log(`Inserting ${toInsert.length} new rows…`);
    await db
      .insert(stateClauseValues)
      .values(toInsert)
      .onConflictDoNothing({
        target: [stateClauseValues.stateId, stateClauseValues.clauseKey],
      });
  } else {
    console.log("All (state, clause) pairs already exist — no inserts needed.");
  }

  // Backfill: for any pre-existing deposit_return_days row that is still NULL,
  // populate it from the legacy map. This keeps re-runs idempotent and lets
  // the script "heal" earlier seedings that ran before this script existed.
  // We only update rows whose value is NULL so we never clobber admin edits.
  let backfilled = 0;
  for (const [stateId, days] of Object.entries(LEGACY_DEPOSIT_RETURN_DAYS)) {
    const result = await db
      .update(stateClauseValues)
      .set({
        valueNumeric: days,
        needsReview: false,
        notes: "Seeded from legacy DEPOSIT_RETURN_DAYS map",
        updatedAt: new Date(),
      })
      // Only touch rows that have never been hand-edited by an admin
      // (`updated_by IS NULL`) AND still have a NULL value. This prevents
      // re-runs from clobbering an admin who intentionally cleared a value
      // or is mid-review.
      .where(
        and(
          eq(stateClauseValues.stateId, stateId),
          eq(stateClauseValues.clauseKey, CLAUSE_KEYS.DEPOSIT_RETURN_DAYS),
          isNull(stateClauseValues.valueNumeric),
          isNull(stateClauseValues.updatedBy),
        ),
      )
      .returning({ id: stateClauseValues.id });

    if (result.length > 0) backfilled++;
  }

  console.log(`Inserted ${toInsert.length} rows. Backfilled deposit_return_days for ${backfilled} states.`);
  console.log(`Expected total: ${allStates.length * CLAUSE_DEFINITIONS.length} rows.`);
}

main()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
