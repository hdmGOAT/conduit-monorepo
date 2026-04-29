"use client"

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import appAPIClient from '@/lib/api/httpClient'
import { Button } from '@/components/button'

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
        appAPIClient.get(`/groups/${id}/memberships`).then(mRes => setMemberships(mRes.data))
      }
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } }, message?: string }
      alert(apiError?.response?.data?.error || apiError?.message || `Failed to ${action} request`)
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex max-w-5xl flex-col items-center justify-center px-5 py-32">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-ink/20 border-t-ink"></div>
        <p className="mt-4 text-sm font-medium text-ink/40">Opening group space...</p>
      </main>
    )
  }

  if (!group) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-24">
        <div className="rounded-3xl border border-rose-100 bg-rose-50/50 p-12 text-center backdrop-blur-sm">
          <h2 className="text-xl font-bold text-rose-900">Group not found</h2>
          <p className="mt-2 text-rose-700/60">{error || 'Could not find the group you are looking for.'}</p>
          <div className="mt-8">
            <Button href="/groups" variant="secondary">Back to Groups</Button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main
      className="relative min-h-screen overflow-x-clip px-5 py-12 sm:px-8"
      style={{
        background:
          "radial-gradient(circle at 10% 16%, rgba(255, 177, 42, 0.16), transparent 28%), radial-gradient(circle at 90% 84%, rgba(239, 109, 76, 0.14), transparent 30%), linear-gradient(145deg, #f8f7f2, #e7f0ec 56%, #f7d9bb)",
      }}
    >
      <div className="noise" />
      <div className="relative z-10 mx-auto max-w-5xl">
        <header className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-forest/60">Community Space</p>
              {group.role && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  group.role === 'admin' ? "bg-ink text-white" : "bg-ink/5 text-ink/40"
                }`}>
                  {group.role}
                </span>
              )}
            </div>
            <h1 className="mt-3 font-display text-5xl font-bold tracking-tight text-ink sm:text-6xl">
              {group.name}
            </h1>
          </div>

          {group.role === 'admin' && (
            <Button href={`/groups/${id}/edit`} variant="nav-secondary" size="sm">
              Edit Group Settings
            </Button>
          )}
        </header>

        <nav className="mb-10 flex gap-1 border-b border-ink/5 pb-4">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'members', label: 'Members', count: memberships.length, hidden: !group.role },
            { id: 'collections', label: 'Collections', count: collections.length, hidden: !group.role },
            { id: 'requests', label: 'Requests', count: joinRequests.length, hidden: group.role !== 'admin' },
          ].filter(t => !t.hidden).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'overview' | 'collections' | 'members' | 'requests')}
              className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition-all ${
                activeTab === tab.id 
                  ? "bg-ink text-white shadow-md" 
                  : "text-ink/40 hover:bg-ink/10 hover:text-ink/60"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  activeTab === tab.id ? "bg-white/10 text-white/40" : "bg-ink/5 text-ink/20"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="float-in">
          {activeTab === 'overview' && (
            <div className="grid gap-8 md:grid-cols-[1fr_0.4fr]">
              <div className="glass-card rounded-[2.5rem] border border-ink/10 p-8 shadow-glow sm:p-10">
                <h2 className="font-display text-2xl font-bold text-ink">About this group</h2>
                <p className="mt-4 leading-relaxed text-ink/60">
                  Welcome to {group.name}. This space is managed by its administrators and owners to coordinate collections, events, and community goals.
                </p>
                
                {group.role ? (
                  <div className="mt-10 rounded-[2rem] border border-ink/5 bg-ink/[0.02] p-6">
                    <p className="text-sm font-bold text-ink">Your Membership</p>
                    <p className="mt-1 text-sm text-ink/50">You are currently active in this group as a {group.role}.</p>
                    
                    {group.role === 'admin' ? (
                      <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-ink/30">Join Code</p>
                          <p className="mt-1 font-mono text-xl font-bold tracking-widest text-ink">{group.join_code || '---'}</p>
                        </div>
                        <Button variant="nav-secondary" size="sm" onClick={() => navigator.clipboard.writeText(group.join_code || '')}>
                          Copy
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-6">
                        <button onClick={leaveGroup} disabled={submitting} className="text-xs font-bold uppercase tracking-widest text-ember hover:underline disabled:opacity-50">
                          Leave Group
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-10 rounded-[2rem] border border-ink/5 bg-gold/5 p-8 text-center">
                    <h3 className="text-lg font-bold text-ink">Ready to join?</h3>
                    <p className="mt-2 text-sm text-ink/60">Access to this group is restricted. Request join to see member activity and collections.</p>
                    <div className="mt-8">
                      <Button onClick={requestJoin} disabled={submitting || group.has_pending_request} variant="primary" className="min-w-[200px]">
                        {submitting ? 'Requesting...' : group.has_pending_request ? 'Request Pending' : 'Request Access'}
                      </Button>
                    </div>
                  </div>
                )}

                {message && <div className="mt-8 rounded-2xl bg-forest/5 p-4 text-sm font-medium text-forest">{message}</div>}
                {error && <div className="mt-8 rounded-2xl bg-rose-50 p-4 text-sm font-medium text-rose-800">{error}</div>}
              </div>

              <div className="space-y-6">
                <div className="glass-card rounded-[2rem] border border-ink/10 p-6 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-ink/30">Privacy</p>
                  <p className="mt-2 text-sm font-bold text-ink">{group.join_code ? 'Public with code' : 'Private (Review required)'}</p>
                </div>
                <div className="glass-card rounded-[2rem] border border-ink/10 p-6 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-ink/30">Members</p>
                  <p className="mt-2 text-sm font-bold text-ink">{memberships.length} Active</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'collections' && (
            <div className="glass-card rounded-[2.5rem] border border-ink/10 p-8 shadow-glow sm:p-10">
              <div className="mb-10 flex flex-wrap items-center justify-between gap-6">
                <div>
                  <h2 className="font-display text-2xl font-bold text-ink">Active Collections</h2>
                  <p className="mt-1 text-sm text-ink/50">Review and participate in community funding targets.</p>
                </div>
                {group.role === 'admin' && (
                  <Button href={`/groups/${id}/collections/new`} variant="primary" size="sm">
                    New Collection
                  </Button>
                )}
              </div>

              {collections.length === 0 ? (
                <div className="rounded-[2.5rem] border border-dashed border-ink/10 py-20 text-center">
                  <p className="text-lg font-bold text-ink/30">No collections active.</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {collections.map((c) => (
                    <a key={c.id} href={`/groups/${id}/collections/${c.id}`} className="group flex items-center justify-between rounded-3xl border border-ink/5 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-ink/10 hover:shadow-glow">
                      <div>
                        <p className="font-display text-2xl font-bold text-ink">{formatCurrency(c.amount)}</p>
                        <p className="mt-1 text-xs text-ink/40 italic">Due {formatDeadline(c.deadline)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                          c.paid_by_current_user ? "bg-forest/5 text-forest" : "bg-gold/5 text-gold"
                        }`}>
                          {c.paid_by_current_user ? 'Paid' : c.status}
                        </span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/5 text-ink transition-all group-hover:bg-ink group-hover:text-white">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'members' && (
            <div className="glass-card rounded-[2.5rem] border border-ink/10 p-8 shadow-glow sm:p-10">
              <h2 className="font-display text-2xl font-bold text-ink">Community Members</h2>
              <div className="mt-8 divide-y divide-ink/5">
                {memberships.length === 0 ? (
                  <p className="py-12 text-center text-sm font-bold text-ink/30 uppercase tracking-widest">No members found</p>
                ) : memberships.map(m => (
                  <div key={m.user_id} className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-ink/5 flex items-center justify-center font-bold text-ink/20">
                        {(m.display_name || m.email || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-ink">{m.display_name || m.email || `User #${m.user_id}`}</p>
                        <p className="text-xs font-bold uppercase tracking-widest text-ink/30">{m.role}</p>
                      </div>
                    </div>
                    {group.role === 'admin' && m.user_id !== group.owner_id && (
                      <button onClick={() => ejectMember(m.user_id)} className="text-[10px] font-bold uppercase tracking-widest text-ember/40 hover:text-ember transition-colors">
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'requests' && (
            <div className="glass-card rounded-[2.5rem] border border-ink/10 p-8 shadow-glow sm:p-10">
              <h2 className="font-display text-2xl font-bold text-ink">Pending Requests</h2>
              <div className="mt-8 space-y-4">
                {joinRequests.length === 0 ? (
                  <div className="rounded-[2rem] border border-dashed border-ink/10 py-12 text-center">
                    <p className="text-sm font-bold text-ink/30 uppercase tracking-widest">No pending reviews</p>
                  </div>
                ) : joinRequests.map(jr => (
                  <div key={jr.user_id} className="flex items-center justify-between rounded-[2rem] border border-ink/5 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-gold/5 flex items-center justify-center font-bold text-gold/40 text-xl">
                        {(jr.display_name || jr.email || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-ink">{jr.display_name || jr.email || `User #${jr.user_id}`}</p>
                        <p className="text-xs text-ink/40">Requested to join the community</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => handleJoinRequest(jr.user_id, 'approved')}>Approve</Button>
                      <Button size="sm" variant="nav-secondary" onClick={() => handleJoinRequest(jr.user_id, 'denied')}>Deny</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
