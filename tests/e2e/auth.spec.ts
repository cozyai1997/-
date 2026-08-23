import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

const email = `trainer-${Date.now()}@example.com`
const password = 'Local-test-password-2026!'
let createdUserId = ''

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase E2E 환경 변수가 설정되지 않았습니다.')
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

test.beforeAll(async () => {
  const { data, error } = await createAdminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) throw error
  createdUserId = data.user.id
})

test.afterAll(async () => {
  if (createdUserId) {
    await createAdminClient().auth.admin.deleteUser(createdUserId)
  }
})

test('비로그인 사용자를 로그인 화면으로 이동시킨다', async ({ page }) => {
  await page.goto('/dashboard')

  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/)
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible()
  await expect(page.getByLabel('이메일')).toBeVisible()
  await expect(page.getByLabel('비밀번호')).toBeVisible()
})

test('이메일과 비밀번호로 로그인하면 대시보드를 연다', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('이메일').fill(email)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible()
  await page.getByRole('button', { name: '로그아웃' }).click()
  await expect(page).toHaveURL(/\/login$/)
})

test('외부 복귀 경로를 무시한다', async ({ page }) => {
  await page.goto('/login?next=//example.org')
  await page.getByLabel('이메일').fill(email)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
})
