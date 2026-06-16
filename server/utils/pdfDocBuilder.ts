import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, RGB } from 'pdf-lib';

// Shared pure-JS PDF builder. We use this instead of Puppeteer/Chromium because
// headless Chromium hangs in the deployed environment (every PDF request hit the
// ~30s Express response timeout in production). pdf-lib has no browser dependency.

export const PDF_COLORS = {
  teal: rgb(0.05, 0.58, 0.53),
  dark: rgb(0.1, 0.1, 0.1),
  gray: rgb(0.42, 0.45, 0.5),
  green: rgb(0.09, 0.4, 0.2),
  red: rgb(0.6, 0.11, 0.11),
  amber: rgb(0.57, 0.25, 0.05),
  line: rgb(0.88, 0.9, 0.92),
};

export interface Field {
  label: string;
  value: string | null | undefined;
}

export class PdfDocBuilder {
  doc!: PDFDocument;
  page!: PDFPage;
  font!: PDFFont;
  fontBold!: PDFFont;
  fontItalic!: PDFFont;

  readonly PAGE_W = 612;
  readonly PAGE_H = 792;
  readonly MARGIN = 50;
  readonly CONTENT_W = 612 - 50 * 2;
  y = 792 - 50;

  static async create(): Promise<PdfDocBuilder> {
    const b = new PdfDocBuilder();
    b.doc = await PDFDocument.create();
    b.font = await b.doc.embedFont(StandardFonts.Helvetica);
    b.fontBold = await b.doc.embedFont(StandardFonts.HelveticaBold);
    b.fontItalic = await b.doc.embedFont(StandardFonts.HelveticaOblique);
    b.page = b.doc.addPage([b.PAGE_W, b.PAGE_H]);
    b.y = b.PAGE_H - b.MARGIN;
    return b;
  }

  // Standard PDF fonts use WinAnsi and THROW on un-encodable characters, so
  // strip everything outside printable ASCII before any text is drawn.
  safe(str: any): string {
    return String(str ?? '').replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
  }

  hasValue(v: any): boolean {
    return v != null && String(v).trim() !== '';
  }

  wrapLines(text: string, f: PDFFont, size: number, maxWidth: number): string[] {
    const lines: string[] = [];
    for (const rawLine of this.safe(text).split('\n')) {
      const words = rawLine.split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        lines.push('');
        continue;
      }
      let line = '';
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (f.widthOfTextAtSize(test, size) > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
    }
    return lines.length ? lines : [''];
  }

  newPage() {
    this.page = this.doc.addPage([this.PAGE_W, this.PAGE_H]);
    this.y = this.PAGE_H - this.MARGIN;
  }

  ensureSpace(needed: number) {
    if (this.y - needed < this.MARGIN) this.newPage();
  }

  moveDown(n: number) {
    this.y -= n;
  }

  private centerX(text: string, f: PDFFont, size: number): number {
    return this.MARGIN + (this.CONTENT_W - f.widthOfTextAtSize(text, size)) / 2;
  }

  title(text: string) {
    const size = 22;
    this.ensureSpace(size + 6);
    const t = this.safe(text);
    this.y -= size;
    this.page.drawText(t, { x: this.centerX(t, this.fontBold, size), y: this.y, size, font: this.fontBold, color: PDF_COLORS.teal });
    this.y -= 6;
  }

  subtitle(text: string) {
    const size = 12;
    this.ensureSpace(size + 4);
    const t = this.safe(text);
    this.y -= size;
    this.page.drawText(t, { x: this.centerX(t, this.font, size), y: this.y, size, font: this.font, color: PDF_COLORS.gray });
    this.y -= 4;
  }

  rule(color: RGB = PDF_COLORS.teal, thickness = 1.5) {
    this.ensureSpace(thickness + 6);
    this.y -= 6;
    this.page.drawLine({ start: { x: this.MARGIN, y: this.y }, end: { x: this.PAGE_W - this.MARGIN, y: this.y }, thickness, color });
  }

  // Top-level section label (uppercase, teal).
  sectionTitle(text: string) {
    this.ensureSpace(26);
    this.y -= 20;
    this.page.drawText(this.safe(text).toUpperCase(), { x: this.MARGIN, y: this.y, size: 11, font: this.fontBold, color: PDF_COLORS.teal });
    this.y -= 6;
  }

  // Sub-section heading with a thin underline (dark gray).
  h3(text: string) {
    this.ensureSpace(24);
    this.y -= 16;
    this.page.drawText(this.safe(text), { x: this.MARGIN, y: this.y, size: 12, font: this.fontBold, color: PDF_COLORS.dark });
    this.y -= 4;
    this.page.drawLine({ start: { x: this.MARGIN, y: this.y }, end: { x: this.PAGE_W - this.MARGIN, y: this.y }, thickness: 0.5, color: PDF_COLORS.line });
    this.y -= 2;
  }

  paragraph(
    text: string,
    opts: { size?: number; bold?: boolean; italic?: boolean; color?: RGB; x?: number; width?: number; gap?: number; center?: boolean } = {}
  ) {
    const size = opts.size ?? 11;
    const f = opts.bold ? this.fontBold : opts.italic ? this.fontItalic : this.font;
    const color = opts.color ?? PDF_COLORS.dark;
    const x = opts.x ?? this.MARGIN;
    const width = opts.width ?? (this.MARGIN + this.CONTENT_W - x);
    const gap = opts.gap ?? 4;
    for (const ln of this.wrapLines(text, f, size, width)) {
      this.ensureSpace(size + gap);
      this.y -= size;
      let drawX = x;
      if (opts.center) drawX = this.centerX(ln, f, size);
      this.page.drawText(ln, { x: drawX, y: this.y, size, font: f, color });
      this.y -= gap;
    }
  }

  bullet(text: string, opts: { size?: number; color?: RGB } = {}) {
    const size = opts.size ?? 11;
    const color = opts.color ?? PDF_COLORS.dark;
    this.ensureSpace(size + 4);
    this.page.drawText('-', { x: this.MARGIN + 6, y: this.y - size, size, font: this.font, color });
    this.paragraph(text, { x: this.MARGIN + 18, width: this.CONTENT_W - 18, size, color, gap: 4 });
  }

  // Render label/value pairs in a multi-column grid; empty values are skipped.
  fieldGrid(items: Field[], columns = 2) {
    const filtered = items.filter((it) => this.hasValue(it.value));
    if (filtered.length === 0) return;
    const gutter = 16;
    const colW = (this.CONTENT_W - gutter * (columns - 1)) / columns;
    for (let i = 0; i < filtered.length; i += columns) {
      const rowItems = filtered.slice(i, i + columns);
      const cells = rowItems.map((it) => ({
        label: this.safe(it.label).toUpperCase(),
        lines: this.wrapLines(String(it.value), this.font, 11, colW),
      }));
      const maxLines = Math.max(...cells.map((c) => c.lines.length));
      this.ensureSpace(11 + 2 + maxLines * 14 + 8);
      const labelY = this.y - 10;
      cells.forEach((c, ci) => {
        const x = this.MARGIN + ci * (colW + gutter);
        this.page.drawText(c.label, { x, y: labelY, size: 8, font: this.fontBold, color: PDF_COLORS.gray });
        c.lines.forEach((ln, li) => {
          this.page.drawText(ln, { x, y: labelY - 13 - li * 14, size: 11, font: this.font, color: PDF_COLORS.dark });
        });
      });
      this.y = labelY - 13 - (maxLines - 1) * 14 - 10;
    }
  }

  // Small filled label chip (e.g. a role badge) drawn at a given baseline.
  inlineBadge(text: string, x: number, baselineY: number, bg: RGB = PDF_COLORS.teal): number {
    const size = 9;
    const t = this.safe(text);
    const w = this.fontBold.widthOfTextAtSize(t, size);
    const padX = 6;
    const padY = 3;
    this.page.drawRectangle({ x, y: baselineY - padY, width: w + padX * 2, height: size + padY * 2, color: bg });
    this.page.drawText(t, { x: x + padX, y: baselineY + 1, size, font: this.fontBold, color: rgb(1, 1, 1) });
    return w + padX * 2;
  }

  footer(lines: string[]) {
    this.y -= 16;
    this.ensureSpace(14 + lines.length * 12);
    this.y -= 6;
    this.page.drawLine({ start: { x: this.MARGIN, y: this.y }, end: { x: this.PAGE_W - this.MARGIN, y: this.y }, thickness: 0.5, color: PDF_COLORS.line });
    this.y -= 4;
    for (const ln of lines) {
      this.paragraph(ln, { size: 9, color: PDF_COLORS.gray, center: true, gap: 2 });
    }
  }

  async toBuffer(): Promise<Buffer> {
    const bytes = await this.doc.save();
    return Buffer.from(bytes);
  }
}
