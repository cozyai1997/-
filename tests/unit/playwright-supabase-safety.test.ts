// @vitest-environment node

import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { assertLocalSupabaseUrl } from '../../tests/e2e/support/local-supabase-safety'

describe('Playwright Supabase 안전 경계', () => {
  it.each([
    'http://127.0.0.1:54321',
    'http://localhost:54321',
  ])('loopback Supabase URL %s만 허용한다', (url) => {
    expect(assertLocalSupabaseUrl(url).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/u)
  })

  it.each([
    'https://example.supabase.co',
    'http://192.168.0.10:54321',
    'not-a-url',
    '',
  ])('외부 또는 잘못된 Supabase URL %s를 fixture 실행 전에 거부한다', (url) => {
    expect(() => assertLocalSupabaseUrl(url)).toThrow('로컬 Supabase')
  })

  it('운영 project ref는 hostname 변형과 무관하게 명시적으로 거부한다', () => {
    expect(() => assertLocalSupabaseUrl(
      'https://ipbqrgsdkoqtuqgnewrs.supabase.co',
    )).toThrow('ipbqrgsdkoqtuqgnewrs')
  })

  it('Playwright config 자체가 test listing 전에 운영 URL을 거부하고 키를 출력하지 않는다', () => {
    const secret = 'must-not-appear-in-output'
    const result = spawnSync(process.execPath, [
      resolve('node_modules/@playwright/test/cli.js'),
      'test', '--list', '--config', resolve('playwright.config.ts'),
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 30_000,
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: 'https://ipbqrgsdkoqtuqgnewrs.supabase.co',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'dummy-publishable-key',
        SUPABASE_SERVICE_ROLE_KEY: secret,
      },
    })
    const output = `${result.stdout}${result.stderr}`

    expect(result.status).not.toBe(0)
    expect(output).toContain('ipbqrgsdkoqtuqgnewrs')
    expect(output).not.toContain(secret)
  })
})
