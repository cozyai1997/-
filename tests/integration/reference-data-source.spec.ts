import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'csv-parse/sync'
import { describe, expect, it } from 'vitest'

import { importReferenceData } from '../../scripts/data/import-reference-data'
import { analyzeEvolutionPublication } from '../../scripts/data/publish-core-reference-data'

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

    expect(typeIds.size).toBe(18)
    expect(candidate.types).toHaveLength(typeIds.size)
    expect(candidate.forms.filter((form) => form.isBattleOnly)).toHaveLength(rawBattleOnly)
    expect(candidate.battleOnlyDiagnostics).toHaveLength(9)
    expect(candidate.sourceDiagnostics).toEqual([
      { code: 'missing-evolution-target-form', table: 'evolutions', key: 'milotic>megamilotic:233', target: 'forms:milotic-mega' },
      { code: 'missing-evolution-target-form', table: 'evolutions', key: 'milotic>megamilotic:234', target: 'forms:milotic-mega' },
    ])
    expect(publication).toMatchObject({
      sourceCount: 602,
      publishableCount: 573,
      excludedPureSameSpeciesCount: 27,
      excludedMissingTargetCount: 2,
      excludedInvalidCount: 0,
    })
    expect(publication.publishableCount + publication.excludedPureSameSpeciesCount
      + publication.excludedMissingTargetCount + publication.excludedInvalidCount)
      .toBe(sources.evolutions.length)
  })
})
