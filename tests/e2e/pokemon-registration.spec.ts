import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

const suffix = Date.now().toString(36)
const email = `pokemon-${suffix}@example.com`
const password = 'Local-test-password-2026!'
const teraTypeNamesKo = [
  '노말', '격투', '비행', '독', '땅', '바위', '벌레', '고스트', '강철', '불꽃',
  '물', '풀', '전기', '에스퍼', '얼음', '드래곤', '악', '페어리', '스텔라',
] as const
const teraTypeIdentifiers = [
  'normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel', 'fire',
  'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark', 'fairy', 'stellar',
] as const
let admin: SupabaseClient
let userId = ''
let nationalDexNumber = 0
let targetNationalDexNumber = 0
let publicationId = ''
let previousActivePublicationId = ''
let typeId = ''
let speciesId = ''
let formId = ''
let alternateFormId = ''
let gigantamaxFormId = ''
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
let waterTeraTypeId = ''
let stellarTeraTypeId = ''
let teraTypeIds: string[] = []

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

    const previousActive = await admin
      .from('data_publications')
      .select('id')
      .eq('status', 'active')
      .maybeSingle()
    if (previousActive.error) throw previousActive.error
    previousActivePublicationId = previousActive.data?.id ?? ''
    if (previousActivePublicationId) {
      const retired = await admin
        .from('data_publications')
        .update({ status: 'retired' })
        .eq('id', previousActivePublicationId)
      if (retired.error) throw retired.error
    }

    const publication = await admin
      .from('data_publications')
      .insert({
        version: `registration-e2e-${suffix}`,
        status: 'active',
        validated_at: new Date().toISOString(),
        activated_at: new Date().toISOString(),
      })
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

    const teraTypes = await admin
      .from('reference_tera_types')
      .insert(teraTypeIdentifiers.map((identifier, sortOrder) => ({
        publication_id: publicationId,
        identifier: `${identifier}-${suffix}`,
        name_ko: teraTypeNamesKo[sortOrder],
        reference_type_id: identifier === 'water' ? typeId : null,
        sort_order: sortOrder,
      })))
      .select('id,identifier')
    if (teraTypes.error) throw teraTypes.error
    if (teraTypes.data.length !== 19) throw new Error('E2E 테라타입 19개 픽스처 생성 실패')
    teraTypeIds = teraTypes.data.map((teraType) => teraType.id)
    waterTeraTypeId = teraTypes.data.find(
      (teraType) => teraType.identifier === `water-${suffix}`,
    )?.id ?? ''
    stellarTeraTypeId = teraTypes.data.find(
      (teraType) => teraType.identifier === `stellar-${suffix}`,
    )?.id ?? ''
    if (!waterTeraTypeId || !stellarTeraTypeId) {
      throw new Error('E2E 물·스텔라 테라타입 픽스처 생성 실패')
    }

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
        publication_id: publicationId,
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
        publication_id: publicationId,
        identifier: `vaporeon-default-${suffix}`,
        species_id: speciesId,
        name_ko: '기본 모습',
        is_default: true,
        base_hp: 130,
        base_attack: 65,
        base_defense: 60,
        base_special_attack: 110,
        base_special_defense: 95,
        base_speed: 65,
        is_battle_only: false,
      })
      .select('id')
      .single()
    if (form.error) throw form.error
    formId = form.data.id

    const alternateForm = await admin
      .from('reference_forms')
      .insert({
        publication_id: publicationId,
        identifier: `vaporeon-wave-${suffix}`,
        species_id: speciesId,
        base_form_id: formId,
        name_ko: '물결 모습',
        is_default: false,
        base_hp: 130,
        base_attack: 65,
        base_defense: 60,
        base_special_attack: 110,
        base_special_defense: 95,
        base_speed: 65,
        is_battle_only: false,
      })
      .select('id')
      .single()
    if (alternateForm.error) throw alternateForm.error
    alternateFormId = alternateForm.data.id

    const gigantamaxForm = await admin
      .from('reference_forms')
      .insert({
        publication_id: publicationId,
        identifier: `vaporeon-gmax-${suffix}`,
        species_id: speciesId,
        base_form_id: formId,
        name_ko: '거다이맥스 모습',
        is_default: false,
        base_hp: 130,
        base_attack: 65,
        base_defense: 60,
        base_special_attack: 110,
        base_special_defense: 95,
        base_speed: 65,
        is_battle_only: true,
      })
      .select('id')
      .single()
    if (gigantamaxForm.error) throw gigantamaxForm.error
    gigantamaxFormId = gigantamaxForm.data.id

    const battleOptions = await Promise.all([
      admin.from('reference_form_tera_options').insert([
        { publication_id: publicationId, form_id: formId, tera_type_id: waterTeraTypeId },
        { publication_id: publicationId, form_id: formId, tera_type_id: stellarTeraTypeId },
        { publication_id: publicationId, form_id: alternateFormId, tera_type_id: stellarTeraTypeId },
      ]),
      admin.from('reference_form_gigantamax_options').insert({
        publication_id: publicationId,
        source_form_id: formId,
        gigantamax_form_id: gigantamaxFormId,
      }),
    ])
    for (const result of battleOptions) {
      if (result.error) throw result.error
    }

    const targetSpecies = await admin
      .from('reference_species')
      .insert({
        publication_id: publicationId,
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
        publication_id: publicationId,
        identifier: `jolteon-default-${suffix}`,
        species_id: targetSpeciesId,
        name_ko: '기본 모습',
        is_default: true,
        base_hp: 65,
        base_attack: 65,
        base_defense: 60,
        base_special_attack: 110,
        base_special_defense: 95,
        base_speed: 130,
        is_battle_only: false,
      })
      .select('id')
      .single()
    if (targetForm.error) throw targetForm.error
    targetFormId = targetForm.data.id

    const evolutionRule = await admin
      .from('reference_evolution_rules')
      .insert({
        publication_id: publicationId,
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
      .insert({
        publication_id: publicationId,
        identifier: `jolly-${suffix}`,
        name_ko: '명랑',
        increased_stat: 'speed',
        decreased_stat: 'special_attack',
      })
      .select('id')
      .single()
    if (nature.error) throw nature.error
    natureId = nature.data.id

    const ability = await admin
      .from('reference_abilities')
      .insert({
        publication_id: publicationId,
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
        publication_id: publicationId,
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
          publication_id: publicationId,
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
          publication_id: publicationId,
          identifier: `ice-beam-${suffix}`,
          name_ko: '냉동빔',
          description_ko: '차가운 광선으로 상대를 공격한다.',
          type_id: typeId,
          damage_class: 'special',
          power: 90,
          accuracy: 100,
          pp: null,
        },
        {
          publication_id: publicationId,
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
        publication_id: publicationId,
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
    const formIds = [gigantamaxFormId, alternateFormId, targetFormId, formId].filter(Boolean)
    const speciesIds = [targetSpeciesId, speciesId].filter(Boolean)
    const abilityIds = [disallowedAbilityId, abilityId].filter(Boolean)
    const cleanupSteps: CleanupStep[] = [
      cleanupStep('인증 사용자 삭제', Boolean(userId), () => admin.auth.admin.deleteUser(userId)),
      cleanupStep('감사 이벤트 삭제', Boolean(userId), () => (
        admin.from('audit_events').delete().eq('user_id', userId)
      )),
      cleanupStep('시험 게시본 은퇴', Boolean(publicationId), () => (
        admin.from('data_publications').update({ status: 'retired' }).eq('id', publicationId)
      )),
      cleanupStep('기존 게시본 복구', Boolean(previousActivePublicationId), () => (
        admin.from('data_publications')
          .update({ status: 'active' })
          .eq('id', previousActivePublicationId)
      )),
      cleanupStep('진화 규칙 삭제', Boolean(evolutionRuleId), () => (
        admin.from('reference_evolution_rules').delete().eq('id', evolutionRuleId)
      )),
      cleanupStep('거다이맥스 관계 삭제', Boolean(publicationId), () => (
        admin.from('reference_form_gigantamax_options').delete().eq('publication_id', publicationId)
      )),
      cleanupStep('폼 테라 관계 삭제', Boolean(publicationId), () => (
        admin.from('reference_form_tera_options').delete().eq('publication_id', publicationId)
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
      cleanupStep('테라타입 삭제', teraTypeIds.length > 0, () => (
        admin.from('reference_tera_types').delete().in('id', teraTypeIds)
      )),
      cleanupStep('거다이맥스 폼 삭제', Boolean(gigantamaxFormId), () => (
        admin.from('reference_forms').delete().eq('id', gigantamaxFormId)
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
      residueStep('거다이맥스 관계 잔존', Boolean(publicationId), async () => {
        const result = await admin
          .from('reference_form_gigantamax_options')
          .select('source_form_id', { count: 'exact', head: true })
          .eq('publication_id', publicationId)
        return { error: result.error, residue: result.count ?? 0 }
      }),
      residueStep('폼 테라 관계 잔존', Boolean(publicationId), async () => {
        const result = await admin
          .from('reference_form_tera_options')
          .select('form_id', { count: 'exact', head: true })
          .eq('publication_id', publicationId)
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
      residueStep('테라타입 잔존', teraTypeIds.length > 0, async () => {
        const result = await admin
          .from('reference_tera_types')
          .select('id', { count: 'exact', head: true })
          .in('id', teraTypeIds)
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
      residueStep('기존 active 게시본 미복구', Boolean(previousActivePublicationId), async () => {
        const result = await admin
          .from('data_publications')
          .select('id', { count: 'exact', head: true })
          .eq('id', previousActivePublicationId)
          .eq('status', 'active')
        return { error: result.error, residue: result.count === 1 ? 0 : 1 }
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
    await expect(page.getByText('테라타입: 물')).toHaveCount(2)
    await expect(page.getByText('거다이맥스 가능')).toHaveCount(2)

    await expectNoInternalIdentifiers(page)

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
    await expect(page.getByRole('option', { name: '저수 · 숨겨진 특성' })).toBeAttached()
    await expect(page.getByRole('option', { name: '촉촉바디' })).toHaveCount(0)
    await expect(page.getByLabel('테라타입').locator('option:checked')).toHaveText('물')
    await expect(page.getByRole('checkbox', { name: '거다이맥스 인자 보유' })).toBeChecked()

    const detailStats = page.getByRole('table', { name: '보유 포켓몬 능력치' })
    await expect(detailStats.getByRole('row', { name: /HP 130 0 31 0 244/ })).toBeVisible()
    await expect(detailStats.getByRole('row', { name: /공격 65 0 31 252 139/ })).toBeVisible()
    await expect(detailStats.getByRole('row', { name: /방어 60 0 31 0 95/ })).toBeVisible()
    await expect(detailStats.getByRole('row', { name: /특공 110 0 31 0 139/ })).toBeVisible()
    await expect(detailStats.getByRole('row', { name: /특방 95 0 31 4 138/ })).toBeVisible()
    await expect(detailStats.getByRole('row', { name: /스피드 65 0 31 252 152/ })).toBeVisible()
    await expect(page.getByRole('article', { name: '파도타기' }).filter({ hasText: '현재 기술 1' }))
      .toContainText('기본 PP: 15')
    await expect(page.getByRole('article', { name: '냉동빔' }).filter({ hasText: '현재 기술 2' }))
      .toContainText('기본 PP: 확인 불가')
    await expectNoInternalIdentifiers(page)

    await page.getByLabel('테라타입').selectOption({ label: '스텔라' })
    await page.getByRole('checkbox', { name: '거다이맥스 인자 보유' }).uncheck()

    await page.getByLabel('빠른 수정 레벨').fill('61')
    await page.getByLabel('메모').fill('특수공격 중심 육성')
    await page.getByRole('button', { name: '빠른 수정 저장' }).click()
    await expect(page.getByText('Lv. 61')).toBeVisible()
    await expect(page.getByRole('paragraph').filter({ hasText: '특수공격 중심 육성' })).toBeVisible()
    await expect(page.getByLabel('저장된 전투 설정')).toContainText('테라타입: 스텔라')
    await expect(page.getByLabel('저장된 전투 설정')).toContainText('거다이맥스 불가능')

    await page.getByLabel('테라타입').selectOption({ label: '물' })
    await page.getByRole('checkbox', { name: '거다이맥스 인자 보유' }).check()
    await page.getByRole('button', { name: '빠른 수정 저장' }).click()
    await expect(page.getByLabel('저장된 전투 설정')).toContainText('테라타입: 물')
    await expect(page.getByLabel('저장된 전투 설정')).toContainText('거다이맥스 가능')

    await page.getByRole('button', { name: '보호 정보 정정 열기' }).click()
    await page.getByLabel('정정 모습').selectOption({ label: '물결 모습' })
    await page.getByLabel('정정 사유').fill('잘못 입력한 모습 정보를 정정함')
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: '정정 저장' }).click()
    await expect(page).toHaveURL(/\/my-pokemon$/)

    const formCorrected = await admin
      .from('owned_pokemon')
      .select('id,form_id,ability_id,tera_type_id,has_gigantamax_factor')
      .eq('user_id', userId)
      .eq('nickname', '파도')
      .single()
    if (formCorrected.error) throw formCorrected.error
    const retainedMoves = await admin
      .from('owned_pokemon_moves')
      .select('move_id,kind,slot,target_condition_ko')
      .eq('owned_pokemon_id', formCorrected.data.id)
      .order('kind')
      .order('slot')
    if (retainedMoves.error) throw retainedMoves.error
    const formAudit = await admin
      .from('audit_events')
      .select('before_data,after_data,reason_ko')
      .eq('entity_id', formCorrected.data.id)
      .eq('action', 'correct')
      .single()
    if (formAudit.error) throw formAudit.error

    expect(formCorrected.data).toMatchObject({
      form_id: alternateFormId,
      ability_id: null,
      tera_type_id: null,
      has_gigantamax_factor: false,
    })
    expect(retainedMoves.data).toHaveLength(4)
    expect(formAudit.data).toMatchObject({
      reason_ko: '잘못 입력한 모습 정보를 정정함',
      before_data: {
        tera_type_id: waterTeraTypeId,
        has_gigantamax_factor: true,
        dependent_state: { ability_id: abilityId, moves: expect.any(Array) },
      },
      after_data: {
        tera_type_id: null,
        has_gigantamax_factor: false,
        dependent_state: { ability_id: null, moves: expect.any(Array) },
      },
    })
    expect((formAudit.data.after_data as { dependent_state?: { moves?: unknown[] } })
      .dependent_state?.moves).toHaveLength(4)

    await page.getByRole('link', { name: /파도 상세 보기/ }).click()
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
      .select('id,species_id,form_id,ability_id')
      .eq('user_id', userId)
      .eq('nickname', '파도')
      .single()
    if (owned.error) throw owned.error
    const clearedMoves = await admin
      .from('owned_pokemon_moves')
      .select('id')
      .eq('owned_pokemon_id', owned.data.id)
    if (clearedMoves.error) throw clearedMoves.error
    const audits = await admin
      .from('audit_events')
      .select('action, reason_ko, before_data, after_data')
      .eq('entity_id', owned.data.id)
      .eq('action', 'correct')
      .order('id')
    if (audits.error) throw audits.error
    expect(owned.data).toMatchObject({
      species_id: targetSpeciesId,
      form_id: targetFormId,
      ability_id: null,
    })
    expect(clearedMoves.data).toEqual([])
    expect(audits.data).toHaveLength(2)
    expect(audits.data[1]).toMatchObject({
      reason_ko: '종과 초기 포획일 입력 오류 정정',
      before_data: {
        captured_on: null,
        species_id: speciesId,
        dependent_state: { ability_id: null, moves: expect.any(Array) },
      },
      after_data: {
        captured_on: '2026-08-17',
        species_id: targetSpeciesId,
        dependent_state: { ability_id: null, moves: [] },
      },
    })
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
  await expect(page.getByRole('option', { name: '기본 모습' })).toBeAttached()
  await expect(page.getByRole('option', { name: '물결 모습' })).toBeAttached()
  await expect(page.getByRole('option', { name: '거다이맥스 모습' })).toHaveCount(0)
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
  await expect(page.getByLabel('테라타입').getByRole('option')).toHaveCount(3)
  await expect(page.getByRole('option', { name: '물', exact: true })).toBeAttached()
  await expect(page.getByRole('option', { name: '스텔라', exact: true })).toBeAttached()
  await expect(page.getByRole('option', { name: '불꽃', exact: true })).toHaveCount(0)
  await page.getByLabel('테라타입').selectOption({ label: '물' })
  await expect(page.getByRole('checkbox', { name: '거다이맥스 인자 보유' })).toBeEnabled()
  await page.getByRole('checkbox', { name: '거다이맥스 인자 보유' }).check()

  if (verifyReconciliation) {
    await page.getByRole('button', { name: '이전' }).click()
    await page.getByRole('button', { name: '이전' }).click()
    await page.getByLabel('모습', { exact: true }).selectOption({ label: '물결 모습' })
    await page.getByRole('button', { name: '다음' }).click()
    await page.getByRole('button', { name: '다음' }).click()
    await expect(page.getByLabel('특성', { exact: true })).toHaveValue('')
    await expect(page.getByRole('option', { name: '저수 · 숨겨진 특성' })).toHaveCount(0)
    await expect(page.getByRole('option', { name: '촉촉바디' })).toBeAttached()
    await expect(page.getByText('거다이맥스 불가능')).toBeVisible()
    await expect(page.getByRole('checkbox', { name: '거다이맥스 인자 보유' })).toBeDisabled()
    await expect(page.getByRole('checkbox', { name: '거다이맥스 인자 보유' })).not.toBeChecked()
    await page.getByRole('button', { name: '이전' }).click()
    await page.getByRole('button', { name: '이전' }).click()
    await page.getByLabel('모습', { exact: true }).selectOption({ label: '기본 모습' })
    await page.getByRole('button', { name: '다음' }).click()
    await page.getByRole('button', { name: '다음' }).click()
    await page.getByLabel('특성', { exact: true }).selectOption({ label: '저수 · 숨겨진 특성' })
    await page.getByLabel('테라타입').selectOption({ label: '물' })
    await page.getByRole('checkbox', { name: '거다이맥스 인자 보유' }).check()
  }
  await page.getByRole('button', { name: '다음' }).click()

  await expect(page.getByText('4 / 7단계')).toBeVisible()
  for (const statName of ['HP', '공격', '방어', '특수공격', '특수방어', '스피드']) {
    await page.getByLabel(`실전 ${statName} IV`).fill('31')
  }
  await expect(page.getByLabel('HP 종족값')).toHaveValue('130')
  await expect(page.getByLabel('공격 종족값', { exact: true })).toHaveValue('65')
  await expect(page.getByLabel('방어 종족값', { exact: true })).toHaveValue('60')
  await expect(page.getByLabel('특수공격 종족값', { exact: true })).toHaveValue('110')
  await expect(page.getByLabel('특수방어 종족값', { exact: true })).toHaveValue('95')
  await expect(page.getByLabel('스피드 종족값', { exact: true })).toHaveValue('65')
  await page.getByRole('button', { name: '다음' }).click()

  await expect(page.getByText('5 / 7단계')).toBeVisible()
  await page.getByLabel('공격 EV', { exact: true }).fill('252')
  await page.getByLabel('특수방어 EV', { exact: true }).fill('4')
  await page.getByLabel('스피드 EV', { exact: true }).fill('252')
  const liveStats = page.getByRole('table', { name: '등록 중 능력치' })
  await expect(liveStats.getByRole('row', { name: /HP 130 0 31 0 244/ })).toBeVisible()
  await expect(liveStats.getByRole('row', { name: /공격 65 0 31 252 139/ })).toBeVisible()
  await expect(liveStats.getByRole('row', { name: /방어 60 0 31 0 95/ })).toBeVisible()
  await expect(liveStats.getByRole('row', { name: /특공 110 0 31 0 139/ })).toBeVisible()
  await expect(liveStats.getByRole('row', { name: /특방 95 0 31 4 138/ })).toBeVisible()
  await expect(liveStats.getByRole('row', { name: /스피드 65 0 31 252 152/ })).toBeVisible()
  await page.getByRole('button', { name: '다음' }).click()

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
  const currentMoves = page.getByRole('group', { name: '현재 기술' })
  await expect(currentMoves.getByRole('article', { name: '파도타기' })).toContainText('기본 PP: 15')
  await expect(currentMoves.getByRole('article', { name: '냉동빔' })).toContainText('기본 PP: 확인 불가')

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
    await page.getByLabel('테라타입').selectOption({ label: '물' })
    await page.getByRole('checkbox', { name: '거다이맥스 인자 보유' }).check()
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
  await expect(page.getByText('테라타입: 물')).toBeVisible()
  await expect(page.getByText('거다이맥스 가능')).toBeVisible()
  const finalStats = page.getByRole('table', { name: '최종 능력치' })
  await expect(finalStats.getByRole('row', { name: /HP 130 0 31 0 244/ })).toBeVisible()
  await expect(finalStats.getByRole('row', { name: /스피드 65 0 31 252 152/ })).toBeVisible()
  await expect(page.getByRole('article', { name: '파도타기' }).filter({ hasText: '현재 기술 1' }))
    .toContainText('기본 PP: 15')
  await expect(page.getByRole('article', { name: '냉동빔' }).filter({ hasText: '현재 기술 2' }))
    .toContainText('기본 PP: 확인 불가')
  await expectNoInternalIdentifiers(page)
  await page.getByRole('button', { name: '등록 완료' }).click()
  await expect(page).toHaveURL(/\/my-pokemon$/)
}

function formatDex(value: number) {
  return String(value).padStart(4, '0')
}

async function expectNoInternalIdentifiers(page: import('@playwright/test').Page) {
  const visibleText = await page.locator('body').innerText()
  expect(visibleText).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)
  expect(page.url()).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)
  for (const identifier of [
    typeId, speciesId, formId, alternateFormId, gigantamaxFormId,
    targetSpeciesId, targetFormId, natureId, abilityId, disallowedAbilityId,
    itemId, allowedMoveId, secondAllowedMoveId, otherSpeciesMoveId,
    ...teraTypeIds,
  ].filter(Boolean)) {
    expect(visibleText).not.toContain(identifier)
  }
  expect(visibleText).not.toMatch(new RegExp(`[a-z][a-z0-9-]*-${suffix}`, 'iu'))
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
