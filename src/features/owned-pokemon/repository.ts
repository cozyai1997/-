import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database.generated'

import type { OwnedPokemonInput } from './schema'

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

  return data.map((pokemon) => ({
    nickname: pokemon.nickname,
    level: pokemon.level,
    nameKo: pokemon.reference_species.name_ko,
    nationalDexNumber: pokemon.reference_species.national_dex_number,
    formNameKo: pokemon.reference_forms.name_ko,
  })) satisfies OwnedPokemonCard[]
}
