import { createBrowserClient } from '@supabase/ssr'

import type { Database } from '@/types/database.generated'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !publishableKey) {
    throw new Error('Supabase 공개 환경 변수가 설정되지 않았습니다.')
  }

  return createBrowserClient<Database>(url, publishableKey)
}
