import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { StatsCalculator } from '@/components/pokemon/stats-calculator'

describe('수동 능력치 계산기', () => {
  it('승인된 네 용어 정의와 실제 능력치 열을 표시한다', () => {
    render(<StatsCalculator />)

    const glossary = screen.getByText('종족값 Base Stats', { selector: 'dt' }).closest('dl')
    expect(glossary).not.toBeNull()
    expect(within(glossary!).getByText('개체값 IV (원본)')).toBeVisible()
    expect(within(glossary!).getByText('그 포켓몬 종과 폼 자체가 가진 기본 능력치')).toBeVisible()
    expect(within(glossary!).getByText('태어날 때 정해지는 0~31 수치')).toBeVisible()
    expect(within(glossary!).getByText('전투나 아이템으로 올리는 훈련 수치, 능력치당 최대 252')).toBeVisible()
    expect(within(glossary!).getByText('현재 레벨에서 실제 전투에 적용되는 HP·공격·방어·특공·특방·스피드 숫자')).toBeVisible()
    expect(screen.getByLabelText('HP 적용 IV (왕관 보정 포함)')).toBeVisible()
    expect(screen.getByRole('columnheader', { name: '적용 IV (왕관 보정 포함)' })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: '실제 능력치 Stats' })).toBeVisible()
    expect(screen.queryByRole('columnheader', { name: '최종' })).not.toBeInTheDocument()
  })

  it('일반과 껍질몬 HP 규칙을 선택해 루카리오 예시 HP를 정확히 계산한다', async () => {
    const user = userEvent.setup()
    render(<StatsCalculator />)

    const hpRule = screen.getByLabelText('HP 계산 규칙')
    expect(hpRule).toHaveValue('standard')
    expect(within(hpRule).getByRole('option', { name: '일반' })).toHaveValue('standard')
    expect(within(hpRule).getByRole('option', { name: '껍질몬(HP는 항상 1)' })).toHaveValue('fixed-one')
    expect(screen.getByRole('row', { name: /HP/ })).toHaveTextContent('145')

    await user.selectOptions(hpRule, 'fixed-one')
    await user.click(screen.getByRole('button', { name: '능력치 계산하기' }))
    expect(screen.getByRole('row', { name: /HP/ })).toHaveTextContent('1')
    expect(screen.getByRole('row', { name: /^공격 / })).toHaveTextContent('130')
  })
})
