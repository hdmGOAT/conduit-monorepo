'use client'

import { CollectionsDashboard } from "../collections-dashboard"
import { useEffect, useState } from "react"
import appAPIClient from "@/lib/api/httpClient"

type User = {
  id: string
  email: string
  display_name: string
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await appAPIClient.get('/auth/me')
        if (res.data && res.data.id) {
          setUser(res.data)
        } else {
          window.location.href = '/login'
        }
      } catch {
        window.location.href = '/login'
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  if (loading) {
    return (
      <main className="relative min-h-screen bg-cloud">
        <div className="flex items-center justify-center h-screen">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/20 border-t-ink"></div>
            <p className="text-sm font-medium text-ink/60">Loading...</p>
          </div>
        </div>
      </main>
    )
  }

  if (!user) {
    return null
  }

  return (
    <main className="min-h-screen bg-cloud">
      <CollectionsDashboard />
    </main>
  )
}
