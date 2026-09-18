(function (TF) {
  "use strict";
  const U = TF.ui;
  const { h, fmt, pill, table, tabs, lineChart, barChart, toast, select, input } = U;
  const day = 86400000;

  TF.views.reports = {
    title: "Reports",
    subtitle: "The numbers management asks for, with the filter and the export sitting next to them so nobody has to rebuild them in a spreadsheet.",
    render() {
      return tabs([
        { id: "rev", label: "Revenue", render: revenue },
        { id: "act", label: "Activations", render: activations },
        { id: "churn", label: "Churn & retention", render: churn },
        { id: "field", label: "Field performance", render: field }
      ]);
    }
  };

  function revenue() {
    const S = TF.store;
    const rev = S.revenueSeries(12);
    const byPlan = {};
    S.db.customers.filter((c) => c.status === "active").forEach((c) => {
      const t = S.get.tariff(c.tariff);
      byPlan[t.name] = (byPlan[t.name] || 0) + t.price;
    });
    const planRows = Object.keys(byPlan).map((k) => ({ plan: k, value: byPlan[k] })).sort((a, b) => b.value - a.value);
    const m = S.metrics();

    return h("div", { class: "stack" }, [
      h("div", { class: "grid g4" }, [
        box("Monthly recurring", fmt.money(m.mrr)),
        box("Collected, 30 days", fmt.money(m.collected30)),
        box("Collection efficiency", fmt.pct(m.collection), m.collection > 90 ? "var(--good)" : "var(--warn)"),
        box("Average revenue per user", fmt.money(m.mrr / Math.max(1, m.active)))
      ]),
      h("div", { class: "card" }, [
        h("header", null, h("h3", { text: "Collections by cycle" })),
        lineChart([{ points: rev.map((r) => r.value), color: "var(--cyan)" }], { labels: rev.map((r) => r.label), height: 200, fmtY: (v) => (v / 1000000).toFixed(1) + "M" })
      ]),
      h("div", { class: "split" }, [
        h("div", { class: "card" }, [
          h("header", null, [h("h3", { text: "Recurring revenue by plan" }), h("div", { style: "flex:1" }),
          h("button", { class: "btn sm", onclick: () => U.csv("revenue-by-plan.csv", pcols, planRows) }, "Export CSV")]),
          table(pcols, planRows)
        ]),
        h("div", { class: "card" }, [
          h("header", null, h("h3", { text: "Payment mix, 30 days" })),
          mixChart()
        ])
      ])
    ]);
  }
  const pcols = [
    { label: "Plan", cell: (r) => r.plan },
    { label: "Monthly value", right: true, cell: (r) => h("span", { class: "num", text: fmt.money(r.value) }), raw: (r) => r.value }
  ];

  function mixChart() {
    const S = TF.store;
    const by = {};
    S.db.payments.filter((p) => p.at > S.db.meta.now - 30 * day).forEach((p) => by[p.method] = (by[p.method] || 0) + p.amount);
    const keys = Object.keys(by);
    if (!keys.length) return h("div", { class: "empty", text: "No payment in the last 30 days." });
    const colors = ["var(--cyan)", "var(--good)", "var(--violet)", "var(--warn)", "var(--cyan-deep)"];
    const total = keys.reduce((a, k) => a + by[k], 0);
    return h("div", { class: "row", style: "gap:18px;align-items:center" }, [
      U.donut(keys.map((k, i) => ({ value: by[k], color: colors[i % colors.length] })), { center: fmt.money(Math.round(total / 1000000)) + "M", sub: "MMK" }),
      h("div", { class: "stack", style: "gap:6px;flex:1" }, keys.map((k, i) => h("div", { class: "row", style: "justify-content:space-between" }, [
        h("span", null, [h("i", { style: "display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:7px;background:" + colors[i % colors.length] }), k]),
        h("b", { class: "num", text: fmt.pct((by[k] / total) * 100) })
      ])))
    ]);
  }

  function activations() {
    const S = TF.store;
    const from = input({ type: "date", value: fmt.iso(S.db.meta.now - 90 * day) });
    const to = input({ type: "date", value: fmt.iso(S.db.meta.now) });
    const body = h("div");
    function rows() {
      const a = new Date(from.value).getTime(), b = new Date(to.value).getTime() + day;
      return S.db.customers.filter((c) => c.installed >= a && c.installed <= b).sort((x, y) => y.installed - x.installed);
    }
    function paint() {
      const list = rows();
      const byMonth = {};
      list.forEach((c) => {
        const k = new Date(c.installed).toLocaleString("en", { month: "short" });
        byMonth[k] = (byMonth[k] || 0) + 1;
      });
      U.clear(body);
      body.appendChild(h("div", { class: "grid g4" }, [
        box("Activations in range", list.length),
        box("Business", list.filter((c) => c.segment === "business").length),
        box("Contract value added", fmt.money(list.reduce((a, c) => a + S.get.tariff(c.tariff).price, 0))),
        box("Zones touched", Array.from(new Set(list.map((c) => c.zone))).length)
      ]));
      const keys = Object.keys(byMonth);
      if (keys.length) body.appendChild(h("div", { class: "card" }, [
        h("header", null, h("h3", { text: "Activations by month" })),
        barChart(keys.map((k) => ({ label: k, value: byMonth[k] })), { height: 180 })
      ]));
      body.appendChild(h("div", { class: "card" }, [
        h("header", null, [h("h3", { text: "Activation register" }), h("div", { style: "flex:1" }),
        h("button", { class: "btn sm", onclick: () => U.csv("activations.csv", acols, list) }, "Export CSV")]),
        table(acols, list.slice(0, 40), { onRow: (c) => TF.openCustomer(c.id) })
      ]));
    }
    [from, to].forEach((i) => i.addEventListener("change", paint));
    paint();
    return h("div", { class: "stack" }, [
      h("div", { class: "toolbar" }, [h("span", { class: "hint", text: "From" }), from, h("span", { class: "hint", text: "to" }), to,
      h("span", { class: "hint", text: "No 30-day ceiling: the range is yours to choose." })]),
      body
    ]);
  }
  const acols = [
    { label: "Subscriber", cell: (c) => c.name },
    { label: "ID", cell: (c) => h("span", { class: "num", text: c.id }) },
    { label: "Plan", cell: (c) => TF.store.get.tariff(c.tariff).name },
    { label: "Zone", cell: (c) => c.zone },
    { label: "Splitter", cell: (c) => h("span", { class: "hint num", text: c.sn + ":" + c.snPort }) },
    { label: "Activated", right: true, cell: (c) => fmt.date(c.installed), raw: (c) => fmt.iso(c.installed) }
  ];

  function churn() {
    const S = TF.store;
    const growth = S.subscriberGrowth(12);
    const lost = S.db.customers.filter((c) => c.status === "expired" || c.status === "suspended");
    const atRisk = S.db.customers.filter((c) => {
      const onu = S.get.onuOfCustomer(c.id);
      const tk = S.get.ticketsOf(c.id).length;
      return c.status === "active" && ((onu && onu.rx < -25) || tk >= 2);
    });
    return h("div", { class: "stack" }, [
      h("div", { class: "grid g4" }, [
        box("Subscribers", S.db.customers.length),
        box("Lost or suspended", lost.length, "var(--bad)"),
        box("Churn rate", fmt.pct((lost.length / S.db.customers.length) * 100)),
        box("At risk", atRisk.length, "var(--warn)")
      ]),
      h("div", { class: "card" }, [
        h("header", null, h("h3", { text: "Subscriber base over 12 cycles" })),
        lineChart([{ points: growth.map((g) => g.value), color: "var(--good)" }], { labels: growth.map((g) => g.label), height: 190 })
      ]),
      h("div", { class: "card" }, [
        h("header", null, [h("h3", { text: "At-risk accounts — poor optics or repeat tickets" }), h("div", { style: "flex:1" }),
        h("button", { class: "btn sm", onclick: () => U.csv("at-risk.csv", rcols, atRisk) }, "Export CSV")]),
        table(rcols, atRisk.slice(0, 25), { onRow: (c) => TF.openCustomer(c.id), empty: "Nobody is flagged at risk today." })
      ])
    ]);
  }
  const rcols = [
    { label: "Subscriber", cell: (c) => c.name },
    { label: "Plan", cell: (c) => TF.store.get.tariff(c.tariff).name },
    { label: "Optical", cell: (c) => { const o = TF.store.get.onuOfCustomer(c.id); return o ? h("span", { class: "num", style: "color:" + U.opticalGrade(o.rx).color, text: fmt.dbm(o.rx) }) : "—"; }, raw: (c) => { const o = TF.store.get.onuOfCustomer(c.id); return o ? o.rx : ""; } },
    { label: "Tickets", right: true, cell: (c) => TF.store.get.ticketsOf(c.id).length },
    { label: "Since", right: true, cell: (c) => fmt.date(c.installed), raw: (c) => fmt.iso(c.installed) }
  ];

  function field() {
    const S = TF.store;
    const resolved = S.db.tickets.filter((t) => t.status === "resolved");
    const mttrH = resolved.length ? resolved.reduce((a, t) => a + (t.updated - t.created) / 3600000, 0) / resolved.length : 0;
    const byTech = {};
    S.db.tickets.filter((t) => t.tech).forEach((t) => {
      byTech[t.tech] = byTech[t.tech] || { tech: t.tech, total: 0, done: 0, hours: 0 };
      byTech[t.tech].total++;
      if (t.status === "resolved") { byTech[t.tech].done++; byTech[t.tech].hours += (t.updated - t.created) / 3600000; }
    });
    const rows = Object.keys(byTech).map((k) => byTech[k]);
    return h("div", { class: "stack" }, [
      h("div", { class: "grid g4" }, [
        box("Mean time to repair", mttrH.toFixed(1) + " h"),
        box("Resolved", resolved.length, "var(--good)"),
        box("Still open", S.db.tickets.length - resolved.length),
        box("Past SLA", S.db.tickets.filter((t) => t.status !== "resolved" && t.sla < S.db.meta.now).length, "var(--warn)")
      ]),
      h("div", { class: "card" }, [
        h("header", null, h("h3", { text: "By technician" })),
        table([
          { label: "Technician", cell: (r) => r.tech },
          { label: "Assigned", right: true, cell: (r) => r.total },
          { label: "Resolved", right: true, cell: (r) => r.done },
          { label: "Average repair time", right: true, cell: (r) => h("span", { class: "num", text: r.done ? (r.hours / r.done).toFixed(1) + " h" : "—" }) },
          {
            label: "Completion", cell: (r) => h("div", { style: "min-width:120px" }, h("div", { class: "bar-track" },
              h("div", { class: "bar-fill", style: "width:" + (r.total ? (r.done / r.total) * 100 : 0) + "%" })))
          }
        ], rows, { empty: "No dispatch recorded yet." })
      ]),
      h("div", { class: "card" }, [
        h("header", null, h("h3", { text: "Ticket mix" })),
        barChart(Object.entries(S.db.tickets.reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + 1; return acc; }, {}))
          .map(([label, value]) => ({ label, value })), { height: 170 })
      ])
    ]);
  }

  function box(label, value, color) {
    return h("div", { class: "card kpi" }, [h("span", { class: "label", text: label }), h("span", { class: "value", style: "font-size:24px" + (color ? ";color:" + color : ""), text: value })]);
  }
})(window.TF = window.TF || {});
