"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  const pathname = usePathname();
  const on = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link href={href} className={"nav-link" + (on ? " on" : "")}>
      <span className="ic">{icon}</span>
      {label}
    </Link>
  );
}
