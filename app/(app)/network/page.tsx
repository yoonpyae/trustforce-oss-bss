import Link from "next/link";
import { getNetworkOverview } from "@/lib/queries/network";
import { Pill } from "@/components/Pill";
import { setStatus } from "@/lib/actions/customers";

export const dynamic = "force-dynamic";

export default async function NetworkPage() {
  const { nasDevices, ipPools, bandwidthProfiles, sessions } = await getNetworkOverview(80);
  const onlineCount = sessions.filter((s) => s.session.online).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Live network</h1>
          <p>
            PPPoE/IPoE sessions, NAS and IP pool utilisation. Session throughput and RADIUS state are simulated — there is
            no real MikroTik/RADIUS deployment behind this build — but CoA disconnect/reconnect below writes a real status
            change to the subscriber record.
          </p>
        </div>
      </div>

      <div className="grid g3" style={{ marginBottom: 14 }}>
        <div className="card">
          <header><h3>BNG / NAS</h3></header>
          <div className="table-wrap">
            <table>
              <thead><tr><th>NAS</th><th>Type</th><th className="t-right">Sessions</th></tr></thead>
              <tbody>
                {nasDevices.map(({ nas, sessions: n }) => (
                  <tr key={nas.id}><td className="num">{nas.id}<div className="hint">{nas.name}</div></td><td>{nas.type}</td><td className="t-right num">{n}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <header><h3>IP pools</h3></header>
          <div className="stack">
            {ipPools.map(({ pool, used }) => (
              <div key={pool.id}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span>{pool.name}</span><span className="num hint">{used} used</span>
                </div>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.min(100, used)}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <header><h3>Bandwidth profiles</h3></header>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Profile</th><th className="t-right">Down/Up</th></tr></thead>
              <tbody>
                {bandwidthProfiles.map((b) => (
                  <tr key={b.id}><td>{b.name}</td><td className="t-right num">{b.downKbps / 1000}M / {b.upKbps / 1000}M</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <header>
          <h3 style={{ flex: 1 }}>PPPoE monitor</h3>
          <span className="pill on">{onlineCount} online</span>
        </header>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Customer</th><th>NAS</th><th className="t-right">Down</th><th className="t-right">Up</th><th className="t-right">Uptime</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {sessions.map(({ customer, session }) => (
                <tr key={customer.id}>
                  <td><Link href={`/subscribers/${customer.id}`}>{customer.fullName}</Link><div className="hint num">{customer.pppoeUsername}</div></td>
                  <td className="num">{customer.zone}</td>
                  <td className="t-right num">{session.rxMbps} Mbps</td>
                  <td className="t-right num">{session.txMbps} Mbps</td>
                  <td className="t-right num">{session.online ? Math.floor(session.uptimeS / 3600) + "h" : "—"}</td>
                  <td><Pill status={session.online ? "online" : "offline"} /></td>
                  <td>
                    <form action={setStatus}>
                      <input type="hidden" name="customerId" value={customer.id} />
                      <input type="hidden" name="status" value={session.online ? "suspended" : "active"} />
                      <button className="btn sm ghost" type="submit">{session.online ? "CoA disconnect" : "CoA reconnect"}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
