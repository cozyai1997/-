// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getOwnedPokemonDetail: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/features/owned-pokemon/repository', () => ({
  getOwnedPokemonDetail: mocks.getOwnedPokemonDetail,
}))

import { GET } from '@/app/api/private-images/route'

describe('private image locator authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes only the route-verified user ID to the owned-pokemon lookup', async () => {
    const imageQuery = {
      select: () => imageQuery,
      eq: () => imageQuery,
      maybeSingle: () => Promise.resolve({ data: { storage_path: 'verified-user/owned/portrait.webp' }, error: null }),
    }
    const client = {
      auth: {
        getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'verified-user' } }, error: null })),
      },
      from: vi.fn(() => imageQuery),
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: vi.fn(() => Promise.resolve({
            data: { signedUrl: 'https://example.test/signed' }, error: null,
          })),
        })),
      },
    }
    mocks.createClient.mockResolvedValue(client)
    mocks.getOwnedPokemonDetail.mockResolvedValue({ id: 'owned' })

    const response = await GET(new Request(
      'http://example.test/api/private-images?dex=133&entry=1&ownerId=untrusted-client-user',
    ))

    expect(response.status).toBe(200)
    expect(mocks.getOwnedPokemonDetail).toHaveBeenCalledWith(client, 133, 1, 'verified-user')
  })

  it('returns 204 without asking storage for a signed URL when the owned Pokemon has no image', async () => {
    const imageQuery = {
      select: () => imageQuery,
      eq: () => imageQuery,
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
    }
    const createSignedUrl = vi.fn()
    const client = {
      auth: {
        getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'verified-user' } }, error: null })),
      },
      from: vi.fn(() => imageQuery),
      storage: { from: vi.fn(() => ({ createSignedUrl })) },
    }
    mocks.createClient.mockResolvedValue(client)
    mocks.getOwnedPokemonDetail.mockResolvedValue({ id: 'owned' })

    const response = await GET(new Request('http://example.test/api/private-images?dex=133&entry=1'))

    expect(response.status).toBe(204)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await response.text()).toBe('')
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('keeps unauthenticated and non-owner requests distinct from normal image absence', async () => {
    const unauthenticatedClient = {
      auth: {
        getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: new Error('signed out') })),
      },
    }
    mocks.createClient.mockResolvedValueOnce(unauthenticatedClient)

    const unauthenticated = await GET(new Request(
      'http://example.test/api/private-images?dex=133&entry=1',
    ))

    expect(unauthenticated.status).toBe(401)
    expect(mocks.getOwnedPokemonDetail).not.toHaveBeenCalled()

    const ownerClient = {
      auth: {
        getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'verified-user' } }, error: null })),
      },
    }
    mocks.createClient.mockResolvedValueOnce(ownerClient)
    mocks.getOwnedPokemonDetail.mockResolvedValueOnce(null)

    const notOwner = await GET(new Request('http://example.test/api/private-images?dex=133&entry=1'))

    expect(notOwner.status).toBe(404)
  })
})
