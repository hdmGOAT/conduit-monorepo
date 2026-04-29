"use client"

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import appAPIClient from '@/lib/api/httpClient'
import { StripePaymentForm } from '@/components/collections/stripe-payment-form'
import { Button } from '@/components/button'

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

function parseFieldOptions(options: unknown): string[] {
  // Handle null/undefined
  if (!options) return []
  
  // If already an array, return it
  if (Array.isArray(options)) return options.map(o => String(o))
  
  // If string, try to decode from base64 then parse as JSON
  if (typeof options === 'string') {
    try {
      // Try base64 decode first
      const decoded = atob(options)
      const parsed = JSON.parse(decoded)
      if (Array.isArray(parsed)) return parsed.map(o => String(o))
    } catch {
      // If base64 decode fails, try parsing as JSON directly
      try {
        const parsed = JSON.parse(options)
        if (Array.isArray(parsed)) return parsed.map(o => String(o))
      } catch {
        // If all else fails, return empty array
        return []
      }
    }
  }
  
  return []
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
    if (!me || !form) return

    // Find the current user's submission across all submissions
    const mySubmission = submissions.find((s) => String(s.user_id) === String(me.id))
    if (!mySubmission) return

    const myAnswers = submissionAnswers[mySubmission.id] ?? []
    if (myAnswers.length === 0) return

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

    // Set answers with the prefilled values
    if (Object.keys(map).length > 0) {
      setAnswers((current) => ({
        ...Object.fromEntries(sortFields(form.fields).map((f) => [String(f.id), current[String(f.id)] ?? ''])),
        ...map
      }))
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

  const router = useRouter()

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

        // Clear form fields after successful submission
        setAnswers({})

        // Navigate back to group page to 'close' the form view
        try {
          router.push(`/groups/${id}`)
        } catch {
          // ignore navigation errors
        }
    } catch (submissionError: unknown) {
      const apiError = submissionError as { response?: { data?: { error?: string } }, message?: string }
      setError(apiError?.response?.data?.error || apiError?.message || 'Failed to submit form')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex max-w-6xl items-center justify-center px-5 py-32 sm:px-8">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/20 border-t-ink"></div>
          <p className="text-sm font-medium text-ink/60">Loading collection details...</p>
        </div>
      </main>
    )
  }

  if (!group || !collection) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-24 sm:px-8">
        <div className="rounded-3xl border border-rose-100 bg-rose-50/50 p-8 text-center backdrop-blur-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-rose-900">Collection not found</h2>
          <p className="mt-2 text-rose-700/70">{error || 'This collection might have been deleted or moved.'}</p>
          <div className="mt-8">
            <Button href={`/groups/${id}`} variant="secondary">Back to group</Button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
      {/* Header */}
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-mist px-3 py-1 text-xs font-bold uppercase tracking-wider text-forest">
              {collection.status}
            </span>
            <span className="text-sm text-ink/50">Collection</span>
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            {formatCurrency(collection.amount)}
          </h1>
          <p className="mt-3 text-lg text-ink/60">
            Due <span className="font-medium text-ink">{formatDate(collection.deadline)}</span>
          </p>
        </div>

        <div className="flex flex-col gap-3 items-end">
          {group.role === 'admin' && (
            <div className="flex items-center gap-2">
              <Button href={`/groups/${id}/collections/${collectionId}/edit`} variant="nav-secondary" size="sm">
                Edit Settings
              </Button>
              {collection.status !== 'closed' && (
                <Button onClick={closeCollection} variant="tertiary" size="sm">
                  Close
                </Button>
              )}
            </div>
          )}
          <Button href={`/groups/${id}`} variant="nav-secondary" size="sm">
            ← Group
          </Button>
        </div>
      </div>

      {/* Notifications */}
      <div className="space-y-4 mb-10">
        {message && (
          <div className="float-in flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 text-emerald-800 backdrop-blur-sm">
            <svg className="h-5 w-5 flex-shrink-0 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <p className="text-sm font-medium">{message}</p>
          </div>
        )}

        {error && (
          <div className="float-in flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/50 p-4 text-rose-800 backdrop-blur-sm">
            <svg className="h-5 w-5 flex-shrink-0 text-rose-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left: Payment & Form */}
        <div className="lg:col-span-2 space-y-8">
          <div className="grid gap-8 sm:grid-cols-2">
            {/* Payment Section */}
            {!paidPayment && (
              <section className="glass-card rounded-3xl border border-ink/10 p-6 shadow-glow">
                <div className="mb-4">
                  <h2 className="font-display text-xl font-bold text-ink">Payment</h2>
                  <p className="mt-1 text-xs leading-relaxed text-ink/60">
                    Unlock form
                  </p>
                </div>

                <div className="flex flex-col gap-2 mb-6">
                  <Button onClick={() => startPayment('stripe')} disabled={paying} variant="primary" size="sm" className="w-full">
                    {paying ? 'Processing...' : 'Stripe'}
                  </Button>
                  <Button onClick={() => startPayment('cash')} disabled={paying} variant="nav-secondary" size="sm" className="w-full">
                    Cash
                  </Button>
                </div>

                {stripeClientSecret && (
                  <div className="rounded-2xl border border-ink/5 bg-ink/[0.02] p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-ink/40 mb-3">Checkout</h3>
                    <StripePaymentForm
                      clientSecret={stripeClientSecret}
                      onCompleted={handleStripeCompleted}
                      onCancel={() => setStripeClientSecret(null)}
                    />
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-ink/5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-ink/30 mb-2">Status</p>
                  {!myPayment ? (
                    <div className="flex items-center gap-2 text-ink/50">
                      <div className="h-1.5 w-1.5 rounded-full bg-ember animate-pulse"></div>
                      <span className="text-xs">Pending</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-lg bg-ink/5 px-3 py-2">
                      <span className="text-xs font-medium text-ink/70 capitalize">{myPayment.method}</span>
                      <span className={`text-[10px] font-bold uppercase ${myPayment.status === 'paid' ? 'text-forest' : 'text-ember'}`}>
                        {myPayment.status}
                      </span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Form Section */}
            <section className="glass-card rounded-3xl border border-ink/10 p-6 shadow-glow">
              <div className="mb-4">
                <h2 className="font-display text-xl font-bold text-ink">Details</h2>
                {form && (
                  <div className="mt-3 rounded-xl bg-forest/5 border border-forest/10 p-3">
                    <h3 className="text-sm font-bold text-forest">{form.title}</h3>
                    {form.description && <p className="mt-1 text-xs leading-relaxed text-forest/70">{form.description}</p>}
                    {isEditing && (
                      <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-100/50 px-2 py-1 text-[10px] font-medium text-amber-800">
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                        Editing
                      </div>
                    )}
                  </div>
                )}
              </div>

              {form ? (
                <form onSubmit={submitForm} className="space-y-4">
                  {sortFields(form.fields).map((field) => {
                    const inputValue = answers[field.id] ?? ''
                    const fieldOptions = parseFieldOptions(field.options)
                  
                  return (
                    <div key={field.id} className="space-y-1">
                      <label className="text-xs font-bold text-ink/70">
                        {field.label}
                        {field.is_required && <span className="ml-1 text-ember">*</span>}
                      </label>

                      {field.field_type === 'textarea' ? (
                        <textarea
                          value={inputValue}
                          onChange={(e) => setAnswers(curr => ({ ...curr, [field.id]: e.target.value }))}
                          placeholder={field.placeholder ?? ''}
                          rows={3}
                          disabled={!paidPayment}
                          className="w-full rounded-lg border border-ink/10 bg-white/50 px-3 py-2 text-sm text-ink outline-none focus:border-ink/20 focus:ring-2 focus:ring-ink/5 disabled:opacity-50 transition-all"
                        />
                      ) : field.field_type === 'select' ? (
                        <select
                          value={inputValue}
                          onChange={(e) => setAnswers(curr => ({ ...curr, [field.id]: e.target.value }))}
                          disabled={!paidPayment}
                          className="w-full rounded-lg border border-ink/10 bg-white/50 px-3 py-2 text-sm text-ink outline-none focus:border-ink/20 focus:ring-2 focus:ring-ink/5 disabled:opacity-50 transition-all appearance-none"
                        >
                          <option value="" disabled>{field.placeholder || 'Select an option'}</option>
                          {fieldOptions.map((option, idx) => (
                            <option key={idx} value={String(option)}>
                              {String(option)}
                            </option>
                          ))}
                        </select>
                      ) : field.field_type === 'checkbox' ? (
                        <div className="space-y-1">
                          {fieldOptions.map((option, idx) => (
                            <label key={idx} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={inputValue.includes(String(option))}
                                onChange={(e) => {
                                  const optionStr = String(option)
                                  if (e.target.checked) {
                                    const currentValues = inputValue ? inputValue.split('|') : []
                                    if (!currentValues.includes(optionStr)) {
                                      currentValues.push(optionStr)
                                      setAnswers(curr => ({ ...curr, [field.id]: currentValues.join('|') }))
                                    }
                                  } else {
                                    const currentValues = inputValue.split('|').filter(v => v !== optionStr)
                                    setAnswers(curr => ({ ...curr, [field.id]: currentValues.join('|') }))
                                  }
                                }}
                                disabled={!paidPayment}
                                className="h-3.5 w-3.5 rounded border-ink/20 text-forest focus:ring-ink/10 disabled:opacity-50 transition-all"
                              />
                              <span className="text-xs text-ink/70">{String(option)}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <input
                          type={field.field_type}
                          value={inputValue}
                          onChange={(e) => setAnswers(curr => ({ ...curr, [field.id]: e.target.value }))}
                          placeholder={field.placeholder ?? ''}
                          disabled={!paidPayment}
                          className="w-full rounded-lg border border-ink/10 bg-white/50 px-3 py-2 text-sm text-ink outline-none focus:border-ink/20 focus:ring-2 focus:ring-ink/5 disabled:opacity-50 transition-all"
                        />
                      )}
                    </div>
                  )
                })}

                <Button
                  type="submit"
                  disabled={!paidPayment || submitting}
                  variant={paidPayment ? 'primary' : 'nav-secondary'}
                  size="sm"
                  className="w-full"
                >
                  {submitting ? 'Submitting...' : isEditing ? 'Update' : paidPayment ? 'Submit' : 'Pay to Unlock'}
                </Button>
              </form>
            ) : (
              <div className="rounded-lg border border-dashed border-ink/10 p-4 text-center">
                <p className="text-xs text-ink/40">No form details required for this collection.</p>
              </div>
            )}
          </section>
        </div>
      </div>

        {/* Right Sidebar: Admin Stats */}
        {group.role === 'admin' && (
          <div>
            <section className="glass-card rounded-3xl border border-ink/10 p-6 shadow-glow">
              <h2 className="font-display text-lg font-bold text-ink">Status</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-forest/5 p-3 border border-forest/10">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-forest/60">Paid</p>
                  <p className="mt-1 text-2xl font-bold text-forest">{paidUserIds.size}</p>
                </div>
                <div className="rounded-xl bg-ember/5 p-3 border border-ember/10">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-ember/60">Unpaid</p>
                  <p className="mt-1 text-2xl font-bold text-ember">{unpaidMembers.length}</p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-ink/30">Pending</h3>
                <div className="max-h-[250px] overflow-y-auto space-y-1.5 pr-2">
                  {unpaidMembers.length === 0 ? (
                    <p className="text-xs italic text-ink/40">All paid up.</p>
                  ) : (
                    unpaidMembers.map(member => (
                      <div key={member.user_id} className="flex items-center justify-between rounded-lg bg-ink/5 p-2">
                        <span className="text-xs font-medium text-ink/70 truncate mr-1">
                          {member.display_name || member.email}
                        </span>
                        <span className="text-[9px] font-bold text-ember uppercase tracking-tighter shrink-0">Unpaid</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Submissions Table */}
      {group.role === 'admin' && form && (
        <section className="mt-12 pt-12 border-t border-ink/10">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="font-display text-2xl font-bold text-ink">Submissions</h2>
            <span className="text-sm font-medium text-ink/40">{submissions.length}</span>
          </div>

          <div className="grid gap-4">
            {submissions.length === 0 ? (
              <div className="glass-card rounded-3xl border border-dashed border-ink/10 p-8 text-center">
                <p className="text-sm text-ink/40">Waiting for responses...</p>
              </div>
            ) : (
              submissions.map(submission => {
                const answers = submissionAnswers[submission.id] ?? []
                const payment = paymentByUser.get(String(submission.user_id))
                return (
                  <article key={submission.id} className="glass-card overflow-hidden rounded-2xl border border-ink/10 shadow-glow">
                    <div className="flex items-center justify-between bg-ink/5 px-4 py-3">
                      <div>
                        <p className="text-xs font-bold text-ink">
                          {members.find(m => m.user_id === submission.user_id)?.display_name || 'Anonymous'}
                        </p>
                        <p className="text-[9px] text-ink/40 uppercase tracking-widest mt-0.5">
                          {submission.submitted_at ? formatDate(submission.submitted_at) : 'Recently'}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${payment?.status === 'paid' ? 'bg-forest/10 text-forest' : 'bg-ember/10 text-ember'}`}>
                        {payment?.status === 'paid' ? 'Paid' : 'Unconfirmed'}
                      </span>
                    </div>
                    <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {sortFields(form.fields).map(field => {
                        const answer = answers.find(a => String(a.field_id) === String(field.id))
                        return (
                          <div key={field.id} className="space-y-0.5">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-ink/30">{field.label}</p>
                            <p className="text-xs font-medium text-ink/80 break-words">
                              {answer?.value_text || (answer?.value_json ? JSON.stringify(answer.value_json) : '—')}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </section>
      )}
    </main>
  )
}
