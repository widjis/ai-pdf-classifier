import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, ChevronDown, HelpCircle, Loader2, LogOut, Menu, Search } from 'lucide-react';
import { ViewState } from '../types';
import { api } from '../lib/api/client';
import type { AuthUser, Batch, BatchSummary } from '../lib/api/types';

interface HeaderProps {
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  onToggleSidebar?: () => void;
  authUser: AuthUser;
  onSignOut: () => void;
}

export default function Header({ currentView, onNavigate, onToggleSidebar, authUser, onSignOut }: HeaderProps) {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchSummaries, setBatchSummaries] = useState<BatchSummary[]>([]);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const loadBatchSummaries = async () => {
    setIsLoadingBatches(true);
    setBatchError(null);
    try {
      const batches = await api.batches.list();
      const sorted = [...batches].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const top = sorted.slice(0, 6);
      const summaries = await Promise.all(top.map((b) => api.batches.get(b.id)));
      setBatchSummaries(summaries);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load batches.';
      setBatchError(message);
    } finally {
      setIsLoadingBatches(false);
    }
  };

  useEffect(() => {
    if (!isNotificationsOpen) return;
    void loadBatchSummaries();
    const id = window.setInterval(() => {
      void loadBatchSummaries();
    }, 8000);
    return () => window.clearInterval(id);
  }, [isNotificationsOpen]);

  useEffect(() => {
    if (!isNotificationsOpen) return;
    const onMouseDown = (evt: MouseEvent) => {
      const node = popoverRef.current;
      if (!node) return;
      if (evt.target instanceof Node && node.contains(evt.target)) return;
      setIsNotificationsOpen(false);
    };
    const onKeyDown = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') setIsNotificationsOpen(false);
    };
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isNotificationsOpen]);

  useEffect(() => {
    if (!isUserMenuOpen) return;
    const onMouseDown = (evt: MouseEvent) => {
      const node = userMenuRef.current;
      if (!node) return;
      if (evt.target instanceof Node && node.contains(evt.target)) return;
      setIsUserMenuOpen(false);
    };
    const onKeyDown = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') setIsUserMenuOpen(false);
    };
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isUserMenuOpen]);

  const initials = useMemo(() => {
    const raw = authUser.displayName || authUser.email;
    const parts = raw
      .split(/\s+/g)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    const first = parts[0]?.[0] ?? 'U';
    const second = (parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1]) ?? '';
    return `${first}${second}`.toUpperCase();
  }, [authUser.displayName, authUser.email]);

  const activeCount = useMemo(() => {
    return batchSummaries.filter((b) => b.status === 'running' || b.totals.processing > 0 || b.totals.queued > 0).length;
  }, [batchSummaries]);

  const statusBadge = (batch: Batch) => {
    switch (batch.status) {
      case 'draft':
        return { label: 'Draft', className: 'bg-slate-100 text-slate-700' };
      case 'running':
        return { label: 'Running', className: 'bg-blue-100 text-blue-700' };
      case 'needs_review':
        return { label: 'Needs review', className: 'bg-amber-100 text-amber-800' };
      case 'completed':
        return { label: 'Completed', className: 'bg-emerald-100 text-emerald-700' };
      case 'failed':
        return { label: 'Failed', className: 'bg-red-100 text-red-700' };
      case 'canceled':
        return { label: 'Canceled', className: 'bg-slate-100 text-slate-700' };
      default:
        return { label: batch.status, className: 'bg-slate-100 text-slate-700' };
    }
  };

  const progressPercent = (b: BatchSummary) => {
    const total = b.totals.total;
    if (total <= 0) return 0;
    const done = b.totals.approved + b.totals.readyForReview + b.totals.failed;
    return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
  };

  return (
    <header className="h-16 border-b border-slate-200/70 bg-white/70 backdrop-blur-xl flex items-center justify-between px-4 sm:px-6 lg:px-8 flex-shrink-0">
      <div className="flex items-center gap-4 md:gap-10 h-full min-w-0">
        {onToggleSidebar ? (
          <button
            type="button"
            className="md:hidden -ml-1 p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            onClick={onToggleSidebar}
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
        ) : null}
        <h1 className="text-[15px] font-semibold text-slate-900 tracking-wide flex items-center gap-2 min-w-0">
          <span className="inline-flex h-7 items-center rounded-full border border-slate-200 bg-white px-2.5 text-[12px] font-semibold text-brand-700">
            AI PDF Classifier
          </span>
          <span className="hidden sm:inline text-slate-700">Console</span>
        </h1>
        <nav className="hidden md:flex space-x-6 h-full">
          {(['dashboard', 'files'] as ViewState[]).map((tab) => (
            <button
              key={tab}
              onClick={() => onNavigate(tab)}
              className={`h-full px-2 text-sm font-semibold border-b-2 transition-colors capitalize cursor-pointer flex items-center mt-[1px] ${
                currentView === tab
                  ? 'border-brand-600 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-3 sm:gap-5">
        {currentView === 'dashboard' && (
          <div className="relative flex items-center h-full">
            <Search className="w-4 h-4 absolute left-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search files..."
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 w-[180px] sm:w-64 text-slate-900 placeholder-slate-400 bg-white/70 transition-colors"
            />
          </div>
        )}
        <div className="flex items-center gap-4 text-slate-500 ml-2">
          <div className="relative" ref={popoverRef}>
            <button
              type="button"
              className="hover:text-slate-800 transition-colors cursor-pointer relative"
              aria-haspopup="dialog"
              aria-expanded={isNotificationsOpen}
              onClick={() => setIsNotificationsOpen((v) => !v)}
            >
              <Bell className="w-5 h-5" />
              {activeCount > 0 && (
                <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
              )}
            </button>

            {isNotificationsOpen && (
              <div className="absolute right-0 mt-3 w-[420px] max-w-[calc(100vw-24px)] rounded-xl border border-slate-200 bg-white shadow-lg z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Batches</div>
                    <div className="text-xs text-slate-500">Live progress and status</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadBatchSummaries()}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                    disabled={isLoadingBatches}
                  >
                    Refresh
                  </button>
                </div>

                <div className="max-h-[420px] overflow-y-auto">
                  {isLoadingBatches && (
                    <div className="px-4 py-4 text-sm text-slate-600 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading...
                    </div>
                  )}
                  {!isLoadingBatches && batchError && <div className="px-4 py-4 text-sm text-red-700">{batchError}</div>}
                  {!isLoadingBatches && !batchError && batchSummaries.length === 0 && (
                    <div className="px-4 py-4 text-sm text-slate-600">No batches yet.</div>
                  )}

                  {!isLoadingBatches &&
                    !batchError &&
                    batchSummaries.map((b) => {
                      const badge = statusBadge(b);
                      const pct = progressPercent(b);
                      const total = b.totals.total;
                      const done = b.totals.approved + b.totals.readyForReview + b.totals.failed;
                      return (
                        <div key={b.id} className="px-4 py-3 border-b border-slate-100 last:border-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900 truncate">{b.name}</div>
                              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                                <span className={`rounded-full px-2 py-0.5 font-semibold ${badge.className}`}>{badge.label}</span>
                                <span className="tabular-nums">
                                  {done}/{total} ({pct}%)
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                              onClick={() => onNavigate('files')}
                            >
                              View
                            </button>
                          </div>

                          <div className="mt-2 h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                            <div className="h-full bg-brand-600" style={{ width: `${pct}%` }} />
                          </div>

                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                            <span className="tabular-nums">Queued: {b.totals.queued}</span>
                            <span className="tabular-nums">Processing: {b.totals.processing}</span>
                            <span className="tabular-nums">Ready: {b.totals.readyForReview}</span>
                            <span className="tabular-nums">Approved: {b.totals.approved}</span>
                            <span className="tabular-nums">Failed: {b.totals.failed}</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
          <button className="hover:text-slate-800 transition-colors cursor-pointer">
            <HelpCircle className="w-5 h-5" />
          </button>
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              className="group inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-1.5 py-1.5 shadow-sm hover:bg-white transition-colors"
              onClick={() => {
                setIsNotificationsOpen(false);
                setIsUserMenuOpen((v) => !v);
              }}
              aria-haspopup="menu"
              aria-expanded={isUserMenuOpen}
              title={authUser.displayName}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-b from-slate-100 to-slate-200 flex items-center justify-center overflow-hidden border border-slate-200">
                <span className="text-[11px] font-bold tracking-wide text-slate-700">{initials}</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-3 w-[280px] max-w-[calc(100vw-24px)] rounded-xl border border-slate-200 bg-white shadow-lg z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200">
                  <div className="text-sm font-semibold text-slate-900 truncate">{authUser.displayName}</div>
                  <div className="text-xs text-slate-500 truncate">{authUser.email}</div>
                  <div className="mt-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                    {authUser.role}
                  </div>
                </div>
                <div className="p-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onSignOut();
                    }}
                    className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
