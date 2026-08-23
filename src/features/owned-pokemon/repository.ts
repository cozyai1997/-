import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database.generated'

import { statKeys, type OwnedPokemonInput, type StatBlock } from './schema'

export type SpeciesOption = {
  id: string
  nameKo: string
  nationalDexNumber: number
  forms: Array<{ id: string; nameKo: string; isDefault: boolean }>
}

export type OwnedPokemonCard = {
  nickname: string | null
  level: number
  nameKo: string
  formNameKo: string
  nationalDexNumber: number
  entry: number
}

export type LookupOption = { id: string; nameKo: string }

export type AbilityOption = {
  id: string
  nameKo: string
  descriptionKo: string
  isHidden: boolean
}

export type MoveAcquisitionRoute = {
  methodKo: string
  conditionKo: string
}

export type MoveOption = {
  id: string
  nameKo: string
  descriptionKo: string
  typeKo: string
  damageClassKo: string
  power: number | null
  accuracy: number | null
  pp: number | null
  routes: MoveAcquisitionRoute[]
}

export type PokemonFilteredOptions = {
  abilities: AbilityOption[]
  moves: MoveOption[]
}

type AbilityRelationRow = {
  form_id: string
  is_hidden: boolean
  reference_abilities: {
    id: string
    name_ko: string
    description_ko: string
    is_active: boolean
  }
}

type MoveLearnsetRelationRow = {
  learn_method: string
  condition_ko: string
  reference_moves: {
    id: string
    name_ko: string
    description_ko: string
    damage_class: string
    power: number | null
    accuracy: number | null
    pp: number | null
    is_active: boolean
    reference_types: { name_ko: string }
  }
}

const learnMethodIdentifiers = [
  'level',
  'tm',
  'tutor',
  'egg',
  'special',
  'form_change',
  'legacy',
] as const

const learnMethodLabelsKo: Record<(typeof learnMethodIdentifiers)[number], string> = {
  level: '레벨업',
  tm: '기술머신',
  tutor: '기술 가르침',
  egg: '유전',
  special: '특별한 방법',
  form_change: '모습 변경',
  legacy: '과거 버전',
}

const damageClassLabelsKo: Record<string, string> = {
  physical: '물리',
  special: '특수',
  status: '변화',
}

const koreanCollator = new Intl.Collator('ko')

export function learnMethodLabelKo(identifier: string): string {
  if (!learnMethodIdentifiers.includes(identifier as (typeof learnMethodIdentifiers)[number])) {
    throw new Error('지원하지 않는 기술 습득 경로입니다.')
  }
  return learnMethodLabelsKo[identifier as (typeof learnMethodIdentifiers)[number]]
}

export function damageClassLabelKo(identifier: string): string {
  const label = damageClassLabelsKo[identifier]
  if (!label) throw new Error('지원하지 않는 기술 분류입니다.')
  return label
}

export function groupAbilityOptions(
  rows: ReadonlyArray<AbilityRelationRow>,
  exactFormId: string,
  baseFormId: string | null,
): AbilityOption[] {
  const exactRows = rows.filter((row) => row.form_id === exactFormId)
  const selectedRows = exactRows.length > 0
    ? exactRows
    : rows.filter((row) => baseFormId !== null && row.form_id === baseFormId)
  const abilities = new Map<string, AbilityOption>()

  for (const row of selectedRows) {
    if (!row.reference_abilities.is_active) continue
    const existing = abilities.get(row.reference_abilities.id)
    abilities.set(row.reference_abilities.id, {
      id: row.reference_abilities.id,
      nameKo: row.reference_abilities.name_ko,
      descriptionKo: row.reference_abilities.description_ko,
      isHidden: (existing?.isHidden ?? false) || row.is_hidden,
    })
  }

  return [...abilities.values()].sort(compareKoreanNameAndId)
}

export function groupMoveOptions(rows: ReadonlyArray<MoveLearnsetRelationRow>): MoveOption[] {
  type GroupedMove = Omit<MoveOption, 'routes'> & {
    rawRoutes: Array<{ method: string; conditionKo: string }>
    routeKeys: Set<string>
  }
  const moves = new Map<string, GroupedMove>()

  for (const row of rows) {
    const move = row.reference_moves
    if (!move.is_active) continue
    const conditionKo = row.condition_ko.trim()
    if (!conditionKo) throw new Error('기술 습득 조건은 한국어로 비어 있지 않게 등록해야 합니다.')
    learnMethodLabelKo(row.learn_method)
    let grouped = moves.get(move.id)
    if (!grouped) {
      grouped = {
        id: move.id,
        nameKo: move.name_ko,
        descriptionKo: move.description_ko,
        typeKo: move.reference_types.name_ko,
        damageClassKo: damageClassLabelKo(move.damage_class),
        power: move.power,
        accuracy: move.accuracy,
        pp: move.pp,
        rawRoutes: [],
        routeKeys: new Set(),
      }
      moves.set(move.id, grouped)
    }
    const routeKey = `${row.learn_method}\u0000${conditionKo}`
    if (!grouped.routeKeys.has(routeKey)) {
      grouped.routeKeys.add(routeKey)
      grouped.rawRoutes.push({ method: row.learn_method, conditionKo })
    }
  }

  return [...moves.values()]
    .map((move) => ({
      id: move.id,
      nameKo: move.nameKo,
      descriptionKo: move.descriptionKo,
      typeKo: move.typeKo,
      damageClassKo: move.damageClassKo,
      power: move.power,
      accuracy: move.accuracy,
      pp: move.pp,
      routes: move.rawRoutes
        .sort((left, right) => {
          const order = learnMethodOrder(left.method) - learnMethodOrder(right.method)
          return order || koreanCollator.compare(left.conditionKo, right.conditionKo)
        })
        .map((route) => ({
          methodKo: learnMethodLabelKo(route.method),
          conditionKo: route.conditionKo,
        })),
    }))
    .sort(compareKoreanNameAndId)
}

export async function listPokemonFilteredOptions(
  client: SupabaseClient<Database>,
  speciesId: string,
  formId: string,
): Promise<PokemonFilteredOptions> {
  const formRequest = client
    .from('reference_forms')
    .select('id, species_id, base_form_id')
    .eq('id', formId)
    .eq('species_id', speciesId)
    .maybeSingle()
  const learnsetRequest = client
    .from('reference_move_learnsets')
    .select(`
      learn_method,
      condition_ko,
      reference_moves!inner(
        id, name_ko, description_ko, damage_class, power, accuracy, pp, is_active,
        reference_types!inner(name_ko)
      )
    `)
    .eq('species_id', speciesId)

  const formResult = await formRequest
  if (formResult.error) throw formResult.error
  if (!formResult.data) throw new Error('선택한 종에 해당하는 모습을 찾지 못했습니다.')

  const formIds = formResult.data.base_form_id
    ? [formId, formResult.data.base_form_id]
    : [formId]
  const abilityRequest = client
    .from('reference_form_abilities')
    .select(`
      form_id,
      is_hidden,
      reference_abilities!inner(id, name_ko, description_ko, is_active)
    `)
    .in('form_id', formIds)
  const [abilityResult, learnsetResult] = await Promise.all([abilityRequest, learnsetRequest])
  if (abilityResult.error) throw abilityResult.error
  if (learnsetResult.error) throw learnsetResult.error

  return {
    abilities: groupAbilityOptions(
      abilityResult.data as unknown as AbilityRelationRow[],
      formId,
      formResult.data.base_form_id,
    ),
    moves: groupMoveOptions(learnsetResult.data as unknown as MoveLearnsetRelationRow[]),
  }
}

function learnMethodOrder(identifier: string): number {
  const order = learnMethodIdentifiers.indexOf(identifier as (typeof learnMethodIdentifiers)[number])
  if (order === -1) throw new Error('지원하지 않는 기술 습득 경로입니다.')
  return order
}

function compareKoreanNameAndId(
  left: { nameKo: string; id: string },
  right: { nameKo: string; id: string },
) {
  return koreanCollator.compare(left.nameKo, right.nameKo) || left.id.localeCompare(right.id)
}

export type OwnedPokemonDetail = OwnedPokemonInput & {
  id: string
  nameKo: string
  formNameKo: string
  nationalDexNumber: number
  originalNatureNameKo: string | null
  effectiveNatureNameKo: string | null
  abilityNameKo: string | null
  heldItemNameKo: string | null
  evolutionRules: Array<{
    conditionKo: string
    targetNameKo: string
    targetDexNumber: number
  }>
}

export type OwnedPokemonEditOptions = {
  species: SpeciesOption[]
  natures: LookupOption[]
  abilities: LookupOption[]
  items: LookupOption[]
}

export async function listSpeciesOptions(client: SupabaseClient<Database>) {
  const { data, error } = await client
    .from('reference_species')
    .select('id, name_ko, national_dex_number, reference_forms(id, name_ko, is_default)')
    .eq('is_active', true)
    .order('national_dex_number')
  if (error) throw error

  return data.map((species) => ({
    id: species.id,
    nameKo: species.name_ko,
    nationalDexNumber: species.national_dex_number,
    forms: species.reference_forms.map((form) => ({
      id: form.id,
      nameKo: form.name_ko,
      isDefault: form.is_default,
    })),
  })) satisfies SpeciesOption[]
}

export async function createOwnedPokemon(
  client: SupabaseClient<Database>,
  input: OwnedPokemonInput,
) {
  const { data, error } = await client.rpc('create_owned_pokemon_with_moves', {
    p_species_id: input.speciesId,
    p_form_id: input.formId,
    p_nickname: input.nickname as unknown as string,
    p_gender: input.gender,
    p_level: input.level,
    p_captured_on: input.capturedOn as unknown as string,
    p_original_nature_id: input.originalNatureId as unknown as string,
    p_effective_nature_id: input.effectiveNatureId as unknown as string,
    p_ability_id: input.abilityId as unknown as string,
    p_original_iv: input.originalIv,
    p_effective_iv: input.effectiveIv,
    p_ev: input.ev,
    p_held_item_id: input.heldItemId as unknown as string,
    p_notes: input.notes,
    p_current_moves: input.currentMoves.map((move) => ({ move_id: move.moveId })),
    p_target_moves: input.targetMoves.map((move) => ({
      move_id: move.moveId,
      condition_ko: move.conditionKo,
    })),
  })
  if (error) throw error
  return data
}

export async function listOwnedPokemon(client: SupabaseClient<Database>) {
  const { data, error } = await client
    .from('owned_pokemon')
    .select('nickname, level, reference_species(name_ko, national_dex_number), reference_forms(name_ko)')
    .order('created_at')
  if (error) throw error

  const entries = new Map<number, number>()
  return data.map((pokemon) => {
    const dex = pokemon.reference_species.national_dex_number
    const entry = (entries.get(dex) ?? 0) + 1
    entries.set(dex, entry)
    return {
      nickname: pokemon.nickname,
      level: pokemon.level,
      nameKo: pokemon.reference_species.name_ko,
      nationalDexNumber: dex,
      formNameKo: pokemon.reference_forms.name_ko,
      entry,
    }
  }) satisfies OwnedPokemonCard[]
}

export async function getOwnedPokemonDetail(
  client: SupabaseClient<Database>,
  nationalDexNumber: number,
  entry: number,
) {
  const { data, error } = await client
    .from('owned_pokemon')
    .select(`
      id, species_id, form_id, nickname, gender, level, captured_on,
      original_nature_id, effective_nature_id, ability_id, original_iv,
      effective_iv, ev, held_item_id, notes, created_at,
      reference_species(name_ko, national_dex_number),
      reference_forms(name_ko),
      original_nature:reference_natures!owned_pokemon_original_nature_id_fkey(name_ko),
      effective_nature:reference_natures!owned_pokemon_effective_nature_id_fkey(name_ko),
      ability:reference_abilities(name_ko),
      held_item:reference_items(name_ko)
    `)
    .order('created_at')
  if (error) throw error

  const pokemon = data.filter(
    (row) => row.reference_species.national_dex_number === nationalDexNumber,
  )[entry - 1]
  if (!pokemon) return null

  const [rulesResult, movesResult] = await Promise.all([
    client
      .from('reference_evolution_rules')
      .select(`
        condition_ko,
        target_form:reference_forms!reference_evolution_rules_to_form_id_fkey(
          name_ko,
          reference_species(name_ko, national_dex_number)
        )
      `)
      .eq('from_form_id', pokemon.form_id)
      .order('sort_order'),
    client
      .from('owned_pokemon_moves')
      .select('move_id, kind, slot, target_condition_ko')
      .eq('owned_pokemon_id', pokemon.id)
      .order('slot'),
  ])
  if (rulesResult.error) throw rulesResult.error
  if (movesResult.error) throw movesResult.error

  return {
    id: pokemon.id,
    speciesId: pokemon.species_id,
    formId: pokemon.form_id,
    nickname: pokemon.nickname,
    gender: pokemon.gender,
    level: pokemon.level,
    capturedOn: pokemon.captured_on,
    originalNatureId: pokemon.original_nature_id,
    effectiveNatureId: pokemon.effective_nature_id,
    abilityId: pokemon.ability_id,
    originalIv: parseStatBlock(pokemon.original_iv),
    effectiveIv: parseStatBlock(pokemon.effective_iv),
    ev: parseStatBlock(pokemon.ev),
    heldItemId: pokemon.held_item_id,
    notes: pokemon.notes,
    currentMoves: movesResult.data
      .filter((move) => move.kind === 'current')
      .map((move) => ({ moveId: move.move_id })),
    targetMoves: movesResult.data
      .filter((move) => move.kind === 'target')
      .map((move) => ({
        moveId: move.move_id,
        conditionKo: move.target_condition_ko,
      })),
    nameKo: pokemon.reference_species.name_ko,
    formNameKo: pokemon.reference_forms.name_ko,
    nationalDexNumber: pokemon.reference_species.national_dex_number,
    originalNatureNameKo: pokemon.original_nature?.name_ko ?? null,
    effectiveNatureNameKo: pokemon.effective_nature?.name_ko ?? null,
    abilityNameKo: pokemon.ability?.name_ko ?? null,
    heldItemNameKo: pokemon.held_item?.name_ko ?? null,
    evolutionRules: rulesResult.data.map((rule) => ({
      conditionKo: rule.condition_ko,
      targetNameKo: rule.target_form.reference_species.name_ko,
      targetDexNumber: rule.target_form.reference_species.national_dex_number,
    })),
  } satisfies OwnedPokemonDetail
}

export async function listOwnedPokemonEditOptions(client: SupabaseClient<Database>) {
  const [species, natures, abilities, items] = await Promise.all([
    listSpeciesOptions(client),
    client.from('reference_natures').select('id, name_ko').eq('is_active', true).order('name_ko'),
    client.from('reference_abilities').select('id, name_ko').eq('is_active', true).order('name_ko'),
    client.from('reference_items').select('id, name_ko').eq('is_active', true).order('name_ko'),
  ])
  if (natures.error) throw natures.error
  if (abilities.error) throw abilities.error
  if (items.error) throw items.error
  return {
    species,
    natures: natures.data.map((item) => ({ id: item.id, nameKo: item.name_ko })),
    abilities: abilities.data.map((item) => ({ id: item.id, nameKo: item.name_ko })),
    items: items.data.map((item) => ({ id: item.id, nameKo: item.name_ko })),
  } satisfies OwnedPokemonEditOptions
}

export async function updateOwnedPokemonQuick(
  client: SupabaseClient<Database>,
  pokemonId: string,
  input: OwnedPokemonInput,
) {
  const { error } = await client
    .from('owned_pokemon')
    .update({
      nickname: input.nickname,
      gender: input.gender,
      level: input.level,
      effective_nature_id: input.effectiveNatureId,
      ability_id: input.abilityId,
      effective_iv: input.effectiveIv,
      ev: input.ev,
      held_item_id: input.heldItemId,
      notes: input.notes,
    })
    .eq('id', pokemonId)
  if (error) throw error
}

export async function correctOwnedPokemon(
  client: SupabaseClient<Database>,
  pokemonId: string,
  input: OwnedPokemonInput,
  reasonKo: string,
) {
  const { error } = await client.rpc('correct_owned_pokemon', {
    p_owned_pokemon_id: pokemonId,
    p_species_id: input.speciesId,
    p_form_id: input.formId,
    p_captured_on: (input.capturedOn ?? null) as unknown as string,
    p_original_iv: input.originalIv,
    p_reason_ko: reasonKo,
  })
  if (error) throw error
}

function parseStatBlock(value: Database['public']['Tables']['owned_pokemon']['Row']['original_iv']) {
  const record = value as Record<string, unknown>
  return Object.fromEntries(
    statKeys.map((key) => [key, Number(record[key] ?? 0)]),
  ) as StatBlock
}
