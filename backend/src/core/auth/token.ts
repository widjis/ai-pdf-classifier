import crypto from 'node:crypto';
import { env } from '../config/env.js';

const TOKEN_PREFIX = 'v1';

const base64UrlEncode = (buf: Buffer): string => {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const base64UrlDecode = (value: string): Buffer => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLen);
  return Buffer.from(padded, 'base64');
};

const getAuthKey = (): Buffer => {
  const raw = env.authTokenKeyBase64 ?? env.secretsEncryptionKeyBase64;
  if (!raw) throw new Error('Missing AUTH_TOKEN_KEY_BASE64');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('Invalid AUTH_TOKEN_KEY_BASE64');
  return key;
};

export type AuthTokenPayload = {
  sub: string;
  email: string;
  exp: number;
};

export const signAuthToken = (payload: { sub: string; email: string }, ttlSeconds: number): string => {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body: AuthTokenPayload = { sub: payload.sub, email: payload.email, exp };
  const bodyJson = Buffer.from(JSON.stringify(body), 'utf8');
  const bodyEncoded = base64UrlEncode(bodyJson);

  const mac = crypto.createHmac('sha256', getAuthKey()).update(`${TOKEN_PREFIX}.${bodyEncoded}`).digest();
  const sigEncoded = base64UrlEncode(mac);
  return `${TOKEN_PREFIX}.${bodyEncoded}.${sigEncoded}`;
};

export const verifyAuthToken = (token: string): AuthTokenPayload => {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const prefix = parts[0];
  const bodyEncoded = parts[1];
  const sigEncoded = parts[2];
  if (!prefix || !bodyEncoded || !sigEncoded) throw new Error('Invalid token');
  if (prefix !== TOKEN_PREFIX) throw new Error('Invalid token');

  const mac = crypto.createHmac('sha256', getAuthKey()).update(`${prefix}.${bodyEncoded}`).digest();
  const expectedSig = base64UrlEncode(mac);
  if (expectedSig.length !== sigEncoded.length) throw new Error('Invalid token');
  if (!crypto.timingSafeEqual(Buffer.from(expectedSig, 'utf8'), Buffer.from(sigEncoded, 'utf8'))) throw new Error('Invalid token');

  const body = JSON.parse(base64UrlDecode(bodyEncoded).toString('utf8')) as AuthTokenPayload;
  if (typeof body !== 'object' || body === null) throw new Error('Invalid token');
  if (typeof body.sub !== 'string' || typeof body.email !== 'string' || typeof body.exp !== 'number') throw new Error('Invalid token');
  if (Math.floor(Date.now() / 1000) > body.exp) throw new Error('Token expired');
  return body;
};
