alter table public.reference_option_filter_publication_staging
  drop constraint reference_option_filter_publication_staging_row_kind_check,
  add constraint reference_option_filter_publication_staging_row_kind_check
    check (row_kind in ('move', 'form_base_link', 'form_ability', 'learnset'));

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
  staged_form_base_links integer;
  staged_form_abilities integer;
  staged_learnsets integer;
  applied_form_base_links integer;
begin
  if not exists (
    select 1
    from public.data_publications
    where id = p_publication_id
      and status = 'active'
  ) then
    raise invalid_parameter_value using message = 'target publication must be active';
  end if;

  select
    count(*) filter (where row_kind = 'move'),
    count(*) filter (where row_kind = 'form_base_link'),
    count(*) filter (where row_kind = 'form_ability'),
    count(*) filter (where row_kind = 'learnset')
  into
    staged_moves,
    staged_form_base_links,
    staged_form_abilities,
    staged_learnsets
  from public.reference_option_filter_publication_staging
  where batch_id = p_batch_id
    and publication_id = p_publication_id;

  if staged_moves <> 826
    or staged_form_base_links <> 1498
    or staged_form_abilities <> 3055
    or staged_learnsets <> 116519
  then
    raise exception
      'staged option filter row count mismatch: moves=%, form_base_links=%, form_abilities=%, learnsets=%',
      staged_moves, staged_form_base_links, staged_form_abilities, staged_learnsets;
  end if;

  if (
    select count(distinct payload ->> 'identifier')
    from public.reference_option_filter_publication_staging
    where batch_id = p_batch_id
      and publication_id = p_publication_id
      and row_kind = 'move'
  ) <> 826 then
    raise invalid_parameter_value using message = 'staged move identifiers must be unique';
  end if;

  if exists (
    select 1
    from public.reference_option_filter_publication_staging as staged
    left join public.reference_types as move_type
      on move_type.id = (staged.payload ->> 'type_id')::uuid
      and move_type.publication_id = p_publication_id
      and move_type.is_active
    where staged.batch_id = p_batch_id
      and staged.publication_id = p_publication_id
      and staged.row_kind = 'move'
      and move_type.id is null
  ) then
    raise invalid_parameter_value using message = 'staged move type must belong to the active publication';
  end if;

  if exists (
    select 1
    from public.reference_option_filter_publication_staging as staged
    left join public.reference_forms as target_form
      on target_form.id = (staged.payload ->> 'form_id')::uuid
      and target_form.publication_id = p_publication_id
    left join public.reference_forms as base_form
      on base_form.id = nullif(staged.payload ->> 'base_form_id', '')::uuid
      and base_form.publication_id = p_publication_id
    where staged.batch_id = p_batch_id
      and staged.publication_id = p_publication_id
      and staged.row_kind = 'form_base_link'
      and (
        target_form.id is null
        or (
          nullif(staged.payload ->> 'base_form_id', '') is not null
          and (base_form.id is null or base_form.species_id <> target_form.species_id)
        )
      )
  ) then
    raise invalid_parameter_value using message = 'staged base form link is invalid';
  end if;

  if exists (
    select 1
    from public.reference_option_filter_publication_staging as staged
    left join public.reference_forms as target_form
      on target_form.id = (staged.payload ->> 'form_id')::uuid
      and target_form.publication_id = p_publication_id
    left join public.reference_abilities as ability
      on ability.id = (staged.payload ->> 'ability_id')::uuid
      and ability.publication_id = p_publication_id
      and ability.is_active
    where staged.batch_id = p_batch_id
      and staged.publication_id = p_publication_id
      and staged.row_kind = 'form_ability'
      and (target_form.id is null or ability.id is null)
  ) then
    raise invalid_parameter_value using message = 'staged form ability reference is invalid';
  end if;

  if exists (
    select 1
    from public.reference_option_filter_publication_staging as staged
    left join public.reference_species as species
      on species.id = (staged.payload ->> 'species_id')::uuid
      and species.publication_id = p_publication_id
      and species.is_active
    left join public.reference_forms as target_form
      on target_form.id = nullif(staged.payload ->> 'form_id', '')::uuid
      and target_form.publication_id = p_publication_id
    where staged.batch_id = p_batch_id
      and staged.publication_id = p_publication_id
      and staged.row_kind = 'learnset'
      and (
        species.id is null
        or (
          nullif(staged.payload ->> 'form_id', '') is not null
          and (target_form.id is null or target_form.species_id <> species.id)
        )
        or not exists (
          select 1
          from public.reference_option_filter_publication_staging as staged_move
          where staged_move.batch_id = p_batch_id
            and staged_move.publication_id = p_publication_id
            and staged_move.row_kind = 'move'
            and staged_move.payload ->> 'identifier' = staged.payload ->> 'move_identifier'
        )
      )
  ) then
    raise invalid_parameter_value using message = 'staged learnset reference is invalid';
  end if;

  insert into public.reference_moves (
    publication_id,
    identifier,
    name_ko,
    description_ko,
    type_id,
    damage_class,
    power,
    accuracy,
    pp,
    is_active
  )
  select
    p_publication_id,
    staged.payload ->> 'identifier',
    staged.payload ->> 'name_ko',
    staged.payload ->> 'description_ko',
    (staged.payload ->> 'type_id')::uuid,
    staged.payload ->> 'damage_class',
    (staged.payload ->> 'power')::smallint,
    (staged.payload ->> 'accuracy')::smallint,
    (staged.payload ->> 'pp')::smallint,
    (staged.payload ->> 'is_active')::boolean
  from public.reference_option_filter_publication_staging as staged
  where staged.batch_id = p_batch_id
    and staged.publication_id = p_publication_id
    and staged.row_kind = 'move'
  order by staged.source_order
  on conflict (identifier) do update
  set
    publication_id = excluded.publication_id,
    name_ko = excluded.name_ko,
    description_ko = excluded.description_ko,
    type_id = excluded.type_id,
    damage_class = excluded.damage_class,
    power = excluded.power,
    accuracy = excluded.accuracy,
    pp = excluded.pp,
    is_active = excluded.is_active;

  update public.reference_forms as target_form
  set base_form_id = nullif(staged.payload ->> 'base_form_id', '')::uuid
  from public.reference_option_filter_publication_staging as staged
  where staged.batch_id = p_batch_id
    and staged.publication_id = p_publication_id
    and staged.row_kind = 'form_base_link'
    and target_form.id = (staged.payload ->> 'form_id')::uuid
    and target_form.publication_id = p_publication_id;

  get diagnostics applied_form_base_links = row_count;
  if applied_form_base_links <> 1498 then
    raise exception 'form base link update count mismatch: %', applied_form_base_links;
  end if;

  delete from public.reference_form_abilities
  where publication_id = p_publication_id;

  insert into public.reference_form_abilities (
    publication_id, form_id, ability_id, slot, is_hidden
  )
  select
    p_publication_id,
    (staged.payload ->> 'form_id')::uuid,
    (staged.payload ->> 'ability_id')::uuid,
    staged.payload ->> 'slot',
    (staged.payload ->> 'is_hidden')::boolean
  from public.reference_option_filter_publication_staging as staged
  where staged.batch_id = p_batch_id
    and staged.publication_id = p_publication_id
    and staged.row_kind = 'form_ability'
  order by staged.source_order;

  delete from public.reference_move_learnsets
  where publication_id = p_publication_id;

  insert into public.reference_move_learnsets (
    publication_id,
    species_id,
    form_id,
    move_id,
    learn_method,
    learn_level,
    condition_ko
  )
  select
    p_publication_id,
    (staged.payload ->> 'species_id')::uuid,
    nullif(staged.payload ->> 'form_id', '')::uuid,
    move.id,
    staged.payload ->> 'learn_method',
    (staged.payload ->> 'learn_level')::smallint,
    staged.payload ->> 'condition_ko'
  from public.reference_option_filter_publication_staging as staged
  join public.reference_moves as move
    on move.identifier = staged.payload ->> 'move_identifier'
    and move.publication_id = p_publication_id
  where staged.batch_id = p_batch_id
    and staged.publication_id = p_publication_id
    and staged.row_kind = 'learnset'
  order by staged.source_order;

  delete from public.reference_option_filter_publication_staging
  where batch_id = p_batch_id
    and publication_id = p_publication_id;
end;
$$;

revoke all on function public.replace_pokemon_option_filter_reference_data(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.replace_pokemon_option_filter_reference_data(uuid, uuid)
  to service_role;

create or replace function private.validate_owned_pokemon_ability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_publication_id uuid;
  selected_base_form_id uuid;
begin
  if tg_op = 'UPDATE'
    and new.species_id is not distinct from old.species_id
    and new.form_id is not distinct from old.form_id
    and new.ability_id is not distinct from old.ability_id
  then
    return new;
  end if;

  if new.ability_id is null then
    return new;
  end if;

  select id into active_publication_id
  from public.data_publications
  where status = 'active';

  if active_publication_id is null then
    raise invalid_parameter_value using message = '활성 기준데이터 게시본이 없습니다.';
  end if;

  select form.base_form_id
  into selected_base_form_id
  from public.reference_forms as form
  join public.reference_species as species on species.id = form.species_id
  where form.id = new.form_id
    and form.species_id = new.species_id
    and form.publication_id = active_publication_id
    and species.publication_id = active_publication_id
    and form.is_active
    and species.is_active;

  if not found then
    raise invalid_parameter_value using message = '선택한 종과 모습이 활성 게시본에 없습니다.';
  end if;

  if exists (
    select 1
    from public.reference_form_abilities
    where publication_id = active_publication_id
      and form_id = new.form_id
  ) then
    if not exists (
      select 1
      from public.reference_form_abilities as relation
      join public.reference_abilities as ability on ability.id = relation.ability_id
      where relation.publication_id = active_publication_id
        and relation.form_id = new.form_id
        and relation.ability_id = new.ability_id
        and ability.publication_id = active_publication_id
        and ability.is_active
    ) then
      raise invalid_parameter_value using message = '선택한 모습에서 사용할 수 없는 특성입니다.';
    end if;
  elsif selected_base_form_id is null or not exists (
    select 1
    from public.reference_form_abilities as relation
    join public.reference_abilities as ability on ability.id = relation.ability_id
    where relation.publication_id = active_publication_id
      and relation.form_id = selected_base_form_id
      and relation.ability_id = new.ability_id
      and ability.publication_id = active_publication_id
      and ability.is_active
  ) then
    raise invalid_parameter_value using message = '선택한 모습에서 사용할 수 없는 특성입니다.';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_owned_pokemon_ability()
  from public, anon, authenticated;

drop trigger if exists owned_pokemon_validate_ability on public.owned_pokemon;
create trigger owned_pokemon_validate_ability
before insert or update of species_id, form_id, ability_id on public.owned_pokemon
for each row execute function private.validate_owned_pokemon_ability();

create or replace function public.create_owned_pokemon_with_moves(
  p_species_id uuid,
  p_form_id uuid,
  p_nickname text,
  p_gender public.pokemon_gender,
  p_level smallint,
  p_captured_on date,
  p_original_nature_id uuid,
  p_effective_nature_id uuid,
  p_ability_id uuid,
  p_original_iv jsonb,
  p_effective_iv jsonb,
  p_ev jsonb,
  p_held_item_id uuid,
  p_notes text,
  p_current_moves jsonb,
  p_target_moves jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  active_publication_id uuid;
  new_pokemon_id uuid;
  selected_base_form_id uuid;
  current_count integer;
  current_distinct_count integer;
  target_count integer;
  target_distinct_count integer;
begin
  if owner_id is null then
    raise insufficient_privilege using message = '인증된 사용자만 포켓몬을 등록할 수 있습니다.';
  end if;

  select id into active_publication_id
  from public.data_publications
  where status = 'active';
  if active_publication_id is null then
    raise invalid_parameter_value using message = '활성 기준데이터 게시본이 없습니다.';
  end if;

  select form.base_form_id
  into selected_base_form_id
  from public.reference_forms as form
  join public.reference_species as species on species.id = form.species_id
  where form.id = p_form_id
    and form.species_id = p_species_id
    and form.publication_id = active_publication_id
    and species.publication_id = active_publication_id
    and form.is_active
    and species.is_active;

  if not found then
    raise invalid_parameter_value using message = '선택한 종과 모습이 활성 게시본에서 일치하지 않습니다.';
  end if;

  if coalesce(jsonb_typeof(p_current_moves), 'null') <> 'array'
    or coalesce(jsonb_typeof(p_target_moves), 'null') <> 'array' then
    raise invalid_parameter_value using message = '기술 선택은 배열로 제공해야 합니다.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_current_moves) as selected(value)
    where jsonb_typeof(selected.value) <> 'object'
      or nullif(btrim(selected.value ->> 'move_id'), '') is null
  ) then
    raise invalid_parameter_value using message = '현재 기술 ID가 올바르지 않습니다.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_target_moves) as selected(value)
    where jsonb_typeof(selected.value) <> 'object'
      or nullif(btrim(selected.value ->> 'move_id'), '') is null
      or nullif(btrim(selected.value ->> 'condition_ko'), '') is null
      or selected.value ->> 'condition_ko' <> btrim(selected.value ->> 'condition_ko')
  ) then
    raise invalid_parameter_value using message = '목표 기술 ID와 습득 조건이 올바르지 않습니다.';
  end if;

  select count(*), count(distinct (selected.value ->> 'move_id')::uuid)
  into current_count, current_distinct_count
  from jsonb_array_elements(p_current_moves) as selected(value);

  select count(*), count(distinct (selected.value ->> 'move_id')::uuid)
  into target_count, target_distinct_count
  from jsonb_array_elements(p_target_moves) as selected(value);

  if current_count > 4 or current_count <> current_distinct_count then
    raise invalid_parameter_value using message = '현재 기술은 중복 없이 4개 이하로 선택해야 합니다.';
  end if;
  if target_count > 4 or target_count <> target_distinct_count then
    raise invalid_parameter_value using message = '목표 기술은 중복 없이 4개 이하로 선택해야 합니다.';
  end if;

  if p_ability_id is not null then
    if exists (
      select 1
      from public.reference_form_abilities
      where publication_id = active_publication_id
        and form_id = p_form_id
    ) then
      if not exists (
        select 1
        from public.reference_form_abilities as relation
        join public.reference_abilities as ability on ability.id = relation.ability_id
        where relation.publication_id = active_publication_id
          and relation.form_id = p_form_id
          and relation.ability_id = p_ability_id
          and ability.publication_id = active_publication_id
          and ability.is_active
      ) then
        raise invalid_parameter_value using message = '선택한 모습이 사용할 수 없는 특성입니다.';
      end if;
    elsif selected_base_form_id is null or not exists (
      select 1
      from public.reference_form_abilities as relation
      join public.reference_abilities as ability on ability.id = relation.ability_id
      where relation.publication_id = active_publication_id
        and relation.form_id = selected_base_form_id
        and relation.ability_id = p_ability_id
        and ability.publication_id = active_publication_id
        and ability.is_active
    ) then
      raise invalid_parameter_value using message = '선택한 모습이 사용할 수 없는 특성입니다.';
    end if;
  end if;

  if exists (
    select 1
    from (
      select (selected.value ->> 'move_id')::uuid as move_id
      from jsonb_array_elements(p_current_moves) as selected(value)
      union all
      select (selected.value ->> 'move_id')::uuid as move_id
      from jsonb_array_elements(p_target_moves) as selected(value)
    ) as selected_moves
    where not exists (
      select 1
      from public.reference_move_learnsets as learnset
      join public.reference_moves as move on move.id = learnset.move_id
      where learnset.publication_id = active_publication_id
        and learnset.species_id = p_species_id
        and learnset.move_id = selected_moves.move_id
        and move.publication_id = active_publication_id
        and move.is_active
    )
  ) then
    raise invalid_parameter_value using message = '선택한 종이 활성 게시본에서 배울 수 없는 기술입니다.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_target_moves) as selected(value)
    where not exists (
      select 1
      from public.reference_move_learnsets as learnset
      join public.reference_moves as move on move.id = learnset.move_id
      where learnset.publication_id = active_publication_id
        and learnset.species_id = p_species_id
        and learnset.move_id = (selected.value ->> 'move_id')::uuid
        and learnset.condition_ko = selected.value ->> 'condition_ko'
        and move.publication_id = active_publication_id
        and move.is_active
    )
  ) then
    raise invalid_parameter_value using message = '목표 기술 습득 조건이 활성 게시본과 일치하지 않습니다.';
  end if;

  insert into public.owned_pokemon (
    user_id, species_id, form_id, nickname, gender, level, captured_on,
    original_nature_id, effective_nature_id, ability_id, original_iv,
    effective_iv, ev, held_item_id, notes
  ) values (
    owner_id, p_species_id, p_form_id, p_nickname, p_gender, p_level, p_captured_on,
    p_original_nature_id, p_effective_nature_id, p_ability_id, p_original_iv,
    p_effective_iv, p_ev, p_held_item_id, p_notes
  )
  returning id into new_pokemon_id;

  insert into public.owned_pokemon_moves (
    owned_pokemon_id, move_id, kind, slot, target_condition_ko
  )
  select new_pokemon_id,
    (selected.value ->> 'move_id')::uuid,
    'current'::public.owned_move_kind,
    selected.slot,
    ''
  from jsonb_array_elements(p_current_moves) with ordinality as selected(value, slot);

  insert into public.owned_pokemon_moves (
    owned_pokemon_id, move_id, kind, slot, target_condition_ko
  )
  select new_pokemon_id,
    (selected.value ->> 'move_id')::uuid,
    'target'::public.owned_move_kind,
    selected.slot,
    selected.value ->> 'condition_ko'
  from jsonb_array_elements(p_target_moves) with ordinality as selected(value, slot);

  return new_pokemon_id;
end;
$$;

revoke all on function public.create_owned_pokemon_with_moves(
  uuid, uuid, text, public.pokemon_gender, smallint, date, uuid, uuid, uuid,
  jsonb, jsonb, jsonb, uuid, text, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.create_owned_pokemon_with_moves(
  uuid, uuid, text, public.pokemon_gender, smallint, date, uuid, uuid, uuid,
  jsonb, jsonb, jsonb, uuid, text, jsonb, jsonb
) to authenticated;

create function public.update_owned_pokemon_quick(
  p_owned_pokemon_id uuid,
  p_nickname text,
  p_gender public.pokemon_gender,
  p_level smallint,
  p_effective_nature_id uuid,
  p_ability_id uuid,
  p_effective_iv jsonb,
  p_ev jsonb,
  p_held_item_id uuid,
  p_notes text
)
returns public.owned_pokemon
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  active_publication_id uuid;
  selected public.owned_pokemon;
  selected_base_form_id uuid;
  updated public.owned_pokemon;
begin
  if owner_id is null then
    raise insufficient_privilege using message = '인증된 사용자만 빠른 수정을 할 수 있습니다.';
  end if;

  select * into selected
  from public.owned_pokemon
  where id = p_owned_pokemon_id
    and user_id = owner_id
  for update;
  if not found then
    raise insufficient_privilege using message = '빠르게 수정할 포켓몬을 찾을 수 없습니다.';
  end if;

  select id into active_publication_id
  from public.data_publications
  where status = 'active';
  if active_publication_id is null then
    raise invalid_parameter_value using message = '활성 기준데이터 게시본이 없습니다.';
  end if;

  select form.base_form_id
  into selected_base_form_id
  from public.reference_forms as form
  join public.reference_species as species on species.id = form.species_id
  where form.id = selected.form_id
    and form.species_id = selected.species_id
    and form.publication_id = active_publication_id
    and species.publication_id = active_publication_id
    and form.is_active
    and species.is_active;
  if not found then
    raise invalid_parameter_value using message = '보유 포켓몬의 종과 모습이 활성 게시본에 없습니다.';
  end if;

  if p_ability_id is not null then
    if exists (
      select 1
      from public.reference_form_abilities
      where publication_id = active_publication_id
        and form_id = selected.form_id
    ) then
      if not exists (
        select 1
        from public.reference_form_abilities as relation
        join public.reference_abilities as ability on ability.id = relation.ability_id
        where relation.publication_id = active_publication_id
          and relation.form_id = selected.form_id
          and relation.ability_id = p_ability_id
          and ability.publication_id = active_publication_id
          and ability.is_active
      ) then
        raise invalid_parameter_value using message = '현재 모습에서 사용할 수 없는 특성입니다.';
      end if;
    elsif selected_base_form_id is null or not exists (
      select 1
      from public.reference_form_abilities as relation
      join public.reference_abilities as ability on ability.id = relation.ability_id
      where relation.publication_id = active_publication_id
        and relation.form_id = selected_base_form_id
        and relation.ability_id = p_ability_id
        and ability.publication_id = active_publication_id
        and ability.is_active
    ) then
      raise invalid_parameter_value using message = '현재 모습에서 사용할 수 없는 특성입니다.';
    end if;
  end if;

  update public.owned_pokemon
  set
    nickname = p_nickname,
    gender = p_gender,
    level = p_level,
    effective_nature_id = p_effective_nature_id,
    ability_id = p_ability_id,
    effective_iv = p_effective_iv,
    ev = p_ev,
    held_item_id = p_held_item_id,
    notes = p_notes
  where id = p_owned_pokemon_id
    and user_id = owner_id
  returning * into updated;

  return updated;
end;
$$;

revoke all on function public.update_owned_pokemon_quick(
  uuid, text, public.pokemon_gender, smallint, uuid, uuid, jsonb, jsonb, uuid, text
) from public, anon, authenticated;
grant execute on function public.update_owned_pokemon_quick(
  uuid, text, public.pokemon_gender, smallint, uuid, uuid, jsonb, jsonb, uuid, text
) to authenticated;

create or replace function private.audit_owned_pokemon_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  record_id uuid;
  correction_reason text := nullif(
    current_setting('app.owned_pokemon_correction_reason', true),
    ''
  );
  correction_before jsonb;
  dependent_moves jsonb;
  audit_before jsonb;
  audit_after jsonb;
begin
  if tg_op = 'DELETE' then
    owner_id := old.user_id;
    record_id := old.id;
  else
    owner_id := new.user_id;
    record_id := new.id;
  end if;

  if tg_op = 'UPDATE' and correction_reason is not null then
    correction_before := nullif(
      current_setting('app.owned_pokemon_correction_before_data', true),
      ''
    )::jsonb;
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'move_id', move.move_id,
          'kind', move.kind,
          'slot', move.slot,
          'target_condition_ko', move.target_condition_ko
        ) order by move.kind, move.slot
      ),
      '[]'::jsonb
    )
    into dependent_moves
    from public.owned_pokemon_moves as move
    where move.owned_pokemon_id = new.id;

    audit_before := coalesce(correction_before, to_jsonb(old));
    audit_after := to_jsonb(new) || jsonb_build_object(
      'dependent_state', jsonb_build_object(
        'ability_id', new.ability_id,
        'moves', dependent_moves
      )
    );
  else
    audit_before := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
    audit_after := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  end if;

  insert into public.audit_events (
    user_id,
    entity_type,
    entity_id,
    action,
    before_data,
    after_data,
    reason_ko
  ) values (
    owner_id,
    'owned_pokemon',
    record_id,
    case
      when tg_op = 'UPDATE' and correction_reason is not null then 'correct'
      else lower(tg_op)
    end,
    audit_before,
    audit_after,
    correction_reason
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.audit_owned_pokemon_change()
  from public, anon, authenticated;

create or replace function public.correct_owned_pokemon(
  p_owned_pokemon_id uuid,
  p_species_id uuid,
  p_form_id uuid,
  p_captured_on date,
  p_original_iv jsonb,
  p_reason_ko text
)
returns public.owned_pokemon
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  active_publication_id uuid;
  current_pokemon public.owned_pokemon;
  corrected public.owned_pokemon;
  selected_base_form_id uuid;
  next_ability_id uuid;
  species_changed boolean;
  form_changed boolean;
  before_moves jsonb;
  correction_before jsonb;
begin
  if owner_id is null then
    raise insufficient_privilege using message = '인증된 사용자만 보호 정보를 정정할 수 있습니다.';
  end if;
  if char_length(btrim(coalesce(p_reason_ko, ''))) < 5 then
    raise check_violation using message = '정정 사유는 5자 이상이어야 합니다.';
  end if;

  select * into current_pokemon
  from public.owned_pokemon
  where id = p_owned_pokemon_id
    and user_id = owner_id
  for update;
  if not found then
    raise insufficient_privilege using message = '정정할 포켓몬을 찾을 수 없습니다.';
  end if;

  select id into active_publication_id
  from public.data_publications
  where status = 'active';
  if active_publication_id is null then
    raise invalid_parameter_value using message = '활성 기준데이터 게시본이 없습니다.';
  end if;

  select form.base_form_id
  into selected_base_form_id
  from public.reference_forms as form
  join public.reference_species as species on species.id = form.species_id
  where form.id = p_form_id
    and form.species_id = p_species_id
    and form.publication_id = active_publication_id
    and species.publication_id = active_publication_id
    and form.is_active
    and species.is_active;
  if not found then
    raise invalid_parameter_value using message = '정정할 종과 모습이 활성 게시본에서 일치하지 않습니다.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'move_id', move.move_id,
        'kind', move.kind,
        'slot', move.slot,
        'target_condition_ko', move.target_condition_ko
      ) order by move.kind, move.slot
    ),
    '[]'::jsonb
  )
  into before_moves
  from public.owned_pokemon_moves as move
  where move.owned_pokemon_id = current_pokemon.id;

  correction_before := to_jsonb(current_pokemon) || jsonb_build_object(
    'dependent_state', jsonb_build_object(
      'ability_id', current_pokemon.ability_id,
      'moves', before_moves
    )
  );

  species_changed := p_species_id <> current_pokemon.species_id;
  form_changed := p_form_id <> current_pokemon.form_id;
  next_ability_id := current_pokemon.ability_id;

  if species_changed then
    next_ability_id := null;
    delete from public.owned_pokemon_moves
    where owned_pokemon_id = current_pokemon.id;
  elsif form_changed and next_ability_id is not null then
    if exists (
      select 1
      from public.reference_form_abilities
      where publication_id = active_publication_id
        and form_id = p_form_id
    ) then
      if not exists (
        select 1
        from public.reference_form_abilities as relation
        join public.reference_abilities as ability on ability.id = relation.ability_id
        where relation.publication_id = active_publication_id
          and relation.form_id = p_form_id
          and relation.ability_id = next_ability_id
          and ability.publication_id = active_publication_id
          and ability.is_active
      ) then
        next_ability_id := null;
      end if;
    elsif selected_base_form_id is null or not exists (
      select 1
      from public.reference_form_abilities as relation
      join public.reference_abilities as ability on ability.id = relation.ability_id
      where relation.publication_id = active_publication_id
        and relation.form_id = selected_base_form_id
        and relation.ability_id = next_ability_id
        and ability.publication_id = active_publication_id
        and ability.is_active
    ) then
      next_ability_id := null;
    end if;
  end if;

  perform set_config(
    'app.owned_pokemon_correction_reason',
    btrim(p_reason_ko),
    true
  );
  perform set_config(
    'app.owned_pokemon_correction_before_data',
    correction_before::text,
    true
  );

  update public.owned_pokemon
  set
    species_id = p_species_id,
    form_id = p_form_id,
    captured_on = p_captured_on,
    original_iv = p_original_iv,
    ability_id = next_ability_id
  where id = p_owned_pokemon_id
    and user_id = owner_id
  returning * into corrected;

  return corrected;
end;
$$;

revoke all on function public.correct_owned_pokemon(uuid, uuid, uuid, date, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.correct_owned_pokemon(uuid, uuid, uuid, date, jsonb, text)
  to authenticated;
