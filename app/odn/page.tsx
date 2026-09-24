import { getPlantOverview } from "@/lib/queries/odn";
import { NetworkExplorer } from "@/components/NetworkExplorer";

export const dynamic = "force-dynamic";

export default async function OdnPage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  const sp = await searchParams;
  const { olts, dns, sns, fibers } = await getPlantOverview();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Networking map</h1>
          <p>
            OLT → PON port → feeder fibre → DN (1:4) → distribution fibre → SN (1:16) → ONU → customer. {olts.length} OLTs,{" "}
            {dns.length} DNs, {sns.length} SNs. Expand the tree on the left (like a KMZ/Google-Earth layer list) or toggle
            layers, then click any object to focus the map.
          </p>
        </div>
        <div className="spacer" />
        <a href="/api/kml" className="btn ghost">Export plant KML</a>
      </div>

      <NetworkExplorer olts={olts} dns={dns} sns={sns} fibers={fibers} initialFocus={sp.focus} />
    </>
  );
}
