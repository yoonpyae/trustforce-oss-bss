import { statusPillClass } from "@/lib/format";

export function Pill({ status, children }: { status: string; children?: React.ReactNode }) {
  return <span className={`pill ${statusPillClass(status)}`}>{children ?? status}</span>;
}
