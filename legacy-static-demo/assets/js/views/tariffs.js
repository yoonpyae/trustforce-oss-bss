(function (TF) {
  "use strict";
  const U = TF.ui;
  const { h, fmt, pill, table, modal, toast, select, input, field } = U;

  TF.views.tariffs = {
    title: "Plans",
    subtitle: "A plan is not just a price. It carries the rate limit, the address pool, the billing cycle and what happens the day it expires — which is why a plan is published, not typed in twice.",
    render() {
      const S = TF.store;
      const wrap = h("div", { class: "stack" });
      const body = h("div");
      wrap.appendChild(h("div", { class: "toolbar" }, [
        h("span", { class: "hint grow", text: "Every plan below is referenced by live subscribers. Changing one takes effect at the next renewal, not retroactively." }),
        h("button", { class: "btn primary", onclick: () => editor(null, paint) }, "New plan")
      ]));
      wrap.appendChild(body);

      function paint() {
        U.clear(body);
        body.appendChild(h("div", { class: "grid g4" }, S.db.tariffs.map((t) => {
          const bw = S.get.bandwidth(t.bw);
          const subs = S.db.customers.filter((c) => c.tariff === t.id).length;
          return h("div", { class: "card stack", style: "gap:10px" }, [
            h("div", { class: "row" }, [
              h("div", null, [h("h3", { text: t.name }), h("span", { class: "hint num", text: t.id })]),
              h("div", { style: "flex:1" }),
              pill(t.cycle, t.cycle === "prepaid" ? "info" : "warn")
            ]),
            h("div", { class: "kpi" }, [
              h("span", { class: "value", style: "font-size:24px", text: fmt.money(t.price) }),
              h("span", { class: "foot", text: "MMK per " + t.days + " days" })
            ]),
            h("dl", { class: "defn", style: "grid-template-columns:90px 1fr" }, [
              h("dt", { text: "Speed" }), h("dd", null, h("span", { class: "num", text: bw.down + " / " + bw.up + " Mbps" })),
              h("dt", { text: "Burst" }), h("dd", null, h("span", { class: "num", text: bw.burst })),
              h("dt", { text: "Pool" }), h("dd", { text: t.pool }),
              h("dt", { text: "FUP" }), h("dd", { text: t.fup ? t.fup + " GB" : "unlimited" }),
              h("dt", { text: "Service" }), h("dd", { text: t.service })
            ]),
            h("div", { class: "row" }, [
              h("span", { class: "hint", text: subs + " subscribers" }),
              h("div", { style: "flex:1" }),
              h("button", { class: "btn sm", onclick: () => editor(t, paint) }, "Edit")
            ])
          ]);
        })));

        body.appendChild(h("div", { class: "card" }, [
          h("header", null, h("h3", { text: "Dependency check before publishing" })),
          table([
            { label: "Plan", cell: (t) => t.name },
            { label: "Rate profile", cell: (t) => ok(!!S.get.bandwidth(t.bw), t.bw) },
            { label: "IP pool", cell: (t) => { const p = S.db.ipPools.find((x) => x.id === t.pool); return ok(!!p, t.pool + (p ? " · " + (p.size - p.used) + " free" : " missing")); } },
            { label: "Billing cycle", cell: (t) => ok(true, t.cycle + " · " + t.days + "d") },
            { label: "Expiry behaviour", cell: (t) => ok(true, t.cycle === "prepaid" ? "disconnect at expiry" : "grace then suspend") },
            { label: "In use", right: true, cell: (t) => S.db.customers.filter((c) => c.tariff === t.id).length }
          ], S.db.tariffs)
        ]));
      }
      paint();
      return wrap;
    }
  };

  function ok(good, label) {
    return h("span", { style: "color:" + (good ? "var(--good)" : "var(--bad)") }, (good ? "✓ " : "✕ ") + label);
  }

  function editor(t, after) {
    const S = TF.store;
    const isNew = !t;
    t = t || { id: "TP-" + (400 + S.db.tariffs.length), name: "", bw: "BW-30", price: 30000, cycle: "prepaid", days: 30, pool: "POOL-RES-A", fup: 0, segment: "personal", service: "PPPoE" };
    const name = input({ value: t.name, placeholder: "Home Fiber 40" });
    const price = input({ type: "number", value: t.price, step: 1000 });
    const days = input({ type: "number", value: t.days });
    const bw = select(S.db.bandwidths.map((b) => ({ value: b.id, label: `${b.name} — ${b.down}/${b.up} Mbps`, selected: b.id === t.bw })));
    const pool = select(S.db.ipPools.map((p) => ({ value: p.id, label: p.name + " (" + (p.size - p.used) + " free)", selected: p.id === t.pool })));
    const cycle = select([{ value: "prepaid", label: "Prepaid — 30-day package" }, { value: "postpaid", label: "Postpaid — calendar month" }].map((o) => Object.assign(o, { selected: o.value === t.cycle })));
    const service = select(["PPPoE", "Static IP", "Hotspot"].map((s) => ({ value: s, label: s, selected: s === t.service })));
    const fup = input({ type: "number", value: t.fup });

    modal({
      title: isNew ? "New plan" : "Edit " + t.name,
      body: [
        field("Plan name", name),
        h("div", { class: "grid g2" }, [field("Price (MMK)", price), field("Validity (days)", days)]),
        h("div", { class: "grid g2" }, [field("Rate profile", bw), field("IP pool", pool)]),
        h("div", { class: "grid g2" }, [field("Billing cycle", cycle), field("Access type", service)]),
        field("Fair-use cap (GB, 0 = unlimited)", fup),
        h("p", { class: "hint", text: "Test the plan on a staging subscriber before it goes on sale: activate, log in, check the speed, let it expire, and confirm the reminder messages fire." })
      ],
      actions: [{ label: "Cancel" }, {
        label: isNew ? "Publish plan" : "Save changes", tone: "primary", onClick: () => {
          if (!name.value.trim()) { toast("Name the plan", "A plan needs a name customers will recognise", "bad"); return true; }
          S.actions.saveTariff({
            id: t.id, name: name.value.trim(), bw: bw.value, price: Number(price.value),
            cycle: cycle.value, days: Number(days.value), pool: pool.value,
            fup: Number(fup.value), segment: t.segment, service: service.value
          });
          toast(isNew ? "Plan published" : "Plan updated", name.value, "good");
          after();
        }
      }]
    });
  }
})(window.TF = window.TF || {});
