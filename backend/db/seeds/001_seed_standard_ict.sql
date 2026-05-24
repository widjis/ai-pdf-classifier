insert into app_users (email, display_name, role, is_active)
select 'admin@local', 'Admin', 'admin', true
where not exists (select 1 from app_users where email = 'admin@local');

update app_users
set display_name = 'Admin',
    role = 'admin',
    is_active = true
where email = 'admin@local';

insert into mapping_profiles (name, description, version, is_active, created_by)
select 'Standard ICT Mappings', 'Default mapping profile for ICT archive folders', 1, true, u.id
from app_users u
where u.email = 'admin@local'
  and not exists (
    select 1
    from mapping_profiles mp
    where mp.name = 'Standard ICT Mappings' and mp.version = 1
  );

update mapping_profiles
set description = 'Default mapping profile for ICT archive folders',
    is_active = true
where name = 'Standard ICT Mappings' and version = 1;

with profile as (
  select id from mapping_profiles where name = 'Standard ICT Mappings' and version = 1
)
insert into mapping_rules (profile_id, match_type, source, target_folder, priority, is_active)
select profile.id, v.match_type, v.source, v.target_folder, v.priority, true
from profile
cross join (
  values
    ('category', 'Berita Kehilangan', 'Berita Kehilangan', 100),
    ('category', 'Checklist Reimburse HP', 'Checklist Reimburse HP', 100),
    ('category', 'COF Scan', 'COF Scan', 100),
    ('category', 'ICT Loan Form', 'ICT Loan Form', 100),
    ('category', 'Kartu Halo', 'Kartu Halo', 100),
    ('category', 'Serah Terima Barang', 'Serah Terima Barang', 100),
    ('category', 'SRF Scan', 'SRF Scan', 100)
) as v(match_type, source, target_folder, priority)
where not exists (
  select 1
  from mapping_rules r
  where r.profile_id = profile.id
    and r.match_type = v.match_type
    and r.source = v.source
);

with profile as (
  select id from mapping_profiles where name = 'Standard ICT Mappings' and version = 1
)
update mapping_rules r
set target_prefix = case r.source
  when 'Berita Kehilangan' then 'ICTBKK'
  when 'Checklist Reimburse HP' then 'ICTCRH'
  when 'COF Scan' then 'ICTCOF'
  when 'ICT Loan Form' then 'ICTLOA'
  when 'Kartu Halo' then 'ICTBAK'
  when 'Serah Terima Barang' then 'ICTSTB'
  when 'SRF Scan' then 'ICTSRF'
  else r.target_prefix
end
from profile
where r.profile_id = profile.id
  and r.match_type = 'category'
  and r.source in (
    'Berita Kehilangan',
    'Checklist Reimburse HP',
    'COF Scan',
    'ICT Loan Form',
    'Kartu Halo',
    'Serah Terima Barang',
    'SRF Scan'
  );

insert into user_preferences (user_id, default_mapping_profile_id, default_ai_provider, default_ai_model, updated_at)
select u.id, p.id, 'gemini', 'gemini-1.5-pro', now()
from app_users u
join mapping_profiles p on p.name = 'Standard ICT Mappings' and p.version = 1
where u.email = 'admin@local'
  and not exists (select 1 from user_preferences up where up.user_id = u.id);

update user_preferences up
set default_mapping_profile_id = p.id,
    default_ai_provider = 'gemini',
    default_ai_model = 'gemini-1.5-pro',
    updated_at = now()
from app_users u
join mapping_profiles p on p.name = 'Standard ICT Mappings' and p.version = 1
where up.user_id = u.id
  and u.email = 'admin@local';
