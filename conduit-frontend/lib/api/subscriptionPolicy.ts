type PolicyCode = 'member_limit_reached' | 'transaction_capacity_reached'

type PolicyPayload = {
  code?: string
  tier?: string
  limit?: number
  current?: number
  period_end?: string
  error?: string
}

export type PolicyGuidance = {
  code: PolicyCode
  title: string
  message: string
  detail: string
  ctaLabel: string
}

function formatTierLabel(tier: string | undefined) {
  if (!tier) return 'current'
  return `${tier.slice(0, 1).toUpperCase()}${tier.slice(1)}`
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function buildMemberLimitGuidance(payload: PolicyPayload): PolicyGuidance {
  const limit = asNumber(payload.limit)
  const current = asNumber(payload.current)
  const tierLabel = formatTierLabel(payload.tier)

  const detail = limit !== null && current !== null
    ? `${current} of ${limit} members are already in this group for the ${tierLabel} tier.`
    : `This group has reached the member cap for the ${tierLabel} tier.`

  return {
    code: 'member_limit_reached',
    title: 'Member limit reached',
    message: 'This action would exceed your member capacity. Upgrade the group to add more people.',
    detail,
    ctaLabel: 'Upgrade group',
  }
}

function buildTransactionLimitGuidance(payload: PolicyPayload): PolicyGuidance {
  const limit = asNumber(payload.limit)
  const current = asNumber(payload.current)
  const tierLabel = formatTierLabel(payload.tier)

  const detail = limit !== null && current !== null
    ? `${current} of ${limit} transactions have been used in this billing period for the ${tierLabel} tier.`
    : `This group has reached transaction capacity for the ${tierLabel} tier this period.`

  return {
    code: 'transaction_capacity_reached',
    title: 'Transaction capacity reached',
    message: 'Payments are paused because this group is at its transaction capacity. Upgrade to keep collecting.',
    detail,
    ctaLabel: 'Upgrade group',
  }
}

export function getPolicyGuidanceFromError(error: unknown): PolicyGuidance | null {
  const payload = (error as { response?: { data?: PolicyPayload } })?.response?.data
  const code = payload?.code

  if (code === 'member_limit_reached') {
    return buildMemberLimitGuidance(payload ?? {})
  }
  if (code === 'transaction_capacity_reached') {
    return buildTransactionLimitGuidance(payload ?? {})
  }

  return null
}
