(function (TF) {
  "use strict";
  const U = TF.ui;
  const { h, fmt, pill, table, modal, toast, select, input } = U;

  let focus = null; // last traced object

  TF.views.topology = {
    title: "Topology & impact",
    subtitle: "Trace any identifier up or down the fibre, see the same relationship on the map, and answer the only question that matters during an outage: who is affected.",
    render() {
      const S = TF.store;
      const wrap = h("div", { class: "stack" });
      const target = focus || S.db.sns[0].id;

      /* ---- trace panel ---- */
      const box = h("div");
      const q = input({ placeholder: "Customer ID, ONU serial, MAC, SN, DN, fibre or OLT port…", value: target, class: "grow" });
      const go = () => { focus = q.value.trim(); paintTrace(); };

      wrap.appendChild(h("div", { class: "card stack" }, [
        h("header", null, [h("h3", { text: "Trace" }), h("span", { class: "hint", text: "Up: customer → ONU → SN → DN → fibre → OLT.  Down: OLT → PON → DN → SN → ONU → customer." })]),
        h("div", { class: "toolbar", style: "margin:0" }, [
          q,
          h("button", { class: "btn primary", onclick: go }, "Trace"),
          h("button", { class: "btn", onclick: () => { focus = S.db.sns[Math.floor(Math.random() * S.db.sns.length)].id; q.value = focus; paintTrace(); } }, "Random object")
        ]),
        box
      ]));
      q.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });

      function paintTrace() {
        U.clear(box);
        const id = (focus || "").trim();
        const chain = S.tracePath(resolve(id));
        if (!chain.length) {
          box.appendChild(h("div", { class: "empty", text: "No managed object matches “" + id + "”. Try a customer ID such as CUS-0007, an ONU serial, or a node like SN-004." }));
          return;
        }
        const im = S.impactOf(resolve(id));
        box.appendChild(TF.traceStrip(chain, resolve(id)));
        box.appendChild(h("div", { class: "metric-strip", style: "margin-top:12px" }, [
          mm("Objects in path", chain.length),
          mm("Subscribers downstream", im.customers.length),
          mm("Business accounts", im.business),
          mm("Monthly revenue", fmt.money(im.revenue))
        ]));
        box.appendChild(h("div", { class: "row", style: "margin-top:10px" }, [
          h("button", { class: "btn sm", onclick: () => TF.impactDialog(resolve(id)) }, "Impact analysis"),
          h("button", { class: "btn sm", onclick: () => TF.traceTo(resolve(id)) }, "Open object")
        ]));
      }

      function resolve(id) {
        const onu = S.db.onus.find((o) => o.id === id || o.serial.toLowerCase() === id.toLowerCase() || o.mac.toLowerCase() === id.toLowerCase());
        if (onu) return onu.id;
        const c = S.db.customers.find((x) => x.phone === id);
        return c ? c.id : id;
      }
      paintTrace();

      /* ---- map ---- */
      wrap.appendChild(mapCard());

      /* ---- weak points ---- */
      const weak = S.weakPoints();
      wrap.appendChild(h("div", { class: "card" }, [
        h("header", null, [
          h("h3", { text: "Weak points" }),
          h("span", { class: "hint", text: "Derived from relationships and live state, not from alarms alone" }),
          h("div", { style: "flex:1" }),
          h("button", { class: "btn sm", onclick: () => U.csv("weak-points.csv", wcols, weak) }, "Export CSV")
        ]),
        table(wcols.concat([{
          label: "", right: true, cell: (w) => h("button", { class: "btn sm", onclick: (e) => { e.stopPropagation(); TF.impactDialog(w.object); } }, "Impact")
        }]), weak, { onRow: (w) => { focus = w.object; q.value = w.object; paintTrace(); box.scrollIntoView({ behavior: "smooth", block: "center" }); } })
      ]));

      return wrap;
    }
  };

  const wcols = [
    { label: "Type", cell: (w) => w.type },
    { label: "Object", cell: (w) => h("span", { class: "num", text: w.object }) },
    { label: "Finding", cell: (w) => w.detail },
    { label: "Severity", cell: (w) => pill(w.severity, w.severity), raw: (w) => w.severity },
    { label: "Subscribers", right: true, cell: (w) => h("span", { class: "num", text: w.customers }) }
  ];

  /* ---------------- map ---------------- */
  function mapCard() {
    const S = TF.store;
    const objs = []
      .concat(S.db.olts.map((o) => ({ id: o.id, lat: o.lat, lng: o.lng, kind: "OLT", color: "var(--cyan)", size: 15 })))
      .concat(S.db.dns.map((d) => ({ id: d.id, lat: d.lat, lng: d.lng, kind: "DN", color: d.condition === "good" ? "var(--violet)" : "var(--warn)", size: 11 })))
      .concat(S.db.sns.map((s) => {
        const weak = S.db.onus.filter((o) => o.sn === s.id && o.rx < -25).length;
        const off = S.db.onus.filter((o) => o.sn === s.id && !o.online).length;
        return { id: s.id, lat: s.lat, lng: s.lng, kind: "SN", color: weak ? "var(--bad)" : off ? "var(--warn)" : "var(--good)", size: 9 };
      }));

    const lats = objs.map((o) => o.lat), lngs = objs.map((o) => o.lng);
    const minLat = Math.min.apply(null, lats), maxLat = Math.max.apply(null, lats);
    const minLng = Math.min.apply(null, lngs), maxLng = Math.max.apply(null, lngs);
    const canvas = h("div", { class: "map", style: "height:380px" });

    // faint feeder lines OLT → DN → SN, drawn as SVG under the dots
    const svg = U.svg("svg", { viewBox: "0 0 100 100", preserveAspectRatio: "none", style: "position:absolute;inset:0;width:100%;height:100%" });
    const X = (lng) => ((lng - minLng) / (maxLng - minLng || 1)) * 92 + 4;
    const Y = (lat) => (1 - (lat - minLat) / (maxLat - minLat || 1)) * 88 + 6;
    S.db.dns.forEach((d) => {
      const olt = S.get.olt(d.olt);
      svg.appendChild(U.svg("line", { x1: X(olt.lng), y1: Y(olt.lat), x2: X(d.lng), y2: Y(d.lat), stroke: "var(--line)", "stroke-width": 0.35, "vector-effect": "non-scaling-stroke" }));
      S.get.snsOfDn(d.id).forEach((s) => {
        svg.appendChild(U.svg("line", { x1: X(d.lng), y1: Y(d.lat), x2: X(s.lng), y2: Y(s.lat), stroke: "var(--line-soft)", "stroke-width": 0.25, "vector-effect": "non-scaling-stroke" }));
      });
    });
    canvas.appendChild(svg);

    objs.forEach((o) => {
      canvas.appendChild(h("button", {
        class: "map-dot",
        title: o.kind + " " + o.id,
        "aria-label": o.kind + " " + o.id,
        style: `left:${X(o.lng)}%;top:${Y(o.lat)}%;width:${o.size}px;height:${o.size}px;background:${o.color}`,
        onclick: () => TF.traceTo(o.id)
      }));
    });

    return h("div", { class: "card" }, [
      h("header", null, [
        h("h3", { text: "Plant map" }),
        h("div", { class: "legend" }, [
          lg("var(--cyan)", "OLT"), lg("var(--violet)", "distribution node"), lg("var(--good)", "service node healthy"),
          lg("var(--warn)", "offline customers"), lg("var(--bad)", "optical budget breach")
        ]),
        h("div", { style: "flex:1" }),
        h("button", { class: "btn sm", onclick: exportPlantKml }, "Export plant KML")
      ]),
      canvas,
      h("p", { class: "hint", text: "Positions come from the GPS recorded against each object. In production this layer is the same KMZ the survey team files, so a logical trace and a fibre route always agree." })
    ]);
  }

  function exportPlantKml() {
    const S = TF.store;
    let marks = "";
    S.db.olts.forEach((o) => { marks += `<Placemark><name>${o.id} ${o.name}</name><Point><coordinates>${o.lng},${o.lat},0</coordinates></Point></Placemark>\n`; });
    S.db.dns.forEach((d) => { marks += `<Placemark><name>${d.id} (1:4)</name><Point><coordinates>${d.lng},${d.lat},0</coordinates></Point></Placemark>\n`; });
    S.db.sns.forEach((s) => { marks += `<Placemark><name>${s.id} (1:16)</name><Point><coordinates>${s.lng},${s.lat},0</coordinates></Point></Placemark>\n`; });
    const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>TrustForce ODN plant</name>\n${marks}</Document></kml>`;
    const a = h("a", { href: URL.createObjectURL(new Blob([kml], { type: "application/vnd.google-earth.kml+xml" })), download: "trustforce-plant.kml" });
    document.body.appendChild(a); a.click(); a.remove();
    toast("Plant exported", "trustforce-plant.kml opens in Google Earth", "good");
  }

  /* ---------------- impact dialog ---------------- */
  TF.impactDialog = function (id) {
    const S = TF.store;
    const im = S.impactOf(id);
    const byZone = {};
    im.customers.forEach((c) => byZone[c.zone] = (byZone[c.zone] || 0) + 1);
    const biz = im.customers.filter((c) => c.segment === "business");

    modal({
      title: "If " + id + " fails",
      body: [
        h("div", { class: "grid g3" }, [
          box("Subscribers affected", im.customers.length),
          box("Business accounts", biz.length, biz.length ? "var(--warn)" : null),
          box("Revenue exposed", fmt.money(im.revenue) + " MMK")
        ]),
        h("p", { class: "hint", text: im.label + " feeds " + im.sns.length + " service node(s) across " + Object.keys(byZone).join(", ") + "." }),
        h("div", { class: "card" }, table([
          { label: "Service node", cell: (s) => h("span", { class: "num", text: s.id }) },
          { label: "Zone", cell: (s) => s.zone },
          { label: "Customers", right: true, cell: (s) => S.get.customersOfSn(s.id).length }
        ], im.sns, { empty: "No downstream service node." })),
        biz.length ? h("div", { class: "card" }, [
          h("header", null, h("h3", { text: "Business accounts to call first" })),
          table([
            { label: "Account", cell: (c) => c.name },
            { label: "Plan", cell: (c) => S.get.tariff(c.tariff).name },
            { label: "Phone", cell: (c) => h("span", { class: "num", text: c.phone }) }
          ], biz.slice(0, 8))
        ]) : null
      ],
      actions: [
        {
          label: "Notify affected customers", onClick: () => {
            S.actions.sendCampaign("Outage notice " + id, "Downstream of " + id, "SMS", im.customers, false);
            toast("Notice queued", im.customers.length + " subscribers will receive the maintenance SMS", "good");
          }
        },
        {
          label: "Export list", onClick: () => {
            U.csv("impact-" + id + ".csv", [
              { label: "ID", cell: (c) => c.id }, { label: "Name", cell: (c) => c.name },
              { label: "Phone", cell: (c) => c.phone }, { label: "Zone", cell: (c) => c.zone },
              { label: "Plan", cell: (c) => S.get.tariff(c.tariff).name }
            ], im.customers);
            return true;
          }
        },
        { label: "Close", tone: "primary" }
      ]
    });
  };

  function box(label, value, color) {
    return h("div", { class: "card kpi" }, [h("span", { class: "label", text: label }), h("span", { class: "value", style: "font-size:24px" + (color ? ";color:" + color : ""), text: value })]);
  }
  function mm(label, value) { return h("div", null, [h("span", { text: label }), h("b", { text: value })]); }
  function lg(color, label) { return h("span", null, [h("i", { style: "background:" + color }), label]); }
})(window.TF = window.TF || {});
