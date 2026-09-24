"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window` at import time, so the map must never render
// during SSR — load it only in the browser.
export const PlantMap = dynamic(() => import("./PlantMap").then((m) => m.PlantMap), {
  ssr: false,
  loading: () => <div className="map" style={{ height: 460, display: "grid", placeItems: "center", color: "var(--text-mute)" }}>Loading map…</div>,
});
