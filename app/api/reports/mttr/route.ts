import { getMttrByTechnician } from "@/lib/queries/reports";
import { csvResponse } from "@/lib/csv";
import { getSession } from "@/lib/auth-session";

export async function GET() {
  if (!(await getSession())) return new Response("Unauthorized", { status: 401 });
  const rows = await getMttrByTechnician();
  return csvResponse(rows.map((r) => ({ technician: r.technician, resolved: r.count, mttr_hours: r.mttrHours })), "mttr.csv");
}
