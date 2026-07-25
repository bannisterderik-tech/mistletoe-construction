/* Mistletoe Construction — shared interactions */
(function () {
  // Mobile nav
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.nav-main');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // Scroll reveals
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
  }

  // Rain streaks in hero
  var rain = document.querySelector('.rain');
  if (rain && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (var i = 0; i < 26; i++) {
      var d = document.createElement('i');
      d.style.left = (Math.random() * 100) + '%';
      d.style.animationDuration = (1.6 + Math.random() * 2.2) + 's';
      d.style.animationDelay = (Math.random() * 4) + 's';
      d.style.opacity = 0.25 + Math.random() * 0.5;
      rain.appendChild(d);
    }
  }

  // Membership "Join" buttons → Stripe Checkout (subscription)
  document.querySelectorAll('[data-join-membership]').forEach(function (b) {
    b.addEventListener('click', function (ev) {
      ev.preventDefault();
      var orig = b.textContent;
      b.textContent = 'Opening secure checkout…';
      b.style.pointerEvents = 'none';
      fetch('/api/create-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'membership' })
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (d && d.url) { window.location = d.url; return; }
        b.textContent = orig; b.style.pointerEvents = '';
        alert((d && d.error) || 'Checkout is warming up — call or text (541) 670-5005 and we\'ll set you up.');
      }).catch(function () {
        // Payments not wired yet / offline → fall back to the contact form.
        window.location = 'contact.html';
      });
    });
  });

  // Post-checkout thank-you on membership page
  if (/[?&]joined=1/.test(location.search)) {
    var hero = document.querySelector('.hero .hero-lede') || document.querySelector('.hero-lede');
    if (hero) hero.innerHTML = '<strong>You\'re in — welcome to the Home Care family!</strong> Your membership is active. We\'ll reach out within one business day to schedule your first inspection. Questions? (541) 670-5005.';
  }

  // Contact form → CRM leads (Supabase) with mailto fallback
  var form = document.querySelector('form[data-estimate]');
  if (form) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var g = function (n) { var f = form.querySelector('[name="' + n + '"]'); return f ? f.value : ''; };
      var note = form.querySelector('.form-note');

      function mailtoFallback() {
        var body = 'Name: ' + g('name') + '\nPhone: ' + g('phone') + '\nEmail: ' + g('email') +
          '\nService: ' + g('service') + '\n\n' + g('message');
        var subject = 'Free Estimate Request — ' + (g('service') || 'General') + ' — ' + g('name');
        window.location.href = 'mailto:Mistletoeconstructionllc@gmail.com?subject=' +
          encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
        if (note) { note.textContent = 'Opening your email app… or just call/text (541) 670-5005.'; }
      }

      var cfg = window.MC_CONFIG;
      if (!cfg) return mailtoFallback();

      var lead = {
        id: 'l' + Date.now().toString(36),
        name: g('name'), phone: g('phone'),
        service: g('service') || 'Something else',
        note: (g('message') || '') + (g('email') ? '  [email: ' + g('email') + ']' : ''),
        stage: 'new'
      };
      var btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
      fetch(cfg.url + '/rest/v1/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': cfg.key, 'Authorization': 'Bearer ' + cfg.key },
        body: JSON.stringify(lead)
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        form.reset();
        if (btn) { btn.textContent = 'Request Sent ✓'; }
        if (note) { note.textContent = "Got it! We'll reply within one business day. Urgent? Call or text (541) 670-5005."; }
      }).catch(function () {
        if (btn) { btn.disabled = false; btn.textContent = 'Request My Free Estimate'; }
        mailtoFallback();
      });
    });
  }
})();
