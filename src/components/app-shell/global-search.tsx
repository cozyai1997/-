'use client'

import { useEffect, useRef, useState } from 'react'

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(true)
      }
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  return (
    <div className="global-search">
      <button type="button" className="search-trigger" onClick={() => setOpen(true)}>
        <span>포켓몬, 기술, 특성 검색</span><kbd>Ctrl K</kbd>
      </button>
      {open ? (
        <div className="search-dialog" role="dialog" aria-modal="true" aria-label="통합 검색">
          <div className="search-panel">
            <label htmlFor="global-search">통합 검색</label>
            <input ref={inputRef} id="global-search" type="search" placeholder="한글 이름을 입력하세요" />
            <p>검색 데이터 연결은 다음 개발 단계에서 제공됩니다.</p>
            <button type="button" className="text-button" onClick={() => setOpen(false)}>닫기</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
