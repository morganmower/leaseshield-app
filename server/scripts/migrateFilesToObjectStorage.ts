import { db } from "../db";
import { rentalSubmissionFiles, uploadedDocuments } from "@shared/schema";
import { eq, like, or } from "drizzle-orm";
import { objectStorageClient } from "../replit_integrations/object_storage/objectStorage";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs/promises";

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

async function uploadBuffer(buffer: Buffer, folder: string, originalExt: string, mimeType: string): Promise<string> {
  const uniqueId = randomUUID();
  const objectPath = `${PRIVATE_OBJECT_DIR}/${folder}/${uniqueId}${originalExt}`;
  const { bucketName, objectName } = parseObjectStoragePath(objectPath);
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);
  await file.save(buffer, { contentType: mimeType, resumable: false });
  return objectPath;
}

async function migrateRentalSubmissionFiles() {
  const files = await db
    .select()
    .from(rentalSubmissionFiles)
    .where(like(rentalSubmissionFiles.storedPath, "uploads/%"));

  console.log(`Found ${files.length} rental submission files to migrate`);

  let success = 0;
  let failed = 0;
  let missing = 0;

  for (const file of files) {
    const localPath = path.resolve(file.storedPath);
    try {
      await fs.access(localPath);
    } catch {
      console.warn(`  MISSING: ${file.originalName} (${file.storedPath})`);
      missing++;
      continue;
    }

    try {
      const buffer = await fs.readFile(localPath);
      const ext = path.extname(file.storedPath).toLowerCase();
      const mimeType = file.mimeType || "application/octet-stream";
      const newPath = await uploadBuffer(buffer, "applicants", ext, mimeType);

      await db
        .update(rentalSubmissionFiles)
        .set({ storedPath: newPath })
        .where(eq(rentalSubmissionFiles.id, file.id));

      console.log(`  OK: ${file.originalName} -> ${newPath}`);
      success++;
    } catch (err) {
      console.error(`  FAIL: ${file.originalName}: ${err}`);
      failed++;
    }
  }

  console.log(`\nRental submission files: ${success} migrated, ${missing} missing from disk, ${failed} failed`);
}

async function migrateUploadedDocuments() {
  const docs = await db
    .select()
    .from(uploadedDocuments)
    .where(like(uploadedDocuments.fileUrl, "uploads/%"));

  console.log(`Found ${docs.length} uploaded documents to migrate`);

  let success = 0;
  let failed = 0;
  let missing = 0;

  for (const doc of docs) {
    const localPath = path.resolve(doc.fileUrl);
    try {
      await fs.access(localPath);
    } catch {
      console.warn(`  MISSING: ${doc.fileName} (${doc.fileUrl})`);
      missing++;
      continue;
    }

    try {
      const buffer = await fs.readFile(localPath);
      const ext = path.extname(doc.fileUrl).toLowerCase();
      const mimeType = doc.fileType || "application/octet-stream";
      const newPath = await uploadBuffer(buffer, "documents", ext, mimeType);

      await db
        .update(uploadedDocuments)
        .set({ fileUrl: newPath })
        .where(eq(uploadedDocuments.id, doc.id));

      console.log(`  OK: ${doc.fileName} -> ${newPath}`);
      success++;
    } catch (err) {
      console.error(`  FAIL: ${doc.fileName}: ${err}`);
      failed++;
    }
  }

  console.log(`\nUploaded documents: ${success} migrated, ${missing} missing from disk, ${failed} failed`);
}

async function main() {
  console.log("=== File Migration: Local Disk -> Object Storage ===");
  console.log(`Using PRIVATE_OBJECT_DIR: ${PRIVATE_OBJECT_DIR}\n`);

  await migrateRentalSubmissionFiles();
  console.log("");
  await migrateUploadedDocuments();

  console.log("\n=== Migration complete ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
