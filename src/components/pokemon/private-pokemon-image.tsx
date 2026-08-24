'use client'

import { useEffect, useState } from 'react'

type PrivatePokemonImageProps = {
  dex: number
  entry: number
  alt: string
  revision?: number
  className?: string
}

const fallback = '/silhouettes/default.svg'

export function PrivatePokemonImage({
  dex,
  entry,
  alt,
  revision = 0,
  className = '',
}: PrivatePokemonImageProps) {
  const [source, setSource] = useState(fallback)

  useEffect(() => {
    const controller = new AbortController()
    const query = new URLSearchParams({
      dex: String(dex).padStart(4, '0'),
      entry: String(entry),
    })
    fetch(`/api/private-images?${query}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 204 || !response.ok) return null
        return response.json() as Promise<{ url: string }>
      })
      .then((result) => setSource(result?.url ?? fallback))
      .catch(() => {
        if (!controller.signal.aborted) setSource(fallback)
      })
    return () => controller.abort()
  }, [dex, entry, revision])

  return (
    // 서명 URL과 blob URL은 런타임에만 결정되므로 Next Image 최적화 대상이 아니다.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`private-pokemon-image ${className}`.trim()}
      src={source}
      alt={alt}
      onError={() => setSource(fallback)}
    />
  )
}
