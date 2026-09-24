"use client";

import { useState } from "react";

type Template = { id: string; name: string; channel: string };

export function CampaignForm({ sendCampaign, templates }: { sendCampaign: (fd: FormData) => Promise<void>; templates: Template[] }) {
  const [audience, setAudience] = useState("active");
  const [channel, setChannel] = useState("sms");
  const [template, setTemplate] = useState(templates[0]?.id ?? "");
  const [testPassed, setTestPassed] = useState(false);
  const [busy, setBusy] = useState<"test" | "send" | null>(null);

  function reset(setter: () => void) {
    setter();
    setTestPassed(false);
  }

  async function run(testMode: boolean) {
    setBusy(testMode ? "test" : "send");
    const fd = new FormData();
    fd.set("audience", audience);
    fd.set("channel", channel);
    fd.set("template", template);
    if (testMode) fd.set("testMode", "on");
    await sendCampaign(fd);
    setBusy(null);
    if (testMode) setTestPassed(true);
    else setTestPassed(false);
  }

  return (
    <div className="card">
      <header><h3>New campaign</h3></header>
      <div className="stack">
        <div className="field">
          <label>Audience</label>
          <select value={audience} onChange={(e) => reset(() => setAudience(e.target.value))}>
            <option value="all">All clients</option>
            <option value="active">Active</option>
            <option value="expired">Expiring / expired</option>
            <option value="offline">Offline / suspended</option>
            <option value="business">Business</option>
          </select>
        </div>
        <div className="grid g2">
          <div className="field">
            <label>Channel</label>
            <select value={channel} onChange={(e) => reset(() => setChannel(e.target.value))}>
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
            </select>
          </div>
          <div className="field">
            <label>Template</label>
            <select value={template} onChange={(e) => reset(() => setTemplate(e.target.value))}>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
        <div className="row">
          <button className="btn" type="button" disabled={busy !== null} onClick={() => run(true)}>
            {busy === "test" ? "Running test…" : "1. Run test (3 recipients)"}
          </button>
          <button className="btn primary" type="button" disabled={!testPassed || busy !== null} onClick={() => run(false)}>
            {busy === "send" ? "Sending…" : "2. Send live"}
          </button>
        </div>
        <p className="hint">{testPassed ? "Test pass confirmed — live send unlocked for this configuration." : "A test send is required before the live send unlocks, matching the NationNet 4-point pre-action check."}</p>
      </div>
    </div>
  );
}
