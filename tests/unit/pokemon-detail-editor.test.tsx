import { render, screen, waitFor, within } from '@testing-library/react'
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
  natures: [{ id: 'nature-jolly', nameKo: '명랑', increasedStat: 'speed', decreasedStat: 'special_attack' }],
  abilities: [
    { id: 'ability-water', nameKo: '저수' },
    { id: 'ability-wave', nameKo: '촉촉바디' },
    { id: 'ability-global-only', nameKo: '전역 전용 특성' },
  ],
  items: [{ id: 'item-water', nameKo: '신비의물방울' }],
}

const standardBattle = {
  baseStats: { hp: 65, attack: 65, defense: 60, special_attack: 110, special_defense: 95, speed: 130 },
  hpRule: 'standard' as const,
  teraTypes: [{ id: 'tera-water', nameKo: '물' }],
  canGigantamax: false,
}

const eligibleBattle = {
  ...standardBattle,
  teraTypes: [
    { id: 'tera-water', nameKo: '물' },
    { id: 'tera-fire', nameKo: '불꽃' },
  ],
  canGigantamax: true,
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
  battle: standardBattle,
}

const waveOptions: PokemonFilteredOptions = {
  abilities: [{
    id: 'ability-wave',
    nameKo: '촉촉바디',
    descriptionKo: '비가 오면 상태 이상을 회복한다.',
    isHidden: false,
  }],
  moves: baseOptions.moves,
  battle: standardBattle,
}

const electricOptions: PokemonFilteredOptions = {
  abilities: [],
  moves: [],
  battle: standardBattle,
}

const eligibleOptions: PokemonFilteredOptions = {
  ...baseOptions,
  battle: eligibleBattle,
}

const waveIneligibleOptions: PokemonFilteredOptions = {
  ...waveOptions,
  battle: {
    ...standardBattle,
    teraTypes: [{ id: 'tera-fire', nameKo: '불꽃' }],
  },
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
    teraTypeNameKo: null,
    battle: standardBattle,
    currentMoveDetails: [],
    targetMoveDetails: [],
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

  it('등록 필터가 거부하는 과거 배틀 전용 폼도 저장된 프로필로 능력치를 표시한다', async () => {
    listPokemonFilteredOptions.mockRejectedValueOnce(new Error('배틀 전용 폼은 등록할 수 없음'))
    render(<PokemonDetailEditor
      initialPokemon={pokemon({ battle: standardBattle })}
      options={options}
      dex={134}
      entry={1}
    />)

    expect(await screen.findByText('빠른 수정 특성을 불러오지 못했습니다. 다시 시도해 주세요.'))
      .toBeVisible()
    expect(screen.getByRole('button', { name: '빠른 수정 저장' })).toBeDisabled()
    const table = screen.getByRole('table', { name: '보유 포켓몬 능력치' })
    expect(within(table).getByRole('row', { name: /HP/ })).toHaveTextContent('65')
    expect(within(table).getByRole('row', { name: /HP/ })).toHaveTextContent('148')
    expect(within(table).queryByText(/계산 불가/)).not.toBeInTheDocument()
  })

  it('최신 폼 프로필로 다섯 전투 수치 열과 현재·목표 기술의 기본 PP를 표시한다', async () => {
    const historicalBattle = {
      ...eligibleBattle,
      baseStats: { hp: 1, attack: 1, defense: 1, special_attack: 1, special_defense: 1, speed: 1 },
      teraTypes: [{ id: 'tera-historical', nameKo: '과거 타입' }],
    }
    render(<PokemonDetailEditor
      initialPokemon={pokemon({
        effectiveNatureId: 'nature-jolly',
        teraTypeId: 'tera-water',
        teraTypeNameKo: '물',
        hasGigantamaxFactor: true,
        battle: historicalBattle,
        currentMoveDetails: [{
          moveId: 'move-surf',
          slot: 1,
          nameKo: '파도타기',
          descriptionKo: '큰 파도로 상대를 공격한다.',
          typeKo: '물',
          damageClassKo: '특수',
          power: 90,
          accuracy: 100,
          pp: 15,
          conditionKo: null,
        }],
        targetMoveDetails: [{
          moveId: 'move-wish',
          slot: 1,
          nameKo: '희망사항',
          descriptionKo: '다음 턴에 HP를 회복한다.',
          typeKo: '노말',
          damageClassKo: '변화',
          power: null,
          accuracy: null,
          pp: null,
          conditionKo: '알 기술로 습득',
        }],
      })}
      options={options}
      dex={134}
      entry={1}
    />)

    expect(within(screen.getByLabelText('저장된 전투 설정')).getByText('테라타입: 물')).toBeVisible()
    expect(within(screen.getByLabelText('저장된 전투 설정')).getByText('거다이맥스 인자 보유')).toBeVisible()
    expect(screen.getByRole('heading', { name: '적용 IV (왕관 보정 포함)' })).toBeVisible()

    const table = screen.getByRole('table', { name: '보유 포켓몬 능력치' })
    for (const heading of [
      '종족값 Base Stats',
      '개체값 IV (원본)',
      '적용 IV (왕관 보정 포함)',
      '노력치 EV',
      '실제 능력치 Stats',
    ]) {
      expect(within(table).getByRole('columnheader', { name: heading })).toBeVisible()
    }
    await waitFor(() => expect(within(table).getByRole('row', { name: /HP/ })).toHaveTextContent('65'))
    expect(within(table).queryByText('1')).not.toBeInTheDocument()

    const currentMove = screen.getByRole('article', { name: '파도타기' })
    expect(within(currentMove).getByText('현재 기술 1')).toBeVisible()
    expect(within(currentMove).getByText('기본 PP: 15')).toBeVisible()
    const targetMove = screen.getByRole('article', { name: '희망사항' })
    expect(within(targetMove).getByText('목표 기술 1')).toBeVisible()
    expect(within(targetMove).getByText('기본 PP: 확인 불가')).toBeVisible()
    expect(within(targetMove).getByText('습득 조건: 알 기술로 습득')).toBeVisible()
    expect(screen.queryByText('tera-water')).not.toBeInTheDocument()
  })

  it('현재 성격 미지정은 중립 보정으로 실제 능력치를 계산한다', async () => {
    render(<PokemonDetailEditor initialPokemon={pokemon()} options={options} dex={134} entry={1} />)

    const table = screen.getByRole('table', { name: '보유 포켓몬 능력치' })
    await waitFor(() => expect(within(table).getByRole('row', { name: /HP/ })).toHaveTextContent('148'))
    expect(within(table).queryByText(/계산 불가/)).not.toBeInTheDocument()
  })

  it.each([
    ['선택한 성격이 기준데이터에 없음', options],
    ['선택한 성격 보정이 불완전함', {
      ...options,
      natures: [{ id: 'nature-missing', nameKo: '불완전', increasedStat: 'speed' }],
    } as unknown as OwnedPokemonEditOptions],
    ['선택한 성격 보정 중 한쪽만 null', {
      ...options,
      natures: [{
        id: 'nature-missing',
        nameKo: '반쪽 보정',
        increasedStat: 'speed',
        decreasedStat: null,
      }],
    } satisfies OwnedPokemonEditOptions],
  ])('%s이면 값을 추정하지 않는다', async (_caseName, editOptions) => {
    render(<PokemonDetailEditor
      initialPokemon={pokemon({ effectiveNatureId: 'nature-missing' })}
      options={editOptions}
      dex={134}
      entry={1}
    />)

    expect(await screen.findByText(
      '계산 불가: 성격 보정 정보가 불완전하여 실제 능력치를 계산할 수 없습니다.',
    )).toBeVisible()
  })

  it('빠른 수정은 테라타입과 거다이맥스 인자를 저장하고 저장된 헤더 배지를 갱신한다', async () => {
    listPokemonFilteredOptions.mockResolvedValueOnce(eligibleOptions)
    updateOwnedPokemonQuick.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    render(<PokemonDetailEditor initialPokemon={pokemon()} options={options} dex={134} entry={1} />)

    const teraType = await screen.findByLabelText('테라타입')
    await user.selectOptions(teraType, 'tera-water')
    await user.click(screen.getByLabelText('거다이맥스 인자 보유'))
    await user.click(screen.getByRole('button', { name: '빠른 수정 저장' }))

    expect(updateOwnedPokemonQuick).toHaveBeenCalledWith(
      expect.anything(),
      'owned-pokemon',
      expect.objectContaining({
        teraTypeId: 'tera-water',
        hasGigantamaxFactor: true,
      }),
    )
    const savedBattle = screen.getByLabelText('저장된 전투 설정')
    expect(within(savedBattle).getByText('테라타입: 물')).toBeVisible()
    expect(within(savedBattle).getByText('거다이맥스 인자 보유')).toBeVisible()
  })

  it('최신 성공 프로필이 불가능하면 로딩 중 인자를 보존했다가 비활성화하고 해제한다', async () => {
    const loading = deferred<PokemonFilteredOptions>()
    listPokemonFilteredOptions.mockReturnValueOnce(loading.promise)
    const view = render(<PokemonDetailEditor
      initialPokemon={pokemon({
        battle: eligibleBattle,
        teraTypeId: 'tera-water',
        hasGigantamaxFactor: true,
      })}
      options={options}
      dex={134}
      entry={1}
    />)

    expect(screen.queryByLabelText('거다이맥스 인자 보유')).not.toBeInTheDocument()
    loading.resolve(baseOptions)
    const checkbox = await screen.findByLabelText('거다이맥스 인자 보유')
    await waitFor(() => expect(checkbox).not.toBeChecked())
    expect(checkbox).toBeDisabled()

    await userEvent.setup().click(screen.getByRole('button', { name: '빠른 수정 저장' }))
    expect(updateOwnedPokemonQuick).toHaveBeenCalledWith(
      expect.anything(),
      'owned-pokemon',
      expect.objectContaining({ hasGigantamaxFactor: false }),
    )
    view.unmount()
  })

  it('로딩 중인 빠른 필터는 선택을 지우지 않고 최신 성공 프로필이 허용하면 그대로 표시한다', async () => {
    const loading = deferred<PokemonFilteredOptions>()
    listPokemonFilteredOptions.mockReturnValueOnce(loading.promise)
    render(<PokemonDetailEditor
      initialPokemon={pokemon({
        battle: eligibleBattle,
        teraTypeId: 'tera-water',
        hasGigantamaxFactor: true,
      })}
      options={options}
      dex={134}
      entry={1}
    />)

    expect(screen.queryByLabelText('거다이맥스 인자 보유')).not.toBeInTheDocument()
    loading.resolve(eligibleOptions)
    const checkbox = await screen.findByLabelText('거다이맥스 인자 보유')
    expect(checkbox).toBeChecked()
    expect(checkbox).toBeEnabled()
    expect(screen.getByLabelText('테라타입')).toHaveValue('tera-water')
  })

  it('종 정정 이벤트는 서버와 같이 특성과 모든 기술 선택을 즉시 비운다', async () => {
    const user = userEvent.setup()
    render(<PokemonDetailEditor initialPokemon={pokemon()} options={options} dex={134} entry={1} />)
    await waitFor(() => expect(screen.getByRole('button', { name: '빠른 수정 저장' })).toBeEnabled())

    await user.click(screen.getByRole('button', { name: '보호 정보 정정 열기' }))
    expect(screen.getByLabelText('HP 개체값 IV (원본)')).toBeVisible()
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

  it('폼 정정은 최신 프로필로 전투 선택을 정합화하되 정정 RPC 계약은 그대로 사용한다', async () => {
    listPokemonFilteredOptions.mockImplementation(
      async (_client: unknown, _speciesId: string, formId: string) => formId === 'form-wave'
        ? waveIneligibleOptions
        : eligibleOptions,
    )
    const user = userEvent.setup()
    render(<PokemonDetailEditor
      initialPokemon={pokemon({
        battle: eligibleBattle,
        teraTypeId: 'tera-water',
        teraTypeNameKo: '물',
        hasGigantamaxFactor: true,
      })}
      options={options}
      dex={134}
      entry={1}
    />)
    await waitFor(() => expect(screen.getByRole('button', { name: '빠른 수정 저장' })).toBeEnabled())

    await user.click(screen.getByRole('button', { name: '보호 정보 정정 열기' }))
    await user.selectOptions(screen.getByLabelText('정정 모습'), 'form-wave')
    await user.type(screen.getByLabelText('정정 사유'), '전투 폼 입력 오류 정정')
    await waitFor(() => expect(screen.getByRole('button', { name: '정정 저장' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: '정정 저장' }))

    expect(correctOwnedPokemon).toHaveBeenCalledWith(
      expect.anything(),
      'owned-pokemon',
      expect.objectContaining({
        formId: 'form-wave',
        teraTypeId: null,
        hasGigantamaxFactor: false,
      }),
      '전투 폼 입력 오류 정정',
    )
  })

  it('동일 폼 보호 정정 뒤에는 RPC가 저장하지 않은 전투 정합화를 저장값처럼 표시하지 않는다', async () => {
    listPokemonFilteredOptions.mockResolvedValue(waveIneligibleOptions)
    const persisted = pokemon({
      battle: eligibleBattle,
      teraTypeId: 'tera-water',
      teraTypeNameKo: '물',
      hasGigantamaxFactor: true,
    })
    let persistedAfterCorrection = persisted
    correctOwnedPokemon.mockImplementationOnce(async (
      _client: unknown,
      _pokemonId: string,
      correction: OwnedPokemonDetail,
    ) => {
      persistedAfterCorrection = {
        ...persisted,
        capturedOn: correction.capturedOn,
        originalIv: correction.originalIv,
      }
    })
    const user = userEvent.setup()
    const view = render(<PokemonDetailEditor
      initialPokemon={persisted}
      options={options}
      dex={134}
      entry={1}
    />)
    await waitFor(() => expect(screen.getByRole('button', { name: '빠른 수정 저장' })).toBeEnabled())

    await user.click(screen.getByRole('button', { name: '보호 정보 정정 열기' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '정정 저장' })).toBeEnabled())
    await user.type(screen.getByLabelText('정정 사유'), '포획일 입력 오류 정정')
    await user.click(screen.getByRole('button', { name: '정정 저장' }))

    await screen.findByText('보호 정보를 정정하고 변경 이력을 보존했습니다.')
    let savedBattle = screen.getByLabelText('저장된 전투 설정')
    expect(within(savedBattle).getByText('테라타입: 물')).toBeVisible()
    expect(within(savedBattle).getByText('거다이맥스 인자 보유')).toBeVisible()

    view.unmount()
    render(<PokemonDetailEditor
      initialPokemon={persistedAfterCorrection}
      options={options}
      dex={134}
      entry={1}
    />)
    await waitFor(() => expect(screen.getByRole('button', { name: '빠른 수정 저장' })).toBeEnabled())
    savedBattle = screen.getByLabelText('저장된 전투 설정')
    expect(within(savedBattle).getByText('테라타입: 물')).toBeVisible()
    expect(within(savedBattle).getByText('거다이맥스 인자 보유')).toBeVisible()
    expect(correctOwnedPokemon).toHaveBeenCalledWith(
      expect.anything(),
      'owned-pokemon',
      expect.anything(),
      '포획일 입력 오류 정정',
    )
  })
})
