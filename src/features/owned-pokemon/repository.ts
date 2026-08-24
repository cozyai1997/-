import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database.generated'

import { statKeys, type OwnedPokemonInput, type StatBlock } from './schema'
import type { HpRule, NonHpStatKey } from '../stats/types'

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
  teraTypeNameKo: string | null
  hasGigantamaxFactor: boolean
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

export type NatureOption = LookupOption & {
  increasedStat: NonHpStatKey | null
  decreasedStat: NonHpStatKey | null
}

export type FormBattleProfile = {
  baseStats: StatBlock | null
  hpRule: HpRule
  teraTypes: Array<{ id: string; nameKo: string }>
  canGigantamax: boolean
}

export type PokemonFilteredOptions = {
  abilities: AbilityOption[]
  moves: MoveOption[]
  battle: FormBattleProfile
}

export type OwnedMoveDetail = {
  moveId: string
  slot: number
  nameKo: string
  descriptionKo: string
  typeKo: string
  damageClassKo: string
  power: number | null
  accuracy: number | null
  pp: number | null
  conditionKo: string | null
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
  const publicationResult = await client
    .from('data_publications')
    .select('id')
    .eq('status', 'active')
    .maybeSingle()
  if (publicationResult.error) throw publicationResult.error
  if (!publicationResult.data) throw new Error('활성 기준데이터 게시본이 없습니다.')
  const publicationId = publicationResult.data.id

  const formRequest = client
    .from('reference_forms')
    .select(`
      id, species_id, base_form_id, is_battle_only,
      base_hp, base_attack, base_defense, base_special_attack, base_special_defense, base_speed,
      reference_species!inner(identifier)
    `)
    .eq('id', formId)
    .eq('species_id', speciesId)
    .eq('publication_id', publicationId)
    .eq('is_active', true)
    .eq('is_battle_only', false)
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
    .eq('publication_id', publicationId)
    .eq('reference_moves.publication_id', publicationId)
    .eq('reference_moves.is_active', true)

  const [formResult, learnsetResult] = await Promise.all([formRequest, learnsetRequest])
  if (formResult.error) throw formResult.error
  if (!formResult.data) throw new Error('선택한 종에 해당하는 모습을 찾지 못했습니다.')
  if (learnsetResult.error) throw learnsetResult.error

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
    .eq('publication_id', publicationId)
    .eq('reference_abilities.publication_id', publicationId)
    .eq('reference_abilities.is_active', true)
  const teraRequest = client
    .from('reference_form_tera_options')
    .select(`
      tera_type_id,
      reference_tera_types!inner(id, name_ko, sort_order, is_active)
    `)
    .eq('form_id', formId)
    .eq('publication_id', publicationId)
    .eq('reference_tera_types.publication_id', publicationId)
    .eq('reference_tera_types.is_active', true)
  const gigantamaxRequest = client
    .from('reference_form_gigantamax_options')
    .select('source_form_id')
    .eq('source_form_id', formId)
    .eq('publication_id', publicationId)
    .maybeSingle()
  const [abilityResult, teraResult, gigantamaxResult] = await Promise.all([
    abilityRequest,
    teraRequest,
    gigantamaxRequest,
  ])
  if (abilityResult.error) throw abilityResult.error
  if (teraResult.error) throw teraResult.error
  if (gigantamaxResult.error) throw gigantamaxResult.error

  const form = formResult.data as unknown as {
    base_hp: number | null
    base_attack: number | null
    base_defense: number | null
    base_special_attack: number | null
    base_special_defense: number | null
    base_speed: number | null
    reference_species: { identifier: string }
  }
  const teraTypes = (teraResult.data as unknown as Array<{
    tera_type_id: string
    reference_tera_types: { id: string; name_ko: string; sort_order: number }
  }>)
    .map((row) => ({
      id: row.reference_tera_types.id,
      nameKo: row.reference_tera_types.name_ko,
      sortOrder: row.reference_tera_types.sort_order,
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
    .map(({ id, nameKo }) => ({ id, nameKo }))

  return {
    abilities: groupAbilityOptions(
      abilityResult.data as unknown as AbilityRelationRow[],
      formId,
      formResult.data.base_form_id,
    ),
    moves: groupMoveOptions(learnsetResult.data as unknown as MoveLearnsetRelationRow[]),
    battle: {
      baseStats: toBaseStatsOrNull(form),
      hpRule: form.reference_species.identifier === 'shedinja' ? 'fixed-one' : 'standard',
      teraTypes,
      canGigantamax: gigantamaxResult.data !== null,
    },
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
  teraTypeNameKo: string | null
  battle: FormBattleProfile
  currentMoveDetails: OwnedMoveDetail[]
  targetMoveDetails: OwnedMoveDetail[]
  evolutionRules: Array<{
    conditionKo: string
    targetNameKo: string
    targetDexNumber: number
  }>
}

export type OwnedPokemonEditOptions = {
  species: SpeciesOption[]
  natures: NatureOption[]
  abilities: LookupOption[]
  items: LookupOption[]
}

async function getActivePublicationId(client: SupabaseClient<Database>): Promise<string> {
  const { data, error } = await client
    .from('data_publications')
    .select('id')
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('활성 기준데이터 게시본이 없습니다.')
  return data.id
}

async function listSpeciesOptionsForPublication(
  client: SupabaseClient<Database>,
  publicationId: string,
) {
  const pageSize = 1_000
  const speciesOptions: SpeciesOption[] = []

  for (let start = 0; ; start += pageSize) {
    const { data, error } = await client
      .from('reference_species')
      .select(`
        id, name_ko, national_dex_number,
        reference_forms!inner(id, name_ko, is_default, is_battle_only)
      `)
      .eq('publication_id', publicationId)
      .eq('is_active', true)
      .eq('reference_forms.publication_id', publicationId)
      .eq('reference_forms.is_active', true)
      .eq('reference_forms.is_battle_only', false)
      .order('national_dex_number')
      .range(start, start + pageSize - 1)
    if (error) throw error

    speciesOptions.push(...data.map((species) => ({
      id: species.id,
      nameKo: species.name_ko,
      nationalDexNumber: species.national_dex_number,
      forms: species.reference_forms
        .filter((form) => !form.is_battle_only)
        .map((form) => ({
        id: form.id,
        nameKo: form.name_ko,
        isDefault: form.is_default,
        })),
    })))
    if (data.length < pageSize) break
  }

  return speciesOptions
}

export async function listSpeciesOptions(client: SupabaseClient<Database>) {
  return listSpeciesOptionsForPublication(client, await getActivePublicationId(client))
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
    p_tera_type_id: input.teraTypeId as unknown as string,
    p_has_gigantamax_factor: input.hasGigantamaxFactor,
  })
  if (error) throw error
  return data
}

export async function listOwnedPokemon(client: SupabaseClient<Database>) {
  const { data, error } = await client
    .from('owned_pokemon')
    .select(`
      nickname, level, has_gigantamax_factor,
      reference_species(name_ko, national_dex_number),
      reference_forms(name_ko),
      tera_type:reference_tera_types(name_ko)
    `)
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
      teraTypeNameKo: pokemon.tera_type?.name_ko ?? null,
      hasGigantamaxFactor: pokemon.has_gigantamax_factor,
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
      effective_iv, ev, held_item_id, notes, tera_type_id, has_gigantamax_factor, created_at,
      reference_species(name_ko, national_dex_number, identifier),
      reference_forms(
        name_ko, base_hp, base_attack, base_defense,
        base_special_attack, base_special_defense, base_speed
      ),
      tera_type:reference_tera_types(name_ko),
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
      .select(`
        move_id, kind, slot, target_condition_ko,
        reference_moves!inner(
          name_ko, description_ko, damage_class, power, accuracy, pp,
          reference_types!inner(name_ko)
        )
      `)
      .eq('owned_pokemon_id', pokemon.id)
      .order('slot'),
  ])
  if (rulesResult.error) throw rulesResult.error
  if (movesResult.error) throw movesResult.error

  const ownedMoves = movesResult.data as unknown as Array<{
    move_id: string
    kind: 'current' | 'target'
    slot: number
    target_condition_ko: string
    reference_moves: {
      name_ko: string
      description_ko: string
      damage_class: string
      power: number | null
      accuracy: number | null
      pp: number | null
      reference_types: { name_ko: string }
    }
  }>
  const moveDetails = ownedMoves.map(toOwnedMoveDetail)
  const form = pokemon.reference_forms as unknown as {
    base_hp: number | null
    base_attack: number | null
    base_defense: number | null
    base_special_attack: number | null
    base_special_defense: number | null
    base_speed: number | null
  }
  const species = pokemon.reference_species as unknown as {
    name_ko: string
    national_dex_number: number
    identifier: string
  }

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
    teraTypeId: pokemon.tera_type_id,
    hasGigantamaxFactor: pokemon.has_gigantamax_factor,
    currentMoves: ownedMoves
      .filter((move) => move.kind === 'current')
      .map((move) => ({ moveId: move.move_id })),
    targetMoves: ownedMoves
      .filter((move) => move.kind === 'target')
      .map((move) => ({
        moveId: move.move_id,
        conditionKo: move.target_condition_ko,
      })),
    nameKo: species.name_ko,
    formNameKo: pokemon.reference_forms.name_ko,
    nationalDexNumber: species.national_dex_number,
    originalNatureNameKo: pokemon.original_nature?.name_ko ?? null,
    effectiveNatureNameKo: pokemon.effective_nature?.name_ko ?? null,
    abilityNameKo: pokemon.ability?.name_ko ?? null,
    heldItemNameKo: pokemon.held_item?.name_ko ?? null,
    teraTypeNameKo: pokemon.tera_type?.name_ko ?? null,
    battle: {
      baseStats: toBaseStatsOrNull(form),
      hpRule: species.identifier === 'shedinja' ? 'fixed-one' : 'standard',
      teraTypes: [],
      canGigantamax: false,
    },
    currentMoveDetails: moveDetails.filter((move) => move.conditionKo === null),
    targetMoveDetails: moveDetails.filter((move) => move.conditionKo !== null),
    evolutionRules: rulesResult.data.map((rule) => ({
      conditionKo: rule.condition_ko,
      targetNameKo: rule.target_form.reference_species.name_ko,
      targetDexNumber: rule.target_form.reference_species.national_dex_number,
    })),
  } satisfies OwnedPokemonDetail
}

export async function listOwnedPokemonEditOptions(client: SupabaseClient<Database>) {
  const publicationId = await getActivePublicationId(client)
  const [species, natures, abilities, items] = await Promise.all([
    listSpeciesOptionsForPublication(client, publicationId),
    client.from('reference_natures')
      .select('id, name_ko, increased_stat, decreased_stat')
      .eq('publication_id', publicationId)
      .eq('is_active', true)
      .order('name_ko'),
    client.from('reference_abilities')
      .select('id, name_ko')
      .eq('publication_id', publicationId)
      .eq('is_active', true)
      .order('name_ko'),
    client.from('reference_items')
      .select('id, name_ko')
      .eq('publication_id', publicationId)
      .eq('is_active', true)
      .order('name_ko'),
  ])
  if (natures.error) throw natures.error
  if (abilities.error) throw abilities.error
  if (items.error) throw items.error
  return {
    species,
    natures: natures.data.map((item) => ({
      id: item.id,
      nameKo: item.name_ko,
      increasedStat: toNonHpStatKeyOrNull(item.increased_stat),
      decreasedStat: toNonHpStatKeyOrNull(item.decreased_stat),
    })),
    abilities: abilities.data.map((item) => ({ id: item.id, nameKo: item.name_ko })),
    items: items.data.map((item) => ({ id: item.id, nameKo: item.name_ko })),
  } satisfies OwnedPokemonEditOptions
}

export async function updateOwnedPokemonQuick(
  client: SupabaseClient<Database>,
  pokemonId: string,
  input: OwnedPokemonInput,
) {
  const { error } = await client.rpc('update_owned_pokemon_quick', {
    p_owned_pokemon_id: pokemonId,
    p_nickname: input.nickname as unknown as string,
    p_gender: input.gender,
    p_level: input.level,
    p_effective_nature_id: input.effectiveNatureId as unknown as string,
    p_ability_id: input.abilityId as unknown as string,
    p_effective_iv: input.effectiveIv,
    p_ev: input.ev,
    p_held_item_id: input.heldItemId as unknown as string,
    p_notes: input.notes,
    p_apply_battle_options: true,
    p_tera_type_id: input.teraTypeId as unknown as string,
    p_has_gigantamax_factor: input.hasGigantamaxFactor,
  })
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

function toBaseStatsOrNull(value: {
  base_hp: number | null
  base_attack: number | null
  base_defense: number | null
  base_special_attack: number | null
  base_special_defense: number | null
  base_speed: number | null
}): StatBlock | null {
  const baseStats = {
    hp: value.base_hp,
    attack: value.base_attack,
    defense: value.base_defense,
    special_attack: value.base_special_attack,
    special_defense: value.base_special_defense,
    speed: value.base_speed,
  }
  if (statKeys.some((key) => baseStats[key] === null)) return null
  return baseStats as StatBlock
}

function toNonHpStatKeyOrNull(value: string | null): NonHpStatKey | null {
  switch (value) {
    case 'attack':
    case 'defense':
    case 'special_attack':
    case 'special_defense':
    case 'speed':
      return value
    default:
      return null
  }
}

function toOwnedMoveDetail(move: {
  move_id: string
  slot: number
  target_condition_ko: string
  reference_moves: {
    name_ko: string
    description_ko: string
    damage_class: string
    power: number | null
    accuracy: number | null
    pp: number | null
    reference_types: { name_ko: string }
  }
}): OwnedMoveDetail {
  return {
    moveId: move.move_id,
    slot: move.slot,
    nameKo: move.reference_moves.name_ko,
    descriptionKo: move.reference_moves.description_ko,
    typeKo: move.reference_moves.reference_types.name_ko,
    damageClassKo: damageClassLabelKo(move.reference_moves.damage_class),
    power: move.reference_moves.power,
    accuracy: move.reference_moves.accuracy,
    pp: move.reference_moves.pp,
    conditionKo: move.target_condition_ko || null,
  }
}
