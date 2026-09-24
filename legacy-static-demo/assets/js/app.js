(function (TF) {
  "use strict";
  const U = TF.ui;
  const { h, qs, clear } = U;

  const NAV = [
    {
      group: "Business", items: [
        { id: "dashboard", label: "Overview", ic: "◎" },
        { id: "subscribers", label: "Subscribers", ic: "☰" },
        { id: "billing", label: "Billing", ic: "₭" },
        { id: "tariffs", label: "Plans", ic: "▤" }
      ]
    },
    {
      group: "Fibre network", items: [
        { id: "odn", label: "Fibre plant", ic: "⌗" },
        { id: "topology", label: "Topology & impact", ic: "⌥" },
        { id: "network", label: "Access network", ic: "⇄" },
        { id: "alarms", label: "Alarms", ic: "△", badge: () => TF.store.metrics().alarms }
      ]
    },
    {
      group: "Operations", items: [
        { id: "helpdesk", label: "Helpdesk", ic: "✱", badge: () => TF.store.db.tickets.filter((t) => t.status === "open").length },
        { id: "inventory", label: "Inventory", ic: "▣" },
        { id: "messaging", label: "Messaging", ic: "✉" },
        { id: "reports", label: "Reports", ic: "▦" },
        { id: "settings", label: "Administration", ic: "⚙" }
      ]
    }
  ];

  function buildRail() {
    const rail = qs("#rail");
    clear(rail);
    NAV.forEach((g) => {
      const box = h("div", { class: "rail-group" }, h("p", { text: g.group }));
      g.items.forEach((it) => {
        const badge = it.badge ? it.badge() : 0;
        box.appendChild(h("a", {
          href: "#/" + it.id,
          class: TF.state.route === it.id ? "on" : "",
          "aria-current": TF.state.route === it.id ? "page" : null
        }, [
          h("span", { class: "ic", text: it.ic }),
          h("span", { text: it.label }),
          badge ? h("span", { class: "tag", text: badge }) : null
        ]));
      });
      rail.appendChild(box);
    });
  }

  function render() {
    const view = TF.views[TF.state.route] || TF.views.dashboard;
    const main = qs("#main");
    clear(main);
    main.appendChild(h("div", { class: "page-head" }, [
      h("div", null, [h("h1", { text: view.title }), view.subtitle ? h("p", { text: view.subtitle }) : null])
    ]));
    main.appendChild(view.render());
    main.scrollTop = 0;
    buildRail();
    qs(".rail").classList.remove("open");
  }

  TF.go = function (route) {
    location.hash = "#/" + route;
  };

  function onHash() {
    const r = (location.hash || "#/dashboard").replace("#/", "");
    TF.state.route = TF.views[r] ? r : "dashboard";
    render();
  }

  /* ---------- global search ---------- */
  function wireSearch() {
    const input = qs("#omni");
    const results = qs("#omni-results");
    let hits = [];

    function close() { results.style.display = "none"; }
    function paint() {
      clear(results);
      if (!hits.length) {
        results.appendChild(h("div", { class: "omni-empty", text: "Nothing matches. Try a subscriber name, CUS-0042, an ONU serial, a MAC, SN-004, DN-002 or INV-26014." }));
      }
      hits.forEach((x) => {
        results.appendChild(h("div", {
          class: "omni-hit", role: "option",
          onclick: () => { close(); input.value = ""; TF.traceTo(x.id); }
        }, [
          h("span", { class: "hint", text: x.kind }),
          h("div", null, [h("div", { text: x.label }), h("div", { class: "hint num", text: x.sub })]),
          h("span", { class: "hint num", text: x.id })
        ]));
      });
      results.style.display = "block";
    }

    input.addEventListener("input", () => {
      const q = input.value.trim();
      if (q.length < 2) return close();
      hits = TF.store.search(q);
      paint();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { close(); input.blur(); }
      if (e.key === "Enter" && hits.length) { close(); input.value = ""; TF.traceTo(hits[0].id); }
    });
    document.addEventListener("click", (e) => {
      if (!results.contains(e.target) && e.target !== input) close();
    });
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); input.focus(); input.select(); }
    });
  }

  function boot() {
    qs("#who-name").textContent = TF.state.user.name;
    qs("#who-role").textContent = TF.state.user.role;
    qs("#nav-toggle").addEventListener("click", () => qs(".rail").classList.toggle("open"));
    qs("#theme").addEventListener("click", () => {
      const root = document.documentElement;
      root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
    });
    wireSearch();
    window.addEventListener("hashchange", onHash);
    onHash();
    TF.store.startLive();
    TF.store.onChange((kind) => { if (kind !== "tick") buildRail(); });
  }

  document.addEventListener("DOMContentLoaded", boot);
})(window.TF = window.TF || {});
