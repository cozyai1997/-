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
- `src/components/pokemon/pokemon-stat-table.tsx`: 종족값 Base Stats·개체값 IV (원본)·적용 IV (왕관 보정 포함)·노력치 EV·실제 능력치 Stats 표.
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

  Read `FormEN`, six `Base*` columns, `BattleOnly`, and each species JSON once. Build each normal form from the top-level JSON stats and empty aspects; match all 473 derived CSV rows to raw JSON by `FormEN === forms[].name`. Reject a CSV/raw battle-only disagreement, then resolve stats before building Tera and Gmax rows. Map Stellar to `{ id: 'stellar', nameKo: '스텔라', referenceTypeId: null, sortOrder: 18 }` without adding it to `types` or `typeMatchups`; the 19 Tera rows use canonical zero-based orders `0..18`.

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

  Enable RLS on all three tables. Explicitly revoke every table privilege inherited by `anon` and `authenticated`, then grant authenticated only active-publication SELECT and service role the publication privileges. This explicit revoke is required because platform default ACLs can otherwise leave `TRUNCATE`, `REFERENCES`, or `TRIGGER`, which RLS does not block. Revoke PUBLIC/anon/authenticated execution from every new private or service function.

- [ ] **Step 4: Implement DB invariants and atomic replacement**

  `private.validate_reference_form_gigantamax_option()` must reject cross-species links, battle-only sources, and non-battle-only targets. Replace the old overload with `replace_pokemon_option_filter_reference_data(uuid, uuid, text, text)` so it validates the authenticated candidate digest/version, all nine staging kinds, and exact production counts before any replacement, then updates form profiles/natures and replaces Tera/Gmax rows in the same transaction.

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
  개체값 IV (원본): 태어날 때 정해지는 0~31 수치
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
  $referenceSource = (Resolve-Path '<trusted-source-folder>').Path
  pnpm data:import -- --source $referenceSource --output .reference-data/candidate.json
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

- [ ] **Step 6: Commit, push, and pin the release SHA before any production write**

  Finish all local commits first. Require the feature branch, a clean worktree, and the exact linked project ref. Push and prove the remote branch resolves to the same immutable SHA before running any Supabase migration or data command:

  ```powershell
  $branch = (git branch --show-current).Trim()
  if ($branch -ne 'feat/pokemon-trainer-manager-mvp') { throw "잘못된 release branch: $branch" }
  if (git status --porcelain) { throw 'release 전 worktree가 clean이 아닙니다.' }
  $linkedRef = (Get-Content -LiteralPath 'supabase/.temp/project-ref' -Raw).Trim()
  if ($linkedRef -ne 'ipbqrgsdkoqtuqgnewrs') { throw "잘못된 linked Supabase ref: $linkedRef" }

  git push origin feat/pokemon-trainer-manager-mvp
  if ($LASTEXITCODE -ne 0) { throw 'GitHub push 실패' }
  $releaseSha = (git rev-parse HEAD).Trim()
  $remoteSha = ((git ls-remote origin refs/heads/feat/pokemon-trainer-manager-mvp) -split '\s+')[0]
  if ($releaseSha -notmatch '^[0-9a-f]{40}$' -or $releaseSha -ne $remoteSha) {
    throw "local/remote SHA 불일치: local=$releaseSha remote=$remoteSha"
  }
  if (git status --porcelain) { throw 'push 후 worktree가 clean이 아닙니다.' }
  ```

  Do not continue to Step 7 if any check fails. This ordering is mandatory: Git commit/push and local `HEAD == remote SHA` occur before the first production write. Run Steps 6–9 in the same PowerShell session; after any interruption, re-enter the reviewed 40-hex `$releaseSha` and repeat every clean/ref/local/remote equality check before resuming.

- [ ] **Step 7: Migrate and publish the same-version authenticated artifact**

  Re-check the pinned SHA, clean worktree, and linked ref. Before migration, read the active publication and require the reviewed existing same-version snapshot. After migration, run the same preflight again and require byte-for-byte-equivalent JSON. Do not require new base-stat/Tera/Gmax rows at this point because the option publication has not populated them yet. The reviewed pre-publication counts are `types=18`, `species=1,025`, `forms=1,498`, `abilities=310`, `items=332`, `natures=25`, `evolutions=480`, `typeMatchups=324`, `moves=826`, `formAbilities=3,055`, and `learnsets=116,519`.

  ```powershell
  if ((git rev-parse HEAD).Trim() -ne $releaseSha -or (git status --porcelain)) {
    throw '검증된 release SHA/worktree 상태가 변경되었습니다.'
  }
  $currentRemoteSha = ((git ls-remote origin refs/heads/feat/pokemon-trainer-manager-mvp) -split '\s+')[0]
  if ($currentRemoteSha -ne $releaseSha) { throw 'production write 직전 remote SHA가 변경되었습니다.' }
  if ((Get-Content -LiteralPath 'supabase/.temp/project-ref' -Raw).Trim() -ne 'ipbqrgsdkoqtuqgnewrs') {
    throw 'linked Supabase project가 검토된 ref와 다릅니다.'
  }
  function Invoke-LinkedJsonQuery([string]$Sql) {
    $queryFile = Join-Path ([IO.Path]::GetTempPath()) ("pokemon-linked-query-{0}.sql" -f [guid]::NewGuid().ToString('N'))
    try {
      [IO.File]::WriteAllText($queryFile, $Sql, [Text.UTF8Encoding]::new($false))
      $raw = pnpm exec supabase db query --linked --agent no --output-format json --file $queryFile
      $queryExit = $LASTEXITCODE
      if ($queryExit -ne 0) { throw "linked SQL 실패: $queryExit" }
      return @($raw | ConvertFrom-Json)
    } finally {
      if (Test-Path -LiteralPath $queryFile) { Remove-Item -LiteralPath $queryFile -Force }
      if (Test-Path -LiteralPath "$queryFile.tmp") { Remove-Item -LiteralPath "$queryFile.tmp" -Force }
    }
  }

  # Do not trust an earlier ignored artifact. Re-import and validate immediately before release.
  $referenceSource = (Resolve-Path '<trusted-source-folder>').Path
  pnpm data:import -- --source $referenceSource --output .reference-data/candidate.json
  if ($LASTEXITCODE -ne 0) { throw 'fresh candidate import 실패' }
  pnpm data:validate -- --input .reference-data/candidate.json --report .reference-data/validation-report.json
  if ($LASTEXITCODE -ne 0) { throw 'fresh candidate validation 실패' }
  $candidate = Get-Content -LiteralPath '.reference-data/candidate.json' -Raw | ConvertFrom-Json
  $validationArtifact = Get-Content -LiteralPath '.reference-data/validation-report.json' -Raw | ConvertFrom-Json
  if (-not $validationArtifact.valid -or $candidate.version -ne 'Cobbleverse 1.7.42+Cobblemon 1.7.3' -or
      $validationArtifact.version -ne $candidate.version -or @($validationArtifact.sourceDiagnostics).Count -ne 2 -or
      @($candidate.battleOnlyDiagnostics).Count -ne 9 -or
      @($candidate.forms).Count -ne 1498 -or @($candidate.forms | Where-Object { -not $_.isBattleOnly }).Count -ne 1334 -or
      @($candidate.forms | Where-Object isBattleOnly).Count -ne 164 -or @($candidate.teraTypes).Count -ne 19 -or
      @($candidate.formTeraOptions).Count -ne 25184 -or @($candidate.formGigantamaxOptions).Count -ne 42) {
    throw 'fresh candidate/version/battle counts가 검토된 release와 다릅니다.'
  }
  $expectedArtifactRows = [ordered]@{
    types=18; species=1025; forms=1498; abilities=310; moves=826; learnsets=116519;
    items=615; evolutions=602; formAbilities=3055; natures=25; typeMatchups=324
  }
  foreach ($entry in $expectedArtifactRows.GetEnumerator()) {
    if ([int]$validationArtifact.rowCounts.PSObject.Properties[$entry.Key].Value -ne $entry.Value) {
      throw "fresh validation row count 불일치: $($entry.Key)"
    }
  }
  $candidateFileHash = (Get-FileHash -LiteralPath '.reference-data/candidate.json' -Algorithm SHA256).Hash
  $reportFileHash = (Get-FileHash -LiteralPath '.reference-data/validation-report.json' -Algorithm SHA256).Hash
  $candidateDigest = [string]$validationArtifact.candidateDigest
  if ($candidateDigest -notmatch '^[0-9a-f]{64}$') { throw 'candidate digest가 없습니다.' }

  $activeSql = @"
  select publication.id, publication.version,
    (select count(*) from public.reference_types where publication_id = publication.id and is_active) as types,
    (select count(*) from public.reference_species where publication_id = publication.id and is_active) as species,
    (select count(*) from public.reference_forms where publication_id = publication.id and is_active) as forms,
    (select count(*) from public.reference_abilities where publication_id = publication.id and is_active) as abilities,
    (select count(*) from public.reference_items where publication_id = publication.id and is_active) as items,
    (select count(*) from public.reference_natures where publication_id = publication.id and is_active) as natures,
    (select count(*) from public.reference_evolution_rules where publication_id = publication.id) as evolutions,
    (select count(*) from public.reference_type_matchups where publication_id = publication.id) as type_matchups,
    (select count(*) from public.reference_moves where publication_id = publication.id and is_active) as moves,
    (select count(*) from public.reference_form_abilities where publication_id = publication.id) as form_abilities,
    (select count(*) from public.reference_move_learnsets where publication_id = publication.id) as learnsets
  from public.data_publications as publication where publication.status = 'active'
  "@
  $expectedBefore = [ordered]@{
    types=18; species=1025; forms=1498; abilities=310; items=332; natures=25;
    evolutions=480; type_matchups=324; moves=826; form_abilities=3055; learnsets=116519
  }
  function Read-ActiveSnapshot {
    $rows = @(Invoke-LinkedJsonQuery $activeSql)
    if ($rows.Count -ne 1 -or $rows[0].version -ne 'Cobbleverse 1.7.42+Cobblemon 1.7.3') {
      throw '운영 active publication이 검토된 동일 version 한 건이 아닙니다.'
    }
    foreach ($entry in $expectedBefore.GetEnumerator()) {
      if ([int]$rows[0].PSObject.Properties[$entry.Key].Value -ne $entry.Value) {
        throw "운영 사전 수량 불일치: $($entry.Key)"
      }
    }
    return $rows[0]
  }
  $beforeMigration = Read-ActiveSnapshot
  $dryRun = pnpm exec supabase db push --dry-run --linked --skip-vault --agent no --yes 2>&1
  if ($LASTEXITCODE -ne 0) { throw 'production migration dry-run 실패' }
  $pendingMigrations = @([regex]::Matches(
    ($dryRun -join "`n"),
    '(?<![0-9A-Za-z_])([0-9]{14}_[0-9A-Za-z_-]+\.sql)(?![0-9A-Za-z_-])'
  ) | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique)
  if ($pendingMigrations.Count -ne 1 -or $pendingMigrations[0] -ne '20260824123000_pokemon_battle_data.sql') {
    throw "검토되지 않은 migration pending set: $($pendingMigrations -join ',')"
  }
  pnpm exec supabase db push --linked --skip-vault --agent no --yes
  if ($LASTEXITCODE -ne 0) { throw 'production migration 실패' }
  $migrationRows = @(Invoke-LinkedJsonQuery "select count(*)::int as applied from supabase_migrations.schema_migrations where version='20260824123000'")
  if ($migrationRows.Count -ne 1 -or [int]$migrationRows[0].applied -ne 1) {
    throw '검토된 migration version이 remote history에 없습니다.'
  }
  $afterMigration = Read-ActiveSnapshot
  if (($beforeMigration | ConvertTo-Json -Compress) -ne ($afterMigration | ConvertTo-Json -Compress)) {
    throw 'migration이 기존 active publication/version/counts를 변경했습니다.'
  }
  ```

  Before the first core write, require the global option staging table to be empty. Reserve an exclusive publication window with no concurrent option publisher. Generate a new authenticated core SQL file for this release only. Execute that exact file with `--file`, then publish options from the same candidate/source. Never reuse `.reference-data/core-publication.sql` or another earlier artifact. Always remove both final and `.tmp` in `finally`:

  ```powershell
  $validationArtifact = Get-Content -LiteralPath '.reference-data/validation-report.json' -Raw | ConvertFrom-Json
  $candidateDigest = [string]$validationArtifact.candidateDigest
  if ($candidateDigest -notmatch '^[0-9a-f]{64}$') { throw 'candidate digest가 없습니다.' }
  function Assert-GlobalOptionStagingEmpty([string]$Phase) {
    $rows = @(Invoke-LinkedJsonQuery 'select count(*)::int as staging from public.reference_option_filter_publication_staging')
    if ($rows.Count -ne 1 -or [int]$rows[0].staging -ne 0) {
      throw "$Phase 전역 option staging이 0이 아닙니다. 다른 publisher와 동시에 진행하지 마세요."
    }
  }
  $coreSql = Join-Path ([IO.Path]::GetTempPath()) ("pokemon-core-publication-{0}.sql" -f [guid]::NewGuid().ToString('N'))
  $coreSqlTmp = "$coreSql.tmp"
  try {
    pnpm data:publish:core -- --input .reference-data/candidate.json --source $referenceSource --output $coreSql
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $coreSql) -or (Test-Path -LiteralPath $coreSqlTmp)) {
      throw 'fresh authenticated 핵심 게시 SQL 생성 실패'
    }
    $coreSqlHash = (Get-FileHash -LiteralPath $coreSql -Algorithm SHA256).Hash
    Assert-GlobalOptionStagingEmpty 'core write'
    pnpm exec supabase db query --linked --agent no --file $coreSql
    if ($LASTEXITCODE -ne 0) { throw '핵심 게시 SQL 실행 실패' }
    if ((Get-FileHash -LiteralPath $coreSql -Algorithm SHA256).Hash -ne $coreSqlHash) {
      throw '게시 SQL 파일이 실행 전후 변경되었습니다.'
    }
    if ((Get-FileHash -LiteralPath '.reference-data/candidate.json' -Algorithm SHA256).Hash -ne $candidateFileHash -or
        (Get-FileHash -LiteralPath '.reference-data/validation-report.json' -Algorithm SHA256).Hash -ne $reportFileHash) {
      throw 'core 게시 중 candidate/report 파일이 변경되었습니다.'
    }
    $productionApiUrl = ([string]$env:SUPABASE_URL).TrimEnd('/')
    if ($productionApiUrl -ne 'https://ipbqrgsdkoqtuqgnewrs.supabase.co' -or
        [string]::IsNullOrWhiteSpace($env:SUPABASE_SERVICE_ROLE_KEY)) {
      throw 'option publisher의 production Supabase URL/key precondition 실패'
    }
    pnpm data:publish:option-filters -- --input .reference-data/candidate.json --source $referenceSource
    $optionExit = $LASTEXITCODE
    if ($optionExit -ne 0) {
      $remainingBatches = @(Invoke-LinkedJsonQuery @"
  select staging.batch_id, staging.publication_id, publication.version, publication.status,
    count(*)::int as staged_rows
  from public.reference_option_filter_publication_staging staging
  join public.data_publications publication on publication.id=staging.publication_id
  group by staging.batch_id, staging.publication_id, publication.version, publication.status
  order by staging.batch_id, staging.publication_id
  "@)
      if ($remainingBatches.Count -ne 0) {
        $remainingBatchState = $remainingBatches | ConvertTo-Json -Depth 5 -Compress
        Write-Warning "option 실패 후 소유권을 증명할 수 없는 staging residue: $remainingBatchState"
        throw 'publisher의 exact-batch cleanup이 완료되지 않았습니다. 운영 절차는 batch 소유권을 추정하거나 어떤 행도 삭제하지 않습니다; partial-core/no-deploy 상태로 중단하고 별도 진단하세요.'
      }
      Assert-GlobalOptionStagingEmpty 'option failure cleanup'
      throw "option publish exit $optionExit; core만 갱신된 partial-core 상태이므로 deploy 금지"
    }
    Assert-GlobalOptionStagingEmpty 'option success'
    if ((Get-FileHash -LiteralPath '.reference-data/candidate.json' -Algorithm SHA256).Hash -ne $candidateFileHash -or
        (Get-FileHash -LiteralPath '.reference-data/validation-report.json' -Algorithm SHA256).Hash -ne $reportFileHash -or
        (Get-FileHash -LiteralPath $coreSql -Algorithm SHA256).Hash -ne $coreSqlHash) {
      throw 'option 게시 중 release artifact가 변경되었습니다.'
    }
  } finally {
    foreach ($artifact in @($coreSql, $coreSqlTmp)) {
      if (Test-Path -LiteralPath $artifact) {
        Remove-Item -LiteralPath $artifact -Force -ErrorAction SilentlyContinue
      }
    }
    $remainingCoreArtifacts = @($coreSql, $coreSqlTmp) | Where-Object { Test-Path -LiteralPath $_ }
    if ($remainingCoreArtifacts.Count -ne 0) {
      throw "core SQL release artifact cleanup 실패: $($remainingCoreArtifacts -join ', ')"
    }
  }
  ```

  If option publication fails after the core transaction commits, record the database as a **partial-core state**. Do not deploy and do not publish a different version or candidate. The publisher itself attempts cleanup using its caller-owned exact `batch_id + publication_id`; if that cleanup also fails, its `AggregateError` preserves both failures. The operational failure branch independently diagnoses global residue but never infers ownership from row count, version, or active status and never deletes an unidentified batch. It proves global staging zero when publisher cleanup succeeded; otherwise it surfaces the batch state and halts for separate diagnosis. Retry only from the same pinned local/remote SHA after freshly re-importing and re-authenticating the same candidate/source; full digest/count/RLS/catalog postflight remains mandatory before Step 8.

  Run an executable postflight. Require the exact active version, validator and all three digests, the full published counts, `602 = 600 + 2` evolution accounting, and total staging residue zero:

  ```powershell
  $postflightSql = @"
  select publication.version,
    publication.validation_report -> 'valid' = 'true'::jsonb as validator_valid,
    publication.validation_report ->> 'candidateDigest' as candidate_digest,
    publication.validation_report #>> '{authentication,candidateDigest}' as authenticated_candidate_digest,
    publication.validation_report #>> '{authentication,trustedSourceDigest}' as trusted_source_digest,
    (publication.validation_report #>> '{authentication,evolutionAccounting,sourceCount}')::int as source_evolutions,
    (publication.validation_report #>> '{authentication,evolutionAccounting,publishableCount}')::int as publishable_evolutions,
    (publication.validation_report #>> '{authentication,evolutionAccounting,excludedMissingTargetCount}')::int as missing_targets,
    (select count(*) from public.reference_types where publication_id=publication.id and is_active) as types,
    (select count(*) from public.reference_species where publication_id=publication.id and is_active) as species,
    (select count(*) from public.reference_forms where publication_id=publication.id and is_active) as forms,
    (select count(*) from public.reference_forms where publication_id=publication.id and is_active and not is_battle_only) as playable,
    (select count(*) from public.reference_forms where publication_id=publication.id and is_active and is_battle_only) as battle_only,
    (select count(*) from public.reference_forms where publication_id=publication.id and is_active and base_hp is not null and base_attack is not null and base_defense is not null and base_special_attack is not null and base_special_defense is not null and base_speed is not null) as complete_stats,
    (select count(*) from public.reference_abilities where publication_id=publication.id and is_active) as abilities,
    (select count(*) from public.reference_items where publication_id=publication.id and is_active) as items,
    (select count(*) from public.reference_natures where publication_id=publication.id and is_active) as natures,
    (select count(*) from public.reference_evolution_rules where publication_id=publication.id) as evolutions,
    (select count(*) from public.reference_type_matchups where publication_id=publication.id) as type_matchups,
    (select count(*) from public.reference_moves where publication_id=publication.id and is_active) as moves,
    (select count(*) from public.reference_form_abilities where publication_id=publication.id) as form_abilities,
    (select count(*) from public.reference_move_learnsets where publication_id=publication.id) as learnsets,
    (select count(*) from public.reference_tera_types where publication_id=publication.id and is_active) as tera_types,
    (select count(*) from public.reference_form_tera_options where publication_id=publication.id) as form_tera,
    (select count(*) from public.reference_form_gigantamax_options where publication_id=publication.id) as gmax,
    (select count(*) from public.reference_option_filter_publication_staging) as staging
  from public.data_publications as publication where publication.status='active'
  "@
  $postRows = @(Invoke-LinkedJsonQuery $postflightSql)
  if ($postRows.Count -ne 1) { throw 'active publication은 정확히 한 건이어야 합니다.' }
  $post = $postRows[0]
  $expectedAfter = [ordered]@{
    types=18; species=1025; forms=1498; playable=1334; battle_only=164; complete_stats=1498;
    abilities=310; items=615; natures=25; evolutions=600; type_matchups=324; moves=826;
    form_abilities=3055; learnsets=116519; tera_types=19; form_tera=25184; gmax=42; staging=0;
    source_evolutions=602; publishable_evolutions=600; missing_targets=2
  }
  if ($post.version -ne 'Cobbleverse 1.7.42+Cobblemon 1.7.3' -or -not $post.validator_valid) {
    throw 'postflight version/validator 불일치'
  }
  foreach ($name in @('candidate_digest','authenticated_candidate_digest','trusted_source_digest')) {
    if ($post.PSObject.Properties[$name].Value -ne $candidateDigest) { throw "postflight digest 불일치: $name" }
  }
  foreach ($entry in $expectedAfter.GetEnumerator()) {
    if ([int]$post.PSObject.Properties[$entry.Key].Value -ne $entry.Value) { throw "postflight count 불일치: $($entry.Key)" }
  }
  ```

  Run a read-only catalog and privilege gate before the operating-user check. It requires RLS on all three new tables; one exact authenticated active-read policy per table; no anon SELECT; no anon/authenticated INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, or TRIGGER; the old two-argument RPC absent; and no non-owner EXECUTE grant except `service_role` on the four-argument RPC:

  ```powershell
  $catalogSql = @"
  with expected_tables(table_name, policy_name) as (values
    ('reference_tera_types', 'authenticated read active tera types'),
    ('reference_form_tera_options', 'authenticated read active form tera options'),
    ('reference_form_gigantamax_options', 'authenticated read active gigantamax options')
  ), table_state as (
    select expected.table_name, expected.policy_name, class.oid as table_oid,
      class.relrowsecurity, policy.oid as policy_oid, policy.polcmd, policy.polroles,
      policy.polwithcheck, pg_get_expr(policy.polqual, policy.polrelid) as policy_qual,
      count(policy.oid) over (partition by expected.table_name) as policy_count
    from expected_tables expected
    left join pg_namespace namespace on namespace.nspname='public'
    left join pg_class class on class.relnamespace=namespace.oid and class.relname=expected.table_name
    left join pg_policy policy on policy.polrelid=class.oid
  ), table_issues as (
    select 'table:' || table_name || ':missing-or-rls' as issue from table_state
    where table_oid is null or not coalesce(relrowsecurity,false)
    union all select 'table:' || table_name || ':policy-count' from table_state where policy_count <> 1
    union all select 'table:' || table_name || ':policy-contract' from table_state
    where policy_count=1 and (
      (select polname from pg_policy where oid=policy_oid) is distinct from policy_name
      or polcmd is distinct from 'r' or polwithcheck is not null
      or (select array_agg(role.rolname order by role.rolname)
          from unnest(polroles) role_oid join pg_roles role on role.oid=role_oid)
         is distinct from array['authenticated']::name[]
      or regexp_replace(policy_qual,'\s+','','g') not like
         '%publication.id=' || table_name || '.publication_id%publication.status=''active''::publication_status%'
    )
  ), privilege_issues as (
    select 'privilege:' || expected.table_name || ':' || role.rolname as issue
    from expected_tables expected cross join pg_roles role
    where role.rolname in ('anon','authenticated') and (
      has_table_privilege(role.oid,'public.' || expected.table_name,'insert')
      or has_table_privilege(role.oid,'public.' || expected.table_name,'update')
      or has_table_privilege(role.oid,'public.' || expected.table_name,'delete')
      or has_table_privilege(role.oid,'public.' || expected.table_name,'truncate')
      or has_table_privilege(role.oid,'public.' || expected.table_name,'references')
      or has_table_privilege(role.oid,'public.' || expected.table_name,'trigger')
      or (role.rolname='anon' and has_table_privilege(role.oid,'public.' || expected.table_name,'select'))
      or (role.rolname='authenticated' and not has_table_privilege(role.oid,'public.' || expected.table_name,'select'))
    )
  ), rpc_state as (
    select to_regprocedure('public.replace_pokemon_option_filter_reference_data(uuid,uuid,text,text)') as current_rpc,
      to_regprocedure('public.replace_pokemon_option_filter_reference_data(uuid,uuid)') as old_rpc
  ), rpc_issues as (
    select 'rpc:signature' as issue from rpc_state where current_rpc is null or old_rpc is not null
    union all
    select 'rpc:execute:' || role.rolname from rpc_state cross join pg_roles role
    where role.rolname in ('anon','authenticated','service_role') and
      ((role.rolname='service_role') is distinct from has_function_privilege(role.oid,current_rpc,'execute'))
    union all
    select 'rpc:unexpected-explicit-execute' from rpc_state
    join pg_proc function on function.oid=current_rpc
    where exists (
      select 1 from aclexplode(coalesce(function.proacl,acldefault('f',function.proowner))) privilege
      where privilege.privilege_type='EXECUTE' and privilege.grantee <> function.proowner
        and privilege.grantee <> (select oid from pg_roles where rolname='service_role')
    )
  )
  select issue from table_issues
  union all select issue from privilege_issues
  union all select issue from rpc_issues
  order by issue
  "@
  $catalogIssues = @(Invoke-LinkedJsonQuery $catalogSql)
  if ($catalogIssues.Count -ne 0) {
    throw "RLS/catalog privilege postflight 실패: $($catalogIssues.issue -join ', ')"
  }
  $rlsCatalogPostflight = 'passed'
  ```

  Finally execute an authenticated-role RLS gate inside a rolled-back transaction; exit nonzero on any invisible active reference collection:

  ```powershell
  $rlsSql = @"
  begin;
  set local role authenticated;
  select set_config('request.jwt.claim.role','authenticated',true), set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
  do `$rls`$
  declare active_id uuid;
  begin
    select id into strict active_id from public.data_publications where status='active';
    if (select count(*) from public.reference_types where publication_id=active_id and is_active) <> 18
       or (select count(*) from public.reference_species where publication_id=active_id and is_active) <> 1025
       or (select count(*) from public.reference_forms where publication_id=active_id and is_active) <> 1498
       or (select count(*) from public.reference_forms where publication_id=active_id and is_active and not is_battle_only) <> 1334
       or (select count(*) from public.reference_forms where publication_id=active_id and is_active and is_battle_only) <> 164
       or (select count(*) from public.reference_forms where publication_id=active_id and is_active and base_hp is not null and base_attack is not null and base_defense is not null and base_special_attack is not null and base_special_defense is not null and base_speed is not null) <> 1498
       or (select count(*) from public.reference_abilities where publication_id=active_id and is_active) <> 310
       or (select count(*) from public.reference_items where publication_id=active_id and is_active) <> 615
       or (select count(*) from public.reference_natures where publication_id=active_id and is_active) <> 25
       or (select count(*) from public.reference_evolution_rules where publication_id=active_id) <> 600
       or (select count(*) from public.reference_type_matchups where publication_id=active_id) <> 324
       or (select count(*) from public.reference_moves where publication_id=active_id and is_active) <> 826
       or (select count(*) from public.reference_form_abilities where publication_id=active_id) <> 3055
       or (select count(*) from public.reference_move_learnsets where publication_id=active_id) <> 116519
       or (select count(*) from public.reference_tera_types where publication_id=active_id and is_active) <> 19
       or (select count(*) from public.reference_form_tera_options where publication_id=active_id) <> 25184
       or (select count(*) from public.reference_form_gigantamax_options where publication_id=active_id) <> 42 then
      raise exception 'authenticated RLS active-reference read mismatch';
    end if;
  end
  `$rls`$;
  rollback;
  "@
  $rlsSqlFile = Join-Path ([IO.Path]::GetTempPath()) ("pokemon-rls-postflight-{0}.sql" -f [guid]::NewGuid().ToString('N'))
  try {
    [IO.File]::WriteAllText($rlsSqlFile, $rlsSql, [Text.UTF8Encoding]::new($false))
    pnpm exec supabase db query --linked --agent no --file $rlsSqlFile
    if ($LASTEXITCODE -ne 0) { throw 'authenticated RLS postflight 실패' }
    $rlsPostflight = 'passed'
  } finally {
    if (Test-Path -LiteralPath $rlsSqlFile) { Remove-Item -LiteralPath $rlsSqlFile -Force }
    if (Test-Path -LiteralPath "$rlsSqlFile.tmp") { Remove-Item -LiteralPath "$rlsSqlFile.tmp" -Force }
  }
  ```

- [ ] **Step 8: Deploy and verify Vercel production**

  Use the reviewed Vercel CLI `59.5.0` with its cached login; do not require or accept a `VERCEL_TOKEN`. Pin the current canonical production deployment ID and immutable URL before creating anything. Remove only the repository's ordinary, non-link `.vercel/output`, pull production settings, then re-check the project/team link and clean local/remote release SHA. Build a fresh production prebuilt artifact and deploy it with `--skip-domain`, so the canonical alias cannot move before the staged smoke passes. The explicit `meta.releaseCommit` is authoritative because `gitSource.sha` is nullable for prebuilt deployments; cross-check optional Git metadata only when Vercel returns it:

  ```powershell
  $vercelScope = 'masterasset'
  $vercelTeamId = 'team_UqNAq7UGoE0hxsNKrcaUekZQ'
  $vercelProjectId = 'prj_B8AdbunhhoUgT1MYU8dXhcFr036b'
  $vercelProjectName = 'pokemon-trainer-manager'
  $canonicalAlias = 'pokemon-trainer-manager.vercel.app'
  $releaseBranch = 'feat/pokemon-trainer-manager-mvp'
  if ($releaseSha -notmatch '^[0-9a-f]{40}$') { throw 'releaseSha가 고정되지 않았습니다.' }
  $vercelVersionLines = @(& pnpm dlx vercel@59.5.0 --version)
  if ($LASTEXITCODE -ne 0) { throw 'pinned Vercel CLI version 조회 실패' }
  $vercelCliVersion = (($vercelVersionLines -join "`n").Trim())
  if ($vercelCliVersion -ne '59.5.0') { throw "Vercel CLI version 불일치: $vercelCliVersion" }
  if (-not [string]::IsNullOrWhiteSpace($env:VERCEL_TOKEN)) {
    throw '이 절차는 VERCEL_TOKEN이 아닌 검증된 cached auth만 사용합니다.'
  }
  if (-not [string]::IsNullOrWhiteSpace($env:VERCEL_ORG_ID) -and $env:VERCEL_ORG_ID -ne $vercelTeamId) {
    throw 'VERCEL_ORG_ID가 승인된 team과 다릅니다.'
  }
  if (-not [string]::IsNullOrWhiteSpace($env:VERCEL_PROJECT_ID) -and $env:VERCEL_PROJECT_ID -ne $vercelProjectId) {
    throw 'VERCEL_PROJECT_ID가 승인된 project와 다릅니다.'
  }

  function Invoke-PinnedVercelJson {
    param([Parameter(Mandatory)][string[]]$Arguments)
    $rawLines = @(& pnpm dlx vercel@59.5.0 @Arguments --scope $vercelScope --non-interactive)
    if ($LASTEXITCODE -ne 0) { throw "Vercel CLI 실패(exit $LASTEXITCODE): $($Arguments -join ' ')" }
    try { return (($rawLines -join "`n") | ConvertFrom-Json) }
    catch { throw "Vercel JSON 파싱 실패: $($Arguments -join ' ')" }
  }
  function Invoke-PinnedVercel {
    param([Parameter(Mandatory)][string[]]$Arguments)
    & pnpm dlx vercel@59.5.0 @Arguments --scope $vercelScope --non-interactive
    if ($LASTEXITCODE -ne 0) { throw "Vercel CLI 실패(exit $LASTEXITCODE): $($Arguments -join ' ')" }
  }
  function Get-VercelProjectApi {
    Invoke-PinnedVercelJson -Arguments @('api', "/v9/projects/${vercelProjectId}?teamId=${vercelTeamId}", '--raw')
  }
  function Get-VercelDeploymentApi {
    param([Parameter(Mandatory)][string]$DeploymentId)
    Invoke-PinnedVercelJson -Arguments @('api', "/v13/deployments/$([uri]::EscapeDataString($DeploymentId))?teamId=${vercelTeamId}", '--raw')
  }
  function Assert-ReleaseGitState {
    $headSha = (& git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'git HEAD 조회 실패' }
    $remoteLines = @(& git ls-remote origin "refs/heads/$releaseBranch")
    if ($LASTEXITCODE -ne 0 -or $remoteLines.Count -ne 1) { throw 'release remote SHA 조회 실패' }
    $remoteMatch = [regex]::Match($remoteLines[0], "^([0-9a-f]{40})\s+$([regex]::Escape("refs/heads/$releaseBranch"))$")
    $dirty = @(& git status --porcelain=v1 --untracked-files=normal)
    if (-not $remoteMatch.Success -or $LASTEXITCODE -ne 0 -or $headSha -ne $releaseSha -or
        $remoteMatch.Groups[1].Value -ne $releaseSha -or $dirty.Count -ne 0) {
      throw 'release SHA/local-remote/worktree precondition 실패'
    }
  }
  function Assert-VercelLinkAndTeam {
    $link = Get-Content -LiteralPath '.vercel/project.json' -Raw | ConvertFrom-Json
    if ($link.projectId -ne $vercelProjectId -or $link.orgId -ne $vercelTeamId -or
        $link.projectName -ne $vercelProjectName) { throw '로컬 Vercel link 불일치' }
    $identity = Invoke-PinnedVercelJson -Arguments @('whoami', '--json')
    if ($identity.team.id -ne $vercelTeamId -or $identity.team.slug -ne $vercelScope) {
      throw 'cached-auth Vercel team 불일치'
    }
    $remoteProject = Get-VercelProjectApi
    if ($remoteProject.id -ne $vercelProjectId -or $remoteProject.accountId -ne $vercelTeamId -or
        $remoteProject.name -ne $vercelProjectName) { throw '원격 Vercel project 불일치' }
  }
  function Get-CanonicalInspection {
    Invoke-PinnedVercelJson -Arguments @('inspect', $canonicalAlias, '--json', '--wait', '--timeout', '3m')
  }
  function Assert-CanonicalDeployment {
    param([Parameter(Mandatory)][string]$ExpectedDeploymentId)
    $project = Get-VercelProjectApi
    $canonical = Get-CanonicalInspection
    if ($project.targets.production.id -ne $ExpectedDeploymentId -or $canonical.id -ne $ExpectedDeploymentId -or
        $canonical.target -ne 'production' -or $canonical.readyState -ne 'READY' -or
        @($canonical.aliases) -notcontains $canonicalAlias) {
      throw "canonical alias가 예상 deployment $ExpectedDeploymentId 를 가리키지 않습니다."
    }
  }
  function Remove-VerifiedVercelOutput {
    $repoRoot = (Resolve-Path -LiteralPath '.').ProviderPath
    $vercelRoot = [IO.Path]::GetFullPath((Join-Path $repoRoot '.vercel'))
    $outputPath = [IO.Path]::GetFullPath((Join-Path $vercelRoot 'output'))
    if (-not [StringComparer]::OrdinalIgnoreCase.Equals([IO.Path]::GetDirectoryName($outputPath), $vercelRoot) -or
        [IO.Path]::GetFileName($outputPath) -ne 'output') { throw 'Vercel output 삭제 대상 계산 실패' }
    if (Test-Path -LiteralPath $outputPath) {
      $outputItem = Get-Item -LiteralPath $outputPath -Force
      if (-not $outputItem.PSIsContainer -or -not [string]::IsNullOrWhiteSpace([string]$outputItem.LinkType)) {
        throw '.vercel/output이 일반 디렉터리가 아닙니다.'
      }
      $resolvedOutput = (Resolve-Path -LiteralPath $outputPath).ProviderPath
      if (-not [StringComparer]::OrdinalIgnoreCase.Equals($resolvedOutput, $outputPath)) {
        throw '.vercel/output resolved path 불일치'
      }
      Remove-Item -LiteralPath $resolvedOutput -Recurse -Force
    }
    if (Test-Path -LiteralPath $outputPath) { throw '.vercel/output 삭제 실패' }
  }

  Assert-ReleaseGitState
  Assert-VercelLinkAndTeam
  $previousProject = Get-VercelProjectApi
  $previousDeploymentId = [string]$previousProject.targets.production.id
  $previousDeploymentHost = [string]$previousProject.targets.production.url
  $previousDeploymentUrl = "https://$previousDeploymentHost"
  if ($previousDeploymentId -notmatch '^dpl_[A-Za-z0-9]+$' -or
      [string]::IsNullOrWhiteSpace($previousDeploymentHost) -or
      @($previousProject.targets.production.alias) -notcontains $canonicalAlias) {
    throw '기존 canonical production deployment를 고정하지 못했습니다.'
  }
  $previousDeployment = Get-VercelDeploymentApi $previousDeploymentId
  if ($previousDeployment.id -ne $previousDeploymentId -or $previousDeployment.url -ne $previousDeploymentHost -or
      $previousDeployment.projectId -ne $vercelProjectId -or $previousDeployment.ownerId -ne $vercelTeamId -or
      $previousDeployment.target -ne 'production' -or $previousDeployment.readyState -ne 'READY') {
    throw '고정한 이전 production deployment 검증 실패'
  }
  Assert-CanonicalDeployment $previousDeploymentId

  function Invoke-PinnedRollback {
    Invoke-PinnedVercel -Arguments @('rollback', $previousDeploymentId, '--yes', '--timeout', '3m')
    Assert-CanonicalDeployment $previousDeploymentId
    $rolledBackDeployment = Get-VercelDeploymentApi $previousDeploymentId
    if (@($rolledBackDeployment.alias) -notcontains $canonicalAlias) {
      throw 'rollback 후 canonical alias API 검증 실패'
    }
  }

  Remove-VerifiedVercelOutput
  Invoke-PinnedVercel -Arguments @('pull', '--environment=production', '--project', $vercelProjectId, '--yes')
  Assert-VercelLinkAndTeam
  Assert-ReleaseGitState
  Assert-CanonicalDeployment $previousDeploymentId
  try {
    Invoke-PinnedVercel -Arguments @('build', '--prod', '--project', $vercelProjectId, '--yes')
    if (-not (Test-Path -LiteralPath '.vercel/output/config.json' -PathType Leaf)) {
      throw 'Vercel prebuilt output/config.json이 없습니다.'
    }
    Assert-VercelLinkAndTeam
    Assert-ReleaseGitState
    Assert-CanonicalDeployment $previousDeploymentId
    $deployEnvelope = Invoke-PinnedVercelJson -Arguments @(
      'deploy', '--prebuilt', '--prod', '--skip-domain', '--json',
      '--meta', "releaseCommit=$releaseSha", '--project', $vercelProjectId, '--yes'
    )
    if ($deployEnvelope.status -and $deployEnvelope.status -ne 'ok') { throw 'Vercel deploy JSON status 실패' }
    $stagedDeployment = if ($deployEnvelope.deployment) { $deployEnvelope.deployment } else { $deployEnvelope }
    $stagedDeploymentId = [string]$stagedDeployment.id
    try { $stagedUri = [uri]$stagedDeployment.url } catch { throw 'staged deployment URL 파싱 실패' }
    $stagedDeploymentUrl = $stagedUri.AbsoluteUri.TrimEnd('/')
    if ($stagedDeploymentId -notmatch '^dpl_[A-Za-z0-9]+$' -or $stagedUri.Scheme -ne 'https' -or
        $stagedDeployment.target -ne 'production' -or $stagedDeployment.readyState -ne 'READY') {
      throw 'staged deploy JSON 검증 실패'
    }
    $stagedInspection = Invoke-PinnedVercelJson -Arguments @(
      'inspect', $stagedDeploymentId, '--json', '--wait', '--timeout', '3m'
    )
    if ($stagedInspection.id -ne $stagedDeploymentId -or $stagedInspection.url -ne $stagedUri.Host -or
        $stagedInspection.target -ne 'production' -or $stagedInspection.readyState -ne 'READY') {
      throw 'staged deployment inspect --wait 검증 실패'
    }
    $stagedApi = Get-VercelDeploymentApi $stagedDeploymentId
    if ($stagedApi.id -ne $stagedDeploymentId -or $stagedApi.url -ne $stagedUri.Host -or
        $stagedApi.projectId -ne $vercelProjectId -or $stagedApi.ownerId -ne $vercelTeamId -or
        $stagedApi.target -ne 'production' -or $stagedApi.readyState -ne 'READY' -or
        $stagedApi.meta.releaseCommit -ne $releaseSha -or @($stagedApi.alias) -contains $canonicalAlias) {
      throw 'staged deployment API/project/meta/skip-domain 검증 실패'
    }
    foreach ($observedCommit in @([string]$stagedApi.gitSource.sha, [string]$stagedApi.meta.githubCommitSha)) {
      if (-not [string]::IsNullOrWhiteSpace($observedCommit) -and $observedCommit -ne $releaseSha) {
        throw 'Vercel optional Git metadata가 releaseSha와 다릅니다.'
      }
    }
    Assert-ReleaseGitState
    Assert-CanonicalDeployment $previousDeploymentId
    & pnpm dlx vercel@59.5.0 curl '/' --deployment $stagedDeploymentId --yes `
      --scope $vercelScope --non-interactive -- --fail --silent --show-error --output NUL
    if ($LASTEXITCODE -ne 0) { throw 'staged deployment HTTP health check 실패' }
  } finally {
    Remove-VerifiedVercelOutput
  }
  ```

  Never run Playwright/local E2E with production Supabase variables. Open only the exact immutable `$stagedDeploymentUrl`, never the canonical alias, and confirm the target string before creating data. Generate a nonce first, enter an exact disposable email containing that nonce, and create only that account in the staged app after `$smokeStartedAt` is recorded. The operator must complete every item in `$requiredSmokeEvidence` against one Pikachu smoke record; a single undifferentiated confirmation is forbidden. Each item records its assertion, exact confirmation token, UTC timestamp, and `passed` result in `$smokeEvidence`, which is included in final release evidence. Do not paste an auth or Pokémon UUID: the service-role cleanup resolves the exact email, verifies its creation time, and reads its owned Pokémon IDs before any deletion. Set `$smokeFlowPassed = 'passed'` only after every item succeeds.

  Before server cleanup, sign out the disposable session and clear its browser cookies/local storage because deleting an auth user does not revoke an already-issued JWT. Confirm that separately from the UI checks. The service-role client recursively enumerates only the server-verified `<smoke-user-uuid>/` prefix inside `private-pokemon-images`, removes the returned paths, hard-deletes that auth user so FK cascades finish, and only then deletes audit rows for that exact UUID. It never deletes `storage.objects` directly. Cleanup/API/temp-file failures are collected so the six-category residue query still runs whenever the authenticated identity was resolved; if no identity can be authenticated, stop without deleting any user. Flow and browser assertions run only after cleanup and proof:

  ```powershell
  $stagedSmokeScript = {
  try {
  Assert-CanonicalDeployment $previousDeploymentId
  $smokeFlowPassed = 'not-passed'
  $smokeBrowserCleared = 'not-cleared'
  $requiredSmokeEvidence = @(
    [ordered]@{
      key = 'sevenStepSave'
      assertion = '피카츄(도감번호 #0025, 일반)를 7단계에서 정확히 한 마리 저장하고 목록·상세에 같은 값이 표시됨'
    },
    [ordered]@{
      key = 'koreanAndPublicIdentity'
      assertion = '종·모습·특성·기술은 한국어만 표시되고 도감번호 #0025가 보이며 UUID·pikachu-normal·그 밖의 내부 form ID가 보이지 않음'
    },
    [ordered]@{
      key = 'abilityFiltering'
      assertion = '피카츄 특성에는 정전기·피뢰침만 허용되고 맹화는 선택지·목록·상세에 없음'
    },
    [ordered]@{
      key = 'moveFilteringAndPp'
      assertion = '피카츄 기술에는 10만볼트가 허용되고 화염방사는 없으며 선택·최종·상세에 기본 PP: 15가 정확히 표시됨'
    },
    [ordered]@{
      key = 'statTermsAndValues'
      assertion = '레벨 50·성실·개체값 IV (원본) 31·적용 IV (왕관 보정 포함) 31·노력치 EV 0에서 표의 HP/공격/방어/특수공격/특수방어/스피드가 각각 35/31/31/0/110, 55/31/31/0/75, 40/31/31/0/60, 50/31/31/0/70, 50/31/31/0/70, 90/31/31/0/110이고, glossary 네 쌍은 종족값 Base Stats: 그 포켓몬 종과 폼 자체가 가진 기본 능력치; 개체값 IV (원본): 태어날 때 정해지는 0~31 수치; 노력치 EV: 전투나 아이템으로 올리는 훈련 수치, 능력치당 최대 252; 실제 능력치 Stats: 현재 레벨에서 실제 전투에 적용되는 HP·공격·방어·특공·특방·스피드 숫자임'
    },
    [ordered]@{
      key = 'teraAndGigantamax'
      assertion = '전기 테라타입과 거다이맥스 인자를 저장하고 목록·최종·상세에 테라타입: 전기 및 거다이맥스 인자 보유가 표시됨'
    },
    [ordered]@{
      key = 'privateImageLifecycle'
      assertion = 'private image upload/read/delete를 수행해 업로드 후 목록·상세에서 같은 비공개 이미지를 읽고 등록 이미지 삭제 후 이미지가 다시 노출되지 않음'
    },
    [ordered]@{
      key = 'browserErrors'
      assertion = 'DevTools Preserve log 기준 smoke 시작부터 종료까지 uncaught console error 0건·실패 network 0건'
    }
  )
  $smokeEvidence = [ordered]@{}
  $openedSmokeTarget = (Read-Host "브라우저에서 정확히 $stagedDeploymentUrl 을 열었다면 해당 URL을 다시 입력").TrimEnd('/')
  if ($openedSmokeTarget -ne $stagedDeploymentUrl) {
    throw 'smoke 브라우저 대상이 staged deployment URL과 다릅니다.'
  }
  $smokeNonce = "pokemon-release-smoke-$([guid]::NewGuid().ToString('N'))"
  $smokeEmail = (Read-Host "사용할 disposable email 입력(반드시 $smokeNonce 포함)").Trim().ToLowerInvariant()
  if ([string]::IsNullOrWhiteSpace($smokeEmail) -or -not $smokeEmail.Contains($smokeNonce)) {
    throw 'smoke email이 release nonce와 결합되지 않았습니다.'
  }
  $smokeStartedAt = [DateTimeOffset]::UtcNow
  $verifiedSmokePokemonIds = @()
  $cleanupRows = @()
  try {
    # 지금부터 $stagedDeploymentUrl 앱에서 위 email로 계정 하나만 만들고 정확히 한 마리를 저장·검증한다.
    foreach ($requirement in $requiredSmokeEvidence) {
      $expectedToken = "PASS:$($requirement.key)"
      $confirmation = (Read-Host "[$($requirement.key)] $($requirement.assertion)`n확인 후 정확히 $expectedToken 입력").Trim()
      if ($confirmation -cne $expectedToken) {
        throw "production smoke 항목 검증 실패: $($requirement.key)"
      }
      $smokeEvidence[$requirement.key] = [ordered]@{
        assertion = $requirement.assertion
        confirmation = $expectedToken
        result = 'passed'
        verifiedAt = [DateTimeOffset]::UtcNow.ToString('o')
      }
    }
    if ($smokeEvidence.Count -ne $requiredSmokeEvidence.Count -or
        @($smokeEvidence.Values | Where-Object { $_.result -ne 'passed' }).Count -ne 0) {
      throw 'production smoke 항목별 증거가 완전하지 않습니다.'
    }
    $smokeFlowPassed = 'passed'
    $browserConfirmation = (Read-Host 'sign-out 후 해당 사이트 cookie/local storage를 지웠다면 SIGNED_OUT_AND_CLEARED 입력').Trim()
    if ($browserConfirmation -cne 'SIGNED_OUT_AND_CLEARED') { throw 'disposable browser session 정리가 확인되지 않았습니다.' }
    $smokeBrowserCleared = 'cleared'
  } finally {
    $cleanupScript = Join-Path '.reference-data' ("smoke-cleanup-{0}.ts" -f [guid]::NewGuid().ToString('N'))
    $cleanupResult = "$cleanupScript.result.json"
    New-Item -ItemType Directory -Path '.reference-data' -Force | Out-Null
    $cleanupErrors = @()
    try {
      $normalizedSupabaseUrl = $env:SUPABASE_URL.TrimEnd('/')
      if ($normalizedSupabaseUrl -ne 'https://ipbqrgsdkoqtuqgnewrs.supabase.co' -or
          [string]::IsNullOrWhiteSpace($env:SUPABASE_SERVICE_ROLE_KEY)) {
        throw 'production smoke cleanup Supabase precondition 실패'
      }
      [IO.File]::WriteAllText($cleanupScript, @'
  import { writeFileSync } from "node:fs";
  import { createClient } from "@supabase/supabase-js";

  const url = process.env.SUPABASE_URL?.replace(/\/+$/u, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.SMOKE_EMAIL?.toLowerCase();
  const nonce = process.env.SMOKE_NONCE;
  const startedAt = process.env.SMOKE_STARTED_AT;
  const resultPath = process.env.SMOKE_RESULT_PATH;
  if (url !== "https://ipbqrgsdkoqtuqgnewrs.supabase.co" || !key || !email || !nonce ||
      !startedAt || !resultPath || !email.includes(nonce)) {
    throw new Error("production smoke cleanup environment precondition failed");
  }
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const matchingUsers = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    matchingUsers.push(...data.users.filter((user) => user.email?.toLowerCase() === email));
    if (data.users.length < 1000) break;
  }
  if (matchingUsers.length !== 1) throw new Error("exact disposable auth user was not uniquely resolved");
  const user = matchingUsers[0];
  if (!user.created_at || Date.parse(user.created_at) < Date.parse(startedAt)) {
    throw new Error("resolved auth user predates this smoke run");
  }
  const { data: pokemonRows, error: pokemonError } = await client
    .from("owned_pokemon").select("id").eq("user_id", user.id);
  if (pokemonError) throw pokemonError;
  const pokemonIds = (pokemonRows ?? []).map((row) => row.id);
  writeFileSync(resultPath, JSON.stringify({ userId: user.id, email, createdAt: user.created_at, pokemonIds }), { flag: "wx" });

  const cleanupErrors: unknown[] = [];
  const bucket = client.storage.from("private-pokemon-images");
  const collect = async (prefix: string): Promise<string[]> => {
    const paths: string[] = [];
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await bucket.list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw error;
      for (const entry of data ?? []) {
        const path = `${prefix}/${entry.name}`;
        if (!path.startsWith(`${user.id}/`)) throw new Error("storage prefix escaped disposable user");
        if (entry.id === null) paths.push(...await collect(path));
        else paths.push(path);
      }
      if ((data?.length ?? 0) < 100) break;
    }
    return paths;
  };
  let storageRemoved = false;
  try {
    const paths = await collect(user.id);
    for (let offset = 0; offset < paths.length; offset += 100) {
      const { error } = await bucket.remove(paths.slice(offset, offset + 100));
      if (error) throw error;
    }
    storageRemoved = true;
  } catch (error) {
    cleanupErrors.push(error);
  }
  let authDeleted = false;
  if (storageRemoved) {
    try {
      const { error } = await client.auth.admin.deleteUser(user.id);
      if (error) throw error;
      authDeleted = true;
    } catch (error) {
      cleanupErrors.push(error);
    }
  } else {
    cleanupErrors.push(new Error("auth deletion skipped because storage cleanup failed"));
  }
  if (authDeleted) {
    try {
      const { error } = await client.from("audit_events").delete().eq("user_id", user.id);
      if (error) throw error;
    } catch (error) {
      cleanupErrors.push(error);
    }
  } else {
    cleanupErrors.push(new Error("audit deletion skipped because auth deletion failed"));
  }
  if (cleanupErrors.length) throw new AggregateError(cleanupErrors, "production smoke cleanup failed");
  '@)
      $env:SUPABASE_URL = $normalizedSupabaseUrl
      $env:SMOKE_EMAIL = $smokeEmail
      $env:SMOKE_NONCE = $smokeNonce
      $env:SMOKE_STARTED_AT = $smokeStartedAt.ToString('o')
      $env:SMOKE_RESULT_PATH = $cleanupResult
      pnpm exec tsx $cleanupScript
      if ($LASTEXITCODE -ne 0) { throw "smoke cleanup command exit $LASTEXITCODE" }
    } catch {
      $cleanupErrors += $_.Exception.Message
    } finally {
      foreach ($name in @('SMOKE_EMAIL','SMOKE_NONCE','SMOKE_STARTED_AT','SMOKE_RESULT_PATH')) {
        Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
      }
      if (Test-Path -LiteralPath $cleanupScript) {
        Remove-Item -LiteralPath $cleanupScript -Force -ErrorAction SilentlyContinue
      }
      if (Test-Path -LiteralPath $cleanupScript) {
        $cleanupErrors += 'smoke cleanup 임시 스크립트 삭제 실패'
      }
    }

    $cleanupIdentity = $null
    if (Test-Path -LiteralPath $cleanupResult) {
      try {
        $cleanupIdentity = Get-Content -LiteralPath $cleanupResult -Raw | ConvertFrom-Json
      } catch {
        $cleanupErrors += $_.Exception.Message
      } finally {
        Remove-Item -LiteralPath $cleanupResult -Force -ErrorAction SilentlyContinue
        if (Test-Path -LiteralPath $cleanupResult) { $cleanupErrors += 'smoke cleanup result 삭제 실패' }
      }
    } else {
      $cleanupErrors += 'server-authenticated smoke identity를 확인하지 못해 삭제하지 않았습니다.'
    }

    if ($cleanupIdentity) {
      $parsedSmokeUserId = [guid]::Empty
      if (-not [guid]::TryParse($cleanupIdentity.userId, [ref]$parsedSmokeUserId) -or
          $cleanupIdentity.email.ToLowerInvariant() -ne $smokeEmail) {
        $cleanupErrors += 'authenticated cleanup identity 응답이 올바르지 않습니다.'
      } else {
        $smokePokemonLiterals = @()
        $verifiedSmokePokemonIds = @($cleanupIdentity.pokemonIds)
        foreach ($pokemonId in $verifiedSmokePokemonIds) {
          $parsedPokemonId = [guid]::Empty
          if (-not [guid]::TryParse($pokemonId, [ref]$parsedPokemonId)) {
            $cleanupErrors += 'authenticated Pokemon UUID가 올바르지 않습니다.'
          } else {
            $smokePokemonLiterals += "'$parsedPokemonId'::uuid"
          }
        }
        $smokePokemonArray = if ($smokePokemonLiterals.Count) { 'array[' + ($smokePokemonLiterals -join ',') + ']::uuid[]' } else { 'array[]::uuid[]' }
        $cleanupProofSql = @"
  select
    (select count(*) from auth.users where id='$parsedSmokeUserId'::uuid) as auth_users,
    (select count(*) from public.owned_pokemon where user_id='$parsedSmokeUserId'::uuid) as owned,
    (select count(*) from public.owned_pokemon_moves where owned_pokemon_id=any($smokePokemonArray)) as moves,
    (select count(*) from public.owned_pokemon_images where owned_pokemon_id=any($smokePokemonArray)) as images,
    (select count(*) from public.audit_events where user_id='$parsedSmokeUserId'::uuid) as audit,
    (select count(*) from storage.objects where bucket_id='private-pokemon-images' and name like '$parsedSmokeUserId/%') as storage
  "@
        try {
          $cleanupRows = @(Invoke-LinkedJsonQuery $cleanupProofSql)
          if ($cleanupRows.Count -ne 1) { throw 'production smoke cleanup 조회 실패' }
          foreach ($name in @('auth_users','owned','moves','images','audit','storage')) {
            if ([int]$cleanupRows[0].PSObject.Properties[$name].Value -ne 0) { throw "production smoke residue: $name" }
          }
        } catch {
          $cleanupErrors += $_.Exception.Message
        }
      }
    }
    if ($cleanupErrors.Count) { throw ($cleanupErrors -join '; ') }
  }
  if ($smokeFlowPassed -ne 'passed' -or $smokeBrowserCleared -ne 'cleared' -or
      $smokeEvidence.Count -ne $requiredSmokeEvidence.Count -or
      @($smokeEvidence.Values | Where-Object { $_.result -ne 'passed' }).Count -ne 0 -or
      @($verifiedSmokePokemonIds).Count -ne 1 -or $cleanupRows.Count -ne 1 -or
      @('auth_users','owned','moves','images','audit','storage').Where({
        [int]$cleanupRows[0].PSObject.Properties[$_].Value -ne 0
      }).Count -ne 0) {
    throw 'production smoke UI/browser 검증 또는 서버 유도 Pokemon 1건 검증이 완료되지 않았습니다.'
  }
  } catch {
    $smokeFailure = $_.Exception
    try { Assert-CanonicalDeployment $previousDeploymentId }
    catch {
      throw "staged smoke 실패: $($smokeFailure.Message); canonical previous-ID 검증도 실패: $($_.Exception.Message)"
    }
    throw $smokeFailure
  }
  }
  . $stagedSmokeScript
  ```

  Re-authenticate the staged deployment and require the same explicit release metadata immediately before promotion. Confirm that the canonical alias still targets the pinned previous deployment, then promote the staged deployment ID. Because `promote` has no JSON mode in CLI 59.5.0, verify the result through cached-auth project/deployment API calls plus canonical `inspect`. If promotion starts and any promotion/post-promotion check fails, roll back to the pinned previous deployment ID and verify the canonical alias again. A failure before promotion must leave the canonical alias on the previous ID:

  ```powershell
  $promotionRequested = $false
  try {
    Assert-ReleaseGitState
    Assert-VercelLinkAndTeam
    Assert-CanonicalDeployment $previousDeploymentId
    $stagedApi = Get-VercelDeploymentApi $stagedDeploymentId
    if ($stagedApi.projectId -ne $vercelProjectId -or $stagedApi.ownerId -ne $vercelTeamId -or
        $stagedApi.target -ne 'production' -or $stagedApi.readyState -ne 'READY' -or
        $stagedApi.meta.releaseCommit -ne $releaseSha -or @($stagedApi.alias) -contains $canonicalAlias) {
      throw 'promotion 직전 staged deployment 인증 실패'
    }
    if ($smokeFlowPassed -ne 'passed' -or $smokeBrowserCleared -ne 'cleared' -or
        $smokeEvidence.Count -ne $requiredSmokeEvidence.Count -or
        @($smokeEvidence.Values | Where-Object { $_.result -ne 'passed' }).Count -ne 0 -or
        @($verifiedSmokePokemonIds).Count -ne 1 -or $cleanupRows.Count -ne 1 -or
        @('auth_users','owned','moves','images','audit','storage').Where({
          [int]$cleanupRows[0].PSObject.Properties[$_].Value -ne 0
        }).Count -ne 0) {
      throw 'promotion 직전 staged smoke/cleanup gate 실패'
    }
    $promotionRequested = $true
    Invoke-PinnedVercel -Arguments @('promote', $stagedDeploymentId, '--yes', '--timeout', '3m')
    Assert-CanonicalDeployment $stagedDeploymentId
    $promotedDeploymentId = $stagedDeploymentId
    $promotedApi = Get-VercelDeploymentApi $promotedDeploymentId
    if ($promotedApi.id -ne $promotedDeploymentId -or $promotedApi.projectId -ne $vercelProjectId -or
        $promotedApi.ownerId -ne $vercelTeamId -or $promotedApi.target -ne 'production' -or
        $promotedApi.readyState -ne 'READY' -or $promotedApi.meta.releaseCommit -ne $releaseSha -or
        @($promotedApi.alias) -notcontains $canonicalAlias) {
      throw 'promote 후 canonical/API 검증 실패'
    }
    foreach ($observedCommit in @([string]$promotedApi.gitSource.sha, [string]$promotedApi.meta.githubCommitSha)) {
      if (-not [string]::IsNullOrWhiteSpace($observedCommit) -and $observedCommit -ne $releaseSha) {
        throw 'promote 후 optional Git metadata가 releaseSha와 다릅니다.'
      }
    }
    Assert-ReleaseGitState
  } catch {
    $releaseFailure = $_.Exception
    if ($promotionRequested) {
      try { Invoke-PinnedRollback }
      catch { throw "release 실패: $($releaseFailure.Message); pinned rollback도 실패: $($_.Exception.Message)" }
    } else {
      Assert-CanonicalDeployment $previousDeploymentId
    }
    throw $releaseFailure
  }
  ```

  Database changes remain in place if application deployment fails; never delete existing user rows as rollback. The only Vercel rollback target is the previously pinned deployment ID and URL.

- [ ] **Step 9: Record final evidence**

  Re-run the ref/SHA/project/team/clean checks and write evidence only to ignored `.reference-data`; do not create a tracked evidence commit after the SHA that was published and deployed. Record the migration, candidate/report/core hashes, pre/post-migration snapshots, exact publication and both RLS postflights, the pinned previous/staged/promoted Vercel IDs and URLs, authoritative `meta.releaseCommit`, canonical identity, and all six cleanup zeros. Do not use nullable `gitSource.sha` as release evidence:

  ```powershell
  Assert-ReleaseGitState
  Assert-VercelLinkAndTeam
  Assert-CanonicalDeployment $promotedDeploymentId
  if (Test-Path -LiteralPath '.vercel/output') { throw 'final evidence 전에 .vercel/output이 남아 있습니다.' }
  if ((Get-Content -LiteralPath 'supabase/.temp/project-ref' -Raw).Trim() -ne 'ipbqrgsdkoqtuqgnewrs') {
    throw 'final evidence linked Supabase ref 불일치'
  }
  $finalRemoteLines = @(& git ls-remote origin "refs/heads/$releaseBranch")
  if ($LASTEXITCODE -ne 0 -or $finalRemoteLines.Count -ne 1) { throw 'final remote SHA 조회 실패' }
  $finalRemoteMatch = [regex]::Match(
    $finalRemoteLines[0],
    "^([0-9a-f]{40})\s+$([regex]::Escape("refs/heads/$releaseBranch"))$"
  )
  if (-not $finalRemoteMatch.Success) { throw 'final remote SHA 응답 형식 불일치' }
  $finalRemoteSha = $finalRemoteMatch.Groups[1].Value
  if ($finalRemoteSha -ne $releaseSha) { throw 'final remote SHA가 release SHA와 다릅니다.' }

  $finalPostRows = @(Invoke-LinkedJsonQuery $postflightSql)
  if ($finalPostRows.Count -ne 1) { throw 'final active publication은 정확히 한 건이어야 합니다.' }
  $finalPostflight = $finalPostRows[0]
  if ($finalPostflight.version -ne 'Cobbleverse 1.7.42+Cobblemon 1.7.3' -or
      -not $finalPostflight.validator_valid) { throw 'final publication version/validator 불일치' }
  foreach ($name in @('candidate_digest','authenticated_candidate_digest','trusted_source_digest')) {
    if ($finalPostflight.PSObject.Properties[$name].Value -ne $candidateDigest) {
      throw "final publication digest 불일치: $name"
    }
  }
  foreach ($entry in $expectedAfter.GetEnumerator()) {
    if ([int]$finalPostflight.PSObject.Properties[$entry.Key].Value -ne $entry.Value) {
      throw "final publication count 불일치: $($entry.Key)"
    }
  }
  Assert-GlobalOptionStagingEmpty 'final evidence'

  $finalCatalogIssues = @(Invoke-LinkedJsonQuery $catalogSql)
  if ($finalCatalogIssues.Count -ne 0) {
    throw "final RLS/catalog privilege postflight 실패: $($finalCatalogIssues.issue -join ', ')"
  }
  $finalRlsSqlFile = Join-Path ([IO.Path]::GetTempPath()) ("pokemon-final-rls-postflight-{0}.sql" -f [guid]::NewGuid().ToString('N'))
  try {
    [IO.File]::WriteAllText($finalRlsSqlFile, $rlsSql, [Text.UTF8Encoding]::new($false))
    pnpm exec supabase db query --linked --agent no --file $finalRlsSqlFile
    if ($LASTEXITCODE -ne 0) { throw 'final authenticated RLS postflight 실패' }
  } finally {
    if (Test-Path -LiteralPath $finalRlsSqlFile) { Remove-Item -LiteralPath $finalRlsSqlFile -Force }
    if (Test-Path -LiteralPath "$finalRlsSqlFile.tmp") { Remove-Item -LiteralPath "$finalRlsSqlFile.tmp" -Force }
  }
  $finalRlsCatalogPostflight = 'passed'
  $finalRlsPostflight = 'passed'

  $finalCleanupRows = @(Invoke-LinkedJsonQuery $cleanupProofSql)
  if ($finalCleanupRows.Count -ne 1 -or
      @('auth_users','owned','moves','images','audit','storage').Where({
        [int]$finalCleanupRows[0].PSObject.Properties[$_].Value -ne 0
      }).Count -ne 0) { throw 'final production smoke residue 검증 실패' }

  $finalCanonical = Get-CanonicalInspection
  $finalDeployment = Get-VercelDeploymentApi $promotedDeploymentId
  $finalProject = Get-VercelProjectApi
  $expectedProductionAliases = @($finalProject.targets.production.alias)
  $missingFinalAliases = @($expectedProductionAliases | Where-Object {
    @($finalCanonical.aliases) -notcontains $_ -or @($finalDeployment.alias) -notcontains $_
  })
  if ($cleanupRows.Count -ne 1 -or $finalRlsCatalogPostflight -ne 'passed' -or
      $finalRlsPostflight -ne 'passed' -or $smokeFlowPassed -ne 'passed' -or
      $smokeEvidence.Count -ne $requiredSmokeEvidence.Count -or
      @($smokeEvidence.Values | Where-Object { $_.result -ne 'passed' }).Count -ne 0 -or
      $smokeBrowserCleared -ne 'cleared' -or @($verifiedSmokePokemonIds).Count -ne 1 -or
      $stagedDeploymentId -ne $promotedDeploymentId -or $finalCanonical.id -ne $promotedDeploymentId -or
      $finalCanonical.url -ne $stagedUri.Host -or $finalCanonical.target -ne 'production' -or
      $finalCanonical.readyState -ne 'READY' -or $finalDeployment.id -ne $promotedDeploymentId -or
      $finalDeployment.url -ne $stagedUri.Host -or $finalDeployment.target -ne 'production' -or
      $finalDeployment.readyState -ne 'READY' -or $finalDeployment.meta.releaseCommit -ne $releaseSha -or
      $finalDeployment.projectId -ne $vercelProjectId -or $finalDeployment.ownerId -ne $vercelTeamId -or
      $finalProject.targets.production.id -ne $promotedDeploymentId -or
      $expectedProductionAliases.Count -eq 0 -or $expectedProductionAliases -notcontains $canonicalAlias -or
      $missingFinalAliases.Count -ne 0 -or
      @('auth_users','owned','moves','images','audit','storage').Where({
        [int]$finalCleanupRows[0].PSObject.Properties[$_].Value -ne 0
      }).Count -ne 0) {
    throw '필수 live evidence가 완전하지 않습니다.'
  }
  $evidence = [ordered]@{
    releaseSha=$releaseSha
    remoteSha=$finalRemoteSha
    linkedProjectRef='ipbqrgsdkoqtuqgnewrs'
    migration='20260824123000_pokemon_battle_data.sql'
    pendingMigrations=$pendingMigrations
    candidateDigest=$candidateDigest
    candidateFileSha256=$candidateFileHash
    validationReportSha256=$reportFileHash
    coreSqlSha256=$coreSqlHash
    preMigrationSnapshot=$beforeMigration
    postMigrationSnapshot=$afterMigration
    publicationPostflight=$finalPostflight
    rlsCatalogPostflight=$finalRlsCatalogPostflight
    rlsPostflight=$finalRlsPostflight
    smokeBrowserCleared=$smokeBrowserCleared
    smokePokemonCount=@($verifiedSmokePokemonIds).Count
    vercelCliVersion=$vercelCliVersion
    previousDeploymentId=$previousDeploymentId
    previousDeploymentUrl=$previousDeploymentUrl
    stagedDeploymentId=$stagedDeploymentId
    stagedDeploymentUrl=$stagedDeploymentUrl
    promotedDeploymentId=$promotedDeploymentId
    canonicalAlias=$canonicalAlias
    productionAliases=$expectedProductionAliases
    canonicalDeploymentId=$finalCanonical.id
    deploymentOwnerId=$finalDeployment.ownerId
    deploymentState=$finalDeployment.readyState
    deploymentReleaseCommit=$finalDeployment.meta.releaseCommit
    smokeFlow=$smokeFlowPassed
    smokeEvidence=$smokeEvidence
    smokeCleanup=$finalCleanupRows[0]
  }
  $evidencePath = ".reference-data/release-evidence-$releaseSha.json"
  $evidenceTmp = "$evidencePath.tmp"
  if ((Test-Path -LiteralPath $evidencePath) -or (Test-Path -LiteralPath $evidenceTmp)) {
    throw 'release evidence artifact가 이미 존재합니다.'
  }
  try {
    [IO.File]::WriteAllText($evidenceTmp, ($evidence | ConvertTo-Json -Depth 20), [Text.UTF8Encoding]::new($false))
    [IO.File]::Move($evidenceTmp, $evidencePath)
  } finally {
    if (Test-Path -LiteralPath $evidenceTmp) { Remove-Item -LiteralPath $evidenceTmp -Force }
  }
  if (git status --porcelain) { throw 'ignored evidence 기록 후 tracked worktree가 변경되었습니다.' }
  ```

  Do not call the deployment complete if any live check was skipped.
