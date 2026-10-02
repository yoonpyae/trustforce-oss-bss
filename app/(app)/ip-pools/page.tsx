import Link from "next/link";
import { listPoolsWithUsage } from "@/lib/queries/ip-pools";
import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { Pill } from "@/components/Pill";
import { getSession } from "@/lib/auth-session";
import { PoolEditor } from "./PoolEditor";

export const dynamic = "force-dynamic";

export default async function IpPoolsPage() {
  const [pools, nasDevices, session] = await Promise.all([
    listPoolsWithUsage(),
    db.select().from(s.nasDevices),
    getSession(),
  ]);
  const canEdit = session?.role === "sysadmin" || session?.role === "network_ops";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>IP pools</h1>
          <p>Address resources — each pool carries its own VLAN, gateway, DNS, zone and NAS, independent of any
            Traffic Plan. A subscriber's pool (and the VLAN that comes with it) is assigned here, never derived
            from their plan.</p>
        </div>
        <div className="spacer" />
        <Link href="/tariffs" className="btn ghost">Traffic Plan →</Link>
        {canEdit && <PoolEditor nasDevices={nasDevices} />}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pool</th><th>CIDR</th><th className="t-right">VLAN</th><th>NAS</th><th>Zone</th>
                <th>Type</th><th className="t-right">Utilisation</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {pools.map((p) => (
                <tr key={p.id} className="clickable">
                  <td><Link href={`/ip-pools/${p.id}`}><b>{p.name}</b></Link><div className="hint num">{p.id}</div></td>
                  <td className="num">{p.rangeCidr}</td>
                  <td className="t-right num">{p.vlan ?? "—"}</td>
                  <td>{p.nas?.name ?? "—"}</td>
                  <td>{p.zone ?? "—"}</td>
                  <td style={{ textTransform: "capitalize" }}>{p.type}</td>
                  <td className="t-right num">{p.used}{p.total > 0 ? ` / ${p.total}` : ""}</td>
                  <td><Pill status={p.status === "active" ? "active" : "disabled"}>{p.status}</Pill></td>
                  <td>{canEdit && <PoolEditor pool={p} nasDevices={nasDevices} compact canDelete />}</td>
                </tr>
              ))}
              {pools.length === 0 && <tr><td colSpan={9} className="empty">No IP pools yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
