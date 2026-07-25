/* ============================================================
   Mistletoe data layer — dual mode.
   - Supabase mode: when js/config.js defines window.MC_CONFIG.
     Reads are served from an in-memory cache filled at startup
     (RLS in Postgres decides what each role can see); writes
     update the cache instantly and sync to Supabase.
   - Demo mode: no config -> localStorage, seeded sample data.
   Pages call the same MC.* API either way and wrap their init
   in MC.ready.then(...).
   ============================================================ */
(function () {
  var DB_KEY = "mc_demo_db_v1";
  var SES_KEY = "mc_session_v1";
  var CFG = window.MC_CONFIG || null;

  /* ---------- shared helpers ---------- */
  function money(n) { return "$" + Number(n || 0).toLocaleString("en-US"); }
  function fmtDate(iso) {
    var dt = new Date(String(iso).slice(0, 10) + "T12:00:00");
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  /* ================= DEMO MODE ================= */
  function seed() {
    var today = new Date();
    function d(off) { var x = new Date(today); x.setDate(x.getDate() + off); return x.toISOString().slice(0, 10); }
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
      ],
      partners: [],
      team_seats: [
        { id: "t1", email: "casey@mistletoeconstruction.com", name: "Casey Rivera", role: "sales", active: true },
        { id: "t2", email: "drew@mistletoeconstruction.com", name: "Drew Patel", role: "field", active: true }
      ]
    };
  }

  function demoMode() {
    function load() {
      try { var raw = localStorage.getItem(DB_KEY); if (raw) return JSON.parse(raw); } catch (e) {}
      var s = seed(); localStorage.setItem(DB_KEY, JSON.stringify(s)); return s;
    }
    var db = load();
    function save() { localStorage.setItem(DB_KEY, JSON.stringify(db)); }

    return {
      mode: "demo",
      ready: Promise.resolve(),
      list: function (e) { return (db[e] || []).slice(); },
      get: function (e, id) { return (db[e] || []).find(function (x) { return String(x.id) === String(id); }) || null; },
      customerName: function (id) { var c = this.get("customers", id); return c ? c.name : "—"; },
      memberName: function (id) {
        if (!id) return "Unassigned";
        var m = this.get("team_seats", id);
        return m ? ((m.name || m.email) + (m.role ? " · " + m.role : "")) : "—";
      },
      teamMembers: function () { return (db.team_seats || []).filter(function (m) { return m.active !== false; }); },
      add: function (e, obj) { obj.id = obj.id || e.slice(0, 1) + Date.now().toString(36); (db[e] = db[e] || []).push(obj); save(); return obj; },
      update: function (e, id, patch) {
        var x = this.get(e, id); if (!x) return null;
        Object.keys(patch).forEach(function (k) { x[k] = patch[k]; }); save(); return x;
      },
      remove: function (e, id) { db[e] = (db[e] || []).filter(function (x) { return String(x.id) !== String(id); }); save(); },
      resetDemo: function () { localStorage.removeItem(DB_KEY); location.reload(); },
      money: money, fmtDate: fmtDate,
      auth: {
        session: function () { try { return JSON.parse(localStorage.getItem(SES_KEY)); } catch (e) { return null; } },
        login: function (role, name) {
          var s = { role: role, name: name || (role === "admin" ? "Alex Smith" : "Dana Whitfield"), customerId: role === "client" ? "c1" : null, t: Date.now() };
          localStorage.setItem(SES_KEY, JSON.stringify(s)); return s;
        },
        logout: function (redirect) { localStorage.removeItem(SES_KEY); location.href = redirect || "../portal/login.html"; },
        require: function (roles, loginPath) {
          var s = this.session();
          var allowed = Array.isArray(roles) ? roles : (roles ? [roles] : null);
          if (!s || (allowed && allowed.indexOf(s.role) === -1)) { location.href = loginPath; return null; }
          return s;
        },
        sendMagicLink: function () { return Promise.resolve({ demo: true }); }
      }
    };
  }

  /* ================= SUPABASE MODE ================= */
  function supabaseMode() {
    var TABLES = ["customers", "leads", "jobs", "visits", "invoices", "partners", "proposals", "team_seats"];
    var cache = {}; TABLES.forEach(function (t) { cache[t] = []; });
    var sb = null;
    var sessionInfo = null; /* { role, name, email, customerId } */

    function loadLib() {
      return new Promise(function (res, rej) {
        if (window.supabase) return res();
        var s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }

    function fetchAll() {
      return Promise.all(TABLES.map(function (t) {
        return sb.from(t).select("*").then(function (r) {
          cache[t] = r.data || []; /* RLS decides what we can see; errors -> empty */
        }).catch(function () { cache[t] = []; });
      }));
    }

    var ready = loadLib().then(function () {
      sb = window.supabase.createClient(CFG.url, CFG.key);
      return sb.auth.getSession();
    }).then(function (r) {
      var sess = r.data && r.data.session;
      if (!sess) return;
      /* effective role comes from the DB (admin allowlist > active team seat > profile) */
      return sb.rpc("my_role").then(function (rr) {
        var effRole = (rr && !rr.error && rr.data) ? rr.data : null;
        return sb.from("profiles").select("*").eq("id", sess.user.id).single().then(function (p) {
          var prof = p.data || {};
          sessionInfo = {
            role: effRole || prof.role || "client",
            email: sess.user.email,
            name: (sess.user.email || "").split("@")[0],
            customerId: prof.customerId || null
          };
          /* friendlier display name for linked clients / team members */
          return fetchAll().then(function () {
            if (sessionInfo.customerId) {
              var c = cache.customers.find(function (x) { return x.id === sessionInfo.customerId; });
              if (c) sessionInfo.name = c.name;
            }
            var seat = (cache.team_seats || []).find(function (x) { return (x.email || "").toLowerCase() === (sessionInfo.email || "").toLowerCase(); });
            if (seat && seat.name) sessionInfo.name = seat.name;
          });
        });
      });
    }).catch(function (e) { console.error("MC init:", e); });

    function syncErr(r) { if (r && r.error) console.error("MC sync:", r.error.message); }

    return {
      mode: "supabase",
      ready: ready,
      client: function () { return sb; },
      list: function (e) { return (cache[e] || []).slice(); },
      get: function (e, id) { return (cache[e] || []).find(function (x) { return String(x.id) === String(id); }) || null; },
      customerName: function (id) { var c = this.get("customers", id); return c ? c.name : "—"; },
      memberName: function (id) {
        if (!id) return "Unassigned";
        var m = this.get("team_seats", id);
        return m ? ((m.name || m.email) + (m.role ? " · " + m.role : "")) : "—";
      },
      teamMembers: function () { return (cache.team_seats || []).filter(function (m) { return m.active !== false; }); },
      add: function (e, obj) {
        if (obj.id === undefined && e !== "partners" && e !== "team_seats") obj.id = e.slice(0, 1) + Date.now().toString(36);
        (cache[e] = cache[e] || []).push(obj);
        sb.from(e).insert(obj).select().then(function (r) {
          syncErr(r);
          if (r.data && r.data[0] && obj.id === undefined) obj.id = r.data[0].id;
        });
        return obj;
      },
      update: function (e, id, patch) {
        var x = this.get(e, id); if (!x) return null;
        Object.keys(patch).forEach(function (k) { x[k] = patch[k]; });
        sb.from(e).update(patch).eq("id", id).then(syncErr);
        return x;
      },
      remove: function (e, id) {
        cache[e] = (cache[e] || []).filter(function (x) { return String(x.id) !== String(id); });
        sb.from(e).delete().eq("id", id).then(syncErr);
      },
      resetDemo: function () { alert("Live mode — connected to the real database."); },
      money: money, fmtDate: fmtDate,
      auth: {
        session: function () { return sessionInfo; },
        login: function () { location.href = "login.html"; },
        logout: function (redirect) {
          sb.auth.signOut().then(function () { location.href = redirect || "../portal/login.html"; });
        },
        require: function (roles, loginPath) {
          var allowed = Array.isArray(roles) ? roles : (roles ? [roles] : null);
          if (!sessionInfo || (allowed && allowed.indexOf(sessionInfo.role) === -1)) { location.href = loginPath; return null; }
          return sessionInfo;
        },
        sendMagicLink: function (email, redirectTo) {
          return sb.auth.signInWithOtp({ email: email, options: { emailRedirectTo: redirectTo } });
        }
      }
    };
  }

  window.MC = CFG ? supabaseMode() : demoMode();
})();
