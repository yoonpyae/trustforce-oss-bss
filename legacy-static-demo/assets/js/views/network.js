(function (TF) {
  "use strict";
  const U = TF.ui;
  const { h, fmt, pill, table, tabs, toast, modal, select, input, field } = U;

  const f = { q: "", state: "", nas: "" };

  TF.views.network = {
    title: "Access network",
    subtitle: "FreeRADIUS, the BNGs and the address plan. Sessions update live; Change-of-Authorization takes effect the moment a payment lands.",
    render() {
      return tabs([
        { id: "sessions", label: "Live sessions", render: sessions },
        { id: "nas", label: "BNG / NAS", render: nasTab },
        { id: "pools", label: "IP pools", render: pools },
        { id: "bw", label: "Bandwidth profiles", render: bandwidth },
        { id: "radius", label: "RADIUS log", render: radiusLog }
      ]);
    }
  };

  function sessions() {
    const S = TF.store;
    const wrap = h("div", { class: "stack" });
    const body = h("div");

    wrap.appendChild(h("div", { class: "toolbar" }, [
      input({ class: "grow", placeholder: "Login, IP or caller ID…", oninput: (e) => { f.q = e.target.value.toLowerCase(); paint(); } }),
      select([{ value: "", label: "All sessions" }, { value: "up", label: "Connected" }, { value: "down", label: "Disconnected" }], { onchange: (e) => { f.state = e.target.value; paint(); } }),
      select([{ value: "", label: "All BNGs" }].concat(S.db.nasDevices.map((n) => ({ value: n.id, label: n.name }))), { onchange: (e) => { f.nas = e.target.value; paint(); } })
    ]));
    wrap.appendChild(body);

    function rows() {
      return S.db.sessions.filter((s) =>
        (!f.q || s.login.includes(f.q) || s.ip.includes(f.q) || s.callerId.toLowerCase().includes(f.q) || s.name.toLowerCase().includes(f.q)) &&
        (!f.state || (f.state === "up" ? s.online : !s.online)) &&
        (!f.nas || s.nas === f.nas)
      ).sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0) || b.rxMbps - a.rxMbps);
    }

    function paint() {
      const list = rows();
      U.clear(body);
      body.appendChild(h("div", { class: "grid g4" }, [
        stat("Connected", list.filter((s) => s.online).length),
        stat("Disconnected", list.filter((s) => !s.online).length),
        stat("Aggregate downstream", fmt.num(list.reduce((a, s) => a + s.rxMbps, 0) / 1000, 2) + " Gbps"),
        stat("Throttled by FUP", list.filter((s) => s.throttled).length)
      ]));
      body.appendChild(h("div", { class: "card" }, [
        h("header", null, [h("h3", { text: "Sessions" }), h("span", { class: "hint", text: "refreshing every 4 seconds" })]),
        table([
          { label: "Login", cell: (s) => h("div", null, [h("div", { class: "num", text: s.login }), h("div", { class: "hint", text: s.name })]) },
          { label: "IP", cell: (s) => h("span", { class: "num", text: s.ip }) },
          { label: "BNG", cell: (s) => s.nas },
          { label: "Uptime", cell: (s) => h("span", { class: "num", text: fmt.uptime(s.uptimeS) }) },
          { label: "Down / up", cell: (s) => h("span", { class: "num", text: s.online ? s.rxMbps + " / " + s.txMbps + " Mbps" : "—" }) },
          { label: "Cap", cell: (s) => h("span", { class: "num", text: s.capDown + "/" + s.capUp }) },
          { label: "Total", cell: (s) => h("span", { class: "num", text: s.totalGB + " GB" }) },
          { label: "State", cell: (s) => pill(s.online ? "online" : "offline", s.online ? "online" : "offline") },
          {
            label: "", right: true, cell: (s) => h("button", {
              class: "btn sm " + (s.online ? "danger" : ""),
              onclick: (e) => {
                e.stopPropagation();
                S.actions.coa(s.customer, s.online ? "disconnect" : "reconnect");
                toast("CoA " + (s.online ? "disconnect" : "reconnect"), s.login + " on " + s.nas, "good");
                paint();
              }
            }, s.online ? "Disconnect" : "Reconnect")
          }
        ], list.slice(0, 60), { onRow: (s) => TF.openCustomer(s.customer) })
      ]));
      body.appendChild(h("div", { class: "hint", text: "Showing " + Math.min(60, list.length) + " of " + list.length + " sessions." }));
    }

    paint();
    TF.store.onChange((kind) => { if (kind === "tick" && document.body.contains(body)) paint(); });
    return wrap;
  }

  function nasTab() {
    const S = TF.store;
    return h("div", { class: "grid g2" }, S.db.nasDevices.map((n) => h("div", { class: "card stack" }, [
      h("div", { class: "row" }, [
        h("div", null, [h("h3", { text: n.name }), h("div", { class: "hint num", text: n.id + " · " + n.vendor + " " + n.model })]),
        h("div", { style: "flex:1" }),
        pill(n.status, n.status === "online" ? "online" : "warn")
      ]),
      h("dl", { class: "defn" }, [
        h("dt", { text: "Management" }), h("dd", null, h("span", { class: "num", text: n.ip + ":" + n.apiPort })),
        h("dt", { text: "Shared secret" }), h("dd", null, h("span", { class: "num", text: n.secret + " (vault)" })),
        h("dt", { text: "Live sessions" }), h("dd", null, h("span", { class: "num", text: S.db.sessions.filter((s) => s.nas === n.id && s.online).length + " / " + n.sessions })),
        h("dt", { text: "CPU" }), h("dd", null, h("div", null, [
          h("div", { class: "bar-track" }, h("div", { class: "bar-fill", style: "width:" + n.cpu + "%;background:" + (n.cpu > 70 ? "var(--warn)" : "linear-gradient(90deg,var(--cyan-deep),var(--cyan))") })),
          h("span", { class: "hint num", text: n.cpu + "% · uptime " + n.uptime })
        ]))
      ]),
      h("div", { class: "row" }, [
        h("button", { class: "btn sm", onclick: () => toast("Connection test passed", n.ip + " answered the API handshake in 42 ms", "good") }, "Test connection"),
        h("button", { class: "btn sm", onclick: () => toast("Configuration pulled", "Queues, pools and PPP profiles compared with " + n.id) }, "Sync configuration")
      ])
    ])));
  }

  function pools() {
    const S = TF.store;
    return h("div", { class: "card" }, [
      h("header", null, [h("h3", { text: "Address plan" }), h("span", { class: "hint", text: "Overlapping ranges are the usual cause of “authenticated but no traffic”." })]),
      table([
        { label: "Pool", cell: (p) => h("span", { class: "num", text: p.id }) },
        { label: "Name", cell: (p) => p.name },
        { label: "Range", cell: (p) => h("span", { class: "num", text: p.range }) },
        { label: "Attached BNG", cell: (p) => p.nas },
        {
          label: "Utilisation", cell: (p) => h("div", { style: "min-width:150px" }, [
            h("div", { class: "hint num", text: p.used + " / " + p.size }),
            h("div", { class: "bar-track" }, h("div", { class: "bar-fill", style: "width:" + Math.min(100, (p.used / p.size) * 100) + "%;background:" + ((p.used / p.size) > 0.85 ? "var(--bad)" : "linear-gradient(90deg,var(--cyan-deep),var(--cyan))") }))
          ])
        },
        { label: "Free", right: true, cell: (p) => h("span", { class: "num", text: p.size - p.used }) }
      ], S.db.ipPools)
    ]);
  }

  function bandwidth() {
    const S = TF.store;
    return h("div", { class: "card" }, [
      h("header", null, [h("h3", { text: "Rate-limit profiles" }), h("span", { class: "hint", text: "Referenced by tariffs; edited in one place so no plan drifts." })]),
      table([
        { label: "Profile", cell: (b) => h("span", { class: "num", text: b.id }) },
        { label: "Name", cell: (b) => b.name },
        { label: "Download", cell: (b) => h("span", { class: "num", text: b.down + " Mbps" }) },
        { label: "Upload", cell: (b) => h("span", { class: "num", text: b.up + " Mbps" }) },
        { label: "Burst", cell: (b) => h("span", { class: "num", text: b.burst }) },
        { label: "Queue priority", cell: (b) => b.priority },
        { label: "Plans using it", right: true, cell: (b) => S.db.tariffs.filter((t) => t.bw === b.id).length }
      ], S.db.bandwidths)
    ]);
  }

  function radiusLog() {
    const S = TF.store;
    const events = [];
    S.db.sessions.slice(0, 40).forEach((s, i) => {
      events.push({
        at: S.db.meta.now - i * 137000,
        type: s.online ? "Access-Accept" : "Access-Reject",
        user: s.login, nas: s.nas, ip: s.ip,
        detail: s.online ? "Framed-IP " + s.ip + ", rate " + s.capDown + "M/" + s.capUp + "M" : "Expired plan — authorisation refused"
      });
    });
    S.db.audit.filter((a) => a.action.indexOf("CoA") >= 0 || a.action.indexOf("RADIUS") >= 0).forEach((a) => {
      events.push({ at: a.at, type: "CoA-Request", user: a.target, nas: "—", ip: a.ip, detail: a.detail });
    });
    events.sort((a, b) => b.at - a.at);
    return h("div", { class: "card" }, [
      h("header", null, [h("h3", { text: "Authentication and authorization events" }),
      h("button", { class: "btn sm", onclick: () => U.csv("radius-log.csv", rcols, events) }, "Export CSV")]),
      table(rcols, events.slice(0, 50))
    ]);
  }
  const rcols = [
    { label: "When", cell: (e) => fmt.dateTime(e.at) },
    { label: "Type", cell: (e) => pill(e.type, e.type === "Access-Accept" ? "online" : e.type === "CoA-Request" ? "info" : "offline"), raw: (e) => e.type },
    { label: "User", cell: (e) => h("span", { class: "num", text: e.user }) },
    { label: "NAS", cell: (e) => e.nas },
    { label: "Detail", cell: (e) => e.detail }
  ];

  function stat(label, value) {
    return h("div", { class: "card kpi" }, [h("span", { class: "label", text: label }), h("span", { class: "value", style: "font-size:24px", text: value })]);
  }
})(window.TF = window.TF || {});
