(function (TF) {
  "use strict";
  const U = TF.ui;
  const { h, fmt, pill, table, modal, drawer, toast, field, input, select, tabs, lineChart } = U;

  const filters = { q: "", status: "", zone: "", service: "", page: 0 };
  const PER = 25;

  TF.views.subscribers = {
    title: "Subscribers",
    subtitle: "One record per service. Identity, plan, RADIUS credentials, fibre position and support history live together — the 360° view support staff need while the customer is still on the phone.",
    render() {
      const S = TF.store, db = S.db;
      const wrap = h("div", { class: "stack" });

      const zones = Array.from(new Set(db.customers.map((c) => c.zone))).sort();
      const q = input({ class: "grow", placeholder: "Name, ID, phone, PPPoE login or IP…", value: filters.q, oninput: (e) => { filters.q = e.target.value; filters.page = 0; paint(); } });
      const st = select([{ value: "", label: "Any status" }].concat(["active", "grace", "suspended", "expired"].map((s) => ({ value: s, label: s, selected: filters.status === s }))), { onchange: (e) => { filters.status = e.target.value; filters.page = 0; paint(); } });
      const zn = select([{ value: "", label: "Any zone" }].concat(zones.map((z) => ({ value: z, label: z, selected: filters.zone === z }))), { onchange: (e) => { filters.zone = e.target.value; filters.page = 0; paint(); } });
      const sv = select([{ value: "", label: "Any service" }].concat(["PPPoE", "Static IP", "Hotspot"].map((s) => ({ value: s, label: s, selected: filters.service === s }))), { onchange: (e) => { filters.service = e.target.value; filters.page = 0; paint(); } });

      const body = h("div");
      wrap.appendChild(h("div", { class: "toolbar" }, [
        q, st, zn, sv,
        h("button", { class: "btn", onclick: exportCsv }, "Export CSV"),
        h("button", { class: "btn primary", onclick: newSubscriber }, "New subscriber")
      ]));
      wrap.appendChild(body);

      function matches() {
        const needle = filters.q.toLowerCase();
        return db.customers.filter((c) =>
          (!filters.status || c.status === filters.status) &&
          (!filters.zone || c.zone === filters.zone) &&
          (!filters.service || c.service === filters.service) &&
          (!needle || c.name.toLowerCase().includes(needle) || c.id.toLowerCase().includes(needle) ||
            c.phone.includes(needle) || c.login.includes(needle) || c.ip.includes(needle))
        );
      }

      function paint() {
        const rows = matches();
        const page = rows.slice(filters.page * PER, filters.page * PER + PER);
        U.clear(body);
        body.appendChild(h("div", { class: "card" }, [
          table([
            { label: "Subscriber", cell: (c) => h("div", null, [h("div", { text: c.name }), h("div", { class: "hint num", text: c.id + " · " + c.login })]) },
            { label: "Plan", cell: (c) => S.get.tariff(c.tariff).name },
            { label: "Status", cell: (c) => pill(c.status, c.status === "active" ? "active" : c.status === "grace" ? "grace" : c.status === "expired" ? "expired" : "suspended") },
            { label: "Session", cell: (c) => { const s = S.get.session(c.id); return s && s.online ? pill("online", "online") : pill("offline", "offline"); } },
            { label: "Optical", cell: (c) => { const o = S.get.onuOfCustomer(c.id); const g = U.opticalGrade(o ? o.rx : null); return h("span", { class: "num", style: "color:" + g.color, text: o ? fmt.dbm(o.rx) : "—" }); } },
            { label: "Fibre path", cell: (c) => h("span", { class: "hint num", text: c.olt + " › " + c.dn + " › " + c.sn + ":" + c.snPort }) },
            { label: "Expires", right: true, cell: (c) => h("span", { class: "num", style: c.expiry < db.meta.now ? "color:var(--bad)" : null, text: fmt.date(c.expiry) }) }
          ], page, { onRow: (c) => open(c.id), empty: "No subscriber matches those filters. Clear one and try again." }),
          h("div", { class: "row", style: "justify-content:space-between;margin-top:10px" }, [
            h("span", { class: "hint", text: rows.length ? `${filters.page * PER + 1}–${Math.min(rows.length, (filters.page + 1) * PER)} of ${rows.length}` : "0 results" }),
            h("div", { class: "row" }, [
              h("button", { class: "btn sm", disabled: filters.page === 0, onclick: () => { filters.page--; paint(); } }, "Previous"),
              h("button", { class: "btn sm", disabled: (filters.page + 1) * PER >= rows.length, onclick: () => { filters.page++; paint(); } }, "Next")
            ])
          ])
        ]));
      }

      function exportCsv() {
        U.csv("trustforce-subscribers.csv", [
          { label: "ID", cell: (c) => c.id }, { label: "Name", cell: (c) => c.name },
          { label: "Phone", cell: (c) => c.phone }, { label: "Plan", cell: (c) => S.get.tariff(c.tariff).name },
          { label: "Status", cell: (c) => c.status }, { label: "Zone", cell: (c) => c.zone },
          { label: "OLT", cell: (c) => c.olt }, { label: "SN", cell: (c) => c.sn + ":" + c.snPort },
          { label: "Expiry", cell: (c) => fmt.iso(c.expiry) }
        ], matches());
      }

      paint();
      return wrap;
    }
  };

  /* ---------------- detail drawer ---------------- */
  function open(id) {
    const S = TF.store, c = S.get.customer(id);
    if (!c) return;
    const onu = S.get.onuOfCustomer(id);
    const t = S.get.tariff(c.tariff);
    const bw = S.get.bandwidth(t.bw);
    const sess = S.get.session(id);

    const content = tabs([
      { id: "overview", label: "Overview", render: () => overview(c, t, bw, onu, sess) },
      { id: "billing", label: "Billing", render: () => billing(c) },
      { id: "network", label: "Network & optical", render: () => network(c, onu, sess) },
      { id: "tickets", label: "Support", render: () => support(c) }
    ]);

    drawer(c.name, `${c.id} · ${c.segment} · ${c.zone} · installed ${fmt.date(c.installed)}`, content, [
      h("button", { class: "btn primary sm", onclick: () => rechargeDialog(c.id) }, "Recharge"),
      h("button", { class: "btn sm", onclick: () => { S.actions.syncRadius(c.id); toast("Pushed to FreeRADIUS", "Credentials and rate-limit synced to " + c.nas, "good"); } }, "Sync RADIUS")
    ]);
  }
  TF.openCustomer = open;

  function defn(pairs) {
    const dl = h("dl", { class: "defn" });
    pairs.forEach((p) => { if (!p) return; dl.appendChild(h("dt", { text: p[0] })); dl.appendChild(h("dd", null, typeof p[1] === "object" ? p[1] : String(p[1]))); });
    return dl;
  }

  function overview(c, t, bw, onu, sess) {
    const S = TF.store;
    const days = fmt.days(c.expiry);
    return h("div", { class: "stack" }, [
      h("div", { class: "grid g3" }, [
        stat("Plan", t.name, `${bw.down}/${bw.up} Mbps · ${fmt.mmk(t.price)}`),
        stat("Service state", c.status, days >= 0 ? days + " days remaining" : Math.abs(days) + " days overdue", days < 0 ? "var(--bad)" : days < 4 ? "var(--warn)" : "var(--good)"),
        stat("Session", sess && sess.online ? "online" : "offline", sess && sess.online ? fmt.uptime(sess.uptimeS) + " uptime" : "last seen " + fmt.ago(onu ? onu.lastSeen : c.installed), sess && sess.online ? "var(--good)" : "var(--bad)")
      ]),
      h("div", { class: "split" }, [
        h("div", { class: "card" }, [
          h("header", null, h("h3", { text: "Account" })),
          defn([
            ["Contact", c.phone + " · " + c.email],
            ["Address", c.address],
            ["Coordinates", h("span", { class: "num", text: c.lat.toFixed(5) + ", " + c.lng.toFixed(5) })],
            ["Billing", c.billing + " · " + c.contract + (c.autoRenew ? " · auto-renew on" : " · manual renewal")],
            ["Wallet balance", h("span", { class: "num", text: fmt.mmk(c.balance) })],
            ["Next expiry", fmt.dateTime(c.expiry)]
          ])
        ]),
        h("div", { class: "card stack" }, [
          h("h3", { text: "Quick actions" }),
          h("button", { class: "btn", onclick: () => rechargeDialog(c.id) }, "Recharge / renew"),
          h("button", { class: "btn", onclick: () => topUpDialog(c.id) }, "Add wallet balance"),
          h("button", { class: "btn", onclick: () => planDialog(c.id) }, "Change plan"),
          h("button", { class: "btn", onclick: () => graceDialog(c.id) }, "Grant grace period"),
          h("button", { class: "btn danger", onclick: () => { TF.store.actions.coa(c.id, "disconnect"); toast("CoA sent", "Packet-of-Disconnect delivered to " + c.nas); U.closeOverlays(); } }, "Disconnect session (CoA)")
        ])
      ]),
      h("div", { class: "card" }, [
        h("header", null, [h("h3", { text: "Fibre path" }), h("span", { class: "hint", text: "Customer → ONU → SN → DN → fibre → OLT" })]),
        TF.traceStrip(S.tracePath(c.id))
      ])
    ]);
  }

  function billing(c) {
    const S = TF.store;
    const inv = S.get.invoicesOf(c.id);
    const pay = S.get.paymentsOf(c.id);
    return h("div", { class: "stack" }, [
      h("div", { class: "grid g3" }, [
        stat("Lifetime paid", fmt.money(pay.reduce((a, p) => a + p.amount, 0)), pay.length + " payments"),
        stat("Open balance", fmt.money(inv.filter((i) => i.status !== "paid").reduce((a, i) => a + i.amount + i.tax, 0)), inv.filter((i) => i.status !== "paid").length + " unpaid invoices"),
        stat("Wallet", fmt.money(c.balance), "available for renewal")
      ]),
      h("div", { class: "card" }, [
        h("header", null, [h("h3", { text: "Invoices" }), h("button", { class: "btn sm", onclick: () => rechargeDialog(c.id) }, "Take payment")]),
        table([
          { label: "Invoice", cell: (i) => h("span", { class: "num", text: i.id }) },
          { label: "Period", cell: (i) => h("span", { class: "hint num", text: i.period }) },
          { label: "Amount", right: true, cell: (i) => h("span", { class: "num", text: fmt.money(i.amount + i.tax) }) },
          { label: "Status", cell: (i) => pill(i.status, i.status) },
          { label: "Method", cell: (i) => i.method || "—" },
          { label: "Issued", right: true, cell: (i) => fmt.date(i.issued) }
        ], inv.slice(0, 12), { empty: "No invoice raised yet." })
      ])
    ]);
  }

  function network(c, onu, sess) {
    const S = TF.store;
    const t = S.get.tariff(c.tariff), bw = S.get.bandwidth(t.bw);
    const hist = onu ? S.opticalHistory(onu.id, 30) : null;
    const grade = U.opticalGrade(onu ? onu.rx : null);
    return h("div", { class: "stack" }, [
      h("div", { class: "split" }, [
        h("div", { class: "card" }, [
          h("header", null, h("h3", { text: "Access & authentication" })),
          defn([
            ["PPPoE login", h("span", { class: "num", text: c.login })],
            ["Secret", h("span", { class: "num", text: c.secret + "  (hidden by role)" })],
            ["Framed IP", h("span", { class: "num", text: c.ip })],
            ["IP pool", c.pool],
            ["NAS / BNG", c.nas + " · " + S.get.nas(c.nas).vendor],
            ["Rate limit", `${bw.down}M/${bw.up}M · burst ${bw.burst} · priority ${bw.priority}`],
            ["FUP", t.fup ? t.fup + " GB then throttled" : "unlimited"],
            ["Live throughput", sess && sess.online ? h("span", { class: "num", text: sess.rxMbps + " ↓ / " + sess.txMbps + " ↑ Mbps" }) : "session down"]
          ])
        ]),
        h("div", { class: "card" }, [
          h("header", null, h("h3", { text: "ONU" })),
          onu ? defn([
            ["Device", onu.vendor + " " + onu.model],
            ["Serial", h("span", { class: "num", text: onu.serial })],
            ["MAC", h("span", { class: "num", text: onu.mac })],
            ["Firmware", onu.firmware],
            ["Distance from OLT", h("span", { class: "num", text: onu.distance + " m" })],
            ["Temperature", h("span", { class: "num", text: onu.temperature + " °C · " + onu.voltage + " V" })],
            ["CPU / memory", h("span", { class: "num", text: onu.cpu + "% / " + onu.mem + "%" })],
            ["Wi-Fi SSID", onu.wifiSsid]
          ]) : h("div", { class: "empty", text: "No ONU bound to this service." })
        ])
      ]),
      onu ? h("div", { class: "card" }, [
        h("header", null, [
          h("h3", { text: "Optical power, last 30 days" }),
          h("span", { class: "pill " + grade.key, text: grade.label }),
          h("div", { style: "flex:1" }),
          h("button", { class: "btn sm", onclick: () => { S.actions.rebootOnu(onu.id); toast("Reboot issued", onu.id + " will re-register in about 60 seconds"); } }, "Reboot ONU")
        ]),
        h("div", { class: "metric-strip", style: "margin-bottom:10px" }, [
          m2("ONU RX", fmt.dbm(onu.rx)), m2("ONU TX", fmt.dbm(onu.tx)),
          m2("OLT-side RX", fmt.dbm(onu.oltRx)), m2("Budget margin", (28 + onu.rx).toFixed(1) + " dB")
        ]),
        lineChart([{ points: hist.points, color: grade.color }], {
          labels: hist.labels, height: 170, max: -8, min: -30,
          fmtY: (v) => v.toFixed(0)
        }),
        h("p", { class: "hint", text: onu.rx < -25 ? "Level has drifted below the design budget. Check the drop cable and the SN connector before dispatching a splice team." : "Stable within the design budget for this splitter stage." })
      ]) : null,
      h("div", { class: "card" }, [
        h("header", null, h("h3", { text: "Topology path" })),
        TF.traceStrip(S.tracePath(c.id))
      ])
    ]);
  }

  function support(c) {
    const S = TF.store;
    const tk = S.get.ticketsOf(c.id);
    const al = S.db.alarms.filter((a) => a.customer === c.id);
    return h("div", { class: "stack" }, [
      h("div", { class: "card" }, [
        h("header", null, h("h3", { text: "Tickets" })),
        table([
          { label: "Ticket", cell: (t) => h("span", { class: "num", text: t.id }) },
          { label: "Subject", cell: (t) => t.subject },
          { label: "Status", cell: (t) => pill(t.status, t.status === "resolved" ? "resolved" : t.status === "open" ? "warn" : "info") },
          { label: "Technician", cell: (t) => t.tech || "unassigned" },
          { label: "Opened", right: true, cell: (t) => fmt.ago(t.created) }
        ], tk, { empty: "This subscriber has never raised a ticket." })
      ]),
      h("div", { class: "card" }, [
        h("header", null, h("h3", { text: "Alarm history" })),
        table([
          { label: "Event", cell: (a) => a.label },
          { label: "Severity", cell: (a) => pill(a.severity, a.severity) },
          { label: "Raised", cell: (a) => fmt.dateTime(a.raised) },
          { label: "State", cell: (a) => a.state }
        ], al, { empty: "No alarm has ever been raised against this service." })
      ])
    ]);
  }

  function stat(label, value, foot, color) {
    return h("div", { class: "card kpi" }, [
      h("span", { class: "label", text: label }),
      h("span", { class: "value", text: value, style: (color ? "color:" + color + ";" : "") + "font-size:22px" }),
      h("span", { class: "foot", text: foot })
    ]);
  }
  function m2(label, value) { return h("div", null, [h("span", { text: label }), h("b", { text: value })]); }

  /* ---------------- dialogs ---------------- */
  function rechargeDialog(id) {
    const S = TF.store, c = S.get.customer(id);
    const planSel = select(S.db.tariffs.map((t) => ({ value: t.id, label: `${t.name} — ${fmt.mmk(t.price)} / ${t.days}d`, selected: t.id === c.tariff })));
    const methodSel = select(["KBZPay QR", "WavePay QR", "Cash at counter", "Bank transfer", "Wallet balance"].map((m) => ({ value: m, label: m })));
    const preview = h("p", { class: "hint" });
    function updatePreview() {
      const t = S.get.tariff(planSel.value);
      const base = c.expiry > S.db.meta.now ? c.expiry : S.db.meta.now;
      preview.textContent = `New expiry ${fmt.date(base + t.days * 86400000)} · total ${fmt.mmk(t.price + Math.round(t.price * 0.05))} including 5% commercial tax.`;
    }
    planSel.addEventListener("change", updatePreview);
    updatePreview();

    modal({
      title: "Recharge " + c.name,
      body: [
        field("Plan", planSel),
        field("Payment method", methodSel, "Wallet balance available: " + fmt.mmk(c.balance)),
        preview
      ],
      actions: [
        { label: "Cancel" },
        {
          label: "Take payment", tone: "primary", onClick: () => {
            const inv = S.actions.recharge(c.id, { tariff: planSel.value, method: methodSel.value });
            toast("Payment recorded", inv.id + " · service active to " + fmt.date(c.expiry), "good");
            open(c.id);
          }
        }
      ]
    });
  }
  TF.rechargeDialog = rechargeDialog;

  function topUpDialog(id) {
    const S = TF.store, c = S.get.customer(id);
    const amt = input({ type: "number", value: 10000, min: 1000, step: 1000 });
    const note = input({ placeholder: "Reference or receipt number" });
    modal({
      title: "Add balance — " + c.name,
      body: [field("Amount (MMK)", amt), field("Note", note), h("p", { class: "hint", text: "Wallet balance is not internet service. It is spent when the next renewal is taken." })],
      actions: [{ label: "Cancel" }, {
        label: "Add balance", tone: "primary", onClick: () => {
          S.actions.addBalance(c.id, Number(amt.value), note.value);
          toast("Balance added", fmt.mmk(Number(amt.value)) + " · new wallet " + fmt.mmk(c.balance), "good");
          open(c.id);
        }
      }]
    });
  }

  function planDialog(id) {
    const S = TF.store, c = S.get.customer(id);
    const sel = select(S.db.tariffs.map((t) => ({ value: t.id, label: t.name + " — " + fmt.mmk(t.price), selected: t.id === c.tariff })));
    const pro = input({ type: "checkbox", checked: true });
    const out = h("p", { class: "hint" });
    function calc() {
      const from = S.get.tariff(c.tariff), to = S.get.tariff(sel.value);
      const days = Math.max(0, fmt.days(c.expiry));
      const delta = Math.round(((to.price - from.price) / 30) * days);
      out.textContent = `${days} days left on the current cycle. Pro-rated adjustment: ${delta >= 0 ? "charge" : "credit"} ${fmt.mmk(Math.abs(delta))}.`;
    }
    sel.addEventListener("change", calc); calc();
    modal({
      title: "Change plan — " + c.name,
      body: [field("New plan", sel), h("label", { class: "row" }, [pro, h("span", { text: "Apply pro-rated adjustment" })]), out],
      actions: [{ label: "Cancel" }, {
        label: "Change plan", tone: "primary", onClick: () => {
          const d = S.actions.changePlan(c.id, sel.value, pro.checked);
          toast("Plan changed", "Rate limit pushed to " + c.nas + (pro.checked ? " · adjustment " + fmt.mmk(d) : ""), "good");
          open(c.id);
        }
      }]
    });
  }

  function graceDialog(id) {
    const S = TF.store, c = S.get.customer(id);
    const sel = select([1, 2, 3, 4, 5].map((d) => ({ value: d, label: d + " day" + (d > 1 ? "s" : "") })));
    modal({
      title: "Grace period — " + c.name,
      body: [field("Extend by", sel), h("p", { class: "hint", text: "Grace keeps the session up without payment. It is logged against your account and visible in the audit trail." })],
      actions: [{ label: "Cancel" }, {
        label: "Grant grace", tone: "primary", onClick: () => {
          S.actions.grace(c.id, Number(sel.value));
          toast("Grace granted", c.name + " stays online until " + fmt.date(c.expiry), "good");
          open(c.id);
        }
      }]
    });
  }

  function newSubscriber() {
    const S = TF.store;
    const name = input({ placeholder: "Full name or company" });
    const phone = input({ placeholder: "09…" });
    const zoneSel = select(Array.from(new Set(S.db.customers.map((c) => c.zone))).sort().map((z) => ({ value: z, label: z })));
    const planSel = select(S.db.tariffs.map((t) => ({ value: t.id, label: t.name + " — " + fmt.mmk(t.price) })));
    const free = [];
    S.db.sns.forEach((sn) => sn.ports.filter((p) => p.state !== "used").forEach((p) => free.push({ sn: sn.id, port: p.port, zone: sn.zone })));
    const portSel = select(free.slice(0, 60).map((f) => ({ value: f.sn + ":" + f.port, label: `${f.sn} port ${f.port} · ${f.zone}` })));

    modal({
      title: "New subscriber",
      body: [
        field("Name", name),
        field("Phone", phone),
        field("Zone", zoneSel),
        field("Plan", planSel),
        field("Splitter port", portSel, "Only free and reserved 1:16 ports are offered, so two installers cannot book the same port.")
      ],
      actions: [{ label: "Cancel" }, {
        label: "Create subscriber", tone: "primary", onClick: (body) => {
          if (!name.value.trim()) { toast("Name is required", "Enter the subscriber or company name", "bad"); return true; }
          const [snId, port] = portSel.value.split(":");
          const sn = S.get.sn(snId);
          const t = S.get.tariff(planSel.value);
          const seq = S.db.customers.length + 1;
          const id = "CUS-" + String(9000 + seq);
          const c = {
            kind: "CUSTOMER", id, name: name.value.trim(), segment: t.segment,
            phone: phone.value || "09000000000", email: "new" + seq + "@example.mm",
            address: "To be surveyed, " + sn.zone, zone: sn.zone,
            lat: sn.lat, lng: sn.lng, service: t.service, tariff: t.id, billing: t.cycle,
            status: "active", balance: 0, login: "res" + (9000 + seq), secret: "••••••••",
            ip: "10.20.9." + (seq % 250), pool: t.pool, nas: S.get.olt(sn.olt).nas,
            onu: null, sn: sn.id, snPort: Number(port), dn: sn.dn, olt: sn.olt, oltPort: sn.oltPort,
            installed: S.db.meta.now, activated: S.db.meta.now,
            expiry: S.db.meta.now + t.days * 86400000, lastInvoice: null,
            autoRenew: true, contract: "monthly", notes: "Created from the demo UI"
          };
          const p = sn.ports.find((x) => x.port === Number(port));
          p.state = "used"; p.customer = id;
          S.actions.addCustomer(c);
          toast("Subscriber created", id + " booked on " + snId + " port " + port, "good");
          open(id);
        }
      }]
    });
  }
})(window.TF = window.TF || {});
