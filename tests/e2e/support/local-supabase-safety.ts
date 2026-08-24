const productionProjectRef = 'ipbqrgsdkoqtuqgnewrs'
const allowedLoopbackHosts = new Set(['127.0.0.1', 'localhost'])

export function assertLocalSupabaseUrl(value: string | undefined): URL {
  const raw = value?.trim() ?? ''
  if (raw.toLowerCase().includes(productionProjectRef)) {
    throw new Error(`E2E에서 운영 Supabase project ref ${productionProjectRef} 사용을 거부합니다.`)
  }

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('E2E에는 유효한 로컬 Supabase URL이 필요합니다.')
  }
  if (!allowedLoopbackHosts.has(url.hostname.toLowerCase())) {
    throw new Error(`E2E에는 로컬 Supabase loopback URL만 허용됩니다: ${url.hostname}`)
  }
  return url
}
