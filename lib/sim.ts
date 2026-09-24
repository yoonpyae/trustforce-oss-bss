// Simulated network telemetry — RADIUS/CoA, MikroTik sessions, TR-069 and
// live optical jitter are not backed by real hardware in this build (see
// README), so these numbers are generated deterministically from the object's
// id plus a slow-moving time bucket rather than being fabricated per request
// or persisted as if they were real device readings.
import { makeRng, seedFromString } from "@/lib/rng";

function bucketRng(id: string, bucketMinutes: number) {
  const bucket = Math.floor(Date.now() / (bucketMinutes * 60000));
  return makeRng(seedFromString(id + ":" + bucket));
}

export function simOnuOptical(onuId: string, rxBase: number, txBase: number, status: string) {
  const r = bucketRng(onuId, 5);
  const jitter = (r() - 0.5) * 0.6;
  const online = status === "online";
  return {
    rx: online ? +(rxBase + jitter).toFixed(1) : null,
    tx: online ? +(txBase + jitter * 0.4).toFixed(1) : null,
    online,
    uptimeH: online ? Math.floor(r() * 900) + 3 : 0,
  };
}

export function simOpticalHistory(onuId: string, rxBase: number, days = 30) {
  const points: number[] = [];
  const labels: string[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const r = bucketRng(onuId + ":day" + d, 1440);
    // gentle random-walk-ish drift so the trend looks organic but is stable per day
    const drift = Math.sin(d / 6) * 0.8;
    points.push(+(rxBase + drift + (r() - 0.5) * 0.5).toFixed(1));
    const dt = new Date(Date.now() - d * 86400000);
    labels.push(dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }));
  }
  return { points, labels };
}

export function simOltPortTraffic(portId: string, onuCount: number) {
  const r = bucketRng(portId, 5);
  return {
    rxGbps: +(onuCount * (0.02 + r() * 0.05)).toFixed(2),
    txGbps: +(onuCount * (0.08 + r() * 0.15)).toFixed(2),
  };
}

export function simSession(customerId: string, capDownKbps: number, capUpKbps: number, online: boolean) {
  const r = bucketRng(customerId, 1);
  if (!online) return { online: false, rxMbps: 0, txMbps: 0, uptimeS: 0, totalGB: 0 };
  return {
    online: true,
    rxMbps: +((capDownKbps / 1000) * (0.05 + r() * 0.55)).toFixed(1),
    txMbps: +((capUpKbps / 1000) * (0.03 + r() * 0.35)).toFixed(1),
    uptimeS: Math.floor(r() * 400000) + 300,
    totalGB: +(r() * 480).toFixed(1),
  };
}
