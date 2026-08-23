import { randomUUID } from 'node:crypto'

import { normalizePrivatePokemonImage, MAX_PRIVATE_IMAGE_BYTES } from '@/features/owned-pokemon/image-policy'
import { getOwnedPokemonDetail } from '@/features/owned-pokemon/repository'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const bucket = 'private-pokemon-images'
const signedUrlLifetimeSeconds = 300

export async function GET(request: Request) {
  const context = await authorizeLocator(request)
  if (context instanceof Response) return context

  const { data: image, error } = await context.client
    .from('owned_pokemon_images')
    .select('storage_path')
    .eq('owned_pokemon_id', context.pokemon.id)
    .maybeSingle()
  if (error) return jsonError('이미지 정보를 불러오지 못했습니다.', 500)
  if (!image) return jsonError('등록된 이미지가 없습니다.', 404)

  const signed = await context.client.storage
    .from(bucket)
    .createSignedUrl(image.storage_path, signedUrlLifetimeSeconds)
  if (signed.error) return jsonError('이미지 접근 주소를 만들지 못했습니다.', 404)

  return Response.json(
    { url: signed.data.signedUrl, expiresIn: signedUrlLifetimeSeconds },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}

export async function POST(request: Request) {
  const context = await authorizeLocator(request)
  if (context instanceof Response) return context

  const body = await readJson(request)
  if (!body) return jsonError('업로드 정보를 확인해 주세요.', 400)
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType : ''
  const byteSize = typeof body.byteSize === 'number' ? body.byteSize : 0
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
    return jsonError('JPEG, PNG, WebP 이미지만 업로드할 수 있습니다.', 415)
  }
  if (!Number.isInteger(byteSize) || byteSize < 1 || byteSize > MAX_PRIVATE_IMAGE_BYTES) {
    return jsonError('이미지는 5 MiB 이하만 업로드할 수 있습니다.', 413)
  }

  const path = `${context.userId}/${context.pokemon.id}/incoming/${randomUUID()}`
  const signed = await context.client.storage.from(bucket).createSignedUploadUrl(path)
  if (signed.error) return jsonError('비공개 업로드 주소를 만들지 못했습니다.', 500)

  return Response.json(
    { path: signed.data.path, token: signed.data.token },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}

export async function PUT(request: Request) {
  const context = await authorizeLocator(request)
  if (context instanceof Response) return context

  const body = await readJson(request)
  const incomingPath = typeof body?.path === 'string' ? body.path : ''
  const expectedPrefix = `${context.userId}/${context.pokemon.id}/incoming/`
  if (!incomingPath.startsWith(expectedPrefix) || incomingPath.slice(expectedPrefix.length).includes('/')) {
    return jsonError('처리할 이미지 경로가 올바르지 않습니다.', 400)
  }

  const downloaded = await context.client.storage.from(bucket).download(incomingPath)
  if (downloaded.error || !downloaded.data) return jsonError('업로드한 이미지를 읽지 못했습니다.', 404)

  try {
    const file = new File(
      [new Uint8Array(await downloaded.data.arrayBuffer())],
      'private-upload',
      { type: downloaded.data.type },
    )
    const normalized = await normalizePrivatePokemonImage(file)
    const portraitPath = `${context.userId}/${context.pokemon.id}/portrait.webp`
    const stored = await context.client.storage.from(bucket).upload(
      portraitPath,
      normalized.bytes,
      { contentType: normalized.mimeType, cacheControl: '300', upsert: true },
    )
    if (stored.error) return jsonError('변환한 이미지를 저장하지 못했습니다.', 500)

    const metadata = await context.client.from('owned_pokemon_images').upsert({
      owned_pokemon_id: context.pokemon.id,
      storage_path: portraitPath,
      mime_type: normalized.mimeType,
      byte_size: normalized.byteSize,
      width: normalized.width,
      height: normalized.height,
    }, { onConflict: 'owned_pokemon_id' })
    if (metadata.error) return jsonError('이미지 정보를 저장하지 못했습니다.', 500)

    return Response.json({ message: '비공개 이미지를 저장했습니다.' })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '이미지를 처리하지 못했습니다.', 400)
  } finally {
    await context.client.storage.from(bucket).remove([incomingPath])
  }
}

export async function DELETE(request: Request) {
  const context = await authorizeLocator(request)
  if (context instanceof Response) return context

  const { data: image, error } = await context.client
    .from('owned_pokemon_images')
    .select('storage_path')
    .eq('owned_pokemon_id', context.pokemon.id)
    .maybeSingle()
  if (error) return jsonError('이미지 정보를 불러오지 못했습니다.', 500)
  if (!image) return new Response(null, { status: 204 })

  const removed = await context.client.storage.from(bucket).remove([image.storage_path])
  if (removed.error) return jsonError('비공개 이미지를 삭제하지 못했습니다.', 500)
  const deleted = await context.client
    .from('owned_pokemon_images')
    .delete()
    .eq('owned_pokemon_id', context.pokemon.id)
  if (deleted.error) return jsonError('이미지 정보를 삭제하지 못했습니다.', 500)
  return new Response(null, { status: 204 })
}

async function authorizeLocator(request: Request) {
  const url = new URL(request.url)
  const dex = Number(url.searchParams.get('dex'))
  const entry = Number(url.searchParams.get('entry'))
  if (!Number.isInteger(dex) || !Number.isInteger(entry) || dex < 1 || entry < 1) {
    return jsonError('공식 도감번호와 등록 순서를 확인해 주세요.', 400)
  }

  const client = await createClient()
  const authenticated = await client.auth.getUser()
  if (authenticated.error || !authenticated.data.user) return jsonError('로그인이 필요합니다.', 401)
  const pokemon = await getOwnedPokemonDetail(client, dex, entry)
  if (!pokemon) return jsonError('포켓몬을 찾을 수 없습니다.', 404)
  return { client, userId: authenticated.data.user.id, pokemon }
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json()
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

function jsonError(message: string, status: number) {
  return Response.json(
    { error: message },
    { status, headers: { 'Cache-Control': 'private, no-store' } },
  )
}
