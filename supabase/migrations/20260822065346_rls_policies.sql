revoke all on all tables in schema public from anon, authenticated;

grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

grant usage on schema public to authenticated;
grant select on table
  public.reference_types,
  public.reference_species,
  public.reference_forms,
  public.reference_abilities,
  public.reference_moves,
  public.reference_items,
  public.reference_natures,
  public.reference_move_learnsets,
  public.reference_evolution_rules,
  public.reference_type_matchups,
  public.data_publications
to authenticated;

grant select, insert, update, delete on table
  public.owned_pokemon,
  public.owned_pokemon_moves,
  public.owned_pokemon_images
to authenticated;

grant select on table public.audit_events to authenticated;
grant usage, select on sequence public.audit_events_id_seq to authenticated;

alter table public.reference_types enable row level security;
alter table public.reference_species enable row level security;
alter table public.reference_forms enable row level security;
alter table public.reference_abilities enable row level security;
alter table public.reference_moves enable row level security;
alter table public.reference_items enable row level security;
alter table public.reference_natures enable row level security;
alter table public.reference_move_learnsets enable row level security;
alter table public.reference_evolution_rules enable row level security;
alter table public.reference_type_matchups enable row level security;
alter table public.data_publications enable row level security;
alter table public.owned_pokemon enable row level security;
alter table public.owned_pokemon_moves enable row level security;
alter table public.owned_pokemon_images enable row level security;
alter table public.audit_events enable row level security;

create policy "authenticated read reference types"
on public.reference_types for select to authenticated using (true);
create policy "authenticated read reference species"
on public.reference_species for select to authenticated using (true);
create policy "authenticated read reference forms"
on public.reference_forms for select to authenticated using (true);
create policy "authenticated read reference abilities"
on public.reference_abilities for select to authenticated using (true);
create policy "authenticated read reference moves"
on public.reference_moves for select to authenticated using (true);
create policy "authenticated read reference items"
on public.reference_items for select to authenticated using (true);
create policy "authenticated read reference natures"
on public.reference_natures for select to authenticated using (true);
create policy "authenticated read reference move learnsets"
on public.reference_move_learnsets for select to authenticated using (true);
create policy "authenticated read reference evolution rules"
on public.reference_evolution_rules for select to authenticated using (true);
create policy "authenticated read reference type matchups"
on public.reference_type_matchups for select to authenticated using (true);
create policy "authenticated read active publications"
on public.data_publications for select to authenticated using (status = 'active');

create policy "owned pokemon select own"
on public.owned_pokemon for select to authenticated
using ((select auth.uid()) = user_id);

create policy "owned pokemon insert own"
on public.owned_pokemon for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "owned pokemon update own"
on public.owned_pokemon for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "owned pokemon delete own"
on public.owned_pokemon for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "owned moves select through owner"
on public.owned_pokemon_moves for select to authenticated
using (
  exists (
    select 1 from public.owned_pokemon as pokemon
    where pokemon.id = owned_pokemon_id
      and pokemon.user_id = (select auth.uid())
  )
);

create policy "owned moves insert through owner"
on public.owned_pokemon_moves for insert to authenticated
with check (
  exists (
    select 1 from public.owned_pokemon as pokemon
    where pokemon.id = owned_pokemon_id
      and pokemon.user_id = (select auth.uid())
  )
);

create policy "owned moves update through owner"
on public.owned_pokemon_moves for update to authenticated
using (
  exists (
    select 1 from public.owned_pokemon as pokemon
    where pokemon.id = owned_pokemon_id
      and pokemon.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.owned_pokemon as pokemon
    where pokemon.id = owned_pokemon_id
      and pokemon.user_id = (select auth.uid())
  )
);

create policy "owned moves delete through owner"
on public.owned_pokemon_moves for delete to authenticated
using (
  exists (
    select 1 from public.owned_pokemon as pokemon
    where pokemon.id = owned_pokemon_id
      and pokemon.user_id = (select auth.uid())
  )
);

create policy "owned images select through owner"
on public.owned_pokemon_images for select to authenticated
using (
  exists (
    select 1 from public.owned_pokemon as pokemon
    where pokemon.id = owned_pokemon_id
      and pokemon.user_id = (select auth.uid())
  )
);

create policy "owned images insert through owner"
on public.owned_pokemon_images for insert to authenticated
with check (
  exists (
    select 1 from public.owned_pokemon as pokemon
    where pokemon.id = owned_pokemon_id
      and pokemon.user_id = (select auth.uid())
  )
);

create policy "owned images update through owner"
on public.owned_pokemon_images for update to authenticated
using (
  exists (
    select 1 from public.owned_pokemon as pokemon
    where pokemon.id = owned_pokemon_id
      and pokemon.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.owned_pokemon as pokemon
    where pokemon.id = owned_pokemon_id
      and pokemon.user_id = (select auth.uid())
  )
);

create policy "owned images delete through owner"
on public.owned_pokemon_images for delete to authenticated
using (
  exists (
    select 1 from public.owned_pokemon as pokemon
    where pokemon.id = owned_pokemon_id
      and pokemon.user_id = (select auth.uid())
  )
);

create policy "audit events select own"
on public.audit_events for select to authenticated
using ((select auth.uid()) = user_id);

create function private.audit_owned_pokemon_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  record_id uuid;
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
    after_data
  ) values (
    owner_id,
    'owned_pokemon',
    record_id,
    lower(tg_op),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.audit_owned_pokemon_change() from public, anon, authenticated;

create trigger owned_pokemon_audit
after insert or update or delete on public.owned_pokemon
for each row execute function private.audit_owned_pokemon_change();
