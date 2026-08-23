// @vitest-environment node

import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

type LocalEnvironment = { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string }
type Identity = { client: SupabaseClient; id: string }

const bucket = 'private-pokemon-images'
const userIds: string[] = []
let admin: SupabaseClient
let alice: Identity
let bob: Identity
let speciesId = ''
let formId = ''
let pokemonId = ''
let objectPath = ''
let webp: Buffer

describe('사용자별 비공개 포켓몬 이미지', () => {
  beforeAll(async () => {
    const environment = readLocalEnvironment()
    admin = createClient(environment.API_URL, environment.SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    alice = await createIdentity(environment, 'image-alice')
    bob = await createIdentity(environment, 'image-bob')

    const species = await admin.from('reference_species').insert({
      identifier: `image-eevee-${randomUUID()}`,
      national_dex_number: 133,
      name_ko: '이브이',
      description_ko: '이미지 권한 시험용',
    }).select('id').single()
    if (species.error) throw species.error
    speciesId = species.data.id

    const form = await admin.from('reference_forms').insert({
      identifier: `image-eevee-form-${randomUUID()}`,
      species_id: speciesId,
      name_ko: '기본 모습',
      is_default: true,
    }).select('id').single()
    if (form.error) throw form.error
    formId = form.data.id

    const pokemon = await admin.from('owned_pokemon').insert({
      user_id: alice.id,
      species_id: speciesId,
      form_id: formId,
      gender: 'female',
      level: 5,
    }).select('id').single()
    if (pokemon.error) throw pokemon.error
    pokemonId = pokemon.data.id
    objectPath = `${alice.id}/${pokemonId}/portrait.webp`
    webp = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#4477aa' },
    }).webp().toBuffer()
  })

  afterAll(async () => {
    if (objectPath) await admin.storage.from(bucket).remove([objectPath])
    if (pokemonId) await admin.from('owned_pokemon').delete().eq('id', pokemonId)
    for (const id of userIds) await admin.auth.admin.deleteUser(id)
    if (formId) await admin.from('reference_forms').delete().eq('id', formId)
    if (speciesId) await admin.from('reference_species').delete().eq('id', speciesId)
  })

  it('소유자는 정해진 경로에 WebP를 올리고 내려받을 수 있다', async () => {
    const uploaded = await alice.client.storage.from(bucket).upload(objectPath, webp, {
      contentType: 'image/webp',
      upsert: true,
    })
    expect(uploaded.error).toBeNull()

    const downloaded = await alice.client.storage.from(bucket).download(objectPath)
    expect(downloaded.error).toBeNull()
    expect(downloaded.data?.size).toBeGreaterThan(0)
  })

  it('다른 사용자는 객체를 조회하거나 서명 URL을 만들 수 없다', async () => {
    const downloaded = await bob.client.storage.from(bucket).download(objectPath)
    const signed = await bob.client.storage.from(bucket).createSignedUrl(objectPath, 300)
    const listed = await bob.client.storage.from(bucket).list(`${alice.id}/${pokemonId}`)

    expect(downloaded.error).not.toBeNull()
    expect(signed.error).not.toBeNull()
    expect(listed.data).toEqual([])
  })

  it('소유자도 규칙 밖의 경로와 MIME 형식으로 업로드할 수 없다', async () => {
    const wrongPath = await alice.client.storage.from(bucket).upload(
      `${alice.id}/${pokemonId}/other.webp`,
      webp,
      { contentType: 'image/webp' },
    )
    const wrongMime = await alice.client.storage.from(bucket).upload(
      `${alice.id}/${pokemonId}/portrait.png`,
      webp,
      { contentType: 'image/png' },
    )

    expect(wrongPath.error).not.toBeNull()
    expect(wrongMime.error).not.toBeNull()
  })
})

function readLocalEnvironment(): LocalEnvironment {
  const cliPath = resolve(process.cwd(), 'node_modules/supabase/dist/supabase.js')
  const result = spawnSync(process.execPath, [cliPath, 'status', '-o', 'env'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
  if (result.status !== 0) throw new Error('로컬 Supabase가 실행 중이어야 합니다.')
  const values = Object.fromEntries(
    result.stdout
      .split(/\r?\n/u)
      .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/u))
      .filter((match): match is RegExpMatchArray => match !== null)
      .map((match) => [match[1], match[2]]),
  )
  for (const name of ['API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY'] as const) {
    if (!values[name]) throw new Error(`로컬 Supabase에서 ${name} 값을 찾지 못했습니다.`)
  }
  return values as LocalEnvironment
}

async function createIdentity(environment: LocalEnvironment, label: string): Promise<Identity> {
  const email = `${label}-${randomUUID()}@example.test`
  const password = `Image-${randomUUID()}-A1!`
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (created.error || !created.data.user) throw created.error ?? new Error('사용자 생성 실패')
  userIds.push(created.data.user.id)
  const client = createClient(environment.API_URL, environment.ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const signedIn = await client.auth.signInWithPassword({ email, password })
  if (signedIn.error) throw signedIn.error
  return { client, id: created.data.user.id }
}
