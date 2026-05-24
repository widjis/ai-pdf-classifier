import { Client } from 'ldapts';
import { env } from '../../core/config/env.js';

export type LdapUser = {
  dn: string;
  email: string;
  displayName: string;
};

const parseAllowedGroups = (raw: string | undefined): string[] => {
  if (!raw) return [];
  return raw
    .split(',')
    .map((g) => g.trim())
    .filter((g) => g.length > 0);
};

const normalizeMemberOf = (value: unknown): string[] => {
  if (!value) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string') as string[];
  return [];
};

const requireLdapConfig = () => {
  if (!env.ldapUrl) throw new Error('Missing LDAP_URL');
  if (!env.ldapBaseDn) throw new Error('Missing LDAP_BASE_DN');
  return {
    url: env.ldapUrl,
    baseDn: env.ldapBaseDn,
    searchBase: env.ldapSearchBase ?? env.ldapBaseDn,
    bindDn: env.ldapBindDn,
    bindPassword: env.ldapBindPassword,
    allowedGroups: parseAllowedGroups(env.ldapAllowedGroups),
    tlsRejectUnauthorized: env.ldapTlsRejectUnauthorized,
  };
};

const escapeLdapFilterValue = (value: string) => {
  return value.replace(/\\/g, '\\5c').replace(/\*/g, '\\2a').replace(/\(/g, '\\28').replace(/\)/g, '\\29').replace(/\0/g, '\\00');
};

export const authenticateWithLdap = async (email: string, password: string): Promise<LdapUser | null> => {
  const cfg = requireLdapConfig();
  const client = new Client({
    url: cfg.url,
    timeout: 10_000,
    connectTimeout: 10_000,
    tlsOptions: { rejectUnauthorized: cfg.tlsRejectUnauthorized },
  });

  try {
    if (cfg.bindDn && cfg.bindPassword) {
      await client.bind(cfg.bindDn, cfg.bindPassword);
    }

    const escapedEmail = escapeLdapFilterValue(email.trim().toLowerCase());
    const filter = `(|(mail=${escapedEmail})(userPrincipalName=${escapedEmail}))`;
    const result = await client.search(cfg.searchBase, {
      scope: 'sub',
      filter,
      attributes: ['dn', 'displayName', 'cn', 'mail', 'userPrincipalName', 'memberOf'],
      sizeLimit: 2,
      paged: false,
    });

    const entry = result.searchEntries[0] as Record<string, unknown> | undefined;
    const dn = typeof entry?.dn === 'string' ? entry.dn : undefined;
    if (!dn) return null;

    if (cfg.allowedGroups.length > 0) {
      const memberOf = normalizeMemberOf(entry?.memberOf);
      const isAllowed = cfg.allowedGroups.some((allowed) => memberOf.some((m) => m.toLowerCase() === allowed.toLowerCase()));
      if (!isAllowed) return null;
    }

    try {
      await client.bind(dn, password);
    } catch {
      return null;
    }

    const displayNameRaw = entry?.displayName ?? entry?.cn;
    const displayName = typeof displayNameRaw === 'string' && displayNameRaw.trim().length > 0 ? displayNameRaw.trim() : email.trim();
    return { dn, email: email.trim().toLowerCase(), displayName };
  } finally {
    await client.unbind().catch(() => undefined);
  }
};
