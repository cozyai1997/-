import { notFound } from 'next/navigation'

import { PokemonDetailEditor } from '@/components/forms/pokemon-detail-editor'
import {
  getOwnedPokemonDetail,
  listOwnedPokemonEditOptions,
} from '@/features/owned-pokemon/repository'
import { createClient } from '@/lib/supabase/server'

type DetailPageProps = {
  searchParams: Promise<{ dex?: string; entry?: string }>
}

export default async function PokemonDetailPage({ searchParams }: DetailPageProps) {
  const query = await searchParams
  const dex = Number(query.dex)
  const entry = Number(query.entry)
  if (!Number.isInteger(dex) || !Number.isInteger(entry) || dex < 1 || entry < 1) notFound()

  const client = await createClient()
  const [pokemon, options] = await Promise.all([
    getOwnedPokemonDetail(client, dex, entry),
    listOwnedPokemonEditOptions(client),
  ])
  if (!pokemon) notFound()

  return (
    <main className="owned-page">
      <PokemonDetailEditor initialPokemon={pokemon} options={options} />
    </main>
  )
}
