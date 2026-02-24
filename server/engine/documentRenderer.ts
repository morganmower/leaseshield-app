import * as path from 'path';
import * as fs from 'fs';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { renderOfficialOverlay, type OverlayField, type RenderStrategy } from './officialOverlayRenderer';
import { runOfficialOverlayGuardrails, computeSha256, assertBasePdfReadable } from './overlayGuardrails';
import { resolveForm, getOverlayData } from './index';

export type DocumentRenderInput = {
  templateId?: string;
  noticeFormKey?: string;
  inputs: Record<string, string | number | boolean>;
  gateAnswers?: Record<string, string>;
  serviceSelection?: Record<string, boolean>;
  dateCalc?: any;
  userId?: string;
  format?: 'pdf' | 'docx';
};

export type DocumentRenderResult = {
  buffer: Buffer;
  contentType: 'application/pdf' | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  filename: string;
  renderModeUsed: 'official_pdf_overlay' | 'leaseshield_formatted';
  renderStrategyUsed?: RenderStrategy;
  basePdfSha256?: string;
  outputPdfSha256?: string;
  pageCount?: number;
};

export async function renderDocument(input: DocumentRenderInput): Promise<DocumentRenderResult> {
  if (input.noticeFormKey) {
    return renderFromNoticeForm(input);
  }

  if (input.templateId) {
    return renderFromTemplate(input);
  }

  throw new Error('[DocumentRenderer] Either templateId or noticeFormKey is required');
}

async function renderFromNoticeForm(input: DocumentRenderInput): Promise<DocumentRenderResult> {
  const formKey = input.noticeFormKey!;
  const def = await resolveForm(formKey);
  const outputMode = def.outputTemplate?.mode || 'leaseshield_formatted';

  if (outputMode !== 'official_pdf_overlay') {
    throw new Error(`[DocumentRenderer] Notice form "${formKey}" is not configured for official_pdf_overlay. Use leaseshield_formatted path instead.`);
  }

  if (!def.outputTemplate?.basePdfAttachmentPath) {
    throw new Error(`[DocumentRenderer] Notice form "${formKey}" has no basePdfAttachmentPath set.`);
  }

  const basePdfPath = path.resolve(process.cwd(), def.outputTemplate.basePdfAttachmentPath);
  await assertBasePdfReadable(basePdfPath);

  const overlayData = getOverlayData({
    def,
    inputs: input.inputs,
    serviceSelection: input.serviceSelection || {},
    dateCalc: input.dateCalc || null,
  });

  const renderStrategy: RenderStrategy = (def.outputTemplate as any).renderStrategy || 'form_fields';

  const basePdfBytes = fs.readFileSync(basePdfPath);
  const basePdfSha256 = computeSha256(basePdfBytes);

  const result = await renderOfficialOverlay({
    basePdfPath,
    overlayData,
    renderStrategy,
  });

  const guardrailResult = await runOfficialOverlayGuardrails({
    outputBuffer: result.buffer,
    basePdfPath,
    strict: false,
  });

  if (!guardrailResult.passed) {
    console.warn(`[DocumentRenderer] Guardrail violations in "${formKey}" output:`, guardrailResult.violations);
  }

  const outputPdfSha256 = computeSha256(result.buffer);
  const safeTitle = def.form.displayName.replace(/[^a-zA-Z0-9]/g, '_');

  return {
    buffer: result.buffer,
    contentType: 'application/pdf',
    filename: `${safeTitle}.pdf`,
    renderModeUsed: 'official_pdf_overlay',
    renderStrategyUsed: result.strategyUsed,
    basePdfSha256,
    outputPdfSha256,
    pageCount: result.pageCount,
  };
}

async function renderFromTemplate(input: DocumentRenderInput): Promise<DocumentRenderResult> {
  const templateRow = await db.execute(sql`
    SELECT t.id, t.title, t.state_id, t.output_template_id,
           ot.mode, ot.base_pdf_attachment_path, ot.render_strategy, ot.page_count,
           nf.key as notice_form_key
    FROM templates t
    LEFT JOIN output_templates ot ON t.output_template_id = ot.id
    LEFT JOIN notice_form_versions nfv ON ot.form_version_id = nfv.id
    LEFT JOIN notice_forms nf ON nfv.form_id = nf.id
    WHERE t.id = ${input.templateId}
    LIMIT 1
  `);

  if (!templateRow.rows.length) {
    throw new Error(`[DocumentRenderer] Template not found: ${input.templateId}`);
  }

  const row = templateRow.rows[0] as any;

  if (row.output_template_id && row.mode === 'official_pdf_overlay') {
    const noticeFormKey = row.notice_form_key;
    if (!noticeFormKey) {
      throw new Error(`[DocumentRenderer] Template ${input.templateId} has output_template_id but no linked notice_form_key`);
    }

    return renderFromNoticeForm({ ...input, noticeFormKey });
  }

  throw new Error(
    `[DocumentRenderer] Template "${row.title}" has no official overlay config. ` +
    `Use the leaseshield_formatted pipeline (generateDocument/generateDocumentDOCX) directly.`
  );
}

export async function saveRenderProvenance(
  docId: string,
  provenance: {
    renderModeUsed: string;
    renderStrategyUsed?: string;
    basePdfSha256?: string;
    outputPdfSha256?: string;
  }
): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE generated_notice_documents
      SET
        render_mode_used = ${provenance.renderModeUsed},
        render_strategy_used = ${provenance.renderStrategyUsed || null},
        base_pdf_sha256 = ${provenance.basePdfSha256 || null},
        output_pdf_sha256 = ${provenance.outputPdfSha256 || null}
      WHERE id = ${docId}
    `);
  } catch (e: any) {
    console.warn(`[DocumentRenderer] Failed to save provenance for doc ${docId}: ${e.message}`);
  }
}
