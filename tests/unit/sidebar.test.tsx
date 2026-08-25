import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Sidebar } from '@/components/app-shell/sidebar'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}))

describe('사이드바', () => {
  it('구현된 메뉴만 링크로 제공하고 미구현 메뉴는 준비 중으로 비활성화한다', () => {
    const { container } = render(<Sidebar />)

    for (const [label, href] of [
      ['대시보드', '/dashboard'],
      ['내 포켓몬', '/my-pokemon'],
      ['새 포켓몬 등록', '/my-pokemon/new'],
      ['능력치 계산', '/stats'],
    ]) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href)
    }

    for (const [label, href] of [
      ['기술 조회', '/moves'],
      ['상성 분석', '/type-analysis'],
      ['진화 공략', '/evolutions'],
    ]) {
      const item = screen.getByText(`${label} · 준비 중`)
      expect(item).toHaveAttribute('aria-disabled', 'true')
      expect(item).not.toHaveAttribute('href')
      expect(screen.queryByRole('link', { name: new RegExp(label) })).not.toBeInTheDocument()
      expect(container.querySelector(`a[href="${href}"]`)).not.toBeInTheDocument()
    }
  })
})
