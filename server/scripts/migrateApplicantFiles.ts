import { objectStorageClient } from "../replit_integrations/object_storage/objectStorage";
import fsSync from "fs";
import path from "path";

const PRIVATE_OBJECT_DIR = process.env.PRIVATE_OBJECT_DIR || "";

async function migrate() {
  const parts = PRIVATE_OBJECT_DIR.split("/").filter(Boolean);
  if (parts.length < 2) {
    console.error("PRIVATE_OBJECT_DIR not configured");
    process.exit(1);
  }

  const bucketName = parts[0];
  const prefix = parts.slice(1).join("/");
  const bucket = objectStorageClient.bucket(bucketName);

  const uploadDir = path.join(process.cwd(), "uploads/applicants");
  if (!fsSync.existsSync(uploadDir)) {
    console.log("No uploads/applicants directory found. Nothing to migrate.");
    return;
  }

  const files = fsSync.readdirSync(uploadDir);
  console.log(`Found ${files.length} files to migrate to object storage...`);

  const results: Array<{ filename: string; size: number; objectKey: string; status: string }> = [];

  for (const filename of files) {
    const localPath = path.join(uploadDir, filename);
    const stat = fsSync.statSync(localPath);
    if (!stat.isFile()) continue;

    const objectKey = `${prefix}/applicants/${filename}`;

    try {
      const fileObj = bucket.file(objectKey);
      const [exists] = await fileObj.exists();

      if (exists) {
        console.log(`  SKIP (already exists): ${filename}`);
        results.push({ filename, size: stat.size, objectKey, status: "skipped" });
        continue;
      }

      const buffer = fsSync.readFileSync(localPath);
      const ext = path.extname(filename).toLowerCase();
      let contentType = "application/octet-stream";
      if (ext === ".pdf") contentType = "application/pdf";
      else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
      else if (ext === ".png") contentType = "image/png";

      await fileObj.save(buffer, {
        resumable: false,
        contentType,
        metadata: {
          metadata: { originalName: filename, migratedFrom: "local-disk" },
        },
      });

      console.log(`  OK: ${filename} -> ${objectKey} (${stat.size} bytes)`);
      results.push({ filename, size: stat.size, objectKey, status: "uploaded" });
    } catch (err) {
      console.error(`  FAIL: ${filename}:`, err);
      results.push({ filename, size: stat.size, objectKey, status: "error" });
    }
  }

  console.log("\n--- Migration Summary ---");
  const uploaded = results.filter(r => r.status === "uploaded").length;
  const skipped = results.filter(r => r.status === "skipped").length;
  const errors = results.filter(r => r.status === "error").length;
  console.log(`Uploaded: ${uploaded}, Skipped: ${skipped}, Errors: ${errors}`);
  console.log(`Total: ${results.length} files processed`);

  const reportPath = path.join(process.cwd(), "orphan-migration-report.json");
  fsSync.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`Report saved to: ${reportPath}`);
}

migrate().then(() => process.exit(0)).catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
