alter table public.reference_move_learnsets
  drop constraint reference_move_learnsets_learn_level_check,
  add constraint reference_move_learnsets_learn_level_check
    check (learn_level is null or learn_level between 0 and 100);

create table public.reference_option_filter_publication_staging (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  publication_id uuid not null references public.data_publications(id) on delete cascade,
  row_kind text not null check (row_kind in ('form_ability', 'learnset')),
  source_order integer not null check (source_order >= 0),
  payload jsonb not null,
  unique (batch_id, row_kind, source_order)
);

create index reference_option_filter_staging_batch_idx
  on public.reference_option_filter_publication_staging (batch_id, row_kind, source_order);
create index reference_option_filter_staging_publication_idx
  on public.reference_option_filter_publication_staging (publication_id);

grant all privileges on table public.reference_option_filter_publication_staging to service_role;

alter table public.reference_option_filter_publication_staging enable row level security;

create function public.replace_pokemon_option_filter_reference_data(
  p_publication_id uuid,
  p_batch_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  staged_form_abilities integer;
  staged_learnsets integer;
begin
  select count(*) into staged_form_abilities
  from public.reference_option_filter_publication_staging
  where batch_id = p_batch_id
    and publication_id = p_publication_id
    and row_kind = 'form_ability';

  select count(*) into staged_learnsets
  from public.reference_option_filter_publication_staging
  where batch_id = p_batch_id
    and publication_id = p_publication_id
    and row_kind = 'learnset';

  if staged_form_abilities <> 3055 or staged_learnsets <> 116519 then
    raise exception 'staged option filter row count mismatch: form_abilities=%, learnsets=%',
      staged_form_abilities, staged_learnsets;
  end if;

  delete from public.reference_form_abilities
  where publication_id = p_publication_id;

  insert into public.reference_form_abilities (
    publication_id, form_id, ability_id, slot, is_hidden
  )
  select p_publication_id,
    (payload ->> 'form_id')::uuid,
    (payload ->> 'ability_id')::uuid,
    payload ->> 'slot',
    (payload ->> 'is_hidden')::boolean
  from public.reference_option_filter_publication_staging
  where batch_id = p_batch_id
    and publication_id = p_publication_id
    and row_kind = 'form_ability'
  order by source_order;

  delete from public.reference_move_learnsets
  where publication_id = p_publication_id;

  insert into public.reference_move_learnsets (
    publication_id, species_id, form_id, move_id, learn_method, learn_level, condition_ko
  )
  select p_publication_id,
    (payload ->> 'species_id')::uuid,
    (payload ->> 'form_id')::uuid,
    (payload ->> 'move_id')::uuid,
    payload ->> 'learn_method',
    (payload ->> 'learn_level')::smallint,
    payload ->> 'condition_ko'
  from public.reference_option_filter_publication_staging
  where batch_id = p_batch_id
    and publication_id = p_publication_id
    and row_kind = 'learnset'
  order by source_order;

  delete from public.reference_option_filter_publication_staging
  where batch_id = p_batch_id
    and publication_id = p_publication_id;
end;
$$;

revoke all on function public.replace_pokemon_option_filter_reference_data(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.replace_pokemon_option_filter_reference_data(uuid, uuid) to service_role;
