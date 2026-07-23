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

  // Contact form → mailto fallback (no backend required)
  var form = document.querySelector('form[data-estimate]');
  if (form) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var g = function (n) { var f = form.querySelector('[name="' + n + '"]'); return f ? f.value : ''; };
      var body = 'Name: ' + g('name') + '\nPhone: ' + g('phone') + '\nEmail: ' + g('email') +
        '\nService: ' + g('service') + '\n\n' + g('message');
      var subject = 'Free Estimate Request — ' + (g('service') || 'General') + ' — ' + g('name');
      window.location.href = 'mailto:Mistletoeconstructionllc@gmail.com?subject=' +
        encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      var note = form.querySelector('.form-note');
      if (note) { note.textContent = 'Opening your email app… or just call/text (541) 670-5005.'; }
    });
  }
})();
