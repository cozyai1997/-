import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

import './globals.css'

export const metadata: Metadata = {
  title: {
    default: '포켓몬 트레이너 매니저',
    template: '%s | 포켓몬 트레이너 매니저',
  },
  description: '비공식 Cobbleverse 호환 포켓몬 육성 관리 도구',
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#08111f',
  width: 'device-width',
  initialScale: 1,
}

type RootLayoutProps = Readonly<{
  children: ReactNode
}>

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ko">
      <body>
        <header className="root-header">
          <span className="brand-mark" aria-hidden="true">
            P
          </span>
          <span className="root-brand">포켓몬 트레이너 매니저</span>
          <span className="unofficial-label">비공식 Cobbleverse 호환 관리 도구</span>
        </header>
        {children}
      </body>
    </html>
  )
}

