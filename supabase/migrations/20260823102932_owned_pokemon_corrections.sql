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
begin
  if tg_op = 'DELETE' then
    owner_id := old.user_id;
    record_id := old.id;
  else
    owner_id := new.user_id;
    record_id := new.id;
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
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    correction_reason
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.audit_owned_pokemon_change() from public, anon, authenticated;

create function public.correct_owned_pokemon(
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
  corrected public.owned_pokemon;
begin
  if char_length(btrim(coalesce(p_reason_ko, ''))) < 5 then
    raise exception '정정 사유는 5자 이상이어야 합니다.' using errcode = 'check_violation';
  end if;

  perform set_config(
    'app.owned_pokemon_correction_reason',
    btrim(p_reason_ko),
    true
  );

  update public.owned_pokemon
  set
    species_id = p_species_id,
    form_id = p_form_id,
    captured_on = p_captured_on,
    original_iv = p_original_iv
  where id = p_owned_pokemon_id
    and user_id = (select auth.uid())
  returning * into corrected;

  if corrected.id is null then
    raise exception '정정할 포켓몬을 찾을 수 없습니다.' using errcode = 'insufficient_privilege';
  end if;

  return corrected;
end;
$$;

revoke all on function public.correct_owned_pokemon(uuid, uuid, uuid, date, jsonb, text)
from public, anon;
grant execute on function public.correct_owned_pokemon(uuid, uuid, uuid, date, jsonb, text)
to authenticated, service_role;
