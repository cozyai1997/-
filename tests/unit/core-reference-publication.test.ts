import { describe, expect, it } from 'vitest'

import {
  buildCoreReferenceSql,
  prepareCoreReferenceData,
} from '../../scripts/data/publish-core-reference-data'
import {
  validateReferenceData,
  type ExpectedRowCounts,
  type ReferenceDataset,
} from '../../src/features/localization/reference-data-validation'
import { publishValidatedCandidate } from '../../scripts/data/publish-reference-data'

const fixtureCounts: ExpectedRowCounts = {
  types: 1,
  species: 1,
  forms: 2,
  abilities: 1,
  moves: 0,
  learnsets: 0,
  items: 2,
  evolutions: 1,
  formAbilities: 0,
  natures: 1,
  typeMatchups: 1,
}

const dataset: ReferenceDataset = {
  version: 'fixture-v1',
  sourceCommits: { source: 'a'.repeat(40) },
  sha256: { source: 'b'.repeat(64) },
  battleOnlyDiagnostics: [],
  reportedCounts: {
    types: 1,
    species: 1,
    forms: 2,
    abilities: 1,
    moves: 0,
    learnsets: 0,
    items: 2,
    evolutions: 1,
    formAbilities: 0,
    natures: 1,
    typeMatchups: 1,
    teraTypes: 2,
    formTeraOptions: 2,
    formGigantamaxOptions: 1,
  },
  types: [{ id: 'normal', nameKo: '노말' }],
  species: [{
    id: 'eevee',
    nationalDexNumber: 133,
    nameKo: '이브이',
    descriptionKo: '여러 모습으로 진화하는 포켓몬.',
  }],
  forms: [
    { id: 'eevee-normal', speciesId: 'eevee', baseFormId: null, nameKo: '일반', primaryTypeId: 'normal', secondaryTypeId: null, baseStats: { hp: 55, attack: 55, defense: 50, special_attack: 45, special_defense: 65, speed: 55 }, isBattleOnly: false, aspects: [] },
    { id: 'eevee-gmax', speciesId: 'eevee', baseFormId: 'eevee-normal', nameKo: 'Gmax', primaryTypeId: 'normal', secondaryTypeId: null, baseStats: { hp: 55, attack: 55, defense: 50, special_attack: 45, special_defense: 65, speed: 55 }, isBattleOnly: true, aspects: ['gmax'] },
  ],
  abilities: [{ id: 'adaptability', nameKo: '적응력', descriptionKo: '같은 타입 기술이 강해진다.' }],
  moves: [],
  learnsets: [],
  items: [
    { id: 'water_stone', nameKo: '물의돌', descriptionKo: '특정 포켓몬을 진화시키는 돌.' },
    { id: 'unknown_item', nameKo: 'Unknown Item', descriptionKo: 'Unknown effect' },
  ],
  evolutions: [{
    id: 'eevee>vaporeon:0',
    fromSpeciesId: 'eevee',
    toSpeciesId: 'eevee',
    conditionKo: '물의돌 사용',
  }],
  formAbilities: [],
  natures: [{ id: 'hardy', nameKo: '노력', increasedStat: null, decreasedStat: null }],
  teraTypes: [
    { id: 'normal', nameKo: '노말', referenceTypeId: 'normal', sortOrder: 0 },
    { id: 'stellar', nameKo: '스텔라', referenceTypeId: null, sortOrder: 19 },
  ],
  formTeraOptions: [
    { formId: 'eevee-normal', teraTypeId: 'normal' },
    { formId: 'eevee-normal', teraTypeId: 'stellar' },
  ],
  formGigantamaxOptions: [{ sourceFormId: 'eevee-normal', gigantamaxFormId: 'eevee-gmax' }],
  typeMatchups: [{ attackingTypeId: 'normal', defendingTypeId: 'normal', multiplier: 1 }],
}

describe('운영용 핵심 포켓몬 기준데이터 게시', () => {
  it('화면에 필요한 행만 한국어 상태로 준비한다', () => {
    const prepared = prepareCoreReferenceData(dataset)

    expect(prepared.species).toHaveLength(1)
    expect(prepared.forms).toEqual([
      expect.objectContaining({ identifier: 'eevee-normal', nameKo: '일반', isDefault: true }),
      expect.objectContaining({ identifier: 'eevee-gmax', nameKo: '거다이맥스', isDefault: false }),
    ])
    expect(prepared.items).toEqual([
      expect.objectContaining({ identifier: 'water_stone', nameKo: '물의돌' }),
    ])
  })

  it('실패 시 일부 행이 노출되지 않도록 하나의 트랜잭션 SQL을 만든다', () => {
    const sql = buildCoreReferenceSql(dataset)

    expect(sql).toMatch(/^do \$publication\$/u)
    expect(sql).toContain('declare target_publication_id uuid;')
    expect(sql).toContain("'fixture-v1'")
    expect(sql).toContain('jsonb_to_recordset')
    expect(sql).toContain('as row(identifier text, "nameKo" text, "colorHex" text')
    expect(sql).toContain("status = 'active'")
    expect(sql.trimEnd()).toMatch(/\$publication\$;$/u)
  })

  it('battleDataIssues만 있는 후보는 기존 핵심 게시본을 교체하지 않는다', () => {
    const candidate = structuredClone(dataset)
    candidate.forms[0].baseStats.speed = 0
    candidate.forms[1].nameKo = '거다이맥스'
    candidate.items[1] = { id: 'unknown_item', nameKo: '알수없는아이템', descriptionKo: '검증용 설명' }
    const report = validateReferenceData(candidate, {
      expectedRowCounts: fixtureCounts,
      expectedBattleRowCounts: { teraTypes: 2, formTeraOptions: 2, formGigantamaxOptions: 1 },
      expectedBattleDatasetProfile: { playableForms: 1, battleOnlyForms: 1, battleOnlyDiagnostics: 0 },
    })
    const current = {
      activePublicationId: 'current-publication',
      publications: [{
        id: 'current-publication', version: 'old-version', rowCounts: fixtureCounts,
        sourceCommits: {}, sha256: {},
      }],
    }

    expect(report.missingKoreanFields).toEqual([])
    expect(report.brokenReferences).toEqual([])
    expect(report.countMismatches).toEqual([])
    expect(report.manifestIssues).toEqual([])
    expect(report.battleDataIssues).toEqual(['forms:eevee-normal:baseStats'])
    expect(publishValidatedCandidate(current, candidate, report)).toBe(current)
  })
})
