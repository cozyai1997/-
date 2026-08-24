# Task 3 Report: Supabase battle data, RLS, and atomic replacement

## Implemented

- Added battle profile columns and constraints to `reference_forms`, publication-consistent composite keys, the three Tera/Gigantamax reference tables, indexes, grants, and active-publication RLS policies.
- Added nine-kind staging validation and complete atomic replacement for form profiles, nature adjustments, Tera types/options, and Gigantamax options while retaining `form_base_link`.
- Enforced the published raw counts: 1,334 playable forms, 164 battle-only forms, 19 Tera types, 25,184 Tera links, and 42 Gigantamax links.
- Added Gigantamax relationship validation and owned-Pokemon Tera/Gigantamax reconciliation. New registration and correction require an active playable form; legacy direct rows without battle selections remain readable.
- Replaced the owned-Pokemon RPC definitions after dropping the old PostgREST signatures. The ten-argument quick-edit call remains compatible and preserves battle fields unless explicitly told to apply them.
- Regenerated `src/types/database.generated.ts` from the local database.

## TDD evidence

### RED

Command:

```powershell
pnpm exec supabase db reset --local
$env:RUN_SUPABASE_INTEGRATION='1'
pnpm test -- tests/security/option-filter-publication-atomicity.spec.ts tests/security/owned-pokemon-transaction.spec.ts tests/security/rls.spec.ts
Remove-Item Env:RUN_SUPABASE_INTEGRATION
```

Result: failed as expected before the migration. Relevant failures were the staging row-kind CHECK rejection, `PGRST205` for missing `public.reference_tera_types`, and `PGRST204` for missing `reference_forms.is_battle_only`.

### GREEN

Commands and results:

```powershell
pnpm exec supabase db reset --local
pnpm exec supabase db lint --local --level warning --fail-on warning
pnpm exec supabase gen types typescript --local --schema public | Set-Content -Encoding utf8 src/types/database.generated.ts
```

- Reset applied `20260824123000_pokemon_battle_data.sql` successfully.
- DB lint: `No schema errors found`.

Focused integration tests:

```powershell
$env:RUN_SUPABASE_INTEGRATION='1'
pnpm test -- tests/security/option-filter-publication-atomicity.spec.ts
pnpm test -- tests/security/owned-pokemon-transaction.spec.ts
pnpm test -- tests/security/rls.spec.ts
Remove-Item Env:RUN_SUPABASE_INTEGRATION
```

- Atomic publication replacement: 3/3 passed in 24.40s.
- Owned-Pokemon transaction/security: 15/15 passed in 3.45s.
- RLS: 6/6 passed in 5.82s.
- `pnpm typecheck`: passed.

## Files changed

- `supabase/migrations/20260824123000_pokemon_battle_data.sql`
- `src/types/database.generated.ts`
- `tests/security/option-filter-publication-atomicity.spec.ts`
- `tests/security/owned-pokemon-transaction.spec.ts`
- `tests/security/rls.spec.ts`

## Self-review

- Restored pre-mutation validation for the existing move, form-ability, and learnset staging branches as well as the five battle branches.
- Added a materialized Tera-ID mapping and staging expression index after the first complete replacement exceeded the local PostgREST 60-second upstream limit. The final service-role RPC test completes inside that limit.
- No unresolved concerns.

## Review fix

### RED

- Added a count-correct but noncanonical Tera identifier to a full nine-kind staged batch. The replacement RPC rejected it with `staged tera types must use the canonical 19 identifiers`.
- Added a duplicate final `form_tera_option` after all mutable replacement branches. The RPC reached the late option insert, returned PostgreSQL `23505`, and the test confirmed the prior move, base-form link, ability, and learnset rows were unchanged.
- The first run of the new field-by-field owned-Pokemon regression failed only on the fixture nickname CHECK constraint (`23514`); shortening the fixture name restored the intended battle-option case.

### GREEN

Commands run after the review changes:

```powershell
pnpm supabase db reset --local
pnpm supabase db lint --local
pnpm supabase gen types typescript --local --schema public > src/types/database.generated.ts
$env:RUN_SUPABASE_INTEGRATION='1'
pnpm vitest run tests/security/option-filter-publication-atomicity.spec.ts --reporter=verbose
pnpm vitest run tests/security/owned-pokemon-transaction.spec.ts --reporter=verbose
pnpm vitest run tests/security/rls.spec.ts --reporter=verbose
pnpm typecheck
```

- Reset applied the battle-data migration; `db lint --local` reported `No schema errors found`.
- The atomic suite verifies the true late `23505` rollback, canonical 19-ID rejection, same-publication replacement, and cross-publication rotation. It removes the retired relation before moving the global `normal` Tera UUID, then proves an `owned_pokemon.tera_type_id` still points to that same UUID.
- Owned-Pokemon transaction/security: 16/16 passed in 3.15s after the RED fixture correction. Coverage includes independent Tera/Gigantamax explicit-change behavior, correction preservation of a still-valid Tera choice, and audit JSON battle fields.
- RLS: 6/6 passed in 5.36s. It now covers both option tables, anon denial, normal-user write denial, RPC EXECUTE revocation, ordered cleanup, active-publication restoration, and no fixture residue.
- Generated types and `pnpm typecheck` passed.

### Review changes

- Form Tera and Gigantamax staged validation now uses staged `form_battle_profile.is_battle_only`, rather than prior table state.
- The reconciler now tracks Tera and Gigantamax changes independently.
- Replacement accepts only the canonical 19 identifiers, moves existing global Tera rows without changing their UUIDs, deletes dependent option rows before the move, and deactivates obsolete target-publication Tera rows.
- Replaced redundant primary-key prefix indexes with option lookup indexes on `(publication_id, tera_type_id)` and `(publication_id, gigantamax_form_id)`.

No unresolved concerns.
