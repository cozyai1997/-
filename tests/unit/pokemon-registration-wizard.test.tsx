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
  getUser,
} = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  listOwnedPokemonEditOptions: vi.fn(),
  listPokemonFilteredOptions: vi.fn(),
  createOwnedPokemon: vi.fn(),
  refreshSession: vi.fn(),
  getUser: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser, refreshSession } }),
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

const capableBattle = {
  baseStats: { hp: 65, attack: 65, defense: 60, special_attack: 110, special_defense: 95, speed: 130 },
  hpRule: 'standard' as const,
  teraTypes: [{ id: 'tera-water', nameKo: '물' }],
  canGigantamax: true,
}

const ineligibleWaveBattle = {
  ...capableBattle,
  teraTypes: [{ id: 'tera-ice', nameKo: '얼음' }],
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
      pp: null,
      routes: [{ methodKo: '기술머신', conditionKo: '기술머신 135로 습득' }],
    },
  ],
  battle: capableBattle,
}

const waveOptions: PokemonFilteredOptions = {
  abilities: [{
    id: 'ability-wave',
    nameKo: '촉촉바디',
    descriptionKo: '비가 오면 상태 이상을 회복한다.',
    isHidden: false,
  }],
  moves: waterOptions.moves,
  battle: ineligibleWaveBattle,
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
  battle: {
    ...capableBattle,
    teraTypes: [{ id: 'tera-electric', nameKo: '전기' }],
    canGigantamax: false,
  },
}

describe('포켓몬 등록 필터 선택 UI', () => {
  beforeEach(() => {
    sessionStorage.clear()
    refreshSession.mockResolvedValue({ error: null })
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    createOwnedPokemon.mockResolvedValue({ id: 'owned-1' })
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
    expect(screen.getAllByText('기본 PP: 15')).toHaveLength(2)

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

  it('일곱 단계를 거쳐 전투 선택, 능력치, 기술 PP를 확인하고 초안 전체를 등록한다', async () => {
    const user = userEvent.setup()
    render(<PokemonRegistrationWizard />)

    await user.selectOptions(await screen.findByLabelText('포켓몬 종'), 'species-water')
    await waitFor(() => expect(screen.getByRole('button', { name: '다음' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: '다음' }))

    await user.clear(screen.getByLabelText('레벨'))
    await user.type(screen.getByLabelText('레벨'), '50')
    await user.click(screen.getByRole('button', { name: '다음' }))

    await user.selectOptions(screen.getByLabelText('현재 성격'), 'nature-jolly')
    await user.selectOptions(screen.getByLabelText('특성', { exact: true }), 'ability-water')
    const teraType = screen.getByRole('combobox', { name: '테라타입' })
    expect(screen.getAllByRole('option', { name: '물' })).toHaveLength(1)
    expect(screen.queryByText('tera-water')).not.toBeInTheDocument()
    await user.selectOptions(teraType, 'tera-water')
    const gigantamax = screen.getByRole('checkbox', { name: '거다이맥스 인자 보유' })
    expect(gigantamax).toBeEnabled()
    expect(screen.getByText('거다이맥스 가능')).toBeVisible()
    await user.click(gigantamax)
    await user.click(screen.getByRole('button', { name: '다음' }))

    expect(screen.getByText('종족값 Base Stats')).toBeVisible()
    expect(screen.getByText('그 포켓몬 종과 폼 자체가 가진 기본 능력치')).toBeVisible()
    expect(screen.getByText('개체값 IV')).toBeVisible()
    expect(screen.getByText('태어날 때 정해지는 0~31 수치')).toBeVisible()
    expect(screen.getByText('노력치 EV')).toBeVisible()
    expect(screen.getByText('전투나 아이템으로 올리는 훈련 수치, 능력치당 최대 252')).toBeVisible()
    expect(screen.getByText('실제 능력치 Stats')).toBeVisible()
    expect(screen.getByText('현재 레벨에서 실제 전투에 적용되는 HP·공격·방어·특공·특방·스피드 숫자')).toBeVisible()
    expect(screen.getByLabelText('HP 종족값')).toHaveValue(65)
    expect(screen.getByLabelText('HP 종족값')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('원본 HP IV')).toBeEnabled()
    expect(screen.getByLabelText('실전 HP IV')).toBeEnabled()
    await user.clear(screen.getByLabelText('실전 스피드 IV'))
    await user.type(screen.getByLabelText('실전 스피드 IV'), '31')
    await user.click(screen.getByRole('button', { name: '다음' }))

    await user.clear(screen.getByLabelText('스피드 EV'))
    await user.type(screen.getByLabelText('스피드 EV'), '252')
    const liveStats = screen.getByRole('table', { name: '등록 중 능력치' })
    expect(liveStats).toHaveTextContent('종족값 Base Stats')
    expect(screen.getByRole('rowheader', { name: '스피드' }).closest('tr'))
      .toHaveTextContent('스피드130031252200')
    await user.click(screen.getByRole('button', { name: '다음' }))

    await user.selectOptions(screen.getByLabelText('현재 기술 1'), 'move-surf')
    await user.selectOptions(screen.getByLabelText('목표 기술 1'), 'move-ice-beam')
    expect(screen.getByRole('article', { name: '파도타기' })).toHaveTextContent('기본 PP: 15')
    expect(screen.getByRole('article', { name: '냉동빔' })).toHaveTextContent('기본 PP: 확인 불가')
    await user.click(screen.getByRole('button', { name: '다음' }))

    expect(screen.getByText('테라타입: 물')).toBeVisible()
    expect(screen.getByText('거다이맥스 가능')).toBeVisible()
    expect(screen.getByRole('table', { name: '최종 능력치' })).toBeVisible()
    expect(screen.getByRole('article', { name: '파도타기' })).toHaveTextContent('현재 기술 1')
    expect(screen.getByRole('article', { name: '파도타기' })).toHaveTextContent('기본 PP: 15')
    expect(screen.getByRole('article', { name: '냉동빔' })).toHaveTextContent('목표 기술 1')
    expect(screen.getByRole('article', { name: '냉동빔' })).toHaveTextContent('기본 PP: 확인 불가')

    await user.click(screen.getByRole('button', { name: '등록 완료' }))
    await waitFor(() => expect(createOwnedPokemon).toHaveBeenCalledTimes(1))
    expect(createOwnedPokemon.mock.calls[0]?.[1]).toEqual({
      step: 7,
      speciesId: 'species-water',
      formId: 'form-water',
      nickname: null,
      gender: 'genderless',
      level: 50,
      capturedOn: null,
      originalNatureId: null,
      effectiveNatureId: 'nature-jolly',
      abilityId: 'ability-water',
      originalIv: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
      effectiveIv: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 31 },
      ev: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 252 },
      heldItemId: null,
      notes: '',
      teraTypeId: 'tera-water',
      hasGigantamaxFactor: true,
      currentMoves: [{ moveId: 'move-surf' }],
      targetMoves: [{ moveId: 'move-ice-beam', conditionKo: '기술머신 135로 습득' }],
    })
    expect(replace).toHaveBeenCalledWith('/my-pokemon')
  })

  it('폼 필터가 성공할 때까지 진행을 막고 유효한 특성과 종별 기술을 유지한다', async () => {
    const user = userEvent.setup()
    let resolveWave: ((value: PokemonFilteredOptions) => void) | undefined
    const retainedWaveOptions: PokemonFilteredOptions = {
      abilities: waterOptions.abilities,
      moves: waterOptions.moves,
      battle: ineligibleWaveBattle,
    }
    sessionStorage.setItem(registrationDraftKey, JSON.stringify({
      ...createRegistrationDraft(),
      speciesId: 'species-water',
      formId: 'form-water',
      abilityId: 'ability-water',
      currentMoves: [{ moveId: 'move-surf' }],
      targetMoves: [{ moveId: 'move-surf', conditionKo: '레벨 40에 습득' }],
      teraTypeId: 'tera-water',
      hasGigantamaxFactor: true,
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
    expect(screen.getByRole('status')).toHaveTextContent(
      '특성·기술·테라타입·거다이맥스 정보를 불러오는 중입니다.',
    )

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
        teraTypeId: null,
        hasGigantamaxFactor: false,
      })
    })
    expect(screen.getByRole('combobox', { name: '테라타입' })).toHaveValue('')
    expect(screen.getByRole('option', { name: '얼음' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: '거다이맥스 인자 보유' })).toBeDisabled()
    expect(screen.getByText('거다이맥스 불가능')).toBeVisible()
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
      '특성·기술·테라타입·거다이맥스 정보를 불러오지 못했습니다. 종과 모습을 다시 선택해 주세요.',
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
    expect(screen.getByRole('option', { name: '얼음' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '물' })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: '거다이맥스 인자 보유' })).toBeDisabled()
  })

  it('선택한 현재 성격이 기준데이터에서 누락되면 중립으로 추정하지 않는다', async () => {
    sessionStorage.setItem(registrationDraftKey, JSON.stringify({
      ...createRegistrationDraft(),
      step: 5,
      speciesId: 'species-water',
      formId: 'form-water',
      effectiveNatureId: 'nature-missing',
    }))
    render(<PokemonRegistrationWizard />)

    expect(await screen.findByText(
      '계산 불가: 성격 보정 정보가 불완전하여 실제 능력치를 계산할 수 없습니다.',
    )).toBeVisible()
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
    expect(await screen.findByRole('status')).toHaveTextContent(
      '특성·기술·테라타입·거다이맥스 정보를 불러오는 중입니다.',
    )
    await user.selectOptions(species, 'species-electric')
    await waitFor(() => expect(listPokemonFilteredOptions).toHaveBeenCalledTimes(2))
    resolveWater?.(waterOptions)
    await user.click(screen.getByRole('button', { name: '다음' }))
    await user.click(screen.getByRole('button', { name: '다음' }))

    expect(await screen.findByRole('option', { name: '축전' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /저수/u })).not.toBeInTheDocument()
  })
})
