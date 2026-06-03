/**
 * LeaseShield App - Apply Link Live-Propagation Regression Test
 *
 * Guards the fix that makes landlord property edits propagate immediately to
 * EXISTING applicant links. The public apply endpoints
 *   GET /api/apply/:token   and   GET /api/apply/link/:linkId
 * must resolve propertyName, coverPage, fieldSchema, and propertyTerms LIVE
 * from the unit->property chain. The link.mergedSchemaJson snapshot is only a
 * fallback. If a future change reverts to reading the snapshot, this test fails.
 *
 * Self-contained: spins up an in-process Express app with only the apply routes
 * on an ephemeral port, so it does not depend on the dev server being up.
 *
 * Run:  npx tsx tests/apply-live-propagation.test.ts
 */

import express from "express";
import { randomUUID } from "crypto";
import type { Server } from "http";
import { eq } from "drizzle-orm";
import { db } from "../server/db";
import { users } from "@shared/schema";
import { storage } from "../server/storage";
import { registerApplyRoutes } from "../server/routes/apply";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, details = "") {
  if (condition) {
    passed++;
    console.log(`✅ ${name}${details ? `: ${details}` : ""}`);
  } else {
    failed++;
    console.log(`❌ ${name}${details ? `: ${details}` : ""}`);
  }
}

async function main() {
  console.log("🚀 Apply Link Live-Propagation Regression Test\n" + "=".repeat(60));

  // --- Spin up an in-process server with only the apply routes ---
  const app = express();
  app.use(express.json());
  await registerApplyRoutes(app);
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = (server.address() as any).port;
  const base = `http://127.0.0.1:${port}`;

  // --- Create throwaway test data ---
  const userId = `apply-live-test-${randomUUID()}`;
  let propertyId: string | undefined;

  // OLD (snapshot) values vs NEW (live) values we will edit to.
  const OLD = {
    name: "OLD PROP NAME",
    cover: { title: "OLD COVER", intro: "old", sections: [] },
    terms: { applicationFee: "$10 OLD", additionalNotes: "OLD NOTE" },
    fieldSchema: { fields: [] },
  };
  const NEW = {
    name: "NEW PROP NAME",
    cover: { title: "NEW COVER", intro: "new", sections: [] },
    terms: { applicationFee: "$99 NEW", additionalNotes: "NEW NOTE" },
    fieldSchema: { fields: [{ key: "phone", visible: true }] },
  };

  try {
    await storage.upsertUser({
      id: userId,
      email: `${userId}@example.invalid`,
      firstName: "Apply",
      lastName: "Tester",
    });

    // Property starts at OLD values.
    const property = await storage.createRentalProperty({
      userId,
      name: OLD.name,
      state: "UT",
      defaultCoverPageJson: OLD.cover,
      defaultFieldSchemaJson: OLD.fieldSchema,
      propertyTermsJson: OLD.terms,
    } as any);
    propertyId = property.id;

    const unit = await storage.createRentalUnit({
      propertyId: property.id,
      unitLabel: "Unit T",
      rentAmount: 100000, // $1,000.00
    } as any);

    const publicToken = `tok_${randomUUID().replace(/-/g, "")}`;
    // The link snapshot captures the OLD values (as it would at creation time).
    const link = await storage.createRentalApplicationLink({
      unitId: unit.id,
      publicToken,
      mergedSchemaJson: {
        propertyName: OLD.name,
        coverPage: OLD.cover,
        propertyTerms: OLD.terms,
        fieldSchema: OLD.fieldSchema,
        unitLabel: "Unit T",
      },
    } as any);

    const fetchOk = async (url: string, label: string) => {
      const res = await fetch(url);
      check(`[${label}] HTTP 200`, res.status === 200, `got ${res.status}`);
      return res.json();
    };
    const fetchByToken = (label: string) =>
      fetchOk(`${base}/api/apply/${publicToken}`, label);
    const fetchById = (label: string) =>
      fetchOk(`${base}/api/apply/link/${link.id}`, label);

    // --- Case 1: landlord edits the property; existing link must reflect it ---
    await storage.updateRentalProperty(property.id, userId, {
      name: NEW.name,
      defaultCoverPageJson: NEW.cover,
      defaultFieldSchemaJson: NEW.fieldSchema,
      propertyTermsJson: NEW.terms,
    } as any);

    for (const [label, data] of [
      ["token", await fetchByToken("token")],
      ["linkId", await fetchById("linkId")],
    ] as const) {
      check(
        `[${label}] propertyName is live, not snapshot`,
        data.propertyName === NEW.name,
        `got "${data.propertyName}"`,
      );
      check(
        `[${label}] coverPage is live, not snapshot`,
        data.coverPage?.title === NEW.cover.title,
        `got "${data.coverPage?.title}"`,
      );
      check(
        `[${label}] propertyTerms.applicationFee is live`,
        data.propertyTerms?.applicationFee === NEW.terms.applicationFee,
        `got "${data.propertyTerms?.applicationFee}"`,
      );
      check(
        `[${label}] propertyTerms.additionalNotes is live`,
        data.propertyTerms?.additionalNotes === NEW.terms.additionalNotes,
        `got "${data.propertyTerms?.additionalNotes}"`,
      );
      check(
        `[${label}] unit rent overlaid live`,
        data.propertyTerms?.monthlyRent === "$1,000/mo",
        `got "${data.propertyTerms?.monthlyRent}"`,
      );
      check(
        `[${label}] fieldSchema is live, not snapshot`,
        JSON.stringify(data.fieldSchema) === JSON.stringify(NEW.fieldSchema),
        `got ${JSON.stringify(data.fieldSchema)}`,
      );
    }

    // --- Case 2: landlord CLEARS the terms to null; snapshot must NOT resurface ---
    await storage.updateRentalProperty(property.id, userId, {
      propertyTermsJson: null,
    } as any);

    for (const [label, data] of [
      ["token", await fetchByToken("token")],
      ["linkId", await fetchById("linkId")],
    ] as const) {
      check(
        `[${label}] cleared applicationFee does not fall back to snapshot`,
        data.propertyTerms?.applicationFee === undefined,
        `got "${data.propertyTerms?.applicationFee}"`,
      );
      check(
        `[${label}] cleared additionalNotes does not fall back to snapshot`,
        data.propertyTerms?.additionalNotes === undefined,
        `got "${data.propertyTerms?.additionalNotes}"`,
      );
      check(
        `[${label}] unit rent still overlaid after clearing terms`,
        data.propertyTerms?.monthlyRent === "$1,000/mo",
        `got "${data.propertyTerms?.monthlyRent}"`,
      );
    }
  } finally {
    // --- Cleanup: delete property (cascades unit + link), then the user ---
    // Teardown is strict: failures are surfaced as test failures so the
    // isolation/no-orphan guarantee is enforced by the run itself.
    try {
      if (propertyId) {
        await storage.deleteRentalProperty(propertyId, userId);
      }
      await db.delete(users).where(eq(users.id, userId));
      check("cleanup removed test data", true);
    } catch (err) {
      check("cleanup removed test data", false, String(err));
    }
    server.close();
  }

  console.log("=".repeat(60));
  console.log(`\n${failed === 0 ? "✅ ALL PASSED" : "❌ FAILURES"} — ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("❌ Test suite crashed:", err);
  process.exit(1);
});
