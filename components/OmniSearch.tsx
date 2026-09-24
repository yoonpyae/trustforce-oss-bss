"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { globalSearch, type SearchHit } from "@/lib/actions/search";

export function OmniSearch() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        boxRef.current?.querySelector("input")?.focus();
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onChange(v: string) {
    setQ(v);
    if (v.trim().length < 2) {
      setHits([]);
      setOpen(false);
      return;
    }
    startTransition(async () => {
      const res = await globalSearch(v);
      setHits(res);
      setOpen(true);
    });
  }

  return (
    <div className="omni" ref={boxRef}>
      <span className="omni-icon" aria-hidden="true">⌕</span>
      <input
        type="search"
        autoComplete="off"
        placeholder="Search anything — subscriber, ONU serial, MAC, SN-004, DN-002, INV-26014  (Ctrl K)"
        aria-label="Global search"
        value={q}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => hits.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div className="omni-results" role="listbox">
          {hits.length === 0 ? (
            <div className="omni-empty">No matches for “{q}”.</div>
          ) : (
            hits.map((h) => (
              <div
                key={h.type + h.id}
                className="omni-hit"
                role="option"
                tabIndex={0}
                onClick={() => {
                  setOpen(false);
                  router.push(h.href);
                }}
              >
                <span className="pill plain info">{h.type}</span>
                <span>
                  <b>{h.label}</b>
                  <div className="hint">{h.sub}</div>
                </span>
                <span className="num hint">{h.id}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
