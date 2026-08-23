import sharp from 'sharp'

export const MAX_PRIVATE_IMAGE_BYTES = 5 * 1024 * 1024
export const PRIVATE_IMAGE_MAX_EDGE = 1024
export const PRIVATE_IMAGE_MIME_TYPE = 'image/webp'

const acceptedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

export type NormalizedPrivatePokemonImage = {
  bytes: Buffer
  mimeType: typeof PRIVATE_IMAGE_MIME_TYPE
  byteSize: number
  width: number
  height: number
}

export async function normalizePrivatePokemonImage(
  file: File,
): Promise<NormalizedPrivatePokemonImage> {
  if (file.size < 1 || file.size > MAX_PRIVATE_IMAGE_BYTES) {
    throw new Error('이미지는 5 MiB 이하만 업로드할 수 있습니다.')
  }
  if (!acceptedMimeTypes.has(file.type)) {
    throw new Error('JPEG, PNG, WebP 이미지만 업로드할 수 있습니다.')
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  if (!signatureMatches(bytes, file.type)) {
    throw new Error('JPEG, PNG, WebP 형식과 파일 내용이 일치해야 합니다.')
  }

  try {
    const transformed = await sharp(bytes, {
      failOn: 'error',
      limitInputPixels: 20_000_000,
    })
      .rotate()
      .resize({
        width: PRIVATE_IMAGE_MAX_EDGE,
        height: PRIVATE_IMAGE_MAX_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85, effort: 4 })
      .toBuffer({ resolveWithObject: true })

    if (!transformed.info.width || !transformed.info.height) {
      throw new Error('이미지 크기를 확인할 수 없습니다.')
    }
    return {
      bytes: transformed.data,
      mimeType: PRIVATE_IMAGE_MIME_TYPE,
      byteSize: transformed.data.byteLength,
      width: transformed.info.width,
      height: transformed.info.height,
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('이미지 크기')) throw error
    throw new Error('손상되었거나 처리할 수 없는 이미지입니다.')
  }
}

function signatureMatches(bytes: Buffer, mimeType: string) {
  if (mimeType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (mimeType === 'image/png') {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  }
  return bytes.length >= 12
    && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
    && bytes.subarray(8, 12).toString('ascii') === 'WEBP'
}
