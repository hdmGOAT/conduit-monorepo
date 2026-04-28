"use client"

import React, { useEffect, useState } from 'react'
import { Button } from './button'
import appAPIClient from '@/lib/api/httpClient'
import { groupFormSchema } from '@/lib/validators/groups'

type Privacy = 'public' | 'private'

interface Group {
  id?: string
  name?: string
  privacy?: Privacy
}

interface GroupFormProps {
  initialData?: Partial<Group>
  onSuccess?: (group: Group) => void
  mode?: 'create' | 'edit'
  groupId?: string
}

export default function GroupForm({
  initialData,
  onSuccess,
  mode = 'create',
  groupId,
}: GroupFormProps) {
  const [name, setName] = useState('')
  const [privacy, setPrivacy] = useState<Privacy>('public')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (initialData) {
      setName(initialData.name ?? '')
      setPrivacy((initialData.privacy as Privacy) ?? 'public')
    }
  }, [initialData])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const result = groupFormSchema.safeParse({
      name,
      privacy,
    })

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors
      const errors: Record<string, string> = {}
      Object.entries(fieldErrors).forEach(([field, messages]) => {
        if (messages?.[0]) {
          errors[field] = messages[0]
        }
      })
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    setSubmitting(true)
    try {
      if (mode === 'edit' && groupId) {
        const body = { name: name.trim() }
        const res = await appAPIClient.patch(`/groups/${groupId}`, body)
        
        // Also update privacy setting
        const privacyBody = { is_open: privacy === 'public' }
        await appAPIClient.patch(`/groups/${groupId}/is_open`, privacyBody)

        const updated = res.data
        onSuccess?.(updated)
        window.location.href = `/groups/${updated.id ?? groupId}`
      } else {
        // create with name and is_open
        const body = { 
          name: name.trim(),
          is_open: privacy === 'public'
        }
        const res = await appAPIClient.post('/groups', body)
        const created = res.data
        onSuccess?.(created)
        if (created?.id) {
          window.location.href = `/groups/${created.id}`
        } else {
          window.location.reload()
        }
      }
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } }, message?: string }
      setError(apiError?.response?.data?.error || apiError?.message || 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block font-medium">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full border rounded px-3 py-2"
          placeholder="Group name"
          required
          minLength={3}
        />
        {fieldErrors.name ? <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p> : null}
      </div>

      <div>
          <label className="block font-medium">Privacy</label>
          <select
            value={privacy}
            onChange={(e) => setPrivacy(e.target.value as Privacy)}
            className="mt-1 block w-full border rounded px-3 py-2"
          >
            <option value="public">Public — anyone can join</option>
            <option value="private">Private — request to join</option>
          </select>
          {fieldErrors.privacy ? <p className="mt-1 text-sm text-red-600">{fieldErrors.privacy}</p> : null}
        </div>

      {error && <div className="text-red-600">{error}</div>}

      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? (mode === 'edit' ? 'Saving…' : 'Creating…') : mode === 'edit' ? 'Save changes' : 'Create group'}
        </Button>
      </div>
    </form>
  )
}
