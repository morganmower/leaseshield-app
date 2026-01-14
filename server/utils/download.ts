import type { Response } from "express";
import JSZip from "jszip";

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

/**
 * Validates DOCX structural integrity by checking required OPC parts exist.
 * Ensures no dangling footer/header relationships that would cause Word errors.
 * Throws an error with diagnostic info if validation fails.
 */
export async function assertValidDocx(buf: Buffer): Promise<void> {
  try {
    const zip = await JSZip.loadAsync(buf);

    const required = ["[Content_Types].xml", "_rels/.rels", "word/document.xml"];
    for (const f of required) {
      if (!zip.file(f)) {
        throw new Error(`DOCX missing required part: ${f}`);
      }
    }

    const relsFile = zip.file("word/_rels/document.xml.rels");
    if (relsFile) {
      const relsXml = await relsFile.async("text");
      
      const footerRegex = /Target="(footer\d+\.xml)"/g;
      let footerMatch;
      while ((footerMatch = footerRegex.exec(relsXml)) !== null) {
        const ft = footerMatch[1];
        if (!zip.file(`word/${ft}`)) {
          throw new Error(`DOCX references missing footer part: word/${ft}`);
        }
      }
      
      const headerRegex = /Target="(header\d+\.xml)"/g;
      let headerMatch;
      while ((headerMatch = headerRegex.exec(relsXml)) !== null) {
        const ht = headerMatch[1];
        if (!zip.file(`word/${ht}`)) {
          throw new Error(`DOCX references missing header part: word/${ht}`);
        }
      }
    }

    console.log(`✅ DOCX structural validation passed (${buf.length} bytes)`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("DOCX")) {
      throw error;
    }
    throw new Error(`DOCX validation failed: unable to parse as ZIP. ${error}`);
  }
}
