import React, { useEffect, useMemo, useState } from 'react';
import { Folder, Clock, BarChart2, Trash2, Plus, LayoutGrid, Settings, KeyRound, Tag, Users } from 'lucide-react';
import { ViewState } from '../types';
import { ApiClientError, api } from '../lib/api/client';
import type { AuthUser, MappingRule } from '../lib/api/types';

const SETTINGS_KEY = 'ai-pdf-classifier.settings';

interface SidebarProps {
  authUser: AuthUser;
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  activeCategory: string | null;
  onSelectCategory: (category: string) => void;
}

export default function Sidebar({ authUser, currentView, onNavigate, activeCategory, onSelectCategory }: SidebarProps) {
  const settingsActive = currentView === 'settings' || currentView === 'aiConfiguration' || currentView === 'manageUsers';
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
        const prefs = await api.userPreferences.get(authUser.id);
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
  }, [authUser.id]);

  return (
    <aside className="w-[280px] bg-slate-950/45 border-r border-white/10 h-full flex flex-col flex-shrink-0 text-white backdrop-blur-xl">
      <div className="p-5 border-b border-white/10 flex flex-col gap-1">
        <div className="flex items-center gap-2 text-white/90 font-semibold mb-1">
          <div className="bg-white/10 border border-white/10 text-white p-1.5 rounded-xl">
            <LayoutGrid className="w-4 h-4" />
          </div>
          <span className="text-[15px] tracking-wide">Classification</span>
        </div>
        <span className="text-xs text-white/50 font-medium">V1.0.0</span>
      </div>

      <div className="p-4">
        <button
          onClick={() => onNavigate('newBatch')}
          className="w-full bg-gradient-to-b from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-700 text-white flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-sm transition-all cursor-pointer shadow-[0_14px_45px_-25px_rgba(0,83,219,0.75)] focus:outline-none focus:ring-4 focus:ring-brand-500/25"
        >
          <Plus className="w-4 h-4" />
          New Batch
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        <div className="px-3 space-y-0.5">
          <button
            onClick={() => onNavigate('files')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl cursor-pointer transition-colors ${
              currentView === 'files' ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white/90'
            }`}
          >
             <Folder className="w-4 h-4" />
             All Files
           </button>
          <button
            onClick={() => onNavigate('dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl cursor-pointer transition-colors ${
              currentView === 'dashboard' ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white/90'
            }`}
          >
             <Clock className="w-4 h-4" />
             Recent
           </button>
        </div>

        <div className="mt-6 px-3">
          <h3 className="px-3 text-xs font-semibold text-white/40 tracking-wider mb-2 uppercase">Categories</h3>
          <div className="space-y-0.5">
            {isLoadingCategories && (
              <div className="px-3 py-2 text-sm font-semibold text-white/60">Loading...</div>
            )}
            {!isLoadingCategories && !hasCategories && (
              <div className="px-3 py-2 text-sm font-semibold text-white/55">No categories</div>
            )}
            {!isLoadingCategories &&
              hasCategories &&
              sortedCategories.map((category) => (
                <button
                  key={category}
                  onClick={() => onSelectCategory(category)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl cursor-pointer transition-colors ${
                    category === activeCategory && currentView === 'files'
                      ? 'bg-white/10 text-white'
                      : 'text-white/70 hover:bg-white/5 hover:text-white/90'
                  }`}
                  title={category}
                >
                  <Tag
                    className={`w-4 h-4 ${
                      category === activeCategory && currentView === 'files' ? 'text-white/90' : 'text-white/35'
                    }`}
                  />
                  <span className="truncate">{category}</span>
                </button>
              ))}
          </div>
        </div>
      </nav>

      <div className="p-3 border-t border-white/10 space-y-0.5">
        <button
          onClick={() => onNavigate('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl cursor-pointer transition-colors ${
            settingsActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white/90'
          }`}
        >
          <Settings className="w-4 h-4" /> Settings
        </button>
        {settingsActive && (
          <div className="pl-2 space-y-0.5">
            <button
              onClick={() => onNavigate('settings')}
              className={`w-full flex items-center gap-3 px-3 py-1.5 text-[13px] font-semibold rounded-xl cursor-pointer transition-colors ${
                currentView === 'settings' ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/5 hover:text-white/90'
              }`}
            >
              <span className="w-4" />
              General
            </button>
            <button
              onClick={() => onNavigate('aiConfiguration')}
              className={`w-full flex items-center gap-3 px-3 py-1.5 text-[13px] font-semibold rounded-xl cursor-pointer transition-colors ${
                currentView === 'aiConfiguration' ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/5 hover:text-white/90'
              }`}
            >
              <KeyRound className="w-4 h-4 text-white/45" />
              AI Configuration
            </button>
            {authUser.role === 'admin' && (
              <button
                onClick={() => onNavigate('manageUsers')}
                className={`w-full flex items-center gap-3 px-3 py-1.5 text-[13px] font-semibold rounded-xl cursor-pointer transition-colors ${
                  currentView === 'manageUsers' ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/5 hover:text-white/90'
                }`}
              >
                <Users className="w-4 h-4 text-white/45" />
                Manage Users
              </button>
            )}
          </div>
        )}
        <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl text-white/70 hover:bg-white/5 hover:text-white/90 cursor-pointer transition-colors">
          <BarChart2 className="w-4 h-4 text-white/55" /> System Status
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl text-white/70 hover:bg-white/5 hover:text-white/90 cursor-pointer transition-colors">
          <Trash2 className="w-4 h-4 text-white/45" /> Trash
        </button>
      </div>
    </aside>
  );
}
