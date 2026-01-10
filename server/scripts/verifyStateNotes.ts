#!/usr/bin/env npx tsx
/**
 * Verify State Notes - Checks decoder notes coverage for a state
 * 
 * Usage: npx tsx server/scripts/verifyStateNotes.ts <STATE_CODE>
 * Example: npx tsx server/scripts/verifyStateNotes.ts IL
 * 
 * This script:
 * - Checks which required topics are missing approved notes
 * - Returns non-zero exit code if required topics are missing
 * - Outputs summary for CI/CD integration
 */

import { db } from "../db";
import { states, stateNotes } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import {
  REQUIRED_CREDIT_TOPICS,
  REQUIRED_CRIMINAL_EVICTION_TOPICS,
  TOPIC_LABELS,
} from "@shared/decoderTopics";

async function verifyStateNotes(stateCode: string): Promise<boolean> {
  console.log(`\n🔍 Verifying decoder notes for state: ${stateCode}\n`);

  // Verify state exists
  const [state] = await db.select().from(states).where(eq(states.id, stateCode.toUpperCase()));
  if (!state) {
    console.error(`❌ State "${stateCode}" not found in database.`);
    process.exit(1);
  }

  console.log(`State: ${state.name} (${state.id})`);
  console.log(`Decoder Notes Ready Flag: ${state.decoderNotesReady ? "✅ Yes" : "❌ No"}\n`);

  let allPassing = true;
  const missingRequired: string[] = [];

  // Check Criminal/Eviction required topics
  console.log("📋 Criminal/Eviction Decoder (REQUIRED):");
  for (const topic of REQUIRED_CRIMINAL_EVICTION_TOPICS) {
    const label = TOPIC_LABELS[topic];

    const [note] = await db
      .select()
      .from(stateNotes)
      .where(
        and(
          eq(stateNotes.stateId, stateCode.toUpperCase()),
          eq(stateNotes.decoder, "criminal_eviction"),
          eq(stateNotes.topic, topic),
          eq(stateNotes.status, "approved"),
          eq(stateNotes.isActive, true)
        )
      );

    if (note) {
      console.log(`   ✅ ${label} - APPROVED`);
    } else {
      console.log(`   ❌ ${label} - MISSING or NOT APPROVED`);
      missingRequired.push(`criminal_eviction:${topic}`);
      allPassing = false;
    }
  }

  // Check Credit required topics
  console.log("\n📋 Credit Decoder (REQUIRED):");
  for (const topic of REQUIRED_CREDIT_TOPICS) {
    const label = TOPIC_LABELS[topic];

    const [note] = await db
      .select()
      .from(stateNotes)
      .where(
        and(
          eq(stateNotes.stateId, stateCode.toUpperCase()),
          eq(stateNotes.decoder, "credit"),
          eq(stateNotes.topic, topic),
          eq(stateNotes.status, "approved"),
          eq(stateNotes.isActive, true)
        )
      );

    if (note) {
      console.log(`   ✅ ${label} - APPROVED`);
    } else {
      console.log(`   ❌ ${label} - MISSING or NOT APPROVED`);
      missingRequired.push(`credit:${topic}`);
      allPassing = false;
    }
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  if (allPassing) {
    console.log("✅ All required decoder notes are approved!");
    console.log(`   State ${state.id} is decoder-ready.`);
    
    // Check if flag needs updating
    if (!state.decoderNotesReady) {
      console.log("\n⚠️  Note: decoder_notes_ready flag is false but all notes are approved.");
      console.log("   Consider updating the flag in the database.");
    }
  } else {
    console.log(`❌ Missing ${missingRequired.length} required topic(s):`);
    for (const missing of missingRequired) {
      console.log(`   - ${missing}`);
    }
    console.log("\nNext steps:");
    console.log("1. Go to Admin → State Notes");
    console.log("2. Create or edit the missing topics");
    console.log("3. Submit for review and approve with checklist");
    console.log("4. Re-run this script to verify");
  }
  console.log("=".repeat(50) + "\n");

  return allPassing;
}

// Main execution
const stateArg = process.argv[2];
if (!stateArg) {
  console.log("Usage: npx tsx server/scripts/verifyStateNotes.ts <STATE_CODE>");
  console.log("Example: npx tsx server/scripts/verifyStateNotes.ts IL");
  process.exit(1);
}

verifyStateNotes(stateArg)
  .then((passed) => process.exit(passed ? 0 : 1))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
