# TrustForce OSS/BSS

A working ISP OSS/BSS console for **TrustForce Myanmar**, built from the requirement documents supplied
(NationNet BSS workflow analysis, the TrustForce OSS/BSS deck, the ODN Smart Network requirement, and the
TR-069/ACS development guide). It follows the operational shape of Splynx / Radiuz, plus the ODN fibre-plant
object model (OLT → DN → SN → ONU, with a live map) that those platforms don't cover in the way the ODN deck
asks for.

**Stack:** Next.js 15 (App Router, Server Actions) · Drizzle ORM · Neon Postgres · Leaflet/OpenStreetMap ·
deployed on Vercel.

A previous iteration of this project was a pure front-end demo with an in-memory seeded dataset. That version
is kept at [`legacy-static-demo/`](legacy-static-demo/) for reference. This version persists real data in Neon.

---

## What's real vs. simulated

This matters, so it's stated plainly rather than left to be discovered:

**Real — backed by actual rows in Neon Postgres, with every mutation writing an audit log entry:**
- Subscribers, tariffs, bandwidth profiles, IP pools, NAS registry
- Billing: invoices, payments, vouchers, wallet balances, proration on plan change
- The ODN fibre-plant object model itself: OLTs, PON ports, DNs, SNs, ONUs, fibre routes (used for the map
  and for topology trace/fault-impact — this needs to be real for those features to mean anything)
- Helpdesk tickets (kanban), inventory stock and asset-to-customer binding
- Leads (CRM pipeline) and their conversion into a real subscriber + ONU + splitter-port booking
- Scheduled field appointments (installs/repairs/maintenance/surveys)
- Staff accounts, the audit trail, messaging campaign records
- Locations and system settings (subscriber ID format, VLAN inheritance, billing calculation mode)
- The payment webhook endpoint itself (`/api/webhooks/payment`) — real code, real effect on real rows

**Simulated — deterministic, generated from the object's ID and a slow time bucket (see `lib/sim.ts`), not
persisted as if it were a real device reading:**
- RADIUS/CoA, MikroTik/NAS live sessions and PPPoE throughput
- ONU optical RX/TX jitter and the day-by-day optical trend
- TR-069/GenieACS device management (not implemented — see the ACS guide's own 12–17 week estimate for what
  a real integration takes)
- SMS/WhatsApp delivery — a "send" here writes a real campaign row, nothing is dispatched to a carrier
- The *other end* of the payment webhook: no real KBZPay/WavePay/AYA Pay merchant account is wired to call it
  — the endpoint is real, but nothing external calls it yet

## Authentication & user management

Real login, backed by the app's own `staff`/`sessions` tables (not a third-party auth provider — the
Neon project here is provisioned through Vercel's marketplace integration, which isn't reachable from a
personal Neon account/CLI, so the declarative Neon Auth path couldn't be wired up; this is a straightforward
self-managed alternative on the same Postgres database):

- Passwords are hashed with Node's `scrypt` (`lib/password.ts`), never stored or logged in plain text.
- A session is an opaque random token stored server-side (`sessions` table) and set as an httpOnly, `SameSite=lax`
  cookie — not a JWT, so a session can be revoked server-side at any time (e.g. on logout).
- `middleware.ts` does a cheap cookie-presence check on every route except `/login`; `app/(app)/layout.tsx` does
  the real DB-backed session lookup and redirects to `/login` if it doesn't resolve. CSV/KML export routes under
  `app/api/**` check the session again themselves, since middleware alone doesn't validate it for them.
- Every audit-log entry (`lib/audit.ts`) now records the real signed-in user instead of a fixed demo actor.
- **User management** lives on the Settings page: only the `sysadmin` role can create accounts, change another
  user's role, deactivate/reactivate, or issue a temporary password; every user can change their own password
  from the same page. A new account is created with `mustChangePassword: true` and is prompted to set its own
  password at first login.

Seeded demo accounts (see `scripts/seed.ts`) all share the password **`trustforce123`**:

| Email | Role |
|---|---|
| hein@trustforcemm.com | System administrator |
| noc1@trustforcemm.com | Network operations |
| cashier@trustforcemm.com | Cashier / billing |
| field1@trustforcemm.com | Network operations |
| finance@trustforcemm.com | Management / finance |
| sales@trustforcemm.com | Sales & CS |

Each role can only open the modules listed for it in the permission matrix on Settings — enforced in
`lib/permissions.ts` and `app/(app)/layout.tsx`, not just hidden in the UI. A role that opens a URL outside
its module list gets an "Access restricted" page instead of the module.

---

## Running it locally

```bash
npm install
npm run db:push    # sync the Drizzle schema to your Neon database
npm run db:seed    # deterministic seed: 3 OLTs, 16 DNs, 47 SNs, ~570 subscribers, invoices, tickets…
npm run dev
```

Requires a `DATABASE_URL` (and `DATABASE_URL_UNPOOLED` for schema push) in `.env.local` — provisioned
automatically if you run `vercel integration add neon` and link the project, or point it at your own Neon
project.

## Deploying

```bash
vercel --prod
```

The Neon integration on Vercel wires `DATABASE_URL` into the deployment's environment automatically.

---

## Modules

Each operational area below has its own dashboard (KPI tiles + charts) at the top of its page, in addition to
the cross-module overview at `/dashboard` — the way Splynx splits a Finance, CRM, Ticket and Network dashboard
out from one combined admin home.

**Business** — Dashboard (live KPIs, collections chart, weak-point table, shortcut widgets into Leads/Schedule/
Tickets/Inventory) · **Leads** (CRM pipeline for new inquiries — source/status funnel, convert a qualified lead
straight into a provisioned subscriber, which books a real splitter port) · Subscribers (360° view: overview,
billing, network & optical, support; recharge, wallet top-up, proration'd plan change, grace extension,
onboarding that books a free splitter port) · Billing & finance dashboard (revenue trend, payment-method mix,
invoices, payments, vouchers) · Tariffs (plan editor with the pre-publish dependency check: bandwidth profile +
IP pool + NAS + validity + expiry behaviour).

**Fibre network** — **Networking map**: OLT → PON port → feeder fibre → DN 1:4 → distribution fibre → SN 1:16 →
ONU → customer, as a Leaflet map paired with a collapsible OLT/DN/SN layer tree and per-layer visibility toggles
— the same sidebar-tree-plus-map convention as the ODN deck's KMZ/Google-Earth reference view and Splynx's own
networking map · Topology & trace (resolve any identifier to its physical path, fault-impact analysis, KML
export) · Live network (simulated PPPoE sessions, NAS/IP pool/bandwidth-profile inventory) · Alarms (current/
acknowledged/cleared, escalate to ticket).

**Operations** — Ticket dashboard (Open → Assigned → In-progress → Resolved kanban, SLA-breach and MTTR tiles) ·
**Schedule** (field-visit calendar for installs/repairs/maintenance/surveys, technician load, link to a
customer or ticket) · Inventory dashboard (stock value, reorder alerts, asset-to-customer binding) · Messaging
(audience builder, mandatory test pass before live send) · Reports (revenue, activations with a free date
range, churn/at-risk, field MTTR — all CSV-exportable) · Settings (permission matrix, staff accounts,
integration status, searchable audit trail).

Global omni-search (**Ctrl + K**) resolves any identifier — subscriber, ONU serial/MAC, SN/DN/OLT/fibre ID,
invoice, ticket, voucher — to its record.

## Subscriber ID format, VLAN, and billing calculation mode

Configured in **Settings → System settings**:

- **Subscriber ID prefix & formatting**: new subscriber IDs are `{serviceCode}{location code}-{sequence}`, e.g.
  `TFYGN-000123` — the service code and digit count are set here, the location segment comes from the
  **Locations** table (add more branches/regions there, e.g. Mandalay/`MDY`, each with its own counter). A
  subscriber's ID is generated once at onboarding and is not editable afterwards. This only applies going
  forward — the ~550 seeded demo subscribers keep their original `CUS-0001`-style IDs, matching how a real
  system would roll the new scheme out without renumbering existing accounts.
- **VLAN**: each plan (Tariffs) can carry a VLAN; a subscriber inherits it from their plan at onboarding, plan
  change, or recharge, shown on their Network & optical tab.
- **Billing calculation mode**: `monthly` (default) always charges a plan's full fee on renewal. `daily`
  excludes days a subscriber had no service — recharging an overdue/expired subscriber only charges for the
  active days in the new cycle, at the plan's daily rate.
- **POE device credentials**: an optional username/password pair per subscriber, for a secondary POE-powered
  device on the same drop (e.g. a CCTV camera) — set at onboarding, shown on Network & optical.

## Payment gateway webhook

`POST /api/webhooks/payment` is what a real KBZPay/WavePay/AYA Pay merchant callback would hit — it isn't
wired to an actual gateway (there's no merchant account here), but the endpoint itself is real and does the
full automated-payment flow described by a live integration: auto-settle the invoice (or process a renewal)
and auto CoA-reconnect a lapsed subscriber. It's excluded from the login-required middleware, since a payment
gateway won't have a staff session — instead it checks an `x-webhook-secret` header against the secret shown
on Settings → System settings.

```
POST /api/webhooks/payment
x-webhook-secret: <paymentWebhookSecret>
Content-Type: application/json

{ "customerId": "CUS-0001", "invoiceId": "INV-26097", "method": "kbzpay", "transactionId": "TXN-123" }
```

`invoiceId` omitted → treated as a plan renewal for `customerId` (same as the Recharge button, respects the
billing calculation mode above) instead of settling a specific invoice.

See [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) for the object model this was built from, and
[`lib/schema.ts`](lib/schema.ts) for the actual Drizzle schema.
