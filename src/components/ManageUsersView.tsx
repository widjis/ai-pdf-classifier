import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Plus, ShieldCheck, UserCog } from 'lucide-react';
import { ApiClientError, api } from '../lib/api/client';
import type { AppUser, AuditEvent, AuthUser, LdapDirectoryUser } from '../lib/api/types';

const getErrorMessage = (error: unknown) => {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong while talking to the backend.';
};

const ROLE_LABEL: Record<AppUser['role'], string> = {
  admin: 'Admin',
  reviewer: 'Reviewer',
  operator: 'Operator',
};

export default function ManageUsersView({ authUser }: { authUser: AuthUser }) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<AppUser['role']>('operator');
  const [isCreating, setIsCreating] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const [ldapQuery, setLdapQuery] = useState('');
  const [ldapRole, setLdapRole] = useState<AppUser['role']>('operator');
  const [ldapResults, setLdapResults] = useState<LdapDirectoryUser[]>([]);
  const [isLdapSearching, setIsLdapSearching] = useState(false);
  const [ldapProvisioningIdentity, setLdapProvisioningIdentity] = useState<string | null>(null);
  const [hasLdapSearched, setHasLdapSearched] = useState(false);
  const [isLdapSuggestionsOpen, setIsLdapSuggestionsOpen] = useState(false);
  const ldapSuggestionsRef = useRef<HTMLDivElement | null>(null);
  const ldapSearchSeqRef = useRef(0);

  const [resetTarget, setResetTarget] = useState<AppUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [isAuditLoading, setIsAuditLoading] = useState(false);

  const isAdmin = authUser.role === 'admin';

  const sortedUsers = useMemo(() => {
    const copy = [...users];
    copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return copy;
  }, [users]);

  const loadUsers = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.users.list();
      setUsers(res);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const loadAudit = async () => {
    setIsAuditLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.auditEvents.list(120);
      setAuditEvents(res);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsAuditLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    void loadUsers();
    void loadAudit();
  }, [isAdmin]);

  const createUser = async () => {
    const payload = {
      email: email.trim().toLowerCase(),
      displayName: displayName.trim(),
      role,
    };
    if (!payload.email || !payload.displayName) return;

    setIsCreating(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const created = await api.users.create(payload);
      setUsers((prev) => [created, ...prev]);
      setEmail('');
      setDisplayName('');
      setRole('operator');
      setSuccessMessage('User created.');
      await loadAudit();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsCreating(false);
    }
  };

  const searchLdap = async () => {
    const query = ldapQuery.trim();
    if (query.length < 3) return;
    setIsLdapSearching(true);
    setHasLdapSearched(true);
    setErrorMessage(null);
    try {
      const res = await api.users.ldapSearch(query);
      setLdapResults(res);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLdapSearching(false);
    }
  };

  useEffect(() => {
    const onMouseDown = (evt: MouseEvent) => {
      const node = ldapSuggestionsRef.current;
      if (!node) return;
      if (evt.target instanceof Node && node.contains(evt.target)) return;
      setIsLdapSuggestionsOpen(false);
    };
    window.addEventListener('mousedown', onMouseDown);
    return () => window.removeEventListener('mousedown', onMouseDown);
  }, []);

  useEffect(() => {
    const query = ldapQuery.trim();
    if (query.length < 3) {
      setIsLdapSearching(false);
      setHasLdapSearched(false);
      setLdapResults([]);
      return;
    }

    const nextSeq = ldapSearchSeqRef.current + 1;
    ldapSearchSeqRef.current = nextSeq;

    const timeoutId = window.setTimeout(async () => {
      setIsLdapSearching(true);
      setHasLdapSearched(true);
      try {
        const res = await api.users.ldapSearch(query);
        if (ldapSearchSeqRef.current !== nextSeq) return;
        setLdapResults(res);
      } catch (error) {
        if (ldapSearchSeqRef.current !== nextSeq) return;
        setErrorMessage(getErrorMessage(error));
      } finally {
        if (ldapSearchSeqRef.current !== nextSeq) return;
        setIsLdapSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [ldapQuery]);

  const provisionLdapUser = async (identity: string) => {
    setLdapProvisioningIdentity(identity);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const updated = await api.users.provisionLdapUser({ identity, role: ldapRole });
      setUsers((prev) => {
        const exists = prev.some((u) => u.id === updated.id);
        if (exists) return prev.map((u) => (u.id === updated.id ? updated : u));
        return [updated, ...prev];
      });
      setSuccessMessage('User provisioned.');
      await loadAudit();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLdapProvisioningIdentity(null);
    }
  };

  const updateUser = async (userId: string, patch: { role?: AppUser['role']; isActive?: boolean }) => {
    setUpdatingUserId(userId);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const updated = await api.users.update(userId, patch);
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
      setSuccessMessage('User updated.');
      await loadAudit();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setUpdatingUserId(null);
    }
  };

  const closeReset = () => {
    setResetTarget(null);
    setResetPassword('');
    setResetPasswordConfirm('');
  };

  const submitReset = async () => {
    if (!resetTarget) return;
    if (resetPassword.length < 10) return;
    if (resetPassword !== resetPasswordConfirm) return;
    setIsResetting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await api.users.resetLocalPassword(resetTarget.id, { newPassword: resetPassword });
      setSuccessMessage('Local admin password reset.');
      closeReset();
      await loadAudit();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsResetting(false);
    }
  };

  const formatWhen = (iso: string) => {
    const ts = new Date(iso);
    if (!Number.isFinite(ts.getTime())) return iso;
    return ts.toLocaleString();
  };

  const actionLabel = (action: AuditEvent['action']) => {
    if (action === 'users.create') return 'User created';
    if (action === 'users.update') return 'User updated';
    if (action === 'users.reset_local_password') return 'Local password reset';
    return action;
  };

  if (!isAdmin) {
    return (
      <div className="max-w-[1040px] w-full">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Manage Users</h2>
          <p className="text-[15px] text-slate-600">This section is restricted to admins.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-slate-500 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-slate-900">Access denied</div>
              <div className="mt-1 text-sm text-slate-600">Ask an administrator to grant you admin role.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1120px] w-full">
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Manage Users</h2>
            <p className="text-[15px] text-slate-600">Provision accounts, assign roles, and disable access.</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 shadow-sm">
            <UserCog className="w-4 h-4 text-slate-500" />
            <span>Admin-only</span>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
        )}
        {successMessage && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-5">
          <h3 className="text-[17px] font-semibold text-slate-900 mb-0.5">Create User</h3>
          <p className="text-[14px] text-slate-500">Create an account entry. LDAP users can also be auto-provisioned on first login.</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_180px_160px] gap-4 items-end">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700" htmlFor="create_user_email">
                Email
              </label>
              <input
                id="create_user_email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 text-slate-900 placeholder-slate-400 bg-slate-50/60 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700" htmlFor="create_user_display_name">
                Display name
              </label>
              <input
                id="create_user_display_name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Example: Jane Doe"
                className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 text-slate-900 placeholder-slate-400 bg-slate-50/60 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700" htmlFor="create_user_role">
                Role
              </label>
              <select
                id="create_user_role"
                value={role}
                onChange={(e) => setRole(e.target.value as AppUser['role'])}
                className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 text-slate-900 bg-white transition-colors"
              >
                <option value="operator">Operator</option>
                <option value="reviewer">Reviewer</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => void createUser()}
              disabled={isCreating || email.trim().length === 0 || displayName.trim().length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>{isCreating ? 'Creating...' : 'Create'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-5">
          <h3 className="text-[17px] font-semibold text-slate-900 mb-0.5">Enable AD/LDAP User</h3>
          <p className="text-[14px] text-slate-500">Search corporate directory, then add or re-enable the account with a role.</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_180px_160px] gap-4 items-end">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700" htmlFor="ldap_user_query">
                Search
              </label>
              <div className="relative" ref={ldapSuggestionsRef}>
                <input
                  id="ldap_user_query"
                  type="text"
                  value={ldapQuery}
                  onChange={(e) => {
                    setErrorMessage(null);
                    setLdapQuery(e.target.value);
                    setIsLdapSuggestionsOpen(true);
                  }}
                  onFocus={() => setIsLdapSuggestionsOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setIsLdapSuggestionsOpen(false);
                      void searchLdap();
                    }
                    if (e.key === 'Escape') setIsLdapSuggestionsOpen(false);
                  }}
                  placeholder="Email, username, or display name"
                  className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 text-slate-900 placeholder-slate-400 bg-slate-50/60 transition-colors"
                />
                {isLdapSuggestionsOpen && ldapQuery.trim().length >= 3 && ldapResults.length > 0 && (
                  <div className="absolute z-50 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                    <div className="max-h-[260px] overflow-auto">
                      {ldapResults.slice(0, 8).map((u) => (
                        <button
                          key={u.email}
                          type="button"
                          onMouseDown={(evt) => evt.preventDefault()}
                          onClick={() => {
                            setLdapQuery(u.email);
                            setIsLdapSuggestionsOpen(false);
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                        >
                          <div className="text-sm font-semibold text-slate-900 truncate">{u.displayName}</div>
                          <div className="mt-0.5 text-xs text-slate-500 font-medium truncate">{u.email}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="text-[12px] text-slate-500">Minimum 3 characters.</div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700" htmlFor="ldap_user_role">
                Role
              </label>
              <select
                id="ldap_user_role"
                value={ldapRole}
                onChange={(e) => setLdapRole(e.target.value as AppUser['role'])}
                className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 text-slate-900 bg-white transition-colors"
              >
                <option value="operator">Operator</option>
                <option value="reviewer">Reviewer</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => void searchLdap()}
              disabled={isLdapSearching || ldapQuery.trim().length < 3}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLdapSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>{isLdapSearching ? 'Searching...' : 'Search'}</span>
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 overflow-x-auto">
            <table className="min-w-[920px] w-full text-left bg-white">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-[12px] font-semibold text-slate-500">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="text-[13px]">
                {hasLdapSearched && !isLdapSearching && ldapResults.length === 0 && (
                  <tr>
                    <td className="px-4 py-5 text-slate-500 font-medium" colSpan={2}>
                      No directory users found.
                    </td>
                  </tr>
                )}
                {ldapResults.map((u) => {
                  const isProvisioning = ldapProvisioningIdentity === u.email;
                  return (
                    <tr key={u.email} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-4">
                        <div className="text-slate-900 font-semibold truncate">{u.displayName}</div>
                        <div className="mt-0.5 text-slate-500 font-medium truncate">{u.email}</div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => void provisionLdapUser(u.email)}
                          disabled={isProvisioning || ldapProvisioningIdentity !== null}
                          className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isProvisioning ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                          <span>{isProvisioning ? 'Saving...' : 'Add / Enable'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-[17px] font-semibold text-slate-900 mb-0.5">Users</h3>
            <p className="text-[14px] text-slate-500">Role changes take effect on the next token validation.</p>
          </div>
          <button
            type="button"
            onClick={() => void loadUsers()}
            disabled={isLoading}
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[920px] w-full text-left bg-white">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-[12px] font-semibold text-slate-500">
                <th className="px-6 py-3">User</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-[13px]">
              {sortedUsers.length === 0 && !isLoading && (
                <tr>
                  <td className="px-6 py-6 text-slate-500 font-medium" colSpan={4}>
                    No users found.
                  </td>
                </tr>
              )}
              {sortedUsers.map((u) => {
                const isUpdating = updatingUserId === u.id;
                const isSelf = u.id === authUser.id;
                const canResetLocal = u.role === 'admin' && u.email.toLowerCase().endsWith('@local');
                return (
                  <tr key={u.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-6 py-4">
                      <div className="text-slate-900 font-semibold truncate">{u.displayName}</div>
                      <div className="mt-0.5 text-slate-500 font-medium truncate">{u.email}</div>
                      {isSelf && (
                        <div className="mt-1 text-[11px] font-semibold text-slate-400">You</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={u.role}
                        onChange={(e) => void updateUser(u.id, { role: e.target.value as AppUser['role'] })}
                        disabled={isUpdating}
                        className="w-[170px] px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 text-slate-900 bg-white disabled:opacity-50"
                      >
                        <option value="operator">{ROLE_LABEL.operator}</option>
                        <option value="reviewer">{ROLE_LABEL.reviewer}</option>
                        <option value="admin">{ROLE_LABEL.admin}</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold ${
                          u.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {u.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        {canResetLocal && (
                          <button
                            type="button"
                            onClick={() => setResetTarget(u)}
                            disabled={isUpdating}
                            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Reset local password
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void updateUser(u.id, { isActive: !u.isActive })}
                          disabled={isUpdating}
                          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isUpdating ? (
                            <span className="inline-flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Saving...
                            </span>
                          ) : u.isActive ? (
                            'Disable'
                          ) : (
                            'Enable'
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-[17px] font-semibold text-slate-900 mb-0.5">Audit Log</h3>
            <p className="text-[14px] text-slate-500">Tracks role changes, access disablement, and local password resets.</p>
          </div>
          <button
            type="button"
            onClick={() => void loadAudit()}
            disabled={isAuditLoading}
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAuditLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-left bg-white">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-[12px] font-semibold text-slate-500">
                <th className="px-6 py-3 w-[220px]">When</th>
                <th className="px-6 py-3 w-[220px]">Actor</th>
                <th className="px-6 py-3">Action</th>
                <th className="px-6 py-3 w-[260px]">Target</th>
              </tr>
            </thead>
            <tbody className="text-[13px]">
              {!isAuditLoading && auditEvents.length === 0 && (
                <tr>
                  <td className="px-6 py-6 text-slate-500 font-medium" colSpan={4}>
                    No audit events yet.
                  </td>
                </tr>
              )}
              {auditEvents.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-6 py-4 text-slate-600 font-medium tabular-nums">{formatWhen(e.createdAt)}</td>
                  <td className="px-6 py-4">
                    <div className="text-slate-900 font-semibold truncate">{e.actorDisplayName ?? '—'}</div>
                    <div className="mt-0.5 text-slate-500 font-medium truncate">{e.actorEmail ?? '—'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold bg-slate-100 text-slate-700">
                      {actionLabel(e.action)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-900 font-semibold truncate">{e.targetDisplayName ?? '—'}</div>
                    <div className="mt-0.5 text-slate-500 font-medium truncate">{e.targetEmail ?? '—'}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {resetTarget && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-slate-900/40" onClick={closeReset}></div>
          <div className="absolute top-1/2 left-1/2 w-[560px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <div className="text-[13px] font-semibold text-slate-500 tracking-wide">RESET LOCAL PASSWORD</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">Local admin password reset</div>
              <div className="mt-2 text-sm text-slate-600">
                Target: <span className="font-semibold text-slate-800">{resetTarget.displayName}</span>{' '}
                <span className="text-slate-500">({resetTarget.email})</span>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700" htmlFor="reset_local_password">
                  New password
                </label>
                <input
                  id="reset_local_password"
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Min 10 characters"
                  className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 text-slate-900 placeholder-slate-400 bg-slate-50/60 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700" htmlFor="reset_local_password_confirm">
                  Confirm password
                </label>
                <input
                  id="reset_local_password_confirm"
                  type="password"
                  value={resetPasswordConfirm}
                  onChange={(e) => setResetPasswordConfirm(e.target.value)}
                  placeholder="Re-type password"
                  className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 text-slate-900 placeholder-slate-400 bg-slate-50/60 transition-colors"
                />
              </div>
              <div className="text-xs text-slate-500">
                This only applies to local identities (<span className="font-mono">@local</span>). LDAP users should reset passwords via corporate policy.
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeReset}
                disabled={isResetting}
                className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitReset()}
                disabled={
                  isResetting ||
                  resetPassword.length < 10 ||
                  resetPasswordConfirm.length === 0 ||
                  resetPassword !== resetPasswordConfirm
                }
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isResetting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </span>
                ) : (
                  'Reset password'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
