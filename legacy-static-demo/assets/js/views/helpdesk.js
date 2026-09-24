(function (TF) {
  "use strict";
  const U = TF.ui;
  const { h, fmt, pill, table, modal, drawer, toast, select, input, field, tabs } = U;
  const TECHS = ["Ko Myo (Van 1)", "U Thura (Van 2)", "Ko Hein (Van 3)", "Daw Su (Indoor)"];
  const STAGES = [
    { id: "open", label: "Open" },
    { id: "assigned", label: "Assigned" },
    { id: "in-progress", label: "In progress" },
    { id: "resolved", label: "Resolved" }
  ];

  TF.views.helpdesk = {
    title: "Helpdesk & field work",
    subtitle: "Tickets move through one lifecycle, dispatch carries the address and GPS to the technician's phone, and the agent sees line status and billing health on the same screen as the complaint.",
    render() {
      const S = TF.store;
      const wrap = h("div", { class: "stack" });
      const board = h("div");

      wrap.appendChild(h("div", { class: "toolbar" }, [
        h("span", { class: "hint grow", text: "Drag is deliberately not the only way to move a ticket — every transition is a logged action." }),
        h("button", { class: "btn primary", onclick: () => newTicket(paint) }, "New ticket")
      ]));
      wrap.appendChild(board);

      function paint() {
        U.clear(board);
        const t = S.db.tickets;
        const breach = t.filter((x) => x.status !== "resolved" && x.sla < S.db.meta.now);
        board.appendChild(h("div", { class: "grid g4", style: "margin-bottom:14px" }, [
          box("Open queue", t.filter((x) => x.status !== "resolved").length),
          box("Urgent", t.filter((x) => x.priority === "urgent" && x.status !== "resolved").length, "var(--bad)"),
          box("Past SLA", breach.length, breach.length ? "var(--warn)" : "var(--good)"),
          box("Resolved this week", t.filter((x) => x.status === "resolved" && x.updated > S.db.meta.now - 7 * 86400000).length, "var(--good)")
        ]));

        board.appendChild(h("div", { class: "kanban" }, STAGES.map((st) => {
          const items = t.filter((x) => x.status === st.id);
          return h("div", { class: "kcol" }, [
            h("h4", { text: st.label + " · " + items.length }),
            ...items.slice(0, 12).map((x) => card(x, paint))
          ]);
        })));
      }

      function card(t, after) {
        const late = t.status !== "resolved" && t.sla < TF.store.db.meta.now;
        return h("div", { class: "kcard" }, [
          h("div", { class: "row", style: "gap:6px;margin-bottom:6px" }, [
            h("span", { class: "hint num", text: t.id }),
            pill(t.priority, t.priority === "urgent" ? "critical" : t.priority === "high" ? "warn" : "idle"),
            late ? pill("past SLA", "expired") : null
          ]),
          h("h5", { text: t.subject }),
          h("p", { text: t.customerName + " · " + t.zone + (t.tech ? " · " + t.tech : "") }),
          h("div", { class: "row" }, [
            h("button", { class: "btn sm", onclick: () => open(t.id, after) }, "Open"),
            nextStage(t) ? h("button", { class: "btn sm primary", onclick: () => move(t, after) }, nextStage(t).label) : null
          ])
        ]);
      }

      function nextStage(t) {
        const i = STAGES.findIndex((s) => s.id === t.status);
        return i >= 0 && i < STAGES.length - 1 ? { id: STAGES[i + 1].id, label: "→ " + STAGES[i + 1].label } : null;
      }

      function move(t, after) {
        const nxt = nextStage(t);
        if (nxt.id === "assigned") return dispatch(t, after);
        TF.store.actions.moveTicket(t.id, nxt.id);
        toast("Ticket moved", t.id + " is now " + nxt.id);
        after();
      }

      paint();
      return wrap;
    }
  };

  function dispatch(t, after) {
    const sel = select(TECHS.map((x) => ({ value: x, label: x })));
    const when = select(["Today, next slot", "Today, afternoon", "Tomorrow morning", "Tomorrow afternoon"].map((x) => ({ value: x, label: x })));
    const S = TF.store;
    const c = t.customer ? S.get.customer(t.customer) : null;
    modal({
      title: "Dispatch " + t.id,
      body: [
        field("Technician", sel),
        field("Slot", when),
        c ? h("div", { class: "card" }, [
          h("h3", { text: "Sent to the technician's phone" }),
          h("p", { class: "hint", text: c.address }),
          h("p", { class: "hint num", text: "GPS " + c.lat.toFixed(5) + ", " + c.lng.toFixed(5) + " · " + c.sn + " port " + c.snPort + " · ONU " + c.onu })
        ]) : null
      ],
      actions: [{ label: "Cancel" }, {
        label: "Dispatch", tone: "primary", onClick: () => {
          S.actions.moveTicket(t.id, "assigned", sel.value);
          toast("Dispatched", sel.value + " · " + when.value, "good");
          after();
        }
      }]
    });
  }

  function open(id, after) {
    const S = TF.store;
    const t = S.db.tickets.find((x) => x.id === id);
    const c = t.customer ? S.get.customer(t.customer) : null;
    const onu = c ? S.get.onuOfCustomer(c.id) : null;
    const sess = c ? S.get.session(c.id) : null;
    const inv = c ? S.get.invoicesOf(c.id).filter((i) => i.status !== "paid") : [];

    const note = input({ placeholder: "Add a note…" });
    const notes = h("div", { class: "stack", style: "gap:6px" });
    function paintNotes() {
      U.clear(notes);
      t.notes.slice().reverse().forEach((n) => notes.appendChild(h("div", { class: "card", style: "padding:10px" }, [
        h("div", { class: "hint", text: n.by + " · " + fmt.dateTime(n.at) }),
        h("div", { text: n.text })
      ])));
    }
    paintNotes();

    drawer(t.subject, `${t.id} · ${t.category} · ${t.priority} · opened ${fmt.ago(t.created)}`, h("div", { class: "stack" }, [
      c ? h("div", { class: "card" }, [
        h("header", null, [h("h3", { text: "360° diagnostics" }), h("div", { style: "flex:1" }),
        h("button", { class: "btn sm", onclick: () => TF.openCustomer(c.id) }, "Open subscriber")]),
        h("div", { class: "grid g4" }, [
          diag("Line", sess && sess.online ? "session up" : "session down", sess && sess.online ? "var(--good)" : "var(--bad)"),
          diag("Optical", onu ? fmt.dbm(onu.rx) : "—", onu ? U.opticalGrade(onu.rx).color : null),
          diag("Billing", inv.length ? inv.length + " unpaid" : "settled", inv.length ? "var(--warn)" : "var(--good)"),
          diag("Fibre position", c.sn + " : " + c.snPort)
        ]),
        TF.traceStrip(S.tracePath(c.id))
      ]) : null,
      h("div", { class: "card stack" }, [
        h("header", null, h("h3", { text: "Work" })),
        h("div", { class: "row" }, [
          h("span", { class: "hint", text: "Status" }), pill(t.status, t.status === "resolved" ? "resolved" : "info"),
          h("span", { class: "hint", text: "Technician" }), h("span", { text: t.tech || "unassigned" }),
          h("span", { class: "hint", text: "SLA" }), h("span", { class: "num", style: t.sla < S.db.meta.now && t.status !== "resolved" ? "color:var(--bad)" : null, text: fmt.dateTime(t.sla) })
        ]),
        h("div", { class: "row" }, STAGES.map((st) => h("button", {
          class: "btn sm " + (st.id === t.status ? "primary" : ""),
          onclick: () => { S.actions.moveTicket(t.id, st.id); toast("Ticket " + st.label.toLowerCase(), t.id); open(id, after); if (after) after(); }
        }, st.label)))
      ]),
      h("div", { class: "card stack" }, [
        h("header", null, h("h3", { text: "Notes" })),
        notes,
        h("div", { class: "row" }, [
          h("div", { style: "flex:1" }, note),
          h("button", {
            class: "btn", onclick: () => {
              if (!note.value.trim()) return;
              t.notes.push({ at: Date.now(), by: TF.state.user.login, text: note.value.trim() });
              note.value = ""; paintNotes();
            }
          }, "Add note")
        ])
      ])
    ]));
  }

  function newTicket(after) {
    const S = TF.store;
    const cust = select(S.db.customers.slice(0, 250).map((c) => ({ value: c.id, label: c.name + " · " + c.id })));
    const subj = input({ placeholder: "What did the customer report?" });
    const cat = select(["Fault", "Performance", "Install", "Move", "Config", "Billing", "Hardware"].map((c) => ({ value: c, label: c })));
    const pri = select(["low", "normal", "high", "urgent"].map((p) => ({ value: p, label: p, selected: p === "normal" })));
    modal({
      title: "New ticket",
      body: [field("Subscriber", cust), field("Subject", subj), h("div", { class: "grid g2" }, [field("Category", cat), field("Priority", pri)])],
      actions: [{ label: "Cancel" }, {
        label: "Create ticket", tone: "primary", onClick: () => {
          if (!subj.value.trim()) { toast("Describe the issue", "A subject is required", "bad"); return true; }
          const c = S.get.customer(cust.value);
          const t = {
            kind: "TICKET", id: "TKT-" + (3300 + S.db.tickets.length), subject: subj.value.trim(),
            category: cat.value, customer: c.id, customerName: c.name, zone: c.zone,
            priority: pri.value, status: "open", tech: null,
            created: S.db.meta.now, updated: S.db.meta.now,
            sla: S.db.meta.now + (cat.value === "Fault" ? 8 : 48) * 3600000,
            notes: [{ at: S.db.meta.now, by: TF.state.user.login, text: "Logged from the helpdesk." }]
          };
          S.db.tickets.unshift(t);
          S.log("Ticket created", t.id, c.name + " · " + cat.value);
          toast("Ticket created", t.id, "good");
          after();
        }
      }]
    });
  }

  function box(label, value, color) {
    return h("div", { class: "card kpi" }, [h("span", { class: "label", text: label }), h("span", { class: "value", style: color ? "color:" + color : null, text: value })]);
  }
  function diag(label, value, color) {
    return h("div", null, [h("div", { class: "hint", text: label }), h("div", { class: "num", style: "font-size:16px" + (color ? ";color:" + color : ""), text: value })]);
  }
})(window.TF = window.TF || {});
