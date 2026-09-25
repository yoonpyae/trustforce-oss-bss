import Link from "next/link";

const TABS = [
  { href: "/inventory", label: "Dashboard" },
  { href: "/inventory/products", label: "Products" },
  { href: "/inventory/items", label: "Items" },
  { href: "/inventory/supply/suppliers", label: "Suppliers" },
  { href: "/inventory/supply/vendors", label: "Vendors" },
  { href: "/inventory/supply/invoices", label: "Supplier invoices" },
];

export function InventoryTabs({ active }: { active: string }) {
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
