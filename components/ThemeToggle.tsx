"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = (typeof window !== "undefined" && window.localStorage.getItem("tf-theme")) as "dark" | "light" | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem("tf-theme", next);
    } catch {}
  }

  return (
    <button id="theme" className="btn sm ghost" aria-label="Toggle light or dark theme" onClick={toggle}>
      {theme === "dark" ? "◐" : "◑"}
    </button>
  );
}
