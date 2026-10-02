"use client";

import { useState } from "react";
import { addLocation } from "@/lib/actions/system-settings";

type Location = {
  id: string; name: string; code: string; nextSequence: number;
  city: string | null; township: string | null; lat: number | null; lng: number | null;
};

export function LocationsPanel({
  locations, isSysadmin, serviceCode, digitCount,
}: { locations: Location[]; isSysadmin: boolean; serviceCode: string; digitCount: number }) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="stack">
      <div className="table-wrap">
        <table>
          <thead><tr><th>Location</th><th>Code</th><th className="t-right">Next ID</th></tr></thead>
          <tbody>
            {locations.map((l) => (
              <tr key={l.id}>
                <td>
                  {l.name}
                  {(l.city || l.township || (l.lat != null && l.lng != null)) && (
                    <div className="hint">
                      {[l.city, l.township].filter(Boolean).join(" · ")}
                      {l.lat != null && l.lng != null && ` · ${l.lat.toFixed(4)}, ${l.lng.toFixed(4)}`}
                    </div>
                  )}
                </td>
                <td className="num">{l.code}</td>
                <td className="t-right num">{serviceCode}{l.code}-{String(l.nextSequence).padStart(digitCount, "0")}</td>
              </tr>
            ))}
            {locations.length === 0 && <tr><td colSpan={3} className="empty">No locations yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {isSysadmin && (
        <form
          className="stack"
          style={{ gap: 8 }}
          action={async (fd) => {
            setError(null);
            try {
              await addLocation(fd);
              (document.getElementById("loc-form") as HTMLFormElement)?.reset();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not add location.");
            }
          }}
          id="loc-form"
        >
          <div className="row">
            <input className="plain grow" name="name" placeholder="Name, e.g. Mandalay" required />
            <input className="plain" name="code" placeholder="Code, e.g. MDY" style={{ width: 100 }} required />
            <input className="plain num" name="startingSequence" type="number" min={1} placeholder="Start at" defaultValue={1} style={{ width: 100 }} />
          </div>
          <div className="row">
            <input className="plain" name="city" placeholder="City" style={{ flex: 1 }} />
            <input className="plain" name="township" placeholder="Township" style={{ flex: 1 }} />
            <input className="plain num" name="lat" type="number" step="any" placeholder="Lat" style={{ width: 110 }} />
            <input className="plain num" name="lng" type="number" step="any" placeholder="Lng" style={{ width: 110 }} />
            <button className="btn sm primary" type="submit">Add</button>
          </div>
        </form>
      )}
      {error && <p className="hint" style={{ color: "var(--bad)" }}>{error}</p>}
    </div>
  );
}
