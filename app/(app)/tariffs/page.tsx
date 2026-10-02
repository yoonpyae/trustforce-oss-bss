import Link from "next/link";
import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { listTariffsWithUsage } from "@/lib/queries/tariffs";
import { mmk } from "@/lib/format";
import { Pill } from "@/components/Pill";
import { TariffEditor } from "./TariffEditor";
import { getSession } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export default async function TariffsPage() {
  const session = await getSession();
  const canEdit = session?.role === "sysadmin";
  const [tariffs, bandwidthProfiles, ipPools, nasDevices] = await Promise.all([
    listTariffsWithUsage(),
    db.select().from(s.bandwidthProfiles),
    db.select().from(s.ipPools),
    db.select().from(s.nasDevices),
  ]);

  const bwMap = new Map(bandwidthProfiles.map((b) => [b.id, b]));
  const poolMap = new Map(ipPools.map((p) => [p.id, p]));
  const nasMap = new Map(nasDevices.map((n) => [n.id, n]));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Traffic Plan</h1>
          <p>
            Bandwidth policy catalogue with the pre-publish dependency check: bandwidth profile, validity and price
            must all resolve before a plan can be saved. IP pool and VLAN are not part of a plan — a pool (with its
            own VLAN) is assigned independently per subscriber (Subscribers → Network &amp; optical), and the same
            plan can be reused across as many pools/VLANs as needed.
            {!canEdit && " Your role has read-only access to plans."}
          </p>
        </div>
        <div className="spacer" />
        <Link href="/ip-pools" className="btn ghost">IP pools →</Link>
        {canEdit && <TariffEditor bandwidthProfiles={bandwidthProfiles} ipPools={ipPools} nasDevices={nasDevices} />}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Plan</th><th>Type</th><th className="t-right">Price</th><th>Validity</th>
                <th>Bandwidth</th><th>Default IP pool</th><th>Allowed NAS</th>
                <th className="t-right">Subscribers</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {tariffs.map((t) => {
                const bw = bwMap.get(t.bandwidthProfileId);
                return (
                  <tr key={t.id}>
                    <td><b>{t.name}</b><div className="hint num">{t.id}</div></td>
                    <td>{t.billingType} / {t.accountType}</td>
                    <td className="t-right num">{mmk(t.priceMmk)}</td>
                    <td>{t.validityDays}d</td>
                    <td className="num">{bw ? `${bw.downKbps / 1000}M/${bw.upKbps / 1000}M` : "—"}</td>
                    <td>{t.ipPoolId ? poolMap.get(t.ipPoolId)?.name ?? "—" : "—"}</td>
                    <td>{t.allowedNasIds.length ? t.allowedNasIds.map((id) => nasMap.get(id)?.name ?? id).join(", ") : <span className="hint">Any</span>}</td>
                    <td className="t-right num">
                      {t.subscriberCount > 0 ? <Link href={`/subscribers?tariffId=${t.id}`} title="View/batch-migrate subscribers on this plan">{t.subscriberCount}</Link> : 0}
                    </td>
                    <td><Pill status={t.status} /></td>
                    <td>{canEdit && <TariffEditor tariff={t} bandwidthProfiles={bandwidthProfiles} ipPools={ipPools} nasDevices={nasDevices} compact />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
