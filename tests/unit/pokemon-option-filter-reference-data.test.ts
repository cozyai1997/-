import { describe, expect, it } from 'vitest'

import { importReferenceData } from '../../scripts/data/import-reference-data'

const sourceRoot = 'C:/Users/PARKSUNGSIK/OneDrive/문서/Desktop/Cobbleverse_Pokemon_Manager_Package_v1.3_TABLE_FIX'

describe('포켓몬 선택 필터 기준 데이터', () => {
  it('원본 폼, 기술, 습득과 특성 관계의 필터 필드를 그대로 보존한다', () => {
    const dataset = importReferenceData(sourceRoot)

    expect(dataset.reportedCounts).toMatchObject({
      moves: 826,
      learnsets: 116519,
      formAbilities: 3055,
    })
    expect(dataset.forms.find((row) => row.id === 'venusaur-gmax')).toMatchObject({
      baseFormId: 'venusaur-normal',
    })
    expect(dataset.moves.find((row) => row.id === 'visegrip')).toMatchObject({
      damageClass: 'physical',
      power: 55,
      accuracy: 100,
      pp: null,
    })
    expect(dataset.learnsets.find((row) => row.speciesId === 'bulbasaur' && row.moveId === 'growl')).toMatchObject({
      formId: null,
      learnMethod: 'level',
      learnLevel: 1,
    })
    expect(new Set(dataset.learnsets.map((row) => row.learnMethod))).toEqual(new Set([
      'level', 'tm', 'tutor', 'egg', 'legacy', 'special', 'form_change',
    ]))
    expect(dataset.formAbilities.filter((row) => row.formId === 'beedrill-mega')).toEqual([
      expect.objectContaining({ abilityId: 'adaptability', slot: 'first', isHidden: false }),
      expect.objectContaining({ abilityId: 'adaptability', slot: 'hidden', isHidden: true }),
    ])
  })
})
