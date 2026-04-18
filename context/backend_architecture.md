# System Architecture Specification (Refined Design)

## Product

Organization-Based Collections & Payments Platform

Related implementation notes:

* API/enforcement: `context/subscription_api_notes.md`
* Database/migrations: `context/subscription_db_notes.md`

---

# 1. Architectural Overview

The system is a **modular monolith backend with a database-driven event system**, supporting both synchronous core operations and asynchronous side effects.

It integrates with external payment providers and optional third-party tools for data synchronization.

### Core Principle

> **Core business logic is synchronous and strongly consistent.
> Everything external or slow is handled asynchronously.**

---

# 2. High-Level Architecture

```
[ Next.js PWA Client ]
          |
          v
[ Go (Gin) Backend - Modular Monolith ]
          |
   +------+-------------------+
   |                          |
PostgreSQL              Stripe API
   |
   v
Outbox Events Table
   |
   v
Worker Process (Go)
   |
   +------------------------+
   |                        |
Google Sheets         Notion (optional)
Notifications (future)
```

---

# 3. Core Design Principles

## 3.1 Modular Monolith First

* Single backend deployment
* Internal modules separated by domain
* No microservices

---

## 3.2 Database-Centric Consistency

* PostgreSQL is the source of truth
* All state changes are transactional

---

## 3.3 Event-Driven Side Effects

* External integrations are async
* No external calls inside API request cycle

---

## 3.4 Stripe-First Payments

* Stripe handles all payment logic
* Backend only manages state transitions

---

## 3.5 Worker-Based Side Effects

* Background workers handle integrations and notifications

---

## 3.6 Subscription-Aware Capacity Control

* Organizations operate on tiered subscriptions
* Tier defines transaction capacity per billing period
* Free tier has a lower member cap and a small transaction fee
* Limits are enforced synchronously in API write paths

---

# 4. System Components

---

## 4.1 Frontend (Next.js PWA)

### Responsibilities

* Authentication UI
* Group & collection dashboards
* Payment initiation (Stripe redirect)
* Cash payment QR display + scanning
* Status visualization

### Characteristics

* Mobile-first
* Stateless
* No business logic

---

## 4.2 Backend API (Gin)

### Responsibilities

* Authentication (JWT cookies)
* Group & membership management
* Collection management
* Payment lifecycle management
* Cash payment verification
* Subscription tier enforcement (member and transaction limits)
* Stripe webhook handling
* Event creation (outbox)

### Structure (logical modules)

```
/auth
/groups
/collections
/payments
/cash
/webhooks
/subscriptions
/events
```

---

## 4.3 PostgreSQL (System of Record)

### Responsibilities

* Store all application state
* Guarantee transactional integrity
* Store event outbox

### Core Tables

#### Domain Tables

* users
* groups
* memberships
* organization_subscriptions
* subscription_usage
* collections
* payments
* cash_payments

#### Event Table

```
outbox_events
-------------
id
event_type
aggregate_id
payload (jsonb)
status (pending | processed)
created_at
processed_at
retry_count
```

---

## 4.4 Stripe (Payment Processor)

### Responsibilities

* Payment processing UI
* Card handling and compliance (PCI)
* Payment confirmation webhooks

### Flow

1. Backend creates PaymentIntent
2. User pays via Stripe UI
3. Stripe sends webhook
4. Backend verifies and updates payment state

---

## 4.5 Worker System (Go)

### Responsibilities

* Process outbox events
* Sync external systems
* Handle retries
* Execute side effects

---

### Worker Types

#### 1. Integration Worker

* Google Sheets sync
* Notion sync (optional)

#### 2. Notification Worker (future)

* Email receipts
* Payment reminders

---

### Execution Model

```
DB Outbox → Worker Polling → Process Event → External API → Mark Done
```

---

# 5. Core Domain Model

---

## User

* id
* email

---

## Group

* id
* owner_id
* name

---

## Organization Subscription (Organization/Group Level)

* group_id
* tier (free | paid)
* transaction_capacity_per_period
* transaction_count_current_period
* member_limit
* transaction_fee_bps

---

## Membership

* user_id
* group_id
* role (admin | member | collector)

---

## Collection

* id
* group_id
* amount
* deadline
* status (active | closed)

---

## Payment

* id
* user_id
* collection_id
* amount
* status (pending | paid | failed)
* method (stripe | cash)
* stripe_payment_intent_id (nullable)

---

## Cash Payment

* id
* payment_id
* status (pending | confirmed)
* confirmed_by
* created_at

---

# 6. Key System Flows

---

## 6.1 Group Creation

1. User creates group
2. Backend stores group
3. Creator becomes admin

---

## 6.2 Collection Creation

1. Admin creates collection
2. Backend stores collection
3. Collection becomes active

---

## 6.3 Stripe Payment Flow

1. User selects payment
2. Backend creates Payment (pending)
3. Backend creates Stripe PaymentIntent
4. User completes payment on Stripe
5. Stripe sends webhook
6. Backend verifies webhook
7. Payment marked PAID
8. Event emitted → outbox

---

## 6.4 Cash Payment Flow

### Step 1: Initiation

1. User selects cash payment
2. Backend creates Payment (pending, cash)
3. Backend generates QR for payment

---

### Step 2: Confirmation

1. Collector scans QR
2. Backend validates collector role
3. Backend marks Payment as PAID
4. CashPayment marked CONFIRMED
5. Event emitted → outbox

---

## 6.5 Event Processing Flow

### Transaction

```
Update domain state
Insert outbox event
COMMIT
```

---

### Worker

```
Poll outbox_events
Process event
Call external API
Mark processed
```

---

## 6.6 Subscription Policy Enforcement Flow

1. Request arrives (member invite or payment creation)
2. Backend loads organization subscription
3. Backend validates member limit and transaction capacity
4. For free-tier payments, backend applies small transaction fee
5. Request succeeds or returns a policy limit error
6. Usage counters update transactionally on successful writes

---

# 7. State Management

---

## Collection State

```
Active → Closed
```

---

## Payment State

```
Pending → Paid → Failed
```

---

## Cash Payment State

```
Pending → Confirmed
```

---

## Subscription Usage State

```
WithinLimit → ExhaustedForPeriod
ExhaustedForPeriod → WithinLimit (period reset)
```

---

# 8. Security Architecture

## Authentication

* JWT stored in HTTP-only cookies

---

## Authorization

* Role-based access control (RBAC)
* Collector role required for cash confirmation

---

## Payment Security

* Stripe webhook signature verification
* No sensitive payment data stored
* Idempotent webhook processing

---

## Cash Security

* QR tied to payment ID
* Collector-only confirmation
* Replay protection via single-use payment state

---

# 9. Reliability Design

## Idempotency

* Stripe webhooks safe to retry
* Cash confirmation safe against duplicate scans

---

## Retry Strategy

* Worker retries failed integrations
* Exponential backoff (simple)

---

## Failure Isolation

* API never depends on external systems
* Workers handle all external risk

---

# 10. Scalability Model

## API

* Stateless → horizontally scalable

---

## Workers

* Can scale independently if needed

---

## Database

* Primary scaling constraint
* Indexed on:

  * user_id
  * group_id
  * collection_id

---

## Commercial Scaling

* Tier upgrades increase allowed transaction volume per organization
* Free-tier transaction fees offset low-volume processing costs

---

# 11. Non-Functional Requirements

## Reliability

* Strong consistency for payments
* eventual consistency for integrations

---

## Performance

* Fast API responses (<200ms target)
* Async heavy operations

---

## Maintainability

* Clear domain modules
* Simple monolith structure
* Minimal infrastructure dependencies

---

# 12. Constraints

* No microservices
* No distributed system complexity
* Stripe is the only payment processor
* PostgreSQL is the only source of truth
* Workers are optional scaling layer, not core dependency
* Subscription limits must be enforced before member/payment writes
* Free tier has limited members and applies a small transaction fee

---

# 13. Architecture Summary

> The system is a modular monolith built with Go (Gin) and PostgreSQL as its source of truth. Stripe handles all online payments, while cash payments are confirmed through a secure QR-based collector workflow. An outbox-based worker system processes all external side effects such as Google Sheets synchronization. The architecture enforces tiered organization subscriptions with transaction-capacity limits, plus free-tier member caps and a small transaction fee, while prioritizing correctness and simplicity.