# Task 9 로컬 구현·검증 보고서

## 범위와 안전 경계

- 기준 커밋: `2ca16158096cd3762f7d366dc8a8f29605ddec54`
- 수행 범위: 로컬 데이터 후보 생성, TDD 회귀 테스트, 로컬 Supabase 통합/E2E 검증, 품질 게이트, 로컬 커밋.
- 수행하지 않음: GitHub push, production Supabase migration/publication, Vercel 배포와 production smoke test.
- 모든 Supabase 통합/E2E 셸은 관련 환경 변수 이름을 먼저 제거하고 `supabase status -o env`를 메모리에서만 파싱했다. `API_URL`이 대소문자까지 정확히 `http://127.0.0.1:54321`인지 단언한 후에만 로컬 키를 프로세스 환경에 설정했다. 키 값은 출력하거나 보고서에 저장하지 않았다.
- `CI=1`로 실행했으며 E2E 전에 같은 로컬 URL 단언을 다시 수행했다.

## TDD RED → GREEN

### 등록·스탯 E2E

- 먼저 `tests/e2e/stats.spec.ts`와 `tests/e2e/pokemon-registration.spec.ts`에 회귀 계약을 추가했다.
- RED: `pnpm exec playwright test tests/e2e/stats.spec.ts tests/e2e/pokemon-registration.spec.ts --project=chromium --retries=0`
  - 로컬 URL 단언 통과.
  - 1 failed, 1 passed, 1 did not run, 26.18초.
  - 최초 제품 경계: 테라 옵션 기대 3개, 실제 1개. 확장 픽스처가 아직 없어서 의도대로 실패했다.
- GREEN: 같은 집중 명령이 3 passed, 18.6초(셸 총 22.82초).
- 반복 중 발견한 실패는 구현 결함이 아니라 정확 locator, 폼 교정 뒤 전투 선택 재선택, Gmax 폼 정리 범위를 보완해야 하는 테스트 픽스처 경계였다. 제품 흐름은 유지했다.

검증한 사용자 흐름:

- 여섯 종족값과 명랑/Jolly 성격의 스피드 상승·특공 하락을 사용한 정확한 스탯 계산.
- 레벨 60 샤미드 결과: HP 244, 공격 139, 방어 95, 특공 139, 특방 138, 스피드 152.
- 7단계 선택·저장, 6/7단계와 상세 화면의 기술 PP(15 및 원본 null), 목록/상세 한국어 배지.
- 19개 표준 테라타입(식별자는 접미사로 격리, 표시명은 한국어), 폼별 선택지, 빠른 테라/거다이맥스 저장.
- 플레이 가능한 Gmax 원본과 같은 종 battle-only 대상 연결, battle-only 등록 목록 제외.
- 폼 교정 시 DB의 테라 null/Gmax false 재조정과 감사 로그 before/after 필드.
- UUID와 영문 내부 식별자가 화면에 보이지 않음.
- 종료 훅에서 인증 사용자, 보유 포켓몬, 감사 로그, 게시본, 모든 참조 관계와 픽스처 행을 개별 재조회하여 잔존 0을 요구함.

### 실제 데이터 회귀

- 최초 실제 후보 검증 실패를 그룹별로 확인했다.
  - `forms.nameKo`: 473개(패키지에 고정된 `cobblemon.ui.pokedex.info.form.<formId>` 한국어 키 361개, 별도 해결 112개).
  - `items.nameKo`: 120개.
  - `items.descriptionKo`: 283개.
  - `evolutions.conditionKo`: 85개.
  - 잘못된 mega 대상 참조 16개: 같은 종 실제 mega 폼으로 해결 가능한 14개, 원본에 대상 폼이 없는 `megamilotic` 2개.
- 최초 데이터 회귀 RED: 3 failed/36 passed, 5.65초. Gmax 영문 폼명, Acacia Log 영문명, `megagengar` 참조가 실패했다.
- 의미 없는 순번형 임시 이름을 금지하는 회귀 RED: 3 failed/36 passed, 5.63초. Lucario 의상, `melon_seeds`, Milotic 원본 공백 표시가 실패했다.
- 진화 의미 보존 회귀 RED: 신규 테스트 1 failed/39 passed, 5.94초. `During rain`이 일반 문구로 손실되는 경계를 잡았다.
- 최종 집중 GREEN: 40 passed, 5.87초.

적용한 데이터 판정:

- 폼명은 패키지 고정 한국어 키를 최우선으로 사용한다. 남은 112개는 종 한국어명 + 검토된 폼 사전/직접 보충(89 템플릿·사전, 23 직접 맵)으로 의미 있게 표시하며 알 수 없는 토큰은 즉시 실패한다. `Form 2` 세 건은 원본에 상세 의미가 없음을 한국어 표시명에 투명하게 기록한다.
- Minecraft 도구 120개는 고정 `ko_kr`의 `item.minecraft`/`block.minecraft` 값 115개, 검토된 별칭 3개(`raw_cod`, `eye_of_ender`, `slimeball`), Cobblemon 열매 보충 2개로 해결한다. 알 수 없는 도구는 즉시 실패한다.
- 원본에 한국어 설명이 없는 도구는 해결된 한국어 도구명과 `한국어 설명이 원본에 제공되지 않습니다`를 사용하며 영문 설명을 공개하지 않는다.
- 진화 조건은 209개 고유 원자 조건을 레벨, 도구, 기술, 시간, 성격, 능력치, 날씨, 바이옴, 파티, 교환, 누적 피해/행동으로 의미 보존 번역한다. 비어 있는 trade만 `통신 교환`으로 처리하고 알 수 없는 비어 있지 않은 조건은 즉시 실패한다. 일반 `추가 조건 충족` 대체는 없다.
- mega 참조 14개는 같은 종의 실제 mega 폼에 연결한다. 대상 폼이 원본에 존재하지 않는 Milotic 2개는 602개 진화 행을 유지하면서 같은 종 기본 대상으로 연결하고 `원본에 대상 메가 폼이 없음`을 조건에 명시한다. 폼을 발명하거나 행을 삭제하지 않았다.

## 실제 후보 검증

- 원본: `C:\Users\PARKSUNGSIK\OneDrive\문서\Desktop\Cobbleverse_Pokemon_Manager_Package_v1.3_TABLE_FIX`
- 로컬 ignored 산출물: `.reference-data/candidate.json`, `.reference-data/validation-report.json`
- 최종 재생성·검증·프로그램 단언: exit 0, 7.70초.
- `validation-report.json`: `valid=true`; `missingKoreanFields`, `brokenReferences`, `countMismatches`, `manifestIssues`, `battleDataIssues` 모두 0.

| 데이터 | 확인 수량 |
|---|---:|
| types | 18 |
| species | 1,025 |
| forms | 1,498 |
| playable forms | 1,334 |
| battle-only forms | 164 |
| abilities | 310 |
| items | 615 |
| evolutions | 602 |
| form abilities | 3,055 |
| natures | 25 |
| moves | 826 |
| learnsets | 116,519 |
| type matchups | 324 |
| Tera types | 19 |
| form/Tera options | 25,184 |
| Gmax options | 42 |
| expected battleOnly diagnostics | 9 |

- candidate SHA-256: `0BE6F72169F744129D881FE98D7885A68476F34561B52E7A87687CFCFA0034E2`
- validation report SHA-256: `3179F4173E37E2CD27EC4716B3812E306A30214532F290AEA60A623C2F560BC2`

## 전체 로컬 품질 게이트

| 명령 | 결과 | 시간 |
|---|---|---:|
| `pnpm test` (최종 재실행) | 20 passed / 4 skipped 파일, 185 passed / 30 skipped 테스트 | 68.39초 |
| `RUN_SUPABASE_INTEGRATION=1 pnpm test -- tests/security` | 로컬 URL 단언 후 4 파일, 30 passed | 128.57초 |
| `pnpm test:e2e -- --project=chromium` | 로컬 URL 재단언 후 8 passed; 종료 훅 잔존 검사 포함 | 25.90초 |
| `pnpm typecheck` | exit 0 | 6.75초 |
| `pnpm lint` | 경고 0, exit 0 | 12.15초 |
| `pnpm build` | Next.js production build 성공 | 13.39초 |
| `pnpm exec supabase db lint --local --level warning --fail-on warning` | `No schema errors found`, 결과 0개 | 3.10초 |
| `git diff --check` | 공백 오류 없음, exit 0 | 0.29초 |

게이트 중 수정한 항목:

- 최초 전체 lint는 기존 `tests/unit/owned-pokemon-schema.test.ts`의 의도적 구조 분해 변수 2개를 미사용 경고로 보고하여 exit 1(16.32초)이었다. 값에 `void` 사용을 명시하는 테스트 전용 최소 수정 후 경고 없이 재통과했다.
- 보안 래퍼의 최초 두 시도는 테스트 시작 전 PowerShell 문자열/출력 파싱 오류로 중단되었다. 로컬 상태 출력 형식을 안전하게 줄 단위로 파싱하도록 고쳤고, 비밀값은 어느 시도에서도 출력하지 않았다.

## 변경 파일

- `scripts/data/import-reference-data.ts`
- `tests/e2e/pokemon-registration.spec.ts`
- `tests/e2e/stats.spec.ts`
- `tests/unit/pokemon-battle-data-normalization.test.ts`
- `tests/unit/owned-pokemon-schema.test.ts` (lint 경고 제거만)
- `.superpowers/sdd/2026-08-24-pokemon-battle-data/task-9-report.md`

## 경고와 남은 운영 작업

- 로컬 Supabase 상태는 imgproxy, edge runtime, pooler를 중지된 선택 서비스로 알렸지만 이번 게이트가 요구한 API/DB/Auth와 모든 통합 테스트는 통과했다.
- `git diff --check`는 Windows `core.autocrlf`의 LF→CRLF 안내를 표시했으나 공백 오류는 없고 exit 0이었다.
- production 데이터 게시, migration 적용, GitHub push, Vercel 배포/production smoke는 검토 후 별도 승인 단계로 남겼다.
