# Task 4 implementation report — 공통 능력치 계산과 등록 상태 정합화

## Scope

- Base commit: `3970aec21f042a9f7253cd6d8d9b4f1d0aa5b56d`
- Implemented only the Task 4 stat, schema, registration-state, and named unit-test files.
- No repository persistence or UI Task 5+ code was changed.

## RED evidence

Before production changes, ran:

```text
pnpm test -- tests/unit/stats.test.ts tests/unit/owned-pokemon-schema.test.ts tests/unit/pokemon-registration-state.test.ts
```

Observed the expected failures:

- `calculate-owned-pokemon-stats` could not be resolved because the common owned-Pokemon calculator did not exist.
- Draft key was `pokemon-registration-draft-v2`, rather than v3.
- Restored drafts had no `teraTypeId` or `hasGigantamaxFactor` defaults.
- Species reconciliation retained both battle selections.
- `reconcileBattleSelections` was absent.

The focused run failed with 7 behavioural draft failures and the absent calculator-module error.

## GREEN evidence

Implemented:

- one shared `StatBlock` from `features/stats/types`, re-exported by the owned-Pokemon schema;
- `HpRule` support where `fixed-one` changes only HP;
- `calculateOwnedPokemonStats`, which returns Korean `unavailable` results for missing base stats or incomplete selected nature data, while `null` nature is neutral;
- v3 draft migration (v3 → v2 → v1), safe stored field normalization, species-reset clearing, and form allowlist battle reconciliation.

Verified:

```text
pnpm test -- tests/unit/stats.test.ts tests/unit/owned-pokemon-schema.test.ts tests/unit/pokemon-registration-state.test.ts
3 files passed, 36 tests passed

pnpm typecheck
next typegen && tsc --noEmit passed
```

## Self-review

- `fixed-one` is checked only in the HP branch; all five other stats still use the standard IV/EV/level/nature formula.
- The calculator never fabricates a value when required base stats or selected nature adjustment data is incomplete.
- The persisted draft reader is defensive against malformed JSON, non-object payloads, malformed battle values, and legacy v2/v1 payloads.
- A selected Tera type is preserved only when its ID is in the current battle profile allowlist. Gigantamax factor is forced false when the current form is ineligible.
- `git diff --check` completed without whitespace errors.

## Review fix

Review found that the two battle fields were optional in `OwnedPokemonInput`, contrary to the approved Task 4 contract.

### RED evidence

Added a compile-time `@ts-expect-error` test that assigns an input with both battle fields omitted. Before the fix, running `pnpm typecheck` failed with:

```text
tests/unit/owned-pokemon-schema.test.ts: Unused '@ts-expect-error' directive.
```

This proves omission was incorrectly accepted.

### GREEN evidence

- Made `teraTypeId: string | null` and `hasGigantamaxFactor: boolean` required in `OwnedPokemonInput`.
- Kept registration draft defaults explicit (`null` / `false`) and retained malformed-storage normalization coverage.
- Updated the existing typed detail return and the owned-Pokemon transaction fixture with explicit no-selection values. This is an application-contract compatibility change only; it does not add Task 5 persistence/query behavior.

Verified:

```text
pnpm test -- tests/unit/stats.test.ts tests/unit/owned-pokemon-schema.test.ts tests/unit/pokemon-registration-state.test.ts tests/security/owned-pokemon-transaction.spec.ts
3 files passed, 1 file skipped; 37 tests passed, 17 skipped

pnpm typecheck
next typegen && tsc --noEmit passed
```
