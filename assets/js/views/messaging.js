(function (TF) {
  "use strict";
  const U = TF.ui;
  const { h, fmt, pill, table, tabs, modal, toast, select, input, field } = U;
  const day = 86400000;

  const AUDIENCES = [
    { id: "expiring3", label: "Expiring within 3 days", pick: (S) => S.db.customers.filter((c) => c.expiry > S.db.meta.now && c.expiry < S.db.meta.now + 3 * day) },
    { id: "expired", label: "Already expired", pick: (S) => S.db.customers.filter((c) => c.status === "expired") },
    { id: "offline", label: "Offline right now", pick: (S) => S.db.customers.filter((c) => { const s = S.get.session(c.id); return s && !s.online; }) },
    { id: "business", label: "Business accounts", pick: (S) => S.db.customers.filter((c) => c.segment === "business") },
    { id: "all", label: "Every active subscriber", pick: (S) => S.db.customers.filter((c) => c.status === "active") }
  ];

  TF.views.messaging = {
    title: "Customer messaging",
    subtitle: "Lifecycle messages go out on their own. Anything sent by hand runs through a test pass first, because a bulk send is the one action in this system that cannot be taken back.",
    render() {
      return tabs([
        { id: "send", label: "Send", render: sender },
        { id: "tpl", label: "Templates", render: templates },
        { id: "hist", label: "History", render: history }
      ]);
    }
  };

  function sender() {
    const S = TF.store;
    const aud = select(AUDIENCES.map((a) => ({ value: a.id, label: a.label })));
    const ch = select([{ value: "SMS", label: "SMS" }, { value: "Viber", label: "Viber" }, { value: "Email", label: "Email" }]);
    const tpl = select([{ value: "", label: "Write my own" }].concat(S.db.templates.map((t) => ({ value: t.id, label: t.name }))));
    const bodyText = h("textarea", { placeholder: "Message body. Placeholders: {name} {plan} {expiry} {amount} {zone}" });
    const count = h("div", { class: "card kpi" });
    const results = h("div");

    function recipients() { return AUDIENCES.find((a) => a.id === aud.value).pick(S); }
    function refresh() {
      const r = recipients();
      U.clear(count).appendChild(h("div", null, [
        h("span", { class: "label", text: "Recipients in this audience" }),
        h("span", { class: "value", text: r.length }),
        h("span", { class: "foot", text: "Estimated cost " + fmt.mmk(r.length * 25) + " at 25 MMK per message" })
      ]));
    }
    aud.addEventListener("change", refresh);
    tpl.addEventListener("change", () => {
      const t = S.db.templates.find((x) => x.id === tpl.value);
      if (t) { bodyText.value = t.body; ch.value = t.channel === "SMTP" ? "Email" : t.channel; }
    });
    refresh();

    function render(sample) {
      const t = S.get.tariff(sample.tariff);
      return bodyText.value
        .replace(/\{name\}/g, sample.name)
        .replace(/\{plan\}/g, t.name)
        .replace(/\{expiry\}/g, fmt.date(sample.expiry))
        .replace(/\{amount\}/g, fmt.money(t.price))
        .replace(/\{zone\}/g, sample.zone)
        .replace(/\{date\}/g, fmt.date(S.db.meta.now + 2 * day));
    }

    function run(testMode) {
      const r = recipients();
      if (!bodyText.value.trim()) { toast("Nothing to send", "Write a message or pick a template", "bad"); return; }
      const shown = r.slice(0, testMode ? 5 : 12);
      S.actions.sendCampaign(testMode ? "Test run" : "Manual send", AUDIENCES.find((a) => a.id === aud.value).label, ch.value, r, testMode);
      U.clear(results).appendChild(h("div", { class: "card" }, [
        h("header", null, [
          h("h3", { text: testMode ? "Test pass — nothing left the building" : "Sent to " + r.length + " subscribers" }),
          pill(testMode ? "test" : "live", testMode ? "warn" : "online")
        ]),
        table([
          { label: "Subscriber", cell: (c) => c.name },
          { label: "To", cell: (c) => h("span", { class: "num", text: ch.value === "Email" ? c.email : c.phone }) },
          { label: "Rendered message", cell: (c) => h("span", { class: "hint", text: render(c) }) },
          { label: "Result", cell: () => testMode ? pill("preview", "idle") : pill("delivered", "online") }
        ], shown),
        h("p", { class: "hint", text: testMode ? "Check the placeholders above. If a {token} is still showing, the template does not match this audience." : "Delivery receipts arrive from the gateway within a minute and are written to the campaign record." })
      ]));
    }

    return h("div", { class: "stack" }, [
      h("div", { class: "split" }, [
        h("div", { class: "card stack" }, [
          h("header", null, h("h3", { text: "Compose" })),
          field("Audience", aud),
          h("div", { class: "grid g2" }, [field("Channel", ch), field("Start from a template", tpl)]),
          field("Message", bodyText, "Keep SMS under 160 characters or it bills as two."),
          h("div", { class: "row" }, [
            h("button", { class: "btn", onclick: () => run(true) }, "Run test pass"),
            h("button", { class: "btn primary", onclick: () => confirmSend(recipients().length, () => run(false)) }, "Send for real")
          ])
        ]),
        count
      ]),
      results
    ]);
  }

  function confirmSend(n, go) {
    modal({
      title: "Send to " + n + " subscribers?",
      body: [h("p", { text: "This delivers immediately through the live gateway and cannot be recalled." }),
      h("p", { class: "hint", text: "Subscribers who opted out of marketing are excluded automatically. Service notices always go out." })],
      actions: [{ label: "Cancel" }, { label: "Send now", tone: "primary", onClick: go }]
    });
  }

  function templates() {
    const S = TF.store;
    return h("div", { class: "stack" }, [
      h("div", { class: "card" }, [
        h("header", null, [h("h3", { text: "Lifecycle templates" }), h("span", { class: "hint", text: "Fired by the scheduler, not by a person" })]),
        table([
          { label: "Template", cell: (t) => t.name },
          { label: "Channel", cell: (t) => pill(t.channel, "info") },
          { label: "Body", cell: (t) => h("span", { class: "hint", text: t.body }) }
        ], S.db.templates)
      ]),
      h("div", { class: "card" }, [
        h("header", null, h("h3", { text: "Automation rules" })),
        table([
          { label: "Trigger", cell: (r) => r.trigger },
          { label: "Template", cell: (r) => r.tpl },
          { label: "Channel", cell: (r) => r.ch },
          { label: "State", cell: (r) => pill(r.on ? "on" : "off", r.on ? "online" : "idle") }
        ], [
          { trigger: "Service activated", tpl: "Welcome / service activated", ch: "SMS", on: true },
          { trigger: "3 days before expiry", tpl: "Expiry reminder — 3 days", ch: "SMS", on: true },
          { trigger: "Expiry day, 09:00", tpl: "Expiry today", ch: "SMS", on: true },
          { trigger: "Payment reconciled", tpl: "Payment received", ch: "SMS", on: true },
          { trigger: "Technician dispatched", tpl: "Technician on the way", ch: "SMS", on: true },
          { trigger: "Planned maintenance published", tpl: "Planned maintenance", ch: "Viber", on: false }
        ])
      ])
    ]);
  }

  function history() {
    const S = TF.store;
    return h("div", { class: "card" }, [
      h("header", null, h("h3", { text: "Campaigns" })),
      table([
        { label: "Campaign", cell: (c) => c.name },
        { label: "Audience", cell: (c) => c.audience },
        { label: "Channel", cell: (c) => c.channel },
        { label: "Sent", right: true, cell: (c) => h("span", { class: "num", text: c.sent }) },
        { label: "Delivered", right: true, cell: (c) => h("span", { class: "num", text: c.delivered }) },
        { label: "Failed", right: true, cell: (c) => h("span", { class: "num", style: c.failed ? "color:var(--warn)" : null, text: c.failed }) },
        { label: "When", right: true, cell: (c) => fmt.dateTime(c.at) },
        { label: "Mode", cell: (c) => c.testMode ? pill("test", "idle") : pill("live", "online") }
      ], S.db.campaigns)
    ]);
  }
})(window.TF = window.TF || {});
