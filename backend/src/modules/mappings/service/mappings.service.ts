import { ApiError } from '../../../core/http/apiError.js';
import type { MappingProfile, MappingRule, MappingRuleMatchType } from '../model/mapping.model.js';
import { mappingProfilesRepository } from '../repository/mappingProfiles.repository.js';
import { mappingRulesRepository } from '../repository/mappingRules.repository.js';

export const mappingsService = {
  listProfiles: async (): Promise<MappingProfile[]> => mappingProfilesRepository.list(),

  createProfile: async (args: {
    name: string;
    description?: string;
    version: number;
    isActive: boolean;
    createdBy?: string;
  }): Promise<MappingProfile> => {
    const exists = await mappingProfilesRepository.existsNameVersion(args.name, args.version);
    if (exists) throw new ApiError({ status: 409, code: 'CONFLICT', message: 'Profile name+version already exists' });
    return mappingProfilesRepository.create(args);
  },

  getProfile: async (id: string): Promise<MappingProfile> => {
    const profile = await mappingProfilesRepository.getById(id);
    if (!profile) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Mapping profile not found' });
    return profile;
  },

  updateProfile: async (
    id: string,
    patch: { name?: string; description?: string; version?: number; isActive?: boolean },
  ): Promise<MappingProfile> => {
    const existing = await mappingProfilesRepository.getById(id);
    if (!existing) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Mapping profile not found' });
    return mappingProfilesRepository.update(id, patch);
  },

  listRules: async (profileId: string): Promise<MappingRule[]> => {
    await mappingsService.getProfile(profileId);
    return mappingRulesRepository.listByProfileId(profileId);
  },

  createRule: async (args: {
    profileId: string;
    matchType: MappingRuleMatchType;
    source: string;
    targetFolder: string;
    targetCode?: string;
    targetPrefix?: string;
    priority: number;
    isActive: boolean;
  }): Promise<MappingRule> => {
    await mappingsService.getProfile(args.profileId);
    return mappingRulesRepository.create(args);
  },

  deleteRule: async (id: string): Promise<void> => {
    const ok = await mappingRulesRepository.deleteById(id);
    if (!ok) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Mapping rule not found' });
  },
};

