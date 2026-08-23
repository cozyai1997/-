create table public.app_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin')),
  granted_by uuid references auth.users(id) on delete set null,
  reason_ko text not null check (btrim(reason_ko) <> ''),
  granted_at timestamptz not null default now()
);

create index app_roles_granted_by_idx on public.app_roles (granted_by);

create table private.role_audit_events (
  id bigint generated always as identity primary key,
  target_user_id uuid not null,
  actor_user_id uuid,
  action text not null check (action in ('grant', 'revoke', 'change')),
  previous_role text,
  next_role text,
  reason_ko text not null,
  occurred_at timestamptz not null default now()
);

create index role_audit_events_target_time_idx
on private.role_audit_events (target_user_id, occurred_at desc);

revoke all on table public.app_roles from public, anon, authenticated;
revoke all on table private.role_audit_events from public, anon, authenticated;
grant all privileges on table private.role_audit_events to service_role;
grant usage, select on sequence private.role_audit_events_id_seq to service_role;
grant select on table public.app_roles to authenticated;

alter table public.app_roles enable row level security;

create policy "users read own role"
on public.app_roles for select to authenticated
using ((select auth.uid()) = user_id);

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((select auth.jwt() ->> 'user_role' = 'admin'), false)
    and exists (
      select 1
      from public.app_roles
      where user_id = (select auth.uid())
        and role = 'admin'
    );
$$;

revoke all on function private.is_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

grant insert, update, delete on table
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

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'public.reference_types',
    'public.reference_species',
    'public.reference_forms',
    'public.reference_abilities',
    'public.reference_moves',
    'public.reference_items',
    'public.reference_natures',
    'public.reference_move_learnsets',
    'public.reference_evolution_rules',
    'public.reference_type_matchups',
    'public.data_publications'
  ] loop
    execute format(
      'create policy "admins insert" on %s for insert to authenticated with check ((select private.is_admin()))',
      target_table
    );
    execute format(
      'create policy "admins update" on %s for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))',
      target_table
    );
    execute format(
      'create policy "admins delete" on %s for delete to authenticated using ((select private.is_admin()))',
      target_table
    );
  end loop;
end;
$$;

drop policy "authenticated read active publications" on public.data_publications;
create policy "authenticated read active publications or admin drafts"
on public.data_publications for select to authenticated
using (status = 'active' or (select private.is_admin()));

create function private.audit_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into private.role_audit_events (
      target_user_id, actor_user_id, action, next_role, reason_ko
    ) values (
      new.user_id, coalesce((select auth.uid()), new.granted_by), 'grant', new.role, new.reason_ko
    );
    return new;
  elsif tg_op = 'DELETE' then
    insert into private.role_audit_events (
      target_user_id, actor_user_id, action, previous_role, reason_ko
    ) values (
      old.user_id, (select auth.uid()), 'revoke', old.role, old.reason_ko
    );
    return old;
  end if;

  insert into private.role_audit_events (
    target_user_id, actor_user_id, action, previous_role, next_role, reason_ko
  ) values (
    new.user_id, (select auth.uid()), 'change', old.role, new.role, new.reason_ko
  );
  return new;
end;
$$;

revoke all on function private.audit_role_change() from public, anon, authenticated;

create trigger app_roles_audit
after insert or update or delete on public.app_roles
for each row execute function private.audit_role_change();

create function private.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  assigned_role text;
begin
  select role into assigned_role
  from public.app_roles
  where user_id = (event ->> 'user_id')::uuid;

  claims := event -> 'claims';
  if assigned_role is null then
    claims := claims - 'user_role';
  else
    claims := jsonb_set(claims, '{user_role}', to_jsonb(assigned_role));
  end if;

  return jsonb_build_object('claims', claims);
end;
$$;

revoke all on function private.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant usage on schema private to supabase_auth_admin;
grant execute on function private.custom_access_token_hook(jsonb) to supabase_auth_admin;
