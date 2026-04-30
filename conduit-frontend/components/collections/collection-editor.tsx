"use client"

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/button'
import appAPIClient from '@/lib/api/httpClient'

type CollectionFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'email' | 'phone'

type CollectionField = {
  id?: string
  localId?: string
  fieldKey: string
  label: string
  fieldType: CollectionFieldType
  placeholder: string
  isRequired: boolean
  sortOrder: number
  optionsText: string
  persisted: boolean
}

type CollectionPayload = {
  amount: number
  deadline: string
}

type CollectionSummary = {
  id: string
  amount: number
  deadline: string
  status?: string
}

type FormSummary = {
  id: string
  title: string
  description?: string | null
  is_required: boolean
}

type MembershipRecord = {
  user_id: string
}

type CollectionEditorProps = {
  groupId: string
  mode: 'create' | 'edit'
  collectionId?: string
  initialCollection?: CollectionSummary | null
  initialForm?: FormSummary | null
  initialFields?: Array<Partial<CollectionField> & { id?: string; options?: unknown }>
}

const fieldTypeOptions: CollectionFieldType[] = ['text', 'textarea', 'number', 'date', 'select', 'checkbox', 'email', 'phone']

function formatAmountInput(amountInCents?: number | null) {
  if (typeof amountInCents !== 'number' || Number.isNaN(amountInCents)) return ''
  return (amountInCents / 100).toFixed(2)
}

function formatDeadlineInput(deadline?: string | null) {
  if (!deadline) return ''
  const date = new Date(deadline)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60 * 1000)
  return localDate.toISOString().slice(0, 16)
}

function normalizeFieldKey(value: string, fallbackIndex: number) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return normalized || `field_${fallbackIndex}`
}

function emptyField(sortOrder: number): CollectionField {
  return {
    localId: `local_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
    fieldKey: `field_${sortOrder}`,
    label: '',
    fieldType: 'text',
    placeholder: '',
    isRequired: false,
    sortOrder,
    optionsText: '',
    persisted: false,
  }
}

function toDraftField(field: Partial<CollectionField> & { id?: string; options?: unknown }, index: number): CollectionField {
  const optionsText = Array.isArray(field.options) ? field.options.join(', ') : ''

  return {
    id: field.id,
    localId: field.id ? String(field.id) : `local_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
    fieldKey: field.fieldKey ?? `field_${index + 1}`,
    label: field.label ?? '',
    fieldType: field.fieldType ?? 'text',
    placeholder: field.placeholder ?? '',
    isRequired: field.isRequired ?? false,
    sortOrder: field.sortOrder ?? index + 1,
    optionsText,
    persisted: true,
  }
}

export function CollectionEditor({
  groupId,
  mode,
  collectionId,
  initialCollection,
  initialForm,
  initialFields = [],
}: CollectionEditorProps) {
  const router = useRouter()
  // `perMember` stores the amount each member pays in pesos as a string (e.g., "2500.00").
  const [perMember, setPerMember] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [deadline, setDeadline] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formRequired, setFormRequired] = useState(true)
  const [fields, setFields] = useState<CollectionField[]>(() => {
    return initialFields && initialFields.length > 0
      ? initialFields.map((field, index) => toDraftField(field, index))
      : [emptyField(1)]
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [membersCount, setMembersCount] = useState<number | null>(null)

  useEffect(() => {
    if (initialCollection) {
      // initialCollection.amount is stored as integer cents representing
      // the per-member base amount. We display pesos (divide by 100).
      setPerMember(formatAmountInput(initialCollection.amount))
      setDeadline(formatDeadlineInput(initialCollection.deadline))
    }
  }, [initialCollection])

  useEffect(() => {
    if (initialForm) {
      setFormTitle(initialForm.title)
      setFormDescription(initialForm.description ?? '')
      setFormRequired(initialForm.is_required)
    }
  }, [initialForm])

  useEffect(() => {
    // Fetch memberships count for this group to derive total amount.
    let mounted = true
    async function loadMembers() {
      try {
        // Also fetch current user so we can exclude the creator/self from the count
        const [mRes, meRes] = await Promise.all([
          appAPIClient.get(`/groups/${groupId}/memberships`).catch(() => ({ data: [] })),
          appAPIClient.get('/auth/me').catch(() => ({ data: null })),
        ])

        if (!mounted) return
        const list = Array.isArray(mRes.data) ? mRes.data : []
        const me = meRes?.data ?? null

        // If the current user is included in the memberships, exclude them
        // from the payable members count because creators typically don't
        // pay themselves. Keep a minimum of 0.
        const includesMe = me && list.some((membership: MembershipRecord) => String(membership.user_id) === String(me.id))
        const count = Math.max(0, list.length - (includesMe ? 1 : 0))
        setMembersCount(count)
      } catch {
        // ignore — membersCount can remain null and user can edit totals manually
      }
    }

    if (groupId) loadMembers()
    return () => { mounted = false }
  }, [groupId])

  // `fields` are initialized from `initialFields` above. Avoid reacting
  // to `initialFields` changes on every render because parent code may
  // pass a new array reference each render which can cause an update
  // loop when we call `setFields` here. If dynamic updates from the
  // parent are required later, add a stable equality check before
  // calling `setFields` to prevent infinite re-renders.

  const editableFields = useMemo(
    () => fields.map((field, index) => ({ field, index })),
    [fields]
  )

  function updateField(index: number, patch: Partial<CollectionField>) {
    setFields((current) => current.map((field, currentIndex) => (currentIndex === index ? { ...field, ...patch } : field)))
  }

  function addField() {
    setFields((current) => [...current, emptyField(current.length + 1)])
  }

  function removeField(index: number) {
    setFields((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  function moveFieldUp(index: number) {
    setFields((current) => {
      if (index <= 0) return current
      const next = [...current]
      const tmp = next[index - 1]
      next[index - 1] = next[index]
      next[index] = tmp
      return next.map((f, i) => ({ ...f, sortOrder: i + 1 }))
    })
  }

  function moveFieldDown(index: number) {
    setFields((current) => {
      if (index >= current.length - 1) return current
      const next = [...current]
      const tmp = next[index + 1]
      next[index + 1] = next[index]
      next[index] = tmp
      return next.map((f, i) => ({ ...f, sortOrder: i + 1 }))
    })
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const perMemberValue = Number(perMember)
    const totalValue = Number(totalAmount)

    // Determine per-member base amount to send to backend (in pesos).
    let resolvedPerMember: number | null = null
    if (Number.isFinite(perMemberValue) && perMemberValue > 0) {
      resolvedPerMember = perMemberValue
    } else if (Number.isFinite(totalValue) && totalValue > 0 && membersCount && membersCount > 0) {
      resolvedPerMember = totalValue / membersCount
    }

    if (!resolvedPerMember || !Number.isFinite(resolvedPerMember) || resolvedPerMember <= 0) {
      setError('Enter a valid per-member or total amount greater than zero.')
      return
    }

    const deadlineValue = new Date(deadline)
    if (Number.isNaN(deadlineValue.getTime())) {
      setError('Choose a valid deadline.')
      return
    }

    if (!formTitle.trim()) {
      setError('Attach a form title before saving this collection.')
      return
    }

    // Backend expects amount in smallest units (centavos). We operate in
    // pesos in the UI, so convert pesos -> centavos by multiplying by 100.
    const collectionPayload: CollectionPayload = {
      amount: Math.round(resolvedPerMember * 100),
      deadline: deadlineValue.toISOString(),
    }

    setSubmitting(true)
    try {
      const collectionResponse = mode === 'edit' && collectionId
        ? await appAPIClient.patch(`/groups/${groupId}/collections/${collectionId}`, collectionPayload)
        : await appAPIClient.post(`/groups/${groupId}/collections`, collectionPayload)

      const savedCollectionId = String(collectionResponse.data?.id ?? collectionId ?? '')
      if (!savedCollectionId) {
        throw new Error('Collection save did not return an id.')
      }

      const formPayload = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        is_required: formRequired,
        fields: fields
          .filter((field) => field.label.trim().length > 0)
          .map((field, index) => ({
            id: field.persisted && field.id ? Number(field.id) : undefined,
            field_key: normalizeFieldKey(field.fieldKey || field.label, index + 1),
            label: field.label.trim(),
            field_type: field.fieldType,
            placeholder: field.placeholder.trim(),
            is_required: field.isRequired,
            options: field.fieldType === 'select' || field.fieldType === 'checkbox'
              ? field.optionsText.split(',').map((option) => option.trim()).filter(Boolean)
              : undefined,
            sort_order: index + 1,
          })),
      }

      let savedFormId = initialForm?.id
      if (savedFormId) {
        const updatedForm = await appAPIClient.put(`/forms/${savedFormId}`, formPayload)
        savedFormId = String(updatedForm.data?.id ?? savedFormId)
      } else {
        const createdForm = await appAPIClient.post(`/collections/${savedCollectionId}/form`, formPayload)
        savedFormId = String(createdForm.data?.id ?? '')
        if (!savedFormId) {
          throw new Error('Form save did not return an id.')
        }
        const updatedForm = await appAPIClient.put(`/forms/${savedFormId}`, formPayload)
        savedFormId = String(updatedForm.data?.id ?? savedFormId)
      }

      router.push(`/groups/${groupId}/collections/${savedCollectionId}`)
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save collection.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-12">
      {error && (
        <div className="float-in flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/50 p-4 text-rose-800 backdrop-blur-sm">
          <svg className="h-5 w-5 flex-shrink-0 text-rose-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <section className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
        {/* Left Column: Details */}
        <div className="glass-card rounded-[2.5rem] border border-ink/10 p-8 shadow-glow">
          <div className="mb-8">
            <h2 className="font-display text-2xl font-bold text-ink">Collection Details</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/60">
              Set the financial targets and deadline for this collection.
            </p>
          </div>

          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-bold text-ink/70">Amount per member</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/30 font-medium">$</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={perMember}
                    onChange={(e) => {
                      const v = e.currentTarget.value
                      setPerMember(v)
                      const n = Number(v)
                      if (membersCount && Number.isFinite(n)) setTotalAmount((n * membersCount).toFixed(2))
                    }}
                    placeholder="0.00"
                    className="w-full rounded-2xl border border-ink/10 bg-white/50 pl-8 pr-4 py-3.5 text-ink outline-none focus:border-ink/20 focus:ring-4 focus:ring-ink/5 transition-all"
                    required
                  />
                </div>
                <p className="text-[10px] font-medium text-ink/40 italic">Individual contribution in USD.</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <label className="text-sm font-bold text-ink/70">Total Goal</label>
                  {membersCount !== null && (
                    <span className="text-[10px] font-bold text-forest uppercase tracking-wider bg-forest/5 px-2 py-0.5 rounded-full">
                      {membersCount} members
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/30 font-medium">$</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={totalAmount}
                    onChange={(e) => {
                      const v = e.currentTarget.value
                      setTotalAmount(v)
                      const n = Number(v)
                      if (membersCount && Number.isFinite(n) && membersCount > 0) setPerMember((n / membersCount).toFixed(2))
                    }}
                    placeholder="0.00"
                    className="w-full rounded-2xl border border-ink/10 bg-white/50 pl-8 pr-4 py-3.5 text-ink outline-none focus:border-ink/20 focus:ring-4 focus:ring-ink/5 transition-all"
                  />
                </div>
                <p className="text-[10px] font-medium text-ink/40 italic">Estimated total for the group.</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-ink/70">Deadline</label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.currentTarget.value)}
                className="w-full rounded-2xl border border-ink/10 bg-white/50 px-4 py-3.5 text-ink outline-none focus:border-ink/20 focus:ring-4 focus:ring-ink/5 transition-all"
                required
              />
            </div>

            <div className="pt-4">
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-ink/5 bg-ink/[0.02] p-4 transition-colors hover:bg-ink/[0.04]">
                <input
                  type="checkbox"
                  checked={formRequired}
                  onChange={(e) => setFormRequired(e.currentTarget.checked)}
                  className="mt-1 h-4 w-4 rounded border-ink/20 text-ink focus:ring-ink/10"
                />
                <div>
                  <p className="text-sm font-bold text-ink">Require Form Completion</p>
                  <p className="mt-0.5 text-xs text-ink/50">Members must fill out the form before finishing their payment.</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Form Editor */}
        <div className="glass-card rounded-[2.5rem] border border-ink/10 p-8 shadow-glow">
          <div className="mb-8">
            <h2 className="font-display text-2xl font-bold text-ink">Attached Form</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/60">
              Collect additional details from members after they pay.
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-ink/70">Form Title</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.currentTarget.value)}
                placeholder="e.g., T-Shirt Sizes & Dietary Requirements"
                className="w-full rounded-2xl border border-ink/10 bg-white/50 px-4 py-3.5 text-ink outline-none focus:border-ink/20 focus:ring-4 focus:ring-ink/5 transition-all font-medium"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-ink/70">Form Description</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.currentTarget.value)}
                rows={3}
                placeholder="Explain why you need this information..."
                className="w-full rounded-2xl border border-ink/10 bg-white/50 px-4 py-3.5 text-ink outline-none focus:border-ink/20 focus:ring-4 focus:ring-ink/5 transition-all text-sm leading-relaxed"
              />
            </div>

            <div className="pt-6 border-t border-ink/5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-widest text-ink/30">Form Fields</h3>
                <Button type="button" variant="nav-secondary" size="sm" onClick={addField} className="!px-4">
                  Add Field
                </Button>
              </div>

              <div className="space-y-4">
                {editableFields.length === 0 && (
                  <div className="rounded-[2rem] border border-dashed border-ink/10 p-10 text-center">
                    <p className="text-sm text-ink/40">No fields added yet.</p>
                  </div>
                )}

                {editableFields.map(({ field, index }) => (
                  <div key={field.id ?? field.localId} className="group relative rounded-[2rem] border border-ink/10 bg-white/40 p-5 backdrop-blur-sm transition-all hover:bg-white/60">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink/5 text-[10px] font-bold text-ink/40">
                          {index + 1}
                        </span>
                        <p className="text-xs font-bold uppercase tracking-wider text-ink/60">
                          {field.fieldType} field
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button type="button" onClick={() => moveFieldUp(index)} disabled={index === 0} className="p-1.5 text-ink/40 hover:text-ink disabled:opacity-20 transition-colors">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                        </button>
                        <button type="button" onClick={() => moveFieldDown(index)} disabled={index === fields.length - 1} className="p-1.5 text-ink/40 hover:text-ink disabled:opacity-20 transition-colors">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        <button type="button" onClick={() => removeField(index)} className="ml-1 p-1.5 text-ember/60 hover:text-ember transition-colors">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-ink/30 ml-1">Label</label>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => updateField(index, { label: e.currentTarget.value })}
                          placeholder="e.g., T-Shirt Size"
                          className="w-full rounded-xl border border-ink/5 bg-white/50 px-3 py-2 text-sm outline-none focus:border-ink/10 focus:ring-2 focus:ring-ink/5 transition-all"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-ink/30 ml-1">Type</label>
                        <select
                          value={field.fieldType}
                          onChange={(e) => updateField(index, { fieldType: e.currentTarget.value as CollectionFieldType })}
                          className="w-full rounded-xl border border-ink/5 bg-white/50 px-3 py-2 text-sm outline-none focus:border-ink/10 focus:ring-2 focus:ring-ink/5 transition-all appearance-none"
                        >
                          {fieldTypeOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-ink/30 ml-1">Placeholder</label>
                        <input
                          type="text"
                          value={field.placeholder}
                          onChange={(e) => updateField(index, { placeholder: e.currentTarget.value })}
                          placeholder="e.g., Small, Medium, Large..."
                          className="w-full rounded-xl border border-ink/5 bg-white/50 px-3 py-2 text-sm outline-none focus:border-ink/10 focus:ring-2 focus:ring-ink/5 transition-all"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-5">
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={field.isRequired}
                            onChange={(e) => updateField(index, { isRequired: e.currentTarget.checked })}
                            className="h-3.5 w-3.5 rounded border-ink/20 text-ink focus:ring-ink/10"
                          />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-ink/60">Required</span>
                        </label>
                      </div>

                      {(field.fieldType === 'select' || field.fieldType === 'checkbox') && (
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-ink/30 ml-1">Options (comma separated)</label>
                          <input
                            type="text"
                            value={field.optionsText}
                            onChange={(e) => updateField(index, { optionsText: e.currentTarget.value })}
                            placeholder="Option 1, Option 2, Option 3"
                            className="w-full rounded-xl border border-ink/5 bg-white/50 px-3 py-2 text-sm outline-none focus:border-ink/10 focus:ring-2 focus:ring-ink/5 transition-all"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-center gap-4 pt-8">
        <Button
          variant="nav-secondary"
          size="md"
          onClick={() => { if (groupId) router.push(`/groups/${groupId}`); else router.back() }}
          className="min-w-[160px]"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={submitting}
          className="min-w-[200px]"
        >
          {submitting ? (mode === 'edit' ? 'Saving...' : 'Creating...') : mode === 'edit' ? 'Save Collection' : 'Launch Collection'}
        </Button>
      </div>
    </form>
  )
}