"use client";

import { useState } from "react";
import { addLocation } from "@/lib/actions/system-settings";

type Location = { id: string; name: string; code: string; nextSequence: number };

export function LocationsPanel({ locations, isSysadmin }: { locations: Location[]; isSysadmin: boolean }) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="stack">
      <div className="table-wrap">
        <table>
          <thead><tr><th>Location</th><th>Code</th><th className="t-right">Next ID</th></tr></thead>
          <tbody>
            {locations.map((l) => (
              <tr key={l.id}><td>{l.name}</td><td className="num">{l.code}</td><td className="t-right num">{l.nextSequence}</td></tr>
            ))}
            {locations.length === 0 && <tr><td colSpan={3} className="empty">No locations yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {isSysadmin && (
        <form
          className="row"
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
          <input className="plain grow" name="name" placeholder="Name, e.g. Mandalay" required />
          <input className="plain" name="code" placeholder="Code, e.g. MDY" style={{ width: 100 }} required />
          <button className="btn sm primary" type="submit">Add</button>
        </form>
      )}
      {error && <p className="hint" style={{ color: "var(--bad)" }}>{error}</p>}
    </div>
  );
}
