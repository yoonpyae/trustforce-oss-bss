import Link from "next/link";

const TABS = [
  { href: "/billing", label: "Dashboard" },
  { href: "/billing/invoices", label: "Invoices" },
  { href: "/billing/vouchers", label: "Vouchers" },
];

export function BillingTabs({ active }: { active: string }) {
  return (
    <div className="tabs" style={{ marginBottom: 18 }}>
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={active === t.href ? "on" : undefined} style={{ padding: "8px 12px", fontSize: 13 }}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}
