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
  type: randomUUID(),
  species: randomUUID(),
  baseForm: randomUUID(),
  exactForm: randomUUID(),
  fallbackForm: randomUUID(),
  baseAbility: randomUUID(),
  exactAbility: randomUUID(),
  validMove: randomUUID(),
  invalidMove: randomUUID(),
}

let admin: SupabaseClient
let alice: SupabaseClient
let anonymous: SupabaseClient
let aliceId: string
let nationalDexNumber: number

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
    const publication = await admin.from('data_publications').insert({
      id: ids.publication,
      version: `transaction-${ids.publication}`,
    })
    expect(publication.error).toBeNull()
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
    const forms = await admin.from('reference_forms').insert([
      {
        id: ids.baseForm,
        publication_id: ids.publication,
        species_id: ids.species,
        identifier: `transaction-base-${ids.baseForm}`,
        name_ko: '기본 모습',
        is_default: true,
      },
      {
        id: ids.exactForm,
        publication_id: ids.publication,
        species_id: ids.species,
        base_form_id: ids.baseForm,
        identifier: `transaction-exact-${ids.exactForm}`,
        name_ko: '정확한 모습',
        is_default: false,
      },
      {
        id: ids.fallbackForm,
        publication_id: ids.publication,
        species_id: ids.species,
        base_form_id: ids.baseForm,
        identifier: `transaction-fallback-${ids.fallbackForm}`,
        name_ko: '대체 모습',
        is_default: false,
      },
    ])
    expect(forms.error).toBeNull()
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
  })

  afterAll(async () => {
    if (!admin) return
    if (aliceId) await admin.auth.admin.deleteUser(aliceId)
    await admin.from('reference_move_learnsets').delete().eq('publication_id', ids.publication)
    await admin.from('reference_form_abilities').delete().eq('publication_id', ids.publication)
    await admin.from('reference_moves').delete().in('id', [ids.validMove, ids.invalidMove])
    await admin.from('reference_abilities').delete().in('id', [ids.baseAbility, ids.exactAbility])
    await admin.from('reference_forms').delete().in('id', [ids.exactForm, ids.fallbackForm])
    await admin.from('reference_forms').delete().eq('id', ids.baseForm)
    await admin.from('reference_species').delete().eq('id', ids.species)
    await admin.from('reference_types').delete().eq('id', ids.type)
    await admin.from('data_publications').delete().eq('id', ids.publication)
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
