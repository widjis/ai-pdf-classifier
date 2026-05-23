import { pool } from '../../../core/db/postgres.js';
import type { MappingRule, MappingRuleMatchType } from '../model/mapping.model.js';

type RuleRow = {
  id: string;
  profile_id: string;
  match_type: string;
  source: string;
  target_code: string | null;
  target_prefix: string | null;
  target_folder: string;
  priority: number;
  is_active: boolean;
  created_at: string;
};

const mapRule = (r: RuleRow): MappingRule => ({
  id: r.id,
  profileId: r.profile_id,
  matchType: r.match_type as MappingRuleMatchType,
  source: r.source,
  targetCode: r.target_code,
  targetPrefix: r.target_prefix,
  targetFolder: r.target_folder,
  priority: r.priority,
  isActive: r.is_active,
  createdAt: r.created_at,
});

export const mappingRulesRepository = {
  listByProfileId: async (profileId: string): Promise<MappingRule[]> => {
    const res = await pool.query<RuleRow>(
      `select id, profile_id, match_type, source, target_code, target_prefix, target_folder, priority, is_active, created_at
       from mapping_rules
       where profile_id = $1
       order by priority asc, created_at desc`,
      [profileId],
    );
    return res.rows.map(mapRule);
  },

  create: async (args: {
    profileId: string;
    matchType: MappingRuleMatchType;
    source: string;
    targetFolder: string;
    targetCode?: string;
    targetPrefix?: string;
    priority: number;
    isActive: boolean;
  }): Promise<MappingRule> => {
    const res = await pool.query<RuleRow>(
      `insert into mapping_rules (profile_id, match_type, source, target_code, target_prefix, target_folder, priority, is_active)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id, profile_id, match_type, source, target_code, target_prefix, target_folder, priority, is_active, created_at`,
      [
        args.profileId,
        args.matchType,
        args.source,
        args.targetCode ?? null,
        args.targetPrefix ?? null,
        args.targetFolder,
        args.priority,
        args.isActive,
      ],
    );
    const row = res.rows[0];
    if (!row) throw new Error('Failed to create mapping rule');
    return mapRule(row);
  },

  deleteById: async (id: string): Promise<boolean> => {
    const res = await pool.query('delete from mapping_rules where id = $1', [id]);
    return res.rowCount === 1;
  },
};

