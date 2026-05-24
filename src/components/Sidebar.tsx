import React, { useEffect, useMemo, useState } from 'react';
import { Folder, Clock, BarChart2, Trash2, Plus, LayoutGrid, Settings, KeyRound, Tag } from 'lucide-react';
import { ViewState } from '../types';
import { ApiClientError, api } from '../lib/api/client';
import type { MappingRule } from '../lib/api/types';

const SETTINGS_KEY = 'ai-pdf-classifier.settings';

interface SidebarProps {
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
}

export default function Sidebar({ currentView, onNavigate }: SidebarProps) {
  const settingsActive = currentView === 'settings' || currentView === 'aiConfiguration';
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  const hasCategories = categories.length > 0;

  const sortedCategories = useMemo(() => {
    const copy = [...categories];
    copy.sort((a, b) => a.localeCompare(b));
    return copy;
  }, [categories]);

  useEffect(() => {
    let cancelled = false;

    const parseProfileIdFromLocalStorage = (): string | null => {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as Partial<{ defaultMappingProfileId: string }>;
        return parsed.defaultMappingProfileId ?? null;
      } catch {
        return null;
      }
    };

    const resolveProfileId = async (): Promise<string | null> => {
      const fromLocalStorage = parseProfileIdFromLocalStorage();
      if (fromLocalStorage) return fromLocalStorage;
      try {
        const users = await api.users.list();
        const activeUser = users.find((u) => u.isActive) ?? users[0];
        if (!activeUser) return null;
        const prefs = await api.userPreferences.get(activeUser.id);
        return prefs.defaultMappingProfileId;
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 404) return null;
        return null;
      }
    };

    const loadCategories = async () => {
      setIsLoadingCategories(true);
      try {
        const profileId = await resolveProfileId();
        if (!profileId) {
          if (!cancelled) setCategories([]);
          return;
        }
        const rules = await api.mappingProfiles.getRules(profileId);
        const folders = Array.from(
          new Set(
            rules
              .filter((rule: MappingRule) => rule.isActive && rule.matchType === 'category')
              .map((rule) => rule.targetFolder)
              .filter((folder) => folder.trim().length > 0),
          ),
        );
        if (!cancelled) setCategories(folders);
      } finally {
        if (!cancelled) setIsLoadingCategories(false);
      }
    };

    const onSettingsUpdated = () => {
      void loadCategories();
    };

    void loadCategories();
    window.addEventListener('ai-pdf-classifier:settings-updated', onSettingsUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener('ai-pdf-classifier:settings-updated', onSettingsUpdated);
    };
  }, []);

  return (
    <aside className="w-[260px] bg-slate-50 border-r border-slate-200 h-full flex flex-col flex-shrink-0">
      <div className="p-5 border-b border-slate-200 flex flex-col gap-1">
        <div className="flex items-center gap-2 text-slate-800 font-semibold mb-1">
           <div className="bg-brand-600 text-white p-1.5 rounded-md">
             <LayoutGrid className="w-4 h-4" />
           </div>
           <span className="text-[15px]">Classification</span>
        </div>
        <span className="text-xs text-slate-500 font-medium">Batch v2.4 Active</span>
      </div>

      <div className="p-4">
        <button onClick={() => onNavigate('newBatch')} className="w-full bg-brand-600 hover:bg-brand-700 text-white flex items-center justify-center gap-2 py-2 px-4 rounded-md font-medium text-sm transition-colors cursor-pointer">
          <Plus className="w-4 h-4" />
          New Batch
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        <div className="px-3 space-y-0.5">
           <button onClick={() => onNavigate('files')} className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors ${currentView === 'files' ? 'bg-[#e0e7ff] text-brand-600' : 'text-slate-600 hover:bg-slate-100'}`}>
             <Folder className="w-4 h-4" />
             All Files
           </button>
           <button onClick={() => onNavigate('dashboard')} className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors ${currentView === 'dashboard' ? 'bg-[#e0e7ff] text-brand-600' : 'text-slate-600 hover:bg-slate-100'}`}>
             <Clock className="w-4 h-4" />
             Recent
           </button>
        </div>

        <div className="mt-6 px-3">
          <h3 className="px-3 text-xs font-semibold text-slate-400 tracking-wider mb-2 uppercase">Categories</h3>
          <div className="space-y-0.5">
            {isLoadingCategories && (
              <div className="px-3 py-2 text-sm font-medium text-slate-500">Loading...</div>
            )}
            {!isLoadingCategories && !hasCategories && (
              <div className="px-3 py-2 text-sm font-medium text-slate-500">No categories</div>
            )}
            {!isLoadingCategories &&
              hasCategories &&
              sortedCategories.map((category) => (
                <button
                  key={category}
                  onClick={() => onNavigate('files')}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
                  title={category}
                >
                  <Tag className="w-4 h-4 text-slate-400" />
                  <span className="truncate">{category}</span>
                </button>
              ))}
          </div>
        </div>
      </nav>

      <div className="p-3 border-t border-slate-200 space-y-0.5">
        <button
          onClick={() => onNavigate('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors ${
            settingsActive ? 'bg-[#e0e7ff] text-brand-600' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Settings className="w-4 h-4" /> Settings
        </button>
        {settingsActive && (
          <div className="pl-2 space-y-0.5">
            <button
              onClick={() => onNavigate('settings')}
              className={`w-full flex items-center gap-3 px-3 py-1.5 text-[13px] font-medium rounded-md cursor-pointer transition-colors ${
                currentView === 'settings' ? 'bg-white text-slate-900' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="w-4" />
              General
            </button>
            <button
              onClick={() => onNavigate('aiConfiguration')}
              className={`w-full flex items-center gap-3 px-3 py-1.5 text-[13px] font-medium rounded-md cursor-pointer transition-colors ${
                currentView === 'aiConfiguration' ? 'bg-white text-slate-900' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <KeyRound className="w-4 h-4 text-slate-400" />
              AI Configuration
            </button>
          </div>
        )}
        <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors">
          <BarChart2 className="w-4 h-4 border border-slate-400 rounded-xs" /> System Status
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors">
          <Trash2 className="w-4 h-4 text-slate-400" /> Trash
        </button>
      </div>
    </aside>
  );
}
