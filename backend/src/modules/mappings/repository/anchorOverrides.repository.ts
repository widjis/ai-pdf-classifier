import { pool } from '../../../core/db/postgres.js';
import type { AnchorOverride } from '../model/mapping.model.js';

type AnchorOverrideRow = {
  id: string;
  profile_id: string;
  category: string;
  anchor_keywords: string[];
  priority: number;
  is_active: boolean;
  created_at: string;
};

const mapRow = (r: AnchorOverrideRow): AnchorOverride => ({
  id: r.id,
  profileId: r.profile_id,
  category: r.category,
  anchorKeywords: r.anchor_keywords,
  priority: r.priority,
  isActive: r.is_active,
  createdAt: r.created_at,
});

export const anchorOverridesRepository = {
  listByProfileId: async (profileId: string): Promise<AnchorOverride[]> => {
    const res = await pool.query<AnchorOverrideRow>(
      `select id, profile_id, category, anchor_keywords, priority, is_active, created_at
       from mapping_profile_anchor_overrides
       where profile_id = $1
       order by priority asc, created_at desc`,
      [profileId],
    );
    return res.rows.map(mapRow);
  },

  upsert: async (args: {
    profileId: string;
    category: string;
    anchorKeywords: string[];
    priority: number;
    isActive: boolean;
  }): Promise<AnchorOverride> => {
    const res = await pool.query<AnchorOverrideRow>(
      `insert into mapping_profile_anchor_overrides (profile_id, category, anchor_keywords, priority, is_active)
       values ($1, $2, $3, $4, $5)
       on conflict (profile_id, category)
       do update set anchor_keywords = excluded.anchor_keywords, priority = excluded.priority, is_active = excluded.is_active
       returning id, profile_id, category, anchor_keywords, priority, is_active, created_at`,
      [args.profileId, args.category, args.anchorKeywords, args.priority, args.isActive],
    );
    const row = res.rows[0];
    if (!row) throw new Error('Failed to upsert anchor override');
    return mapRow(row);
  },

  deleteById: async (id: string): Promise<boolean> => {
    const res = await pool.query('delete from mapping_profile_anchor_overrides where id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  },
};

