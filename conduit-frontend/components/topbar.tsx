"use client"

import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { Fraunces } from 'next/font/google'
import { Button } from './button'
import appAPIClient from '@/lib/api/httpClient'
import { clearAccessToken } from '@/lib/api/authToken'

const fraunces = Fraunces({ subsets: ['latin'], weight: ['400','500','600','700'] })

type TopBarProps = {
  children?: React.ReactNode
  backToGroups?: boolean
}

export function TopBar({ children, backToGroups }: TopBarProps) {
  const [me, setMe] = useState<{ id?: string; display_name?: string; email?: string } | null>(null)

  useEffect(() => {
    let mounted = true
    appAPIClient.get('/auth/me').then((res) => {
      if (mounted && res?.data?.id) setMe(res.data)
    }).catch(() => {
      if (mounted) setMe(null)
    })
    return () => { mounted = false }
  }, [])

  async function logout() {
    try {
      await appAPIClient.post('/auth/logout', {})
    } catch {
      // Ignore logout failures and clear the local session state anyway.
    } finally {
      clearAccessToken()
      setMe(null)
      window.location.href = '/login'
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-ink/10 bg-cloud/95 backdrop-blur-xl">
      <nav className="flex w-full items-center justify-between px-5 py-4 sm:px-8">
        <div className="flex items-center gap-4">
          <Link href="/" className={`${fraunces.className} text-3xl font-semibold tracking-tight text-ink`}>
            Conduit
          </Link>
          {backToGroups && (
            <Button href="/groups" variant="nav-secondary" size="sm">
              ← Groups
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* auth-aware links */}
          {me ? (
            <>
              <Link href="/dashboard" className="text-sm font-medium text-ink/80 hover:text-ink">Dashboard</Link>
              <Link href="/groups" className="text-sm font-medium text-ink/80 hover:text-ink">Groups</Link>
              <details className="relative">
                <summary className="cursor-pointer list-none rounded-full px-3 py-2 text-sm font-medium text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink">
                  {me.display_name || me.email}
                </summary>
                <div className="absolute right-0 top-full mt-2 w-44 overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-xl">
                  <button
                    type="button"
                    onClick={logout}
                    className="block w-full px-4 py-3 text-left text-sm font-medium text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
                  >
                    Log out
                  </button>
                </div>
              </details>
            </>
          ) : (
            <>
              <Button href="/login" variant="nav-primary" size="sm">Log In</Button>
              <Button href="/signup" variant="nav-secondary" size="sm">Sign Up</Button>
            </>
          )}

          {children}
        </div>
      </nav>
    </header>
  )
}

export default TopBar
