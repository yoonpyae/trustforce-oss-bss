import { getMttrByTechnician } from "@/lib/queries/reports";
import { csvResponse } from "@/lib/csv";

export async function GET() {
  const rows = await getMttrByTechnician();
  return csvResponse(rows.map((r) => ({ technician: r.technician, resolved: r.count, mttr_hours: r.mttrHours })), "mttr.csv");
}
