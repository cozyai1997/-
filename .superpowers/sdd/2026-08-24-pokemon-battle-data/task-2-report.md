# Task 2 Report: Candidate Validation and Atomic Publication Preparation

## Status

DONE

## Implementation

- Added production battle-data count contracts: 1,334 playable forms, 164 battle-only forms, 9 raw diagnostics, 19 Tera types, 25,184 form/Tera links, and 42 Gigantamax links.
- Added `ValidationReport.battleDataIssues` and made any battle-data issue block candidate activation.
- Validated all six base stats, supported non-HP nature adjustments, playable/battle-only Tera relationships, Ogerpon/Terapagos single-option constraints, and Gigantamax source/target semantics.
- Extended option-filter publication count and reference validation for natures, Tera types, Tera links, and Gigantamax links.
- Added `prepareBattlePublicationRows(dataset, ids)` and staged the five new row kinds in the same batch as existing move, form-link, ability, and learnset rows. UUIDs are used for relational payloads; `name_ko` is the only display value carried for Tera types.
- No Task 3 schema, migration, generated-database-type, or runtime UI changes were made.

## Files Changed

- `src/features/localization/reference-data-validation.ts`
- `scripts/data/publish-pokemon-option-filter-reference-data.ts`
- `tests/unit/reference-data-validation.test.ts`
- `tests/unit/pokemon-option-filter-reference-data.test.ts`
- `tests/unit/pokemon-option-filter-publication.test.ts`

## TDD Evidence

### RED

Command:

```powershell
pnpm test -- tests/unit/reference-data-validation.test.ts tests/unit/pokemon-option-filter-reference-data.test.ts tests/unit/pokemon-option-filter-publication.test.ts tests/unit/core-reference-publication.test.ts
```

Observed expected failures before implementation:

- `prepareBattlePublicationRows is not a function`
- `productionExpectedBattleRowCounts` was `undefined`
- `ValidationReport.battleDataIssues` was `undefined`

After adding the production-profile test, the same command failed as expected because `productionExpectedBattleDatasetProfile` was `undefined`.

### GREEN

Focused command:

```powershell
pnpm test -- tests/unit/reference-data-validation.test.ts tests/unit/pokemon-option-filter-reference-data.test.ts tests/unit/pokemon-option-filter-publication.test.ts tests/unit/core-reference-publication.test.ts
```

Result: 4 test files passed, 28 tests passed.

Type check:

```powershell
pnpm typecheck
```

Result: passed (`next typegen && tsc --noEmit`).

## Self-Review

- Reviewed the production and test diffs, including UUID mapping, batch construction, count checks, and Korean display payload fields.
- Ran `git diff --check`; no whitespace errors were reported.
- Corrected an initially uncovered `formIds` reference in the candidate validator before the final GREEN run.

## Concerns

- The new staging row kinds are intentionally prepared but cannot be consumed by the current database RPC until Task 3 adds its schema and atomic replacement branches. No database migration was added here by scope.

## Review Fix

### Changes

- Added `collectBattleDataIssues()` as the single reusable battle semantic-validation boundary. `assertOptionFilterCandidate()` now calls it after basic identifier/reference validation and rejects its first stable issue before any database query or staging write.
- Added a direct publication regression: invalid base stats reject before the client's `from()` method can run. The reused validator covers invalid nature adjustments, battle-only and missing playable Tera options, Ogerpon/Terapagos option counts, and Gigantamax relationship semantics with the same stable issue locations.
- Added the requested core-publication regression. It builds a report whose only invalidity is `forms:eevee-normal:baseStats` in `battleDataIssues` and proves `publishValidatedCandidate()` returns the current publication state unchanged.
- Added negative cross-species and non-battle-only Gigantamax target tests, plus a positive UUID-payload assertion for `form_gigantamax_option` staging.

### TDD Evidence

RED command:

```powershell
pnpm test -- tests/unit/reference-data-validation.test.ts tests/unit/pokemon-option-filter-reference-data.test.ts tests/unit/pokemon-option-filter-publication.test.ts tests/unit/core-reference-publication.test.ts
```

Before adding the reused semantic guard, the new direct publication test followed the pre-existing path into its `database should not be called` client stub instead of rejecting `forms:form-0:baseStats`; that demonstrated the candidate validator did not enforce battle semantics.

GREEN command:

```powershell
pnpm test -- tests/unit/reference-data-validation.test.ts tests/unit/pokemon-option-filter-reference-data.test.ts tests/unit/pokemon-option-filter-publication.test.ts tests/unit/core-reference-publication.test.ts
```

Result: 4 test files passed, 32 tests passed.

Type check:

```powershell
pnpm typecheck
```

Result: passed (`next typegen && tsc --noEmit`).

### Review-Fix Self-Review

- Kept the existing structural validation order, so its established error contracts still win before semantic validation.
- Confirmed semantic validation is invoked before any Supabase publication lookup, staging insertion, or RPC replacement.
