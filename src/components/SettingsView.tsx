import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Layers3, Plus } from 'lucide-react';
import { ApiClientError, api } from '../lib/api/client';
import type { AiProvider, AiProviderKeyStatus, AnchorOverride, MappingProfile, MappingRule } from '../lib/api/types';

const SETTINGS_KEY = 'ai-pdf-classifier.settings';

const AI_MODELS: Record<AiProvider, Array<{ value: string; label: string }>> = {
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
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong while talking to the backend.';
};

const getActiveProfiles = (profiles: MappingProfile[]) => {
  const activeProfiles = profiles.filter((profile) => profile.isActive);
  return activeProfiles.length > 0 ? activeProfiles : profiles;
};

type SettingsSection = 'general' | 'aiConfiguration';

export default function SettingsView({ section = 'general' }: { section?: SettingsSection }) {
  return section === 'aiConfiguration' ? <AiConfigurationView /> : <SettingsGeneralView />;
}

function AiConfigurationView() {
  const [status, setStatus] = useState<Record<AiProvider, AiProviderKeyStatus> | null>(null);
  const [openAiKey, setOpenAiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [showOpenAi, setShowOpenAi] = useState(false);
  const [showGemini, setShowGemini] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [savingProvider, setSavingProvider] = useState<AiProvider | null>(null);
  const [clearingProvider, setClearingProvider] = useState<AiProvider | null>(null);
  const [testingProvider, setTestingProvider] = useState<AiProvider | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadStatus = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.aiConfig.status();
      const next: Record<AiProvider, AiProviderKeyStatus> = {
        gemini: { provider: 'gemini', hasKey: false, updatedAt: null },
        openai: { provider: 'openai', hasKey: false, updatedAt: null },
      };
      for (const p of res.providers) next[p.provider] = p;
      setStatus(next);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const saveKey = async (provider: AiProvider) => {
    const apiKey = (provider === 'openai' ? openAiKey : geminiKey).trim();
    if (!apiKey) return;

    setSavingProvider(provider);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await api.aiConfig.setKey(provider, { apiKey });
      if (provider === 'openai') setOpenAiKey('');
      if (provider === 'gemini') setGeminiKey('');
      await loadStatus();
      setSuccessMessage('API key saved.');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSavingProvider(null);
    }
  };

  const clearKey = async (provider: AiProvider) => {
    setClearingProvider(provider);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await api.aiConfig.clearKey(provider);
      await loadStatus();
      setSuccessMessage('API key cleared.');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setClearingProvider(null);
    }
  };

  const testKey = async (provider: AiProvider) => {
    setTestingProvider(provider);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await api.aiConfig.testKey(provider);
      setSuccessMessage('API key test passed.');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setTestingProvider(null);
    }
  };

  const renderProviderCard = (provider: AiProvider, args: { label: string; value: string; onChange: (v: string) => void; show: boolean; onToggleShow: () => void }) => {
    const providerStatus = status?.[provider] ?? { provider, hasKey: false, updatedAt: null };
    const isSaving = savingProvider === provider;
    const isClearing = clearingProvider === provider;
    const isTesting = testingProvider === provider;

    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-[17px] font-semibold text-slate-900 mb-0.5">{args.label}</h3>
              <p className="text-[13px] text-slate-500">System-wide key used by the backend to call this provider.</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                providerStatus.hasKey ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {providerStatus.hasKey ? 'Configured' : 'Not configured'}
            </span>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700" htmlFor={`ai_key_${provider}`}>
              API Key
            </label>
            <div className="flex gap-2">
              <input
                id={`ai_key_${provider}`}
                type={args.show ? 'text' : 'password'}
                value={args.value}
                onChange={(e) => args.onChange(e.target.value)}
                placeholder={provider === 'openai' ? 'sk-...' : 'AIza...'}
                className="flex-1 px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 placeholder-slate-400 bg-slate-50"
              />
              <button
                type="button"
                onClick={args.onToggleShow}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {args.show ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Keys are stored encrypted in the database and are never sent back to the browser.
            </p>
            <p className="text-xs text-slate-500">Test checks the saved key. Click Save before testing changes.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => void testKey(provider)}
              disabled={isTesting || isLoading || !providerStatus.hasKey}
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isTesting ? 'Testing...' : 'Test'}
            </button>
            <button
              type="button"
              onClick={() => void clearKey(provider)}
              disabled={isClearing || isLoading}
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isClearing ? 'Clearing...' : 'Clear'}
            </button>
            <button
              type="button"
              onClick={() => void saveKey(provider)}
              disabled={isSaving || isLoading || args.value.trim().length === 0}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-[1040px] w-full">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">AI Configuration</h2>
        <p className="text-[15px] text-slate-600">Configure system-wide provider credentials used for classification runs.</p>
        {errorMessage && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
        )}
        {successMessage && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {renderProviderCard('openai', {
          label: 'OpenAI',
          value: openAiKey,
          onChange: setOpenAiKey,
          show: showOpenAi,
          onToggleShow: () => setShowOpenAi((prev) => !prev),
        })}
        {renderProviderCard('gemini', {
          label: 'Gemini',
          value: geminiKey,
          onChange: setGeminiKey,
          show: showGemini,
          onToggleShow: () => setShowGemini((prev) => !prev),
        })}
      </div>
    </div>
  );
}

function SettingsGeneralView() {
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [mappingProfiles, setMappingProfiles] = useState<MappingProfile[]>([]);
  const [defaultMappingProfileId, setDefaultMappingProfileId] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [aiProvider, setAiProvider] = useState<AiProvider>('gemini');
  const [aiModel, setAiModel] = useState('gemini-1.5-pro');
  const [prefixMappings, setPrefixMappings] = useState<MappingRule[]>([]);
  const [anchorOverrides, setAnchorOverrides] = useState<AnchorOverride[]>([]);
  const [newSource, setNewSource] = useState('');
  const [newTargetFolder, setNewTargetFolder] = useState('');
  const [newTargetPrefix, setNewTargetPrefix] = useState('');
  const [overrideCategory, setOverrideCategory] = useState('');
  const [overrideKeywords, setOverrideKeywords] = useState('');
  const [overridePriority, setOverridePriority] = useState('100');
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDescription, setNewProfileDescription] = useState('');
  const [newProfileVersion, setNewProfileVersion] = useState('1');
  const [shouldCloneRules, setShouldCloneRules] = useState(true);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isLoadingMappings, setIsLoadingMappings] = useState(false);
  const [isLoadingOverrides, setIsLoadingOverrides] = useState(false);
  const [isSavingDefaults, setIsSavingDefaults] = useState(false);
  const [isAddingMapping, setIsAddingMapping] = useState(false);
  const [isSavingOverride, setIsSavingOverride] = useState(false);
  const [isCreatingPreset, setIsCreatingPreset] = useState(false);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [deletingOverrideId, setDeletingOverrideId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const hydratedRef = useRef(false);

  const displayedRules = useMemo(() => {
    const copy = [...prefixMappings];
    copy.sort((a, b) => a.targetFolder.localeCompare(b.targetFolder));
    return copy;
  }, [prefixMappings]);

  const filenamePattern = useMemo(() => {
    const prefix = newTargetPrefix.trim().length > 0 ? newTargetPrefix.trim() : 'PREFIX';
    return `${prefix}### - {Requester}.pdf`;
  }, [newTargetPrefix]);

  const selectedProfile = useMemo(
    () => mappingProfiles.find((profile) => profile.id === selectedProfileId) ?? null,
    [mappingProfiles, selectedProfileId],
  );

  const defaultProfile = useMemo(
    () => mappingProfiles.find((profile) => profile.id === defaultMappingProfileId) ?? null,
    [defaultMappingProfileId, mappingProfiles],
  );

  useEffect(() => {
    const first = AI_MODELS[aiProvider][0]?.value;
    if (!first) return;
    const isValid = AI_MODELS[aiProvider].some((model) => model.value === aiModel);
    if (!isValid) setAiModel(first);
  }, [aiProvider, aiModel]);

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      setIsBootstrapping(true);
      setErrorMessage(null);

      try {
        const [users, profiles] = await Promise.all([api.users.list(), api.mappingProfiles.list()]);
        const nextProfiles = getActiveProfiles(profiles);
        const activeUser = users.find((user) => user.isActive) ?? users[0];

        if (!activeUser) throw new Error('No active user is available to load settings.');
        if (nextProfiles.length === 0) throw new Error('No mapping presets are available in the database.');

        let profileId = nextProfiles[0].id;
        let provider: AiProvider = 'gemini';
        let model = AI_MODELS.gemini[0].value;

        try {
          const prefs = await api.userPreferences.get(activeUser.id);
          if (prefs.defaultMappingProfileId && nextProfiles.some((profile) => profile.id === prefs.defaultMappingProfileId)) {
            profileId = prefs.defaultMappingProfileId;
          }
          if (prefs.defaultAiProvider) provider = prefs.defaultAiProvider;
          if (prefs.defaultAiModel) model = prefs.defaultAiModel;
        } catch (error) {
          if (!(error instanceof ApiClientError) || error.status !== 404) throw error;
        }

        if (cancelled) return;

        setActiveUserId(activeUser.id);
        setMappingProfiles(nextProfiles);
        setDefaultMappingProfileId(profileId);
        setSelectedProfileId(profileId);
        setAiProvider(provider);
        setAiModel(model);
        hydratedRef.current = true;
      } catch (error) {
        if (!cancelled) setErrorMessage(getErrorMessage(error));
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    };

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedProfileId) return;

    let cancelled = false;

    const loadRules = async () => {
      setIsLoadingMappings(true);
      setErrorMessage(null);
      try {
        const rules = await api.mappingProfiles.getRules(selectedProfileId);
        if (!cancelled) setPrefixMappings(rules);
      } catch (error) {
        if (!cancelled) setErrorMessage(getErrorMessage(error));
      } finally {
        if (!cancelled) setIsLoadingMappings(false);
      }
    };

    const loadOverrides = async () => {
      setIsLoadingOverrides(true);
      setErrorMessage(null);
      try {
        const overrides = await api.mappingProfiles.getAnchorOverrides(selectedProfileId);
        if (!cancelled) setAnchorOverrides(overrides);
      } catch (error) {
        if (!cancelled) setErrorMessage(getErrorMessage(error));
      } finally {
        if (!cancelled) setIsLoadingOverrides(false);
      }
    };

    void loadRules();
    void loadOverrides();

    return () => {
      cancelled = true;
    };
  }, [selectedProfileId]);

  useEffect(() => {
    const folders = prefixMappings
      .filter((r) => r.isActive && r.matchType === 'category')
      .map((r) => r.targetFolder)
      .filter((v) => v.trim().length > 0);
    const categories = Array.from(new Set<string>(folders)).sort((a, b) => a.localeCompare(b));
    if (overrideCategory.trim().length === 0 && categories.length > 0) {
      setOverrideCategory(categories[0] ?? '');
    }
  }, [overrideCategory, prefixMappings]);

  useEffect(() => {
    if (!hydratedRef.current || !activeUserId || !defaultMappingProfileId || !aiModel) return;

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setIsSavingDefaults(true);
      try {
        await api.userPreferences.update(activeUserId, {
          defaultMappingProfileId,
          defaultAiProvider: aiProvider,
          defaultAiModel: aiModel,
        });
      } catch (error) {
        if (!cancelled) setErrorMessage(getErrorMessage(error));
      } finally {
        if (!cancelled) setIsSavingDefaults(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [activeUserId, aiProvider, aiModel, defaultMappingProfileId]);

  useEffect(() => {
    if (!defaultProfile) return;

    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        defaultMappingPreset: defaultProfile.name,
        defaultMappingProfileId: defaultProfile.id,
        aiProvider,
        aiModel,
        prefixMappings: prefixMappings.map((rule) => ({
          id: rule.id,
          source: rule.source,
          target: rule.targetPrefix ?? rule.targetCode ?? rule.targetFolder,
        })),
      }),
    );
    window.dispatchEvent(new Event('ai-pdf-classifier:settings-updated'));
  }, [aiModel, aiProvider, defaultProfile, prefixMappings]);

  const addMapping = async () => {
    const source = newSource.trim();
    const targetFolder = newTargetFolder.trim();
    const targetPrefix = newTargetPrefix.trim();
    if (!source || !targetFolder || !targetPrefix || !selectedProfileId) return;

    setIsAddingMapping(true);
    setErrorMessage(null);

    try {
      const created = await api.mappingProfiles.createRule(selectedProfileId, {
        matchType: 'category',
        source,
        targetFolder,
        targetPrefix,
        priority: 100,
        isActive: true,
      });

      setPrefixMappings((prev) => [...prev, created]);
      setNewSource('');
      setNewTargetFolder('');
      setNewTargetPrefix('');
      setSuccessMessage(`Rule added to preset "${selectedProfile?.name ?? 'selected'}".`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsAddingMapping(false);
    }
  };

  const removeMapping = async (id: string) => {
    setDeletingRuleId(id);
    setErrorMessage(null);

    try {
      await api.mappingRules.delete(id);
      setPrefixMappings((prev) => prev.filter((rule) => rule.id !== id));
      setSuccessMessage('Rule deleted.');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setDeletingRuleId(null);
    }
  };

  const saveAnchorOverride = async () => {
    if (!selectedProfileId) return;
    const category = overrideCategory.trim();
    const keywords = overrideKeywords
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
    const priority = Number(overridePriority);
    if (!category || keywords.length === 0 || !Number.isFinite(priority) || !Number.isInteger(priority) || priority <= 0) return;

    setIsSavingOverride(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const created = await api.mappingProfiles.upsertAnchorOverride(selectedProfileId, {
        category,
        anchorKeywords: keywords,
        priority,
        isActive: true,
      });
      setAnchorOverrides((prev) => {
        const next = prev.filter((o) => o.category !== created.category);
        next.unshift(created);
        return next;
      });
      setOverrideKeywords('');
      setOverridePriority('100');
      setSuccessMessage('Anchor override saved.');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSavingOverride(false);
    }
  };

  const deleteAnchorOverride = async (overrideId: string) => {
    if (!selectedProfileId) return;
    setDeletingOverrideId(overrideId);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await api.mappingProfiles.deleteAnchorOverride(selectedProfileId, overrideId);
      setAnchorOverrides((prev) => prev.filter((o) => o.id !== overrideId));
      setSuccessMessage('Anchor override deleted.');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setDeletingOverrideId(null);
    }
  };

  const createPreset = async () => {
    const name = newProfileName.trim();
    const description = newProfileDescription.trim();
    const version = Number(newProfileVersion);

    if (!activeUserId || !name || !Number.isInteger(version) || version <= 0) return;

    setIsCreatingPreset(true);
    setErrorMessage(null);

    try {
      const created = await api.mappingProfiles.create({
        name,
        description: description || undefined,
        version,
        isActive: true,
        createdBy: activeUserId,
      });

      if (shouldCloneRules && prefixMappings.length > 0) {
        for (const rule of prefixMappings) {
          await api.mappingProfiles.createRule(created.id, {
            matchType: rule.matchType,
            source: rule.source,
            targetFolder: rule.targetFolder,
            targetCode: rule.targetCode ?? undefined,
            targetPrefix: rule.targetPrefix ?? undefined,
            priority: rule.priority,
            isActive: rule.isActive,
          });
        }
      }

      const refreshedProfiles = getActiveProfiles(await api.mappingProfiles.list());
      setMappingProfiles(refreshedProfiles);
      setSelectedProfileId(created.id);
      setNewProfileName('');
      setNewProfileDescription('');
      setNewProfileVersion('1');
      setShouldCloneRules(true);
      setSuccessMessage(
        shouldCloneRules && prefixMappings.length > 0
          ? `Preset "${created.name}" created and cloned ${prefixMappings.length} rules.`
          : `Preset "${created.name}" created.`
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsCreatingPreset(false);
    }
  };

  const statusText = isBootstrapping
    ? 'Loading settings from backend...'
    : isSavingDefaults
      ? 'Saving defaults...'
      : isLoadingMappings
        ? 'Loading preset rules...'
        : 'Settings are synced with the backend';

  return (
    <div className="max-w-[1040px] w-full">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Settings</h2>
        <p className="text-[15px] text-slate-600">
          This page stores defaults for new batches and lets admins manage mapping presets.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px]">
          <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">{statusText}</span>
          {defaultProfile && (
            <span className="rounded-full bg-[#e0e7ff] px-3 py-1 font-medium text-brand-700">
              Default preset: {defaultProfile.name}
            </span>
          )}
        </div>
        {errorMessage && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
        )}
        {successMessage && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-5">
          <h3 className="text-[17px] font-semibold text-slate-900 mb-0.5">Defaults For New Batches</h3>
          <p className="text-[14px] text-slate-500">These values are used automatically when an operator opens `New Batch`.</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            <div className="flex flex-col gap-1.5 min-w-0">
              <label className="text-sm font-semibold text-slate-700" htmlFor="settings_mapping_preset">
                Default Mapping Preset
              </label>
              <select
                id="settings_mapping_preset"
                value={defaultMappingProfileId}
                onChange={(e) => setDefaultMappingProfileId(e.target.value)}
                disabled={isBootstrapping || mappingProfiles.length === 0}
                className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 bg-slate-50"
              >
                {mappingProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">You can edit a different preset without changing the default.</p>
            </div>

            <div className="flex flex-col gap-1.5 min-w-0">
              <label className="text-sm font-semibold text-slate-700" htmlFor="settings_ai_provider">
                Default AI Provider
              </label>
              <select
                id="settings_ai_provider"
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value as AiProvider)}
                disabled={isBootstrapping}
                className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 bg-slate-50"
              >
                <option value="gemini">Gemini</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5 min-w-0">
              <label className="text-sm font-semibold text-slate-700" htmlFor="settings_ai_model">
                Default AI Model
              </label>
              <select
                id="settings_ai_model"
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                disabled={isBootstrapping}
                className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 bg-slate-50"
              >
                {AI_MODELS[aiProvider].map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-5">
            <h3 className="text-[17px] font-semibold text-slate-900 mb-0.5">Preset Editor</h3>
            <p className="text-[14px] text-slate-500">
              Select which preset you want to edit. This does not have to match the default preset.
            </p>
          </div>
          <div className="p-6 space-y-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700" htmlFor="selected_mapping_preset">
                Preset Open In Editor
              </label>
              <select
                id="selected_mapping_preset"
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                disabled={isBootstrapping || mappingProfiles.length === 0}
                className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 bg-slate-50"
              >
                {mappingProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedProfile && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Layers3 className="h-4 w-4 text-brand-600" />
                      <h4 className="text-base font-semibold text-slate-900 truncate">{selectedProfile.name}</h4>
                      {selectedProfile.id === defaultMappingProfileId && (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{selectedProfile.description || 'No preset description yet.'}</p>
                  </div>
                  {selectedProfile.id !== defaultMappingProfileId && (
                    <button
                      type="button"
                      onClick={() => setDefaultMappingProfileId(selectedProfile.id)}
                      className="rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100"
                    >
                      Set As Default
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-5">
            <h3 className="text-[17px] font-semibold text-slate-900 mb-0.5">Create New Mapping Preset</h3>
            <p className="text-[14px] text-slate-500">
              Create a new preset when you need a dedicated set of rules for a department, vendor, or document type.
            </p>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700" htmlFor="new_profile_name">
                Preset Name
              </label>
              <input
                id="new_profile_name"
                type="text"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                placeholder="Example: Legal Preset, Finance Preset"
                className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 placeholder-slate-400 bg-slate-50"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700" htmlFor="new_profile_description">
                Description
              </label>
              <textarea
                id="new_profile_description"
                value={newProfileDescription}
                onChange={(e) => setNewProfileDescription(e.target.value)}
                rows={3}
                placeholder="Describe what this preset is used for."
                className="w-full resize-none px-4 py-3 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 placeholder-slate-400 bg-slate-50"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-4 items-start">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700" htmlFor="new_profile_version">
                  Version
                </label>
                <input
                  id="new_profile_version"
                  type="number"
                  min="1"
                  step="1"
                  value={newProfileVersion}
                  onChange={(e) => setNewProfileVersion(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 bg-slate-50"
                />
              </div>

              <label className="mt-7 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shouldCloneRules}
                  onChange={(e) => setShouldCloneRules(e.target.checked)}
                  className="mt-1"
                />
                <span className="text-sm text-slate-600">Clone rules from the preset currently open in the editor.</span>
              </label>
            </div>

            <button
              type="button"
              onClick={() => void createPreset()}
              disabled={!activeUserId || newProfileName.trim().length === 0 || isCreatingPreset}
              className="w-full rounded-md bg-brand-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreatingPreset ? 'Creating preset...' : 'Create New Preset'}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-5">
          <h3 className="text-[17px] font-semibold text-slate-900 mb-0.5">Rules</h3>
          <p className="text-[14px] text-slate-500">Manage rules for the preset currently open in the editor.</p>
        </div>
        <div className="p-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700" htmlFor="mapping_source">
                  Source Category / Label
                </label>
                <input
                  id="mapping_source"
                  type="text"
                  value={newSource}
                  onChange={(e) => setNewSource(e.target.value)}
                  placeholder="Example: Kartu Halo"
                  className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 placeholder-slate-400 bg-white"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700" htmlFor="mapping_target_folder">
                  Folder
                </label>
                <input
                  id="mapping_target_folder"
                  type="text"
                  value={newTargetFolder}
                  onChange={(e) => setNewTargetFolder(e.target.value)}
                  placeholder="Example: Kartu Halo"
                  className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 placeholder-slate-400 bg-white"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700" htmlFor="mapping_target_prefix">
                  Prefix
                </label>
                <input
                  id="mapping_target_prefix"
                  type="text"
                  value={newTargetPrefix}
                  onChange={(e) => setNewTargetPrefix(e.target.value)}
                  placeholder="Example: ICTBAK"
                  className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 placeholder-slate-400 bg-white"
                />
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-500">
              PDF filename pattern preview: <span className="font-mono text-slate-700">{filenamePattern}</span>
            </div>

            <div className="mt-4 flex items-center justify-end">
              <button
                type="button"
                onClick={() => void addMapping()}
                className="bg-brand-600 hover:bg-brand-700 text-white flex items-center justify-center gap-2 py-2 px-4 rounded-md font-medium text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={
                  newSource.trim().length === 0 ||
                  newTargetFolder.trim().length === 0 ||
                  newTargetPrefix.trim().length === 0 ||
                  isAddingMapping ||
                  !selectedProfileId
                }
              >
                <Plus className="w-4 h-4" />
                {isAddingMapping ? 'Adding...' : 'Add Rule'}
              </button>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto border border-slate-200 rounded-xl">
            <table className="min-w-[760px] w-full text-left bg-white">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-[12px] font-semibold text-slate-500">
                  <th className="px-4 py-3">Folder</th>
                  <th className="px-4 py-3">PDF filename pattern</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-[13px]">
                {!isLoadingMappings && prefixMappings.length === 0 && (
                  <tr>
                    <td className="px-4 py-5 text-slate-500" colSpan={3}>
                      No rules in this preset yet.
                    </td>
                  </tr>
                )}
                {displayedRules.map((rule) => (
                  <tr key={rule.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 text-slate-800 font-medium">{rule.targetFolder}</td>
                    <td className="px-4 py-3 text-slate-700 font-mono">
                      {rule.targetPrefix ? `${rule.targetPrefix}### - {Requester}.pdf` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void removeMapping(rule.id)}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        disabled={deletingRuleId === rule.id}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-5">
          <h3 className="text-[17px] font-semibold text-slate-900 mb-0.5">Anchor Overrides</h3>
          <p className="text-[14px] text-slate-500">Force a category when specific keywords appear in extracted anchors.</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700" htmlFor="anchor_override_category">
                Category (Folder)
              </label>
              <select
                id="anchor_override_category"
                value={overrideCategory}
                onChange={(e) => setOverrideCategory(e.target.value)}
                disabled={isBootstrapping || prefixMappings.length === 0}
                className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 bg-slate-50"
              >
                {Array.from(new Set<string>(prefixMappings.map((r) => r.targetFolder).filter((v) => v.trim().length > 0)))
                  .sort((a, b) => a.localeCompare(b))
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700" htmlFor="anchor_override_keywords">
                Keywords (comma-separated)
              </label>
              <input
                id="anchor_override_keywords"
                type="text"
                value={overrideKeywords}
                onChange={(e) => setOverrideKeywords(e.target.value)}
                placeholder="Example: equipment checkout form, it equipment checkout"
                className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 placeholder-slate-400 bg-white"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700" htmlFor="anchor_override_priority">
                Priority
              </label>
              <input
                id="anchor_override_priority"
                type="number"
                min="1"
                step="1"
                value={overridePriority}
                onChange={(e) => setOverridePriority(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 bg-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => void saveAnchorOverride()}
              disabled={
                isSavingOverride ||
                isBootstrapping ||
                isLoadingOverrides ||
                overrideCategory.trim().length === 0 ||
                overrideKeywords.trim().length === 0
              }
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingOverride ? 'Saving...' : 'Save Override'}
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
            <div className="px-4 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 bg-[#f8fafc]">
              Overrides
            </div>
            <div className="divide-y divide-slate-200">
              {isLoadingOverrides && <div className="px-4 py-3 text-sm text-slate-600">Loading overrides...</div>}
              {!isLoadingOverrides && anchorOverrides.length === 0 && (
                <div className="px-4 py-3 text-sm text-slate-600">No overrides configured.</div>
              )}
              {anchorOverrides.map((o) => (
                <div key={o.id} className="px-4 py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800">{o.category}</div>
                    <div className="mt-1 text-xs text-slate-600 break-words">{o.anchorKeywords.join(', ')}</div>
                    <div className="mt-1 text-[11px] text-slate-500">Priority: {o.priority}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteAnchorOverride(o.id)}
                    disabled={deletingOverrideId === o.id}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingOverrideId === o.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
