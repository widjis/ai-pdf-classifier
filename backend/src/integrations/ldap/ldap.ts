import { Client } from 'ldapts';
import { env } from '../../core/config/env.js';
import fs from 'node:fs';

export type LdapUser = {
  dn: string;
  email: string;
  displayName: string;
};

const normalizeStringAttr = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value.trim().length > 0 ? value.trim() : undefined;
  if (Array.isArray(value)) {
    const first = value.find((v) => typeof v === 'string' && v.trim().length > 0);
    return typeof first === 'string' ? first.trim() : undefined;
  }
  return undefined;
};

const normalizeStringArrayAttr = (value: unknown): string[] => {
  if (!value) return [];
  if (typeof value === 'string') return value.trim().length > 0 ? [value.trim()] : [];
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string' && v.trim().length > 0).map((v) => (v as string).trim());
  return [];
};

const parseAllowedGroups = (raw: string | undefined): string[] => {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (trimmed.length === 0) return [];

  const separator = [';', '\n', '|'].find((sep) => trimmed.includes(sep));
  if (!separator) return [trimmed];

  return trimmed
    .split(separator)
    .map((g) => g.trim())
    .filter((g) => g.length > 0);
};

const normalizeMemberOf = (value: unknown): string[] => {
  if (!value) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string') as string[];
  return [];
};

const getEmailFromEntry = (entry: Record<string, unknown>): string | undefined => {
  const mail = normalizeStringAttr(entry.mail);
  if (mail) return mail;

  const upn = normalizeStringAttr(entry.userPrincipalName);
  if (upn) return upn;

  const proxyAddresses = normalizeStringArrayAttr(entry.proxyAddresses);
  const primary = proxyAddresses.find((v) => v.startsWith('SMTP:'));
  if (primary) return primary.slice('SMTP:'.length);

  const any = proxyAddresses.find((v) => v.toLowerCase().startsWith('smtp:'));
  if (any) return any.slice('smtp:'.length);

  return undefined;
};

const requireLdapConfig = () => {
  if (!env.ldapUrl) throw new Error('Missing LDAP_URL');
  if (!env.ldapBaseDn) throw new Error('Missing LDAP_BASE_DN');
  let tlsCa: Buffer | undefined;
  if (env.ldapTlsCaBase64) {
    tlsCa = Buffer.from(env.ldapTlsCaBase64, 'base64');
  } else if (env.ldapTlsCaFile) {
    if (!fs.existsSync(env.ldapTlsCaFile)) throw new Error('Missing LDAP_TLS_CA_FILE');
    tlsCa = fs.readFileSync(env.ldapTlsCaFile);
  }
  return {
    url: env.ldapUrl,
    baseDn: env.ldapBaseDn,
    searchBase: env.ldapSearchBase ?? env.ldapBaseDn,
    bindDn: env.ldapBindDn,
    bindPassword: env.ldapBindPassword,
    allowedGroups: parseAllowedGroups(env.ldapAllowedGroups),
    tlsRejectUnauthorized: env.ldapTlsRejectUnauthorized,
    tlsCa,
  };
};

const escapeLdapFilterValue = (value: string) => {
  return value.replace(/\\/g, '\\5c').replace(/\*/g, '\\2a').replace(/\(/g, '\\28').replace(/\)/g, '\\29').replace(/\0/g, '\\00');
};

const isAllowedEntry = (entry: Record<string, unknown>, allowedGroups: string[]): boolean => {
  if (allowedGroups.length === 0) return true;
  const memberOf = normalizeMemberOf(entry.memberOf);
  return allowedGroups.some((allowed) => memberOf.some((m) => m.toLowerCase() === allowed.toLowerCase()));
};

export const lookupLdapUser = async (identity: string): Promise<LdapUser | null> => {
  const cfg = requireLdapConfig();
  const client = new Client({
    url: cfg.url,
    timeout: 10_000,
    connectTimeout: 10_000,
    tlsOptions: { rejectUnauthorized: cfg.tlsRejectUnauthorized, ...(cfg.tlsCa ? { ca: cfg.tlsCa } : {}) },
  });

  try {
    if (cfg.bindDn && cfg.bindPassword) {
      await client.bind(cfg.bindDn, cfg.bindPassword);
    }

    const normalized = identity.trim();
    if (normalized.length === 0) return null;
    const escaped = escapeLdapFilterValue(normalized.toLowerCase());
    const filter = `(|(mail=${escaped})(userPrincipalName=${escaped})(proxyAddresses=*${escaped}*)(sAMAccountName=${escaped}))`;
    const result = await client.search(cfg.searchBase, {
      scope: 'sub',
      filter,
      attributes: ['dn', 'displayName', 'cn', 'mail', 'userPrincipalName', 'proxyAddresses', 'memberOf', 'sAMAccountName'],
      sizeLimit: 3,
      paged: false,
    });

    for (const rawEntry of result.searchEntries) {
      const entry = rawEntry as Record<string, unknown>;
      const dn = typeof entry.dn === 'string' ? entry.dn : undefined;
      if (!dn) continue;
      if (!isAllowedEntry(entry, cfg.allowedGroups)) continue;

      const email = getEmailFromEntry(entry);
      if (!email) continue;

      const displayNameRaw = entry.displayName ?? entry.cn;
      const displayName = normalizeStringAttr(displayNameRaw) ?? email;
      return { dn, email: email.toLowerCase(), displayName };
    }

    return null;
  } finally {
    await client.unbind().catch(() => undefined);
  }
};

export const searchLdapUsers = async (query: string, limit = 10): Promise<LdapUser[]> => {
  const cfg = requireLdapConfig();
  const client = new Client({
    url: cfg.url,
    timeout: 10_000,
    connectTimeout: 10_000,
    tlsOptions: { rejectUnauthorized: cfg.tlsRejectUnauthorized, ...(cfg.tlsCa ? { ca: cfg.tlsCa } : {}) },
  });

  try {
    if (cfg.bindDn && cfg.bindPassword) {
      await client.bind(cfg.bindDn, cfg.bindPassword);
    }

    const trimmed = query.trim();
    if (trimmed.length === 0) return [];
    const escaped = escapeLdapFilterValue(trimmed.toLowerCase());
    const contains = `*${escaped}*`;
    const filter =
      `(|(mail=${contains})(userPrincipalName=${contains})(proxyAddresses=${contains})(sAMAccountName=${contains})(cn=${contains})(name=${contains})(displayName=${contains})(givenName=${contains})(sn=${contains}))`;

    const result = await client.search(cfg.searchBase, {
      scope: 'sub',
      filter,
      attributes: ['dn', 'displayName', 'cn', 'name', 'givenName', 'sn', 'mail', 'userPrincipalName', 'proxyAddresses', 'memberOf', 'sAMAccountName'],
      sizeLimit: Math.min(Math.max(limit, 1), 50),
      paged: false,
    });

    const byEmail = new Map<string, LdapUser>();
    for (const rawEntry of result.searchEntries) {
      const entry = rawEntry as Record<string, unknown>;
      const dn = typeof entry.dn === 'string' ? entry.dn : undefined;
      if (!dn) continue;
      if (!isAllowedEntry(entry, cfg.allowedGroups)) continue;

      const email = getEmailFromEntry(entry);
      if (!email) continue;
      const normalizedEmail = email.toLowerCase();
      if (byEmail.has(normalizedEmail)) continue;

      const displayNameRaw = entry.displayName ?? entry.cn;
      const displayName = normalizeStringAttr(displayNameRaw) ?? normalizedEmail;
      byEmail.set(normalizedEmail, { dn, email: normalizedEmail, displayName });
    }

    return Array.from(byEmail.values());
  } finally {
    await client.unbind().catch(() => undefined);
  }
};

export const authenticateWithLdap = async (identity: string, password: string): Promise<LdapUser | null> => {
  const cfg = requireLdapConfig();
  const client = new Client({
    url: cfg.url,
    timeout: 10_000,
    connectTimeout: 10_000,
    tlsOptions: { rejectUnauthorized: cfg.tlsRejectUnauthorized, ...(cfg.tlsCa ? { ca: cfg.tlsCa } : {}) },
  });

  try {
    if (cfg.bindDn && cfg.bindPassword) {
      await client.bind(cfg.bindDn, cfg.bindPassword);
    }

    const normalized = identity.trim().toLowerCase();
    if (normalized.length === 0) return null;
    const escaped = escapeLdapFilterValue(normalized);
    const filter = `(|(mail=${escaped})(userPrincipalName=${escaped})(proxyAddresses=*${escaped}*)(sAMAccountName=${escaped}))`;
    const result = await client.search(cfg.searchBase, {
      scope: 'sub',
      filter,
      attributes: ['dn', 'displayName', 'cn', 'mail', 'userPrincipalName', 'proxyAddresses', 'memberOf', 'sAMAccountName'],
      sizeLimit: 2,
      paged: false,
    });

    const entry = result.searchEntries[0] as Record<string, unknown> | undefined;
    if (!entry || typeof entry.dn !== 'string') return null;
    const dn = entry.dn;

    if (cfg.allowedGroups.length > 0) {
      const isAllowed = isAllowedEntry(entry, cfg.allowedGroups);
      if (!isAllowed) return null;
    }

    try {
      await client.bind(dn, password);
    } catch {
      return null;
    }

    const displayNameRaw = entry?.displayName ?? entry?.cn;
    const resolvedEmail = getEmailFromEntry(entry) ?? (normalized.includes('@') ? normalized : undefined);
    if (!resolvedEmail) return null;
    const displayName = typeof displayNameRaw === 'string' && displayNameRaw.trim().length > 0 ? displayNameRaw.trim() : resolvedEmail;
    return { dn, email: resolvedEmail.trim().toLowerCase(), displayName };
  } finally {
    await client.unbind().catch(() => undefined);
  }
};
