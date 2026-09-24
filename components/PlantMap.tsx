"use client";

import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMap } from "react-leaflet";
import { useEffect } from "react";
import Link from "next/link";

export type MapOlt = { id: string; name: string; lat: number; lng: number; operStatus: string };
export type MapDn = { id: string; name: string; lat: number; lng: number; condition: string; zone: string };
export type MapSn = { id: string; name: string; lat: number; lng: number; condition: string; zone: string; customers: number };
export type MapFiber = { id: string; kind: string; route: [number, number][]; condition?: string };

const COLORS: Record<string, string> = {
  up: "#34d399", good: "#34d399", enabled: "#34d399",
  degraded: "#f5a524", attention: "#f5a524",
  down: "#ff5d73", failed: "#ff5d73",
};

function FocusHandler({ focus, points }: { focus?: string; points: Map<string, [number, number]> }) {
  const map = useMap();
  useEffect(() => {
    if (focus && points.has(focus)) {
      map.setView(points.get(focus)!, 15, { animate: true });
    }
  }, [focus, map, points]);
  return null;
}

export function PlantMap({
  olts, dns, sns, fibers, focus, height = 460,
}: { olts: MapOlt[]; dns: MapDn[]; sns: MapSn[]; fibers: MapFiber[]; focus?: string; height?: number }) {
  const center: [number, number] = olts.length ? [olts[0].lat, olts[0].lng] : [16.85, 96.14];
  const points = new Map<string, [number, number]>();
  olts.forEach((o) => points.set(o.id, [o.lat, o.lng]));
  dns.forEach((d) => points.set(d.id, [d.lat, d.lng]));
  sns.forEach((s) => points.set(s.id, [s.lat, s.lng]));

  return (
    <div className="map" style={{ height }}>
      <MapContainer center={center} zoom={12} className="leaflet-map" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FocusHandler focus={focus} points={points} />

        {fibers.map((f) => (
          <Polyline
            key={f.id}
            positions={f.route}
            pathOptions={{
              color: f.condition === "attention" ? COLORS.attention : "#2fd3e1",
              weight: f.kind === "feeder" ? 3 : 1.6,
              opacity: 0.65,
            }}
          />
        ))}

        {olts.map((o) => (
          <CircleMarker key={o.id} center={[o.lat, o.lng]} radius={10} pathOptions={{ color: "#03202b", weight: 2, fillColor: COLORS[o.operStatus] ?? "#2fd3e1", fillOpacity: 1 }}>
            <Popup>
              <b>{o.id}</b> — {o.name}<br />Status: {o.operStatus}<br />
              <Link href={`/odn/olt/${o.id}`}>Open OLT →</Link>
            </Popup>
          </CircleMarker>
        ))}
        {dns.map((d) => (
          <CircleMarker key={d.id} center={[d.lat, d.lng]} radius={6} pathOptions={{ color: "#03202b", weight: 1, fillColor: COLORS[d.condition] ?? "#2fd3e1", fillOpacity: 1 }}>
            <Popup>
              <b>{d.id}</b> — {d.name}<br />Zone: {d.zone}<br />
              <Link href={`/odn/dn/${d.id}`}>Open DN →</Link>
            </Popup>
          </CircleMarker>
        ))}
        {sns.map((s) => (
          <CircleMarker key={s.id} center={[s.lat, s.lng]} radius={4} pathOptions={{ color: "#03202b", weight: 1, fillColor: COLORS[s.condition] ?? "#9b8cff", fillOpacity: 1 }}>
            <Popup>
              <b>{s.id}</b> — {s.name}<br />{s.customers} customers<br />
              <Link href={`/odn/sn/${s.id}`}>Open SN →</Link>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="map-legend">
        <span><i style={{ background: "#2fd3e1" }} />OLT</span>
        <span><i style={{ background: "#2fd3e1" }} />DN (1:4)</span>
        <span><i style={{ background: "#9b8cff" }} />SN (1:16)</span>
        <span><i style={{ background: "#f5a524" }} />Needs attention</span>
        <span>Lines: feeder (thick) / distribution (thin) fibre</span>
      </div>
    </div>
  );
}
