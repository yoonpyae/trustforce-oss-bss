import { getActivations } from "@/lib/queries/reports";
import { csvResponse } from "@/lib/csv";
import { dateStr } from "@/lib/format";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rows = await getActivations(searchParams.get("start") || undefined, searchParams.get("end") || undefined);
  return csvResponse(
    rows.map((c) => ({ id: c.id, name: c.fullName, plan: c.tariff?.name ?? "", installed: dateStr(c.installedDate), status: c.status })),
    "activations.csv"
  );
}
