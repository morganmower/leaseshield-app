import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

export type OverlayFieldData = {
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
};

export async function generateOverlayPdf(
  basePdfPath: string,
  overlayData: OverlayFieldData[]
): Promise<Buffer> {
  const resolvedPath = path.resolve(basePdfPath);
  const pdfBytes = fs.readFileSync(resolvedPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pages = pdfDoc.getPages();

  for (const field of overlayData) {
    if (!field.value || field.value.trim() === '') continue;

    const pageIndex = field.pageNumber - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;

    const page = pages[pageIndex];
    const font = field.font === 'HelveticaBold' ? helveticaBold : helvetica;
    const fontSize = field.fontSize || 10;
    const color = rgb(0, 0, 0);

    if (field.value === 'X' || field.value === 'x') {
      page.drawText('X', {
        x: field.x,
        y: field.y,
        size: fontSize,
        font: helveticaBold,
        color,
      });
      continue;
    }

    const textWidth = font.widthOfTextAtSize(field.value, fontSize);

    let drawX = field.x;
    if (field.align === 'center' && field.maxWidth) {
      drawX = field.x + (field.maxWidth - textWidth) / 2;
    } else if (field.align === 'right' && field.maxWidth) {
      drawX = field.x + field.maxWidth - textWidth;
    }

    if (field.wrap && field.maxWidth && textWidth > field.maxWidth) {
      const words = field.value.split(' ');
      let lines: string[] = [];
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);
        if (testWidth > field.maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      const lineHeight = fontSize * 1.2;
      for (let i = 0; i < lines.length; i++) {
        page.drawText(lines[i], {
          x: field.x,
          y: field.y - (i * lineHeight),
          size: fontSize,
          font,
          color,
        });
      }
    } else {
      const displayValue = field.maxWidth && textWidth > field.maxWidth
        ? truncateToFit(field.value, font, fontSize, field.maxWidth)
        : field.value;

      page.drawText(displayValue, {
        x: drawX,
        y: field.y,
        size: fontSize,
        font,
        color,
      });
    }
  }

  const resultBytes = await pdfDoc.save();
  return Buffer.from(resultBytes);
}

function truncateToFit(
  text: string,
  font: any,
  fontSize: number,
  maxWidth: number
): string {
  let truncated = text;
  while (font.widthOfTextAtSize(truncated, fontSize) > maxWidth && truncated.length > 1) {
    truncated = truncated.slice(0, -1);
  }
  return truncated;
}
