#!/usr/bin/env npx tsx
/**
 * Initialize State Notes - Creates draft placeholders for required decoder topics
 * 
 * Usage: npx tsx server/scripts/initStateNotes.ts <STATE_CODE>
 * Example: npx tsx server/scripts/initStateNotes.ts IL
 * 
 * This script:
 * - Reads the controlled topic lists (credit + criminal_eviction)
 * - Inserts draft records for required topics for the specified state
 * - Sets status='draft', bullets=[], isActive=false
 * - Uses upsert so re-running is safe
 * - Does NOT create legal content - just placeholders for admins to fill
 */

import { db } from "../db";
import { states, stateNotes } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import {
  CREDIT_TOPICS,
  CRIMINAL_EVICTION_TOPICS,
  REQUIRED_CREDIT_TOPICS,
  REQUIRED_CRIMINAL_EVICTION_TOPICS,
  TOPIC_LABELS,
} from "@shared/decoderTopics";

async function initStateNotes(stateCode: string) {
  console.log(`\n🔧 Initializing decoder notes for state: ${stateCode}\n`);

  // Verify state exists
  const [state] = await db.select().from(states).where(eq(states.id, stateCode.toUpperCase()));
  if (!state) {
    console.error(`❌ State "${stateCode}" not found in database.`);
    console.log("Available states: Run 'SELECT id, name FROM states' to see all states.");
    process.exit(1);
  }

  console.log(`✅ Found state: ${state.name} (${state.id})`);
  console.log(`   Decoder Notes Ready: ${state.decoderNotesReady ? "Yes" : "No"}\n`);

  let created = 0;
  let skipped = 0;

  // Process Criminal/Eviction topics (required first)
  console.log("📋 Criminal/Eviction Decoder Topics:");
  for (const topic of CRIMINAL_EVICTION_TOPICS) {
    const isRequired = REQUIRED_CRIMINAL_EVICTION_TOPICS.includes(topic as any);
    const label = TOPIC_LABELS[topic];

    // Check if note already exists
    const [existing] = await db
      .select()
      .from(stateNotes)
      .where(
        and(
          eq(stateNotes.stateId, stateCode.toUpperCase()),
          eq(stateNotes.decoder, "criminal_eviction"),
          eq(stateNotes.topic, topic)
        )
      );

    if (existing) {
      console.log(`   ⏭️  ${label} - exists (status: ${existing.status})`);
      skipped++;
    } else {
      await db.insert(stateNotes).values({
        stateId: stateCode.toUpperCase(),
        decoder: "criminal_eviction",
        topic,
        title: `${state.name} ${label}`,
        bullets: [],
        sourceLinks: [],
        status: "draft",
        isActive: false,
        version: 1,
      });
      const marker = isRequired ? "🔴" : "🟡";
      console.log(`   ${marker} ${label} - created draft${isRequired ? " (REQUIRED)" : ""}`);
      created++;
    }
  }

  // Process Credit topics
  console.log("\n📋 Credit Decoder Topics:");
  for (const topic of CREDIT_TOPICS) {
    const isRequired = REQUIRED_CREDIT_TOPICS.includes(topic as any);
    const label = TOPIC_LABELS[topic];

    // Check if note already exists
    const [existing] = await db
      .select()
      .from(stateNotes)
      .where(
        and(
          eq(stateNotes.stateId, stateCode.toUpperCase()),
          eq(stateNotes.decoder, "credit"),
          eq(stateNotes.topic, topic)
        )
      );

    if (existing) {
      console.log(`   ⏭️  ${label} - exists (status: ${existing.status})`);
      skipped++;
    } else {
      await db.insert(stateNotes).values({
        stateId: stateCode.toUpperCase(),
        decoder: "credit",
        topic,
        title: `${state.name} ${label}`,
        bullets: [],
        sourceLinks: [],
        status: "draft",
        isActive: false,
        version: 1,
      });
      const marker = isRequired ? "🔴" : "🟡";
      console.log(`   ${marker} ${label} - created draft${isRequired ? " (REQUIRED)" : ""}`);
      created++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Created: ${created} drafts`);
  console.log(`   Skipped: ${skipped} (already exist)`);
  console.log(`\n✅ Done! Now go to Admin → State Notes to fill in the content and approve.\n`);
}

// Main execution
const stateArg = process.argv[2];
if (!stateArg) {
  console.log("Usage: npx tsx server/scripts/initStateNotes.ts <STATE_CODE>");
  console.log("Example: npx tsx server/scripts/initStateNotes.ts IL");
  process.exit(1);
}

initStateNotes(stateArg)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
