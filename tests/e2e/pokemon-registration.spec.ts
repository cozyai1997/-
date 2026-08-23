import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

const suffix = Date.now().toString(36)
const email = `pokemon-${suffix}@example.com`
const password = 'Local-test-password-2026!'
let admin: SupabaseClient
let userId = ''
let speciesId = ''
let formId = ''

test.describe.serial('보유 포켓몬 등록', () => {
  test.beforeAll(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceRoleKey) throw new Error('Supabase E2E 환경 변수가 필요합니다.')

    admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (created.error) throw created.error
    userId = created.data.user.id

    const species = await admin
      .from('reference_species')
      .insert({
        identifier: `vaporeon-${suffix}`,
        national_dex_number: 134,
        name_ko: '샤미드',
        description_ko: '물 타입 진화 포켓몬',
      })
      .select('id')
      .single()
    if (species.error) throw species.error
    speciesId = species.data.id

    const form = await admin
      .from('reference_forms')
      .insert({
        identifier: `vaporeon-default-${suffix}`,
        species_id: speciesId,
        name_ko: '기본 모습',
        is_default: true,
      })
      .select('id')
      .single()
    if (form.error) throw form.error
    formId = form.data.id
  })

  test.afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId)
    if (formId) await admin.from('reference_forms').delete().eq('id', formId)
    if (speciesId) await admin.from('reference_species').delete().eq('id', speciesId)
  })

  test('새로고침해도 7단계 등록 초안을 유지하고 같은 종을 두 번 등록한다', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('이메일').fill(email)
    await page.getByLabel('비밀번호').fill(password)
    await page.getByRole('button', { name: '로그인' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    await registerPokemon(page, '파도')
    await registerPokemon(page, '물결')

    await page.goto('/my-pokemon')
    await expect(page.getByText('도감번호 #0134')).toHaveCount(2)
    await expect(page.getByText('파도')).toBeVisible()
    await expect(page.getByText('물결')).toBeVisible()

    const visibleText = await page.locator('body').innerText()
    expect(visibleText).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)
    expect(page.url()).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)
  })
})

async function registerPokemon(page: import('@playwright/test').Page, nickname: string) {
  await page.goto('/my-pokemon/new')
  await page.getByLabel('포켓몬 종').selectOption({ label: '샤미드 · 도감번호 #0134' })
  await page.getByRole('button', { name: '다음' }).click()

  await page.getByLabel('별명').fill(nickname)
  await page.getByLabel('레벨').fill('60')
  await page.reload()
  await expect(page.getByLabel('별명')).toHaveValue(nickname)
  await page.getByRole('button', { name: '다음' }).click()

  for (let step = 3; step <= 6; step += 1) {
    await expect(page.getByText(`${step} / 7단계`)).toBeVisible()
    await page.getByRole('button', { name: '다음' }).click()
  }

  await expect(page.getByText('7 / 7단계')).toBeVisible()
  await page.getByRole('button', { name: '등록 완료' }).click()
  await expect(page).toHaveURL(/\/my-pokemon$/)
}
