import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PokemonMoveCard, basicPpLabel } from '@/components/pokemon/pokemon-move-card'
import { PokemonMoveSlot, groupMovesByPrimaryRoute } from '@/components/forms/pokemon-move-slot'
import type { MoveOption } from '@/features/owned-pokemon/repository'

const flamethrower: MoveOption = {
  id: 'move-flamethrower-internal-id',
  nameKo: '화염방사',
  descriptionKo: '강한 불꽃을 발사하여 공격한다.',
  typeKo: '불꽃',
  damageClassKo: '특수',
  power: 90,
  accuracy: 100,
  pp: 15,
  routes: [{ methodKo: '레벨업', conditionKo: '레벨 36에 습득' }],
}

describe('PokemonMoveCard', () => {
  it('기술의 기본 PP를 다른 전투 정보와 함께 표시한다', () => {
    render(<PokemonMoveCard move={flamethrower} />)

    expect(screen.getByRole('article', { name: '화염방사' })).toHaveTextContent('불꽃')
    expect(screen.getByRole('article', { name: '화염방사' })).toHaveTextContent('특수')
    expect(screen.getByText('기본 PP: 15')).toBeVisible()
    expect(basicPpLabel(15)).toBe('기본 PP: 15')
  })

  it('원천 PP가 없으면 값을 추정하지 않고 확인 불가로 표시한다', () => {
    render(<PokemonMoveCard move={{ ...flamethrower, nameKo: '알 수 없는 기술', pp: null }} />)

    expect(screen.getByText('기본 PP: 확인 불가')).toBeVisible()
    expect(basicPpLabel(null)).toBe('기본 PP: 확인 불가')
  })
})

describe('PokemonMoveSlot', () => {
  it('기존 습득 방법 그룹을 유지하면서 선택 기술 상세에 공통 PP 문구를 사용한다', () => {
    const groups = groupMovesByPrimaryRoute([
      flamethrower,
      { ...flamethrower, id: 'move-egg', nameKo: '용의숨결', routes: [{ methodKo: '알 기술', conditionKo: '교배로 습득' }] },
    ])
    expect(groups.map(([methodKo]) => methodKo)).toEqual(['레벨업', '알 기술'])

    render(
      <PokemonMoveSlot
        kind="current"
        slot={0}
        moveId={flamethrower.id}
        moves={[flamethrower]}
        selectedMoveIds={new Set([flamethrower.id])}
        disabled={false}
        onMoveChange={() => undefined}
      />,
    )

    expect(screen.getByRole('group', { name: '레벨업' })).toBeInTheDocument()
    expect(screen.getByText('기본 PP: 15')).toBeVisible()
  })
})
