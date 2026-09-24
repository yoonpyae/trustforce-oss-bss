/* Store: indexes over the seed data, topology queries, and every action the
 * demo can perform. Every mutation writes an audit entry, the way the real
 * system is expected to. */
(function (TF) {
  "use strict";

  const db = TF.db;
  const listeners = [];
  const day = 86400000;

  const idx = {};
  function reindex() {
    idx.customer = {}; idx.onu = {}; idx.sn = {}; idx.dn = {}; idx.olt = {};
    idx.tariff = {}; idx.session = {}; idx.nas = {}; idx.bw = {}; idx.fiber = {};
    db.customers.forEach((c) => idx.customer[c.id] = c);
    db.onus.forEach((o) => idx.onu[o.id] = o);
    db.sns.forEach((s) => idx.sn[s.id] = s);
    db.dns.forEach((d) => idx.dn[d.id] = d);
    db.olts.forEach((o) => idx.olt[o.id] = o);
    db.tariffs.forEach((t) => idx.tariff[t.id] = t);
    db.sessions.forEach((s) => idx.session[s.customer] = s);
    db.nasDevices.forEach((n) => idx.nas[n.id] = n);
    db.bandwidths.forEach((b) => idx.bw[b.id] = b);
    db.fibers.forEach((f) => idx.fiber[f.id] = f);
  }
  reindex();

  const get = {
    customer: (id) => idx.customer[id],
    onu: (id) => idx.onu[id],
    sn: (id) => idx.sn[id],
    dn: (id) => idx.dn[id],
    olt: (id) => idx.olt[id],
    tariff: (id) => idx.tariff[id],
    nas: (id) => idx.nas[id],
    bandwidth: (id) => idx.bw[id],
    fiber: (id) => idx.fiber[id],
    session: (customerId) => idx.session[customerId],
    onuOfCustomer: (cid) => db.onus.find((o) => o.customer === cid),
    customersOfSn: (snId) => db.customers.filter((c) => c.sn === snId),
    customersOfDn: (dnId) => db.customers.filter((c) => c.dn === dnId),
    customersOfOlt: (id) => db.customers.filter((c) => c.olt === id),
    snsOfDn: (dnId) => db.sns.filter((s) => s.dn === dnId),
    dnsOfOlt: (id) => db.dns.filter((d) => d.olt === id),
    invoicesOf: (cid) => db.invoices.filter((i) => i.customer === cid),
    paymentsOf: (cid) => db.payments.filter((p) => p.customer === cid),
    ticketsOf: (cid) => db.tickets.filter((t) => t.customer === cid),
    alarmsOf: (objId) => db.alarms.filter((a) => a.object === objId || (a.path || []).indexOf(objId) >= 0)
  };

  /* ---------- topology ---------- */
  // Upstream trace: customer → ONU → SN → DN → fibre → OLT port → OLT
  function tracePath(anyId) {
    const c = idx.customer[anyId];
    const onu = c ? get.onuOfCustomer(c.id) : idx.onu[anyId];
    let sn = null, dn = null, olt = null, oltPort = null, fiber = null, cust = c || null;
    if (onu) { cust = cust || idx.customer[onu.customer]; sn = idx.sn[onu.sn]; }
    if (!sn && idx.sn[anyId]) sn = idx.sn[anyId];
    if (sn) dn = idx.dn[sn.dn];
    if (!dn && idx.dn[anyId]) dn = idx.dn[anyId];
    if (dn) { olt = idx.olt[dn.olt]; oltPort = dn.oltPort; fiber = idx.fiber[dn.fiber]; }
    if (!olt && idx.olt[anyId]) olt = idx.olt[anyId];

    const chain = [];
    if (cust) chain.push({ kind: "Customer", id: cust.id, label: cust.name });
    if (onu) chain.push({ kind: "ONU", id: onu.id, label: onu.vendor + " " + onu.model });
    if (sn) chain.push({ kind: "SN 1:16", id: sn.id, label: sn.zone + " · port " + (onu ? onu.snPort : "—") });
    if (dn) chain.push({ kind: "DN 1:4", id: dn.id, label: dn.zone + " · out " + (sn ? sn.dnPort : "—") });
    if (fiber) chain.push({ kind: "Fibre", id: fiber.id, label: fiber.lengthM + " m · " + fiber.cores + " core" });
    if (oltPort) chain.push({ kind: "PON port", id: oltPort, label: "GPON" });
    if (olt) chain.push({ kind: "OLT", id: olt.id, label: olt.vendor + " " + olt.model });
    return chain.reverse(); // OLT first, customer last
  }

  // What breaks if this object fails
  function impactOf(id) {
    let sns = [], customers = [], label = id;
    if (idx.olt[id]) {
      sns = db.sns.filter((s) => s.olt === id);
      customers = get.customersOfOlt(id);
      label = idx.olt[id].name;
    } else if (idx.dn[id]) {
      sns = get.snsOfDn(id);
      customers = get.customersOfDn(id);
      label = idx.dn[id].name;
    } else if (idx.sn[id]) {
      sns = [idx.sn[id]];
      customers = get.customersOfSn(id);
      label = idx.sn[id].name;
    } else if (idx.fiber[id]) {
      const dn = db.dns.find((d) => d.fiber === id);
      if (dn) { sns = get.snsOfDn(dn.id); customers = get.customersOfDn(dn.id); }
      label = "Fibre " + id;
    } else if (id.indexOf("/S") > 0) {
      const dn = db.dns.find((d) => d.oltPort === id);
      if (dn) { sns = get.snsOfDn(dn.id); customers = get.customersOfDn(dn.id); }
      label = "PON port " + id;
    }
    const revenue = customers.reduce((a, c) => a + (idx.tariff[c.tariff] ? idx.tariff[c.tariff].price : 0), 0);
    const business = customers.filter((c) => c.segment === "business").length;
    return { id, label, sns, customers, revenue, business };
  }

  // Weak points: shared routes, capacity pressure, repeated alarms, poor optics
  function weakPoints() {
    const out = [];
    db.dns.forEach((dn) => {
      const cs = get.customersOfDn(dn.id);
      if (cs.length >= 44) out.push({ type: "Concentration", object: dn.id, detail: cs.length + " subscribers behind one 1:4 node", severity: "major", customers: cs.length });
      if (dn.condition === "attention") out.push({ type: "Physical condition", object: dn.id, detail: "Flagged at last inspection · " + TF.ui.fmt.date(dn.inspected), severity: "minor", customers: cs.length });
    });
    db.sns.forEach((sn) => {
      const used = sn.ports.filter((p) => p.state === "used").length;
      if (used >= 15) out.push({ type: "Capacity", object: sn.id, detail: used + "/16 ports used — no room for new installs", severity: "minor", customers: used });
      const weak = db.onus.filter((o) => o.sn === sn.id && o.rx < -25).length;
      if (weak >= 3) out.push({ type: "Optical budget", object: sn.id, detail: weak + " ONUs below -25 dBm on the same splitter", severity: "critical", customers: get.customersOfSn(sn.id).length });
    });
    db.fibers.forEach((f) => {
      if (f.condition === "attention") {
        const im = impactOf(f.id);
        out.push({ type: "Fibre route", object: f.id, detail: "Route marked for repair · closure " + f.closure, severity: "major", customers: im.customers.length });
      }
    });
    db.olts.forEach((o) => {
      if (o.powerB === "failed") out.push({ type: "Single point of failure", object: o.id, detail: "Running on a single power feed", severity: "critical", customers: get.customersOfOlt(o.id).length });
    });
    const order = { critical: 0, major: 1, minor: 2 };
    return out.sort((a, b) => order[a.severity] - order[b.severity] || b.customers - a.customers);
  }

  /* ---------- global search ---------- */
  function search(q) {
    q = (q || "").trim().toLowerCase();
    if (q.length < 2) return [];
    const hits = [];
    const push = (kind, id, label, sub) => hits.push({ kind, id, label, sub });
    db.customers.forEach((c) => {
      if (c.id.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.login.includes(q) || c.ip.includes(q))
        push("Customer", c.id, c.name, c.id + " · " + c.login + " · " + c.zone);
    });
    db.onus.forEach((o) => {
      if (o.id.toLowerCase().includes(q) || o.serial.toLowerCase().includes(q) || o.mac.toLowerCase().includes(q))
        push("ONU", o.id, o.vendor + " " + o.model, o.serial + " · " + o.mac);
    });
    db.sns.forEach((s) => { if (s.id.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)) push("SN", s.id, s.name, s.ratio + " · " + s.zone); });
    db.dns.forEach((d) => { if (d.id.toLowerCase().includes(q) || d.name.toLowerCase().includes(q)) push("DN", d.id, d.name, d.ratio + " · " + d.zone); });
    db.olts.forEach((o) => { if (o.id.toLowerCase().includes(q) || o.name.toLowerCase().includes(q) || o.ip.includes(q)) push("OLT", o.id, o.name, o.vendor + " " + o.model); });
    db.fibers.forEach((f) => { if (f.id.toLowerCase().includes(q)) push("Fibre", f.id, "Route " + f.id, f.lengthM + " m · " + f.closure); });
    db.invoices.forEach((i) => { if (i.id.toLowerCase().includes(q)) push("Invoice", i.id, i.customerName, TF.ui.fmt.mmk(i.amount) + " · " + i.status); });
    db.tickets.forEach((t) => { if (t.id.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q)) push("Ticket", t.id, t.subject, t.customerName + " · " + t.status); });
    db.vouchers.forEach((v) => { if (v.id.toLowerCase().includes(q)) push("Voucher", v.id, TF.ui.fmt.mmk(v.value), v.status); });
    return hits.slice(0, 24);
  }

  /* ---------- audit ---------- */
  let logSeq = 0;
  function log(action, target, detail) {
    db.audit.unshift({
      kind: "AUDIT", id: "LOG-" + (99000 + ++logSeq),
      actor: TF.state.user.login, action, target, detail,
      ip: "10.10.4.11", at: Date.now()
    });
  }

  /* ---------- actions ---------- */
  const actions = {
    recharge(customerId, opts) {
      const c = get.customer(customerId);
      const t = get.tariff(opts.tariff || c.tariff);
      const base = c.expiry > db.meta.now ? c.expiry : db.meta.now;
      c.tariff = t.id;
      c.expiry = base + t.days * day;
      c.status = "active";
      const inv = {
        kind: "INVOICE", id: "INV-" + (27000 + db.invoices.length),
        customer: c.id, customerName: c.name, tariff: t.id,
        amount: t.price, tax: Math.round(t.price * 0.05),
        issued: db.meta.now, due: db.meta.now + 7 * day,
        status: "paid", method: opts.method,
        period: TF.ui.fmt.iso(base) + " → " + TF.ui.fmt.iso(c.expiry)
      };
      db.invoices.unshift(inv);
      db.payments.unshift({
        kind: "PAYMENT", id: "PMT-" + (42000 + db.payments.length),
        invoice: inv.id, customer: c.id, customerName: c.name,
        amount: inv.amount + inv.tax, method: opts.method, at: db.meta.now, reconciled: true
      });
      if (opts.method === "Wallet balance") c.balance = Math.max(0, c.balance - (inv.amount + inv.tax));
      const s = get.session(c.id);
      if (s) { s.online = true; }
      const onu = get.onuOfCustomer(c.id);
      if (onu) onu.online = true;
      log("Recharge", c.id, t.name + " · " + opts.method + " · " + TF.ui.fmt.mmk(inv.amount));
      emit();
      return inv;
    },

    addBalance(customerId, amount, note) {
      const c = get.customer(customerId);
      c.balance += amount;
      log("Wallet top-up", c.id, TF.ui.fmt.mmk(amount) + (note ? " · " + note : ""));
      emit();
    },

    grace(customerId, days) {
      const c = get.customer(customerId);
      c.expiry = Math.max(c.expiry, db.meta.now) + days * day;
      c.status = "grace";
      log("Grace extension", c.id, days + " day extension granted");
      emit();
    },

    setStatus(customerId, status) {
      const c = get.customer(customerId);
      c.status = status;
      const s = get.session(c.id);
      if (s && status !== "active") { s.online = false; s.rxMbps = 0; s.txMbps = 0; s.uptimeS = 0; }
      log("Subscriber status", c.id, "→ " + status);
      emit();
    },

    coa(customerId, mode) {
      const c = get.customer(customerId);
      const s = get.session(c.id);
      const onu = get.onuOfCustomer(c.id);
      if (mode === "disconnect") {
        if (s) { s.online = false; s.rxMbps = 0; s.txMbps = 0; s.uptimeS = 0; }
        if (onu) { onu.online = false; onu.lastSeen = db.meta.now; }
      } else {
        if (s) { s.online = true; s.uptimeS = 30; }
        if (onu) { onu.online = true; onu.lastSeen = db.meta.now; }
      }
      log("RADIUS CoA", c.id, mode === "disconnect" ? "Packet-of-Disconnect sent to " + c.nas : "Session re-authorised on " + c.nas);
      emit();
      return true;
    },

    changePlan(customerId, tariffId, prorate) {
      const c = get.customer(customerId);
      const from = get.tariff(c.tariff), to = get.tariff(tariffId);
      const remaining = Math.max(0, Math.round((c.expiry - db.meta.now) / day));
      const delta = prorate ? Math.round(((to.price - from.price) / 30) * remaining) : 0;
      c.tariff = tariffId;
      c.pool = to.pool;
      log("Plan change", c.id, from.name + " → " + to.name + (prorate ? " · prorated " + TF.ui.fmt.mmk(delta) : ""));
      emit();
      return delta;
    },

    syncRadius(customerId) {
      const c = get.customer(customerId);
      log("FreeRADIUS sync", c.id, "Credentials and rate-limit pushed to " + c.nas);
      emit();
    },

    rebootOnu(onuId) {
      const o = get.onu(onuId);
      o.uptimeH = 0;
      o.lastSeen = db.meta.now;
      log("ONU reboot", onuId, "Remote reboot issued from OLT " + o.olt);
      emit();
    },

    setPonPort(oltId, portId, admin) {
      const olt = get.olt(oltId);
      const p = olt.ports.find((x) => x.id === portId);
      p.admin = admin;
      p.oper = admin === "enabled" ? "up" : "down";
      log("PON port " + admin, portId, "Administrative state changed");
      emit();
    },

    ackAlarm(alarmId) {
      const a = db.alarms.find((x) => x.id === alarmId);
      a.state = "cleared";
      a.cleared = db.meta.now;
      log("Alarm cleared", alarmId, a.code + " on " + a.object);
      emit();
    },

    alarmToTicket(alarmId) {
      const a = db.alarms.find((x) => x.id === alarmId);
      const c = a.customer ? get.customer(a.customer) : null;
      const t = {
        kind: "TICKET", id: "TKT-" + (3200 + db.tickets.length),
        subject: a.label + " on " + a.object, category: "Fault",
        customer: c ? c.id : null, customerName: c ? c.name : "Network object",
        zone: c ? c.zone : "-", priority: a.severity === "critical" ? "urgent" : "high",
        status: "open", tech: null,
        created: db.meta.now, updated: db.meta.now, sla: db.meta.now + 8 * 3600000,
        notes: [{ at: db.meta.now, by: "alarm-engine", text: a.detail }]
      };
      db.tickets.unshift(t);
      log("Ticket raised from alarm", t.id, alarmId + " · " + a.code);
      emit();
      return t;
    },

    moveTicket(ticketId, status, tech) {
      const t = db.tickets.find((x) => x.id === ticketId);
      t.status = status;
      t.updated = db.meta.now;
      if (tech) t.tech = tech;
      t.notes.push({ at: db.meta.now, by: TF.state.user.login, text: "Moved to " + status + (tech ? " · " + tech : "") });
      log("Ticket " + status, ticketId, tech ? "Assigned to " + tech : "Status change");
      emit();
    },

    generateVouchers(count, value, batch) {
      const made = [];
      for (let i = 0; i < count; i++) {
        const v = {
          kind: "VOUCHER",
          id: "TF-" + String(Math.floor(100000 + Math.random() * 899999)) + "-" + String(100 + Math.floor(Math.random() * 899)),
          value, batch, status: "unused", usedBy: null, usedAt: null,
          createdAt: db.meta.now, createdBy: TF.state.user.login
        };
        db.vouchers.unshift(v);
        made.push(v);
      }
      log("Voucher batch generated", batch, count + " × " + TF.ui.fmt.mmk(value));
      emit();
      return made;
    },

    redeemVoucher(code, customerId) {
      const v = db.vouchers.find((x) => x.id.toUpperCase() === code.toUpperCase().trim());
      if (!v) return { ok: false, msg: "No voucher matches that code." };
      if (v.status === "used") return { ok: false, msg: "Voucher already redeemed on " + TF.ui.fmt.date(v.usedAt) + "." };
      v.status = "used"; v.usedBy = customerId; v.usedAt = db.meta.now;
      actions.addBalance(customerId, v.value, "voucher " + v.id);
      log("Voucher redeemed", v.id, customerId + " · " + TF.ui.fmt.mmk(v.value));
      emit();
      return { ok: true, voucher: v };
    },

    issueStock(itemId, qty, to) {
      const it = db.inventory.find((x) => x.id === itemId);
      if (it.stock - qty < 0) return false;
      it.stock -= qty;
      log("Stock issued", itemId, qty + " " + it.unit + " → " + to);
      emit();
      return true;
    },

    receiveStock(itemId, qty, ref) {
      const it = db.inventory.find((x) => x.id === itemId);
      it.stock += qty;
      log("Stock received", itemId, "+" + qty + " " + it.unit + " · " + ref);
      emit();
    },

    sendCampaign(name, audience, channel, recipients, testMode) {
      const c = {
        id: "CMP-" + (15 + db.campaigns.length), name, audience, channel,
        sent: testMode ? 0 : recipients.length,
        delivered: testMode ? 0 : Math.max(0, recipients.length - Math.round(recipients.length * 0.03)),
        failed: testMode ? 0 : Math.round(recipients.length * 0.03),
        at: db.meta.now, testMode: !!testMode
      };
      db.campaigns.unshift(c);
      log(testMode ? "Message test run" : "Campaign sent", c.id, audience + " · " + recipients.length + " recipients · " + channel);
      emit();
      return c;
    },

    saveTariff(t) {
      const found = db.tariffs.find((x) => x.id === t.id);
      if (found) Object.assign(found, t); else db.tariffs.push(t);
      reindex();
      log(found ? "Tariff updated" : "Tariff created", t.id, t.name + " · " + TF.ui.fmt.mmk(t.price));
      emit();
    },

    addCustomer(c) {
      db.customers.unshift(c);
      reindex();
      log("Subscriber created", c.id, c.name + " · " + c.zone);
      emit();
    }
  };

  /* ---------- derived metrics ---------- */
  function metrics() {
    const active = db.customers.filter((c) => c.status === "active").length;
    const online = db.sessions.filter((s) => s.online).length;
    const expiring = db.customers.filter((c) => c.expiry > db.meta.now && c.expiry < db.meta.now + 7 * day).length;
    const overdue = db.invoices.filter((i) => i.status === "overdue");
    const mrr = db.customers.filter((c) => c.status === "active")
      .reduce((a, c) => a + (get.tariff(c.tariff) ? get.tariff(c.tariff).price : 0), 0);
    const collected30 = db.payments.filter((p) => p.at > db.meta.now - 30 * day).reduce((a, p) => a + p.amount, 0);
    const issued30 = db.invoices.filter((i) => i.issued > db.meta.now - 30 * day);
    const billed30 = issued30.reduce((a, i) => a + i.amount + i.tax, 0);
    const settled30 = issued30.filter((i) => i.status === "paid").reduce((a, i) => a + i.amount + i.tax, 0);
    const weakOptics = db.onus.filter((o) => o.rx < -25).length;
    return {
      subscribers: db.customers.length,
      active, online,
      offline: db.sessions.length - online,
      expiring,
      overdueCount: overdue.length,
      overdueValue: overdue.reduce((a, i) => a + i.amount + i.tax, 0),
      mrr, collected30, billed30,
      settled30,
      collection: billed30 ? (settled30 / billed30) * 100 : 0,
      alarms: db.alarms.filter((a) => a.state === "active").length,
      critical: db.alarms.filter((a) => a.state === "active" && a.severity === "critical").length,
      openTickets: db.tickets.filter((t) => t.status !== "resolved").length,
      weakOptics,
      olts: db.olts.length, dns: db.dns.length, sns: db.sns.length, onus: db.onus.length,
      snPortsUsed: db.sns.reduce((a, s) => a + s.ports.filter((p) => p.state === "used").length, 0),
      snPortsTotal: db.sns.length * 16
    };
  }

  // 12-month revenue history, derived from payments plus a seeded ramp
  function revenueSeries(months) {
    months = months || 12;
    const out = [];
    for (let i = months - 1; i >= 0; i--) {
      const from = db.meta.now - (i + 1) * 30 * day, to = db.meta.now - i * 30 * day;
      const v = db.payments.filter((p) => p.at >= from && p.at < to).reduce((a, p) => a + p.amount, 0);
      out.push({
        label: new Date(to).toLocaleString("en", { month: "short" }),
        value: v || Math.round(metrics().mrr * (0.62 + 0.03 * (months - i)))
      });
    }
    return out;
  }

  function subscriberGrowth(months) {
    const out = [];
    for (let i = months - 1; i >= 0; i--) {
      const at = db.meta.now - i * 30 * day;
      out.push({
        label: new Date(at).toLocaleString("en", { month: "short" }),
        value: db.customers.filter((c) => c.installed <= at).length
      });
    }
    return out;
  }

  // Optical history for an ONU: 30 daily readings with a deterministic drift
  function opticalHistory(onuId, days) {
    days = days || 30;
    const o = get.onu(onuId);
    let seed = 0;
    for (let i = 0; i < onuId.length; i++) seed += onuId.charCodeAt(i) * (i + 3);
    const drift = o.rx < -25 ? 0.13 : 0.02;
    const pts = [], labels = [];
    for (let d = days - 1; d >= 0; d--) {
      const wob = Math.sin((seed + d) * 0.7) * 0.35 + Math.cos((seed + d) * 0.31) * 0.22;
      pts.push(+(o.rx + drift * d + wob).toFixed(2));
      labels.push(new Date(db.meta.now - d * day).getDate() + "");
    }
    return { points: pts, labels };
  }

  /* ---------- live tick ---------- */
  function startLive() {
    setInterval(() => {
      let touched = false;
      db.sessions.forEach((s) => {
        if (!s.online) return;
        s.uptimeS += 4;
        const jitter = (Math.random() - 0.45) * s.capDown * 0.08;
        s.rxMbps = Math.max(0.1, Math.min(s.capDown, +(s.rxMbps + jitter).toFixed(1)));
        s.txMbps = Math.max(0.05, Math.min(s.capUp, +(s.txMbps + jitter * 0.4).toFixed(1)));
        s.totalGB = +(s.totalGB + s.rxMbps * 0.0005).toFixed(2);
        touched = true;
      });
      if (touched) listeners.forEach((fn) => fn("tick"));
    }, 4000);
  }

  function emit(kind) { listeners.forEach((fn) => fn(kind || "change")); }
  function onChange(fn) { listeners.push(fn); }

  TF.state = {
    user: { name: "Hein Htet Aung", login: "admin.hein", role: "System administrator" },
    route: "dashboard"
  };
  TF.store = { db, get, actions, metrics, search, tracePath, impactOf, weakPoints, revenueSeries, subscriberGrowth, opticalHistory, onChange, emit, log, startLive, reindex };
})(window.TF = window.TF || {});
