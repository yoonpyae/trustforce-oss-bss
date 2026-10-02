import Link from "next/link";
import { notFound } from "next/navigation";
import { getPoolDetail, listPoolsWithUsage } from "@/lib/queries/ip-pools";
import { Pill } from "@/components/Pill";
import { PoolSubscribersTable } from "./PoolSubscribersTable";

export const dynamic = "force-dynamic";

export default async function PoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, allPools] = await Promise.all([getPoolDetail(id), listPoolsWithUsage()]);
  if (!detail) notFound();
  const { pool, nas, subscribers } = detail;
  const otherPools = allPools.filter((p) => p.id !== pool.id && p.status === "active");

  return (
    <>
      <div className="page-head">
        <div>
          <div className="crumb"><Link href="/ip-pools">IP pools</Link> / {pool.name}</div>
          <h1>{pool.name}</h1>
          <p className="num">{pool.rangeCidr} · VLAN {pool.vlan ?? "—"} · <Pill status={pool.status === "active" ? "active" : "disabled"}>{pool.status}</Pill></p>
        </div>
      </div>

      <div className="split" style={{ marginBottom: 14 }}>
        <div className="card">
          <header><h3>Pool</h3></header>
          <dl className="defn">
            <dt>CIDR range</dt><dd className="num">{pool.rangeCidr}</dd>
            <dt>VLAN</dt><dd className="num">{pool.vlan ?? "—"}</dd>
            <dt>Gateway</dt><dd className="num">{pool.gateway ?? "—"}</dd>
            <dt>DNS</dt><dd className="num">{pool.dns ?? "—"}</dd>
            <dt>Zone</dt><dd>{pool.zone ?? "—"}</dd>
            <dt>Type</dt><dd style={{ textTransform: "capitalize" }}>{pool.type}</dd>
            <dt>NAS</dt><dd>{nas?.name ?? "—"}</dd>
          </dl>
        </div>
        <div className="card">
          <header><h3>Utilisation</h3></header>
          <div className="kpi">
            <span className="label">Assigned subscribers</span>
            <span className="value num">{subscribers.length}</span>
          </div>
        </div>
      </div>

      <PoolSubscribersTable subscribers={subscribers} otherPools={otherPools} />
    </>
  );
}
