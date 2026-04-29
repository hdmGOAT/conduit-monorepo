'use client'

import { useEffect, useState } from 'react'
import appAPIClient from '@/lib/api/httpClient'
import Link from 'next/link'

type Collection = {
  id: string
  group_id: string
  amount: number
  deadline: string
  status: string
}

type Group = {
  id: string
  name: string
}

type TypedCollection = Collection & {
  group_name: string
  daysUntilDeadline: number
  paid_by_current_user: boolean
  has_submission_by_current_user: boolean
}

function formatCurrency(amountInCents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amountInCents / 100)
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
  }).format(date)
}

function getDaysUntilDeadline(deadline: string): number {
  const now = new Date()
  const deadlineDate = new Date(deadline)
  const diffTime = deadlineDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

export function CollectionsDashboard() {
  const [collections, setCollections] = useState<TypedCollection[]>([])
  const [currentTab, setCurrentTab] = useState<'pending' | 'completed' | 'overdue'>('pending')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        
        // Fetch all groups user is in
        const groupsRes = await appAPIClient.get('/groups/joined')
        const groupsList = Array.isArray(groupsRes.data) ? groupsRes.data : []
        
        // Build group map
        const groupMap = new Map<string, string>()
        groupsList.forEach((g: Group) => {
          groupMap.set(g.id, g.name)
        })

        // Fetch all collections from all groups
        const allCollections: TypedCollection[] = []
        
        for (const group of groupsList) {
          try {
            const collectionsRes = await appAPIClient.get(`/groups/${group.id}/collections`)
            const groupCollections = Array.isArray(collectionsRes.data) ? collectionsRes.data : []

            const enrichedCollections = await Promise.all(
              groupCollections.map(async (col: Collection & { paid_by_current_user?: boolean }) => {
                const submissionRes = await appAPIClient
                  .get(`/collections/${col.id}/submissions/me`)
                  .catch(() => ({ data: null }))

                return {
                  ...col,
                  group_name: group.name,
                  daysUntilDeadline: getDaysUntilDeadline(col.deadline),
                  paid_by_current_user: Boolean(col.paid_by_current_user),
                  has_submission_by_current_user: Boolean(submissionRes.data),
                }
              })
            )

            allCollections.push(...enrichedCollections)
          } catch {
            // Skip collections for this group
          }
        }

        setCollections(allCollections)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load collections')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const filterCollections = (collections: TypedCollection[]) => {
    const now = new Date()
    
    return collections.filter(col => {
      const deadline = new Date(col.deadline)
      const isCompleted = col.status === 'closed' || (col.paid_by_current_user && col.has_submission_by_current_user)

      if (currentTab === 'completed') {
        return isCompleted
      } else if (currentTab === 'overdue') {
        return !isCompleted && deadline < now
      } else {
        // pending
        return !isCompleted && deadline >= now
      }
    })
  }

  const filtered = filterCollections(collections)

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/20 border-t-ink"></div>
          <p className="text-sm font-medium text-ink/60">Loading your collections...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
      <div className="mb-12">
        <h1 className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
          My Collections
        </h1>
        <p className="mt-3 text-lg text-ink/60">
          Track payments and forms across all your groups
        </p>
      </div>

      {error && (
        <div className="float-in mb-8 flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/50 p-4 text-rose-800 backdrop-blur-sm">
          <svg className="h-5 w-5 flex-shrink-0 text-rose-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-8 flex gap-2 border-b border-ink/10">
        {(['pending', 'completed', 'overdue'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setCurrentTab(tab)}
            className={`px-4 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${
              currentTab === tab
                ? 'border-ink text-ink'
                : 'border-transparent text-ink/50 hover:text-ink/70'
            }`}
          >
            {tab === 'pending' && `Pending (${collections.filter(c => !(c.status === 'closed' || (c.paid_by_current_user && c.has_submission_by_current_user)) && new Date(c.deadline) >= new Date()).length})`}
            {tab === 'completed' && `Completed (${collections.filter(c => c.status === 'closed' || (c.paid_by_current_user && c.has_submission_by_current_user)).length})`}
            {tab === 'overdue' && `Overdue (${collections.filter(c => !(c.status === 'closed' || (c.paid_by_current_user && c.has_submission_by_current_user)) && new Date(c.deadline) < new Date()).length})`}
          </button>
        ))}
      </div>

      {/* Collections Grid */}
      {filtered.length === 0 ? (
        <div className="glass-card rounded-3xl border border-dashed border-ink/10 p-12 text-center">
          <p className="text-ink/40">
            {currentTab === 'pending' && 'No pending collections'}
            {currentTab === 'completed' && 'No completed collections'}
            {currentTab === 'overdue' && 'No overdue collections'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(collection => (
            <Link
              key={collection.id}
              href={`/groups/${collection.group_id}/collections/${collection.id}`}
              className="glass-card group cursor-pointer rounded-3xl border border-ink/10 p-6 shadow-glow transition-all hover:border-ink/20 hover:shadow-lg"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-xs text-ink/50 uppercase tracking-wide">{collection.group_name}</p>
                  <h3 className="mt-2 text-lg font-bold text-ink line-clamp-2">
                    {formatCurrency(collection.amount)}
                  </h3>
                </div>
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-tighter shrink-0 ${
                  collection.status === 'closed' || (collection.paid_by_current_user && collection.has_submission_by_current_user)
                    ? 'bg-forest/10 text-forest'
                    : collection.daysUntilDeadline < 0
                    ? 'bg-ember/10 text-ember'
                    : collection.daysUntilDeadline <= 7
                    ? 'bg-amber-100/50 text-amber-800'
                    : 'bg-mist/10 text-mist'
                }`}>
                  {collection.status === 'closed' || (collection.paid_by_current_user && collection.has_submission_by_current_user)
                    ? 'Completed'
                    : collection.daysUntilDeadline < 0
                    ? 'Overdue'
                    : `${collection.daysUntilDeadline}d`}
                </span>
              </div>

              <p className="text-sm text-ink/60">
                Due {formatDate(collection.deadline)}
              </p>

              <div className="mt-4 flex items-center gap-2 text-xs text-ink/40 group-hover:text-ink/60 transition-colors">
                <span>View collection</span>
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
