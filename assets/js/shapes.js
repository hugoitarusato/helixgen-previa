/* ==========================================================================
   HelixGen: forma 3D de partículas no topo das páginas internas
   Mesma técnica do DNA da Home (WebGL puro, sem bibliotecas): milhares de pontos
   formam uma figura própria de cada página, com profundidade de campo, bokeh ao
   fundo e iluminação. O scroll gira a figura e aproxima a câmera.
   Cada página escolhe a figura pelo atributo data-forma do <canvas id="forma">:
   exames, clinicas, sobre, blog, contato.
   Sem WebGL, fica a imagem estática (assets/img/dna-hero-1080.webp).
   Com "reduzir movimento" ativo, a figura é desenhada parada.
   Para ajustar uma figura, edite a função dela em SHAPES (abaixo).
   ========================================================================== */
(() => {
  const canvas = document.getElementById('forma');
  if (!canvas) return;
  const media = canvas.parentElement, hero = canvas.closest('.phero');
  const key = canvas.dataset.forma;
  // sway: balança de um lado a outro (figuras planas); base: ângulo inicial em radianos
  const CFG = { exames: { sway: true, base: -0.5 }, clinicas: { sway: false, base: 0.4 }, sobre: { sway: false, base: 0.55 }, blog: { sway: true, base: -0.3 }, contato: { sway: true, base: -0.35 } };
  const cfg = CFG[key];
  if (!cfg) return;
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'high-performance' });
  if (!gl) return;
  const TAU = Math.PI * 2, PI = Math.PI;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = matchMedia('(max-width: 767px)').matches;
  const N = small ? 17000 : 44000, BOK = 46, COUNT = N + BOK;

  function mulberry(seed) { let s = seed | 0; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* matrizes 3x3 (linha a linha) */
  const rotY = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
  const rotZ = a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
  const mmul = (A, B) => { const R = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) R[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]; return R; };
  const XF = (R, t) => ({ R, t });

  /* caminhos 2D */
  const arcPts = (cx, cy, r, a0, a1, n = 12) => { const o = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return o; };
  const rrect = (x1, y1, x2, y2, r, n = 8) => { const p = [...arcPts(x1 + r, y1 + r, r, PI, 1.5 * PI, n), ...arcPts(x2 - r, y1 + r, r, 1.5 * PI, TAU, n), ...arcPts(x2 - r, y2 - r, r, 0, 0.5 * PI, n), ...arcPts(x1 + r, y2 - r, r, 0.5 * PI, PI, n)]; p.push(p[0]); return p; };
  const plen = p => { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; };

  function Builder(seed) {
    const rnd = mulberry(seed);
    const uni = (a, b) => a + (b - a) * rnd();
    const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(TAU * rnd());
    const unit = () => { const x = gauss(), y = gauss(), z = gauss(), l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
    const out = new Float32Array(COUNT * 8); let k = 0;
    const light = () => { const v = Math.pow(uni(0.3, 1.45), 1.3); return rnd() < 0.05 ? 3 : v; };
    const lightv = vs => { const v = light(); return v > 2 ? v : v * vs; };
    const SZ = () => 3.35 * uni(0.6, 1.25);
    function place(T, p, n, s, v) {
      if (k >= N) return;
      if (T) { const R = T.R; p = [R[0] * p[0] + R[1] * p[1] + R[2] * p[2] + T.t[0], R[3] * p[0] + R[4] * p[1] + R[5] * p[2] + T.t[1], R[6] * p[0] + R[7] * p[1] + R[8] * p[2] + T.t[2]]; n = [R[0] * n[0] + R[1] * n[1] + R[2] * n[2], R[3] * n[0] + R[4] * n[1] + R[5] * n[2], R[6] * n[0] + R[7] * n[1] + R[8] * n[2]]; }
      const o = k * 8, l = Math.hypot(n[0], n[1], n[2]) || 1;
      out[o] = p[0]; out[o + 1] = p[1]; out[o + 2] = p[2]; out[o + 3] = n[0] / l; out[o + 4] = n[1] / l; out[o + 5] = n[2] / l; out[o + 6] = s; out[o + 7] = v; k++;
    }
    const grain = (fn, f = 0.5) => { const g = unit(); return [fn[0] * f + g[0] * (1 - f), fn[1] * f + g[1] * (1 - f), fn[2] * f + g[2] * (1 - f)]; };

    /* traço extrudado: caminho 2D com largura w e profundidade 2D, centrado em zc */
    function strokeSample(s, n) {
      const path = s.path, cum = [0];
      for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
      const L = cum[cum.length - 1], w = s.w, D = s.D, zc = s.zc, pf = w / (w + 2 * D);
      for (let q = 0; q < n; q++) {
        const u = rnd() * L; let lo = 0, hi = cum.length - 1;
        while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= u) lo = mid; else hi = mid; }
        const seg = cum[hi] - cum[lo] || 1, t = (u - cum[lo]) / seg;
        const ax = path[lo][0], ay = path[lo][1], bx = path[hi][0], by = path[hi][1];
        const tx = (bx - ax) / seg, ty = (by - ay) / seg, nx = ty, ny = -tx;
        const px = ax + (bx - ax) * t, py = ay + (by - ay) * t;
        let off, z, fn; const r = rnd();
        if (r < 0.07) { off = uni(-w / 2, w / 2); z = zc + uni(-D, D); fn = unit(); }
        else if (rnd() < pf) { const sg = rnd() < 0.5 ? -1 : 1; off = uni(-w / 2, w / 2); z = zc + sg * D; fn = [0, 0, sg]; }
        else { const sg = rnd() < 0.5 ? -1 : 1; off = sg * w / 2; z = zc + uni(-D, D); fn = [sg * nx, sg * ny, 0]; }
        const j = 1.3;
        place(s.T, [px + nx * off + gauss() * j, py + ny * off + gauss() * j, z + gauss() * j], grain(fn), SZ() * (s.sz || 1), lightv(s.vs || 1));
      }
    }
    function strokes(list, total) {
      const items = list.map(s => ({ ...s, wt: plen(s.path) * (s.k || 1) })), sum = items.reduce((a, s) => a + s.wt, 0);
      for (const s of items) strokeSample(s, Math.round(total * s.wt / sum));
    }
    /* esfera (casca + miolo) */
    function sphere(c, r, n, shell = 0.65, T = null, vs = 1, sz = 1, cut = null) {
      let guard = n * 8;
      for (let q = 0; q < n && guard-- > 0;) {
        const d = unit(), rad = rnd() < shell ? r * uni(0.95, 1.04) : r * Math.cbrt(rnd());
        const p = [c[0] + d[0] * rad, c[1] + d[1] * rad, c[2] + d[2] * rad];
        if (cut && cut(p)) continue;
        place(T, p, d, SZ() * sz, lightv(vs)); q++;
      }
    }
    /* painel esparso (preenchimento tênue) em retângulo arredondado */
    function panel(x1, y1, x2, y2, r, zc, n, T, vlo = 0.15, vhi = 0.4, zs = 4) {
      for (let q = 0; q < n;) {
        const x = uni(x1, x2), y = uni(y1, y2);
        const dx = Math.max(x1 + r - x, 0, x - (x2 - r)), dy = Math.max(y1 + r - y, 0, y - (y2 - r));
        if (dx * dx + dy * dy > r * r) continue;
        place(T, [x, y, zc + gauss() * zs], [0, 0, rnd() < 0.5 ? -1 : 1], SZ() * 0.8, uni(vlo, vhi)); q++;
      }
    }
    /* tubo ao longo de uma curva */
    function curve(fn, n, rad, T = null, vs = 1, sz = 0.85) {
      for (let q = 0; q < n; q++) {
        const p = fn(rnd()), d = unit(), rr = rad * Math.pow(rnd(), 0.6);
        place(T, [p[0] + d[0] * rr, p[1] + d[1] * rr, p[2] + d[2] * rr], d, SZ() * sz, lightv(vs));
      }
    }
    /* poeira ambiente: completa o total de partículas */
    function dust(R) {
      while (k < N) { const d = unit(), rr = R * Math.cbrt(rnd()); place(null, [d[0] * rr, d[1] * rr * 0.8, d[2] * rr], d, SZ() * 0.7, uni(0.18, 0.5)); }
    }
    function finish() {
      dust(520);
      // bokeh de fundo (x,y em fração da tela; tamanho negativo = disco)
      const br = mulberry(seed + 99);
      for (let i = 0; i < BOK; i++) { const o = (N + i) * 8; out[o] = br(); out[o + 1] = br(); out[o + 2] = 0; out[o + 6] = -(9 + 25 * br()); out[o + 7] = 0.04 + 0.11 * br(); }
      return out;
    }
    return { rnd, uni, gauss, unit, place, grain, strokes, sphere, panel, curve, dust, finish, N, count: () => k };
  }


  /* ---------- formas ---------- */
  const SHAPES = {};

  /* Exames: prancheta + tubo de ensaio (ícone enviado), extrudado em 3D */
  
  /* Exames (alternativa): prancheta + tubo de ensaio, extrudado em 3D */
  SHAPES.exames = () => {
    const b = Builder(11), S = 1.75, OX = 372, OY = 372;
    const c = pts => pts.map(([x, y]) => [(x - OX) * S, (y - OY) * S]);
    const x1 = 236, y1 = 218, x2 = 458, y2 = 545, r = 26;
    const bodyL = c([[424, y2], [x1 + r, y2], ...arcPts(x1 + r, y2 - r, r, 0.5 * PI, PI, 10), [x1, y1 + r], ...arcPts(x1 + r, y1 + r, r, PI, 1.5 * PI, 10), [278, y1]]);
    const bodyR = c([[414, y1], [x2 - r, y1], ...arcPts(x2 - r, y1 + r, r, 1.5 * PI, TAU, 10), [x2, 322]]);
    const clip = c([...arcPts(288, 224, 12, PI, 1.5 * PI, 6), [315, 212], ...arcPts(345, 212, 30, PI, TAU, 22), [402, 212], ...arcPts(402, 224, 12, 1.5 * PI, TAU, 6), [414, 234], ...arcPts(402, 234, 12, 0, 0.5 * PI, 6), [288, 246], ...arcPts(288, 234, 12, 0.5 * PI, PI, 6), [276, 224]]);
    const slot = c([[300, 229], [390, 229]]);
    const list = [
      { path: bodyL, w: 26, D: 20, zc: 8 }, { path: bodyR, w: 26, D: 20, zc: 8 },
      { path: clip, w: 22, D: 24, zc: -10 }, { path: slot, w: 12, D: 14, zc: -10, k: 0.6 }
    ];
    for (const yy of [297, 358, 420, 482]) {
      list.push({ path: c(arcPts(281, yy, 17, 0, TAU, 28)), w: 20, D: 16, zc: 8, k: 1.1 });
      list.push({ path: c([[318, yy], [404, yy]]), w: 18, D: 14, zc: 8 });
    }
    const wave = []; for (let i = 0; i <= 24; i++) { const x = 432 + i * 61 / 24; wave.push([x, 392 - 8 * Math.sin(i / 24 * TAU)]); }
    list.push({ path: c(rrect(413, 328, 510, 355, 6)), w: 24, D: 26, zc: -70 });
    list.push({ path: c([[428, 355], [428, 525], ...arcPts(462.5, 525, 34.5, PI, 0, 18), [497, 355]]), w: 24, D: 22, zc: -70 });
    list.push({ path: c(wave), w: 12, D: 10, zc: -70, k: 0.7 });
    b.strokes(list, Math.round(N * 0.80));
    const P = ([x, y]) => [(x - OX) * S, (y - OY) * S];
    for (const [x, y] of [[454, 421], [469, 484], [457, 518]]) { const [px, py] = P([x, y]); b.sphere([px, py, -70], 15, Math.round(N * 0.008), 0.55, null, 1.1, 1.05); }
    { const [px, py] = P([345, 196]); b.sphere([px, py, -10], 9, Math.round(N * 0.004), 0.6); }
    // folha da prancheta (preenchimento tênue) e líquido no tubo
    const a = P([246, 226]), d = P([448, 536]);
    b.panel(a[0], a[1], d[0], d[1], 40, 8, Math.round(N * 0.06), null);
    const l1 = P([437, 397]), l2 = P([488, 548]);
    for (let q = 0; q < Math.round(N * 0.04); q++) { b.place(null, [b.uni(l1[0], l2[0]), b.uni(l1[1], l2[1]), -70 + b.gauss() * 14], b.unit(), 3.4, b.uni(0.3, 0.8)); }
    return b.finish();
  };

  /* Para clínicas: cruz (laboratório) ligada às clínicas por rotas */
  SHAPES.clinicas = () => {
    const b = Builder(23), { uni, rnd } = b;
    // cruz: duas caixas, só superfície com viés para as arestas
    const H1 = [170, 54, 54], H2 = [54, 170, 54];
    const edge = () => rnd() < 0.6 ? (rnd() < 0.5 ? -1 : 1) * (1 - Math.pow(rnd(), 2.2)) : uni(-1, 1);
    const inside = (p, h) => Math.abs(p[0]) < h[0] - 0.5 && Math.abs(p[1]) < h[1] - 0.5 && Math.abs(p[2]) < h[2] - 0.5;
    const boxN = Math.round(N * 0.2);
    [[H1, H2], [H2, H1]].forEach(([h, o]) => {
      const ar = [h[1] * h[2], h[0] * h[2], h[0] * h[1]], tot = ar[0] + ar[1] + ar[2];
      for (let q = 0; q < boxN / 2;) {
        let t = rnd() * tot, ax = 0; if (t > ar[0]) { t -= ar[0]; ax = 1; if (t > ar[1]) ax = 2; }
        const sg = rnd() < 0.5 ? -1 : 1, p = [0, 0, 0], n = [0, 0, 0];
        for (let i = 0; i < 3; i++) p[i] = i === ax ? sg * h[i] : edge() * h[i];
        if (inside(p, o)) continue;
        n[ax] = sg; b.place(null, p, b.grain(n, 0.55), 3.35 * uni(0.6, 1.25), (() => { const v = Math.pow(uni(0.3, 1.45), 1.3); return rnd() < 0.05 ? 3 : v; })()); q++;
      }
    });
    // nós (clínicas)
    const nodes = [], RAD = [1, 0.84, 1.1, 0.92, 1.04, 0.96];
    for (let i = 0; i < 6; i++) { const y = 1 - 2 * (i + 0.5) / 6, rr = Math.sqrt(1 - y * y), th = i * 2.399963 + 0.4; nodes.push({ d: [Math.cos(th) * rr, y, Math.sin(th) * rr], R: 360 * RAD[i], r: 42 + 8 * ((i * 5) % 3) }); }
    nodes.forEach(nd => { nd.p = nd.d.map(v => v * nd.R); b.sphere(nd.p, nd.r, Math.round(N * 0.04), 0.6, null, 1.15, 1.05); });
    // rotas: hub -> nó e nó -> nó
    const bez = (p0, c1, p1) => t => { const u = 1 - t; return [u * u * p0[0] + 2 * u * t * c1[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c1[1] + t * t * p1[1], u * u * p0[2] + 2 * u * t * c1[2] + t * t * p1[2]]; };
    nodes.forEach((nd, i) => {
      const s = nd.d.map(v => v * 80), e = nd.d.map((v, k) => nd.p[k] - v * nd.r);
      const up = Math.abs(nd.d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      let pr = [nd.d[1] * up[2] - nd.d[2] * up[1], nd.d[2] * up[0] - nd.d[0] * up[2], nd.d[0] * up[1] - nd.d[1] * up[0]]; const pl = Math.hypot(...pr) || 1; pr = pr.map(v => v / pl * (i % 2 ? 70 : -70));
      const m = s.map((v, k) => (v + e[k]) / 2 + pr[k]);
      b.curve(bez(s, m, e), Math.round(N * 0.034), 6, null, 1);
    });
    nodes.forEach((nd, i) => {
      const o = nodes[(i + 1) % 6], mid = nd.p.map((v, k) => (v + o.p[k]) / 2), ml = Math.hypot(...mid) || 1;
      const ctl = mid.map(v => v * 1.22);
      const s = nd.p.map((v, k) => v + (ctl[k] - v) * 0.12), e = o.p.map((v, k) => v + (ctl[k] - v) * 0.12);
      b.curve(bez(s, ctl, e), Math.round(N * 0.026), 5, null, 0.85, 0.8);
    });
    // órbita
    const T = XF(mmul(rotY(0.5), [1, 0, 0, 0, Math.cos(0.38), -Math.sin(0.38), 0, Math.sin(0.38), Math.cos(0.38)]), [0, 0, 0]);
    b.curve(t => [430 * Math.cos(t * TAU), 0, 430 * Math.sin(t * TAU)], Math.round(N * 0.06), 3.5, T, 0.7, 0.75);
    return b.finish();
  };

  /* Sobre: célula em corte */
  SHAPES.sobre = () => {
    const b = Builder(37), { uni, rnd, unit, gauss } = b, R = 300;
    const oct = p => p[0] > 0 && p[1] < 0 && p[2] < 0;
    const lv = () => { const v = Math.pow(uni(0.3, 1.45), 1.3); return rnd() < 0.05 ? 3 : v; };
    b.sphere([0, 0, 0], R, Math.round(N * 0.30), 1, null, 0.9, 1, oct);
    // faces do corte (três quartos de disco) + arestas em arco
    const quarter = (rad, n, plane) => {
      for (let q = 0; q < n; q++) {
        const r = rad * Math.sqrt(rnd()), a = rnd() * PI / 2, u = -r * Math.cos(a), v = -r * Math.sin(a);
        let p, nn;
        if (plane === 0) { p = [0, u, v]; nn = [1, 0, 0]; } else if (plane === 1) { p = [-u, 0, v]; nn = [0, -1, 0]; } else { p = [-u, v, 0]; nn = [0, 0, -1]; }
        b.place(null, p, b.grain(nn, 0.5), 3.4 * uni(0.55, 1.1), uni(0.25, 0.9));
      }
    };
    [0, 1, 2].forEach(pl => quarter(R * 0.985, Math.round(N * 0.05), pl));
    [0, 1, 2].forEach(pl => b.curve(t => { const a = t * PI / 2, c = R * Math.cos(a), s = R * Math.sin(a); return pl === 0 ? [0, -c, -s] : pl === 1 ? [c, 0, -s] : [c, -s, 0]; }, Math.round(N * 0.022), 3.5, null, 1.25, 0.9));
    // citoplasma (nuvem tênue)
    for (let q = 0; q < Math.round(N * 0.06);) { const d = unit(), rr = R * 0.93 * Math.cbrt(rnd()), p = [d[0] * rr, d[1] * rr, d[2] * rr]; if (oct(p)) continue; b.place(null, p, d, 3.4 * uni(0.7, 1.2), uni(0.15, 0.45)); q++; }
    // núcleo, também em corte
    const NR = 124; b.sphere([0, 0, 0], NR, Math.round(N * 0.16), 0.7, null, 1.3, 1.05, oct);
    [0, 1, 2].forEach(pl => { for (let q = 0; q < Math.round(N * 0.013); q++) { const r = (NR - 2) * Math.sqrt(rnd()), a = rnd() * PI / 2, u = -r * Math.cos(a), v = -r * Math.sin(a); const p = pl === 0 ? [0, u, v] : pl === 1 ? [-u, 0, v] : [-u, v, 0], nn = pl === 0 ? [1, 0, 0] : pl === 1 ? [0, -1, 0] : [0, 0, -1]; b.place(null, p, b.grain(nn, 0.5), 3.8, uni(0.4, 1.2)); } });
    b.sphere([-34, 26, 30], 34, Math.round(N * 0.035), 0.5, null, 1.5, 1.1);
    // organelas
    const spots = [[-150, -60, 120], [140, 90, 90], [-110, 140, -60], [60, -150, 120], [-170, 20, -90], [130, 40, -150], [190, -40, 150]];
    spots.forEach((p, i) => { if (oct(p)) p = [p[0], -p[1], p[2]]; b.sphere(p, 22 + (i % 3) * 5, Math.round(N * 0.011), 0.6, null, 1.1); });
    return b.finish();
  };

  /* Blog: folhas de artigo em leque, em profundidade */
  SHAPES.blog = () => {
    const b = Builder(51), { rnd, uni } = b;
    const W = 150, Hh = 205, list = [], panels = [];
    for (let i = 0; i < 5; i++) {
      const t = i - 2, T = XF(mmul(rotY(t * 0.17), rotZ(-t * 0.035)), [t * 84, -t * 16, t * 100]), img = i % 2 === 1;
      list.push({ path: rrect(-W, -Hh, W, Hh, 16), w: 9, D: 3.5, zc: 0, T, k: 1 });
      list.push({ path: [[-120, -150], [10, -150]], w: 20, D: 3.5, zc: 0, T, k: 1.2 });
      let y0 = -100;
      if (img) { list.push({ path: rrect(-120, -105, 120, -15, 6), w: 7, D: 3, zc: 0, T }); list.push({ path: [[-100, -30], [-20, -100]], w: 5, D: 2, zc: 0, T, k: 0.6 }); y0 = 22; }
      for (let y = y0, n = 0; y < 185; y += 34, n++) list.push({ path: [[-120, y], [120 - (n % 3 === 2 ? 70 + rnd() * 30 : rnd() * 26), y]], w: 8, D: 3, zc: 0, T });
      panels.push(T);
    }
    b.strokes(list, Math.round(N * 0.86));
    panels.forEach(T => b.panel(-W + 8, -Hh + 8, W - 8, Hh - 8, 12, 0, Math.round(N * 0.02), T, 0.12, 0.34, 2));
    return b.finish();
  };

  /* Contato: dois balões de conversa */
  SHAPES.contato = () => {
    const b = Builder(67), { uni } = b;
    const bubble = (w, h, r, dir) => {
      const x1 = -w / 2, x2 = w / 2, y1 = -h / 2, y2 = h / 2, tx = dir < 0 ? x1 + r + 40 : x2 - r - 40;
      const p = [...arcPts(x1 + r, y1 + r, r, PI, 1.5 * PI, 12), ...arcPts(x2 - r, y1 + r, r, 1.5 * PI, TAU, 12), ...arcPts(x2 - r, y2 - r, r, 0, 0.5 * PI, 12),
        [tx + 30, y2], [tx + dir * 26, y2 + 74], [tx - 30, y2], ...arcPts(x1 + r, y2 - r, r, 0.5 * PI, PI, 12)];
      p.push(p[0]); return p;
    };
    const TA = XF(rotZ(-0.04), [-60, -70, 70]), TB = XF(rotZ(0.05), [175, 135, -95]);
    const list = [
      { path: bubble(470, 290, 92, -1), w: 26, D: 22, zc: 0, T: TA },
      { path: bubble(300, 196, 70, 1), w: 24, D: 20, zc: 0, T: TB },
      { path: [[-80, 40], [60, 40]], w: 12, D: 10, zc: 0, T: TB, k: 0.8 }, { path: [[-80, 78], [10, 78]], w: 12, D: 10, zc: 0, T: TB, k: 0.8 }
    ];
    // linhas do balão B ficam dentro (ajuste: y relativo ao centro do balão)
    list[2].path = [[-80, -18], [70, -18]]; list[3].path = [[-80, 20], [10, 20]];
    b.strokes(list, Math.round(N * 0.80));
    [-92, 0, 92].forEach(x => b.sphere([x, 0, 0], 27, Math.round(N * 0.032), 0.55, TA, 1.2, 1.05));
    b.panel(-225, -135, 225, 135, 80, 0, Math.round(N * 0.025), TA, 0.12, 0.3);
    b.panel(-140, -90, 140, 90, 55, 0, Math.round(N * 0.02), TB, 0.12, 0.3);
    return b.finish();
  };


  /* ===================== WebGL ===================== */
  const BINS = 512, ZMIN = -750, ZMAX = 750;
  const M = window.HGMorph || { GLSL_ATTR: 'attribute vec4 aS; attribute vec4 aSC; uniform float uMorph;', GLSL_MIX: '', enabled: false };
  const VS = `
${M.GLSL_ATTR}
attribute vec3 aP, aN; attribute vec2 aM; attribute float aR;
uniform float uPhi, uTilt, uK, uFocus, uDpr, uTime, uBok; uniform vec2 uRes, uCenter;
varying vec3 vCol; varying float vAlpha, vR, vSize, vKind;
void main() {
  vec3 p = aP, n = aN; vec2 mm = aM;
  vec2 scr; float r; float alpha; vec3 col; float kind = 0.0;
  if (mm.x < 0.0) {
    scr = aP.xy * uRes + vec2(0.0, sin(uTime * 0.25 + aP.x * 9.0) * 12.0);
    r = -mm.x * uBok; alpha = mm.y; col = vec3(0.27, 0.67, 0.75) * (0.55 + aR * 0.65); kind = 2.0;
  } else {
    float c = cos(uPhi), s = sin(uPhi);
    p = vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c); n = vec3(n.x * c + n.z * s, n.y, -n.x * s + n.z * c);
    float ct = cos(uTilt), st = sin(uTilt);
    p = vec3(p.x, p.y * ct - p.z * st, p.y * st + p.z * ct); n = normalize(vec3(n.x, n.y * ct - n.z * st, n.y * st + n.z * ct));
    float ps = 2600.0 / (2600.0 + p.z);
    scr = uCenter + p.xy * uK * ps;
    float r0 = mm.x * uK * ps;
    float coc = abs(p.z - uFocus) * 0.026 * ps * uK;
    r = sqrt(r0 * r0 + coc * coc);
    alpha = clamp(r0 * r0 / (r * r) * 1.35, 0.0, 1.0);
    kind = coc < 1.6 ? 1.0 : 0.0;
    vec3 L = normalize(vec3(-0.50, -0.62, -0.60)), L2 = normalize(vec3(0.7, 0.35, 0.25));
    float diff = pow(clamp(0.38 + 0.62 * dot(n, L), 0.0, 1.0), 1.4);
    float rim = pow(clamp(dot(n, L2), 0.0, 1.0), 2.0);
    vec3 SH = vec3(0.016, 0.172, 0.212), MID = vec3(0.102, 0.659, 0.753), HI = vec3(0.82, 0.97, 1.0);
    col = SH + diff * (MID - SH) + pow(diff, 5.0) * (HI - MID) * 0.9 + rim * vec3(0.157, 0.745, 0.843) * 0.35;
    if (mm.y > 2.0) col = col * 0.4 + HI * 1.15; else col *= mm.y;
    float fog = clamp((p.z + 180.0) / 1000.0, 0.0, 0.72);
    col = mix(col, vec3(0.04, 0.176, 0.216), fog);
  }
  vec2 px = scr;
${M.GLSL_MIX}
  gl_Position = vec4(px.x / uRes.x * 2.0 - 1.0, 1.0 - px.y / uRes.y * 2.0, 0.0, 1.0);
  float rp = max(r * uDpr, 0.6);
  vCol = col; vAlpha = alpha; vR = rp; vKind = kind; vSize = rp * 2.0 + 2.0;
  gl_PointSize = vSize;
}`;
  const FS = `
precision mediump float;
varying vec3 vCol; varying float vAlpha, vR, vSize, vKind;
void main() {
  vec2 pc = gl_PointCoord - 0.5;
  float d = length(pc) * vSize;
  float a = clamp(vR - d + 0.5, 0.0, 1.0) * vAlpha;
  if (a < 0.004) discard;
  float t = d / vR, shade;
  if (vKind > 0.5 && vKind < 1.5) {
    float nz = sqrt(max(1.0 - t * t, 0.0));
    float lx = (pc.x * -0.50 + pc.y * -0.62) * vSize / vR;
    shade = clamp(0.7 + 0.55 * nz + 0.4 * lx, 0.3, 1.8);
  } else {
    shade = 1.0 + (vKind > 1.5 ? 0.5 : 0.25) * pow(t, 6.0);
  }
  gl_FragColor = vec4(vCol * shade * a, a);
}`;
  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  let prog, data, U = {}, ibo, order, binOf, counts, aR;
  try {
    data = SHAPES[key]();
    prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) { console.warn('Forma 3D indisponível:', e.message); return; }
  gl.useProgram(prog);
  const attr = (buf, name, size, stride, off) => { gl.bindBuffer(gl.ARRAY_BUFFER, buf); const l = gl.getAttribLocation(prog, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, stride, off * 4); };
  const bufD = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bufD); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  attr(bufD, 'aP', 3, 32, 0); attr(bufD, 'aN', 3, 32, 3); attr(bufD, 'aM', 2, 32, 6);
  const rr = mulberry(5); aR = new Float32Array(COUNT); for (let i = 0; i < COUNT; i++) aR[i] = rr();
  const bufR = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bufR); gl.bufferData(gl.ARRAY_BUFFER, aR, gl.STATIC_DRAW); attr(bufR, 'aR', 1, 4, 0);
  ['uPhi', 'uTilt', 'uK', 'uFocus', 'uDpr', 'uTime', 'uBok', 'uRes', 'uCenter', 'uMorph'].forEach(n => U[n] = gl.getUniformLocation(prog, n));
  ibo = gl.createBuffer(); order = new Uint16Array(COUNT); binOf = new Uint16Array(N); counts = new Uint32Array(BINS + 1);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.DEPTH_TEST); gl.clearColor(0, 0, 0, 0);

  // ordena as partículas por profundidade (em faixas, O(n))
  function sortDepth(phi, tilt) {
    const c = Math.cos(phi), s = Math.sin(phi), ct = Math.cos(tilt), st = Math.sin(tilt); counts.fill(0);
    for (let i = 0, o = 0; i < N; i++, o += 8) {
      const z2 = data[o + 1] * st + (-data[o] * s + data[o + 2] * c) * ct;
      let b = ((ZMAX - z2) / (ZMAX - ZMIN) * BINS) | 0; b = b < 0 ? 0 : b >= BINS ? BINS - 1 : b;
      binOf[i] = b; counts[b + 1]++;
    }
    for (let i = 0; i < BINS; i++) counts[i + 1] += counts[i];
    for (let i = 0; i < BOK; i++) order[i] = N + i;
    for (let i = 0; i < N; i++) order[BOK + counts[binOf[i]]++] = i;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, order, gl.DYNAMIC_DRAW);
  }

  /* ---------- tamanho: a figura ocupa o lado direito da faixa ---------- */
  let cw = 0, ch = 0, dpr = 1, K = 1, cx = 0, cy = 0;
  function layout() {
    cw = canvas.clientWidth; ch = canvas.clientHeight; dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    const hd = (document.querySelector('.header') || { offsetHeight: 96 }).offsetHeight, portrait = cw < 760, top = Math.max(hd, 88), avail = Math.max(240, ch - top - 12);
    if (!portrait) { K = Math.min(avail / 700, cw * 0.4 / 600); cx = cw * 0.72; cy = top + avail / 2; }
    else {   // celular: a figura fica na área acima do texto (um pouco por trás dele)
      const inn = hero.querySelector('.phero__in'), zone = Math.max(170, ch - (inn ? inn.offsetHeight : 240) - 40 + 50 - top);
      K = Math.min(cw * 0.62 / 600, zone / 700); cx = cw * 0.66; cy = top + zone / 2;
    }
  }

  /* ---------- laço ---------- */
  let visible = true, running = false, live = false, mx = 0, my = 0, tx = 0, ty = 0, morphBuf = null, mt0 = -1, lastP = null;
  const t0 = performance.now();
  function params(now) {
    const time = reduce ? 0 : (now - t0) / 1000;
    const p = reduce ? 0 : Math.min(1, Math.max(0, scrollY / (hero.offsetHeight || 1)));
    return { time, p, phi: cfg.base + (cfg.sway ? 0.34 * Math.sin(time * 0.22) : time * 0.07) + p * (cfg.sway ? 1.9 : 2.4) + mx * 0.35, tilt: 0.13 + my * 0.14 - p * 0.08,
      Ke: K * (1 + p * 0.22), focus: -40 + p * 110, cxe: cx + mx * 26, cye: cy + my * 18 - p * 90 * K };
  }
  /* Espelho em JS do vertex shader: posição, raio e cor de cada partícula na tela (para a transição entre páginas). */
  function project(P) {
    const c = Math.cos(P.phi), s = Math.sin(P.phi), ct = Math.cos(P.tilt), st = Math.sin(P.tilt);
    const xy = new Float32Array(2 * N), r = new Float32Array(N), col = new Float32Array(4 * N);
    const nl = Math.hypot(-0.50, -0.62, -0.60), Lx = -0.50 / nl, Ly = -0.62 / nl, Lz = -0.60 / nl, nl2 = Math.hypot(0.7, 0.35, 0.25), Rx = 0.7 / nl2, Ry = 0.35 / nl2, Rz = 0.25 / nl2;
    const SH = [0.016, 0.172, 0.212], MID = [0.102, 0.659, 0.753], HI = [0.82, 0.97, 1.0], RIM = [0.157, 0.745, 0.843], FOG = [0.04, 0.176, 0.216];
    for (let i = 0, o = 0; i < N; i++, o += 8) {
      const x = data[o], y = data[o + 1], z = data[o + 2], z1 = -x * s + z * c, px = x * c + z * s, py = y * ct - z1 * st, pz = y * st + z1 * ct;
      const nx0 = data[o + 3], ny0 = data[o + 4], nz0 = data[o + 5], nz1 = -nx0 * s + nz0 * c, nx = nx0 * c + nz0 * s, ny = ny0 * ct - nz1 * st, nz = ny0 * st + nz1 * ct;
      const ps = 2600 / (2600 + pz), r0 = data[o + 6] * P.Ke * ps, coc = Math.abs(pz - P.focus) * 0.026 * ps * P.Ke, rr = Math.sqrt(r0 * r0 + coc * coc);
      xy[2 * i] = P.cxe + px * P.Ke * ps; xy[2 * i + 1] = P.cye + py * P.Ke * ps; r[i] = rr;
      const diff = Math.pow(Math.min(1, Math.max(0, 0.38 + 0.62 * (nx * Lx + ny * Ly + nz * Lz))), 1.4), rim = Math.pow(Math.min(1, Math.max(0, nx * Rx + ny * Ry + nz * Rz)), 2), d5 = Math.pow(diff, 5), b = data[o + 7];
      const fog = Math.min(0.72, Math.max(0, (pz + 180) / 1000));
      for (let k = 0; k < 3; k++) {
        let v = SH[k] + diff * (MID[k] - SH[k]) + d5 * (HI[k] - MID[k]) * 0.9 + rim * RIM[k] * 0.35;
        v = b > 2 ? v * 0.4 + HI[k] * 1.15 : v * b;
        col[4 * i + k] = v + (FOG[k] - v) * fog;
      }
      col[4 * i + 3] = Math.min(1, r0 * r0 / (rr * rr) * 1.35);
    }
    return { n: N, xy, r, col };
  }
  function draw(now) {
    running = false;
    if (!visible || document.hidden || !cw) return;
    mx += (tx - mx) * 0.05; my += (ty - my) * 0.05;
    const P = lastP = params(now), phi = P.phi, tilt = P.tilt, p = P.p, time = P.time;
    if (morphBuf && mt0 < 0) mt0 = now;
    sortDepth(phi, tilt);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(U.uMorph, morphBuf ? Math.min(1, (now - mt0) / M.DURATION) : 1);
    gl.uniform1f(U.uPhi, phi); gl.uniform1f(U.uTilt, tilt);
    gl.uniform1f(U.uK, P.Ke); gl.uniform1f(U.uFocus, P.focus); gl.uniform1f(U.uDpr, dpr); gl.uniform1f(U.uTime, time);
    gl.uniform1f(U.uBok, Math.max(ch, 700) / 1350); gl.uniform2f(U.uRes, cw, ch);
    gl.uniform2f(U.uCenter, P.cxe, P.cye);
    gl.drawElements(gl.POINTS, COUNT, gl.UNSIGNED_SHORT, 0);
    if (!live) { live = true; media.classList.add('is-live'); }
    if (!reduce) loop();
  }
  function loop() { if (!running) { running = true; requestAnimationFrame(draw); } }
  layout();
  /* transição: se veio de outra página com figura 3D, as partículas partem das posições dela */
  {
    const locS = gl.getAttribLocation(prog, 'aS'), locC = gl.getAttribLocation(prog, 'aSC'), old = M.enabled && M.load && M.load();
    if (old && cw) morphBuf = M.prepare(old, project(params(performance.now())), COUNT);
    if (morphBuf) {
      const bS = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bS); gl.bufferData(gl.ARRAY_BUFFER, morphBuf, gl.STATIC_DRAW);
      [[locS, 0], [locC, 16]].forEach(([l, off]) => { if (l >= 0) { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 4, gl.FLOAT, false, 32, off); } });
      media.classList.add('no-fade');
    } else { if (locS >= 0) gl.vertexAttrib4f(locS, 0, 0, 0, -1); if (locC >= 0) gl.vertexAttrib4f(locC, 0, 0, 0, 0); }
  }
  addEventListener('pagehide', () => { if (M.enabled && M.save && live && visible && lastP) M.save(project(lastP)); });
  new ResizeObserver(() => { layout(); loop(); }).observe(canvas);
  new IntersectionObserver(e => { visible = e[0].isIntersecting; if (visible) loop(); }).observe(hero);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loop(); });
  if (!reduce && matchMedia('(hover: hover) and (pointer: fine)').matches) addEventListener('pointermove', e => { tx = e.clientX / innerWidth - 0.5; ty = e.clientY / innerHeight - 0.5; }, { passive: true });
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); visible = false; media.classList.remove('is-live'); });
  loop();
})();
