/* ============================================================
   Mistletoe data layer — DEMO MODE (localStorage).
   Later: swap the internals of these functions for Supabase
   calls. Page code never changes — only this file.
   ============================================================ */
(function () {
  var DB_KEY = "mc_demo_db_v1";
  var SES_KEY = "mc_session_v1";

  /* ---------- Seed data (loaded once) ---------- */
  function seed() {
    var today = new Date();
    function d(offsetDays) {
      var x = new Date(today); x.setDate(x.getDate() + offsetDays);
      return x.toISOString().slice(0, 10);
    }
    return {
      customers: [
        { id: "c1", name: "Dana Whitfield", phone: "(541) 555-0141", email: "dana@example.com", address: "1210 SE Rice Hill Rd", city: "Riddle", member: true, notes: "Gate code 4412. Dog is friendly." },
        { id: "c2", name: "Marcus & Jenny Ortega", phone: "(541) 555-0177", email: "ortegafam@example.com", address: "455 NE Cedar St", city: "Myrtle Creek", member: true, notes: "" },
        { id: "c3", name: "Bill Tanner", phone: "(541) 555-0163", email: "btanner@example.com", address: "2890 W Bradford Ave", city: "Roseburg", member: false, notes: "Referred by Dana Whitfield." },
        { id: "c4", name: "Sue Ellen Park", phone: "(541) 555-0129", email: "separk@example.com", address: "118 Maple Ln", city: "Canyonville", member: false, notes: "" },
        { id: "c5", name: "Ray Delgado", phone: "(541) 555-0102", email: "rdelgado@example.com", address: "77 Umpqua View Dr", city: "Glide", member: true, notes: "Metal roof 2025. Wildfire overlay district." }
      ],
      leads: [
        { id: "l1", name: "Karen Mosley", phone: "(541) 555-0190", city: "Winston", service: "Roof Replacement", stage: "new", note: "Web form — granules in gutters, 22-yr roof", created: d(-1) },
        { id: "l2", name: "Tom Beckett", phone: "(541) 555-0155", city: "Roseburg", service: "Moss Removal", stage: "new", note: "Called — north slope fully green", created: d(-2) },
        { id: "l3", name: "Alicia Fry", phone: "(541) 555-0171", city: "Sutherlin", service: "Roof Repair", stage: "contacted", note: "Leak over garage, photos texted", created: d(-4) },
        { id: "l4", name: "Gene Harmon", phone: "(541) 555-0118", city: "Oakland", service: "Roof Replacement", stage: "inspection", note: "Inspection booked — historic home, brick chimney", created: d(-6) },
        { id: "l5", name: "Priya Nair", phone: "(541) 555-0136", city: "Green", service: "Gutter Guards", stage: "quoted", note: "Quoted $1,850 micro-mesh", created: d(-9) },
        { id: "l6", name: "Walt Simmons", phone: "(541) 555-0147", city: "Camas Valley", service: "Metal Roofing", stage: "quoted", note: "Shop + house, DECRA samples shown", created: d(-12) }
      ],
      jobs: [
        { id: "j1", customerId: "c3", title: "Full roof replacement — Bradford Ave", status: "in-progress", start: d(-2), value: 16800, note: "Tear-off done, dried-in. Shingles tomorrow." },
        { id: "j2", customerId: "c4", title: "Valley + flashing repair", status: "scheduled", start: d(3), value: 1450, note: "Materials on truck." },
        { id: "j3", customerId: "c5", title: "Shop metal roof — panel install", status: "in-progress", start: d(-7), value: 12400, note: "Panels 60% set." },
        { id: "j4", customerId: "c2", title: "Gutter guards install", status: "done", start: d(-14), value: 1980, note: "Complete. Photos delivered." }
      ],
      visits: [
        { id: "v1", customerId: "c1", date: d(-30), type: "Annual inspection", summary: "Roof sound. Treated early moss on north slope, cleared valleys, flushed gutters.", photos: 6 },
        { id: "v2", customerId: "c2", date: d(-18), type: "Seasonal debris check", summary: "Cleared fir needles from valleys after windstorm. No damage found.", photos: 4 },
        { id: "v3", customerId: "c1", date: d(14), type: "Fall inspection (due)", summary: "", photos: 0 },
        { id: "v4", customerId: "c5", date: d(21), type: "Annual inspection (due)", summary: "", photos: 0 }
      ],
      invoices: [
        { id: "i1", customerId: "c3", kind: "estimate", label: "EST-1041 · Roof replacement", amount: 16800, status: "approved", date: d(-10) },
        { id: "i2", customerId: "c4", kind: "estimate", label: "EST-1042 · Valley repair", amount: 1450, status: "sent", date: d(-3) },
        { id: "i3", customerId: "c2", kind: "invoice", label: "INV-2031 · Gutter guards", amount: 1980, status: "paid", date: d(-12) },
        { id: "i4", customerId: "c5", kind: "invoice", label: "INV-2032 · Metal roof progress", amount: 6200, status: "sent", date: d(-1) },
        { id: "i5", customerId: "c1", kind: "estimate", label: "EST-1043 · Zinc strips + treatment", amount: 640, status: "draft", date: d(0) }
      ]
    };
  }

  /* ---------- Store ---------- */
  function load() {
    try { var raw = localStorage.getItem(DB_KEY); if (raw) return JSON.parse(raw); } catch (e) {}
    var s = seed(); save(s); return s;
  }
  function save(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }

  var db = load();

  var MC = {
    /* read */
    list: function (entity) { return (db[entity] || []).slice(); },
    get: function (entity, id) { return (db[entity] || []).find(function (x) { return x.id === id; }) || null; },
    customerName: function (id) { var c = MC.get("customers", id); return c ? c.name : "—"; },

    /* write */
    add: function (entity, obj) {
      obj.id = obj.id || entity.slice(0, 1) + Date.now().toString(36);
      db[entity] = db[entity] || []; db[entity].push(obj); save(db); return obj;
    },
    update: function (entity, id, patch) {
      var x = MC.get(entity, id); if (!x) return null;
      Object.keys(patch).forEach(function (k) { x[k] = patch[k]; }); save(db); return x;
    },
    remove: function (entity, id) {
      db[entity] = (db[entity] || []).filter(function (x) { return x.id !== id; }); save(db);
    },
    resetDemo: function () { localStorage.removeItem(DB_KEY); location.reload(); },

    /* helpers */
    money: function (n) { return "$" + Number(n).toLocaleString("en-US"); },
    fmtDate: function (iso) {
      var dt = new Date(iso + "T12:00:00");
      return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    },

    /* auth (demo). Later: Supabase auth — same signatures. */
    auth: {
      session: function () {
        try { return JSON.parse(localStorage.getItem(SES_KEY)); } catch (e) { return null; }
      },
      login: function (role, name) {
        var s = { role: role, name: name || (role === "admin" ? "Alex Smith" : "Dana Whitfield"), t: Date.now() };
        localStorage.setItem(SES_KEY, JSON.stringify(s)); return s;
      },
      logout: function (redirect) {
        localStorage.removeItem(SES_KEY);
        location.href = redirect || "../portal/login.html";
      },
      /* Redirect to login if no session / wrong role. Call at top of protected pages. */
      require: function (role, loginPath) {
        var s = MC.auth.session();
        if (!s || (role && s.role !== role)) { location.href = loginPath; return null; }
        return s;
      }
    }
  };

  window.MC = MC;
})();
