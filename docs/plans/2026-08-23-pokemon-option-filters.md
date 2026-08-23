# Pokemon option filters implementation plan

## Objective

Filter abilities to the selected Pokemon form and moves to the selected species, show only Korean labels and descriptions, let a user store at most four current and four target moves, and publish the required reference data to Supabase without importing Excel at runtime.

## Approved behavior

- The application never reads Excel at runtime. Repository source CSV and the generated candidate JSON are publication inputs only.
- Ability choices come from the exact selected form. A form with no direct rows inherits the rows of its valid `BaseFormID`.
- Move choices come from the selected species because all 116,519 source learnset rows are species-level and have no `FormID`.
- Move acquisition methods are displayed in Korean categories. English identifiers may be stored internally but must never be rendered.
- Official Korean move/ability names and Korean descriptions from the prepared cache are the display source. A row without a usable Korean display value is rejected from publication.
- A form change clears an ability that is no longer valid. A species change clears ability, current moves, and target moves. A form-only change retains moves because the source is species-level.
- Current moves and target moves each allow zero to four distinct selections. Target rows store the selected Korean acquisition condition.
- Internal UUIDs and internal identifiers are option values only; visible labels use Korean names and the official National Pokedex number where relevant.

## Global constraints

- Preserve unrelated user changes; do not reset or delete user work.
- Follow red-green-refactor: add focused failing tests and observe the intended failure before production code.
- New public-schema tables/functions require explicit grants, RLS, and indexes.
- Database writes for a Pokemon and its move rows must be one transaction.
- Use a security-invoker function and `auth.uid()` for authenticated ownership; never expose or embed a service-role key in browser code.
- Keep raw English method identifiers out of JSX. Use a closed Korean mapping.
- Verify unit tests, typecheck, lint, production build, local E2E, Supabase advisors, production data counts, and the deployed flow.

## Task 1: Reference schema and Korean publication pipeline

1. Add focused failing tests for preserving move battle fields, learnset method/level, form base IDs, form-ability slot/hidden flags, Korean method normalization, and rejection of missing Korean display values.
2. Add a Supabase migration created with the CLI that:
   - adds nullable self-referencing `base_form_id` to `reference_forms`;
   - creates `reference_form_abilities` with publication, form, ability, slot, and hidden fields;
   - adds required `species_id` and nullable `form_id` semantics to `reference_move_learnsets`;
   - preserves `level`, `tm`, `tutor`, `egg`, `legacy`, `special`, and `form_change` methods;
   - adds lookup indexes, explicit grants, and read RLS matching other active reference tables.
3. Extend the import candidate types and importer to preserve the needed fields. Convert damage class to internal identifiers and keep Korean display fields only.
4. Add a batched service-role publication script for form base links, moves, form abilities, and learnsets. It must resolve source identifiers to database UUIDs, be idempotent, reject missing Korean display values, preserve all 3,055 source relation rows, and never print secrets.
5. Update the generated database type declarations and package scripts.
6. Run the focused tests and the full unit suite; commit the task.

## Task 2: Domain filtering, validation, and transactional storage

1. Add focused failing tests for zero-to-four distinct current and target moves, draft v2 migration/defaults, invalid-selection reconciliation, and Korean method labels.
2. Extend owned Pokemon input with `currentMoves` and `targetMoves`, each carrying a move ID and target acquisition condition where applicable.
3. Add a repository query that loads exact-form/base-form abilities and species learnsets in parallel, deduplicates repeated ability/move rows by ID, and returns Korean-only view models grouped by Korean acquisition labels.
4. Replace the insert path with a security-invoker transactional RPC that writes `owned_pokemon` and `owned_pokemon_moves`, using `auth.uid()` and applying existing RLS.
5. Add server-side validation that an ability is valid for the selected exact/base form and each move belongs to the selected species learnset.
6. Update detail/edit models without regressing existing quick correction behavior; commit the task.

## Task 3: Registration GUI and end-to-end coverage

1. Add failing UI/E2E coverage proving that another form/species ability or move is absent, allowed Korean options are present, duplicate slots cannot be selected, invalid selections clear after species/form changes, and saved current/target rows exist.
2. Load filtered options only after species/form selection, with cancellation protection and Korean loading/error/empty states.
3. Replace the step-six placeholder with accessible current and target move controls, four slots each, Korean acquisition summaries, and the existing held-item control.
4. Change the ability selector to the filtered form list and visibly mark hidden abilities in Korean.
5. Keep the local draft versioned as v2 and avoid rendering UUIDs or English method identifiers.
6. Run focused tests, full unit tests, typecheck, lint, build, and local E2E; commit the task.

## Task 4: Review, production publication, and deployment

1. Run an independent spec and code-quality review; address important findings and re-review the fix diff.
2. Apply the migration locally, publish the complete filter data, and verify exact counts and representative Eevee/form queries.
3. Run Supabase database lint/advisors and migration dry-run before production apply.
4. Apply the production migration, publish data in batches, and verify counts plus authenticated filtering/storage with a disposable test user that is deleted afterward.
5. Push the feature branch, wait for Vercel production deployment, and verify the deployed Korean filtered registration flow and that no internal ID is visible.
