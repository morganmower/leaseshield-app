# APPLICANT FILE RECOVERY — READ THIS FIRST

## What happened
169 applicant files (IDs, paystubs, W2s uploaded Jan 17 - Feb 13, 2026) were lost from disk.
Database records still exist but point to files that no longer exist.
This workspace was rolled back to a checkpoint that hopefully still has those files.

## Step 1: Check if files exist
Tell the AI agent in this chat:

> "Run this command: ls uploads/applicants/ | wc -l"

If the number is significantly more than 27, the checkpoint has recovered files.
If it's 27 or fewer, try a different checkpoint (roll back again to an earlier date).

## Step 2: Run the recovery script
Tell the AI agent:

> "Run the applicant file recovery script. First download the mapping file from cloud storage, then run: npx tsx server/scripts/recoverApplicantFiles.ts --dry-run"

The dry-run will show how many files it can recover. If the numbers look good, tell the agent:

> "Run it for real without --dry-run: npx tsx server/scripts/recoverApplicantFiles.ts"

This will:
1. Upload each found file to permanent cloud storage
2. Update the database so records point to the cloud copies
3. Generate a CSV report at .private/recovery-reports/

## Step 3: Roll forward
After the script finishes, roll forward to the latest checkpoint (the one from Feb 13, 2026).
The files will be safe in cloud storage permanently.

## Step 4: Verify
In the latest code, tell the agent:

> "Check the file health endpoint: curl http://localhost:5000/api/admin/file-health"

## Key files
- Recovery script: server/scripts/recoverApplicantFiles.ts
- Mapping backup: stored in cloud storage at /.private/backups/file-mapping-1771017306730.json
  (needs to be downloaded to .private/backups/file-mapping-1771017306730.json before running)
- The script uses the app's existing database and cloud storage connections

## If the mapping file is missing after rollback
The agent should run this to download it:
```
npx tsx -e "
async function main() {
  const { objectStorageClient } = await import('./server/replit_integrations/object_storage/objectStorage');
  const PRIVATE_OBJECT_DIR = process.env.PRIVATE_OBJECT_DIR || '';
  const objectPath = PRIVATE_OBJECT_DIR + '/backups/file-mapping-1771017306730.json';
  const normalized = objectPath.startsWith('/') ? objectPath : '/' + objectPath;
  const parts = normalized.split('/');
  const bucket = objectStorageClient.bucket(parts[1]);
  const file = bucket.file(parts.slice(2).join('/'));
  const [contents] = await file.download();
  const fs = await import('fs');
  fs.mkdirSync('.private/backups', { recursive: true });
  fs.writeFileSync('.private/backups/file-mapping-1771017306730.json', contents);
  console.log('Downloaded mapping file');
}
main();
"
```

## If the recovery script is missing after rollback
The agent should check cloud storage or ask to recreate it. The script:
- Reads .private/backups/file-mapping-1771017306730.json
- For each of 169 records, checks if uploads/applicants/{uuid}.{ext} exists on disk
- Uploads found files to cloud storage at PRIVATE_OBJECT_DIR/applicants/{uuid}.{ext}
- Updates rental_submission_files.stored_path in the database
- Writes a CSV report to .private/recovery-reports/
