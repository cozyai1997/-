import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import {
  damageClassLabelKo,
  groupAbilityOptions,
  groupMoveOptions,
  learnMethodLabelKo,
  listPokemonFilteredOptions,
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
        data: { id: 'exact', species_id: 'species', base_form_id: 'base' },
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
    })
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
    }))
  })
})
