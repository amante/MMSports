/* Global navbar + footer injector — v1.13 */
window.Site = (function () {
  const VERSION = "1.17.0";
  const REPO_NAME = "MMSports";
  function el(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") e.className = v;
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.substring(2), v);
      else e.setAttribute(k, v);
    }
    for (const c of [].concat(children)) {
      if (typeof c === "string") e.appendChild(document.createTextNode(c));
      else if (c) e.appendChild(c);
    }
    return e;
  }
  function repoBase() {
    try {
      const parts = window.location.pathname.split('/').filter(Boolean);
      const idx = parts.indexOf(REPO_NAME);
      if (idx >= 0) return '/' + parts.slice(0, idx + 1).join('/') + '/';
    } catch (e) {}
    return '/';
  }
  function defaultItems() {
    const base = repoBase();
    return [
      { label: "Inicio", href: base },
      { label: "WebSites", href: base + "WebSites/" },
      { label: "SportsBets", href: base + "WebSites/SportsBets/" }
    ];
  }
  function currentPath() { return window.location.pathname.replace(/\/+$/, "") + "/"; }
  function renderNavbar(targetId = "site-navbar", items) {
    const target = document.getElementById(targetId);
    if (!target) return;
    const navItems = items && items.length ? items : defaultItems();
    const here = currentPath();
    const nav = el("nav", { class: "w-full bg-white/80 backdrop-blur border-b border-slate-200" }, [
      el("div", { class: "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between" }, [
        el("div", { class: "font-semibold" }, "MMSports — Proyectos"),
        el("ul", { class: "flex items-center gap-3 text-sm" },
          navItems.map(it => {
            const a = el("a", { href: it.href, class: "px-3 py-1.5 rounded-lg hover:bg-slate-100" }, it.label);
            try {
              const u = new URL(it.href, window.location.origin);
              const path = u.pathname.replace(/\/+$/, "") + "/";
              if (here.startsWith(path)) a.className += " bg-slate-900 text-white hover:bg-slate-900";
            } catch {}
            return el("li", {}, a);
          })
        )
      ])
    ]);
    target.innerHTML = "";
    target.appendChild(nav);
  }
  function renderFooter(targetId = "site-footer") {
    const target = document.getElementById(targetId);
    if (!target) return;
    const ft = el("footer", { class: "mt-10 border-t border-slate-200" }, [
      el("div", { class: "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-sm text-slate-600 flex flex-wrap items-center justify-between gap-2" }, [
        el("div", {}, `© ${new Date().getFullYear()} MMSports`),
        el("div", {}, `Versión del sitio: v${VERSION}`)
      ])
    ]);
    target.innerHTML = "";
    target.appendChild(ft);
  }
  function auto() { renderNavbar(); renderFooter(); }
  return { version: VERSION, renderNavbar, renderFooter, auto };
})();