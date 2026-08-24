import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { ReferenceDataset } from '../../src/features/localization/reference-data-validation'

const batchSize = 750
const hangulPattern = /[ㄱ-ㅎㅏ-ㅣ가-힣]/u

type IdentifierRow = { id: string; identifier: string }
type FormRow = IdentifierRow & {
  publication_id: string | null
  species_id: string
  name_ko: string
  primary_type_id: string | null
  secondary_type_id: string | null
  is_default: boolean
  is_active: boolean
}

export type BattleStagingKind =
  | 'form_battle_profile'
  | 'nature_adjustment'
  | 'tera_type'
  | 'form_tera_option'
  | 'form_gigantamax_option'

type BattlePublicationIds = {
  formIds: Map<string, string>
  natureIds: Map<string, string>
  teraTypeIds: Map<string, string>
  typeIds: Map<string, string>
}

export type BattlePublicationRow = {
  rowKind: BattleStagingKind
  payload: Record<string, string | number | boolean | null>
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function chunks<T>(rows: T[], size = batchSize): T[][] {
  return Array.from({ length: Math.ceil(rows.length / size) }, (_, index) => (
    rows.slice(index * size, (index + 1) * size)
  ))
}

function requireEnvironment(name: string): string {
  const value = process.env[name]
  if (!value?.trim()) throw new Error(`${name} 환경 변수가 필요합니다.`)
  return value
}

function requireIdentifierId(map: Map<string, string>, identifier: string, table: string): string {
  const id = map.get(identifier)
  if (!id) throw new Error(`${table} 식별자를 찾을 수 없습니다: ${identifier}`)
  return id
}

async function selectAll<T>(
  client: SupabaseClient,
  table: string,
  columns: string,
  publicationId: string,
): Promise<T[]> {
  const rows: T[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .eq('publication_id', publicationId)
      .order('id')
      .range(offset, offset + 999)
    if (error) throw new Error(`${table} 조회 실패: ${error.message}`)
    const page = (data ?? []) as T[]
    rows.push(...page)
    if (page.length < 1000) return rows
  }
}

async function insertBatches(
  client: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  for (const batch of chunks(rows)) {
    const { error } = await client.from(table).insert(batch)
    if (error) throw new Error(`${table} 게시 실패: ${error.message}`)
  }
}

export async function stageThenReplacePublicationRows<T>(
  rows: T[],
  size: number,
  stage: (batch: T[]) => Promise<void>,
  replace: () => Promise<void>,
  cleanup: () => Promise<void> = async () => {},
): Promise<void> {
  try {
    for (const batch of chunks(rows, size)) await stage(batch)
    await replace()
  } catch (error) {
    try {
      await cleanup()
    } catch {
      // The original staging or replacement failure is the actionable error.
    }
    throw error
  }
}

export function assertOptionFilterPublicationCounts(
  dataset: Pick<
    ReferenceDataset,
    | 'moves'
    | 'forms'
    | 'formAbilities'
    | 'learnsets'
    | 'natures'
    | 'teraTypes'
    | 'formTeraOptions'
    | 'formGigantamaxOptions'
    | 'reportedCounts'
  >,
): void {
  const expected = {
    moves: 826,
    forms: 1498,
    formAbilities: 3055,
    learnsets: 116519,
    natures: 25,
    teraTypes: 19,
    formTeraOptions: 25_184,
    formGigantamaxOptions: 42,
  } as const
  for (const [key, count] of Object.entries(expected) as Array<[keyof typeof expected, number]>) {
    const actual = dataset[key].length
    const reported = dataset.reportedCounts[key]
    if (actual !== count || reported !== count) {
      throw new Error(`${key}:actual=${actual}:reported=${reported}:expected=${count}`)
    }
  }
}

function assertUniqueIdentifiers(
  table: string,
  rows: ReadonlyArray<{ id: string }>,
): Set<string> {
  const identifiers = new Set<string>()
  for (const row of rows) {
    if (!row.id.trim() || identifiers.has(row.id)) throw new Error(`${table}:${row.id}:id`)
    identifiers.add(row.id)
  }
  return identifiers
}

function assertResolvedIdentifier(
  knownIds: ReadonlySet<string>,
  identifier: string | null | undefined,
  location: string,
): void {
  if (identifier && !knownIds.has(identifier)) throw new Error(location)
}

export function assertOptionFilterCandidate(dataset: ReferenceDataset): void {
  assertOptionFilterPublicationCounts(dataset)
  assertKoreanOptionDisplayValues(dataset)

  const typeIds = assertUniqueIdentifiers('types', dataset.types)
  const speciesIds = assertUniqueIdentifiers('species', dataset.species)
  const formIds = assertUniqueIdentifiers('forms', dataset.forms)
  const abilityIds = assertUniqueIdentifiers('abilities', dataset.abilities)
  const moveIds = assertUniqueIdentifiers('moves', dataset.moves)
  assertUniqueIdentifiers('natures', dataset.natures)
  const teraTypeIds = assertUniqueIdentifiers('teraTypes', dataset.teraTypes)
  const formsById = new Map(dataset.forms.map((row) => [row.id, row]))

  for (const species of dataset.species) {
    assertResolvedIdentifier(typeIds, species.primaryTypeId, `species:${species.id}:primaryTypeId`)
    assertResolvedIdentifier(typeIds, species.secondaryTypeId, `species:${species.id}:secondaryTypeId`)
  }
  for (const form of dataset.forms) {
    assertResolvedIdentifier(speciesIds, form.speciesId, `forms:${form.id}:speciesId`)
    assertResolvedIdentifier(typeIds, form.primaryTypeId, `forms:${form.id}:primaryTypeId`)
    assertResolvedIdentifier(typeIds, form.secondaryTypeId, `forms:${form.id}:secondaryTypeId`)
    if (form.baseFormId) {
      const baseForm = formsById.get(form.baseFormId)
      if (!baseForm || baseForm.speciesId !== form.speciesId) {
        throw new Error(`forms:${form.id}:baseFormId`)
      }
    }
  }
  for (const move of dataset.moves) {
    assertResolvedIdentifier(typeIds, move.typeId, `moves:${move.id}:typeId`)
  }
  dataset.formAbilities.forEach((row, index) => {
    const form = formsById.get(row.formId)
    if (!form) throw new Error(`formAbilities:${index}:formId`)
    if (!speciesIds.has(row.speciesId) || form.speciesId !== row.speciesId) {
      throw new Error(`formAbilities:${index}:speciesId`)
    }
    if (!abilityIds.has(row.abilityId)) throw new Error(`formAbilities:${index}:abilityId`)
  })
  dataset.learnsets.forEach((row, index) => {
    const conditionKo = row.conditionKo
    if (
      typeof conditionKo !== 'string'
      || !conditionKo.trim()
      || conditionKo !== conditionKo.trim()
      || !hangulPattern.test(conditionKo)
    ) {
      throw new Error(`learnsets:${index}:conditionKo`)
    }
    if (!speciesIds.has(row.speciesId)) throw new Error(`learnsets:${index}:speciesId`)
    if (!moveIds.has(row.moveId)) throw new Error(`learnsets:${index}:moveId`)
    if (row.formId) {
      const form = formsById.get(row.formId)
      if (!form || form.speciesId !== row.speciesId) {
        throw new Error(`learnsets:${index}:formId`)
      }
    }
  })
  for (const option of dataset.formTeraOptions) {
    assertResolvedIdentifier(formIds, option.formId, `formTeraOptions:${option.formId}:formId`)
    assertResolvedIdentifier(teraTypeIds, option.teraTypeId, `formTeraOptions:${option.formId}:teraTypeId`)
  }
  for (const option of dataset.formGigantamaxOptions) {
    const source = formsById.get(option.sourceFormId)
    const target = formsById.get(option.gigantamaxFormId)
    if (!source || !target || source.speciesId !== target.speciesId || source.isBattleOnly || !target.isBattleOnly) {
      throw new Error(`formGigantamaxOptions:${option.sourceFormId}:${option.gigantamaxFormId}`)
    }
  }
}

export function prepareBattlePublicationRows(
  dataset: Pick<
    ReferenceDataset,
    'forms' | 'natures' | 'teraTypes' | 'formTeraOptions' | 'formGigantamaxOptions'
  >,
  ids: BattlePublicationIds,
): BattlePublicationRow[] {
  return [
    ...dataset.forms.map((form) => ({
      rowKind: 'form_battle_profile' as const,
      payload: {
        form_id: requireIdentifierId(ids.formIds, form.id, 'reference_forms'),
        base_form_id: form.baseFormId
          ? requireIdentifierId(ids.formIds, form.baseFormId, 'reference_forms')
          : null,
        base_hp: form.baseStats.hp,
        base_attack: form.baseStats.attack,
        base_defense: form.baseStats.defense,
        base_special_attack: form.baseStats.special_attack,
        base_special_defense: form.baseStats.special_defense,
        base_speed: form.baseStats.speed,
        is_battle_only: form.isBattleOnly,
      },
    })),
    ...dataset.natures.map((nature) => ({
      rowKind: 'nature_adjustment' as const,
      payload: {
        nature_id: requireIdentifierId(ids.natureIds, nature.id, 'reference_natures'),
        increased_stat: nature.increasedStat,
        decreased_stat: nature.decreasedStat,
      },
    })),
    ...dataset.teraTypes.map((teraType) => ({
      rowKind: 'tera_type' as const,
      payload: {
        tera_type_id: requireIdentifierId(ids.teraTypeIds, teraType.id, 'reference_tera_types'),
        identifier: teraType.id,
        name_ko: teraType.nameKo,
        reference_type_id: teraType.referenceTypeId
          ? requireIdentifierId(ids.typeIds, teraType.referenceTypeId, 'reference_types')
          : null,
        sort_order: teraType.sortOrder,
      },
    })),
    ...dataset.formTeraOptions.map((option) => ({
      rowKind: 'form_tera_option' as const,
      payload: {
        form_id: requireIdentifierId(ids.formIds, option.formId, 'reference_forms'),
        tera_type_id: requireIdentifierId(ids.teraTypeIds, option.teraTypeId, 'reference_tera_types'),
      },
    })),
    ...dataset.formGigantamaxOptions.map((option) => ({
      rowKind: 'form_gigantamax_option' as const,
      payload: {
        source_form_id: requireIdentifierId(ids.formIds, option.sourceFormId, 'reference_forms'),
        gigantamax_form_id: requireIdentifierId(ids.formIds, option.gigantamaxFormId, 'reference_forms'),
      },
    })),
  ]
}

export function assertKoreanOptionDisplayValues(
  dataset: {
    abilities: Array<{ id: string; nameKo: string; descriptionKo?: string }>
    moves: Array<{ id: string; nameKo: string; descriptionKo?: string }>
  },
): void {
  for (const [table, rows] of [
    ['abilities', dataset.abilities],
    ['moves', dataset.moves],
  ] as const) {
    for (const row of rows) {
      for (const field of ['nameKo', 'descriptionKo'] as const) {
        const value = row[field]
        if (typeof value !== 'string' || !value.trim() || !hangulPattern.test(value)) {
          throw new Error(`${table}:${row.id}:${field}`)
        }
      }
    }
  }
}

export async function publishPokemonOptionFilterReferenceData(
  dataset: ReferenceDataset,
  client: SupabaseClient,
): Promise<{
  moves: number
  forms: number
  formAbilities: number
  learnsets: number
  natures: number
  teraTypes: number
  formTeraOptions: number
  formGigantamaxOptions: number
}> {
  assertOptionFilterCandidate(dataset)

  const { data: publication, error: publicationError } = await client
    .from('data_publications')
    .select('id')
    .eq('version', dataset.version)
    .eq('status', 'active')
    .maybeSingle()
  if (publicationError) throw new Error(`게시 버전 조회 실패: ${publicationError.message}`)
  if (!publication) throw new Error(`핵심 기준데이터 게시본이 없습니다: ${dataset.version}`)

  const publicationId = publication.id as string
  const [types, species, forms, abilities, natures] = await Promise.all([
    selectAll<IdentifierRow>(client, 'reference_types', 'id,identifier', publicationId),
    selectAll<IdentifierRow>(client, 'reference_species', 'id,identifier', publicationId),
    selectAll<FormRow>(
      client,
      'reference_forms',
      'id,identifier,publication_id,species_id,name_ko,primary_type_id,secondary_type_id,is_default,is_active',
      publicationId,
    ),
    selectAll<IdentifierRow>(client, 'reference_abilities', 'id,identifier', publicationId),
    selectAll<IdentifierRow>(client, 'reference_natures', 'id,identifier', publicationId),
  ])

  const typeIds = new Map(types.map((row) => [row.identifier, row.id]))
  const speciesIds = new Map(species.map((row) => [row.identifier, row.id]))
  const formIds = new Map(forms.map((row) => [row.identifier, row.id]))
  const abilityIds = new Map(abilities.map((row) => [row.identifier, row.id]))
  const natureIds = new Map(natures.map((row) => [row.identifier, row.id]))
  const databaseForms = new Map(forms.map((row) => [row.identifier, row]))

  const formBaseLinks = dataset.forms.map((source) => {
    const form = databaseForms.get(source.id)
    if (!form) throw new Error(`reference_forms 식별자를 찾을 수 없습니다: ${source.id}`)
    return {
      form_id: form.id,
      base_form_id: source.baseFormId
        ? requireIdentifierId(formIds, source.baseFormId, 'reference_forms')
        : null,
    }
  })
  const formAbilities = dataset.formAbilities.map((row) => ({
    publication_id: publicationId,
    form_id: requireIdentifierId(formIds, row.formId, 'reference_forms'),
    ability_id: requireIdentifierId(abilityIds, row.abilityId, 'reference_abilities'),
    slot: row.slot,
    is_hidden: row.isHidden,
  }))
  const learnsets = dataset.learnsets.map((row) => ({
      species_id: requireIdentifierId(speciesIds, row.speciesId, 'reference_species'),
      form_id: row.formId ? requireIdentifierId(formIds, row.formId, 'reference_forms') : null,
      move_identifier: row.moveId,
      learn_method: row.learnMethod,
      learn_level: row.learnLevel,
      condition_ko: row.conditionKo,
  }))

  const moves = dataset.moves.map((row) => ({
    identifier: row.id,
    name_ko: row.nameKo,
    description_ko: row.descriptionKo,
    type_id: requireIdentifierId(typeIds, row.typeId, 'reference_types'),
    damage_class: row.damageClass,
    power: row.power,
    accuracy: row.accuracy,
    pp: row.pp,
    is_active: true,
  }))
  const teraTypeIds = new Map(dataset.teraTypes.map((row) => [row.id, randomUUID()]))
  const battleRows = prepareBattlePublicationRows(dataset, {
    formIds,
    natureIds,
    teraTypeIds,
    typeIds,
  })
  const batchId = randomUUID()
  const stagedRows = [
    ...moves.map((row, sourceOrder) => ({
      batch_id: batchId,
      publication_id: publicationId,
      row_kind: 'move',
      source_order: sourceOrder,
      payload: row,
    })),
    ...formBaseLinks.map((row, sourceOrder) => ({
      batch_id: batchId,
      publication_id: publicationId,
      row_kind: 'form_base_link',
      source_order: sourceOrder,
      payload: row,
    })),
    ...formAbilities.map((row, sourceOrder) => ({
      batch_id: batchId,
      publication_id: publicationId,
      row_kind: 'form_ability',
      source_order: sourceOrder,
      payload: row,
    })),
    ...learnsets.map((row, sourceOrder) => ({
      batch_id: batchId,
      publication_id: publicationId,
      row_kind: 'learnset',
      source_order: sourceOrder,
      payload: row,
    })),
    ...battleRows.map((row, sourceOrder) => ({
      batch_id: batchId,
      publication_id: publicationId,
      row_kind: row.rowKind,
      source_order: sourceOrder,
      payload: row.payload,
    })),
  ]
  const cleanupStagedAttempt = async () => {
    const { error } = await client
      .from('reference_option_filter_publication_staging')
      .delete()
      .eq('batch_id', batchId)
      .eq('publication_id', publicationId)
    if (error) throw new Error(`포켓몬 선택 필터 스테이징 정리 실패: ${error.message}`)
  }
  await stageThenReplacePublicationRows(
    stagedRows,
    batchSize,
    async (batch) => insertBatches(client, 'reference_option_filter_publication_staging', batch),
    async () => {
      const { error } = await client.rpc('replace_pokemon_option_filter_reference_data', {
        p_publication_id: publicationId,
        p_batch_id: batchId,
      })
      if (error) throw new Error(`포켓몬 선택 필터 교체 실패: ${error.message}`)
    },
    cleanupStagedAttempt,
  )

  return {
    moves: moves.length,
    forms: formBaseLinks.length,
    formAbilities: formAbilities.length,
    learnsets: learnsets.length,
    natures: dataset.natures.length,
    teraTypes: dataset.teraTypes.length,
    formTeraOptions: dataset.formTeraOptions.length,
    formGigantamaxOptions: dataset.formGigantamaxOptions.length,
  }
}

async function main(): Promise<void> {
  const input = argument('--input')
  if (!input) {
    throw new Error('사용법: tsx scripts/data/publish-pokemon-option-filter-reference-data.ts --input <후보 JSON>')
  }
  const dataset = JSON.parse(readFileSync(resolve(input), 'utf8')) as ReferenceDataset
  const client = createClient(
    requireEnvironment('SUPABASE_URL'),
    requireEnvironment('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const counts = await publishPokemonOptionFilterReferenceData(dataset, client)
  process.stdout.write(`${JSON.stringify(counts)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void main()
}
