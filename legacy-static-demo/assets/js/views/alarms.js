(function (TF) {
  "use strict";
  const U = TF.ui;
  const { h, fmt, pill, table, toast, select } = U;
  const af = { state: "active", severity: "" };

  TF.views.alarms = {
    title: "Alarms & events",
    subtitle: "Each alarm is attached to the object that raised it, the path above it, and the subscribers behind it — so the first question after “what broke” is already answered.",
    render() {
      const S = TF.store;
      const wrap = h("div", { class: "stack" });
      const body = h("div");

      wrap.appendChild(h("div", { class: "toolbar" }, [
        select([{ value: "active", label: "Active" }, { value: "cleared", label: "Cleared" }, { value: "", label: "All" }].map((o) => Object.assign(o, { selected: o.value === af.state })), { onchange: (e) => { af.state = e.target.value; paint(); } }),
        select([{ value: "", label: "Any severity" }, { value: "critical", label: "Critical" }, { value: "major", label: "Major" }, { value: "minor", label: "Minor" }], { onchange: (e) => { af.severity = e.target.value; paint(); } }),
        h("div", { style: "flex:1" }),
        h("button", { class: "btn", onclick: () => U.csv("alarms.csv", cols(), rows()) }, "Export CSV")
      ]));
      wrap.appendChild(body);

      function rows() {
        return S.db.alarms.filter((a) => (!af.state || a.state === af.state) && (!af.severity || a.severity === af.severity));
      }

      function cols() {
        return [
          { label: "Raised", cell: (a) => h("div", null, [h("div", { text: fmt.ago(a.raised) }), h("div", { class: "hint num", text: fmt.dateTime(a.raised) })]), raw: (a) => fmt.iso(a.raised) },
          { label: "Severity", cell: (a) => pill(a.severity, a.severity), raw: (a) => a.severity },
          { label: "Event", cell: (a) => h("div", null, [h("div", { text: a.label }), h("div", { class: "hint", text: a.detail })]), raw: (a) => a.label },
          { label: "Object", cell: (a) => h("a", { href: "javascript:void(0)", class: "num", onclick: (e) => { e.stopPropagation(); TF.traceTo(a.object); } }, a.object), raw: (a) => a.object },
          { label: "Path", cell: (a) => h("span", { class: "hint num", text: (a.path || []).join(" › ") }), raw: (a) => (a.path || []).join(" > ") },
          { label: "Impact", cell: (a) => { const im = S.impactOf(a.path ? a.path[a.path.length - 2] || a.object : a.object); return h("span", { class: "num", text: (a.customer ? 1 : im.customers.length) + " subs" }); }, raw: (a) => (a.customer ? 1 : "") }
        ];
      }

      function paint() {
        const list = rows();
        U.clear(body);
        const active = S.db.alarms.filter((a) => a.state === "active");
        body.appendChild(h("div", { class: "grid g4" }, [
          box("Critical", active.filter((a) => a.severity === "critical").length, "var(--bad)"),
          box("Major", active.filter((a) => a.severity === "major").length, "var(--warn)"),
          box("Minor", active.filter((a) => a.severity === "minor").length),
          box("Cleared today", S.db.alarms.filter((a) => a.cleared && a.cleared > S.db.meta.now - 86400000).length, "var(--good)")
        ]));
        body.appendChild(h("div", { class: "card" }, [
          h("header", null, h("h3", { text: list.length + " events" })),
          table(cols().concat([{
            label: "", right: true, cell: (a) => a.state === "active" ? h("div", { class: "row" }, [
              h("button", { class: "btn sm", onclick: (e) => { e.stopPropagation(); const t = S.actions.alarmToTicket(a.id); toast("Ticket raised", t.id + " queued for dispatch", "good"); } }, "Raise ticket"),
              h("button", { class: "btn sm", onclick: (e) => { e.stopPropagation(); S.actions.ackAlarm(a.id); toast("Alarm cleared", a.id); paint(); } }, "Clear")
            ]) : h("span", { class: "hint", text: fmt.date(a.cleared) })
          }]), list.slice(0, 60), { empty: "Nothing is alarming right now." })
        ]));
      }

      paint();
      return wrap;
    }
  };

  function box(label, value, color) {
    return h("div", { class: "card kpi" }, [h("span", { class: "label", text: label }), h("span", { class: "value", style: color ? "color:" + color : null, text: value })]);
  }
})(window.TF = window.TF || {});
