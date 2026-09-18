(function (TF) {
  "use strict";
  const U = TF.ui;
  const { h, fmt, pill, table, modal, toast, select, input, field, tabs } = U;

  TF.views.inventory = {
    title: "Inventory",
    subtitle: "Stock, serial numbers and who is holding what. Hardware leaves the warehouse bound either to a subscriber or to a technician's van, never to nobody.",
    render() {
      return tabs([
        { id: "stock", label: "Warehouse", render: stock },
        { id: "bound", label: "Assets with customers", render: bound }
      ]);
    }
  };

  function stock() {
    const S = TF.store;
    const body = h("div");
    function paint() {
      U.clear(body);
      const inv = S.db.inventory;
      const low = inv.filter((i) => i.stock <= i.min);
      body.appendChild(h("div", { class: "grid g4" }, [
        box("Line items", inv.length),
        box("Below reorder point", low.length, low.length ? "var(--warn)" : "var(--good)"),
        box("Stock value", fmt.money(inv.reduce((a, i) => a + i.stock * i.cost, 0)) + " MMK"),
        box("Reserved for jobs", inv.reduce((a, i) => a + i.reserved, 0))
      ]));
      if (low.length) {
        body.appendChild(h("div", { class: "card", style: "border-color:var(--warn)" }, [
          h("h3", { text: "Reorder before the next install wave" }),
          h("p", { class: "hint", text: low.map((i) => `${i.name} (${i.stock} ${i.unit} left, minimum ${i.min})`).join(" · ") })
        ]));
      }
      body.appendChild(h("div", { class: "card" }, [
        h("header", null, [h("h3", { text: "Stock on hand" }), h("div", { style: "flex:1" }),
        h("button", { class: "btn sm", onclick: () => U.csv("inventory.csv", cols, inv) }, "Export CSV")]),
        table(cols.concat([{
          label: "", right: true, cell: (i) => h("div", { class: "row" }, [
            h("button", { class: "btn sm", onclick: () => issue(i, paint) }, "Issue"),
            h("button", { class: "btn sm", onclick: () => receive(i, paint) }, "Receive")
          ])
        }]), inv)
      ]));
    }
    const cols = [
      { label: "Item", cell: (i) => h("div", null, [h("div", { text: i.name }), h("div", { class: "hint num", text: i.id })]), raw: (i) => i.name },
      { label: "Category", cell: (i) => i.category },
      { label: "On hand", right: true, cell: (i) => h("span", { class: "num", style: i.stock <= i.min ? "color:var(--warn)" : null, text: i.stock + " " + i.unit }), raw: (i) => i.stock },
      { label: "Reserved", right: true, cell: (i) => h("span", { class: "num", text: i.reserved }) },
      { label: "Reorder at", right: true, cell: (i) => h("span", { class: "num", text: i.min }) },
      { label: "Unit cost", right: true, cell: (i) => h("span", { class: "num", text: fmt.money(i.cost) }) },
      { label: "Location", cell: (i) => i.location }
    ];
    paint();
    return body;
  }

  function issue(item, after) {
    const S = TF.store;
    const qty = input({ type: "number", value: 1, min: 1, max: item.stock });
    const toWhom = select([
      { value: "Ko Myo (Van 1)", label: "Technician — Ko Myo (Van 1)" },
      { value: "U Thura (Van 2)", label: "Technician — U Thura (Van 2)" },
      { value: "Ko Hein (Van 3)", label: "Technician — Ko Hein (Van 3)" },
      { value: "Direct to subscriber", label: "Direct to subscriber" }
    ]);
    const ref = input({ placeholder: "Ticket or job reference, e.g. TKT-3108" });
    modal({
      title: "Issue " + item.name,
      body: [field("Quantity", qty), field("Issued to", toWhom), field("Reference", ref),
      h("p", { class: "hint", text: "Consumables are deducted automatically when the technician closes the ticket in the field app; this form is for counter issues." })],
      actions: [{ label: "Cancel" }, {
        label: "Issue stock", tone: "primary", onClick: () => {
          if (!S.actions.issueStock(item.id, Number(qty.value), toWhom.value + (ref.value ? " · " + ref.value : ""))) {
            toast("Not enough stock", "Only " + item.stock + " " + item.unit + " on hand", "bad"); return true;
          }
          toast("Stock issued", qty.value + " " + item.unit + " → " + toWhom.value, "good");
          after();
        }
      }]
    });
  }

  function receive(item, after) {
    const qty = input({ type: "number", value: 20, min: 1 });
    const ref = input({ placeholder: "Purchase order or delivery note" });
    modal({
      title: "Receive " + item.name,
      body: [field("Quantity", qty), field("Reference", ref)],
      actions: [{ label: "Cancel" }, {
        label: "Receive", tone: "primary", onClick: () => {
          TF.store.actions.receiveStock(item.id, Number(qty.value), ref.value || "no reference");
          toast("Stock received", "+" + qty.value + " " + item.unit, "good");
          after();
        }
      }]
    });
  }

  function bound() {
    const S = TF.store;
    const rows = S.db.onus.slice(0, 60).map((o) => ({ o, c: S.get.customer(o.customer) }));
    return h("div", { class: "card" }, [
      h("header", null, [h("h3", { text: "Hardware bound to subscribers" }),
      h("span", { class: "hint", text: "Serial and MAC are written to the subscriber record at installation, so a swap is traceable." })]),
      table([
        { label: "Asset", cell: (r) => h("span", { class: "num", text: r.o.id }) },
        { label: "Device", cell: (r) => r.o.vendor + " " + r.o.model },
        { label: "Serial", cell: (r) => h("span", { class: "num", text: r.o.serial }) },
        { label: "MAC", cell: (r) => h("span", { class: "num", text: r.o.mac }) },
        { label: "Subscriber", cell: (r) => r.c ? r.c.name : "—" },
        { label: "Position", cell: (r) => h("span", { class: "hint num", text: r.o.sn + ":" + r.o.snPort }) },
        { label: "State", cell: (r) => pill(r.o.online ? "online" : "offline", r.o.online ? "online" : "offline") }
      ], rows, { onRow: (r) => r.c && TF.openCustomer(r.c.id) })
    ]);
  }

  function box(label, value, color) {
    return h("div", { class: "card kpi" }, [h("span", { class: "label", text: label }), h("span", { class: "value", style: "font-size:24px" + (color ? ";color:" + color : ""), text: value })]);
  }
})(window.TF = window.TF || {});
