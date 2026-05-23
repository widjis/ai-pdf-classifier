import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, UploadCloud, X } from 'lucide-react';

type DocType = 'standard' | 'ocr' | 'scanned';
type AiProvider = 'gemini' | 'openai';

const SETTINGS_KEY = 'ai-pdf-classifier.settings';

interface NewBatchViewProps {
  onCancel: () => void;
  onStart: () => void;
}

export default function NewBatchView({ onCancel, onStart }: NewBatchViewProps) {
  const [batchName, setBatchName] = useState('');
  const [mappingPreset, setMappingPreset] = useState(() => {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return 'standard_ict';
    const parsed = JSON.parse(raw) as Partial<{ defaultMappingPreset: string }>;
    return parsed.defaultMappingPreset ?? 'standard_ict';
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
  const [docType, setDocType] = useState<DocType>('standard');
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const aiModels = useMemo(
    () => ({
      gemini: [
        { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
        { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
        { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      ],
      openai: [
        { value: 'gpt-4o', label: 'GPT-4o' },
        { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
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

  return (
    <div className="max-w-3xl mx-auto w-full">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Create New Batch</h2>
        <p className="text-[15px] text-slate-500">Configure your document classification parameters before starting the run.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
        <div className="p-6 flex flex-col gap-6">
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
              <label className="text-sm font-semibold text-slate-700" htmlFor="mapping_preset">
                Mapping Preset
              </label>
              <select
                id="mapping_preset"
                name="mapping_preset"
                value={mappingPreset}
                onChange={(e) => setMappingPreset(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 bg-slate-50"
              >
                <option value="standard_ict">Standard ICT Mappings</option>
                <option value="finance_q3">Finance Q3 Taxonomy</option>
                <option value="hr_onboarding">HR Onboarding Docs</option>
                <option value="custom">-- Custom Configuration --</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-sm font-semibold text-slate-700">Document Type Handling</span>
            <div className="flex flex-col md:flex-row gap-3">
              <label className={`flex-1 border rounded p-3 flex items-start gap-3 cursor-pointer transition-colors ${docType === 'standard' ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input className="mt-1" name="doc_type" type="radio" value="standard" checked={docType === 'standard'} onChange={() => setDocType('standard')} />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-800">Standard PDF</span>
                  <span className="text-xs text-slate-500">Native text layer available</span>
                </div>
              </label>

              <label className={`flex-1 border rounded p-3 flex items-start gap-3 cursor-pointer transition-colors ${docType === 'ocr' ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input className="mt-1" name="doc_type" type="radio" value="ocr" checked={docType === 'ocr'} onChange={() => setDocType('ocr')} />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-800">OCR Required</span>
                  <span className="text-xs text-slate-500">Force text extraction</span>
                </div>
              </label>

              <label className={`flex-1 border rounded p-3 flex items-start gap-3 cursor-pointer transition-colors ${docType === 'scanned' ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input className="mt-1" name="doc_type" type="radio" value="scanned" checked={docType === 'scanned'} onChange={() => setDocType('scanned')} />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-800">Scanned Images</span>
                  <span className="text-xs text-slate-500">Image pre-processing</span>
                </div>
              </label>
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
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onStart}
            className="px-5 py-2 bg-brand-600 text-white rounded text-sm font-semibold hover:bg-brand-700 cursor-pointer transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={files.length === 0 || batchName.trim().length === 0}
          >
            <Play className="w-4 h-4" />
            Start Classification Run
          </button>
        </div>
      </div>
    </div>
  );
}
