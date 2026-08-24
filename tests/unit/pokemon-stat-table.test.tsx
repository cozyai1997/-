import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PokemonStatTable } from '@/components/pokemon/pokemon-stat-table'
import { StatGlossary } from '@/components/pokemon/stat-glossary'
import type { StatBlock } from '@/features/stats/types'

const originalIv: StatBlock = {
  hp: 31,
  attack: 30,
  defense: 29,
  special_attack: 28,
  special_defense: 27,
  speed: 26,
}

const effectiveIv: StatBlock = {
  ...originalIv,
  attack: 31,
  speed: 31,
}

const ev: StatBlock = {
  hp: 4,
  attack: 252,
  defense: 0,
  special_attack: 0,
  special_defense: 0,
  speed: 252,
}

const baseStats: StatBlock = {
  hp: 70,
  attack: 110,
  defense: 70,
  special_attack: 115,
  special_defense: 70,
  speed: 90,
}

describe('StatGlossary', () => {
  it('네 가지 전투 능력치 용어를 승인된 한국어 정의로 설명한다', () => {
    const { container } = render(<StatGlossary />)
    const glossary = container.querySelector('dl')

    expect(glossary).not.toBeNull()
    expect(within(glossary as HTMLElement).getByText('종족값 Base Stats')).toBeVisible()
    expect(within(glossary as HTMLElement).getByText('그 포켓몬 종과 폼 자체가 가진 기본 능력치')).toBeVisible()
    expect(within(glossary as HTMLElement).getByText('개체값 IV')).toBeVisible()
    expect(within(glossary as HTMLElement).getByText('태어날 때 정해지는 0~31 수치')).toBeVisible()
    expect(within(glossary as HTMLElement).getByText('노력치 EV')).toBeVisible()
    expect(within(glossary as HTMLElement).getByText('전투나 아이템으로 올리는 훈련 수치, 능력치당 최대 252')).toBeVisible()
    expect(within(glossary as HTMLElement).getByText('실제 능력치 Stats')).toBeVisible()
    expect(within(glossary as HTMLElement).getByText('현재 레벨에서 실제 전투에 적용되는 HP·공격·방어·특공·특방·스피드 숫자')).toBeVisible()
  })
})

describe('PokemonStatTable', () => {
  it('여섯 능력치에 종족값·원본 IV·실전 IV·EV·실제 능력치 열을 표시한다', () => {
    render(
      <PokemonStatTable
        baseStats={baseStats}
        originalIv={originalIv}
        effectiveIv={effectiveIv}
        ev={ev}
        actualStats={{
          status: 'ready',
          stats: {
            hp: 146,
            attack: 162,
            defense: 89,
            special_attack: 135,
            special_defense: 86,
            speed: 156,
          },
        }}
        caption="보유 포켓몬 능력치"
      />,
    )

    const table = screen.getByRole('table', { name: '보유 포켓몬 능력치' })
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      '능력치',
      '종족값 Base Stats',
      '원본 IV',
      '실전 IV',
      '노력치 EV',
      '실제 능력치 Stats',
    ])
    expect(within(table).getAllByRole('rowheader').map((cell) => cell.textContent)).toEqual([
      'HP', '공격', '방어', '특공', '특방', '스피드',
    ])
    expect(within(table).getByRole('rowheader', { name: '공격' }).closest('tr')).toHaveTextContent(
      '공격1103031252162',
    )
  })

  it('실제 능력치를 계산할 수 없으면 숫자를 만들지 않고 한국어 사유를 한 번 표시한다', () => {
    render(
      <PokemonStatTable
        baseStats={null}
        originalIv={originalIv}
        effectiveIv={effectiveIv}
        ev={ev}
        actualStats={{ status: 'unavailable', reasonKo: '종족값 정보가 없습니다.' }}
        caption="계산 불가 능력치"
      />,
    )

    const table = screen.getByRole('table', { name: '계산 불가 능력치' })
    const unavailable = within(table).getByText('계산 불가: 종족값 정보가 없습니다.')
    expect(unavailable).toBeVisible()
    expect(unavailable).toHaveAttribute('rowspan', '6')
    expect(within(table).getAllByText('확인 불가')).toHaveLength(6)
    expect(within(table).getAllByText(/계산 불가:/)).toHaveLength(1)
  })
})
