import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tryLoadEnv = (envPath: string) => {
  dotenv.config({ path: envPath });
};

tryLoadEnv(path.join(process.cwd(), '.env'));
tryLoadEnv(path.join(process.cwd(), '.env.local'));
tryLoadEnv(path.join(process.cwd(), '..', '.env'));
tryLoadEnv(path.join(process.cwd(), '..', '.env.local'));
tryLoadEnv(path.join(__dirname, '..', '..', '..', '.env'));

const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return defaultValue;
};

const requireString = (name: string): string => {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
};

const getPort = (): number => {
  const raw = process.env.PORT?.trim();
  if (!raw) return 4000;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new Error('Invalid PORT');
  return n;
};

const getOptionalTrimmed = (name: string): string | undefined => {
  const value = process.env[name];
  if (!value) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed;
};

const buildPostgresUrl = (baseUrl: string): string => {
  const url = new URL(baseUrl);
  const username = getOptionalTrimmed('POSTGRES_USERNAME');
  const password = getOptionalTrimmed('POSTGRES_PASSWORD');
  const database = getOptionalTrimmed('POSTGRES_DATABASE');

  if (username) url.username = username;
  if (password) url.password = password;
  if (database) url.pathname = `/${database}`;

  return url.toString();
};

export const env = {
  nodeEnv: process.env.NODE_ENV?.trim() ?? 'development',
  port: getPort(),
  postgresUrl: buildPostgresUrl(requireString('POSTGRES_URL')),
  postgresSsl: parseBoolean(process.env.POSTGRES_SSL, false),
  postgresSslRejectUnauthorized: parseBoolean(process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED, false),
  secretsEncryptionKeyBase64: getOptionalTrimmed('SECRETS_ENCRYPTION_KEY_BASE64'),
  authTokenKeyBase64: getOptionalTrimmed('AUTH_TOKEN_KEY_BASE64'),
  localAdminEmail: getOptionalTrimmed('LOCAL_ADMIN_EMAIL'),
  localAdminPassword: getOptionalTrimmed('LOCAL_ADMIN_PASSWORD'),
  localAdminDisplayName: getOptionalTrimmed('LOCAL_ADMIN_DISPLAY_NAME') ?? 'Local Admin',
  ldapUrl: getOptionalTrimmed('LDAP_URL'),
  ldapBaseDn: getOptionalTrimmed('LDAP_BASE_DN'),
  ldapSearchBase: getOptionalTrimmed('LDAP_SEARCH_BASE'),
  ldapBindDn: getOptionalTrimmed('LDAP_BIND_DN'),
  ldapBindPassword: getOptionalTrimmed('LDAP_BIND_PASSWORD'),
  ldapAllowedGroups: getOptionalTrimmed('LDAP_ALLOWED_GROUPS'),
  ldapTlsRejectUnauthorized: parseBoolean(process.env.LDAP_TLS_REJECT_UNAUTHORIZED, true),
  ldapTlsCaFile: getOptionalTrimmed('LDAP_TLS_CA_FILE'),
  ldapTlsCaBase64: getOptionalTrimmed('LDAP_TLS_CA_BASE64'),
  uploadDir: getOptionalTrimmed('UPLOAD_DIR') ?? path.resolve(process.cwd(), 'storage', 'uploads'),
  exportDir: getOptionalTrimmed('EXPORT_DIR') ?? path.resolve(process.cwd(), 'storage', 'exports'),
  sharedFolderPath: getOptionalTrimmed('SHARED_FOLDER_PATH'),
  cifsSharePath: getOptionalTrimmed('CIFS_SHARE_PATH'),
} as const;
