---
name: Puppeteer hangs in deployed environment
description: Why server-side PDF routes that launch headless Chromium time out in production, and what to use instead.
---

# Puppeteer/Chromium hangs in the deployed environment

PDF routes that call `puppeteer.launch` (with `execSync('which chromium')`) work in
the Replit workspace (dev) but **hang in the published deployment** — every request
hits the ~30s Express "Response timeout" and the user sees a failed download. Chromium
is not reliably available/launchable in the deployed reserved VM, and the `--single-process`
launch can hang rather than error.

**Rule:** generate server-side PDFs with `pdf-lib` (pure JS, already a dependency here,
used by `server/scripts/*` and `server/utils/documentGenerator.ts`), not Puppeteer.

**Why:** removes the Chromium dependency entirely so generation is deterministic in prod.

**How to apply:**
- pdf-lib's StandardFonts use WinAnsi encoding and **throw** on un-encodable chars —
  sanitize all drawn text (strip to printable ASCII) before `drawText`, including
  user-supplied fields like typed signatures.
- Wrap variable-width values (emails, names) to their column width so odd/long input
  can't overflow or trip layout math.
- Shared helper `server/utils/pdfDocBuilder.ts` (PdfDocBuilder + PDF_COLORS) wraps pdf-lib
  with safe()/wrap/pagination/title/sectionTitle/bullet/fieldGrid/footer — reuse it for new
  server PDFs instead of hand-rolling pdf-lib.
- Migrated application-process downloads (all pdf-lib now): consent-pdf + application-pdf
  (rentalScreening.ts) and adverse-action-letter (denialDecision.ts).
- Still Puppeteer (outside the application-process scope, will hang in prod until migrated):
  blankApplicationGenerator, moveOutChecklistGenerator, documentGenerator,
  leaseAgreementGenerator (PDF path).
- Any server PDF fix must be REPUBLISHED to take effect in production.
