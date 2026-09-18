# TrustForce OSS/BSS — working demo

A browser-based demo of an ISP OSS/BSS control centre for **TrustForce Myanmar**, built from the three
requirement documents supplied (NationNet BSS workflow analysis, the TrustForce OSS/BSS deck, and the
ODN Smart Network requirement). It follows the operational shape of Splynx / Radiuz, and adds the
ODN fibre-plant module that those platforms do not cover in the way the ODN deck asks for.

Everything runs in the browser. No build step, no server required, no backend. All data is generated
in-memory by a deterministic seeded generator, so the network looks identical on every reload.

---

## Opening it in Antigravity IDE

1. Open Antigravity IDE → **Open Folder** → select this `trustforce-oss-bss` folder.
2. Open `index.html`.
3. Either:
   - right-click `index.html` → **Open with Live Server / Open in Browser**, or
   - run `npm start` in the integrated terminal (`npx serve .`) and open the printed URL, or
   - just double-click `index.html` in a file manager — it works from `file://` too, because the
     scripts are plain `<script>` tags rather than ES modules.

No `npm install` is needed. `package.json` exists only to give the IDE a start script.

---

## What is in it

Thirteen modules, grouped in the left rail:

**Business**
- **Dashboard** — KPIs, 12-cycle collections chart, session split, fibre-plant capacity, renewals due,
  live alarms, weak points.
- **Subscribers** — filterable list (550 seeded accounts) with a 360° drawer: overview, billing,
  network & optical, support. Recharge, wallet top-up, plan change with proration, grace extension,
  new-subscriber onboarding that books a free 1:16 splitter port.
- **Billing & finance** — invoices (settling one fires a CoA reconnect), payments with method mix
  (KBZPay / WavePay / cash / bank / wallet), vouchers (generate, print, redeem), gateway config,
  proration calculator.
- **Tariffs** — plan catalogue and editor with the pre-publish dependency check (bandwidth profile +
  IP pool + NAS + validity + expiry behaviour) recommended in the NationNet review.

**Fibre network**
- **ODN plant** — the centrepiece. OLT → PON port → feeder fibre → DN (1:4) → SN (1:16) → ONU →
  customer, each one a manageable object with inventory, chassis/slot/port drill-down, optical RX/TX at
  both ends with 7/30/90-day trend, alarms, capacity (used / free / reserved), control actions and a
  history timeline. Fibre records export as KML.
- **Topology & trace** — resolve any identifier (customer ID, ONU serial, MAC, phone, OLT port, DN/SN/
  fibre ID) to the full physical path, run trace up/down, view the plant map, export plant KML, and run
  fault-impact analysis ("DN-005 fails → 3 SNs → 30 customers → MMK 3.09M exposed").
- **Live network** — PPPoE/IPoE sessions updating live, per-session CoA disconnect/reconnect, BNG/NAS
  inventory, IP pool utilisation, bandwidth/FUP profiles, RADIUS log.
- **Alarms** — LOS, dying gasp, optical low/high, temperature, reboot, link down; severity and state
  filters, affected path and customer impact per row, acknowledge / clear / raise ticket.

**Operations**
- **Helpdesk** — Open → Assigned → In-progress → Resolved kanban, mobile field dispatch with GPS
  payload, 360° diagnostics on the ticket (line status, optical, billing health, fibre position).
- **Inventory** — warehouse stock with reorder alerts, issue/receive, assets bound to customers by
  serial and MAC.
- **Messaging** — audience builder (expiring / expired / offline / business / all), SMS & Viber
  templates with placeholder rendering, mandatory test pass before a live send, automation rules,
  campaign history.
- **Reports** — revenue, activations (free date range — deliberately no 30-day cap), churn & retention
  with an at-risk list, field MTTR by technician. Every table exports CSV.
- **Settings** — least-privilege permission matrix, staff accounts, integrations, searchable audit
  trail, theme toggle.

Global omni-search sits in the top bar (**Ctrl + K**) and resolves any identifier to its object.

---

## How the documents map to the modules

| Requirement | Where it lives |
|---|---|
| NationNet: Dashboard, Clients, Billing, Vouchers, PPPoE monitor, profiles, SMS, reports, logs | Dashboard, Subscribers, Billing, Live network, Messaging, Reports, Settings |
| NationNet risk findings: secrets, least privilege, destructive log cleanup, CSV control | Settings → permission matrix (secrets write-only/vault, two-person log clearing, export permissions) |
| NationNet: plan dependency checklist, 4-point pre-action checks | Tariffs → pre-publish check; confirm dialogs on recharge, sync, bulk send |
| NationNet: 30-day report cap flagged as a limitation | Reports → free date range |
| TrustForce deck: FreeRADIUS AAA, NAS multi-vendor, CoA, live bandwidth, FUP, hardware mapping | Live network |
| TrustForce deck: anniversary billing, proration, grace 1–5 days, QR auto-matching, instant CoA re-activation | Billing, Subscribers |
| TrustForce deck: ticket lifecycle, mobile dispatch, 360° diagnostics | Helpdesk |
| TrustForce deck: warehouse, asset binding, technician auto-deduction | Inventory |
| TrustForce deck: collection / recovery / retention / MTTR analytics | Dashboard, Reports |
| ODN deck: OLT/DN/SN/ONU as managed objects, optical both ends + trend, alarms, KMZ route, trace, weak points, fault impact, capacity, audited control actions, global search | ODN plant, Topology & trace, Alarms |

---

## Suggested 5-minute walkthrough

1. **Dashboard** — read the KPI row, then the weak-point table at the bottom.
2. Press **Ctrl + K**, paste an ONU MAC or type `CUS-0012`. Land on the subscriber.
3. In the drawer open **Network & optical** → click the trace strip → you are in the ODN module at that
   customer's SN.
4. **ODN plant → SN tab** — open any SN, look at the 16-port grid, export the port list.
5. **Topology & trace** — pick `DN-005`, run **Fault impact**: affected SNs, customers, revenue exposed,
   then "Notify affected".
6. **Alarms** — filter Critical, raise a ticket from one, then find it in **Helpdesk** and dispatch it.
7. **Billing** — settle an overdue invoice and watch the CoA reconnect toast; check **Settings → audit
   trail** for the two entries it wrote.

---

## Notes and caveats

- This is a **front-end demo**. There is no database, no RADIUS, no OLT, no payment gateway. Actions
  mutate in-memory state and write audit entries; they do not touch any real system.
- All subscribers, phone numbers, MACs, serials, coordinates and money figures are generated. Nothing
  here comes from a production system.
- State is not persisted. Reloading the page resets the demo.
- Figures in the demo are tuned to be plausible for a Yangon FTTH operator of ~550 subscribers, not to
  reconcile against any real ledger.

See `docs/DATA-MODEL.md` for the object model and the list of auditable actions.
