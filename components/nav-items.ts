export type NavItem = { href: string; label: string; icon: string };
export type NavGroup = { group: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    group: "Business",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "◆" },
      { href: "/leads", label: "Leads", icon: "✦" },
      { href: "/subscribers", label: "Subscribers", icon: "☰" },
      { href: "/billing", label: "Billing & finance", icon: "฿" },
      { href: "/tariffs", label: "Plan", icon: "▤" },
    ],
  },
  {
    group: "Fibre network",
    items: [
      { href: "/odn", label: "Networking map", icon: "⌬" },
      { href: "/topology", label: "Topology & trace", icon: "⌖" },
      { href: "/network", label: "Live network", icon: "⟲" },
      { href: "/alarms", label: "Alarms", icon: "▲" },
    ],
  },
  {
    group: "Operations",
    items: [
      { href: "/helpdesk", label: "Helpdesk", icon: "☎" },
      { href: "/schedule", label: "Schedule", icon: "⏱" },
      { href: "/inventory", label: "Inventory", icon: "▣" },
      { href: "/messaging", label: "Messaging", icon: "✉" },
      { href: "/reports", label: "Reports", icon: "▦" },
      { href: "/settings", label: "Settings", icon: "⚙" },
    ],
  },
];
