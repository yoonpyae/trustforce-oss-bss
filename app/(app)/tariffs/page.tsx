import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { mmk } from "@/lib/format";
import { Pill } from "@/components/Pill";
import { TariffEditor } from "./TariffEditor";

export const dynamic = "force-dynamic";

export default async function TariffsPage() {
  const [tariffs, bandwidthProfiles, ipPools, nasDevices] = await Promise.all([
    db.select().from(s.tariffs),
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
          <h1>Tariffs</h1>
          <p>Plan catalogue with the pre-publish dependency check: bandwidth profile, IP pool, NAS, validity and expiry behaviour must all resolve before a plan can be saved.</p>
        </div>
        <div className="spacer" />
        <TariffEditor bandwidthProfiles={bandwidthProfiles} ipPools={ipPools} nasDevices={nasDevices} />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Plan</th><th>Type</th><th className="t-right">Price</th><th>Validity</th>
                <th>Bandwidth</th><th>IP pool</th><th>NAS</th><th>Status</th><th></th>
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
                    <td>{poolMap.get(t.ipPoolId)?.name ?? "—"}</td>
                    <td>{nasMap.get(t.nasId)?.name ?? "—"}</td>
                    <td><Pill status={t.status} /></td>
                    <td><TariffEditor tariff={t} bandwidthProfiles={bandwidthProfiles} ipPools={ipPools} nasDevices={nasDevices} compact /></td>
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
