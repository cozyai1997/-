import { describe, expect, it, vi } from 'vitest'

import {
  assertKoreanOptionDisplayValues,
  assertOptionFilterPublicationCounts,
  prepareBattlePublicationRows,
  publishPokemonOptionFilterReferenceData,
  stageThenReplacePublicationRows,
} from '../../scripts/data/publish-pokemon-option-filter-reference-data'
import type { ReferenceDataset } from '@/features/localization/reference-data-validation'

function countCorrectCandidate(): ReferenceDataset {
  const types = [
    { id: 'normal', nameKo: '노말' },
    ...Array.from({ length: 17 }, (_, index) => ({ id: `type-${index}`, nameKo: `타입가-${index}` })),
  ]
  const species = [
    {
      id: 'species-a', nationalDexNumber: 1, nameKo: '이상해씨',
      descriptionKo: '검증용 포켓몬이다.',
    },
    ...Array.from({ length: 1_024 }, (_, index) => ({
      id: `species-${index + 1}`,
      nationalDexNumber: index + 2,
      nameKo: `포켓몬가-${index + 1}`,
      descriptionKo: `검증용 포켓몬 설명 ${index + 1}`,
    })),
  ]
  const forms = Array.from({ length: 1_498 }, (_, index) => ({
    id: `form-${index}`,
    speciesId: 'species-a',
    baseFormId: index === 0 ? null : 'form-0',
    nameKo: `모습가-${index}`,
    primaryTypeId: 'normal',
    secondaryTypeId: null,
    baseStats: { hp: 50, attack: 50, defense: 50, special_attack: 50, special_defense: 50, speed: 50 },
    isBattleOnly: index >= 1_334,
    aspects: [],
  }))
  const moves = Array.from({ length: 826 }, (_, index) => ({
    id: `move-${index}`,
    nameKo: `기술가-${index}`,
    descriptionKo: `한국어 기술 설명 ${index}`,
    typeId: 'normal',
    damageClass: 'physical' as const,
    power: 40,
    accuracy: 100,
    pp: 35,
  }))

  return {
    version: 'candidate-v1',
    sourceCommits: { source: 'a'.repeat(40) },
    sha256: { source: 'b'.repeat(64) },
    battleOnlyDiagnostics: Array.from({ length: 9 }, (_, index) => `diagnostic-${index}`),
    reportedCounts: {
      types: 18,
      species: 1_025,
      forms: 1_498,
      abilities: 310,
      moves: 826,
      learnsets: 116_519,
      items: 615,
      evolutions: 602,
      formAbilities: 3_055,
      natures: 25,
      typeMatchups: 324,
      teraTypes: 19,
      formTeraOptions: 25_184,
      formGigantamaxOptions: 42,
    },
    types,
    species,
    forms,
    abilities: [
      { id: 'ability-a', nameKo: '심록', descriptionKo: '위기일 때 풀 타입 기술이 강해진다.' },
      ...Array.from({ length: 309 }, (_, index) => ({
        id: `ability-${index + 1}`,
        nameKo: `특성가-${index + 1}`,
        descriptionKo: `검증용 특성 설명 ${index + 1}`,
      })),
    ],
    moves,
    learnsets: Array.from({ length: 116_519 }, (_, index) => ({
      speciesId: 'species-a',
      formId: null,
      moveId: `move-${index % 826}`,
      learnMethod: 'level' as const,
      learnLevel: 1,
      conditionKo: `레벨 1에 습득 ${index}`,
    })),
    items: Array.from({ length: 615 }, (_, index) => ({
      id: `item-${index}`,
      nameKo: `도구가-${index}`,
      descriptionKo: `검증용 도구 설명 ${index}`,
    })),
    evolutions: Array.from({ length: 602 }, (_, index) => ({
      id: `species-a>species-a:${index}`,
      fromSpeciesId: 'species-a',
      toSpeciesId: 'species-a',
      toFormId: `form-${index + 1}`,
      conditionKo: `레벨 ${index + 1}에 진화`,
    })),
    formAbilities: Array.from({ length: 3_055 }, (_, index) => ({
      formId: `form-${index % 1_498}`,
      speciesId: 'species-a',
      abilityId: 'ability-a',
      slot: `slot-${Math.floor(index / 1_498)}`,
      isHidden: false,
    })),
    natures: Array.from({ length: 25 }, (_, index) => ({
      id: `nature-${index}`, nameKo: `성격가-${index}`, increasedStat: null, decreasedStat: null,
    })),
    teraTypes: Array.from({ length: 19 }, (_, index) => ({
      id: `tera-${index}`, nameKo: `테라가-${index}`, referenceTypeId: null, sortOrder: index,
    })),
    formTeraOptions: [
      ...Array.from({ length: 1_325 }, (_, formIndex) => Array.from({ length: 19 }, (_, teraIndex) => ({
        formId: `form-${formIndex}`, teraTypeId: `tera-${teraIndex}`,
      }))).flat(),
      ...Array.from({ length: 9 }, (_, index) => ({
        formId: `form-${1_325 + index}`, teraTypeId: 'tera-0',
      })),
    ],
    formGigantamaxOptions: Array.from({ length: 42 }, (_, index) => ({
      sourceFormId: `form-${index}`, gigantamaxFormId: `form-${1_334 + index}`,
    })),
    typeMatchups: types.flatMap((attackingType) => types.map((defendingType) => ({
      attackingTypeId: attackingType.id,
      defendingTypeId: defendingType.id,
      multiplier: 1,
    }))),
  }
}

const validCandidate = countCorrectCandidate()

describe('포켓몬 선택 필터 게시', () => {
  it('전투 게시 행은 내부 UUID를 연결하고 화면용 이름은 한국어만 유지한다', () => {
    const dataset = {
      ...countCorrectCandidate(),
      forms: [
        {
          id: 'form-a', speciesId: 'species-a', baseFormId: null, nameKo: '일반',
          primaryTypeId: 'normal', secondaryTypeId: null,
          baseStats: { hp: 50, attack: 51, defense: 52, special_attack: 53, special_defense: 54, speed: 55 },
          isBattleOnly: false, aspects: [],
        },
        {
          id: 'form-a-gmax', speciesId: 'species-a', baseFormId: 'form-a', nameKo: '거다이맥스',
          primaryTypeId: 'normal', secondaryTypeId: null,
          baseStats: { hp: 50, attack: 51, defense: 52, special_attack: 53, special_defense: 54, speed: 55 },
          isBattleOnly: true, aspects: ['gmax'],
        },
      ],
      natures: [{ id: 'hardy', nameKo: '노력', increasedStat: null, decreasedStat: null }],
      teraTypes: [{ id: 'normal', nameKo: '노말', referenceTypeId: 'normal', sortOrder: 0 }],
      formTeraOptions: [{ formId: 'form-a', teraTypeId: 'normal' }],
      formGigantamaxOptions: [{ sourceFormId: 'form-a', gigantamaxFormId: 'form-a-gmax' }],
    } as ReferenceDataset

    const rows = prepareBattlePublicationRows(dataset, {
      formIds: new Map([
        ['form-a', '00000000-0000-4000-8000-000000000001'],
        ['form-a-gmax', '00000000-0000-4000-8000-000000000005'],
      ]),
      natureIds: new Map([['hardy', '00000000-0000-4000-8000-000000000002']]),
      teraTypeIds: new Map([['normal', '00000000-0000-4000-8000-000000000003']]),
      typeIds: new Map([['normal', '00000000-0000-4000-8000-000000000004']]),
    })

    expect(rows).toEqual([
      {
        rowKind: 'form_battle_profile',
        payload: {
          form_id: '00000000-0000-4000-8000-000000000001', base_form_id: null,
          base_hp: 50, base_attack: 51, base_defense: 52, base_special_attack: 53,
          base_special_defense: 54, base_speed: 55, is_battle_only: false,
        },
      },
      {
        rowKind: 'form_battle_profile',
        payload: {
          form_id: '00000000-0000-4000-8000-000000000005',
          base_form_id: '00000000-0000-4000-8000-000000000001',
          base_hp: 50, base_attack: 51, base_defense: 52, base_special_attack: 53,
          base_special_defense: 54, base_speed: 55, is_battle_only: true,
        },
      },
      {
        rowKind: 'nature_adjustment',
        payload: {
          nature_id: '00000000-0000-4000-8000-000000000002',
          increased_stat: null, decreased_stat: null,
        },
      },
      {
        rowKind: 'tera_type',
        payload: {
          tera_type_id: '00000000-0000-4000-8000-000000000003', identifier: 'normal', name_ko: '노말',
          reference_type_id: '00000000-0000-4000-8000-000000000004', sort_order: 0,
        },
      },
      {
        rowKind: 'form_tera_option',
        payload: {
          form_id: '00000000-0000-4000-8000-000000000001',
          tera_type_id: '00000000-0000-4000-8000-000000000003',
        },
      },
      {
        rowKind: 'form_gigantamax_option',
        payload: {
          source_form_id: '00000000-0000-4000-8000-000000000001',
          gigantamax_form_id: '00000000-0000-4000-8000-000000000005',
        },
      },
    ])
    expect(JSON.stringify(rows)).not.toContain('form-a')
    expect(rows.find((row) => row.rowKind === 'tera_type')?.payload.name_ko).toBe('노말')
  })

  it('한국어 기술 또는 특성 표시값이 비어 있으면 쓰기 전에 거부한다', () => {
    expect(() => assertKoreanOptionDisplayValues({
      abilities: [{ id: 'adaptability', nameKo: '적응력', descriptionKo: '   ' }],
      moves: [{ id: 'tackle', nameKo: '몸통박치기', descriptionKo: '상대에게 부딪친다.' }],
    })).toThrow('abilities:adaptability:descriptionKo')
    expect(() => assertKoreanOptionDisplayValues({
      abilities: [{ id: 'adaptability', nameKo: '적응력', descriptionKo: '같은 타입 기술이 강해진다.' }],
      moves: [{ id: 'tackle', nameKo: 'Tackle', descriptionKo: '상대에게 부딪친다.' }],
    })).toThrow('moves:tackle:nameKo')
  })

  it('전투 의미 계약을 위반한 후보는 데이터베이스 호출 전에 거부한다', async () => {
    const client = { from: vi.fn(() => { throw new Error('database should not be called') }) }
    const candidate = structuredClone(validCandidate)
    candidate.forms[0].baseStats.hp = 0

    await expect(publishPokemonOptionFilterReferenceData(candidate, client as never))
      .rejects.toThrow('forms:form-0:baseStats')
    expect(client.from).not.toHaveBeenCalled()
  })

  it('중복 관계가 있으면 전체 validator가 첫 DB 호출 전에 거부한다', async () => {
    const client = { from: vi.fn(() => { throw new Error('database should not be called') }) }
    const candidate = structuredClone(validCandidate)
    candidate.learnsets[1] = { ...candidate.learnsets[0] }

    await expect(publishPokemonOptionFilterReferenceData(candidate, client as never))
      .rejects.toThrow('learnsets:species-a::move-0:level:1:레벨 1에 습득 0:duplicate')
    expect(client.from).not.toHaveBeenCalled()
  })

  it.each([
    ['printf', (candidate: ReferenceDataset) => { candidate.items[0].nameKo = '%s포플레' }, '%s'],
    ['brace', (candidate: ReferenceDataset) => { candidate.items[0].descriptionKo = '{count}개 사용' }, '{count}'],
  ] as const)('%s 표시 토큰이 있으면 전체 validator가 첫 DB 호출 전에 거부한다', async (
    _label,
    tamper,
    token,
  ) => {
    const client = { from: vi.fn(() => { throw new Error('database should not be called') }) }
    const candidate = structuredClone(validCandidate)
    tamper(candidate)

    await expect(publishPokemonOptionFilterReferenceData(candidate, client as never))
      .rejects.toThrow(token)
    expect(client.from).not.toHaveBeenCalled()
  })

  it('행 수 또는 보고 수가 맞지 않으면 데이터베이스 호출 전에 거부한다', async () => {
    const client = { from: vi.fn(() => { throw new Error('database should not be called') }) }
    const candidate = {
      version: 'fixture-v1', sourceCommits: {}, sha256: {},
      reportedCounts: { types: 0, species: 0, forms: 0, abilities: 0, moves: 825, learnsets: 116519, items: 0, evolutions: 0, formAbilities: 3055, natures: 0, typeMatchups: 0 },
      types: [], species: [], forms: [], abilities: [], moves: [], learnsets: [], items: [], evolutions: [], formAbilities: [], natures: [], typeMatchups: [],
    } as unknown as ReferenceDataset

    await expect(publishPokemonOptionFilterReferenceData(candidate, client as never))
      .rejects.toThrow('moves:actual=0:reported=825:expected=826')
    expect(client.from).not.toHaveBeenCalled()
  })

  it.each([
    ['forms', 1497, 1498, 'forms:actual=1497:reported=1498:expected=1498'],
    ['formAbilities', 3054, 3055, 'formAbilities:actual=3054:reported=3055:expected=3055'],
    ['learnsets', 116519, 116518, 'learnsets:actual=116519:reported=116518:expected=116519'],
  ] as const)('%s의 실제 또는 보고 행 수 불일치를 거부한다', (key, actual, reported, expected) => {
    const candidate = {
      moves: Array.from({ length: 826 }),
      forms: Array.from({ length: key === 'forms' ? actual : 1498 }),
      formAbilities: Array.from({ length: key === 'formAbilities' ? actual : 3055 }),
      learnsets: Array.from({ length: key === 'learnsets' ? actual : 116519 }),
      reportedCounts: {
        moves: 826,
        forms: key === 'forms' ? reported : 1498,
        formAbilities: key === 'formAbilities' ? reported : 3055,
        learnsets: key === 'learnsets' ? reported : 116519,
        natures: 25,
        teraTypes: 19,
        formTeraOptions: 25_184,
        formGigantamaxOptions: 42,
      },
      natures: Array.from({ length: 25 }),
      teraTypes: Array.from({ length: 19 }),
      formTeraOptions: Array.from({ length: 25_184 }),
      formGigantamaxOptions: Array.from({ length: 42 }),
    } as unknown as Pick<
      ReferenceDataset,
      | 'moves'
      | 'forms'
      | 'formAbilities'
      | 'learnsets'
      | 'natures'
      | 'teraTypes'
      | 'formTeraOptions'
      | 'formGigantamaxOptions'
      | 'reportedCounts'
    >

    expect(() => assertOptionFilterPublicationCounts(candidate)).toThrow(expected)
  })

  it.each([
    [
      '기술 타입 식별자',
      (candidate: ReferenceDataset) => ({
        ...candidate,
        moves: candidate.moves.map((row, index) => index === 0
          ? { ...row, typeId: 'missing-type' }
          : row),
      }),
      'moves:move-0:typeId',
    ],
    [
      '특성 한국어 설명',
      (candidate: ReferenceDataset) => ({
        ...candidate,
        abilities: [{ ...candidate.abilities[0], descriptionKo: 'English only' }],
      }),
      'abilities:ability-a:descriptionKo',
    ],
    [
      '기술 습득 한국어 조건',
      (candidate: ReferenceDataset) => ({
        ...candidate,
        learnsets: candidate.learnsets.map((row, index) => index === 0
          ? { ...row, conditionKo: 'Level 1' }
          : row),
      }),
      'learnsets:0:conditionKo',
    ],
    [
      '기술 습득 기술 참조',
      (candidate: ReferenceDataset) => ({
        ...candidate,
        learnsets: candidate.learnsets.map((row, index) => index === 0
          ? { ...row, moveId: 'missing-move' }
          : row),
      }),
      'learnsets:0:moveId',
    ],
    [
      '기본 모습의 같은 종 소속',
      (candidate: ReferenceDataset) => ({
        ...candidate,
        species: [
          ...candidate.species,
          {
            id: 'species-b', nationalDexNumber: 2, nameKo: '이상해풀',
            descriptionKo: '두 번째 검증용 포켓몬이다.',
          },
        ],
        forms: candidate.forms.map((row, index) => index === 1
          ? { ...row, speciesId: 'species-b', baseFormId: 'form-0' }
          : row),
      }),
      'forms:form-1:baseFormId',
    ],
    [
      '폼 특성 종 일치',
      (candidate: ReferenceDataset) => ({
        ...candidate,
        species: [
          ...candidate.species,
          {
            id: 'species-b', nationalDexNumber: 2, nameKo: '이상해풀',
            descriptionKo: '두 번째 검증용 포켓몬이다.',
          },
        ],
        formAbilities: candidate.formAbilities.map((row, index) => index === 0
          ? { ...row, speciesId: 'species-b' }
          : row),
      }),
      'formAbilities:0:speciesId',
    ],
    [
      '폼 특성 특성 참조',
      (candidate: ReferenceDataset) => ({
        ...candidate,
        formAbilities: candidate.formAbilities.map((row, index) => index === 0
          ? { ...row, abilityId: 'missing-ability' }
          : row),
      }),
      'formAbilities:0:abilityId',
    ],
  ] as const)('행 수가 맞아도 %s 계약 위반은 첫 DB 호출 전에 거부한다', async (
    _label,
    modify,
    expected,
  ) => {
    const client = { from: vi.fn(() => { throw new Error('database should not be called') }) }

    await expect(publishPokemonOptionFilterReferenceData(
      modify(validCandidate),
      client as never,
    )).rejects.toThrow(expected)
    expect(client.from).not.toHaveBeenCalled()
  })

  it('후보 버전과 active 상태를 함께 만족하는 게시본만 교체 대상으로 조회한다', async () => {
    const filters: Array<[string, unknown]> = []
    const query = {
      select() { return query },
      eq(column: string, value: unknown) {
        filters.push([column, value])
        return query
      },
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const client = {
      from: vi.fn((table: string) => {
        expect(table).toBe('data_publications')
        return query
      }),
    }

    await expect(publishPokemonOptionFilterReferenceData(validCandidate, client as never))
      .rejects.toThrow('핵심 기준데이터 게시본이 없습니다')
    expect(filters).toEqual([
      ['version', validCandidate.version],
      ['status', 'active'],
    ])
  })

  it('스테이징 배치가 실패하면 기존 게시본 교체를 호출하지 않는다', async () => {
    const stage = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('second batch failed'))
    const replace = vi.fn().mockResolvedValue(undefined)
    const cleanup = vi.fn().mockRejectedValue(new Error('cleanup must not mask stage failure'))

    await expect((stageThenReplacePublicationRows as unknown as (
      rows: number[], size: number, stage: (batch: number[]) => Promise<void>, replace: () => Promise<void>, cleanup: () => Promise<void>,
    ) => Promise<void>)([1, 2, 3], 2, stage, replace, cleanup))
      .rejects.toThrow('second batch failed')

    expect(stage).toHaveBeenCalledTimes(2)
    expect(replace).not.toHaveBeenCalled()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('교체 RPC가 실패하면 원래 오류를 유지하면서 해당 시도의 스테이징을 정리한다', async () => {
    const stage = vi.fn().mockResolvedValue(undefined)
    const replace = vi.fn().mockRejectedValue(new Error('replacement RPC failed'))
    const cleanup = vi.fn().mockResolvedValue(undefined)

    await expect((stageThenReplacePublicationRows as unknown as (
      rows: number[], size: number, stage: (batch: number[]) => Promise<void>, replace: () => Promise<void>, cleanup: () => Promise<void>,
    ) => Promise<void>)([1, 2, 3], 2, stage, replace, cleanup))
      .rejects.toThrow('replacement RPC failed')

    expect(stage).toHaveBeenCalledTimes(2)
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('모든 스테이징 배치가 끝난 뒤 한 번만 교체하고 배치 크기를 지킨다', async () => {
    const staged: number[][] = []
    const replace = vi.fn().mockResolvedValue(undefined)

    await stageThenReplacePublicationRows([1, 2, 3, 4, 5], 2, async (batch) => { staged.push(batch) }, replace)

    expect(staged).toEqual([[1, 2], [3, 4], [5]])
    expect(replace).toHaveBeenCalledTimes(1)
  })

  it('반복 게시 시도는 각자 성공적으로 교체하고 실패하지 않은 시도의 스테이징을 지우지 않는다', async () => {
    const stagedAttempts: string[][] = []
    const replacedAttempts: string[] = []
    const cleanup = vi.fn().mockResolvedValue(undefined)
    const attempt = async (rows: string[]) => {
      await (stageThenReplacePublicationRows as unknown as (
        rows: string[], size: number, stage: (batch: string[]) => Promise<void>, replace: () => Promise<void>, cleanup: () => Promise<void>,
      ) => Promise<void>)(rows, 2, async (batch) => { stagedAttempts.push(batch) }, async () => {
        replacedAttempts.push(rows[0])
      }, cleanup)
    }

    await attempt(['attempt-a:1', 'attempt-a:2'])
    await attempt(['attempt-b:1', 'attempt-b:2'])

    expect(stagedAttempts).toEqual([['attempt-a:1', 'attempt-a:2'], ['attempt-b:1', 'attempt-b:2']])
    expect(replacedAttempts).toEqual(['attempt-a:1', 'attempt-b:1'])
    expect(cleanup).not.toHaveBeenCalled()
  })
})
