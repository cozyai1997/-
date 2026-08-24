import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PokemonBattleBadges } from '@/components/pokemon/pokemon-battle-badges'
import { PokemonBattleFields } from '@/components/pokemon/pokemon-battle-fields'

const teraTypes = [
  { id: 'type-fire-internal-id', nameKo: '불꽃' },
  { id: 'type-water-internal-id', nameKo: '물' },
]

describe('PokemonBattleFields', () => {
  it('선택한 폼에서 공급된 한국어 테라타입만 고를 수 있다', async () => {
    const onTeraTypeChange = vi.fn()
    const user = userEvent.setup()

    render(
      <PokemonBattleFields
        teraTypes={teraTypes}
        teraTypeId={null}
        canGigantamax
        hasGigantamaxFactor={false}
        onTeraTypeChange={onTeraTypeChange}
        onGigantamaxFactorChange={vi.fn()}
      />,
    )

    const select = screen.getByRole('combobox', { name: '테라타입' })
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      '미지정', '불꽃', '물',
    ])
    expect(screen.queryByRole('option', { name: '전기' })).not.toBeInTheDocument()
    expect(screen.queryByText('type-fire-internal-id')).not.toBeInTheDocument()

    await user.selectOptions(select, 'type-water-internal-id')
    expect(onTeraTypeChange).toHaveBeenCalledWith('type-water-internal-id')
  })

  it('거다이맥스가 불가능한 폼은 체크박스를 비활성화하고 기존 선택을 해제한다', async () => {
    const onGigantamaxFactorChange = vi.fn()

    render(
      <PokemonBattleFields
        teraTypes={teraTypes}
        teraTypeId="type-fire-internal-id"
        canGigantamax={false}
        hasGigantamaxFactor
        onTeraTypeChange={vi.fn()}
        onGigantamaxFactorChange={onGigantamaxFactorChange}
      />,
    )

    const checkbox = screen.getByRole('checkbox', { name: '거다이맥스 인자 보유' })
    expect(checkbox).toBeDisabled()
    expect(checkbox).not.toBeChecked()
    expect(screen.getByText('거다이맥스 불가능')).toBeVisible()
    await waitFor(() => expect(onGigantamaxFactorChange).toHaveBeenCalledWith(false))
  })

  it('외부 로딩 중에는 선택을 보존하고 성공한 비적격 프로필에서만 해제한다', async () => {
    const onGigantamaxFactorChange = vi.fn()
    const view = render(
      <PokemonBattleFields
        teraTypes={[]}
        teraTypeId="type-fire-internal-id"
        canGigantamax={false}
        hasGigantamaxFactor
        disabled
        onTeraTypeChange={vi.fn()}
        onGigantamaxFactorChange={onGigantamaxFactorChange}
      />,
    )

    expect(onGigantamaxFactorChange).not.toHaveBeenCalled()

    view.rerender(
      <PokemonBattleFields
        teraTypes={teraTypes}
        teraTypeId="type-fire-internal-id"
        canGigantamax={false}
        hasGigantamaxFactor
        disabled={false}
        onTeraTypeChange={vi.fn()}
        onGigantamaxFactorChange={onGigantamaxFactorChange}
      />,
    )

    const checkbox = screen.getByRole('checkbox', { name: '거다이맥스 인자 보유' })
    expect(checkbox).toBeDisabled()
    expect(checkbox).not.toBeChecked()
    await waitFor(() => expect(onGigantamaxFactorChange).toHaveBeenCalledWith(false))
  })
})

describe('PokemonBattleBadges', () => {
  it('배지는 한국어 표시명과 상태만 렌더링하고 내부 ID를 노출하지 않는다', () => {
    render(
      <PokemonBattleBadges
        teraTypeNameKo="불꽃"
        hasGigantamaxFactor
      />,
    )

    expect(screen.getByText('테라타입: 불꽃')).toBeVisible()
    expect(screen.getByText('거다이맥스 인자 보유')).toBeVisible()
    expect(screen.queryByText(/internal|type-fire|uuid/i)).not.toBeInTheDocument()
  })

  it('저장된 false 값은 가능성 대신 인자 없음 상태로 표시한다', () => {
    render(
      <PokemonBattleBadges
        teraTypeNameKo={null}
        hasGigantamaxFactor={false}
      />,
    )

    expect(screen.getByText('거다이맥스 인자 없음')).toBeVisible()
    expect(screen.queryByText('거다이맥스 불가능')).not.toBeInTheDocument()
  })
})
