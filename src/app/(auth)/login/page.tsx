'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import { Suspense, type FormEvent, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage('')

    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '')
    const password = String(form.get('password') ?? '')
    const supabase = createClient()

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      setMessage(
        error
          ? '회원가입에 실패했습니다. 이메일과 비밀번호를 확인해 주세요.'
          : '가입 확인 메일을 받은 뒤 로그인할 수 있습니다.',
      )
      setPending(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMessage('로그인에 실패했습니다. 이메일과 비밀번호를 확인해 주세요.')
      setPending(false)
      return
    }

    const requestedPath = searchParams.get('next')
    const destination =
      requestedPath?.startsWith('/') && !requestedPath.startsWith('//')
        ? requestedPath
        : '/dashboard'
    router.replace(destination as Route)
    router.refresh()
  }

  function changeMode() {
    setMode((current) => (current === 'login' ? 'signup' : 'login'))
    setMessage('')
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="eyebrow">트레이너 계정</p>
        <h1 id="auth-title">{mode === 'login' ? '로그인' : '회원가입'}</h1>
        <p className="auth-description">
          {mode === 'login'
            ? '내 포켓몬과 육성 기록은 계정별로 안전하게 분리됩니다.'
            : '가입 확인 메일을 받은 뒤 로그인할 수 있습니다.'}
        </p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="email">이메일</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
          <label htmlFor="password">비밀번호</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={8}
            required
          />
          <button className="primary-button" type="submit" disabled={pending}>
            {pending ? '처리 중…' : mode === 'login' ? '로그인' : '회원가입'}
          </button>
        </form>
        {message ? <p className="auth-message" role="status">{message}</p> : null}
        <button className="text-button" type="button" onClick={changeMode}>
          {mode === 'login' ? '회원가입으로 전환' : '로그인으로 전환'}
        </button>
      </section>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="auth-page">로그인 화면을 준비하고 있습니다…</main>}>
      <LoginForm />
    </Suspense>
  )
}
