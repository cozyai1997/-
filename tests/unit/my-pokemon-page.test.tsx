import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import MyPokemonPage from '@/app/(protected)/my-pokemon/page'

const { listOwnedPokemon } = vi.hoisted(() => ({
  listOwnedPokemon: vi.fn(),
}))

vi.mock('@/features/owned-pokemon/repository', () => ({
  listOwnedPokemon,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve({}),
}))

vi.mock('@/components/pokemon/private-pokemon-image', () => ({
  PrivatePokemonImage: ({ alt }: { alt: string }) => <div role="img" aria-label={alt} />,
}))

describe('내 포켓몬 목록', () => {
  it('각 카드에 저장된 한국어 테라타입과 거다이맥스 배지를 표시한다', async () => {
    listOwnedPokemon.mockResolvedValueOnce([
      {
        nickname: '파도',
        level: 60,
        nameKo: '샤미드',
        formNameKo: '기본 모습',
        nationalDexNumber: 134,
        entry: 1,
        teraTypeNameKo: '물',
        hasGigantamaxFactor: false,
      },
      {
        nickname: null,
        level: 50,
        nameKo: '리자몽',
        formNameKo: '기본 모습',
        nationalDexNumber: 6,
        entry: 1,
        teraTypeNameKo: null,
        hasGigantamaxFactor: true,
      },
    ])

    render(await MyPokemonPage())

    expect(screen.getByText('테라타입: 물')).toBeVisible()
    expect(screen.getByText('테라타입: 미지정')).toBeVisible()
    expect(screen.getByText('거다이맥스 불가능')).toBeVisible()
    expect(screen.getByText('거다이맥스 가능')).toBeVisible()
    expect(screen.queryByText(/tera-/)).not.toBeInTheDocument()
  })
})
