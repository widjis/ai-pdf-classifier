import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, UploadCloud, X } from 'lucide-react';
import { ApiClientError, api } from '../lib/api/client';
import type { MappingProfile } from '../lib/api/types';

type AiProvider = 'gemini' | 'openai';

const SETTINGS_KEY = 'ai-pdf-classifier.settings';

interface NewBatchViewProps {
  initialFiles?: File[];
  onCancel: () => void;
  onStart: (args: { batchId: string }) => void;
}

const getErrorMessage = (error: unknown) => {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong while talking to the backend.';
};

export default function NewBatchView({ initialFiles, onCancel, onStart }: NewBatchViewProps) {
  const [batchName, setBatchName] = useState('');
  const [mappingProfileId, setMappingProfileId] = useState(() => {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw) as Partial<{ defaultMappingProfileId: string }>;
    return parsed.defaultMappingProfileId ?? '';
  });
  const [aiProvider, setAiProvider] = useState<AiProvider>(() => {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return 'gemini';
    const parsed = JSON.parse(raw) as Partial<{ aiProvider: AiProvider }>;
    return parsed.aiProvider ?? 'gemini';
  });
  const [aiModel, setAiModel] = useState(() => {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return 'gemini-1.5-pro';
    const parsed = JSON.parse(raw) as Partial<{ aiModel: string }>;
    return parsed.aiModel ?? 'gemini-1.5-pro';
  });
  const [files, setFiles] = useState<File[]>(() => initialFiles ?? []);
  const [profiles, setProfiles] = useState<MappingProfile[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [storageBlockedReason, setStorageBlockedReason] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const aiModels = useMemo(
    () => ({
      gemini: [
        { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
        { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
        { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
        { value: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image Preview' },
      ],
      openai: [
        { value: 'gpt-4o', label: 'GPT-4o' },
        { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
        { value: 'gpt-5.4-mini', label: 'GPT-5.4 mini' },
        { value: 'gpt-5.4-nano', label: 'GPT-5.4 nano' },
      ],
    }),
    [],
  );

  useEffect(() => {
    const first = aiModels[aiProvider][0]?.value;
    if (!first) return;
    const isValid = aiModels[aiProvider].some((m) => m.value === aiModel);
    if (!isValid) setAiModel(first);
  }, [aiModels, aiProvider, aiModel]);

  useEffect(() => {
    if (!initialFiles || initialFiles.length === 0) return;
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => `${f.name}|${f.size}|${f.lastModified}`));
      const next = [...prev];
      for (const f of initialFiles) {
        const key = `${f.name}|${f.size}|${f.lastModified}`;
        if (existing.has(key)) continue;
        existing.add(key);
        next.push(f);
      }
      return next;
    });
  }, [initialFiles]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoadingProfiles(true);
      setErrorMessage(null);
      try {
        const res = await api.mappingProfiles.list();
        if (cancelled) return;
        setProfiles(res);
        if (mappingProfileId.trim().length === 0) {
          const active = res.find((p) => p.isActive) ?? res[0];
          if (active) setMappingProfileId(active.id);
        }
      } catch (error) {
        if (!cancelled) setErrorMessage(getErrorMessage(error));
      } finally {
        if (!cancelled) setIsLoadingProfiles(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [mappingProfileId]);

  useEffect(() => {
    let cancelled = false;
    void api.health()
      .then((health) => {
        if (cancelled) return;
        const shared = health.storage?.sharedFolder;
        if (!shared || shared.configured === false) {
          setStorageBlockedReason(null);
          return;
        }
        if (shared.ok) {
          setStorageBlockedReason(null);
          return;
        }
        const base = `Shared storage is not accessible (${shared.path}).`;
        const detail = shared.error ? ` ${shared.error}` : '';
        setStorageBlockedReason(`${base}${detail}`);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to check storage readiness.';
        setStorageBlockedReason(message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const accept = useMemo(() => ['.pdf', '.zip', '.docx'].join(','), []);

  const addFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;
    setFiles((prev) => [...prev, ...incoming]);
  };

  const onBrowse = () => inputRef.current?.click();

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    addFiles(Array.from(e.dataTransfer.files));
  };

  const onPick: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    addFiles(Array.from(e.target.files ?? []));
    e.target.value = '';
  };

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

  const startRun = async () => {
    if (isStarting) return;
    if (files.length === 0) return;
    if (batchName.trim().length === 0) return;
    if (storageBlockedReason) return;

    setIsStarting(true);
    setErrorMessage(null);

    try {
      const created = await api.batches.create({
        name: batchName.trim(),
        mappingProfileId: mappingProfileId.trim().length > 0 ? mappingProfileId : undefined,
        aiProvider,
        aiModel,
        docTypeHandling: 'standard',
      });
      await api.batches.uploadDocuments(created.id, files);
      await api.batches.start(created.id);
      onStart({ batchId: created.id });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto w-full">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Create New Batch</h2>
        <p className="text-[15px] text-slate-500">Configure your document classification parameters before starting the run.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
        <div className="p-6 flex flex-col gap-6">
          {errorMessage && (
            <div className="border border-red-200 bg-red-50 text-red-700 rounded px-4 py-3 text-sm font-medium">
              {errorMessage}
            </div>
          )}
          {storageBlockedReason && (
            <div className="border border-amber-200 bg-amber-50 text-amber-800 rounded px-4 py-3 text-sm font-medium">
              {storageBlockedReason}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700" htmlFor="batch_name">
              Batch Name
            </label>
            <input
              id="batch_name"
              name="batch_name"
              type="text"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder="e.g., Legal_Review_Q4_2023"
              className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 placeholder-slate-400 bg-slate-50"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="grid grid-cols-1 gap-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700" htmlFor="ai_provider">
                  AI Provider
                </label>
                <select
                  id="ai_provider"
                  name="ai_provider"
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value as AiProvider)}
                  className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 bg-slate-50"
                >
                  <option value="gemini">Gemini</option>
                  <option value="openai">OpenAI</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700" htmlFor="ai_model">
                  AI Model
                </label>
                <select
                  id="ai_model"
                  name="ai_model"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 bg-slate-50"
                >
                  {aiModels[aiProvider].map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700" htmlFor="mapping_profile">
                Mapping Profile
              </label>
              <select
                id="mapping_profile"
                name="mapping_profile"
                value={mappingProfileId}
                onChange={(e) => setMappingProfileId(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 bg-slate-50"
                disabled={isLoadingProfiles || profiles.length === 0}
              >
                {profiles.length === 0 ? (
                  <option value="">{isLoadingProfiles ? 'Loading…' : 'No profiles available'}</option>
                ) : (
                  profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (v{p.version})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-slate-700">Data Source</span>
            <div
              role="button"
              tabIndex={0}
              onClick={onBrowse}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ' ? onBrowse() : null)}
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-slate-200 rounded p-6 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100/40 transition-colors cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-brand-600 mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-sm text-slate-800 font-semibold mb-1">Drag &amp; drop files here, or click to browse</p>
              <p className="text-xs text-slate-500">Supports PDF, ZIP, DOCX up to 500MB</p>
              <input ref={inputRef} className="hidden" type="file" multiple accept={accept} onChange={onPick} />
            </div>

            {files.length > 0 && (
              <div className="border border-slate-200 rounded bg-white overflow-hidden">
                <div className="px-4 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 bg-[#f8fafc]">
                  Selected Files
                </div>
                <div className="divide-y divide-slate-100">
                  {files.map((f, idx) => (
                    <div key={`${f.name}-${idx}`} className="px-4 py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm text-slate-800 font-medium truncate">{f.name}</div>
                        <div className="text-xs text-slate-500">{Math.ceil(f.size / 1024)} KB</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                        aria-label={`Remove ${f.name}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-50/80 border-t border-slate-200 p-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 border border-slate-200 rounded text-sm font-medium text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
            disabled={isStarting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={startRun}
            className="px-5 py-2 bg-brand-600 text-white rounded text-sm font-semibold hover:bg-brand-700 cursor-pointer transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={
              isStarting ||
              Boolean(storageBlockedReason) ||
              files.length === 0 ||
              batchName.trim().length === 0 ||
              (profiles.length === 0 && !isLoadingProfiles)
            }
          >
            <Play className="w-4 h-4" />
            {isStarting ? 'Starting…' : 'Start Classification Run'}
          </button>
        </div>
      </div>
    </div>
  );
}
