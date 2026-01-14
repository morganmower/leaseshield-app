import crypto from 'crypto';

const MAX_KEY_LENGTH = 100;

function truncateWithHash(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  const hash = crypto.createHash('md5').update(str).digest('hex').substring(0, 8);
  return str.substring(0, maxLength - 9) + '_' + hash;
}

export function generateKey(category: string, title: string): string {
  const normalized = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 80);
  const key = `${category}_${normalized}`;
  return truncateWithHash(key, MAX_KEY_LENGTH);
}

/**
 * Generate template key from category, templateType, and title.
 * DEPRECATED for new content: Prefer explicit keys in seed records.
 * Use only as fallback for legacy migration.
 */
export function generateTemplateKey(category: string, templateType: string, title: string): string {
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_');
  const key = `${templateType}_${titleSlug}`;
  return truncateWithHash(key, MAX_KEY_LENGTH);
}

/**
 * Generate compliance card key from category and title.
 * DEPRECATED for new content: Prefer explicit keys in seed records.
 * Use only as fallback for legacy migration.
 */
export function generateComplianceKey(category: string, title: string): string {
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_');
  const key = `${category}_${titleSlug}`;
  return truncateWithHash(key, MAX_KEY_LENGTH);
}

/**
 * Generate communication template key from templateType and title.
 * DEPRECATED for new content: Prefer explicit keys in seed records.
 * Use only as fallback for legacy migration.
 */
export function generateCommunicationKey(templateType: string, title: string): string {
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_');
  const key = `${templateType}_${titleSlug}`;
  return truncateWithHash(key, MAX_KEY_LENGTH);
}
