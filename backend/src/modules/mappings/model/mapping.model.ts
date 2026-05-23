export type MappingProfile = {
  id: string;
  name: string;
  description: string | null;
  version: number;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
};

export type MappingRuleMatchType = 'category' | 'filename_prefix' | 'filename_regex';

export type MappingRule = {
  id: string;
  profileId: string;
  matchType: MappingRuleMatchType;
  source: string;
  targetCode: string | null;
  targetPrefix: string | null;
  targetFolder: string;
  priority: number;
  isActive: boolean;
  createdAt: string;
};

