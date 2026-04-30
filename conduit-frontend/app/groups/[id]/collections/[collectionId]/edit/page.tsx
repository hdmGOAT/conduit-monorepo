"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import appAPIClient from '@/lib/api/httpClient'
import { CollectionEditor } from '@/components/collections/collection-editor'
import { Button } from '@/components/button'

type Collection = {
  id: string
  group_id: string
  amount: number
  deadline: string
  status?: string
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
  fields?: FormField[]
}

export default function Page() {
  const params = useParams() as { id: string; collectionId: string }
  const { id, collectionId } = params
  const [collection, setCollection] = useState<Collection | null>(null)
  const [form, setForm] = useState<CollectionForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const [collectionsRes, formRes] = await Promise.all([
          appAPIClient.get(`/groups/${id}/collections`),
          appAPIClient.get(`/collections/${collectionId}/form`),
        ])

        if (!mounted) return

        const nextCollection = (Array.isArray(collectionsRes.data) ? collectionsRes.data : []).find((item: Collection) => String(item.id) === String(collectionId))
        setCollection(nextCollection ?? null)
        setForm(formRes.data)
      } catch (loadError: unknown) {
        const apiError = loadError as { response?: { data?: { error?: string } }, message?: string }
        if (mounted) {
          setError(apiError?.response?.data?.error || apiError?.message || 'Failed to load collection')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [collectionId, id])

  if (loading) {
    return (
      <main className="mx-auto flex max-w-6xl items-center justify-center px-5 py-32 sm:px-8">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/20 border-t-ink"></div>
          <p className="text-sm font-medium text-ink/60">Loading collection...</p>
        </div>
      </main>
    )
  }

  if (!collection) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-24 sm:px-8">
        <div className="rounded-3xl border border-rose-100 bg-rose-50/50 p-8 text-center backdrop-blur-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-rose-900">Collection not found</h2>
          <p className="mt-2 text-rose-700/70">{error || 'Could not find the collection you are trying to edit.'}</p>
          <div className="mt-8">
            <Button href={`/groups/${id}`} variant="secondary">Back to group</Button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
      <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-forest/60">Settings</p>
          <h1 className="mt-3 font-display text-5xl font-bold tracking-tight text-ink sm:text-6xl">
            Edit collection.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink/60">
            Update the payment target or the attached form fields. Changes will be reflected immediately for all members.
          </p>
        </div>

        <Button href={`/groups/${id}/collections/${collectionId}`} variant="nav-secondary" size="sm">
          Preview Live Page
        </Button>
      </div>

      <div className="float-in delay-1">
        <CollectionEditor
          groupId={id}
          mode="edit"
          collectionId={collectionId}
          initialCollection={collection}
          initialForm={form}
          initialFields={(form?.fields ?? []).map((field) => ({
            id: field.id,
            fieldKey: field.field_key,
            label: field.label,
            fieldType: (field.field_type === "boolean" ? "checkbox" : field.field_type) as "text" | "textarea" | "number" | "date" | "select" | "checkbox" | "email" | "phone",
            placeholder: field.placeholder ?? undefined,
            isRequired: field.is_required,
            options: field.options,
            sortOrder: field.sort_order,
            persisted: true,
          }))}
        />
      </div>
    </main>
  )
}