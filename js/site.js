// Shared behaviour for every page: navbar pill, progress bar, mobile menu,
// reveal-on-scroll, count-up stats.
(function () {
  const navbar = document.getElementById('navbar');
  const progress = document.getElementById('scrollProgress');
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (progress) progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
      if (navbar) navbar.classList.toggle('nav-scrolled', window.scrollY > 80);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Close' : 'Menu';
    });
  }

  // Decorative chessboard textures
  document.querySelectorAll('.board-texture').forEach((el) => {
    el.innerHTML = '<span></span>'.repeat(36);
    el.setAttribute('aria-hidden', 'true');
  });

  // Reveal on scroll
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

  // Count-up stats (easeOutExpo, staggered 200ms)
  const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
  function countUp(el, target, duration = 2000) {
    const start = performance.now();
    el.classList.add('counting');
    function update(now) {
      const p = Math.min((now - start) / duration, 1);
      el.firstChild.textContent = Math.floor(easeOutExpo(p) * target);
      if (p < 1) requestAnimationFrame(update);
      else { el.firstChild.textContent = target; el.classList.remove('counting'); }
    }
    requestAnimationFrame(update);
  }
  const specs = document.querySelector('.specs-grid');
  if (specs) {
    const specObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.querySelectorAll('.spec-item').forEach((item, i) => {
          setTimeout(() => countUp(item.querySelector('.spec-number'), parseFloat(item.dataset.target)), i * 200);
        });
        specObserver.unobserve(entry.target);
      });
    }, { threshold: 0.3 });
    specObserver.observe(specs);
  }

  // Read more / Read less toggles
  document.querySelectorAll('.readmore-btn').forEach((btn) => {
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    if (!panel) return;
    btn.addEventListener('click', () => {
      const open = panel.hidden;
      panel.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? 'Read less' : 'Read more';
    });
  });

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
