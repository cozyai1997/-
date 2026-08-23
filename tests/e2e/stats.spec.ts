import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

const suffix = Date.now().toString(36)
const email = `stats-${suffix}@example.com`
const password = 'Stats-test-password-2026!'
let admin: SupabaseClient
let userId = ''

test.beforeAll(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) throw new Error('Supabase E2E 환경 변수가 필요합니다.')
  admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (created.error || !created.data.user) throw created.error ?? new Error('사용자 생성 실패')
  userId = created.data.user.id
})

test.afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId)
})

test('한국어 화면에서 IV·EV·성격을 반영하고 잘못된 EV를 설명한다', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('이메일').fill(email)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.getByRole('link', { name: '능력치 계산' }).click()

  await expect(page.getByRole('heading', { name: '능력치 계산' })).toBeVisible()
  await expect(page.getByText('루카리오 예시값')).toBeVisible()
  await page.getByLabel('공격 EV', { exact: true }).fill('252')
  await page.getByLabel('특수방어 EV').fill('4')
  await page.getByLabel('스피드 EV').fill('252')
  await page.getByLabel('상승 능력치').selectOption('speed')
  await page.getByLabel('하락 능력치').selectOption('special_attack')
  await page.getByRole('button', { name: '능력치 계산하기' }).click()

  await expect(page.getByRole('row', { name: /공격 110 31 252 162/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /특수공격 115 31 0 121/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /스피드 90 31 252 156/ })).toBeVisible()

  await page.getByLabel('HP EV').fill('7')
  await expect(page.getByRole('heading', { name: '계산 결과' })).toBeHidden()
  await page.getByRole('button', { name: '능력치 계산하기' }).click()
  await expect(page.locator('.calculation-errors')).toContainText('EV 총합은 510 이하여야 합니다.')
  await expect(page.getByRole('heading', { name: '계산 결과' })).toBeHidden()

  await page.getByLabel('HP EV').fill('0')
  await page.getByLabel('공격 EV', { exact: true }).fill('253')
  await page.getByRole('button', { name: '능력치 계산하기' }).click()
  await expect(page.locator('.calculation-errors')).toContainText('개별 EV는 0부터 252 사이의 정수여야 합니다.')
})
