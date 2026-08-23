import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

const suffix = Date.now().toString(36)
const email = `pokemon-${suffix}@example.com`
const password = 'Local-test-password-2026!'
let admin: SupabaseClient
let userId = ''
let nationalDexNumber = 0
let targetNationalDexNumber = 0
let publicationId = ''
let typeId = ''
let speciesId = ''
let formId = ''
let alternateFormId = ''
let targetSpeciesId = ''
let targetFormId = ''
let evolutionRuleId = ''
let natureId = ''
let abilityId = ''
let disallowedAbilityId = ''
let itemId = ''
let allowedMoveId = ''
let secondAllowedMoveId = ''
let otherSpeciesMoveId = ''

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

    const publication = await admin
      .from('data_publications')
      .insert({ version: `registration-e2e-${suffix}` })
      .select('id')
      .single()
    if (publication.error) throw publication.error
    publicationId = publication.data.id

    const type = await admin
      .from('reference_types')
      .insert({
        publication_id: publicationId,
        identifier: `water-${suffix}`,
        name_ko: '물',
        color_hex: '#4592C4',
        sort_order: 0,
      })
      .select('id')
      .single()
    if (type.error) throw type.error
    typeId = type.data.id

    const occupiedDexNumbers = await admin
      .from('reference_species')
      .select('national_dex_number')
      .gte('national_dex_number', 8000)
      .lte('national_dex_number', 9999)
    if (occupiedDexNumbers.error) throw occupiedDexNumbers.error
    const occupied = new Set(
      occupiedDexNumbers.data.map((species) => species.national_dex_number),
    )
    nationalDexNumber = Array.from({ length: 1999 }, (_, index) => 8000 + index)
      .find((candidate) => !occupied.has(candidate) && !occupied.has(candidate + 1)) ?? 0
    targetNationalDexNumber = nationalDexNumber + 1
    if (!nationalDexNumber) throw new Error('E2E 도감번호 픽스처 공간이 부족합니다.')

    const species = await admin
      .from('reference_species')
      .insert({
        identifier: `vaporeon-${suffix}`,
        national_dex_number: nationalDexNumber,
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

    const alternateForm = await admin
      .from('reference_forms')
      .insert({
        identifier: `vaporeon-wave-${suffix}`,
        species_id: speciesId,
        base_form_id: formId,
        name_ko: '물결 모습',
        is_default: false,
      })
      .select('id')
      .single()
    if (alternateForm.error) throw alternateForm.error
    alternateFormId = alternateForm.data.id

    const targetSpecies = await admin
      .from('reference_species')
      .insert({
        identifier: `jolteon-${suffix}`,
        national_dex_number: targetNationalDexNumber,
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

    const disallowedAbility = await admin
      .from('reference_abilities')
      .insert({
        identifier: `hydration-${suffix}`,
        name_ko: '촉촉바디',
        description_ko: '비가 오면 상태 이상을 회복한다.',
      })
      .select('id')
      .single()
    if (disallowedAbility.error) throw disallowedAbility.error
    disallowedAbilityId = disallowedAbility.data.id

    const formAbilities = await admin.from('reference_form_abilities').insert([
      {
        publication_id: publicationId,
        form_id: formId,
        ability_id: abilityId,
        slot: 'first',
        is_hidden: true,
      },
      {
        publication_id: publicationId,
        form_id: alternateFormId,
        ability_id: disallowedAbilityId,
        slot: 'first',
        is_hidden: false,
      },
    ])
    if (formAbilities.error) throw formAbilities.error

    const moves = await admin
      .from('reference_moves')
      .insert([
        {
          identifier: `surf-${suffix}`,
          name_ko: '파도타기',
          description_ko: '큰 파도로 상대를 공격한다.',
          type_id: typeId,
          damage_class: 'special',
          power: 90,
          accuracy: 100,
          pp: 15,
        },
        {
          identifier: `ice-beam-${suffix}`,
          name_ko: '냉동빔',
          description_ko: '차가운 광선으로 상대를 공격한다.',
          type_id: typeId,
          damage_class: 'special',
          power: 90,
          accuracy: 100,
          pp: 10,
        },
        {
          identifier: `thunderbolt-${suffix}`,
          name_ko: '십만볼트',
          description_ko: '강한 전기를 발사한다.',
          type_id: typeId,
          damage_class: 'special',
          power: 90,
          accuracy: 100,
          pp: 15,
        },
      ])
      .select('id, identifier')
    if (moves.error) throw moves.error
    allowedMoveId = moves.data.find((move) => move.identifier === `surf-${suffix}`)?.id ?? ''
    secondAllowedMoveId = moves.data.find(
      (move) => move.identifier === `ice-beam-${suffix}`,
    )?.id ?? ''
    otherSpeciesMoveId = moves.data.find((move) => move.identifier === `thunderbolt-${suffix}`)?.id ?? ''
    if (!allowedMoveId || !secondAllowedMoveId || !otherSpeciesMoveId) {
      throw new Error('E2E 기술 픽스처 생성 실패')
    }

    const learnsets = await admin.from('reference_move_learnsets').insert([
      {
        publication_id: publicationId,
        species_id: speciesId,
        form_id: null,
        move_id: secondAllowedMoveId,
        learn_method: 'tm',
        learn_level: null,
        condition_ko: '기술머신 135로 습득',
      },
      {
        publication_id: publicationId,
        species_id: speciesId,
        form_id: null,
        move_id: allowedMoveId,
        learn_method: 'level',
        learn_level: 40,
        condition_ko: '레벨 40에 습득',
      },
      {
        publication_id: publicationId,
        species_id: speciesId,
        form_id: null,
        move_id: allowedMoveId,
        learn_method: 'tm',
        learn_level: null,
        condition_ko: '기술머신 123으로 습득',
      },
      {
        publication_id: publicationId,
        species_id: targetSpeciesId,
        form_id: null,
        move_id: otherSpeciesMoveId,
        learn_method: 'tm',
        learn_level: null,
        condition_ko: '기술머신 126으로 습득',
      },
    ])
    if (learnsets.error) throw learnsets.error

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
    if (!admin) return
    const moveIds = [allowedMoveId, secondAllowedMoveId, otherSpeciesMoveId].filter(Boolean)
    const formIds = [alternateFormId, targetFormId, formId].filter(Boolean)
    const speciesIds = [targetSpeciesId, speciesId].filter(Boolean)
    const abilityIds = [disallowedAbilityId, abilityId].filter(Boolean)
    const cleanupSteps: CleanupStep[] = [
      cleanupStep('인증 사용자 삭제', Boolean(userId), () => admin.auth.admin.deleteUser(userId)),
      cleanupStep('감사 이벤트 삭제', Boolean(userId), () => (
        admin.from('audit_events').delete().eq('user_id', userId)
      )),
      cleanupStep('진화 규칙 삭제', Boolean(evolutionRuleId), () => (
        admin.from('reference_evolution_rules').delete().eq('id', evolutionRuleId)
      )),
      cleanupStep('기술 습득 관계 삭제', Boolean(publicationId), () => (
        admin.from('reference_move_learnsets').delete().eq('publication_id', publicationId)
      )),
      cleanupStep('폼 특성 관계 삭제', Boolean(publicationId), () => (
        admin.from('reference_form_abilities').delete().eq('publication_id', publicationId)
      )),
      cleanupStep('기술 삭제', moveIds.length > 0, () => (
        admin.from('reference_moves').delete().in('id', moveIds)
      )),
      cleanupStep('도구 삭제', Boolean(itemId), () => (
        admin.from('reference_items').delete().eq('id', itemId)
      )),
      cleanupStep('특성 삭제', abilityIds.length > 0, () => (
        admin.from('reference_abilities').delete().in('id', abilityIds)
      )),
      cleanupStep('성격 삭제', Boolean(natureId), () => (
        admin.from('reference_natures').delete().eq('id', natureId)
      )),
      cleanupStep('대체 폼 삭제', Boolean(alternateFormId), () => (
        admin.from('reference_forms').delete().eq('id', alternateFormId)
      )),
      cleanupStep('대상 폼 삭제', Boolean(targetFormId), () => (
        admin.from('reference_forms').delete().eq('id', targetFormId)
      )),
      cleanupStep('기본 폼 삭제', Boolean(formId), () => (
        admin.from('reference_forms').delete().eq('id', formId)
      )),
      cleanupStep('종 삭제', speciesIds.length > 0, () => (
        admin.from('reference_species').delete().in('id', speciesIds)
      )),
      cleanupStep('타입 삭제', Boolean(typeId), () => (
        admin.from('reference_types').delete().eq('id', typeId)
      )),
      cleanupStep('게시 단위 삭제', Boolean(publicationId), () => (
        admin.from('data_publications').delete().eq('id', publicationId)
      )),
      residueStep('인증 사용자 잔존', Boolean(userId), async () => {
        const result = await admin.auth.admin.getUserById(userId)
        if (result.data.user) return { error: null, residue: 1 }
        if (result.error?.status === 404 || result.error?.code === 'user_not_found') {
          return { error: null, residue: 0 }
        }
        return { error: result.error, residue: 0 }
      }),
      residueStep('감사 이벤트 잔존', Boolean(userId), async () => {
        const result = await admin
          .from('audit_events')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
        return { error: result.error, residue: result.count ?? 0 }
      }),
      residueStep('보유 포켓몬 잔존', Boolean(userId), async () => {
        const result = await admin
          .from('owned_pokemon')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
        return { error: result.error, residue: result.count ?? 0 }
      }),
      residueStep('진화 규칙 잔존', Boolean(evolutionRuleId), async () => {
        const result = await admin
          .from('reference_evolution_rules')
          .select('id', { count: 'exact', head: true })
          .eq('id', evolutionRuleId)
        return { error: result.error, residue: result.count ?? 0 }
      }),
      residueStep('기술 습득 관계 잔존', Boolean(publicationId), async () => {
        const result = await admin
          .from('reference_move_learnsets')
          .select('id', { count: 'exact', head: true })
          .eq('publication_id', publicationId)
        return { error: result.error, residue: result.count ?? 0 }
      }),
      residueStep('폼 특성 관계 잔존', Boolean(publicationId), async () => {
        const result = await admin
          .from('reference_form_abilities')
          .select('id', { count: 'exact', head: true })
          .eq('publication_id', publicationId)
        return { error: result.error, residue: result.count ?? 0 }
      }),
      residueStep('기술 잔존', moveIds.length > 0, async () => {
        const result = await admin
          .from('reference_moves')
          .select('id', { count: 'exact', head: true })
          .in('id', moveIds)
        return { error: result.error, residue: result.count ?? 0 }
      }),
      residueStep('특성 잔존', abilityIds.length > 0, async () => {
        const result = await admin
          .from('reference_abilities')
          .select('id', { count: 'exact', head: true })
          .in('id', abilityIds)
        return { error: result.error, residue: result.count ?? 0 }
      }),
      residueStep('폼 잔존', formIds.length > 0, async () => {
        const result = await admin
          .from('reference_forms')
          .select('id', { count: 'exact', head: true })
          .in('id', formIds)
        return { error: result.error, residue: result.count ?? 0 }
      }),
      residueStep('종 잔존', speciesIds.length > 0, async () => {
        const result = await admin
          .from('reference_species')
          .select('id', { count: 'exact', head: true })
          .in('id', speciesIds)
        return { error: result.error, residue: result.count ?? 0 }
      }),
      residueStep('도구 잔존', Boolean(itemId), async () => {
        const result = await admin
          .from('reference_items')
          .select('id', { count: 'exact', head: true })
          .eq('id', itemId)
        return { error: result.error, residue: result.count ?? 0 }
      }),
      residueStep('성격 잔존', Boolean(natureId), async () => {
        const result = await admin
          .from('reference_natures')
          .select('id', { count: 'exact', head: true })
          .eq('id', natureId)
        return { error: result.error, residue: result.count ?? 0 }
      }),
      residueStep('타입 잔존', Boolean(typeId), async () => {
        const result = await admin
          .from('reference_types')
          .select('id', { count: 'exact', head: true })
          .eq('id', typeId)
        return { error: result.error, residue: result.count ?? 0 }
      }),
      residueStep('게시 단위 잔존', Boolean(publicationId), async () => {
        const result = await admin
          .from('data_publications')
          .select('id', { count: 'exact', head: true })
          .eq('id', publicationId)
        return { error: result.error, residue: result.count ?? 0 }
      }),
    ]
    await runCleanupSteps(cleanupSteps)
  })

  test('새로고침해도 7단계 등록 초안을 유지하고 같은 종을 두 번 등록한다', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('이메일').fill(email)
    await page.getByLabel('비밀번호').fill(password)
    await page.getByRole('button', { name: '로그인' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    await registerPokemon(page, '파도', true)
    await registerPokemon(page, '물결')

    await page.goto('/my-pokemon')
    await expect(page.getByText(`도감번호 #${formatDex(nationalDexNumber)}`)).toHaveCount(2)
    await expect(page.getByText('파도')).toBeVisible()
    await expect(page.getByText('물결')).toBeVisible()

    const visibleText = await page.locator('body').innerText()
    expect(visibleText).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)
    expect(page.url()).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)

    const savedPokemon = await admin
      .from('owned_pokemon')
      .select('id')
      .eq('user_id', userId)
      .eq('nickname', '파도')
      .single()
    if (savedPokemon.error) throw savedPokemon.error
    const savedMoves = await admin
      .from('owned_pokemon_moves')
      .select('move_id, kind, slot, target_condition_ko')
      .eq('owned_pokemon_id', savedPokemon.data.id)
      .order('kind')
      .order('slot')
    if (savedMoves.error) throw savedMoves.error
    expect(savedMoves.data).toEqual([
      { move_id: allowedMoveId, kind: 'current', slot: 1, target_condition_ko: '' },
      { move_id: secondAllowedMoveId, kind: 'current', slot: 2, target_condition_ko: '' },
      {
        move_id: allowedMoveId,
        kind: 'target',
        slot: 1,
        target_condition_ko: '기술머신 123으로 습득',
      },
      {
        move_id: secondAllowedMoveId,
        kind: 'target',
        slot: 2,
        target_condition_ko: '기술머신 135로 습득',
      },
    ])
  })

  test('도감번호 상세 URL에서 빠른 수정과 사유가 있는 보호 정보 정정을 수행한다', async ({ page }) => {
    await signIn(page)
    await page.goto('/my-pokemon')
    await page.getByRole('link', { name: /파도 상세 보기/ }).click()

    await expect(page).toHaveURL(
      new RegExp(`/my-pokemon/detail\\?dex=${formatDex(nationalDexNumber)}&entry=1$`),
    )
    expect(page.url()).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)
    await expect(page.getByText('천둥의돌을 사용한다')).toBeVisible()

    await page.getByLabel('빠른 수정 레벨').fill('61')
    await page.getByLabel('메모').fill('특수공격 중심 육성')
    await page.getByRole('button', { name: '빠른 수정 저장' }).click()
    await expect(page.getByText('Lv. 61')).toBeVisible()
    await expect(page.getByRole('paragraph').filter({ hasText: '특수공격 중심 육성' })).toBeVisible()

    await page.getByRole('button', { name: '보호 정보 정정 열기' }).click()
    await page.getByLabel('정정 포켓몬 종').selectOption({
      label: `쥬피썬 · 도감번호 #${formatDex(targetNationalDexNumber)}`,
    })
    await page.getByLabel('정정 포획일').fill('2026-08-17')
    await page.getByLabel('정정 사유').fill('종과 초기 포획일 입력 오류 정정')
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: '정정 저장' }).click()
    await expect(page).toHaveURL(/\/my-pokemon$/)
    await expect(page.getByText(`도감번호 #${formatDex(targetNationalDexNumber)}`)).toBeVisible()

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

async function registerPokemon(
  page: import('@playwright/test').Page,
  nickname: string,
  verifyReconciliation = false,
) {
  await page.goto('/my-pokemon/new')
  await page.getByLabel('포켓몬 종').selectOption({
    label: `샤미드 · 도감번호 #${formatDex(nationalDexNumber)}`,
  })
  await page.getByRole('button', { name: '다음' }).click()

  await page.getByLabel('별명').fill(nickname)
  await page.getByLabel('레벨').fill('60')
  await page.reload()
  await expect(page.getByLabel('별명')).toHaveValue(nickname)
  await page.getByRole('button', { name: '다음' }).click()

  await expect(page.getByText('3 / 7단계')).toBeVisible()
  await page.getByLabel('원본 성격').selectOption({ label: '명랑' })
  await page.getByLabel('현재 성격').selectOption({ label: '명랑' })
  await expect(page.getByRole('option', { name: '저수 · 숨겨진 특성' })).toBeAttached()
  await expect(page.getByRole('option', { name: '촉촉바디' })).toHaveCount(0)
  await page.getByLabel('특성', { exact: true }).selectOption({ label: '저수 · 숨겨진 특성' })

  if (verifyReconciliation) {
    await page.getByRole('button', { name: '이전' }).click()
    await page.getByRole('button', { name: '이전' }).click()
    await page.getByLabel('모습', { exact: true }).selectOption({ label: '물결 모습' })
    await page.getByRole('button', { name: '다음' }).click()
    await page.getByRole('button', { name: '다음' }).click()
    await expect(page.getByLabel('특성', { exact: true })).toHaveValue('')
    await expect(page.getByRole('option', { name: '저수 · 숨겨진 특성' })).toHaveCount(0)
    await expect(page.getByRole('option', { name: '촉촉바디' })).toBeAttached()
    await page.getByRole('button', { name: '이전' }).click()
    await page.getByRole('button', { name: '이전' }).click()
    await page.getByLabel('모습', { exact: true }).selectOption({ label: '기본 모습' })
    await page.getByRole('button', { name: '다음' }).click()
    await page.getByRole('button', { name: '다음' }).click()
    await page.getByLabel('특성', { exact: true }).selectOption({ label: '저수 · 숨겨진 특성' })
  }
  await page.getByRole('button', { name: '다음' }).click()

  for (let step = 4; step <= 5; step += 1) {
    await expect(page.getByText(`${step} / 7단계`)).toBeVisible()
    await page.getByRole('button', { name: '다음' }).click()
  }

  await expect(page.getByText('6 / 7단계')).toBeVisible()
  await expect(page.getByRole('option', { name: /파도타기/u }).first()).toBeAttached()
  await expect(page.getByRole('option', { name: /십만볼트/u })).toHaveCount(0)
  await expect(page.getByLabel('현재 기술 2')).toBeDisabled()
  await expect(page.getByLabel('목표 기술 2')).toBeDisabled()
  await page.getByLabel('현재 기술 1').selectOption(allowedMoveId)
  await expect(page.getByLabel('현재 기술 2')).toBeEnabled()
  await expect(page.getByLabel('현재 기술 2').locator(`option[value="${allowedMoveId}"]`)).toBeDisabled()
  await page.getByLabel('현재 기술 2').selectOption(secondAllowedMoveId)
  await page.getByLabel('목표 기술 1').selectOption(allowedMoveId)
  await expect(page.getByLabel('목표 기술 2')).toBeEnabled()
  await page.getByLabel('목표 기술 2').selectOption(secondAllowedMoveId)
  await page.getByLabel('목표 습득 방법 1').selectOption({ label: '기술머신 · 기술머신 123으로 습득' })
  await page.getByLabel('지닌 도구').selectOption({ label: '신비의물방울' })

  await page.reload()
  await expect(page.getByLabel('현재 기술 1')).toHaveValue(allowedMoveId)
  await expect(page.getByLabel('현재 기술 2')).toHaveValue(secondAllowedMoveId)
  await expect(page.getByLabel('목표 기술 1')).toHaveValue(allowedMoveId)
  await expect(page.getByLabel('목표 기술 2')).toHaveValue(secondAllowedMoveId)
  await expect(page.getByLabel('목표 습득 방법 1')).toHaveValue('기술머신 123으로 습득')

  if (verifyReconciliation) {
    for (let step = 0; step < 5; step += 1) {
      await page.getByRole('button', { name: '이전' }).click()
    }
    await page.getByLabel('포켓몬 종').selectOption({
      label: `쥬피썬 · 도감번호 #${formatDex(targetNationalDexNumber)}`,
    })
    await page.getByLabel('포켓몬 종').selectOption({
      label: `샤미드 · 도감번호 #${formatDex(nationalDexNumber)}`,
    })
    await page.getByRole('button', { name: '다음' }).click()
    await page.getByRole('button', { name: '다음' }).click()
    await expect(page.getByLabel('특성', { exact: true })).toHaveValue('')
    await page.getByLabel('특성', { exact: true }).selectOption({ label: '저수 · 숨겨진 특성' })
    await page.getByRole('button', { name: '다음' }).click()
    await page.getByRole('button', { name: '다음' }).click()
    await page.getByRole('button', { name: '다음' }).click()
    await expect(page.getByLabel('현재 기술 1')).toHaveValue('')
    await expect(page.getByLabel('현재 기술 2')).toBeDisabled()
    await expect(page.getByLabel('목표 기술 1')).toHaveValue('')
    await expect(page.getByLabel('목표 기술 2')).toBeDisabled()
    await page.getByLabel('현재 기술 1').selectOption(allowedMoveId)
    await page.getByLabel('현재 기술 2').selectOption(secondAllowedMoveId)
    await page.getByLabel('목표 기술 1').selectOption(allowedMoveId)
    await page.getByLabel('목표 기술 2').selectOption(secondAllowedMoveId)
    await page.getByLabel('목표 습득 방법 1').selectOption({ label: '기술머신 · 기술머신 123으로 습득' })
  }
  await page.getByRole('button', { name: '다음' }).click()

  await expect(page.getByText('7 / 7단계')).toBeVisible()
  await page.getByRole('button', { name: '등록 완료' }).click()
  await expect(page).toHaveURL(/\/my-pokemon$/)
}

function formatDex(value: number) {
  return String(value).padStart(4, '0')
}

type CleanupStepResult = { error: unknown; residue?: number | null }
type CleanupStep = {
  label: string
  enabled: boolean
  run: () => PromiseLike<CleanupStepResult>
}

function cleanupStep(
  label: string,
  enabled: boolean,
  run: () => PromiseLike<{ error: unknown }>,
): CleanupStep {
  return { label, enabled, run }
}

function residueStep(
  label: string,
  enabled: boolean,
  run: () => PromiseLike<CleanupStepResult>,
): CleanupStep {
  return { label, enabled, run }
}

async function runCleanupSteps(steps: CleanupStep[]) {
  const failures: string[] = []
  for (const step of steps) {
    if (!step.enabled) continue
    try {
      const result = await step.run()
      if (result.error) failures.push(`${step.label}: ${cleanupErrorMessage(result.error)}`)
      if ((result.residue ?? 0) > 0) failures.push(`${step.label}: ${result.residue}개`)
    } catch (error) {
      failures.push(`${step.label}: ${cleanupErrorMessage(error)}`)
    }
  }
  if (failures.length) {
    throw new Error(`E2E 픽스처 정리 실패\n${failures.join('\n')}`)
  }
}

function cleanupErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) return String(error.message)
  return String(error)
}
