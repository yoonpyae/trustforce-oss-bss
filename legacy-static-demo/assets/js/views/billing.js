(function (TF) {
  "use strict";
  const U = TF.ui;
  const { h, fmt, pill, table, tabs, modal, toast, select, input, field } = U;
  const day = 86400000;
  const bf = { status: "", q: "" };

  TF.views.billing = {
    title: "Billing & finance",
    subtitle: "Anniversary cycles, pro-rated upgrades, QR reconciliation and vouchers. A settled payment re-authorises the session without anyone touching the router.",
    render() {
      return tabs([
        { id: "inv", label: "Invoices", render: invoices },
        { id: "pay", label: "Payments", render: payments },
        { id: "vou", label: "Vouchers", render: vouchers },
        { id: "gw", label: "Payment gateways", render: gateways }
      ]);
    }
  };

  function invoices() {
    const S = TF.store, db = S.db;
    const wrap = h("div", { class: "stack" });
    const body = h("div");
    wrap.appendChild(h("div", { class: "toolbar" }, [
      input({ class: "grow", placeholder: "Invoice number or subscriber…", oninput: (e) => { bf.q = e.target.value.toLowerCase(); paint(); } }),
      select([{ value: "", label: "Any status" }, { value: "paid", label: "Paid" }, { value: "pending", label: "Pending" }, { value: "overdue", label: "Overdue" }], { onchange: (e) => { bf.status = e.target.value; paint(); } }),
      h("button", { class: "btn", onclick: prorationTool }, "Proration calculator"),
      h("button", { class: "btn primary", onclick: collectDialog }, "Take a payment")
    ]));
    wrap.appendChild(body);

    function rows() {
      return db.invoices.filter((i) =>
        (!bf.status || i.status === bf.status) &&
        (!bf.q || i.id.toLowerCase().includes(bf.q) || i.customerName.toLowerCase().includes(bf.q))
      );
    }

    function paint() {
      const list = rows();
      const m = S.metrics();
      U.clear(body);
      body.appendChild(h("div", { class: "grid g4" }, [
        stat("Billed, 30 days", fmt.money(m.billed30)),
        stat("Collected, 30 days", fmt.money(m.collected30)),
        stat("Collection efficiency", fmt.pct(m.collection), m.collection > 90 ? "var(--good)" : "var(--warn)"),
        stat("Overdue", fmt.money(m.overdueValue), m.overdueValue ? "var(--bad)" : null)
      ]));
      body.appendChild(h("div", { class: "card" }, [
        h("header", null, [h("h3", { text: "Invoices" }), h("div", { style: "flex:1" }),
        h("button", { class: "btn sm", onclick: () => U.csv("invoices.csv", icols, list.slice(0, 500)) }, "Export CSV")]),
        table(icols.concat([{
          label: "", right: true, cell: (i) => i.status === "paid" ? h("span", { class: "hint", text: "settled" })
            : h("button", { class: "btn sm primary", onclick: (e) => { e.stopPropagation(); settle(i); } }, "Settle")
        }]), list.slice(0, 60), { onRow: (i) => TF.openCustomer(i.customer) }),
        h("div", { class: "hint", style: "margin-top:8px", text: "Showing " + Math.min(60, list.length) + " of " + list.length + " invoices." })
      ]));
    }

    function settle(inv) {
      const sel = select(["KBZPay QR", "WavePay QR", "Cash at counter", "Bank transfer", "Wallet balance"].map((m) => ({ value: m, label: m })));
      modal({
        title: "Settle " + inv.id,
        body: [
          h("p", null, `${inv.customerName} · ${fmt.mmk(inv.amount + inv.tax)} including tax.`),
          field("Method", sel),
          h("p", { class: "hint", text: "Settling triggers a CoA re-authorisation, so the session comes back without a truck roll or a router login." })
        ],
        actions: [{ label: "Cancel" }, {
          label: "Record payment", tone: "primary", onClick: () => {
            inv.status = "paid"; inv.method = sel.value;
            S.db.payments.unshift({ kind: "PAYMENT", id: "PMT-" + (43000 + S.db.payments.length), invoice: inv.id, customer: inv.customer, customerName: inv.customerName, amount: inv.amount + inv.tax, method: sel.value, at: S.db.meta.now, reconciled: true });
            S.actions.coa(inv.customer, "reconnect");
            S.log("Payment recorded", inv.id, sel.value + " · " + fmt.mmk(inv.amount + inv.tax));
            toast("Payment recorded", inv.id + " settled · session re-authorised", "good");
            paint();
          }
        }]
      });
    }

    paint();
    return wrap;
  }

  const icols = [
    { label: "Invoice", cell: (i) => h("span", { class: "num", text: i.id }) },
    { label: "Subscriber", cell: (i) => i.customerName },
    { label: "Period", cell: (i) => h("span", { class: "hint num", text: i.period }) },
    { label: "Amount", right: true, cell: (i) => h("span", { class: "num", text: fmt.money(i.amount + i.tax) }), raw: (i) => i.amount + i.tax },
    { label: "Status", cell: (i) => pill(i.status, i.status), raw: (i) => i.status },
    { label: "Method", cell: (i) => i.method || "—" },
    { label: "Issued", right: true, cell: (i) => fmt.date(i.issued), raw: (i) => fmt.iso(i.issued) }
  ];

  function payments() {
    const S = TF.store;
    const byMethod = {};
    S.db.payments.filter((p) => p.at > S.db.meta.now - 30 * day).forEach((p) => byMethod[p.method] = (byMethod[p.method] || 0) + p.amount);
    const items = Object.keys(byMethod).map((k) => ({ label: k.split(" ")[0], value: byMethod[k] }));
    return h("div", { class: "stack" }, [
      h("div", { class: "card" }, [
        h("header", null, [h("h3", { text: "Collected by method, last 30 days" })]),
        items.length ? U.barChart(items, { height: 190, fmtY: (v) => (v / 1000000).toFixed(1) + "M" }) : h("div", { class: "empty", text: "No payment in the window." })
      ]),
      h("div", { class: "card" }, [
        h("header", null, [h("h3", { text: "Payment ledger" }), h("div", { style: "flex:1" }),
        h("button", { class: "btn sm", onclick: () => U.csv("payments.csv", pcols, S.db.payments.slice(0, 500)) }, "Export CSV")]),
        table(pcols, S.db.payments.slice(0, 40), { onRow: (p) => TF.openCustomer(p.customer) })
      ])
    ]);
  }
  const pcols = [
    { label: "Receipt", cell: (p) => h("span", { class: "num", text: p.id }) },
    { label: "Subscriber", cell: (p) => p.customerName },
    { label: "Invoice", cell: (p) => h("span", { class: "num", text: p.invoice }) },
    { label: "Method", cell: (p) => p.method },
    { label: "Amount", right: true, cell: (p) => h("span", { class: "num", text: fmt.money(p.amount) }), raw: (p) => p.amount },
    { label: "Received", right: true, cell: (p) => fmt.dateTime(p.at), raw: (p) => fmt.iso(p.at) },
    { label: "Reconciled", cell: (p) => p.reconciled ? pill("matched", "paid") : pill("unmatched", "warn") }
  ];

  function vouchers() {
    const S = TF.store;
    const body = h("div");
    function paint() {
      const v = S.db.vouchers;
      U.clear(body);
      body.appendChild(h("div", { class: "grid g4" }, [
        stat("Unused", v.filter((x) => x.status === "unused").length),
        stat("Redeemed", v.filter((x) => x.status === "used").length),
        stat("Face value in stock", fmt.money(v.filter((x) => x.status === "unused").reduce((a, x) => a + x.value, 0))),
        stat("Batches", Array.from(new Set(v.map((x) => x.batch))).length)
      ]));
      body.appendChild(h("div", { class: "card" }, [
        h("header", null, [h("h3", { text: "Voucher stock" }), h("div", { style: "flex:1" }),
        h("button", { class: "btn sm", onclick: () => redeem(paint) }, "Redeem a code"),
        h("button", { class: "btn sm primary", onclick: () => generate(paint) }, "Generate batch")]),
        table([
          { label: "Code", cell: (x) => h("span", { class: "num", text: x.id }) },
          { label: "Value", right: true, cell: (x) => h("span", { class: "num", text: fmt.money(x.value) }) },
          { label: "Batch", cell: (x) => x.batch },
          { label: "Status", cell: (x) => pill(x.status, x.status === "unused" ? "info" : "paid") },
          { label: "Redeemed by", cell: (x) => x.usedBy || "—" },
          { label: "When", right: true, cell: (x) => x.usedAt ? fmt.date(x.usedAt) : "—" }
        ], v.slice(0, 40)),
        h("p", { class: "hint", style: "margin-top:8px", text: "Codes carry face value, so printing and exporting them is restricted to the cashier role and every action is written to the audit trail." })
      ]));
    }
    paint();
    return body;
  }

  function generate(after) {
    const count = input({ type: "number", value: 20, min: 1, max: 200 });
    const value = select([5000, 10000, 20000, 30000, 50000].map((v) => ({ value: v, label: fmt.mmk(v) })));
    const batch = input({ value: "BATCH-2026-04" });
    modal({
      title: "Generate voucher batch",
      body: [field("How many", count), field("Face value", value), field("Batch reference", batch)],
      actions: [{ label: "Cancel" }, {
        label: "Generate", tone: "primary", onClick: () => {
          const made = TF.store.actions.generateVouchers(Number(count.value), Number(value.value), batch.value);
          toast("Batch generated", made.length + " codes created in " + batch.value, "good");
          after();
        }
      }]
    });
  }

  function redeem(after) {
    const S = TF.store;
    const code = input({ placeholder: "TF-123456-789" });
    const cust = select(S.db.customers.slice(0, 200).map((c) => ({ value: c.id, label: c.name + " · " + c.id })));
    modal({
      title: "Redeem voucher",
      body: [field("Code", code), field("Credit to", cust)],
      actions: [{ label: "Cancel" }, {
        label: "Redeem", tone: "primary", onClick: () => {
          const r = S.actions.redeemVoucher(code.value, cust.value);
          if (!r.ok) { toast("Cannot redeem", r.msg, "bad"); return true; }
          toast("Voucher redeemed", fmt.mmk(r.voucher.value) + " added to the wallet", "good");
          after();
        }
      }]
    });
  }

  function gateways() {
    const gws = [
      { name: "KBZPay", mode: "Dynamic QR", state: "connected", matched: "98.2%", note: "Callback matched against invoice reference" },
      { name: "WavePay", mode: "Dynamic QR", state: "connected", matched: "96.5%", note: "Callback matched against invoice reference" },
      { name: "AYA Pay", mode: "Static QR", state: "sandbox", matched: "—", note: "Awaiting merchant approval" },
      { name: "Bank transfer (CB, KBZ)", mode: "Statement import", state: "manual", matched: "82.0%", note: "Daily CSV import, cashier confirms the remainder" }
    ];
    return h("div", { class: "stack" }, [
      h("div", { class: "card" }, [
        h("header", null, h("h3", { text: "Connected providers" })),
        table([
          { label: "Provider", cell: (g) => g.name },
          { label: "Mode", cell: (g) => g.mode },
          { label: "State", cell: (g) => pill(g.state, g.state === "connected" ? "online" : g.state === "sandbox" ? "warn" : "idle") },
          { label: "Auto-match rate", right: true, cell: (g) => h("span", { class: "num", text: g.matched }) },
          { label: "Note", cell: (g) => h("span", { class: "hint", text: g.note }) }
        ], gws)
      ]),
      h("div", { class: "card" }, [
        h("header", null, h("h3", { text: "Reconciliation flow" })),
        h("p", { text: "A subscriber scans the QR shown on the invoice. The provider posts a callback carrying the invoice reference. The matcher settles the invoice, extends the anniversary date and fires a CoA request to the BNG, so the session comes back inside a few seconds without a cashier in the loop." }),
        h("p", { class: "hint", text: "Anything that cannot be matched automatically lands in an exceptions queue for the cashier, and is never silently dropped." })
      ])
    ]);
  }

  function collectDialog() {
    const S = TF.store;
    const cust = select(S.db.customers.slice(0, 300).map((c) => ({ value: c.id, label: c.name + " · " + c.id })));
    modal({
      title: "Take a payment",
      body: [field("Subscriber", cust), h("p", { class: "hint", text: "Opens the recharge flow with the subscriber's current plan preselected." })],
      actions: [{ label: "Cancel" }, { label: "Continue", tone: "primary", onClick: () => TF.rechargeDialog(cust.value) }]
    });
  }

  function prorationTool() {
    const S = TF.store;
    const from = select(S.db.tariffs.map((t) => ({ value: t.id, label: t.name + " — " + fmt.mmk(t.price) })));
    const to = select(S.db.tariffs.map((t) => ({ value: t.id, label: t.name + " — " + fmt.mmk(t.price), selected: t.id === "TP-104" })));
    const days = input({ type: "number", value: 12, min: 0, max: 30 });
    const out = h("div", { class: "card kpi" });
    function calc() {
      const a = S.get.tariff(from.value), b = S.get.tariff(to.value);
      const d = Number(days.value);
      const credit = Math.round((a.price / 30) * d);
      const charge = Math.round((b.price / 30) * d);
      U.clear(out).appendChild(h("div", null, [
        h("span", { class: "label", text: "Adjustment on today's invoice" }),
        h("span", { class: "value", style: "font-size:26px", text: fmt.money(charge - credit) + " MMK" }),
        h("span", { class: "foot", text: `Unused ${a.name}: −${fmt.money(credit)} · new ${b.name} for ${d} days: +${fmt.money(charge)}` })
      ]));
    }
    [from, to, days].forEach((el) => el.addEventListener("input", calc));
    [from, to].forEach((el) => el.addEventListener("change", calc));
    calc();
    modal({
      title: "Proration calculator",
      body: [field("Current plan", from), field("New plan", to), field("Days remaining in the cycle", days), out],
      actions: [{ label: "Close", tone: "primary" }]
    });
  }

  function stat(label, value, color) {
    return h("div", { class: "card kpi" }, [h("span", { class: "label", text: label }), h("span", { class: "value", style: "font-size:24px" + (color ? ";color:" + color : ""), text: value })]);
  }
})(window.TF = window.TF || {});
