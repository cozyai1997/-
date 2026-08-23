import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PokemonDetailEditor } from '@/components/forms/pokemon-detail-editor'
import type {
  OwnedPokemonDetail,
  OwnedPokemonEditOptions,
  PokemonFilteredOptions,
} from '@/features/owned-pokemon/repository'
import { createRegistrationDraft } from '@/features/owned-pokemon/registration-state'

const {
  correctOwnedPokemon,
  listPokemonFilteredOptions,
  replace,
  refresh,
  updateOwnedPokemonQuick,
} = vi.hoisted(() => ({
  correctOwnedPokemon: vi.fn(),
  listPokemonFilteredOptions: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  updateOwnedPokemonQuick: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({}),
}))

vi.mock('@/components/pokemon/private-pokemon-image', () => ({
  PrivatePokemonImage: () => <div>비공개 이미지</div>,
}))

vi.mock('@/features/owned-pokemon/repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/owned-pokemon/repository')>()
  return {
    ...actual,
    correctOwnedPokemon,
    listPokemonFilteredOptions,
    updateOwnedPokemonQuick,
  }
})

const options: OwnedPokemonEditOptions = {
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
    { id: 'ability-wave', nameKo: '촉촉바디' },
    { id: 'ability-global-only', nameKo: '전역 전용 특성' },
  ],
  items: [{ id: 'item-water', nameKo: '신비의물방울' }],
}

const baseOptions: PokemonFilteredOptions = {
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
    routes: [{ methodKo: '기술머신', conditionKo: '기술머신 123으로 습득' }],
  }],
}

const waveOptions: PokemonFilteredOptions = {
  abilities: [{
    id: 'ability-wave',
    nameKo: '촉촉바디',
    descriptionKo: '비가 오면 상태 이상을 회복한다.',
    isHidden: false,
  }],
  moves: baseOptions.moves,
}

const electricOptions: PokemonFilteredOptions = {
  abilities: [],
  moves: [],
}

function pokemon(overrides: Partial<OwnedPokemonDetail> = {}): OwnedPokemonDetail {
  const draft = createRegistrationDraft()
  return {
    ...draft,
    id: 'owned-pokemon',
    speciesId: 'species-water',
    formId: 'form-water',
    nickname: '파도',
    gender: 'female',
    level: 60,
    abilityId: 'ability-water',
    currentMoves: [{ moveId: 'move-surf' }],
    targetMoves: [{ moveId: 'move-surf', conditionKo: '기술머신 123으로 습득' }],
    nameKo: '샤미드',
    formNameKo: '기본 모습',
    nationalDexNumber: 134,
    originalNatureNameKo: null,
    effectiveNatureNameKo: null,
    abilityNameKo: '저수',
    heldItemNameKo: null,
    evolutionRules: [],
    ...overrides,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

describe('포켓몬 상세 필터 수정', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    listPokemonFilteredOptions.mockImplementation(
      async (_client: unknown, _speciesId: string, formId: string) => {
        if (formId === 'form-wave') return waveOptions
        if (formId === 'form-electric') return electricOptions
        return baseOptions
      },
    )
  })

  it('빠른 수정은 현재 폼의 필터 특성만 표시하고 조정 완료 전 저장을 막는다', async () => {
    const loading = deferred<PokemonFilteredOptions>()
    listPokemonFilteredOptions.mockReturnValueOnce(loading.promise)
    const user = userEvent.setup()
    render(<PokemonDetailEditor
      initialPokemon={pokemon({ abilityId: 'ability-global-only' })}
      options={options}
      dex={134}
      entry={1}
    />)

    expect(screen.getByRole('button', { name: '빠른 수정 저장' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('빠른 수정 특성을 불러오는 중입니다.')

    loading.resolve(baseOptions)
    const ability = await screen.findByLabelText('특성', { exact: true })
    await waitFor(() => expect(ability).toHaveValue(''))
    expect(screen.getByRole('option', { name: '저수 · 숨겨진 특성' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '전역 전용 특성' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '촉촉바디' })).not.toBeInTheDocument()

    await user.selectOptions(ability, 'ability-water')
    await user.click(screen.getByRole('button', { name: '빠른 수정 저장' }))
    expect(updateOwnedPokemonQuick).toHaveBeenCalledWith(
      expect.anything(),
      'owned-pokemon',
      expect.objectContaining({ abilityId: 'ability-water' }),
    )
  })

  it('빠른 수정 필터 오류와 빈 선택지를 한국어로 알리고 오류 중 저장을 막는다', async () => {
    listPokemonFilteredOptions.mockRejectedValueOnce(new Error('조회 실패'))
    const view = render(<PokemonDetailEditor
      initialPokemon={pokemon()}
      options={options}
      dex={134}
      entry={1}
    />)

    expect(await screen.findByText('빠른 수정 특성을 불러오지 못했습니다. 다시 시도해 주세요.'))
      .toBeVisible()
    expect(screen.getByRole('button', { name: '빠른 수정 저장' })).toBeDisabled()

    view.unmount()
    listPokemonFilteredOptions.mockResolvedValueOnce(electricOptions)
    render(<PokemonDetailEditor
      initialPokemon={pokemon({ abilityId: null })}
      options={options}
      dex={134}
      entry={1}
    />)
    expect(await screen.findByText('선택한 모습에 등록된 특성이 없습니다.')).toBeVisible()
  })

  it('종 정정 이벤트는 서버와 같이 특성과 모든 기술 선택을 즉시 비운다', async () => {
    const user = userEvent.setup()
    render(<PokemonDetailEditor initialPokemon={pokemon()} options={options} dex={134} entry={1} />)
    await waitFor(() => expect(screen.getByRole('button', { name: '빠른 수정 저장' })).toBeEnabled())

    await user.click(screen.getByRole('button', { name: '보호 정보 정정 열기' }))
    await user.selectOptions(screen.getByLabelText('정정 포켓몬 종'), 'species-electric')
    await user.type(screen.getByLabelText('정정 사유'), '종 입력 오류를 정정함')
    await waitFor(() => expect(screen.getByRole('button', { name: '정정 저장' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: '정정 저장' }))

    expect(correctOwnedPokemon).toHaveBeenCalledWith(
      expect.anything(),
      'owned-pokemon',
      expect.objectContaining({
        speciesId: 'species-electric',
        formId: 'form-electric',
        abilityId: null,
        currentMoves: [],
        targetMoves: [],
      }),
      '종 입력 오류를 정정함',
    )
  })

  it('폼만 정정하면 요청 중 저장을 막고 기술은 유지하되 새 폼에서 무효인 특성만 비운다', async () => {
    const waveLoading = deferred<PokemonFilteredOptions>()
    listPokemonFilteredOptions.mockImplementation(
      (_client: unknown, _speciesId: string, formId: string) => formId === 'form-wave'
        ? waveLoading.promise
        : Promise.resolve(baseOptions),
    )
    const user = userEvent.setup()
    render(<PokemonDetailEditor initialPokemon={pokemon()} options={options} dex={134} entry={1} />)
    await waitFor(() => expect(screen.getByRole('button', { name: '빠른 수정 저장' })).toBeEnabled())

    await user.click(screen.getByRole('button', { name: '보호 정보 정정 열기' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '정정 저장' })).toBeEnabled())
    await user.selectOptions(screen.getByLabelText('정정 모습'), 'form-wave')
    expect(screen.getByRole('button', { name: '정정 저장' })).toBeDisabled()
    expect(screen.getByText('정정할 모습의 특성을 확인하는 중입니다.')).toBeVisible()

    waveLoading.resolve(waveOptions)
    await user.type(screen.getByLabelText('정정 사유'), '모습 입력 오류를 정정함')
    await waitFor(() => expect(screen.getByRole('button', { name: '정정 저장' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: '정정 저장' }))

    expect(correctOwnedPokemon).toHaveBeenCalledWith(
      expect.anything(),
      'owned-pokemon',
      expect.objectContaining({
        speciesId: 'species-water',
        formId: 'form-wave',
        abilityId: null,
        currentMoves: [{ moveId: 'move-surf' }],
        targetMoves: [{ moveId: 'move-surf', conditionKo: '기술머신 123으로 습득' }],
      }),
      '모습 입력 오류를 정정함',
    )
  })
})
