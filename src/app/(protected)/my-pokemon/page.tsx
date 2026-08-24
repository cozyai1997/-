import Link from 'next/link'
import type { Route } from 'next'

import { PokemonBattleBadges } from '@/components/pokemon/pokemon-battle-badges'
import { PrivatePokemonImage } from '@/components/pokemon/private-pokemon-image'
import { listOwnedPokemon } from '@/features/owned-pokemon/repository'
import { createClient } from '@/lib/supabase/server'

export default async function MyPokemonPage() {
  const pokemon = await listOwnedPokemon(await createClient())

  return (
    <main className="owned-page">
      <div className="page-heading">
        <div><p className="eyebrow">나만의 육성 기록</p><h1>내 포켓몬</h1></div>
        <Link className="primary-link" href="/my-pokemon/new">새 포켓몬 등록</Link>
      </div>
      {pokemon.length ? (
        <section className="pokemon-card-grid" aria-label="보유 포켓몬 목록">
          {pokemon.map((item) => (
            <article className="pokemon-card" key={`${item.nationalDexNumber}-${item.entry}`}>
              <PrivatePokemonImage
                dex={item.nationalDexNumber}
                entry={item.entry}
                alt={`${item.nickname || item.nameKo} 개인 이미지`}
              />
              <span className="dex-number">도감번호 #{String(item.nationalDexNumber).padStart(4, '0')}</span>
              <h2>{item.nickname || item.nameKo}</h2>
              <p>{item.nameKo} · {item.formNameKo}</p>
              <span>Lv. {item.level}</span>
              <PokemonBattleBadges
                teraTypeNameKo={item.teraTypeNameKo}
                hasGigantamaxFactor={item.hasGigantamaxFactor}
              />
              <Link
                className="card-link"
                href={`/my-pokemon/detail?dex=${String(item.nationalDexNumber).padStart(4, '0')}&entry=${item.entry}` as Route}
                aria-label={`${item.nickname || item.nameKo} 상세 보기`}
              >
                상세 보기
              </Link>
            </article>
          ))}
        </section>
      ) : <section className="empty-dashboard"><h2>등록된 포켓몬이 없습니다</h2><p>첫 포켓몬을 등록해 육성 기록을 시작하세요.</p></section>}
    </main>
  )
}
