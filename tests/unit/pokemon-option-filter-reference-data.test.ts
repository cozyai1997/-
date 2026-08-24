import { describe, expect, it } from 'vitest'

import {
  normalizeFormAbilityRow,
  normalizeFormRow,
  normalizeLearnsetRow,
  normalizeMoveRow,
} from '../../scripts/data/import-reference-data'
import {
  productionExpectedBattleDatasetProfile,
  productionExpectedBattleRowCounts,
} from '../../src/features/localization/reference-data-validation'

describe('포켓몬 선택 필터 기준 데이터', () => {
  it('원천 battle-only 기준에 맞는 운영 전투 행 수를 고정한다', () => {
    expect(productionExpectedBattleRowCounts).toEqual({
      teraTypes: 19,
      formTeraOptions: 25_184,
      formGigantamaxOptions: 42,
    })
    expect(productionExpectedBattleDatasetProfile).toEqual({
      playableForms: 1_334,
      battleOnlyForms: 164,
      battleOnlyDiagnostics: 9,
    })
  })

  it('원본 폼, 기술, 습득과 특성 관계의 필터 필드를 그대로 보존한다', () => {
    expect(normalizeFormRow({
      FormID: 'venusaur-gmax', SpeciesID: 'venusaur', BaseFormID: 'venusaur-normal',
      FormKO: 'Gmax', Type1: 'grass', Type2: 'poison',
    })).toMatchObject({
      id: 'venusaur-gmax',
      baseFormId: 'venusaur-normal',
    })
    expect(normalizeMoveRow({
      MoveID: 'visegrip', NameKO: '찝기', Type: 'normal', Category: 'physical',
      Power: '55', Accuracy: '100', PP: '',
    }, { nameKo: '찝기', descriptionKo: '상대를 양쪽에서 집어서 데미지를 준다.' })).toMatchObject({
      id: 'visegrip',
      damageClass: 'physical',
      power: 55,
      accuracy: 100,
      pp: null,
    })
    expect(normalizeLearnsetRow({
      SpeciesID: 'bulbasaur', FormID: '', MoveID: 'growl', SourceType: 'level', SourceValue: '1', MinLevel: '1',
    })).toMatchObject({
      speciesId: 'bulbasaur',
      formId: null,
      learnMethod: 'level',
      learnLevel: 1,
    })
    expect(normalizeLearnsetRow({
      SpeciesID: 'vaporeon', FormID: '', MoveID: 'bubble', SourceType: 'level', SourceValue: '0', MinLevel: '0',
    })).toMatchObject({ learnMethod: 'level', learnLevel: 0 })
    expect(normalizeFormAbilityRow({
      FormID: 'beedrill-mega', SpeciesID: 'beedrill', AbilityID: 'adaptability', Slot: 'hidden', Hidden: 'True',
    })).toEqual({
      formId: 'beedrill-mega', speciesId: 'beedrill', abilityId: 'adaptability', slot: 'hidden', isHidden: true,
    })
  })
})
