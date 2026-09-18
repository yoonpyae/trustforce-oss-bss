(function (TF) {
  "use strict";
  const U = TF.ui;
  const { h, fmt, pill, table, drawer, modal, toast, tabs, lineChart, select, input, field } = U;

  /* Shared: the OLT → … → customer strip used everywhere an object is shown */
  TF.traceStrip = function (chain, activeId) {
    const strip = h("div", { class: "trace" });
    chain.forEach((n, i) => {
      if (i) strip.appendChild(h("div", { class: "trace-link" }));
      strip.appendChild(h("div", {
        class: "trace-node" + (n.id === activeId ? " hot" : ""),
        title: "Open " + n.id,
        onclick: () => TF.traceTo(n.id)
      }, [
        h("small", { text: n.kind }),
        h("b", { text: n.id }),
        h("em", { text: n.label })
      ]));
    });
    return strip;
  };

  /* Route any object id to the right screen */
  TF.traceTo = function (id) {
    const S = TF.store;
    U.closeOverlays();
    if (S.get.customer(id)) return TF.openCustomer(id);
    if (S.get.onu(id)) return TF.openCustomer(S.get.onu(id).customer);
    if (S.get.sn(id)) return openSn(id);
    if (S.get.dn(id)) return openDn(id);
    if (S.get.olt(id)) return openOlt(id);
    if (S.get.fiber(id)) return openFiber(id);
    if (id.indexOf("/S") > 0) {
      const dn = S.db.dns.find((d) => d.oltPort === id);
      if (dn) return openDn(dn.id);
      return openOlt(id.split("/")[0]);
    }
    toast("Nothing to open", id + " is not a managed object", "bad");
  };

  /* ---------------- main view ---------------- */
  TF.views.odn = {
    title: "Fibre plant",
    subtitle: "OLT, distribution node, service node and ONU are managed objects, not spreadsheet rows. Every one carries inventory, live state, optical readings, alarms and its own history.",
    render() {
      return tabs([
        { id: "olt", label: "OLT", render: oltTab },
        { id: "dn", label: "Distribution nodes (1:4)", render: dnTab },
        { id: "sn", label: "Service nodes (1:16)", render: snTab },
        { id: "optical", label: "Optical monitoring", render: opticalTab }
      ]);
    }
  };

  /* ---------------- OLT ---------------- */
  function oltTab() {
    const S = TF.store;
    const wrap = h("div", { class: "grid g3" });
    S.db.olts.forEach((o) => {
      const subs = S.get.customersOfOlt(o.id).length;
      const live = o.ports.filter((p) => p.oper === "up").length;
      const faults = S.db.alarms.filter((a) => a.state === "active" && (a.object === o.id || a.path[0] === o.id)).length;
      wrap.appendChild(h("div", { class: "card stack", style: "cursor:pointer", onclick: () => openOlt(o.id) }, [
        h("div", { class: "row" }, [
          h("div", null, [h("h3", { text: o.name }), h("div", { class: "hint num", text: o.id + " · " + o.vendor + " " + o.model })]),
          h("div", { style: "flex:1" }),
          pill(o.operStatus === "up" ? "up" : "degraded", o.operStatus === "up" ? "online" : "warn")
        ]),
        h("div", { class: "metric-strip" }, [
          mm("Subscribers", subs), mm("PON up", live + "/" + o.ports.length),
          mm("Temp", o.temperature + "°C"), mm("Alarms", faults)
        ]),
        h("div", null, [
          h("div", { class: "hint", text: "Chassis load " + o.load + "%" }),
          h("div", { class: "bar-track" }, h("div", { class: "bar-fill", style: "width:" + o.load + "%" }))
        ]),
        o.powerB === "failed" ? h("div", { class: "hint", style: "color:var(--bad)", text: "Power supply B failed — single feed only" }) : null
      ]));
    });
    return wrap;
  }

  function openOlt(id) {
    const S = TF.store, o = S.get.olt(id);
    if (!o) return;
    drawer(o.name, `${o.id} · ${o.vendor} ${o.model} · ${o.site}`, tabs([
      {
        id: "ov", label: "Overview", render: () => h("div", { class: "stack" }, [
          h("div", { class: "grid g4" }, [
            kpiBox("Subscribers", S.get.customersOfOlt(id).length),
            kpiBox("Distribution nodes", S.get.dnsOfOlt(id).length),
            kpiBox("ONUs registered", S.db.onus.filter((u) => u.olt === id).length),
            kpiBox("Uptime since reboot", Math.round((S.db.meta.now - o.lastReboot) / 86400000) + " d")
          ]),
          h("div", { class: "card" }, [h("header", null, h("h3", { text: "Identity" })), defn([
            ["Management IP", mono(o.ip)], ["Serial", mono(o.serial)],
            ["Firmware", o.firmware], ["Hardware", o.hardware],
            ["Site / zone", o.site + " · " + o.zone],
            ["Upstream BNG", o.nas + " (" + S.get.nas(o.nas).vendor + ")"],
            ["Installed", fmt.date(o.installed)], ["Last reboot", fmt.dateTime(o.lastReboot)],
            ["Admin / operational", o.adminStatus + " / " + o.operStatus]
          ])])
        ])
      },
      {
        id: "hw", label: "Hardware", render: () => h("div", { class: "stack" }, [
          h("div", { class: "grid g4" }, [
            kpiBox("Temperature", o.temperature + " °C", o.temperature > 44 ? "var(--warn)" : null),
            kpiBox("Fan", o.fan), kpiBox("PSU A", o.powerA, "var(--good)"),
            kpiBox("PSU B", o.powerB, o.powerB === "failed" ? "var(--bad)" : "var(--good)")
          ]),
          h("div", { class: "card" }, [
            h("header", null, h("h3", { text: "Cards" })),
            table([
              { label: "Slot", cell: (s) => mono("Slot " + s.slot) },
              { label: "Board", cell: (s) => s.board },
              { label: "Serial", cell: (s) => mono(s.serial) },
              { label: "Ports", cell: (s) => s.ports },
              { label: "State", cell: (s) => pill(s.state, s.state === "normal" ? "online" : "warn") },
              { label: "Temp", right: true, cell: (s) => mono(s.temp + " °C") }
            ], boards(o))
          ])
        ])
      },
      { id: "ports", label: "Ports & topology", render: () => portsPanel(o) },
      {
        id: "alarms", label: "Alarms", render: () => h("div", { class: "card" }, table([
          { label: "Event", cell: (a) => a.label },
          { label: "Object", cell: (a) => mono(a.object) },
          { label: "Severity", cell: (a) => pill(a.severity, a.severity) },
          { label: "Raised", cell: (a) => fmt.dateTime(a.raised) },
          { label: "State", cell: (a) => a.state }
        ], S.db.alarms.filter((a) => a.path[0] === o.id || a.object === o.id).slice(0, 25), { empty: "No alarm recorded against this chassis." }))
      },
      { id: "hist", label: "History", render: () => historyPanel(o.id) }
    ]), [
      h("button", { class: "btn sm", onclick: () => TF.go("topology") }, "Open in topology")
    ]);
  }

  function boards(o) {
    const out = [];
    for (let s = 1; s <= (o.model.indexOf("X7") > 0 ? 2 : 1); s++) {
      out.push({ slot: s, board: o.vendor === "Huawei" ? "GPBD 8-port GPON" : "GTGH 8-port GPON", serial: o.serial + "-B" + s, ports: 8, state: "normal", temp: o.temperature - 3 + s });
    }
    out.push({ slot: "CTRL", board: "Control & switching", serial: o.serial + "-C0", ports: "2×10G", state: o.operStatus === "up" ? "normal" : "degraded", temp: o.temperature });
    return out;
  }

  function portsPanel(o) {
    const S = TF.store;
    const box = h("div", { class: "stack" });
    const detail = h("div");
    box.appendChild(h("div", { class: "card" }, [
      h("header", null, [h("h3", { text: "Slot → port" }), h("span", { class: "hint", text: "Select a PON port to reveal the fibre route and everything downstream" })]),
      h("div", { class: "port-grid" }, o.ports.map((p) => h("div", {
        class: "port " + (p.oper === "up" ? (p.onuCount ? "online" : "free") : "free"),
        onclick: () => showPort(p)
      }, [
        h("div", { class: "p-no", text: "Slot " + p.slot + " / PON " + p.port }),
        h("div", { class: "p-id", text: p.dn ? p.dn : "not connected" }),
        h("div", { class: "p-rx num", text: p.onuCount + " ONU · " + p.tx + " Mbps ↓" })
      ])))
    ]));
    box.appendChild(detail);

    function showPort(p) {
      U.clear(detail);
      if (!p.dn) {
        detail.appendChild(h("div", { class: "card empty", text: "Port " + p.id + " has no fibre terminated. Assign a feeder route to bring it into service." }));
        return;
      }
      const dn = S.get.dn(p.dn);
      const snList = S.get.snsOfDn(dn.id);
      const im = S.impactOf(dn.id);
      detail.appendChild(h("div", { class: "card stack" }, [
        h("header", null, [h("h3", { text: p.id + " → " + dn.id }), h("div", { style: "flex:1" }),
        h("button", { class: "btn sm", onclick: () => openDn(dn.id) }, "Open node"),
        h("button", { class: "btn sm " + (p.admin === "enabled" ? "danger" : ""), onclick: () => { S.actions.setPonPort(o.id, p.id, p.admin === "enabled" ? "disabled" : "enabled"); toast("Port " + (p.admin === "enabled" ? "enabled" : "disabled"), p.id + " · logged for audit"); showPort(p); } }, p.admin === "enabled" ? "Disable port" : "Enable port")]),
        h("div", { class: "metric-strip" }, [
          mm("Fibre", dn.fiber), mm("Split", dn.ratio), mm("Service nodes", snList.length),
          mm("Subscribers", im.customers.length), mm("Port TX", fmt.dbm(p.txPower))
        ]),
        TF.traceStrip([
          { kind: "OLT", id: o.id, label: o.vendor },
          { kind: "PON port", id: p.id, label: "GPON" },
          { kind: "Fibre", id: dn.fiber, label: S.get.fiber(dn.fiber).lengthM + " m" },
          { kind: "DN 1:4", id: dn.id, label: dn.zone }
        ], p.id),
        table([
          { label: "Service node", cell: (s) => mono(s.id) },
          { label: "Zone", cell: (s) => s.zone },
          { label: "Ports used", cell: (s) => s.ports.filter((x) => x.state === "used").length + " / 16" },
          { label: "Weak optics", cell: (s) => S.db.onus.filter((u) => u.sn === s.id && u.rx < -25).length },
          { label: "", right: true, cell: (s) => h("button", { class: "btn sm", onclick: (e) => { e.stopPropagation(); openSn(s.id); } }, "16-port view") }
        ], snList)
      ]));
    }
    return box;
  }

  /* ---------------- DN ---------------- */
  function dnTab() {
    const S = TF.store;
    return h("div", { class: "card" }, table([
      { label: "Node", cell: (d) => mono(d.id) },
      { label: "Name", cell: (d) => d.name },
      { label: "Fed from", cell: (d) => mono(d.oltPort) },
      { label: "Outputs used", cell: (d) => d.outputs.filter((o) => o.state === "used").length + " / 4" },
      { label: "Service nodes", cell: (d) => S.get.snsOfDn(d.id).length },
      { label: "Subscribers", cell: (d) => S.get.customersOfDn(d.id).length },
      { label: "Condition", cell: (d) => pill(d.condition, d.condition === "good" ? "online" : "warn") },
      { label: "Last inspected", right: true, cell: (d) => fmt.date(d.inspected) }
    ], S.db.dns, { onRow: (d) => openDn(d.id) }));
  }

  function openDn(id) {
    const S = TF.store, d = S.get.dn(id);
    const im = S.impactOf(id);
    drawer(d.name, `${d.id} · 1:4 splitter · ${d.zone}`, h("div", { class: "stack" }, [
      h("div", { class: "grid g4" }, [
        kpiBox("Subscribers behind this node", im.customers.length),
        kpiBox("Service nodes", im.sns.length),
        kpiBox("Insertion loss", d.insertionLoss.toFixed(1) + " dB"),
        kpiBox("Monthly revenue at risk", fmt.money(im.revenue))
      ]),
      h("div", { class: "card" }, [h("header", null, h("h3", { text: "Object record" })), defn([
        ["Zone", d.zone], ["GPS", mono(d.lat.toFixed(5) + ", " + d.lng.toFixed(5))],
        ["Fed by", mono(d.oltPort + " via " + d.fiber)],
        ["Installed", fmt.date(d.installed)], ["Last inspection", fmt.date(d.inspected)],
        ["Condition", d.condition], ["Photo on file", d.photo ? "yes" : "no"],
        ["Comment", d.comment || "—"]
      ])]),
      h("div", { class: "card" }, [
        h("header", null, [h("h3", { text: "Output ports" }), h("span", { class: "hint", text: "1 in → 4 out, each output a managed relationship" })]),
        h("div", { class: "port-grid" }, d.outputs.map((o) => {
          const sn = o.sn ? S.get.sn(o.sn) : null;
          const used = sn ? sn.ports.filter((p) => p.state === "used").length : 0;
          return h("div", { class: "port " + (sn ? "online" : o.state === "reserved" ? "degraded" : "free"), onclick: () => sn && openSn(sn.id) }, [
            h("div", { class: "p-no", text: "Output " + o.port }),
            h("div", { class: "p-id", text: sn ? sn.id : o.state }),
            h("div", { class: "p-rx", text: sn ? used + "/16 customers" : "available" })
          ]);
        }))
      ]),
      h("div", { class: "card" }, [h("header", null, h("h3", { text: "Upstream path" })), TF.traceStrip(S.tracePath(id), id)]),
      historyPanel(id)
    ]), [
      h("button", { class: "btn sm", onclick: () => TF.impactDialog(id) }, "Impact analysis")
    ]);
  }

  /* ---------------- SN ---------------- */
  function snTab() {
    const S = TF.store;
    return h("div", { class: "card" }, table([
      { label: "Node", cell: (s) => mono(s.id) },
      { label: "Zone", cell: (s) => s.zone },
      { label: "Parent", cell: (s) => mono(s.dn + " / out " + s.dnPort) },
      { label: "Ports used", cell: (s) => { const u = s.ports.filter((p) => p.state === "used").length; return h("div", { style: "min-width:110px" }, [h("div", { class: "hint num", text: u + " / 16" }), h("div", { class: "bar-track" }, h("div", { class: "bar-fill", style: "width:" + (u / 16) * 100 + "%" }))]); } },
      { label: "Offline ONU", cell: (s) => S.db.onus.filter((o) => o.sn === s.id && !o.online).length },
      { label: "Below budget", cell: (s) => { const n = S.db.onus.filter((o) => o.sn === s.id && o.rx < -25).length; return h("span", { style: n ? "color:var(--warn)" : null, text: n }); } },
      { label: "Loss", right: true, cell: (s) => mono(s.insertionLoss.toFixed(1) + " dB") }
    ], S.db.sns, { onRow: (s) => openSn(s.id) }));
  }

  function openSn(id) {
    const S = TF.store, sn = S.get.sn(id);
    const rows = sn.ports.map((p) => {
      const c = p.customer ? S.get.customer(p.customer) : null;
      const o = c ? S.get.onuOfCustomer(c.id) : null;
      return { p, c, o };
    });
    const grid = h("div", { class: "port-grid" }, rows.map((r) => {
      const g = r.o ? U.opticalGrade(r.o.rx) : { key: "free", color: "var(--idle)" };
      const cls = !r.c ? "free" : !r.o.online ? "offline" : g.key;
      return h("div", { class: "port " + cls, onclick: () => r.c ? TF.openCustomer(r.c.id) : toast("Free port", "Port " + r.p.port + " is " + r.p.state + " and can be booked for a new install") }, [
        h("div", { class: "p-no", text: "Port " + String(r.p.port).padStart(2, "0") }),
        h("div", { class: "p-id", text: r.c ? r.c.name : r.p.state }),
        h("div", { class: "p-rx", style: "color:" + (r.o ? g.color : "var(--text-mute)"), text: r.o ? fmt.dbm(r.o.rx) + " · " + (r.o.online ? "online" : "offline") : "—" })
      ]);
    }));

    drawer(sn.name, `${sn.id} · 1:16 splitter · ${sn.zone} · fed from ${sn.dn} output ${sn.dnPort}`, h("div", { class: "stack" }, [
      h("div", { class: "grid g4" }, [
        kpiBox("Customers", rows.filter((r) => r.c).length),
        kpiBox("Online", rows.filter((r) => r.o && r.o.online).length),
        kpiBox("Free ports", rows.filter((r) => !r.c).length),
        kpiBox("Worst RX", fmt.dbm(Math.min.apply(null, rows.filter((r) => r.o).map((r) => r.o.rx))))
      ]),
      h("div", { class: "card" }, [
        h("header", null, [h("h3", { text: "16-port customer view" }),
        h("div", { class: "legend" }, [
          lg("var(--good)", "good"), lg("var(--warn)", "marginal"), lg("var(--bad)", "offline / out of budget"), lg("var(--line)", "free")
        ])]),
        grid
      ]),
      h("div", { class: "card" }, [
        h("header", null, [h("h3", { text: "Port detail" }),
        h("button", { class: "btn sm", onclick: () => exportSn(sn, rows) }, "Export CSV")]),
        table([
          { label: "Port", cell: (r) => mono(String(r.p.port).padStart(2, "0")) },
          { label: "Customer", cell: (r) => r.c ? r.c.name : h("span", { class: "hint", text: r.p.state }) },
          { label: "ONU", cell: (r) => r.o ? mono(r.o.id) : "—" },
          { label: "Serial", cell: (r) => r.o ? mono(r.o.serial) : "—" },
          { label: "ONU RX", cell: (r) => r.o ? h("span", { class: "num", style: "color:" + U.opticalGrade(r.o.rx).color, text: fmt.dbm(r.o.rx) }) : "—" },
          { label: "OLT RX", cell: (r) => r.o ? mono(fmt.dbm(r.o.oltRx)) : "—" },
          { label: "Status", cell: (r) => r.o ? pill(r.o.online ? "online" : "offline", r.o.online ? "online" : "offline") : h("span", { class: "hint", text: "—" }) }
        ], rows, { onRow: (r) => r.c && TF.openCustomer(r.c.id) })
      ]),
      h("div", { class: "card" }, [h("header", null, h("h3", { text: "Upstream path" })), TF.traceStrip(S.tracePath(id), id)]),
      historyPanel(id)
    ]), [h("button", { class: "btn sm", onclick: () => TF.impactDialog(id) }, "Impact analysis")]);
  }

  function exportSn(sn, rows) {
    U.csv(sn.id + "-ports.csv", [
      { label: "Port", cell: (r) => r.p.port },
      { label: "Customer", cell: (r) => r.c ? r.c.name : r.p.state },
      { label: "CustomerID", cell: (r) => r.c ? r.c.id : "" },
      { label: "ONU", cell: (r) => r.o ? r.o.id : "" },
      { label: "Serial", cell: (r) => r.o ? r.o.serial : "" },
      { label: "RX dBm", cell: (r) => r.o ? r.o.rx : "" },
      { label: "Status", cell: (r) => r.o ? (r.o.online ? "online" : "offline") : "free" }
    ], rows);
  }

  /* ---------------- fibre ---------------- */
  function openFiber(id) {
    const S = TF.store, f = S.get.fiber(id);
    const im = S.impactOf(id);
    drawer("Fibre route " + f.id, `${f.from} → ${f.to} · ${f.lengthM} m`, h("div", { class: "stack" }, [
      h("div", { class: "grid g4" }, [
        kpiBox("Cores", f.coreUsed + " / " + f.cores),
        kpiBox("Length", f.lengthM + " m"),
        kpiBox("Subscribers carried", im.customers.length),
        kpiBox("Condition", f.condition, f.condition === "good" ? "var(--good)" : "var(--warn)")
      ]),
      h("div", { class: "card" }, [h("header", null, h("h3", { text: "Route" })), defn([
        ["From", mono(f.from)], ["To", mono(f.to)], ["Closure", f.closure],
        ["KMZ reference", mono(f.route)],
        ["Google Earth", h("button", { class: "btn sm", onclick: () => exportKml(f) }, "Export KML")]
      ])])
    ]));
  }

  function exportKml(f) {
    const S = TF.store;
    const dn = S.db.dns.find((d) => d.id === f.to);
    const olt = S.get.olt(dn.olt);
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>TrustForce ${f.id}</name>
<Placemark><name>${olt.id} ${olt.name}</name><Point><coordinates>${olt.lng},${olt.lat},0</coordinates></Point></Placemark>
<Placemark><name>${dn.id}</name><Point><coordinates>${dn.lng},${dn.lat},0</coordinates></Point></Placemark>
<Placemark><name>Route ${f.id}</name><LineString><coordinates>${olt.lng},${olt.lat},0 ${dn.lng},${dn.lat},0</coordinates></LineString></Placemark>
</Document></kml>`;
    const blob = new Blob([kml], { type: "application/vnd.google-earth.kml+xml" });
    const a = h("a", { href: URL.createObjectURL(blob), download: f.id + ".kml" });
    document.body.appendChild(a); a.click(); a.remove();
    toast("KML exported", f.id + ".kml is ready for Google Earth", "good");
  }

  /* ---------------- optical monitoring ---------------- */
  const opt = { band: "all", zone: "" };
  function opticalTab() {
    const S = TF.store;
    const wrap = h("div", { class: "stack" });
    const body = h("div");
    const zones = Array.from(new Set(S.db.sns.map((s) => s.zone))).sort();

    wrap.appendChild(h("div", { class: "toolbar" }, [
      select([
        { value: "all", label: "All ONUs" },
        { value: "weak", label: "Below −25 dBm" },
        { value: "marginal", label: "−25 to −27 dBm" },
        { value: "offline", label: "Offline only" }
      ], { onchange: (e) => { opt.band = e.target.value; paint(); } }),
      select([{ value: "", label: "All zones" }].concat(zones.map((z) => ({ value: z, label: z }))), { onchange: (e) => { opt.zone = e.target.value; paint(); } }),
      h("span", { class: "hint", text: "Design budget for a 1:4 + 1:16 cascade is about −25 dBm at the ONU." })
    ]));
    wrap.appendChild(body);

    function rows() {
      return S.db.onus.filter((o) => {
        const sn = S.get.sn(o.sn);
        if (opt.zone && sn.zone !== opt.zone) return false;
        if (opt.band === "weak") return o.rx < -25;
        if (opt.band === "marginal") return o.rx >= -27 && o.rx < -25;
        if (opt.band === "offline") return !o.online;
        return true;
      }).sort((a, b) => a.rx - b.rx);
    }

    function paint() {
      const list = rows();
      U.clear(body);
      const hist = list.slice(0, 40);
      body.appendChild(h("div", { class: "card" }, [
        h("header", null, [h("h3", { text: "Weakest 40 readings" }), h("div", { style: "flex:1" }),
        h("button", { class: "btn sm", onclick: () => U.csv("optical-levels.csv", cols(), list) }, "Export CSV")]),
        table(cols(), hist, { onRow: (o) => opticalDetail(o.id), empty: "No ONU matches that filter." })
      ]));
      body.appendChild(h("div", { class: "hint", text: list.length + " ONUs in scope." }));
    }

    function cols() {
      return [
        { label: "ONU", cell: (o) => mono(o.id) },
        { label: "Customer", cell: (o) => { const c = S.get.customer(o.customer); return c ? c.name : "—"; } },
        { label: "Splitter", cell: (o) => mono(o.sn + ":" + o.snPort) },
        { label: "ONU RX", cell: (o) => h("span", { class: "num", style: "color:" + U.opticalGrade(o.rx).color, text: fmt.dbm(o.rx) }), raw: (o) => o.rx },
        { label: "OLT RX", cell: (o) => mono(fmt.dbm(o.oltRx)), raw: (o) => o.oltRx },
        { label: "Distance", cell: (o) => mono(o.distance + " m"), raw: (o) => o.distance },
        { label: "Temp", cell: (o) => mono(o.temperature + " °C"), raw: (o) => o.temperature },
        { label: "State", cell: (o) => pill(o.online ? "online" : "offline", o.online ? "online" : "offline"), raw: (o) => (o.online ? "online" : "offline") }
      ];
    }

    paint();
    return wrap;
  }

  function opticalDetail(onuId) {
    const S = TF.store, o = S.get.onu(onuId), c = S.get.customer(o.customer);
    const ranges = [
      { id: 7, label: "7 days" }, { id: 30, label: "30 days" }, { id: 90, label: "90 days" }
    ];
    const chartBox = h("div");
    function draw(days) {
      const hist = S.opticalHistory(onuId, days);
      U.clear(chartBox).appendChild(lineChart([{ points: hist.points, color: U.opticalGrade(o.rx).color }], {
        labels: hist.labels, height: 180, min: -30, max: -8, fmtY: (v) => v.toFixed(0)
      }));
    }
    draw(30);
    modal({
      title: onuId + " · " + (c ? c.name : ""),
      body: [
        h("div", { class: "metric-strip" }, [
          mm("ONU RX", fmt.dbm(o.rx)), mm("ONU TX", fmt.dbm(o.tx)), mm("OLT RX", fmt.dbm(o.oltRx)),
          mm("Distance", o.distance + " m"), mm("Margin", (28 + o.rx).toFixed(1) + " dB")
        ]),
        h("div", { class: "row" }, ranges.map((r) => h("button", { class: "btn sm", onclick: () => draw(r.id) }, r.label))),
        chartBox,
        h("p", { class: "hint", text: "Compare both ends: a low ONU RX with a normal OLT RX points at the drop cable or the customer connector, not the feeder." })
      ],
      actions: [
        { label: "Open subscriber", onClick: () => TF.openCustomer(o.customer) },
        { label: "Reboot ONU", tone: "danger", onClick: () => { S.actions.rebootOnu(onuId); toast("Reboot issued", onuId); } },
        { label: "Close", tone: "primary" }
      ]
    });
  }

  /* ---------------- shared bits ---------------- */
  function historyPanel(objectId) {
    const S = TF.store;
    const events = S.db.audit.filter((a) => a.target === objectId)
      .concat(S.db.alarms.filter((a) => a.object === objectId).map((a) => ({
        at: a.raised, actor: "alarm-engine", action: a.label, target: a.object, detail: a.detail
      })))
      .sort((a, b) => b.at - a.at).slice(0, 15);
    return h("div", { class: "card" }, [
      h("header", null, h("h3", { text: "Object history" })),
      table([
        { label: "When", cell: (e) => fmt.dateTime(e.at) },
        { label: "Actor", cell: (e) => e.actor },
        { label: "Event", cell: (e) => e.action },
        { label: "Detail", cell: (e) => e.detail }
      ], events, { empty: "No lifecycle event recorded for this object yet." })
    ]);
  }

  function defn(pairs) {
    const dl = h("dl", { class: "defn" });
    pairs.forEach((p) => { dl.appendChild(h("dt", { text: p[0] })); dl.appendChild(h("dd", null, typeof p[1] === "object" ? p[1] : String(p[1]))); });
    return dl;
  }
  function mono(t) { return h("span", { class: "num", text: t }); }
  function mm(label, value) { return h("div", null, [h("span", { text: label }), h("b", { text: value })]); }
  function lg(color, label) { return h("span", null, [h("i", { style: "background:" + color }), label]); }
  function kpiBox(label, value, color) {
    return h("div", { class: "card kpi" }, [
      h("span", { class: "label", text: label }),
      h("span", { class: "value", style: "font-size:22px" + (color ? ";color:" + color : ""), text: value })
    ]);
  }

  TF.odn = { openOlt, openDn, openSn, openFiber, opticalDetail };
})(window.TF = window.TF || {});
