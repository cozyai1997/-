import Link from 'next/link'
import type { Route } from 'next'

import { LogoutButton } from './logout-button'

const navigation = [
  ['대시보드', '/dashboard'],
  ['내 포켓몬', '/my-pokemon'],
  ['새 포켓몬 등록', '/my-pokemon/new'],
  ['능력치 계산', '/stats'],
  ['기술 조회', '/moves'],
  ['상성 분석', '/type-analysis'],
  ['진화 공략', '/evolutions'],
] as const

export function Sidebar() {
  return (
    <aside className="sidebar" aria-label="주 메뉴">
      <nav>
        {navigation.map(([label, href]) => <Link key={href} href={href as Route}>{label}</Link>)}
      </nav>
      <LogoutButton />
    </aside>
  )
}
