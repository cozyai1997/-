alter table public.reference_forms
  add column base_form_id uuid references public.reference_forms(id) on delete restrict;

create index reference_forms_base_form_idx on public.reference_forms (base_form_id);

alter table public.reference_moves
  alter column pp drop not null;

alter table public.reference_move_learnsets
  add column species_id uuid references public.reference_species(id) on delete cascade;

update public.reference_move_learnsets as learnset
set species_id = form.species_id
from public.reference_forms as form
where form.id = learnset.form_id;

alter table public.reference_move_learnsets
  alter column species_id set not null,
  alter column form_id drop not null,
  drop constraint reference_move_learnsets_learn_method_check,
  drop constraint reference_move_learnsets_form_id_move_id_learn_method_learn_key,
  add constraint reference_move_learnsets_learn_method_check
    check (learn_method in ('level', 'tm', 'tutor', 'egg', 'legacy', 'special', 'form_change'));

create index reference_move_learnsets_species_idx
  on public.reference_move_learnsets (species_id);
create index reference_move_learnsets_form_idx
  on public.reference_move_learnsets (form_id);
create index reference_move_learnsets_publication_species_idx
  on public.reference_move_learnsets (publication_id, species_id);

create table public.reference_form_abilities (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.data_publications(id) on delete cascade,
  form_id uuid not null references public.reference_forms(id) on delete cascade,
  ability_id uuid not null references public.reference_abilities(id) on delete restrict,
  slot text not null check (btrim(slot) <> ''),
  is_hidden boolean not null default false
);

create index reference_form_abilities_publication_idx
  on public.reference_form_abilities (publication_id);
create index reference_form_abilities_form_idx
  on public.reference_form_abilities (form_id);
create index reference_form_abilities_ability_idx
  on public.reference_form_abilities (ability_id);
create index reference_form_abilities_publication_form_idx
  on public.reference_form_abilities (publication_id, form_id);

grant all privileges on table public.reference_form_abilities to service_role;
grant select on table public.reference_form_abilities to authenticated;

alter table public.reference_form_abilities enable row level security;

create policy "authenticated read reference form abilities"
on public.reference_form_abilities for select to authenticated using (true);
