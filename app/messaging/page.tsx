import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { desc } from "drizzle-orm";
import { Pill } from "@/components/Pill";
import { dateTimeStr } from "@/lib/format";
import { sendCampaign } from "@/lib/actions/messaging";
import { CampaignForm } from "./CampaignForm";

export const dynamic = "force-dynamic";

const TEMPLATES = [
  { id: "TPL-WELCOME", name: "Welcome / service activated", channel: "SMS", body: "Mingalaba {name}! Your {plan} service is now active. Support 09-777-000-111 — TrustForce." },
  { id: "TPL-EXP-3", name: "Expiry reminder — 3 days", channel: "SMS", body: "Dear {name}, your {plan} expires on {expiry}. Pay via KBZPay/WavePay QR to stay online." },
  { id: "TPL-PAID", name: "Payment received", channel: "SMS", body: "Payment received. {plan} extended to {expiry}. Thank you, {name}." },
  { id: "TPL-OUTAGE", name: "Planned / fault maintenance", channel: "WhatsApp", body: "Notice: fibre maintenance in {zone}. Service may be interrupted. — TrustForce" },
];

export default async function MessagingPage() {
  const campaigns = await db.select().from(s.campaigns).orderBy(desc(s.campaigns.createdAt)).limit(30);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Messaging</h1>
          <p>
            Audience builder with a mandatory test pass before a live send. There is no connected SMS/Viber gateway in
            this build, so a &quot;send&quot; here creates a real campaign record and audit entry rather than dispatching an
            actual message.
          </p>
        </div>
      </div>

      <div className="split">
        <CampaignForm sendCampaign={sendCampaign} templates={TEMPLATES} />
        <div className="card">
          <header><h3>Templates</h3></header>
          <div className="stack">
            {TEMPLATES.map((t) => (
              <div key={t.id} className="port free" style={{ cursor: "default" }}>
                <div className="p-id"><b>{t.name}</b> <span className="pill plain info">{t.channel}</span></div>
                <div className="hint">{t.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <header><h3>Campaign history</h3></header>
        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Audience</th><th>Channel</th><th>Template</th><th className="t-right">Recipients</th><th>Status</th><th>When</th></tr></thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td className="num">{c.id}</td>
                  <td>{c.audience}</td>
                  <td>{c.channel}</td>
                  <td className="num">{c.template}</td>
                  <td className="t-right num">{c.recipientCount}</td>
                  <td><Pill status={c.status} /></td>
                  <td>{dateTimeStr(c.createdAt)}</td>
                </tr>
              ))}
              {campaigns.length === 0 && <tr><td colSpan={7} className="empty">No campaigns yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
