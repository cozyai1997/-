import completeFixture from '../fixtures/reference-data/complete/dataset.json'
import englishDescriptionFixture from '../fixtures/reference-data/english-description/dataset.json'
import { describe, expect, it } from 'vitest'
import {
  chooseActivePublicationId,
  productionExpectedBattleDatasetProfile,
  productionExpectedBattleRowCounts,
  validateReferenceData,
  type BattleReportedCounts,
  type BattleDatasetProfile,
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

const fixtureBattleCounts: BattleReportedCounts = {
  teraTypes: 2,
  formTeraOptions: 2,
  formGigantamaxOptions: 0,
}

const fixtureBattleProfile: BattleDatasetProfile = {
  playableForms: 1,
  battleOnlyForms: 0,
  battleOnlyDiagnostics: 0,
}

const reviewedSourceCommits = {
  cobblemon: 'd1b8094539f2dd23bd98c1a48293fac1f2010c16',
  koreanLocalizationContent: '9e231c83211f17e9fbb9994ef777750f04e883aa',
}
const reviewedSourceHashes = {
  evolutions: 'aececbd2841ccf662732c42c5eef4c2b5c3ec3e4041fa80fab1872d21b8f108f',
  sourceManifest: 'd9f8a25fcfed05e8a5392c474c3d0b3c834ed6f1c8a1a417eded5d72071e0531',
}

function missingMegaFixture(): ReferenceDataset {
  const dataset = structuredClone(completeFixture) as ReferenceDataset
  dataset.sourceCommits = reviewedSourceCommits
  dataset.sha256 = reviewedSourceHashes
  dataset.species[0] = {
    ...dataset.species[0], id: 'milotic', nationalDexNumber: 350,
    nameKo: '밀로틱', descriptionKo: '사랑 포켓몬이다.',
  }
  dataset.forms[0] = {
    ...dataset.forms[0], id: 'milotic-normal', speciesId: 'milotic', nameKo: '기본 모습',
  }
  dataset.learnsets[0] = {
    ...dataset.learnsets[0], speciesId: 'milotic', formId: 'milotic-normal',
  }
  dataset.formAbilities[0] = {
    ...dataset.formAbilities[0], speciesId: 'milotic', formId: 'milotic-normal',
  }
  dataset.formTeraOptions = dataset.formTeraOptions.map((row) => ({
    ...row, formId: 'milotic-normal',
  }))
  dataset.evolutions = [{
    id: 'milotic>megamilotic:233',
    fromSpeciesId: 'milotic',
    toSpeciesId: 'milotic',
    conditionKo: '키스톤 사용; 원본에 대상 메가 폼이 없음',
  }]
  dataset.sourceDiagnostics = [{
    code: 'missing-evolution-target-form',
    table: 'evolutions',
    key: 'milotic>megamilotic:233',
    target: 'forms:milotic-mega',
  }]
  dataset.reportedCounts.evolutions = 1
  return dataset
}

function validateMissingMegaFixture(dataset: ReferenceDataset) {
  return validateReferenceData(dataset, {
    expectedRowCounts: { ...fixtureCounts, evolutions: 1, forms: dataset.forms.length },
    expectedBattleRowCounts: fixtureBattleCounts,
    expectedBattleDatasetProfile: {
      ...fixtureBattleProfile,
      battleOnlyForms: dataset.forms.filter((form) => form.isBattleOnly).length,
    },
  })
}

describe('한국어 기준 데이터 공개 검증', () => {
  it('필수 한국어 필드가 완성된 데이터만 승인한다', () => {
    const report = validateReferenceData(completeFixture as ReferenceDataset, {
      expectedRowCounts: fixtureCounts,
      expectedBattleRowCounts: fixtureBattleCounts,
      expectedBattleDatasetProfile: fixtureBattleProfile,
    })

    expect(report.valid).toBe(true)
    expect(report.missingKoreanFields).toEqual([])
    expect(report.brokenReferences).toEqual([])
    expect(report.countMismatches).toEqual([])
    expect(report.battleDataIssues).toEqual([])
  })

  it('영어 설명과 비어 있는 한국어 필드를 거부한다', () => {
    const dataset = structuredClone(englishDescriptionFixture) as ReferenceDataset
    dataset.moves[0].nameKo = '   '

    const report = validateReferenceData(dataset, {
      expectedRowCounts: fixtureCounts,
      expectedBattleRowCounts: fixtureBattleCounts,
      expectedBattleDatasetProfile: fixtureBattleProfile,
    })

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

    const report = validateReferenceData(dataset, {
      expectedRowCounts: fixtureCounts,
      expectedBattleRowCounts: fixtureBattleCounts,
      expectedBattleDatasetProfile: fixtureBattleProfile,
    })

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

  it('식별자 배열과 관계 배열의 중복 키를 독립적으로 거부한다', () => {
    const dataset = structuredClone(completeFixture) as ReferenceDataset
    dataset.types.push({ ...dataset.types[0] })
    dataset.learnsets.push({ ...dataset.learnsets[0] })
    dataset.formTeraOptions.push({ ...dataset.formTeraOptions[0] })
    dataset.reportedCounts.types = 2
    dataset.reportedCounts.learnsets = 2
    dataset.reportedCounts.formTeraOptions = 3

    const report = validateReferenceData(dataset, {
      expectedRowCounts: { ...fixtureCounts, types: 2, learnsets: 2 },
      expectedBattleRowCounts: { ...fixtureBattleCounts, formTeraOptions: 3 },
      expectedBattleDatasetProfile: fixtureBattleProfile,
    })

    expect(report.valid).toBe(false)
    expect(report.duplicateKeys).toEqual(expect.arrayContaining([
      { table: 'types', key: 'normal' },
      { table: 'learnsets', key: 'eevee:eevee-normal:tackle:level:1:기본 습득' },
      { table: 'formTeraOptions', key: 'eevee-normal:normal' },
    ]))
  })

  it('서로 다른 행 ID로 포장된 동일 진화 관계도 거부한다', () => {
    const dataset = structuredClone(completeFixture) as ReferenceDataset
    dataset.evolutions = [
      { id: 'evolution-a', fromSpeciesId: 'eevee', toSpeciesId: 'eevee', conditionKo: '특수 조건' },
      { id: 'evolution-b', fromSpeciesId: 'eevee', toSpeciesId: 'eevee', conditionKo: '특수 조건' },
    ]
    dataset.reportedCounts.evolutions = 2

    const report = validateReferenceData(dataset, {
      expectedRowCounts: { ...fixtureCounts, evolutions: 2 },
      expectedBattleRowCounts: fixtureBattleCounts,
      expectedBattleDatasetProfile: fixtureBattleProfile,
    })

    expect(report.valid).toBe(false)
    expect(report.duplicateKeys).toContainEqual({
      table: 'evolutions',
      key: 'eevee::eevee::특수 조건',
    })
  })

  it('원본에 실제 mega 대상 폼이 없는 행과 정확히 대응하는 진단만 승인한다', () => {
    const report = validateMissingMegaFixture(missingMegaFixture())

    expect(report.valid).toBe(true)
    expect(report.sourceDiagnosticIssues).toEqual([])
  })

  it.each([
    [
      'orphan',
      (dataset: ReferenceDataset) => { dataset.sourceDiagnostics![0].key = 'milotic>megamilotic:999' },
      'sourceDiagnostics:milotic>megamilotic:999:evolution-row-count=0',
    ],
    [
      'fabricated target',
      (dataset: ReferenceDataset) => { dataset.sourceDiagnostics![0].target = 'forms:milotic-gmax' },
      'sourceDiagnostics:milotic>megamilotic:233:target=forms:milotic-gmax:expected=forms:milotic-mega',
    ],
    [
      'duplicate',
      (dataset: ReferenceDataset) => { dataset.sourceDiagnostics!.push({ ...dataset.sourceDiagnostics![0] }) },
      'sourceDiagnostics:milotic>megamilotic:233:duplicate',
    ],
    [
      'source mismatch',
      (dataset: ReferenceDataset) => {
        dataset.evolutions[0].id = 'pikachu>megapikachu:0'
        dataset.sourceDiagnostics![0] = {
          ...dataset.sourceDiagnostics![0],
          key: 'pikachu>megapikachu:0',
          target: 'forms:pikachu-mega',
        }
      },
      'sourceDiagnostics:pikachu>megapikachu:0:source-species=milotic:raw=pikachu',
    ],
    [
      'metadata',
      (dataset: ReferenceDataset) => {
        const diagnostic = dataset.sourceDiagnostics![0] as unknown as { code: string; table: string }
        diagnostic.code = 'fabricated-code'
        diagnostic.table = 'forms'
      },
      'sourceDiagnostics:milotic>megamilotic:233:metadata',
    ],
  ] as const)('%s source diagnostic 변조를 거부한다', (_label, tamper, issue) => {
    const dataset = missingMegaFixture()
    tamper(dataset)

    const report = validateMissingMegaFixture(dataset)

    expect(report.valid).toBe(false)
    expect(report.sourceDiagnosticIssues).toContain(issue)
  })

  it('진단이 가리키는 대상 폼이 실제로 있으면 source gap으로 인정하지 않는다', () => {
    const dataset = missingMegaFixture()
    dataset.forms.push({
      ...dataset.forms[0],
      id: 'milotic-mega',
      baseFormId: 'milotic-normal',
      nameKo: '메가밀로틱',
      isBattleOnly: true,
    })
    dataset.reportedCounts.forms = 2

    const report = validateMissingMegaFixture(dataset)

    expect(report.valid).toBe(false)
    expect(report.sourceDiagnosticIssues).toContain(
      'sourceDiagnostics:milotic>megamilotic:233:target-present=forms:milotic-mega',
    )
  })

  it('내부 구조가 맞아도 검토 허용 목록에 없는 누락 메가 진단은 거부한다', () => {
    const dataset = missingMegaFixture()
    dataset.evolutions[0] = {
      id: 'eevee>megaeevee:0', fromSpeciesId: 'eevee', toSpeciesId: 'eevee',
      conditionKo: '키스톤 사용',
    }
    dataset.sourceDiagnostics![0] = {
      code: 'missing-evolution-target-form', table: 'evolutions',
      key: 'eevee>megaeevee:0', target: 'forms:eevee-mega',
    }

    const report = validateMissingMegaFixture(dataset)

    expect(report.valid).toBe(false)
    expect(report.sourceDiagnosticIssues).toContain('sourceDiagnostics:eevee>megaeevee:0:unreviewed')
  })

  it.each([
    ['Cobblemon commit', (dataset: ReferenceDataset) => { dataset.sourceCommits.cobblemon = '0'.repeat(40) }, 'sourceCommit:cobblemon'],
    ['Korean localization commit', (dataset: ReferenceDataset) => { dataset.sourceCommits.koreanLocalizationContent = '0'.repeat(40) }, 'sourceCommit:koreanLocalizationContent'],
    ['raw evolution hash', (dataset: ReferenceDataset) => { dataset.sha256.evolutions = '0'.repeat(64) }, 'sha256:evolutions'],
    ['source manifest hash', (dataset: ReferenceDataset) => { dataset.sha256.sourceManifest = '0'.repeat(64) }, 'sha256:sourceManifest'],
  ] as const)('%s가 바뀐 누락 진단은 검토 앵커 불일치로 거부한다', (_label, tamper, anchor) => {
    const dataset = missingMegaFixture()
    tamper(dataset)

    const report = validateMissingMegaFixture(dataset)

    expect(report.valid).toBe(false)
    expect(report.sourceDiagnosticIssues).toContain(
      `sourceDiagnostics:milotic>megamilotic:233:source-anchor:${anchor}`,
    )
  })

  it('검토된 원본 행의 조건 서명이 바뀌면 누락 진단을 거부한다', () => {
    const dataset = missingMegaFixture()
    dataset.evolutions[0].conditionKo = '키스톤 사용'

    const report = validateMissingMegaFixture(dataset)

    expect(report.valid).toBe(false)
    expect(report.sourceDiagnosticIssues).toContain(
      'sourceDiagnostics:milotic>megamilotic:233:row-signature',
    )
  })

  it('진화 대상 폼이 대상 종에 속하지 않으면 거부한다', () => {
    const dataset = structuredClone(completeFixture) as ReferenceDataset
    dataset.species.push({
      id: 'vaporeon', nationalDexNumber: 134, nameKo: '샤미드', descriptionKo: '물 포켓몬이다.',
    })
    dataset.forms.push({
      ...dataset.forms[0], id: 'vaporeon-normal', speciesId: 'vaporeon',
      baseFormId: null, nameKo: '기본 모습', isBattleOnly: true,
    })
    dataset.evolutions = [{
      id: 'eevee>vaporeon:0', fromSpeciesId: 'eevee', toSpeciesId: 'vaporeon',
      toFormId: 'eevee-normal', conditionKo: '물의돌 사용',
    }]
    Object.assign(dataset.reportedCounts, { species: 2, forms: 2, evolutions: 1 })

    const report = validateReferenceData(dataset, {
      expectedRowCounts: { ...fixtureCounts, species: 2, forms: 2, evolutions: 1 },
      expectedBattleRowCounts: fixtureBattleCounts,
      expectedBattleDatasetProfile: { ...fixtureBattleProfile, battleOnlyForms: 1 },
    })

    expect(report.valid).toBe(false)
    expect(report.brokenReferences).toContainEqual({
      table: 'evolutions', key: 'eevee>vaporeon:0', target: 'formSpecies:eevee',
    })
  })

  it('암시적 대상 기본 폼이 실제로 없으면 거부한다', () => {
    const dataset = structuredClone(completeFixture) as ReferenceDataset
    dataset.species.push({
      id: 'vaporeon', nationalDexNumber: 134, nameKo: '샤미드', descriptionKo: '물 포켓몬이다.',
    })
    dataset.evolutions = [{
      id: 'eevee>vaporeon:1', fromSpeciesId: 'eevee', toSpeciesId: 'vaporeon',
      conditionKo: '물의돌 사용',
    }]
    Object.assign(dataset.reportedCounts, { species: 2, evolutions: 1 })

    const report = validateReferenceData(dataset, {
      expectedRowCounts: { ...fixtureCounts, species: 2, evolutions: 1 },
      expectedBattleRowCounts: fixtureBattleCounts,
      expectedBattleDatasetProfile: fixtureBattleProfile,
    })

    expect(report.valid).toBe(false)
    expect(report.brokenReferences).toContainEqual({
      table: 'evolutions', key: 'eevee>vaporeon:1', target: 'forms:vaporeon-normal',
    })
  })

  it('암시적 출발 기본 폼이 실제로 없으면 거부한다', () => {
    const dataset = structuredClone(completeFixture) as ReferenceDataset
    dataset.species.push({
      id: 'vaporeon', nationalDexNumber: 134, nameKo: '샤미드', descriptionKo: '물 포켓몬이다.',
    })
    dataset.evolutions = [{
      id: 'vaporeon>eevee:2', fromSpeciesId: 'vaporeon', toSpeciesId: 'eevee',
      conditionKo: '특수 조건',
    }]
    Object.assign(dataset.reportedCounts, { species: 2, evolutions: 1 })

    const report = validateReferenceData(dataset, {
      expectedRowCounts: { ...fixtureCounts, species: 2, evolutions: 1 },
      expectedBattleRowCounts: fixtureBattleCounts,
      expectedBattleDatasetProfile: fixtureBattleProfile,
    })

    expect(report.valid).toBe(false)
    expect(report.brokenReferences).toContainEqual({
      table: 'evolutions', key: 'vaporeon>eevee:2', target: 'forms:vaporeon-normal',
    })
  })

  it.each([
    ['implicit', undefined],
    ['explicit', 'eevee-normal'],
  ] as const)('같은 종 진화가 %s 기본/self 폼을 대상으로 하면 거부한다', (_label, toFormId) => {
    const dataset = structuredClone(completeFixture) as ReferenceDataset
    dataset.evolutions = [{
      id: 'eevee>eevee:0', fromSpeciesId: 'eevee', toSpeciesId: 'eevee',
      toFormId, conditionKo: '특수 조건',
    }]
    dataset.reportedCounts.evolutions = 1

    const report = validateReferenceData(dataset, {
      expectedRowCounts: { ...fixtureCounts, evolutions: 1 },
      expectedBattleRowCounts: fixtureBattleCounts,
      expectedBattleDatasetProfile: fixtureBattleProfile,
    })

    expect(report.valid).toBe(false)
    expect(report.brokenReferences).toContainEqual({
      table: 'evolutions', key: 'eevee>eevee:0', target: 'sameSpeciesDefaultForm:eevee-normal',
    })
  })

  it('한글이 섞여 있어도 printf·중괄호 보간 토큰이 남은 표시 필드를 거부한다', () => {
    const dataset = structuredClone(completeFixture) as ReferenceDataset
    dataset.items[0].nameKo = '%s포플레'
    dataset.items[0].descriptionKo = '{count}개 사용'

    const report = validateReferenceData(dataset, {
      expectedRowCounts: fixtureCounts,
      expectedBattleRowCounts: fixtureBattleCounts,
      expectedBattleDatasetProfile: fixtureBattleProfile,
    })

    expect(report.valid).toBe(false)
    expect(report.placeholderIssues).toEqual([
      { table: 'items', key: 'soothe-bell', field: 'nameKo', token: '%s' },
      { table: 'items', key: 'soothe-bell', field: 'descriptionKo', token: '{count}' },
    ])
  })

  it('검증 실패 시 기존 활성 게시 버전을 유지한다', () => {
    const dataset = englishDescriptionFixture as ReferenceDataset
    const invalidReport = validateReferenceData(englishDescriptionFixture as ReferenceDataset, {
      expectedRowCounts: fixtureCounts,
      expectedBattleRowCounts: fixtureBattleCounts,
      expectedBattleDatasetProfile: fixtureBattleProfile,
    })
    const current = { activePublicationId: 'current-publication', publications: [] }

    expect(chooseActivePublicationId('current-publication', 'candidate-publication', invalidReport)).toBe(
      'current-publication',
    )
    expect(publishValidatedCandidate(current, dataset, invalidReport)).toBe(current)
  })

  it('검증을 통과한 후보만 새 활성 게시 상태로 원자적으로 교체한다', () => {
    const dataset = completeFixture as ReferenceDataset
    const report = validateReferenceData(dataset, {
      expectedRowCounts: fixtureCounts,
      expectedBattleRowCounts: fixtureBattleCounts,
      expectedBattleDatasetProfile: fixtureBattleProfile,
    })
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

  it('전투 기준데이터의 운영 수량과 폼·테라·거다이맥스 의미 계약을 검사한다', () => {
    const dataset = structuredClone(completeFixture) as ReferenceDataset
    dataset.forms.push({
      id: 'eevee-gmax', speciesId: 'eevee', baseFormId: 'eevee-normal', nameKo: '거다이맥스',
      primaryTypeId: 'normal', secondaryTypeId: null,
      baseStats: { hp: 55, attack: 55, defense: 50, special_attack: 45, special_defense: 65, speed: 55 },
      isBattleOnly: true, aspects: ['gmax'],
    })
    dataset.reportedCounts.forms = 2
    dataset.formGigantamaxOptions = [{ sourceFormId: 'eevee-normal', gigantamaxFormId: 'eevee-gmax' }]
    dataset.reportedCounts.formGigantamaxOptions = 1
    dataset.forms[0].baseStats.speed = 0
    dataset.natures[0].increasedStat = 'hp' as never
    dataset.formTeraOptions.push({ formId: 'eevee-gmax', teraTypeId: 'normal' })
    dataset.reportedCounts.formTeraOptions = 3

    const report = validateReferenceData(dataset, {
      expectedRowCounts: { ...fixtureCounts, forms: 2 },
      expectedBattleRowCounts: { teraTypes: 2, formTeraOptions: 3, formGigantamaxOptions: 1 },
      expectedBattleDatasetProfile: { playableForms: 1, battleOnlyForms: 1, battleOnlyDiagnostics: 0 },
    })

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
    expect(report.valid).toBe(false)
    expect(report.battleDataIssues).toEqual(expect.arrayContaining([
      'forms:eevee-normal:baseStats',
      'natures:hardy:adjustment',
      'formTeraOptions:eevee-gmax:battle-only',
    ]))
  })

  it.each([
    ['cross-species Gigantamax source', (dataset: ReferenceDataset) => {
      dataset.forms[1].speciesId = 'other-species'
      dataset.species.push({ id: 'other-species', nationalDexNumber: 999, nameKo: '검증종', descriptionKo: '검증 설명' })
    }],
    ['non-battle-only Gigantamax target', (dataset: ReferenceDataset) => {
      dataset.forms[1].isBattleOnly = false
    }],
  ])('거다이맥스 %s 관계를 거부한다', (_label, modify) => {
    const dataset = structuredClone(completeFixture) as ReferenceDataset
    dataset.forms.push({
      id: 'eevee-gmax', speciesId: 'eevee', baseFormId: 'eevee-normal', nameKo: '거다이맥스',
      primaryTypeId: 'normal', secondaryTypeId: null,
      baseStats: { hp: 55, attack: 55, defense: 50, special_attack: 45, special_defense: 65, speed: 55 },
      isBattleOnly: true, aspects: ['gmax'],
    })
    dataset.reportedCounts.forms = 2
    dataset.formGigantamaxOptions = [{ sourceFormId: 'eevee-normal', gigantamaxFormId: 'eevee-gmax' }]
    dataset.reportedCounts.formGigantamaxOptions = 1
    modify(dataset)

    const report = validateReferenceData(dataset, {
      expectedRowCounts: { ...fixtureCounts, forms: 2, species: dataset.species.length },
      expectedBattleRowCounts: fixtureBattleCounts,
      expectedBattleDatasetProfile: {
        playableForms: dataset.forms.filter((form) => !form.isBattleOnly).length,
        battleOnlyForms: dataset.forms.filter((form) => form.isBattleOnly).length,
        battleOnlyDiagnostics: 0,
      },
    })

    expect(report.battleDataIssues).toContain('formGigantamaxOptions:eevee-normal:eevee-gmax')
  })
})
