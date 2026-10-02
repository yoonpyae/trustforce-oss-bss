import Link from "next/link";
import { listCustomers, getZones } from "@/lib/queries/customers";
import { listLocations, getSystemSettings } from "@/lib/queries/settings";
import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { AddCustomerForm } from "./AddCustomerForm";
import { SubscribersTable } from "./SubscribersTable";

export const dynamic = "force-dynamic";

export default async function SubscribersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; zone?: string }> }) {
  const sp = await searchParams;
  const [customers, zones, tariffs, locations, ipPools, settings] = await Promise.all([
    listCustomers({ q: sp.q, status: sp.status, zone: sp.zone, limit: 300 }),
    getZones(),
    db.select().from(s.tariffs),
    listLocations(),
    db.select().from(s.ipPools),
    getSystemSettings(),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Subscribers</h1>
          <p>{customers.length} accounts shown. Filterable list backed by Neon Postgres — every action here writes a real row and an audit entry.</p>
        </div>
        <div className="spacer" />
        <a href="/api/reports/customers" className="btn ghost">Export CSV</a>
        <AddCustomerForm
          zones={zones} tariffs={tariffs} locations={locations} ipPools={ipPools}
          defaultLocationId={settings.defaultLocationId} serviceCode={settings.subscriberIdServiceCode} digitCount={settings.subscriberIdDigitCount}
        />
      </div>

      <form className="toolbar" method="get">
        <input className="grow" type="search" name="q" placeholder="Search name, ID, phone, username…" defaultValue={sp.q ?? ""} />
        <select name="status" defaultValue={sp.status ?? ""}>
          <option value="">All statuses</option>
          {["pending", "active", "grace", "suspended", "expired", "inactive", "banned", "disabled"].map((st) => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>
        <select name="zone" defaultValue={sp.zone ?? ""}>
          <option value="">All zones</option>
          {zones.map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
        </select>
        <button className="btn primary sm" type="submit">Filter</button>
        {(sp.q || sp.status || sp.zone) && <Link href="/subscribers" className="btn sm ghost">Clear</Link>}
      </form>

      <SubscribersTable customers={customers} tariffs={tariffs} />
    </>
  );
}
