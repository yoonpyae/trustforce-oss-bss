(function (TF) {
  "use strict";
  const U = TF.ui;
  const { h, fmt, pill, table, tabs, toast, select, input, field } = U;

  TF.views.settings = {
    title: "Administration",
    subtitle: "Who can do what, which integrations are live, and a record of every action taken in the system.",
    render() {
      return tabs([
        { id: "roles", label: "Roles & staff", render: roles },
        { id: "int", label: "Integrations", render: integrations },
        { id: "audit", label: "Audit trail", render: audit },
        { id: "co", label: "Operator profile", render: company }
      ]);
    }
  };

  function roles() {
    const S = TF.store;
    const matrix = [
      { action: "View subscriber record", admin: "✓", noc: "✓", cashier: "✓", sales: "✓", field: "assigned only", finance: "✓" },
      { action: "Take payment / recharge", admin: "✓", noc: "—", cashier: "✓", sales: "—", field: "—", finance: "—" },
      { action: "Edit tariff", admin: "✓", noc: "—", cashier: "—", sales: "—", field: "—", finance: "—" },
      { action: "Send CoA / disconnect", admin: "✓", noc: "✓", cashier: "—", sales: "—", field: "—", finance: "—" },
      { action: "Reboot ONU / disable PON port", admin: "✓", noc: "✓", cashier: "—", sales: "—", field: "with ticket", finance: "—" },
      { action: "Reveal RADIUS secret", admin: "vault", noc: "vault", cashier: "—", sales: "—", field: "—", finance: "—" },
      { action: "Bulk message", admin: "✓", noc: "outage only", cashier: "—", sales: "approval", field: "—", finance: "—" },
      { action: "Export subscriber CSV", admin: "✓", noc: "—", cashier: "—", sales: "—", field: "—", finance: "watermarked" },
      { action: "Clear audit log", admin: "two-person", noc: "—", cashier: "—", sales: "—", field: "—", finance: "—" }
    ];
    return h("div", { class: "stack" }, [
      h("div", { class: "card" }, [
        h("header", null, [h("h3", { text: "Permission matrix" }), h("span", { class: "hint", text: "Least privilege: a cashier never sees a router secret, a technician never edits a price." })]),
        table([
          { label: "Action", cell: (r) => r.action },
          { label: "Admin", cell: (r) => cell(r.admin) },
          { label: "Network ops", cell: (r) => cell(r.noc) },
          { label: "Cashier", cell: (r) => cell(r.cashier) },
          { label: "Sales / CS", cell: (r) => cell(r.sales) },
          { label: "Field tech", cell: (r) => cell(r.field) },
          { label: "Finance", cell: (r) => cell(r.finance) }
        ], matrix)
      ]),
      h("div", { class: "card" }, [
        h("header", null, [h("h3", { text: "Staff accounts" }), h("div", { style: "flex:1" }),
        h("button", { class: "btn sm", onclick: () => toast("Invite sent", "The new user sets their own password and must enrol MFA before first login", "good") }, "Invite user")]),
        table([
          { label: "Name", cell: (u) => u.name },
          { label: "Role", cell: (u) => S.db.roles.find((r) => r.id === u.role).name },
          { label: "Email", cell: (u) => h("span", { class: "num", text: u.email }) },
          { label: "MFA", cell: (u) => u.mfa ? pill("enrolled", "online") : pill("not enrolled", "warn") },
          { label: "Last seen", right: true, cell: (u) => fmt.ago(u.last) }
        ], S.db.staff)
      ])
    ]);
  }
  function cell(v) {
    if (v === "✓") return h("span", { style: "color:var(--good)" }, "✓");
    if (v === "—") return h("span", { class: "hint" }, "—");
    return h("span", { class: "hint", style: "color:var(--warn)" }, v);
  }

  function integrations() {
    const rows = [
      { name: "FreeRADIUS", state: "connected", detail: "AAA for PPPoE and static IP · CoA on port 3799", owner: "Network ops" },
      { name: "MikroTik API", state: "connected", detail: "2 BNGs · queue and PPP profile sync", owner: "Network ops" },
      { name: "Cisco / Huawei BNG", state: "connected", detail: "SSH provisioning templates", owner: "Network ops" },
      { name: "OLT NMS (Huawei, ZTE)", state: "connected", detail: "ONU inventory, optical polling every 5 minutes", owner: "Network ops" },
      { name: "TR-069 ACS", state: "connected", detail: "Remote SSID and password management, firmware push", owner: "Network ops" },
      { name: "KBZPay / WavePay", state: "connected", detail: "Dynamic QR with invoice callback", owner: "Finance" },
      { name: "SMS gateway", state: "connected", detail: "Local aggregator, sender ID TRUSTFORCE", owner: "Marketing" },
      { name: "Viber business", state: "sandbox", detail: "Awaiting template approval", owner: "Marketing" },
      { name: "Accounting export", state: "scheduled", detail: "Nightly journal CSV at 23:30", owner: "Finance" }
    ];
    return h("div", { class: "stack" }, [
      h("div", { class: "card" }, [
        h("header", null, h("h3", { text: "Connected systems" })),
        table([
          { label: "System", cell: (r) => r.name },
          { label: "State", cell: (r) => pill(r.state, r.state === "connected" ? "online" : r.state === "sandbox" ? "warn" : "info") },
          { label: "What it does", cell: (r) => h("span", { class: "hint", text: r.detail }) },
          { label: "Owner", cell: (r) => r.owner },
          { label: "", right: true, cell: (r) => h("button", { class: "btn sm", onclick: () => toast("Test passed", r.name + " responded normally", "good") }, "Test") }
        ], rows)
      ]),
      h("div", { class: "card" }, [
        h("header", null, h("h3", { text: "Secrets" })),
        h("p", { text: "Router API credentials, RADIUS shared secrets, gateway keys and SMTP passwords are held in the vault. They are write-only from this interface: an operator can rotate a secret but cannot read one back." }),
        h("p", { class: "hint", text: "Rotation reminder: RADIUS shared secrets were last rotated 74 days ago. Policy is 90." })
      ])
    ]);
  }

  function audit() {
    const S = TF.store;
    const body = h("div");
    const q = input({ class: "grow", placeholder: "Actor, action or object…" });
    function paint() {
      const needle = q.value.toLowerCase();
      const rows = S.db.audit.filter((a) => !needle || a.actor.includes(needle) || a.action.toLowerCase().includes(needle) || String(a.target).toLowerCase().includes(needle));
      U.clear(body).appendChild(h("div", { class: "card" }, [
        h("header", null, [h("h3", { text: rows.length + " entries" }), h("div", { style: "flex:1" }),
        h("button", { class: "btn sm", onclick: () => U.csv("audit-trail.csv", cols, rows) }, "Export CSV")]),
        table(cols, rows.slice(0, 60)),
        h("p", { class: "hint", style: "margin-top:8px", text: "Retention is 400 days. Security events are written to an append-only archive that no role in this interface can delete." })
      ]));
    }
    const cols = [
      { label: "When", cell: (a) => fmt.dateTime(a.at), raw: (a) => new Date(a.at).toISOString() },
      { label: "Actor", cell: (a) => h("span", { class: "num", text: a.actor }) },
      { label: "Action", cell: (a) => a.action },
      { label: "Object", cell: (a) => h("a", { href: "javascript:void(0)", class: "num", onclick: () => TF.traceTo(a.target) }, a.target), raw: (a) => a.target },
      { label: "Detail", cell: (a) => h("span", { class: "hint", text: a.detail }) },
      { label: "Source", right: true, cell: (a) => h("span", { class: "num", text: a.ip }) }
    ];
    q.addEventListener("input", paint);
    paint();
    return h("div", { class: "stack" }, [h("div", { class: "toolbar" }, [q]), body]);
  }

  function company() {
    const S = TF.store;
    return h("div", { class: "grid g2" }, [
      h("div", { class: "card" }, [
        h("header", null, h("h3", { text: "Operator" })),
        h("dl", { class: "defn" }, [
          h("dt", { text: "Trading name" }), h("dd", { text: S.db.meta.operator }),
          h("dt", { text: "Website" }), h("dd", null, h("a", { href: "https://trustforcemm.com", target: "_blank", rel: "noopener" }, "trustforcemm.com")),
          h("dt", { text: "Currency" }), h("dd", { text: "Myanmar kyat (MMK)" }),
          h("dt", { text: "Timezone" }), h("dd", { text: S.db.meta.timezone }),
          h("dt", { text: "Commercial tax" }), h("dd", { text: "5% applied at invoice level" }),
          h("dt", { text: "Build" }), h("dd", null, h("span", { class: "num", text: S.db.meta.version }))
        ])
      ]),
      h("div", { class: "card stack" }, [
        h("header", null, h("h3", { text: "Demo controls" })),
        h("p", { class: "hint", text: "This build runs entirely in the browser against a generated dataset. Nothing leaves the machine and no real network is touched." }),
        h("button", { class: "btn", onclick: () => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === "light" ? "dark" : "light"; } }, "Toggle light / dark"),
        h("button", { class: "btn", onclick: () => location.reload() }, "Reset demo data")
      ])
    ]);
  }
})(window.TF = window.TF || {});
