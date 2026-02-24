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
    { fieldKey: 'plaintiff_name', pageNumber: 1, x: 40, y: 696, font: 'Helvetica', fontSize: 9, maxWidth: 234, align: 'left', wrap: false },
    { fieldKey: 'plaintiff_address', pageNumber: 1, x: 40, y: 684, font: 'Helvetica', fontSize: 8, maxWidth: 120, align: 'left', wrap: false },
    { fieldKey: 'plaintiff_city_state_zip', pageNumber: 1, x: 40, y: 672, font: 'Helvetica', fontSize: 8, maxWidth: 234, align: 'left', wrap: false },
    { fieldKey: 'plaintiff_phone', pageNumber: 1, x: 160, y: 684, font: 'Helvetica', fontSize: 8, maxWidth: 100, align: 'left', wrap: false },

    { fieldKey: 'case_number', pageNumber: 1, x: 356, y: 707, font: 'Helvetica', fontSize: 9, maxWidth: 200, align: 'left', wrap: false },

    { fieldKey: 'defendant_name', pageNumber: 1, x: 40, y: 651, font: 'Helvetica', fontSize: 9, maxWidth: 234, align: 'left', wrap: false },
    { fieldKey: 'defendant_address', pageNumber: 1, x: 40, y: 639, font: 'Helvetica', fontSize: 8, maxWidth: 234, align: 'left', wrap: false },
    { fieldKey: 'defendant_city_state_zip', pageNumber: 1, x: 40, y: 627, font: 'Helvetica', fontSize: 8, maxWidth: 234, align: 'left', wrap: false },

    { fieldKey: 'premises_address', pageNumber: 1, x: 76, y: 551, font: 'Helvetica', fontSize: 9, maxWidth: 500, align: 'left', wrap: false },
    { fieldKey: 'premises_city', pageNumber: 1, x: 58, y: 535, font: 'Helvetica', fontSize: 9, maxWidth: 180, align: 'left', wrap: false },
    { fieldKey: 'premises_county', pageNumber: 1, x: 291, y: 535, font: 'Helvetica', fontSize: 9, maxWidth: 140, align: 'left', wrap: false },

    { fieldKey: 'rent_period_from', pageNumber: 1, x: 116, y: 375, font: 'Helvetica', fontSize: 9, maxWidth: 110, align: 'left', wrap: false },
    { fieldKey: 'rent_period_to', pageNumber: 1, x: 271, y: 375, font: 'Helvetica', fontSize: 9, maxWidth: 110, align: 'left', wrap: false },
    { fieldKey: 'monthly_rent_amount', pageNumber: 1, x: 146, y: 359, font: 'Helvetica', fontSize: 9, maxWidth: 120, align: 'left', wrap: false },
    { fieldKey: 'rent_amount_due', pageNumber: 1, x: 171, y: 343, font: 'Helvetica', fontSize: 9, maxWidth: 120, align: 'left', wrap: false },

    { fieldKey: 'service_checkbox_personal', pageNumber: 1, x: 48, y: 281, font: 'HelveticaBold', fontSize: 10, maxWidth: null, align: 'left', wrap: false },
    { fieldKey: 'service_checkbox_first_class_mail', pageNumber: 1, x: 48, y: 267, font: 'HelveticaBold', fontSize: 10, maxWidth: null, align: 'left', wrap: false },
    { fieldKey: 'service_checkbox_posting', pageNumber: 1, x: 48, y: 253, font: 'HelveticaBold', fontSize: 10, maxWidth: null, align: 'left', wrap: false },

    { fieldKey: 'service_date', pageNumber: 1, x: 106, y: 231, font: 'Helvetica', fontSize: 9, maxWidth: 130, align: 'left', wrap: false },
    { fieldKey: 'server_name', pageNumber: 1, x: 416, y: 231, font: 'Helvetica', fontSize: 9, maxWidth: 156, align: 'left', wrap: false },

    { fieldKey: 'signature_date', pageNumber: 1, x: 466, y: 173, font: 'Helvetica', fontSize: 9, maxWidth: 106, align: 'left', wrap: false },
    { fieldKey: 'plaintiff_name_print', pageNumber: 1, x: 91, y: 157, font: 'Helvetica', fontSize: 9, maxWidth: 200, align: 'left', wrap: false },
    { fieldKey: 'plaintiff_phone_sig', pageNumber: 1, x: 386, y: 157, font: 'Helvetica', fontSize: 9, maxWidth: 186, align: 'left', wrap: false },
    { fieldKey: 'plaintiff_address_sig', pageNumber: 1, x: 76, y: 141, font: 'Helvetica', fontSize: 9, maxWidth: 500, align: 'left', wrap: true },
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
