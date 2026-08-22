import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import RootLayout from '@/app/layout'

describe('루트 앱 셸', () => {
  it('한국어 앱 이름과 문서 언어를 렌더링한다', () => {
    render(
      <RootLayout>
        <main />
      </RootLayout>,
    )

    expect(screen.getByText('포켓몬 트레이너 매니저')).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('ko')
  })
})
