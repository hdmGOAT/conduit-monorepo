"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import appAPIClient from '@/lib/api/httpClient'
import { Button } from '@/components/button'

type Group = {
  id: string
  name: string
  role?: string
}

type GroupSubscriptionSummary = {
  tier: string
  tier_name?: string
  member_limit: number
  member_usage: number
  member_remaining: number
  transaction_capacity_per_period: number
  transaction_usage: number
  transaction_remaining: number
  transaction_fee_bps: number
  period_end?: string
}

type PlanCard = {
  tier: 'starter' | 'growth' | 'enterprise'
  name: string
  monthlyPrice: string
  members: string
  transactions: string
  fee: string
  badge?: string
}

const PLAN_CARDS: PlanCard[] = [
  {
    tier: 'starter',
    name: 'Starter',
    monthlyPrice: 'PHP 150',
    members: 'Up to 100 members',
    transactions: '2,500 transactions / period',
    fee: '0.25% transaction fee',
  },
  {
    tier: 'growth',
    name: 'Growth',
    monthlyPrice: 'PHP 500',
    members: 'Up to 500 members',
    transactions: '15,000 transactions / period',
    fee: '0.10% transaction fee',
    badge: 'Most popular',
  },
  {
    tier: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 'PHP 1,500',
    members: 'Up to 5,000 members',
    transactions: '120,000 transactions / period',
    fee: '0% transaction fee',
  },
]

function formatTierLabel(tier: string) {
  if (!tier) return 'Unknown'
  return `${tier.slice(0, 1).toUpperCase()}${tier.slice(1)}`
}

function formatDate(value?: string) {
  if (!value) return 'Unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date)
}

export default function GroupBillingPage() {
  const params = useParams() as { id: string }
  const searchParams = useSearchParams()
  const id = params.id

  const [group, setGroup] = useState<Group | null>(null)
  const [summary, setSummary] = useState<GroupSubscriptionSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkoutState, setCheckoutState] = useState<'idle' | 'submitting' | 'confirming'>('idle')
  const [activeTier, setActiveTier] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const returnTo = useMemo(() => {
    const value = searchParams.get('returnTo')
    if (!value || !value.startsWith('/')) return `/groups/${id}`
    return value
  }, [id, searchParams])

  const checkoutStatus = searchParams.get('checkout')
  const checkoutSessionID = searchParams.get('session_id')

  const loadBillingData = useCallback(async () => {
    const [groupRes, subscriptionRes] = await Promise.all([
      appAPIClient.get(`/groups/${id}`),
      appAPIClient.get(`/groups/${id}/subscription`),
    ])

    setGroup(groupRes.data)
    setSummary(subscriptionRes.data)

    if (groupRes.data?.role !== 'admin') {
      setError('Only group admins can manage upgrades for this group.')
    }
  }, [id])

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError(null)
      try {
        await loadBillingData()
        if (!mounted) return
      } catch (loadError: unknown) {
        const apiError = loadError as { response?: { data?: { error?: string } }, message?: string }
        if (mounted) setError(apiError?.response?.data?.error || apiError?.message || 'Failed to load billing details.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [loadBillingData])

  useEffect(() => {
    let mounted = true

    async function confirmUpgrade() {
      if (checkoutStatus !== 'success' || !checkoutSessionID) return

      setCheckoutState('confirming')
      setNotice('Payment received. Verifying and applying your plan...')
      setError(null)

      try {
        await appAPIClient.post(`/groups/${id}/subscription/confirm`, { session_id: checkoutSessionID })
        if (!mounted) return
        await loadBillingData()
        setNotice('Upgrade complete. Your new limits are now active.')
      } catch (confirmError: unknown) {
        const apiError = confirmError as { response?: { data?: { error?: string } }, message?: string }
        if (!mounted) return
        setError(apiError?.response?.data?.error || apiError?.message || 'Payment succeeded, but we could not apply the upgrade yet. Please try again.')
      } finally {
        if (mounted) setCheckoutState('idle')
      }
    }

    if (checkoutStatus === 'cancel') {
      setNotice('Checkout was canceled. Your current plan is unchanged.')
    }

    confirmUpgrade().catch(() => {
      setCheckoutState('idle')
    })

    return () => {
      mounted = false
    }
  }, [checkoutSessionID, checkoutStatus, id, loadBillingData])

  const upgradeMailto = useMemo(() => {
    const subject = encodeURIComponent(`Upgrade request for group ${group?.name || id}`)
    const body = encodeURIComponent([
      `Group ID: ${id}`,
      `Group name: ${group?.name || 'Unknown'}`,
      `Current tier: ${summary?.tier || 'Unknown'}`,
      '',
      'Please help us upgrade this group plan.',
    ].join('\n'))
    return `mailto:sales@conduit.app?subject=${subject}&body=${body}`
  }, [group?.name, id, summary?.tier])

  async function startCheckout(tier: PlanCard['tier']) {
    setCheckoutState('submitting')
    setActiveTier(tier)
    setError(null)
    setNotice(null)

    try {
      const response = await appAPIClient.post(`/groups/${id}/subscription/checkout`, {
        tier,
        return_to: returnTo,
      })

      const checkoutURL = response?.data?.checkout_url
      if (!checkoutURL) {
        throw new Error('No checkout URL was returned.')
      }

      window.location.href = checkoutURL
    } catch (checkoutError: unknown) {
      const apiError = checkoutError as { response?: { data?: { error?: string } }, message?: string }
      setError(apiError?.response?.data?.error || apiError?.message || 'Unable to start checkout right now.')
      setCheckoutState('idle')
      setActiveTier(null)
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex max-w-4xl flex-col items-center justify-center px-5 py-28">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-ink/20 border-t-ink"></div>
        <p className="mt-4 text-sm font-medium text-ink/40">Loading billing details...</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-12 sm:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-forest/60">Billing</p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">Upgrade Group Plan</h1>
        </div>
        <Button href={returnTo} variant="nav-secondary" size="sm">Back to workflow</Button>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-rose-100 bg-rose-50/50 p-4 text-sm font-medium text-rose-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-6 rounded-2xl border border-forest/20 bg-forest/5 p-4 text-sm font-medium text-forest">
          {notice}
        </div>
      )}

      <section className="glass-card rounded-3xl border border-ink/10 p-6 shadow-glow sm:p-8">
        <h2 className="font-display text-2xl font-bold text-ink">Current plan</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-ink/10 bg-white/70 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink/30">Tier</p>
            <p className="mt-1 text-xl font-bold text-ink">{formatTierLabel(summary?.tier_name || summary?.tier || '')}</p>
            <p className="mt-2 text-xs text-ink/50">Period ends {formatDate(summary?.period_end)}</p>
          </div>
          <div className="rounded-2xl border border-ink/10 bg-white/70 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink/30">Usage</p>
            <p className="mt-1 text-sm text-ink/70">Members: {summary?.member_usage ?? 0}/{summary?.member_limit ?? 0}</p>
            <p className="mt-1 text-sm text-ink/70">Transactions: {summary?.transaction_usage ?? 0}/{summary?.transaction_capacity_per_period ?? 0}</p>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="font-display text-xl font-bold text-ink">Plans & pricing</h3>
          <p className="mt-1 text-sm text-ink/60">Choose a monthly plan in Philippine pesos and complete checkout with Stripe to upgrade instantly.</p>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {PLAN_CARDS.map((plan) => {
              const isCurrent = summary?.tier === plan.tier
              const isWorking = checkoutState !== 'idle' && activeTier === plan.tier
              return (
                <article key={plan.tier} className={`rounded-2xl border p-4 ${isCurrent ? 'border-forest/40 bg-forest/5' : 'border-ink/10 bg-white/70'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-lg font-bold text-ink">{plan.name}</p>
                    {plan.badge && <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold">{plan.badge}</span>}
                  </div>
                  <p className="mt-2 text-2xl font-bold text-ink">{plan.monthlyPrice}<span className="text-sm font-medium text-ink/50">/month</span></p>
                  <ul className="mt-3 space-y-1 text-sm text-ink/70">
                    <li>{plan.members}</li>
                    <li>{plan.transactions}</li>
                    <li>{plan.fee}</li>
                  </ul>
                  <div className="mt-4">
                    {isCurrent ? (
                      <Button variant="nav-secondary" size="sm" className="w-full" disabled>Current plan</Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        className="w-full"
                        disabled={checkoutState !== 'idle' || group?.role !== 'admin'}
                        onClick={() => startCheckout(plan.tier)}
                      >
                        {isWorking ? 'Redirecting to checkout...' : `Upgrade to ${plan.name}`}
                      </Button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button href={upgradeMailto} variant="nav-secondary" size="sm">Need invoice or annual billing?</Button>
            <Button href={`/groups/${id}/edit`} variant="nav-secondary" size="sm">Open group settings</Button>
          </div>
        </div>
      </section>
    </main>
  )
}
