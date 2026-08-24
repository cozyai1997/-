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
})
