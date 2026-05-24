import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, FileText, RefreshCw } from 'lucide-react';
import { ApiClientError, api } from '../lib/api/client';
import type { Batch, BatchDocumentListItem, BatchSummary } from '../lib/api/types';
import { DocumentInfo } from '../types';

interface BatchProcessingViewProps {
  onReview: (file: DocumentInfo) => void;
  activeBatchId: string | null;
}

const getErrorMessage = (error: unknown) => {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong while talking to the backend.';
};

const formatBytes = (sizeBytes: number) => {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'] as const;
  let idx = 0;
  let n = sizeBytes;
  while (n >= 1024 && idx < units.length - 1) {
    n /= 1024;
    idx += 1;
  }
  return `${n.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
};

export default function BatchProcessingView({ onReview: _onReview, activeBatchId }: BatchProcessingViewProps) {
  const [batchId, setBatchId] = useState<string | null>(activeBatchId);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batch, setBatch] = useState<BatchSummary | null>(null);
  const [documents, setDocuments] = useState<BatchDocumentListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!activeBatchId) return;
    setBatchId(activeBatchId);
  }, [activeBatchId]);

  useEffect(() => {
    let cancelled = false;
    const loadBatches = async () => {
      try {
        const res = await api.batches.list();
        if (cancelled) return;
        setBatches(res);
        if (!batchId && res[0]?.id) setBatchId(res[0].id);
      } catch (error) {
        if (!cancelled) setErrorMessage(getErrorMessage(error));
      }
    };
    void loadBatches();
    return () => {
      cancelled = true;
    };
  }, [batchId]);

  useEffect(() => {
    let cancelled = false;
    const loadBatch = async () => {
      if (!batchId) return;
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const [summary, docs] = await Promise.all([api.batches.get(batchId), api.batches.listDocuments(batchId)]);
        if (cancelled) return;
        setBatch(summary);
        setDocuments(docs);
        setSelectedIds(new Set());
      } catch (error) {
        if (!cancelled) setErrorMessage(getErrorMessage(error));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void loadBatch();
    return () => {
      cancelled = true;
    };
  }, [batchId]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const displayDocs = documents.slice(0, 25);

  const toggleAll = () => {
    if (selectedIds.size === displayDocs.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(displayDocs.map((d) => d.batchDocumentId)));
  };

  const progress = useMemo(() => {
    const total = batch?.totals.total ?? 0;
    const done = (batch?.totals.readyForReview ?? 0) + (batch?.totals.approved ?? 0);
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, pct };
  }, [batch]);

  return (
    <div className="max-w-[1100px] w-full">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Batch Processing</h2>
        <p className="text-[15px] text-slate-500">
          {batch ? `Batch "${batch.name}" (${batch.status})` : isLoading ? 'Loading batch…' : 'Select a batch to view documents.'}
        </p>
      </div>

      {errorMessage && (
        <div className="mb-6 border border-red-200 bg-red-50 text-red-700 rounded px-4 py-3 text-sm font-medium">
          {errorMessage}
        </div>
      )}

      {batches.length > 0 && (
        <div className="mb-6">
          <label className="text-xs font-semibold text-slate-500 tracking-widest uppercase">Batch</label>
          <select
            value={batchId ?? ''}
            onChange={(e) => setBatchId(e.target.value)}
            className="mt-2 w-full md:w-[520px] px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 bg-slate-50"
            disabled={isLoading}
          >
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.status})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mb-6">
        <div className="flex justify-between items-end mb-2">
          <span className="text-[11px] font-semibold text-slate-400 tracking-widest uppercase">Progress</span>
          <span className="text-[13px] font-semibold text-brand-600">
            {progress.done}/{progress.total} Completed ({progress.pct}%)
          </span>
        </div>
        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-brand-600 rounded-full transition-all duration-500" style={{ width: `${progress.pct}%` }}></div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-[#f8fafc]">
                <th className="py-2.5 px-4 w-12 text-center">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    checked={selectedIds.size > 0 && selectedIds.size === displayDocs.length}
                    onChange={toggleAll}
                    disabled={displayDocs.length === 0}
                  />
                </th>
                <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Original Filename</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Size</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[13px]">
              {displayDocs.length === 0 && (
                <tr>
                  <td className="py-4 px-4 text-slate-500 font-medium" colSpan={5}>
                    {isLoading ? 'Loading files…' : 'No files in this batch yet.'}
                  </td>
                </tr>
              )}
              {displayDocs.map((doc) => (
                <tr key={doc.batchDocumentId} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="py-3.5 px-4 w-12 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                      checked={selectedIds.has(doc.batchDocumentId)}
                      onChange={() => toggleSelect(doc.batchDocumentId)}
                    />
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5 text-slate-700">
                      <FileText className={`w-4 h-4 flex-shrink-0 ${doc.status === 'failed' ? 'text-red-400' : 'text-slate-400'}`} />
                      <span className="font-medium truncate max-w-[420px] text-slate-800">{doc.originalFilename}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 font-medium tabular-nums">{formatBytes(doc.sizeBytes)}</td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded textxs font-medium bg-slate-100 text-slate-700">{doc.finalCategory ?? '—'}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5 font-medium">
                      {(doc.status === 'approved' || doc.status === 'ready_for_review') && (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                          <span className="text-slate-600">{doc.status === 'approved' ? 'Approved' : 'Ready for Review'}</span>
                        </>
                      )}
                      {(doc.status === 'processing' || doc.status === 'queued') && (
                        <>
                          <RefreshCw className="w-4 h-4 text-brand-600 animate-spin" />
                          <span className="text-brand-600">{doc.status === 'queued' ? 'Queued' : 'Processing'}</span>
                        </>
                      )}
                      {doc.status === 'failed' && (
                        <>
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                          <span className="text-red-500">Failed</span>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-slate-50/80 border-t border-slate-200 p-3 px-4 flex items-center justify-between text-[13px] text-slate-500 font-medium">
          <span>
            Showing 1-{displayDocs.length} of {documents.length} files
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="px-1.5 py-1.5 bg-white border border-slate-200 rounded text-slate-400 hover:bg-slate-100 cursor-pointer disabled:opacity-50 transition-colors"
              disabled
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="px-1.5 py-1.5 bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-100 cursor-pointer shadow-sm transition-colors"
              disabled
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
