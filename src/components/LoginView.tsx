import React, { useMemo, useState } from 'react';
import { ArrowRight, BadgeCheck, Building2, Check, Eye, EyeOff, KeyRound, Loader2, Lock, Mail, Server, ShieldCheck } from 'lucide-react';
import { ApiClientError, api, authToken } from '../lib/api/client';
import type { AuthUser } from '../lib/api/types';

const getErrorMessage = (error: unknown) => {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong while talking to the backend.';
};

export default function LoginView({ onSuccess }: { onSuccess: (user: AuthUser) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = useMemo(() => email.trim().length > 3 && password.length > 0 && !isSubmitting, [email, password.length, isSubmitting]);

  const onSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await api.auth.login({ email: email.trim(), password });
      authToken.set(res.token);
      onSuccess(res.user);
    } catch (error) {
      authToken.clear();
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative isolate overflow-hidden bg-slate-950 flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.25)_1px,transparent_0)] [background-size:28px_28px] opacity-60" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(0,83,219,0.22),transparent_38%,rgba(16,185,129,0.18))]" />
        <div className="absolute -top-36 -left-40 w-[520px] h-[520px] bg-brand-600/25 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 -right-44 w-[560px] h-[560px] bg-emerald-500/20 rounded-full blur-[130px]" />
      </div>

      <div className="relative w-full max-w-5xl rounded-3xl overflow-hidden border border-white/10 bg-white/5 shadow-[0_30px_120px_-45px_rgba(0,0,0,0.85)] backdrop-blur-xl">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="relative p-8 md:p-10 text-white">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/10 text-white flex items-center justify-center shadow-sm">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold tracking-wide text-white/95">AI PDF Classifier</div>
                  <div className="text-xs text-white/60 font-medium">Enterprise document intelligence</div>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-[11px] font-semibold text-white/70">
                <Building2 className="w-4 h-4" />
                <span>Managed access</span>
              </div>
            </div>

            <div className="mt-10 max-w-md">
              <h1 className="text-3xl font-semibold tracking-tight leading-tight">
                Secure sign-in for
                <span className="block text-white/80">batch classification at scale</span>
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-white/65">
                Use your corporate credentials. Sessions are signed, scoped, and auditable.
              </p>
            </div>

            <div className="mt-10 grid gap-3 max-w-md">
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                <ShieldCheck className="w-5 h-5 text-emerald-300 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white/90">Policy-aligned security</div>
                  <div className="mt-1 text-[13px] leading-relaxed text-white/65">
                    Enforced password policy, session expiration, and least-privilege scopes.
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                <BadgeCheck className="w-5 h-5 text-sky-200 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white/90">Traceable operations</div>
                  <div className="mt-1 text-[13px] leading-relaxed text-white/65">
                    Every classification run is attributable to an authenticated identity.
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                <Server className="w-5 h-5 text-indigo-200 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white/90">Environment-ready</div>
                  <div className="mt-1 text-[13px] leading-relaxed text-white/65">
                    Deployable behind SSO gateways, proxies, and internal networks.
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 flex items-center gap-2 text-xs text-white/45">
              <Check className="w-4 h-4 text-emerald-300/80" />
              <span className="font-mono tracking-wide">DEEPARCHIVE</span>
              <span className="text-white/30">•</span>
              <span>Security-first workspace</span>
            </div>
          </div>

          <div className="bg-white p-8 md:p-10">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-500 tracking-wide">SIGN IN</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900 tracking-tight">Access your workspace</div>
              </div>
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600">
                <KeyRound className="w-4 h-4 text-slate-500" />
                <span>Token-based session</span>
              </div>
            </div>

            {errorMessage && (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
            )}

            <form onSubmit={(e) => void onSubmit(e)} className="mt-7 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="login_email">
                  Corporate email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="login_email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    autoComplete="username"
                    className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 text-slate-900 placeholder-slate-400 bg-slate-50/60 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="login_password">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login_password"
                    type={isPasswordVisible ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full px-4 pr-11 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 text-slate-900 placeholder-slate-400 bg-slate-50/60 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setIsPasswordVisible((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                  >
                    {isPasswordVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="group w-full rounded-xl bg-gradient-to-b from-brand-600 to-brand-700 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_40px_-18px_rgba(0,83,219,0.65)] transition-all hover:from-brand-500 hover:to-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-500/25 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                <span className="flex items-center justify-center gap-2">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Signing in</span>
                    </>
                  ) : (
                    <>
                      <span>Continue</span>
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </span>
              </button>
            </form>

            <div className="mt-7 flex items-start justify-between gap-6 text-xs text-slate-500">
              <div className="leading-relaxed">
                No account? Contact your administrator to provision access.
              </div>
              <div className="hidden sm:flex flex-col items-end gap-1 text-[11px] text-slate-400">
                <div className="font-semibold text-slate-500">Support</div>
                <div className="font-mono">it-helpdesk@company</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
