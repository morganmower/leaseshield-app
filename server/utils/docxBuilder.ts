import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  TableLayoutType,
  IRunOptions,
  IParagraphOptions,
} from 'docx';

export const STATE_NAMES: Record<string, string> = {
  UT: 'Utah',
  TX: 'Texas',
  ND: 'North Dakota',
  SD: 'South Dakota',
  NC: 'North Carolina',
  OH: 'Ohio',
  MI: 'Michigan',
  ID: 'Idaho',
  WY: 'Wyoming',
  CA: 'California',
  VA: 'Virginia',
  NV: 'Nevada',
  AZ: 'Arizona',
  FL: 'Florida',
};

export const H1 = (text: string): Paragraph =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: 32 })],
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
  });

export const H2 = (text: string): Paragraph =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24 })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
  });

export const H3 = (text: string): Paragraph =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22 })],
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 100 },
  });

export const SectionHeader = (text: string): Paragraph =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22 })],
    shading: { fill: "f0f0f0" },
    spacing: { before: 200, after: 100 },
  });

export const P = (text: string, options?: { bold?: boolean; italic?: boolean; size?: number; center?: boolean }): Paragraph =>
  new Paragraph({
    children: [
      new TextRun({
        text,
        size: options?.size || 22,
        bold: options?.bold,
        italics: options?.italic,
      }),
    ],
    alignment: options?.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { after: 120 },
  });

export const LabelValue = (label: string, value: string): Paragraph =>
  new Paragraph({
    children: [
      new TextRun({ text: label, bold: true, size: 22 }),
      new TextRun({ text: value, size: 22 }),
    ],
    spacing: { after: 80 },
  });

export const FieldLine = (label: string, underlineLength: number = 50): Paragraph =>
  new Paragraph({
    children: [
      new TextRun({ text: label + " ", size: 20 }),
      new TextRun({ text: "_".repeat(underlineLength), size: 20 }),
    ],
    spacing: { after: 80 },
  });

export const MultiFieldLine = (fields: Array<{ label: string; underlineLength?: number }>): Paragraph =>
  new Paragraph({
    children: fields.flatMap((field, i) => [
      new TextRun({ text: field.label + " ", size: 20 }),
      new TextRun({ text: "_".repeat(field.underlineLength || 20) + (i < fields.length - 1 ? "   " : ""), size: 20 }),
    ]),
    spacing: { after: 80 },
  });

export const SignatureLine = (label: string): Paragraph =>
  new Paragraph({
    children: [
      new TextRun({ text: label + " ", bold: true, size: 22 }),
      new TextRun({ text: "________________________________________________", size: 22 }),
    ],
    spacing: { before: 200, after: 80 },
  });

export const HR = (): Paragraph =>
  new Paragraph({
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
    },
    spacing: { before: 150, after: 150 },
  });

export const CheckboxLine = (text: string): Paragraph =>
  new Paragraph({
    children: [
      new TextRun({ text: "[ ] Yes  [ ] No   ", size: 20 }),
      new TextRun({ text: text, size: 20 }),
    ],
    spacing: { after: 80 },
  });

export const Footer = (text: string = "For informational purposes only. Consult with a licensed attorney for legal advice."): Paragraph =>
  new Paragraph({
    children: [
      new TextRun({
        text,
        size: 18,
        italics: true,
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { before: 400 },
  });

export function createTable(headers: string[], rows: string[][]): Table {
  const headerRow = new TableRow({
    children: headers.map(header =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 18 })] })],
      })
    ),
  });

  const dataRows = rows.map(row =>
    new TableRow({
      children: row.map(cell =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: cell, size: 18 })] })],
        })
      ),
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [headerRow, ...dataRows],
  });
}

export function createChecklistTable(items: string[]): Table {
  const headerRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "Item", bold: true, size: 18 })] })],
        width: { size: 30, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "Condition", bold: true, size: 18 })] })],
        width: { size: 15, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "Notes/Damage Description", bold: true, size: 18 })] })],
        width: { size: 55, type: WidthType.PERCENTAGE },
      }),
    ],
  });

  const dataRows = items.map(item =>
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: item, size: 18 })] })],
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "", size: 18 })] })],
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "", size: 18 })] })],
        }),
      ],
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [headerRow, ...dataRows],
  });
}

export interface DocxInput {
  title: string;
  stateId: string;
  version?: number;
  updatedAt?: Date;
  children: (Paragraph | Table)[];
  margins?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
}

export async function generateDocx(input: DocxInput): Promise<Buffer> {
  const { title, stateId, version = 1, updatedAt = new Date(), children, margins } = input;

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: margins?.top || 1440,
              right: margins?.right || 1440,
              bottom: margins?.bottom || 1440,
              left: margins?.left || 1440,
            },
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

export { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, BorderStyle, TableLayoutType };
