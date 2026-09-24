/* Tiny DOM + formatting + overlay toolkit. No framework, no build step. */
(function (TF) {
  "use strict";

  /* ---------- dom ---------- */
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === "class") node.className = v;
        else if (k === "html") node.innerHTML = v;
        else if (k === "text") node.textContent = v;
        else if (k.slice(0, 2) === "on") node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === "data") Object.keys(v).forEach((d) => node.dataset[d] = v[d]);
        else node.setAttribute(k, v);
      });
    }
    (Array.isArray(children) ? children : children ? [children] : []).forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === "object" ? c : document.createTextNode(String(c)));
    });
    return node;
  }
  const h = el;
  const frag = (kids) => { const f = document.createDocumentFragment(); kids.filter(Boolean).forEach((k) => f.appendChild(k)); return f; };
  const qs = (s, r) => (r || document).querySelector(s);
  const qsa = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const clear = (n) => { while (n.firstChild) n.removeChild(n.firstChild); return n; };

  /* ---------- format ---------- */
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = {
    money: (n) => (n === null || n === undefined ? "—" : Math.round(n).toLocaleString("en-US")),
    mmk: (n) => fmt.money(n) + " MMK",
    num: (n, d) => Number(n).toFixed(d === undefined ? 0 : d),
    pct: (n) => Math.round(n) + "%",
    date: (ts) => {
      if (!ts) return "—";
      const d = new Date(ts);
      return `${pad(d.getDate())} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]} ${d.getFullYear()}`;
    },
    dateTime: (ts) => {
      if (!ts) return "—";
      const d = new Date(ts);
      return fmt.date(ts) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
    },
    iso: (ts) => new Date(ts).toISOString().slice(0, 10),
    ago: (ts) => {
      const s = Math.max(0, (TF.db.meta.now - ts) / 1000);
      if (s < 90) return "just now";
      if (s < 5400) return Math.round(s / 60) + " min ago";
      if (s < 172800) return Math.round(s / 3600) + " h ago";
      return Math.round(s / 86400) + " d ago";
    },
    uptime: (sec) => {
      if (!sec) return "—";
      const d = Math.floor(sec / 86400), hr = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
      return (d ? d + "d " : "") + pad(hr) + "h " + pad(m) + "m";
    },
    dbm: (v) => (v === null || v === undefined ? "—" : v.toFixed(1) + " dBm"),
    days: (ts) => Math.round((ts - TF.db.meta.now) / 86400000)
  };

  /* ---------- optical grading ---------- */
  function opticalGrade(rx) {
    if (rx === null || rx === undefined) return { key: "free", label: "no reading", color: "var(--idle)" };
    if (rx >= -25) return { key: "online", label: "good", color: "var(--good)" };
    if (rx >= -27) return { key: "degraded", label: "marginal", color: "var(--warn)" };
    return { key: "offline", label: "out of budget", color: "var(--bad)" };
  }

  /* ---------- pills ---------- */
  function pill(text, tone) {
    return h("span", { class: "pill " + (tone || "info"), text: text });
  }

  /* ---------- tables ---------- */
  function table(cols, rows, opts) {
    opts = opts || {};
    const thead = h("tr", null, cols.map((c) => h("th", { class: c.right ? "t-right" : null, text: c.label })));
    const body = h("tbody");
    if (!rows.length) {
      body.appendChild(h("tr", null, h("td", { colspan: cols.length }, h("div", { class: "empty", text: opts.empty || "Nothing to show yet." }))));
    }
    rows.forEach((r) => {
      const tr = h("tr", { class: opts.onRow ? "clickable" : null });
      if (opts.onRow) tr.addEventListener("click", () => opts.onRow(r));
      cols.forEach((c) => {
        const v = c.cell(r);
        tr.appendChild(h("td", { class: c.right ? "t-right" : null }, typeof v === "object" && v !== null ? v : String(v === null || v === undefined ? "—" : v)));
      });
      body.appendChild(tr);
    });
    return h("div", { class: "table-wrap" }, h("table", null, [h("thead", null, thead), body]));
  }

  /* ---------- charts (hand-rolled svg, no deps) ---------- */
  const SVGNS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs) {
    const n = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach((k) => n.setAttribute(k, attrs[k]));
    return n;
  }

  function lineChart(series, opts) {
    opts = opts || {};
    const w = 640, ht = opts.height || 180, pl = 44, pr = 8, pt = 12, pb = 22;
    const all = series.reduce((a, s) => a.concat(s.points), []);
    const max = opts.max !== undefined ? opts.max : Math.max.apply(null, all) * 1.12 || 1;
    const min = opts.min !== undefined ? opts.min : Math.min(0, Math.min.apply(null, all));
    const n = series[0].points.length;
    const x = (i) => pl + (i * (w - pl - pr)) / Math.max(1, n - 1);
    const y = (v) => pt + (ht - pt - pb) * (1 - (v - min) / (max - min || 1));
    const root = svg("svg", { viewBox: `0 0 ${w} ${ht}`, class: "spark", role: "img", "aria-label": opts.label || "chart" });

    for (let g = 0; g <= 3; g++) {
      const gv = min + ((max - min) * g) / 3;
      root.appendChild(svg("line", { x1: pl, x2: w - pr, y1: y(gv), y2: y(gv), stroke: "var(--line-soft)", "stroke-width": 1 }));
      const t = svg("text", { x: 6, y: y(gv) + 4, fill: "var(--text-mute)", "font-size": 10 });
      t.textContent = opts.fmtY ? opts.fmtY(gv) : Math.round(gv).toLocaleString();
      root.appendChild(t);
    }
    series.forEach((s) => {
      const d = s.points.map((p, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p).toFixed(1)).join(" ");
      if (s.fill !== false) {
        const area = svg("path", {
          d: d + ` L ${x(n - 1)} ${y(min)} L ${x(0)} ${y(min)} Z`,
          fill: s.color || "var(--cyan)", opacity: 0.10
        });
        root.appendChild(area);
      }
      root.appendChild(svg("path", { d: d, fill: "none", stroke: s.color || "var(--cyan)", "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
    });
    (opts.labels || []).forEach((lb, i) => {
      if (opts.labels.length > 12 && i % 3 !== 0) return;
      const t = svg("text", { x: x(i), y: ht - 6, fill: "var(--text-mute)", "font-size": 10, "text-anchor": "middle" });
      t.textContent = lb;
      root.appendChild(t);
    });
    return root;
  }

  function barChart(items, opts) {
    opts = opts || {};
    const w = 640, ht = opts.height || 200, pl = 48, pr = 8, pt = 10, pb = 26;
    const max = Math.max.apply(null, items.map((i) => i.value)) * 1.1 || 1;
    const bw = (w - pl - pr) / items.length;
    const root = svg("svg", { viewBox: `0 0 ${w} ${ht}`, class: "spark" });
    for (let g = 0; g <= 3; g++) {
      const gv = (max * g) / 3;
      const yy = pt + (ht - pt - pb) * (1 - gv / max);
      root.appendChild(svg("line", { x1: pl, x2: w - pr, y1: yy, y2: yy, stroke: "var(--line-soft)" }));
      const t = svg("text", { x: 6, y: yy + 4, fill: "var(--text-mute)", "font-size": 10 });
      t.textContent = opts.fmtY ? opts.fmtY(gv) : Math.round(gv).toLocaleString();
      root.appendChild(t);
    }
    items.forEach((it, i) => {
      const hgt = ((ht - pt - pb) * it.value) / max;
      root.appendChild(svg("rect", {
        x: pl + i * bw + bw * 0.18, y: pt + (ht - pt - pb) - hgt,
        width: bw * 0.64, height: Math.max(1, hgt), rx: 3,
        fill: it.color || "var(--cyan-deep)"
      }));
      const t = svg("text", { x: pl + i * bw + bw / 2, y: ht - 8, fill: "var(--text-mute)", "font-size": 10, "text-anchor": "middle" });
      t.textContent = it.label;
      root.appendChild(t);
    });
    return root;
  }

  function donut(slices, opts) {
    opts = opts || {};
    const size = 150, r = 58, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r;
    const total = slices.reduce((a, s) => a + s.value, 0) || 1;
    const root = svg("svg", { viewBox: `0 0 ${size} ${size}`, width: size, height: size });
    let off = 0;
    slices.forEach((s) => {
      const len = (s.value / total) * C;
      root.appendChild(svg("circle", {
        cx, cy, r, fill: "none", stroke: s.color, "stroke-width": 16,
        "stroke-dasharray": `${len} ${C - len}`, "stroke-dashoffset": -off,
        transform: `rotate(-90 ${cx} ${cy})`
      }));
      off += len;
    });
    const big = svg("text", { x: cx, y: cy + 2, "text-anchor": "middle", fill: "var(--text)", "font-size": 22, "font-family": "var(--font-head)" });
    big.textContent = opts.center || total;
    root.appendChild(big);
    if (opts.sub) {
      const s2 = svg("text", { x: cx, y: cy + 18, "text-anchor": "middle", fill: "var(--text-mute)", "font-size": 10 });
      s2.textContent = opts.sub;
      root.appendChild(s2);
    }
    return root;
  }

  /* ---------- overlays ---------- */
  function closeOverlays() {
    qsa(".scrim, .drawer, .modal").forEach((n) => n.remove());
  }

  function modal(opts) {
    closeOverlays();
    const scrim = h("div", { class: "scrim", onclick: closeOverlays });
    const body = h("div", { class: "body" }, opts.body);
    const foot = h("footer", null, (opts.actions || []).map((a) =>
      h("button", {
        class: "btn " + (a.tone || ""),
        onclick: () => { const keep = a.onClick ? a.onClick(body) : false; if (!keep) closeOverlays(); }
      }, a.label)
    ));
    const box = h("div", { class: "modal", role: "dialog", "aria-modal": "true" }, [
      h("header", null, [h("h2", { text: opts.title }), h("div", { style: "flex:1" }), h("button", { class: "btn sm ghost", onclick: closeOverlays, "aria-label": "Close" }, "✕")]),
      body,
      opts.actions ? foot : null
    ]);
    document.body.appendChild(scrim);
    document.body.appendChild(box);
    const first = qs("input, select, textarea, button.primary", box);
    if (first) first.focus();
    return box;
  }

  function drawer(title, subtitle, content, actions) {
    closeOverlays();
    const scrim = h("div", { class: "scrim", onclick: closeOverlays });
    const box = h("div", { class: "drawer", role: "dialog", "aria-modal": "true" }, [
      h("div", { class: "drawer-head" }, [
        h("div", null, [h("h2", { text: title }), subtitle ? h("div", { class: "hint", text: subtitle }) : null]),
        h("div", { style: "flex:1" }),
        h("div", { class: "row" }, (actions || []).concat([h("button", { class: "btn sm ghost", onclick: closeOverlays, "aria-label": "Close" }, "✕")]))
      ]),
      h("div", { class: "drawer-body" }, content)
    ]);
    document.body.appendChild(scrim);
    document.body.appendChild(box);
    return box;
  }

  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeOverlays(); });

  /* ---------- toast ---------- */
  function toast(title, detail, tone) {
    let wrap = qs(".toasts");
    if (!wrap) { wrap = h("div", { class: "toasts" }); document.body.appendChild(wrap); }
    const t = h("div", { class: "toast " + (tone || "") }, [h("b", { text: title }), detail ? h("span", { text: detail }) : null]);
    wrap.appendChild(t);
    setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .3s"; setTimeout(() => t.remove(), 320); }, 3600);
  }

  /* ---------- tabs ---------- */
  function tabs(items, onChange) {
    const bar = h("div", { class: "tabs", role: "tablist" });
    const panel = h("div");
    let active = items[0].id;
    function render() {
      clear(bar);
      items.forEach((it) => bar.appendChild(h("button", {
        class: it.id === active ? "on" : "", role: "tab", "aria-selected": it.id === active,
        onclick: () => { active = it.id; render(); }
      }, it.label)));
      clear(panel).appendChild(items.find((i) => i.id === active).render());
      if (onChange) onChange(active);
    }
    render();
    return h("div", null, [bar, panel]);
  }

  /* ---------- field helpers ---------- */
  function field(label, control, hint) {
    return h("label", { class: "field" }, [h("span", { text: label }), control, hint ? h("span", { class: "hint", text: hint }) : null]);
  }
  function input(attrs) { return h("input", attrs || {}); }
  function select(options, attrs) {
    const s = h("select", attrs || {});
    options.forEach((o) => s.appendChild(h("option", { value: o.value, selected: o.selected }, o.label)));
    return s;
  }

  /* ---------- csv ---------- */
  function csv(filename, cols, rows) {
    const esc = (v) => '"' + String(v === null || v === undefined ? "" : v).replace(/"/g, '""') + '"';
    const lines = [cols.map((c) => esc(c.label)).join(",")];
    rows.forEach((r) => lines.push(cols.map((c) => esc(c.raw ? c.raw(r) : c.cell(r))).join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = h("a", { href: URL.createObjectURL(blob), download: filename });
    document.body.appendChild(a); a.click(); a.remove();
    toast("Export ready", filename + " downloaded", "good");
  }

  TF.views = TF.views || {};
  TF.ui = {
    h, el, frag, qs, qsa, clear, fmt, pill, table, lineChart, barChart, donut,
    modal, drawer, toast, tabs, field, input, select, csv, closeOverlays, opticalGrade, svg
  };
})(window.TF = window.TF || {});
