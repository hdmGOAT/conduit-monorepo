# Subscription Model: API & Enforcement Notes

## Goal

Define how tiered subscriptions are enforced in API write paths.

Business constraints:

- Organizations (currently represented by groups) use a tiered subscription model.
- Higher tiers can process more transactions per billing period.
- Free tier has a limited member count.
- Free tier applies a small transaction fee.

## Enforcement Points

Subscription checks must run before data writes in these flows:

1. Add member to group.
2. Create payment for a collection.

## Policy Outcomes

Use policy-specific, machine-readable responses for limit failures.

### Member Limit Reached

Recommended response:

- Status: `409 Conflict`
- Body:

```json
{
  "error": "subscription limit reached",
  "code": "member_limit_reached",
  "tier": "free",
  "limit": 25,
  "current": 25
}
```

### Transaction Capacity Reached

Recommended response:

- Status: `409 Conflict`
- Body:

```json
{
  "error": "subscription limit reached",
  "code": "transaction_capacity_reached",
  "tier": "free",
  "limit": 250,
  "current": 250,
  "period_start": "2026-04-01T00:00:00Z",
  "period_end": "2026-04-30T23:59:59Z"
}
```

## Fee Calculation Rules (Free Tier)

Use basis points (bps) for deterministic fee calculation.

- `fee_bps`: per-organization fee setting for current tier.
- `fee_amount_cents = ceil(base_amount_cents * fee_bps / 10000)`
- `charged_amount_cents = base_amount_cents + fee_amount_cents`

Recommended payment response fields (for transparency):

```json
{
  "id": 123,
  "base_amount": 10000,
  "fee_amount": 50,
  "total_amount": 10050,
  "currency": "usd",
  "status": "pending",
  "method": "stripe"
}
```

## Suggested Endpoints (Planned)

These endpoints are optional for first rollout but useful for frontend visibility.

### Get Organization Subscription Snapshot

- Method: `GET`
- Path: `/api/subscriptions/groups/:groupID`
- Auth: group admin/member
- Response:

```json
{
  "group_id": 1,
  "tier": "free",
  "member_limit": 25,
  "current_member_count": 17,
  "transaction_capacity_per_period": 250,
  "transaction_count_current_period": 42,
  "transaction_fee_bps": 50,
  "period_start": "2026-04-01T00:00:00Z",
  "period_end": "2026-04-30T23:59:59Z",
  "can_add_member": true,
  "can_create_payment": true
}
```

### Change Organization Tier (Manual/Admin)

- Method: `PATCH`
- Path: `/api/subscriptions/groups/:groupID`
- Auth: group owner/admin (or platform admin)
- Request:

```json
{
  "tier": "starter"
}
```

- Response: updated subscription snapshot (same shape as GET).

## Integration with Existing Handler Conventions

Current API handlers use:

- Validation errors: `{"error":"invalid request","details":[...]}`
- Domain/business errors: simple `{"error":"..."}` payloads

For consistency, policy limit responses should keep the existing `error` string and add `code` plus limit metadata.

## Transactional Enforcement Sequence

For payment creation:

1. Load organization subscription + current usage period.
2. Verify `transaction_count_current_period < transaction_capacity_per_period`.
3. Calculate fee from `fee_bps` if tier is free.
4. Create payment with computed total amount.
5. Increment usage counters in the same DB transaction.

For member invite/add:

1. Load current member count.
2. Verify count `< member_limit`.
3. Insert membership.

## Open Product Inputs

The following values should be confirmed by product/business before hardcoding defaults:

- Free tier member limit.
- Per-tier transaction capacities.
- Free-tier transaction fee (bps).
- Billing period definition (calendar month vs rolling window).
