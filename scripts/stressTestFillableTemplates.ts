/**
 * Stress test: for every template a landlord fills in, verify which entered
 * field values actually surface in the generated document.
 *
 * Method (differential): for each template, build a baseline where every field
 * is populated, generate the doc, then flip ONE field at a time to a different
 * type-valid value and regenerate. If the document text is unchanged when a
 * field changes, that entered value is silently ignored (the class of bug fixed
 * in the MI lease generator: maxDeposit/lateFeeDays).
 *
 * Run:  npx tsx scripts/stressTestFillableTemplates.ts
 */
import JSZip from "jszip";
import { db } from "../server/db";
import { templates } from "@shared/schema";
import { isNotNull } from "drizzle-orm";
import { generateLeaseAgreementDocx } from "../server/utils/leaseAgreementGenerator";
import { generateDocumentDOCX } from "../server/utils/documentGenerator";

type Field = { id: string; type?: string; label?: string; options?: any };

function isLeaseTitle(title: string): boolean {
  const t = title.toLowerCase();
  return t.includes("lease") || t.includes("rental agreement");
}

// Build a type-valid value. variant=false -> baseline "A", variant=true -> "B".
function valueFor(field: Field, idx: number, variant: boolean): string {
  const type = (field.type || "text").toLowerCase();
  switch (type) {
    case "date":
      return variant ? "2032-11-19" : "2031-03-07";
    case "currency":
    case "number":
      return variant ? "5678" : "1234";
    case "checkbox":
      return variant ? "No" : "Yes";
    case "select": {
      let opts: string[] = [];
      const raw = field.options;
      if (Array.isArray(raw)) {
        opts = raw.map((o: any) => (typeof o === "string" ? o : o?.value ?? o?.label)).filter(Boolean);
      }
      if (opts.length >= 2) return variant ? opts[1] : opts[0];
      if (opts.length === 1) return opts[0]; // cannot differentiate
      return variant ? `OPT_B_${idx}` : `OPT_A_${idx}`;
    }
    default:
      // text, textarea, email, tel, phone, signature, anything else
      return variant ? `BBVAR${idx}ZZ` : `AAVAR${idx}ZZ`;
  }
}

function buildValues(fields: Field[], flipIdx: number | null): Record<string, string> {
  const out: Record<string, string> = {};
  fields.forEach((f, i) => {
    out[f.id] = valueFor(f, i, flipIdx === i);
  });
  return out;
}

async function extractText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const file = zip.file("word/document.xml");
  if (!file) return "";
  const xml = await file.async("string");
  // Strip tags, normalize whitespace.
  return xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function routesToLeaseGenerator(template: any): boolean {
  // Mirror the server routing in documentsGenerate.ts / documents.ts.
  return template.templateType === "lease" || isLeaseTitle(template.title);
}

async function genDocx(template: any, fieldValues: Record<string, string>): Promise<Buffer> {
  const common = {
    templateTitle: template.title,
    stateId: template.stateId,
    fieldValues,
    version: template.version || 1,
    updatedAt: template.updatedAt || new Date(),
    landlordInfo: undefined as any,
  };
  if (routesToLeaseGenerator(template)) {
    return generateLeaseAgreementDocx(common);
  }
  return generateDocumentDOCX({
    templateTitle: template.title,
    templateContent: "",
    fieldValues,
    stateId: template.stateId,
    version: template.version || 1,
    updatedAt: template.updatedAt || new Date(),
    landlordInfo: undefined,
  });
}

async function main() {
  const rows = await db.select().from(templates).where(isNotNull(templates.fillableFormData));

  const fillable = rows
    .map((t: any) => ({ t, fields: (t.fillableFormData?.fields ?? []) as Field[] }))
    .filter((x) => x.fields.length > 0)
    .sort((a, b) => a.t.title.localeCompare(b.t.title));

  console.log(`\nStress testing ${fillable.length} templates with fillable fields.\n`);

  type Report = {
    title: string;
    state: string;
    type: string;
    mode: string;
    generator: string;
    misroute: boolean;
    overlayPdf: boolean;
    total: number;
    surfaced: number;
    missing: string[];
    error?: string;
  };
  const reports: Report[] = [];

  for (const { t, fields } of fillable) {
    const lease = routesToLeaseGenerator(t);
    const generator =
      t.generationMode === "static"
        ? "BLANK (values ignored by design)"
        : lease
        ? "leaseAgreementGenerator"
        : "documentGenerator (generic hardcoded lease)";

    // A non-lease template type routed to a lease generator is a structural misroute.
    const misroute = t.generationMode !== "static" && t.templateType !== "lease";

    const rep: Report = {
      title: t.title,
      state: t.stateId,
      type: t.templateType,
      mode: t.generationMode,
      generator,
      misroute,
      overlayPdf: !!t.outputTemplateId,
      total: fields.length,
      surfaced: 0,
      missing: [],
    };

    if (t.generationMode === "static") {
      // Blank generators ignore field values entirely; differential N/A.
      reports.push(rep);
      continue;
    }

    try {
      const baseText = await extractText(await genDocx(t, buildValues(fields, null)));
      for (let i = 0; i < fields.length; i++) {
        const vText = await extractText(await genDocx(t, buildValues(fields, i)));
        if (vText !== baseText) rep.surfaced++;
        else rep.missing.push(fields[i].id);
      }
    } catch (err: any) {
      rep.error = err?.message || String(err);
    }
    reports.push(rep);
  }

  // ---- Output ----
  const line = "-".repeat(96);
  console.log(line);
  for (const r of reports) {
    const flags = [
      r.misroute ? "MISROUTE" : "",
      r.overlayPdf ? "PDF-OVERLAY" : "",
    ].filter(Boolean).join(" ");
    console.log(`${r.title}  [${r.state}/${r.type}/${r.mode}] ${flags}`);
    console.log(`  generator: ${r.generator}`);
    if (r.error) {
      console.log(`  ERROR: ${r.error}`);
    } else if (r.mode === "static") {
      console.log(`  (static blank form — ${r.total} on-screen fields not merged into output)`);
    } else {
      console.log(`  fields: ${r.total}  surfaced: ${r.surfaced}  silently-dropped: ${r.missing.length}`);
      if (r.missing.length) console.log(`  DROPPED: ${r.missing.join(", ")}`);
    }
    console.log(line);
  }

  // ---- Summaries ----
  const wizard = reports.filter((r) => r.mode !== "static");
  const misroutes = wizard.filter((r) => r.misroute);
  const leaseTemplates = wizard.filter((r) => !r.misroute && r.type === "lease");
  const leaseWithDrops = leaseTemplates.filter((r) => r.missing.length > 0 && !r.error);

  console.log("\n========== SUMMARY ==========");
  console.log(`Wizard (landlord-filled) templates: ${wizard.length}`);
  console.log(`  Lease templates: ${leaseTemplates.length}  (with silently-dropped fields: ${leaseWithDrops.length})`);
  console.log(`  MISROUTED non-lease wizard templates (rendered as a lease): ${misroutes.length}`);
  if (misroutes.length) {
    console.log("   -> " + misroutes.map((r) => `${r.title} [${r.state}]`).join("; "));
  }

  console.log("\nLease templates with dropped fields (entered value never appears):");
  for (const r of leaseWithDrops) {
    console.log(`  ${r.title} [${r.state}]: ${r.missing.join(", ")}`);
  }

  console.log("\nStatic blank forms (on-screen fields are NOT merged into the document):");
  for (const r of reports.filter((r) => r.mode === "static")) {
    console.log(`  ${r.title} [${r.state}/${r.type}] (${r.total} fields)`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
