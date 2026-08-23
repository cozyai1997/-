import { describe, expect, it, vi } from 'vitest'

import {
  assertKoreanOptionDisplayValues,
  assertOptionFilterPublicationCounts,
  publishPokemonOptionFilterReferenceData,
  stageThenReplacePublicationRows,
} from '../../scripts/data/publish-pokemon-option-filter-reference-data'
import type { ReferenceDataset } from '@/features/localization/reference-data-validation'

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
    ['formAbilities', 3054, 3055, 'formAbilities:actual=3054:reported=3055:expected=3055'],
    ['learnsets', 116519, 116518, 'learnsets:actual=116519:reported=116518:expected=116519'],
  ] as const)('%s의 실제 또는 보고 행 수 불일치를 거부한다', (key, actual, reported, expected) => {
    const candidate = {
      moves: Array.from({ length: 826 }),
      formAbilities: Array.from({ length: key === 'formAbilities' ? actual : 3055 }),
      learnsets: Array.from({ length: key === 'learnsets' ? actual : 116519 }),
      reportedCounts: {
        moves: 826,
        formAbilities: key === 'formAbilities' ? reported : 3055,
        learnsets: key === 'learnsets' ? reported : 116519,
      },
    } as unknown as Pick<ReferenceDataset, 'moves' | 'formAbilities' | 'learnsets' | 'reportedCounts'>

    expect(() => assertOptionFilterPublicationCounts(candidate)).toThrow(expected)
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
