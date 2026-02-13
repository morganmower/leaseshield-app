import { objectStorageClient } from "./replit_integrations/object_storage/objectStorage";
import { randomUUID } from "crypto";
import path from "path";

function parseObjectStoragePath(fullPath: string): { bucketName: string; objectName: string } {
  const normalized = fullPath.startsWith("/") ? fullPath : `/${fullPath}`;
  const parts = normalized.split("/");
  if (parts.length < 3) throw new Error("Invalid object storage path");
  return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
}

function getPrivateDir(): string {
  const dir = process.env.PRIVATE_OBJECT_DIR;
  if (!dir) throw new Error("PRIVATE_OBJECT_DIR not configured — file storage unavailable");
  return dir;
}

export interface UploadResult {
  storedPath: string;
  verified: boolean;
  fileSize: number;
  checksum: string;
}

export interface FileHealthStatus {
  id: string;
  originalName: string;
  storedPath: string;
  exists: boolean;
  sizeMatch: boolean;
  expectedSize: number | null;
  actualSize: number | null;
  error?: string;
}

async function computeChecksum(buffer: Buffer): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(buffer).digest("hex").slice(0, 16);
}

export async function uploadFileToCloud(
  buffer: Buffer,
  folder: string,
  originalName: string,
  mimeType: string
): Promise<UploadResult> {
  const privateDir = getPrivateDir();
  const uniqueId = randomUUID();
  const ext = path.extname(originalName).toLowerCase();
  const objectPath = `${privateDir}/${folder}/${uniqueId}${ext}`;
  const { bucketName, objectName } = parseObjectStoragePath(objectPath);
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);

  await file.save(buffer, { contentType: mimeType, resumable: false });

  const [exists] = await file.exists();
  if (!exists) {
    throw new Error(`UPLOAD VERIFICATION FAILED: File not found after upload at ${objectPath}`);
  }

  const [metadata] = await file.getMetadata();
  const actualSize = parseInt(String(metadata.size || "0"), 10);
  if (Math.abs(actualSize - buffer.length) > 1) {
    try { await file.delete(); } catch {}
    throw new Error(
      `UPLOAD VERIFICATION FAILED: Size mismatch — expected ${buffer.length} bytes, got ${actualSize} bytes. Upload was rolled back.`
    );
  }

  const checksum = await computeChecksum(buffer);

  console.log(
    `[FileStorage] UPLOAD OK: ${originalName} -> ${objectPath} (${buffer.length} bytes, checksum: ${checksum})`
  );

  return {
    storedPath: objectPath,
    verified: true,
    fileSize: buffer.length,
    checksum,
  };
}

export async function downloadFileFromCloud(
  storedPath: string,
  res: any,
  originalName: string,
  mimeType?: string | null
): Promise<void> {
  if (storedPath.startsWith("uploads/") || storedPath.startsWith("/home/")) {
    res.status(404).json({
      message: "This file was stored locally and is no longer available. The applicant may need to re-upload it.",
      recoverable: false,
    });
    return;
  }

  const { bucketName, objectName } = parseObjectStoragePath(storedPath);
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);

  const [exists] = await file.exists();
  if (!exists) {
    console.error(`[FileStorage] DOWNLOAD FAIL: File not found at ${storedPath}`);
    res.status(404).json({
      message: "File not found in storage. It may have been deleted or corrupted.",
      recoverable: false,
    });
    return;
  }

  const [metadata] = await file.getMetadata();
  const contentType = mimeType || metadata.contentType || "application/octet-stream";
  const safeName = originalName.replace(/[^\w\s.-]/g, "_");

  res.set({
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${safeName}"`,
    "Content-Length": metadata.size,
  });

  const stream = file.createReadStream();
  stream.on("error", (err) => {
    console.error(`[FileStorage] STREAM ERROR for ${storedPath}:`, err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Error streaming file" });
    }
  });
  stream.pipe(res);
}

export async function deleteFileFromCloud(storedPath: string): Promise<boolean> {
  if (storedPath.startsWith("uploads/") || storedPath.startsWith("/home/")) {
    return true;
  }

  try {
    const { bucketName, objectName } = parseObjectStoragePath(storedPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
      console.log(`[FileStorage] DELETE OK: ${storedPath}`);
    }
    return true;
  } catch (e) {
    console.error(`[FileStorage] DELETE FAIL: ${storedPath}`, e);
    return false;
  }
}

export async function checkFileHealth(
  id: string,
  originalName: string,
  storedPath: string,
  expectedSize: number | null
): Promise<FileHealthStatus> {
  const result: FileHealthStatus = {
    id,
    originalName,
    storedPath,
    exists: false,
    sizeMatch: false,
    expectedSize,
    actualSize: null,
  };

  if (storedPath.startsWith("uploads/") || storedPath.startsWith("/home/")) {
    result.error = "File stored on local disk (not cloud) — not recoverable from this environment";
    return result;
  }

  try {
    const { bucketName, objectName } = parseObjectStoragePath(storedPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    const [exists] = await file.exists();
    result.exists = exists;

    if (exists) {
      const [metadata] = await file.getMetadata();
      result.actualSize = parseInt(String(metadata.size || "0"), 10);
      if (expectedSize !== null) {
        result.sizeMatch = Math.abs(result.actualSize - expectedSize) <= 1;
      } else {
        result.sizeMatch = result.actualSize > 0;
      }
    } else {
      result.error = "File not found in cloud storage";
    }
  } catch (e: any) {
    result.error = e.message || "Unknown error checking file";
  }

  return result;
}
