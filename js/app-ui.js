/* ============================================================
   Mistletoe CRM — shared UI kit (MCUI)
   A reusable right-side detail panel (drawer), toast, and confirm
   used across every admin page for click-through record detail.
   Self-injects its CSS; depends only on the brand tokens in main.css.
   ============================================================ */
(function () {
  if (window.MCUI) return;

  /* ---------- styles ---------- */
  var css = "\
  .mcui-scrim{position:fixed;inset:0;background:rgba(12,20,14,.46);opacity:0;pointer-events:none;transition:opacity .22s ease;z-index:80}\
  .mcui-scrim.open{opacity:1;pointer-events:auto}\
  .mcui-drawer{position:fixed;top:0;right:0;height:100%;width:min(560px,100%);background:var(--cream,#f5f6f3);box-shadow:-18px 0 50px rgba(12,20,14,.28);transform:translateX(100%);transition:transform .26s cubic-bezier(.4,0,.15,1);z-index:81;display:flex;flex-direction:column}\
  .mcui-drawer.open{transform:translateX(0)}\
  .mcui-dhead{padding:1.15rem 1.4rem;border-bottom:1px solid rgba(28,36,29,.1);display:flex;align-items:flex-start;gap:1rem;background:var(--pine-900,#1b3d26);color:#eef3ec}\
  .mcui-dhead .mcui-eyebrow{font-size:.72rem;letter-spacing:.09em;text-transform:uppercase;opacity:.72;font-weight:800}\
  .mcui-dhead h3{margin:.15rem 0 0;font-family:var(--font-display,inherit);font-size:1.4rem;line-height:1.15;color:#fff}\
  .mcui-dhead .mcui-dsub{opacity:.8;font-size:.9rem;margin-top:.15rem}\
  .mcui-x{margin-left:auto;background:rgba(255,255,255,.14);border:0;color:#fff;width:2rem;height:2rem;border-radius:50%;font-size:1.1rem;line-height:1;cursor:pointer;flex:0 0 auto}\
  .mcui-x:hover{background:rgba(255,255,255,.26)}\
  .mcui-dbody{padding:1.3rem 1.4rem;overflow-y:auto;flex:1}\
  .mcui-dfoot{padding:1rem 1.4rem;border-top:1px solid rgba(28,36,29,.1);display:flex;gap:.6rem;flex-wrap:wrap;background:rgba(28,36,29,.02)}\
  .mcui-sec{margin-bottom:1.5rem}\
  .mcui-sec>h4{font-size:.74rem;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-soft,#5b665c);font-weight:800;margin:0 0 .6rem;display:flex;align-items:center;gap:.5rem}\
  .mcui-sec>h4 .mcui-count{background:rgba(28,36,29,.08);border-radius:99px;padding:.05rem .5rem;font-size:.7rem;color:var(--ink-soft,#5b665c)}\
  .mcui-kv{display:grid;grid-template-columns:8.5rem 1fr;gap:.4rem .8rem;font-size:.94rem}\
  .mcui-kv dt{color:var(--ink-soft,#5b665c);font-weight:700}\
  .mcui-kv dd{margin:0;color:var(--pine-900,#1b3d26)}\
  .mcui-list{display:flex;flex-direction:column;gap:.5rem}\
  .mcui-item{border:1px solid rgba(28,36,29,.1);border-radius:12px;padding:.7rem .85rem;background:#fff;display:flex;justify-content:space-between;align-items:center;gap:.8rem}\
  .mcui-item .mcui-it-main{font-weight:700;color:var(--pine-900,#1b3d26)}\
  .mcui-item .mcui-it-sub{font-size:.84rem;color:var(--ink-soft,#5b665c);margin-top:.1rem}\
  .mcui-empty{color:var(--ink-soft,#5b665c);font-size:.9rem;padding:.5rem 0}\
  .mcui-row-link{cursor:pointer}\
  .mcui-row-link:hover{background:rgba(28,36,29,.035)}\
  .mcui-toast{position:fixed;bottom:1.4rem;left:50%;transform:translateX(-50%) translateY(1.5rem);background:var(--pine-900,#1b3d26);color:#fff;padding:.75rem 1.15rem;border-radius:12px;box-shadow:0 12px 34px rgba(12,20,14,.32);z-index:90;font-weight:700;opacity:0;transition:opacity .2s,transform .2s;max-width:90vw}\
  .mcui-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}\
  .mcui-toast.err{background:#a5311d}\
  @media(max-width:560px){.mcui-drawer{width:100%}.mcui-kv{grid-template-columns:1fr}.mcui-kv dt{margin-top:.4rem}}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  /* ---------- drawer ---------- */
  var scrim = document.createElement("div"); scrim.className = "mcui-scrim";
  var drawer = document.createElement("div"); drawer.className = "mcui-drawer";
  drawer.setAttribute("role", "dialog"); drawer.setAttribute("aria-modal", "true");
  document.addEventListener("DOMContentLoaded", function () {
    document.body.appendChild(scrim); document.body.appendChild(drawer);
  });
  if (document.body) { document.body.appendChild(scrim); document.body.appendChild(drawer); }

  scrim.addEventListener("click", close);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }

  function open(opts) {
    opts = opts || {};
    var actions = (opts.actions || []).map(function (a, i) {
      var kind = a.kind || "outline";
      return "<button class='btn btn-" + kind + " btn-sm' data-mcui-act='" + i + "'>" + esc(a.label) + "</button>";
    }).join("");
    drawer.innerHTML =
      "<div class='mcui-dhead'>" +
        "<div><div class='mcui-eyebrow'>" + esc(opts.eyebrow || "Detail") + "</div>" +
        "<h3>" + esc(opts.title || "") + "</h3>" +
        (opts.subtitle ? "<div class='mcui-dsub'>" + esc(opts.subtitle) + "</div>" : "") + "</div>" +
        "<button class='mcui-x' aria-label='Close'>&times;</button>" +
      "</div>" +
      "<div class='mcui-dbody'>" + (opts.bodyHTML || "") + "</div>" +
      (actions ? "<div class='mcui-dfoot'>" + actions + "</div>" : "");
    drawer.querySelector(".mcui-x").addEventListener("click", close);
    (opts.actions || []).forEach(function (a, i) {
      var b = drawer.querySelector("[data-mcui-act='" + i + "']");
      if (b && a.onClick) b.addEventListener("click", function () { a.onClick(api); });
    });
    if (opts.onBody) opts.onBody(drawer.querySelector(".mcui-dbody"));
    scrim.classList.add("open"); drawer.classList.add("open");
    return api;
  }
  function close() { scrim.classList.remove("open"); drawer.classList.remove("open"); }
  function setBody(html) { var b = drawer.querySelector(".mcui-dbody"); if (b) b.innerHTML = html; }

  /* ---------- section/table render helpers ---------- */
  function kv(pairs) {
    var rows = pairs.filter(function (p) { return p && p[1] != null && p[1] !== ""; })
      .map(function (p) { return "<dt>" + esc(p[0]) + "</dt><dd>" + (p[2] === "raw" ? p[1] : esc(p[1])) + "</dd>"; }).join("");
    return "<dl class='mcui-kv'>" + rows + "</dl>";
  }
  function section(title, innerHTML, count) {
    return "<div class='mcui-sec'><h4>" + esc(title) + (count != null ? "<span class='mcui-count'>" + count + "</span>" : "") + "</h4>" + innerHTML + "</div>";
  }
  function list(items, emptyMsg) {
    if (!items || !items.length) return "<div class='mcui-empty'>" + esc(emptyMsg || "Nothing yet.") + "</div>";
    return "<div class='mcui-list'>" + items.map(function (it) {
      return "<div class='mcui-item" + (it.onClick ? " mcui-row-link" : "") + "'" + (it.id ? " data-mcui-id='" + esc(it.id) + "'" : "") + ">" +
        "<div><div class='mcui-it-main'>" + (it.mainRaw || esc(it.main || "")) + "</div>" +
        (it.sub ? "<div class='mcui-it-sub'>" + esc(it.sub) + "</div>" : "") + "</div>" +
        (it.right ? "<div>" + (it.rightRaw || esc(it.right)) + "</div>" : "") + "</div>";
    }).join("") + "</div>";
  }

  /* ---------- toast ---------- */
  var toastEl;
  function toast(msg, kind) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "mcui-toast"; document.body.appendChild(toastEl); }
    toastEl.className = "mcui-toast" + (kind === "err" ? " err" : "");
    toastEl.textContent = msg;
    requestAnimationFrame(function () { toastEl.classList.add("show"); });
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () { toastEl.classList.remove("show"); }, 2600);
  }

  /* ---------- reusable list toolbar (search + sort) ---------- */
  function listBar(mountEl, opts) {
    opts = opts || {};
    var sorts = opts.sorts || [];
    mountEl.style.display = "flex"; mountEl.style.gap = ".6rem"; mountEl.style.flexWrap = "wrap";
    mountEl.style.alignItems = "center"; mountEl.style.marginBottom = "1rem";
    mountEl.innerHTML =
      "<input type='search' class='mcbar-q' placeholder='" + esc(opts.placeholder || "Search…") + "' aria-label='Search' style='flex:1;min-width:180px'>" +
      (sorts.length ? "<label class='t-sub' style='opacity:.7'>Sort</label><select class='mcbar-sort'>" +
        sorts.map(function (s) { return "<option value='" + esc(s.value) + "'>" + esc(s.label) + "</option>"; }).join("") + "</select>" : "") +
      (opts.extraHTML || "");
    var q = mountEl.querySelector(".mcbar-q"), sortSel = mountEl.querySelector(".mcbar-sort");
    var state = { q: "", sort: sorts[0] && sorts[0].value };
    function emit() { state.q = q.value.trim(); if (sortSel) state.sort = sortSel.value; opts.onChange && opts.onChange(state); }
    q.addEventListener("input", emit);
    if (sortSel) sortSel.addEventListener("change", emit);
    state.mount = mountEl;
    return state;
  }
  // Apply a listBar state to an array. cfg = { keys:[...], sorts:{ value: comparatorFn } }
  function filterSort(arr, state, cfg) {
    cfg = cfg || {};
    var out = arr;
    if (state && state.q && cfg.keys) {
      var ql = state.q.toLowerCase();
      out = out.filter(function (x) { return cfg.keys.map(function (k) { return x[k] == null ? "" : x[k]; }).join(" ").toLowerCase().indexOf(ql) > -1; });
    }
    var cmp = cfg.sorts && state && cfg.sorts[state.sort];
    if (cmp) out = out.slice().sort(cmp);
    return out;
  }
  // Common comparators
  var cmp = {
    textAsc: function (k) { return function (a, b) { return String(a[k] || "").localeCompare(String(b[k] || "")); }; },
    textDesc: function (k) { return function (a, b) { return String(b[k] || "").localeCompare(String(a[k] || "")); }; },
    numAsc: function (k) { return function (a, b) { return (Number(a[k]) || 0) - (Number(b[k]) || 0); }; },
    numDesc: function (k) { return function (a, b) { return (Number(b[k]) || 0) - (Number(a[k]) || 0); }; },
    dateDesc: function (k) { return function (a, b) { var x = String(a[k] || ""), y = String(b[k] || ""); return x < y ? 1 : x > y ? -1 : 0; }; },
    dateAsc: function (k) { return function (a, b) { var x = String(a[k] || ""), y = String(b[k] || ""); return x < y ? -1 : x > y ? 1 : 0; }; }
  };

  var api = { open: open, close: close, setBody: setBody, kv: kv, section: section, list: list, toast: toast, esc: esc, drawer: drawer, listBar: listBar, filterSort: filterSort, cmp: cmp };
  window.MCUI = api;
})();
