import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'csv-parse/sync'
import { describe, expect, it } from 'vitest'

import { importReferenceData } from '../../scripts/data/import-reference-data'
import {
  analyzeEvolutionPublication,
  buildCoreReferenceSql,
} from '../../scripts/data/publish-core-reference-data'
import { canonicalReferenceDatasetDigest } from '../../scripts/data/authenticate-reference-data'
import { validateReferenceData } from '../../src/features/localization/reference-data-validation'

type CsvRow = Record<string, string>

const sourceRoot = process.env.REFERENCE_DATA_SOURCE
const enabled = process.env.RUN_REFERENCE_DATA_INTEGRATION === '1' && Boolean(sourceRoot)

function readCsv(path: string): CsvRow[] {
  return parse(readFileSync(path, 'utf8'), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[]
}

function uniqueCount(rows: CsvRow[], fields: string[]): number {
  return new Set(rows.map((row) => fields.map((field) => row[field]).join('\u001f'))).size
}

describe.runIf(enabled)('실제 기준데이터 원본 독립 완전성', () => {
  it('CSV·raw 행과 고유 키를 candidate 및 게시 변환 수량과 독립 비교한다', () => {
    if (!sourceRoot) throw new Error('REFERENCE_DATA_SOURCE 환경 변수가 필요합니다.')
    const fullRoot = join(sourceRoot, 'cobbleverse_data_full')
    const seedRoot = join(sourceRoot, 'cobbleverse_data')
    const cacheRoot = join(sourceRoot, 'full_data_cache', 'pokemon-by-slug')
    const sources = {
      species: readCsv(join(fullRoot, 'pokemon_full.csv')),
      forms: readCsv(join(fullRoot, 'forms_full.csv')),
      abilities: readCsv(join(fullRoot, 'abilities_full.csv')),
      moves: readCsv(join(fullRoot, 'moves_full.csv')),
      learnsets: readCsv(join(fullRoot, 'learnsets_full.csv')),
      items: readCsv(join(fullRoot, 'items_full.csv')),
      evolutions: readCsv(join(fullRoot, 'evolutions_full.csv')),
      formAbilities: readCsv(join(fullRoot, 'form_abilities_full.csv')),
      natures: readCsv(join(seedRoot, 'natures.csv')),
      typeMatchups: readCsv(join(seedRoot, 'types.csv')),
    }
    const candidate = importReferenceData(sourceRoot)

    const idContracts = [
      ['species', 'SpeciesID'], ['forms', 'FormID'], ['abilities', 'AbilityID'],
      ['moves', 'MoveID'], ['items', 'ItemID'], ['natures', 'NatureID'],
    ] as const
    for (const [table, idField] of idContracts) {
      const rows = sources[table]
      expect(uniqueCount(rows, [idField]), `${table} 원본 고유 식별자`).toBe(rows.length)
      expect(candidate[table], `${table} candidate 행`).toHaveLength(rows.length)
      expect(new Set(candidate[table].map((row) => row.id)).size, `${table} candidate 고유 식별자`)
        .toBe(rows.length)
    }

    const relationContracts = [
      ['learnsets', ['SpeciesID', 'FormID', 'MoveID', 'SourceType', 'SourceValue', 'MinLevel']],
      ['evolutions', ['FromSpeciesID', 'FromFormID', 'ToSpeciesID', 'ToFormID', 'Method', 'Condition']],
      ['formAbilities', ['FormID', 'SpeciesID', 'AbilityID', 'Slot', 'Hidden']],
      ['typeMatchups', ['AttackType', 'DefenseType']],
    ] as const
    for (const [table, fields] of relationContracts) {
      const rows = sources[table]
      expect(uniqueCount(rows, [...fields]), `${table} 원본 고유 관계`).toBe(rows.length)
      expect(candidate[table], `${table} candidate 행`).toHaveLength(rows.length)
    }

    const candidateRelationContracts = [
      ['learnsets', candidate.learnsets, (row: typeof candidate.learnsets[number]) => [
        row.speciesId, row.formId ?? '', row.moveId, row.learnMethod, row.learnLevel ?? '', row.conditionKo,
      ]],
      ['evolutions', candidate.evolutions, (row: typeof candidate.evolutions[number]) => [
        row.fromSpeciesId, row.fromFormId ?? '', row.toSpeciesId, row.toFormId ?? '', row.conditionKo,
      ]],
      ['formAbilities', candidate.formAbilities, (row: typeof candidate.formAbilities[number]) => [
        row.formId, row.speciesId, row.abilityId, row.slot, row.isHidden,
      ]],
      ['typeMatchups', candidate.typeMatchups, (row: typeof candidate.typeMatchups[number]) => [
        row.attackingTypeId, row.defendingTypeId,
      ]],
      ['formTeraOptions', candidate.formTeraOptions, (row: typeof candidate.formTeraOptions[number]) => [
        row.formId, row.teraTypeId,
      ]],
      ['formGigantamaxOptions', candidate.formGigantamaxOptions, (row: typeof candidate.formGigantamaxOptions[number]) => [
        row.sourceFormId, row.gigantamaxFormId,
      ]],
    ] as const
    for (const [table, rows, keyFor] of candidateRelationContracts) {
      const keys = rows.map((row) => keyFor(row as never).join('\u001f'))
      expect(new Set(keys).size, `${table} candidate 고유 관계`).toBe(rows.length)
    }

    const rawBattleOnly = sources.forms.filter((form) => {
      if (form.FormEN === 'Normal') return false
      const raw = JSON.parse(readFileSync(join(cacheRoot, `${form.SpeciesID}.json`), 'utf8')) as {
        forms?: Array<{ name: string; battleOnly?: boolean }>
      }
      const matches = raw.forms?.filter((entry) => entry.name === form.FormEN) ?? []
      expect(matches, `raw 폼 ${form.FormID}`).toHaveLength(1)
      return matches[0].battleOnly === true
    }).length
    const typeIds = new Set(sources.typeMatchups.flatMap((row) => [row.AttackType, row.DefenseType]))
    const publication = analyzeEvolutionPublication(candidate)
    const validation = validateReferenceData(candidate)
    const candidateDigest = canonicalReferenceDatasetDigest(candidate)
    const authenticatedSql = buildCoreReferenceSql(candidate, sourceRoot)

    expect(typeIds.size).toBe(18)
    expect(candidate.types).toHaveLength(typeIds.size)
    expect(candidate.forms.filter((form) => form.isBattleOnly)).toHaveLength(rawBattleOnly)
    expect(candidate.battleOnlyDiagnostics).toHaveLength(9)
    expect(validation.valid, JSON.stringify(validation)).toBe(true)
    expect(validation.sourceDiagnosticIssues).toEqual([])
    expect(candidateDigest).toMatch(/^[0-9a-f]{64}$/u)
    expect(authenticatedSql).toContain(`"candidateDigest":"${candidateDigest}"`)
    expect(authenticatedSql).toContain(`"trustedSourceDigest":"${candidateDigest}"`)
    expect(authenticatedSql).toContain('"method":"trusted-source-reimport-sha256"')
    expect(authenticatedSql).toContain('"sourceCount":602')
    expect(authenticatedSql).toContain('"publishableCount":600')
    expect(authenticatedSql).toContain('"excludedMissingTargetCount":2')
    expect(authenticatedSql).toContain('"valid":true')
    expect(candidate.sourceDiagnostics).toEqual([
      { code: 'missing-evolution-target-form', table: 'evolutions', key: 'milotic>megamilotic:233', target: 'forms:milotic-mega' },
      { code: 'missing-evolution-target-form', table: 'evolutions', key: 'milotic>megamilotic:234', target: 'forms:milotic-mega' },
    ])
    expect(publication).toMatchObject({
      sourceCount: 602,
      publishableCount: 600,
      excludedPureSameSpeciesCount: 0,
      excludedMissingTargetCount: 2,
      excludedInvalidCount: 0,
    })
    expect(candidate.evolutions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'tornadus>tornadus:367', toFormId: 'tornadus-therian' }),
      expect.objectContaining({ id: 'kyurem>kyurem:370', toFormId: 'kyurem-black' }),
      expect.objectContaining({ id: 'keldeo>keldeo:372', toFormId: 'keldeo-resolute' }),
      expect.objectContaining({ id: 'hoopa>hoopa:414', toFormId: 'hoopa-unbound' }),
      expect.objectContaining({ id: 'silvally>silvally:448', toFormId: 'silvally-water' }),
      expect.objectContaining({ id: 'zacian>zacian:552', toFormId: 'zacian-crowned' }),
      expect.objectContaining({ id: 'eternatus>eternatus:554', toFormId: 'eternatus-eternamax' }),
      expect.objectContaining({ id: 'enamorus>enamorus:559', toFormId: 'enamorus-therian' }),
    ]))
    expect(publication.publishableCount + publication.excludedPureSameSpeciesCount
      + publication.excludedMissingTargetCount + publication.excludedInvalidCount)
      .toBe(sources.evolutions.length)
  }, 15_000)
})
