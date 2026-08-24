import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'
import sharp from 'sharp'

const suffix = Date.now().toString(36)
const email = `private-image-${suffix}@example.com`
const password = 'Private-image-test-2026!'
let admin: SupabaseClient
let userId = ''
let publicationId = ''
let previousActivePublicationId = ''
let speciesId = ''
let formId = ''
let pokemonId = ''
let nationalDexNumber = 0

test.describe.serial('비공개 포켓몬 이미지', () => {
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

    const previousActive = await admin
      .from('data_publications')
      .select('id')
      .eq('status', 'active')
      .maybeSingle()
    if (previousActive.error) throw previousActive.error
    previousActivePublicationId = previousActive.data?.id ?? ''
    if (previousActivePublicationId) {
      const retired = await admin.from('data_publications')
        .update({ status: 'retired' })
        .eq('id', previousActivePublicationId)
      if (retired.error) throw retired.error
    }
    const publication = await admin.from('data_publications').insert({
      version: `private-image-e2e-${suffix}`,
      status: 'active',
      validated_at: new Date().toISOString(),
      activated_at: new Date().toISOString(),
    }).select('id').single()
    if (publication.error) throw publication.error
    publicationId = publication.data.id

    const occupiedDexNumbers = await admin
      .from('reference_species')
      .select('national_dex_number')
      .gte('national_dex_number', 7000)
      .lte('national_dex_number', 7999)
    if (occupiedDexNumbers.error) throw occupiedDexNumbers.error
    const occupied = new Set(
      occupiedDexNumbers.data.map((species) => species.national_dex_number),
    )
    nationalDexNumber =
      Array.from({ length: 1000 }, (_, index) => 7000 + index).find(
        (candidate) => !occupied.has(candidate),
      ) ?? 0
    if (!nationalDexNumber) throw new Error('개인 이미지 E2E 도감번호 픽스처 공간이 부족합니다.')

    const species = await admin.from('reference_species').insert({
      publication_id: publicationId,
      identifier: `image-eevee-${suffix}`,
      national_dex_number: nationalDexNumber,
      name_ko: '이브이',
      description_ko: '개인 이미지 시험용',
    }).select('id').single()
    if (species.error) throw species.error
    speciesId = species.data.id
    const form = await admin.from('reference_forms').insert({
      publication_id: publicationId,
      identifier: `image-eevee-form-${suffix}`,
      species_id: speciesId,
      name_ko: '기본 모습',
      is_default: true,
    }).select('id').single()
    if (form.error) throw form.error
    formId = form.data.id
    const pokemon = await admin.from('owned_pokemon').insert({
      user_id: userId,
      species_id: speciesId,
      form_id: formId,
      nickname: '별빛',
      gender: 'female',
      level: 15,
    }).select('id').single()
    if (pokemon.error) throw pokemon.error
    pokemonId = pokemon.data.id
  })

  test.afterAll(async () => {
    if (userId && pokemonId) {
      await admin.storage.from('private-pokemon-images').remove([
        `${userId}/${pokemonId}/portrait.webp`,
      ])
    }
    if (userId) {
      const deletedUser = await admin.auth.admin.deleteUser(userId)
      if (deletedUser.error) throw deletedUser.error
      const deletedAudits = await admin.from('audit_events').delete().eq('user_id', userId)
      if (deletedAudits.error) throw deletedAudits.error
      const auditResidue = await admin.from('audit_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
      if (auditResidue.error || auditResidue.count !== 0) {
        throw auditResidue.error ?? new Error(`개인 이미지 E2E 감사 잔존: ${auditResidue.count}`)
      }
    }
    if (formId) await admin.from('reference_forms').delete().eq('id', formId)
    if (speciesId) await admin.from('reference_species').delete().eq('id', speciesId)
    if (publicationId) {
      const retired = await admin.from('data_publications')
        .update({ status: 'retired' })
        .eq('id', publicationId)
      if (retired.error) throw retired.error
    }
    if (previousActivePublicationId) {
      const restored = await admin.from('data_publications')
        .update({ status: 'active' })
        .eq('id', previousActivePublicationId)
      if (restored.error) throw restored.error
    }
    if (publicationId) {
      const deletedPublication = await admin.from('data_publications')
        .delete()
        .eq('id', publicationId)
      if (deletedPublication.error) throw deletedPublication.error
    }
  })

  test('개인 이미지를 WebP로 저장해 표시하고 삭제하면 실루엣으로 돌아간다', async ({ page }) => {
    const detailPath = `/my-pokemon/detail?dex=${nationalDexNumber.toString().padStart(4, '0')}&entry=1`
    await page.goto('/login')
    await page.getByLabel('이메일').fill(email)
    await page.getByLabel('비밀번호').fill(password)
    await page.getByRole('button', { name: '로그인' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    await page.goto(detailPath)

    const portrait = page.getByRole('img', { name: '별빛 개인 이미지' })
    await expect(portrait).toHaveAttribute('src', '/silhouettes/default.svg')

    const invalidMime = await page.request.post(`/api/private-images?${new URLSearchParams({
      dex: nationalDexNumber.toString().padStart(4, '0'),
      entry: '1',
    })}`, {
      data: { mimeType: 'image/svg+xml', byteSize: 128 },
    })
    expect(invalidMime.status()).toBe(415)
    const oversized = await page.request.post(`/api/private-images?${new URLSearchParams({
      dex: nationalDexNumber.toString().padStart(4, '0'),
      entry: '1',
    })}`, {
      data: { mimeType: 'image/png', byteSize: 5 * 1024 * 1024 + 1 },
    })
    expect(oversized.status()).toBe(413)

    const png = await sharp({
      create: { width: 1400, height: 700, channels: 3, background: '#7357d9' },
    }).png().withMetadata({ orientation: 6 }).toBuffer()
    await page.getByLabel('이미지 선택').setInputFiles({
      name: 'eevee.png',
      mimeType: 'image/png',
      buffer: png,
    })
    await expect(page.getByText('비공개 이미지를 저장했습니다.')).toBeVisible()
    await expect(portrait).not.toHaveAttribute('src', '/silhouettes/default.svg')
    expect(page.url()).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)
    const access = await page.request.get(`/api/private-images?${new URLSearchParams({
      dex: nationalDexNumber.toString().padStart(4, '0'),
      entry: '1',
    })}`)
    expect(access.status()).toBe(200)
    expect(await access.json()).toMatchObject({ expiresIn: 300 })

    const metadata = await admin.from('owned_pokemon_images')
      .select('mime_type, width, height, byte_size')
      .eq('owned_pokemon_id', pokemonId)
      .single()
    if (metadata.error) throw metadata.error
    expect(metadata.data).toMatchObject({ mime_type: 'image/webp', width: 512, height: 1024 })
    expect(metadata.data.byte_size).toBeGreaterThan(0)

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: '등록 이미지 삭제' }).click()
    await expect(page.getByText('비공개 이미지를 삭제했습니다.')).toBeVisible()
    await expect(portrait).toHaveAttribute('src', '/silhouettes/default.svg')
  })
})
