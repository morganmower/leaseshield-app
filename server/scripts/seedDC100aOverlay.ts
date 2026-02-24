import { db } from "../db";
import { randomUUID } from "crypto";
import { outputTemplates, overlayFields, noticeFormVersions, noticeForms } from "@shared/schema";
import { eq } from "drizzle-orm";

async function seedOverlay() {
  console.log('Updating MI DC 100a to official_pdf_overlay mode...');

  const form = await db.select().from(noticeForms)
    .where(eq(noticeForms.key, 'mi_dc_100a_demand_possession_nonpayment'));

  if (form.length === 0) {
    console.error('MI DC 100a form not found. Run seedMichiganDC100a.ts first.');
    process.exit(1);
  }

  const formId = form[0].id;
  const versions = await db.select().from(noticeFormVersions)
    .where(eq(noticeFormVersions.formId, formId));

  if (versions.length === 0) {
    console.error('No version found for MI DC 100a.');
    process.exit(1);
  }

  const versionId = versions[0].id;

  const existing = await db.select().from(outputTemplates)
    .where(eq(outputTemplates.formVersionId, versionId));

  let outputTemplateId: string;

  if (existing.length > 0) {
    outputTemplateId = existing[0].id;
    await db.update(outputTemplates)
      .set({
        mode: 'official_pdf_overlay',
        basePdfAttachmentPath: 'server/assets/court-forms/MI_DC_100a.pdf',
        htmlTemplate: null,
        pageCount: 1,
      } as any)
      .where(eq(outputTemplates.id, outputTemplateId));
    console.log(`Updated output template ${outputTemplateId} to official_pdf_overlay`);

    await db.delete(overlayFields)
      .where(eq(overlayFields.outputTemplateId, outputTemplateId));
    console.log('Cleared existing overlay fields');
  } else {
    outputTemplateId = randomUUID();
    await db.insert(outputTemplates).values({
      id: outputTemplateId,
      formVersionId: versionId,
      mode: 'official_pdf_overlay',
      basePdfAttachmentPath: 'server/assets/court-forms/MI_DC_100a.pdf',
      htmlTemplate: null,
      docxTemplateAttachmentPath: null,
      pageCount: 1,
    } as any);
    console.log(`Created output template ${outputTemplateId}`);
  }

  const leftColW = (612 - 72) * 0.55;
  const maxLeftField = leftColW - 12;

  const fields: Array<{
    fieldKey: string;
    pageNumber: number;
    x: number;
    y: number;
    font: string;
    fontSize: number;
    maxWidth: number | null;
    align: string;
    wrap: boolean;
  }> = [
    { fieldKey: 'plaintiff_name', pageNumber: 1, x: 40, y: 701, font: 'Helvetica', fontSize: 9, maxWidth: Math.floor(maxLeftField), align: 'left', wrap: false },
    { fieldKey: 'plaintiff_address', pageNumber: 1, x: 40, y: 689, font: 'Helvetica', fontSize: 8, maxWidth: 145, align: 'left', wrap: false },
    { fieldKey: 'plaintiff_phone', pageNumber: 1, x: 190, y: 689, font: 'Helvetica', fontSize: 8, maxWidth: 100, align: 'left', wrap: false },
    { fieldKey: 'plaintiff_city_state_zip', pageNumber: 1, x: 40, y: 677, font: 'Helvetica', fontSize: 8, maxWidth: Math.floor(maxLeftField), align: 'left', wrap: false },

    { fieldKey: 'defendant_name', pageNumber: 1, x: 40, y: 651, font: 'Helvetica', fontSize: 9, maxWidth: Math.floor(maxLeftField), align: 'left', wrap: false },
    { fieldKey: 'defendant_address', pageNumber: 1, x: 40, y: 639, font: 'Helvetica', fontSize: 8, maxWidth: Math.floor(maxLeftField), align: 'left', wrap: false },
    { fieldKey: 'defendant_city_state_zip', pageNumber: 1, x: 40, y: 627, font: 'Helvetica', fontSize: 8, maxWidth: Math.floor(maxLeftField), align: 'left', wrap: false },

    { fieldKey: 'premises_address', pageNumber: 1, x: 80, y: 553, font: 'Helvetica', fontSize: 9, maxWidth: 492, align: 'left', wrap: false },
    { fieldKey: 'premises_city', pageNumber: 1, x: 62, y: 537, font: 'Helvetica', fontSize: 9, maxWidth: 190, align: 'left', wrap: false },
    { fieldKey: 'premises_county', pageNumber: 1, x: 304, y: 537, font: 'Helvetica', fontSize: 9, maxWidth: 130, align: 'left', wrap: false },

    { fieldKey: 'rent_period_from', pageNumber: 1, x: 120, y: 380, font: 'Helvetica', fontSize: 9, maxWidth: 120, align: 'left', wrap: false },
    { fieldKey: 'rent_period_to', pageNumber: 1, x: 286, y: 380, font: 'Helvetica', fontSize: 9, maxWidth: 120, align: 'left', wrap: false },
    { fieldKey: 'monthly_rent_amount', pageNumber: 1, x: 154, y: 364, font: 'Helvetica', fontSize: 9, maxWidth: 140, align: 'left', wrap: false },
    { fieldKey: 'rent_amount_due', pageNumber: 1, x: 181, y: 348, font: 'Helvetica', fontSize: 9, maxWidth: 140, align: 'left', wrap: false },

    { fieldKey: 'service_checkbox_personal', pageNumber: 1, x: 50, y: 287, font: 'HelveticaBold', fontSize: 10, maxWidth: null, align: 'left', wrap: false },
    { fieldKey: 'service_checkbox_first_class_mail', pageNumber: 1, x: 50, y: 274, font: 'HelveticaBold', fontSize: 10, maxWidth: null, align: 'left', wrap: false },
    { fieldKey: 'service_checkbox_posting', pageNumber: 1, x: 50, y: 261, font: 'HelveticaBold', fontSize: 10, maxWidth: null, align: 'left', wrap: false },

    { fieldKey: 'service_date', pageNumber: 1, x: 114, y: 242, font: 'Helvetica', fontSize: 9, maxWidth: 140, align: 'left', wrap: false },
    { fieldKey: 'server_name', pageNumber: 1, x: 436, y: 242, font: 'Helvetica', fontSize: 9, maxWidth: 136, align: 'left', wrap: false },

    { fieldKey: 'signature_date', pageNumber: 1, x: 476, y: 188, font: 'Helvetica', fontSize: 9, maxWidth: 100, align: 'left', wrap: false },
    { fieldKey: 'plaintiff_name_print', pageNumber: 1, x: 96, y: 172, font: 'Helvetica', fontSize: 9, maxWidth: 210, align: 'left', wrap: false },
    { fieldKey: 'plaintiff_phone_sig', pageNumber: 1, x: 394, y: 172, font: 'Helvetica', fontSize: 9, maxWidth: 182, align: 'left', wrap: false },
    { fieldKey: 'plaintiff_address_sig', pageNumber: 1, x: 80, y: 156, font: 'Helvetica', fontSize: 9, maxWidth: 496, align: 'left', wrap: true },
  ];

  for (const f of fields) {
    await db.insert(overlayFields).values({
      id: randomUUID(),
      outputTemplateId,
      ...f,
    } as any);
  }

  console.log(`Inserted ${fields.length} overlay fields`);
  console.log('MI DC 100a overlay setup complete!');
  process.exit(0);
}

seedOverlay().catch(err => {
  console.error('Seed overlay failed:', err);
  process.exit(1);
});
