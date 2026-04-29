"use client"

import Link from 'next/link'
import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import appAPIClient from '@/lib/api/httpClient'

interface Group {
  id: string
  name: string
  role?: string
  owner_id: string
  join_code?: string
  has_pending_request?: boolean
}

interface Membership {
  user_id: string
  group_id: string
  role: string
  display_name?: string
  email?: string
}

interface JoinRequest {
  user_id: string
  group_id: string
  status: string
  display_name?: string
  email?: string
}

interface Collection {
  id: string
  group_id: string
  amount: number
  status: string
  deadline: string
  paid_by_current_user?: boolean
}

function formatCurrency(amountInCents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amountInCents / 100)
}

function formatDeadline(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export default function Page() {
  const params = useParams() as { id: string }
  const id = params.id
  const [group, setGroup] = useState<Group | null>(null)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'collections' | 'members' | 'requests'>('overview')

  useEffect(() => {
    let mounted = true
    appAPIClient.get(`/groups/${id}`).then(res => {
      if (mounted) {
        setGroup(res.data)
        appAPIClient.get(`/groups/${id}/collections`).then((cRes) => {
          if (!mounted) return
          setCollections(Array.isArray(cRes.data) ? cRes.data : [])
        }).catch(console.error)
        if (res.data.role) {
          appAPIClient.get(`/groups/${id}/memberships`).then(mRes => {
            if (mounted) setMemberships(mRes.data)
          }).catch(console.error)
        }
        if (res.data.role === 'admin') {
          appAPIClient.get(`/groups/${id}/join-requests`).then(jrRes => {
            if (mounted) setJoinRequests(jrRes.data.filter((jr: JoinRequest) => jr.status === 'pending'))
          }).catch(console.error)
        }
      }
    }).catch(err => {
      if (mounted) setError(err?.response?.data?.error || err?.message || 'Failed to load group')
    }).finally(() => {
      if (mounted) setLoading(false)
    })
    return () => { mounted = false }
  }, [id])

  async function requestJoin() {
    if (!group) return
    setSubmitting(true)
    setError(null)
    setMessage(null)

    try {
      const res = await appAPIClient.post(`/groups/${id}/join`, {})
      const body = res.data ?? {}
      if (body.message === 'already a member') {
        setMessage('You are already a member of this group.')
      } else if (body.status === 'pending' || body.message === 'join request already exists' || body.message === 'join request created') {
        setMessage('Your join request was sent and is waiting for review.')
        setGroup({ ...group, has_pending_request: true })
      } else {
        setMessage('You joined the group.')
        setGroup({ ...group, role: body.role as string })
        appAPIClient.get(`/groups/${id}/memberships`).then(mRes => setMemberships(mRes.data))
      }
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } }, message?: string }
      setError(apiError?.response?.data?.error || apiError?.message || 'Failed to request access')
    } finally {
      setSubmitting(false)
    }
  }

  async function leaveGroup() {
    if (submitting) return
    if (!confirm('Are you sure you want to leave this group?')) return
    setSubmitting(true)
    setError(null)

    try {
      await appAPIClient.delete(`/groups/${id}/memberships/me`)
      window.location.href = '/groups'
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } }, message?: string }
      setError(apiError?.response?.data?.error || apiError?.message || 'Failed to leave group')
      setSubmitting(false)
    }
  }

  async function ejectMember(userId: string) {
    if (!confirm('Are you sure you want to remove this member?')) return
    try {
      await appAPIClient.delete(`/groups/${id}/memberships/${userId}`)
      setMemberships(memberships.filter(m => m.user_id !== userId))
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } }, message?: string }
      alert(apiError?.response?.data?.error || apiError?.message || 'Failed to remove member')
    }
  }

  async function handleJoinRequest(userId: string, action: 'approved' | 'denied') {
    try {
      await appAPIClient.patch(`/groups/${id}/join-requests/${userId}`, { status: action, role: 'member' })
      setJoinRequests(joinRequests.filter(jr => jr.user_id !== userId))
      if (action === 'approved') {
        // Refresh memberships to include the new member
        appAPIClient.get(`/groups/${id}/memberships`).then(mRes => setMemberships(mRes.data))
      }
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } }, message?: string }
      alert(apiError?.response?.data?.error || apiError?.message || `Failed to ${action} request`)
    }
  }

  if (loading) {
    return <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">Loading...</main>
  }

  if (!group) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
        <div className="rounded border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
          {error || 'Group not found'}
        </div>
        <Link href="/groups" className="text-blue-600 underline">Back to groups</Link>
      </main>
    )
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 mb-2">
        <h1 className="text-3xl font-semibold">{group.name}</h1>
        {group.role === 'admin' ? (
          <Link href={`/groups/${id}/edit`} className="rounded border border-gray-300 px-4 py-2 text-gray-800 bg-white shadow-sm hover:bg-gray-50 transition">
            Edit group
          </Link>
        ) : null}
      </div>

      <div className="flex border-b mb-2">
        <button 
          className={`px-4 py-2 border-b-2 font-medium text-sm ${activeTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        {group.role && (
          <button 
            className={`px-4 py-2 border-b-2 font-medium text-sm ${activeTab === 'members' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            onClick={() => setActiveTab('members')}
          >
            Members ({memberships.length})
          </button>
        )}
        {group.role && (
          <button 
            className={`px-4 py-2 border-b-2 font-medium text-sm ${activeTab === 'collections' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            onClick={() => setActiveTab('collections')}
          >
            Collections ({collections.length})
          </button>
        )}
        {group.role === 'admin' && (
          <button 
            className={`px-4 py-2 border-b-2 font-medium text-sm ${activeTab === 'requests' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            onClick={() => setActiveTab('requests')}
          >
            Pending Requests {joinRequests.length > 0 && `(${joinRequests.length})`}
          </button>
        )}
      </div>

      {activeTab === 'overview' && (
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Group access</h2>
          {group.role ? (
            <div>
              <p className="mt-2 text-sm text-gray-600">
                You are a member of this group (Role: {group.role}).
              </p>
              {group.role === 'admin' ? (
                <div className="mt-4 p-4 border rounded-lg bg-gray-50 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm text-gray-600">Join Code</div>
                    <div className="text-xl font-mono tracking-wider mt-1">{group.join_code || 'None'}</div>
                  </div>
                </div>
              ) : (
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={leaveGroup}
                    disabled={submitting}
                    className="rounded bg-rose-50 text-rose-700 px-4 py-2 hover:bg-rose-100 disabled:opacity-50 transition"
                  >
                    Leave group
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <p className="mt-2 text-sm text-gray-600">
                Public groups add you right away. Private groups create a join request for the owners and admins to review.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={requestJoin}
                  disabled={submitting || group.has_pending_request}
                  className="rounded bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Requesting…' : group.has_pending_request ? 'Request Pending' : 'Join or request access'}
                </button>
              </div>
            </>
          )}

          <div className="mt-6 flex">
            <Link href="/groups" className="text-blue-600 underline">
              Back to groups
            </Link>
          </div>

          {message ? <p className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">{message}</p> : null}
          {error ? <p className="mt-4 rounded border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">{error}</p> : null}
        </section>
      )}

      {activeTab === 'collections' && group.role && (
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Collections</h2>
              <p className="text-sm text-gray-600">Members can open a collection to pay and submit the attached form.</p>
            </div>
            {group.role === 'admin' ? (
              <Link href={`/groups/${id}/collections/new`} className="rounded bg-blue-600 px-4 py-2 text-white">
                New collection
              </Link>
            ) : null}
          </div>

          {collections.length === 0 ? (
            <div className="rounded border border-dashed p-8 text-center text-gray-600">
              No collections have been created yet.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {collections.map((collection) => (
                <Link
                  key={collection.id}
                  href={`/groups/${id}/collections/${collection.id}`}
                  className="rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold">{formatCurrency(collection.amount)}</h3>
                      <p className="text-sm text-gray-500">Due {formatDeadline(collection.deadline)}</p>
                    </div>
                    <span className="rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.12em]">
                      {collection.paid_by_current_user ? (
                        <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full">Paid</span>
                      ) : (
                        <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full">{collection.status}</span>
                      )}
                    </span>
                  </div>
                  {group.role === 'admin' ? (
                    <div className="mt-4 text-sm text-blue-600 underline">
                      Edit collection
                    </div>
                  ) : null}
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'requests' && group.role === 'admin' && (
        <section className="rounded-2xl border bg-white p-6 shadow-sm border-blue-200">
          <h2 className="text-xl font-semibold mb-4 text-blue-900">Pending Join Requests</h2>
          {joinRequests.length === 0 ? (
            <div className="p-4 text-gray-500 text-sm border rounded-lg bg-gray-50">No pending requests.</div>
          ) : (
            <div className="divide-y border rounded-lg overflow-hidden">
              {joinRequests.map(jr => (
                <div key={jr.user_id} className="p-4 flex items-center justify-between bg-white">
                  <div>
                    <div className="font-medium">{jr.display_name || jr.email || `User #${jr.user_id}`}</div>
                    <div className="text-sm text-gray-500">Requested to join</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleJoinRequest(jr.user_id, 'approved')}
                      className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition"
                    >
                      Approve
                    </button>
                    <button 
                      onClick={() => handleJoinRequest(jr.user_id, 'denied')}
                      className="text-sm border border-gray-300 text-gray-700 px-3 py-1 rounded hover:bg-gray-50 transition"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'members' && group.role && (
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Members</h2>
          <div className="divide-y border rounded-lg overflow-hidden">
            {memberships.length === 0 ? (
              <div className="p-4 text-gray-500 text-sm">No members to display.</div>
            ) : memberships.map(m => (
              <div key={m.user_id} className="p-4 flex items-center justify-between bg-white">
                <div>
                  <div className="font-medium">{m.display_name || m.email || `User #${m.user_id}`}</div>
                  <div className="text-sm text-gray-500 capitalize">{m.role}</div>
                </div>
                {group.role === 'admin' && m.user_id !== group.owner_id ? (
                  <button 
                    onClick={() => ejectMember(m.user_id)}
                    className="text-sm text-red-600 hover:text-red-800 transition"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}