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
- Staff accounts, the audit trail, messaging campaign records

**Simulated — deterministic, generated from the object's ID and a slow time bucket (see `lib/sim.ts`), not
persisted as if it were a real device reading:**
- RADIUS/CoA, MikroTik/NAS live sessions and PPPoE throughput
- ONU optical RX/TX jitter and the day-by-day optical trend
- TR-069/GenieACS device management (not implemented — see the ACS guide's own 12–17 week estimate for what
  a real integration takes)
- SMS/WhatsApp/payment-gateway delivery — a "send" or "settle" here writes a real campaign/payment row, but
  nothing is actually dispatched to a carrier or bank

There is no real authentication; actions are attributed to a fixed demo actor (see `lib/audit.ts`).

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

**Business** — Dashboard (live KPIs, collections chart, weak-point table) · Subscribers (360° view: overview,
billing, network & optical, support; recharge, wallet top-up, proration'd plan change, grace extension,
onboarding that books a free splitter port) · Billing & finance (invoices, payments, vouchers) · Tariffs
(plan editor with the pre-publish dependency check: bandwidth profile + IP pool + NAS + validity + expiry
behaviour).

**Fibre network** — ODN plant (OLT → PON port → feeder fibre → DN 1:4 → distribution fibre → SN 1:16 → ONU →
customer, each a real record with an interactive Leaflet map) · Topology & trace (resolve any identifier to
its physical path, fault-impact analysis, KML export) · Live network (simulated PPPoE sessions, NAS/IP
pool/bandwidth-profile inventory) · Alarms (current/acknowledged/cleared, escalate to ticket).

**Operations** — Helpdesk (Open → Assigned → In-progress → Resolved kanban) · Inventory (stock issue/receive,
asset-to-customer binding) · Messaging (audience builder, mandatory test pass before live send) · Reports
(revenue, activations with a free date range, churn/at-risk, field MTTR — all CSV-exportable) · Settings
(permission matrix, staff accounts, integration status, searchable audit trail).

Global omni-search (**Ctrl + K**) resolves any identifier — subscriber, ONU serial/MAC, SN/DN/OLT/fibre ID,
invoice, ticket, voucher — to its record.

See [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) for the object model this was built from, and
[`lib/schema.ts`](lib/schema.ts) for the actual Drizzle schema.
