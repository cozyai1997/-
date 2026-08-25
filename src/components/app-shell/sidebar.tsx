import Link from 'next/link'
import type { Route } from 'next'

import { LogoutButton } from './logout-button'

const navigation = [
  { label: '대시보드', href: '/dashboard' },
  { label: '내 포켓몬', href: '/my-pokemon' },
  { label: '새 포켓몬 등록', href: '/my-pokemon/new' },
  { label: '능력치 계산', href: '/stats' },
  { label: '기술 조회' },
  { label: '상성 분석' },
  { label: '진화 공략' },
] as const

export function Sidebar() {
  return (
    <aside className="sidebar" aria-label="주 메뉴">
      <nav>
        {navigation.map((item) => 'href' in item
          ? <Link key={item.href} href={item.href as Route}>{item.label}</Link>
          : (
              <span key={item.label} className="sidebar-disabled" aria-disabled="true">
                {item.label} · 준비 중
              </span>
            ))}
      </nav>
      <LogoutButton />
    </aside>
  )
}
