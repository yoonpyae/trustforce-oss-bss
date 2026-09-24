export function mmk(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("en-US") + " MMK";
}

export function num(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("en-US");
}

export function dateStr(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function dateTimeStr(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function daysUntil(d: Date | string | null | undefined): number {
  if (!d) return 0;
  const dt = typeof d === "string" ? new Date(d) : d;
  return Math.round((dt.getTime() - Date.now()) / 86400000);
}

export function relTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  const diffMs = Date.now() - dt.getTime();
  const abs = Math.abs(diffMs);
  const mins = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  const suffix = diffMs >= 0 ? "ago" : "from now";
  if (mins < 60) return `${mins}m ${suffix}`;
  if (hours < 48) return `${hours}h ${suffix}`;
  return `${days}d ${suffix}`;
}

export function statusPillClass(status: string): string {
  const map: Record<string, string> = {
    active: "on", online: "on", paid: "on", resolved: "on", instock: "on",
    offline: "off", expired: "off", overdue: "off", fault: "off", critical: "off", banned: "off", disabled: "off",
    grace: "warn", degraded: "warn", pending: "warn", major: "warn", attention: "warn",
    suspended: "idle", draft: "idle", minor: "idle", idle: "idle", used: "idle",
  };
  return map[status] ?? "info";
}
