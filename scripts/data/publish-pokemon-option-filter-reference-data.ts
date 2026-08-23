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

async function selectAll<T>(client: SupabaseClient, table: string, columns: string): Promise<T[]> {
  const rows: T[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from(table).select(columns).range(offset, offset + 999)
    if (error) throw new Error(`${table} 조회 실패: ${error.message}`)
    const page = (data ?? []) as T[]
    rows.push(...page)
    if (page.length < 1000) return rows
  }
}

async function upsertBatches(
  client: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
): Promise<void> {
  for (const batch of chunks(rows)) {
    const { error } = await client.from(table).upsert(batch, { onConflict })
    if (error) throw new Error(`${table} 게시 실패: ${error.message}`)
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
): Promise<void> {
  for (const batch of chunks(rows, size)) await stage(batch)
  await replace()
}

export function assertOptionFilterPublicationCounts(
  dataset: Pick<ReferenceDataset, 'moves' | 'formAbilities' | 'learnsets' | 'reportedCounts'>,
): void {
  const expected = { moves: 826, formAbilities: 3055, learnsets: 116519 } as const
  for (const [key, count] of Object.entries(expected) as Array<[keyof typeof expected, number]>) {
    const actual = dataset[key].length
    const reported = dataset.reportedCounts[key]
    if (actual !== count || reported !== count) {
      throw new Error(`${key}:actual=${actual}:reported=${reported}:expected=${count}`)
    }
  }
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
): Promise<{ moves: number; formAbilities: number; learnsets: number }> {
  assertOptionFilterPublicationCounts(dataset)
  assertKoreanOptionDisplayValues(dataset)

  const { data: publication, error: publicationError } = await client
    .from('data_publications')
    .select('id')
    .eq('version', dataset.version)
    .maybeSingle()
  if (publicationError) throw new Error(`게시 버전 조회 실패: ${publicationError.message}`)
  if (!publication) throw new Error(`핵심 기준데이터 게시본이 없습니다: ${dataset.version}`)

  const publicationId = publication.id as string
  const [types, species, forms, abilities] = await Promise.all([
    selectAll<IdentifierRow>(client, 'reference_types', 'id,identifier'),
    selectAll<IdentifierRow>(client, 'reference_species', 'id,identifier'),
    selectAll<FormRow>(
      client,
      'reference_forms',
      'id,identifier,publication_id,species_id,name_ko,primary_type_id,secondary_type_id,is_default,is_active',
    ),
    selectAll<IdentifierRow>(client, 'reference_abilities', 'id,identifier'),
  ])

  const typeIds = new Map(types.map((row) => [row.identifier, row.id]))
  const speciesIds = new Map(species.map((row) => [row.identifier, row.id]))
  const formIds = new Map(forms.map((row) => [row.identifier, row.id]))
  const abilityIds = new Map(abilities.map((row) => [row.identifier, row.id]))
  const sourceMoveIds = new Set(dataset.moves.map((row) => row.id))

  const formBaseLinks = dataset.forms.map((source) => {
    const form = forms.find((row) => row.identifier === source.id)
    if (!form) throw new Error(`reference_forms 식별자를 찾을 수 없습니다: ${source.id}`)
    return {
      id: form.id,
      publication_id: form.publication_id,
      species_id: form.species_id,
      identifier: form.identifier,
      name_ko: form.name_ko,
      primary_type_id: form.primary_type_id,
      secondary_type_id: form.secondary_type_id,
      is_default: form.is_default,
      is_active: form.is_active,
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
  const learnsetReferences = dataset.learnsets.map((row) => {
    if (!sourceMoveIds.has(row.moveId)) {
      throw new Error(`reference_moves 식별자를 찾을 수 없습니다: ${row.moveId}`)
    }
    return {
      publication_id: publicationId,
      species_id: requireIdentifierId(speciesIds, row.speciesId, 'reference_species'),
      form_id: row.formId ? requireIdentifierId(formIds, row.formId, 'reference_forms') : null,
      moveIdentifier: row.moveId,
      learn_method: row.learnMethod,
      learn_level: row.learnLevel,
      condition_ko: row.conditionKo,
    }
  })

  const moves = dataset.moves.map((row) => ({
    publication_id: publicationId,
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
  await upsertBatches(client, 'reference_moves', moves, 'identifier')

  const databaseMoves = await selectAll<IdentifierRow>(client, 'reference_moves', 'id,identifier')
  const moveIds = new Map(databaseMoves.map((row) => [row.identifier, row.id]))
  await upsertBatches(client, 'reference_forms', formBaseLinks, 'id')
  const learnsets = learnsetReferences.map(({ moveIdentifier, ...row }) => ({
    ...row,
    move_id: requireIdentifierId(moveIds, moveIdentifier, 'reference_moves'),
  }))
  const batchId = randomUUID()
  const stagedRows = [
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
  ]
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
  )

  return { moves: moves.length, formAbilities: formAbilities.length, learnsets: learnsets.length }
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
