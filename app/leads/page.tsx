import { listLeads, getLeadsFunnel } from "@/lib/queries/leads";
import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { Pill } from "@/components/Pill";
import { dateStr, relTime } from "@/lib/format";
import { updateLeadStatus, convertLeadToCustomer } from "@/lib/actions/leads";
import { LeadForm } from "./LeadForm";
import { Donut } from "@/components/Charts";

export const dynamic = "force-dynamic";

const STAGES = ["new", "contacted", "qualified", "quoted", "won", "lost"] as const;
const STAGE_COLORS: Record<string, string> = {
  new: "var(--cyan)", contacted: "var(--violet)", qualified: "var(--warn)",
  quoted: "var(--cyan-deep)", won: "var(--good)", lost: "var(--bad)",
};

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const sp = await searchParams;
  const [leads, funnel, tariffs, zones] = await Promise.all([
    listLeads({ status: sp.status, q: sp.q }),
    getLeadsFunnel(),
    db.select().from(s.tariffs),
    db.select({ zone: s.customers.zone }).from(s.customers).groupBy(s.customers.zone),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Leads</h1>
          <p>New-inquiry pipeline, kept separate from provisioned subscribers until a lead is converted and booked onto the ODN plant.</p>
        </div>
        <div className="spacer" />
        <LeadForm zones={zones.map((z) => z.zone)} tariffs={tariffs} />
      </div>

      <div className="grid g4" style={{ marginBottom: 14 }}>
        <div className="card kpi"><span className="label">Open pipeline</span><span className="value num">{funnel.open}</span><span className="foot">{funnel.total} total captured</span></div>
        <div className="card kpi"><span className="label">Qualified + quoted</span><span className="value num">{funnel.byStatus.qualified + funnel.byStatus.quoted}</span></div>
        <div className="card kpi"><span className="label">Won</span><span className="value num" style={{ color: "var(--good)" }}>{funnel.byStatus.won}</span><span className="foot">{funnel.conversionRate}% of closed leads</span></div>
        <div className="card kpi"><span className="label">Lost</span><span className="value num" style={{ color: "var(--bad)" }}>{funnel.byStatus.lost}</span></div>
      </div>

      <div className="split" style={{ marginBottom: 14 }}>
        <div className="card">
          <header><h3>Funnel</h3></header>
          <div className="row" style={{ gap: 18, flexWrap: "wrap" }}>
            {STAGES.map((st) => (
              <div className="kpi" key={st}>
                <span className="label" style={{ textTransform: "capitalize" }}>{st}</span>
                <span className="value num" style={{ fontSize: 22, color: STAGE_COLORS[st] }}>{funnel.byStatus[st] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <header><h3>By source</h3></header>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Donut
              slices={Object.entries(funnel.bySource).map(([src, n], i) => ({ value: n, color: ["#2fd3e1", "#9b8cff", "#34d399", "#f5a524", "#ff5d73", "#7c93a3"][i % 6] }))}
              center={funnel.total}
              sub="leads"
            />
          </div>
          <div className="legend" style={{ justifyContent: "center", marginTop: 8 }}>
            {Object.entries(funnel.bySource).map(([src, n], i) => (
              <span key={src}><i style={{ background: ["#2fd3e1", "#9b8cff", "#34d399", "#f5a524", "#ff5d73", "#7c93a3"][i % 6] }} />{src} ({n})</span>
            ))}
          </div>
        </div>
      </div>

      <div className="toolbar">
        {(["", "new", "contacted", "qualified", "quoted", "won", "lost"] as const).map((st) => (
          <a key={st || "all"} href={st ? `/leads?status=${st}` : "/leads"} className={(sp.status ?? "") === st ? "btn sm primary" : "btn sm ghost"}>{st || "all"}</a>
        ))}
        <span style={{ flex: 1 }} />
        <form method="get">
          <input type="hidden" name="status" value={sp.status ?? ""} />
          <input className="plain" type="search" name="q" placeholder="Search name, phone, ID…" defaultValue={sp.q ?? ""} />
        </form>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Lead</th><th>Source</th><th>Zone</th><th>Interested plan</th><th>Status</th><th>Captured</th><th></th></tr></thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td><b>{l.fullName}</b><div className="hint num">{l.id} · {l.phone}</div></td>
                  <td>{l.source}</td>
                  <td>{l.zone ?? "—"}</td>
                  <td>{l.tariff?.name ?? "—"}</td>
                  <td>
                    <Pill status={l.status === "won" ? "active" : l.status === "lost" ? "expired" : l.status} />
                    {l.convertedCustomerId && <div className="hint num">→ {l.convertedCustomerId}</div>}
                  </td>
                  <td>{relTime(l.createdAt)}</td>
                  <td>
                    {l.status !== "won" && l.status !== "lost" && (
                      <div className="row">
                        <form action={updateLeadStatus}>
                          <input type="hidden" name="leadId" value={l.id} />
                          <input type="hidden" name="status" value={l.status === "new" ? "contacted" : l.status === "contacted" ? "qualified" : "quoted"} />
                          <button className="btn sm ghost" type="submit">Advance</button>
                        </form>
                        {l.tariff && (
                          <form action={convertLeadToCustomer}>
                            <input type="hidden" name="leadId" value={l.id} />
                            <input type="hidden" name="tariffId" value={l.interestedTariffId ?? ""} />
                            <button className="btn sm primary" type="submit">Convert</button>
                          </form>
                        )}
                        <form action={updateLeadStatus}>
                          <input type="hidden" name="leadId" value={l.id} />
                          <input type="hidden" name="status" value="lost" />
                          <button className="btn sm danger" type="submit">Lost</button>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {leads.length === 0 && <tr><td colSpan={7} className="empty">No leads match this filter.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
