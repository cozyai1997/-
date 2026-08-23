create function public.create_owned_pokemon_with_moves(
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

  select form.base_form_id
  into selected_base_form_id
  from public.reference_forms as form
  where form.id = p_form_id
    and form.species_id = p_species_id;

  if not found then
    raise invalid_parameter_value using message = '선택한 종과 모습이 일치하지 않습니다.';
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
      where form_id = p_form_id
    ) then
      if not exists (
        select 1
        from public.reference_form_abilities
        where form_id = p_form_id
          and ability_id = p_ability_id
      ) then
        raise invalid_parameter_value using message = '선택한 모습이 배울 수 없는 특성입니다.';
      end if;
    elsif selected_base_form_id is null or not exists (
      select 1
      from public.reference_form_abilities
      where form_id = selected_base_form_id
        and ability_id = p_ability_id
    ) then
      raise invalid_parameter_value using message = '선택한 모습이 배울 수 없는 특성입니다.';
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
      where learnset.species_id = p_species_id
        and learnset.move_id = selected_moves.move_id
    )
  ) then
    raise invalid_parameter_value using message = '선택한 종이 배울 수 없는 기술입니다.';
  end if;

  insert into public.owned_pokemon (
    user_id,
    species_id,
    form_id,
    nickname,
    gender,
    level,
    captured_on,
    original_nature_id,
    effective_nature_id,
    ability_id,
    original_iv,
    effective_iv,
    ev,
    held_item_id,
    notes
  ) values (
    owner_id,
    p_species_id,
    p_form_id,
    p_nickname,
    p_gender,
    p_level,
    p_captured_on,
    p_original_nature_id,
    p_effective_nature_id,
    p_ability_id,
    p_original_iv,
    p_effective_iv,
    p_ev,
    p_held_item_id,
    p_notes
  )
  returning id into new_pokemon_id;

  insert into public.owned_pokemon_moves (
    owned_pokemon_id,
    move_id,
    kind,
    slot,
    target_condition_ko
  )
  select new_pokemon_id,
    (selected.value ->> 'move_id')::uuid,
    'current'::public.owned_move_kind,
    selected.slot,
    ''
  from jsonb_array_elements(p_current_moves) with ordinality as selected(value, slot);

  insert into public.owned_pokemon_moves (
    owned_pokemon_id,
    move_id,
    kind,
    slot,
    target_condition_ko
  )
  select new_pokemon_id,
    (selected.value ->> 'move_id')::uuid,
    'target'::public.owned_move_kind,
    selected.slot,
    btrim(selected.value ->> 'condition_ko')
  from jsonb_array_elements(p_target_moves) with ordinality as selected(value, slot);

  return new_pokemon_id;
end;
$$;

revoke all on function public.create_owned_pokemon_with_moves(
  uuid,
  uuid,
  text,
  public.pokemon_gender,
  smallint,
  date,
  uuid,
  uuid,
  uuid,
  jsonb,
  jsonb,
  jsonb,
  uuid,
  text,
  jsonb,
  jsonb
) from public, anon, authenticated;

grant execute on function public.create_owned_pokemon_with_moves(
  uuid,
  uuid,
  text,
  public.pokemon_gender,
  smallint,
  date,
  uuid,
  uuid,
  uuid,
  jsonb,
  jsonb,
  jsonb,
  uuid,
  text,
  jsonb,
  jsonb
) to authenticated;
