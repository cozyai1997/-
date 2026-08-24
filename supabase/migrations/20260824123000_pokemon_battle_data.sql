alter table public.reference_forms
  add column base_hp smallint,
  add column base_attack smallint,
  add column base_defense smallint,
  add column base_special_attack smallint,
  add column base_special_defense smallint,
  add column base_speed smallint,
  add column is_battle_only boolean not null default false,
  add constraint reference_forms_base_stats_complete_or_null check (
    num_nonnulls(base_hp, base_attack, base_defense, base_special_attack, base_special_defense, base_speed) in (0, 6)
  ),
  add constraint reference_forms_base_stats_range check (
    (base_hp is null or base_hp between 1 and 255)
    and (base_attack is null or base_attack between 1 and 255)
    and (base_defense is null or base_defense between 1 and 255)
    and (base_special_attack is null or base_special_attack between 1 and 255)
    and (base_special_defense is null or base_special_defense between 1 and 255)
    and (base_speed is null or base_speed between 1 and 255)
  );

alter table public.reference_forms
  add constraint reference_forms_publication_id_id_key unique (publication_id, id);
alter table public.reference_types
  add constraint reference_types_publication_id_id_key unique (publication_id, id);

create table public.reference_tera_types (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null,
  identifier text not null unique,
  name_ko text not null,
  reference_type_id uuid,
  sort_order smallint not null,
  is_active boolean not null default true,
  unique (publication_id, id),
  unique (publication_id, sort_order),
  foreign key (publication_id) references public.data_publications(id) on delete restrict,
  foreign key (publication_id, reference_type_id)
    references public.reference_types(publication_id, id) on delete restrict
);

create table public.reference_form_tera_options (
  publication_id uuid not null,
  form_id uuid not null,
  tera_type_id uuid not null,
  primary key (publication_id, form_id, tera_type_id),
  foreign key (publication_id) references public.data_publications(id) on delete restrict,
  foreign key (publication_id, form_id)
    references public.reference_forms(publication_id, id) on delete cascade,
  foreign key (publication_id, tera_type_id)
    references public.reference_tera_types(publication_id, id) on delete cascade
);

create table public.reference_form_gigantamax_options (
  publication_id uuid not null,
  source_form_id uuid not null,
  gigantamax_form_id uuid not null,
  primary key (publication_id, source_form_id, gigantamax_form_id),
  check (source_form_id <> gigantamax_form_id),
  foreign key (publication_id) references public.data_publications(id) on delete restrict,
  foreign key (publication_id, source_form_id)
    references public.reference_forms(publication_id, id) on delete cascade,
  foreign key (publication_id, gigantamax_form_id)
    references public.reference_forms(publication_id, id) on delete cascade
);

create index reference_form_tera_options_form_idx
  on public.reference_form_tera_options (publication_id, form_id);
create index reference_form_gigantamax_options_source_idx
  on public.reference_form_gigantamax_options (publication_id, source_form_id);
create index reference_option_filter_staging_batch_kind_tera_type_idx
  on public.reference_option_filter_publication_staging
  (batch_id, publication_id, row_kind, ((payload ->> 'tera_type_id')));

alter table public.reference_tera_types enable row level security;
alter table public.reference_form_tera_options enable row level security;
alter table public.reference_form_gigantamax_options enable row level security;

grant all privileges on public.reference_tera_types, public.reference_form_tera_options,
  public.reference_form_gigantamax_options to service_role;
grant select on public.reference_tera_types, public.reference_form_tera_options,
  public.reference_form_gigantamax_options to authenticated;

create policy "authenticated read active tera types"
on public.reference_tera_types for select to authenticated
using (exists (
  select 1 from public.data_publications as publication
  where publication.id = reference_tera_types.publication_id
    and publication.status = 'active'
));
create policy "authenticated read active form tera options"
on public.reference_form_tera_options for select to authenticated
using (exists (
  select 1 from public.data_publications as publication
  where publication.id = reference_form_tera_options.publication_id
    and publication.status = 'active'
));
create policy "authenticated read active gigantamax options"
on public.reference_form_gigantamax_options for select to authenticated
using (exists (
  select 1 from public.data_publications as publication
  where publication.id = reference_form_gigantamax_options.publication_id
    and publication.status = 'active'
));

create or replace function private.validate_reference_form_gigantamax_option()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_species_id uuid;
  target_species_id uuid;
  source_battle_only boolean;
  target_battle_only boolean;
begin
  select species_id, is_battle_only into source_species_id, source_battle_only
  from public.reference_forms
  where id = new.source_form_id and publication_id = new.publication_id;
  select species_id, is_battle_only into target_species_id, target_battle_only
  from public.reference_forms
  where id = new.gigantamax_form_id and publication_id = new.publication_id;

  if source_species_id is null or target_species_id is null
    or source_species_id <> target_species_id
    or source_battle_only
    or not target_battle_only
  then
    raise check_violation using message = '거다이맥스 관계는 같은 종의 일반 원본과 battle-only 대상이어야 합니다.';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_reference_form_gigantamax_option()
  from public, anon, authenticated;

create trigger reference_form_gigantamax_options_validate
before insert or update on public.reference_form_gigantamax_options
for each row execute function private.validate_reference_form_gigantamax_option();

alter table public.reference_option_filter_publication_staging
  drop constraint reference_option_filter_publication_staging_row_kind_check,
  add constraint reference_option_filter_publication_staging_row_kind_check check (row_kind in (
    'move', 'form_base_link', 'form_ability', 'learnset',
    'form_battle_profile', 'nature_adjustment', 'tera_type',
    'form_tera_option', 'form_gigantamax_option'
  ));

create or replace function public.replace_pokemon_option_filter_reference_data(
  p_publication_id uuid,
  p_batch_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
set statement_timeout = '60s'
as $$
declare
  staged_moves integer;
  staged_base_links integer;
  staged_abilities integer;
  staged_learnsets integer;
  staged_profiles integer;
  staged_natures integer;
  staged_tera_types integer;
  staged_tera_options integer;
  staged_gmax_options integer;
  applied integer;
begin
  if not exists (select 1 from public.data_publications where id = p_publication_id and status = 'active') then
    raise invalid_parameter_value using message = 'target publication must be active';
  end if;

  select
    count(*) filter (where row_kind = 'move'),
    count(*) filter (where row_kind = 'form_base_link'),
    count(*) filter (where row_kind = 'form_ability'),
    count(*) filter (where row_kind = 'learnset'),
    count(*) filter (where row_kind = 'form_battle_profile'),
    count(*) filter (where row_kind = 'nature_adjustment'),
    count(*) filter (where row_kind = 'tera_type'),
    count(*) filter (where row_kind = 'form_tera_option'),
    count(*) filter (where row_kind = 'form_gigantamax_option')
  into staged_moves, staged_base_links, staged_abilities, staged_learnsets,
    staged_profiles, staged_natures, staged_tera_types, staged_tera_options, staged_gmax_options
  from public.reference_option_filter_publication_staging
  where batch_id = p_batch_id and publication_id = p_publication_id;

  if (staged_moves, staged_base_links, staged_abilities, staged_learnsets, staged_profiles,
      staged_natures, staged_tera_types, staged_tera_options, staged_gmax_options)
      <> (826, 1498, 3055, 116519, 1498, 25, 19, 25184, 42) then
    raise invalid_parameter_value using message = format(
      'staged row count mismatch: moves=%s base_links=%s abilities=%s learnsets=%s profiles=%s natures=%s tera_types=%s tera_options=%s gmax_options=%s',
      staged_moves, staged_base_links, staged_abilities, staged_learnsets, staged_profiles,
      staged_natures, staged_tera_types, staged_tera_options, staged_gmax_options
    );
  end if;

  if (select count(*) from public.reference_option_filter_publication_staging
      where batch_id = p_batch_id and publication_id = p_publication_id) <> 148666 then
    raise invalid_parameter_value using message = 'unrecognised staging rows are not allowed';
  end if;

  if (select count(distinct payload ->> 'identifier') from public.reference_option_filter_publication_staging
      where batch_id = p_batch_id and publication_id = p_publication_id and row_kind = 'move') <> 826
    or exists (
      select 1 from public.reference_option_filter_publication_staging as staged
      left join public.reference_types as type
        on type.id = (staged.payload ->> 'type_id')::uuid
        and type.publication_id = p_publication_id and type.is_active
      where staged.batch_id = p_batch_id and staged.publication_id = p_publication_id
        and staged.row_kind = 'move' and type.id is null
    ) then
    raise invalid_parameter_value using message = 'staged moves are invalid';
  end if;

  if (select count(*) from public.reference_option_filter_publication_staging
      where batch_id = p_batch_id and publication_id = p_publication_id
        and row_kind = 'form_battle_profile' and coalesce((payload ->> 'is_battle_only')::boolean, false)) <> 164
    or (select count(*) from public.reference_option_filter_publication_staging
      where batch_id = p_batch_id and publication_id = p_publication_id
        and row_kind = 'form_battle_profile' and not coalesce((payload ->> 'is_battle_only')::boolean, false)) <> 1334 then
    raise invalid_parameter_value using message = 'staged battle profiles must contain 1334 playable and 164 battle-only forms';
  end if;

  if exists (
    select 1 from public.reference_option_filter_publication_staging as staged
    left join public.reference_forms as form
      on form.id = (staged.payload ->> 'form_id')::uuid and form.publication_id = p_publication_id
    left join public.reference_forms as base_form
      on base_form.id = nullif(staged.payload ->> 'base_form_id', '')::uuid and base_form.publication_id = p_publication_id
    where staged.batch_id = p_batch_id and staged.publication_id = p_publication_id
      and staged.row_kind = 'form_base_link'
      and (form.id is null or (base_form.id is not null and base_form.species_id <> form.species_id))
  ) then
    raise invalid_parameter_value using message = 'staged base form link is invalid';
  end if;

  if exists (
    select 1 from public.reference_option_filter_publication_staging as staged
    left join public.reference_forms as form
      on form.id = (staged.payload ->> 'form_id')::uuid and form.publication_id = p_publication_id
    where staged.batch_id = p_batch_id and staged.publication_id = p_publication_id
      and staged.row_kind = 'form_battle_profile'
      and form.id is null
  ) then
    raise invalid_parameter_value using message = 'staged battle profile form is invalid';
  end if;

  if exists (
    select 1 from public.reference_option_filter_publication_staging as staged
    left join public.reference_forms as form
      on form.id = (staged.payload ->> 'form_id')::uuid and form.publication_id = p_publication_id
    left join public.reference_abilities as ability
      on ability.id = (staged.payload ->> 'ability_id')::uuid
      and ability.publication_id = p_publication_id and ability.is_active
    where staged.batch_id = p_batch_id and staged.publication_id = p_publication_id
      and staged.row_kind = 'form_ability' and (form.id is null or ability.id is null)
  ) then
    raise invalid_parameter_value using message = 'staged form ability is invalid';
  end if;

  if exists (
    select 1 from public.reference_option_filter_publication_staging as staged
    left join public.reference_species as species
      on species.id = (staged.payload ->> 'species_id')::uuid
      and species.publication_id = p_publication_id and species.is_active
    left join public.reference_forms as form
      on form.id = nullif(staged.payload ->> 'form_id', '')::uuid and form.publication_id = p_publication_id
    where staged.batch_id = p_batch_id and staged.publication_id = p_publication_id and staged.row_kind = 'learnset'
      and (species.id is null
        or (nullif(staged.payload ->> 'form_id', '') is not null and (form.id is null or form.species_id <> species.id))
        or not exists (
          select 1 from public.reference_option_filter_publication_staging as move
          where move.batch_id = p_batch_id and move.publication_id = p_publication_id and move.row_kind = 'move'
            and move.payload ->> 'identifier' = staged.payload ->> 'move_identifier'
        ))
  ) then
    raise invalid_parameter_value using message = 'staged learnset is invalid';
  end if;

  if exists (
    select 1 from public.reference_option_filter_publication_staging as staged
    left join public.reference_natures as nature
      on nature.id = (staged.payload ->> 'nature_id')::uuid and nature.publication_id = p_publication_id
    where staged.batch_id = p_batch_id and staged.publication_id = p_publication_id
      and staged.row_kind = 'nature_adjustment' and nature.id is null
  ) then
    raise invalid_parameter_value using message = 'staged nature is invalid';
  end if;

  if (select count(distinct payload ->> 'identifier') from public.reference_option_filter_publication_staging
      where batch_id = p_batch_id and publication_id = p_publication_id and row_kind = 'tera_type') <> 19
    or (select count(distinct (payload ->> 'sort_order')::smallint) from public.reference_option_filter_publication_staging
      where batch_id = p_batch_id and publication_id = p_publication_id and row_kind = 'tera_type') <> 19 then
    raise invalid_parameter_value using message = 'staged tera types must have unique identifiers and sort order';
  end if;

  if exists (
    select 1 from public.reference_option_filter_publication_staging as staged
    left join public.reference_types as type
      on type.id = nullif(staged.payload ->> 'reference_type_id', '')::uuid
      and type.publication_id = p_publication_id and type.is_active
    where staged.batch_id = p_batch_id and staged.publication_id = p_publication_id
      and staged.row_kind = 'tera_type'
      and nullif(staged.payload ->> 'reference_type_id', '') is not null and type.id is null
  ) then
    raise invalid_parameter_value using message = 'staged tera type reference is invalid';
  end if;

  if exists (
    select 1 from public.reference_option_filter_publication_staging as option
    left join public.reference_forms as form
      on form.id = (option.payload ->> 'form_id')::uuid and form.publication_id = p_publication_id
    left join public.reference_option_filter_publication_staging as tera
      on tera.batch_id = p_batch_id and tera.publication_id = p_publication_id
      and tera.row_kind = 'tera_type'
      and tera.payload ->> 'tera_type_id' = option.payload ->> 'tera_type_id'
    where option.batch_id = p_batch_id and option.publication_id = p_publication_id
      and option.row_kind = 'form_tera_option'
      and (form.id is null or form.is_battle_only or tera.id is null)
  ) then
    raise invalid_parameter_value using message = 'staged form tera option is invalid';
  end if;

  if exists (
    select 1
    from public.reference_option_filter_publication_staging as staged
    where staged.batch_id = p_batch_id and staged.publication_id = p_publication_id
      and staged.row_kind = 'learnset'
      and (
        (staged.payload ->> 'learn_level') !~ '^(0|[1-9][0-9]?)$'
        or (staged.payload ->> 'learn_level')::integer > 100
      )
  ) then
    raise check_violation using message = 'staged learnset level must be between 0 and 100';
  end if;

  if exists (
    select 1 from public.reference_option_filter_publication_staging as staged
    left join public.reference_forms as source_form
      on source_form.id = (staged.payload ->> 'source_form_id')::uuid and source_form.publication_id = p_publication_id
    left join public.reference_forms as target_form
      on target_form.id = (staged.payload ->> 'gigantamax_form_id')::uuid and target_form.publication_id = p_publication_id
    where staged.batch_id = p_batch_id and staged.publication_id = p_publication_id
      and staged.row_kind = 'form_gigantamax_option'
      and (source_form.id is null or target_form.id is null or source_form.species_id <> target_form.species_id)
  ) then
    raise invalid_parameter_value using message = 'staged gigantamax option is invalid';
  end if;

  insert into public.reference_moves (publication_id, identifier, name_ko, description_ko, type_id, damage_class, power, accuracy, pp, is_active)
  select p_publication_id, payload ->> 'identifier', payload ->> 'name_ko', payload ->> 'description_ko',
    (payload ->> 'type_id')::uuid, payload ->> 'damage_class', (payload ->> 'power')::smallint,
    (payload ->> 'accuracy')::smallint, (payload ->> 'pp')::smallint, (payload ->> 'is_active')::boolean
  from public.reference_option_filter_publication_staging
  where batch_id = p_batch_id and publication_id = p_publication_id and row_kind = 'move'
  order by source_order
  on conflict (identifier) do update set publication_id = excluded.publication_id, name_ko = excluded.name_ko,
    description_ko = excluded.description_ko, type_id = excluded.type_id, damage_class = excluded.damage_class,
    power = excluded.power, accuracy = excluded.accuracy, pp = excluded.pp, is_active = excluded.is_active;

  update public.reference_forms as form
  set base_form_id = nullif(staged.payload ->> 'base_form_id', '')::uuid
  from public.reference_option_filter_publication_staging as staged
  where staged.batch_id = p_batch_id and staged.publication_id = p_publication_id
    and staged.row_kind = 'form_base_link' and form.id = (staged.payload ->> 'form_id')::uuid
    and form.publication_id = p_publication_id;
  get diagnostics applied = row_count;
  if applied <> 1498 then raise check_violation using message = 'form base link update count mismatch'; end if;

  update public.reference_forms as form
  set base_hp = (staged.payload ->> 'base_hp')::smallint,
    base_attack = (staged.payload ->> 'base_attack')::smallint,
    base_defense = (staged.payload ->> 'base_defense')::smallint,
    base_special_attack = (staged.payload ->> 'base_special_attack')::smallint,
    base_special_defense = (staged.payload ->> 'base_special_defense')::smallint,
    base_speed = (staged.payload ->> 'base_speed')::smallint,
    is_battle_only = (staged.payload ->> 'is_battle_only')::boolean
  from public.reference_option_filter_publication_staging as staged
  where staged.batch_id = p_batch_id and staged.publication_id = p_publication_id
    and staged.row_kind = 'form_battle_profile' and form.id = (staged.payload ->> 'form_id')::uuid
    and form.publication_id = p_publication_id;
  get diagnostics applied = row_count;
  if applied <> 1498 then raise check_violation using message = 'form battle profile update count mismatch'; end if;

  update public.reference_natures as nature
  set increased_stat = nullif(staged.payload ->> 'increased_stat', ''),
    decreased_stat = nullif(staged.payload ->> 'decreased_stat', '')
  from public.reference_option_filter_publication_staging as staged
  where staged.batch_id = p_batch_id and staged.publication_id = p_publication_id
    and staged.row_kind = 'nature_adjustment' and nature.id = (staged.payload ->> 'nature_id')::uuid
    and nature.publication_id = p_publication_id;
  get diagnostics applied = row_count;
  if applied <> 25 then raise check_violation using message = 'nature update count mismatch'; end if;

  delete from public.reference_form_tera_options where publication_id = p_publication_id;
  insert into public.reference_tera_types (id, publication_id, identifier, name_ko, reference_type_id, sort_order, is_active)
  select (payload ->> 'tera_type_id')::uuid, p_publication_id, payload ->> 'identifier', payload ->> 'name_ko',
    nullif(payload ->> 'reference_type_id', '')::uuid, (payload ->> 'sort_order')::smallint,
    coalesce((payload ->> 'is_active')::boolean, true)
  from public.reference_option_filter_publication_staging
  where batch_id = p_batch_id and publication_id = p_publication_id and row_kind = 'tera_type'
  order by source_order
  on conflict (identifier) do update set publication_id = excluded.publication_id, name_ko = excluded.name_ko,
    reference_type_id = excluded.reference_type_id, sort_order = excluded.sort_order, is_active = excluded.is_active;

  with staged_tera as materialized (
    select payload ->> 'tera_type_id' as staged_id, payload ->> 'identifier' as identifier
    from public.reference_option_filter_publication_staging
    where batch_id = p_batch_id and publication_id = p_publication_id and row_kind = 'tera_type'
  )
  insert into public.reference_form_tera_options (publication_id, form_id, tera_type_id)
  select p_publication_id, (option.payload ->> 'form_id')::uuid, tera.id
  from public.reference_option_filter_publication_staging as option
  join staged_tera on staged_tera.staged_id = option.payload ->> 'tera_type_id'
  join public.reference_tera_types as tera
    on tera.publication_id = p_publication_id and tera.identifier = staged_tera.identifier
  where option.batch_id = p_batch_id and option.publication_id = p_publication_id and option.row_kind = 'form_tera_option';

  delete from public.reference_form_gigantamax_options where publication_id = p_publication_id;
  insert into public.reference_form_gigantamax_options (publication_id, source_form_id, gigantamax_form_id)
  select p_publication_id, (payload ->> 'source_form_id')::uuid, (payload ->> 'gigantamax_form_id')::uuid
  from public.reference_option_filter_publication_staging
  where batch_id = p_batch_id and publication_id = p_publication_id and row_kind = 'form_gigantamax_option';

  delete from public.reference_form_abilities where publication_id = p_publication_id;
  insert into public.reference_form_abilities (publication_id, form_id, ability_id, slot, is_hidden)
  select p_publication_id, (payload ->> 'form_id')::uuid, (payload ->> 'ability_id')::uuid,
    payload ->> 'slot', (payload ->> 'is_hidden')::boolean
  from public.reference_option_filter_publication_staging
  where batch_id = p_batch_id and publication_id = p_publication_id and row_kind = 'form_ability';

  delete from public.reference_move_learnsets where publication_id = p_publication_id;
  insert into public.reference_move_learnsets (publication_id, species_id, form_id, move_id, learn_method, learn_level, condition_ko)
  select p_publication_id, (staged.payload ->> 'species_id')::uuid,
    nullif(staged.payload ->> 'form_id', '')::uuid, move.id, staged.payload ->> 'learn_method',
    (staged.payload ->> 'learn_level')::smallint, staged.payload ->> 'condition_ko'
  from public.reference_option_filter_publication_staging as staged
  join public.reference_moves as move
    on move.publication_id = p_publication_id and move.identifier = staged.payload ->> 'move_identifier'
  where staged.batch_id = p_batch_id and staged.publication_id = p_publication_id and staged.row_kind = 'learnset';

  delete from public.reference_option_filter_publication_staging
  where batch_id = p_batch_id and publication_id = p_publication_id;
end;
$$;
revoke all on function public.replace_pokemon_option_filter_reference_data(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.replace_pokemon_option_filter_reference_data(uuid, uuid) to service_role;

alter table public.owned_pokemon
  add column tera_type_id uuid references public.reference_tera_types(id) on delete restrict,
  add column has_gigantamax_factor boolean not null default false;

create or replace function private.reconcile_owned_pokemon_battle_options()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_publication_id uuid;
  selected_battle_only boolean;
  choices_changed boolean := tg_op = 'INSERT'
    or new.tera_type_id is distinct from old.tera_type_id
    or new.has_gigantamax_factor is distinct from old.has_gigantamax_factor;
  form_changed boolean := tg_op = 'INSERT'
    or new.species_id is distinct from old.species_id
    or new.form_id is distinct from old.form_id;
begin
  if not form_changed and not choices_changed then return new; end if;
  select id into active_publication_id from public.data_publications where status = 'active';
  if active_publication_id is null then
    if new.tera_type_id is not null or new.has_gigantamax_factor then
      raise invalid_parameter_value using message = '활성 기준데이터 게시본이 없습니다.';
    end if;
    return new;
  end if;
  select form.is_battle_only into selected_battle_only
  from public.reference_forms as form
  join public.reference_species as species on species.id = form.species_id
  where form.id = new.form_id and form.species_id = new.species_id
    and form.publication_id = active_publication_id and species.publication_id = active_publication_id
    and form.is_active and species.is_active;
  if not found then
    -- Legacy direct rows may refer to an unpublished historical form. They have no
    -- battle selection to validate, so preserve them; the public create/correct RPCs
    -- separately require a current playable form.
    if new.tera_type_id is not null or new.has_gigantamax_factor then
      raise invalid_parameter_value using message = '선택한 종과 모습이 활성 게시본에 없습니다.';
    end if;
    return new;
  end if;
  if selected_battle_only then raise invalid_parameter_value using message = 'battle-only 모습은 보유 포켓몬으로 등록할 수 없습니다.'; end if;

  if new.tera_type_id is not null and not exists (
    select 1 from public.reference_form_tera_options
    where publication_id = active_publication_id and form_id = new.form_id and tera_type_id = new.tera_type_id
  ) then
    if choices_changed then raise invalid_parameter_value using message = '선택한 테라타입은 현재 모습에서 허용되지 않습니다.'; end if;
    new.tera_type_id := null;
  end if;
  if new.has_gigantamax_factor and not exists (
    select 1 from public.reference_form_gigantamax_options
    where publication_id = active_publication_id and source_form_id = new.form_id
  ) then
    if choices_changed then raise invalid_parameter_value using message = '현재 모습은 거다이맥스 인자를 가질 수 없습니다.'; end if;
    new.has_gigantamax_factor := false;
  end if;
  return new;
end;
$$;
revoke all on function private.reconcile_owned_pokemon_battle_options() from public, anon, authenticated;
create trigger owned_pokemon_reconcile_battle_options
before insert or update of species_id, form_id, tera_type_id, has_gigantamax_factor on public.owned_pokemon
for each row execute function private.reconcile_owned_pokemon_battle_options();

drop function if exists public.create_owned_pokemon_with_moves(uuid, uuid, text, public.pokemon_gender, smallint, date, uuid, uuid, uuid, jsonb, jsonb, jsonb, uuid, text, jsonb, jsonb);
drop function if exists public.update_owned_pokemon_quick(uuid, text, public.pokemon_gender, smallint, uuid, uuid, jsonb, jsonb, uuid, text);

create function public.create_owned_pokemon_with_moves(
  p_species_id uuid, p_form_id uuid, p_nickname text, p_gender public.pokemon_gender, p_level smallint,
  p_captured_on date, p_original_nature_id uuid, p_effective_nature_id uuid, p_ability_id uuid,
  p_original_iv jsonb, p_effective_iv jsonb, p_ev jsonb, p_held_item_id uuid, p_notes text,
  p_current_moves jsonb, p_target_moves jsonb, p_tera_type_id uuid default null,
  p_has_gigantamax_factor boolean default false
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare owner_id uuid := auth.uid(); active_publication_id uuid; new_pokemon_id uuid; current_count integer; target_count integer;
begin
  if owner_id is null then raise insufficient_privilege using message = '인증된 사용자만 포켓몬을 등록할 수 있습니다.'; end if;
  select id into active_publication_id from public.data_publications where status = 'active';
  if active_publication_id is null then raise invalid_parameter_value using message = '활성 기준데이터 게시본이 없습니다.'; end if;
  if not exists (select 1 from public.reference_forms as form join public.reference_species as species on species.id = form.species_id
    where form.id = p_form_id and form.species_id = p_species_id and form.publication_id = active_publication_id
      and species.publication_id = active_publication_id and form.is_active and species.is_active and not form.is_battle_only) then
    raise invalid_parameter_value using message = '선택한 종과 모습이 활성 게시본에서 등록 가능한 모습과 일치하지 않습니다.';
  end if;
  if coalesce(jsonb_typeof(p_current_moves), 'null') <> 'array' or coalesce(jsonb_typeof(p_target_moves), 'null') <> 'array' then
    raise invalid_parameter_value using message = '기술 선택은 배열로 제공해야 합니다.';
  end if;
  if exists (select 1 from jsonb_array_elements(p_current_moves) as selected(value) where jsonb_typeof(value) <> 'object' or nullif(btrim(value ->> 'move_id'), '') is null)
    or exists (select 1 from jsonb_array_elements(p_target_moves) as selected(value) where jsonb_typeof(value) <> 'object' or nullif(btrim(value ->> 'move_id'), '') is null or nullif(btrim(value ->> 'condition_ko'), '') is null or value ->> 'condition_ko' <> btrim(value ->> 'condition_ko')) then
    raise invalid_parameter_value using message = '기술 선택이 올바르지 않습니다.';
  end if;
  select count(*), count(distinct (value ->> 'move_id')::uuid) into current_count, target_count from jsonb_array_elements(p_current_moves) as selected(value);
  if current_count > 4 or current_count <> target_count then raise invalid_parameter_value using message = '현재 기술은 중복 없이 4개 이하로 선택해야 합니다.'; end if;
  select count(*), count(distinct (value ->> 'move_id')::uuid) into current_count, target_count from jsonb_array_elements(p_target_moves) as selected(value);
  if current_count > 4 or current_count <> target_count then raise invalid_parameter_value using message = '목표 기술은 중복 없이 4개 이하로 선택해야 합니다.'; end if;
  if exists (select 1 from (select (value ->> 'move_id')::uuid as move_id from jsonb_array_elements(p_current_moves) as selected(value) union all select (value ->> 'move_id')::uuid from jsonb_array_elements(p_target_moves) as selected(value)) as selected_moves
    where not exists (select 1 from public.reference_move_learnsets as learnset join public.reference_moves as move on move.id = learnset.move_id
      where learnset.publication_id = active_publication_id and learnset.species_id = p_species_id and learnset.move_id = selected_moves.move_id and move.publication_id = active_publication_id and move.is_active)) then
    raise invalid_parameter_value using message = '선택한 종이 활성 게시본에서 배울 수 없는 기술입니다.';
  end if;
  if exists (select 1 from jsonb_array_elements(p_target_moves) as selected(value) where not exists (select 1 from public.reference_move_learnsets as learnset join public.reference_moves as move on move.id = learnset.move_id
    where learnset.publication_id = active_publication_id and learnset.species_id = p_species_id and learnset.move_id = (selected.value ->> 'move_id')::uuid and learnset.condition_ko = selected.value ->> 'condition_ko' and move.publication_id = active_publication_id and move.is_active)) then
    raise invalid_parameter_value using message = '목표 기술 습득 조건이 활성 게시본과 일치하지 않습니다.';
  end if;
  insert into public.owned_pokemon (user_id, species_id, form_id, nickname, gender, level, captured_on, original_nature_id, effective_nature_id, ability_id, original_iv, effective_iv, ev, held_item_id, notes, tera_type_id, has_gigantamax_factor)
  values (owner_id, p_species_id, p_form_id, p_nickname, p_gender, p_level, p_captured_on, p_original_nature_id, p_effective_nature_id, p_ability_id, p_original_iv, p_effective_iv, p_ev, p_held_item_id, p_notes, p_tera_type_id, p_has_gigantamax_factor)
  returning id into new_pokemon_id;
  insert into public.owned_pokemon_moves (owned_pokemon_id, move_id, kind, slot, target_condition_ko)
  select new_pokemon_id, (value ->> 'move_id')::uuid, 'current'::public.owned_move_kind, slot, '' from jsonb_array_elements(p_current_moves) with ordinality as selected(value, slot);
  insert into public.owned_pokemon_moves (owned_pokemon_id, move_id, kind, slot, target_condition_ko)
  select new_pokemon_id, (value ->> 'move_id')::uuid, 'target'::public.owned_move_kind, slot, value ->> 'condition_ko' from jsonb_array_elements(p_target_moves) with ordinality as selected(value, slot);
  return new_pokemon_id;
end;
$$;
revoke all on function public.create_owned_pokemon_with_moves(uuid, uuid, text, public.pokemon_gender, smallint, date, uuid, uuid, uuid, jsonb, jsonb, jsonb, uuid, text, jsonb, jsonb, uuid, boolean) from public, anon, authenticated;
grant execute on function public.create_owned_pokemon_with_moves(uuid, uuid, text, public.pokemon_gender, smallint, date, uuid, uuid, uuid, jsonb, jsonb, jsonb, uuid, text, jsonb, jsonb, uuid, boolean) to authenticated;

create function public.update_owned_pokemon_quick(
  p_owned_pokemon_id uuid, p_nickname text, p_gender public.pokemon_gender, p_level smallint,
  p_effective_nature_id uuid, p_ability_id uuid, p_effective_iv jsonb, p_ev jsonb, p_held_item_id uuid,
  p_notes text, p_apply_battle_options boolean default false, p_tera_type_id uuid default null,
  p_has_gigantamax_factor boolean default false
) returns public.owned_pokemon
language plpgsql security invoker set search_path = ''
as $$
declare updated public.owned_pokemon;
begin
  update public.owned_pokemon set nickname = p_nickname, gender = p_gender, level = p_level,
    effective_nature_id = p_effective_nature_id, ability_id = p_ability_id, effective_iv = p_effective_iv,
    ev = p_ev, held_item_id = p_held_item_id, notes = p_notes,
    tera_type_id = case when p_apply_battle_options then p_tera_type_id else tera_type_id end,
    has_gigantamax_factor = case when p_apply_battle_options then p_has_gigantamax_factor else has_gigantamax_factor end
  where id = p_owned_pokemon_id and user_id = (select auth.uid()) returning * into updated;
  if updated.id is null then raise insufficient_privilege using message = '빠르게 수정할 포켓몬을 찾을 수 없습니다.'; end if;
  return updated;
end;
$$;
revoke all on function public.update_owned_pokemon_quick(uuid, text, public.pokemon_gender, smallint, uuid, uuid, jsonb, jsonb, uuid, text, boolean, uuid, boolean) from public, anon, authenticated;
grant execute on function public.update_owned_pokemon_quick(uuid, text, public.pokemon_gender, smallint, uuid, uuid, jsonb, jsonb, uuid, text, boolean, uuid, boolean) to authenticated;

create or replace function public.correct_owned_pokemon(
  p_owned_pokemon_id uuid, p_species_id uuid, p_form_id uuid, p_captured_on date, p_original_iv jsonb, p_reason_ko text
) returns public.owned_pokemon
language plpgsql volatile security invoker set search_path = ''
as $$
declare owner_id uuid := auth.uid(); current_pokemon public.owned_pokemon; corrected public.owned_pokemon; next_ability_id uuid; before_moves jsonb;
begin
  if owner_id is null then raise insufficient_privilege using message = '인증된 사용자만 보호 정보를 정정할 수 있습니다.'; end if;
  if char_length(btrim(coalesce(p_reason_ko, ''))) < 5 then raise check_violation using message = '정정 사유는 5자 이상이어야 합니다.'; end if;
  select * into current_pokemon from public.owned_pokemon where id = p_owned_pokemon_id and user_id = owner_id for update;
  if not found then raise insufficient_privilege using message = '정정할 포켓몬을 찾을 수 없습니다.'; end if;
  if not exists (
    select 1 from public.reference_forms as form
    join public.reference_species as species on species.id = form.species_id
    join public.data_publications as publication on publication.id = form.publication_id
    where form.id = p_form_id and form.species_id = p_species_id
      and form.is_active and species.is_active and publication.status = 'active'
      and not form.is_battle_only
  ) then
    raise invalid_parameter_value using message = '정정할 종과 모습이 활성 게시본의 등록 가능한 모습과 일치하지 않습니다.';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('move_id', move_id, 'kind', kind, 'slot', slot, 'target_condition_ko', target_condition_ko) order by kind, slot), '[]'::jsonb) into before_moves from public.owned_pokemon_moves where owned_pokemon_id = current_pokemon.id;
  if p_species_id <> current_pokemon.species_id then delete from public.owned_pokemon_moves where owned_pokemon_id = current_pokemon.id; end if;
  next_ability_id := current_pokemon.ability_id;
  if p_species_id <> current_pokemon.species_id or (p_form_id <> current_pokemon.form_id and not exists (select 1 from public.reference_form_abilities where form_id = p_form_id and ability_id = next_ability_id)) then next_ability_id := null; end if;
  perform set_config('app.owned_pokemon_correction_reason', btrim(p_reason_ko), true);
  perform set_config('app.owned_pokemon_correction_before_data', (to_jsonb(current_pokemon) || jsonb_build_object('dependent_state', jsonb_build_object('ability_id', current_pokemon.ability_id, 'moves', before_moves)))::text, true);
  update public.owned_pokemon set species_id = p_species_id, form_id = p_form_id, captured_on = p_captured_on, original_iv = p_original_iv, ability_id = next_ability_id
  where id = p_owned_pokemon_id and user_id = owner_id returning * into corrected;
  return corrected;
end;
$$;
revoke all on function public.correct_owned_pokemon(uuid, uuid, uuid, date, jsonb, text) from public, anon, authenticated;
grant execute on function public.correct_owned_pokemon(uuid, uuid, uuid, date, jsonb, text) to authenticated;
