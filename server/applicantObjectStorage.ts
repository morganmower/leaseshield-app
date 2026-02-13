import { objectStorageClient } from "./replit_integrations/object_storage/objectStorage";

const PRIVATE_OBJECT_DIR = process.env.PRIVATE_OBJECT_DIR || "";

function getBucketAndPrefix() {
  const parts = PRIVATE_OBJECT_DIR.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error("PRIVATE_OBJECT_DIR not properly configured");
  }
  const bucketName = parts[0];
  const prefix = parts.slice(1).join("/");
  return { bucketName, prefix };
}

export function getApplicantObjectKey(filename: string): string {
  const { prefix } = getBucketAndPrefix();
  return `${prefix}/applicants/${filename}`;
}

export function toDbPath(objectKey: string): string {
  const { bucketName } = getBucketAndPrefix();
  return `/${bucketName}/${objectKey}`;
}

export function isObjstorePath(storedPath: string): boolean {
  try {
    const { bucketName } = getBucketAndPrefix();
    return storedPath.startsWith(`/${bucketName}/`);
  } catch {
    return false;
  }
}

export function dbPathToObjectKey(dbPath: string): string {
  const parts = dbPath.split("/").filter(Boolean);
  return parts.slice(1).join("/");
}

export function dbPathToBucketName(dbPath: string): string {
  const parts = dbPath.split("/").filter(Boolean);
  return parts[0];
}

export async function uploadApplicantBuffer(
  buffer: Buffer,
  filename: string,
  contentType: string,
  originalName: string
): Promise<{ objectKey: string; dbPath: string }> {
  const { bucketName } = getBucketAndPrefix();
  const objectKey = getApplicantObjectKey(filename);
  const bucket = objectStorageClient.bucket(bucketName);
  const blob = bucket.file(objectKey);

  await blob.save(buffer, {
    resumable: false,
    contentType,
    metadata: {
      metadata: { originalName },
    },
  });

  return {
    objectKey,
    dbPath: toDbPath(objectKey),
  };
}

export async function downloadApplicantStream(dbPath: string) {
  const objectKey = dbPathToObjectKey(dbPath);
  const bucketName = dbPathToBucketName(dbPath);
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectKey);

  const [exists] = await file.exists();
  if (!exists) {
    return null;
  }

  return file.createReadStream();
}

export async function deleteApplicantObject(dbPath: string): Promise<boolean> {
  try {
    const objectKey = dbPathToObjectKey(dbPath);
    const bucketName = dbPathToBucketName(dbPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectKey);
    await file.delete();
    return true;
  } catch (e) {
    console.error("Error deleting object from storage:", e);
    return false;
  }
}

export async function objectExists(dbPath: string): Promise<boolean> {
  try {
    const objectKey = dbPathToObjectKey(dbPath);
    const bucketName = dbPathToBucketName(dbPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectKey);
    const [exists] = await file.exists();
    return exists;
  } catch {
    return false;
  }
}
