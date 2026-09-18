/* TrustForce OSS/BSS — demo dataset.
 * Deterministic: the same seed always produces the same network, so screenshots,
 * reports and the ODN topology stay stable between reloads.
 */
(function (TF) {
  "use strict";

  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  const R = rng(20260918);
  const pick = (a) => a[Math.floor(R() * a.length)];
  const int = (lo, hi) => lo + Math.floor(R() * (hi - lo + 1));
  const chance = (p) => R() < p;
  const day = 86400000;
  const NOW = new Date("2026-09-18T09:20:00+06:30").getTime();

  const FIRST_M = ["Aung", "Kyaw", "Zaw", "Thura", "Nay", "Myo", "Hein", "Wai", "Thet", "Ko", "Soe", "Min", "Phyo", "Yan"];
  const FIRST_F = ["Ei", "Thiri", "Nilar", "Hnin", "Su", "Yamin", "Khin", "Moe", "Nandar", "Phyu", "Zin", "Thandar"];
  const LAST = ["Win", "Naing", "Oo", "Htun", "Lwin", "Aye", "Maung", "Hlaing", "Myint", "Thein", "Zaw", "Kyi", "Moe", "Phyo"];
  const ORGS = ["Shwe Pyi Trading", "Golden Valley Hotel", "Yangon Tech Hub", "Ayeyar Mart", "Sein Lan Clinic",
    "Mingalar Logistics", "Delta Coffee House", "Pyin Oo Lwin Resort", "Thiri Dental", "Star Print House",
    "Nova Coworking", "City Mart Express", "Bagan Tours", "Royal Textile", "Green Leaf Academy"];

  const ZONES = [
    { zone: "Hlaing", lat: 16.8560, lng: 96.1250 },
    { zone: "Kamayut", lat: 16.8235, lng: 96.1315 },
    { zone: "Insein", lat: 16.9000, lng: 96.1050 },
    { zone: "Thingangyun", lat: 16.8250, lng: 96.1880 },
    { zone: "South Okkalapa", lat: 16.8420, lng: 96.1960 },
    { zone: "Mayangone", lat: 16.8700, lng: 96.1420 }
  ];

  /* ---------------- tariffs ---------------- */
  const bandwidths = [
    { id: "BW-10", name: "Home 10M", down: 10, up: 5, burst: "15M/8M", priority: 6 },
    { id: "BW-20", name: "Home 20M", down: 20, up: 10, burst: "28M/14M", priority: 5 },
    { id: "BW-30", name: "Home 30M", down: 30, up: 15, burst: "40M/20M", priority: 5 },
    { id: "BW-50", name: "Home 50M", down: 50, up: 25, burst: "65M/30M", priority: 4 },
    { id: "BW-100", name: "Pro 100M", down: 100, up: 50, burst: "120M/60M", priority: 3 },
    { id: "BW-200", name: "Business 200M", down: 200, up: 200, burst: "-", priority: 2 },
    { id: "BW-500", name: "Dedicated 500M", down: 500, up: 500, burst: "-", priority: 1 }
  ];

  const tariffs = [
    { id: "TP-101", name: "Home Fiber 10", bw: "BW-10", price: 18000, cycle: "prepaid", days: 30, pool: "POOL-RES-A", fup: 0, segment: "personal", service: "PPPoE" },
    { id: "TP-102", name: "Home Fiber 20", bw: "BW-20", price: 25000, cycle: "prepaid", days: 30, pool: "POOL-RES-A", fup: 0, segment: "personal", service: "PPPoE" },
    { id: "TP-103", name: "Home Fiber 30", bw: "BW-30", price: 33000, cycle: "prepaid", days: 30, pool: "POOL-RES-B", fup: 600, segment: "personal", service: "PPPoE" },
    { id: "TP-104", name: "Home Fiber 50", bw: "BW-50", price: 45000, cycle: "prepaid", days: 30, pool: "POOL-RES-B", fup: 1000, segment: "personal", service: "PPPoE" },
    { id: "TP-201", name: "SME Fiber 100", bw: "BW-100", price: 95000, cycle: "postpaid", days: 30, pool: "POOL-BIZ", fup: 0, segment: "business", service: "PPPoE" },
    { id: "TP-202", name: "Business Static 200", bw: "BW-200", price: 185000, cycle: "postpaid", days: 30, pool: "POOL-STATIC", fup: 0, segment: "business", service: "Static IP" },
    { id: "TP-203", name: "Dedicated Line 500", bw: "BW-500", price: 620000, cycle: "postpaid", days: 30, pool: "POOL-STATIC", fup: 0, segment: "business", service: "Static IP" },
    { id: "TP-301", name: "Hotspot Day Pass", bw: "BW-10", price: 1500, cycle: "prepaid", days: 1, pool: "POOL-HOTSPOT", fup: 0, segment: "personal", service: "Hotspot" }
  ];

  const ipPools = [
    { id: "POOL-RES-A", name: "Residential A", range: "10.20.0.2 – 10.20.7.254", size: 2046, used: 0, nas: "NAS-CORE-01" },
    { id: "POOL-RES-B", name: "Residential B", range: "10.21.0.2 – 10.21.7.254", size: 2046, used: 0, nas: "NAS-CORE-01" },
    { id: "POOL-BIZ", name: "Business CGNAT", range: "10.40.0.2 – 10.40.3.254", size: 1022, used: 0, nas: "NAS-CORE-02" },
    { id: "POOL-STATIC", name: "Public /24 block", range: "103.86.14.2 – 103.86.14.254", size: 253, used: 0, nas: "NAS-CORE-02" },
    { id: "POOL-HOTSPOT", name: "Hotspot captive", range: "172.22.0.2 – 172.22.3.254", size: 1022, used: 0, nas: "NAS-EDGE-03" }
  ];

  const nasDevices = [
    { id: "NAS-CORE-01", name: "Hlaing Core BNG", vendor: "MikroTik", model: "CCR2216-1G-12XS-2XQ", ip: "10.10.0.1", apiPort: 8728, secret: "••••••••••", status: "online", zone: "Hlaing", type: "mikrotik", sessions: 0, cpu: 34, uptime: "63d 04h" },
    { id: "NAS-CORE-02", name: "Kamayut Core BNG", vendor: "Cisco", model: "ASR 1001-X", ip: "10.10.0.2", apiPort: 22, secret: "••••••••••", status: "online", zone: "Kamayut", type: "cisco", sessions: 0, cpu: 51, uptime: "121d 17h" },
    { id: "NAS-EDGE-03", name: "Insein Edge", vendor: "MikroTik", model: "CCR1036-8G-2S+", ip: "10.10.0.3", apiPort: 8728, secret: "••••••••••", status: "online", zone: "Insein", type: "mikrotik", sessions: 0, cpu: 22, uptime: "9d 11h" },
    { id: "NAS-EDGE-04", name: "Thingangyun Edge", vendor: "Huawei", model: "NetEngine 8000 M1C", ip: "10.10.0.4", apiPort: 22, secret: "••••••••••", status: "degraded", zone: "Thingangyun", type: "huawei", sessions: 0, cpu: 78, uptime: "2d 03h" }
  ];

  /* ---------------- optical distribution network ---------------- */
  const olts = [];
  const dns = [];
  const sns = [];
  const fibers = [];
  const customers = [];
  const onus = [];

  const OLT_DEF = [
    { id: "OLT-01", name: "Hlaing Central OLT", vendor: "Huawei", model: "MA5800-X7", ip: "10.30.1.1", zone: "Hlaing", slots: 2, portsPerSlot: 8, nas: "NAS-CORE-01" },
    { id: "OLT-02", name: "Kamayut OLT", vendor: "ZTE", model: "C320", ip: "10.30.1.2", zone: "Kamayut", slots: 2, portsPerSlot: 8, nas: "NAS-CORE-02" },
    { id: "OLT-03", name: "Insein North OLT", vendor: "Huawei", model: "MA5608T", ip: "10.30.1.3", zone: "Insein", slots: 1, portsPerSlot: 8, nas: "NAS-EDGE-03" }
  ];

  let dnSeq = 0, snSeq = 0, fbSeq = 0, cusSeq = 0;

  OLT_DEF.forEach((def, oi) => {
    const zone = ZONES.find((z) => z.zone === def.zone) || ZONES[0];
    const olt = {
      kind: "OLT",
      id: def.id,
      name: def.name,
      vendor: def.vendor,
      model: def.model,
      serial: "SN" + (7100000 + oi * 137),
      firmware: def.vendor === "Huawei" ? "V800R021C10" : "V2.1.0P3",
      hardware: "Rev. C",
      ip: def.ip,
      zone: def.zone,
      site: def.zone + " POP",
      nas: def.nas,
      lat: zone.lat + (R() - 0.5) * 0.012,
      lng: zone.lng + (R() - 0.5) * 0.012,
      installed: NOW - int(420, 1400) * day,
      lastReboot: NOW - int(9, 180) * day,
      adminStatus: "enabled",
      operStatus: oi === 2 ? "degraded" : "up",
      temperature: 38 + int(0, 9),
      fan: "normal",
      powerA: "ok",
      powerB: oi === 2 ? "failed" : "ok",
      load: int(28, 72),
      ports: []
    };

    for (let s = 1; s <= def.slots; s++) {
      for (let p = 1; p <= def.portsPerSlot; p++) {
        const active = (s - 1) * def.portsPerSlot + p <= (oi === 2 ? 4 : 6);
        const port = {
          id: `${def.id}/S${s}/P${p}`,
          slot: s,
          port: p,
          type: "GPON",
          admin: active ? "enabled" : "disabled",
          oper: active ? "up" : "down",
          txPower: -(1.5 + R() * 1.2),
          onuCount: 0,
          rx: 0,
          tx: 0,
          dn: null
        };
        olt.ports.push(port);

        if (!active) continue;

        // one feeder fibre per live PON port, terminating on a 1x4 distribution node
        const fiber = {
          kind: "FIBER",
          id: "F-" + String(++fbSeq).padStart(3, "0"),
          from: port.id,
          cores: 24,
          coreUsed: int(4, 18),
          lengthM: int(420, 3400),
          route: "kmz/route-" + String(fbSeq).padStart(3, "0") + ".kmz",
          closure: "CL-" + String(int(1, 9)).padStart(2, "0"),
          condition: chance(0.12) ? "attention" : "good"
        };
        fibers.push(fiber);

        const dn = {
          kind: "DN",
          id: "DN-" + String(++dnSeq).padStart(3, "0"),
          name: `${def.zone} DN ${dnSeq}`,
          zone: def.zone,
          ratio: "1:4",
          oltPort: port.id,
          olt: def.id,
          fiber: fiber.id,
          lat: zone.lat + (R() - 0.5) * 0.02,
          lng: zone.lng + (R() - 0.5) * 0.02,
          installed: NOW - int(120, 900) * day,
          inspected: NOW - int(5, 220) * day,
          condition: chance(0.15) ? "attention" : "good",
          insertionLoss: 7.2 + R() * 0.6,
          photo: true,
          comment: chance(0.2) ? "Pole-mounted, needs cable tie replacement" : "",
          outputs: []
        };
        port.dn = dn.id;
        fiber.to = dn.id;

        const snCount = int(2, 4);
        for (let o = 1; o <= 4; o++) {
          if (o > snCount) {
            dn.outputs.push({ port: o, sn: null, state: chance(0.4) ? "reserved" : "free" });
            continue;
          }
          const sn = {
            kind: "SN",
            id: "SN-" + String(++snSeq).padStart(3, "0"),
            name: `${def.zone} SN ${snSeq}`,
            zone: def.zone,
            ratio: "1:16",
            dn: dn.id,
            dnPort: o,
            olt: def.id,
            oltPort: port.id,
            fiber: fiber.id,
            lat: dn.lat + (R() - 0.5) * 0.008,
            lng: dn.lng + (R() - 0.5) * 0.008,
            installed: dn.installed + int(5, 90) * day,
            condition: chance(0.12) ? "attention" : "good",
            insertionLoss: 13.5 + R() * 0.8,
            photo: true,
            ports: []
          };
          dn.outputs.push({ port: o, sn: sn.id, state: "used" });
          sns.push(sn);
        }
        dns.push(dn);
      }
    }
    olts.push(olt);
  });

  /* ---------------- subscribers hanging off SN ports ---------------- */
  function rollStatus() {
    const r = R();
    if (r < 0.88) return "active";
    if (r < 0.92) return "grace";
    if (r < 0.95) return "suspended";
    return "expired";
  }
  const ONU_VENDOR = [
    { v: "Huawei", m: "EG8145V5" },
    { v: "ZTE", m: "F670L" },
    { v: "Nokia", m: "G-140W-C" },
    { v: "VSOL", m: "V2802RH" }
  ];

  sns.forEach((sn) => {
    const fill = int(8, 16);
    const olt = olts.find((o) => o.id === sn.olt);
    for (let p = 1; p <= 16; p++) {
      if (p > fill) {
        sn.ports.push({ port: p, customer: null, state: chance(0.25) ? "reserved" : "free" });
        continue;
      }
      cusSeq++;
      const isBiz = chance(0.16);
      const gender = chance(0.5);
      const name = isBiz ? pick(ORGS) : `${chance(0.5) ? (gender ? "U " : "Daw ") : ""}${gender ? pick(FIRST_M) : pick(FIRST_F)} ${pick(LAST)}`;
      const tariff = isBiz ? pick(tariffs.filter((t) => t.segment === "business")) : pick(tariffs.filter((t) => t.segment === "personal" && t.days === 30));
      const status = rollStatus();
      const installed = NOW - int(20, 700) * day;
      const dnObj = dns.find((d) => d.id === sn.dn);
      const dev = pick(ONU_VENDOR);

      // optical budget accumulates loss along the path, plus distance attenuation
      const distance = int(620, 4200);
      const rx = -(8.5 + dnObj.insertionLoss * 0.45 + sn.insertionLoss * 0.55 + distance * 0.00035 * 3 + R() * 1.8);
      const offline = status === "suspended" || status === "expired" || chance(0.07);

      const id = "CUS-" + String(cusSeq).padStart(4, "0");
      const onu = {
        kind: "ONU",
        id: "ONU-" + String(cusSeq).padStart(4, "0"),
        customer: id,
        serial: dev.v.slice(0, 4).toUpperCase() + String(10000000 + cusSeq * 7919).slice(0, 8),
        mac: ["48", "3F", "DA", String(16 + (cusSeq % 200)).padStart(2, "0"), String(10 + (cusSeq % 90)).padStart(2, "0"), String(cusSeq % 100).padStart(2, "0")].join(":"),
        vendor: dev.v,
        model: dev.m,
        firmware: "V5R0" + int(18, 22) + "C00",
        sn: sn.id,
        snPort: p,
        dn: sn.dn,
        olt: sn.olt,
        oltPort: sn.oltPort,
        fiber: sn.fiber,
        distance,
        rx: +rx.toFixed(1),
        tx: +(1.6 + R() * 0.9).toFixed(1),
        oltRx: +(rx - 0.4 - R() * 0.6).toFixed(1),
        temperature: 42 + int(0, 14),
        voltage: +(3.24 + R() * 0.08).toFixed(2),
        cpu: int(8, 62),
        mem: int(30, 78),
        online: !offline,
        lastSeen: offline ? NOW - int(1, 96) * 3600000 : NOW - int(0, 8) * 60000,
        uptimeH: offline ? 0 : int(3, 1400),
        wifiSsid: isBiz ? name.split(" ")[0] + "-NET" : "TrustForce-" + String(cusSeq).padStart(4, "0"),
        lastConfig: NOW - int(2, 300) * day
      };
      onus.push(onu);

      const expiryBase = status === "expired" ? NOW - int(2, 40) * day
        : status === "grace" ? NOW - int(1, 4) * day
          : NOW + int(1, 29) * day;
      const zone = ZONES.find((z) => z.zone === sn.zone) || ZONES[0];

      customers.push({
        kind: "CUSTOMER",
        id,
        name,
        segment: isBiz ? "business" : "personal",
        phone: "09" + int(700000000, 799999999),
        email: (isBiz ? name.toLowerCase().replace(/[^a-z]+/g, ".") : "sub" + cusSeq) + "@example.mm",
        address: `No.${int(1, 240)}, ${int(1, 12)}${["st", "nd", "rd", "th"][Math.min(3, int(0, 3))]} Street, ${sn.zone}`,
        zone: sn.zone,
        lat: sn.lat + (R() - 0.5) * 0.006,
        lng: sn.lng + (R() - 0.5) * 0.006,
        service: tariff.service,
        tariff: tariff.id,
        billing: tariff.cycle,
        status,
        balance: chance(0.3) ? int(0, 60) * 1000 : 0,
        login: (isBiz ? "biz" : "res") + String(cusSeq).padStart(4, "0"),
        secret: "••••••••",
        ip: tariff.pool === "POOL-STATIC" ? "103.86.14." + (2 + (cusSeq % 250)) : "10.2" + (tariff.pool === "POOL-RES-B" ? 1 : 0) + "." + int(0, 7) + "." + int(2, 254),
        pool: tariff.pool,
        nas: olt.nas,
        onu: onu.id,
        sn: sn.id,
        snPort: p,
        dn: sn.dn,
        olt: sn.olt,
        oltPort: sn.oltPort,
        installed,
        activated: installed,
        expiry: expiryBase,
        lastInvoice: null,
        autoRenew: chance(0.7),
        contract: isBiz ? int(12, 24) + " months" : "monthly",
        notes: ""
      });
      sn.ports.push({ port: p, customer: id, state: "used" });
    }
  });

  // roll up counts
  olts.forEach((o) => {
    o.ports.forEach((p) => {
      p.onuCount = onus.filter((u) => u.oltPort === p.id).length;
      p.rx = +(p.onuCount * (0.8 + R() * 2.4)).toFixed(1);
      p.tx = +(p.onuCount * (3.2 + R() * 6)).toFixed(1);
    });
  });
  ipPools.forEach((p) => { p.used = customers.filter((c) => c.pool === p.id).length; });
  nasDevices.forEach((n) => { n.sessions = customers.filter((c) => c.nas === n.id && c.status === "active").length; });

  /* ---------------- billing ---------------- */
  const invoices = [];
  const payments = [];
  const methods = ["KBZPay QR", "WavePay QR", "Cash at counter", "Bank transfer", "Wallet balance"];
  let invSeq = 0, paySeq = 0;

  customers.forEach((c) => {
    const t = tariffs.find((x) => x.id === c.tariff);
    const months = Math.min(6, Math.max(1, Math.floor((NOW - c.installed) / (30 * day))));
    for (let m = months - 1; m >= 0; m--) {
      const issued = c.expiry - (m + 1) * 30 * day;
      if (issued < c.installed - day) continue;
      invSeq++;
      const id = "INV-" + String(26000 + invSeq);
      const due = issued + 7 * day;
      let state = "paid";
      if (m === 0) {
        if (c.status === "expired") state = "overdue";
        else if (c.status === "grace") state = "pending";
        else if (NOW < due) state = chance(0.16) ? "pending" : "paid";
        else state = chance(0.05) ? "overdue" : "paid";
      } else if (chance(0.03)) state = "overdue";
      const inv = {
        kind: "INVOICE",
        id, customer: c.id, customerName: c.name,
        tariff: t.id, amount: t.price, tax: Math.round(t.price * 0.05),
        issued, due, status: state,
        period: new Date(issued).toISOString().slice(0, 10) + " → " + new Date(issued + 30 * day).toISOString().slice(0, 10),
        method: state === "paid" ? pick(methods) : null
      };
      invoices.push(inv);
      if (state === "paid") {
        paySeq++;
        payments.push({
          kind: "PAYMENT",
          id: "PMT-" + String(41000 + paySeq),
          invoice: id, customer: c.id, customerName: c.name,
          amount: inv.amount + inv.tax,
          method: inv.method,
          at: issued + int(0, 6) * day + int(0, 20) * 3600000,
          reconciled: true
        });
      }
      c.lastInvoice = id;
    }
  });
  invoices.sort((a, b) => b.issued - a.issued);
  payments.sort((a, b) => b.at - a.at);

  const vouchers = [];
  for (let i = 1; i <= 60; i++) {
    const used = chance(0.45);
    vouchers.push({
      kind: "VOUCHER",
      id: "TF-" + String(100000 + i * 37).slice(0, 6) + "-" + String(900 + i),
      value: pick([5000, 10000, 20000, 30000]),
      batch: "BATCH-2026-0" + (1 + (i % 3)),
      status: used ? "used" : "unused",
      usedBy: used ? pick(customers).id : null,
      usedAt: used ? NOW - int(1, 90) * day : null,
      createdAt: NOW - int(91, 160) * day,
      createdBy: "cashier.mya"
    });
  }

  /* ---------------- alarms ---------------- */
  const alarms = [];
  const ALARM_KINDS = [
    { code: "LOS", label: "Loss of signal", severity: "critical" },
    { code: "DYING-GASP", label: "Dying gasp", severity: "major" },
    { code: "OPTICAL-LOW", label: "Optical power low", severity: "major" },
    { code: "TEMP-HIGH", label: "Temperature high", severity: "minor" },
    { code: "LINK-DOWN", label: "Uplink down", severity: "critical" },
    { code: "REBOOT", label: "Unexpected reboot", severity: "minor" },
    { code: "REG-FAIL", label: "ONU registration failed", severity: "major" }
  ];
  let alSeq = 0;
  onus.filter((o) => !o.online || o.rx < -25).slice(0, 26).forEach((o) => {
    const k = o.rx < -25 ? ALARM_KINDS[2] : pick([ALARM_KINDS[0], ALARM_KINDS[1], ALARM_KINDS[6]]);
    const sev = k.code === "LOS" || o.rx < -27 ? "critical" : chance(0.45) ? "major" : "minor";
    alarms.push({
      kind: "ALARM", id: "ALM-" + String(++alSeq).padStart(4, "0"),
      code: k.code, label: k.label, severity: sev,
      object: o.id, objectKind: "ONU", customer: o.customer,
      path: [o.olt, o.dn, o.sn, o.id],
      raised: NOW - int(1, 72) * 3600000,
      cleared: null, state: "active",
      detail: k.code === "OPTICAL-LOW" ? `RX ${o.rx} dBm, below the -25.0 dBm threshold` : "No optical signal received from the ONU"
    });
  });
  alarms.push({
    kind: "ALARM", id: "ALM-0101", code: "PSU-FAIL", label: "Redundant PSU failed", severity: "major",
    object: "OLT-03", objectKind: "OLT", customer: null, path: ["OLT-03"],
    raised: NOW - 31 * 3600000, cleared: null, state: "active",
    detail: "Power supply B reporting failed state; chassis running on single feed"
  });
  alarms.push({
    kind: "ALARM", id: "ALM-0102", code: "TEMP-HIGH", label: "Temperature high", severity: "minor",
    object: "NAS-EDGE-04", objectKind: "NAS", customer: null, path: ["NAS-EDGE-04"],
    raised: NOW - 5 * 3600000, cleared: null, state: "active",
    detail: "CPU 78% sustained, chassis 61°C"
  });
  for (let i = 0; i < 18; i++) {
    const o = pick(onus);
    const k = pick(ALARM_KINDS);
    const raised = NOW - int(3, 40) * day;
    alarms.push({
      kind: "ALARM", id: "ALM-" + String(200 + i), code: k.code, label: k.label, severity: k.severity,
      object: o.id, objectKind: "ONU", customer: o.customer, path: [o.olt, o.dn, o.sn, o.id],
      raised, cleared: raised + int(1, 30) * 3600000, state: "cleared",
      detail: "Auto-cleared after service restoration"
    });
  }
  alarms.sort((a, b) => b.raised - a.raised);

  /* ---------------- helpdesk ---------------- */
  const TECHS = ["Ko Myo (Van 1)", "U Thura (Van 2)", "Ko Hein (Van 3)", "Daw Su (Indoor)"];
  const TICKET_KINDS = [
    { t: "No internet — LOS on ONU", cat: "Fault" },
    { t: "Slow speed in the evening", cat: "Performance" },
    { t: "New installation request", cat: "Install" },
    { t: "Relocation to new address", cat: "Move" },
    { t: "Wi-Fi password change", cat: "Config" },
    { t: "Invoice dispute", cat: "Billing" },
    { t: "Router replacement under warranty", cat: "Hardware" },
    { t: "Intermittent disconnects at night", cat: "Fault" }
  ];
  const tickets = [];
  const stages = ["open", "assigned", "in-progress", "resolved"];
  for (let i = 1; i <= 26; i++) {
    const c = pick(customers);
    const k = pick(TICKET_KINDS);
    const stage = i <= 5 ? "open" : i <= 10 ? "assigned" : i <= 15 ? "in-progress" : pick(stages);
    const created = NOW - int(1, 240) * 3600000;
    tickets.push({
      kind: "TICKET", id: "TKT-" + String(3100 + i),
      subject: k.t, category: k.cat,
      customer: c.id, customerName: c.name, zone: c.zone,
      priority: k.cat === "Fault" ? pick(["high", "high", "urgent"]) : pick(["normal", "low", "high"]),
      status: stage,
      tech: stage === "open" ? null : pick(TECHS),
      created,
      updated: created + int(1, 40) * 3600000,
      sla: created + (k.cat === "Fault" ? 8 : 48) * 3600000,
      notes: [{ at: created, by: "helpdesk", text: "Reported by customer over the phone." }]
    });
  }

  /* ---------------- inventory ---------------- */
  const inventory = [
    { id: "ITM-ONT-01", name: "Huawei EG8145V5 ONT", category: "CPE", stock: 142, reserved: 18, min: 60, unit: "pcs", cost: 42000, location: "Hlaing warehouse" },
    { id: "ITM-ONT-02", name: "ZTE F670L ONT", category: "CPE", stock: 58, reserved: 6, min: 60, unit: "pcs", cost: 46000, location: "Hlaing warehouse" },
    { id: "ITM-RTR-01", name: "MikroTik hAP ax lite", category: "CPE", stock: 37, reserved: 4, min: 25, unit: "pcs", cost: 88000, location: "Kamayut store" },
    { id: "ITM-FIB-01", name: "Drop cable 1-core (300m roll)", category: "Fibre", stock: 24, reserved: 3, min: 12, unit: "roll", cost: 165000, location: "Hlaing warehouse" },
    { id: "ITM-FIB-02", name: "ADSS 24-core aerial (2km)", category: "Fibre", stock: 6, reserved: 2, min: 4, unit: "drum", cost: 2400000, location: "Insein yard" },
    { id: "ITM-SPL-01", name: "PLC splitter 1:4 (SC/APC)", category: "Passive", stock: 44, reserved: 5, min: 20, unit: "pcs", cost: 28000, location: "Hlaing warehouse" },
    { id: "ITM-SPL-02", name: "PLC splitter 1:16 (SC/APC)", category: "Passive", stock: 19, reserved: 7, min: 20, unit: "pcs", cost: 64000, location: "Hlaing warehouse" },
    { id: "ITM-CLS-01", name: "Fibre closure 48F dome", category: "Passive", stock: 31, reserved: 2, min: 15, unit: "pcs", cost: 52000, location: "Insein yard" },
    { id: "ITM-PAT-01", name: "Patch cord SC/APC 3m", category: "Consumable", stock: 320, reserved: 40, min: 150, unit: "pcs", cost: 3200, location: "Kamayut store" },
    { id: "ITM-CON-01", name: "Fast connector SC/APC", category: "Consumable", stock: 780, reserved: 120, min: 400, unit: "pcs", cost: 900, location: "Hlaing warehouse" }
  ];

  /* ---------------- messaging ---------------- */
  const templates = [
    { id: "TPL-WELCOME", name: "Welcome / service activated", channel: "SMS", body: "Mingalaba {name}! Your {plan} service is now active. Account {login}. Support 09-777-000-111 — TrustForce." },
    { id: "TPL-EXP-3", name: "Expiry reminder — 3 days", channel: "SMS", body: "Dear {name}, your {plan} expires on {expiry}. Pay via KBZPay/WavePay QR to stay online. — TrustForce" },
    { id: "TPL-EXP-0", name: "Expiry today", channel: "SMS", body: "Dear {name}, your service expires today ({expiry}). Renew now to avoid disconnection. Amount: {amount} MMK." },
    { id: "TPL-PAID", name: "Payment received", channel: "SMS", body: "Payment of {amount} MMK received. {plan} extended to {expiry}. Thank you, {name}." },
    { id: "TPL-OUTAGE", name: "Planned maintenance", channel: "Viber", body: "Notice: fibre maintenance in {zone} on {date}, 01:00–04:00. Service may be interrupted. — TrustForce" },
    { id: "TPL-TECH", name: "Technician on the way", channel: "SMS", body: "{tech} is on the way for ticket {ticket}. ETA {eta}." }
  ];
  const campaigns = [
    { id: "CMP-014", name: "September expiry sweep", audience: "Expiring in 3 days", channel: "SMS", sent: 214, delivered: 209, failed: 5, at: NOW - 2 * day },
    { id: "CMP-013", name: "Hlaing fibre cut notice", audience: "Zone: Hlaing", channel: "Viber", sent: 96, delivered: 96, failed: 0, at: NOW - 9 * day },
    { id: "CMP-012", name: "50M upgrade offer", audience: "Home Fiber 20 subscribers", channel: "SMS", sent: 180, delivered: 174, failed: 6, at: NOW - 21 * day }
  ];

  /* ---------------- staff, roles, audit ---------------- */
  const roles = [
    { id: "admin", name: "System administrator", modules: "All modules, settings, integrations, audit", danger: "Yes" },
    { id: "noc", name: "Network operations", modules: "ODN, alarms, sessions, NAS, tariff read-only", danger: "Control actions" },
    { id: "cashier", name: "Cashier / billing", modules: "Invoices, payments, vouchers, subscriber read", danger: "No" },
    { id: "sales", name: "Sales & CS", modules: "Subscribers, tickets, messaging", danger: "No" },
    { id: "field", name: "Field technician", modules: "Assigned tickets, inventory issue, ONU diagnostics", danger: "No" },
    { id: "finance", name: "Management / finance", modules: "Dashboards, reports, exports", danger: "No" }
  ];
  const staff = [
    { id: "U-001", name: "Hein Htet Aung", role: "admin", email: "hein@trustforcemm.com", last: NOW - 40 * 60000, mfa: true },
    { id: "U-002", name: "Ko Zaw Naing", role: "noc", email: "noc1@trustforcemm.com", last: NOW - 3 * 60000, mfa: true },
    { id: "U-003", name: "Ma Mya Thein", role: "cashier", email: "cashier@trustforcemm.com", last: NOW - 26 * 60000, mfa: false },
    { id: "U-004", name: "Ko Myo Set", role: "field", email: "field1@trustforcemm.com", last: NOW - 8 * 60000, mfa: false },
    { id: "U-005", name: "Daw Nilar Win", role: "finance", email: "finance@trustforcemm.com", last: NOW - 5 * 3600000, mfa: true }
  ];

  const audit = [];
  const AUDIT_ACTS = [
    ["cashier.mya", "Payment recorded", "INV-26014", "KBZPay QR auto-matched"],
    ["noc.zaw", "CoA disconnect", "CUS-0042", "Expired session cleared"],
    ["admin.hein", "Tariff updated", "TP-104", "Price 42,000 → 45,000 MMK"],
    ["noc.zaw", "ONU reboot", "ONU-0117", "Remote reboot after LOS"],
    ["field.myo", "Stock issued", "ITM-ONT-01", "1 pc to ticket TKT-3108"],
    ["admin.hein", "Role changed", "U-003", "cashier: export permission removed"],
    ["cashier.mya", "Voucher batch generated", "BATCH-2026-03", "20 × 10,000 MMK"],
    ["noc.zaw", "PON port disabled", "OLT-03/S1/P4", "Maintenance window"]
  ];
  for (let i = 0; i < 40; i++) {
    const a = AUDIT_ACTS[i % AUDIT_ACTS.length];
    audit.push({
      kind: "AUDIT", id: "LOG-" + String(90000 + i),
      actor: a[0], action: a[1], target: a[2], detail: a[3],
      ip: "10.10.4." + (20 + (i % 30)),
      at: NOW - i * int(20, 180) * 60000
    });
  }
  audit.sort((a, b) => b.at - a.at);

  /* ---------------- live sessions ---------------- */
  const sessions = customers.map((c) => {
    const onu = onus.find((o) => o.id === c.onu);
    const t = tariffs.find((x) => x.id === c.tariff);
    const bw = bandwidths.find((b) => b.id === t.bw);
    const up = !!(onu && onu.online && c.status === "active");
    return {
      kind: "SESSION",
      id: "S-" + c.id,
      customer: c.id, name: c.name, login: c.login,
      nas: c.nas, ip: c.ip, framedPool: c.pool,
      online: up,
      uptimeS: up ? (onu.uptimeH * 3600 + Math.floor(R() * 3600)) : 0,
      rxMbps: up ? +(bw.down * (0.05 + R() * 0.55)).toFixed(1) : 0,
      txMbps: up ? +(bw.up * (0.03 + R() * 0.35)).toFixed(1) : 0,
      totalGB: +(R() * 480).toFixed(1),
      capDown: bw.down, capUp: bw.up,
      callerId: onu ? onu.mac : "-",
      throttled: t.fup > 0 && chance(0.12)
    };
  });

  TF.db = {
    meta: {
      operator: "TrustForce Myanmar",
      site: "trustforcemm.com",
      currency: "MMK",
      timezone: "Asia/Yangon (UTC+06:30)",
      now: NOW,
      version: "0.9.0-demo"
    },
    olts, dns, sns, fibers, onus, customers, tariffs, bandwidths, ipPools,
    nasDevices, invoices, payments, vouchers, alarms, tickets, inventory,
    templates, campaigns, roles, staff, audit, sessions
  };
})(window.TF = window.TF || {});
