import type { Response } from "express";

/**
 * Safe binary download helper for DOCX and PDF files.
 * Ensures proper headers and uses res.end() for unambiguous binary delivery.
 */
export function sendBinaryDownload(
  res: Response,
  opts: {
    buffer: Buffer;
    filename: string;
    contentType: string;
    cacheControl?: string;
  }
) {
  const { buffer, filename, contentType } = opts;

  res.status(200);
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", String(buffer.length));
  res.setHeader("Cache-Control", opts.cacheControl ?? "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  logBinaryResponse(contentType.includes("pdf") ? "PDF" : "DOCX", buffer);

  res.end(buffer);
}

/**
 * Validates that a buffer looks like a valid DOCX file (ZIP format with PK header).
 * Throws an error with diagnostic info if validation fails.
 */
export function assertLooksLikeDocx(buf: Buffer): void {
  if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
    const head = buf.subarray(0, 64).toString("utf8");
    throw new Error(`DOCX validation failed: missing PK (ZIP) header. Buffer head: ${JSON.stringify(head)}`);
  }
}

/**
 * Validates that a buffer looks like a valid PDF file (%PDF header).
 * Throws an error with diagnostic info if validation fails.
 */
export function assertLooksLikePdf(buf: Buffer): void {
  if (buf.length < 4 || buf.subarray(0, 4).toString("utf8") !== "%PDF") {
    const head = buf.subarray(0, 64).toString("utf8");
    throw new Error(`PDF validation failed: missing %PDF header. Buffer head: ${JSON.stringify(head)}`);
  }
}

/**
 * Logs binary response details for debugging download issues.
 * Shows buffer size and first 16 bytes to help identify corruption.
 */
function logBinaryResponse(label: string, buf: Buffer): void {
  const head = buf.subarray(0, 16).toString("utf8").replace(/\s/g, " ");
  console.log(`📦 [${label} Download] bytes=${buf.length} head="${head}"`);
}

export const CONTENT_TYPES = {
  PDF: "application/pdf",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;
