/* ==========================================================================
   HelixGen: DNA do hero em tempo real (WebGL, sem bibliotecas)
   Milhares de partículas formam as duas fitas e as pontes entre elas. A câmera
   tem profundidade de campo: o centro fica nítido e as pontas desfocam.
   O scroll gira a molécula e aproxima a câmera. No celular a cena é a mesma, com
   menos partículas. Sem WebGL ou com "reduzir movimento" ativo, fica a imagem
   estática (assets/img/dna-hero.webp).
   ========================================================================== */
(() => {
  const canvas = document.getElementById('dna');
  if (!canvas) return;
  const media = canvas.parentElement, hero = canvas.closest('.hero');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // parallax leve da imagem quando o 3D não roda
  function posterParallax() {
    if (reduce) return;
    addEventListener('scroll', () => {
      const p = Math.min(1, Math.max(0, scrollY / hero.offsetHeight));
      media.style.transform = `translate3d(0, ${p * 9}%, 0) scale(${1 + p * 0.06})`;
    }, { passive: true });
  }
  if (reduce) { posterParallax(); return; }
  const small = matchMedia('(max-width: 767px)').matches;   // celular: menos partículas, mesma cena
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'high-performance' });
  if (!gl) { posterParallax(); return; }

  /* ---------- geometria (mesmas proporções da imagem estática) ---------- */
  const W = 2160, H = 1350, R = 215, TURNS = 1.45, U0 = -0.2, U1 = 1.2, TUBE = 46, SIZE = 5.2, PHASE = 2.35;
  let seed = 7;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const uni = (a, b) => a + (b - a) * rnd();
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(6.2831853 * rnd());
  const unit = () => { const x = gauss(), y = gauss(), z = gauss(), l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
  function axis(u) {
    const x = W * (0.02 + 1.02 * u);
    const y = H * (0.06 + 0.5 * Math.pow(Math.max(u, 0), 1.35) - 0.25 * Math.max(-u, 0)) + 70 * Math.sin(u * 6.2831853 + 0.9);
    return [x, y, 1500 * (u - 0.58)];
  }
  function frame(u) {
    const a = axis(u), p = axis(u + 1e-3), m = axis(u - 1e-3);
    let T = [p[0] - m[0], p[1] - m[1], p[2] - m[2]]; const tl = Math.hypot(...T); T = T.map(v => v / tl);
    let N = [T[1], -T[0], 0]; const nl = Math.hypot(...N); N = N.map(v => v / nl);       // T x (0,0,1)
    const B = [T[1] * N[2] - T[2] * N[1], T[2] * N[0] - T[0] * N[2], T[0] * N[1] - T[1] * N[0]]; // T x N
    return { a, T, N, B };
  }
  const data = [];
  // posição = A + N*cx' + B*cy', com (cx, cy) girados pela fase no shader
  function push(f, cx, cy, ct, nx, ny, nt, size, v) {
    data.push(f.a[0] + f.T[0] * ct, f.a[1] + f.T[1] * ct, f.a[2] + f.T[2] * ct, ...f.N, ...f.B, cx, cy, nx, ny, nt, size, v);
  }
  const light = () => { let v = Math.pow(uni(0.3, 1.45), 1.3); return rnd() < 0.05 ? 3 : v; };
  const STRAND = small ? 6500 : 14000, GRAIN = small ? 1.3 : 1;
  for (const ph of [0, PHASE]) {
    for (let i = 0; i < STRAND; i++) {
      const u = uni(U0, U1), f = frame(u), th = 6.2831853 * TURNS * u + ph, d = unit();
      const rr = TUBE * Math.pow(uni(0.25, 1), 0.6) * (0.75 + 0.5 * Math.pow(Math.sin(u * 900 + ph * 7), 2));
      const c = Math.cos(th), s = Math.sin(th);
      let nx = 0.55 * d[0] + 0.45 * c, ny = 0.55 * d[1] + 0.45 * s, nt = 0.55 * d[2]; const l = Math.hypot(nx, ny, nt);
      push(f, R * c + rr * d[0], R * s + rr * d[1], rr * d[2], nx / l, ny / l, nt / l, SIZE * GRAIN * uni(0.6, 1.25), light());
    }
  }
  const RUNGS = Math.floor(TURNS * (U1 - U0) * 10.5);
  for (let k = 0; k < RUNGS; k++) {
    const u = U0 + (U1 - U0) * (k + 0.5) / RUNGS, f = frame(u), th = 6.2831853 * TURNS * u;
    const pa = [R * Math.cos(th), R * Math.sin(th)], pb = [R * Math.cos(th + PHASE), R * Math.sin(th + PHASE)];
    for (const [p0, p1] of [[pa, pb], [pb, pa]]) {
      const m = Math.floor((small ? 105 : 210) * uni(0.7, 1.2)), reach = uni(0.34, 0.47);
      for (let i = 0; i < m; i++) {
        const t = reach * Math.pow(rnd(), 1.25), w = TUBE * 0.42 * (1 - 0.55 * t / reach) * uni(0.2, 1), d = unit();
        push(f, p0[0] + (p1[0] - p0[0]) * t + d[0] * w, p0[1] + (p1[1] - p0[1]) * t + d[1] * w, d[2] * w, d[0], d[1], d[2], SIZE * GRAIN * 0.85 * uni(0.6, 1.2), light());
      }
    }
  }
  const HELIX = data.length / 16;
  // bokeh: discos grandes e fracos ao fundo (size negativo = raio em px do palco)
  const BOKEH = 46;
  for (let i = 0; i < BOKEH; i++) data.push(uni(0, W), uni(0, H), 0, 0, 0, 0, 0, 0, 0, uni(0.5, 1.2), 0, 0, 0, 0, -uni(9, 34), uni(0.04, 0.15));
  const COUNT = HELIX + BOKEH;
  if (COUNT > 65000) return;
  const buf = new Float32Array(data);

  /* ---------- shaders ---------- */
  const M = window.HGMorph || { GLSL_ATTR: 'attribute vec4 aS; attribute vec4 aSC; uniform float uMorph;', GLSL_MIX: '', enabled: false };
  const VS = `
${M.GLSL_ATTR}
attribute vec3 aA, aN, aB; attribute vec4 aC; attribute vec3 aM;
uniform float uPhi, uZoom, uFocus, uScale, uDpr, uTime; uniform vec2 uRes, uCenter, uShift;
varying vec3 vCol; varying float vAlpha, vR, vSize, vKind;
void main() {
  vec2 scr; float r; float alpha; vec3 col; float kind = 0.0;
  if (aM.y < 0.0) {
    scr = aA.xy + vec2(0.0, sin(uTime * 0.25 + aA.x) * 12.0);
    r = -aM.y; alpha = aM.z; col = vec3(0.27, 0.67, 0.75) * aC.x; kind = 2.0;
  } else {
    float c = cos(uPhi), s = sin(uPhi);
    vec2 q = vec2(aC.x * c - aC.y * s, aC.x * s + aC.y * c);
    vec3 p = aA + aN * q.x + aB * q.y;
    vec2 nq = vec2(aC.z * c - aC.w * s, aC.z * s + aC.w * c);
    vec3 n = normalize(aN * nq.x + aB * nq.y + cross(aN, aB) * aM.x);
    float ps = 2600.0 / (2600.0 + p.z);
    scr = (p.xy - vec2(1080.0, 675.0)) * ps + vec2(1080.0, 675.0);
    float r0 = aM.y * ps;
    float coc = abs(p.z - uFocus) * 0.026 * ps;
    r = sqrt(r0 * r0 + coc * coc);
    alpha = clamp(r0 * r0 / (r * r) * 1.35, 0.0, 1.0);
    kind = coc < 1.6 ? 1.0 : 0.0;
    vec3 L = normalize(vec3(-0.50, -0.62, -0.60)), L2 = normalize(vec3(0.7, 0.35, 0.25));
    float diff = pow(clamp(0.38 + 0.62 * dot(n, L), 0.0, 1.0), 1.4);
    float rim = pow(clamp(dot(n, L2), 0.0, 1.0), 2.0);
    vec3 SH = vec3(0.016, 0.172, 0.212), MID = vec3(0.102, 0.659, 0.753), HI = vec3(0.82, 0.97, 1.0);
    col = SH + diff * (MID - SH) + pow(diff, 5.0) * (HI - MID) * 0.9 + rim * vec3(0.157, 0.745, 0.843) * 0.35;
    if (aM.z > 2.0) col = col * 0.4 + HI * 1.15; else col *= aM.z;
    float fog = clamp((p.z - 200.0) / 2600.0, 0.0, 0.8);
    col = mix(col, vec3(0.04, 0.176, 0.216), fog);
  }
  scr = (scr - uCenter) * uZoom + uCenter;
  vec2 px = (scr - uShift) * uScale;
  r *= uZoom * uScale;
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
  let prog;
  try {
    prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) { console.warn('DNA 3D indisponível:', e.message); posterParallax(); return; }
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW);
  [['aA', 3, 0], ['aN', 3, 3], ['aB', 3, 6], ['aC', 4, 9], ['aM', 3, 13]].forEach(([n, size, off]) => {
    const loc = gl.getAttribLocation(prog, n); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 64, off * 4);
  });
  const U = {}; ['uPhi', 'uZoom', 'uFocus', 'uScale', 'uDpr', 'uTime', 'uRes', 'uCenter', 'uShift', 'uMorph'].forEach(n => U[n] = gl.getUniformLocation(prog, n));
  const ibo = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  const order = new Uint16Array(COUNT);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.DEPTH_TEST); gl.clearColor(0, 0, 0, 0);

  /* ---------- ordenação por profundidade (em faixas, O(n)) ---------- */
  const BINS = 512, ZMIN = -1500, ZMAX = 1300, binOf = new Uint16Array(HELIX), counts = new Uint32Array(BINS + 1);
  function sort(phi) {
    const c = Math.cos(phi), s = Math.sin(phi); counts.fill(0);
    for (let i = 0, o = 0; i < HELIX; i++, o += 16) {
      const z = buf[o + 2] + buf[o + 5] * (buf[o + 9] * c - buf[o + 10] * s) + buf[o + 8] * (buf[o + 9] * s + buf[o + 10] * c);
      let b = ((ZMAX - z) / (ZMAX - ZMIN) * BINS) | 0; b = b < 0 ? 0 : b >= BINS ? BINS - 1 : b;   // mais distante primeiro
      binOf[i] = b; counts[b + 1]++;
    }
    for (let b = 0; b < BINS; b++) counts[b + 1] += counts[b];
    for (let i = 0; i < BOKEH; i++) order[i] = HELIX + i;
    for (let i = 0; i < HELIX; i++) order[BOKEH + counts[binOf[i]]++] = i;
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, order, gl.DYNAMIC_DRAW);
  }

  /* ---------- tamanho ---------- */
  let cw = 0, ch = 0, dpr = 1, scale = 1, shiftX = 0, shiftY = 0;
  function resize() {
    cw = canvas.clientWidth; ch = canvas.clientHeight; dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    scale = Math.max(cw / W, ch / H);                 // "cover", como a imagem
    shiftX = (W - cw / scale) * 0.5; shiftY = (H - ch / scale) * 0.35;
    if (cw < ch) {                                    // tela em pé: câmera mais afastada, DNA no terço de cima
      scale *= 0.55;
      shiftX = (W - cw / scale) * 0.55; shiftY = -90;
    }
  }
  new ResizeObserver(resize).observe(canvas); resize();

  /* ---------- laço ---------- */
  let visible = true, running = false, live = false, mx = 0, my = 0, tx = 0, ty = 0, t0 = performance.now();
  new IntersectionObserver(e => { visible = e[0].isIntersecting; if (visible) loop(); }).observe(hero);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loop(); });
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    addEventListener('pointermove', e => { tx = e.clientX / innerWidth - 0.5; ty = e.clientY / innerHeight - 0.5; }, { passive: true });
  }
  let morphBuf = null, mt0 = -1, lastP = null;
  function params(now) {
    const time = (now - t0) / 1000, p = Math.min(1, Math.max(0, scrollY / (hero.offsetHeight || 1)));
    return { time, p, phi: time * 0.07 + p * 2.4 + mx * 0.35, zoom: 1 + p * 0.22, focus: -175 + p * 90, sx: shiftX + mx * 26, sy: shiftY + my * 18 - p * 90 };
  }
  /* Espelho em JS do vertex shader: posição, raio e cor de cada partícula na tela (para a transição entre páginas). */
  function project(P) {
    const c = Math.cos(P.phi), s = Math.sin(P.phi), xy = new Float32Array(2 * HELIX), r = new Float32Array(HELIX), col = new Float32Array(4 * HELIX);
    const nl = Math.hypot(-0.50, -0.62, -0.60), Lx = -0.50 / nl, Ly = -0.62 / nl, Lz = -0.60 / nl, nl2 = Math.hypot(0.7, 0.35, 0.25), Rx = 0.7 / nl2, Ry = 0.35 / nl2, Rz = 0.25 / nl2;
    const SH = [0.016, 0.172, 0.212], MID = [0.102, 0.659, 0.753], HI = [0.82, 0.97, 1.0], RIM = [0.157, 0.745, 0.843], FOG = [0.04, 0.176, 0.216];
    for (let i = 0, o = 0; i < HELIX; i++, o += 16) {
      const qx = buf[o + 9] * c - buf[o + 10] * s, qy = buf[o + 9] * s + buf[o + 10] * c;
      const px = buf[o] + buf[o + 3] * qx + buf[o + 6] * qy, py = buf[o + 1] + buf[o + 4] * qx + buf[o + 7] * qy, pz = buf[o + 2] + buf[o + 5] * qx + buf[o + 8] * qy;
      const mq = buf[o + 11] * c - buf[o + 12] * s, mr = buf[o + 11] * s + buf[o + 12] * c, nt = buf[o + 13];
      const cx0 = buf[o + 4] * buf[o + 8] - buf[o + 5] * buf[o + 7], cy0 = buf[o + 5] * buf[o + 6] - buf[o + 3] * buf[o + 8], cz0 = buf[o + 3] * buf[o + 7] - buf[o + 4] * buf[o + 6];
      let nx = buf[o + 3] * mq + buf[o + 6] * mr + cx0 * nt, ny = buf[o + 4] * mq + buf[o + 7] * mr + cy0 * nt, nz = buf[o + 5] * mq + buf[o + 8] * mr + cz0 * nt; const nn = Math.hypot(nx, ny, nz) || 1; nx /= nn; ny /= nn; nz /= nn;
      const ps = 2600 / (2600 + pz), r0 = buf[o + 14] * ps, coc = Math.abs(pz - P.focus) * 0.026 * ps, rr = Math.sqrt(r0 * r0 + coc * coc);
      let sx = (px - 1080) * ps + 1080, sy = (py - 675) * ps + 675;
      sx = (sx - 1300) * P.zoom + 1300; sy = (sy - 480) * P.zoom + 480;
      xy[2 * i] = (sx - P.sx) * scale; xy[2 * i + 1] = (sy - P.sy) * scale; r[i] = rr * P.zoom * scale;
      const diff = Math.pow(Math.min(1, Math.max(0, 0.38 + 0.62 * (nx * Lx + ny * Ly + nz * Lz))), 1.4), rim = Math.pow(Math.min(1, Math.max(0, nx * Rx + ny * Ry + nz * Rz)), 2), d5 = Math.pow(diff, 5), b = buf[o + 15];
      const fog = Math.min(0.8, Math.max(0, (pz - 200) / 2600));
      for (let k = 0; k < 3; k++) {
        let v = SH[k] + diff * (MID[k] - SH[k]) + d5 * (HI[k] - MID[k]) * 0.9 + rim * RIM[k] * 0.35;
        v = b > 2 ? v * 0.4 + HI[k] * 1.15 : v * b;
        col[4 * i + k] = v + (FOG[k] - v) * fog;
      }
      col[4 * i + 3] = Math.min(1, r0 * r0 / (rr * rr) * 1.35);
    }
    return { n: HELIX, xy, r, col };
  }
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
  function draw(now) {
    running = false;
    if (!visible || document.hidden || !cw) return;
    mx += (tx - mx) * 0.05; my += (ty - my) * 0.05;
    const P = lastP = params(now), phi = P.phi;
    if (morphBuf && mt0 < 0) mt0 = now;
    sort(phi);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(U.uMorph, morphBuf ? Math.min(1, (now - mt0) / M.DURATION) : 1);
    gl.uniform1f(U.uPhi, phi); gl.uniform1f(U.uZoom, P.zoom); gl.uniform1f(U.uFocus, P.focus);
    gl.uniform1f(U.uScale, scale); gl.uniform1f(U.uDpr, dpr); gl.uniform1f(U.uTime, P.time);
    gl.uniform2f(U.uRes, cw, ch); gl.uniform2f(U.uCenter, 1300, 480); gl.uniform2f(U.uShift, P.sx, P.sy);
    gl.drawElements(gl.POINTS, COUNT, gl.UNSIGNED_SHORT, 0);
    if (!live) { live = true; media.classList.add('is-live'); }
    loop();
  }
  function loop() { if (!running) { running = true; requestAnimationFrame(draw); } }
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); visible = false; media.classList.remove('is-live'); });
  loop();
})();
