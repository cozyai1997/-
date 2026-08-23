type SessionRefreshClient = {
  auth: {
    refreshSession: () => PromiseLike<{ error: unknown }>
  }
}

const retryDelaysMs = [100, 300] as const

export async function retrySupabaseRead<T>(
  client: SessionRefreshClient,
  read: () => Promise<T>,
): Promise<T> {
  let lastError: unknown = new Error('Supabase 읽기 요청에 실패했습니다.')

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      return await read()
    } catch (error) {
      lastError = error
      if (attempt === 0) {
        try {
          await client.auth.refreshSession()
        } catch {
          // A retry can still succeed when the refresh endpoint itself was transiently unavailable.
        }
      }
      if (attempt === retryDelaysMs.length) break
      await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt]))
    }
  }

  throw lastError
}
