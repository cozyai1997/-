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

- Mutated one Tera identifier in an already complete staged batch to a count-correct substitution. The replacement RPC rejected it with `staged tera types must use the canonical 19 identifiers`; the test restored `normal` in the same batch before executing its GREEN replacement.
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
- Atomic publication replacement: 4/4 passed in 48.64s on a clean local reset (late rollback 10.974s, canonical rejection plus full nine-kind replacement 17.982s, cross-publication stable-UUID rotation 14.219s). It uses an executable count-correct canonical-ID rejection before its full same-publication replacement, and verifies the true late `23505` rollback and cross-publication rotation. The rotation removes the retired relation before moving the global `normal` Tera UUID, then proves an `owned_pokemon.tera_type_id` still points to that same UUID.
- Owned-Pokemon transaction/security: 16/16 passed in 3.15s after the RED fixture correction. Coverage includes independent Tera/Gigantamax explicit-change behavior, correction preservation of a still-valid Tera choice, and audit JSON battle fields.
- RLS: 6/6 passed in 5.36s. It now covers both option tables, anon denial, normal-user write denial, RPC EXECUTE revocation, ordered cleanup, active-publication restoration, and no fixture residue.
- Generated types and `pnpm typecheck` passed.

### Review changes

- Form Tera and Gigantamax staged validation now uses staged `form_battle_profile.is_battle_only`, rather than prior table state.
- The reconciler now tracks Tera and Gigantamax changes independently.
- Replacement accepts only the canonical 19 identifiers, moves existing global Tera rows without changing their UUIDs, deletes dependent option rows before the move, and deactivates obsolete target-publication Tera rows.
- Replaced redundant primary-key prefix indexes with option lookup indexes on `(publication_id, tera_type_id)` and `(publication_id, gigantamax_form_id)`.

No unresolved concerns.

## Review fix: bounded ordering and full idempotence digest

### RED

- An initial full digest exposed that `form_abilities` and `learnsets` receive regenerated surrogate relation IDs during replacement. The digest now compares their complete logical rows while excluding only those generated `id` fields; all other replaced collection fields remain covered.
- The first staged successful batch now rejects both a count-correct noncanonical identifier and a canonical identifier with `sort_order = -1` before restoring the approved mapping and continuing the same batch.

### GREEN

- Clean local reset applied the migration successfully.
- Atomic suite: 4/4 passed in 71.46s total. Each heavy case remained below the 60s RPC/test gateway: late rollback 10.857s, canonical mapping/full replacement 22.236s, and rotation plus no-intervening full-content digest idempotence 32.849s.
- RLS smoke: 6/6 passed in 5.38s. Owned-Pokemon smoke: 17/17 passed in 2.92s.
- `pnpm supabase db lint --local`: `No schema errors found`; generated database types and `pnpm typecheck` passed.

### Review changes

- Staged Tera rows must now match the exact approved identifier-to-nonnegative-sort-order mapping (`normal=0` through `stellar=18`).
- Temporary target slots use the clear bounded allocator `-row_number()` after a `<= 32,768` target-row guard. Final obsolete tombstones are independently renumbered by stable UUID order into the same negative range, so canonical UUID order cannot perturb their state.
- A service-role-only server digest covers moves, forms/base-battle profiles, natures, Tera types/options, Gigantamax options, form abilities, and learnsets. The idempotence regression asserts equal deterministic digests and empty staging after the no-intervening replacement.

No unresolved concerns.

## Review fix: lifecycle ordering and idempotence

### RED

- The first lifecycle implementation attempted `SET CONSTRAINTS` without the `public.` qualification inside a function with an empty search path. The late replacement regression returned `42704`; qualifying the known deferrable constraint resolved it.

### GREEN

- `pnpm supabase db reset --local`: applied all migrations and seed successfully.
- Atomic publication suite: 4/4 passed in 66.96s total. Individual heavy cases remained below the gateway limit: late rollback 11.138s, canonical rejection plus full replacement 18.060s, obsolete-slot/canonical-order-swap rotation plus no-intervening idempotence 32.316s.
- RLS suite: 6/6 passed in 5.23s, including authenticated write denial for both option tables.
- Owned-Pokemon suite: 17/17 passed in 3.01s, including correction that preserves a valid Tera selection and `has_gigantamax_factor = true`.
- `pnpm supabase db lint --local`: `No schema errors found`.
- Regenerated `src/types/database.generated.ts` after the reset; `pnpm typecheck` passed.

### Review changes

- Made the publication/sort-order unique constraint deferrable. Before each canonical Tera upsert, the replacement transaction deterministically moves all target-publication Tera rows to temporary negative sort slots. This clears both obsolete-slot conflicts and canonical-order swaps while global IDs are moved.
- The lifecycle regression creates an active obsolete row at the `normal` slot, swaps active canonical `fighting`/`flying` orders, preserves an owned Pokemon’s `normal` UUID through rotation, deactivates the obsolete row, then restages and proves a no-intervening-change replacement leaves reference state unchanged and staging empty.

No unresolved concerns.
