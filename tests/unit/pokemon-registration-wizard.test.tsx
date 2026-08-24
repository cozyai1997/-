import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PokemonRegistrationWizard } from '@/components/forms/pokemon-registration-wizard'
import type {
  OwnedPokemonEditOptions,
  PokemonFilteredOptions,
} from '@/features/owned-pokemon/repository'
import {
  createRegistrationDraft,
  registrationDraftKey,
} from '@/features/owned-pokemon/registration-state'

const {
  replace,
  refresh,
  listOwnedPokemonEditOptions,
  listPokemonFilteredOptions,
  createOwnedPokemon,
  refreshSession,
} = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  listOwnedPokemonEditOptions: vi.fn(),
  listPokemonFilteredOptions: vi.fn(),
  createOwnedPokemon: vi.fn(),
  refreshSession: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser: vi.fn(), refreshSession } }),
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
  natures: [{ id: 'nature-jolly', nameKo: '명랑', increasedStat: 'speed', decreasedStat: 'special_attack' }],
  abilities: [
    { id: 'ability-water', nameKo: '저수' },
    { id: 'ability-electric', nameKo: '축전' },
  ],
  items: [{ id: 'item-water', nameKo: '신비의물방울' }],
}

const standardBattle = {
  baseStats: { hp: 65, attack: 65, defense: 60, special_attack: 110, special_defense: 95, speed: 130 },
  hpRule: 'standard' as const,
  teraTypes: [{ id: 'tera-water', nameKo: '물' }],
  canGigantamax: false,
}

const waterOptions: PokemonFilteredOptions = {
  abilities: [{
    id: 'ability-water',
    nameKo: '저수',
    descriptionKo: '물 타입 기술을 받으면 회복한다.',
    isHidden: true,
  }],
  moves: [
    {
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
    },
    {
      id: 'move-ice-beam',
      nameKo: '냉동빔',
      descriptionKo: '차가운 광선으로 상대를 공격한다.',
      typeKo: '얼음',
      damageClassKo: '특수',
      power: 90,
      accuracy: 100,
      pp: 10,
      routes: [{ methodKo: '기술머신', conditionKo: '기술머신 135로 습득' }],
    },
  ],
  battle: standardBattle,
}

const waveOptions: PokemonFilteredOptions = {
  abilities: [{
    id: 'ability-wave',
    nameKo: '촉촉바디',
    descriptionKo: '비가 오면 상태 이상을 회복한다.',
    isHidden: false,
  }],
  moves: waterOptions.moves,
  battle: standardBattle,
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
  battle: standardBattle,
}

describe('포켓몬 등록 필터 선택 UI', () => {
  beforeEach(() => {
    sessionStorage.clear()
    refreshSession.mockResolvedValue({ error: null })
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
    vi.resetAllMocks()
  })

  it('로그인 직후 기준데이터 인증 오류를 세션 갱신 뒤 자동 재시도한다', async () => {
    listOwnedPokemonEditOptions
      .mockRejectedValueOnce(new Error('일시적인 401'))
      .mockResolvedValueOnce(editOptions)

    render(<PokemonRegistrationWizard />)

    expect(await screen.findByRole('option', { name: '샤미드 · 도감번호 #0134' }))
      .toBeInTheDocument()
    expect(screen.getByLabelText('포켓몬 종')).toBeEnabled()
    expect(listOwnedPokemonEditOptions).toHaveBeenCalledTimes(2)
    expect(refreshSession).toHaveBeenCalledTimes(1)
  })

  it('자동 재시도가 모두 실패하면 진행을 막고 수동 다시 불러오기를 제공한다', async () => {
    const user = userEvent.setup()
    listOwnedPokemonEditOptions
      .mockRejectedValueOnce(new Error('첫 실패'))
      .mockRejectedValueOnce(new Error('두 번째 실패'))
      .mockRejectedValueOnce(new Error('세 번째 실패'))
      .mockResolvedValueOnce(editOptions)

    render(<PokemonRegistrationWizard />)

    const retry = await screen.findByRole('button', { name: '기준데이터 다시 불러오기' })
    expect(screen.getByLabelText('포켓몬 종')).toBeDisabled()
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled()
    await user.click(retry)

    expect(await screen.findByRole('option', { name: '샤미드 · 도감번호 #0134' }))
      .toBeInTheDocument()
    expect(screen.getByLabelText('포켓몬 종')).toBeEnabled()
    expect(listOwnedPokemonEditOptions).toHaveBeenCalledTimes(4)
  })

  it('정확한 폼의 한국어 특성과 네 칸씩의 현재·목표 기술만 선택하게 한다', async () => {
    const user = userEvent.setup()
    const view = render(<PokemonRegistrationWizard />)

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

    expect(screen.getByLabelText('현재 기술 2')).toBeDisabled()
    expect(screen.getByLabelText('목표 기술 2')).toBeDisabled()
    await user.selectOptions(screen.getByLabelText('현재 기술 1'), 'move-surf')
    expect(screen.getByLabelText('현재 기술 2')).toBeEnabled()
    expect(screen.getByLabelText('현재 기술 2').querySelector('option[value="move-surf"]'))
      .toBeDisabled()
    await user.selectOptions(screen.getByLabelText('현재 기술 2'), 'move-ice-beam')
    await user.selectOptions(screen.getByLabelText('목표 기술 1'), 'move-surf')
    expect(screen.getByLabelText('목표 기술 2')).toBeEnabled()
    await user.selectOptions(screen.getByLabelText('목표 기술 2'), 'move-ice-beam')
    const route = screen.getByLabelText('목표 습득 방법 1')
    await user.selectOptions(route, '기술머신 123으로 습득')
    expect(screen.getAllByText(/물 · 특수 · 위력 90 · 명중 100 · PP 15/u)).toHaveLength(2)

    await waitFor(() => {
      expect(JSON.parse(sessionStorage.getItem(registrationDraftKey) ?? '{}'))
        .toMatchObject({
          currentMoves: [
            { moveId: 'move-surf' },
            { moveId: 'move-ice-beam' },
          ],
          targetMoves: [
            { moveId: 'move-surf', conditionKo: '기술머신 123으로 습득' },
            { moveId: 'move-ice-beam', conditionKo: '기술머신 135로 습득' },
          ],
        })
    })

    view.unmount()
    render(<PokemonRegistrationWizard />)
    await waitFor(() => {
      expect(screen.getByLabelText('현재 기술 1')).toHaveValue('move-surf')
      expect(screen.getByLabelText('현재 기술 2')).toHaveValue('move-ice-beam')
      expect(screen.getByLabelText('목표 기술 1')).toHaveValue('move-surf')
      expect(screen.getByLabelText('목표 기술 2')).toHaveValue('move-ice-beam')
    })
  })

  it('폼 필터가 성공할 때까지 진행을 막고 유효한 특성과 종별 기술을 유지한다', async () => {
    const user = userEvent.setup()
    let resolveWave: ((value: PokemonFilteredOptions) => void) | undefined
    const retainedWaveOptions: PokemonFilteredOptions = {
      abilities: waterOptions.abilities,
      moves: waterOptions.moves,
      battle: standardBattle,
    }
    sessionStorage.setItem(registrationDraftKey, JSON.stringify({
      ...createRegistrationDraft(),
      speciesId: 'species-water',
      formId: 'form-water',
      abilityId: 'ability-water',
      currentMoves: [{ moveId: 'move-surf' }],
      targetMoves: [{ moveId: 'move-surf', conditionKo: '레벨 40에 습득' }],
    }))
    listPokemonFilteredOptions.mockImplementation(
      (_client: unknown, _speciesId: string, formId: string) => formId === 'form-wave'
        ? new Promise<PokemonFilteredOptions>((resolve) => { resolveWave = resolve })
        : Promise.resolve(waterOptions),
    )
    render(<PokemonRegistrationWizard />)

    const form = await screen.findByLabelText('모습', { exact: true })
    await waitFor(() => expect(screen.getByRole('button', { name: '다음' })).toBeEnabled())
    await user.selectOptions(form, 'form-wave')
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('특성과 기술을 불러오는 중입니다.')

    resolveWave?.(retainedWaveOptions)
    await waitFor(() => expect(screen.getByRole('button', { name: '다음' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: '다음' }))
    await user.click(screen.getByRole('button', { name: '다음' }))
    expect(screen.getByLabelText('특성', { exact: true })).toHaveValue('ability-water')
    await waitFor(() => {
      expect(JSON.parse(sessionStorage.getItem(registrationDraftKey) ?? '{}')).toMatchObject({
        formId: 'form-wave',
        abilityId: 'ability-water',
        currentMoves: [{ moveId: 'move-surf' }],
        targetMoves: [{ moveId: 'move-surf', conditionKo: '레벨 40에 습득' }],
      })
    })
  })

  it('폼 필터 오류 뒤에는 다음 단계와 등록 완료를 활성화하지 않는다', async () => {
    sessionStorage.setItem(registrationDraftKey, JSON.stringify({
      ...createRegistrationDraft(),
      step: 7,
      speciesId: 'species-water',
      formId: 'form-wave',
      abilityId: 'ability-water',
    }))
    listPokemonFilteredOptions.mockRejectedValue(new Error('필터 조회 실패'))
    render(<PokemonRegistrationWizard />)

    const submit = await screen.findByRole('button', { name: '등록 완료' })
    expect(submit).toBeDisabled()
    expect(await screen.findByText(
      '특성과 기술을 불러오지 못했습니다. 종과 모습을 다시 선택해 주세요.',
    )).toBeVisible()
    expect(submit).toBeDisabled()
  })

  it('복원한 v2 초안을 필터 결과와 맞춘 뒤 유효한 기술과 경로만 새로고침까지 유지한다', async () => {
    sessionStorage.setItem(registrationDraftKey, JSON.stringify({
      ...createRegistrationDraft(),
      step: 6,
      speciesId: 'species-water',
      formId: 'form-water',
      abilityId: 'ability-water',
      currentMoves: [
        { moveId: 'move-surf' },
        { moveId: 'move-invalid' },
      ],
      targetMoves: [
        { moveId: 'move-surf', conditionKo: '기술머신 123으로 습득' },
        { moveId: 'move-ice-beam', conditionKo: '조작한 습득 조건' },
      ],
    }))
    const view = render(<PokemonRegistrationWizard />)

    await waitFor(() => {
      expect(JSON.parse(sessionStorage.getItem(registrationDraftKey) ?? '{}')).toMatchObject({
        currentMoves: [{ moveId: 'move-surf' }],
        targetMoves: [{ moveId: 'move-surf', conditionKo: '기술머신 123으로 습득' }],
      })
    })
    expect(screen.getByLabelText('현재 기술 1')).toHaveValue('move-surf')
    expect(screen.getByLabelText('현재 기술 2')).toHaveValue('')
    expect(screen.getByLabelText('목표 기술 1')).toHaveValue('move-surf')
    expect(screen.getByLabelText('목표 기술 2')).toHaveValue('')

    view.unmount()
    render(<PokemonRegistrationWizard />)
    await waitFor(() => {
      expect(screen.getByLabelText('현재 기술 1')).toHaveValue('move-surf')
      expect(screen.getByLabelText('목표 기술 1')).toHaveValue('move-surf')
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
