import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PrivatePokemonImage } from '@/components/pokemon/private-pokemon-image'

describe('PrivatePokemonImage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('treats 204 as a normal missing image without parsing a body', async () => {
    const json = vi.fn()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 204,
      json,
    } as unknown as Response)

    render(<PrivatePokemonImage dex={25} entry={1} alt="피카츄 개인 이미지" />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/private-images?dex=0025&entry=1',
      expect.objectContaining({ cache: 'no-store' }),
    ))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(json).not.toHaveBeenCalled()
    expect(screen.getByRole('img', { name: '피카츄 개인 이미지' }))
      .toHaveAttribute('src', '/silhouettes/default.svg')
  })

  it('still renders a signed private image returned by the route', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ url: 'https://example.test/private-image' }),
    } as unknown as Response)

    render(<PrivatePokemonImage dex={25} entry={1} alt="피카츄 개인 이미지" />)

    await waitFor(() => expect(screen.getByRole('img', { name: '피카츄 개인 이미지' }))
      .toHaveAttribute('src', 'https://example.test/private-image'))
  })
})
