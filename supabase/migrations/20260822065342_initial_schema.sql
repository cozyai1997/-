create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.pokemon_gender as enum ('male', 'female', 'genderless');
create type public.owned_move_kind as enum ('current', 'target');
create type public.publication_status as enum ('draft', 'validated', 'active', 'retired', 'rejected');

create function public.valid_stat_block(
  block jsonb,
  per_stat_max integer,
  total_max integer
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  stat_value jsonb;
  total integer := 0;
begin
  if jsonb_typeof(block) <> 'object'
    or (select count(*) from jsonb_object_keys(block)) <> 6
    or not block ?& array['hp', 'attack', 'defense', 'special_attack', 'special_defense', 'speed']
  then
    return false;
  end if;

  for stat_value in select value from jsonb_each(block)
  loop
    if jsonb_typeof(stat_value) <> 'number'
      or (stat_value::text)::numeric <> trunc((stat_value::text)::numeric)
      or (stat_value::text)::integer < 0
      or (stat_value::text)::integer > per_stat_max
    then
      return false;
    end if;
    total := total + (stat_value::text)::integer;
  end loop;

  return total <= total_max;
exception when others then
  return false;
end;
$$;

create function public.stat_block_greater_than_or_equal(left_block jsonb, right_block jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select bool_and((left_block ->> key)::integer >= (right_block ->> key)::integer)
  from unnest(array['hp', 'attack', 'defense', 'special_attack', 'special_defense', 'speed']) as key;
$$;

revoke all on function public.valid_stat_block(jsonb, integer, integer) from public;
revoke all on function public.stat_block_greater_than_or_equal(jsonb, jsonb) from public;
grant execute on function public.valid_stat_block(jsonb, integer, integer) to authenticated, service_role;
grant execute on function public.stat_block_greater_than_or_equal(jsonb, jsonb) to authenticated, service_role;

create table public.data_publications (
  id uuid primary key default gen_random_uuid(),
  version text not null unique check (btrim(version) <> ''),
  status public.publication_status not null default 'draft',
  source_manifest jsonb not null default '{}'::jsonb,
  row_counts jsonb not null default '{}'::jsonb,
  sha256 jsonb not null default '{}'::jsonb,
  validation_report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  activated_at timestamptz,
  retired_at timestamptz,
  constraint publication_activation_requires_validation
    check (status <> 'active' or (validated_at is not null and activated_at is not null))
);

create unique index one_active_data_publication
on public.data_publications ((status))
where status = 'active';

create table public.reference_types (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid references public.data_publications(id) on delete restrict,
  identifier text not null unique check (btrim(identifier) <> ''),
  name_ko text not null check (btrim(name_ko) <> ''),
  color_hex text not null check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order smallint not null check (sort_order >= 0),
  is_active boolean not null default true
);

create index reference_types_publication_idx on public.reference_types (publication_id);

create table public.reference_species (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid references public.data_publications(id) on delete restrict,
  national_dex_number smallint not null unique check (national_dex_number between 1 and 9999),
  identifier text not null unique check (btrim(identifier) <> ''),
  name_ko text not null check (btrim(name_ko) <> ''),
  description_ko text not null check (btrim(description_ko) <> ''),
  primary_type_id uuid references public.reference_types(id) on delete restrict,
  secondary_type_id uuid references public.reference_types(id) on delete restrict,
  is_active boolean not null default true,
  constraint species_types_are_distinct check (
    secondary_type_id is null
    or (primary_type_id is not null and primary_type_id is distinct from secondary_type_id)
  )
);

create index reference_species_publication_idx on public.reference_species (publication_id);
create index reference_species_primary_type_idx on public.reference_species (primary_type_id);
create index reference_species_secondary_type_idx on public.reference_species (secondary_type_id);

create table public.reference_forms (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid references public.data_publications(id) on delete restrict,
  species_id uuid not null references public.reference_species(id) on delete cascade,
  identifier text not null unique check (btrim(identifier) <> ''),
  name_ko text not null check (btrim(name_ko) <> ''),
  primary_type_id uuid references public.reference_types(id) on delete restrict,
  secondary_type_id uuid references public.reference_types(id) on delete restrict,
  is_default boolean not null default false,
  is_active boolean not null default true,
  unique (id, species_id),
  constraint form_types_are_distinct check (
    secondary_type_id is null
    or (primary_type_id is not null and primary_type_id is distinct from secondary_type_id)
  )
);

create index reference_forms_publication_idx on public.reference_forms (publication_id);
create index reference_forms_species_idx on public.reference_forms (species_id);
create index reference_forms_primary_type_idx on public.reference_forms (primary_type_id);
create index reference_forms_secondary_type_idx on public.reference_forms (secondary_type_id);

create unique index one_default_form_per_species
on public.reference_forms (species_id)
where is_default;

create table public.reference_abilities (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid references public.data_publications(id) on delete restrict,
  identifier text not null unique check (btrim(identifier) <> ''),
  name_ko text not null check (btrim(name_ko) <> ''),
  description_ko text not null check (btrim(description_ko) <> ''),
  is_active boolean not null default true
);

create index reference_abilities_publication_idx on public.reference_abilities (publication_id);

create table public.reference_moves (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid references public.data_publications(id) on delete restrict,
  identifier text not null unique check (btrim(identifier) <> ''),
  name_ko text not null check (btrim(name_ko) <> ''),
  description_ko text not null check (btrim(description_ko) <> ''),
  type_id uuid not null references public.reference_types(id) on delete restrict,
  damage_class text not null check (damage_class in ('physical', 'special', 'status')),
  power smallint check (power is null or power >= 0),
  accuracy smallint check (accuracy is null or accuracy between 1 and 100),
  pp smallint not null check (pp > 0),
  priority smallint not null default 0,
  is_active boolean not null default true
);

create index reference_moves_publication_idx on public.reference_moves (publication_id);
create index reference_moves_type_idx on public.reference_moves (type_id);

create table public.reference_items (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid references public.data_publications(id) on delete restrict,
  identifier text not null unique check (btrim(identifier) <> ''),
  name_ko text not null check (btrim(name_ko) <> ''),
  description_ko text not null check (btrim(description_ko) <> ''),
  is_active boolean not null default true
);

create index reference_items_publication_idx on public.reference_items (publication_id);

create table public.reference_natures (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid references public.data_publications(id) on delete restrict,
  identifier text not null unique check (btrim(identifier) <> ''),
  name_ko text not null check (btrim(name_ko) <> ''),
  increased_stat text check (increased_stat in ('attack', 'defense', 'special_attack', 'special_defense', 'speed')),
  decreased_stat text check (decreased_stat in ('attack', 'defense', 'special_attack', 'special_defense', 'speed')),
  is_active boolean not null default true,
  constraint nature_stats_are_distinct check (
    (increased_stat is null and decreased_stat is null)
    or increased_stat is distinct from decreased_stat
  )
);

create index reference_natures_publication_idx on public.reference_natures (publication_id);

create table public.reference_move_learnsets (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid references public.data_publications(id) on delete restrict,
  form_id uuid not null references public.reference_forms(id) on delete cascade,
  move_id uuid not null references public.reference_moves(id) on delete cascade,
  learn_method text not null check (learn_method in ('level', 'tm', 'tutor', 'egg', 'evolution', 'other')),
  learn_level smallint check (learn_level is null or learn_level between 1 and 100),
  condition_ko text not null default ''::text,
  unique (form_id, move_id, learn_method, learn_level)
);

create index reference_move_learnsets_publication_idx on public.reference_move_learnsets (publication_id);
create index reference_move_learnsets_move_idx on public.reference_move_learnsets (move_id);

create table public.reference_evolution_rules (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid references public.data_publications(id) on delete restrict,
  from_form_id uuid not null references public.reference_forms(id) on delete cascade,
  to_form_id uuid not null references public.reference_forms(id) on delete cascade,
  condition_ko text not null check (btrim(condition_ko) <> ''),
  sort_order smallint not null default 0 check (sort_order >= 0),
  constraint evolution_changes_form check (from_form_id <> to_form_id)
);

create index reference_evolution_rules_publication_idx on public.reference_evolution_rules (publication_id);
create index reference_evolution_rules_from_form_idx on public.reference_evolution_rules (from_form_id);
create index reference_evolution_rules_to_form_idx on public.reference_evolution_rules (to_form_id);

create table public.reference_type_matchups (
  attacking_type_id uuid not null references public.reference_types(id) on delete cascade,
  defending_type_id uuid not null references public.reference_types(id) on delete cascade,
  multiplier numeric(4,2) not null check (multiplier in (0, 0.25, 0.5, 1, 2, 4)),
  publication_id uuid references public.data_publications(id) on delete restrict,
  primary key (attacking_type_id, defending_type_id)
);

create index reference_type_matchups_defending_idx on public.reference_type_matchups (defending_type_id);
create index reference_type_matchups_publication_idx on public.reference_type_matchups (publication_id);

create table public.owned_pokemon (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  species_id uuid not null references public.reference_species(id) on delete restrict,
  form_id uuid not null,
  nickname text check (nickname is null or char_length(nickname) between 1 and 40),
  gender public.pokemon_gender not null,
  level smallint not null check (level between 1 and 100),
  captured_on date,
  original_nature_id uuid references public.reference_natures(id) on delete restrict,
  effective_nature_id uuid references public.reference_natures(id) on delete restrict,
  ability_id uuid references public.reference_abilities(id) on delete restrict,
  original_iv jsonb not null default '{"hp":0,"attack":0,"defense":0,"special_attack":0,"special_defense":0,"speed":0}'::jsonb,
  effective_iv jsonb not null default '{"hp":0,"attack":0,"defense":0,"special_attack":0,"special_defense":0,"speed":0}'::jsonb,
  ev jsonb not null default '{"hp":0,"attack":0,"defense":0,"special_attack":0,"special_defense":0,"speed":0}'::jsonb,
  held_item_id uuid references public.reference_items(id) on delete set null,
  notes text not null default ''::text check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint owned_form_matches_species
    foreign key (form_id, species_id) references public.reference_forms(id, species_id) on delete restrict,
  constraint original_iv_range check (public.valid_stat_block(original_iv, 31, 186)),
  constraint effective_iv_range check (public.valid_stat_block(effective_iv, 31, 186)),
  constraint effective_iv_not_below_original
    check (public.stat_block_greater_than_or_equal(effective_iv, original_iv)),
  constraint ev_range_and_total check (public.valid_stat_block(ev, 252, 510))
);

create index owned_pokemon_user_updated_idx on public.owned_pokemon (user_id, updated_at desc);
create index owned_pokemon_species_idx on public.owned_pokemon (species_id);
create index owned_pokemon_form_species_idx on public.owned_pokemon (form_id, species_id);
create index owned_pokemon_original_nature_idx on public.owned_pokemon (original_nature_id);
create index owned_pokemon_effective_nature_idx on public.owned_pokemon (effective_nature_id);
create index owned_pokemon_ability_idx on public.owned_pokemon (ability_id);
create index owned_pokemon_held_item_idx on public.owned_pokemon (held_item_id);

create table public.owned_pokemon_moves (
  id uuid primary key default gen_random_uuid(),
  owned_pokemon_id uuid not null references public.owned_pokemon(id) on delete cascade,
  move_id uuid not null references public.reference_moves(id) on delete restrict,
  kind public.owned_move_kind not null,
  slot smallint not null check (slot between 1 and 4),
  target_condition_ko text not null default ''::text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owned_pokemon_id, kind, slot),
  unique (owned_pokemon_id, kind, move_id),
  constraint target_move_requires_condition
    check (kind <> 'target' or btrim(target_condition_ko) <> '')
);

create index owned_pokemon_moves_move_idx on public.owned_pokemon_moves (move_id);

create table public.owned_pokemon_images (
  id uuid primary key default gen_random_uuid(),
  owned_pokemon_id uuid not null references public.owned_pokemon(id) on delete cascade,
  storage_path text not null unique check (btrim(storage_path) <> ''),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size integer not null check (byte_size between 1 and 5242880),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  created_at timestamptz not null default now()
);

create index owned_pokemon_images_owned_idx on public.owned_pokemon_images (owned_pokemon_id);

create table public.audit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  entity_type text not null check (entity_type in ('owned_pokemon', 'owned_pokemon_move', 'owned_pokemon_image')),
  entity_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete', 'correct')),
  before_data jsonb,
  after_data jsonb,
  reason_ko text,
  occurred_at timestamptz not null default now()
);

create index audit_events_user_time_idx on public.audit_events (user_id, occurred_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;

create trigger owned_pokemon_set_updated_at
before update on public.owned_pokemon
for each row execute function public.set_updated_at();

create trigger owned_pokemon_moves_set_updated_at
before update on public.owned_pokemon_moves
for each row execute function public.set_updated_at();
