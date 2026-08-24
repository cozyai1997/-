import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import {
  damageClassLabelKo,
  correctOwnedPokemon,
  createOwnedPokemon,
  getOwnedPokemonDetail,
  groupAbilityOptions,
  groupMoveOptions,
  learnMethodLabelKo,
  listOwnedPokemon,
  listOwnedPokemonEditOptions,
  listPokemonFilteredOptions,
  listSpeciesOptions,
  updateOwnedPokemonQuick,
} from '@/features/owned-pokemon/repository'
import { createRegistrationDraft } from '@/features/owned-pokemon/registration-state'
import type { Database } from '@/types/database.generated'

describe('포켓몬 필터 표시 라벨', () => {
  it('지원하는 획득 경로를 닫힌 순서의 한국어로 변환한다', () => {
    expect([
      'level',
      'tm',
      'tutor',
      'egg',
      'special',
      'form_change',
      'legacy',
    ].map(learnMethodLabelKo)).toEqual([
      '레벨업',
      '기술머신',
      '기술 가르침',
      '유전',
      '특별한 방법',
      '모습 변경',
      '과거 버전',
    ])
    expect(() => learnMethodLabelKo('unknown')).toThrow('지원하지 않는 기술 습득 경로입니다.')
  })

  it('기술 분류를 닫힌 한국어 라벨로 변환한다', () => {
    expect(['physical', 'special', 'status'].map(damageClassLabelKo)).toEqual([
      '물리',
      '특수',
      '변화',
    ])
    expect(() => damageClassLabelKo('unknown')).toThrow('지원하지 않는 기술 분류입니다.')
  })
})

describe('폼 특성 선택지', () => {
  const ability = (formId: string, id: string, nameKo: string, isHidden: boolean) => ({
    form_id: formId,
    is_hidden: isHidden,
    reference_abilities: {
      id,
      name_ko: nameKo,
      description_ko: `${nameKo} 설명`,
      is_active: true,
    },
  })

  it('정확한 폼 관계가 있으면 기본 폼 관계를 사용하지 않는다', () => {
    const result = groupAbilityOptions([
      ability('base', 'base-ability', '가볍', false),
      ability('exact', 'exact-ability', '나옹', false),
    ], 'exact', 'base')

    expect(result).toEqual([{
      id: 'exact-ability',
      nameKo: '나옹',
      descriptionKo: '나옹 설명',
      isHidden: false,
    }])
  })

  it('정확한 폼 관계가 하나도 없을 때만 기본 폼으로 대체한다', () => {
    const result = groupAbilityOptions([
      ability('base', 'base-ability', '피카츄', false),
    ], 'exact', 'base')

    expect(result.map((option) => option.id)).toEqual(['base-ability'])
  })

  it('같은 특성 ID를 하나로 합치고 중복 행 중 숨겨진 표시를 우선한다', () => {
    const result = groupAbilityOptions([
      ability('exact', 'same', '하나', false),
      ability('exact', 'same', '하나', true),
      ability('exact', 'other', '가나', false),
    ], 'exact', null)

    expect(result).toEqual([
      { id: 'other', nameKo: '가나', descriptionKo: '가나 설명', isHidden: false },
      { id: 'same', nameKo: '하나', descriptionKo: '하나 설명', isHidden: true },
    ])
  })
})

describe('종별 기술 선택지', () => {
  const move = (
    id: string,
    nameKo: string,
    learnMethod: string,
    conditionKo: string,
  ) => ({
    learn_method: learnMethod,
    condition_ko: conditionKo,
    reference_moves: {
      id,
      name_ko: nameKo,
      description_ko: `${nameKo} 설명`,
      damage_class: 'physical',
      power: 40,
      accuracy: 100,
      pp: 35,
      is_active: true,
      reference_types: { name_ko: '노말' },
    },
  })

  it('기술 ID로 합치면서 서로 다른 한국어 획득 경로를 모두 보존한다', () => {
    const result = groupMoveOptions([
      move('tackle', '몸통박치기', 'tm', '기술머신으로 습득'),
      move('tackle', '몸통박치기', 'level', '레벨 1에 습득'),
      move('tackle', '몸통박치기', 'level', '레벨 1에 습득'),
      move('splash', '튀어오르기', 'egg', '유전으로 습득'),
    ])

    expect(result).toEqual([
      {
        id: 'tackle',
        nameKo: '몸통박치기',
        descriptionKo: '몸통박치기 설명',
        typeKo: '노말',
        damageClassKo: '물리',
        power: 40,
        accuracy: 100,
        pp: 35,
        routes: [
          { methodKo: '레벨업', conditionKo: '레벨 1에 습득' },
          { methodKo: '기술머신', conditionKo: '기술머신으로 습득' },
        ],
      },
      {
        id: 'splash',
        nameKo: '튀어오르기',
        descriptionKo: '튀어오르기 설명',
        typeKo: '노말',
        damageClassKo: '물리',
        power: 40,
        accuracy: 100,
        pp: 35,
        routes: [{ methodKo: '유전', conditionKo: '유전으로 습득' }],
      },
    ])
  })
})

describe('필터 저장소 요청 순서', () => {
  it('독립적인 폼과 종별 기술 요청을 둘 다 소비한 뒤 어느 하나를 해결한다', async () => {
    const events: string[] = []
    const filters: Array<[string, string, unknown]> = []
    const consumedIndependent = new Set<string>()
    const payloads: Record<string, unknown> = {
      data_publications: {
        data: { id: 'active-publication' },
        error: null,
      },
      reference_forms: {
        data: {
          id: 'exact', species_id: 'species', base_form_id: 'base', is_battle_only: false,
          base_hp: 55, base_attack: 55, base_defense: 50,
          base_special_attack: 45, base_special_defense: 65, base_speed: 55,
          reference_species: { identifier: 'eevee' },
        },
        error: null,
      },
      reference_move_learnsets: {
        data: [{
          learn_method: 'level',
          condition_ko: '레벨 1에 습득',
          reference_moves: {
            id: 'move',
            name_ko: '몸통박치기',
            description_ko: '상대에게 부딪친다.',
            damage_class: 'physical',
            power: 40,
            accuracy: 100,
            pp: 35,
            is_active: true,
            reference_types: { name_ko: '노말' },
          },
        }],
        error: null,
      },
      reference_form_abilities: {
        data: [{
          form_id: 'exact',
          is_hidden: false,
          reference_abilities: {
            id: 'ability',
            name_ko: '적응력',
            description_ko: '같은 타입 기술이 강해진다.',
            is_active: true,
          },
        }],
        error: null,
      },
      reference_form_tera_options: {
        data: [{
          tera_type_id: 'tera-water',
          reference_tera_types: { id: 'tera-water', name_ko: '물', sort_order: 2, is_active: true },
        }],
        error: null,
      },
      reference_form_gigantamax_options: {
        data: { source_form_id: 'exact' },
        error: null,
      },
    }

    function lazyQuery(table: string) {
      const query = {
        select() { return query },
        eq(column: string, value: unknown) {
          filters.push([table, column, value])
          return query
        },
        maybeSingle() { return query },
        in() { return query },
        order() { return query },
        limit() { return query },
        then(
          onFulfilled: (value: unknown) => unknown,
          onRejected: (reason: unknown) => unknown,
        ) {
          events.push(`consume:${table}`)
          if (table === 'reference_forms' || table === 'reference_move_learnsets') {
            consumedIndependent.add(table)
          }
          return Promise.resolve()
            .then(() => {
              if (
                (table === 'reference_forms' || table === 'reference_move_learnsets')
                && consumedIndependent.size !== 2
              ) {
                throw new Error('독립 요청 둘을 먼저 소비해야 합니다.')
              }
              events.push(`resolve:${table}`)
              return payloads[table]
            })
            .then(onFulfilled, onRejected)
        },
      }
      return query
    }

    const client = {
      from(table: string) {
        return lazyQuery(table)
      },
    } as unknown as SupabaseClient<Database>

    const result = await listPokemonFilteredOptions(client, 'species', 'exact')

    const formResolution = events.findIndex((event) => event === 'resolve:reference_forms')
    expect(events.slice(2, formResolution)).toEqual([
      'consume:reference_forms',
      'consume:reference_move_learnsets',
    ])
    expect(events.slice(0, 2)).toEqual([
      'consume:data_publications',
      'resolve:data_publications',
    ])
    expect(filters).toEqual(expect.arrayContaining([
      ['data_publications', 'status', 'active'],
      ['reference_forms', 'publication_id', 'active-publication'],
      ['reference_move_learnsets', 'publication_id', 'active-publication'],
      ['reference_form_abilities', 'publication_id', 'active-publication'],
    ]))
    expect(result).toMatchObject({
      abilities: [{ id: 'ability', nameKo: '적응력' }],
      moves: [{ id: 'move', nameKo: '몸통박치기' }],
      battle: {
        baseStats: {
          hp: 55,
          attack: 55,
          defense: 50,
          special_attack: 45,
          special_defense: 65,
          speed: 55,
        },
        hpRule: 'standard',
        teraTypes: [{ id: 'tera-water', nameKo: '물' }],
        canGigantamax: true,
      },
    })
  })
})

function queryClient(
  payloads: Record<string, { data: unknown; error: unknown }>,
  options: {
    filters?: Array<[string, string, unknown]>
    ranges?: Array<[string, number, number]>
    requireLimitFor?: string
  } = {},
) {
  function query(table: string) {
    const result = payloads[table] ?? { data: [], error: null }
    let limited = false
    let single = false
    const builder = {
      select() { return builder },
      eq(column: string, value: unknown) {
        options.filters?.push([table, column, value])
        return builder
      },
      in() { return builder },
      order() { return builder },
      range(from: number, to: number) {
        options.ranges?.push([table, from, to])
        return builder
      },
      limit() {
        limited = true
        return builder
      },
      maybeSingle() {
        single = true
        return builder
      },
      then(onFulfilled: (value: unknown) => unknown, onRejected: (reason: unknown) => unknown) {
        const response = table === options.requireLimitFor && !limited
          ? { data: null, error: new Error('다중 거다이맥스 관계에는 limit(1)이 필요합니다.') }
          : single && Array.isArray(result.data)
            ? { ...result, data: result.data[0] ?? null }
            : result
        return Promise.resolve(response).then(onFulfilled, onRejected)
      },
    }
    return builder
  }

  return {
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: 'user' } }, error: null }),
    },
    from: (table: string) => query(table),
  } as unknown as SupabaseClient<Database>
}

describe('전투 기준 저장소 계약', () => {
  it('등록 선택지는 활성 게시본의 battle-only 모습을 제외한다', async () => {
    const result = await listSpeciesOptions(queryClient({
      data_publications: { data: { id: 'publication' }, error: null },
      reference_species: {
        data: [{
          id: 'species', name_ko: '이브이', national_dex_number: 133,
          reference_forms: [
            { id: 'normal', name_ko: '기본 모습', is_default: true, is_battle_only: false },
            { id: 'gmax', name_ko: '거다이맥스', is_default: false, is_battle_only: true },
          ],
        }],
        error: null,
      },
    }))

    expect(result).toEqual([{
      id: 'species', nameKo: '이브이', nationalDexNumber: 133,
      forms: [{ id: 'normal', nameKo: '기본 모습', isDefault: true }],
    }])
  })

  it('여러 거다이맥스 대상 관계가 있어도 존재 여부만 확인한다', async () => {
    const result = await listPokemonFilteredOptions(queryClient({
      data_publications: { data: { id: 'publication' }, error: null },
      reference_forms: {
        data: {
          id: 'form', species_id: 'species', base_form_id: null,
          base_hp: 1, base_attack: 1, base_defense: 1,
          base_special_attack: 1, base_special_defense: 1, base_speed: 1,
          reference_species: { identifier: 'eevee' },
        },
        error: null,
      },
      reference_move_learnsets: { data: [], error: null },
      reference_form_abilities: { data: [], error: null },
      reference_form_tera_options: { data: [], error: null },
      reference_form_gigantamax_options: {
        data: [{ source_form_id: 'form' }, { source_form_id: 'form' }],
        error: null,
      },
    }, { requireLimitFor: 'reference_form_gigantamax_options' }), 'species', 'form')

    expect(result.battle.canGigantamax).toBe(true)
  })

  it('목록과 과거 상세는 한국어 테라타입, 인자, 기술 전투 세부정보를 보존한다', async () => {
    const filters: Array<[string, string, unknown]> = []
    const ranges: Array<[string, number, number]> = []
    const client = queryClient({
      owned_pokemon: {
        data: [{
          id: 'owned', species_id: 'species', form_id: 'legacy-battle-only', nickname: '밤', gender: 'female',
          level: 50, captured_on: null, original_nature_id: null, effective_nature_id: null, ability_id: null,
          original_iv: {}, effective_iv: {}, ev: {}, held_item_id: null, notes: '', created_at: '2026-08-24',
          tera_type_id: 'tera-water', has_gigantamax_factor: true,
          reference_species: { name_ko: '이브이', national_dex_number: 133, identifier: 'eevee' },
          reference_forms: {
            name_ko: '거다이맥스', base_hp: 55, base_attack: 55, base_defense: 50,
            base_special_attack: 45, base_special_defense: 65, base_speed: 55,
          },
          tera_type: { name_ko: '물' }, original_nature: null, effective_nature: null,
          ability: null, held_item: null,
        }],
        error: null,
      },
      reference_evolution_rules: { data: [], error: null },
      owned_pokemon_moves: {
        data: [{
          move_id: 'move', kind: 'current', slot: 1, target_condition_ko: '과거 기록',
          reference_moves: {
            name_ko: '몸통박치기', description_ko: '상대에게 부딪친다.', damage_class: 'physical',
            power: 40, accuracy: 100, pp: 35, reference_types: { name_ko: '노말' },
          },
        }, {
          move_id: 'target-move', kind: 'target', slot: 1, target_condition_ko: '기술머신으로 습득',
          reference_moves: {
            name_ko: '전광석화', description_ko: '눈보다 빠르게 공격한다.', damage_class: 'physical',
            power: 40, accuracy: 100, pp: 30, reference_types: { name_ko: '노말' },
          },
        }],
        error: null,
      },
    }, { filters, ranges })

    await expect(listOwnedPokemon(client)).resolves.toEqual([expect.objectContaining({
      teraTypeNameKo: '물', hasGigantamaxFactor: true,
    })])
    await expect(getOwnedPokemonDetail(client, 133, 1)).resolves.toEqual(expect.objectContaining({
      teraTypeNameKo: '물',
      hasGigantamaxFactor: true,
      battle: expect.objectContaining({
        baseStats: { hp: 55, attack: 55, defense: 50, special_attack: 45, special_defense: 65, speed: 55 },
        hpRule: 'standard',
      }),
      currentMoveDetails: [{
        moveId: 'move', slot: 1, nameKo: '몸통박치기', descriptionKo: '상대에게 부딪친다.',
        typeKo: '노말', damageClassKo: '물리', power: 40, accuracy: 100, pp: 35, conditionKo: '과거 기록',
      }],
      targetMoveDetails: [expect.objectContaining({ moveId: 'target-move', conditionKo: '기술머신으로 습득' })],
    }))
    expect(filters).toContainEqual(['owned_pokemon', 'reference_species.national_dex_number', 133])
    expect(filters).toContainEqual(['owned_pokemon', 'user_id', 'user'])
    expect(filters).toContainEqual(['owned_pokemon', 'id', 'owned'])
    expect(ranges).toContainEqual(['owned_pokemon', 0, 0])
  })

  it('편집 기준데이터는 성격 보정의 닫힌 능력치 키를 포함한다', async () => {
    const options = await listOwnedPokemonEditOptions(queryClient({
      data_publications: { data: { id: 'publication' }, error: null },
      reference_species: { data: [], error: null },
      reference_natures: { data: [{ id: 'jolly', name_ko: '명랑', increased_stat: 'speed', decreased_stat: 'special_attack' }], error: null },
      reference_abilities: { data: [], error: null },
      reference_items: { data: [], error: null },
    }))

    expect(options.natures).toEqual([{
      id: 'jolly', nameKo: '명랑', increasedStat: 'speed', decreasedStat: 'special_attack',
    }])
  })
})

describe('빠른 수정 저장소 경계', () => {
  it('임의 특성을 허용하는 테이블 UPDATE 대신 권한·폼 검증 RPC만 호출한다', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    const client = {
      rpc,
      from: vi.fn(() => { throw new Error('직접 테이블 UPDATE를 호출하면 안 됩니다.') }),
    } as unknown as SupabaseClient<Database>

    await updateOwnedPokemonQuick(client, 'owned-pokemon', {
      ...createRegistrationDraft(),
      speciesId: 'species',
      formId: 'form',
      abilityId: 'ability',
    })

    expect(rpc).toHaveBeenCalledWith('update_owned_pokemon_quick', expect.objectContaining({
      p_owned_pokemon_id: 'owned-pokemon',
      p_ability_id: 'ability',
      p_apply_battle_options: true,
      p_tera_type_id: null,
      p_has_gigantamax_factor: false,
    }))
  })

  it('등록은 테라타입과 거다이맥스 인자를 하나의 RPC 인자로 보낸다', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 'owned-pokemon', error: null })
    const client = { rpc } as unknown as SupabaseClient<Database>
    await createOwnedPokemon(client, {
      ...createRegistrationDraft(), speciesId: 'species', formId: 'form', teraTypeId: 'tera-water',
      hasGigantamaxFactor: true,
    })

    expect(rpc).toHaveBeenCalledWith('create_owned_pokemon_with_moves', expect.objectContaining({
      p_tera_type_id: 'tera-water', p_has_gigantamax_factor: true,
    }))
  })

  it('보호 정보 정정은 전투 인자를 덧붙이지 않고 서버의 기존 조정 서명을 유지한다', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    const client = { rpc } as unknown as SupabaseClient<Database>
    await correctOwnedPokemon(client, 'owned-pokemon', {
      ...createRegistrationDraft(), speciesId: 'species', formId: 'form', teraTypeId: 'tera-water',
      hasGigantamaxFactor: true,
    }, '보호 정보 정정 사유')

    expect(rpc).toHaveBeenCalledWith('correct_owned_pokemon', {
      p_owned_pokemon_id: 'owned-pokemon', p_species_id: 'species', p_form_id: 'form',
      p_captured_on: null, p_original_iv: expect.any(Object), p_reason_ko: '보호 정보 정정 사유',
    })
  })
})
