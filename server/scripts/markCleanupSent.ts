/**
 * Mark Cleanup Emails as Sent
 * 
 * After sending the cleanup email externally, run this script
 * to mark those users so they don't get re-emailed.
 * 
 * Usage: npx tsx server/scripts/markCleanupSent.ts --file sent_emails.csv
 * 
 * The CSV should have an 'email' column (or just be a list of emails, one per line).
 */

import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';

async function markCleanupSent() {
  // Parse command line args
  const args = process.argv.slice(2);
  const fileIndex = args.indexOf('--file');
  
  if (fileIndex === -1 || !args[fileIndex + 1]) {
    console.log('Usage: npx tsx server/scripts/markCleanupSent.ts --file sent_emails.csv');
    console.log('\nThe CSV should have an "email" column header, or just be a list of emails (one per line).');
    process.exit(1);
  }

  const filename = args[fileIndex + 1];

  if (!fs.existsSync(filename)) {
    console.error(`❌ File not found: ${filename}`);
    process.exit(1);
  }

  console.log(`📄 Reading ${filename}...\n`);

  const content = fs.readFileSync(filename, 'utf-8');
  const lines = content.trim().split('\n');

  // Extract emails from CSV
  let emails: string[] = [];
  
  // Check if first line is a header
  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes('email') || firstLine.includes('id');
  
  if (hasHeader) {
    // Parse as CSV with headers
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const emailIndex = headers.indexOf('email');
    
    if (emailIndex === -1) {
      console.error('❌ No "email" column found in CSV header');
      process.exit(1);
    }

    emails = lines.slice(1).map(line => {
      const cols = line.split(',').map(c => c.trim().replace(/"/g, ''));
      return cols[emailIndex];
    }).filter(e => e && e.includes('@'));
  } else {
    // Assume each line is an email
    emails = lines.map(line => line.trim().replace(/"/g, '')).filter(e => e && e.includes('@'));
  }

  console.log(`Found ${emails.length} emails to mark as sent\n`);

  if (emails.length === 0) {
    console.log('No valid emails found.');
    process.exit(0);
  }

  // Update each user
  let updated = 0;
  let notFound = 0;
  const now = new Date();

  for (const email of emails) {
    const result = await db
      .update(users)
      .set({ cleanupEmailSentAt: now })
      .where(eq(users.email, email.toLowerCase()))
      .returning({ id: users.id });

    if (result.length > 0) {
      updated++;
    } else {
      notFound++;
      console.log(`  ⚠️  Not found: ${email}`);
    }
  }

  console.log(`\n✅ Done!`);
  console.log(`   Updated: ${updated} users`);
  if (notFound > 0) {
    console.log(`   Not found: ${notFound} emails`);
  }

  process.exit(0);
}

markCleanupSent().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
