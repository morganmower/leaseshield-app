import { db } from "../db";
import { rentalSubmissionFiles, uploadedDocuments } from "@shared/schema";
import { objectStorageClient } from "../replit_integrations/object_storage/objectStorage";

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

async function main() {
  console.log("=== File Mapping Export - Disaster Recovery Backup ===");
  console.log(`Using PRIVATE_OBJECT_DIR: ${PRIVATE_OBJECT_DIR}\n`);

  // Query all records from both tables
  console.log("Querying rental_submission_files...");
  const rentalFiles = await db
    .select({
      id: rentalSubmissionFiles.id,
      person_id: rentalSubmissionFiles.personId,
      file_type: rentalSubmissionFiles.fileType,
      original_name: rentalSubmissionFiles.originalName,
      stored_path: rentalSubmissionFiles.storedPath,
      file_size: rentalSubmissionFiles.fileSize,
      mime_type: rentalSubmissionFiles.mimeType,
      created_at: rentalSubmissionFiles.createdAt,
    })
    .from(rentalSubmissionFiles);

  console.log(`Found ${rentalFiles.length} rental submission files`);

  console.log("Querying uploaded_documents...");
  const docs = await db
    .select({
      id: uploadedDocuments.id,
      user_id: uploadedDocuments.userId,
      property_id: uploadedDocuments.propertyId,
      file_name: uploadedDocuments.fileName,
      file_url: uploadedDocuments.fileUrl,
      file_type: uploadedDocuments.fileType,
      file_size: uploadedDocuments.fileSize,
      description: uploadedDocuments.description,
      created_at: uploadedDocuments.createdAt,
    })
    .from(uploadedDocuments);

  console.log(`Found ${docs.length} uploaded documents`);

  // Create the backup JSON object
  const backupData = {
    exportedAt: new Date().toISOString(),
    timestamp: Date.now(),
    rentalSubmissionFiles: rentalFiles,
    uploadedDocuments: docs,
    summary: {
      rentalSubmissionFilesCount: rentalFiles.length,
      uploadedDocumentsCount: docs.length,
      totalFilesCount: rentalFiles.length + docs.length,
    },
  };

  const jsonContent = JSON.stringify(backupData, null, 2);
  const buffer = Buffer.from(jsonContent, "utf-8");

  // Upload to object storage
  const timestamp = Date.now();
  const objectPath = `${PRIVATE_OBJECT_DIR}/backups/file-mapping-${timestamp}.json`;
  const { bucketName, objectName } = parseObjectStoragePath(objectPath);

  console.log(`\nUploading backup to object storage...`);
  console.log(`  Path: ${objectPath}`);
  console.log(`  Bucket: ${bucketName}`);
  console.log(`  Object: ${objectName}`);

  try {
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    await file.save(buffer, { contentType: "application/json", resumable: false });

    console.log(`\nBackup uploaded successfully!`);
    console.log(`\nSummary:`);
    console.log(`  - Rental submission files: ${rentalFiles.length}`);
    console.log(`  - Uploaded documents: ${docs.length}`);
    console.log(`  - Total records: ${rentalFiles.length + docs.length}`);
    console.log(`  - Backup size: ${(buffer.length / 1024).toFixed(2)} KB`);
    console.log(`  - Storage path: ${objectPath}`);

    console.log("\n=== Export complete ===");
    process.exit(0);
  } catch (err) {
    console.error("Failed to upload backup:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Export failed:", err);
  process.exit(1);
});
