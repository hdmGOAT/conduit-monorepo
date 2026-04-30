"use client"

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import appAPIClient from '@/lib/api/httpClient'
import { Button } from '@/components/button'
import Html5QrcodePlugin from '@/components/QRScanner'

interface ScanStatus {
  state: 'idle' | 'scanning' | 'success' | 'error' | 'duplicate' | 'unauthorized'
  message: string
  paymentId?: string
  payerName?: string
  amount?: number
}

interface Membership {
  user_id: string
  group_id: string
  role: string
}

interface PaymentConfirmResponse {
  payment: {
    id: string
    status: string
    total_amount: number
    user_id: string
  }
  cash_payment: {
    id: string
    status: string
    confirmed_at: string
  }
}

export default function QRScannerPage() {
  const params = useParams()
  const router = useRouter()
  const groupId = params?.id as string

  const [membership, setMembership] = useState<Membership | null>(null)
  const [status, setStatus] = useState<ScanStatus>({
    state: 'idle',
    message: 'Initializing scanner...',
  })
  const [confirmedPayments, setConfirmedPayments] = useState<Set<string>>(
    new Set()
  )
  const [loading, setLoading] = useState(true)

  // Check authentication and membership
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Get current user
        const meRes = await appAPIClient.get('/auth/me')

        // Check if user is a collector in this group
        const membershipRes = await appAPIClient.get(
          `/groups/${groupId}/memberships`
        )
        const memberships = membershipRes.data as Membership[]
        const userMembership = memberships.find(
          (m) => m.user_id === meRes.data.id
        )

        if (!userMembership) {
          setStatus({
            state: 'unauthorized',
            message: 'You are not a member of this group.',
          })
          setLoading(false)
          return
        }

        if (userMembership.role !== 'collector' && userMembership.role !== 'admin' && userMembership.role !== 'moderator') {
          setStatus({
            state: 'unauthorized',
            message:
              'You must have collector role to access this page. Contact your group administrator.',
          })
          setLoading(false)
          return
        }

        setMembership(userMembership)
        setStatus({
          state: 'idle',
          message: 'Ready to scan. Point your camera at a payment QR code.',
        })
        setLoading(false)
      } catch (error) {
        console.error('Auth check failed:', error)
        setStatus({
          state: 'error',
          message: 'Failed to verify authentication. Please log in again.',
        })
        setLoading(false)
      }
    }

    checkAuth()
  }, [groupId])

  const handleScanSuccess = async (decodedText: string) => {
    // Parse the QR code data (should be "payment:{id}")
    const match = decodedText.match(/^payment:(\d+)$/)
    if (!match) {
      setStatus({
        state: 'error',
        message: `Invalid QR code format. Expected "payment:{id}", got: ${decodedText}`,
      })
      return
    }

    const paymentId = match[1]

    // Check if already confirmed in this session
    if (confirmedPayments.has(paymentId)) {
      setStatus({
        state: 'duplicate',
        message: `Payment ${paymentId} has already been confirmed in this session.`,
        paymentId,
      })
      return
    }

    setStatus({
      state: 'scanning',
      message: 'Processing payment confirmation...',
      paymentId,
    })

    try {
      // Call the confirmation endpoint
      const response = await appAPIClient.post(
        `/payments/${paymentId}/cash/confirm`
      )

      const data = response.data as PaymentConfirmResponse

      // Add to confirmed payments
      setConfirmedPayments((prev) => new Set([...prev, paymentId]))

      setStatus({
        state: 'success',
        message: `✓ Payment confirmed! Amount: $${(data.payment.total_amount / 100).toFixed(2)}`,
        paymentId,
        amount: data.payment.total_amount,
      })

      // Auto-reset after 3 seconds
      setTimeout(() => {
        setStatus({
          state: 'idle',
          message: 'Ready to scan. Point your camera at another payment QR code.',
        })
      }, 3000)
    } catch (error: unknown) {
      let errorMessage = 'Failed to confirm payment'
      if (error instanceof Error && 'response' in error) {
        const errorWithResponse = error as Error & {
          response?: { data?: { error?: string } }
        }
        errorMessage = errorWithResponse.response?.data?.error || error.message
      } else if (error instanceof Error) {
        errorMessage = error.message
      }

      if (errorMessage.includes('already confirmed')) {
        setStatus({
          state: 'duplicate',
          message: `This payment was already confirmed. ${errorMessage}`,
          paymentId,
        })
        setConfirmedPayments((prev) => new Set([...prev, paymentId]))
      } else if (errorMessage.includes('collector role')) {
        setStatus({
          state: 'unauthorized',
          message:
            'You do not have collector permissions. Contact your administrator.',
          paymentId,
        })
      } else if (errorMessage.includes('not found')) {
        setStatus({
          state: 'error',
          message: `Payment not found. Check the QR code and try again.`,
          paymentId,
        })
      } else {
        setStatus({
          state: 'error',
          message: `Error: ${errorMessage}`,
          paymentId,
        })
      }
    }
  }

  const handleScanError = (error: unknown) => {
    // Ignore frequent scanning errors - they're normal
    if (typeof error === 'object' && error !== null && 'message' in error) {
      const err = error as { message?: string }
      if (err.message?.includes('NotFoundException')) {
        return
      }
    }
    console.debug('Scan error (non-critical):', error)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (status.state === 'unauthorized') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4">
        <div className="max-w-md mx-auto mt-8">
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="text-red-600 text-4xl mb-3">🚫</div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              Access Denied
            </h1>
            <p className="text-slate-600 mb-6">{status.message}</p>
            <Button
              onClick={() => router.push(`/groups/${groupId}`)}
              className="w-full"
            >
              Go Back to Group
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4 pb-8">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 pt-4">
          <h1 className="text-2xl font-bold text-slate-900">Cash Payment Verification</h1>
          <button
            onClick={() => router.push(`/groups/${groupId}`)}
            className="text-slate-500 hover:text-slate-700 text-xl"
          >
            ✕
          </button>
        </div>

        {/* Scanner Container */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
          <div className="aspect-square bg-slate-900 relative">
            {membership && (
              <Html5QrcodePlugin
                fps={10}
                qrbox={250}
                disableFlip={false}
                onSuccess={handleScanSuccess}
                onError={handleScanError}
              />
            )}
          </div>
        </div>

        {/* Status Messages */}
        <div className="mb-6">
          {status.state === 'idle' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <p className="text-blue-900 text-sm">{status.message}</p>
            </div>
          )}

          {status.state === 'scanning' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-amber-600 mb-2"></div>
              <p className="text-amber-900 text-sm">{status.message}</p>
            </div>
          )}

          {status.state === 'success' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <p className="text-green-900 font-semibold">{status.message}</p>
              <p className="text-green-800 text-sm mt-1">
                Scanner will reset in a few seconds...
              </p>
            </div>
          )}

          {status.state === 'duplicate' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
              <p className="text-amber-900 text-sm font-semibold">Duplicate Scan</p>
              <p className="text-amber-800 text-xs mt-1">{status.message}</p>
            </div>
          )}

          {status.state === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-red-900 font-semibold">Error</p>
              <p className="text-red-800 text-sm mt-1">{status.message}</p>
            </div>
          )}
        </div>

        {/* Confirmed Payments Counter */}
        {confirmedPayments.size > 0 && (
          <div className="bg-slate-900 text-white rounded-lg p-4 text-center mb-6">
            <p className="text-sm text-slate-300">Payments Confirmed This Session</p>
            <p className="text-3xl font-bold">{confirmedPayments.size}</p>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700">
          <p className="font-semibold mb-2">💡 Tips:</p>
          <ul className="space-y-1 text-xs text-slate-600">
            <li>• Ensure good lighting for optimal scanning</li>
            <li>• Hold device steady and parallel to QR code</li>
            <li>• Duplicate scans will be detected and reported</li>
            <li>
              • Only collectors can confirm payments - admins must have collector
              role
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 space-y-2">
          <Button
            onClick={() => router.push(`/groups/${groupId}`)}
            variant="outline"
            className="w-full"
          >
            Back to Group
          </Button>
        </div>
      </div>
    </div>
  )
}
