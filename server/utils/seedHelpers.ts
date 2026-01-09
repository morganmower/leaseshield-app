export function generateKey(category: string, title: string): string {
  const normalized = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 80);
  return `${category}_${normalized}`;
}

export function generateTemplateKey(category: string, templateType: string, title: string): string {
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 60);
  return `${templateType}_${titleSlug}`;
}

export function generateComplianceKey(category: string, title: string): string {
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 70);
  return `${category}_${titleSlug}`;
}

export function generateCommunicationKey(templateType: string, title: string): string {
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 70);
  return `${templateType}_${titleSlug}`;
}
