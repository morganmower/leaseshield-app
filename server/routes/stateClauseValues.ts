import type { Express } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { stateClauseValues, states } from '@shared/schema';
import { isAuthenticated, requireAdmin } from '../jwtAuth';
import { getUserId } from './_shared';
import { CLAUSE_DEFINITIONS, CLAUSE_KEYS, getClauseDefinition, validateClauseNumericValue } from '@shared/clauseRegistry';
import { clearStateClauseValueCache } from '../utils/stateClauseValues';
import { and, eq, sql } from 'drizzle-orm';

const VALID_CLAUSE_KEYS = new Set<string>(Object.values(CLAUSE_KEYS));

// Validate the PATCH payload — coerce numbers/dates and accept null for
// nullable fields. Rejects junk before it reaches the DB or `new Date()`.
const upsertClauseValueSchema = z.object({
  valueNumeric: z.number().finite().nullable().optional(),
  valueText: z.string().max(2000).nullable().optional(),
  statuteCitation: z.string().max(500).nullable().optional(),
  effectiveDate: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .nullable()
    .optional(),
  sourceBillId: z.string().max(128).nullable().optional(),
  needsReview: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function registerStateClauseValuesRoutes(app: Express) {
  // List all clause values, optionally filtered by stateId
  app.get('/api/admin/state-clause-values', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const stateId = (req.query.stateId as string | undefined)?.toUpperCase();
      const rows = stateId
        ? await db.select().from(stateClauseValues).where(eq(stateClauseValues.stateId, stateId))
        : await db.select().from(stateClauseValues);
      res.json({
        definitions: CLAUSE_DEFINITIONS,
        values: rows,
      });
    } catch (error: any) {
      console.error('Error listing state clause values:', error);
      res.status(500).json({ message: 'Something went wrong. Please try again.' });
    }
  });

  // Upsert one clause value for one state
  app.patch(
    '/api/admin/state-clause-values/:stateId/:clauseKey',
    isAuthenticated,
    requireAdmin,
    async (req, res) => {
      try {
        const stateId = req.params.stateId.toUpperCase();
        const clauseKey = req.params.clauseKey;
        if (!VALID_CLAUSE_KEYS.has(clauseKey)) {
          return res.status(400).json({ message: `Unknown clause key: ${clauseKey}` });
        }
        const definition = getClauseDefinition(clauseKey)!;

        const stateRow = await db.select().from(states).where(eq(states.id, stateId)).limit(1);
        if (stateRow.length === 0) {
          return res.status(400).json({ message: `Unknown state: ${stateId}` });
        }

        const parseResult = upsertClauseValueSchema.safeParse(req.body);
        if (!parseResult.success) {
          return res.status(400).json({
            message: 'Invalid request body',
            errors: parseResult.error.flatten(),
          });
        }
        const {
          valueNumeric,
          valueText,
          statuteCitation,
          effectiveDate,
          sourceBillId,
          needsReview,
          notes,
        } = parseResult.data;

        if (valueNumeric != null) {
          const boundsErr = validateClauseNumericValue(clauseKey, valueNumeric);
          if (boundsErr) {
            return res.status(400).json({ message: boundsErr });
          }
        }

        const userId = getUserId(req);
        const now = new Date();

        const insertRow = {
          stateId,
          clauseKey,
          valueNumeric: valueNumeric ?? null,
          valueText: valueText ?? null,
          unit: definition.unit,
          statuteCitation: statuteCitation ?? null,
          effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
          sourceBillId: sourceBillId ?? null,
          needsReview: needsReview ?? false,
          notes: notes ?? null,
          updatedBy: userId ?? null,
          updatedAt: now,
        };

        const result = await db
          .insert(stateClauseValues)
          .values(insertRow)
          .onConflictDoUpdate({
            target: [stateClauseValues.stateId, stateClauseValues.clauseKey],
            set: {
              valueNumeric: insertRow.valueNumeric,
              valueText: insertRow.valueText,
              unit: insertRow.unit,
              statuteCitation: insertRow.statuteCitation,
              effectiveDate: insertRow.effectiveDate,
              sourceBillId: insertRow.sourceBillId,
              needsReview: insertRow.needsReview,
              notes: insertRow.notes,
              updatedBy: insertRow.updatedBy,
              updatedAt: now,
            },
          })
          .returning();

        clearStateClauseValueCache();
        res.json({ success: true, row: result[0] });
      } catch (error: any) {
        console.error('Error upserting state clause value:', error);
        res.status(500).json({ message: 'Something went wrong. Please try again.' });
      }
    },
  );

  // Idempotently seed empty (NULL value) rows for every supported state x clause.
  // Pre-existing rows are never overwritten.
  app.post('/api/admin/state-clause-values/seed-empty', isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const allStates = await db.select().from(states).where(eq(states.isActive, true));
      const existing = await db.select({ stateId: stateClauseValues.stateId, clauseKey: stateClauseValues.clauseKey }).from(stateClauseValues);
      const haveSet = new Set(existing.map((e) => `${e.stateId}::${e.clauseKey}`));

      const toInsert: Array<typeof stateClauseValues.$inferInsert> = [];
      for (const state of allStates) {
        for (const def of CLAUSE_DEFINITIONS) {
          const key = `${state.id}::${def.key}`;
          if (haveSet.has(key)) continue;
          toInsert.push({
            stateId: state.id,
            clauseKey: def.key,
            valueNumeric: null,
            valueText: null,
            unit: def.unit,
            needsReview: true,
          });
        }
      }

      if (toInsert.length > 0) {
        // onConflictDoNothing makes this safe under concurrent calls.
        await db.insert(stateClauseValues).values(toInsert).onConflictDoNothing({
          target: [stateClauseValues.stateId, stateClauseValues.clauseKey],
        });
        clearStateClauseValueCache();
      }

      res.json({ success: true, inserted: toInsert.length, totalExpected: allStates.length * CLAUSE_DEFINITIONS.length });
    } catch (error: any) {
      console.error('Error seeding state clause values:', error);
      res.status(500).json({ message: 'Something went wrong. Please try again.' });
    }
  });
}
