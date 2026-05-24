import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Download, FileText, RefreshCw, Tag, X } from 'lucide-react';
import { ApiClientError, api, apiBaseUrl } from '../lib/api/client';
import type { Batch, BatchDocumentDetails, BatchDocumentFieldsKey, BatchDocumentListItem, BatchSummary, ExportInfo, MappingRule } from '../lib/api/types';
import { DocumentInfo } from '../types';

interface BatchProcessingViewProps {
  onReview: (file: DocumentInfo) => void;
  activeBatchId: string | null;
  categoryFilter: string | null;
  onClearCategoryFilter: () => void;
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

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const getStringArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

const REVIEW_FIELD_KEYS: BatchDocumentFieldsKey[] = ['requester', 'personName', 'documentNumber', 'documentDate', 'organization', 'notes'];

const REVIEW_FIELD_LABEL: Record<BatchDocumentFieldsKey, string> = {
  requester: 'Requester',
  personName: 'Person name',
  documentNumber: 'Document number',
  documentDate: 'Document date',
  organization: 'Organization',
  notes: 'Notes',
};

const emptyReviewFields = (): Record<BatchDocumentFieldsKey, string> => ({
  requester: '',
  personName: '',
  documentNumber: '',
  documentDate: '',
  organization: '',
  notes: '',
});

type AllBatchesDocumentRow = BatchDocumentListItem & {
  batchId: string;
  batchName: string;
  batchStatus: string;
  batchCreatedAt: string;
};

const mapWithConcurrency = async <T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await fn(items[current]);
    }
  };
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => worker());
  await Promise.all(workers);
  return results;
};

export default function BatchProcessingView({
  onReview: _onReview,
  activeBatchId,
  categoryFilter,
  onClearCategoryFilter,
}: BatchProcessingViewProps) {
  const [batchId, setBatchId] = useState<string | null>(activeBatchId);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batch, setBatch] = useState<BatchSummary | null>(null);
  const [documents, setDocuments] = useState<BatchDocumentListItem[]>([]);
  const [allDocuments, setAllDocuments] = useState<AllBatchesDocumentRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [batchSearch, setBatchSearch] = useState<string>('');

  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewingBatchId, setReviewingBatchId] = useState<string | null>(null);
  const [reviewDetails, setReviewDetails] = useState<BatchDocumentDetails | null>(null);
  const [reviewCategory, setReviewCategory] = useState<string>('');
  const [reviewCategorySaved, setReviewCategorySaved] = useState<string>('');
  const [reviewFields, setReviewFields] = useState<Record<BatchDocumentFieldsKey, string>>(emptyReviewFields);
  const [reviewFieldsSaved, setReviewFieldsSaved] = useState<Record<BatchDocumentFieldsKey, string>>(emptyReviewFields);
  const [isReviewLoading, setIsReviewLoading] = useState(false);
  const [isReviewSaving, setIsReviewSaving] = useState(false);

  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false);
  const [bulkCategoryValue, setBulkCategoryValue] = useState('');

  const [exportInfo, setExportInfo] = useState<ExportInfo | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportStartingIndex, setExportStartingIndex] = useState<number>(1);
  const [exportOrderBy, setExportOrderBy] = useState<'created_at' | 'filename'>('created_at');
  const [exportGroupByCategory, setExportGroupByCategory] = useState<boolean>(false);
  const [exportNumberingMode, setExportNumberingMode] = useState<'global' | 'per_category'>('global');
  const [exportStartingIndexByCategory, setExportStartingIndexByCategory] = useState<Record<string, number>>({});

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
      } catch (error) {
        if (!cancelled) setErrorMessage(getErrorMessage(error));
      }
    };
    void loadBatches();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshAllDocuments = useCallback(
    async (args?: { silent?: boolean }) => {
      if (!args?.silent) {
        setIsLoading(true);
        setErrorMessage(null);
      }
      try {
        const currentBatches: Batch[] = batches.length > 0 ? batches : await api.batches.list();
        if (batches.length === 0) setBatches(currentBatches);

        const docsByBatch = await mapWithConcurrency(currentBatches, 6, async (b) => {
          const docs = await api.batches.listDocuments(b.id);
          return docs.map((d) => ({
            ...d,
            batchId: b.id,
            batchName: b.name,
            batchStatus: b.status,
            batchCreatedAt: b.createdAt,
          }));
        });

        const flat = docsByBatch.flat();
        flat.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setAllDocuments(flat);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        if (!args?.silent) setIsLoading(false);
      }
    },
    [batches],
  );

  useEffect(() => {
    if (!categoryFilter) return;
    setBatchId(null);
    setBatch(null);
    setDocuments([]);
    setSelectedIds(new Set());
    setExportInfo(null);
    setExportError(null);
    closeReview();
    void refreshAllDocuments({ silent: true });
  }, [categoryFilter, refreshAllDocuments]);

  const refreshBatch = useCallback(
    async (args?: { silent?: boolean }) => {
      if (!batchId) return;
      if (!args?.silent) {
        setIsLoading(true);
        setErrorMessage(null);
      }
      try {
        const [summary, docs] = await Promise.all([api.batches.get(batchId), api.batches.listDocuments(batchId)]);
        setBatch(summary);
        setDocuments(docs);
        setSelectedIds(new Set());

        try {
          const latest = await api.batches.getLatestExport(summary.id);
          setExportInfo(latest);
        } catch {
          setExportInfo(null);
        }

        const profileId = summary.mappingProfileId;
        if (profileId) {
          const rules = await api.mappingProfiles.getRules(profileId);
          const folders = Array.from(
            new Set(
              rules
                .filter((r: MappingRule) => r.isActive && r.matchType === 'category')
                .map((r) => r.targetFolder)
                .filter((folder) => folder.trim().length > 0),
            ),
          ).sort((a, b) => a.localeCompare(b));
          setCategories(folders);
        } else {
          setCategories([]);
        }
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        if (!args?.silent) setIsLoading(false);
      }
    },
    [batchId],
  );

  useEffect(() => {
    if (batchId) void refreshBatch();
    else void refreshAllDocuments();
  }, [batchId, refreshAllDocuments, refreshBatch]);

  useEffect(() => {
    const shouldPoll =
      batch?.status === 'running' || documents.some((d) => d.status === 'processing' || d.status === 'queued');
    if (!shouldPoll) return;
    const handle = window.setInterval(() => {
      void refreshBatch({ silent: true });
    }, 2500);
    return () => window.clearInterval(handle);
  }, [batch?.status, documents, refreshBatch]);

  useEffect(() => {
    if (!exportDialogOpen) return;
    if (exportNumberingMode !== 'per_category') return;
    const cats = Array.from(
      new Set<string>(
        documents
          .map((d) => d.finalCategory)
          .filter((c): c is string => typeof c === 'string' && c.trim().length > 0),
      ),
    ).sort((a, b) => a.localeCompare(b));
    const next: Record<string, number> = {};
    for (const c of cats) next[c] = exportStartingIndex;
    setExportStartingIndexByCategory(next);
  }, [documents, exportDialogOpen, exportNumberingMode, exportStartingIndex]);

  const closeReview = () => {
    setReviewingId(null);
    setReviewingBatchId(null);
    setReviewDetails(null);
    setReviewCategory('');
    setReviewCategorySaved('');
    setReviewFields(emptyReviewFields());
    setReviewFieldsSaved(emptyReviewFields());
  };

  const closeBulkCategory = () => {
    setBulkCategoryOpen(false);
    setBulkCategoryValue('');
  };

  const openBulkCategory = () => {
    setBulkCategoryOpen(true);
    setBulkCategoryValue('');
  };

  const selectedList = useMemo(() => Array.from(selectedIds), [selectedIds]);

  const filteredBatches = useMemo(() => {
    const q = batchSearch.trim().toLowerCase();
    if (q.length === 0) return batches;
    return batches.filter((b) => b.name.toLowerCase().includes(q));
  }, [batches, batchSearch]);

  const bulkApprove = async () => {
    if (!batchId) return;
    if (selectedList.length === 0) return;
    setIsBulkSaving(true);
    setErrorMessage(null);
    try {
      await api.batches.bulkApprove(batchId, { batchDocumentIds: selectedList });
      setSelectedIds(new Set());
      await refreshBatch({ silent: true });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsBulkSaving(false);
    }
  };

  const bulkSetCategory = async () => {
    if (!batchId) return;
    if (selectedList.length === 0) return;
    if (bulkCategoryValue.trim().length === 0) return;
    setIsBulkSaving(true);
    setErrorMessage(null);
    try {
      await api.batches.bulkSetCategory(batchId, { batchDocumentIds: selectedList, category: bulkCategoryValue.trim() });
      closeBulkCategory();
      await refreshBatch({ silent: true });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsBulkSaving(false);
    }
  };

  const canExport = useMemo(() => {
    const total = batch?.totals.total ?? 0;
    const approved = batch?.totals.approved ?? 0;
    return total > 0 && approved === total;
  }, [batch]);

  const downloadExportZip = async (id: string) => {
    const url = `${apiBaseUrl}/api/batches/${encodeURIComponent(id)}/export/zip`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const blob = await res.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = `export_${id}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(objectUrl);
  };

  const runExport = async () => {
    if (!batchId) return;
    if (!canExport) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const info = await api.batches.export(batchId, {
        startingIndex: exportStartingIndex,
        orderBy: exportOrderBy,
        groupByCategory: exportGroupByCategory,
        numberingMode: exportNumberingMode,
        startingIndexByCategory: exportNumberingMode === 'per_category' ? exportStartingIndexByCategory : undefined,
      });
      setExportInfo(info);
      if (info.status === 'ready') {
        setExportDialogOpen(false);
        await downloadExportZip(batchId);
      }
      await refreshBatch({ silent: true });
    } catch (error) {
      setExportError(getErrorMessage(error));
    } finally {
      setIsExporting(false);
    }
  };

  const openReview = async (batchDocumentId: string, explicitBatchId?: string) => {
    const targetBatchId = explicitBatchId ?? batchId;
    if (!targetBatchId) return;
    setReviewingId(batchDocumentId);
    setReviewingBatchId(targetBatchId);
    setIsReviewLoading(true);
    try {
      if (!batchId || batchId !== targetBatchId || categories.length === 0) {
        const summary = await api.batches.get(targetBatchId);
        const profileId = summary.mappingProfileId;
        if (profileId) {
          const rules = await api.mappingProfiles.getRules(profileId);
          const folders = Array.from(
            new Set(
              rules
                .filter((r: MappingRule) => r.isActive && r.matchType === 'category')
                .map((r) => r.targetFolder)
                .filter((folder) => folder.trim().length > 0),
            ),
          ).sort((a, b) => a.localeCompare(b));
          setCategories(folders);
        } else {
          setCategories([]);
        }
      }
      const details = await api.batches.getDocument(targetBatchId, batchDocumentId);
      setReviewDetails(details);
      setReviewCategory(details.finalCategory ?? '');
      setReviewCategorySaved(details.finalCategory ?? '');

      const initial = emptyReviewFields();
      const payload = details.responseJson ?? null;
      if (payload && isRecord(payload)) {
        const fieldsRaw = payload.fields;
        if (isRecord(fieldsRaw)) {
          for (const k of REVIEW_FIELD_KEYS) {
            const v = fieldsRaw[k];
            initial[k] = typeof v === 'string' ? v : '';
          }
        }
      }
      setReviewFields(initial);
      setReviewFieldsSaved(initial);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      closeReview();
    } finally {
      setIsReviewLoading(false);
    }
  };

  const hasReviewDirtyChanges = useMemo(() => {
    const catDirty = reviewCategory.trim() !== reviewCategorySaved.trim();
    const fieldsDirty = REVIEW_FIELD_KEYS.some((k) => (reviewFields[k] ?? '') !== (reviewFieldsSaved[k] ?? ''));
    return catDirty || fieldsDirty;
  }, [reviewCategory, reviewCategorySaved, reviewFields, reviewFieldsSaved]);

  const saveReview = async () => {
    if (!reviewingBatchId || !reviewingId) return;
    if (!hasReviewDirtyChanges) return;
    if (reviewCategory.trim().length === 0) return;
    setIsReviewSaving(true);
    setErrorMessage(null);
    try {
      const categoryDirty = reviewCategory.trim() !== reviewCategorySaved.trim();
      const fieldsDirty = REVIEW_FIELD_KEYS.some((k) => (reviewFields[k] ?? '') !== (reviewFieldsSaved[k] ?? ''));

      if (categoryDirty) {
        await api.batches.updateDocumentCategory(reviewingBatchId, reviewingId, { category: reviewCategory.trim() });
      }

      if (fieldsDirty) {
        const fieldsPayload: Partial<Record<BatchDocumentFieldsKey, string | null>> = {};
        for (const k of REVIEW_FIELD_KEYS) {
          const v = (reviewFields[k] ?? '').trim();
          fieldsPayload[k] = v.length > 0 ? v : null;
        }
        await api.batches.updateDocumentFields(reviewingBatchId, reviewingId, { fields: fieldsPayload });
      }

      const refreshed = await api.batches.getDocument(reviewingBatchId, reviewingId);
      setReviewDetails(refreshed);
      setReviewCategory(refreshed.finalCategory ?? '');
      setReviewCategorySaved(refreshed.finalCategory ?? '');

      const next = emptyReviewFields();
      const payload = refreshed.responseJson ?? null;
      if (payload && isRecord(payload)) {
        const fieldsRaw = payload.fields;
        if (isRecord(fieldsRaw)) {
          for (const k of REVIEW_FIELD_KEYS) {
            const v = fieldsRaw[k];
            next[k] = typeof v === 'string' ? v : '';
          }
        }
      }
      setReviewFields(next);
      setReviewFieldsSaved(next);

      if (batchId && batchId === reviewingBatchId) await refreshBatch({ silent: true });
      else await refreshAllDocuments({ silent: true });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsReviewSaving(false);
    }
  };

  const approve = async () => {
    if (!reviewingBatchId || !reviewingId) return;
    if (hasReviewDirtyChanges) return;
    if (reviewCategory.trim().length === 0) return;
    setIsReviewSaving(true);
    try {
      const updated = await api.batches.approveDocument(reviewingBatchId, reviewingId);
      setReviewDetails(updated);
      if (batchId && batchId === reviewingBatchId) await refreshBatch({ silent: true });
      else await refreshAllDocuments({ silent: true });
      closeReview();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsReviewSaving(false);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const allFilteredDocuments = useMemo(() => {
    let rows = allDocuments;
    if (categoryFilter && categoryFilter.trim().length > 0) {
      const target = categoryFilter.trim().toLowerCase();
      rows = rows.filter((d) => (d.finalCategory ?? '').trim().toLowerCase() === target);
    }
    const q = batchSearch.trim().toLowerCase();
    if (q.length > 0) rows = rows.filter((d) => d.batchName.toLowerCase().includes(q));
    return rows;
  }, [allDocuments, batchSearch, categoryFilter]);

  const filteredDocuments = useMemo(() => {
    if (!categoryFilter) return documents;
    const target = categoryFilter.trim().toLowerCase();
    return documents.filter((d) => (d.finalCategory ?? '').trim().toLowerCase() === target);
  }, [categoryFilter, documents]);

  const displayDocs = filteredDocuments.slice(0, 25);
  const displayAllDocs = allFilteredDocuments.slice(0, 25);

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
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Files</h2>
        <p className="text-[15px] text-slate-500">
          {batchId
            ? batch
              ? `Batch "${batch.name}" (${batch.status})`
              : isLoading
                ? 'Loading batch…'
                : 'Select a batch to view documents.'
            : 'All batches'}
        </p>
        {categoryFilter && categoryFilter.trim().length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 shadow-sm">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              <span className="max-w-[520px] truncate">Category: {categoryFilter}</span>
              <button
                type="button"
                onClick={onClearCategoryFilter}
                className="ml-1 rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                title="Clear category filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {batchId && (
              <div className="text-[13px] text-slate-500 font-medium">
                Showing {filteredDocuments.length}/{documents.length} documents in this batch
              </div>
            )}
            {!batchId && (
              <div className="text-[13px] text-slate-500 font-medium">
                Showing {allFilteredDocuments.length}/{allDocuments.length} documents across all batches
              </div>
            )}
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="mb-6 border border-red-200 bg-red-50 text-red-700 rounded px-4 py-3 text-sm font-medium">
          {errorMessage}
        </div>
      )}

      {batches.length > 0 && (
        <div className="mb-6">
          <label className="text-xs font-semibold text-slate-500 tracking-widest uppercase">Batch</label>
          <div className="mt-2 w-full md:w-[520px]">
            <input
              value={batchSearch}
              onChange={(e) => setBatchSearch(e.target.value)}
              placeholder="Filter batches by name…"
              className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 bg-white"
            />
          </div>
          <select
            value={batchId ?? ''}
            onChange={(e) => {
              const next = e.target.value.trim();
              if (next.length === 0) {
                setBatchId(null);
                setBatch(null);
                setDocuments([]);
                setSelectedIds(new Set());
                setExportInfo(null);
                setExportError(null);
                closeReview();
                return;
              }
              setBatchId(next);
            }}
            className="mt-2 w-full md:w-[520px] px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 bg-slate-50"
            disabled={isLoading}
          >
            <option value="">All batches</option>
            {filteredBatches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.status})
              </option>
            ))}
          </select>
        </div>
      )}

      {batchId === null && (
        <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden flex flex-col mb-6">
          <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-2.5 flex items-center justify-between">
            <div className="text-[13px] text-slate-700 font-semibold">
              Showing 1-{displayAllDocs.length} of {allFilteredDocuments.length} files
            </div>
            <button
              type="button"
              onClick={() => void refreshAllDocuments()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-50 transition-colors text-[12px] font-semibold"
              disabled={isLoading}
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-[#f8fafc]">
                  <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Batch</th>
                  <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Original Filename</th>
                  <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Size</th>
                  <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                  <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[13px]">
                {displayAllDocs.length === 0 && (
                  <tr>
                    <td className="py-4 px-4 text-slate-500 font-medium" colSpan={5}>
                      {isLoading ? 'Loading files…' : 'No files match the current filters.'}
                    </td>
                  </tr>
                )}
                {displayAllDocs.map((doc) => (
                  <tr
                    key={`${doc.batchId}:${doc.batchDocumentId}`}
                    className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                    onClick={() => void openReview(doc.batchDocumentId, doc.batchId)}
                  >
                    <td className="py-3.5 px-4 text-slate-700 font-semibold truncate max-w-[260px]">{doc.batchName}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5 text-slate-700">
                        <FileText className={`w-4 h-4 flex-shrink-0 ${doc.status === 'failed' ? 'text-red-400' : 'text-slate-400'}`} />
                        <span className="font-medium truncate max-w-[420px] text-slate-800 group-hover:underline">{doc.originalFilename}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-medium tabular-nums">{formatBytes(doc.sizeBytes)}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">{doc.finalCategory ?? '—'}</span>
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
        </div>
      )}

      {batchId !== null && (
        <div className="mb-6">
        <div className="flex justify-between items-end mb-2">
          <span className="text-[11px] font-semibold text-slate-400 tracking-widest uppercase">Progress</span>
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-semibold text-brand-600">
              {progress.done}/{progress.total} Completed ({progress.pct}%)
            </span>
            <button
              type="button"
              onClick={() => setExportDialogOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-brand-600 border border-brand-600 rounded text-white hover:bg-brand-700 transition-colors text-[12px] font-semibold disabled:opacity-50 disabled:hover:bg-brand-600"
              disabled={!batchId || isLoading}
              title={canExport ? 'Export approved documents' : 'Export requires all documents to be approved'}
            >
              <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
              Export
            </button>
            <button
              type="button"
              onClick={() => void refreshBatch()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-50 transition-colors text-[12px] font-semibold"
              disabled={isLoading || !batchId}
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-brand-600 rounded-full transition-all duration-500" style={{ width: `${progress.pct}%` }}></div>
        </div>
        {(exportError || exportInfo?.status === 'ready') && batchId && (
          <div className="mt-3 flex items-center justify-between gap-3 text-sm">
            {exportError && <div className="text-red-600 font-semibold">{exportError}</div>}
            {exportInfo?.status === 'ready' && (
              <div className="text-slate-700 font-medium truncate">
                Export ready:
                <span className="ml-2 font-mono text-[12px] text-slate-500">{exportInfo.outputPath ?? '—'}</span>
              </div>
            )}
            {exportInfo?.status === 'ready' && (
              <div className="ml-auto flex items-center gap-2">
                <a
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-brand-600 border border-brand-600 rounded text-white hover:bg-brand-700 transition-colors text-[12px] font-semibold"
                  href={`${apiBaseUrl}/api/batches/${encodeURIComponent(batchId)}/export/zip`}
                >
                  <Download className="w-3.5 h-3.5" />
                  Download ZIP
                </a>
                <a
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-50 transition-colors text-[12px] font-semibold"
                  href={`${apiBaseUrl}/api/batches/${encodeURIComponent(batchId)}/export/manifest`}
                >
                  <Download className="w-3.5 h-3.5" />
                  Manifest
                </a>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {batchId !== null && (
        <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden flex flex-col">
        {selectedIds.size > 0 && (
          <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-2.5 flex items-center justify-between">
            <div className="text-[13px] text-slate-700 font-semibold">{selectedIds.size} selected</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void bulkApprove()}
                disabled={isBulkSaving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 rounded text-white hover:bg-brand-700 transition-colors text-[12px] font-semibold disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approve selected
              </button>
              <button
                type="button"
                onClick={openBulkCategory}
                disabled={isBulkSaving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-50 transition-colors text-[12px] font-semibold disabled:opacity-50"
              >
                <Tag className="w-3.5 h-3.5" />
                Set category
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                disabled={isBulkSaving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-50 transition-colors text-[12px] font-semibold disabled:opacity-50"
              >
                Clear
              </button>
            </div>
          </div>
        )}
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
                <tr
                  key={doc.batchDocumentId}
                  className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                  onClick={() => void openReview(doc.batchDocumentId)}
                >
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
                      <span className="font-medium truncate max-w-[420px] text-slate-800 group-hover:underline">{doc.originalFilename}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 font-medium tabular-nums">{formatBytes(doc.sizeBytes)}</td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">{doc.finalCategory ?? '—'}</span>
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
      )}

      {reviewingId && reviewingBatchId && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/40" onClick={closeReview}></div>
          <div className="absolute inset-y-0 right-0 w-full max-w-[980px] bg-white shadow-2xl flex flex-col">
            <div className="h-[56px] border-b border-slate-200 px-4 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-slate-900 truncate">Document Review</div>
                <div className="text-[12px] text-slate-500 truncate">
                  {reviewDetails?.originalFilename ?? reviewingId}
                </div>
              </div>
              <button
                type="button"
                onClick={closeReview}
                className="p-2 rounded hover:bg-slate-100 text-slate-500 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 min-h-0 flex">
              <div className="flex-1 min-w-0 bg-slate-100">
                {isReviewLoading ? (
                  <div className="h-full w-full flex items-center justify-center text-slate-600 text-sm font-medium">Loading preview…</div>
                ) : (
                  <iframe
                    title="PDF Preview"
                    className="w-full h-full"
                    src={`${apiBaseUrl}/api/batches/${encodeURIComponent(reviewingBatchId)}/documents/${encodeURIComponent(reviewingId)}/file#pagemode=none&navpanes=0&zoom=page-width`}
                  />
                )}
              </div>

              <div className="w-[360px] border-l border-slate-200 flex flex-col">
                <div className="p-4 overflow-y-auto flex-1 space-y-4">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-400 tracking-widest uppercase mb-2">Category</div>
                    <select
                      value={reviewCategory}
                      onChange={(e) => setReviewCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded text-sm bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                      disabled={isReviewLoading || isReviewSaving}
                    >
                      <option value="">Select category…</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void saveReview()}
                        disabled={isReviewLoading || isReviewSaving || reviewCategory.trim().length === 0 || !hasReviewDirtyChanges}
                        className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-50 transition-colors text-sm font-semibold disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => void approve()}
                        disabled={
                          isReviewLoading ||
                          isReviewSaving ||
                          reviewCategory.trim().length === 0 ||
                          hasReviewDirtyChanges ||
                          reviewDetails?.status === 'approved'
                        }
                        className="flex-1 px-3 py-2 bg-brand-600 rounded text-white hover:bg-brand-700 transition-colors text-sm font-semibold disabled:opacity-50"
                      >
                        Approve
                      </button>
                    </div>
                    {hasReviewDirtyChanges && (
                      <div className="mt-2 text-[12px] text-slate-500 font-medium">
                        Save changes before approving.
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-[11px] font-semibold text-slate-400 tracking-widest uppercase mb-1">Status</div>
                      <div className="text-slate-800 font-semibold">{reviewDetails?.status ?? '—'}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-slate-400 tracking-widest uppercase mb-1">Confidence</div>
                      <div className="text-slate-800 font-semibold tabular-nums">
                        {reviewDetails?.finalConfidence === null || reviewDetails?.finalConfidence === undefined ? '—' : `${reviewDetails.finalConfidence}%`}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold text-slate-400 tracking-widest uppercase mb-2">Metadata</div>
                    <div className="space-y-3">
                      {REVIEW_FIELD_KEYS.map((k) => (
                        <div key={k} className="flex flex-col gap-1">
                          <label className="text-[12px] font-semibold text-slate-600" htmlFor={`review_field_${k}`}>
                            {REVIEW_FIELD_LABEL[k]}
                          </label>
                          {k === 'notes' ? (
                            <textarea
                              id={`review_field_${k}`}
                              rows={3}
                              value={reviewFields[k]}
                              onChange={(e) => setReviewFields((prev) => ({ ...prev, [k]: e.target.value }))}
                              disabled={isReviewLoading || isReviewSaving}
                              className="w-full resize-none px-3 py-2 border border-slate-200 rounded text-sm bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 placeholder-slate-400"
                            />
                          ) : (
                            <input
                              id={`review_field_${k}`}
                              type="text"
                              value={reviewFields[k]}
                              onChange={(e) => setReviewFields((prev) => ({ ...prev, [k]: e.target.value }))}
                              disabled={isReviewLoading || isReviewSaving}
                              className="w-full px-3 py-2 border border-slate-200 rounded text-sm bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 placeholder-slate-400"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {(() => {
                    const payload = reviewDetails?.responseJson ?? null;
                    if (!payload || !isRecord(payload)) return null;
                    const anchors = getStringArray(payload.anchors);
                    if (anchors.length === 0) return null;
                    return (
                      <div>
                        <div className="text-[11px] font-semibold text-slate-400 tracking-widest uppercase mb-2">Anchors</div>
                        <div className="flex flex-wrap gap-1.5">
                          {anchors.slice(0, 18).map((a, idx) => (
                            <span key={`${a}-${idx}`} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-semibold">
                              {a}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {exportInfo?.status === 'ready' && (
                    <div>
                      <div className="text-[11px] font-semibold text-slate-400 tracking-widest uppercase mb-2">Export</div>
                      <a
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-50 transition-colors text-sm font-semibold"
                        href={`${apiBaseUrl}/api/batches/${encodeURIComponent(reviewingBatchId)}/export/documents/${encodeURIComponent(reviewingId)}/file`}
                      >
                        <Download className="w-4 h-4" />
                        Download exported PDF
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {bulkCategoryOpen && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-slate-900/40" onClick={closeBulkCategory}></div>
          <div className="absolute top-1/2 left-1/2 w-[520px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="text-[13px] font-semibold text-slate-900">Set category for {selectedIds.size} documents</div>
              <button
                type="button"
                onClick={closeBulkCategory}
                className="p-2 rounded hover:bg-slate-100 text-slate-500 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <select
                value={bulkCategoryValue}
                onChange={(e) => setBulkCategoryValue(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded text-sm bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                disabled={isBulkSaving}
              >
                <option value="">Select category…</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeBulkCategory}
                disabled={isBulkSaving}
                className="px-3 py-2 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-50 transition-colors text-sm font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void bulkSetCategory()}
                disabled={isBulkSaving || bulkCategoryValue.trim().length === 0}
                className="px-3 py-2 bg-brand-600 rounded text-white hover:bg-brand-700 transition-colors text-sm font-semibold disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {exportDialogOpen && batchId && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setExportDialogOpen(false)}></div>
          <div className="absolute top-1/2 left-1/2 w-[560px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="text-[13px] font-semibold text-slate-900">Export Results</div>
              <button
                type="button"
                onClick={() => setExportDialogOpen(false)}
                className="p-2 rounded hover:bg-slate-100 text-slate-500 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="text-sm text-slate-600">
                Output root:
                <span className="ml-2 font-mono text-[12px] text-slate-500">backend/storage/exports</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 tracking-widest uppercase mb-2">Starting index</div>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={exportStartingIndex}
                    onChange={(e) => setExportStartingIndex(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                  <div className="mt-1 text-[12px] text-slate-500 font-medium">
                    Global default. If per-category numbering is enabled, categories can override this.
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 tracking-widest uppercase mb-2">Order</div>
                  <select
                    value={exportOrderBy}
                    onChange={(e) => setExportOrderBy(e.target.value as 'created_at' | 'filename')}
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="created_at">By upload time</option>
                    <option value="filename">By filename</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 tracking-widest uppercase mb-2">Grouping</div>
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700 font-medium">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                      checked={exportGroupByCategory}
                      onChange={(e) => setExportGroupByCategory(e.target.checked)}
                      disabled={exportNumberingMode === 'per_category'}
                    />
                    Group by category
                  </label>
                  {exportNumberingMode === 'per_category' && (
                    <div className="mt-1 text-[12px] text-slate-500 font-medium">Enabled automatically for per-category numbering.</div>
                  )}
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 tracking-widest uppercase mb-2">Numbering</div>
                  <select
                    value={exportNumberingMode}
                    onChange={(e) => {
                      const next = e.target.value as 'global' | 'per_category';
                      setExportNumberingMode(next);
                      if (next === 'per_category') setExportGroupByCategory(true);
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="global">Global (per batch)</option>
                    <option value="per_category">Per category</option>
                  </select>
                </div>
              </div>

              {exportNumberingMode === 'per_category' && (
                <div className="rounded border border-slate-200 bg-white overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-[12px] font-semibold text-slate-700">
                    Per-category starting index
                  </div>
                  <div className="p-3 space-y-2">
                    {(() => {
                      const cats = Array.from(
                        new Set<string>(
                          documents
                            .map((d) => d.finalCategory)
                            .filter((c): c is string => typeof c === 'string' && c.trim().length > 0),
                        ),
                      ).sort((a, b) => a.localeCompare(b));
                      if (cats.length === 0) return <div className="text-sm text-slate-500">No categories detected yet.</div>;
                      return (
                        <div className="space-y-2">
                          {cats.map((c) => (
                            <div key={c} className="flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-slate-800 truncate">{c}</div>
                              </div>
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={exportStartingIndexByCategory[c] ?? exportStartingIndex}
                                onChange={(e) =>
                                  setExportStartingIndexByCategory((prev) => ({
                                    ...prev,
                                    [c]: Number(e.target.value),
                                  }))
                                }
                                className="w-[160px] px-3 py-2 border border-slate-200 rounded text-sm bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                              />
                            </div>
                          ))}
                          <div className="pt-2 flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                const next: Record<string, number> = {};
                                for (const c of cats) next[c] = exportStartingIndex;
                                setExportStartingIndexByCategory(next);
                              }}
                              className="px-3 py-2 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-50 transition-colors text-sm font-semibold"
                            >
                              Set all to global starting index
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <div className="font-semibold mb-1">Filename format</div>
                <div className="font-mono text-[12px] text-slate-600">prefix + documentNumber - requester.pdf</div>
                {!canExport && (
                  <div className="mt-2 text-red-600 font-semibold">
                    Export is disabled until all documents are approved ({batch?.totals.approved ?? 0}/{batch?.totals.total ?? 0} approved).
                  </div>
                )}
              </div>
            </div>

            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setExportDialogOpen(false)}
                className="px-3 py-2 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-50 transition-colors text-sm font-semibold"
                disabled={isExporting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void runExport()}
                className="px-3 py-2 bg-brand-600 rounded text-white hover:bg-brand-700 transition-colors text-sm font-semibold disabled:opacity-50"
                disabled={isExporting || !canExport}
              >
                {isExporting ? 'Exporting…' : 'Export now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
