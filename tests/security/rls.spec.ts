// @vitest-environment node

import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

type LocalSupabaseEnvironment = {
  API_URL: string
  ANON_KEY: string
  SERVICE_ROLE_KEY: string
}

type TestIdentity = {
  client: SupabaseClient
  id: string
}

const describeLocalSupabase = process.env.RUN_SUPABASE_INTEGRATION === '1' ? describe : describe.skip

const identities: string[] = []
let admin: SupabaseClient
let alice: TestIdentity
let bob: TestIdentity
let speciesId: string
let formId: string
let gigantamaxFormId: string
let pokemonId: string
let anonymous: SupabaseClient
let previousActivePublicationId: string | null = null
const referencePublicationId = randomUUID()
const retiredReferencePublicationId = randomUUID()
const activeTeraTypeId = randomUUID()
const retiredTeraTypeId = randomUUID()

function readLocalSupabaseEnvironment(): LocalSupabaseEnvironment {
  const cliPath = resolve(process.cwd(), 'node_modules/supabase/dist/supabase.js')
  const result = spawnSync(process.execPath, [cliPath, 'status', '-o', 'env'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    throw new Error(
      `로컬 Supabase가 실행 중이어야 합니다. 먼저 \`pnpm supabase start\`를 실행하세요.\n${result.stderr}`,
    )
  }

  const values = Object.fromEntries(
    result.stdout
      .split(/\r?\n/u)
      .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/u))
      .filter((match): match is RegExpMatchArray => match !== null)
      .map((match) => [match[1], match[2]]),
  )

  for (const name of ['API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY'] as const) {
    if (!values[name]) {
      throw new Error(`Supabase 로컬 환경에서 ${name} 값을 찾지 못했습니다.`)
    }
  }

  return values as LocalSupabaseEnvironment
}

async function createIdentity(
  environment: LocalSupabaseEnvironment,
  label: string,
): Promise<TestIdentity> {
  const email = `${label}-${randomUUID()}@example.test`
  const password = `Rls-${randomUUID()}-A1!`
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (created.error || !created.data.user) {
    throw created.error ?? new Error(`${label} 시험 사용자를 만들지 못했습니다.`)
  }

  identities.push(created.data.user.id)

  const client = createClient(environment.API_URL, environment.ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const signedIn = await client.auth.signInWithPassword({ email, password })

  if (signedIn.error) {
    throw signedIn.error
  }

  return { client, id: created.data.user.id }
}

describeLocalSupabase('사용자별 보유 포켓몬 RLS', () => {
  beforeAll(async () => {
    const environment = readLocalSupabaseEnvironment()
    admin = createClient(environment.API_URL, environment.SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    anonymous = createClient(environment.API_URL, environment.ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    alice = await createIdentity(environment, 'alice')
    bob = await createIdentity(environment, 'bob')

    const previousActive = await admin.from('data_publications').select('id').eq('status', 'active').maybeSingle()
    expect(previousActive.error).toBeNull()
    previousActivePublicationId = previousActive.data?.id ?? null
    if (previousActivePublicationId) {
      expect((await admin.from('data_publications').update({ status: 'retired' })
        .eq('id', previousActivePublicationId)).error).toBeNull()
    }
    expect((await admin.from('data_publications').insert([
      { id: referencePublicationId, version: `rls-active-${referencePublicationId}`, status: 'active', validated_at: new Date().toISOString(), activated_at: new Date().toISOString() },
      { id: retiredReferencePublicationId, version: `rls-retired-${retiredReferencePublicationId}`, status: 'retired' },
    ])).error).toBeNull()
    expect((await admin.from('reference_tera_types').insert([
      { id: activeTeraTypeId, publication_id: referencePublicationId, identifier: `rls-active-tera-${activeTeraTypeId}`, name_ko: '노말', sort_order: 0 },
      { id: retiredTeraTypeId, publication_id: retiredReferencePublicationId, identifier: `rls-retired-tera-${retiredTeraTypeId}`, name_ko: '스텔라', sort_order: 0 },
    ])).error).toBeNull()

    speciesId = randomUUID()
    formId = randomUUID()
    const referenceData = await admin.from('reference_species').insert({
      id: speciesId,
      publication_id: referencePublicationId,
      national_dex_number: 9001,
      identifier: `eevee-${speciesId}`,
      name_ko: '이브이',
      description_ko: '다양한 모습으로 진화할 가능성을 지닌 포켓몬.',
    })
    expect(referenceData.error).toBeNull()

    const formData = await admin.from('reference_forms').insert({
      id: formId,
      publication_id: referencePublicationId,
      species_id: speciesId,
      identifier: `eevee-normal-${formId}`,
      name_ko: '이브이',
      is_default: true,
      is_battle_only: false,
    })
    expect(formData.error).toBeNull()
    gigantamaxFormId = randomUUID()
    expect((await admin.from('reference_forms').insert({
      id: gigantamaxFormId,
      publication_id: referencePublicationId,
      species_id: speciesId,
      identifier: `eevee-gmax-${gigantamaxFormId}`,
      name_ko: '이브이 거다이맥스',
      is_default: false,
      is_battle_only: true,
    })).error).toBeNull()
    expect((await admin.from('reference_form_tera_options').insert({
      publication_id: referencePublicationId,
      form_id: formId,
      tera_type_id: activeTeraTypeId,
    })).error).toBeNull()
    expect((await admin.from('reference_form_gigantamax_options').insert({
      publication_id: referencePublicationId,
      source_form_id: formId,
      gigantamax_form_id: gigantamaxFormId,
    })).error).toBeNull()

    pokemonId = randomUUID()
    const inserted = await alice.client.from('owned_pokemon').insert({
      id: pokemonId,
      user_id: alice.id,
      species_id: speciesId,
      form_id: formId,
      nickname: '첫 이브이',
      gender: 'female',
      level: 12,
    })
    expect(inserted.error).toBeNull()
  })

  afterAll(async () => {
    if (admin) {
      const failures: string[] = []
      const collect = (label: string, error: { message?: string } | null) => {
        if (error) failures.push(`${label}: ${error.message ?? '알 수 없는 오류'}`)
      }
      for (const id of identities) {
        const deleted = await admin.auth.admin.deleteUser(id)
        collect('사용자 삭제', deleted.error)
      }
      collect('테라 옵션 삭제', (await admin.from('reference_form_tera_options').delete().in('publication_id', [referencePublicationId, retiredReferencePublicationId])).error)
      collect('거다이맥스 옵션 삭제', (await admin.from('reference_form_gigantamax_options').delete().in('publication_id', [referencePublicationId, retiredReferencePublicationId])).error)
      collect('테라 타입 삭제', (await admin.from('reference_tera_types').delete().in('publication_id', [referencePublicationId, retiredReferencePublicationId])).error)
      collect('모습 삭제', (await admin.from('reference_forms').delete().in('id', [formId, gigantamaxFormId])).error)
      collect('종 삭제', (await admin.from('reference_species').delete().eq('id', speciesId)).error)
      collect('시험 게시본 은퇴', (await admin.from('data_publications').update({ status: 'retired' }).eq('id', referencePublicationId)).error)
      collect('시험 게시본 삭제', (await admin.from('data_publications').delete().in('id', [referencePublicationId, retiredReferencePublicationId])).error)
      if (previousActivePublicationId) collect('기존 게시본 복구', (await admin.from('data_publications').update({ status: 'active' }).eq('id', previousActivePublicationId)).error)
      const residue = await Promise.all([
        admin.from('reference_form_tera_options').select('form_id', { count: 'exact', head: true }).in('publication_id', [referencePublicationId, retiredReferencePublicationId]),
        admin.from('reference_form_gigantamax_options').select('source_form_id', { count: 'exact', head: true }).in('publication_id', [referencePublicationId, retiredReferencePublicationId]),
        admin.from('reference_tera_types').select('id', { count: 'exact', head: true }).in('publication_id', [referencePublicationId, retiredReferencePublicationId]),
        admin.from('reference_forms').select('id', { count: 'exact', head: true }).in('id', [formId, gigantamaxFormId]),
        admin.from('data_publications').select('id', { count: 'exact', head: true }).in('id', [referencePublicationId, retiredReferencePublicationId]),
      ])
      residue.forEach((result, index) => {
        collect(`잔존 조회 ${index + 1}`, result.error)
        if ((result.count ?? 0) > 0) failures.push(`잔존 조회 ${index + 1}: ${result.count}개`)
      })
      if (failures.length) throw new Error(`RLS 픽스처 정리 실패\n${failures.join('\n')}`)
    }
  })

  it('본인 행만 조회한다', async () => {
    const aliceRows = await alice.client.from('owned_pokemon').select('id,nickname')
    const bobRows = await bob.client.from('owned_pokemon').select('id,nickname')

    expect(aliceRows.error).toBeNull()
    expect(aliceRows.data).toEqual([{ id: pokemonId, nickname: '첫 이브이' }])
    expect(bobRows.error).toBeNull()
    expect(bobRows.data).toEqual([])
  })

  it('다른 사용자의 행을 수정하거나 삭제하지 못한다', async () => {
    const quickUpdated = await bob.client.rpc('update_owned_pokemon_quick', {
      p_owned_pokemon_id: pokemonId,
      p_nickname: '가로챈 이브이',
      p_gender: 'female',
      p_level: 20,
      p_effective_nature_id: null,
      p_ability_id: null,
      p_effective_iv: {
        hp: 0, attack: 0, defense: 0,
        special_attack: 0, special_defense: 0, speed: 0,
      },
      p_ev: {
        hp: 0, attack: 0, defense: 0,
        special_attack: 0, special_defense: 0, speed: 0,
      },
      p_held_item_id: null,
      p_notes: '',
    })
    const corrected = await bob.client.rpc('correct_owned_pokemon', {
      p_owned_pokemon_id: pokemonId,
      p_species_id: speciesId,
      p_form_id: formId,
      p_captured_on: '2026-08-17',
      p_original_iv: {
        hp: 0,
        attack: 0,
        defense: 0,
        special_attack: 0,
        special_defense: 0,
        speed: 0,
      },
      p_reason_ko: '다른 사용자 정보 정정 시도',
    })
    const updated = await bob.client
      .from('owned_pokemon')
      .update({ nickname: '가로챈 이브이' })
      .eq('id', pokemonId)
      .select('id')
    const deleted = await bob.client.from('owned_pokemon').delete().eq('id', pokemonId).select('id')

    expect(quickUpdated.error?.code).toBe('42501')
    expect(corrected.error?.code).toBe('42501')
    expect(updated.error).toBeNull()
    expect(updated.data).toEqual([])
    expect(deleted.error).toBeNull()
    expect(deleted.data).toEqual([])

    const ownerRow = await alice.client
      .from('owned_pokemon')
      .select('nickname')
      .eq('id', pokemonId)
      .single()
    expect(ownerRow.data?.nickname).toBe('첫 이브이')
  })

  it('다른 사용자 ID로 행을 추가하지 못한다', async () => {
    const inserted = await bob.client.from('owned_pokemon').insert({
      user_id: alice.id,
      species_id: speciesId,
      form_id: formId,
      gender: 'male',
      level: 5,
    })

    expect(inserted.error?.code).toBe('42501')
  })

  it('공통 도감은 인증 사용자가 읽을 수 있지만 쓸 수 없다', async () => {
    const selected = await bob.client
      .from('reference_species')
      .select('national_dex_number,name_ko')
      .eq('id', speciesId)
      .single()
    const inserted = await bob.client.from('reference_species').insert({
      national_dex_number: 9999,
      identifier: `forbidden-${randomUUID()}`,
      name_ko: '금지된 포켓몬',
      description_ko: '일반 사용자는 공통 도감을 수정할 수 없습니다.',
    })

    expect(selected.error).toBeNull()
    expect(selected.data).toEqual({ national_dex_number: 9001, name_ko: '이브이' })
    expect(inserted.error?.code).toBe('42501')
  })

  it('전투 기준값과 양쪽 옵션은 활성 게시본만 인증 사용자에게 읽히며 anon·일반 쓰기·교체 실행은 거부된다', async () => {
    const visible = await bob.client.from('reference_tera_types')
      .select('id,name_ko').in('id', [activeTeraTypeId, retiredTeraTypeId]).order('id')
    const anonymousRead = await anonymous.from('reference_tera_types').select('id').eq('id', activeTeraTypeId)
    const userWrite = await bob.client.from('reference_tera_types').insert({
      publication_id: referencePublicationId,
      identifier: `rls-forbidden-${randomUUID()}`,
      name_ko: '금지',
      sort_order: 99,
    })
    const teraOptions = await bob.client.from('reference_form_tera_options').select('form_id,tera_type_id')
    const gigantamaxOptions = await bob.client.from('reference_form_gigantamax_options').select('source_form_id,gigantamax_form_id')
    const anonymousTeraOptions = await anonymous.from('reference_form_tera_options').select('form_id')
    const anonymousGigantamaxOptions = await anonymous.from('reference_form_gigantamax_options').select('source_form_id')
    const replacement = await bob.client.rpc('replace_pokemon_option_filter_reference_data', {
      p_publication_id: referencePublicationId,
      p_batch_id: randomUUID(),
    })

    expect(visible.error).toBeNull()
    expect(visible.data).toEqual([{ id: activeTeraTypeId, name_ko: '노말' }])
    expect(anonymousRead.error).not.toBeNull()
    expect(userWrite.error?.code).toBe('42501')
    expect(teraOptions.data).toEqual([{ form_id: formId, tera_type_id: activeTeraTypeId }])
    expect(gigantamaxOptions.data).toEqual([{ source_form_id: formId, gigantamax_form_id: gigantamaxFormId }])
    expect(anonymousTeraOptions.error).not.toBeNull()
    expect(anonymousGigantamaxOptions.error).not.toBeNull()
    expect(replacement.error?.code).toBe('42501')
  })

  it('보유 포켓몬이 있어도 계정을 삭제하고 감사 기록은 보존한다', async () => {
    const environment = readLocalSupabaseEnvironment()
    const departing = await createIdentity(environment, 'departing')
    const ownedId = randomUUID()
    const inserted = await departing.client.from('owned_pokemon').insert({
      id: ownedId,
      user_id: departing.id,
      species_id: speciesId,
      form_id: formId,
      gender: 'genderless',
      level: 5,
    })
    expect(inserted.error).toBeNull()

    const deleted = await admin.auth.admin.deleteUser(departing.id)
    expect(deleted.error).toBeNull()
    identities.splice(identities.indexOf(departing.id), 1)

    const ownedRows = await admin.from('owned_pokemon').select('id').eq('id', ownedId)
    const auditRows = await admin
      .from('audit_events')
      .select('action,entity_id')
      .eq('entity_id', ownedId)
      .order('id')

    expect(ownedRows.data).toEqual([])
    expect(auditRows.data).toEqual([
      { action: 'insert', entity_id: ownedId },
      { action: 'delete', entity_id: ownedId },
    ])
  })
})
