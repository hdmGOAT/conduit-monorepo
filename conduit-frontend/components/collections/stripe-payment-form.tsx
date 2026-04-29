"use client"

import { FormEvent, useMemo, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import type { StripeElementsOptions } from '@stripe/stripe-js'
import { loadStripe } from '@stripe/stripe-js'

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? ''
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null

type StripePaymentFormProps = {
  clientSecret: string
  onCompleted: (message: string) => void | Promise<void>
  onCancel: () => void
}

type StripePaymentFormInnerProps = StripePaymentFormProps

function StripePaymentFormInner({ onCompleted, onCancel }: StripePaymentFormInnerProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!stripe || !elements) return

    setSubmitting(true)
    setError(null)

    try {
      const submitResult = await elements.submit()
      if (submitResult.error) {
        setError(submitResult.error.message || 'Check the payment details and try again.')
        return
      }

      const returnUrl = new URL(window.location.href)
      returnUrl.searchParams.set('stripe', 'success')

      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl.toString(),
        },
        redirect: 'if_required',
      })

      if (result.error) {
        setError(result.error.message || 'Stripe could not confirm this payment.')
        return
      }

      const status = result.paymentIntent?.status
      const message = status === 'succeeded'
        ? 'Payment submitted to Stripe. It will remain pending until the webhook confirms it.'
        : status === 'processing'
          ? 'Payment submitted and is processing.'
          : 'Payment submitted to Stripe.'

      await onCompleted(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={!stripe || !elements || submitting}
          className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-cloud transition hover:bg-[#0d1f3f] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Confirming payment…' : 'Confirm payment'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-ink/15 bg-cloud px-4 py-2 text-sm font-medium text-ink transition hover:bg-[#f3efe7]"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

export function StripePaymentForm({ clientSecret, onCompleted, onCancel }: StripePaymentFormProps) {
  const options = useMemo<StripeElementsOptions>(() => ({
    clientSecret,
    appearance: {
      theme: 'stripe',
    },
  }), [clientSecret])

  if (!stripePromise) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Stripe is not configured. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to enable card payments.
      </div>
    )
  }

  return (
    <Elements stripe={stripePromise} options={options}>
      <StripePaymentFormInner clientSecret={clientSecret} onCompleted={onCompleted} onCancel={onCancel} />
    </Elements>
  )
}
