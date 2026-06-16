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
- Known remaining offender: the rental `application-pdf` route still uses Puppeteer and
  will exhibit the same prod timeout until migrated to pdf-lib.
- Any server PDF fix must be REPUBLISHED to take effect in production.
