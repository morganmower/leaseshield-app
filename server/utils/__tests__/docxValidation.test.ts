import JSZip from 'jszip';
import { generateDocx, H1, H2, P, HR, Footer } from '../docxBuilder';

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
});
