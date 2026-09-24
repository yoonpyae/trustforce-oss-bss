import Link from "next/link";
import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { Pill } from "@/components/Pill";
import { relTime } from "@/lib/format";
import { moveTicket } from "@/lib/actions/tickets";

export const dynamic = "force-dynamic";

const STAGES = [
  { key: "open", label: "Open", next: "assigned" },
  { key: "assigned", label: "Assigned", next: "in-progress" },
  { key: "in-progress", label: "In progress", next: "resolved" },
  { key: "resolved", label: "Resolved", next: null },
] as const;

export default async function HelpdeskPage() {
  const tickets = await db.select().from(s.tickets);
  const customers = await db.select({ id: s.customers.id, fullName: s.customers.fullName, zone: s.customers.zone }).from(s.customers);
  const custMap = new Map(customers.map((c) => [c.id, c]));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Helpdesk</h1>
          <p>{tickets.length} tickets. Kanban lifecycle Open → Assigned → In-progress → Resolved, each move writes a real row and audit entry.</p>
        </div>
      </div>

      <div className="kanban">
        {STAGES.map((stage) => {
          const items = tickets.filter((t) => t.status === stage.key);
          return (
            <div className="kcol" key={stage.key}>
              <h4>{stage.label} ({items.length})</h4>
              {items.map((t) => {
                const cust = custMap.get(t.customerId);
                return (
                  <div className="kcard" key={t.id}>
                    <h5>{t.category} <span className="hint num">{t.id}</span></h5>
                    <p>{cust ? <Link href={`/subscribers/${cust.id}`}>{cust.fullName}</Link> : t.customerId} · {cust?.zone}</p>
                    <div className="badge-row" style={{ marginBottom: 8 }}>
                      <Pill status={t.priority} />
                      {t.technician && <span className="pill plain info">{t.technician}</span>}
                      <span className="hint">{relTime(t.openedAt)}</span>
                    </div>
                    {stage.next && (
                      <form action={moveTicket}>
                        <input type="hidden" name="ticketId" value={t.id} />
                        <input type="hidden" name="status" value={stage.next} />
                        <button className="btn sm primary" type="submit">
                          Move to {STAGES.find((s2) => s2.key === stage.next)?.label}
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
              {items.length === 0 && <p className="hint">Nothing here.</p>}
            </div>
          );
        })}
      </div>
    </>
  );
}
