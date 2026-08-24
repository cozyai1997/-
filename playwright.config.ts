import { execFileSync } from 'node:child_process'

import { defineConfig, devices } from '@playwright/test'
import { assertLocalSupabaseUrl } from './tests/e2e/support/local-supabase-safety'

function readLocalSupabaseEnvironment() {
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    assertLocalSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
    return process.env
  }

  let output: string
  try {
    output =
      process.platform === 'win32'
        ? execFileSync('cmd.exe', ['/d', '/s', '/c', 'supabase status -o env'], {
            encoding: 'utf8',
          })
        : execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8' })
  } catch {
    return process.env
  }
  const values = Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z_]+)="(.*)"$/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => [match[1], match[2]]),
  )
  assertLocalSupabaseUrl(values.API_URL)
  return {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: values.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      values.PUBLISHABLE_KEY ?? values.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: values.SERVICE_ROLE_KEY,
  }
}

const testEnvironment = readLocalSupabaseEnvironment()
assertLocalSupabaseUrl(testEnvironment.NEXT_PUBLIC_SUPABASE_URL)
Object.assign(process.env, testEnvironment)
const webServerEnvironment = {
  ...Object.fromEntries(
    Object.entries(testEnvironment).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === 'string' &&
        ![
          'SUPABASE_SERVICE_ROLE_KEY',
          'SUPABASE_SECRET_KEY',
          'SUPABASE_ACCESS_TOKEN',
          'SUPABASE_DB_PASSWORD',
        ].includes(entry[0]),
    ),
  ),
  NEXT_DIST_DIR: '.next-e2e',
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    env: webServerEnvironment,
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
