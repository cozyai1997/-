import { requiredKoreanFields, type KoreanFieldTable } from './required-fields'

export type ExpectedRowCounts = {
  types: number
  species: number
  forms: number
  abilities: number
  moves: number
  learnsets: number
  items: number
  evolutions: number
  formAbilities: number
  natures: number
  typeMatchups: number
}

type KoreanNamedRow = {
  id: string
  nameKo: string
  descriptionKo?: string
}

export type ReferenceDataset = {
  version: string
  sourceCommits: Record<string, string>
  sha256: Record<string, string>
  reportedCounts: ExpectedRowCounts
  types: KoreanNamedRow[]
  species: Array<KoreanNamedRow & {
    nationalDexNumber: number
    primaryTypeId?: string | null
    secondaryTypeId?: string | null
  }>
  forms: Array<KoreanNamedRow & {
    speciesId: string
    baseFormId: string | null
    primaryTypeId?: string | null
    secondaryTypeId?: string | null
  }>
  abilities: KoreanNamedRow[]
  moves: Array<KoreanNamedRow & {
    typeId: string
    damageClass: 'physical' | 'special' | 'status'
    power: number | null
    accuracy: number | null
    pp: number | null
  }>
  learnsets: Array<{
    speciesId: string
    formId?: string | null
    moveId: string
    learnMethod: 'level' | 'tm' | 'tutor' | 'egg' | 'legacy' | 'special' | 'form_change'
    learnLevel: number | null
    conditionKo: string
  }>
  items: KoreanNamedRow[]
  evolutions: Array<{
    id?: string
    fromSpeciesId: string
    toSpeciesId: string
    fromFormId?: string | null
    toFormId?: string | null
    conditionKo: string
  }>
  formAbilities: Array<{
    formId: string
    speciesId: string
    abilityId: string
    slot: string
    isHidden: boolean
  }>
  natures: KoreanNamedRow[]
  typeMatchups: Array<{
    attackingTypeId: string
    defendingTypeId: string
    multiplier: number
  }>
}

export type ValidationReport = {
  valid: boolean
  version: string
  rowCounts: ExpectedRowCounts
  missingKoreanFields: Array<{ table: string; key: string; field: string }>
  brokenReferences: Array<{ table: string; key: string; target: string }>
  countMismatches: Array<{
    table: keyof ExpectedRowCounts
    expected: number
    actual: number
    reported: number
  }>
  manifestIssues: string[]
  sourceCommits: Record<string, string>
  sha256: Record<string, string>
}

export const productionExpectedRowCounts: ExpectedRowCounts = {
  types: 18,
  species: 1025,
  forms: 1498,
  abilities: 310,
  moves: 826,
  learnsets: 116519,
  items: 615,
  evolutions: 602,
  formAbilities: 3055,
  natures: 25,
  typeMatchups: 324,
}

const rowCountKeys = Object.keys(productionExpectedRowCounts) as Array<keyof ExpectedRowCounts>
const hangulPattern = /[ㄱ-ㅎㅏ-ㅣ가-힣]/u
const commitPattern = /^[0-9a-f]{40}$/u
const sha256Pattern = /^[0-9a-f]{64}$/u

function rowKey(table: KoreanFieldTable, row: Record<string, unknown>, index: number): string {
  if (typeof row.id === 'string' && row.id.trim()) return row.id
  if (table === 'evolutions') {
    return `${String(row.fromSpeciesId)}>${String(row.toSpeciesId)}`
  }
  if (table === 'learnsets') {
    return `${String(row.speciesId)}:${String(row.moveId)}`
  }
  return String(index)
}

function addBrokenReference(
  target: ValidationReport['brokenReferences'],
  table: string,
  key: string,
  targetTable: string,
  targetId: string | null | undefined,
  knownIds: Set<string>,
): void {
  if (targetId && !knownIds.has(targetId)) {
    target.push({ table, key, target: `${targetTable}:${targetId}` })
  }
}

export function validateReferenceData(
  dataset: ReferenceDataset,
  options: { expectedRowCounts?: ExpectedRowCounts } = {},
): ValidationReport {
  const expectedRowCounts = options.expectedRowCounts ?? productionExpectedRowCounts
  const rowCounts = Object.fromEntries(
    rowCountKeys.map((table) => [table, dataset[table].length]),
  ) as ExpectedRowCounts
  const missingKoreanFields: ValidationReport['missingKoreanFields'] = []
  const brokenReferences: ValidationReport['brokenReferences'] = []
  const countMismatches: ValidationReport['countMismatches'] = []
  const manifestIssues: string[] = []

  for (const [table, fields] of Object.entries(requiredKoreanFields) as Array<
    [KoreanFieldTable, readonly string[]]
  >) {
    const rows = dataset[table] as unknown as Array<Record<string, unknown>>
    rows.forEach((row, index) => {
      for (const field of fields) {
        const value = row[field]
        if (typeof value !== 'string' || !hangulPattern.test(value)) {
          missingKoreanFields.push({ table, key: rowKey(table, row, index), field })
        }
      }
    })
  }

  for (const table of rowCountKeys) {
    const expected = expectedRowCounts[table]
    const actual = rowCounts[table]
    const reported = dataset.reportedCounts[table]
    if (actual !== expected || reported !== actual) {
      countMismatches.push({ table, expected, actual, reported })
    }
  }

  if (!dataset.version.trim()) manifestIssues.push('version:missing')
  if (Object.keys(dataset.sourceCommits).length === 0) manifestIssues.push('sourceCommits:missing')
  for (const [source, commit] of Object.entries(dataset.sourceCommits)) {
    if (!commitPattern.test(commit)) manifestIssues.push(`sourceCommit:${source}:invalid`)
  }
  if (Object.keys(dataset.sha256).length === 0) manifestIssues.push('sha256:missing')
  for (const [file, hash] of Object.entries(dataset.sha256)) {
    if (!sha256Pattern.test(hash)) manifestIssues.push(`sha256:${file}:invalid`)
  }

  const typeIds = new Set(dataset.types.map((row) => row.id))
  const speciesIds = new Set(dataset.species.map((row) => row.id))
  const formsById = new Map(dataset.forms.map((row) => [row.id, row]))
  const formIds = new Set(formsById.keys())
  const abilityIds = new Set(dataset.abilities.map((row) => row.id))
  const moveIds = new Set(dataset.moves.map((row) => row.id))

  for (const row of dataset.species) {
    addBrokenReference(brokenReferences, 'species', row.id, 'types', row.primaryTypeId, typeIds)
    addBrokenReference(brokenReferences, 'species', row.id, 'types', row.secondaryTypeId, typeIds)
  }
  for (const row of dataset.forms) {
    addBrokenReference(brokenReferences, 'forms', row.id, 'species', row.speciesId, speciesIds)
    addBrokenReference(brokenReferences, 'forms', row.id, 'types', row.primaryTypeId, typeIds)
    addBrokenReference(brokenReferences, 'forms', row.id, 'types', row.secondaryTypeId, typeIds)
  }
  for (const row of dataset.moves) {
    addBrokenReference(brokenReferences, 'moves', row.id, 'types', row.typeId, typeIds)
  }
  dataset.learnsets.forEach((row, index) => {
    const key = `${row.speciesId}:${row.moveId}:${index}`
    addBrokenReference(brokenReferences, 'learnsets', key, 'species', row.speciesId, speciesIds)
    addBrokenReference(brokenReferences, 'learnsets', key, 'forms', row.formId, formIds)
    addBrokenReference(brokenReferences, 'learnsets', key, 'moves', row.moveId, moveIds)
    if (row.formId) {
      const form = formsById.get(row.formId)
      if (form && form.speciesId !== row.speciesId) {
        brokenReferences.push({ table: 'learnsets', key, target: `formSpecies:${form.speciesId}` })
      }
    }
  })
  dataset.evolutions.forEach((row, index) => {
    const key = row.id ?? `${row.fromSpeciesId}>${row.toSpeciesId}:${index}`
    addBrokenReference(brokenReferences, 'evolutions', key, 'species', row.fromSpeciesId, speciesIds)
    addBrokenReference(brokenReferences, 'evolutions', key, 'species', row.toSpeciesId, speciesIds)
    addBrokenReference(brokenReferences, 'evolutions', key, 'forms', row.fromFormId, formIds)
    addBrokenReference(brokenReferences, 'evolutions', key, 'forms', row.toFormId, formIds)
  })
  dataset.formAbilities.forEach((row, index) => {
    const key = `${row.formId}:${row.abilityId}:${index}`
    addBrokenReference(brokenReferences, 'formAbilities', key, 'forms', row.formId, formIds)
    addBrokenReference(brokenReferences, 'formAbilities', key, 'species', row.speciesId, speciesIds)
    addBrokenReference(brokenReferences, 'formAbilities', key, 'abilities', row.abilityId, abilityIds)
  })
  dataset.typeMatchups.forEach((row, index) => {
    const key = `${row.attackingTypeId}:${row.defendingTypeId}:${index}`
    addBrokenReference(brokenReferences, 'typeMatchups', key, 'types', row.attackingTypeId, typeIds)
    addBrokenReference(brokenReferences, 'typeMatchups', key, 'types', row.defendingTypeId, typeIds)
  })

  return {
    valid:
      missingKoreanFields.length === 0 &&
      brokenReferences.length === 0 &&
      countMismatches.length === 0 &&
      manifestIssues.length === 0,
    version: dataset.version,
    rowCounts,
    missingKoreanFields,
    brokenReferences,
    countMismatches,
    manifestIssues,
    sourceCommits: dataset.sourceCommits,
    sha256: dataset.sha256,
  }
}

export function chooseActivePublicationId(
  currentPublicationId: string,
  candidatePublicationId: string,
  report: ValidationReport,
): string {
  return report.valid ? candidatePublicationId : currentPublicationId
}
