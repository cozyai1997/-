import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

import {
  analyzeEvolutionPublication,
  prepareCoreReferenceData,
  writeFreshCoreReferenceSql,
} from '../../scripts/data/publish-core-reference-data'
import {
  type ReferenceDataset,
} from '../../src/features/localization/reference-data-validation'
import { createProductionReferenceCandidate } from '../fixtures/reference-data/production-candidate'

const reviewedSourceCommits = {
  cobblemon: 'd1b8094539f2dd23bd98c1a48293fac1f2010c16',
  koreanLocalizationContent: '9e231c83211f17e9fbb9994ef777750f04e883aa',
}
const reviewedSourceHashes = {
  evolutions: 'aececbd2841ccf662732c42c5eef4c2b5c3ec3e4041fa80fab1872d21b8f108f',
  sourceManifest: 'd9f8a25fcfed05e8a5392c474c3d0b3c834ed6f1c8a1a417eded5d72071e0531',
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
    toFormId: 'eevee-gmax',
    conditionKo: '물의돌 사용',
  }],
  formAbilities: [],
  natures: [{ id: 'hardy', nameKo: '노력', increasedStat: null, decreasedStat: null }],
  teraTypes: [
    { id: 'normal', nameKo: '노말', referenceTypeId: 'normal', sortOrder: 0 },
    { id: 'stellar', nameKo: '스텔라', referenceTypeId: null, sortOrder: 18 },
  ],
  formTeraOptions: [
    { formId: 'eevee-normal', teraTypeId: 'normal' },
    { formId: 'eevee-normal', teraTypeId: 'stellar' },
  ],
  formGigantamaxOptions: [{ sourceFormId: 'eevee-normal', gigantamaxFormId: 'eevee-gmax' }],
  typeMatchups: [{ attackingTypeId: 'normal', defendingTypeId: 'normal', multiplier: 1 }],
}

describe('운영용 핵심 포켓몬 기준데이터 게시', () => {
  it('fresh SQL writer는 성공 시 final만 남기고 tmp를 지운다', () => {
    const temporaryDirectory = mkdtempSync(resolve(tmpdir(), 'pokemon-core-writer-'))
    const outputPath = resolve(temporaryDirectory, 'publication.sql')
    try {
      writeFreshCoreReferenceSql(outputPath, '검증된 새 SQL')
      expect(readFileSync(outputPath, 'utf8')).toBe('검증된 새 SQL')
      expect(existsSync(`${outputPath}.tmp`)).toBe(false)
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true })
    }
  })

  it('fresh SQL writer는 기존 final을 덮어쓰지 않고 tmp 잔존도 만들지 않는다', () => {
    const temporaryDirectory = mkdtempSync(resolve(tmpdir(), 'pokemon-core-writer-'))
    const outputPath = resolve(temporaryDirectory, 'publication.sql')
    writeFileSync(outputPath, '기존 파일', 'utf8')

    try {
      expect(() => writeFreshCoreReferenceSql(outputPath, '새 SQL')).toThrow('already exists')
      expect(readFileSync(outputPath, 'utf8')).toBe('기존 파일')
      expect(existsSync(`${outputPath}.tmp`)).toBe(false)

      rmSync(outputPath)
      mkdirSync(outputPath)
      expect(() => writeFreshCoreReferenceSql(outputPath, '새 SQL')).toThrow('already exists')
      expect(existsSync(`${outputPath}.tmp`)).toBe(false)
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true })
    }
  })
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

  it('실제 메가 폼 대상은 게시하고 순수 자기 진화와 누락된 메가 대상은 구분해 제외한다', () => {
    const candidate = structuredClone(dataset)
    candidate.sourceCommits = reviewedSourceCommits
    candidate.sha256 = reviewedSourceHashes
    candidate.species.push(
      { id: 'gengar', nationalDexNumber: 94, nameKo: '팬텀', descriptionKo: '그림자 포켓몬.' },
      { id: 'milotic', nationalDexNumber: 350, nameKo: '밀로틱', descriptionKo: '사랑 포켓몬.' },
    )
    candidate.forms.push(
      { ...candidate.forms[0], id: 'gengar-normal', speciesId: 'gengar', nameKo: '기본 모습' },
      { ...candidate.forms[0], id: 'gengar-mega', speciesId: 'gengar', baseFormId: 'gengar-normal', nameKo: '메가팬텀', isBattleOnly: true },
      { ...candidate.forms[0], id: 'milotic-normal', speciesId: 'milotic', nameKo: '기본 모습' },
    )
    candidate.evolutions = [
      { id: 'gengar>megagengar:71', fromSpeciesId: 'gengar', toSpeciesId: 'gengar', toFormId: 'gengar-mega', conditionKo: '키스톤 사용' },
      {
        id: 'milotic>megamilotic:233', fromSpeciesId: 'milotic', toSpeciesId: 'milotic',
        conditionKo: '키스톤 사용; 원본에 대상 메가 폼이 없음',
      },
    ]
    const withDiagnostics = Object.assign(candidate, {
      sourceDiagnostics: [{
        code: 'missing-evolution-target-form' as const,
        table: 'evolutions' as const,
        key: 'milotic>megamilotic:233',
        target: 'forms:milotic-mega',
      }],
    })

    const analysis = analyzeEvolutionPublication(withDiagnostics)
    const prepared = prepareCoreReferenceData(withDiagnostics)

    expect(analysis).toMatchObject({
      sourceCount: 2,
      publishableCount: 1,
      excludedPureSameSpeciesCount: 0,
      excludedMissingTargetCount: 1,
      excludedInvalidCount: 0,
    })
    expect(analysis.missingTargetDiagnostics).toEqual(withDiagnostics.sourceDiagnostics)
    expect(prepared.evolutions).toEqual([{
      fromFormIdentifier: 'gengar-normal',
      toFormIdentifier: 'gengar-mega',
      conditionKo: '키스톤 사용',
      sortOrder: 0,
    }])
  })

  it.each([
    ['implicit', undefined],
    ['explicit default', 'eevee-normal'],
  ] as const)('같은 종의 %s base/self 폼 전이는 게시 경계에서 거부한다', (_label, toFormId) => {
    const candidate = structuredClone(dataset)
    candidate.evolutions = [{
      id: 'eevee>eevee:72', fromSpeciesId: 'eevee', toSpeciesId: 'eevee',
      toFormId, conditionKo: '특수 조건',
    }]

    expect(() => analyzeEvolutionPublication(candidate))
      .toThrow('evolutions:eevee>eevee:72:sameSpeciesDefaultForm:eevee-normal')
  })

  it('다른 종 소유 폼을 진화 대상으로 지정하면 게시 경계에서 거부한다', () => {
    const candidate = structuredClone(dataset)
    candidate.species.push({
      id: 'vaporeon', nationalDexNumber: 134, nameKo: '샤미드', descriptionKo: '물 포켓몬이다.',
    })
    candidate.evolutions = [{
      id: 'eevee>vaporeon:73', fromSpeciesId: 'eevee', toSpeciesId: 'vaporeon',
      toFormId: 'eevee-gmax', conditionKo: '물의돌 사용',
    }]

    expect(() => analyzeEvolutionPublication(candidate))
      .toThrow('evolutions:eevee>vaporeon:73:toFormSpecies:eevee')
  })

  it('암시적 대상 기본 폼이 없으면 게시 경계에서 거부한다', () => {
    const candidate = structuredClone(dataset)
    candidate.species.push({
      id: 'vaporeon', nationalDexNumber: 134, nameKo: '샤미드', descriptionKo: '물 포켓몬이다.',
    })
    candidate.evolutions = [{
      id: 'eevee>vaporeon:74', fromSpeciesId: 'eevee', toSpeciesId: 'vaporeon', conditionKo: '물의돌 사용',
    }]

    expect(() => analyzeEvolutionPublication(candidate))
      .toThrow('evolutions:eevee>vaporeon:74:forms:vaporeon-normal')
  })

  it('명시적 대상 폼이 없으면 게시 경계에서 거부한다', () => {
    const candidate = structuredClone(dataset)
    candidate.evolutions = [{
      id: 'eevee>eevee:explicit-missing', fromSpeciesId: 'eevee', toSpeciesId: 'eevee',
      toFormId: 'eevee-mega', conditionKo: '키스톤 사용',
    }]

    expect(() => analyzeEvolutionPublication(candidate))
      .toThrow('evolutions:eevee>eevee:explicit-missing:forms:eevee-mega')
  })

  it('암시적 출발 기본 폼이 없으면 게시 경계에서 거부한다', () => {
    const candidate = structuredClone(dataset)
    candidate.species.push({
      id: 'vaporeon', nationalDexNumber: 134, nameKo: '샤미드', descriptionKo: '물 포켓몬이다.',
    })
    candidate.evolutions = [{
      id: 'vaporeon>eevee:75', fromSpeciesId: 'vaporeon', toSpeciesId: 'eevee',
      conditionKo: '특수 조건',
    }]

    expect(() => analyzeEvolutionPublication(candidate))
      .toThrow('evolutions:vaporeon>eevee:75:forms:vaporeon-normal')
  })

  it('중복·orphan source diagnostic으로 게시 제외 수량을 조작할 수 없다', () => {
    const candidate = structuredClone(dataset)
    candidate.evolutions = [{
      id: 'eevee>megaeevee:74', fromSpeciesId: 'eevee', toSpeciesId: 'eevee', conditionKo: '키스톤 사용',
    }]
    candidate.sourceDiagnostics = [
      { code: 'missing-evolution-target-form', table: 'evolutions', key: 'eevee>megaeevee:74', target: 'forms:eevee-mega' },
      { code: 'missing-evolution-target-form', table: 'evolutions', key: 'eevee>megaeevee:74', target: 'forms:eevee-mega' },
      { code: 'missing-evolution-target-form', table: 'evolutions', key: 'eevee>megaeevee:999', target: 'forms:eevee-mega' },
    ]
    candidate.reportedCounts.evolutions = 999

    expect(() => analyzeEvolutionPublication(candidate)).toThrow('sourceDiagnostics:')
  })

  it('게시 회계는 candidate 보고 수가 아니라 실제 진화 행과 신뢰된 진단으로 계산한다', () => {
    const candidate = structuredClone(dataset)
    candidate.sourceCommits = reviewedSourceCommits
    candidate.sha256 = reviewedSourceHashes
    candidate.species.push({
      id: 'milotic', nationalDexNumber: 350, nameKo: '밀로틱', descriptionKo: '사랑 포켓몬.',
    })
    candidate.forms.push({
      ...candidate.forms[0], id: 'milotic-normal', speciesId: 'milotic', nameKo: '기본 모습',
    })
    candidate.evolutions = [{
      id: 'milotic>megamilotic:233', fromSpeciesId: 'milotic', toSpeciesId: 'milotic',
      conditionKo: '키스톤 사용; 원본에 대상 메가 폼이 없음',
    }]
    candidate.sourceDiagnostics = [{
      code: 'missing-evolution-target-form', table: 'evolutions',
      key: 'milotic>megamilotic:233', target: 'forms:milotic-mega',
    }]
    candidate.reportedCounts.evolutions = 999

    expect(analyzeEvolutionPublication(candidate)).toMatchObject({
      sourceCount: 1,
      publishableCount: 0,
      excludedPureSameSpeciesCount: 0,
      excludedMissingTargetCount: 1,
      excludedInvalidCount: 0,
    })
  })

  it('핵심 게시 CLI는 trusted source 없이 유효 후보 SQL을 만들지 않는다', () => {
    const temporaryDirectory = mkdtempSync(resolve(tmpdir(), 'pokemon-core-auth-'))
    const inputPath = resolve(temporaryDirectory, 'candidate.json')
    const outputPath = resolve(temporaryDirectory, 'publication.sql')
    writeFileSync(inputPath, JSON.stringify(createProductionReferenceCandidate()), 'utf8')

    try {
      const result = spawnSync(process.execPath, [
        resolve('node_modules/tsx/dist/cli.mjs'),
        resolve('scripts/data/publish-core-reference-data.ts'),
        '--input', inputPath,
        '--output', outputPath,
      ], { cwd: process.cwd(), encoding: 'utf8', timeout: 30_000 })

      expect(result.status).not.toBe(0)
      expect(`${result.stdout}${result.stderr}`).toContain('--source')
      expect(existsSync(outputPath)).toBe(false)
      expect(existsSync(`${outputPath}.tmp`)).toBe(false)
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true })
    }
  })

})
