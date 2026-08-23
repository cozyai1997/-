import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { GlobalSearch } from '@/components/app-shell/global-search'
import { Sidebar } from '@/components/app-shell/sidebar'
import { createClient } from '@/lib/supabase/server'

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims?.sub) redirect('/login')

  return (
    <div className="protected-layout">
      <Sidebar />
      <div className="app-workspace">
        <GlobalSearch />
        {children}
      </div>
    </div>
  )
}
