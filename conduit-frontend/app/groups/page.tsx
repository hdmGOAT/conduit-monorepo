"use client"

import Link from 'next/link'
import { useEffect, useState } from 'react'
import appAPIClient from '@/lib/api/httpClient'

type Group = {
  id: string
  name: string
}

interface JoinRequest {
  user_id: string
  group_id: string
  status: string
  group_name?: string
}

export default function GroupsPage() {
  const [ownedGroups, setOwnedGroups] = useState<Group[]>([])
  const [joinedGroups, setJoinedGroups] = useState<Group[]>([])
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([])
  const [activeTab, setActiveTab] = useState<'managed' | 'joined' | 'requests'>('managed')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [joinCode, setJoinCode] = useState('')
  const [joinSubmitting, setJoinSubmitting] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadGroups() {
      setLoading(true)
      setError(null)

      try {
        const [ownedRes, joinedRes, requestsRes] = await Promise.all([
          appAPIClient.get('/groups/owned'),
          appAPIClient.get('/groups/joined'),
          appAPIClient.get('/groups/requests')
        ])
        
        if (mounted) {
          setOwnedGroups(Array.isArray(ownedRes.data) ? ownedRes.data : ownedRes.data.groups ?? [])
          setJoinedGroups(Array.isArray(joinedRes.data) ? joinedRes.data : joinedRes.data.groups ?? [])
          setJoinRequests(Array.isArray(requestsRes.data) ? requestsRes.data : [])
        }
      } catch (err: unknown) {
        const apiError = err as { response?: { data?: { error?: string } }, message?: string }
        if (mounted) {
          setError(apiError?.message || 'Failed to load groups')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadGroups()

    return () => {
      mounted = false
    }
  }, [])

  async function handleJoinWithCode(e: React.FormEvent) {
    e.preventDefault()
    if (!joinCode.trim()) return
    setJoinSubmitting(true)
    setJoinError(null)
    try {
      const res = await appAPIClient.post('/groups/join-with-code', { code: joinCode.trim() })
      window.location.href = `/groups/${res.data.group_id}`
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } }, message?: string }
      setJoinError(apiError?.response?.data?.error || apiError?.message || 'Failed to join group')
      setJoinSubmitting(false)
    }
  }

  return (
    <main className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-semibold">Groups</h1>
          <p className="text-sm text-gray-600">Manage the groups you belong to or administer.</p>
        </div>
        <Link href="/groups/new" className="rounded bg-blue-600 px-4 py-2 text-white">
          New group
        </Link>
      </div>

      <div className="mb-8 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-2">Join a group</h2>
        <p className="text-sm text-gray-600 mb-4">Enter a join code provided by a group admin.</p>
        <form onSubmit={handleJoinWithCode} className="flex gap-2 items-start">
          <div className="flex-1 max-w-sm">
            <input 
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="e.g. abc123"
              className="w-full border rounded px-3 py-2"
              required
            />
            {joinError && <p className="text-sm text-red-600 mt-1">{joinError}</p>}
          </div>
          <button 
            type="submit" 
            disabled={joinSubmitting || !joinCode.trim()}
            className="rounded bg-blue-50 text-blue-700 px-4 py-2 hover:bg-blue-100 disabled:opacity-50"
          >
            {joinSubmitting ? 'Joining...' : 'Join'}
          </button>
        </form>
      </div>

      {loading ? <div>Loading groups…</div> : null}
      {error ? <div className="mb-4 rounded border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">{error}</div> : null}

      {!loading && !error && (
        <>
          <div className="flex border-b mb-6">
            <button
              onClick={() => setActiveTab('managed')}
              className={`pb-3 px-4 font-medium text-sm transition-colors ${
                activeTab === 'managed'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Managed Groups
            </button>
            <button
              onClick={() => setActiveTab('joined')}
              className={`pb-3 px-4 font-medium text-sm transition-colors ${
                activeTab === 'joined'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Joined Groups
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`pb-3 px-4 font-medium text-sm transition-colors ${
                activeTab === 'requests'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Pending Requests {joinRequests.length > 0 && `(${joinRequests.length})`}
            </button>
          </div>

          {activeTab === 'managed' && (
            <>
              {ownedGroups.length === 0 ? (
                <div className="rounded border border-dashed p-8 text-center text-gray-600">
                  No managed groups yet. Create your first group to get started.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {ownedGroups.map((group) => (
                    <Link
                      key={group.id}
                      href={`/groups/${group.id}`}
                      className="rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="text-xl font-semibold">{group.name}</h2>
                          <p className="text-sm text-gray-500">Managed group</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'joined' && (
            <>
              {joinedGroups.length === 0 ? (
                <div className="rounded border border-dashed p-8 text-center text-gray-600">
                  No joined groups yet. Join a group using a code.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {joinedGroups.map((group) => (
                    <Link
                      key={group.id}
                      href={`/groups/${group.id}`}
                      className="rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="text-xl font-semibold">{group.name}</h2>
                          <p className="text-sm text-gray-500">Joined group</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'requests' && (
            <>
              {joinRequests.length === 0 ? (
                <div className="rounded border border-dashed p-8 text-center text-gray-600">
                  No pending join requests.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {joinRequests.map((request) => (
                    <Link
                      key={request.group_id}
                      href={`/groups/${request.group_id}`}
                      className="rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="text-xl font-semibold">{request.group_name}</h2>
                          <p className="text-sm text-gray-500 capitalize">Status: {request.status}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </main>
  )
}
