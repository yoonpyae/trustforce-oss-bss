# Data model & architecture

## Layout

```
index.html                 shell: brand, omni-search, left rail, main region
assets/css/theme.css       design tokens, base type, light/dark
assets/css/app.css         layout, cards, tables, drawers, trace strip, port grid, kanban
assets/js/core/ui.js       TF.ui — DOM builder, formatters, tables, SVG charts, modal/drawer/toast, CSV
assets/js/data/seed.js     deterministic seeded dataset (TF.db)
assets/js/core/store.js    indexes, accessors, trace/impact/search/metrics, actions, live tick
assets/js/views/*.js       one file per module, each registering into TF.views
assets/js/app.js           navigation, hash router, omni-search wiring, boot
```

No bundler, no framework, no network calls. Scripts load in order via plain `<script>` tags so the
app also runs from `file://`. A seeded PRNG makes every reload produce the identical network.

## Object model

```
OLT ─┬─ slot / card
     └─ PON port ── feeder fibre ── DN (1:4 splitter)
                                      └─ distribution fibre ── SN (1:16 splitter)
                                                                 └─ drop fibre ── ONU ── Customer
```

| Object | Key fields |
|---|---|
| **OLT** | id, vendor/model, site, coordinates, uptime, temperature, PSU state, slots, PON ports |
| **PON port** | id (`OLT-01/S1/P1`), admin state, TX power, ONUs attached, capacity |
| **Fibre** | id, from/to endpoints, length, core count, route points (KML export), loss budget |
| **DN** | id (1:4), site, coordinates, 4 output legs, used/free/reserved, feeder fibre |
| **SN** | id (1:16), site, coordinates, 16 ports each `used / free / reserved / faulty`, parent DN |
| **ONU** | id, serial, MAC, model, RX/TX dBm both ends, online state, last reboot, SN port, customer |
| **Customer** | id, name, type (personal/business), zone, phone, address, coordinates, tariff, status (`active / grace / suspended / expired`), installed, expiry, balance, ONU |
| **Tariff** | id, name, price (MMK), validity, bandwidth profile, IP pool, prepaid/postpaid, expiry behaviour |
| **Bandwidth profile** | down/up rate, burst, limit-at, priority, FUP threshold |
| **IP pool** | name, range, router, used/free |
| **NAS / BNG** | id, vendor, IP, shared-secret state, type, linked OLT, CoA support |
| **Session** | customer, NAS, framed IP, uptime, down/up rate, total usage, online flag |
| **Invoice** | id, customer, tariff, amount, 5% tax, issued, due, period, status (`paid / pending / overdue`), method |
| **Payment** | id, invoice, amount, method (KBZPay / WavePay / cash / bank / wallet), timestamp, reconciled |
| **Voucher** | code, tariff, status, generated-by, redeemed-by, redeemed-at |
| **Alarm** | id, code (LOS, DYING-GASP, OPTICAL-LOW, TEMP-HIGH, LINK-DOWN, REBOOT, REG-FAIL), severity, object + objectKind, path, raised, cleared, state |
| **Ticket** | id, customer, category, priority, status (open/assigned/in-progress/resolved), technician, notes, SLA, opened/resolved |
| **Inventory item** | SKU, name, on-hand, reserved, reorder level, unit cost, bin |
| **Asset** | serial, MAC, model, bound customer, issued-by, issued-at |
| **Staff / Role** | id, name, role, permission matrix cell values |
| **Audit entry** | timestamp, actor, action, object, detail |

## Derived functions (`TF.store`)

- `tracePath(id)` — resolves any identifier to `OLT → PON port → fibre → DN → SN → ONU → customer`.
- `impactOf(id)` — everything downstream of an object: SNs, customers, business customers, monthly
  revenue exposed.
- `weakPoints()` — objects ranked by customers-at-risk × optical margin × alarm history.
- `search(q)` — customer ID/name/phone, ONU serial/MAC, OLT/PON/DN/SN/fibre ID, invoice, ticket, voucher.
- `metrics()` — subscribers, active, online/offline, expiring, overdue count & value, MRR,
  collection rate (paid value ÷ issued value over 30 days), alarms, criticals, open tickets, weak
  optics, plant counts, splitter port utilisation.
- `revenueSeries()`, `subscriberGrowth()`, `opticalHistory(onu, days)`.
- `startLive()` — 4-second tick that nudges session throughput and uptime.

## Actions (every one writes an audit entry)

`recharge`, `addBalance`, `grace`, `setStatus`, `coa` (disconnect / reconnect), `changePlan`
(with proration), `syncRadius`, `rebootOnu`, `setPonPort` (enable/disable), `ackAlarm`,
`alarmToTicket`, `moveTicket`, `generateVouchers`, `redeemVoucher`, `issueStock`, `receiveStock`,
`sendCampaign`, `saveTariff`, `addCustomer`.

Actions that would be service-affecting in production (CoA, PON port disable, bulk send, plan change)
go through a confirmation dialog first, matching the 4-point pre-action check from the NationNet
review.

## Seed snapshot

3 OLTs · 16 DNs · 47 SNs · 550 ONUs / subscribers · 8 tariffs · 7 bandwidth profiles · 5 IP pools ·
4 NAS · ~2,800 invoices with matching payments · 60 vouchers · 27 active alarms · 26 tickets ·
10 stock SKUs · 6 message templates · 6 roles · 40 audit rows. Zones: Hlaing, Kamayut, Insein,
Thingangyun, South Okkalapa, Mayangone. Reference time is fixed at 2026-09-18 09:20 +06:30.
