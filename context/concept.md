# System Architecture Specification (MVP)

**Product:** Organization-Based Collections & Payments Platform

---

# 1. Architectural Overview

The system is a **simple client–server web application** that allows organizations to create groups and collect payments from members.

Payments are handled either:

* via **Stripe (online payments)**
* via **cash confirmation (manual but verified via QR scan)**

The backend is the **single source of truth for all state**.

---

# 2. High-Level Components

## 2.1 Client (Next.js PWA)

**Responsibilities**

* User login and session handling
* View groups and collections
* Initiate payments (Stripe or cash)
* Display payment status
* Generate/scan QR codes (cash payments)

**Characteristics**

* Mobile-first (PWA)
* Stateless
* No business logic or payment logic

---

## 2.2 Backend API (Gin)

**Responsibilities**

* Authentication (JWT cookies)
* Group management
* Collection management
* Payment creation and updates
* Cash payment verification
* Stripe webhook handling
* State management

**Key Property**

> Backend is the only source of truth

---

## 2.3 Database (PostgreSQL)

**Responsibilities**

* Store all system data
* Maintain payment and collection state

---

## 2.4 Payment Processor (Stripe)

**Responsibilities**

* Handle online payments
* Provide payment UI
* Send webhook on success/failure

---

## 2.5 Cash Payment Flow (Simple Version)

No event system, no workers.

### Concept:

Cash payments are manually confirmed by a collector via QR scan.

---

# 3. Core Domain Model (Minimal)

```
User
- id
- email

Group
- id
- name
- owner_id

Membership
- user_id
- group_id
- role

Collection
- id
- group_id
- amount
- deadline
- status (active | closed)

Payment
- id
- user_id
- collection_id
- amount
- status (pending | paid | failed)
- payment_method (stripe | cash)
- external_id (stripe payment intent or null)

CashPayment
- id
- payment_id
- status (pending | confirmed)
- created_at
- confirmed_by
```

---

# 4. Key System Flows

---

## 4.1 Group Creation

1. User creates group
2. Backend stores group
3. Creator becomes admin
4. Response returned

---

## 4.2 Collection Creation

1. Admin creates collection
2. Backend stores collection
3. Collection becomes active

---

## 4.3 Stripe Payment Flow

1. User selects “Pay”
2. Backend creates Payment (pending)
3. Backend creates Stripe Payment Intent
4. User pays via Stripe UI
5. Stripe sends webhook
6. Backend verifies webhook
7. Payment marked as PAID

---

## 4.4 Cash Payment Flow

### Step 1: Initiation

1. User selects “Cash Payment”
2. Backend creates Payment (pending, cash)
3. Backend generates QR for payment ID

---

### Step 2: Confirmation

1. Collector scans QR
2. Backend verifies collector role
3. Backend marks payment as PAID
4. CashPayment marked confirmed

---

## 5. State Management

### Collection

```
active → closed
```

### Payment

```
pending → paid
pending → failed
```

---

# 6. Security

## Authentication

* JWT in HTTP-only cookies

## Authorization

* Role-based (admin, member, collector)

## Payments

* Stripe webhook verification required
* Cash confirmation restricted to collectors

---

# 7. Non-Functional Requirements (MVP Level)

### Reliability

* Stripe webhook idempotency
* Safe payment state updates

### Simplicity

* No workers
* No queues
* No integrations

### Scalability (future-ready but not implemented)

* Stateless backend
* Clean DB schema

---

# 8. Constraints

* No internal money handling
* Stripe is sole online payment system
* Cash is manually confirmed (trusted actor system)
* No background processing system in MVP

---

# 9. Architecture Summary

> The system is a minimal client–server application where a Next.js PWA frontend interacts with a Gin backend to manage groups, collections, and payments. Online payments are processed through Stripe with webhook-based confirmation, while cash payments are manually confirmed through QR scanning by authorized collectors. PostgreSQL acts as the single source of truth, and the system avoids asynchronous infrastructure to maintain simplicity for the MVP stage.

---