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
  userId: string,
  input: OwnedPokemonInput,
) {
  const { error } = await client.from('owned_pokemon').insert({
    user_id: userId,
    species_id: input.speciesId,
    form_id: input.formId,
    nickname: input.nickname,
    gender: input.gender,
    level: input.level,
    captured_on: input.capturedOn,
    original_nature_id: input.originalNatureId,
    effective_nature_id: input.effectiveNatureId,
    ability_id: input.abilityId,
    original_iv: input.originalIv,
    effective_iv: input.effectiveIv,
    ev: input.ev,
    held_item_id: input.heldItemId,
    notes: input.notes,
  })
  if (error) throw error
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

  const { data: rules, error: rulesError } = await client
    .from('reference_evolution_rules')
    .select(`
      condition_ko,
      target_form:reference_forms!reference_evolution_rules_to_form_id_fkey(
        name_ko,
        reference_species(name_ko, national_dex_number)
      )
    `)
    .eq('from_form_id', pokemon.form_id)
    .order('sort_order')
  if (rulesError) throw rulesError

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
    nameKo: pokemon.reference_species.name_ko,
    formNameKo: pokemon.reference_forms.name_ko,
    nationalDexNumber: pokemon.reference_species.national_dex_number,
    originalNatureNameKo: pokemon.original_nature?.name_ko ?? null,
    effectiveNatureNameKo: pokemon.effective_nature?.name_ko ?? null,
    abilityNameKo: pokemon.ability?.name_ko ?? null,
    heldItemNameKo: pokemon.held_item?.name_ko ?? null,
    evolutionRules: rules.map((rule) => ({
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
