import fs from "fs";
import path from "path";
import { objectStorageClient } from "../replit_integrations/object_storage/objectStorage";
import { db } from "../db";
import { rentalSubmissionFiles } from "@shared/schema";
import { eq } from "drizzle-orm";

const dryRun = process.argv.includes("--dry-run");
const recoveredDir = "uploads/applicants";
const PRIVATE_OBJECT_DIR = process.env.PRIVATE_OBJECT_DIR || "";

if (!PRIVATE_OBJECT_DIR) {
  console.error("PRIVATE_OBJECT_DIR not set");
  process.exit(1);
}

function parseObjectStoragePath(fullPath: string): { bucketName: string; objectName: string } {
  const normalized = fullPath.startsWith("/") ? fullPath : `/${fullPath}`;
  const parts = normalized.split("/");
  if (parts.length < 3) throw new Error("Invalid object storage path");
  return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
}

interface MappingRow {
  id: string;
  person_id: string;
  file_type: string;
  original_name: string;
  stored_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

function safeCsv(val: any): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function main() {
  console.log("=== Applicant File Recovery ===");
  console.log("Recovered dir:", recoveredDir);
  console.log("PRIVATE_OBJECT_DIR:", PRIVATE_OBJECT_DIR);
  console.log("Mode:", dryRun ? "DRY RUN" : "LIVE");
  console.log("");

  const mappingPath = ".private/backups/file-mapping-1771017306730.json";
  if (!fs.existsSync(mappingPath)) {
    console.error("Mapping file not found at", mappingPath);
    console.error("Download it first from cloud storage");
    process.exit(1);
  }

  const raw = fs.readFileSync(mappingPath, "utf8");
  const data = JSON.parse(raw);
  const rows: MappingRow[] = data.rentalSubmissionFiles || [];
  console.log("Mapping rows loaded:", rows.length);

  const { bucketName } = parseObjectStoragePath(PRIVATE_OBJECT_DIR + "/test");
  const bucket = objectStorageClient.bucket(bucketName);

  const reportLines: string[] = [];
  reportLines.push([
    "file_id", "person_id", "file_type", "original_name",
    "old_stored_path", "expected_filename", "local_found",
    "uploaded", "new_stored_path", "error"
  ].join(","));

  let foundLocal = 0;
  let uploadedCount = 0;
  let updatedCount = 0;
  let missingLocal = 0;
  let skippedAlreadyCloud = 0;

  for (const r of rows) {
    const fileId = r.id;
    const oldStoredPath = r.stored_path;

    if (!fileId || !oldStoredPath) continue;

    if (oldStoredPath.startsWith("/") && oldStoredPath.includes("/.private/")) {
      skippedAlreadyCloud++;
      reportLines.push([
        safeCsv(fileId), safeCsv(r.person_id), safeCsv(r.file_type),
        safeCsv(r.original_name), safeCsv(oldStoredPath),
        safeCsv(path.basename(oldStoredPath)), "n/a", "n/a",
        safeCsv(oldStoredPath), ""
      ].join(","));
      continue;
    }

    const expectedFilename = path.basename(oldStoredPath);
    const localPath = path.join(recoveredDir, expectedFilename);

    if (!fs.existsSync(localPath)) {
      missingLocal++;
      reportLines.push([
        safeCsv(fileId), safeCsv(r.person_id), safeCsv(r.file_type),
        safeCsv(r.original_name), safeCsv(oldStoredPath),
        safeCsv(expectedFilename), "NO", "NO", "", "local file missing"
      ].join(","));
      continue;
    }

    foundLocal++;

    const newStoredPath = `${PRIVATE_OBJECT_DIR}/applicants/${expectedFilename}`;
    const { objectName } = parseObjectStoragePath(newStoredPath);

    let uploaded = false;
    let errMsg = "";

    try {
      if (dryRun) {
        uploaded = true;
      } else {
        const buffer = fs.readFileSync(localPath);
        const file = bucket.file(objectName);
        await file.save(buffer, {
          contentType: r.mime_type || "application/octet-stream",
          resumable: false
        });

        const [exists] = await file.exists();
        if (!exists) {
          throw new Error("Upload verification failed: file not found after upload");
        }

        uploaded = true;
        uploadedCount++;
        console.log(`  UPLOADED: ${expectedFilename} (${buffer.length} bytes)`);
      }
    } catch (e: any) {
      errMsg = e?.message || String(e);
      reportLines.push([
        safeCsv(fileId), safeCsv(r.person_id), safeCsv(r.file_type),
        safeCsv(r.original_name), safeCsv(oldStoredPath),
        safeCsv(expectedFilename), "YES", "NO", "", safeCsv(errMsg)
      ].join(","));
      continue;
    }

    try {
      if (!dryRun) {
        await db.update(rentalSubmissionFiles)
          .set({ storedPath: newStoredPath })
          .where(eq(rentalSubmissionFiles.id, fileId));
        updatedCount++;
      }

      reportLines.push([
        safeCsv(fileId), safeCsv(r.person_id), safeCsv(r.file_type),
        safeCsv(r.original_name), safeCsv(oldStoredPath),
        safeCsv(expectedFilename), "YES", uploaded ? "YES" : "NO",
        safeCsv(newStoredPath), safeCsv(errMsg)
      ].join(","));
    } catch (e: any) {
      errMsg = e?.message || String(e);
      reportLines.push([
        safeCsv(fileId), safeCsv(r.person_id), safeCsv(r.file_type),
        safeCsv(r.original_name), safeCsv(oldStoredPath),
        safeCsv(expectedFilename), "YES", uploaded ? "YES" : "NO",
        safeCsv(newStoredPath), safeCsv(errMsg)
      ].join(","));
    }
  }

  fs.mkdirSync(".private/recovery-reports", { recursive: true });
  const ts = Date.now();
  const reportPath = `.private/recovery-reports/applicant-file-recovery-${ts}.csv`;
  fs.writeFileSync(reportPath, reportLines.join("\n"), "utf8");

  console.log("\n=== Summary ===");
  console.log("Total mapping rows:", rows.length);
  console.log("Already cloud (skipped):", skippedAlreadyCloud);
  console.log("Local found:", foundLocal);
  console.log("Local missing:", missingLocal);
  console.log("Uploaded:", dryRun ? "(dry-run)" : uploadedCount);
  console.log("DB updated:", dryRun ? "(dry-run)" : updatedCount);
  console.log("Report written:", reportPath);

  if (dryRun) {
    console.log("\nRun again WITHOUT --dry-run to upload + update DB.");
  } else {
    console.log("\nDone! Validate downloads in the app, then consider deleting local copies.");
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
