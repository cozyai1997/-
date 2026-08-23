import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PokemonRegistrationWizard } from '@/components/forms/pokemon-registration-wizard'
import type {
  OwnedPokemonEditOptions,
  PokemonFilteredOptions,
} from '@/features/owned-pokemon/repository'

const {
  replace,
  refresh,
  listOwnedPokemonEditOptions,
  listPokemonFilteredOptions,
  createOwnedPokemon,
} = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  listOwnedPokemonEditOptions: vi.fn(),
  listPokemonFilteredOptions: vi.fn(),
  createOwnedPokemon: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser: vi.fn() } }),
}))

vi.mock('@/features/owned-pokemon/repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/owned-pokemon/repository')>()
  return {
    ...actual,
    createOwnedPokemon,
    listOwnedPokemonEditOptions,
    listPokemonFilteredOptions,
  }
})

const editOptions: OwnedPokemonEditOptions = {
  species: [
    {
      id: 'species-water',
      nameKo: '샤미드',
      nationalDexNumber: 134,
      forms: [
        { id: 'form-water', nameKo: '기본 모습', isDefault: true },
        { id: 'form-wave', nameKo: '물결 모습', isDefault: false },
      ],
    },
    {
      id: 'species-electric',
      nameKo: '쥬피썬',
      nationalDexNumber: 135,
      forms: [{ id: 'form-electric', nameKo: '기본 모습', isDefault: true }],
    },
  ],
  natures: [{ id: 'nature-jolly', nameKo: '명랑' }],
  abilities: [
    { id: 'ability-water', nameKo: '저수' },
    { id: 'ability-electric', nameKo: '축전' },
  ],
  items: [{ id: 'item-water', nameKo: '신비의물방울' }],
}

const waterOptions: PokemonFilteredOptions = {
  abilities: [{
    id: 'ability-water',
    nameKo: '저수',
    descriptionKo: '물 타입 기술을 받으면 회복한다.',
    isHidden: true,
  }],
  moves: [{
    id: 'move-surf',
    nameKo: '파도타기',
    descriptionKo: '큰 파도로 상대를 공격한다.',
    typeKo: '물',
    damageClassKo: '특수',
    power: 90,
    accuracy: 100,
    pp: 15,
    routes: [
      { methodKo: '레벨업', conditionKo: '레벨 40에 습득' },
      { methodKo: '기술머신', conditionKo: '기술머신 123으로 습득' },
    ],
  }],
}

const waveOptions: PokemonFilteredOptions = {
  abilities: [{
    id: 'ability-wave',
    nameKo: '촉촉바디',
    descriptionKo: '비가 오면 상태 이상을 회복한다.',
    isHidden: false,
  }],
  moves: waterOptions.moves,
}

const electricOptions: PokemonFilteredOptions = {
  abilities: [{
    id: 'ability-electric',
    nameKo: '축전',
    descriptionKo: '전기 타입 기술을 받으면 회복한다.',
    isHidden: false,
  }],
  moves: [{
    id: 'move-thunderbolt',
    nameKo: '십만볼트',
    descriptionKo: '강한 전기를 발사한다.',
    typeKo: '전기',
    damageClassKo: '특수',
    power: 90,
    accuracy: 100,
    pp: 15,
    routes: [{ methodKo: '기술머신', conditionKo: '기술머신 126으로 습득' }],
  }],
}

describe('포켓몬 등록 필터 선택 UI', () => {
  beforeEach(() => {
    sessionStorage.clear()
    listOwnedPokemonEditOptions.mockResolvedValue(editOptions)
    listPokemonFilteredOptions.mockImplementation(
      async (_client: unknown, _speciesId: string, formId: string) => {
        if (formId === 'form-water') return waterOptions
        if (formId === 'form-wave') return waveOptions
        return electricOptions
      },
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('정확한 폼의 한국어 특성과 네 칸씩의 현재·목표 기술만 선택하게 한다', async () => {
    const user = userEvent.setup()
    render(<PokemonRegistrationWizard />)

    await user.selectOptions(await screen.findByLabelText('포켓몬 종'), 'species-water')
    await user.click(screen.getByRole('button', { name: '다음' }))
    await user.click(screen.getByRole('button', { name: '다음' }))

    const ability = await screen.findByLabelText('특성', { exact: true })
    expect(screen.getByRole('option', { name: '저수 · 숨겨진 특성' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '축전' })).not.toBeInTheDocument()
    await user.selectOptions(ability, 'ability-water')
    expect(ability).toHaveAccessibleDescription('물 타입 기술을 받으면 회복한다.')

    await user.click(screen.getByRole('button', { name: '다음' }))
    await user.click(screen.getByRole('button', { name: '다음' }))
    await user.click(screen.getByRole('button', { name: '다음' }))

    for (let slot = 1; slot <= 4; slot += 1) {
      expect(screen.getByLabelText(`현재 기술 ${slot}`)).toBeInTheDocument()
      expect(screen.getByLabelText(`목표 기술 ${slot}`)).toBeInTheDocument()
    }
    expect(screen.queryByRole('option', { name: /십만볼트/u })).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('현재 기술 1'), 'move-surf')
    expect(screen.getByLabelText('현재 기술 2').querySelector('option[value="move-surf"]'))
      .toBeDisabled()
    await user.selectOptions(screen.getByLabelText('목표 기술 1'), 'move-surf')
    const route = screen.getByLabelText('목표 습득 방법 1')
    await user.selectOptions(route, '기술머신 123으로 습득')
    expect(screen.getAllByText(/물 · 특수 · 위력 90 · 명중 100 · PP 15/u)).toHaveLength(2)

    await waitFor(() => {
      expect(JSON.parse(sessionStorage.getItem('pokemon-registration-draft-v2') ?? '{}'))
        .toMatchObject({
          currentMoves: [{ moveId: 'move-surf' }],
          targetMoves: [{
            moveId: 'move-surf',
            conditionKo: '기술머신 123으로 습득',
          }],
        })
    })
  })

  it('폼 변경은 종별 기술을 유지하면서 허용되지 않는 특성을 지운다', async () => {
    const user = userEvent.setup()
    render(<PokemonRegistrationWizard />)

    await user.selectOptions(await screen.findByLabelText('포켓몬 종'), 'species-water')
    await user.click(screen.getByRole('button', { name: '다음' }))
    await user.click(screen.getByRole('button', { name: '다음' }))
    await user.selectOptions(await screen.findByLabelText('특성', { exact: true }), 'ability-water')
    await user.click(screen.getByRole('button', { name: '이전' }))
    await user.click(screen.getByRole('button', { name: '이전' }))
    await user.selectOptions(screen.getByLabelText('모습'), 'form-wave')
    await user.click(screen.getByRole('button', { name: '다음' }))
    await user.click(screen.getByRole('button', { name: '다음' }))

    await waitFor(() => expect(screen.getByLabelText('특성', { exact: true })).toHaveValue(''))
    expect(screen.queryByRole('option', { name: /저수/u })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: '촉촉바디' })).toBeInTheDocument()
  })

  it('늦게 끝난 이전 종의 요청이 최신 종의 선택지를 덮지 못하게 한다', async () => {
    const user = userEvent.setup()
    let resolveWater: ((value: PokemonFilteredOptions) => void) | undefined
    listPokemonFilteredOptions.mockImplementation(
      (_client: unknown, speciesId: string) => speciesId === 'species-water'
        ? new Promise<PokemonFilteredOptions>((resolve) => { resolveWater = resolve })
        : Promise.resolve(electricOptions),
    )
    render(<PokemonRegistrationWizard />)

    const species = await screen.findByLabelText('포켓몬 종')
    await user.selectOptions(species, 'species-water')
    expect(await screen.findByRole('status')).toHaveTextContent('특성과 기술을 불러오는 중입니다.')
    await user.selectOptions(species, 'species-electric')
    await waitFor(() => expect(listPokemonFilteredOptions).toHaveBeenCalledTimes(2))
    resolveWater?.(waterOptions)
    await user.click(screen.getByRole('button', { name: '다음' }))
    await user.click(screen.getByRole('button', { name: '다음' }))

    expect(await screen.findByRole('option', { name: '축전' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /저수/u })).not.toBeInTheDocument()
  })
})
