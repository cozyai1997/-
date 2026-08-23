import { describe, expect, it, vi } from 'vitest'

import {
  assertKoreanOptionDisplayValues,
  assertOptionFilterPublicationCounts,
  publishPokemonOptionFilterReferenceData,
  stageThenReplacePublicationRows,
} from '../../scripts/data/publish-pokemon-option-filter-reference-data'
import type { ReferenceDataset } from '@/features/localization/reference-data-validation'

function countCorrectCandidate(): ReferenceDataset {
  const forms = Array.from({ length: 1_498 }, (_, index) => ({
    id: `form-${index}`,
    speciesId: 'species-a',
    baseFormId: index === 0 ? null : 'form-0',
    nameKo: `모습가-${index}`,
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
    sourceCommits: {},
    sha256: {},
    reportedCounts: {
      types: 1,
      species: 1,
      forms: 1_498,
      abilities: 1,
      moves: 826,
      learnsets: 116_519,
      items: 0,
      evolutions: 0,
      formAbilities: 3_055,
      natures: 0,
      typeMatchups: 0,
    },
    types: [{ id: 'normal', nameKo: '노말' }],
    species: [{
      id: 'species-a',
      nationalDexNumber: 1,
      nameKo: '이상해씨',
      descriptionKo: '검증용 포켓몬이다.',
    }],
    forms,
    abilities: [{
      id: 'ability-a',
      nameKo: '심록',
      descriptionKo: '위기일 때 풀 타입 기술이 강해진다.',
    }],
    moves,
    learnsets: Array.from({ length: 116_519 }, (_, index) => ({
      speciesId: 'species-a',
      formId: null,
      moveId: `move-${index % 826}`,
      learnMethod: 'level' as const,
      learnLevel: 1,
      conditionKo: '레벨 1에 습득',
    })),
    items: [],
    evolutions: [],
    formAbilities: Array.from({ length: 3_055 }, (_, index) => ({
      formId: `form-${index % 1_498}`,
      speciesId: 'species-a',
      abilityId: 'ability-a',
      slot: 'first',
      isHidden: false,
    })),
    natures: [],
    typeMatchups: [],
  }
}

const validCandidate = countCorrectCandidate()

describe('포켓몬 선택 필터 게시', () => {
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
      },
    } as unknown as Pick<ReferenceDataset, 'moves' | 'forms' | 'formAbilities' | 'learnsets' | 'reportedCounts'>

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
