"use client";

import { useState } from "react";
import { updateSystemSettings } from "@/lib/actions/system-settings";

type Settings = { subscriberIdServiceCode: string; subscriberIdDigitCount: number; defaultLocationId: string | null; billingCalculationMode: string; paymentWebhookSecret: string };
type Location = { id: string; name: string; code: string };

export function SystemSettingsForm({ settings, locations, isSysadmin }: { settings: Settings; locations: Location[]; isSysadmin: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!isSysadmin) {
    return (
      <dl className="defn">
        <dt>Subscriber ID format</dt><dd className="num">{settings.subscriberIdServiceCode}&lt;LOCATION&gt;-{"0".repeat(settings.subscriberIdDigitCount)}</dd>
        <dt>Billing calculation</dt><dd style={{ textTransform: "capitalize" }}>{settings.billingCalculationMode}</dd>
      </dl>
    );
  }

  return (
    <form
      className="stack"
      action={async (fd) => {
        setError(null);
        setSaved(false);
        try {
          await updateSystemSettings(fd);
          setSaved(true);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Save failed.");
        }
      }}
    >
      {error && <p className="hint" style={{ color: "var(--bad)" }}>{error}</p>}
      {saved && <p className="hint" style={{ color: "var(--good)" }}>Saved.</p>}
      <div className="grid g2">
        <div className="field">
          <label>Subscriber ID service code</label>
          <input name="subscriberIdServiceCode" defaultValue={settings.subscriberIdServiceCode} maxLength={4} />
        </div>
        <div className="field">
          <label>Subscriber ID digit count</label>
          <input name="subscriberIdDigitCount" type="number" min={3} max={10} defaultValue={settings.subscriberIdDigitCount} />
        </div>
      </div>
      <p className="hint num">
        Example: {settings.subscriberIdServiceCode}{locations[0]?.code ?? "YGN"}-{String(1).padStart(settings.subscriberIdDigitCount, "0")}
      </p>
      <div className="grid g2">
        <div className="field">
          <label>Default location</label>
          <select name="defaultLocationId" defaultValue={settings.defaultLocationId ?? ""}>
            <option value="">None — location required per subscriber</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
          </select>
        </div>
        <div className="field">
          <label>Billing calculation</label>
          <select name="billingCalculationMode" defaultValue={settings.billingCalculationMode}>
            <option value="monthly">Monthly — always charge the full plan fee</option>
            <option value="daily">Daily — exclude days a subscriber had no service</option>
          </select>
        </div>
      </div>
      <button className="btn primary sm" type="submit" style={{ justifySelf: "start" }}>Save system settings</button>
      <p className="hint">
        Payment webhook: <code>POST /api/webhooks/payment</code> with header <code>x-webhook-secret: {settings.paymentWebhookSecret}</code>
      </p>
    </form>
  );
}
