import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Download, Plus, Trash2 } from 'lucide-react';
import { mockMappings } from '../data';
import type { MappingRule } from '../types';

type AiProvider = 'gemini' | 'openai';

const SETTINGS_KEY = 'ai-pdf-classifier.settings';

export default function SettingsView() {
  const mappingPresets = useMemo(
    () => [
      { value: 'standard_ict', label: 'Standard ICT Mappings' },
      { value: 'finance_q3', label: 'Finance Q3 Taxonomy' },
      { value: 'hr_onboarding', label: 'HR Onboarding Docs' },
      { value: 'custom', label: '-- Custom Configuration --' },
    ],
    [],
  );

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

  const [defaultMappingPreset, setDefaultMappingPreset] = useState('standard_ict');
  const [aiProvider, setAiProvider] = useState<AiProvider>('gemini');
  const [aiModel, setAiModel] = useState('gemini-1.5-pro');
  const [prefixMappings, setPrefixMappings] = useState<MappingRule[]>(mockMappings);
  const [newSource, setNewSource] = useState('');
  const [newTarget, setNewTarget] = useState('');

  useEffect(() => {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as Partial<{
      defaultMappingPreset: string;
      aiProvider: AiProvider;
      aiModel: string;
      prefixMappings: MappingRule[];
    }>;

    if (parsed.defaultMappingPreset) setDefaultMappingPreset(parsed.defaultMappingPreset);
    if (parsed.aiProvider) setAiProvider(parsed.aiProvider);
    if (parsed.aiModel) setAiModel(parsed.aiModel);
    if (parsed.prefixMappings && Array.isArray(parsed.prefixMappings) && parsed.prefixMappings.length > 0) {
      setPrefixMappings(parsed.prefixMappings);
    }
  }, []);

  useEffect(() => {
    const payload = JSON.stringify({
      defaultMappingPreset,
      aiProvider,
      aiModel,
      prefixMappings,
    });
    localStorage.setItem(SETTINGS_KEY, payload);
  }, [defaultMappingPreset, aiProvider, aiModel, prefixMappings]);

  useEffect(() => {
    const first = aiModels[aiProvider][0]?.value;
    if (!first) return;
    const isValid = aiModels[aiProvider].some((m) => m.value === aiModel);
    if (!isValid) setAiModel(first);
  }, [aiModels, aiProvider, aiModel]);

  const addMapping = () => {
    const source = newSource.trim();
    const target = newTarget.trim();
    if (!source || !target) return;

    setPrefixMappings((prev) => [{ id: `m-${Date.now()}`, source, target }, ...prev]);
    setNewSource('');
    setNewTarget('');
  };

  const removeMapping = (id: string) => setPrefixMappings((prev) => prev.filter((m) => m.id !== id));

  return (
    <div className="max-w-[800px] w-full">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Settings</h2>
        <p className="text-[15px] text-slate-600">Configure mapping presets, AI models, and prefix mappings.</p>
      </div>

      <div className="mb-10">
        <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden mb-8">
          <div className="p-6">
            <div className="mb-5">
              <h3 className="text-[17px] font-semibold text-slate-900 mb-0.5">Defaults</h3>
              <p className="text-[14px] text-slate-500">Used as defaults when creating new batches.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700" htmlFor="settings_mapping_preset">
                  Mapping Preset
                </label>
                <select
                  id="settings_mapping_preset"
                  value={defaultMappingPreset}
                  onChange={(e) => setDefaultMappingPreset(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 bg-slate-50"
                >
                  {mappingPresets.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="settings_ai_provider">
                    AI Provider
                  </label>
                  <select
                    id="settings_ai_provider"
                    value={aiProvider}
                    onChange={(e) => setAiProvider(e.target.value as AiProvider)}
                    className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 bg-slate-50"
                  >
                    <option value="gemini">Gemini</option>
                    <option value="openai">OpenAI</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="settings_ai_model">
                    AI Model
                  </label>
                  <select
                    id="settings_ai_model"
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
            </div>
          </div>
        </div>

         <div className="flex items-center justify-between mb-4">
            <div>
               <h3 className="text-[17px] font-semibold text-slate-900 mb-0.5">Prefix Mappings</h3>
               <p className="text-[14px] text-slate-500">Rules for renaming files based on classification output.</p>
            </div>
         </div>

         <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden mb-5">
           <div className="p-4 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
             <div className="flex flex-col gap-1.5">
               <label className="text-sm font-semibold text-slate-700" htmlFor="mapping_source">
                 Source Prefix
               </label>
               <input
                 id="mapping_source"
                 type="text"
                 value={newSource}
                 onChange={(e) => setNewSource(e.target.value)}
                 placeholder="e.g., BA_HALO"
                 className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 placeholder-slate-400 bg-slate-50"
               />
             </div>
             <div className="flex flex-col gap-1.5">
               <label className="text-sm font-semibold text-slate-700" htmlFor="mapping_target">
                 Target Prefix
               </label>
               <input
                 id="mapping_target"
                 type="text"
                 value={newTarget}
                 onChange={(e) => setNewTarget(e.target.value)}
                 placeholder="e.g., ICTBAK"
                 className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 placeholder-slate-400 bg-slate-50"
               />
             </div>
             <button
               type="button"
               onClick={addMapping}
               className="bg-brand-600 hover:bg-brand-700 text-white flex items-center justify-center gap-2 py-2 px-4 rounded-md font-medium text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
               disabled={newSource.trim().length === 0 || newTarget.trim().length === 0}
             >
               <Plus className="w-4 h-4" />
               Add
             </button>
           </div>
         </div>

         <div className="flex flex-wrap gap-4">
           {prefixMappings.map((mapping) => (
             <div key={mapping.id} className="border border-slate-200 bg-white rounded-md p-3 flex items-center justify-center gap-4 shadow-sm min-w-[200px]">
               <div className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-600 text-[13px] font-mono tracking-wide font-medium w-32 text-center truncate">
                 {mapping.source}
               </div>
               <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
               <div className="bg-[#e0e7ff] border border-blue-100 rounded px-2.5 py-1.5 text-brand-700 text-[13px] font-mono tracking-wide font-medium w-32 text-center truncate shadow-inner">
                 {mapping.target}
               </div>
               <button
                 type="button"
                 onClick={() => removeMapping(mapping.id)}
                 className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                 aria-label={`Remove ${mapping.source}`}
               >
                 <Trash2 className="w-4 h-4" />
               </button>
             </div>
           ))}
         </div>
      </div>

      <div className="bg-[#f8fafc] border border-blue-100/60 rounded-xl p-8 shadow-sm relative overflow-hidden mt-6">
         <div className="flex items-start justify-between">
           <div className="max-w-[460px]">
             <div className="flex items-center gap-3 mb-2.5">
                 <div className="w-9 h-9 rounded bg-[#e0e7ff] text-brand-600 flex items-center justify-center -ml-1">
                    <Download className="w-4 h-4" />
                 </div>
                 <h3 className="text-[19px] font-bold text-slate-900 tracking-tight">Download Prepared ZIP</h3>
             </div>
             <p className="text-[15px] text-slate-600 mb-6 leading-relaxed ml-11">
               The system has finished processing the current batch applying your prefix rules.
             </p>
             
             <div className="flex items-center gap-4 ml-11">
                <div className="bg-[#e2f5ec] border border-[#a7f3d0] text-[#006242] text-[13px] font-medium px-3 py-1.5 rounded flex items-center gap-2 shadow-sm">
                   <div className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"></div>
                   120 Files ready for export
                </div>
                <div className="w-px h-5 bg-slate-300"></div>
                <span className="text-[14px] text-slate-500 font-medium">Total Size: 45.2 MB</span>
             </div>
           </div>

           <button className="bg-brand-600 hover:bg-brand-700 text-white font-medium px-6 py-3 rounded-md flex items-center justify-center gap-3 transition-colors mt-2 shadow-sm cursor-pointer whitespace-nowrap min-w-[200px] flex-col">
             <Download className="w-5 h-5 mb-1" />
             Download Archive
           </button>
         </div>
      </div>
    </div>
  );
}
