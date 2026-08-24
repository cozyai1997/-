import { requiredKoreanFields, type KoreanFieldTable } from './required-fields'
import type { NonHpStatKey, StatBlock } from '../stats/types'

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

export type KoreanNamedRow = {
  id: string
  nameKo: string
  descriptionKo?: string
}

export type ReferenceFormRow = KoreanNamedRow & {
  speciesId: string
  baseFormId: string | null
  primaryTypeId: string | null
  secondaryTypeId: string | null
  baseStats: StatBlock
  isBattleOnly: boolean
  aspects: string[]
}

export type ReferenceNatureRow = KoreanNamedRow & {
  increasedStat: NonHpStatKey | null
  decreasedStat: NonHpStatKey | null
}

export type ReferenceTeraTypeRow = {
  id: string
  nameKo: string
  referenceTypeId: string | null
  sortOrder: number
}

export type ReferenceFormTeraOptionRow = { formId: string; teraTypeId: string }

export type ReferenceFormGigantamaxOptionRow = {
  sourceFormId: string
  gigantamaxFormId: string
}

export type BattleReportedCounts = {
  teraTypes: number
  formTeraOptions: number
  formGigantamaxOptions: number
}

export type BattleExpectedRowCounts = BattleReportedCounts

export type BattleDatasetProfile = {
  playableForms: number
  battleOnlyForms: number
  battleOnlyDiagnostics: number
}

export type SourceDiagnostic = {
  code: 'missing-evolution-target-form'
  table: 'evolutions'
  key: string
  target: string
}

export type ReferenceDataset = {
  version: string
  sourceCommits: Record<string, string>
  sha256: Record<string, string>
  battleOnlyDiagnostics: string[]
  sourceDiagnostics?: SourceDiagnostic[]
  reportedCounts: ExpectedRowCounts & BattleReportedCounts
  types: KoreanNamedRow[]
  species: Array<KoreanNamedRow & {
    nationalDexNumber: number
    primaryTypeId?: string | null
    secondaryTypeId?: string | null
  }>
  forms: ReferenceFormRow[]
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
  natures: ReferenceNatureRow[]
  teraTypes: ReferenceTeraTypeRow[]
  formTeraOptions: ReferenceFormTeraOptionRow[]
  formGigantamaxOptions: ReferenceFormGigantamaxOptionRow[]
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
  battleDataIssues: string[]
  duplicateKeys: Array<{ table: string; key: string }>
  placeholderIssues: Array<{ table: string; key: string; field: string; token: string }>
  sourceDiagnostics: SourceDiagnostic[]
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

export const productionExpectedBattleRowCounts: BattleExpectedRowCounts = {
  teraTypes: 19,
  formTeraOptions: 25_184,
  formGigantamaxOptions: 42,
}

export const productionExpectedBattleDatasetProfile: BattleDatasetProfile = {
  playableForms: 1_334,
  battleOnlyForms: 164,
  battleOnlyDiagnostics: 9,
}

const rowCountKeys = Object.keys(productionExpectedRowCounts) as Array<keyof ExpectedRowCounts>
const hangulPattern = /[ㄱ-ㅎㅏ-ㅣ가-힣]/u
const commitPattern = /^[0-9a-f]{40}$/u
const sha256Pattern = /^[0-9a-f]{64}$/u
const nonHpStatKeys = new Set<NonHpStatKey>([
  'attack',
  'defense',
  'special_attack',
  'special_defense',
  'speed',
])
const statKeys = ['hp', 'attack', 'defense', 'special_attack', 'special_defense', 'speed'] as const
const interpolationTokenPattern = /%(?:\d+\$)?[a-zA-Z]|\{[^{}\r\n]+\}/gu

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

function collectDuplicateKeys<T>(
  target: ValidationReport['duplicateKeys'],
  table: string,
  rows: T[],
  keyFor: (row: T, index: number) => string,
): void {
  const seen = new Set<string>()
  const reported = new Set<string>()
  rows.forEach((row, index) => {
    const key = keyFor(row, index)
    if (seen.has(key) && !reported.has(key)) {
      target.push({ table, key })
      reported.add(key)
    }
    seen.add(key)
  })
}

export function validateReferenceData(
  dataset: ReferenceDataset,
  options: {
    expectedRowCounts?: ExpectedRowCounts
    expectedBattleRowCounts?: BattleExpectedRowCounts
    expectedBattleDatasetProfile?: BattleDatasetProfile
  } = {},
): ValidationReport {
  const expectedRowCounts = options.expectedRowCounts ?? productionExpectedRowCounts
  const expectedBattleRowCounts = options.expectedBattleRowCounts ?? productionExpectedBattleRowCounts
  const expectedBattleDatasetProfile = options.expectedBattleDatasetProfile
    ?? productionExpectedBattleDatasetProfile
  const rowCounts = Object.fromEntries(
    rowCountKeys.map((table) => [table, dataset[table].length]),
  ) as ExpectedRowCounts
  const missingKoreanFields: ValidationReport['missingKoreanFields'] = []
  const brokenReferences: ValidationReport['brokenReferences'] = []
  const countMismatches: ValidationReport['countMismatches'] = []
  const manifestIssues: string[] = []
  const battleDataIssues: string[] = []
  const duplicateKeys: ValidationReport['duplicateKeys'] = []
  const placeholderIssues: ValidationReport['placeholderIssues'] = []
  const sourceDiagnostics = dataset.sourceDiagnostics ?? []

  for (const [table, fields] of Object.entries(requiredKoreanFields) as Array<
    [KoreanFieldTable, readonly string[]]
  >) {
    const rows = dataset[table] as unknown as Array<Record<string, unknown>>
    rows.forEach((row, index) => {
      for (const field of fields) {
        const value = row[field]
        if (typeof value !== 'string' || !hangulPattern.test(value)) {
          missingKoreanFields.push({ table, key: rowKey(table, row, index), field })
          continue
        }
        for (const token of value.match(interpolationTokenPattern) ?? []) {
          placeholderIssues.push({ table, key: rowKey(table, row, index), field, token })
        }
      }
    })
  }

  const idTables = ['types', 'species', 'forms', 'abilities', 'moves', 'items', 'natures', 'teraTypes'] as const
  for (const table of idTables) {
    collectDuplicateKeys(duplicateKeys, table, dataset[table], (row) => row.id)
  }
  collectDuplicateKeys(duplicateKeys, 'learnsets', dataset.learnsets, (row) => [
    row.speciesId, row.formId ?? '', row.moveId, row.learnMethod,
    row.learnLevel ?? '', row.conditionKo,
  ].join(':'))
  collectDuplicateKeys(
    duplicateKeys,
    'evolutions.id',
    dataset.evolutions.filter((row) => typeof row.id === 'string' && row.id.length > 0),
    (row) => row.id as string,
  )
  collectDuplicateKeys(duplicateKeys, 'evolutions', dataset.evolutions, (row) => [
    row.fromSpeciesId, row.fromFormId ?? '', row.toSpeciesId, row.toFormId ?? '', row.conditionKo,
  ].join(':'))
  collectDuplicateKeys(duplicateKeys, 'formAbilities', dataset.formAbilities, (row) => [
    row.formId, row.speciesId, row.abilityId, row.slot, row.isHidden,
  ].join(':'))
  collectDuplicateKeys(duplicateKeys, 'typeMatchups', dataset.typeMatchups, (row) => (
    `${row.attackingTypeId}:${row.defendingTypeId}`
  ))
  collectDuplicateKeys(duplicateKeys, 'formTeraOptions', dataset.formTeraOptions, (row) => (
    `${row.formId}:${row.teraTypeId}`
  ))
  collectDuplicateKeys(duplicateKeys, 'formGigantamaxOptions', dataset.formGigantamaxOptions, (row) => (
    `${row.sourceFormId}:${row.gigantamaxFormId}`
  ))

  for (const table of rowCountKeys) {
    const expected = expectedRowCounts[table]
    const actual = rowCounts[table]
    const reported = dataset.reportedCounts[table]
    if (actual !== expected || reported !== actual) {
      countMismatches.push({ table, expected, actual, reported })
    }
  }

  for (const [table, expected] of Object.entries(expectedBattleRowCounts) as Array<
    [keyof BattleExpectedRowCounts, number]
  >) {
    const actual = dataset[table].length
    const reported = dataset.reportedCounts[table]
    if (actual !== expected || reported !== actual) {
      battleDataIssues.push(`${table}:count:actual=${actual}:reported=${reported}:expected=${expected}`)
    }
  }
  const actualBattleDatasetProfile: BattleDatasetProfile = {
    playableForms: dataset.forms.filter((form) => !form.isBattleOnly).length,
    battleOnlyForms: dataset.forms.filter((form) => form.isBattleOnly).length,
    battleOnlyDiagnostics: dataset.battleOnlyDiagnostics.length,
  }
  for (const [field, expected] of Object.entries(expectedBattleDatasetProfile) as Array<
    [keyof BattleDatasetProfile, number]
  >) {
    const actual = actualBattleDatasetProfile[field]
    if (actual !== expected) {
      battleDataIssues.push(`${field}:count:actual=${actual}:expected=${expected}`)
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
  const teraTypeIds = new Set(dataset.teraTypes.map((row) => row.id))
  const teraOptionsByFormId = new Map<string, ReferenceFormTeraOptionRow[]>()

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

  for (const form of dataset.forms) {
    if (statKeys.some((key) => !Number.isInteger(form.baseStats[key]) || form.baseStats[key] < 1 || form.baseStats[key] > 255)) {
      battleDataIssues.push(`forms:${form.id}:baseStats`)
    }
  }
  for (const nature of dataset.natures) {
    const { increasedStat, decreasedStat } = nature
    const hasIncompleteAdjustment = (increasedStat === null) !== (decreasedStat === null)
    if (
      hasIncompleteAdjustment
      || (increasedStat !== null && !nonHpStatKeys.has(increasedStat))
      || (decreasedStat !== null && !nonHpStatKeys.has(decreasedStat))
    ) {
      battleDataIssues.push(`natures:${nature.id}:adjustment`)
    }
  }
  for (const option of dataset.formTeraOptions) {
    const form = formsById.get(option.formId)
    if (!form) {
      battleDataIssues.push(`formTeraOptions:${option.formId}:formId`)
      continue
    }
    if (!teraTypeIds.has(option.teraTypeId)) {
      battleDataIssues.push(`formTeraOptions:${option.formId}:teraTypeId`)
      continue
    }
    teraOptionsByFormId.set(option.formId, [...(teraOptionsByFormId.get(option.formId) ?? []), option])
  }
  for (const form of dataset.forms) {
    const optionsForForm = teraOptionsByFormId.get(form.id) ?? []
    if (form.isBattleOnly && optionsForForm.length > 0) {
      battleDataIssues.push(`formTeraOptions:${form.id}:battle-only`)
    }
    if (!form.isBattleOnly && optionsForForm.length === 0) {
      battleDataIssues.push(`formTeraOptions:${form.id}:missing`)
    }
    if (!form.isBattleOnly && (form.speciesId === 'ogerpon' || form.speciesId === 'terapagos') && optionsForForm.length !== 1) {
      battleDataIssues.push(`formTeraOptions:${form.id}:restricted-count`)
    }
  }
  for (const option of dataset.formGigantamaxOptions) {
    const source = formsById.get(option.sourceFormId)
    const target = formsById.get(option.gigantamaxFormId)
    if (
      !source
      || !target
      || source.speciesId !== target.speciesId
      || source.isBattleOnly
      || !target.isBattleOnly
    ) {
      battleDataIssues.push(`formGigantamaxOptions:${option.sourceFormId}:${option.gigantamaxFormId}`)
    }
  }

  return {
    valid:
      missingKoreanFields.length === 0 &&
      brokenReferences.length === 0 &&
      countMismatches.length === 0 &&
      manifestIssues.length === 0 &&
      battleDataIssues.length === 0 &&
      duplicateKeys.length === 0 &&
      placeholderIssues.length === 0,
    version: dataset.version,
    rowCounts,
    missingKoreanFields,
    brokenReferences,
    countMismatches,
    manifestIssues,
    battleDataIssues,
    duplicateKeys,
    placeholderIssues,
    sourceDiagnostics,
    sourceCommits: dataset.sourceCommits,
    sha256: dataset.sha256,
  }
}

export function collectBattleDataIssues(
  dataset: ReferenceDataset,
  options: {
    expectedBattleRowCounts?: BattleExpectedRowCounts
    expectedBattleDatasetProfile?: BattleDatasetProfile
  } = {},
): string[] {
  return validateReferenceData(dataset, {
    expectedBattleRowCounts: options.expectedBattleRowCounts,
    expectedBattleDatasetProfile: options.expectedBattleDatasetProfile,
  }).battleDataIssues
}

export function chooseActivePublicationId(
  currentPublicationId: string,
  candidatePublicationId: string,
  report: ValidationReport,
): string {
  return report.valid ? candidatePublicationId : currentPublicationId
}
