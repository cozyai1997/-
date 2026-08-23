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

const identities: string[] = []
let admin: SupabaseClient
let alice: TestIdentity
let bob: TestIdentity
let speciesId: string
let formId: string
let pokemonId: string

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

describe('사용자별 보유 포켓몬 RLS', () => {
  beforeAll(async () => {
    const environment = readLocalSupabaseEnvironment()
    admin = createClient(environment.API_URL, environment.SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    alice = await createIdentity(environment, 'alice')
    bob = await createIdentity(environment, 'bob')

    speciesId = randomUUID()
    formId = randomUUID()
    const referenceData = await admin.from('reference_species').insert({
      id: speciesId,
      national_dex_number: 9001,
      identifier: `eevee-${speciesId}`,
      name_ko: '이브이',
      description_ko: '다양한 모습으로 진화할 가능성을 지닌 포켓몬.',
    })
    expect(referenceData.error).toBeNull()

    const formData = await admin.from('reference_forms').insert({
      id: formId,
      species_id: speciesId,
      identifier: `eevee-normal-${formId}`,
      name_ko: '이브이',
      is_default: true,
    })
    expect(formData.error).toBeNull()

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
      for (const id of identities) {
        const deleted = await admin.auth.admin.deleteUser(id)
        expect(deleted.error).toBeNull()
      }
      if (formId) await admin.from('reference_forms').delete().eq('id', formId)
      if (speciesId) await admin.from('reference_species').delete().eq('id', speciesId)
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
