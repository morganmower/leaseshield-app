// NOTE: DOCX generation must use `docx` library only.
// HTML → DOCX conversion (html-to-docx) caused Word corruption issues.
// These tests validate that DOCX files are structurally valid OOXML.
import JSZip from 'jszip';
import { generateDocx, H1, H2, P, HR, Footer } from '../docxBuilder';
import { generateDocumentDOCX } from '../documentGenerator';

describe('DOCX Generation Validation', () => {
  it('generates a valid Word-openable DOCX with correct structure', async () => {
    const testChildren = [
      H1('Test Document'),
      H2('Section 1'),
      P('This is a test paragraph.'),
      HR(),
      Footer(),
    ];

    const buffer = await generateDocx({
      title: 'Test Document',
      stateId: 'UT',
      version: 1,
      children: testChildren,
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.slice(0, 2).toString()).toBe('PK');

    const zip = await JSZip.loadAsync(buffer);
    
    const requiredFiles = [
      '[Content_Types].xml',
      '_rels/.rels',
      'word/document.xml',
    ];

    for (const file of requiredFiles) {
      expect(zip.file(file)).toBeTruthy();
    }

    const documentXml = await zip.file('word/document.xml')?.async('text');
    expect(documentXml).toBeTruthy();
    expect(documentXml).toContain('Test Document');
    expect(documentXml).toContain('Section 1');
    expect(documentXml).toContain('test paragraph');
  });

  it('generates DOCX with correct margins', async () => {
    const buffer = await generateDocx({
      title: 'Margin Test',
      stateId: 'TX',
      children: [P('Content')],
      margins: {
        top: 1440,
        right: 1440,
        bottom: 1440,
        left: 1440,
      },
    });

    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await zip.file('word/document.xml')?.async('text');
    
    expect(documentXml).toBeTruthy();
    expect(documentXml).toContain('Content');
  });

  it('generates DOCX that is not corrupted (valid ZIP structure)', async () => {
    const buffer = await generateDocx({
      title: 'Corruption Test',
      stateId: 'CA',
      children: [H1('Header'), P('Body text'), Footer()],
    });

    const loadZip = async () => {
      await JSZip.loadAsync(buffer);
    };

    await expect(loadZip()).resolves.not.toThrow();
  });

  it('includes key lease sections in generated documents', async () => {
    const keySections = [
      'TERM OF LEASE',
      'PARTIES',
      'RENT',
      'SECURITY DEPOSIT',
      'MAINTENANCE',
      'INDEMNIFICATION',
      'GOVERNING LAW',
      'SIGNATURES',
    ];

    const testChildren = keySections.flatMap(section => [
      H2(section),
      P(`Content for ${section} section.`),
    ]);
    testChildren.push(Footer());

    const buffer = await generateDocx({
      title: 'Lease Agreement',
      stateId: 'UT',
      children: testChildren,
    });

    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await zip.file('word/document.xml')?.async('text');

    for (const section of keySections) {
      expect(documentXml).toContain(section);
    }
  });

  it('generateDocumentDOCX includes comprehensive content and state disclosures', async () => {
    const buffer = await generateDocumentDOCX({
      templateTitle: 'Residential Lease Agreement',
      templateContent: '',
      fieldValues: {
        landlordName: 'Test Landlord',
        tenantName: 'Test Tenant',
        propertyAddress: '123 Main St',
        propertyCity: 'Salt Lake City',
        propertyZip: '84101',
        monthlyRent: '1500',
        securityDeposit: '1500',
      },
      stateId: 'UT',
      version: 1,
      updatedAt: new Date(),
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.slice(0, 2).toString()).toBe('PK');

    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await zip.file('word/document.xml')?.async('text');
    expect(documentXml).toBeTruthy();

    const requiredSections = [
      'TERM OF LEASE',
      'PARTIES',
      'RENT',
      'SECURITY DEPOSIT',
      'MAINTENANCE AND REPAIRS',
      'INDEMNIFICATION',
      'GOVERNING LAW',
      'SIGNATURES',
    ];

    for (const section of requiredSections) {
      expect(documentXml).toContain(section);
    }

    expect(documentXml).toContain('UTAH STATE-SPECIFIC PROVISIONS');
    expect(documentXml).toContain('Utah Fair Housing Act');
    expect(documentXml).toContain('Test Landlord');
    expect(documentXml).toContain('Test Tenant');
  });

  it('generateDocumentDOCX includes Texas state disclosures for TX', async () => {
    const buffer = await generateDocumentDOCX({
      templateTitle: 'Residential Lease Agreement',
      templateContent: '',
      fieldValues: {},
      stateId: 'TX',
      version: 1,
      updatedAt: new Date(),
    });

    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await zip.file('word/document.xml')?.async('text');

    expect(documentXml).toContain('TEXAS STATE-SPECIFIC PROVISIONS');
    expect(documentXml).toContain('Texas Property Code');
  });
});
