import completeFixture from '../fixtures/reference-data/complete/dataset.json'
import englishDescriptionFixture from '../fixtures/reference-data/english-description/dataset.json'
import { describe, expect, it } from 'vitest'
import {
  chooseActivePublicationId,
  validateReferenceData,
  type ExpectedRowCounts,
  type ReferenceDataset,
} from '@/features/localization/reference-data-validation'
import { publishValidatedCandidate } from '../../scripts/data/publish-reference-data'

const fixtureCounts: ExpectedRowCounts = {
  types: 1,
  species: 1,
  forms: 1,
  abilities: 1,
  moves: 1,
  learnsets: 1,
  items: 1,
  evolutions: 0,
  formAbilities: 1,
  natures: 1,
  typeMatchups: 1,
}

describe('한국어 기준 데이터 공개 검증', () => {
  it('필수 한국어 필드가 완성된 데이터만 승인한다', () => {
    const report = validateReferenceData(completeFixture as ReferenceDataset, {
      expectedRowCounts: fixtureCounts,
    })

    expect(report.valid).toBe(true)
    expect(report.missingKoreanFields).toEqual([])
    expect(report.brokenReferences).toEqual([])
    expect(report.countMismatches).toEqual([])
  })

  it('영어 설명과 비어 있는 한국어 필드를 거부한다', () => {
    const dataset = structuredClone(englishDescriptionFixture) as ReferenceDataset
    dataset.moves[0].nameKo = '   '

    const report = validateReferenceData(dataset, { expectedRowCounts: fixtureCounts })

    expect(report.valid).toBe(false)
    expect(report.missingKoreanFields).toEqual([
      { table: 'abilities', key: 'adaptability', field: 'descriptionKo' },
      { table: 'moves', key: 'tackle', field: 'nameKo' },
    ])
  })

  it('참조가 끊기거나 보고 수량과 실제 수량이 다르면 거부한다', () => {
    const dataset = structuredClone(completeFixture) as ReferenceDataset
    dataset.forms[0].speciesId = 'missing-species'
    dataset.reportedCounts.moves = 952

    const report = validateReferenceData(dataset, { expectedRowCounts: fixtureCounts })

    expect(report.valid).toBe(false)
    expect(report.brokenReferences).toContainEqual({
      table: 'forms',
      key: 'eevee-normal',
      target: 'species:missing-species',
    })
    expect(report.countMismatches).toContainEqual({
      table: 'moves',
      expected: 1,
      actual: 1,
      reported: 952,
    })
  })

  it('검증 실패 시 기존 활성 게시 버전을 유지한다', () => {
    const dataset = englishDescriptionFixture as ReferenceDataset
    const invalidReport = validateReferenceData(englishDescriptionFixture as ReferenceDataset, {
      expectedRowCounts: fixtureCounts,
    })
    const current = { activePublicationId: 'current-publication', publications: [] }

    expect(chooseActivePublicationId('current-publication', 'candidate-publication', invalidReport)).toBe(
      'current-publication',
    )
    expect(publishValidatedCandidate(current, dataset, invalidReport)).toBe(current)
  })

  it('검증을 통과한 후보만 새 활성 게시 상태로 원자적으로 교체한다', () => {
    const dataset = completeFixture as ReferenceDataset
    const report = validateReferenceData(dataset, { expectedRowCounts: fixtureCounts })
    const current = {
      activePublicationId: 'current-publication',
      publications: [
        {
          id: 'current-publication',
          version: 'old-version',
          rowCounts: fixtureCounts,
          sourceCommits: {},
          sha256: {},
        },
      ],
    }

    const next = publishValidatedCandidate(current, dataset, report)

    expect(next).not.toBe(current)
    expect(next.activePublicationId).toMatch(/^[0-9a-f]{64}$/u)
    expect(next.publications).toHaveLength(2)
    expect(next.publications.at(-1)?.version).toBe('fixture-complete-v1')
  })
})
