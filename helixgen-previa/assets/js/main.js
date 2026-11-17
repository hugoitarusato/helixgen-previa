/* ==========================================================================
   HelixGen: comportamento da página
   contato · scroll suave · header · menu · entradas · contadores · etapas ·
   curva de amplificação · cookies
   ========================================================================== */
(() => {
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CFG = window.HELIXGEN || {};

  /* ---------- contato a partir do data.js ---------- */
  if (CFG.whatsapp) {
    const wa = `https://wa.me/${CFG.whatsapp}?text=${encodeURIComponent(CFG.whatsappMensagem || '')}`;
    $$('[data-wa]').forEach(a => { a.href = wa; a.target = '_blank'; a.rel = 'noopener'; });
  }
  $$('[data-tel]').forEach(a => { if (CFG.telefone) { a.href = `tel:${CFG.telefone}`; a.textContent = CFG.telefoneTexto; } });
  $$('[data-mail]').forEach(a => { if (CFG.email) { a.href = `mailto:${CFG.email}`; a.textContent = CFG.email; } });
  $$('[data-linkedin]').forEach(a => { if (CFG.linkedin) a.href = CFG.linkedin; });
  $$('[data-cfg]').forEach(el => { const v = CFG[el.dataset.cfg]; if (v) el.textContent = v; });

  root.classList.add('js');

  /* ---------- scroll suave ---------- */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new window.Lenis({ autoRaf: true, lerp: 0.11, anchors: { offset: -72 } });
  }

  /* ---------- header: some ao descer, volta ao subir, troca de contraste ---------- */
  const header = $('.header');
  const themed = $$('main [data-theme], footer[data-theme]');
  let lastY = scrollY, menuOpen = false, ticking = false;
  function updateHeader() {
    ticking = false;
    const y = scrollY;
    if (Math.abs(y - lastY) > 6) {
      header.classList.toggle('is-hidden', y > lastY && y > 160 && !menuOpen);
      lastY = y;
    }
    header.classList.toggle('is-solid', y > 24);
    if (!menuOpen) {
      const probe = header.offsetHeight / 2;
      let theme = 'light';
      for (const s of themed) {
        const r = s.getBoundingClientRect();
        if (r.top <= probe && r.bottom > probe) { theme = s.dataset.theme; break; }
      }
      header.dataset.theme = theme;
    }
    updateFlow();
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(updateHeader); } }, { passive: true });

  /* ---------- menu mobile em overlay ---------- */
  const burger = $('.burger'), menu = $('#menu'), main = $('main');
  $$('.menu__nav a').forEach((a, i) => a.style.setProperty('--i', i));
  function setMenu(open) {
    menuOpen = open;
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    main.inert = open;
    if (open) { header.dataset.theme = 'dark'; header.classList.remove('is-hidden'); lenis && lenis.stop(); document.body.style.overflow = 'hidden'; }
    else { lenis && lenis.start(); document.body.style.overflow = ''; updateHeader(); }
  }
  burger.addEventListener('click', () => setMenu(!menuOpen));
  menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && menuOpen) { setMenu(false); burger.focus(); } });
  matchMedia('(min-width: 60rem)').addEventListener('change', e => { if (e.matches && menuOpen) setMenu(false); });

  /* ---------- títulos: entrada linha a linha com máscara ---------- */
  function split(el) {
    const text = el.dataset.text || (el.dataset.text = el.textContent.trim().replace(/\s+/g, ' '));
    el.setAttribute('aria-label', text);
    el.textContent = '';
    const words = text.split(' ').map(w => { const s = document.createElement('span'); s.textContent = w; s.style.display = 'inline-block'; return s; });
    words.forEach((s, i) => { el.append(s); if (i < words.length - 1) el.append(' '); });
    const lines = []; let top = null;
    words.forEach(s => { if (s.offsetTop !== top) { top = s.offsetTop; lines.push([]); } lines[lines.length - 1].push(s.textContent); });
    el.textContent = '';
    lines.forEach((l, i) => {
      const line = document.createElement('span'); line.className = 'line'; line.setAttribute('aria-hidden', 'true');
      const inner = document.createElement('span'); inner.className = 'line__in'; inner.style.setProperty('--i', i); inner.textContent = l.join(' ');
      line.append(inner); el.append(line);
    });
    el.classList.add('is-split');
  }
  const splits = $$('[data-split]');
  const splitAll = () => splits.forEach(split);

  /* ---------- entradas disparadas pelo scroll ---------- */
  $$('[data-stagger]').forEach(g => [...g.children].forEach((c, i) => c.style.setProperty('--i', i)));
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      if (e.target.matches('.nums__grid')) runCounters();
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });

  function start() {
    splitAll();
    requestAnimationFrame(() => {
      [...splits, ...$$('[data-reveal]'), $('.nums__grid')].forEach(el => el && io.observe(el));
    });
    updateHeader();
  }
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(start);
  let lastW = innerWidth, rz;
  addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (innerWidth !== lastW) { lastW = innerWidth; splitAll(); } updateHeader(); }, 180); });

  /* ---------- contadores ---------- */
  let counted = false;
  function runCounters() {
    if (counted) return; counted = true;
    $$('[data-count]').forEach((el, i) => {
      const end = +el.dataset.count;
      if (reduce) { el.textContent = end; return; }
      const t0 = performance.now() + i * 90, dur = 1400;
      el.textContent = 0;
      (function tick(now) {
        const t = Math.min(1, Math.max(0, (now - t0) / dur));
        el.textContent = Math.round(end * (1 - Math.pow(1 - t, 4)));
        if (t < 1) requestAnimationFrame(tick);
      })(performance.now());
    });
  }

  /* ---------- Para clínicas: etapa ativa conforme o scroll ---------- */
  const steps = $$('.flow__step'), rail = $('.flow__rail'), railItems = $$('.flow__rail li');
  let activeStep = 0;
  function updateFlow() {
    if (!steps.length) return;
    const mid = innerHeight / 2; let best = 0, dist = Infinity;
    steps.forEach((s, i) => { const r = s.getBoundingClientRect(); const d = Math.abs(r.top + r.height / 2 - mid); if (d < dist) { dist = d; best = i; } });
    if (best === activeStep) return;
    activeStep = best;
    steps.forEach((s, i) => s.classList.toggle('is-active', i === best));
    railItems.forEach((s, i) => s.classList.toggle('is-active', i === best));
    rail && rail.style.setProperty('--p', (best + 1) / steps.length);
  }

  /* ---------- curva de amplificação interativa ---------- */
  const range = $('#ciclo');
  if (range) {
    const line = $('.curva__line'), ghost = $('.curva__ghost'), dot = $('.curva__dot'), cur = $('.curva__cur'), out = $('.curva__out');
    const X0 = 56, X1 = 616, Y0 = 320, Y1 = 40, THR = 284;
    const f = c => 1 / (1 + Math.exp(-(c - 24) / 2.2));
    const px = c => X0 + (c - 1) / 39 * (X1 - X0);
    const py = c => Y0 - f(c) * (Y0 - Y1);
    const path = to => { let d = ''; for (let c = 1; c <= to + 1e-6; c += 0.25) d += (d ? 'L' : 'M') + px(c).toFixed(1) + ' ' + py(c).toFixed(1); return d; };
    ghost.setAttribute('d', path(40));
    function draw(c, announce) {
      line.setAttribute('d', path(c));
      dot.setAttribute('cx', px(c)); dot.setAttribute('cy', py(c));
      cur.setAttribute('x1', px(c)); cur.setAttribute('x2', px(c));
      range.style.setProperty('--fill', ((c - 1) / 39 * 100) + '%');
      if (announce) {
        const n = Math.round(c);
        out.textContent = py(n) < THR
          ? `Ciclo ${n}: sinal acima do limiar, o alvo está presente.`
          : `Ciclo ${n}: sinal ainda abaixo do limiar.`;
      }
    }
    let touched = false, played = false;
    range.addEventListener('input', () => { touched = true; draw(+range.value, true); });
    draw(40, true);
    // ao entrar na tela, a curva se desenha uma vez
    new IntersectionObserver((es, o) => {
      if (!es[0].isIntersecting || played) return;
      played = true; o.disconnect();
      if (reduce) return;
      const t0 = performance.now(), dur = 2600;
      (function tick(now) {
        if (touched) return;
        const t = Math.min(1, (now - t0) / dur), c = 1 + 39 * (1 - Math.pow(1 - t, 2.2));
        range.value = Math.round(c); draw(c, t === 1);
        if (t < 1) requestAnimationFrame(tick);
      })(t0);
    }, { threshold: 0.45 }).observe($('.curva'));
  }

  /* ---------- formulário de contato: prepara um e-mail no aplicativo do visitante ---------- */
  const form = $('[data-contact]');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const d = new FormData(form), err = $('.form__err', form);
      if (d.get('site')) return;                       // campo-isca contra robôs
      const ok = d.get('nome').trim() && /.+@.+\..+/.test(d.get('email')) && d.get('mensagem').trim();
      err.hidden = !!ok;
      if (!ok) return;
      const corpo = `${d.get('mensagem')}\n\n${d.get('nome')}\n${d.get('email')}${d.get('telefone') ? '\n' + d.get('telefone') : ''}`;
      location.href = `mailto:${CFG.email || 'contato@helixgen.com.br'}?subject=${encodeURIComponent('Contato pelo site')}&body=${encodeURIComponent(corpo)}`;
    });
  }

  /* ---------- portal de resultados: o botão aparece quando houver endereço no data.js ---------- */
  const portal = $('[data-portal]');
  if (portal && CFG.portalResultados) { portal.hidden = false; $('a', portal).href = CFG.portalResultados; }

  /* ---------- cookies (LGPD) ---------- */
  const cookie = $('.cookie');
  const store = { get() { try { return localStorage.getItem('helixgen-cookies'); } catch (e) { return null; } }, set(v) { try { localStorage.setItem('helixgen-cookies', v); } catch (e) {} } };
  function showCookie() { cookie.hidden = false; cookie.classList.add('is-out'); requestAnimationFrame(() => requestAnimationFrame(() => cookie.classList.remove('is-out'))); }
  function hideCookie() { cookie.classList.add('is-out'); setTimeout(() => { cookie.hidden = true; }, 450); }
  if (cookie) {
    if (!store.get()) setTimeout(showCookie, 1800);
    $$('[data-cookie]').forEach(b => b.addEventListener('click', () => { store.set(b.dataset.cookie); hideCookie(); }));
    $$('[data-cookie-open]').forEach(b => b.addEventListener('click', showCookie));
  }
})();
