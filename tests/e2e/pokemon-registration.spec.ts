import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

const suffix = Date.now().toString(36)
const email = `pokemon-${suffix}@example.com`
const password = 'Local-test-password-2026!'
let admin: SupabaseClient
let userId = ''
let speciesId = ''
let formId = ''
let targetSpeciesId = ''
let targetFormId = ''
let evolutionRuleId = ''
let natureId = ''
let abilityId = ''
let itemId = ''

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

    const targetSpecies = await admin
      .from('reference_species')
      .insert({
        identifier: `jolteon-${suffix}`,
        national_dex_number: 135,
        name_ko: '쥬피썬',
        description_ko: '번개 타입 진화 포켓몬',
      })
      .select('id')
      .single()
    if (targetSpecies.error) throw targetSpecies.error
    targetSpeciesId = targetSpecies.data.id

    const targetForm = await admin
      .from('reference_forms')
      .insert({
        identifier: `jolteon-default-${suffix}`,
        species_id: targetSpeciesId,
        name_ko: '기본 모습',
        is_default: true,
      })
      .select('id')
      .single()
    if (targetForm.error) throw targetForm.error
    targetFormId = targetForm.data.id

    const evolutionRule = await admin
      .from('reference_evolution_rules')
      .insert({
        from_form_id: formId,
        to_form_id: targetFormId,
        condition_ko: '천둥의돌을 사용한다',
      })
      .select('id')
      .single()
    if (evolutionRule.error) throw evolutionRule.error
    evolutionRuleId = evolutionRule.data.id

    const nature = await admin
      .from('reference_natures')
      .insert({ identifier: `jolly-${suffix}`, name_ko: '명랑' })
      .select('id')
      .single()
    if (nature.error) throw nature.error
    natureId = nature.data.id

    const ability = await admin
      .from('reference_abilities')
      .insert({
        identifier: `water-absorb-${suffix}`,
        name_ko: '저수',
        description_ko: '물 타입 기술을 받으면 회복한다.',
      })
      .select('id')
      .single()
    if (ability.error) throw ability.error
    abilityId = ability.data.id

    const item = await admin
      .from('reference_items')
      .insert({
        identifier: `mystic-water-${suffix}`,
        name_ko: '신비의물방울',
        description_ko: '물 타입 기술의 위력을 높인다.',
      })
      .select('id')
      .single()
    if (item.error) throw item.error
    itemId = item.data.id
  })

  test.afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId)
    if (userId) await admin.from('audit_events').delete().eq('user_id', userId)
    if (evolutionRuleId) await admin.from('reference_evolution_rules').delete().eq('id', evolutionRuleId)
    if (targetFormId) await admin.from('reference_forms').delete().eq('id', targetFormId)
    if (targetSpeciesId) await admin.from('reference_species').delete().eq('id', targetSpeciesId)
    if (itemId) await admin.from('reference_items').delete().eq('id', itemId)
    if (abilityId) await admin.from('reference_abilities').delete().eq('id', abilityId)
    if (natureId) await admin.from('reference_natures').delete().eq('id', natureId)
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

  test('도감번호 상세 URL에서 빠른 수정과 사유가 있는 보호 정보 정정을 수행한다', async ({ page }) => {
    await signIn(page)
    await page.goto('/my-pokemon')
    await page.getByRole('link', { name: /파도 상세 보기/ }).click()

    await expect(page).toHaveURL(/\/my-pokemon\/detail\?dex=0134&entry=1$/)
    expect(page.url()).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)
    await expect(page.getByText('천둥의돌을 사용한다')).toBeVisible()

    await page.getByLabel('빠른 수정 레벨').fill('61')
    await page.getByLabel('메모').fill('특수공격 중심 육성')
    await page.getByRole('button', { name: '빠른 수정 저장' }).click()
    await expect(page.getByText('Lv. 61')).toBeVisible()
    await expect(page.getByRole('paragraph').filter({ hasText: '특수공격 중심 육성' })).toBeVisible()

    await page.getByRole('button', { name: '보호 정보 정정 열기' }).click()
    await page.getByLabel('정정 포켓몬 종').selectOption({ label: '쥬피썬 · 도감번호 #0135' })
    await page.getByLabel('정정 포획일').fill('2026-08-17')
    await page.getByLabel('정정 사유').fill('종과 초기 포획일 입력 오류 정정')
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: '정정 저장' }).click()
    await expect(page).toHaveURL(/\/my-pokemon$/)
    await expect(page.getByText('도감번호 #0135')).toBeVisible()

    const owned = await admin
      .from('owned_pokemon')
      .select('id')
      .eq('user_id', userId)
      .order('created_at')
      .limit(1)
      .single()
    if (owned.error) throw owned.error
    const audit = await admin
      .from('audit_events')
      .select('action, reason_ko, before_data, after_data')
      .eq('entity_id', owned.data.id)
      .eq('action', 'correct')
      .single()
    if (audit.error) throw audit.error
    expect(audit.data.reason_ko).toBe('종과 초기 포획일 입력 오류 정정')
    expect(audit.data.before_data).toMatchObject({ captured_on: null, species_id: speciesId })
    expect(audit.data.after_data).toMatchObject({ captured_on: '2026-08-17', species_id: targetSpeciesId })
  })
})

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByLabel('이메일').fill(email)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

async function registerPokemon(page: import('@playwright/test').Page, nickname: string) {
  await page.goto('/my-pokemon/new')
  await page.getByLabel('포켓몬 종').selectOption({ label: '샤미드 · 도감번호 #0134' })
  await page.getByRole('button', { name: '다음' }).click()

  await page.getByLabel('별명').fill(nickname)
  await page.getByLabel('레벨').fill('60')
  await page.reload()
  await expect(page.getByLabel('별명')).toHaveValue(nickname)
  await page.getByRole('button', { name: '다음' }).click()

  await expect(page.getByText('3 / 7단계')).toBeVisible()
  await page.getByLabel('원본 성격').selectOption({ label: '명랑' })
  await page.getByLabel('현재 성격').selectOption({ label: '명랑' })
  await page.getByLabel('특성', { exact: true }).selectOption({ label: '저수' })
  await page.getByRole('button', { name: '다음' }).click()

  for (let step = 4; step <= 5; step += 1) {
    await expect(page.getByText(`${step} / 7단계`)).toBeVisible()
    await page.getByRole('button', { name: '다음' }).click()
  }

  await expect(page.getByText('6 / 7단계')).toBeVisible()
  await page.getByLabel('지닌 도구').selectOption({ label: '신비의물방울' })
  await page.getByRole('button', { name: '다음' }).click()

  await expect(page.getByText('7 / 7단계')).toBeVisible()
  await page.getByRole('button', { name: '등록 완료' }).click()
  await expect(page).toHaveURL(/\/my-pokemon$/)
}
