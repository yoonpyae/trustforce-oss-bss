"use client";

import { useState } from "react";
import { recharge, addBalance, grantGrace, setStatus, changePlan } from "@/lib/actions/customers";
import { mmk, dateStr, dateTimeStr } from "@/lib/format";
import { Pill } from "@/components/Pill";
import type { getCustomerDetail } from "@/lib/queries/customers";

type Detail = NonNullable<Awaited<ReturnType<typeof getCustomerDetail>>>;
type Tariff = { id: string; name: string; priceMmk: number; validityDays: number; accountType: string };

const TABS = ["Overview", "Billing", "Network & optical", "Support"] as const;

export function SubscriberDetail({ detail, tariffs }: { detail: Detail; tariffs: Tariff[] }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const c = detail.customer;

  return (
    <>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="split">
          <div className="stack">
            <div className="card">
              <header><h3>Account</h3></header>
              <dl className="defn">
                <dt>Customer ID</dt><dd className="num">{c.id}</dd>
                <dt>Username</dt><dd className="num">{c.username}</dd>
                <dt>Account type</dt><dd>{c.accountType}</dd>
                <dt>Address</dt><dd>{c.address}</dd>
                <dt>Zone</dt><dd>{c.zone}</dd>
                <dt>Installed</dt><dd>{dateStr(c.installedDate)}</dd>
                <dt>Status</dt><dd><Pill status={c.status} /></dd>
                <dt>Expiry</dt><dd>{dateStr(c.expiryDate)}</dd>
                <dt>Wallet balance</dt><dd className="num">{mmk(c.balanceMmk)}</dd>
              </dl>
            </div>
            <div className="card">
              <header><h3>Plan</h3></header>
              {detail.tariff ? (
                <dl className="defn">
                  <dt>Plan</dt><dd>{detail.tariff.name}</dd>
                  <dt>Price</dt><dd className="num">{mmk(detail.tariff.priceMmk)}</dd>
                  <dt>Billing</dt><dd>{detail.tariff.billingType}</dd>
                  <dt>Validity</dt><dd>{detail.tariff.validityDays} days</dd>
                  {detail.bandwidth && (
                    <>
                      <dt>Bandwidth</dt><dd className="num">{detail.bandwidth.downKbps / 1000}M / {detail.bandwidth.upKbps / 1000}M</dd>
                    </>
                  )}
                </dl>
              ) : (
                <p className="hint">No plan assigned.</p>
              )}
            </div>
          </div>

          <div className="stack">
            <div className="card">
              <header><h3>Actions</h3></header>
              <div className="stack">
                <form action={recharge} className="row">
                  <input type="hidden" name="customerId" value={c.id} />
                  <select name="method" className="plain" defaultValue="kbzpay" style={{ flex: 1 }}>
                    <option value="kbzpay">KBZPay</option>
                    <option value="wavepay">WavePay</option>
                    <option value="cash">Cash</option>
                    <option value="bank">Bank transfer</option>
                    <option value="wallet">Wallet balance</option>
                  </select>
                  <button className="btn primary sm" type="submit" disabled={!detail.tariff}>Recharge</button>
                </form>

                <form action={addBalance} className="row">
                  <input type="hidden" name="customerId" value={c.id} />
                  <input className="plain" name="amount" type="number" min={0} step={1000} placeholder="Amount MMK" style={{ flex: 1 }} />
                  <button className="btn sm" type="submit">Add balance</button>
                </form>

                <form action={grantGrace} className="row">
                  <input type="hidden" name="customerId" value={c.id} />
                  <select name="days" className="plain" defaultValue="2" style={{ flex: 1 }}>
                    {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{d} day grace</option>)}
                  </select>
                  <button className="btn sm" type="submit">Extend</button>
                </form>

                <form action={changePlan} className="row">
                  <input type="hidden" name="customerId" value={c.id} />
                  <select name="tariffId" className="plain" defaultValue="" style={{ flex: 1 }}>
                    <option value="" disabled>Change plan to…</option>
                    {tariffs.filter((t) => t.accountType === c.accountType).map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <button className="btn sm" type="submit">Change plan</button>
                </form>

                <div className="row">
                  {c.status !== "active" && (
                    <form action={setStatus} className="inline"><input type="hidden" name="customerId" value={c.id} /><input type="hidden" name="status" value="active" />
                      <button className="btn sm primary" type="submit">CoA reconnect</button>
                    </form>
                  )}
                  {c.status === "active" && (
                    <form action={setStatus} className="inline"><input type="hidden" name="customerId" value={c.id} /><input type="hidden" name="status" value="suspended" />
                      <button className="btn sm danger" type="submit">CoA disconnect</button>
                    </form>
                  )}
                  <form action={setStatus} className="inline"><input type="hidden" name="customerId" value={c.id} /><input type="hidden" name="status" value="banned" />
                    <button className="btn sm ghost" type="submit">Ban</button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "Billing" && (
        <div className="split">
          <div className="card">
            <header><h3>Invoices</h3></header>
            <div className="table-wrap">
              <table>
                <thead><tr><th>ID</th><th>Period</th><th className="t-right">Amount</th><th>Status</th></tr></thead>
                <tbody>
                  {detail.invoices.map((i) => (
                    <tr key={i.id}>
                      <td className="num">{i.id}</td>
                      <td>{dateStr(i.periodStart)} → {dateStr(i.periodEnd)}</td>
                      <td className="t-right num">{mmk(i.amountMmk + i.taxMmk)}</td>
                      <td><Pill status={i.status} /></td>
                    </tr>
                  ))}
                  {detail.invoices.length === 0 && <tr><td colSpan={4} className="empty">No invoices yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <header><h3>Payments</h3></header>
            <div className="table-wrap">
              <table>
                <thead><tr><th>ID</th><th>Method</th><th className="t-right">Amount</th><th>When</th></tr></thead>
                <tbody>
                  {detail.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="num">{p.id}</td>
                      <td>{p.method}</td>
                      <td className="t-right num">{mmk(p.amountMmk)}</td>
                      <td>{dateTimeStr(p.timestamp)}</td>
                    </tr>
                  ))}
                  {detail.payments.length === 0 && <tr><td colSpan={4} className="empty">No payments yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "Network & optical" && (
        <div className="split">
          <div className="card">
            <header><h3>Trace</h3></header>
            {detail.onu ? (
              <div className="trace">
                {[
                  { small: "OLT", big: detail.olt?.id, em: detail.olt?.name, href: `/odn?focus=${detail.olt?.id}` },
                  { small: "DN", big: detail.dn?.id, em: detail.dn?.zone, href: `/topology?focus=${detail.dn?.id}` },
                  { small: "SN", big: detail.sn?.id, em: `port ${c.snPort}`, href: `/topology?focus=${detail.sn?.id}` },
                  { small: "ONU", big: detail.onu.id, em: detail.onu.status, href: `/odn?focus=${detail.sn?.id}` },
                ].map((n, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "stretch" }}>
                    {i > 0 && <div className="trace-link" />}
                    <a href={n.href} className="trace-node">
                      <small>{n.small}</small>
                      <b>{n.big ?? "—"}</b>
                      <em>{n.em}</em>
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="hint">No ONU bound to this customer.</p>
            )}
          </div>
          {detail.onu && (
            <div className="card">
              <header><h3>ONU</h3></header>
              <dl className="defn">
                <dt>Serial</dt><dd className="num">{detail.onu.serial}</dd>
                <dt>MAC</dt><dd className="num">{detail.onu.mac}</dd>
                <dt>Model</dt><dd>{detail.onu.vendor} {detail.onu.model}</dd>
                <dt>Status</dt><dd><Pill status={detail.onu.status} /></dd>
                <dt>RX optical</dt><dd className="num">{detail.onu.rxDbmBase.toFixed(1)} dBm</dd>
                <dt>TX optical</dt><dd className="num">{detail.onu.txDbmBase.toFixed(1)} dBm</dd>
                <dt>Last reboot</dt><dd>{dateTimeStr(detail.onu.lastReboot)}</dd>
              </dl>
            </div>
          )}
        </div>
      )}

      {tab === "Support" && (
        <div className="card">
          <header><h3>Tickets</h3></header>
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Category</th><th>Priority</th><th>Status</th><th>Opened</th></tr></thead>
              <tbody>
                {detail.tickets.map((t) => (
                  <tr key={t.id}>
                    <td className="num">{t.id}</td>
                    <td>{t.category}</td>
                    <td><Pill status={t.priority} /></td>
                    <td><Pill status={t.status} /></td>
                    <td>{dateTimeStr(t.openedAt)}</td>
                  </tr>
                ))}
                {detail.tickets.length === 0 && <tr><td colSpan={5} className="empty">No support tickets.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
