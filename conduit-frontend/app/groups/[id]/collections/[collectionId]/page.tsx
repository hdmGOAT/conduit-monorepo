"use client"

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import appAPIClient from '@/lib/api/httpClient'
import { StripePaymentForm } from '@/components/collections/stripe-payment-form'

type Group = {
  id: string
  name: string
  role?: string
}

type Collection = {
  id: string
  group_id: string
  amount: number
  deadline: string
  status: string
}

type FormField = {
  id: string
  form_id: string
  field_key: string
  label: string
  field_type: string
  placeholder?: string | null
  is_required: boolean
  options?: unknown
  sort_order: number
}

type CollectionForm = {
  id: string
  collection_id: string
  title: string
  description?: string | null
  is_required: boolean
  fields: FormField[]
}

type Payment = {
  id: string
  user_id: string
  collection_id: string
  amount: number
  total_amount: number
  status: string
  method: string
  created_at?: string
}

type StripePaymentIntentResponse = {
  id: string
  client_secret: string
}

type CreatePaymentResponse = Payment & {
  stripe_payment_intent?: StripePaymentIntentResponse | null
}

type GroupMember = {
  user_id: string
  group_id: string
  role: string
  display_name?: string
  email?: string
}

type Submission = {
  id: string
  form_id: string
  collection_id: string
  user_id: string
  submitted_at?: string
}

type SubmissionAnswer = {
  id: string
  submission_id: string
  field_id: string
  value_text?: string | null
  value_json?: unknown
  created_at?: string
}

type Me = {
  id: string
  email: string
  display_name: string
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
    timeStyle: 'short',
  }).format(date)
}

function sortFields(fields: FormField[]) {
  return [...fields].sort((left, right) => left.sort_order - right.sort_order)
}

function sameUserId(left: string | number | undefined, right: string | number | undefined) {
  return String(left ?? '') === String(right ?? '')
}

export default function Page() {
  const params = useParams() as { id: string; collectionId: string }
  const { id, collectionId } = params
  const [group, setGroup] = useState<Group | null>(null)
  const [collection, setCollection] = useState<Collection | null>(null)
  const [form, setForm] = useState<CollectionForm | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [members, setMembers] = useState<GroupMember[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [submissionAnswers, setSubmissionAnswers] = useState<Record<string, SubmissionAnswer[]>>({})
  const [me, setMe] = useState<Me | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // If the current user already has a submission, prefill the form answers
    if (!me || !form || submissions.length === 0) return

    const mySubmission = submissions.find((s) => String(s.user_id) === String(me.id))
    if (!mySubmission) return

    const myAnswers = submissionAnswers[mySubmission.id] ?? []
    const map: Record<string, string> = {}
    myAnswers.forEach((a) => {
      if (a.value_text !== undefined && a.value_text !== null) {
        map[String(a.field_id)] = String(a.value_text)
      } else if (a.value_json !== undefined && a.value_json !== null) {
        try {
          map[String(a.field_id)] = typeof a.value_json === 'string' ? String(a.value_json) : JSON.stringify(a.value_json)
        } catch {
          map[String(a.field_id)] = ''
        }
      }
    })

    // Only set answers if there is at least one value (prevents overwriting deliberate empty state)
    if (Object.keys(map).length > 0) {
      setAnswers((current) => ({ ...Object.fromEntries(sortFields(form.fields).map((f) => [String(f.id), current[String(f.id)] ?? ''])), ...map }))
    }
  }, [submissionAnswers, submissions, me, form])

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      try {
        const [groupRes, collectionsRes, authRes] = await Promise.all([
          appAPIClient.get(`/groups/${id}`),
          appAPIClient.get(`/groups/${id}/collections`),
          appAPIClient.get('/auth/me'),
        ])

        if (!mounted) return

        const nextCollection = (Array.isArray(collectionsRes.data) ? collectionsRes.data : []).find((item: Collection) => String(item.id) === String(collectionId))
        setGroup(groupRes.data)
        setCollection(nextCollection ?? null)
        setMe(authRes.data)

        if (nextCollection) {
          const [formRes, paymentsRes, membersRes, submissionsRes, mySubmissionRes] = await Promise.all([
            appAPIClient.get(`/collections/${collectionId}/form`).catch((requestError) => {
              const status = requestError?.response?.status
              if (status === 404 || status === 403) return { data: null }
              throw requestError
            }),
            appAPIClient.get(`/collections/${collectionId}/payments`).catch((requestError) => {
              const status = requestError?.response?.status
              if (status === 403) return { data: [] }
              throw requestError
            }),
            groupRes.data.role === 'admin'
              ? appAPIClient.get(`/groups/${id}/memberships`).catch(() => ({ data: [] }))
              : Promise.resolve({ data: [] }),
            groupRes.data.role === 'admin'
              ? appAPIClient.get(`/collections/${collectionId}/submissions`).catch(() => ({ data: [] }))
              : Promise.resolve({ data: [] }),
            // Fetch current user's submission (for all users, not just admins)
            appAPIClient.get(`/collections/${collectionId}/submissions/me`).catch(() => ({ data: null })),
          ])

          if (!mounted) return

          setForm(formRes.data)
          setPayments(Array.isArray(paymentsRes.data) ? paymentsRes.data : [])
          setMembers(Array.isArray(membersRes.data) ? membersRes.data : [])
          
          const nextSubmissions = Array.isArray(submissionsRes.data) ? submissionsRes.data : []
          
          // If current user has a submission, add it to the submissions list so prefill works
          if (mySubmissionRes.data && !nextSubmissions.find((s: Submission) => String(s.id) === String(mySubmissionRes.data.id))) {
            nextSubmissions.push(mySubmissionRes.data)
          }
          
          setSubmissions(nextSubmissions)

          // Load submission answers: for admins all submissions, for users only their own
          const submissionsToLoadAnswersFor = groupRes.data.role === 'admin' ? nextSubmissions : (mySubmissionRes.data ? [mySubmissionRes.data] : [])
          
          if (formRes.data?.id && submissionsToLoadAnswersFor.length > 0) {
            const answersBySubmission = await Promise.all(
              submissionsToLoadAnswersFor.map(async (submission: Submission) => {
                const response = await appAPIClient.get(`/submissions/${submission.id}/answers`).catch(() => ({ data: [] }))
                return [submission.id, Array.isArray(response.data) ? response.data : []] as const
              })
            )

            if (!mounted) return

            setSubmissionAnswers(Object.fromEntries(answersBySubmission))
          }
        }
      } catch (loadError: unknown) {
        const apiError = loadError as { response?: { data?: { error?: string } }, message?: string }
        if (mounted) {
          setError(apiError?.response?.data?.error || apiError?.message || 'Failed to load collection')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [collectionId, id])

  const myPayment = useMemo(() => {
    if (!me) return null
    return payments.find((payment) => sameUserId(payment.user_id, me.id)) ?? null
  }, [me, payments])

  const paidPayment = useMemo(() => (myPayment?.status === 'paid' ? myPayment : null), [myPayment])

  const paidUserIds = useMemo(() => new Set(payments.filter((payment) => payment.status === 'paid').map((payment) => String(payment.user_id))), [payments])

  const unpaidMembers = useMemo(
    () => members.filter((member) => member.role !== 'admin' && !paidUserIds.has(String(member.user_id))),
    [members, paidUserIds]
  )

  const paymentByUser = useMemo(() => new Map(payments.map((p) => [String(p.user_id), p])), [payments])

  const mySubmission = useMemo(() => {
    if (!me) return null
    return submissions.find((s) => String(s.user_id) === String(me.id)) ?? null
  }, [submissions, me])

  const isEditing = Boolean(mySubmission)

  async function refreshPayments(collectionIdValue: string) {
    const refreshedPayments = await appAPIClient.get(`/collections/${collectionIdValue}/payments`).catch(() => ({ data: [] }))
    setPayments(Array.isArray(refreshedPayments.data) ? refreshedPayments.data : [])
  }

  async function startPayment(method: 'stripe' | 'cash') {
    if (!collection) return

    setPaying(true)
    setMessage(null)
    setError(null)

    try {
      const response = await appAPIClient.post(`/collections/${collection.id}/payments`, { method })
      const createdPayment = response.data as CreatePaymentResponse

      if (createdPayment.status === 'paid') {
        setMessage('Payment completed and the form is now unlocked.')
      } else if (method === 'cash') {
        setMessage('Cash payment recorded and waiting for confirmation.')
      } else {
        const clientSecret = createdPayment.stripe_payment_intent?.client_secret
        if (clientSecret) {
          setStripeClientSecret(clientSecret)
          setMessage('Complete the Stripe payment form below.')
        } else {
          setMessage('Stripe payment started, but no client secret was returned.')
        }
      }

      await refreshPayments(collection.id)
    } catch (paymentError: unknown) {
      const apiError = paymentError as { response?: { data?: { error?: string } }, message?: string }
      setError(apiError?.response?.data?.error || apiError?.message || 'Failed to create payment')
    } finally {
      setPaying(false)
    }
  }

  async function closeCollection() {
    if (!collection) return
    setMessage(null)
    setError(null)
    try {
      const res = await appAPIClient.patch(`/groups/${id}/collections/${collection.id}/close`, {})
      setCollection(res.data)
      setMessage('Collection closed.')
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } }, message?: string }
      setError(apiError?.response?.data?.error || apiError?.message || 'Failed to close collection')
    }
  }

  async function handleStripeCompleted(nextMessage: string) {
    if (!collection) return
    setStripeClientSecret(null)
    setMessage(nextMessage)
    await refreshPayments(collection.id)
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!collection || !form) return

    if (!paidPayment) {
      setError('Pay for this collection before submitting the form.')
      return
    }

    setSubmitting(true)
    setMessage(null)
    setError(null)

    try {
      const currentSubmission = submissions.find((s) => String(s.user_id) === String(me?.id))

      // Build answers payload per field
      const answersPayload = sortFields(form.fields).map((field) => ({
        field_id: field.id,
        value_text: answers[field.id] ?? '',
      }))

      if (currentSubmission) {
        // Update existing submission (meta)
        await appAPIClient.patch(`/forms/${form.id}/submissions/${currentSubmission.id}`, { form_id: form.id, collection_id: collection.id })

        // Upsert answers: update existing ones, create missing ones
        const existingAnswers = submissionAnswers[currentSubmission.id] ?? []
        await Promise.all(
          answersPayload.map(async (a) => {
            const existing = existingAnswers.find((ea) => String(ea.field_id) === String(a.field_id))
            if (existing) {
              // update
              await appAPIClient.patch(`/answers/${existing.id}`, { value_text: a.value_text })
            } else {
              // create
              await appAPIClient.post(`/submissions/${currentSubmission.id}/answers`, { field_id: a.field_id, value_text: a.value_text })
            }
          })
        )

        setMessage('Submission updated successfully.')
      } else {
        // create new submission
        const payload = { collection_id: collection.id, answers: answersPayload }
        await appAPIClient.post(`/forms/${form.id}/submissions`, payload)
        setMessage('Form submitted successfully.')
      }

      // refresh submissions and answers
      const submissionsRes = await appAPIClient.get(`/collections/${collection.id}/submissions`).catch(() => ({ data: [] }))
      const nextSubmissions = Array.isArray(submissionsRes.data) ? submissionsRes.data : []
      setSubmissions(nextSubmissions)

      if (form.id && nextSubmissions.length > 0) {
        const answersBySubmission = await Promise.all(
          nextSubmissions.map(async (submission: Submission) => {
            const response = await appAPIClient.get(`/submissions/${submission.id}/answers`).catch(() => ({ data: [] }))
            return [submission.id, Array.isArray(response.data) ? response.data : []] as const
          })
        )
        setSubmissionAnswers(Object.fromEntries(answersBySubmission))
      }
    } catch (submissionError: unknown) {
      const apiError = submissionError as { response?: { data?: { error?: string } }, message?: string }
      setError(apiError?.response?.data?.error || apiError?.message || 'Failed to submit form')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">Loading collection…</main>
  }

  if (!group || !collection) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
          {error || 'Collection not found.'}
        </div>
        <Link href={`/groups/${id}`} className="mt-4 inline-block text-blue-600 underline">
          Back to group
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.16em] text-ink/60">Collection</p>
          <h1 className="mt-2 text-4xl font-semibold text-ink">{formatCurrency(collection.amount)}</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-ink/70">
            Due {formatDate(collection.deadline)} · Status: {collection.status}
          </p>
        </div>

        {group.role === 'admin' ? (
          <div className="flex flex-wrap gap-3">
            <Link href={`/groups/${id}/collections/${collectionId}/edit`} className="rounded-full border border-ink/15 bg-cloud px-4 py-2 text-sm font-medium text-ink transition hover:bg-[#f3efe7]">
              Edit collection
            </Link>
            {collection.status !== 'closed' && (
              <button onClick={closeCollection} className="rounded-full border border-ink/15 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100">Close collection</button>
            )}
            <Link href={`/groups/${id}`} className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-cloud transition hover:bg-[#0d1f3f]">
              Back to group
            </Link>
          </div>
        ) : null}
      </div>

      {message ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        {!paidPayment ? (
          <div className="rounded-3xl border border-ink/10 bg-cloud p-6 shadow-[0_18px_45px_rgba(18,32,56,0.08)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-ink">Pay and unlock</h2>
                <p className="mt-2 text-sm leading-6 text-ink/70">
                  Members pay here first. Once payment is recorded, the attached form becomes available.
                </p>
              </div>
              <span className="rounded-full bg-ink/5 px-3 py-1 text-xs uppercase tracking-[0.12em] text-ink/60">
                Locked
              </span>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => startPayment('stripe')}
                disabled={paying}
                className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-cloud transition hover:bg-[#0d1f3f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {paying ? 'Starting payment…' : 'Pay with Stripe'}
              </button>
              <button
                type="button"
                onClick={() => startPayment('cash')}
                disabled={paying}
                className="rounded-full border border-ink/15 bg-cloud px-4 py-2 text-sm font-medium text-ink transition hover:bg-[#f3efe7] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Record cash payment
              </button>
            </div>

            {stripeClientSecret ? (
              <div className="mt-6 rounded-2xl border border-ink/10 bg-[#f8f7f2] p-4">
                <p className="text-sm font-medium text-ink">Stripe payment form</p>
                <p className="mt-2 text-sm text-ink/70">Enter card details to confirm the pending payment.</p>
                <div className="mt-4">
                  <StripePaymentForm
                    clientSecret={stripeClientSecret}
                    onCompleted={handleStripeCompleted}
                    onCancel={() => setStripeClientSecret(null)}
                  />
                </div>
              </div>
            ) : null}

            <div className="mt-6 rounded-2xl border border-ink/10 bg-[#f8f7f2] p-4">
              <p className="text-sm font-medium text-ink">Payment status</p>
              <div className="mt-3 space-y-2 text-sm text-ink/70">
                {!myPayment ? (
                  <p>No payments recorded yet.</p>
                ) : (
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-cloud px-3 py-2">
                    <span>{myPayment.method}</span>
                    <span className="capitalize text-ink/60">{myPayment.status}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <div className="rounded-3xl border border-ink/10 bg-[#f8f7f2] p-6 shadow-[0_18px_45px_rgba(18,32,56,0.05)]">
          <h2 className="text-2xl font-semibold text-ink">Attached form</h2>
          {form ? (
            <form className="mt-4 space-y-4" onSubmit={submitForm}>
              <div className="rounded-2xl border border-ink/10 bg-cloud p-4">
                <p className="text-lg font-medium text-ink">{form.title}</p>
                {form.description ? <p className="mt-2 text-sm leading-6 text-ink/70">{form.description}</p> : null}
                {isEditing ? (
                  <p className="mt-2 rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-800">You're editing your previous submission — changes will update your answers.</p>
                ) : null}
                <p className="mt-2 text-xs uppercase tracking-[0.12em] text-ink/60">
                  {form.is_required ? 'Required after payment' : 'Optional after payment'}
                </p>
              </div>

              {sortFields(form.fields).map((field) => {
                const rawOptions = field.options as unknown
                let options: unknown[] = []
                if (Array.isArray(rawOptions)) {
                  options = rawOptions
                } else if (typeof rawOptions === 'string' && rawOptions.length > 0) {
                  try {
                    const parsed = JSON.parse(rawOptions)
                    if (Array.isArray(parsed)) options = parsed
                  } catch {
                    // ignore parse errors
                  }
                } else if (rawOptions && typeof rawOptions === 'object') {
                  // if it's an object, try to treat it as an array-like map
                  // e.g. { "0": "a", "1": "b" }
                  try {
                    const maybeArray = Object.values(rawOptions as Record<string, unknown>)
                    if (Array.isArray(maybeArray)) options = maybeArray
                  } catch {
                    // ignore
                  }
                }
                const inputValue = answers[field.id] ?? ''

                return (
                  <label key={field.id} className="block">
                    <span className="mb-2 block text-sm font-medium text-ink">
                      {field.label}
                      {field.is_required ? <span className="ml-1 text-ember">*</span> : null}
                    </span>

                    {field.field_type === 'textarea' ? (
                      <textarea
                        value={inputValue}
                        onChange={(event) => setAnswers((current) => ({ ...current, [field.id]: event.target.value }))}
                        placeholder={field.placeholder ?? ''}
                        rows={4}
                        disabled={!paidPayment}
                        className="w-full rounded-2xl border border-ink/15 bg-cloud px-4 py-3 text-base outline-none transition focus:border-forest/50 focus:ring-2 focus:ring-forest/15 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    ) : field.field_type === 'select' ? (
                      <select
                        value={inputValue}
                        onChange={(event) => setAnswers((current) => ({ ...current, [field.id]: event.target.value }))}
                        disabled={!paidPayment}
                        className="w-full rounded-2xl border border-ink/15 bg-cloud px-4 py-3 text-base outline-none transition focus:border-forest/50 focus:ring-2 focus:ring-forest/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="">Choose an option</option>
                        {options.map((option, i) => {
                          if (option && typeof option === 'object') {
                            const o = option as any
                            const val = o.value ?? o.id ?? o.label ?? JSON.stringify(o)
                            const label = o.label ?? o.value ?? JSON.stringify(o)
                            return (
                              <option key={String(i)} value={String(val)}>{label}</option>
                            )
                          }
                          return (
                            <option key={String(i)} value={String(option)}>{String(option)}</option>
                          )
                        })}
                      </select>
                    ) : field.field_type === 'checkbox' ? (
                      <div className="rounded-2xl border border-ink/15 bg-cloud px-4 py-3">
                        <label className="flex items-center gap-3 text-sm text-ink/80">
                          <input
                            type="checkbox"
                            checked={inputValue === 'true'}
                            onChange={(event) => setAnswers((current) => ({ ...current, [field.id]: event.target.checked ? 'true' : 'false' }))}
                            disabled={!paidPayment}
                            className="h-4 w-4 rounded border-ink/20"
                          />
                          {field.placeholder || 'Confirm this checkbox'}
                        </label>
                      </div>
                    ) : (
                      <input
                        type={field.field_type}
                        value={inputValue}
                        onChange={(event) => setAnswers((current) => ({ ...current, [field.id]: event.target.value }))}
                        placeholder={field.placeholder ?? ''}
                        disabled={!paidPayment}
                        className="w-full rounded-2xl border border-ink/15 bg-cloud px-4 py-3 text-base outline-none transition focus:border-forest/50 focus:ring-2 focus:ring-forest/15 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    )}
                  </label>
                )
              })}

              <button
                type="submit"
                disabled={!paidPayment || submitting}
                className="w-full rounded-2xl bg-forest px-4 py-3 text-sm font-semibold text-cloud transition hover:bg-[#2d5f54] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : isEditing ? 'Submit edits' : paidPayment ? 'Submit form' : 'Pay to unlock form'}
              </button>
            </form>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-ink/20 bg-cloud p-4 text-sm text-ink/70">
              No form has been attached to this collection yet.
              {group.role === 'admin' ? (
                <div className="mt-4">
                  <Link href={`/groups/${id}/collections/${collectionId}/edit`} className="text-blue-600 underline">
                    Attach a form now
                  </Link>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {group.role === 'admin' ? (
          <div className="rounded-3xl border border-ink/10 bg-[#f8f7f2] p-6 shadow-[0_18px_45px_rgba(18,32,56,0.05)]">
            <h2 className="text-2xl font-semibold text-ink">Quick status</h2>
            <p className="mt-2 text-sm leading-6 text-ink/70">
              Quickly see who still owes payment and who already submitted the form.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-ink/10 bg-cloud p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-ink/60">Paid</p>
                <p className="mt-2 text-2xl font-semibold text-ink">{paidUserIds.size}</p>
              </div>
              <div className="rounded-2xl border border-ink/10 bg-cloud p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-ink/60">Unpaid</p>
                <p className="mt-2 text-2xl font-semibold text-ink">{unpaidMembers.length}</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div>
                <p className="text-sm font-medium text-ink">Unpaid members</p>
                <div className="mt-2 space-y-2">
                  {unpaidMembers.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-ink/20 bg-cloud px-4 py-3 text-sm text-ink/60">Everyone has paid.</p>
                  ) : (
                    unpaidMembers.map((member) => (
                      <div key={member.user_id} className="rounded-2xl border border-ink/10 bg-cloud px-4 py-3 text-sm text-ink/80">
                        <div className="flex items-center justify-between gap-3">
                          <span>{member.display_name || member.email || `User #${member.user_id}`}</span>
                          <span className="text-ember">Unpaid</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {group.role === 'admin' && form ? (
        <section className="rounded-3xl border border-ink/10 bg-cloud p-6 shadow-[0_18px_45px_rgba(18,32,56,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-ink">Responses</h2>
              <p className="mt-2 text-sm leading-6 text-ink/70">
                Review every submission and its answers in one place.
              </p>
            </div>
            <p className="text-sm text-ink/60">{submissions.length} submission{submissions.length === 1 ? '' : 's'}</p>
          </div>

          <div className="mt-5 space-y-4">
            {submissions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-ink/20 bg-[#f8f7f2] px-4 py-5 text-sm text-ink/60">
                No submissions yet.
              </div>
            ) : (
              submissions.map((submission) => {
                const answers = submissionAnswers[submission.id] ?? []
                const payment = paymentByUser.get(String(submission.user_id))
                return (
                  <article key={submission.id} className="rounded-2xl border border-ink/10 bg-[#f8f7f2] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-ink">
                          {members.find((member) => member.user_id === submission.user_id)?.display_name || members.find((member) => member.user_id === submission.user_id)?.email || `User #${submission.user_id}`}
                        </p>
                        <p className="text-sm text-ink/60">
                          Submitted {submission.submitted_at ? formatDate(submission.submitted_at) : 'recently'}
                        </p>
                      </div>
                      <div className="rounded-full bg-ink/5 px-3 py-1 text-xs uppercase tracking-[0.12em] text-ink/60">
                        {payment?.status === 'paid' ? 'Paid' : payment?.status || 'No payment'}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3">
                      {answers.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-ink/20 bg-cloud px-4 py-3 text-sm text-ink/60">No answers saved yet.</p>
                      ) : (
                        sortFields(form.fields).map((field) => {
                          const answer = answers.find((item) => String(item.field_id) === String(field.id))
                          if (!answer) return null
                          const value = typeof answer.value_text === 'string' && answer.value_text.length > 0
                            ? answer.value_text
                            : answer.value_json !== undefined && answer.value_json !== null
                              ? JSON.stringify(answer.value_json)
                              : 'No value'

                          return (
                            <div key={field.id} className="rounded-xl border border-ink/10 bg-cloud px-4 py-3">
                              <p className="text-xs uppercase tracking-[0.12em] text-ink/60">{field.label}</p>
                              <p className="mt-1 text-sm text-ink">{value}</p>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </section>
      ) : null}
    </main>
  )
}