import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import {
  MAX_PRIVATE_IMAGE_BYTES,
  normalizePrivatePokemonImage,
} from '@/features/owned-pokemon/image-policy'

describe('비공개 포켓몬 이미지 정책', () => {
  it('PNG를 1024px 이내 WebP로 변환하고 메타데이터를 제거한다', async () => {
    const png = await sharp({
      create: {
        width: 1400,
        height: 700,
        channels: 4,
        background: { r: 40, g: 120, b: 210, alpha: 1 },
      },
    }).png().withMetadata({ orientation: 6 }).toBuffer()
    const file = new File([new Uint8Array(png)], 'pokemon.png', { type: 'image/png' })

    const result = await normalizePrivatePokemonImage(file)
    const metadata = await sharp(result.bytes).metadata()

    expect(result.mimeType).toBe('image/webp')
    expect(result.width).toBeLessThanOrEqual(1024)
    expect(result.height).toBeLessThanOrEqual(1024)
    expect(metadata.format).toBe('webp')
    expect(metadata.exif).toBeUndefined()
    expect(metadata.icc).toBeUndefined()
  })

  it('5 MiB를 초과하는 입력을 거부한다', async () => {
    const file = new File(
      [new Uint8Array(MAX_PRIVATE_IMAGE_BYTES + 1)],
      'large.png',
      { type: 'image/png' },
    )

    await expect(normalizePrivatePokemonImage(file)).rejects.toThrow('5 MiB 이하')
  })

  it('SVG와 위조된 MIME 형식을 거부한다', async () => {
    const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], 'unsafe.svg', {
      type: 'image/png',
    })

    await expect(normalizePrivatePokemonImage(svg)).rejects.toThrow('JPEG, PNG, WebP')
  })
})
