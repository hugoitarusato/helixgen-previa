/* ==========================================================================
   HelixGen: transição de partículas entre páginas
   Ao sair de uma página com figura 3D (Home ou as cinco internas), a página
   guarda uma "foto" de cada partícula (posição, tamanho e cor na tela) em
   sessionStorage. A página seguinte começa desenhando as partículas nessas
   posições e as leva até a própria figura (dna.js e shapes.js usam este módulo).
   Sem foto recente, com "reduzir movimento" ou em outra aba, nada acontece.
   ========================================================================== */
(() => {
  const KEY = 'hg-morph', MAX_AGE = 10000;
  const OFF = 2048, SX = 16, SR = 6;   // x,y: (px+2048)*16 em 16 bits; raio: px*6 em 8 bits

  /* snap = { n, xy: Float32Array(2n), r: Float32Array(n), col: Float32Array(4n) (rgb 0..1 + alfa) } */
  function save(snap) {
    try {
      const n = snap.n, buf = new Uint8Array(n * 9), dv = new DataView(buf.buffer);
      for (let i = 0, o = 0; i < n; i++, o += 9) {
        const x = Math.min(65535, Math.max(0, Math.round((snap.xy[2 * i] + OFF) * SX)));
        const y = Math.min(65535, Math.max(0, Math.round((snap.xy[2 * i + 1] + OFF) * SX)));
        dv.setUint16(o, x); dv.setUint16(o + 2, y);
        buf[o + 4] = Math.min(255, Math.round(snap.r[i] * SR));
        for (let k = 0; k < 4; k++) buf[o + 5 + k] = Math.min(255, Math.max(0, Math.round(snap.col[4 * i + k] * 255)));
      }
      let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), f: location.pathname, n, w: innerWidth, d: btoa(s) }));
    } catch (e) { try { sessionStorage.removeItem(KEY); } catch (_) { } }
  }

  function load() {
    try {
      const raw = sessionStorage.getItem(KEY); sessionStorage.removeItem(KEY);
      if (!raw) return null;
      const m = JSON.parse(raw);
      if (document.referrer) { try { if (new URL(document.referrer).pathname !== m.f) return null; } catch (_) { } }
      if (Date.now() - m.t > MAX_AGE || Math.abs(m.w - innerWidth) > 40) return null;
      const s = atob(m.d), n = m.n, dv = new DataView(new ArrayBuffer(n * 9)), u8 = new Uint8Array(dv.buffer);
      for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
      const snap = { n, xy: new Float32Array(2 * n), r: new Float32Array(n), col: new Float32Array(4 * n) };
      for (let i = 0, o = 0; i < n; i++, o += 9) {
        snap.xy[2 * i] = dv.getUint16(o) / SX - OFF; snap.xy[2 * i + 1] = dv.getUint16(o + 2) / SX - OFF;
        snap.r[i] = u8[o + 4] / SR;
        for (let k = 0; k < 4; k++) snap.col[4 * i + k] = u8[o + 5 + k] / 255;
      }
      return snap;
    } catch (e) { return null; }
  }

  /* Liga cada partícula nova a uma antiga, em ordem de varredura (esquerda → direita), para o fluxo ficar coerente.
     Devolve Float32Array(total*8): [x, y, raio, atraso] e [r, g, b, alfa] da partícula antiga. atraso < 0 = sem morph. */
  function prepare(old, cur, total) {
    const nO = old.n, nN = cur.n, out = new Float32Array(total * 8);
    const keyO = new Float32Array(nO), keyN = new Float32Array(nN);
    for (let i = 0; i < nO; i++) keyO[i] = old.xy[2 * i] + 0.4 * old.xy[2 * i + 1];
    for (let i = 0; i < nN; i++) keyN[i] = cur.xy[2 * i] + 0.4 * cur.xy[2 * i + 1];
    const oO = Array.from({ length: nO }, (_, i) => i).sort((a, b) => keyO[a] - keyO[b]);
    const oN = Array.from({ length: nN }, (_, i) => i).sort((a, b) => keyN[a] - keyN[b]);
    for (let k = 0; k < nN; k++) {
      const i = oN[k], j = oO[Math.min(nO - 1, Math.floor(k * nO / nN))], o = i * 8;
      const h = Math.sin(i * 12.9898 + 78.233) * 43758.5453; out[o + 3] = h - Math.floor(h);
      out[o] = old.xy[2 * j]; out[o + 1] = old.xy[2 * j + 1]; out[o + 2] = old.r[j];
      out[o + 4] = old.col[4 * j]; out[o + 5] = old.col[4 * j + 1]; out[o + 6] = old.col[4 * j + 2]; out[o + 7] = old.col[4 * j + 3];
    }
    for (let i = nN; i < total; i++) out[i * 8 + 3] = -1;
    return out;
  }

  /* GLSL comum: mistura da posição, raio, cor e alfa entre a foto antiga (aS, aSC) e a figura nova. */
  const GLSL_ATTR = 'attribute vec4 aS; attribute vec4 aSC; uniform float uMorph;';
  const GLSL_MIX = `
  if (aS.w >= 0.0 && uMorph < 1.0) {
    float e = clamp((uMorph - aS.w * 0.3) / 0.7, 0.0, 1.0);
    e = e < 0.5 ? 4.0 * e * e * e : 1.0 - pow(-2.0 * e + 2.0, 3.0) / 2.0;
    vec2 d = px - aS.xy;
    px = mix(aS.xy, px, e) + vec2(-d.y, d.x) * (aS.w - 0.5) * 0.5 * sin(3.14159 * e);
    r = mix(aS.z, r, e); col = mix(aSC.rgb, col, e); alpha = mix(aSC.a, alpha, e);
  }`;
  const T = 1500;   // duração em ms

  window.HGMorph = { save, load, prepare, GLSL_ATTR, GLSL_MIX, DURATION: T, enabled: !matchMedia('(prefers-reduced-motion: reduce)').matches };
})();
