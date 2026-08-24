# Pokemon Battle Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 보유 포켓몬에 한국어 테라타입·폼별 거다이맥스 가능 여부·기술 기본 PP·종족값/IV/EV/실제 능력치를 정확히 저장하고 모든 관련 화면에 표시한다.

**Architecture:** Cobbleverse 원천을 순수 정규화 함수로 1,498개 폼의 완전한 전투 프로필로 변환하고, 기존 option-filter 스테이징 RPC를 확장해 전투 기준데이터를 한 트랜잭션으로 교체한다. 클라이언트는 선택한 폼의 서버 allowlist만 사용하며, 저장 시 Postgres 트리거와 세 RPC가 같은 규칙을 다시 검증한다. 능력치 계산과 표시 컴포넌트는 등록·상세·수동 계산기가 공유한다.

**Tech Stack:** Next.js 16.3.2 App Router, React 19.2.8, TypeScript 5.9.3, Supabase/PostgreSQL, Vitest, Testing Library, Playwright, pnpm 10.33.2

**Spec:** `docs/superpowers/specs/2026-08-24-pokemon-battle-data-design.md`

## Global Constraints

- 기준 프로필은 Cobbleverse 1.7.42 / Cobblemon 1.7.3이다.
- 화면에는 영어 식별자·내부 UUID를 표시하지 않고 한국어 이름과 공식 도감번호만 표시한다.
- 기존 18개 타입과 324개 상성 관계는 그대로 두며 스텔라는 별도 테라타입 테이블에 저장한다.
- 플레이 가능 폼은 1,334개, battle-only 폼은 164개이며 기존 battle-only 보유 행을 삭제하지 않는다. Cobblemon raw JSON의 `battleOnly`가 권위 원본이며 CSV와의 예상 불일치 9개는 진단으로 보존한다.
- 일반 플레이 가능 폼은 19개 테라타입을 허용하고, 오거폰 8개 폼과 테라파고스 일반폼은 각각 고정 테라타입 하나만 허용한다.
- 운영 후보 데이터의 테라 관계는 25,184행, 거다이맥스 관계는 42행이어야 한다.
- 거다이맥스 가능 여부는 종이 아니라 폼 관계로 판정하며, 실제 인자 보유 여부는 사용자 입력으로 저장한다.
- 기술 PP는 남은 PP가 아닌 기본 최대 PP이며 `기본 PP: 15` 또는 `기본 PP: 확인 불가`로 표시한다.
- 네 능력치 용어와 설명은 승인 설계 문구를 그대로 사용한다.
- 모든 동작 변경은 실패 테스트를 먼저 실행한 뒤 최소 구현으로 통과시킨다.
- Next.js 페이지는 서버 컴포넌트로 유지하고 상태·이벤트가 필요한 좁은 컴포넌트에만 `'use client'`를 둔다.
- 사용자 소유 데이터와 관련 없는 기존 변경을 재설정하거나 삭제하지 않는다.

## File Map

**Create**

- `scripts/data/normalize-pokemon-battle-data.ts`: 종족값 상속, 성격 키 변환, 테라 allowlist, 폼별 거다이맥스 관계 생성.
- `supabase/migrations/20260824123000_pokemon_battle_data.sql`: 새 기준 테이블·열·RLS·트리거·게시 RPC·보유 포켓몬 RPC.
- `src/features/stats/calculate-owned-pokemon-stats.ts`: 폼/성격 데이터의 완전성 검사와 보유 개체 능력치 계산 결과 생성.
- `src/components/pokemon/stat-glossary.tsx`: 승인된 네 용어 설명.
- `src/components/pokemon/pokemon-stat-table.tsx`: 종족값·원본/적용 IV·EV·실제 능력치 표.
- `src/components/pokemon/pokemon-battle-fields.tsx`: 테라타입과 거다이맥스 인자 입력.
- `src/components/pokemon/pokemon-battle-badges.tsx`: 목록·상세의 한국어 배지.
- `src/components/pokemon/pokemon-move-card.tsx`: 기술 정보와 기본 PP 표시.
- `src/components/forms/pokemon-move-slot.tsx`: 등록 마법사의 기술 선택 슬롯.
- `tests/fixtures/reference-data/battle-mechanics/mechanics-source.json`: 예외 폼 정규화 최소 픽스처.
- `tests/unit/pokemon-battle-data-normalization.test.ts`
- `tests/unit/pokemon-battle-fields.test.tsx`
- `tests/unit/pokemon-move-card.test.tsx`
- `tests/unit/pokemon-stat-table.test.tsx`
- `tests/unit/stats-calculator.test.tsx`

**Modify**

- `src/features/localization/reference-data-validation.ts`
- `scripts/data/import-reference-data.ts`
- `scripts/data/publish-pokemon-option-filter-reference-data.ts`
- `tests/fixtures/reference-data/complete/dataset.json`
- `tests/fixtures/reference-data/english-description/dataset.json`
- `tests/unit/reference-data-validation.test.ts`
- `tests/unit/source-normalization.test.ts`
- `tests/unit/core-reference-publication.test.ts`
- `tests/unit/pokemon-option-filter-reference-data.test.ts`
- `tests/unit/pokemon-option-filter-publication.test.ts`
- `tests/security/option-filter-publication-atomicity.spec.ts`
- `tests/security/owned-pokemon-transaction.spec.ts`
- `tests/security/rls.spec.ts`
- `src/types/database.generated.ts` (Supabase CLI로 재생성)
- `src/features/stats/types.ts`
- `src/features/stats/calculate-stat.ts`
- `src/features/owned-pokemon/schema.ts`
- `src/features/owned-pokemon/registration-state.ts`
- `src/features/owned-pokemon/repository.ts`
- `src/components/forms/pokemon-registration-wizard.tsx`
- `src/components/forms/pokemon-detail-editor.tsx`
- `src/components/pokemon/stats-calculator.tsx`
- `src/app/(protected)/my-pokemon/page.tsx`
- `src/app/(protected)/stats/page.tsx`
- `src/app/globals.css`
- `tests/unit/stats.test.ts`
- `tests/unit/owned-pokemon-schema.test.ts`
- `tests/unit/pokemon-registration-state.test.ts`
- `tests/unit/pokemon-filtered-options.test.ts`
- `tests/unit/pokemon-registration-wizard.test.tsx`
- `tests/unit/pokemon-detail-editor.test.tsx`
- `tests/e2e/pokemon-registration.spec.ts`
- `tests/e2e/stats.spec.ts`

---

### Task 1: Cobbleverse 전투 데이터 정규화

**Files:**
- Create: `scripts/data/normalize-pokemon-battle-data.ts`
- Create: `tests/fixtures/reference-data/battle-mechanics/mechanics-source.json`
- Create: `tests/unit/pokemon-battle-data-normalization.test.ts`
- Modify: `src/features/localization/reference-data-validation.ts`
- Modify: `scripts/data/import-reference-data.ts`
- Modify: `tests/unit/source-normalization.test.ts`
- Modify: `tests/fixtures/reference-data/complete/dataset.json`
- Modify: `tests/fixtures/reference-data/english-description/dataset.json`

**Interfaces:**
- Produces: `ReferenceFormRow`, `ReferenceNatureRow`, `ReferenceTeraTypeRow`, `ReferenceFormTeraOptionRow`, `ReferenceFormGigantamaxOptionRow` in `reference-data-validation.ts`.
- Produces: `resolveInheritedBaseStats(forms)`, `normalizeNatureRow(row)`, `buildTeraTypes(types)`, `buildFormTeraOptions(forms, teraTypes)`, `buildFormGigantamaxOptions(forms)`.
- Produces: `ReferenceDataset.reportedCounts` keys `teraTypes`, `formTeraOptions`, `formGigantamaxOptions`.

- [ ] **Step 1: Write failing normalization tests**

  Add literal fixtures proving all-six-zero inheritance, two-level inheritance, missing parent, cycle, partial-zero rejection, CSV/raw `BattleOnly` disagreement rejection, `defence`/`special_defence` conversion, 25 nature mappings, 19 Tera types, Ogerpon masks, Terapagos Stellar-only, and the 42 Gmax relationships. The production-sized assertion must be:

  ```ts
  expect(result.forms.filter((form) => !form.isBattleOnly)).toHaveLength(1_334)
  expect(result.forms.filter((form) => form.isBattleOnly)).toHaveLength(164)
  expect(result.battleOnlyDiagnostics).toHaveLength(9)
  expect(result.formTeraOptions).toHaveLength(25_184)
  expect(result.formGigantamaxOptions).toHaveLength(42)
  ```

- [ ] **Step 2: Run the tests and verify RED**

  Run: `pnpm test -- tests/unit/pokemon-battle-data-normalization.test.ts tests/unit/source-normalization.test.ts`

  Expected: FAIL because the new exports and expanded candidate fields do not exist.

- [ ] **Step 3: Add exact candidate types and pure normalization functions**

  Use these public shapes:

  ```ts
  export type ReferenceFormRow = KoreanNamedRow & {
    speciesId: string
    baseFormId: string | null
    primaryTypeId: string | null
    secondaryTypeId: string | null
    baseStats: StatBlock
    isBattleOnly: boolean
    aspects: string[]
  }

  export type ReferenceNatureRow = KoreanNamedRow & {
    increasedStat: NonHpStatKey | null
    decreasedStat: NonHpStatKey | null
  }

  export type ReferenceTeraTypeRow = {
    id: string
    nameKo: string
    referenceTypeId: string | null
    sortOrder: number
  }

  export type ReferenceFormTeraOptionRow = { formId: string; teraTypeId: string }
  export type ReferenceFormGigantamaxOptionRow = {
    sourceFormId: string
    gigantamaxFormId: string
  }
  ```

  Normalize aspect arrays with trim, duplicate removal, and lexical sort. Treat only six zero values together as inheritance; reject partial zero, values outside 1–255, missing parents, and cycles. Convert `defence` to `defense` and `special_defence` to `special_defense`.

  Generate Gmax links by exact same-species aspect matching after removing `gmax`, with these explicit source aliases: `toxtricity-normal` for `amped-form`, `urshifu-normal` for `single_strike-style`, and all nine playable Alcremie cream forms to `alcremie-gmax`.

- [ ] **Step 4: Extend the importer**

  Read `FormEN`, six `Base*` columns, `BattleOnly`, and each species JSON once. Build each normal form from the top-level JSON stats and empty aspects; match all 473 derived CSV rows to raw JSON by `FormEN === forms[].name`. Reject a CSV/raw battle-only disagreement, then resolve stats before building Tera and Gmax rows. Map Stellar to `{ id: 'stellar', nameKo: '스텔라', referenceTypeId: null, sortOrder: 19 }` without adding it to `types` or `typeMatchups`.

- [ ] **Step 5: Run the focused tests and verify GREEN**

  Run: `pnpm test -- tests/unit/pokemon-battle-data-normalization.test.ts tests/unit/source-normalization.test.ts`

  Expected: PASS with 1,498 complete forms, 1,334 playable forms, 164 battle-only forms, 9 expected raw-vs-CSV diagnostics, 25,184 Tera links, and 42 Gmax links.

- [ ] **Step 6: Commit**

  ```powershell
  git add scripts/data/normalize-pokemon-battle-data.ts scripts/data/import-reference-data.ts src/features/localization/reference-data-validation.ts tests/fixtures/reference-data/battle-mechanics/mechanics-source.json tests/fixtures/reference-data/complete/dataset.json tests/fixtures/reference-data/english-description/dataset.json tests/unit/pokemon-battle-data-normalization.test.ts tests/unit/source-normalization.test.ts
  git commit -m "feat: normalize Pokemon battle reference data"
  ```

### Task 2: 후보 검증과 원자적 게시 준비

**Files:**
- Modify: `src/features/localization/reference-data-validation.ts`
- Modify: `scripts/data/publish-pokemon-option-filter-reference-data.ts`
- Modify: `tests/unit/reference-data-validation.test.ts`
- Modify: `tests/unit/pokemon-option-filter-reference-data.test.ts`
- Modify: `tests/unit/pokemon-option-filter-publication.test.ts`
- Modify: `tests/unit/core-reference-publication.test.ts`

**Interfaces:**
- Consumes: Task 1의 확장된 `ReferenceDataset`.
- Produces: `ValidationReport.battleDataIssues: string[]`.
- Produces: `prepareBattlePublicationRows(dataset, ids)` returning staged `form_battle_profile`, `nature_adjustment`, `tera_type`, `form_tera_option`, `form_gigantamax_option` rows.

- [ ] **Step 1: Write failing validation and staging tests**

  Assert exact production counts `19`, `25_184`, `42`; raw-authoritative playable/battle-only counts `1_334` / `164` and 9 expected CSV mismatch diagnostics; all six stats complete; every playable form has at least one Tera option; battle-only forms have none; Ogerpon/Terapagos have exactly one; Gmax source/target share species and target is battle-only; nature keys are valid non-HP keys. Assert that staged payloads use UUIDs internally but retain only Korean display names for UI-facing rows.

- [ ] **Step 2: Run the tests and verify RED**

  Run: `pnpm test -- tests/unit/reference-data-validation.test.ts tests/unit/pokemon-option-filter-reference-data.test.ts tests/unit/pokemon-option-filter-publication.test.ts tests/unit/core-reference-publication.test.ts`

  Expected: FAIL because battle-data validation and staging row kinds are absent.

- [ ] **Step 3: Implement semantic validation**

  Add `battleDataIssues` strings with stable locations such as `forms:<id>:baseStats`, `natures:<id>:adjustment`, `formTeraOptions:<formId>:missing`, and `formGigantamaxOptions:<sourceId>:<targetId>`. Include the array in `ValidationReport.valid` so invalid battle candidates cannot be activated.

- [ ] **Step 4: Extend publication row preparation**

  Extend `assertOptionFilterPublicationCounts()` and `assertOptionFilterCandidate()` with the three new collections. Stage these row kinds in one `batchId`:

  ```ts
  type BattleStagingKind =
    | 'form_battle_profile'
    | 'nature_adjustment'
    | 'tera_type'
    | 'form_tera_option'
    | 'form_gigantamax_option'
  ```

  Include `base_form_id`, six stat columns, and `is_battle_only` in `form_battle_profile`. Include 25 nature adjustments, 19 Tera types, 25,184 Tera links, and 42 Gmax links in the same `stageThenReplacePublicationRows()` call as moves, abilities, and learnsets.

- [ ] **Step 5: Run the tests and verify GREEN**

  Run: `pnpm test -- tests/unit/reference-data-validation.test.ts tests/unit/pokemon-option-filter-reference-data.test.ts tests/unit/pokemon-option-filter-publication.test.ts tests/unit/core-reference-publication.test.ts`

  Expected: PASS and no fixture count mismatch.

- [ ] **Step 6: Commit**

  ```powershell
  git add src/features/localization/reference-data-validation.ts scripts/data/publish-pokemon-option-filter-reference-data.ts tests/unit/reference-data-validation.test.ts tests/unit/pokemon-option-filter-reference-data.test.ts tests/unit/pokemon-option-filter-publication.test.ts tests/unit/core-reference-publication.test.ts tests/fixtures/reference-data/complete/dataset.json tests/fixtures/reference-data/english-description/dataset.json
  git commit -m "feat: validate and stage battle reference data"
  ```

### Task 3: Supabase 전투 스키마·RLS·원자 교체

**Files:**
- Create: `supabase/migrations/20260824123000_pokemon_battle_data.sql`
- Modify: `tests/security/option-filter-publication-atomicity.spec.ts`
- Modify: `tests/security/owned-pokemon-transaction.spec.ts`
- Modify: `tests/security/rls.spec.ts`
- Modify: `src/types/database.generated.ts`

**Interfaces:**
- Consumes: Task 2의 staging payload kinds and exact counts.
- Produces: tables `reference_tera_types`, `reference_form_tera_options`, `reference_form_gigantamax_options`.
- Produces: `owned_pokemon.tera_type_id`, `owned_pokemon.has_gigantamax_factor`.
- Produces: updated RPC signatures listed below.

- [ ] **Step 1: Write failing database behavior tests**

  Cover authenticated active-reference SELECT, anon/write denial, service-role publication, late staging failure rollback, idempotent republish, invalid direct owned-row Tera/Gmax rejection, battle-only create rejection, and correction reconciliation. For quick-edit compatibility, call the old ten-argument RPC and assert it preserves existing battle fields.

- [ ] **Step 2: Run the integration tests and verify RED**

  ```powershell
  pnpm exec supabase db reset --local
  $env:RUN_SUPABASE_INTEGRATION='1'
  pnpm test -- tests/security/option-filter-publication-atomicity.spec.ts tests/security/owned-pokemon-transaction.spec.ts tests/security/rls.spec.ts
  Remove-Item Env:RUN_SUPABASE_INTEGRATION
  ```

  Expected: FAIL because the columns, tables, policies, staging kinds, and validation functions do not exist.

- [ ] **Step 3: Create schema, keys, and policies**

  Add six nullable stat columns and `is_battle_only boolean not null default false` to `reference_forms`; CHECK `num_nonnulls(...) in (0, 6)` and each populated stat 1–255. Add `unique (publication_id, id)` constraints to `reference_forms` and `reference_types`, then create publication-consistent composite foreign keys and these tables:

  ```sql
  create table public.reference_tera_types (
    id uuid primary key default gen_random_uuid(),
    publication_id uuid not null,
    identifier text not null unique,
    name_ko text not null,
    reference_type_id uuid,
    sort_order smallint not null,
    is_active boolean not null default true,
    unique (publication_id, id),
    unique (publication_id, sort_order),
    foreign key (publication_id, reference_type_id)
      references public.reference_types(publication_id, id) on delete restrict
  );

  create table public.reference_form_tera_options (
    publication_id uuid not null,
    form_id uuid not null,
    tera_type_id uuid not null,
    primary key (publication_id, form_id, tera_type_id),
    foreign key (publication_id, form_id)
      references public.reference_forms(publication_id, id) on delete cascade,
    foreign key (publication_id, tera_type_id)
      references public.reference_tera_types(publication_id, id) on delete cascade
  );

  create table public.reference_form_gigantamax_options (
    publication_id uuid not null,
    source_form_id uuid not null,
    gigantamax_form_id uuid not null,
    primary key (publication_id, source_form_id, gigantamax_form_id),
    check (source_form_id <> gigantamax_form_id),
    foreign key (publication_id, source_form_id)
      references public.reference_forms(publication_id, id) on delete cascade,
    foreign key (publication_id, gigantamax_form_id)
      references public.reference_forms(publication_id, id) on delete cascade
  );
  ```

  Enable RLS on all three tables. Authenticated users may SELECT only active-publication rows; anon has no access; service role gets publication privileges. Revoke PUBLIC/anon/authenticated execution from every new private or service function.

- [ ] **Step 4: Implement DB invariants and atomic replacement**

  `private.validate_reference_form_gigantamax_option()` must reject cross-species links, battle-only sources, and non-battle-only targets. Extend `replace_pokemon_option_filter_reference_data(uuid, uuid)` to validate all eight staging kinds and exact production counts before any replacement, then update form profiles/natures and replace Tera/Gmax rows in the same transaction.

  `private.reconcile_owned_pokemon_battle_options()` must reject explicitly invalid user choices but clear stale values when only species/form changes. It runs before insert/update of `species_id, form_id, tera_type_id, has_gigantamax_factor`.

- [ ] **Step 5: Replace the three owned-Pokemon RPC definitions safely**

  Drop the old PostgREST overload before recreating the registration and quick-edit functions. Expose only these signatures:

  ```sql
  create_owned_pokemon_with_moves(
    -- existing 16 arguments,
    p_tera_type_id uuid default null,
    p_has_gigantamax_factor boolean default false
  ) returns uuid

  update_owned_pokemon_quick(
    -- existing 10 arguments,
    p_apply_battle_options boolean default false,
    p_tera_type_id uuid default null,
    p_has_gigantamax_factor boolean default false
  ) returns public.owned_pokemon

  correct_owned_pokemon(
    uuid, uuid, uuid, date, jsonb, text
  ) returns public.owned_pokemon
  ```

  Create requires a non-battle-only form. Quick edit preserves old values when `p_apply_battle_options=false`; the new client sends true. Correction retains valid values and clears invalid Tera/Gmax state. The audit trigger's `to_jsonb()` output must include the new fields.

- [ ] **Step 6: Reset, lint, regenerate types, and verify GREEN**

  ```powershell
  pnpm exec supabase db reset --local
  pnpm exec supabase db lint --local --level warning --fail-on warning
  pnpm exec supabase gen types typescript --local --schema public | Set-Content -Encoding utf8 src/types/database.generated.ts
  $env:RUN_SUPABASE_INTEGRATION='1'
  pnpm test -- tests/security/option-filter-publication-atomicity.spec.ts tests/security/owned-pokemon-transaction.spec.ts tests/security/rls.spec.ts
  Remove-Item Env:RUN_SUPABASE_INTEGRATION
  ```

  Expected: DB lint and all three security files PASS.

- [ ] **Step 7: Commit**

  ```powershell
  git add supabase/migrations/20260824123000_pokemon_battle_data.sql src/types/database.generated.ts tests/security/option-filter-publication-atomicity.spec.ts tests/security/owned-pokemon-transaction.spec.ts tests/security/rls.spec.ts
  git commit -m "feat: enforce Pokemon battle data integrity"
  ```

### Task 4: 공통 능력치 계산과 등록 상태 정합화

**Files:**
- Create: `src/features/stats/calculate-owned-pokemon-stats.ts`
- Modify: `src/features/stats/types.ts`
- Modify: `src/features/stats/calculate-stat.ts`
- Modify: `src/features/owned-pokemon/schema.ts`
- Modify: `src/features/owned-pokemon/registration-state.ts`
- Modify: `tests/unit/stats.test.ts`
- Modify: `tests/unit/owned-pokemon-schema.test.ts`
- Modify: `tests/unit/pokemon-registration-state.test.ts`

**Interfaces:**
- Produces: `HpRule = 'standard' | 'fixed-one'` and `StatCalculationInput.hpRule`.
- Produces: `OwnedPokemonStatResult = { status: 'ready'; stats: CalculatedStats } | { status: 'unavailable'; reasonKo: string }`.
- Produces: `reconcileBattleSelections(draft, battleProfile)`.

- [ ] **Step 1: Write failing stat and draft tests**

  Assert standard HP regression, `fixed-one` HP always 1, the other five Shedinja stats unchanged, missing base stats/nature adjustment returns Korean `unavailable`, v3 draft defaults, v2/v1 migration, invalid stored field normalization, species-change reset, valid Tera retention, invalid Tera clearing, and Gmax factor clearing when ineligible.

- [ ] **Step 2: Run the tests and verify RED**

  Run: `pnpm test -- tests/unit/stats.test.ts tests/unit/owned-pokemon-schema.test.ts tests/unit/pokemon-registration-state.test.ts`

  Expected: FAIL on the absent HP rule and battle fields.

- [ ] **Step 3: Implement calculation result and validation**

  Extend `OwnedPokemonInput` with:

  ```ts
  teraTypeId: string | null
  hasGigantamaxFactor: boolean
  ```

  Import and re-export the single `StatBlock` definition from `src/features/stats/types.ts` in the owned-Pokemon schema so the importer, repository, and calculator cannot drift. `calculateOwnedPokemonStats()` accepts `baseStats`, effective IV, EV, level, `NatureAdjustment | null`, and `hpRule`. It returns `unavailable` when base stats are null or a selected nature lacks a complete adjustment; an unspecified nature is neutral. `calculateAllStats()` applies `fixed-one` only to HP.

- [ ] **Step 4: Upgrade draft storage and reconciliation**

  Use `pokemon-registration-draft-v3`; read v3, v2, then v1. Default to `teraTypeId: null` and `hasGigantamaxFactor: false`. `reconcileSpeciesSelection()` clears both fields. `reconcileBattleSelections()` preserves only a Tera ID in `battle.teraTypes` and forces factor false unless `battle.canGigantamax`.

- [ ] **Step 5: Run the tests and verify GREEN**

  Run: `pnpm test -- tests/unit/stats.test.ts tests/unit/owned-pokemon-schema.test.ts tests/unit/pokemon-registration-state.test.ts`

  Expected: PASS.

- [ ] **Step 6: Commit**

  ```powershell
  git add src/features/stats/types.ts src/features/stats/calculate-stat.ts src/features/stats/calculate-owned-pokemon-stats.ts src/features/owned-pokemon/schema.ts src/features/owned-pokemon/registration-state.ts tests/unit/stats.test.ts tests/unit/owned-pokemon-schema.test.ts tests/unit/pokemon-registration-state.test.ts
  git commit -m "feat: calculate and reconcile Pokemon battle stats"
  ```

### Task 5: Repository의 폼 전투 프로필과 저장 연결

**Files:**
- Modify: `src/features/owned-pokemon/repository.ts`
- Modify: `tests/unit/pokemon-filtered-options.test.ts`
- Modify: `tests/unit/pokemon-registration-wizard.test.tsx`
- Modify: `tests/unit/pokemon-detail-editor.test.tsx`

**Interfaces:**
- Consumes: Task 3 generated DB types and Task 4 input types.
- Produces: `NatureOption`, `FormBattleProfile`, expanded `PokemonFilteredOptions`, `OwnedMoveDetail`, expanded `OwnedPokemonCard`/`OwnedPokemonDetail`.

- [ ] **Step 1: Write failing repository contract tests**

  Assert that `listSpeciesOptions()` excludes battle-only forms, `listPokemonFilteredOptions()` returns only the selected form's Korean Tera allowlist plus base stats and Gmax eligibility, lists/details include Tera display name and factor, detail moves include PP/type/category/description, create/quick-edit send the new arguments, and correction relies on the unchanged server signature to reconcile form changes.

- [ ] **Step 2: Run the tests and verify RED**

  Run: `pnpm test -- tests/unit/pokemon-filtered-options.test.ts tests/unit/pokemon-registration-wizard.test.tsx tests/unit/pokemon-detail-editor.test.tsx`

  Expected: FAIL because the repository contracts lack battle data.

- [ ] **Step 3: Add exact repository types**

  ```ts
  export type NatureOption = LookupOption & {
    increasedStat: NonHpStatKey | null
    decreasedStat: NonHpStatKey | null
  }

  export type FormBattleProfile = {
    baseStats: StatBlock | null
    hpRule: HpRule
    teraTypes: Array<{ id: string; nameKo: string }>
    canGigantamax: boolean
  }

  export type PokemonFilteredOptions = {
    abilities: AbilityOption[]
    moves: MoveOption[]
    battle: FormBattleProfile
  }
  ```

  Add `OwnedMoveDetail` with `moveId`, `slot`, Korean display fields, power, accuracy, PP, and nullable condition.

- [ ] **Step 4: Implement reads and writes**

  Query active publication once, verify the selected form is active and not battle-only for registration filtering, fetch its six base stats, allowed Tera types, and existence of a Gmax link in parallel with abilities/moves. Join the species identifier only to derive `hpRule = species.identifier === 'shedinja' ? 'fixed-one' : 'standard'`; never render that identifier. Sort Tera options by `sort_order`. For historical detail rows allow battle-only forms. Join owned moves through `reference_moves` and `reference_types` for Korean cards.

  Send `p_tera_type_id` and `p_has_gigantamax_factor` on create; send `p_apply_battle_options=true` plus both fields on quick update. Correction keeps its SQL signature and lets the server reconcile on form changes.

- [ ] **Step 5: Run the tests and verify GREEN**

  Run: `pnpm test -- tests/unit/pokemon-filtered-options.test.ts tests/unit/pokemon-registration-wizard.test.tsx tests/unit/pokemon-detail-editor.test.tsx`

  Expected: PASS with full mocked Supabase response shapes.

- [ ] **Step 6: Commit**

  ```powershell
  git add src/features/owned-pokemon/repository.ts tests/unit/pokemon-filtered-options.test.ts tests/unit/pokemon-registration-wizard.test.tsx tests/unit/pokemon-detail-editor.test.tsx
  git commit -m "feat: expose form battle profiles"
  ```

### Task 6: 재사용 가능한 한국어 전투 표시 컴포넌트

**Files:**
- Create: `src/components/pokemon/stat-glossary.tsx`
- Create: `src/components/pokemon/pokemon-stat-table.tsx`
- Create: `src/components/pokemon/pokemon-battle-fields.tsx`
- Create: `src/components/pokemon/pokemon-battle-badges.tsx`
- Create: `src/components/pokemon/pokemon-move-card.tsx`
- Create: `src/components/forms/pokemon-move-slot.tsx`
- Create: `tests/unit/pokemon-stat-table.test.tsx`
- Create: `tests/unit/pokemon-battle-fields.test.tsx`
- Create: `tests/unit/pokemon-move-card.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: Task 4 result union and Task 5 option/move types.
- Produces: `StatGlossary`, `PokemonStatTable`, `PokemonBattleFields`, `PokemonBattleBadges`, `PokemonMoveCard`, `basicPpLabel`, `PokemonMoveSlot`.

- [ ] **Step 1: Write failing component tests**

  Assert the four exact glossary definitions; the five stat columns; `계산 불가: <reason>` instead of invented values; Tera selector only renders supplied Korean options; Gmax checkbox disables and unchecks when impossible; badges never render IDs; move cards render `기본 PP: 15` and `기본 PP: 확인 불가`.

- [ ] **Step 2: Run the tests and verify RED**

  Run: `pnpm test -- tests/unit/pokemon-stat-table.test.tsx tests/unit/pokemon-battle-fields.test.tsx tests/unit/pokemon-move-card.test.tsx`

  Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement focused components**

  `StatGlossary` must render these exact definitions:

  ```text
  종족값 Base Stats: 그 포켓몬 종과 폼 자체가 가진 기본 능력치
  개체값 IV: 태어날 때 정해지는 0~31 수치
  노력치 EV: 전투나 아이템으로 올리는 훈련 수치, 능력치당 최대 252
  실제 능력치 Stats: 현재 레벨에서 실제 전투에 적용되는 HP·공격·방어·특공·특방·스피드 숫자
  ```

  Use this stat-table prop contract:

  ```ts
  type PokemonStatTableProps = {
    baseStats: StatBlock | null
    originalIv: StatBlock
    effectiveIv: StatBlock
    ev: StatBlock
    actualStats: OwnedPokemonStatResult
    caption: string
  }
  ```

  Use semantic `<dl>` for the glossary, `<table>` for six stats, labeled `<select>`/checkbox controls, and text-only badges. Extract the current wizard `MoveSlot` and grouping helpers into `pokemon-move-slot.tsx`; use `PokemonMoveCard` for selected details so PP wording has one implementation.

- [ ] **Step 4: Add responsive styling**

  Add `.stat-glossary`, `.pokemon-stat-table`, `.battle-fields`, `.battle-badges`, `.battle-badge`, and `.pokemon-move-card` rules matching the existing dark palette. At 640px, allow the stat table to scroll horizontally and stack battle controls.

- [ ] **Step 5: Run the tests and verify GREEN**

  Run: `pnpm test -- tests/unit/pokemon-stat-table.test.tsx tests/unit/pokemon-battle-fields.test.tsx tests/unit/pokemon-move-card.test.tsx`

  Expected: PASS with accessible names and no ID leakage.

- [ ] **Step 6: Commit**

  ```powershell
  git add src/components/pokemon/stat-glossary.tsx src/components/pokemon/pokemon-stat-table.tsx src/components/pokemon/pokemon-battle-fields.tsx src/components/pokemon/pokemon-battle-badges.tsx src/components/pokemon/pokemon-move-card.tsx src/components/forms/pokemon-move-slot.tsx src/app/globals.css tests/unit/pokemon-stat-table.test.tsx tests/unit/pokemon-battle-fields.test.tsx tests/unit/pokemon-move-card.test.tsx
  git commit -m "feat: add Korean Pokemon battle components"
  ```

### Task 7: 등록 마법사 연결

**Files:**
- Modify: `src/components/forms/pokemon-registration-wizard.tsx`
- Modify: `tests/unit/pokemon-registration-wizard.test.tsx`

**Interfaces:**
- Consumes: Tasks 4–6 draft reconciliation, battle profile, stat result, and shared components.
- Produces: seven-step registration flow with Tera/Gmax/stat/PP summary.

- [ ] **Step 1: Write failing wizard behavior tests**

  Drive the real component through all seven steps. Assert Korean Tera selection, `거다이맥스 가능/불가능`, checkbox enablement, form-change reconciliation, exact glossary wording, read-only base stats, live actual stats, selected move basic PP, and final Tera/Gmax/stat/move PP summary. Add the null-PP case.

- [ ] **Step 2: Run the test and verify RED**

  Run: `pnpm test -- tests/unit/pokemon-registration-wizard.test.tsx`

  Expected: FAIL on the first missing Tera control.

- [ ] **Step 3: Wire filter loading and reconciliation**

  Change the loading copy to `특성·기술·테라타입·거다이맥스 정보를 불러오는 중입니다.`. After each successful filtered read, call both existing ability/move reconciliation and `reconcileBattleSelections()`. Block Next/Save while any selected-form profile is loading or failed.

- [ ] **Step 4: Render the approved fields**

  Put `PokemonBattleFields` in step 3, `StatGlossary` and read-only base stats in step 4, `PokemonStatTable` under EV inputs in step 5, shared move cards in step 6, and battle badges/stat table/current and target move cards in step 7. Resolve effective nature from `options.natures` and calculate with Task 4's common function.

- [ ] **Step 5: Run the test and verify GREEN**

  Run: `pnpm test -- tests/unit/pokemon-registration-wizard.test.tsx`

  Expected: PASS, including draft persistence and existing retry behavior.

- [ ] **Step 6: Commit**

  ```powershell
  git add src/components/forms/pokemon-registration-wizard.tsx tests/unit/pokemon-registration-wizard.test.tsx
  git commit -m "feat: capture Pokemon battle options during registration"
  ```

### Task 8: 목록·상세·수동 계산기 연결

**Files:**
- Modify: `src/app/(protected)/my-pokemon/page.tsx`
- Modify: `src/components/forms/pokemon-detail-editor.tsx`
- Modify: `src/components/pokemon/stats-calculator.tsx`
- Modify: `src/app/(protected)/stats/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/unit/pokemon-detail-editor.test.tsx`
- Create: `tests/unit/stats-calculator.test.tsx`

**Interfaces:**
- Consumes: Tasks 4–6 repository models and shared components.
- Produces: card/detail badges, quick battle edit, full stat/move details, and terminology-correct manual calculator.

- [ ] **Step 1: Write failing detail and calculator tests**

  Assert list/detail Korean badges; detailed five-column stat table; current/target move cards including PP; quick-edit Tera/Gmax persistence; disabled impossible factor; correction reconciliation; four glossary definitions; `실제 능력치 Stats` header; and manual `일반`/`껍질몬(HP는 항상 1)` HP rule selection.

- [ ] **Step 2: Run the tests and verify RED**

  Run: `pnpm test -- tests/unit/pokemon-detail-editor.test.tsx tests/unit/stats-calculator.test.tsx`

  Expected: FAIL because the displays and controls are absent.

- [ ] **Step 3: Implement list and detail rendering**

  Render `PokemonBattleBadges` on every card and in the detail header. Keep the detail editor's loaded filter as the entire `PokemonFilteredOptions`, add `PokemonBattleFields` to quick edit, and update header display state after a successful save. Render the shared stat table and current/target move cards before the edit panels. During protected correction, reconcile the battle state against the newly loaded form and leave final enforcement to the unchanged correction RPC signature.

- [ ] **Step 4: Update the manual calculator**

  Add `StatGlossary`, rename `최종` to `실제 능력치 Stats`, and add an HP-rule select with values `standard` and `fixed-one`. Preserve the Lucario example and all existing validation.

- [ ] **Step 5: Run the tests and verify GREEN**

  Run: `pnpm test -- tests/unit/pokemon-detail-editor.test.tsx tests/unit/stats-calculator.test.tsx`

  Expected: PASS.

- [ ] **Step 6: Commit**

  ```powershell
  git add 'src/app/(protected)/my-pokemon/page.tsx' 'src/app/(protected)/stats/page.tsx' src/components/forms/pokemon-detail-editor.tsx src/components/pokemon/stats-calculator.tsx src/app/globals.css tests/unit/pokemon-detail-editor.test.tsx tests/unit/stats-calculator.test.tsx
  git commit -m "feat: show Pokemon battle data across owned views"
  ```

### Task 9: 실제 데이터 생성·통합 테스트·운영 배포

**Files:**
- Modify: `tests/e2e/pokemon-registration.spec.ts`
- Modify: `tests/e2e/stats.spec.ts`
- Generated locally (ignored): `.reference-data/candidate.json`, `.reference-data/validation-report.json`

**Interfaces:**
- Consumes: 모든 이전 Task의 마이그레이션, 게시기, 앱 UI.
- Produces: 검증된 Supabase 운영 데이터, GitHub 원격 커밋, Vercel READY production deployment.

- [ ] **Step 1: Extend E2E fixtures and write failing user-flow assertions**

  Add form stats/battle flags, a 19-type allowlist subset for the fixture, eligible/ineligible Gmax forms, nature adjustments, and cleanup for all new rows. Verify selection through save, list/detail persistence, exact stat result, PP in steps 6/7/detail, quick edit, form correction, audit fields, and absence of UUID/English identifiers.

- [ ] **Step 2: Run Chromium E2E and verify RED**

  Run: `pnpm exec playwright test tests/e2e/stats.spec.ts tests/e2e/pokemon-registration.spec.ts --project=chromium`

  Expected: FAIL until the local migrated DB is running with all integrated behavior.

- [ ] **Step 3: Finish integration wiring and verify focused E2E GREEN**

  Make only the minimum integration corrections exposed by the failing flows, adding a regression test before each bug fix. Re-run the same Chromium command until PASS and fixture cleanup reports zero residue.

- [ ] **Step 4: Generate and validate the real candidate**

  ```powershell
  pnpm data:import -- --source 'C:\Users\PARKSUNGSIK\OneDrive\문서\Desktop\Cobbleverse_Pokemon_Manager_Package_v1.3_TABLE_FIX' --output .reference-data/candidate.json
  pnpm data:validate -- --input .reference-data/candidate.json --report .reference-data/validation-report.json
  ```

  Inspect the report and assert: valid, forms 1,498, playable forms 1,334, battle-only forms 164, expected raw battleOnly diagnostics 9, Tera types 19, Tera links 25,184, Gmax links 42, natures 25, moves 826, learnsets 116,519, and type matchups 324.

- [ ] **Step 5: Run the complete local quality gate**

  ```powershell
  pnpm test
  $env:RUN_SUPABASE_INTEGRATION='1'
  pnpm test -- tests/security
  Remove-Item Env:RUN_SUPABASE_INTEGRATION
  pnpm test:e2e -- --project=chromium
  pnpm typecheck
  pnpm lint
  pnpm build
  pnpm exec supabase db lint --local --level warning --fail-on warning
  git diff --check
  ```

  Expected: every command exits 0 with no warnings or residue.

- [ ] **Step 6: Apply Supabase production migration and publish reference data**

  Confirm the linked project is `ipbqrgsdkoqtuqgnewrs`, then run `pnpm exec supabase db push --linked` followed by `pnpm data:publish:option-filters -- --input .reference-data/candidate.json` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` supplied by the configured production environment. Query the active publication afterward and verify all exact counts and active RLS reads before deploying the app.

- [ ] **Step 7: Commit final E2E/integration changes and push GitHub**

  ```powershell
  git add tests/e2e/pokemon-registration.spec.ts tests/e2e/stats.spec.ts
  git commit -m "test: verify Pokemon battle data workflows"
  git push origin feat/pokemon-trainer-manager-mvp
  ```

  Verify `git rev-parse HEAD` equals `git ls-remote origin refs/heads/feat/pokemon-trainer-manager-mvp`.

- [ ] **Step 8: Deploy and verify Vercel production**

  Deploy the same HEAD to project `prj_B8AdbunhhoUgT1MYU8dXhcFr036b` under team `team_UqNAq7UGoE0hxsNKrcaUekZQ`. Require deployment state `READY`, open `https://pokemon-trainer-manager.vercel.app`, register one disposable Pokémon through all seven steps, verify list/detail/Tera/Gmax/stats/PP, then delete the disposable row and prove zero test residue. If the application deployment fails, restore the prior Vercel production deployment while leaving the backward-compatible nullable/defaulted database additions in place; never delete existing user rows as rollback.

- [ ] **Step 9: Record final evidence**

  Capture commit SHA, migration version, publication counts, deployment ID/URL, production smoke-test result, and clean `git status --short`. Do not call the deployment complete if any live check was skipped.
