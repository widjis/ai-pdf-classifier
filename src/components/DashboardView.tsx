import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CloudUpload, FileText, ExternalLink, RefreshCw } from 'lucide-react';
import { DocumentInfo } from '../types';
import { api } from '../lib/api/client';
import type { QueueMetricsResponse, RecentActivityItem } from '../lib/api/types';

interface DashboardViewProps {
  onReview: (file: DocumentInfo) => void;
  onCreateBatch: (files: File[]) => void;
}

export default function DashboardView({ onReview: _onReview, onCreateBatch }: DashboardViewProps) {
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'degraded'>('checking');
  const [recent, setRecent] = useState<RecentActivityItem[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [queueMetrics, setQueueMetrics] = useState<QueueMetricsResponse | null>(null);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const accept = useMemo(() => ['.pdf', '.zip', '.docx'].join(','), []);
  
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const health = await api.health();
        const db = await api.dbPing();
        if (!cancelled) setApiStatus(health.status === 'ok' && db.ok ? 'ok' : 'degraded');
      } catch {
        if (!cancelled) setApiStatus('degraded');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoadingRecent(true);
      setRecentError(null);
      try {
        const items = await api.batches.recentActivity(20);
        if (!cancelled) setRecent(items);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load recent activity.';
        if (!cancelled) setRecentError(message);
      } finally {
        if (!cancelled) setIsLoadingRecent(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadQueue = async (args?: { silent?: boolean }) => {
      if (!args?.silent) {
        setIsLoadingQueue(true);
        setQueueError(null);
      }
      try {
        const data = await api.batches.queueMetrics();
        if (!cancelled) setQueueMetrics(data);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load processing queue.';
        if (!cancelled) setQueueError(message);
      } finally {
        if (!cancelled && !args?.silent) setIsLoadingQueue(false);
      }
    };

    void loadQueue();
    const id = window.setInterval(() => {
      void loadQueue({ silent: true });
    }, 8000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const backlogCount = queueError ? null : queueMetrics?.backlogCount ?? null;
  const computeLoadPercent = queueError ? null : queueMetrics?.computeLoadPercent ?? null;

  const formatRelative = (iso: string) => {
    const ts = new Date(iso).getTime();
    if (!Number.isFinite(ts)) return iso;
    const delta = Date.now() - ts;
    const mins = Math.floor(delta / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const addAndCreateBatch = (incoming: File[]) => {
    const filtered = incoming.filter((f) => {
      const name = f.name.toLowerCase();
      return name.endsWith('.pdf') || name.endsWith('.zip') || name.endsWith('.docx');
    });
    if (filtered.length === 0) return;
    onCreateBatch(filtered);
  };

  const onBrowse = () => inputRef.current?.click();

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    addAndCreateBatch(Array.from(e.dataTransfer.files));
  };

  const onPick: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    addAndCreateBatch(Array.from(e.target.files ?? []));
    e.target.value = '';
  };

  return (
    <div className="w-full lg:max-w-[1024px]">
      <div className="mb-6 border-b border-slate-200 pb-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-[18px] font-semibold text-slate-900 mb-0.5">Overview</h2>
          <div
            className={`px-2.5 py-1 rounded text-[12px] font-semibold ${
              apiStatus === 'ok'
                ? 'bg-[#e2f5ec] text-[#006242]'
                : apiStatus === 'checking'
                  ? 'bg-slate-100 text-slate-600'
                  : 'bg-red-50 text-red-700'
            }`}
          >
            {apiStatus === 'ok' ? 'API: Connected' : apiStatus === 'checking' ? 'API: Checking…' : 'API: Unavailable'}
          </div>
        </div>
        <p className="text-[14px] text-slate-500">Drop files to classify or review recent activity.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 mb-8 items-stretch">
        <div
          role="button"
          tabIndex={0}
          onClick={onBrowse}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ' ? onBrowse() : null)}
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-slate-300 rounded-xl bg-white p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:border-brand-500 hover:bg-slate-50 transition-colors py-14"
        >
          <div className="bg-[#e0e7ff] w-14 h-14 rounded-xl flex items-center justify-center mb-5 shadow-sm">
             <CloudUpload className="w-7 h-7 text-brand-600" />
          </div>
          <h3 className="font-semibold text-slate-800 text-lg mb-1.5">Drag & Drop Files</h3>
          <p className="text-[14px] text-slate-500 max-w-[340px] leading-relaxed mb-6">Supports PDF, ZIP, DOCX up to 500MB.</p>
          <button
            type="button"
            className="px-6 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold rounded text-sm transition-colors border border-slate-200 shadow-sm"
          >
            Browse Files
          </button>
          <input ref={inputRef} className="hidden" type="file" multiple accept={accept} onChange={onPick} />
        </div>

        <div className="border border-slate-200 bg-white rounded-xl p-6 shadow-sm flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
             <h3 className="text-[11px] font-bold text-slate-500 tracking-widest uppercase">Processing Queue</h3>
             <button type="button" className="text-brand-600 hover:bg-slate-50 p-1.5 rounded transition-colors" aria-label="Open files">
               <ExternalLink className="w-4 h-4" />
             </button>
          </div>
          <div className="text-6xl font-light text-slate-900 tracking-tighter mb-4 mt-auto tabular-nums">
            {isLoadingQueue && backlogCount === null ? '—' : backlogCount ?? '—'}
          </div>
          <p className="text-[14px] text-slate-500 leading-relaxed mb-8">
            Documents queued or processing across all batches.
          </p>
          
          <div className="mt-auto">
            <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-2 uppercase tracking-wide">
               <span>Compute Load</span>
               <span className="tabular-nums">{computeLoadPercent === null ? '—' : `${computeLoadPercent}%`}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
               <div
                 className="h-full bg-brand-600 rounded-full transition-all duration-700 ease-out"
                 style={{ width: `${computeLoadPercent ?? 0}%` }}
               ></div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[16px] font-semibold text-slate-800">Recent Activity</h3>
          <button className="text-[13px] font-semibold text-brand-600 hover:text-brand-700 tracking-wide transition-colors">View All</button>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
            <thead>
                <tr className="text-[13px] font-semibold text-slate-500 border-b border-slate-200 bg-slate-50/50">
                    <th className="py-3 px-4 font-medium w-full">File Name</th>
                    <th className="py-3 px-4 font-medium w-28">Size</th>
                    <th className="py-3 px-4 font-medium w-48">Status</th>
                    <th className="py-3 px-4 font-medium w-32 text-right">Time</th>
                </tr>
            </thead>
            <tbody className="text-[14px]">
                {recentError && (
                  <tr>
                    <td className="py-4 px-4 text-red-700 font-medium" colSpan={4}>
                      {recentError}
                    </td>
                  </tr>
                )}
                {!recentError && isLoadingRecent && recent.length === 0 && (
                  <tr>
                    <td className="py-4 px-4 text-slate-500 font-medium" colSpan={4}>
                      Loading recent activity…
                    </td>
                  </tr>
                )}
                {!recentError && !isLoadingRecent && recent.length === 0 && (
                  <tr>
                    <td className="py-4 px-4 text-slate-500 font-medium" colSpan={4}>
                      No recent activity yet.
                    </td>
                  </tr>
                )}
                {recent.map((doc) => (
                    <tr key={doc.batchDocumentId} className="border-b border-slate-100 group hover:bg-slate-50/80 transition-colors last:border-0">
                    <td className="py-4 px-4 font-medium text-slate-700 truncate max-w-[320px]">
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 rounded border shadow-sm bg-slate-100 border-slate-200">
                              <FileText className="w-4 h-4 text-slate-400" />
                            </div>
                            {doc.originalFilename}
                        </div>
                    </td>
                    <td className="py-4 px-4 text-slate-500 tabular-nums font-medium text-[13px]">{Math.ceil(doc.sizeBytes / 1024)} KB</td>
                    <td className="py-4 px-4">
                        {doc.status === 'processing' && (
                            <div className="flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 text-brand-600 animate-spin" />
                            <span className="text-brand-600 font-semibold text-[13px]">Analyzing...</span>
                            <div className="w-full max-w-[120px] h-0.5 bg-slate-200 mt-1 absolute bottom-0 left-0 hidden group-hover:block"><div className="w-1/3 h-full bg-brand-600 animate-pulse"></div></div>
                            </div>
                        )}
                        {doc.status === 'queued' && (
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-semibold rounded text-[12px] flex items-center gap-1.5 w-max">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 block"></span> Queued
                            </span>
                        )}
                        {doc.status === 'ready_for_review' && (
                            <span className="px-2.5 py-1 bg-[#e0e7ff] text-brand-700 font-semibold rounded text-[12px] flex items-center gap-1.5 w-max">
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-600 block"></span> Ready for Review
                            </span>
                        )}
                        {doc.status === 'approved' && (
                            <span className="px-2.5 py-1 bg-[#e2f5ec] text-[#006242] font-semibold rounded text-[12px] flex items-center gap-1.5 w-max">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] block"></span> Approved
                            </span>
                        )}
                        {doc.status === 'failed' && (
                            <span className="px-2.5 py-1 bg-red-50 text-red-700 font-semibold rounded text-[12px] flex items-center gap-1.5 w-max">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-600 block"></span> Failed
                            </span>
                        )}
                    </td>
                    <td className="py-4 px-4 text-slate-400 text-right text-[13px] font-medium">{formatRelative(doc.createdAt)}</td>
                    </tr>
                ))}
            </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
