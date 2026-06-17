---
name: Document generation routing
description: How landlord-filled templates route to generators, the title-based routing trap, and the stress-test harness.
---

# Landlord-filled document generation: routing map

All landlord-filled templates flow through two surfaces with **identical** generator-selection logic:
- `POST /api/documents/generate` (server/routes/documentsGenerate.ts) — wizard "Generate" + download.
- `GET /api/saved-documents/:id/download` (server/routes/documents.ts) — re-download from library.

Selection (DOCX path, the editable one):
- `generationMode === 'static'` templates never reach these routes — they use `/api/templates/:id/download-blank` → blank application / move-out checklist generators, which **ignore field values entirely** (blank underscore forms by design).
- wizard templates: if lease → `leaseAgreementGenerator`; else → generic `documentGenerator`.
- PDF + `outputTemplateId` → official overlay renderer (pdf-lib) instead.

## The trap: lease detection was title-string based
`isLeaseAgreement` was `title.includes('lease') || title.includes('rental agreement')`. This is fragile:
- **Missed** `template_type='lease'` rows whose title lacks those words — all 10 "Month-to-Month Agreement (XX)" templates fell through to the generic generator, which renders only a fixed key set and **silently dropped the landlord/tenant contact block** (landlordAddress/Phone/Email, tenantEmail/Phone).
- **Mis-caught** notices whose title contains "lease" (e.g. "Lease Violation Notice") into the lease generator.

**Fix applied:** route by `templateType === 'lease'` first, title keywords as fallback (additive — zero regression to existing paths). Keep both routes in lockstep.
**Why:** template_type is authoritative; titles are marketing copy and unreliable for routing.

## Known structural issue (NOT yet fixed)
The generic `documentGenerator.generateDocument/DOCX` emits a **hardcoded lease** regardless of template type. So every non-lease **wizard** template (33 of them: notices, eviction complaints/summons, and the UT/NC wizard Rental Applications + UT/NC wizard Move-In Checklists) produces a lease document when a landlord fills and downloads it. Real notice generation lives in a **separate** system: `/api/notice-forms/:formKey/*` (server/routes/noticeGeneration.ts → engine renderHtml / overlay), but there is no tenant-facing UI wiring those notice forms to the template library — the library wizard posts to `/api/documents/generate`. Fixing requires either routing notice/application/checklist template_types to proper generators or to the notice-forms engine. Large, separate effort.

## Stress-test harness
`scripts/stressTestFillableTemplates.ts` (run `npx tsx scripts/stressTestFillableTemplates.ts`).
Differential method: populate every field with a type-valid baseline, generate the DOCX, then flip ONE field at a time and diff the extracted `word/document.xml` text. A field whose change produces an identical document is **silently ignored**. This catches the field-ID-mismatch bug class (the original maxDeposit/lateFeeDays lease bug) without puppeteer. It mirrors the server routing via `routesToLeaseGenerator()` — keep it in sync if routing changes.

**Benign / intended "drops" the harness will still report:**
- `propertyState`: benign — the lease generator already prints the state via the template's `stateId`, so the value appears even though the entered field is ignored.
- `depositReturnDeadline`, `noticeToTerminate`, etc.: intended — now sourced from the `state_clause_values` DB (clause framework), not the wizard field.
- disclosure checkboxes (leadPaint, military, domesticViolence, truthInRenting): clauses are emitted unconditionally, so toggling does nothing.
