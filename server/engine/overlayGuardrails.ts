import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { createRequire } from 'module';

const _require = createRequire(import.meta.url);

const BANNED_STRINGS = [
  'LeaseShield',
  'State-Specific Legal Forms',
  'Document Version',
  'Generated:',
  'For informational purposes',
  'leaseshield',
  'mmower21@gmail.com',
];

const EMAIL_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

export type GuardrailViolation = {
  type: 'banned_string' | 'email_found' | 'page_count_mismatch' | 'base_pdf_missing';
  detail: string;
};

export type GuardrailResult = {
  passed: boolean;
  violations: GuardrailViolation[];
};

export async function runOfficialOverlayGuardrails(config: {
  outputBuffer: Buffer;
  basePdfPath: string;
  strict?: boolean;
}): Promise<GuardrailResult> {
  const violations: GuardrailViolation[] = [];
  const resolvedBasePath = path.resolve(config.basePdfPath);

  if (!fs.existsSync(resolvedBasePath)) {
    violations.push({ type: 'base_pdf_missing', detail: `Base PDF not found: ${resolvedBasePath}` });
    if (config.strict) {
      throw new Error(`[OverlayGuardrails] Base PDF missing: ${resolvedBasePath}`);
    }
    return { passed: false, violations };
  }

  const baseBytes = fs.readFileSync(resolvedBasePath);
  const basePdfDoc = await PDFDocument.load(baseBytes);
  const basePdfPageCount = basePdfDoc.getPageCount();

  const outputPdfDoc = await PDFDocument.load(config.outputBuffer);
  const outputPageCount = outputPdfDoc.getPageCount();

  if (outputPageCount !== basePdfPageCount) {
    violations.push({
      type: 'page_count_mismatch',
      detail: `Base PDF has ${basePdfPageCount} page(s), output has ${outputPageCount} page(s)`,
    });
  }

  const textViolations = await scanTextContent(config.outputBuffer);
  violations.push(...textViolations);

  const bytesViolations = scanRawBytes(config.outputBuffer);
  for (const bv of bytesViolations) {
    const alreadyFound = violations.some(v => v.type === bv.type && v.detail === bv.detail);
    if (!alreadyFound) {
      violations.push(bv);
    }
  }

  const passed = violations.length === 0;

  if (!passed) {
    console.warn(`[OverlayGuardrails] ${violations.length} violation(s) found in overlay output:`);
    for (const v of violations) {
      console.warn(`  [${v.type}] ${v.detail}`);
    }
    if (config.strict) {
      throw new Error(`[OverlayGuardrails] Official overlay output failed guardrails: ${violations.map(v => v.detail).join('; ')}`);
    }
  }

  return { passed, violations };
}

async function scanTextContent(pdfBuffer: Buffer): Promise<GuardrailViolation[]> {
  const violations: GuardrailViolation[] = [];

  try {
    const pdfParse: (buf: Buffer) => Promise<{ text: string }> = _require('pdf-parse');
    const data = await pdfParse(pdfBuffer);
    const text = data.text || '';

    for (const banned of BANNED_STRINGS) {
      if (text.includes(banned)) {
        violations.push({
          type: 'banned_string',
          detail: `Text extraction found banned string: "${banned}"`,
        });
      }
    }

    const emails = text.match(EMAIL_PATTERN) || [];
    for (const email of emails) {
      violations.push({
        type: 'email_found',
        detail: `Text extraction found email address: "${email}"`,
      });
    }
  } catch (e: any) {
    console.warn(`[OverlayGuardrails] Text extraction failed (raw bytes scan still active): ${e.message}`);
  }

  return violations;
}

function scanRawBytes(pdfBuffer: Buffer): GuardrailViolation[] {
  const violations: GuardrailViolation[] = [];
  const rawText = pdfBuffer.toString('latin1');

  for (const banned of BANNED_STRINGS) {
    if (rawText.includes(banned)) {
      violations.push({
        type: 'banned_string',
        detail: `Raw bytes scan found banned string: "${banned}"`,
      });
    }
  }

  const emails = rawText.match(EMAIL_PATTERN) || [];
  for (const email of emails) {
    const isKnownFormField = email.includes('electronic service');
    if (!isKnownFormField) {
      violations.push({
        type: 'email_found',
        detail: `Raw bytes scan found email address: "${email}"`,
      });
    }
  }

  return violations;
}

export function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function assertBasePdfReadable(basePdfPath: string): Promise<void> {
  const resolvedPath = path.resolve(basePdfPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`[OfficialOverlay] Base PDF does not exist: ${resolvedPath}`);
  }
  try {
    fs.accessSync(resolvedPath, fs.constants.R_OK);
  } catch {
    throw new Error(`[OfficialOverlay] Base PDF is not readable: ${resolvedPath}`);
  }
}
