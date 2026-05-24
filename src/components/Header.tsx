import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, HelpCircle, Loader2, Search } from 'lucide-react';
import { ViewState } from '../types';
import { api } from '../lib/api/client';
import type { Batch, BatchSummary } from '../lib/api/types';

interface HeaderProps {
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
}

export default function Header({ currentView, onNavigate }: HeaderProps) {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchSummaries, setBatchSummaries] = useState<BatchSummary[]>([]);
  const popoverRef = useRef<HTMLDivElement | null>(null);

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
    <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 flex-shrink-0">
      <div className="flex items-center gap-10 h-full">
        <h1 className="text-xl font-bold text-brand-600 tracking-tight flex items-center">AI PDF Classifier</h1>
        <nav className="flex space-x-6 h-full">
          {(['dashboard', 'files'] as ViewState[]).map((tab) => (
            <button
              key={tab}
              onClick={() => onNavigate(tab)}
              className={`h-full px-2 text-sm font-medium border-b-2 transition-colors capitalize cursor-pointer flex items-center mt-[1px] ${
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

      <div className="flex items-center gap-5">
        {currentView === 'dashboard' && (
          <div className="relative relative flex items-center h-full">
            <Search className="w-4 h-4 absolute left-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search files..."
              className="pl-9 pr-4 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 w-64 text-slate-800 placeholder-slate-400 bg-slate-50"
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
          <button className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border border-slate-200 cursor-pointer">
             <img src="https://i.pravatar.cc/150?u=a042581f4e" alt="User" className="w-full h-full object-cover" />
          </button>
        </div>
      </div>
    </header>
  );
}
