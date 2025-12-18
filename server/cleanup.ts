import { db } from "./db";
import { storage } from "./storage";
import { 
  rentalSubmissionFiles, 
  rentalSubmissionPeople, 
  rentalSubmissions, 
  rentalApplicationLinks, 
  rentalUnits, 
  rentalProperties 
} from "@shared/schema";
import { eq, and, lt, sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

const DEFAULT_RETENTION = {
  deniedUploadsDays: 730,
  deniedBankStatementsDays: 120,
  approvedUploadsDays: 2555,
  approvedBankStatementsDays: 730,
};

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function safeUnlink(filePath: string): boolean {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (e) {
    console.warn("[CLEANUP] Failed to delete file:", filePath, e);
    return false;
  }
}

function getRetentionDays(
  submissionStatus: string | null,
  fileType: string,
  retentionSettings: typeof DEFAULT_RETENTION
): number {
  const status = (submissionStatus || "").toLowerCase();
  const isBank = fileType === "bank_statements";

  if (status === "approved") {
    return isBank ? retentionSettings.approvedBankStatementsDays : retentionSettings.approvedUploadsDays;
  }
  return isBank ? retentionSettings.deniedBankStatementsDays : retentionSettings.deniedUploadsDays;
}

interface CleanupResult {
  scannedCount: number;
  deletedCount: number;
  elapsedMs: number;
}

export async function runUploadCleanup(): Promise<CleanupResult> {
  const started = Date.now();
  let scannedCount = 0;
  let deletedCount = 0;

  try {
    const files = await db.execute(sql`
      SELECT
        sf.id as file_id,
        sf.stored_path,
        sf.file_type,
        sf.created_at as file_created_at,
        s.status as submission_status,
        rp.id as property_id
      FROM rental_submission_files sf
      JOIN rental_submission_people sp ON sp.id = sf.person_id
      JOIN rental_submissions s ON s.id = sp.submission_id
      JOIN rental_application_links al ON al.id = s.application_link_id
      JOIN rental_units u ON u.id = al.unit_id
      JOIN rental_properties rp ON rp.id = u.property_id
    `);

    const allSettings = await storage.getAllRetentionSettings();
    const settingsMap = new Map(allSettings.map((s) => [s.propertyId, s]));

    scannedCount = files.rows.length;

    for (const row of files.rows) {
      const propertyId = row.property_id as string;
      const retentionRow = settingsMap.get(propertyId) || DEFAULT_RETENTION;

      const keepDays = getRetentionDays(
        row.submission_status as string | null,
        row.file_type as string,
        {
          deniedUploadsDays: retentionRow.deniedUploadsDays,
          deniedBankStatementsDays: retentionRow.deniedBankStatementsDays,
          approvedUploadsDays: retentionRow.approvedUploadsDays,
          approvedBankStatementsDays: retentionRow.approvedBankStatementsDays,
        }
      );

      const cutoffDate = daysAgo(keepDays);
      const fileCreatedAt = row.file_created_at ? new Date(row.file_created_at as string) : null;

      if (fileCreatedAt && fileCreatedAt < cutoffDate) {
        const storedPath = row.stored_path as string;
        if (storedPath) {
          const diskPath = path.resolve(storedPath);
          safeUnlink(diskPath);
        }

        await db.delete(rentalSubmissionFiles).where(eq(rentalSubmissionFiles.id, row.file_id as string));
        deletedCount++;
      }
    }
  } catch (error) {
    console.error("[CLEANUP] Error during upload cleanup:", error);
  }

  const elapsedMs = Date.now() - started;
  console.log(
    `[CLEANUP] ${new Date().toISOString()} scanned=${scannedCount} deleted=${deletedCount} in ${elapsedMs}ms`
  );

  return { scannedCount, deletedCount, elapsedMs };
}

let cleanupInterval: NodeJS.Timeout | null = null;

export function startCleanupScheduler() {
  console.log("[CLEANUP] Starting cleanup scheduler...");
  
  setTimeout(() => {
    runUploadCleanup().catch((e) => console.error("[CLEANUP] startup error:", e));
  }, 5000);

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  cleanupInterval = setInterval(() => {
    runUploadCleanup().catch((e) => console.error("[CLEANUP] interval error:", e));
  }, ONE_DAY_MS);
}

export function stopCleanupScheduler() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}
