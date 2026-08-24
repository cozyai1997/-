// @vitest-environment node

import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  createOwnedPokemon,
  getOwnedPokemonDetail,
  listPokemonFilteredOptions,
} from '@/features/owned-pokemon/repository'
import type { Database } from '@/types/database.generated'

type LocalEnvironment = {
  API_URL: string
  ANON_KEY: string
  SERVICE_ROLE_KEY: string
}

const describeLocalSupabase = process.env.RUN_SUPABASE_INTEGRATION === '1' ? describe : describe.skip
const ids = {
  publication: randomUUID(),
  retiredPublication: randomUUID(),
  type: randomUUID(),
  species: randomUUID(),
  otherSpecies: randomUUID(),
  baseForm: randomUUID(),
  exactForm: randomUUID(),
  fallbackForm: randomUUID(),
  gigantamaxForm: randomUUID(),
  otherForm: randomUUID(),
  allowedTeraType: randomUUID(),
  invalidTeraType: randomUUID(),
  baseAbility: randomUUID(),
  exactAbility: randomUUID(),
  retiredAbility: randomUUID(),
  validMove: randomUUID(),
  invalidMove: randomUUID(),
  nullPublicationMove: randomUUID(),
}

let admin: SupabaseClient
let alice: SupabaseClient
let anonymous: SupabaseClient
let aliceId: string
let nationalDexNumber: number
let previousActivePublicationId: string | null = null

function localEnvironment(): LocalEnvironment {
  const cliPath = resolve(process.cwd(), 'node_modules/supabase/dist/supabase.js')
  const result = spawnSync(process.execPath, [cliPath, 'status', '-o', 'env'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
  if (result.status !== 0) throw new Error('로컬 Supabase가 실행 중이어야 합니다.')
  const values = Object.fromEntries(
    result.stdout
      .split(/\r?\n/u)
      .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/u))
      .filter((match): match is RegExpMatchArray => match !== null)
      .map((match) => [match[1], match[2]]),
  )
  for (const name of ['API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY'] as const) {
    if (!values[name]) throw new Error(`로컬 Supabase ${name}을 찾지 못했습니다.`)
  }
  return values as LocalEnvironment
}

const stats = {
  hp: 0,
  attack: 0,
  defense: 0,
  special_attack: 0,
  special_defense: 0,
  speed: 0,
}

function rpcInput(overrides: Record<string, unknown> = {}) {
  return {
    p_species_id: ids.species,
    p_form_id: ids.exactForm,
    p_nickname: `거래-${randomUUID()}`,
    p_gender: 'female',
    p_level: 12,
    p_captured_on: null,
    p_original_nature_id: null,
    p_effective_nature_id: null,
    p_ability_id: ids.exactAbility,
    p_original_iv: stats,
    p_effective_iv: stats,
    p_ev: stats,
    p_held_item_id: null,
    p_notes: '',
    p_current_moves: [{ move_id: ids.validMove }],
    p_target_moves: [{ move_id: ids.validMove, condition_ko: '레벨 5에 습득' }],
    ...overrides,
  }
}

async function createFixturePokemon(nickname: string): Promise<string> {
  const created = await alice.rpc('create_owned_pokemon_with_moves', rpcInput({
    p_nickname: nickname.slice(0, 40),
  }))
  expect(created.error).toBeNull()
  expect(created.data).toEqual(expect.any(String))
  return created.data as string
}

function correctionInput(pokemonId: string, overrides: Record<string, unknown> = {}) {
  return {
    p_owned_pokemon_id: pokemonId,
    p_species_id: ids.species,
    p_form_id: ids.exactForm,
    p_captured_on: null,
    p_original_iv: stats,
    p_reason_ko: '시험 데이터 입력 오류 정정',
    ...overrides,
  }
}

function quickInput(pokemonId: string, abilityId: string | null) {
  return {
    p_owned_pokemon_id: pokemonId,
    p_nickname: '빠른 수정 검증',
    p_gender: 'female',
    p_level: 13,
    p_effective_nature_id: null,
    p_ability_id: abilityId,
    p_effective_iv: stats,
    p_ev: stats,
    p_held_item_id: null,
    p_notes: '',
  }
}

describeLocalSupabase('보유 포켓몬과 기술의 원자적 등록', () => {
  beforeAll(async () => {
    const environment = localEnvironment()
    admin = createClient(environment.API_URL, environment.SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    anonymous = createClient(environment.API_URL, environment.ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const email = `transaction-${randomUUID()}@example.test`
    const password = `Transaction-${randomUUID()}-A1!`
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (created.error || !created.data.user) throw created.error ?? new Error('사용자 생성 실패')
    aliceId = created.data.user.id
    alice = createClient(environment.API_URL, environment.ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const signedIn = await alice.auth.signInWithPassword({ email, password })
    if (signedIn.error) throw signedIn.error

    nationalDexNumber = 7_000 + (Number.parseInt(ids.species.slice(0, 6), 16) % 1_000)
    const previousActive = await admin
      .from('data_publications')
      .select('id')
      .eq('status', 'active')
      .maybeSingle()
    if (previousActive.error) throw previousActive.error
    previousActivePublicationId = previousActive.data?.id ?? null
    if (previousActivePublicationId) {
      const retiredPrevious = await admin
        .from('data_publications')
        .update({ status: 'retired' })
        .eq('id', previousActivePublicationId)
      if (retiredPrevious.error) throw retiredPrevious.error
    }
    const publication = await admin.from('data_publications').insert({
      id: ids.publication,
      version: `transaction-${ids.publication}`,
      status: 'active',
      validated_at: new Date().toISOString(),
      activated_at: new Date().toISOString(),
    })
    expect(publication.error).toBeNull()
    const retiredPublication = await admin.from('data_publications').insert({
      id: ids.retiredPublication,
      version: `transaction-retired-${ids.retiredPublication}`,
      status: 'retired',
    })
    expect(retiredPublication.error).toBeNull()
    const type = await admin.from('reference_types').insert({
      id: ids.type,
      publication_id: ids.publication,
      identifier: `transaction-${ids.type}`,
      name_ko: '노말',
      color_hex: '#A8A77A',
      sort_order: 0,
    })
    expect(type.error).toBeNull()
    const species = await admin.from('reference_species').insert({
      id: ids.species,
      publication_id: ids.publication,
      national_dex_number: nationalDexNumber,
      identifier: `transaction-${ids.species}`,
      name_ko: '이브이',
      description_ko: '원자적 등록 검증용',
    })
    expect(species.error).toBeNull()
    const otherSpecies = await admin.from('reference_species').insert({
      id: ids.otherSpecies,
      publication_id: ids.publication,
      national_dex_number: nationalDexNumber + 1,
      identifier: `transaction-other-${ids.otherSpecies}`,
      name_ko: '쥬피썬',
      description_ko: '종 정정 검증용',
    })
    expect(otherSpecies.error).toBeNull()
    const forms = await admin.from('reference_forms').insert([
      {
        id: ids.baseForm,
        publication_id: ids.publication,
        species_id: ids.species,
        identifier: `transaction-base-${ids.baseForm}`,
        name_ko: '기본 모습',
        is_default: true,
        is_battle_only: false,
      },
      {
        id: ids.exactForm,
        publication_id: ids.publication,
        species_id: ids.species,
        base_form_id: ids.baseForm,
        identifier: `transaction-exact-${ids.exactForm}`,
        name_ko: '정확한 모습',
        is_default: false,
        is_battle_only: false,
      },
      {
        id: ids.fallbackForm,
        publication_id: ids.publication,
        species_id: ids.species,
        base_form_id: ids.baseForm,
        identifier: `transaction-fallback-${ids.fallbackForm}`,
        name_ko: '대체 모습',
        is_default: false,
        is_battle_only: false,
      },
      {
        id: ids.gigantamaxForm,
        publication_id: ids.publication,
        species_id: ids.species,
        identifier: `transaction-gmax-${ids.gigantamaxForm}`,
        name_ko: '거다이맥스 모습',
        is_default: false,
        is_battle_only: true,
      },
      {
        id: ids.otherForm,
        publication_id: ids.publication,
        species_id: ids.otherSpecies,
        identifier: `transaction-other-${ids.otherForm}`,
        name_ko: '다른 종 모습',
        is_default: true,
        is_battle_only: false,
      },
    ])
    expect(forms.error).toBeNull()
    const teraTypes = await admin.from('reference_tera_types').insert([
      {
        id: ids.allowedTeraType,
        publication_id: ids.publication,
        identifier: `transaction-tera-allowed-${ids.allowedTeraType}`,
        name_ko: '노말',
        reference_type_id: ids.type,
        sort_order: 0,
      },
      {
        id: ids.invalidTeraType,
        publication_id: ids.publication,
        identifier: `transaction-tera-invalid-${ids.invalidTeraType}`,
        name_ko: '스텔라',
        reference_type_id: null,
        sort_order: 1,
      },
    ])
    expect(teraTypes.error).toBeNull()
    const battleOptions = await admin.from('reference_form_tera_options').insert({
      publication_id: ids.publication,
      form_id: ids.exactForm,
      tera_type_id: ids.allowedTeraType,
    })
    expect(battleOptions.error).toBeNull()
    const gigantamaxOptions = await admin.from('reference_form_gigantamax_options').insert({
      publication_id: ids.publication,
      source_form_id: ids.exactForm,
      gigantamax_form_id: ids.gigantamaxForm,
    })
    expect(gigantamaxOptions.error).toBeNull()
    const abilities = await admin.from('reference_abilities').insert([
      {
        id: ids.baseAbility,
        publication_id: ids.publication,
        identifier: `transaction-base-${ids.baseAbility}`,
        name_ko: '적응력',
        description_ko: '기본 폼 특성',
      },
      {
        id: ids.exactAbility,
        publication_id: ids.publication,
        identifier: `transaction-exact-${ids.exactAbility}`,
        name_ko: '위험예지',
        description_ko: '정확한 폼 특성',
      },
      {
        id: ids.retiredAbility,
        publication_id: ids.retiredPublication,
        identifier: `transaction-retired-${ids.retiredAbility}`,
        name_ko: '은퇴 특성',
        description_ko: '은퇴 게시본에서만 연결된 특성',
      },
    ])
    expect(abilities.error).toBeNull()
    const formAbilities = await admin.from('reference_form_abilities').insert([
      {
        publication_id: ids.publication,
        form_id: ids.baseForm,
        ability_id: ids.baseAbility,
        slot: 'first',
      },
      {
        publication_id: ids.retiredPublication,
        form_id: ids.exactForm,
        ability_id: ids.retiredAbility,
        slot: 'retired',
      },
      {
        publication_id: ids.publication,
        form_id: ids.exactForm,
        ability_id: ids.exactAbility,
        slot: 'first',
      },
    ])
    expect(formAbilities.error).toBeNull()
    const moves = await admin.from('reference_moves').insert([
      {
        id: ids.validMove,
        publication_id: ids.publication,
        identifier: `transaction-valid-${ids.validMove}`,
        name_ko: '몸통박치기',
        description_ko: '상대에게 부딪친다.',
        type_id: ids.type,
        damage_class: 'physical',
      },
      {
        id: ids.invalidMove,
        publication_id: ids.publication,
        identifier: `transaction-invalid-${ids.invalidMove}`,
        name_ko: '금지 기술',
        description_ko: '해당 종이 배울 수 없다.',
        type_id: ids.type,
        damage_class: 'status',
      },
      {
        id: ids.nullPublicationMove,
        publication_id: null,
        identifier: `transaction-null-${ids.nullPublicationMove}`,
        name_ko: '무게시 기술',
        description_ko: '게시본이 없는 기술이다.',
        type_id: ids.type,
        damage_class: 'status',
      },
    ])
    expect(moves.error).toBeNull()
    const learnset = await admin.from('reference_move_learnsets').insert({
      publication_id: ids.publication,
      species_id: ids.species,
      form_id: null,
      move_id: ids.validMove,
      learn_method: 'level',
      learn_level: 5,
      condition_ko: '레벨 5에 습득',
    })
    expect(learnset.error).toBeNull()
    const nullPublicationLearnset = await admin.from('reference_move_learnsets').insert({
      publication_id: null,
      species_id: ids.species,
      form_id: null,
      move_id: ids.nullPublicationMove,
      learn_method: 'special',
      learn_level: null,
      condition_ko: '무게시 경로로 습득',
    })
    expect(nullPublicationLearnset.error).toBeNull()
  })

  afterAll(async () => {
    if (!admin) return
    const failures: string[] = []
    const collect = (label: string, error: { message?: string } | null) => {
      if (error) failures.push(`${label}: ${error.message ?? '알 수 없는 오류'}`)
    }
    if (aliceId) {
      collect('사용자 삭제', (await admin.auth.admin.deleteUser(aliceId)).error)
      collect('감사 삭제', (await admin.from('audit_events').delete().eq('user_id', aliceId)).error)
    }
    collect('시험 게시본 은퇴', (await admin
      .from('data_publications')
      .update({ status: 'retired' })
      .eq('id', ids.publication)).error)
    if (previousActivePublicationId) {
      collect('기존 게시본 복구', (await admin
        .from('data_publications')
        .update({ status: 'active' })
        .eq('id', previousActivePublicationId)).error)
    }
    collect('기술 관계 삭제', (await admin
      .from('reference_move_learnsets')
      .delete()
      .in('move_id', [ids.validMove, ids.invalidMove, ids.nullPublicationMove])).error)
    collect('특성 관계 삭제', (await admin
      .from('reference_form_abilities')
      .delete()
      .in('ability_id', [ids.baseAbility, ids.exactAbility, ids.retiredAbility])).error)
    collect('거다이맥스 관계 삭제', (await admin
      .from('reference_form_gigantamax_options').delete().eq('publication_id', ids.publication)).error)
    collect('테라 옵션 삭제', (await admin
      .from('reference_form_tera_options').delete().eq('publication_id', ids.publication)).error)
    collect('테라 타입 삭제', (await admin
      .from('reference_tera_types').delete().eq('publication_id', ids.publication)).error)
    collect('기술 삭제', (await admin
      .from('reference_moves')
      .delete()
      .in('id', [ids.validMove, ids.invalidMove, ids.nullPublicationMove])).error)
    collect('특성 삭제', (await admin
      .from('reference_abilities')
      .delete()
      .in('id', [ids.baseAbility, ids.exactAbility, ids.retiredAbility])).error)
    collect('하위 모습 삭제', (await admin
      .from('reference_forms')
      .delete()
      .in('id', [ids.exactForm, ids.fallbackForm, ids.gigantamaxForm, ids.otherForm])).error)
    collect('기본 모습 삭제', (await admin.from('reference_forms').delete().eq('id', ids.baseForm)).error)
    collect('종 삭제', (await admin
      .from('reference_species')
      .delete()
      .in('id', [ids.species, ids.otherSpecies])).error)
    collect('타입 삭제', (await admin.from('reference_types').delete().eq('id', ids.type)).error)
    collect('게시본 삭제', (await admin
      .from('data_publications')
      .delete()
      .in('id', [ids.publication, ids.retiredPublication])).error)

    const residue = await Promise.all([
      admin.from('owned_pokemon').select('id', { count: 'exact', head: true }).eq('user_id', aliceId),
      admin.from('reference_move_learnsets').select('id', { count: 'exact', head: true }).in('move_id', [ids.validMove, ids.invalidMove, ids.nullPublicationMove]),
      admin.from('reference_form_abilities').select('id', { count: 'exact', head: true }).in('ability_id', [ids.baseAbility, ids.exactAbility, ids.retiredAbility]),
      admin.from('data_publications').select('id', { count: 'exact', head: true }).in('id', [ids.publication, ids.retiredPublication]),
    ])
    for (const [index, result] of residue.entries()) {
      collect(`잔존 조회 ${index + 1}`, result.error)
      if ((result.count ?? 0) > 0) failures.push(`잔존 조회 ${index + 1}: ${result.count}개`)
    }
    if (failures.length) throw new Error(`보안 픽스처 정리 실패\n${failures.join('\n')}`)
  })

  it('auth.uid() 소유로 포켓몬과 현재·목표 기술을 한 번에 등록한다', async () => {
    const pokemonId = await createOwnedPokemon(alice as SupabaseClient<Database>, {
      speciesId: ids.species,
      formId: ids.exactForm,
      nickname: `저장소-${randomUUID()}`,
      gender: 'female',
      level: 12,
      capturedOn: null,
      originalNatureId: null,
      effectiveNatureId: null,
      abilityId: ids.exactAbility,
      originalIv: stats,
      effectiveIv: stats,
      ev: stats,
      heldItemId: null,
      notes: '',
      currentMoves: [{ moveId: ids.validMove }],
      targetMoves: [{ moveId: ids.validMove, conditionKo: '레벨 5에 습득' }],
    })

    expect(pokemonId).toEqual(expect.any(String))
    const pokemon = await alice
      .from('owned_pokemon')
      .select('id,user_id,ability_id')
      .eq('id', pokemonId)
      .single()
    const moves = await alice
      .from('owned_pokemon_moves')
      .select('move_id,kind,slot,target_condition_ko')
      .eq('owned_pokemon_id', pokemonId)
      .order('kind')

    expect(pokemon.data).toEqual({ id: pokemonId, user_id: aliceId, ability_id: ids.exactAbility })
    expect(moves.data).toEqual([
      { move_id: ids.validMove, kind: 'current', slot: 1, target_condition_ko: '' },
      { move_id: ids.validMove, kind: 'target', slot: 1, target_condition_ko: '레벨 5에 습득' },
    ])
    const detail = await getOwnedPokemonDetail(
      alice as SupabaseClient<Database>,
      nationalDexNumber,
      1,
    )
    expect(detail).toMatchObject({
      currentMoves: [{ moveId: ids.validMove }],
      targetMoves: [{ moveId: ids.validMove, conditionKo: '레벨 5에 습득' }],
    })
  })

  it('실제 조회에서 정확한 폼·기본 폼 특성과 종별 기술을 한국어로 반환한다', async () => {
    const exact = await listPokemonFilteredOptions(
      alice as SupabaseClient<Database>,
      ids.species,
      ids.exactForm,
    )
    const fallback = await listPokemonFilteredOptions(
      alice as SupabaseClient<Database>,
      ids.species,
      ids.fallbackForm,
    )

    expect(exact.abilities).toEqual([{
      id: ids.exactAbility,
      nameKo: '위험예지',
      descriptionKo: '정확한 폼 특성',
      isHidden: false,
    }])
    expect(fallback.abilities.map((ability) => ability.id)).toEqual([ids.baseAbility])
    expect(exact.moves).toEqual([{
      id: ids.validMove,
      nameKo: '몸통박치기',
      descriptionKo: '상대에게 부딪친다.',
      typeKo: '노말',
      damageClassKo: '물리',
      power: null,
      accuracy: null,
      pp: null,
      routes: [{ methodKo: '레벨업', conditionKo: '레벨 5에 습득' }],
    }])
  })

  it('정확한 폼 특성이 있으면 기본 폼 특성을 거부하고 관계가 없는 폼만 대체한다', async () => {
    const rejected = await alice.rpc('create_owned_pokemon_with_moves', rpcInput({
      p_ability_id: ids.baseAbility,
      p_nickname: '잘못된 특성',
    }))
    const accepted = await alice.rpc('create_owned_pokemon_with_moves', rpcInput({
      p_form_id: ids.fallbackForm,
      p_ability_id: ids.baseAbility,
      p_nickname: '대체 특성',
    }))

    expect(rejected.error).not.toBeNull()
    expect(accepted.error).toBeNull()
    const rejectedRows = await alice.from('owned_pokemon').select('id').eq('nickname', '잘못된 특성')
    expect(rejectedRows.data).toEqual([])
  })

  it('종이 배울 수 없는 기술이 하나라도 있으면 포켓몬까지 롤백한다', async () => {
    const nickname = '기술 원자성 실패'
    const created = await alice.rpc('create_owned_pokemon_with_moves', rpcInput({
      p_nickname: nickname,
      p_target_moves: [{ move_id: ids.invalidMove, condition_ko: '특별한 방법으로 습득' }],
    }))

    expect(created.error).not.toBeNull()
    const rows = await alice.from('owned_pokemon').select('id').eq('nickname', nickname)
    expect(rows.data).toEqual([])
  })

  it.each([
    '조작한 한국어 습득 조건',
    'Level 5 acquisition',
  ])('활성 게시본 경로와 정확히 같지 않은 목표 조건 %s을 거부하고 전부 롤백한다', async (conditionKo) => {
    const nickname = `조건 위조-${conditionKo}`
    const created = await alice.rpc('create_owned_pokemon_with_moves', rpcInput({
      p_nickname: nickname,
      p_target_moves: [{ move_id: ids.validMove, condition_ko: conditionKo }],
    }))

    expect(created.error).not.toBeNull()
    const rows = await alice.from('owned_pokemon').select('id').eq('nickname', nickname)
    expect(rows.data).toEqual([])
  })

  it('은퇴 특성 관계와 publication 없는 기술 경로를 조회·등록에서 제외한다', async () => {
    const filtered = await listPokemonFilteredOptions(
      alice as SupabaseClient<Database>,
      ids.species,
      ids.exactForm,
    )
    expect(filtered.abilities.map((ability) => ability.id)).toEqual([ids.exactAbility])
    expect(filtered.moves.map((move) => move.id)).toEqual([ids.validMove])

    const retiredAbility = await alice.rpc('create_owned_pokemon_with_moves', rpcInput({
      p_nickname: '은퇴 특성 거부',
      p_ability_id: ids.retiredAbility,
    }))
    const nullMove = await alice.rpc('create_owned_pokemon_with_moves', rpcInput({
      p_nickname: '무게시 기술 거부',
      p_current_moves: [{ move_id: ids.nullPublicationMove }],
      p_target_moves: [{
        move_id: ids.nullPublicationMove,
        condition_ko: '무게시 경로로 습득',
      }],
    }))

    expect(retiredAbility.error).not.toBeNull()
    expect(nullMove.error).not.toBeNull()
    const rows = await alice
      .from('owned_pokemon')
      .select('nickname')
      .in('nickname', ['은퇴 특성 거부', '무게시 기술 거부'])
    expect(rows.data).toEqual([])
  })

  it('빠른 수정 RPC는 소유 포켓몬의 활성 폼 특성만 허용한다', async () => {
    const pokemonId = await createFixturePokemon(`빠른 수정-${randomUUID()}`)

    const valid = await alice.rpc('update_owned_pokemon_quick', quickInput(
      pokemonId,
      ids.exactAbility,
    ))
    const invalid = await alice.rpc('update_owned_pokemon_quick', quickInput(
      pokemonId,
      ids.baseAbility,
    ))
    const invalidDirectUpdate = await alice
      .from('owned_pokemon')
      .update({ ability_id: ids.baseAbility })
      .eq('id', pokemonId)

    expect(valid.error).toBeNull()
    expect(invalid.error).not.toBeNull()
    expect(invalidDirectUpdate.error).not.toBeNull()
    const row = await alice
      .from('owned_pokemon')
      .select('ability_id,level')
      .eq('id', pokemonId)
      .single()
    expect(row.data).toEqual({ ability_id: ids.exactAbility, level: 13 })
  })

  it('직접 변경과 등록에서 허용되지 않은 테라·거다이맥스 및 전투 전용 폼을 거부한다', async () => {
    const pokemonId = await createFixturePokemon(`전투 무결성-${randomUUID()}`)
    const invalidTera = await alice.from('owned_pokemon')
      .update({ tera_type_id: ids.invalidTeraType }).eq('id', pokemonId)
    const invalidGmax = await alice.from('owned_pokemon')
      .update({ has_gigantamax_factor: true, form_id: ids.baseForm }).eq('id', pokemonId)
    const battleOnly = await alice.rpc('create_owned_pokemon_with_moves', rpcInput({
      p_form_id: ids.gigantamaxForm,
      p_nickname: '전투 전용 모습 거부',
    }))
    const invalidCreate = await alice.rpc('create_owned_pokemon_with_moves', rpcInput({
      p_tera_type_id: ids.invalidTeraType,
      p_nickname: '잘못된 테라 거부',
    }))

    expect(invalidTera.error).not.toBeNull()
    expect(invalidGmax.error).not.toBeNull()
    expect(battleOnly.error).not.toBeNull()
    expect(invalidCreate.error).not.toBeNull()
  })

  it('구 10인자 빠른 수정은 전투 필드를 보존하고 정정은 새 폼에서 무효한 값을 정리한다', async () => {
    const created = await alice.rpc('create_owned_pokemon_with_moves', rpcInput({
      p_tera_type_id: ids.allowedTeraType,
      p_has_gigantamax_factor: true,
      p_nickname: '전투 값 보존',
    }))
    expect(created.error).toBeNull()
    const pokemonId = created.data as string
    const oldQuickEdit = await alice.rpc('update_owned_pokemon_quick', quickInput(pokemonId, ids.exactAbility))
    expect(oldQuickEdit.error).toBeNull()
    const preserved = await alice.from('owned_pokemon')
      .select('tera_type_id,has_gigantamax_factor').eq('id', pokemonId).single()
    expect(preserved.data).toEqual({ tera_type_id: ids.allowedTeraType, has_gigantamax_factor: true })

    const corrected = await alice.rpc('correct_owned_pokemon', correctionInput(pokemonId, {
      p_species_id: ids.otherSpecies,
      p_form_id: ids.otherForm,
      p_reason_ko: '전투 선택지 재조정 검증',
    }))
    expect(corrected.error).toBeNull()
    const reconciled = await alice.from('owned_pokemon')
      .select('tera_type_id,has_gigantamax_factor').eq('id', pokemonId).single()
    expect(reconciled.data).toEqual({ tera_type_id: null, has_gigantamax_factor: false })
  })

  it('종 정정은 특성과 모든 기술을 지우고 감사 전후에 종속 상태를 남긴다', async () => {
    const pokemonId = await createFixturePokemon(`종 정정-${randomUUID()}`)
    const corrected = await alice.rpc('correct_owned_pokemon', correctionInput(pokemonId, {
      p_species_id: ids.otherSpecies,
      p_form_id: ids.otherForm,
      p_reason_ko: '잘못 입력한 종과 모습을 정정함',
    }))
    expect(corrected.error).toBeNull()

    const [row, moves, audit] = await Promise.all([
      alice.from('owned_pokemon').select('species_id,form_id,ability_id').eq('id', pokemonId).single(),
      alice.from('owned_pokemon_moves').select('move_id').eq('owned_pokemon_id', pokemonId),
      alice.from('audit_events')
        .select('before_data,after_data,reason_ko')
        .eq('entity_id', pokemonId)
        .eq('action', 'correct')
        .single(),
    ])
    expect(row.data).toEqual({
      species_id: ids.otherSpecies,
      form_id: ids.otherForm,
      ability_id: null,
    })
    expect(moves.data).toEqual([])
    expect(audit.data).toMatchObject({
      reason_ko: '잘못 입력한 종과 모습을 정정함',
      before_data: {
        dependent_state: {
          ability_id: ids.exactAbility,
          moves: [
            { move_id: ids.validMove, kind: 'current', slot: 1, target_condition_ko: '' },
            {
              move_id: ids.validMove,
              kind: 'target',
              slot: 1,
              target_condition_ko: '레벨 5에 습득',
            },
          ],
        },
      },
      after_data: { dependent_state: { ability_id: null, moves: [] } },
    })
  })

  it('폼만 정정하면 기술은 유지하고 새 exact/base 폼에서 무효인 특성만 지운다', async () => {
    const pokemonId = await createFixturePokemon(`폼 정정-${randomUUID()}`)
    const corrected = await alice.rpc('correct_owned_pokemon', correctionInput(pokemonId, {
      p_form_id: ids.fallbackForm,
      p_reason_ko: '잘못 입력한 모습 정보를 정정함',
    }))
    expect(corrected.error).toBeNull()

    const [row, moves, audit] = await Promise.all([
      alice.from('owned_pokemon').select('form_id,ability_id').eq('id', pokemonId).single(),
      alice.from('owned_pokemon_moves')
        .select('move_id,kind,slot,target_condition_ko')
        .eq('owned_pokemon_id', pokemonId)
        .order('kind'),
      alice.from('audit_events')
        .select('before_data,after_data')
        .eq('entity_id', pokemonId)
        .eq('action', 'correct')
        .single(),
    ])
    expect(row.data).toEqual({ form_id: ids.fallbackForm, ability_id: null })
    expect(moves.data).toEqual([
      { move_id: ids.validMove, kind: 'current', slot: 1, target_condition_ko: '' },
      {
        move_id: ids.validMove,
        kind: 'target',
        slot: 1,
        target_condition_ko: '레벨 5에 습득',
      },
    ])
    expect(audit.data?.before_data).toMatchObject({
      dependent_state: { ability_id: ids.exactAbility, moves: expect.any(Array) },
    })
    expect(audit.data?.after_data).toMatchObject({
      dependent_state: { ability_id: null, moves: expect.any(Array) },
    })
    expect((audit.data?.after_data as { dependent_state?: { moves?: unknown[] } })
      .dependent_state?.moves).toHaveLength(2)
  })

  it('정정 후반 제약 실패는 먼저 지운 종속 행까지 한 트랜잭션으로 되돌린다', async () => {
    const pokemonId = await createFixturePokemon(`정정 롤백-${randomUUID()}`)
    const invalidStats = { ...stats, hp: 32 }
    const corrected = await alice.rpc('correct_owned_pokemon', correctionInput(pokemonId, {
      p_species_id: ids.otherSpecies,
      p_form_id: ids.otherForm,
      p_original_iv: invalidStats,
      p_reason_ko: '롤백 검증을 위한 잘못된 정정',
    }))
    expect(corrected.error).not.toBeNull()

    const [row, moves, audits] = await Promise.all([
      alice.from('owned_pokemon').select('species_id,form_id,ability_id').eq('id', pokemonId).single(),
      alice.from('owned_pokemon_moves').select('id').eq('owned_pokemon_id', pokemonId),
      alice.from('audit_events').select('id').eq('entity_id', pokemonId).eq('action', 'correct'),
    ])
    expect(row.data).toEqual({
      species_id: ids.species,
      form_id: ids.exactForm,
      ability_id: ids.exactAbility,
    })
    expect(moves.data).toHaveLength(2)
    expect(audits.data).toEqual([])
  })

  it('RPC가 4개 초과·중복·빈 목표 조건을 각각 거부한다', async () => {
    const invalidPayloads = [
      rpcInput({
        p_current_moves: [1, 2, 3, 4, 5].map(() => ({ move_id: ids.validMove })),
      }),
      rpcInput({
        p_target_moves: [
          { move_id: ids.validMove, condition_ko: '레벨 5에 습득' },
          { move_id: ids.validMove, condition_ko: '레벨 5에 습득' },
        ],
      }),
      rpcInput({
        p_target_moves: [{ move_id: ids.validMove, condition_ko: '   ' }],
      }),
    ]

    for (const payload of invalidPayloads) {
      const created = await alice.rpc('create_owned_pokemon_with_moves', payload)
      expect(created.error).not.toBeNull()
    }
  })

  it('비인증 호출을 거부한다', async () => {
    const created = await anonymous.rpc('create_owned_pokemon_with_moves', rpcInput())
    expect(created.error).not.toBeNull()
  })
})
