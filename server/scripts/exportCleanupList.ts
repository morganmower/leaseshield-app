/**
 * Export Cleanup Email Recipients
 * 
 * Exports a CSV of users who should receive the one-time cleanup email.
 * These are users from the trial cohort who never subscribed.
 * 
 * Usage: npx tsx server/scripts/exportCleanupList.ts
 * Output: cleanup_recipients.csv
 */

import { db } from '../db';
import { users } from '@shared/schema';
import { and, eq, isNull, isNotNull, or, ne } from 'drizzle-orm';
import * as fs from 'fs';

async function exportCleanupList() {
  console.log('🔍 Querying users for cleanup email...\n');

  // Find users who:
  // 1. Are NOT active subscribers
  // 2. Have NOT already received the cleanup email
  // 3. Were part of the trial cohort (had trialing status or trial_ends_at set)
  const eligibleUsers = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      createdAt: users.createdAt,
      subscriptionStatus: users.subscriptionStatus,
      trialEndsAt: users.trialEndsAt,
      cleanupEmailSentAt: users.cleanupEmailSentAt,
    })
    .from(users)
    .where(
      and(
        // Not active subscribers
        or(
          isNull(users.subscriptionStatus),
          ne(users.subscriptionStatus, 'active')
        ),
        // Haven't received cleanup email yet
        isNull(users.cleanupEmailSentAt),
        // Were part of trial cohort (had a trial end date set, indicating they went through trial)
        // OR have a subscription status that indicates they were trialing/canceled
        or(
          isNotNull(users.trialEndsAt),
          eq(users.subscriptionStatus, 'trialing'),
          eq(users.subscriptionStatus, 'canceled'),
          eq(users.subscriptionStatus, 'inactive')
        )
      )
    );

  console.log(`Found ${eligibleUsers.length} users eligible for cleanup email\n`);

  if (eligibleUsers.length === 0) {
    console.log('No users to export.');
    return;
  }

  // Create CSV content
  const headers = ['id', 'first_name', 'last_name', 'email', 'created_at', 'subscription_status', 'trial_ends_at'];
  const rows = eligibleUsers.map(user => [
    user.id,
    user.firstName || '',
    user.lastName || '',
    user.email,
    user.createdAt ? user.createdAt.toISOString() : '',
    user.subscriptionStatus || '',
    user.trialEndsAt ? user.trialEndsAt.toISOString() : '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  // Write to file
  const filename = 'cleanup_recipients.csv';
  fs.writeFileSync(filename, csvContent);

  console.log(`✅ Exported to ${filename}`);
  console.log(`\nSample of first 5 users:`);
  eligibleUsers.slice(0, 5).forEach(user => {
    console.log(`  - ${user.email} (${user.subscriptionStatus || 'no status'})`);
  });

  process.exit(0);
}

exportCleanupList().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
