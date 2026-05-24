import crypto from 'node:crypto';
import { env } from '../config/env.js';

const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

const getKey = (): Buffer => {
  if (!env.secretsEncryptionKeyBase64) {
    throw new Error('Missing SECRETS_ENCRYPTION_KEY_BASE64');
  }
  const raw = Buffer.from(env.secretsEncryptionKeyBase64, 'base64');
  if (raw.length !== KEY_BYTES) {
    throw new Error('Invalid SECRETS_ENCRYPTION_KEY_BASE64: expected 32 bytes base64-encoded');
  }
  return raw;
};

export type EncryptedSecret = {
  iv: Buffer;
  tag: Buffer;
  ciphertext: Buffer;
};

export const encryptSecret = (plaintext: string): Buffer => {
  const key = getKey();
  const iv = crypto.randomBytes(IV_BYTES);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, ciphertext]);
};

export const decryptSecret = (payload: Buffer): string => {
  if (payload.length < IV_BYTES + TAG_BYTES + 1) {
    throw new Error('Invalid encrypted secret payload');
  }
  const key = getKey();
  const iv = payload.subarray(0, IV_BYTES);
  const tag = payload.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = payload.subarray(IV_BYTES + TAG_BYTES);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
};
