import { Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { getStateName } from './getStateName';

const H2 = (text: string): Paragraph =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24 })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
  });

const H3 = (text: string): Paragraph =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22 })],
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 100 },
  });

const P = (text: string): Paragraph =>
  new Paragraph({
    children: [new TextRun({ text, size: 22 })],
    alignment: AlignmentType.LEFT,
    spacing: { after: 120 },
  });

type DisclosureBuilder = () => Paragraph[];

export const STATE_DISCLOSURE_REGISTRY: Record<string, DisclosureBuilder> = {
  UT: () => [
    H3("25.1 Fair Housing Disclosure"),
    P("In accordance with the Utah Fair Housing Act (Utah Code 57-21-1 et seq.), it is unlawful to refuse to rent, discriminate, or discriminate in advertising because of race, color, religion, sex, national origin, familial status, source of income, or disability."),
    H3("25.2 Mold Prevention and Disclosure"),
    P("Pursuant to the Utah Fit Premises Act (Utah Code 57-22-4), Landlord discloses that there is no known mold contamination on the Premises. Tenant agrees to maintain adequate ventilation and promptly report any water leaks or visible mold within 48 hours of discovery."),
    H3("25.3 Radon Gas Disclosure"),
    P("Radon is a naturally occurring radioactive gas that may accumulate in buildings. Long-term exposure may pose health risks. Testing is recommended."),
    H3("25.4 Lead-Based Paint Disclosure (Pre-1978 Properties)"),
    P("If the property was built before January 1, 1978, Landlord has disclosed all known information regarding lead-based paint hazards."),
    H3("25.5 Security Deposit (Utah Code 57-17-3)"),
    P("Landlord shall return the security deposit within 30 days of lease termination with an itemized statement of any deductions. Security deposit may not exceed the equivalent of two months' rent."),
    H3("25.6 Entry Notice"),
    P("Landlord shall provide at least 24 hours' notice before entering the Premises except in emergencies."),
  ],
  TX: () => [
    H3("25.1 Fair Housing Compliance"),
    P("In accordance with the Texas Fair Housing Act and Texas Property Code 92.001 et seq., it is unlawful to discriminate based on race, color, religion, sex, national origin, familial status, or disability."),
    H3("25.2 Texas Property Code Compliance"),
    P("This Lease is governed by Texas Property Code Chapter 92. Landlord must repair conditions that materially affect health and safety within a reasonable time after receiving written notice."),
    H3("25.3 Security Deposit (Texas Property Code 92.103-109)"),
    P("Landlord shall return the security deposit within 30 days of lease termination with an itemized accounting. No statutory limit on security deposit amount."),
    H3("25.4 Late Fees (Texas Property Code 92.019)"),
    P("Late fees cannot be charged until rent is at least one full day late. Late fees must be reasonable and specified in the lease."),
    H3("25.5 Lead-Based Paint Disclosure"),
    P("For properties built before 1978, Landlord certifies disclosure of all known lead-based paint hazards."),
    H3("25.6 Entry Notice"),
    P("Texas law does not specify a minimum notice period, but reasonable notice is required except in emergencies."),
  ],
  ND: () => [
    H3("25.1 Fair Housing Compliance"),
    P("In accordance with North Dakota Century Code 14-02.4 (Fair Housing Law), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, or disability."),
    H3("25.2 Security Deposit"),
    P("Landlord shall return the security deposit within 30 days of lease termination with an itemized statement of deductions."),
    H3("25.3 Lead-Based Paint Disclosure"),
    P("For properties built before 1978, Landlord discloses all known lead-based paint hazards."),
    H3("25.4 Entry Notice"),
    P("Landlord shall provide reasonable notice before entering the Premises except in emergencies."),
  ],
  SD: () => [
    H3("25.1 Fair Housing Compliance"),
    P("In accordance with South Dakota Codified Laws 20-13 (Fair Housing), discrimination is prohibited based on race, color, religion, sex, national origin, ancestry, familial status, or disability."),
    H3("25.2 Security Deposit (SDCL 43-32-6.1)"),
    P("Landlord shall return the security deposit within 14 days after termination (or within 45 days if lease exceeds 1 year) with an itemized statement. Security deposit may not exceed one month's rent."),
    H3("25.3 Lead-Based Paint Disclosure"),
    P("For properties built before 1978, Landlord discloses all known lead-based paint hazards."),
    H3("25.4 Entry Notice"),
    P("Landlord shall provide reasonable notice before entering the Premises except in emergencies."),
  ],
  NC: () => [
    H3("25.1 Fair Housing Compliance"),
    P("In accordance with the North Carolina Fair Housing Act (N.C.G.S. 41A), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, or handicap."),
    H3("25.2 Security Deposit (N.C.G.S. 42-50 to 42-56)"),
    P("Security deposit may not exceed two months' rent. Landlord shall return the deposit within 30 days of termination with an itemized accounting. Trust account requirements apply."),
    H3("25.3 Lead-Based Paint Disclosure"),
    P("For properties built before 1978, Landlord discloses all known lead-based paint hazards."),
    H3("25.4 Entry Notice"),
    P("Landlord shall provide reasonable notice before entering the Premises except in emergencies."),
  ],
  OH: () => [
    H3("25.1 Fair Housing Compliance"),
    P("In accordance with Ohio Revised Code 4112 (Fair Housing), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, ancestry, disability, or military status."),
    H3("25.2 Security Deposit (ORC 5321.16)"),
    P("Landlord shall return the security deposit within 30 days of lease termination with an itemized statement."),
    H3("25.3 Lead-Based Paint Disclosure"),
    P("For properties built before 1978, Landlord discloses all known lead-based paint hazards."),
    H3("25.4 Entry Notice (ORC 5321.04)"),
    P("Landlord shall provide at least 24 hours' notice before entering the Premises except in emergencies."),
  ],
  MI: () => [
    H3("25.1 Fair Housing Compliance"),
    P("In accordance with the Michigan Civil Rights Act (MCL 37.2101), discrimination is prohibited based on religion, race, color, national origin, age, sex, familial status, or marital status."),
    H3("25.2 Security Deposit (MCL 554.601-554.616)"),
    P("Security deposit may not exceed 1.5 months' rent. Landlord shall return the deposit within 30 days of lease termination with an itemized statement."),
    H3("25.3 Lead-Based Paint Disclosure"),
    P("For properties built before 1978, Landlord discloses all known lead-based paint hazards."),
    H3("25.4 Truth in Renting Act"),
    P("Landlord must provide a move-in checklist per MCL 554.608 if security deposit is collected."),
    H3("25.5 Entry Notice"),
    P("Landlord shall provide reasonable notice before entering the Premises except in emergencies."),
  ],
  ID: () => [
    H3("25.1 Fair Housing Compliance"),
    P("In accordance with the Idaho Human Rights Act (Idaho Code 67-5901), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, or disability."),
    H3("25.2 Security Deposit (Idaho Code 6-321)"),
    P("Landlord shall return the security deposit within 21 days of lease termination with an itemized statement. No statutory limit on deposit amount."),
    H3("25.3 Lead-Based Paint Disclosure"),
    P("For properties built before 1978, Landlord discloses all known lead-based paint hazards."),
    H3("25.4 Entry Notice"),
    P("Landlord shall provide reasonable notice before entering the Premises except in emergencies."),
  ],
  WY: () => [
    H3("25.1 Fair Housing Compliance"),
    P("In accordance with Wyoming Fair Housing Act (W.S. 40-27-101), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, or disability."),
    H3("25.2 Security Deposit"),
    P("Landlord shall return the security deposit within 30 days of lease termination (or 15 days if lease specifies) with an itemized statement. No statutory limit on deposit amount."),
    H3("25.3 Lead-Based Paint Disclosure"),
    P("For properties built before 1978, Landlord discloses all known lead-based paint hazards."),
    H3("25.4 Entry Notice"),
    P("Landlord shall provide reasonable notice before entering the Premises except in emergencies."),
  ],
  CA: () => [
    H3("25.1 California Civil Code Compliance"),
    P("This Lease is governed by California Civil Code 1940 et seq. Both parties acknowledge their rights under California tenant protection laws."),
    H3("25.2 Fair Housing (California Fair Employment and Housing Act)"),
    P("Discrimination is prohibited based on race, color, religion, sex, sexual orientation, gender identity, national origin, disability, familial status, source of income, or other protected characteristics."),
    H3("25.3 Security Deposit (Civil Code 1950.5)"),
    P("Security deposit may not exceed two months' rent (three months for furnished units). Landlord shall return the deposit within 21 days of move-out with an itemized statement."),
    H3("25.4 Rent Control Notice"),
    P("If the property is subject to local rent control or the California Tenant Protection Act (AB 1482), Tenant has been notified of applicable rent increase limits and just cause eviction protections."),
    H3("25.5 Mold Disclosure (Health and Safety Code 26147)"),
    P("Landlord discloses any known mold contamination that exceeds permissible exposure limits."),
    H3("25.6 Lead-Based Paint Disclosure"),
    P("For properties built before 1978, Landlord discloses all known lead-based paint hazards."),
    H3("25.7 Entry Notice"),
    P("Landlord shall provide at least 24 hours' written notice before entering the Premises except in emergencies."),
  ],
  VA: () => [
    H3("25.1 Virginia Residential Landlord and Tenant Act"),
    P("This Lease is governed by Virginia Code 55.1-1200 et seq. (Virginia Residential Landlord and Tenant Act). Both parties acknowledge their rights and obligations under this Act."),
    H3("25.2 Fair Housing Compliance"),
    P("In accordance with the Virginia Fair Housing Law (Va. Code 36-96.1), discrimination is prohibited based on race, color, religion, national origin, sex, elderliness, familial status, source of funds, sexual orientation, gender identity, military status, or disability."),
    H3("25.3 Security Deposit (Va. Code 55.1-1226)"),
    P("Security deposit may not exceed two months' rent. Landlord shall return the deposit within 45 days of lease termination with an itemized statement."),
    H3("25.4 Lead-Based Paint Disclosure"),
    P("For properties built before 1978, Landlord discloses all known lead-based paint hazards."),
    H3("25.5 Mold Disclosure"),
    P("Landlord shall disclose visible mold in areas readily accessible within the dwelling unit per Va. Code 55.1-1215."),
    H3("25.6 Entry Notice"),
    P("Landlord shall provide at least 24 hours' notice before entering the Premises except in emergencies."),
    H3("25.7 Military Personnel Rights"),
    P("Members of the armed forces have additional termination rights under the federal Servicemembers Civil Relief Act and Virginia law."),
  ],
  NV: () => [
    H3("25.1 Nevada Revised Statutes Compliance"),
    P("This Lease is governed by NRS Chapter 118A (Landlord and Tenant: Dwellings). Both parties acknowledge their rights and obligations under Nevada law."),
    H3("25.2 Fair Housing Compliance"),
    P("In accordance with the Nevada Fair Housing Law (NRS 118.010-120), discrimination is prohibited based on race, religious creed, color, national origin, disability, ancestry, familial status, sex, sexual orientation, or gender identity."),
    H3("25.3 Security Deposit (NRS 118A.242)"),
    P("Security deposit may not exceed three months' rent. Landlord shall return the deposit within 30 days of lease termination with an itemized statement."),
    H3("25.4 Lead-Based Paint Disclosure"),
    P("For properties built before 1978, Landlord discloses all known lead-based paint hazards."),
    H3("25.5 Entry Notice (NRS 118A.330)"),
    P("Landlord shall provide at least 24 hours' notice before entering the Premises except in emergencies."),
    H3("25.6 Foreclosure Disclosure"),
    P("Landlord must disclose if the property is subject to a notice of default, notice of sale, or pending foreclosure per NRS 118A.275."),
  ],
  AZ: () => [
    H3("25.1 Arizona Residential Landlord and Tenant Act"),
    P("This Lease is governed by A.R.S. 33-1301 et seq. (Arizona Residential Landlord and Tenant Act). Both parties acknowledge their rights and obligations under this Act."),
    H3("25.2 Fair Housing Compliance"),
    P("In accordance with the Arizona Fair Housing Act (A.R.S. 41-1491), discrimination is prohibited based on race, color, religion, sex, familial status, national origin, or disability."),
    H3("25.3 Security Deposit (A.R.S. 33-1321)"),
    P("Security deposit may not exceed one and one-half months' rent. Landlord shall return the deposit within 14 business days after termination with an itemized statement of deductions."),
    H3("25.4 Pool/Spa Disclosure"),
    P("If the property has a pool or spa, Tenant acknowledges receiving information about pool safety and barrier requirements per A.R.S. 36-1681."),
    H3("25.5 Lead-Based Paint Disclosure"),
    P("For properties built before 1978, Landlord discloses all known lead-based paint hazards."),
    H3("25.6 Entry Notice"),
    P("Landlord shall provide at least 48 hours' notice before entering the Premises for non-emergency purposes."),
    H3("25.7 Bed Bug Disclosure"),
    P("Landlord discloses any known bed bug infestations within the last year per A.R.S. 33-1319."),
  ],
  FL: () => [
    H3("25.1 Florida Residential Landlord and Tenant Act"),
    P("This Lease is governed by Florida Statutes Chapter 83 (Florida Residential Landlord and Tenant Act)."),
    H3("25.2 Fair Housing Compliance"),
    P("In accordance with the Florida Fair Housing Act (F.S. 760.20-760.37), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, or disability."),
    H3("25.3 Security Deposit (F.S. 83.49)"),
    P("Landlord shall hold the security deposit in a Florida banking institution. Within 30 days of receiving the deposit, Landlord shall notify Tenant in writing of where the deposit is held. Deposit shall be returned within 15-60 days after lease termination depending on claims."),
    H3("25.4 Radon Gas Disclosure (F.S. 404.056)"),
    P("RADON GAS: Radon is a naturally occurring radioactive gas that, when accumulated in a building in sufficient quantities, may present health risks. Radon testing is encouraged."),
    H3("25.5 Lead-Based Paint Disclosure"),
    P("For properties built before 1978, Landlord discloses all known lead-based paint hazards."),
    H3("25.6 Entry Notice"),
    P("Landlord shall provide at least 12 hours' notice before entering the Premises except in emergencies."),
  ],
  IL: () => [
    H3("25.1 Illinois Landlord and Tenant Act"),
    P("This Lease is governed by applicable provisions of the Illinois Compiled Statutes, including 765 ILCS 705 (Security Deposit Return Act) and 765 ILCS 742 (Radon Awareness Act)."),
    H3("25.2 Fair Housing Compliance"),
    P("In accordance with the Illinois Human Rights Act (775 ILCS 5/), discrimination is prohibited based on race, color, religion, sex, national origin, ancestry, age, order of protection status, marital status, physical or mental disability, military status, sexual orientation, gender identity, or unfavorable discharge from military service."),
    H3("25.3 Source of Income Protection"),
    P("Illinois law prohibits discrimination based on lawful source of income, including housing subsidies such as Section 8 vouchers."),
    H3("25.4 Security Deposit (765 ILCS 710)"),
    P("For properties with 5 or more units, security deposit may not exceed 1.5 months' rent. Landlord shall return the deposit within 30 days if no deductions, or 45 days with an itemized statement of deductions. Chicago landlords must pay interest on deposits per the Chicago RLTO."),
    H3("25.5 Radon Gas Disclosure (765 ILCS 742)"),
    P("RADON DISCLOSURE: Radon is a Class A human carcinogen and the leading cause of lung cancer among non-smokers. The Illinois Emergency Management Agency recommends testing for radon. The seller or lessor may provide test results or the buyer/lessee may request that testing be performed."),
    H3("25.6 Carbon Monoxide Detector Notice"),
    P("Per the Illinois Carbon Monoxide Alarm Detector Act (430 ILCS 135/), the Landlord certifies that carbon monoxide detectors are installed in accordance with state law."),
    H3("25.7 Lead-Based Paint Disclosure"),
    P("For properties built before 1978, Landlord discloses all known lead-based paint hazards."),
    H3("25.8 Entry Notice"),
    P("Landlord shall provide at least 24 hours' notice before entering the Premises except in emergencies."),
    H3("25.9 Chicago RLTO (If Applicable)"),
    P("If the property is located in Chicago, additional tenant protections apply under the Chicago Residential Landlord and Tenant Ordinance, including required interest on security deposits, specific move-in/move-out procedures, and additional disclosure requirements."),
  ],
};

function getDefaultDisclosures(): Paragraph[] {
  return [
    H3("25.1 Fair Housing Compliance"),
    P("Landlord shall comply with all applicable federal, state, and local fair housing laws. Discrimination based on race, color, religion, sex, national origin, familial status, or disability is prohibited."),
    H3("25.2 Lead-Based Paint Disclosure"),
    P("For properties built before 1978, Landlord discloses all known lead-based paint hazards."),
    H3("25.3 Security Deposit"),
    P("Landlord shall return the security deposit within the time period required by applicable state law after Tenant vacates the Premises with an itemized statement of any deductions."),
    H3("25.4 Entry Notice"),
    P("Landlord shall provide reasonable notice before entering the Premises except in emergencies."),
  ];
}

export async function getStateDisclosures(stateId: string): Promise<Paragraph[]> {
  const stateName = await getStateName(stateId);
  const disclosures: Paragraph[] = [];

  disclosures.push(H2(`25. ${stateName.toUpperCase()} STATE-SPECIFIC PROVISIONS`));

  const builder = STATE_DISCLOSURE_REGISTRY[stateId];
  if (builder) {
    disclosures.push(...builder());
  } else {
    disclosures.push(...getDefaultDisclosures());
  }

  return disclosures;
}
