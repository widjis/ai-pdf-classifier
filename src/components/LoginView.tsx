import React, { useMemo, useState } from 'react';
import { Lock, Mail } from 'lucide-react';
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
    <div className="min-h-screen w-full bg-[#f7f9fb] flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,#e2e8f0_1px,transparent_0)] [background-size:24px_24px] opacity-50" />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand-600/10 rounded-full blur-[90px]" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-600/10 rounded-full blur-[90px]" />
      </div>

      <div className="relative w-full max-w-4xl rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="p-8 md:p-10">
            <div className="flex items-center gap-3 mb-10">
              <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-sm">
                <Lock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold text-slate-900 leading-tight">PDF.AI</div>
                <div className="text-xs text-slate-500 font-medium">Enterprise batch classification</div>
              </div>
            </div>

            <div className="mb-7">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sign in</h1>
              <p className="mt-2 text-sm text-slate-500">Login with your email. Authentication is handled by Active Directory.</p>
            </div>

            {errorMessage && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
            )}

            <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="login_email">
                  Email
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
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 placeholder-slate-400 bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="login_password">
                  Password
                </label>
                <input
                  id="login_password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 placeholder-slate-400 bg-slate-50"
                />
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-7 text-xs text-slate-500">
              If you do not have an account, contact an administrator to be added to the system.
            </div>
          </div>

          <div className="hidden md:block bg-slate-950 relative overflow-hidden">
            <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_2px_2px,#94a3b8_1px,transparent_0)] [background-size:22px_22px]" />
            <div className="absolute inset-0 bg-gradient-to-br from-brand-600/25 via-transparent to-emerald-500/25" />
            <div className="relative h-full p-10 flex flex-col justify-between">
              <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-6">
                <div className="text-sm font-semibold text-white tracking-tight mb-2">Secure by default</div>
                <div className="text-[13px] text-slate-200/80 leading-relaxed">
                  Credentials are validated against Active Directory. Provider API keys are stored encrypted and can be tested from Settings.
                </div>
              </div>
              <div className="text-white/20 font-bold tracking-widest text-3xl select-none">DEEPARCHIVE</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
