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

## Concern / follow-up boundary

`OwnedPokemonInput` exposes the new battle fields as optional at this intermediate Task 4 boundary. Registration drafts always materialize them as `null` and `false`, while the pre-existing Task 5 repository/detail contracts and a security fixture do not yet read or provide them. Keeping the input backward-compatible lets Task 4 pass `pnpm typecheck` without modifying prohibited Task 5+ repository/UI files. Task 5 should make all persistence reads/writes carry the values and can tighten the input boundary once its detail model is expanded.
