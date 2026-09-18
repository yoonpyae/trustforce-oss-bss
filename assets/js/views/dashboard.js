(function (TF) {
  "use strict";
  const { h, fmt, pill, table, lineChart, donut } = TF.ui;

  function kpi(label, value, foot, tone) {
    return h("div", { class: "card kpi" }, [
      h("span", { class: "label", text: label }),
      h("span", { class: "value", text: value, style: tone ? "color:" + tone : null }),
      h("span", { class: "foot", text: foot })
    ]);
  }

  TF.views.dashboard = {
    title: "Operations overview",
    subtitle: "Everything the duty manager needs before the morning stand-up: who is online, what is broken, and what is unpaid.",
    render() {
      const S = TF.store, m = S.metrics(), db = S.db;
      const wrap = h("div", { class: "stack" });

      wrap.appendChild(h("div", { class: "grid g4" }, [
        kpi("Subscribers", fmt.money(m.subscribers), m.active + " active · " + (m.subscribers - m.active) + " not billable"),
        kpi("Online right now", fmt.money(m.online), m.offline + " sessions down", m.offline > m.online * 0.12 ? "var(--warn)" : null),
        kpi("Monthly recurring", fmt.money(m.mrr), "MMK from active plans"),
        kpi("Unpaid", fmt.money(m.overdueValue), m.overdueCount + " overdue invoices", m.overdueCount ? "var(--bad)" : null)
      ]));

      /* revenue + network health */
      const rev = S.revenueSeries(12);
      const revCard = h("div", { class: "card" }, [
        h("header", null, [
          h("h3", { text: "Collections, last 12 cycles" }),
          h("span", { class: "hint", text: "Collection efficiency " + fmt.pct(m.collection) })
        ]),
        lineChart([{ points: rev.map((r) => r.value), color: "var(--cyan)" }], {
          labels: rev.map((r) => r.label), height: 190,
          fmtY: (v) => (v / 1000000).toFixed(1) + "M"
        })
      ]);

      const sessionSplit = donut([
        { value: m.online, color: "var(--good)" },
        { value: m.offline, color: "var(--bad)" },
        { value: m.subscribers - m.active, color: "var(--idle)" }
      ], { center: fmt.pct((m.online / Math.max(1, m.active)) * 100), sub: "sessions up" });

      const health = h("div", { class: "card" }, [
        h("header", null, h("h3", { text: "Access network" })),
        h("div", { class: "row", style: "gap:18px;align-items:center" }, [
          sessionSplit,
          h("div", { class: "stack", style: "gap:8px;flex:1;min-width:150px" }, [
            row("Online", m.online, "var(--good)"),
            row("Down", m.offline, "var(--bad)"),
            row("Not billable", m.subscribers - m.active, "var(--idle)"),
            h("div", { class: "hint", text: m.weakOptics + " ONUs below the −25 dBm optical threshold" })
          ])
        ])
      ]);

      wrap.appendChild(h("div", { class: "split" }, [revCard, health]));

      /* fibre plant capacity */
      const fill = (m.snPortsUsed / m.snPortsTotal) * 100;
      wrap.appendChild(h("div", { class: "grid g4" }, [
        h("div", { class: "card stack" }, [
          h("h3", { text: "Fibre plant" }),
          h("div", { class: "metric-strip" }, [
            metric("OLT", m.olts), metric("DN 1:4", m.dns), metric("SN 1:16", m.sns), metric("ONU", m.onus)
          ]),
          h("div", null, [
            h("div", { class: "row", style: "justify-content:space-between" }, [
              h("span", { class: "hint", text: "Splitter ports used" }),
              h("span", { class: "hint num", text: m.snPortsUsed + " / " + m.snPortsTotal })
            ]),
            h("div", { class: "bar-track" }, h("div", { class: "bar-fill", style: "width:" + fill + "%" }))
          ])
        ]),
        h("div", { class: "card kpi" }, [
          h("span", { class: "label", text: "Active alarms" }),
          h("span", { class: "value", text: m.alarms, style: m.critical ? "color:var(--bad)" : null }),
          h("span", { class: "foot", text: m.critical + " critical · " + (m.alarms - m.critical) + " lower" })
        ]),
        h("div", { class: "card kpi" }, [
          h("span", { class: "label", text: "Open tickets" }),
          h("span", { class: "value", text: m.openTickets }),
          h("span", { class: "foot", text: db.tickets.filter((t) => t.priority === "urgent" && t.status !== "resolved").length + " urgent in the queue" })
        ]),
        h("div", { class: "card kpi" }, [
          h("span", { class: "label", text: "Expiring in 7 days" }),
          h("span", { class: "value", text: m.expiring }),
          h("span", { class: "foot", text: "Reminder run scheduled 09:00 daily" })
        ])
      ]));

      /* three working lists */
      const expiring = db.customers
        .filter((c) => c.expiry > db.meta.now && c.expiry < db.meta.now + 7 * 86400000)
        .sort((a, b) => a.expiry - b.expiry).slice(0, 7);

      wrap.appendChild(h("div", { class: "grid g2" }, [
        h("div", { class: "card" }, [
          h("header", null, [h("h3", { text: "Renewals due this week" }), link("Billing", "#/billing")]),
          table([
            { label: "Subscriber", cell: (c) => c.name },
            { label: "Plan", cell: (c) => S.get.tariff(c.tariff).name },
            { label: "Expires", cell: (c) => h("span", { class: "num", text: fmt.days(c.expiry) + "d · " + fmt.date(c.expiry) }) },
            { label: "Amount", right: true, cell: (c) => h("span", { class: "num", text: fmt.money(S.get.tariff(c.tariff).price) }) }
          ], expiring, { onRow: (c) => TF.openCustomer(c.id) })
        ]),
        h("div", { class: "card" }, [
          h("header", null, [h("h3", { text: "Alarms needing a decision" }), link("Alarms", "#/alarms")]),
          table([
            { label: "Object", cell: (a) => h("span", { class: "num", text: a.object }) },
            { label: "Event", cell: (a) => a.label },
            { label: "Severity", cell: (a) => pill(a.severity, a.severity) },
            { label: "Raised", right: true, cell: (a) => fmt.ago(a.raised) }
          ], db.alarms.filter((a) => a.state === "active").slice(0, 7), { onRow: (a) => TF.go("alarms") })
        ])
      ]));

      const weak = S.weakPoints().slice(0, 5);
      wrap.appendChild(h("div", { class: "card" }, [
        h("header", null, [
          h("h3", { text: "Weak points worth fixing before they become outages" }),
          link("Impact analysis", "#/topology")
        ]),
        table([
          { label: "Type", cell: (w) => w.type },
          { label: "Object", cell: (w) => h("a", { href: "#/topology", class: "num", onclick: () => TF.traceTo(w.object) }, w.object) },
          { label: "Finding", cell: (w) => w.detail },
          { label: "Severity", cell: (w) => pill(w.severity, w.severity) },
          { label: "Subscribers exposed", right: true, cell: (w) => h("span", { class: "num", text: w.customers }) }
        ], weak)
      ]));

      return wrap;
    }
  };

  function row(label, value, color) {
    return h("div", { class: "row", style: "justify-content:space-between" }, [
      h("span", null, [h("i", { style: "display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:7px;background:" + color }), label]),
      h("b", { class: "num", text: value })
    ]);
  }
  function metric(label, value) {
    return h("div", null, [h("span", { text: label }), h("b", { class: "num", text: value })]);
  }
  function link(text, href) {
    return h("a", { href, class: "hint" }, text);
  }
})(window.TF = window.TF || {});
