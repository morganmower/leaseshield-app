import type { HydratedFormDefinition } from "./matrixResolver";
import type { DateCalculationResult } from "./dateEngine";

export type RenderInput = {
  def: HydratedFormDefinition;
  inputs: Record<string, string | number | boolean>;
  serviceSelection: Record<string, boolean>;
  dateCalc: DateCalculationResult | null;
};

export function renderHtml(input: RenderInput): string {
  const { def, inputs, serviceSelection, dateCalc } = input;
  const mode = def.outputTemplate?.mode;

  if (mode === 'official_pdf_overlay') {
    return renderOverlayPreviewHtml(input);
  }

  return renderFormattedHtml(input);
}

function renderFormattedHtml(input: RenderInput): string {
  const { def, inputs, serviceSelection, dateCalc } = input;

  if (def.outputTemplate?.htmlTemplate) {
    let html = def.outputTemplate.htmlTemplate;
    for (const [key, value] of Object.entries(inputs)) {
      html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), escapeHtml(String(value)));
    }
    if (dateCalc) {
      html = html.replace(/\{\{compliance_deadline\}\}/g, dateCalc.complianceDeadline);
      html = html.replace(/\{\{earliest_filing_date\}\}/g, dateCalc.earliestFilingDate);
    }

    for (const lang of def.requiredLanguage) {
      html = html.replace(
        new RegExp(`\\{\\{language_${lang.block.key}\\}\\}`, 'g'),
        escapeHtml(lang.block.text)
      );
    }

    for (const rule of def.serviceRules) {
      const selected = serviceSelection[rule.methodId] || false;
      html = html.replace(
        new RegExp(`\\{\\{service_${rule.methodKey}\\}\\}`, 'g'),
        selected ? 'X' : ''
      );
    }

    return html;
  }

  const sections: string[] = [];

  sections.push(`<div style="text-align:center;margin-bottom:24px;">
    <h1 style="font-size:18px;font-weight:bold;margin:0;">${escapeHtml(def.form.displayName)}</h1>
    <p style="font-size:12px;color:#666;margin:4px 0;">State: ${escapeHtml(def.form.stateId)} | Category: ${escapeHtml(def.form.category)}</p>
    ${def.version.statuteSourceCitation ? `<p style="font-size:10px;color:#999;">${escapeHtml(def.version.statuteSourceCitation)}</p>` : ''}
  </div>`);

  const fieldGroups = groupFields(def.fields);
  for (const [group, fields] of Object.entries(fieldGroups)) {
    if (group !== '_default') {
      sections.push(`<h2 style="font-size:14px;font-weight:bold;margin:16px 0 8px;border-bottom:1px solid #ccc;padding-bottom:4px;">${escapeHtml(group)}</h2>`);
    }
    for (const field of fields) {
      const value = inputs[field.key];
      if (value !== undefined && value !== null && value !== '') {
        sections.push(`<div style="margin:4px 0;">
          <span style="font-weight:bold;font-size:12px;">${escapeHtml(field.label)}:</span>
          <span style="font-size:12px;margin-left:8px;">${field.type === 'money' ? formatMoney(value) : escapeHtml(String(value))}</span>
        </div>`);
      }
    }
  }

  if (dateCalc) {
    sections.push(`<div style="margin:16px 0;padding:12px;border:1px solid #ddd;background:#f9f9f9;">
      <h3 style="font-size:13px;font-weight:bold;margin:0 0 8px;">Compliance Dates</h3>
      <p style="font-size:12px;margin:2px 0;"><strong>Compliance Deadline:</strong> ${dateCalc.complianceDeadline}</p>
      <p style="font-size:12px;margin:2px 0;"><strong>Earliest Filing Date:</strong> ${dateCalc.earliestFilingDate}</p>
      <p style="font-size:10px;color:#666;margin:4px 0 0;">${escapeHtml(dateCalc.explainFormula)}</p>
    </div>`);
  }

  const selectedMethods = def.serviceRules.filter(r => serviceSelection[r.methodId]);
  if (selectedMethods.length > 0) {
    sections.push(`<div style="margin:16px 0;">
      <h3 style="font-size:13px;font-weight:bold;margin:0 0 8px;">Certificate of Service</h3>
      ${selectedMethods.map(m => `<div style="font-size:12px;margin:2px 0;">[X] ${escapeHtml(m.methodDisplayName)}</div>`).join('')}
    </div>`);
  }

  for (const lang of def.requiredLanguage) {
    sections.push(`<div style="margin:12px 0;padding:8px;border-left:3px solid #2DD4BF;background:#f0fdfa;">
      <p style="font-size:10px;color:#666;margin:0 0 4px;text-transform:uppercase;">${escapeHtml(lang.blockType.replace(/_/g, ' '))}</p>
      <p style="font-size:11px;margin:0;white-space:pre-wrap;">${escapeHtml(lang.block.text)}</p>
      ${lang.block.sourceCitation ? `<p style="font-size:9px;color:#999;margin:4px 0 0;">${escapeHtml(lang.block.sourceCitation)}</p>` : ''}
    </div>`);
  }

  if (def.form.localOverlayRisk !== 'low' && def.form.disclaimerText) {
    sections.push(`<div style="margin:16px 0;padding:12px;border:2px solid #f59e0b;background:#fffbeb;">
      <p style="font-size:11px;font-weight:bold;color:#b45309;margin:0 0 4px;">LOCAL JURISDICTION NOTICE</p>
      <p style="font-size:11px;margin:0;">${escapeHtml(def.form.disclaimerText)}</p>
    </div>`);
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; max-width: 700px; margin: 0 auto; color: #1a1a1a; }
</style></head><body>${sections.join('\n')}</body></html>`;
}

function renderOverlayPreviewHtml(input: RenderInput): string {
  const { def, inputs, serviceSelection, dateCalc } = input;

  const overlayData: Record<string, string> = {};

  for (const [key, value] of Object.entries(inputs)) {
    overlayData[key] = String(value);
  }

  for (const rule of def.serviceRules) {
    const selected = serviceSelection[rule.methodId] || false;
    overlayData[`service_checkbox_${rule.methodKey}`] = selected ? 'X' : '';
  }

  if (dateCalc) {
    overlayData['compliance_deadline'] = dateCalc.complianceDeadline;
    overlayData['earliest_filing_date'] = dateCalc.earliestFilingDate;
  }

  return JSON.stringify({
    mode: 'official_pdf_overlay',
    basePdf: def.outputTemplate?.basePdfAttachmentPath,
    overlayFields: def.outputTemplate?.overlayFields.map(f => ({
      ...f,
      value: overlayData[f.fieldKey] || '',
    })),
  });
}

function groupFields(fields: HydratedFormDefinition['fields']): Record<string, typeof fields> {
  const groups: Record<string, typeof fields> = {};
  for (const field of fields) {
    const group = field.fieldGroup || '_default';
    (groups[group] = groups[group] || []).push(field);
  }
  return groups;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMoney(value: string | number | boolean): string {
  const num = Number(value);
  if (isNaN(num)) return String(value);
  return `$${num.toFixed(2)}`;
}

export function getOverlayData(input: RenderInput): Array<{
  fieldKey: string;
  value: string;
  pageNumber: number;
  x: number;
  y: number;
  font: string;
  fontSize: number;
  maxWidth: number | null;
  align: string;
  wrap: boolean;
}> {
  const { def, inputs, serviceSelection, dateCalc } = input;
  if (!def.outputTemplate?.overlayFields) return [];

  const valueMap: Record<string, string> = {};
  for (const [key, value] of Object.entries(inputs)) {
    valueMap[key] = String(value);
  }
  for (const rule of def.serviceRules) {
    valueMap[`service_checkbox_${rule.methodKey}`] = serviceSelection[rule.methodId] ? 'X' : '';
  }
  if (dateCalc) {
    valueMap['compliance_deadline'] = dateCalc.complianceDeadline;
    valueMap['earliest_filing_date'] = dateCalc.earliestFilingDate;
  }

  return def.outputTemplate.overlayFields.map(f => ({
    ...f,
    value: valueMap[f.fieldKey] || '',
  }));
}
