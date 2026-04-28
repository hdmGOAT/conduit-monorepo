"use client"

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import appAPIClient from '@/lib/api/httpClient'
import GroupForm from '@/components/GroupForm'

interface Group {
  id: string
  name: string
  role?: string
  is_open?: boolean
}

export default function EditGroupPage() {
  const params = useParams() as { id: string }
  const id = params.id
  const [group, setGroup] = useState<Group | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    appAPIClient.get(`/groups/${id}`).then(res => {
      if (mounted) {
        setGroup(res.data)
        if (res.data.role !== 'admin') {
          setError('You do not have permission to edit this group')
        }
      }
    }).catch(err => {
      if (mounted) setError(err?.response?.data?.error || err?.message || 'Failed to load group')
    }).finally(() => {
      if (mounted) setLoading(false)
    })
    return () => { mounted = false }
  }, [id])

  if (loading) {
    return <main className="max-w-3xl mx-auto p-6">Loading...</main>
  }

  if (error || !group || group.role !== 'admin') {
    return (
      <main className="max-w-3xl mx-auto p-6">
        <div className="rounded border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 mb-4">
          {error || 'Group not found or no permission.'}
        </div>
        <Link href={`/groups/${id}`} className="text-blue-600 underline">Back to group</Link>
      </main>
    )
  }

  return (
    <main className="max-w-3xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Edit Group</h1>
        <Link href={`/groups/${id}`} className="text-blue-600 underline">
          Cancel
        </Link>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <GroupForm 
          mode="edit" 
          groupId={id} 
          initialData={{ name: group.name, privacy: group.is_open ? 'public' : 'private' }} 
        />
      </div>
    </main>
  )
}
