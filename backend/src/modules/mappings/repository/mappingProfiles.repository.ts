import { pool } from '../../../core/db/postgres.js';
import type { MappingProfile } from '../model/mapping.model.js';

type ProfileRow = {
  id: string;
  name: string;
  description: string | null;
  version: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
};

const mapProfile = (r: ProfileRow): MappingProfile => ({
  id: r.id,
  name: r.name,
  description: r.description,
  version: r.version,
  isActive: r.is_active,
  createdBy: r.created_by,
  createdAt: r.created_at,
});

export const mappingProfilesRepository = {
  list: async (): Promise<MappingProfile[]> => {
    const res = await pool.query<ProfileRow>(
      'select id, name, description, version, is_active, created_by, created_at from mapping_profiles order by created_at desc',
    );
    return res.rows.map(mapProfile);
  },

  getById: async (id: string): Promise<MappingProfile | null> => {
    const res = await pool.query<ProfileRow>(
      'select id, name, description, version, is_active, created_by, created_at from mapping_profiles where id = $1',
      [id],
    );
    const row = res.rows[0];
    return row ? mapProfile(row) : null;
  },

  existsNameVersion: async (name: string, version: number): Promise<boolean> => {
    const res = await pool.query<{ exists: boolean }>(
      'select exists(select 1 from mapping_profiles where name = $1 and version = $2) as exists',
      [name, version],
    );
    return res.rows[0]?.exists === true;
  },

  create: async (args: {
    name: string;
    description?: string;
    version: number;
    isActive: boolean;
    createdBy?: string;
  }): Promise<MappingProfile> => {
    const res = await pool.query<ProfileRow>(
      `insert into mapping_profiles (name, description, version, is_active, created_by)
       values ($1, $2, $3, $4, $5)
       returning id, name, description, version, is_active, created_by, created_at`,
      [args.name, args.description ?? null, args.version, args.isActive, args.createdBy ?? null],
    );
    const row = res.rows[0];
    if (!row) throw new Error('Failed to create mapping profile');
    return mapProfile(row);
  },

  update: async (
    id: string,
    patch: { name?: string; description?: string; version?: number; isActive?: boolean },
  ): Promise<MappingProfile> => {
    const current = await mappingProfilesRepository.getById(id);
    if (!current) throw new Error('Profile not found');
    const next = {
      name: patch.name ?? current.name,
      description: patch.description ?? current.description,
      version: patch.version ?? current.version,
      isActive: patch.isActive ?? current.isActive,
    };

    const res = await pool.query<ProfileRow>(
      `update mapping_profiles
       set name = $2,
           description = $3,
           version = $4,
           is_active = $5
       where id = $1
       returning id, name, description, version, is_active, created_by, created_at`,
      [id, next.name, next.description, next.version, next.isActive],
    );
    const row = res.rows[0];
    if (!row) throw new Error('Failed to update mapping profile');
    return mapProfile(row);
  },
};

