// NOTE: DOCX generation must use `docx` library only.
// HTML → DOCX conversion (html-to-docx) caused Word corruption issues.
// PDF = delivery / legal / courts (uses Puppeteer)
// DOCX = editable / customer convenience (uses docx library)
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
  IL: 'Illinois',
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

export function getStateDisclosures(stateId: string): Paragraph[] {
  const stateName = STATE_NAMES[stateId] || stateId;
  const disclosures: Paragraph[] = [];

  disclosures.push(H2(`25. ${stateName.toUpperCase()} STATE-SPECIFIC PROVISIONS`));

  switch (stateId) {
    case 'UT':
      disclosures.push(H3("25.1 Fair Housing Disclosure"));
      disclosures.push(P("In accordance with the Utah Fair Housing Act (Utah Code 57-21-1 et seq.), it is unlawful to refuse to rent, discriminate, or discriminate in advertising because of race, color, religion, sex, national origin, familial status, source of income, or disability."));
      disclosures.push(H3("25.2 Mold Prevention and Disclosure"));
      disclosures.push(P("Pursuant to the Utah Fit Premises Act (Utah Code 57-22-4), Landlord discloses that there is no known mold contamination on the Premises. Tenant agrees to maintain adequate ventilation and promptly report any water leaks or visible mold within 48 hours of discovery."));
      disclosures.push(H3("25.3 Radon Gas Disclosure"));
      disclosures.push(P("Radon is a naturally occurring radioactive gas that may accumulate in buildings. Long-term exposure may pose health risks. Testing is recommended."));
      disclosures.push(H3("25.4 Lead-Based Paint Disclosure (Pre-1978 Properties)"));
      disclosures.push(P("If the property was built before January 1, 1978, Landlord has disclosed all known information regarding lead-based paint hazards."));
      disclosures.push(H3("25.5 Security Deposit (Utah Code 57-17-3)"));
      disclosures.push(P("Landlord shall return the security deposit within 30 days of lease termination with an itemized statement of any deductions. Security deposit may not exceed the equivalent of two months' rent."));
      disclosures.push(H3("25.6 Entry Notice"));
      disclosures.push(P("Landlord shall provide at least 24 hours' notice before entering the Premises except in emergencies."));
      break;
    case 'TX':
      disclosures.push(H3("25.1 Fair Housing Compliance"));
      disclosures.push(P("In accordance with the Texas Fair Housing Act and Texas Property Code 92.001 et seq., it is unlawful to discriminate based on race, color, religion, sex, national origin, familial status, or disability."));
      disclosures.push(H3("25.2 Texas Property Code Compliance"));
      disclosures.push(P("This Lease is governed by Texas Property Code Chapter 92. Landlord must repair conditions that materially affect health and safety within a reasonable time after receiving written notice."));
      disclosures.push(H3("25.3 Security Deposit (Texas Property Code 92.103-109)"));
      disclosures.push(P("Landlord shall return the security deposit within 30 days of lease termination with an itemized accounting. No statutory limit on security deposit amount."));
      disclosures.push(H3("25.4 Late Fees (Texas Property Code 92.019)"));
      disclosures.push(P("Late fees cannot be charged until rent is at least one full day late. Late fees must be reasonable and specified in the lease."));
      disclosures.push(H3("25.5 Lead-Based Paint Disclosure"));
      disclosures.push(P("For properties built before 1978, Landlord certifies disclosure of all known lead-based paint hazards."));
      disclosures.push(H3("25.6 Entry Notice"));
      disclosures.push(P("Texas law does not specify a minimum notice period, but reasonable notice is required except in emergencies."));
      break;
    case 'CA':
      disclosures.push(H3("25.1 California Civil Code Compliance"));
      disclosures.push(P("This Lease is governed by California Civil Code 1940 et seq. Both parties acknowledge their rights under California tenant protection laws."));
      disclosures.push(H3("25.2 Fair Housing (California Fair Employment and Housing Act)"));
      disclosures.push(P("Discrimination is prohibited based on race, color, religion, sex, sexual orientation, gender identity, national origin, disability, familial status, source of income, or other protected characteristics."));
      disclosures.push(H3("25.3 Security Deposit (Civil Code 1950.5)"));
      disclosures.push(P("Security deposit may not exceed two months' rent (three months for furnished units). Landlord shall return the deposit within 21 days of move-out with an itemized statement."));
      disclosures.push(H3("25.4 Rent Control Notice"));
      disclosures.push(P("If the property is subject to local rent control or the California Tenant Protection Act (AB 1482), Tenant has been notified of applicable rent increase limits and just cause eviction protections."));
      disclosures.push(H3("25.5 Mold Disclosure (Health and Safety Code 26147)"));
      disclosures.push(P("Landlord discloses any known mold contamination that exceeds permissible exposure limits."));
      disclosures.push(H3("25.6 Lead-Based Paint Disclosure"));
      disclosures.push(P("For properties built before 1978, Landlord discloses all known lead-based paint hazards."));
      disclosures.push(H3("25.7 Entry Notice"));
      disclosures.push(P("Landlord shall provide at least 24 hours' written notice before entering the Premises except in emergencies."));
      break;
    case 'FL':
      disclosures.push(H3("25.1 Florida Residential Landlord and Tenant Act"));
      disclosures.push(P("This Lease is governed by Florida Statutes Chapter 83 (Florida Residential Landlord and Tenant Act)."));
      disclosures.push(H3("25.2 Fair Housing Compliance"));
      disclosures.push(P("In accordance with the Florida Fair Housing Act (F.S. 760.20-760.37), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, or disability."));
      disclosures.push(H3("25.3 Security Deposit (F.S. 83.49)"));
      disclosures.push(P("Landlord shall hold the security deposit in a Florida banking institution. Within 30 days of receiving the deposit, Landlord shall notify Tenant in writing of where the deposit is held. Deposit shall be returned within 15-60 days after lease termination depending on claims."));
      disclosures.push(H3("25.4 Radon Gas Disclosure (F.S. 404.056)"));
      disclosures.push(P("RADON GAS: Radon is a naturally occurring radioactive gas that, when accumulated in a building in sufficient quantities, may present health risks. Radon testing is encouraged."));
      disclosures.push(H3("25.5 Lead-Based Paint Disclosure"));
      disclosures.push(P("For properties built before 1978, Landlord discloses all known lead-based paint hazards."));
      disclosures.push(H3("25.6 Entry Notice"));
      disclosures.push(P("Landlord shall provide at least 12 hours' notice before entering the Premises except in emergencies."));
      break;
    case 'AZ':
      disclosures.push(H3("25.1 Arizona Residential Landlord and Tenant Act"));
      disclosures.push(P("This Lease is governed by A.R.S. 33-1301 et seq. (Arizona Residential Landlord and Tenant Act). Both parties acknowledge their rights and obligations under this Act."));
      disclosures.push(H3("25.2 Fair Housing Compliance"));
      disclosures.push(P("In accordance with the Arizona Fair Housing Act (A.R.S. 41-1491), discrimination is prohibited based on race, color, religion, sex, familial status, national origin, or disability."));
      disclosures.push(H3("25.3 Security Deposit (A.R.S. 33-1321)"));
      disclosures.push(P("Security deposit may not exceed one and one-half months' rent. Landlord shall return the deposit within 14 business days after termination with an itemized statement of deductions."));
      disclosures.push(H3("25.4 Pool/Spa Disclosure"));
      disclosures.push(P("If the property has a pool or spa, Tenant acknowledges receiving information about pool safety and barrier requirements per A.R.S. 36-1681."));
      disclosures.push(H3("25.5 Lead-Based Paint Disclosure"));
      disclosures.push(P("For properties built before 1978, Landlord discloses all known lead-based paint hazards."));
      disclosures.push(H3("25.6 Entry Notice"));
      disclosures.push(P("Landlord shall provide at least 48 hours' notice before entering the Premises for non-emergency purposes."));
      disclosures.push(H3("25.7 Bed Bug Disclosure"));
      disclosures.push(P("Landlord discloses any known bed bug infestations within the last year per A.R.S. 33-1319."));
      break;
    case 'NV':
      disclosures.push(H3("25.1 Nevada Revised Statutes Compliance"));
      disclosures.push(P("This Lease is governed by NRS Chapter 118A (Landlord and Tenant: Dwellings). Both parties acknowledge their rights and obligations under Nevada law."));
      disclosures.push(H3("25.2 Fair Housing Compliance"));
      disclosures.push(P("In accordance with the Nevada Fair Housing Law (NRS 118.010-120), discrimination is prohibited based on race, religious creed, color, national origin, disability, ancestry, familial status, sex, sexual orientation, or gender identity."));
      disclosures.push(H3("25.3 Security Deposit (NRS 118A.242)"));
      disclosures.push(P("Security deposit may not exceed three months' rent. Landlord shall return the deposit within 30 days of lease termination with an itemized statement."));
      disclosures.push(H3("25.4 Lead-Based Paint Disclosure"));
      disclosures.push(P("For properties built before 1978, Landlord discloses all known lead-based paint hazards."));
      disclosures.push(H3("25.5 Entry Notice (NRS 118A.330)"));
      disclosures.push(P("Landlord shall provide at least 24 hours' notice before entering the Premises except in emergencies."));
      disclosures.push(H3("25.6 Foreclosure Disclosure"));
      disclosures.push(P("Landlord must disclose if the property is subject to a notice of default, notice of sale, or pending foreclosure per NRS 118A.275."));
      break;
    case 'VA':
      disclosures.push(H3("25.1 Virginia Residential Landlord and Tenant Act"));
      disclosures.push(P("This Lease is governed by Virginia Code 55.1-1200 et seq. (Virginia Residential Landlord and Tenant Act). Both parties acknowledge their rights and obligations under this Act."));
      disclosures.push(H3("25.2 Fair Housing Compliance"));
      disclosures.push(P("In accordance with the Virginia Fair Housing Law (Va. Code 36-96.1), discrimination is prohibited based on race, color, religion, national origin, sex, elderliness, familial status, source of funds, sexual orientation, gender identity, military status, or disability."));
      disclosures.push(H3("25.3 Security Deposit (Va. Code 55.1-1226)"));
      disclosures.push(P("Security deposit may not exceed two months' rent. Landlord shall return the deposit within 45 days of lease termination with an itemized statement."));
      disclosures.push(H3("25.4 Lead-Based Paint Disclosure"));
      disclosures.push(P("For properties built before 1978, Landlord discloses all known lead-based paint hazards."));
      disclosures.push(H3("25.5 Mold Disclosure"));
      disclosures.push(P("Landlord shall disclose visible mold in areas readily accessible within the dwelling unit per Va. Code 55.1-1215."));
      disclosures.push(H3("25.6 Entry Notice"));
      disclosures.push(P("Landlord shall provide at least 24 hours' notice before entering the Premises except in emergencies."));
      disclosures.push(H3("25.7 Military Personnel Rights"));
      disclosures.push(P("Members of the armed forces have additional termination rights under the federal Servicemembers Civil Relief Act and Virginia law."));
      break;
    case 'IL':
      disclosures.push(H3("25.1 Illinois Landlord and Tenant Act"));
      disclosures.push(P("This Lease is governed by applicable provisions of the Illinois Compiled Statutes, including 765 ILCS 705 (Security Deposit Return Act) and 765 ILCS 742 (Radon Awareness Act)."));
      disclosures.push(H3("25.2 Fair Housing Compliance"));
      disclosures.push(P("In accordance with the Illinois Human Rights Act (775 ILCS 5/), discrimination is prohibited based on race, color, religion, sex, national origin, ancestry, age, order of protection status, marital status, physical or mental disability, military status, sexual orientation, gender identity, or unfavorable discharge from military service."));
      disclosures.push(H3("25.3 Source of Income Protection"));
      disclosures.push(P("Illinois law prohibits discrimination based on lawful source of income, including housing subsidies such as Section 8 vouchers."));
      disclosures.push(H3("25.4 Security Deposit (765 ILCS 710)"));
      disclosures.push(P("For properties with 5 or more units, security deposit may not exceed 1.5 months' rent. Landlord shall return the deposit within 30 days if no deductions, or 45 days with an itemized statement of deductions. Chicago landlords must pay interest on deposits per the Chicago RLTO."));
      disclosures.push(H3("25.5 Radon Gas Disclosure (765 ILCS 742)"));
      disclosures.push(P("RADON DISCLOSURE: Radon is a Class A human carcinogen and the leading cause of lung cancer among non-smokers. The Illinois Emergency Management Agency recommends testing for radon. The seller or lessor may provide test results or the buyer/lessee may request that testing be performed."));
      disclosures.push(H3("25.6 Carbon Monoxide Detector Notice"));
      disclosures.push(P("Per the Illinois Carbon Monoxide Alarm Detector Act (430 ILCS 135/), the Landlord certifies that carbon monoxide detectors are installed in accordance with state law."));
      disclosures.push(H3("25.7 Lead-Based Paint Disclosure"));
      disclosures.push(P("For properties built before 1978, Landlord discloses all known lead-based paint hazards."));
      disclosures.push(H3("25.8 Entry Notice"));
      disclosures.push(P("Landlord shall provide at least 24 hours' notice before entering the Premises except in emergencies."));
      disclosures.push(H3("25.9 Chicago RLTO (If Applicable)"));
      disclosures.push(P("If the property is located in Chicago, additional tenant protections apply under the Chicago Residential Landlord and Tenant Ordinance, including required interest on security deposits, specific move-in/move-out procedures, and additional disclosure requirements."));
      break;
    default:
      disclosures.push(H3("25.1 Fair Housing Compliance"));
      disclosures.push(P("Landlord shall comply with all applicable federal, state, and local fair housing laws. Discrimination based on race, color, religion, sex, national origin, familial status, or disability is prohibited."));
      disclosures.push(H3("25.2 Lead-Based Paint Disclosure"));
      disclosures.push(P("For properties built before 1978, Landlord discloses all known lead-based paint hazards."));
      disclosures.push(H3("25.3 Security Deposit"));
      disclosures.push(P("Landlord shall return the security deposit within the time period required by applicable state law after Tenant vacates the Premises with an itemized statement of any deductions."));
      disclosures.push(H3("25.4 Entry Notice"));
      disclosures.push(P("Landlord shall provide reasonable notice before entering the Premises except in emergencies."));
      break;
  }

  return disclosures;
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
