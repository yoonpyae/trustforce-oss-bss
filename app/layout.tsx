import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { NAV } from "@/components/nav-items";
import { NavLink } from "@/components/NavLink";
import { OmniSearch } from "@/components/OmniSearch";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "TrustForce OSS/BSS",
  description: "OSS/BSS console for TrustForce Myanmar — subscribers, billing, FreeRADIUS and the optical distribution network in one console.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="shell">
          <div className="brand">
            <div className="brand-mark">TF</div>
            <div>
              <div className="brand-name">TrustForce</div>
              <div className="brand-sub">OSS / BSS</div>
            </div>
          </div>

          <header className="topbar">
            <OmniSearch />
            <div className="topbar-actions">
              <ThemeToggle />
              <div className="whoami">
                <b>Hein Htet Aung</b>
                <span>System administrator</span>
              </div>
            </div>
          </header>

          <nav className="rail" aria-label="Main">
            {NAV.map((g) => (
              <div className="rail-group" key={g.group}>
                <p>{g.group}</p>
                {g.items.map((item) => (
                  <NavLink key={item.href} {...item} />
                ))}
              </div>
            ))}
          </nav>

          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
