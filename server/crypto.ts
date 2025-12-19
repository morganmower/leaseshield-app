import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const rawKey = process.env.SCREENING_CREDENTIALS_KEY;
  if (!rawKey) {
    throw new Error('SCREENING_CREDENTIALS_KEY environment variable is not set');
  }
  
  // Trim whitespace and take only first 64 hex characters
  const key = rawKey.trim().slice(0, 64);
  
  // Validate it's valid hex
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(`SCREENING_CREDENTIALS_KEY must be 64 hex characters (32 bytes). Got ${key.length} chars.`);
  }
  
  const keyBuffer = Buffer.from(key, 'hex');
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(`SCREENING_CREDENTIALS_KEY must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes)`);
  }
  
  return keyBuffer;
}

export interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
}

export function encrypt(plaintext: string): EncryptedData {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

export function decrypt(encryptedData: EncryptedData): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const authTag = Buffer.from(encryptedData.authTag, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export function encryptCredentials(username: string, password: string): {
  encryptedUsername: string;
  encryptedPassword: string;
  encryptionIv: string;
} {
  const usernameData = encrypt(username);
  const passwordData = encrypt(password);
  
  return {
    encryptedUsername: `${usernameData.encrypted}:${usernameData.authTag}`,
    encryptedPassword: `${passwordData.encrypted}:${passwordData.authTag}`,
    encryptionIv: `${usernameData.iv}:${passwordData.iv}`,
  };
}

export function decryptCredentials(data: {
  encryptedUsername: string;
  encryptedPassword: string;
  encryptionIv: string;
}): { username: string; password: string } {
  const [usernameEncrypted, usernameAuthTag] = data.encryptedUsername.split(':');
  const [passwordEncrypted, passwordAuthTag] = data.encryptedPassword.split(':');
  const [usernameIv, passwordIv] = data.encryptionIv.split(':');
  
  const username = decrypt({
    encrypted: usernameEncrypted,
    iv: usernameIv,
    authTag: usernameAuthTag,
  });
  
  const password = decrypt({
    encrypted: passwordEncrypted,
    iv: passwordIv,
    authTag: passwordAuthTag,
  });
  
  return { username, password };
}

export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}
