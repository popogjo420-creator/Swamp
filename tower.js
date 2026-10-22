/* Propeller Pete — procedural voxel model, mesher, rig, poses, GLB + ZIP writers.
   Runs in the browser (window.PeteModel) and in Node (module.exports). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PeteModel = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const V = 0.04; // metres per voxel
  const PI2 = Math.PI * 2;

  /* ---------- noise & colour helpers ---------- */
  function hash(x, y, z, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1442695041) + Math.imul(s | 0, 1013904223)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const sm = (t) => t * t * (3 - 2 * t);
  function vnoise(x, y, z, s) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi);
    let r = 0;
    for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++) {
      r += (dx ? xf : 1 - xf) * (dy ? yf : 1 - yf) * (dz ? zf : 1 - zf) * hash(xi + dx, yi + dy, zi + dz, s);
    }
    return r;
  }
  function smoothstep(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const pack = (r, g, b) => (cl(r) << 16) | (cl(g) << 8) | cl(b);
  const shade = (c, f) => { const [r, g, b] = rgb(c); return pack(r * f, g * f, b * f); };
  const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return pack(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
  // per-voxel jitter kept small: variation comes from smooth noise, not speckle
  const jit = (c, x, y, z, amt, s) => shade(c, 1 + (hash(x, y, z, s || 5) - 0.5) * 2 * 0.3 * (amt == null ? 0.06 : amt));

  const P = {
    // rotting pasty skin
    skin: 0x939a72, skinD: 0x6f7655, skinL: 0xacb18c, ash: 0xa6a898, rot: 0x6f8446, vein: 0x6c5a7d, bruise: 0x735271,
    lip: 0x5c4346, lipD: 0x3e2a2d, wound: 0x5a1717, woundL: 0x7e2622, bone: 0xd5c9a8, boneD: 0xaea283, tongue: 0x6b4656,
    stitch: 0x1e1610, mouth: 0x140909, nail: 0x6f6346, nailD: 0x3b3328, nose: 0x99626a, noseD: 0x6e4550, gold: 0xc9a234,
    hair: 0x5a4838, hairD: 0x3a2e23, hairG: 0x9a958a, stubble: 0x55553f,
    // clothes
    shirt: 0xe6e0c6, shirtD: 0xcfc8aa, stainY: 0xb39a48, stainB: 0x6f5636, blood: 0x6a1a16, sweat: 0xc2ad62,
    plaid: 0x56714f, plaidR: 0x8f3c30, plaidY: 0xb49a46, plaidD: 0x34452f, dirt: 0x5d5040, belt: 0x3b2a1e,
    sock: 0xdcd8c8, sockD: 0xa9a493, sockR: 0xa83b2f, sockB: 0x35589a, sandal: 0x5e4129, sandalD: 0x3f2b1a,
    tattoo: 0x3d5a66, watch: 0x1c1c1e, watchFace: 0x8ea488,
    // chair
    vinyl: 0x2b2725, vinylD: 0x1b1817, vinylL: 0x47403a, foam: 0xcaab5c, foamD: 0xa68841, tape: 0x9c9d97, tapeD: 0x7b7c76,
    chrome: 0xaab1b7, chromeD: 0x767e85, rust: 0x7d4325, rustD: 0x4e2817, rustL: 0x9c5a31, rustO: 0xbb7136,
    tire: 0x2c2b2a, tireD: 0x1b1a19, tireL: 0x403e3b, plastic: 0x202226, plasticL: 0x3a3d42, batt: 0x26272a,
    wireR: 0xa8261f, wireB: 0x161616, cable: 0x3a3a3a, ledOff: 0x3a2a24, hazY: 0xd4a52a, hazK: 0x1d1b18, motor: 0x3d4148,
    grip: 0x1e1c1b, pole: 0xd2cdb8, flag: 0xe8672a, flagD: 0xb64e1e, reflect: 0xdedcd0,
    // propeller beanie
    hatR: 0xd23a2c, hatO: 0xe57a24, hatY: 0xe6c13a, hatG: 0x3f9b4a, hatB: 0x2f63c9, hatP: 0x7b47b8, hatFade: 0x9c9686, hatBand: 0xe9e2cc, trim: 0xc9c2a4,
    propY: 0xf0c530, propB: 0x2a7de1, propHub: 0xd23a2c, brass: 0xb38f3a,
    // eyes
    sclera: 0xdad39b, pupil: 0x1f0404, glow: 0xff3a22, lid: 0x85836a,
  };
  /* ---------- design space ----------
     Shapes are written in design units (D = 4 cm) as signed distance functions and
     rasterised at Q voxels per unit, so the model can be rebuilt finer without
     redrawing it. Colour functions get the design-space centre (X,Y,Z) for smooth
     variation and the voxel index (i,j,k) for fine grain. */
  const Q = 2;

  function Part(name, q) { this.name = name; this.q = q || 1; this.vox = new Map(); }
  const key = (x, y, z) => ((x + 1024) * 2048 + (y + 1024)) * 2048 + (z + 1024);
  Part.prototype.set = function (x, y, z, c, m) {
    if (c == null) return this;
    if (Array.isArray(c)) { m = c[1]; c = c[0]; }
    this.vox.set(key(x, y, z), { x, y, z, c, m: m || 'matte' });
    return this;
  };
  Part.prototype.del = function (x, y, z) { this.vox.delete(key(x, y, z)); };
  Part.prototype.has = function (x, y, z) { return this.vox.has(key(x, y, z)); };
  Part.prototype.get = function (x, y, z) { return this.vox.get(key(x, y, z)); };
  Part.prototype.exposed = function (x, y, z) {
    return !this.has(x + 1, y, z) || !this.has(x - 1, y, z) || !this.has(x, y + 1, z) || !this.has(x, y - 1, z) || !this.has(x, y, z + 1) || !this.has(x, y, z - 1);
  };
  // visit every voxel whose centre lies in the design-space box lo..hi
  function fill(p, lo, hi, fn) {
    const q = p.q;
    const a = lo.map((v) => Math.floor(v * q - 0.5)), b = hi.map((v) => Math.ceil(v * q - 0.5));
    for (let i = a[0]; i <= b[0]; i++) for (let j = a[1]; j <= b[1]; j++) for (let k = a[2]; k <= b[2]; k++) {
      const c = fn((i + 0.5) / q, (j + 0.5) / q, (k + 0.5) / q, i, j, k);
      if (c != null) p.set(i, j, k, c);
    }
  }
  function shape(p, lo, hi, sdf, col) { fill(p, lo, hi, (X, Y, Z, i, j, k) => (sdf(X, Y, Z) <= 0 ? col(X, Y, Z, i, j, k) : null)); }

  /* ---------- signed distance helpers (design units) ---------- */
  const len3 = (a, b, c) => Math.sqrt(a * a + b * b + c * c);
  function sdEll(x, y, z, rx, ry, rz) { const k0 = len3(x / rx, y / ry, z / rz), k1 = len3(x / (rx * rx), y / (ry * ry), z / (rz * rz)); return k1 === 0 ? -Math.min(rx, ry, rz) : k0 * (k0 - 1) / k1; }
  function segD(X, Y, Z, A, B) {
    const px = X - A[0], py = Y - A[1], pz = Z - A[2], dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2];
    const L2 = dx * dx + dy * dy + dz * dz;
    const u = L2 > 0 ? clamp((px * dx + py * dy + pz * dz) / L2, 0, 1) : 0;
    return { d: len3(px - dx * u, py - dy * u, pz - dz * u), u };
  }
  const sdCap = (X, Y, Z, A, B, r) => segD(X, Y, Z, A, B).d - r;
  function sdRBox(X, Y, Z, c, b, r) {
    const qx = Math.abs(X - c[0]) - b[0] + r, qy = Math.abs(Y - c[1]) - b[1] + r, qz = Math.abs(Z - c[2]) - b[2] + r;
    return len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
  }
  const smin = (a, b, k) => { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return b + (a - b) * h - k * h * (1 - h); };
  const capBox = (A, B, r) => [[Math.min(A[0], B[0]) - r - 0.6, Math.min(A[1], B[1]) - r - 0.6, Math.min(A[2], B[2]) - r - 0.6], [Math.max(A[0], B[0]) + r + 0.6, Math.max(A[1], B[1]) + r + 0.6, Math.max(A[2], B[2]) + r + 0.6]];
  function capsules(p, pts, r, col) {
    for (let n = 0; n < pts.length - 1; n++) { const A = pts[n], B = pts[n + 1], bb = capBox(A, B, r); shape(p, bb[0], bb[1], (X, Y, Z) => sdCap(X, Y, Z, A, B, r), col); }
  }
  const frac = (v) => v - Math.floor(v);

  /* ---------- materials as colour functions ---------- */
  const G = (c, i, j, k, amt, s) => shade(c, 1 + (hash(i, j, k, s || 5) - 0.5) * 2 * amt); // fine grain
  const tone = (c, X, Y, Z, amt, f, s) => shade(c, 1 + (vnoise(X * f, Y * f, Z * f, s) - 0.5) * 2 * amt);
  function skinC(X, Y, Z, i, j, k) {
    const n = vnoise(X * 0.16, Y * 0.16, Z * 0.16, 11), b = vnoise(X * 0.11 + 7, Y * 0.11, Z * 0.11, 12);
    let c = mix(P.skin, P.ash, smoothstep(0.42, 0.2, n) * 0.55);
    c = mix(c, P.rot, smoothstep(0.6, 0.82, n) * 0.6);
    c = mix(c, P.bruise, smoothstep(0.66, 0.85, b) * 0.45);
    return G(tone(c, X, Y, Z, 0.05, 0.45, 13), i, j, k, 0.012, 4);
  }
  function metalC(X, Y, Z, i, j, k, rk, s) { // rk = how rusted (0..1)
    s = s || 0;
    const n = vnoise(X * 0.27 + s, Y * 0.27, Z * 0.27 - s, 301), d = vnoise(X * 0.6 + s, Y * 0.6, Z * 0.6, 305);
    if (n < rk) {
      const depth = (rk - n) / Math.max(rk, 1e-3);
      let c = mix(P.rustL, P.rust, smoothstep(0.05, 0.4, depth));
      c = mix(c, P.rustD, smoothstep(0.45, 0.9, depth) * 0.85);
      c = mix(c, P.rustO, smoothstep(0.62, 0.8, d) * 0.5);
      return [G(c, i, j, k, 0.06, 303 + s), 'rust'];
    }
    let c = mix(P.chrome, P.chromeD, smoothstep(0.35, 0.75, d) * 0.6);
    c = mix(c, P.rust, (1 - smoothstep(rk, rk + 0.09, n)) * 0.55);
    return [G(c, i, j, k, 0.025, 304 + s), 'metal'];
  }
  const metal = (rk, s) => (X, Y, Z, i, j, k) => metalC(X, Y, Z, i, j, k, rk, s);
  function vinylC(X, Y, Z, i, j, k, s) {
    s = s || 0;
    const n = vnoise(X * 0.55, Y * 0.55, Z * 0.55, 401 + s);
    let c = tone(P.vinyl, X, Y, Z, 0.12, 0.3, 404 + s);
    if (Math.abs(n - 0.5) < 0.03) c = P.vinylL;
    return [G(c, i, j, k, 0.03, 403 + s), 'plastic'];
  }
  const vinyl = (s) => (X, Y, Z, i, j, k) => vinylC(X, Y, Z, i, j, k, s);
  const piping = (X, Y, Z, i, j, k) => [G(tone(P.vinylL, X, Y, Z, 0.1, 0.3, 405), i, j, k, 0.03, 406), 'plastic'];
  const foamC = (X, Y, Z, i, j, k) => [G(mix(P.foam, P.foamD, vnoise(X * 1.2, Y * 1.2, Z * 1.2, 412)), i, j, k, 0.05, 413), 'matte'];
  const tapeC = (X, Y, Z, i, j, k) => [G(tone(P.tape, X, Y, Z, 0.08, 0.6, 415), i, j, k, 0.03, 416), 'plastic'];
  const rubber = (X, Y, Z, i, j, k) => [G(P.grip, i, j, k, 0.05, 24), 'plastic'];
  const solid = (c, m) => (X, Y, Z, i, j, k) => [G(c, i, j, k, 0.03, 31), m || 'matte'];
  function plaidC(X, Y, Z, i, j, k) {
    const u = ((X % 2.5) + 2.5) % 2.5, v = (((Y + Z) % 2.5) + 2.5) % 2.5;
    const a = u < 0.5, b = v < 0.5, a2 = Math.abs(u - 1.25) < 0.25, b2 = Math.abs(v - 1.25) < 0.25;
    let c = P.plaid;
    if (a && b) c = P.plaidD; else if (a) c = P.plaidR; else if (b) c = P.plaidY;
    else if (a2 || b2) c = mix(P.plaid, P.plaidD, 0.4);
    c = mix(c, P.dirt, smoothstep(0.62, 0.85, vnoise(X * 0.22, Y * 0.22, Z * 0.22, 502)) * 0.45);
    return G(tone(c, X, Y, Z, 0.05, 0.3, 504), i, j, k, 0.03, 503);
  }
  function shirtC(X, Y, Z, i, j, k) {
    let c = (i & 1) ? P.shirt : mix(P.shirt, P.shirtD, 0.1); // ribbed knit
    c = mix(c, P.stainY, smoothstep(0.62, 0.82, vnoise(X * 0.2, Y * 0.2, Z * 0.2, 511)) * 0.45);
    c = mix(c, P.shirtD, smoothstep(18, 14, Y) * 0.3);
    return G(c, i, j, k, 0.02, 513);
  }
  const hairC = (X, Y, Z, i, j, k) => { // soft strands: neighbouring columns differ only a little
    const f = hash(i, 0, k, 601), g = vnoise(X * 0.5, Y * 0.2, Z * 0.5, 603);
    let c = mix(P.hair, P.hairD, 0.25 + 0.35 * f);
    c = mix(c, P.hairG, smoothstep(0.45, 0.75, g) * 0.55);            // grey coming through in streaks
    return G(c, i, j, k, 0.03, 602);
  };

  /* ---------- the wheelchair frame ---------- */
  const TR = 0.52; // tube radius (≈2 cm)
  function chair(p) {
    const T = (pts, rk, s, r) => capsules(p, pts, r || TR, metal(rk == null ? 0.42 : rk, s || 0));
    const XR = -9.75, XL = 9.75;
    for (const x of [XR, XL]) {
      T([[x, 10.25, -8.75], [x, 10.25, 8.75]]);           // seat rail
      T([[x, 4.25, -8.75], [x, 29.25, -8.75]]);           // cane
      T([[x, 4.25, -8.75], [x, 4.25, 5.25]], 0.62);       // base rail
      T([[x, 4.25, 5.25], [x, 10.25, 5.25]], 0.5);        // front upright
      capsules(p, [[x, 4.25, 5.6], [x, 4.25, 6.3]], 0.66, rubber);
      for (const [y, z] of [[10.25, -8.75], [4.25, -8.75], [10.25, 5.25], [4.25, 5.25]]) capsules(p, [[x, y - 0.35, z], [x, y + 0.35, z]], 0.72, solid(P.chromeD, 'metal')); // joint collars
    }
    T([[XR, 4.25, -8.75], [XL, 4.25, -8.75]], 0.65);
    // push handles: left keeps a cracked grip, right is bent up and bare
    T([[XL, 29.25, -8.75], [XL, 29.9, -10.0], [XL, 29.9, -11.8]]);
    capsules(p, [[XL, 29.9, -11.6], [XL, 29.9, -14.3]], 0.78, (X, Y, Z, i, j, k) => [G((k & 1) ? P.grip : shade(P.grip, 1.4), i, j, k, 0.03, 21), 'plastic']);
    T([[XR, 29.25, -8.75], [XR, 29.9, -10.4], [XR, 31.4, -13.2]], 0.85);
    // quilted, sagging backrest with piping round the edge
    const sag = (X, Y) => 0.95 * Math.max(0, 1 - (X / 6.4) ** 2 - ((Y - 18.6) / 5.4) ** 2);
    const quilt = (Y) => 0.6 * Math.pow(Math.max(0, Math.sin(Math.PI * frac((Y - 12) / 4))), 0.6);
    const tear = (X, Y) => ((X + 6) ** 2) / 4.4 + ((Y - 24) ** 2) / 3.2 < 1;
    fill(p, [-9, 12, -11.2], [9, 28.4, -7.9], (X, Y, Z, i, j, k) => {
      const zf = -8 - sag(X, Y), zb = -9 - sag(X, Y) - quilt(Y);
      if (Z > zf || Z < zb) return null;
      if (tear(X, Y) && Z > zf - 0.5) return foamC(X, Y, Z, i, j, k);
      if (Z < -9 - sag(X, Y)) {                                  // back face details
        if (X > -1.9 && X < -0.4 && Y > 15 && Y < 22) return tapeC(X, Y, Z, i, j, k);
        if (Y > 18 && Y < 19 && X > -4 && X < 1.6) return tapeC(X, Y, Z, i, j, k);
        if (X > -7.4 && X < -4.6 && Y > 13.2 && Y < 15.6) return [Math.abs(Y - 14.4) < 0.3 && Math.abs(X + 6) < 0.9 ? 0xe2ded2 : 0x2f5aa8, 'plastic']; // faded parking sticker
      }
      return vinylC(X, Y, Z, i, j, k, 7);
    });
    capsules(p, [[-9, 12, -8.6], [9, 12, -8.6], [9, 28.4, -8.6], [-9, 28.4, -8.6], [-9, 12, -8.6]], 0.48, piping);
    for (const x of [-9.2, 9.2]) for (let y = 13; y <= 27; y += 3.5) capsules(p, [[x, y, -8.7], [x, y, -8.7]], 0.45, solid(P.chromeD, 'metal'));
    // cracked seat cushion, piped front edge, foam bursting out of a rip
    shape(p, [-9.2, 9.8, -7.2], [9.2, 12.2, 7.2], (X, Y, Z) => sdRBox(X, Y, Z, [0, 11, 0], [9, 1, 7], 0.6), (X, Y, Z, i, j, k) => {
      if (((X - 6.4) ** 2) / 3.6 + ((Z - 5.6) ** 2) / 2.2 < 1 && Y > 11.4) return foamC(X, Y, Z, i, j, k);
      if (X > -3.2 && X < -1.6 && (Z > 6.3 || Y < 10.5)) return tapeC(X, Y, Z, i, j, k);
      return vinylC(X, Y, Z, i, j, k, 2);
    });
    capsules(p, [[-8.6, 11.9, 6.75], [8.6, 11.9, 6.75]], 0.4, piping);
    shape(p, [5, 11.6, 4.3], [8, 12.7, 7.2], (X, Y, Z) => sdEll(X - 6.4, Y - 12, Z - 5.7, 1.5, 0.55, 1.1), foamC);
    // armrests (left one warped: its front end sags)
    for (const side of [-1, 1]) {
      const xc = 12 * side, xp = 11.75 * side, xr = side < 0 ? XR : XL;
      const drop = (Z) => (side > 0 ? 0.95 * smoothstep(0.4, 3.4, Z) : 0);
      fill(p, [xc - 1.7, 15.8, -6.7], [xc + 1.7, 19.2, 3.7], (X, Y, Z, i, j, k) => {
        const yy = Y + drop(Z);
        if (sdRBox(X, yy, Z, [xc, 18, -1.5], [1.5, 0.95, 4.9], 0.5) > 0) return null;
        if (yy > 18.5 && Z < -4.8 && X * side < 12.6) return foamC(X, Y, Z, i, j, k);
        if (yy < 17.35 && Math.abs(X - xc) > 1.05) return piping(X, Y, Z, i, j, k);
        return vinylC(X, Y, Z, i, j, k, 3);
      });
      T([[xp, 16.3, -6.2], [xp, 16.3 - drop(-1), -1], [xp, 16.3 - drop(3.2), 3.2]], 0.5);
      T([[xp, 11, -5.25], [xp, 16.3, -5.25]], 0.5); T([[xp, 11, 2.25], [xp, 16.3 - drop(2.25), 2.25]], 0.5);
      T([[xp, 11, -5.25], [xr, 10.25, -5.25]], 0.6); T([[xp, 11, 2.25], [xr, 10.25, 2.25]], 0.6);
    }
    // rear axle + finned drive motors with brass end bells
    T([[-9, 7, -5], [9, 7, -5]], 0.8, 7, 0.85);
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? -13 : 9.5, x1 = side < 0 ? -9.5 : 13, bell = side < 0 ? -9.5 : 9.5;
      fill(p, [x0, 4.4, -7.6], [x1, 9.6, -2.4], (X, Y, Z, i, j, k) => {
        const r = Math.hypot(Y - 7, Z + 5), nearBell = Math.abs(X - bell) < 0.75;
        const R = nearBell ? 2.2 : (i & 1 ? 2.45 : 2.15);
        if (r > R) return null;
        let c = nearBell ? (r < 1.1 ? shade(P.brass, 1.15) : P.brass) : (i & 1 ? P.motor : shade(P.motor, 0.72));
        c = mix(c, P.rust, smoothstep(0.55, 0.3, vnoise(X * 0.4, Y * 0.4, Z * 0.4, 442)) * 0.7);
        if (Y < 5.6) c = mix(c, P.dirt, 0.35);
        return [G(c, i, j, k, 0.03, 443), 'metal'];
      });
    }
    // battery box: rusty steel, hazard band, spec plate, terminals
    shape(p, [-8.2, 1.8, -3.2], [8.2, 8.7, 4.7], (X, Y, Z) => sdRBox(X, Y, Z, [0, 5.25, 0.75], [8, 3.25, 3.75], 0.45), (X, Y, Z, i, j, k) => {
      if (Z > 4.2) {
        if (Y > 6 && Y < 7.6 && Math.abs(X) < 7.4) return [frac((X - Y) / 1.6) < 0.5 ? P.hazY : P.hazK, 'plastic'];
        if (Y > 3 && Y < 4.8 && Math.abs(X) < 2.2) return [(Y > 3.6 && Y < 4.2 && Math.abs(X) < 1.5 && (i & 1)) ? P.hazK : 0xd9d2bd, 'plastic'];
      }
      return metalC(X, Y, Z, i, j, k, 0.62, 3);
    });
    for (const [x, c] of [[-6, P.wireR], [-3, P.wireB], [2.5, P.wireR], [5.5, P.wireB]]) capsules(p, [[x, 8.6, 0.5], [x, 9.4, 0.5]], 0.45, solid(c, 'plastic'));
    capsules(p, [[2.5, 3.5, 5.0], [2.5, 1.5, 5.6], [4.5, 0.7, 5.6], [6.5, 1.5, 4.6], [8.5, 3.5, -1.5], [9.5, 4.5, -3.5]], 0.3, solid(P.wireR, 'plastic'));
    capsules(p, [[-3.5, 3.5, 5.0], [-3.5, 1.2, 5.6], [-6.5, 1.0, 4.6], [-9.5, 3.5, -0.5], [-10.5, 4.5, -3.5]], 0.3, solid(P.wireB, 'plastic'));
    // caster housings hanging off the rail ends
    for (const x of [-9.5, 9.5]) { T([[x, 7.7, 8.5], [x, 10.25, 8.5]], 0.35, 0, 0.62); T([[x * 1.026, 10.25, 8.75], [x, 10.25, 8.5]], 0.4); }
    // footrest hangers: right plate snapped off, left plate bent and rusted through
    T([[-9.5, 10.25, 8.9], [-9.5, 6.5, 11.2], [-9.5, 4.6, 12.4]], 0.55);
    T([[-9.5, 4.6, 12.4], [-8.2, 4.3, 13.3]], 0.95, 0, 0.48);
    T([[9.5, 10.25, 8.9], [9.5, 6.5, 11.2], [9.5, 4.6, 12.4]], 0.55);
    fill(p, [4, 1.8, 11], [9.2, 3.9, 15.2], (X, Y, Z, i, j, k) => {
      const y0 = 3.0 - 0.9 * smoothstep(13.6, 15, Z) * smoothstep(6.2, 4.2, X);
      const stud = frac((X + Z) / 1.4) < 0.28 && frac((X - Z) / 1.4) < 0.28;
      if (Y < y0 || Y > y0 + (stud ? 0.85 : 0.5)) return null;
      if (Math.hypot(X - 6.6, Z - 13.4) < 0.7) return null;
      return metalC(X, Y, Z, i, j, k, 0.7, 9);
    });
    // joystick controller on the right armrest
    shape(p, [-14.3, 18.7, 1.7], [-9.7, 21.3, 7.3], (X, Y, Z) => sdRBox(X, Y, Z, [-12, 20, 4.5], [2, 1, 2.5], 0.4), (X, Y, Z, i, j, k) => {
      if (Z < 2.9) return tapeC(X, Y, Z, i, j, k);
      if (Z > 6.6 && Y > 20.1 && Y < 20.7) {                                      // LED bar on the front edge
        const led = Math.floor((X + 14) / 1); if (Math.abs(frac(X + 14) - 0.5) < 0.32) return led === 0 ? [P.glow, 'glow'] : [P.ledOff, 'plastic'];
      }
      if (Math.abs(X + 11.4) < 0.25 && Math.abs(Z - 5.6) < 1.2 && Y > 20) return [shade(P.plasticL, 1.35), 'plastic']; // crack
      return [G(Y > 20.6 ? P.plasticL : P.plastic, i, j, k, 0.03, 462), 'plastic'];
    });
    capsules(p, [[-10.9, 21.0, 2.9], [-10.9, 21.45, 2.9]], 0.45, solid(P.wireR, 'plastic'));
    capsules(p, [[-10.9, 21.0, 6.1], [-10.9, 21.45, 6.1]], 0.42, solid(P.hazY, 'plastic'));
    fill(p, [-14.2, 20.9, 2.7], [-10.8, 21.9, 6.3], (X, Y, Z, i, j, k) => { // rubber boot round the stick
      const r = Math.hypot(X + 12.5, Z - 4.5); if (r > 1.45 || r < 0.5 || Y > 21.9 - r * 0.45) return null;
      return [frac(r * 2.2) < 0.5 ? P.vinylD : P.vinyl, 'plastic'];
    });
    T([[-12, 18.3, 4.2], [-12, 18.3, 6.4]], 0.5);
    capsules(p, [[-14.5, 19.5, 2.2], [-14.5, 17.5, 0.5], [-14.5, 16.6, -2.5], [-13.5, 16.5, -6.5], [-13.5, 13.5, -6.5], [-11.5, 10.5, -6.5]], 0.32, (X, Y, Z, i, j, k) => [frac((X + Y + Z) * 1.4) < 0.5 ? P.cable : P.wireB, 'plastic']);
    // flag pole mount on the left cane
    capsules(p, [[10.5, 20, -9.5], [10.5, 27.2, -9.5]], 0.4, solid(P.pole, 'plastic'));
    for (const y of [21, 25]) capsules(p, [[10.5, y - 0.3, -9.5], [10.5, y + 0.3, -9.5]], 0.75, metal(0.35, 5)), capsules(p, [[10.5, y, -9.5], [XL, y, -8.75]], 0.4, metal(0.4, 5));
    capsules(p, [[10.5, 22.6, -9.5], [10.5, 23.6, -9.5]], 0.72, tapeC);
  }

  /* ---------- warped drive wheels ---------- */
  function wheel(p, side) {
    const xc = side < 0 ? -15 : 15, inner = side < 0 ? 1 : -1;
    const th0 = side < 0 ? 2.1 : -0.7, ph = side < 0 ? 0.6 : 2.2, S = side < 0 ? 0 : 40;
    const Rof = (th) => 7.05 - 0.9 * Math.pow(Math.max(0, Math.cos(th - th0)), 10);
    const wob = (th) => 0.75 * Math.sin(th + ph);                       // bent rim wobbles side to side
    const spokes = [];
    for (let k = 0; k < 8; k++) if (k !== 5) spokes.push({ a: k * PI2 / 8 + 0.2, bend: k === 2 ? 0.12 : 0 });
    fill(p, [xc - 2.8, -0.3, -12.3], [xc + 2.8, 14.3, 2.3], (X, Y, Z, i, j, k) => {
      const dy = Y - 7, dz = Z + 5, rho = Math.hypot(dy, dz), th = Math.atan2(dy, dz);
      const R = Rof(th), xw = xc + wob(th);
      // tyre: torus with chevron tread cut into the crown
      const dT = Math.hypot(rho - (R - 0.95), (X - xw) * 1.04) - 0.95;
      if (dT <= 0) {
        const crown = rho > R - 0.42, bald = Math.cos(th - 0.4 - S) > 0.86;
        const groove = frac(th * 36 / PI2 + Math.abs(X - xw) * 0.45) < 0.3;
        if (crown && groove && !bald) return null;
        let c = P.tire;
        if ((X - xw) * inner < -0.5 && rho > R - 1.55 && rho < R - 1.05) c = shade(P.tireL, 1.3); // faded sidewall stripe
        if (bald && crown) c = shade(P.tireL, 1.1);
        return [G(c, i, j, k, 0.04, 802 + S), 'matte'];
      }
      // rim
      if (Math.hypot(rho - (R - 2.15), (X - xw) * 0.9) <= 0.5) return metalC(X, Y, Z, i, j, k, 0.5, 11);
      // hub with brass cap and five bolts, reaching in toward the motor
      if (rho <= 1.75 && (X - xc) * inner >= -0.9 && (X - xc) * inner <= 2.4) {
        const face = (X - xc) * inner < -0.45;
        if (face && rho < 0.8) return [P.brass, 'metal'];
        if (face && rho > 0.95 && rho < 1.45 && frac((th + 7 * PI2) / (PI2 / 5)) < 0.28) return [P.chrome, 'metal'];
        return [G(shade(P.motor, 1.15), i, j, k, 0.03, 33), 'metal'];
      }
      // spokes
      if (rho > 1.5 && rho < R - 2.1) {
        for (const s of spokes) {
          const u = clamp((rho - 1.6) / (R - 2.5 - 1.6), 0, 1);
          const a = s.a + s.bend * Math.sin(Math.PI * u);
          let da = th - a; da = Math.atan2(Math.sin(da), Math.cos(da));
          const xs = xc + inner * 0.6 + (wob(a) - inner * 0.6) * u;
          if (Math.hypot(da * rho, X - xs) < 0.34) return metalC(X, Y, Z, i, j, k + 7, 0.42, 17);
        }
      }
      return null;
    });
  }

  /* ---------- front casters ---------- */
  function casterFork(p, side) {
    const xs = 9.5 * side;
    const T = (pts, r, rk) => capsules(p, pts, r, metal(rk == null ? 0.55 : rk, 21 + side));
    T([[xs, 5.6, 8.5], [xs, 8.1, 8.5]], 0.42, 0.35);
    shape(p, [xs - 1.7, 4.6, 6.8], [xs + 1.7, 6, 9.4], (X, Y, Z) => sdRBox(X, Y, Z, [xs, 5.3, 8.1], [1.45, 0.42, 0.95], 0.3), metal(0.6, 22));
    for (const dx of [-1.05, 1.05]) { T([[xs + dx, 5.1, 8.0], [xs + dx, 2.5, 7.5]], 0.36); capsules(p, [[xs + dx * 1.3, 2.5, 7.5], [xs + dx * 1.3, 2.5, 7.5]], 0.45, solid(P.rustD, 'rust')); }
  }
  function casterWheel(p, side) {
    const xs = 9.5 * side, th0 = side < 0 ? 1.2 : -2;
    fill(p, [xs - 1, -0.2, 4.7], [xs + 1, 5.2, 10.3], (X, Y, Z, i, j, k) => {
      const rho = Math.hypot(Y - 2.5, Z - 7.5), th = Math.atan2(Y - 2.5, Z - 7.5);
      const R = 2.4 - 0.4 * Math.pow(Math.max(0, Math.cos(th - th0)), 8);
      if (Math.hypot(rho - (R - 0.62), X - xs) <= 0.62) return [G(frac(th * 10 / PI2) < 0.5 ? P.tire : P.tireL, i, j, k, 0.04, 811), 'matte'];
      if (rho < R - 0.9 && Math.abs(X - xs) < 0.45) return rho < 0.6 ? [P.chromeD, 'metal'] : [shade(P.tireL, 1.6), 'plastic'];
      return null;
    });
  }

  /* ---------- body ---------- */
  const THIGH = [[-4.6, 14.2, -1.5], [-4.7, 13.9, 5.4]]; // right thigh axis (left is mirrored)
  const mirrorPt = (a) => [-a[0], a[1], a[2]];
  const thighD = (X, Y, Z) => Math.min(segD(X, Y, Z, THIGH[0], THIGH[1]).d, segD(X, Y, Z, mirrorPt(THIGH[0]), mirrorPt(THIGH[1])).d);
  function bodySDF(X, Y, Z) {
    let d = sdEll(X, Y - 14, Z + 2.5, 9.8, 3.2, 6.2);               // hips
    d = smin(d, sdEll(X, Y - 18, Z - 1.2, 10.5, 6.1, 7.9), 1.4);     // gut
    d = smin(d, sdEll(X, Y - 22.4, Z + 1.5, 9.3, 4.6, 6.1), 1.4);    // chest
    d = smin(d, sdEll(X, Y - 25.2, Z + 2, 10.3, 2.5, 4.6), 1.2);     // shoulders
    d = smin(d, Math.min(sdEll(X + 3.6, Y - 21.4, Z - 3, 3.4, 2.8, 2.6), sdEll(X - 3.6, Y - 21.4, Z - 3, 3.4, 2.8, 2.6)), 0.8); // moobs
    d = smin(d, sdEll(X, Y - 26.8, Z + 1, 4.6, 2.8, 4.1), 1.0);      // neck
    d = smin(d, thighD(X, Y, Z) - 2.8, 1.0);                          // thighs
    return Math.max(d, 12 - Y);                                       // sits flat on the cushion
  }
  function torso(p) {
    const hem = (X, Z) => 15.7 + 3.6 * smoothstep(-1, 5, Z) + 0.45 * Math.sin(X * 0.55);
    const kinds = new Map();
    const K = (i, j, k) => kinds.get(i + ',' + j + ',' + k);
    fill(p, [-12, 12, -10], [12, 29.5, 11], (X, Y, Z, i, j, k) => {
      if (bodySDF(X, Y, Z) > 0) return null;
      const ax = Math.abs(X);
      let kind, c;
      const shorts = (thighD(X, Y, Z) < 3.0 && Z <= 6.8) || (Y <= 15.5 && Z <= 1.5) || (Y <= 16.4 && Z < -2);
      if (shorts) { kind = 'shorts'; c = plaidC(X, Y, Z, i, j, k); }
      else if (Y > 15.5 && Y < 16.6 && Z < 0.5) { kind = 'belt'; c = G(tone(P.belt, X, Y, Z, 0.1, 0.5, 531), i, j, k, 0.03, 532); }
      else {
        kind = 'skin';
        if (Y >= hem(X, Z)) {
          kind = 'shirt';
          if (ax >= 6.8 && Y >= 21.2) kind = 'skin';                        // big armholes
          if (Y >= 24.6 && (ax < 3.5 || ax > 6.4)) kind = 'skin';           // thin straps
          if (Z > 0 && Y >= 22.6 && ax <= 2.6 + (Y - 22.6) * 0.8) kind = 'skin'; // scoop neck
          if (Z < -3 && Y >= 26 && ax < 3.5) kind = 'skin';
        }
        c = kind === 'shirt' ? shirtC(X, Y, Z, i, j, k) : skinC(X, Y, Z, i, j, k);
      }
      kinds.set(i + ',' + j + ',' + k, kind);
      return c;
    });
    const q = p.q, ctr = (v) => [(v.x + 0.5) / q, (v.y + 0.5) / q, (v.z + 0.5) / q];
    // rolled cuffs on the shorts
    fill(p, [-8.5, 12, 5.2], [8.5, 17.5, 7.2], (X, Y, Z, i, j, k) => {
      if (Y < 12 || Z <= 5.5 || Z > 6.8 || thighD(X, Y, Z) > 3.3 || p.has(i, j, k)) return null;
      kinds.set(i + ',' + j + ',' + k, 'cuff');
      return mix(plaidC(X, Y, Z, i, j, k), P.plaidD, 0.25);
    });
    // cargo pocket on the right thigh, with a flap and a snap
    fill(p, [-8.6, 12.4, 0.3], [-5.5, 15.8, 4.3], (X, Y, Z, i, j, k) => {
      if (p.has(i, j, k) || thighD(X, Y, Z) > 3.25 || X > -6.4) return null;
      kinds.set(i + ',' + j + ',' + k, 'shorts');
      if (Math.abs(Y - 15.1) < 0.35 && Math.abs(Z - 2.3) < 0.4) return [P.chromeD, 'metal'];
      return Y > 14.6 ? mix(plaidC(X, Y, Z, i, j, k), P.plaidD, 0.5) : mix(plaidC(X, Y, Z, i, j, k), P.plaid, 0.25);
    });
    // ribbed binding where the tank top meets skin
    const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (const v of p.vox.values()) {
      if (K(v.x, v.y, v.z) !== 'shirt' || !p.exposed(v.x, v.y, v.z)) continue;
      let edge = false;
      for (const [dx, dy, dz] of N6) for (let s = 1; s <= 2; s++) if (K(v.x + dx * s, v.y + dy * s, v.z + dz * s) === 'skin') edge = true;
      if (edge) v.c = G((v.y & 1) ? P.trim : shade(P.trim, 1.06), v.x, v.y, v.z, 0.02, 533);
    }
    // surface details
    for (const v of p.vox.values()) {
      if (!p.exposed(v.x, v.y, v.z)) continue;
      const [X, Y, Z] = ctr(v), ax = Math.abs(X), kd = K(v.x, v.y, v.z);
      if (kd === 'skin' && ax < 0.5 && Y > 12.5 && Y < 15.2 && Z > 4 && hash(v.x, v.y, v.z, 541) > 0.6) v.c = mix(v.c, P.hairD, 0.5);
      if (kd === 'skin' && Z > 0 && Y > 22.4 && Y < 26.2 && ax < 2.8 && hash(v.x, v.y, v.z, 543) > 0.7) v.c = mix(v.c, P.hairD, 0.55);
      if (kd === 'shirt') {
        if (sdEll(X - 2.5, Y - 19.8, Z - 8.5, 2.6, 1.9, 3) < 0 || (Math.abs(X - 2.2) < 0.35 && Y > 16.6 && Y < 18.6) || (Math.abs(X - 3.9) < 0.3 && Y > 17.4 && Y < 18.6)) v.c = tone(P.stainY, X, Y, Z, 0.1, 0.6, 545);
        if (sdEll(X + 2, Y - 22, Z - 5, 2.3, 2.1, 2.5) < 0 || (Math.abs(X + 2.8) < 0.3 && Y > 18 && Y < 21.5) || (Math.abs(X + 1.1) < 0.3 && Y > 19 && Y < 21.5)) v.c = tone(P.blood, X, Y, Z, 0.12, 0.6, 547);
        if (ax > 6 && ax < 8 && Y > 18 && Y < 20.5) v.c = mix(v.c, P.sweat, 0.4);
      }
      const b = sdEll(X + 8.2, Y - 25.6, Z + 1.4, 2, 1.6, 1.8);             // bite on the right shoulder
      if (b < 0) v.c = b < -0.8 ? P.bone : (hash(v.x, v.y, v.z, 551) > 0.5 ? P.woundL : P.wound);
      
    }
    // navel: a small dark dimple
    for (const v of [...p.vox.values()]) {
      const [X, Y, Z] = ctr(v);
      const d = Math.hypot(X - 0, Y - 16.2, 0);
      if (d < 0.55 && Z > 7.5 && p.exposed(v.x, v.y, v.z)) { p.del(v.x, v.y, v.z); }
    }
    for (const v of p.vox.values()) { const [X, Y, Z] = ctr(v); if (Math.hypot(X, Y - 16.2) < 0.95 && Z > 7 && p.exposed(v.x, v.y, v.z)) v.c = mix(v.c, P.mouth, Math.hypot(X, Y - 16.2) < 0.6 ? 0.6 : 0.25); }
    // torn shirt on the left flank: exposed ribs
    const del = [];
    for (const v of p.vox.values()) {
      const [X, Y, Z] = ctr(v);
      if (X < 6) continue;
      const d = ((Y - 18.5) ** 2) / 6 + (Z ** 2) / 4;
      if (d < 1 && bodySDF(X, Y, Z) > -0.6) del.push(v);
      else if (d < 1 && bodySDF(X, Y, Z) > -1.2) v.c = frac(Y * 0.9) < 0.45 ? P.bone : (hash(v.x, v.y, v.z, 562) > 0.5 ? P.woundL : P.wound);
      else if (d < 1.25 && K(v.x, v.y, v.z) === 'shirt') v.c = P.trim;
    }
    del.forEach((v) => p.del(v.x, v.y, v.z));
  }

  function legPart(p, side) { // shin + foot, written for the right leg and mirrored for the left
    const mx = side < 0 ? 1 : -1;
    const S = side < 0 ? 0 : 50;
    const A = [-4.6, 12.9, 6.4], B = [-4.45, 9.2, 7.1];
    fill(p, side < 0 ? [-7.2, 5, 4] : [1.8, 5, 4], side < 0 ? [-1.8, 15.5, 11.6] : [7.2, 15.5, 11.6], (Xw, Y, Z, i, j, k) => {
      const X = Xw * mx;                                   // right-leg coordinates
      const shin = Math.min(sdCap(X, Y, Z, A, B, 1.9), sdEll(X + 4.6, Y - 13.1, Z - 6.4, 2.1, 2.0, 2.0));
      const foot = smin(sdEll(X + 4.5, Y - 7.0, Z - 8.3, 1.75, 1.05, 2.4), sdEll(X + 4.5, Y - 7.4, Z - 7.0, 1.6, 1.4, 1.5), 0.6);
      const sole = side < 0 ? sdRBox(X, Y, Z, [-4.5, 5.95, 8.4], [1.95, 0.35, 2.7], 0.3) : 99;
      const strap = side < 0 ? Math.min(sdRBox(X, Y, Z, [-4.5, 7.3, 7.4], [1.95, 1.0, 0.45], 0.3), sdRBox(X, Y, Z, [-4.5, 7.1, 9.4], [1.95, 0.85, 0.45], 0.3)) : 99;
      const toe = side > 0 ? sdEll(X + 3.4, Y - 6.75, Z - 10.6, 0.6, 0.55, 0.65) : 99;
      const d = Math.min(smin(shin, foot, 0.8), sole, strap, toe);
      if (d > 0) return null;
      if (toe <= 0) return Z > 10.95 && Y > 6.8 ? [P.nail, 'matte'] : skinC(X, Y, Z, i, j, k);
      if (side < 0 && sole <= 0 && foot > -0.1) return [G(P.sandalD, i, j, k, 0.04, 577), 'matte'];
      if (side < 0 && strap <= 0 && foot > -0.25) return Math.abs(X + 2.6) < 0.4 && Math.abs(Z - 7.4) < 0.4 ? [P.chromeD, 'metal'] : [G(P.sandal, i, j, k, 0.04, 578), 'matte'];
      if (Y > 11.4) {
        let c = skinC(X, Y, Z, i, j, k + S);
        if (hash(i, j, k, 571 + S) > 0.82) c = mix(c, P.hair, 0.5);
        const vein = Math.abs(Math.sin(Y * 2.2 + Math.sin(Y * 1.3) * 1.5) * 0.6 + (X + 4.6) * 0.9) < 0.18 && Z < 6;
        if (vein) c = mix(c, P.vein, 0.6);
        return c;
      }
      let c = P.sock;
      if (Y > 10.6 && Y < 11.2) c = P.sockR; else if (Y > 9.6 && Y < 10.2) c = P.sockB;
      else if (Y > 10.9 && (i & 1)) c = shade(P.sock, 0.94);         // ribbed cuff
      if (Y < 6.4) c = mix(P.sockD, P.dirt, 0.5);
      if (side > 0 && Math.hypot(X + 3.4, Y - 6.75, Z - 10.2) < 0.95) c = mix(P.sockD, P.dirt, 0.6); // frayed hole round the toe
      c = mix(c, P.dirt, smoothstep(0.65, 0.85, vnoise(X * 0.5, Y * 0.5, Z * 0.5, 575 + S)) * 0.4);
      return [G(c, i, j, k, 0.025, 576 + S), 'matte'];
    });
  }

  /* ---------- head (modelled 3 units high, dropped onto the shoulders by HY) ---------- */
  function headPart(p) {
    const eyeRect = (X, Y) => (Math.abs(X + 3) < 2 || Math.abs(X - 3) < 2) && Y > 37 && Y < 40;
    fill(p, [-9, 25.5, -8], [9, 44, 9.5], (X, Y, Z, i, j, k) => {
      const se = Math.pow(Math.pow(Math.abs(X / 7.3), 2.6) + Math.pow(Math.abs((Y - 35.7) / 6.8), 2.6) + Math.pow(Math.abs((Z + 0.2) / 6.3), 2.6), 1 / 2.6);
      const skull = smin((se - 1) * 6.3, sdRBox(X, Y, Z, [0, 35.4, 3], [5.6, 4.9, 3.0], 0.8), 1.1);
      const jowls = Math.min(sdEll(X - 5.2, Y - 32.4, Z - 3.1, 2.7, 2.7, 2.6), sdEll(X + 5.2, Y - 32.4, Z - 3.1, 2.7, 2.7, 2.6));
      const chin2 = sdEll(X, Y - 28.6, Z - 2.8, 5.6, 2.3, 3.3);
      const cheeks = Math.min(sdEll(X + 4.1, Y - 34.3, Z - 5.2, 1.9, 1.5, 1.1), sdEll(X - 4.1, Y - 34.3, Z - 5.2, 1.9, 1.5, 1.1));
      let head = smin(smin(smin(skull, jowls, 0.9), chin2, 1.0), cheeks, 0.7);
      const ears = Math.min(sdEll(X - 7.45, Y - 35.6, Z, 0.9, 1.9, 1.3), sdEll(X + 7.45, Y - 35.6, Z, 0.9, 1.9, 1.3));
      const nose = smin(sdEll(X, Y - 35.4, Z - 6.85, 1.95, 1.5, 1.45), sdCap(X, Y, Z, [0, 38.3, 6.0], [0, 36.4, 6.7], 0.75), 0.4);
      const brow = Math.min(sdEll(X + 3.1, Y - 40.45, Z - 5.55, 2.9, 0.75, 0.8), sdEll(X - 3.1, Y - 40.45, Z - 5.55, 2.9, 0.75, 0.8));
      const bags = Math.min(sdEll(X + 3, Y - 36.45, Z - 5.7, 1.7, 0.55, 0.55), sdEll(X - 3, Y - 36.45, Z - 5.7, 1.7, 0.55, 0.55));
      const stache = smin(smin(sdEll(X + 2.3, Y - 32.75, Z - 6.35, 2.7, 0.95, 0.8), sdEll(X - 2.3, Y - 32.75, Z - 6.35, 2.7, 0.95, 0.8), 0.5),
        Math.min(sdCap(X, Y, Z, [4.4, 32.5, 6.1], [5.4, 30.8, 5.8], 0.55), sdCap(X, Y, Z, [-4.4, 32.5, 6.1], [-5.4, 30.8, 5.8], 0.55)), 0.45);
      const lip = sdCap(X, Y, Z, [-2.7, 30.0, 5.75], [2.7, 30.0, 5.75], 0.6);
      const cav = sdRBox(X, Y, Z, [0, 30.95, 6.3], [3.3, 0.95, 1.3], 0.8);
      const tongue = sdEll(X, Y - 30.35, Z - 5.15, 1.8, 0.55, 1.0);
      const wound = sdEll(X - 6.1, Y - 32.2, Z - 4.4, 1.0, 0.9, 1.1);
      const chew = sdEll(X + 7.8, Y - 37.3, Z - 0.9, 0.75, 0.75, 0.85);
      const bowl = Math.min(sdEll(X - 8.15, Y - 35.7, Z, 0.45, 1.1, 0.7), sdEll(X + 8.15, Y - 35.7, Z, 0.45, 1.1, 0.7));
      head = Math.max(head, -cav);
      head = Math.max(head, -wound);
      let d = Math.min(head, Math.max(ears, -chew, -bowl), nose, brow, bags, stache, lip, tongue);
      const inCav = cav <= 0 && Z <= 5.4 && Z > 4.2 && skull < 0.6;
      const teethRow = Y > 31.15 && Y < 31.95 && Z > 4.4 && Z < 5.75 && Math.abs(X) < 3.0;
      const toothAt = teethRow ? [[-2.9, -2.1], [-1.4, -0.5], [-0.3, 0.6], [0.8, 1.6], [2.1, 2.9]].findIndex(([a, b]) => X > a && X < b) : -1;
      if (d > 0 && !inCav && !(teethRow && toothAt >= 0)) {
        if (wound <= 0 && wound > -0.55 && skull < 0.9 && smin(skull, jowls, 0.9) < 0) return Y < 31.8 ? [frac(Z * 1.6) < 0.5 ? P.bone : P.boneD, 'matte'] : [P.wound, 'matte'];
        return null;
      }
      if (teethRow && toothAt >= 0) return toothAt === 2 ? [P.gold, 'metal'] : [toothAt === 4 ? P.boneD : P.bone, 'matte'];
      if (tongue <= 0) return [G(P.tongue, i, j, k, 0.03, 621), 'matte'];
      if (inCav || (cav < 0.45 && stache > 0 && lip > 0 && nose > 0)) return [P.mouth, 'matte'];
      if (stache <= 0) return mix(hairC(X, Y, Z, i, j, k), P.hairG, 0.3);
      if (lip <= 0) return G(Math.abs(X) > 2.2 ? P.lipD : P.lip, i, j, k, 0.03, 14);
      if (brow <= 0) return Y > 40.6 && Z > 5.6 && Math.abs(X) > 0.7 ? mix(hairC(X, Y, Z, i, j, k), P.hairD, 0.45) : mix(skinC(X, Y, Z, i, j, k), P.skinD, 0.35);
      if (nose <= 0) { const n = vnoise(X * 1.5, Y * 1.5, Z * 1.5, 631); return G(mix(P.nose, n > 0.6 ? P.noseD : P.vein, Math.abs(n - 0.5) * 0.8), i, j, k, 0.025, 632); }
      if (bags <= 0) return mix(skinC(X, Y, Z, i, j, k), P.bruise, 0.42);
      if (ears <= 0) return chew < 0.35 ? [P.wound, 'matte'] : bowl < 0.4 ? mix(skinC(X, Y, Z, i, j, k), P.skinD, 0.55) : skinC(X, Y, Z, i, j, k);
      if (Z > 5.5 && eyeRect(X, Y)) {
        const outerTop = Y > 39.2 && Math.abs(X) > 4.2;                    // droopy outer corners
        if (outerTop) return mix(P.skinD, P.bruise, 0.3);
        return [G(P.sclera, i, j, k, 0.02, 9), 'eye'];
      }
      if (Z > 5.3 && (Math.abs(Math.abs(X) - 3) < 2.5 && Y > 36.6 && Y < 40.4)) return mix(skinC(X, Y, Z, i, j, k), P.bruise, 0.32); // sunken sockets
      let c = skinC(X, Y, Z, i, j, k);
      if (Y < 33.6 && Z > 0.5 && hash(i, j, k, 611) > 0.5) c = mix(c, P.stubble, 0.6);   // stubble
      const ax = Math.abs(X);
      const edge = 35.2 + 1.6 * vnoise(X * 0.9, 0, Z * 0.9, 653) + (hash(i, 0, k, 654) > 0.7 ? -0.7 : 0);
      const fringe = (Y > edge && Y < 41 && ((ax > 5.6 && Z < 0.6) || Z < -4)) || (ax > 6.2 && Z > 0.6 && Z < 2.2 && Y > 34 && Y < 38.5);
      if (fringe && skull > -0.6) return Y < edge + 0.6 ? mix(hairC(X, Y, Z, i, j, k), c, 0.4) : hairC(X, Y, Z, i, j, k);
      return c;
    });
    // scraggly tufts poking out from under the cap
    for (let a = -2.75; a <= 2.8; a += 0.42) {
      if (Math.abs(a) < 1.15) continue;
      const bx = 7.6 * Math.sin(a), bz = 6.6 * Math.cos(a) - 0.3;
      const L = 0.9 + hash(Math.round(a * 10), 1, 2, 655) * 0.9;
      capsules(p, [[bx * 0.97, 39.6, bz * 0.97], [bx * (1 + 0.12 * L), 39.2 - L * 0.7, bz * (1 + 0.12 * L)]], 0.32, hairC);
    }
    // rainbow propeller beanie: panels with piped seams, knit band, button on top
    const HATS = [P.hatR, P.hatO, P.hatY, P.hatG, P.hatB, P.hatP];
    const brim = (Z) => 39.3 + 2.8 * clamp((Z + 1.3) / 7.5, 0, 1);
    fill(p, [-8.6, 38.5, -8.4], [8.6, 47, 7.6], (X, Y, Z, i, j, k) => {
      if (sdEll(X, Y - 38, Z + 0.4, 8.3, 8.7, 7.7) > 0 || Y < brim(Z)) return null;
      const zc = Z + 0.4, phi = Math.atan2(X, zc), rxy = Math.hypot(X, zc);
      const sec = ((phi + Math.PI / 6) / (Math.PI / 3) + 12) % 6, kk = Math.floor(sec), fr = sec - kk;
      let c = HATS[kk];
      c = mix(c, P.hatFade, 0.04 + 0.22 * smoothstep(0.58, 0.85, vnoise(X * 0.3, Y * 0.3, Z * 0.3, 661)));
      c = shade(c, 0.9 + 0.12 * clamp((Y - 40) / 6, 0, 1));
      if (Math.min(fr, 1 - fr) * (Math.PI / 3) * rxy < 0.3 && rxy > 1.2) c = mix(c, P.hatBand, 0.6);
      if (Y - 1.1 < brim(Z)) c = (i + k) & 1 ? P.hatBand : shade(P.hatBand, 0.92);
      if (sdEll(X - 4.5, Y - 42.5, Z - 5, 1.8, 1.4, 1.6) < 0) c = mix(c, P.blood, 0.65);
      if (sdEll(X + 3.6, Y - 43.4, Z + 6.6, 1.0, 0.8, 0.8) < 0) return hairC(X, Y, Z, i, j, k);   // moth hole
      return [G(c, i, j, k, 0.02, 664), 'plastic'];
    });
    capsules(p, [[0, 46.4, 0], [0, 47.3, 0]], 1.0, solid(P.hatR, 'plastic'));
  }

  function propeller(p) {
    capsules(p, [[0, 47.3, 0], [0, 48.6, 0]], 0.42, solid(P.brass, 'metal'));
    shape(p, [-1.2, 48.2, -1.2], [1.2, 49.8, 1.2], (X, Y, Z) => sdEll(X, Y - 49, Z, 1.0, 0.7, 1.0), solid(P.propHub, 'plastic'));
    fill(p, [-7.4, 47.8, -1.6], [7.4, 50.8, 1.6], (X, Y, Z, i, j, k) => {
      const s = X > 0 ? 1 : -1, ax = Math.abs(X);
      if (ax < 0.8) return null;
      const pitch = 0.42 * s;                                  // twisted blades
      const yy = Y - 49 - (s < 0 && ax > 4.6 ? 0.18 * (ax - 4.6) ** 2 : 0); // the blue one is bent up
      const ry = yy * Math.cos(pitch) - Z * Math.sin(pitch), rz = yy * Math.sin(pitch) + Z * Math.cos(pitch);
      if (sdEll(ax - 3.9, ry, rz, 3.3, 0.24, 1.0) > 0) return null;
      if (s > 0 && Math.hypot(ax - 4.6, rz + 0.8) < 0.45) return null;    // chipped
      const edge = rz * s < -0.45;
      return [G(shade(s > 0 ? P.propY : P.propB, edge ? 0.82 : 1), i, j, k, 0.02, 672), 'plastic'];
    });
  }

  /* ---------- arms ---------- */
  const HY = -3; // the head and cap are modelled 3 units high and dropped onto the shoulders
  const ARM_R = { S: [-10.3, 25.6, -3], E: [-12.4, 20.9, -2.6], W: [-12.5, 25.0, 1.0] };
  const ARM_L = { S: [10.3, 25.6, -3], E: [12.0, 22.2, 1.6], W: [12.2, 23.8, 7.2] };
  const KNOB = [-12.5, 24, 4.5], JOY = [-12.5, 21, 4.5];

  function upperArm(p, A) {
    const lo = [Math.min(A.S[0], A.E[0]) - 3, Math.min(A.S[1], A.E[1]) - 3, Math.min(A.S[2], A.E[2]) - 3];
    const hi = [Math.max(A.S[0], A.E[0]) + 3, Math.max(A.S[1], A.E[1]) + 3, Math.max(A.S[2], A.E[2]) + 3];
    const mid = [(A.S[0] + A.E[0]) / 2, (A.S[1] + A.E[1]) / 2 - 0.5, (A.S[2] + A.E[2]) / 2];
    shape(p, lo, hi, (X, Y, Z) => smin(smin(sdCap(X, Y, Z, A.S, A.E, 2.0), sdEll(X - A.S[0], Y - A.S[1], Z - A.S[2], 2.5, 2.3, 2.4), 0.8),
      sdEll(X - mid[0], Y - mid[1], Z - mid[2], 2.1, 2.3, 2.15), 0.8), skinC);  // flabby underarm
  }
  const fingers = (X, Y, Z, list, r) => { let d = 99; for (const f of list) for (let n = 0; n < f.length - 1; n++) d = Math.min(d, sdCap(X, Y, Z, f[n], f[n + 1], r)); return d; };
  function forearmR(p) {
    const { E, W } = ARM_R;
    const au = [0, (W[1] - E[1]), (W[2] - E[2])], L = Math.hypot(au[1], au[2]); au[1] /= L; au[2] /= L;
    const M = [(E[1] + W[1]) / 2, (E[2] + W[2]) / 2];
    const anchor = (Y, Z) => { // little anchor tattoo on the outside of the forearm
      const dy = Y - M[0], dz = Z - M[1], u = dy * au[1] + dz * au[2], v = -dy * au[2] + dz * au[1];
      return (Math.abs(v) < 0.3 && u > -2 && u < 2) || (Math.abs(u - 1.2) < 0.3 && Math.abs(v) < 1.2) || (u < -1.2 && u > -2.2 && Math.abs(Math.abs(v) - 1.1 + (u + 1.7) * 0.6) < 0.35);
    };
    const F = [
      [[-13.85, 25.5, 4.6], [-13.85, 24.9, 6.0], [-13.85, 23.9, 6.05]],
      [[-12.95, 25.6, 4.7], [-12.95, 24.8, 6.25], [-12.95, 23.4, 6.2]],
      [[-12.05, 25.6, 4.7], [-12.05, 24.8, 6.25], [-12.05, 23.4, 6.15]],
      [[-11.2, 25.5, 4.6], [-11.2, 24.8, 6.0], [-11.25, 23.6, 5.9]],
    ];
    const TH = [[-11.1, 25.1, 2.9], [-10.75, 24.1, 3.6], [-11.0, 23.4, 4.3]];
    fill(p, [-15.6, 17, -5.5], [-9.4, 27.4, 7.4], (X, Y, Z, i, j, k) => {
      const arm = smin(sdCap(X, Y, Z, E, W, 1.7), sdEll(X - E[0], Y - E[1], Z - E[2], 1.95, 1.95, 1.95), 0.6);
      const palm = sdEll(X + 12.5, Y - 25.55, Z - 3.4, 1.85, 0.8, 1.9);
      const fing = fingers(X, Y, Z, F, 0.5), thumb = fingers(X, Y, Z, [TH], 0.52);
      const d = smin(smin(arm, palm, 0.8), Math.min(fing, thumb), 0.35);
      if (d > 0) return null;
      if (fing <= 0 && Y < 24.0) return [G(P.nail, i, j, k, 0.03, 681), 'matte'];
      if (thumb <= 0 && Y < 23.75) return [G(P.nail, i, j, k, 0.03, 681), 'matte'];
      let c = skinC(X, Y, Z, i, j, k);
      if (X < -13.6 && arm <= 0 && anchor(Y, Z)) c = mix(c, P.tattoo, 0.75);
      if (fing <= 0 && Y > 25.3 && Z > 4.6 && Z < 5.2) c = mix(c, P.skinD, 0.35);             // knuckles
      return c;
    });
  }
  function armL(p) {
    const { E, W } = ARM_L;
    upperArm(p, ARM_L);
    const F = [11.0, 11.9, 12.8, 13.65].map((x, n) => [[x, 23.65, 10.4], [x, 23.5, 11.9 - (n === 3 ? 0.4 : 0)], [x, 22.1, 12.8 - (n === 3 ? 0.4 : 0)]]);
    const CLAW = F.map((f) => [f[2], [f[2][0], 21.2, f[2][2] - 0.35]]);
    const TH = [[10.9, 23.2, 8.9], [10.25, 22.6, 10.5], [10.45, 21.9, 11.3]];
    fill(p, [8.5, 19.5, -0.5], [15.5, 26.5, 14], (X, Y, Z, i, j, k) => {
      const s = segD(X, Y, Z, E, W);
      const arm = smin(s.d - 1.7, sdEll(X - E[0], Y - E[1], Z - E[2], 1.95, 1.95, 1.95), 0.6);
      const palm = sdEll(X - 12.3, Y - 23.4, Z - 9.2, 1.7, 0.78, 1.95);
      const fing = fingers(X, Y, Z, F, 0.47), claw = fingers(X, Y, Z, CLAW, 0.28), thumb = fingers(X, Y, Z, [TH], 0.5);
      const strap = s.u > 0.66 && s.u < 0.83 && s.d < 1.95;
      const d = Math.min(smin(smin(arm, palm, 0.8), Math.min(fing, thumb), 0.35), claw, strap ? -1 : 99);
      if (d > 0) return null;
      if (claw <= 0 && fing > 0) return [G(P.nailD, i, j, k, 0.04, 683), 'matte'];
      if (strap) return Y > E[1] + (W[1] - E[1]) * s.u + 1.3 && Math.abs(X - 12.1) < 0.9 ? [P.watchFace, 'eye'] : [G(P.watch, i, j, k, 0.04, 681), 'plastic'];
      if (s.u > 0.2 && s.u < 0.4 && arm <= 0 && Y < E[1] + (W[1] - E[1]) * s.u - 1.0) return [hash(i, j, k, 682) > 0.5 ? P.wound : P.woundL, 'matte']; // bitten forearm
      return skinC(X, Y, Z, i, j, k);
    });
  }

  function joystick(p) {
    capsules(p, [[-12.5, 21, 4.5], [-12.5, 23.2, 4.5]], 0.38, metal(0.3, 31));
    shape(p, [-14, 22.5, 3], [-11, 25.4, 6], (X, Y, Z) => sdEll(X + 12.5, Y - 24, Z - 4.5, 1.3, 1.15, 1.3), (X, Y, Z, i, j, k) => [G(Y > 24.7 && Z < 4.2 ? P.plasticL : P.plastic, i, j, k, 0.04, 692), 'plastic']);
  }

  function pole(p) {
    capsules(p, [[10.5, 27, -9.5], [10.5, 59, -9.5]], 0.4, (X, Y, Z, i, j, k) => [G(frac((Y - 27) / 6.5) < 0.16 ? P.flag : P.pole, i, j, k, 0.02, 702), 'plastic']);
    shape(p, [9.5, 58.5, -10.5], [11.5, 60.4, -8.5], (X, Y, Z) => sdEll(X - 10.5, Y - 59.4, Z + 9.5, 0.75, 0.75, 0.75), solid(P.flag, 'plastic'));
  }
  function flag(p) {
    fill(p, [10, 50, -23.6], [10.49, 59, -9.9], (X, Y, Z, i, j, k) => {
      const s = -10 - Z;
      const h = 7.6 * (1 - s / 13.4);
      if (s < 0 || Y < 58.9 - h || Y > 58.9) return null;
      if (s > 9.5 && frac(Y * 1.3 + hash(j, 0, 0, 711) * 0.5) < 0.35) return null; // frayed tip
      if (Math.hypot(s - 6.2, Y - 55.4) < 0.5 || Math.hypot(s - 3.4, Y - 53.6) < 0.35) return null; // holes
      let c = P.flag;
      if (Y > 57.4 && Y < 58.1 && s < 10) c = P.reflect;
      if (s < 0.6) c = P.flagD;                                                  // stitched sleeve
      c = mix(c, P.dirt, smoothstep(0.62, 0.82, vnoise(Y * 0.4, Z * 0.4, 0, 714)) * 0.45);
      return [G(c, i, j, k, 0.03, 715), 'matte'];
    });
  }

  /* ---------- mesher (exposed faces + baked voxel AO, optional skin weights) ---------- */
  const LIN = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  const AO = [0.55, 0.72, 0.87, 1.0];
  const EDGE = { matte: 0.07, plastic: 0.1, metal: 0.14, rust: 0.06, eye: 0, glow: 0 };

  function newGroup() { return { pos: [], nrm: [], col: [], idx: [], jnt: [], wgt: [] }; }
  function meshPart(part, pivot, occ, skin) {
    const groups = {}, q = part.q || 1;
    const corners = [[[0, 0], [1, 0], [1, 1], [0, 1]], [[0, 0], [0, 1], [1, 1], [1, 0]]];
    for (const v of part.vox.values()) {
      const base = [v.x, v.y, v.z];
      const [cr, cg, cb] = rgb(v.c);
      for (let f = 0; f < 6; f++) {
        const a = f >> 1, s = (f & 1) ? -1 : 1;
        const n = [0, 0, 0]; n[a] = s;
        if (part.has(v.x + n[0], v.y + n[1], v.z + n[2])) continue;
        const b = (a + 1) % 3, c = (a + 2) % 3;
        const out = base.slice(); out[a] += s;
        const g = groups[v.m] || (groups[v.m] = newGroup());
        const i0 = g.pos.length / 3;
        const ao = [];
        for (const [db, dc] of corners[s > 0 ? 0 : 1]) {
          const pt = base.slice(); if (s > 0) pt[a] += 1; pt[b] += db; pt[c] += dc;
          const sb = db ? 1 : -1, sc = dc ? 1 : -1;
          const q1 = out.slice(); q1[b] += sb;
          const q2 = out.slice(); q2[c] += sc;
          const q3 = out.slice(); q3[b] += sb; q3[c] += sc;
          const o1 = occ(q1[0], q1[1], q1[2]) ? 1 : 0, o2 = occ(q2[0], q2[1], q2[2]) ? 1 : 0, o3 = occ(q3[0], q3[1], q3[2]) ? 1 : 0;
          const lvl = (o1 && o2) ? 0 : 3 - (o1 + o2 + o3);
          ao.push(lvl);
          // convex edges catch the light like a bevel: the in-plane neighbour on that side is empty
          const e1 = part.has(base[0] + (b === 0 ? sb : 0), base[1] + (b === 1 ? sb : 0), base[2] + (b === 2 ? sb : 0)) ? 0 : 1;
          const e2 = part.has(base[0] + (c === 0 ? sc : 0), base[1] + (c === 1 ? sc : 0), base[2] + (c === 2 ? sc : 0)) ? 0 : 1;
          const k = AO[lvl] * (1 + (EDGE[v.m] || 0) * (e1 + e2));
          g.pos.push((pt[0] / q - pivot[0]) * V, (pt[1] / q - pivot[1]) * V, (pt[2] / q - pivot[2]) * V);
          g.nrm.push(n[0], n[1], n[2]);
          g.col.push(LIN[cl(cr * k)], LIN[cl(cg * k)], LIN[cl(cb * k)]);
          if (skin) { const w = skin(pt[0] / q, pt[1] / q, pt[2] / q); g.jnt.push(w[0], w[2], 0, 0); g.wgt.push(w[1], w[3], 0, 0); }
        }
        if (ao[0] + ao[2] >= ao[1] + ao[3]) g.idx.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
        else g.idx.push(i0 + 1, i0 + 2, i0 + 3, i0 + 1, i0 + 3, i0);
      }
    }
    return finalize(groups, !!skin);
  }
  function finalize(groups, skinned) {
    return Object.keys(groups).map((m) => {
      const g = groups[m], vc = g.pos.length / 3;
      const prim = {
        mat: m, count: vc,
        pos: new Float32Array(g.pos), nrm: new Float32Array(g.nrm), col: new Float32Array(g.col),
        idx: vc > 65535 ? new Uint32Array(g.idx) : new Uint16Array(g.idx),
      };
      if (skinned) { prim.jnt = new Uint8Array(g.jnt); prim.wgt = new Float32Array(g.wgt); }
      return prim;
    });
  }
  function boxPrims(boxes) { // boxes: [x0,x1,y0,y1,z0,z1,color,mat] in voxel units, local
    const groups = {};
    for (const [x0, x1, y0, y1, z0, z1, color, mat] of boxes) {
      const g = groups[mat] || (groups[mat] = newGroup());
      const [r, gg, b] = rgb(color);
      const C = [LIN[r], LIN[gg], LIN[b]];
      const lo = [x0, y0, z0], hi = [x1, y1, z1];
      for (let f = 0; f < 6; f++) {
        const a = f >> 1, s = (f & 1) ? -1 : 1, bb = (a + 1) % 3, cc = (a + 2) % 3;
        const i0 = g.pos.length / 3;
        const cs = s > 0 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [0, 1], [1, 1], [1, 0]];
        for (const [db, dc] of cs) {
          const pt = [0, 0, 0];
          pt[a] = s > 0 ? hi[a] : lo[a]; pt[bb] = db ? hi[bb] : lo[bb]; pt[cc] = dc ? hi[cc] : lo[cc];
          g.pos.push(pt[0] * V, pt[1] * V, pt[2] * V);
          const n = [0, 0, 0]; n[a] = s; g.nrm.push(n[0], n[1], n[2]);
          g.col.push(C[0], C[1], C[2]);
        }
        g.idx.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
      }
    }
    return finalize(groups, false);
  }

  /* ---------- rig definition ---------- */
  const GLARE = 0.38;
  const EYES = { R: [-3, 38.5 + HY, 6], L: [3, 38.5 + HY, 6] };
  const WHEEL_R = 7, CASTER_R = 2.35;          // voxels
  const TRACK = { wheelX: 15.5, casterX: 9.5, casterZ: 8.5, axleZ: -5 };
  const NODES = [
    // name, parent, pivot (voxels, model space), rest euler XYZ
    ['Chair', null, [0, 0, -1], [0, 0, 0]],
    ['Wheel_R', 'Chair', [-15, 7, -5], [0, 0, 0]],
    ['Wheel_L', 'Chair', [15, 7, -5], [0, 0, 0]],
    ['Caster_R', 'Chair', [-9.5, 9, 8.5], [0, 0, 0]],
    ['CasterWheel_R', 'Caster_R', [-9.5, 2.5, 7.5], [0, 0, 0]],
    ['Caster_L', 'Chair', [9.5, 9, 8.5], [0, 0, 0]],
    ['CasterWheel_L', 'Caster_L', [9.5, 2.5, 7.5], [0, 0, 0]],
    ['Joystick', 'Chair', JOY, [0, 0, 0]],
    ['Torso', 'Chair', [0, 12, -2], [0, 0, 0]],
    ['Belly_Root', 'Torso', [0, 18, 3], [0, 0, 0]],
    ['Belly_Jiggle', 'Belly_Root', [0, 18, 3], [0, 0, 0]],
    ['Head', 'Torso', [0, 30 + HY, 0], [0.03, 0, 0.06]],
    ['Eye_R', 'Head', EYES.R, [0, 0, 0]],
    ['Pupil_R', 'Eye_R', EYES.R, [0, 0, 0]],
    ['Lid_R', 'Eye_R', [EYES.R[0], 40 + HY, 6], [0, 0, 0]],
    ['Eye_L', 'Head', EYES.L, [0, 0, 0]],
    ['Pupil_L', 'Eye_L', EYES.L, [0, 0, 0]],
    ['Lid_L', 'Eye_L', [EYES.L[0], 40 + HY, 6], [0, 0, 0]],
    ['Propeller', 'Head', [0, 48 + HY, 0], [0, 0, 0]],
    ['ArmR', 'Torso', ARM_R.S, [0, 0, 0]],
    ['ForearmR', 'ArmR', ARM_R.E, [0, 0, 0]],
    ['ArmL', 'Torso', ARM_L.S, [0, 0, 0]],
    ['LegR', 'Torso', [-4.6, 13, 6.2], [0, 0, 0]],
    ['LegL', 'Torso', [4.6, 13, 6.2], [0, 0, 0]],
  ];
  const BONES = ['Belly_Root', 'Belly_Jiggle'];
  const CHAINS = [
    { prefix: 'Pole_', parent: 'Chair', start: [10.5, 27, -9.5], dir: [0, 1, 0], len: 32, seg: 4, rest0: [-0.03, 0, 0.02], rest: [-0.004, 0, 0.002] },
    { prefix: 'Flag_', parent: 'Pole_7', start: [10.5, 54.5, -10], dir: [0, 0, -1], len: 14, seg: 4, rest0: [-0.38, 0, 0.1], rest: [-0.12, 0, 0] },
  ];
  CHAINS.forEach((ch) => { ch.n = Math.ceil(ch.len / ch.seg); });

  const EYE_RIG = {
    eyeCenterHead: [0, (38.5 - 30) * V, (6 - 0) * V],
    travelX: 1 * V, travelY: 0.5 * V, glare: GLARE,
  };

  function chainWeights(ch, j0, parentJoint) {
    return (x, y, z) => {
      const s = (x - ch.start[0]) * ch.dir[0] + (y - ch.start[1]) * ch.dir[1] + (z - ch.start[2]) * ch.dir[2];
      if (s <= -1) return [parentJoint, 1, 0, 0];
      if (s < 0) return [parentJoint, -s, j0, 1 + s];
      const i = Math.min(Math.floor(s / ch.seg), ch.n - 1);
      const t = Math.min(1, Math.max(0, (s - i * ch.seg) / ch.seg));
      return [j0 + i, 1 - t, j0 + i + 1, t];
    };
  }

  function buildModel() {
    const names = ['Chair', 'Wheel_R', 'Wheel_L', 'Caster_R', 'Caster_L', 'CasterWheel_R', 'CasterWheel_L', 'Joystick', 'Torso', 'Head', 'Propeller', 'ArmR', 'ForearmR', 'ArmL', 'LegR', 'LegL', 'Pole', 'Flag'];
    const parts = {};
    names.forEach((n) => { parts[n] = new Part(n, Q); });
    chair(parts.Chair); wheel(parts.Wheel_R, -1); wheel(parts.Wheel_L, 1);
    casterFork(parts.Caster_R, -1); casterFork(parts.Caster_L, 1); casterWheel(parts.CasterWheel_R, -1); casterWheel(parts.CasterWheel_L, 1);
    joystick(parts.Joystick); torso(parts.Torso);
    { const h = new Part('h', Q); headPart(h); for (const v of h.vox.values()) parts.Head.set(v.x, v.y + HY * Q, v.z, v.c, v.m); }
    { const h = new Part('h', Q); propeller(h); for (const v of h.vox.values()) parts.Propeller.set(v.x, v.y + HY * Q, v.z, v.c, v.m); }
    upperArm(parts.ArmR, ARM_R); forearmR(parts.ForearmR); armL(parts.ArmL);
    legPart(parts.LegR, -1); legPart(parts.LegL, 1); pole(parts.Pole); flag(parts.Flag);

    const groupA = ['Chair', 'Torso', 'Head', 'LegR', 'LegL'].map((n) => parts[n]);
    const occA = (x, y, z) => groupA.some((p) => p.has(x, y, z));
    const occOwn = (p) => (x, y, z) => p.has(x, y, z);

    const pivots = {};
    const nodes = [];
    for (const [name, parent, pivot, rest] of NODES) {
      pivots[name] = pivot;
      const pp = parent ? pivots[parent] : [0, 0, 0];
      nodes.push({ name, parent, pivot, t: [(pivot[0] - pp[0]) * V, (pivot[1] - pp[1]) * V, (pivot[2] - pp[2]) * V], r: rest.slice(), s: null, mesh: null, bone: BONES.includes(name) });
    }
    for (const ch of CHAINS) {
      for (let i = 0; i <= ch.n; i++) {
        const pos = [ch.start[0] + ch.dir[0] * ch.seg * i, ch.start[1] + ch.dir[1] * ch.seg * i, ch.start[2] + ch.dir[2] * ch.seg * i];
        const parent = i === 0 ? ch.parent : ch.prefix + (i - 1);
        const prev = pivots[parent];
        pivots[ch.prefix + i] = pos;
        nodes.push({
          name: ch.prefix + i, parent, pivot: pos,
          t: [(pos[0] - prev[0]) * V, (pos[1] - prev[1]) * V, (pos[2] - prev[2]) * V],
          r: (i === 0 ? ch.rest0 : ch.rest).slice(), s: null, mesh: null, bone: true,
        });
      }
    }
    const node = (n) => nodes.find((d) => d.name === n);
    for (const n of ['Chair', 'Head', 'LegR', 'LegL']) node(n).mesh = meshPart(parts[n], node(n).pivot, occA);
    for (const n of ['Wheel_R', 'Wheel_L', 'Caster_R', 'Caster_L', 'CasterWheel_R', 'CasterWheel_L', 'Joystick', 'Propeller', 'ArmR', 'ForearmR', 'ArmL']) node(n).mesh = meshPart(parts[n], node(n).pivot, occOwn(parts[n]));
    for (const s of ['R', 'L']) {
      node('Pupil_' + s).mesh = boxPrims([[-1, 1, -1, 1, 0.03, 0.15, P.pupil, 'matte'], [-0.5, 0.5, -0.5, 0.5, 0.15, 0.21, P.glow, 'glow']]);
      node('Lid_' + s).mesh = boxPrims([[-2.05, 2.05, -3, 0, 0.01, 0.3, P.lid, 'matte']]);
      node('Lid_' + s).s = [1, GLARE, 1];
    }
    // skinned meshes (vertices in the space node's frame; bind = straight chains, belly at rest)
    const skinned = [];
    {
      const w = (x, y, z) => {
        let e = (x / 11.5) ** 2 + ((y - 17.5) / 7) ** 2 + ((z - 7) / 9) ** 2;
        let k = 1 - smoothstep(0.25, 1.0, e);
        k *= smoothstep(-1, 3, z) * smoothstep(13.5, 16, y) * (1 - smoothstep(21.5, 24.5, y));
        return [0, 1 - k, 1, k];
      };
      skinned.push({ name: 'Body', space: 'Torso', joints: ['Belly_Root', 'Belly_Jiggle'], prims: meshPart(parts.Torso, pivots.Torso, occA, w) });
    }
    {
      const ch = CHAINS[0], joints = ['Chair'];
      for (let i = 0; i <= ch.n; i++) joints.push(ch.prefix + i);
      skinned.push({ name: 'FlagPole', space: 'Chair', joints, prims: meshPart(parts.Pole, pivots.Chair, occOwn(parts.Pole), chainWeights(ch, 1, 0)) });
    }
    {
      const ch = CHAINS[1], joints = ['Pole_7'];
      for (let i = 0; i <= ch.n; i++) joints.push(ch.prefix + i);
      skinned.push({ name: 'Pennant', space: 'Chair', joints, prims: meshPart(parts.Flag, pivots.Chair, occOwn(parts.Flag), chainWeights(ch, 1, 0)) });
    }
    let verts = 0, voxels = 0;
    nodes.forEach((n) => n.mesh && n.mesh.forEach((p) => { verts += p.count; }));
    skinned.forEach((s) => s.prims.forEach((p) => { verts += p.count; }));
    Object.values(parts).forEach((p) => { voxels += p.vox.size; });
    return { V, nodes, skinned, chains: CHAINS, eyeRig: EYE_RIG, materials: MATS, clips: CLIPS, pose, stats: { verts, voxels } };
  }

  /* ---------- small 3x3 rotation math for the arm IK ---------- */
  function matXYZ(e) { // three.js Euler XYZ: R = Rx * Ry * Rz
    const a = Math.cos(e[0]), b = Math.sin(e[0]), c = Math.cos(e[1]), d = Math.sin(e[1]), f = Math.cos(e[2]), g = Math.sin(e[2]);
    const ae = a * f, af = a * g, be = b * f, bf = b * g;
    return [
      [c * f, -c * g, d],
      [af + be * d, ae - bf * d, -b * c],
      [bf - ae * d, be + af * d, a * c],
    ];
  }
  function eulerXYZ(m) {
    const y = Math.asin(clamp(m[0][2], -1, 1));
    if (Math.abs(m[0][2]) < 0.9999999) return [Math.atan2(-m[1][2], m[2][2]), y, Math.atan2(-m[0][1], m[0][0])];
    return [Math.atan2(m[2][1], m[1][1]), y, 0];
  }
  const mv = (m, v) => [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2], m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2], m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]];
  const mtv = (m, v) => [m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2], m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2], m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const scl = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => scl(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
  const frame = (a, n) => { const b = cross(a, n); return [[a[0], n[0], b[0]], [a[1], n[1], b[1]], [a[2], n[2], b[2]]]; }; // columns a, n, a×n
  const mmT = (A, B) => { const o = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i][j] = A[i][0] * B[j][0] + A[i][1] * B[j][1] + A[i][2] * B[j][2]; return o; }; // A * B^T
  const mTm = (A, B) => { const o = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i][j] = A[0][i] * B[0][j] + A[1][i] * B[1][j] + A[2][i] * B[2][j]; return o; }; // A^T * B

  /** Keeps the right hand on the joystick knob: two-bone IK for ArmR/ForearmR,
   *  solved after the torso and the stick have been posed. Mutates `out`. */
  function armIK(out) {
    const get = (n) => out[n] || { r: [0, 0, 0], t: [0, 0, 0] };
    const S = ARM_R.S, E0 = ARM_R.E, K0 = KNOB;
    const jr = get('Joystick').r;
    let K = add(JOY, mv(matXYZ(jr), sub(K0, JOY)));
    const to = get('Torso'), TP = [0, 12, -2];
    K = add(TP, mtv(matXYZ(to.r), sub(sub(K, TP), to.t)));
    const L1 = Math.hypot(...sub(E0, S)), L2 = Math.hypot(...sub(K0, E0));
    const d = sub(K, S);
    let dl = Math.hypot(d[0], d[1], d[2]);
    const u = scl(d, 1 / dl);
    dl = clamp(dl, Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-3);
    const pole = sub(E0, S);
    const v = norm(sub(pole, scl(u, dot(pole, u))));
    const cosA = clamp((L1 * L1 + dl * dl - L2 * L2) / (2 * L1 * dl), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    const E1 = add(S, add(scl(u, L1 * cosA), scl(v, L1 * sinA)));
    const Kc = add(S, scl(u, dl));
    const n0 = norm(cross(sub(E0, S), sub(K0, S))), n1 = norm(cross(sub(E1, S), sub(Kc, S)));
    const Rup = mmT(frame(norm(sub(E1, S)), n1), frame(norm(sub(E0, S)), n0));
    const Rfw = mmT(frame(norm(sub(Kc, E1)), n1), frame(norm(sub(K0, E0)), n0));
    const Rloc = mTm(Rup, Rfw);
    out.ArmR = { r: eulerXYZ(Rup), t: [0, 0, 0] };
    out.ForearmR = { r: eulerXYZ(Rloc), t: [0, 0, 0] };
    return out;
  }

  /* ---------- poses / animation ---------- */
  const CLIPS = { Idle: { duration: 4.0, samples: 64 }, Drive: { duration: 2.4, samples: 48 } };
  const bump = (u, a, b) => { if (u <= a || u >= b) return 0; const t = (u - a) / (b - a); return Math.sin(Math.PI * t) ** 2; };

  // Returns offsets per node: { r:[dx,dy,dz] added to rest euler, t:[x,y,z] voxels added to rest translation }
  // opt.live: the viewer drives wheels, casters, propeller and stick itself, so leave those channels out.
  // opt.gust: wind multiplier on the pennant.
  function pose(clip, t, opt) {
    opt = opt || {};
    const out = {};
    const R = (n, x, y, z) => { (out[n] || (out[n] = { r: [0, 0, 0], t: [0, 0, 0] })).r = [x, y, z]; };
    const T = (n, x, y, z) => { (out[n] || (out[n] = { r: [0, 0, 0], t: [0, 0, 0] })).t = [x, y, z]; };
    const S = Math.sin, C = Math.cos;
    let wind, flapW, flapAmp, poleLean = 0, poleOsc, p;
    if (clip === 'Drive') {
      p = PI2 * t / 2.4;
      const hit = Math.pow(Math.max(0, C(p - 1.0)), 10);         // flat spot on the right tyre
      const hit2 = Math.pow(Math.max(0, C(p - 1.0 - 0.5)), 10);
      if (!opt.live) {
        R('Wheel_R', p, 0, 0); R('Wheel_L', p, 0, 0);
        R('CasterWheel_R', 3 * p, 0, 0); R('CasterWheel_L', 3 * p, 0, 0);
        R('Propeller', 0, 5 * p, 0);
        R('Joystick', 0.3 + 0.03 * S(6 * p), 0, 0.03 * S(2 * p));
      }
      R('Caster_R', 0, 0.13 * S(6 * p + 0.3), 0); R('Caster_L', 0, 0.11 * S(6 * p + 1.6), 0);
      T('Chair', 0, -0.45 * hit + 0.12 * S(2 * p) + 0.05 * S(6 * p), 0);
      R('Chair', 0.012 * S(2 * p + 0.4) - 0.02 * hit, 0, 0.03 * S(p + 0.3) - 0.035 * hit);
      R('Torso', -0.05 + 0.02 * S(2 * p + 0.6) + 0.04 * hit2, 0.02 * S(p), 0.03 * S(p + 0.8) - 0.03 * hit2);
      T('Belly_Jiggle', 0, 0.55 * S(2 * p + 1.1) - 0.7 * hit2, 0.3 * S(2 * p + 1.4));
      R('Belly_Jiggle', 0.03 * S(2 * p + 1.3), 0, 0.03 * S(p + 1.1));
      R('Head', 0.04 + 0.06 * S(2 * p + 1.0) - 0.06 * hit2, 0.03 * S(p + 0.5), 0.09 * S(p + 1.2));
      R('ArmL', -0.1 + 0.1 * S(2 * p + 0.5), 0.05 * S(p), 0.06 * S(2 * p + 1.0));
      R('LegR', 0.14 + 0.2 * S(2 * p + 0.7) + 0.15 * hit2, 0, 0.04 * S(p)); R('LegL', 0.14 + 0.2 * S(2 * p + 1.6) + 0.15 * hit2, 0, -0.04 * S(p + 0.5));
      wind = 1; flapW = 8 * PI2 / 2.4; flapAmp = 1.25; poleLean = -0.045;
      poleOsc = (i) => [0.03 * S(2 * p - i * 0.55) - 0.03 * hit, 0.025 * S(p - i * 0.5)];
    } else {
      p = PI2 * t / 4.0;
      const u = t / 4.0;
      const push = bump(u, 0.5, 0.66), pull = bump(u, 0.66, 0.84);
      const dz = 1.0 * smoothstep(0.54, 0.68, u) * (1 - smoothstep(0.68, 0.86, u)); // lurches forward, then backs up
      const jerk = bump(u, 0.54, 0.62) - bump(u, 0.68, 0.76);
      if (!opt.live) R('Propeller', 0, p, 0);
      R('Joystick', 0.3 * push - 0.24 * pull + 0.012 * S(5 * p), 0, 0.02 * S(3 * p)); // the lurch is scripted, so it stays in live mode
      T('Chair', 0, 0.06 * S(4 * p), dz);
      R('Chair', -0.02 * jerk, 0, 0);
      R('Wheel_R', dz / WHEEL_R, 0, 0); R('Wheel_L', dz / WHEEL_R, 0, 0);
      R('CasterWheel_R', dz / CASTER_R, 0, 0); R('CasterWheel_L', dz / CASTER_R, 0, 0);
      R('Caster_R', 0, 0.18 * pull - 0.08 * push, 0); R('Caster_L', 0, -0.12 * pull + 0.06 * push, 0);
      R('Torso', 0.015 * S(p) + 0.05 * jerk, 0, 0.01 * S(p + 0.5));
      T('Belly_Jiggle', 0, 0.3 * S(p) - 0.6 * jerk + 0.15 * S(4 * p) * (push + pull), 0.15 * S(p) + 0.5 * jerk);
      R('Head', 0.025 * S(p + 0.5) - 0.1 * jerk, 0, 0.05 * S(p + 1));
      R('ArmL', 0.06 * S(p + 0.8) - 0.05 * push, 0.03 * S(2 * p), 0.04 * S(2 * p + 0.3));
      R('LegR', 0.08 + 0.16 * S(2 * p) + 0.2 * jerk, 0, 0); R('LegL', 0.08 + 0.16 * S(2 * p + Math.PI) + 0.2 * jerk, 0, 0);
      wind = 0.3; flapW = 6 * PI2 / 4.0; flapAmp = 0.7;
      poleOsc = (i) => [0.008 * S(2 * p - i * 0.4) + 0.05 * jerk * (i / 8), 0.01 * S(p - i * 0.3 + 1)];
    }
    const g = opt.gust == null ? 1 : opt.gust;
    for (let i = 0; i <= CHAINS[0].n; i++) { const o = poleOsc(i); R('Pole_' + i, poleLean * (0.4 + 0.6 * i / 8) + o[0], 0, o[1]); }
    const fl = CHAINS[1];
    for (let j = 0; j <= fl.n; j++) {
      const k = j / fl.n;
      const lift = wind * g * (j === 0 ? 0.36 : 0.11);
      const flap = flapAmp * g * (0.06 + 0.22 * k) * S(flapW * t - j * 1.15);
      R('Flag_' + j, lift + 0.05 * flapAmp * S(flapW * t * 0.5 - j * 0.8), flap, 0);
    }
    return armIK(out);
  }

  /* ---------- math ---------- */
  function quatXYZ(e) {
    const c1 = Math.cos(e[0] / 2), c2 = Math.cos(e[1] / 2), c3 = Math.cos(e[2] / 2);
    const s1 = Math.sin(e[0] / 2), s2 = Math.sin(e[1] / 2), s3 = Math.sin(e[2] / 2);
    return [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 + s1 * s2 * c3, c1 * c2 * c3 - s1 * s2 * s3];
  }
  function compose(t, q) { // column-major 4x4, unit scale
    const [x, y, z, w] = q;
    const x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
    return [1 - (yy + zz), xy + wz, xz - wy, 0, xy - wz, 1 - (xx + zz), yz + wx, 0, xz + wy, yz - wx, 1 - (xx + yy), 0, t[0], t[1], t[2], 1];
  }
  function mul(a, b) {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s;
    }
    return o;
  }
  function invRigid(m) {
    const o = [m[0], m[4], m[8], 0, m[1], m[5], m[9], 0, m[2], m[6], m[10], 0, 0, 0, 0, 1];
    o[12] = -(o[0] * m[12] + o[4] * m[13] + o[8] * m[14]);
    o[13] = -(o[1] * m[12] + o[5] * m[13] + o[9] * m[14]);
    o[14] = -(o[2] * m[12] + o[6] * m[13] + o[10] * m[14]);
    return o;
  }

  /* ---------- GLB writer ---------- */
  const MATS = {
    matte: { rough: 0.9, metal: 0 },
    plastic: { rough: 0.45, metal: 0 },
    metal: { rough: 0.42, metal: 0.65 },
    rust: { rough: 0.85, metal: 0.25 },
    eye: { rough: 0.55, metal: 0, emissive: [0.16, 0.14, 0.05] },
    glow: { rough: 1, metal: 0, emissive: [1, 0.23, 0.12], base: [0.1, 0.02, 0.02] },
  };

  function toGLB(model) {
    const json = {
      asset: { version: '2.0', generator: 'Propeller Pete voxel builder' },
      scene: 0, scenes: [{ name: 'Scene', nodes: [0] }],
      nodes: [], meshes: [], materials: [], accessors: [], bufferViews: [], buffers: [], skins: [], animations: [],
    };
    const chunks = []; let len = 0;
    const view = (typed, target) => {
      const pad = (4 - (len % 4)) % 4; if (pad) { chunks.push(new Uint8Array(pad)); len += pad; }
      const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
      chunks.push(bytes);
      const v = { buffer: 0, byteOffset: len, byteLength: bytes.byteLength }; if (target) v.target = target;
      len += bytes.byteLength; json.bufferViews.push(v); return json.bufferViews.length - 1;
    };
    const acc = (typed, type, ctype, target, extra) => {
      const comps = { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 }[type];
      json.accessors.push(Object.assign({ bufferView: view(typed, target), componentType: ctype, count: typed.length / comps, type }, extra || {}));
      return json.accessors.length - 1;
    };
    const minmax = (a, n) => { const mn = Array(n).fill(Infinity), mx = Array(n).fill(-Infinity); for (let i = 0; i < a.length; i++) { const k = i % n; if (a[i] < mn[k]) mn[k] = a[i]; if (a[i] > mx[k]) mx[k] = a[i]; } return { min: mn, max: mx }; };
    const matIdx = {};
    Object.keys(MATS).forEach((k) => {
      const m = MATS[k];
      const mat = { name: 'Voxel_' + k, pbrMetallicRoughness: { baseColorFactor: (m.base || [1, 1, 1]).concat(1), metallicFactor: m.metal, roughnessFactor: m.rough } };
      if (m.emissive) mat.emissiveFactor = m.emissive;
      matIdx[k] = json.materials.length; json.materials.push(mat);
    });
    const addMesh = (name, prims) => {
      json.meshes.push({
        name, primitives: prims.map((p) => {
          const attributes = {
            POSITION: acc(p.pos, 'VEC3', 5126, 34962, minmax(p.pos, 3)),
            NORMAL: acc(p.nrm, 'VEC3', 5126, 34962),
            COLOR_0: acc(p.col, 'VEC3', 5126, 34962),
          };
          if (p.jnt) { attributes.JOINTS_0 = acc(p.jnt, 'VEC4', 5121, 34962); attributes.WEIGHTS_0 = acc(p.wgt, 'VEC4', 5126, 34962); }
          return { attributes, indices: acc(p.idx, 'SCALAR', p.idx instanceof Uint32Array ? 5125 : 5123, 34963), material: matIdx[p.mat], mode: 4 };
        }),
      });
      return json.meshes.length - 1;
    };
    const root = {
      name: 'PropellerPete', children: [],
      extras: {
        voxelSize: V,
        cornerEyes: { pupils: ['Pupil_R', 'Pupil_L'], lids: ['Lid_R', 'Lid_L'], eyeCenterInHead: model.eyeRig.eyeCenterHead, pupilTravel: [model.eyeRig.travelX, model.eyeRig.travelY], restingLidCover: model.eyeRig.glare },
        wheelchair: { wheelRadius: WHEEL_R * V, casterRadius: CASTER_R * V, wheelTrack: TRACK.wheelX * 2 * V, casterPivot: [TRACK.casterX * V, (TRACK.casterZ + 1) * V], rearAxleZ: (TRACK.axleZ + 1) * V },
      },
    };
    json.nodes.push(root);
    const idx = {};
    model.nodes.forEach((n, i) => { idx[n.name] = i + 1; });
    model.nodes.forEach((n) => {
      const g = { name: n.name };
      if (n.t.some((v) => v !== 0)) g.translation = n.t;
      if (n.r.some((v) => v !== 0)) g.rotation = quatXYZ(n.r);
      if (n.s) g.scale = n.s;
      if (n.mesh) g.mesh = addMesh(n.name, n.mesh);
      json.nodes.push(g);
    });
    model.nodes.forEach((n) => {
      const parent = n.parent ? json.nodes[idx[n.parent]] : root;
      (parent.children || (parent.children = [])).push(idx[n.name]);
    });
    // skins: inverse bind matrices from the bind pose (bones straight / at rest)
    const byName = {}; model.nodes.forEach((n) => { byName[n.name] = n; });
    const bindLocal = (n) => compose(n.t, n.bone ? [0, 0, 0, 1] : quatXYZ(n.r));
    model.skinned.forEach((s) => {
      const ibm = new Float32Array(s.joints.length * 16);
      s.joints.forEach((j, k) => {
        let m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], cur = byName[j];
        while (cur && cur.name !== s.space) { m = mul(bindLocal(cur), m); cur = byName[cur.parent]; }
        ibm.set(invRigid(m), k * 16);
      });
      json.skins.push({ name: s.name + '_Skin', joints: s.joints.map((j) => idx[j]), inverseBindMatrices: acc(ibm, 'MAT4', 5126), skeleton: idx[s.space] });
      json.nodes.push({ name: s.name, mesh: addMesh(s.name, s.prims), skin: json.skins.length - 1 });
      root.children.push(json.nodes.length - 1);
    });
    // animation clips
    Object.keys(CLIPS).forEach((clip) => {
      const { duration, samples } = CLIPS[clip];
      const times = new Float32Array(samples + 1);
      for (let i = 0; i <= samples; i++) times[i] = (duration * i) / samples;
      const input = acc(times, 'SCALAR', 5126, null, { min: [0], max: [duration] });
      // sample the last key at t = duration so continuous spins (wheels, propeller) land on a full turn
      const frames = []; for (let i = 0; i <= samples; i++) frames.push(pose(clip, times[i]));
      const anim = { name: clip, samplers: [], channels: [] };
      Object.keys(frames[0]).forEach((name) => {
        const n = byName[name]; if (!n) return;
        const rot = new Float32Array((samples + 1) * 4);
        let prev = null;
        frames.forEach((f, i) => {
          const o = f[name];
          const q = quatXYZ([n.r[0] + o.r[0], n.r[1] + o.r[1], n.r[2] + o.r[2]]);
          if (prev && prev[0] * q[0] + prev[1] * q[1] + prev[2] * q[2] + prev[3] * q[3] < 0) q.forEach((v, k) => { q[k] = -v; });
          rot.set(q, i * 4); prev = q;
        });
        anim.samplers.push({ input, output: acc(rot, 'VEC4', 5126), interpolation: 'LINEAR' });
        anim.channels.push({ sampler: anim.samplers.length - 1, target: { node: idx[name], path: 'rotation' } });
        if (frames.some((f) => f[name].t.some((v) => v !== 0))) {
          const tr = new Float32Array((samples + 1) * 3);
          frames.forEach((f, i) => { const o = f[name].t; tr.set([n.t[0] + o[0] * V, n.t[1] + o[1] * V, n.t[2] + o[2] * V], i * 3); });
          anim.samplers.push({ input, output: acc(tr, 'VEC3', 5126), interpolation: 'LINEAR' });
          anim.channels.push({ sampler: anim.samplers.length - 1, target: { node: idx[name], path: 'translation' } });
        }
      });
      json.animations.push(anim);
    });
    // pack
    const binPad = (4 - (len % 4)) % 4;
    const binLen = len + binPad;
    json.buffers.push({ byteLength: binLen });
    let jsonStr = JSON.stringify(json);
    while (jsonStr.length % 4) jsonStr += ' ';
    const jsonBytes = new TextEncoder().encode(jsonStr);
    const total = 12 + 8 + jsonBytes.length + 8 + binLen;
    const out = new Uint8Array(total);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
    dv.setUint32(12, jsonBytes.length, true); dv.setUint32(16, 0x4e4f534a, true);
    out.set(jsonBytes, 20);
    let o = 20 + jsonBytes.length;
    dv.setUint32(o, binLen, true); dv.setUint32(o + 4, 0x004e4942, true); o += 8;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }

  /* ---------- ZIP (store) ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function zip(files) {
    const enc = new TextEncoder(), parts = [], central = []; let off = 0;
    for (const f of files) {
      const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
      const name = enc.encode(f.name), crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, 0, true); h.setUint16(12, 0x5a21, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
      h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, 0, true); c.setUint16(14, 0x5a21, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + data.length;
    }
    const cdSize = central.reduce((s, a) => s + a.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
    const all = parts.concat(central, [new Uint8Array(e.buffer)]);
    const out = new Uint8Array(all.reduce((s, a) => s + a.length, 0)); let o = 0;
    for (const a of all) { out.set(a, o); o += a.length; }
    return out;
  }

  return { V, P, Part, meshPart, boxPrims, buildModel, toGLB, zip, pose, armIK, quatXYZ, hash, mix, shade, jit, CLIPS, TRACK, WHEEL_R, CASTER_R, compose, mul, invRigid };
});

/* WORLD 4: DA NAG DOUBLOON'S TOWER — w4/tower.js beside the page (the page loads it at start; it waits until someone enters).
   The owner, Oct 20 22:45: "build a level after the last doubloon boss that is a massive high quality brick tower, u can tell its brick.
   a 100 floor tower. each floor is its own level. when u enter this world u see the doubloon character and he greets u and tells u about the
   100 floors and his hoes are stuck at the top floor ... these should be platformer levels. you start at level 1 on floor one. and u get xp
   along the way by killing." Plus (22:46-00:02): two players online with everyone seeing the same things, an upgrade system, a market stand
   between floors, health potions, a mana system with attacks that use it, doubloon coins as the money, the old chicken-wing XP drops, an
   inventory with bags (drop, pick up, give to your friend, in the weapon wheel), comedy in the writing, a connecting story, NPCs who talk
   to you all the way up, and a secret reward at the top that people hint at.
   Every floor is a heightfield of brick columns rising out of a dark abyss (one height under every point, so the game's own walking,
   jumping, ledge and enemy rules work unchanged): stepping stones, plazas, stairs, bridges, moving platforms, a guardian and the gate up. */
(function(){'use strict';
if(window.W4&&window.W4.ver)return;
const W4=window.W4=Object.assign(window.W4||{},{ver:1,on:false,fl:0,seed:0,best:0,coins:0,mana:100,manaMax:100,t0:0,tOff:0,busy:false,F:null,G:null,drops:[],dropN:0,gate:false,cp:null,pend:[],seen:{},talk:null,shopOpen:false,bagOpen:false,npcs:[],gx:[]});
const V3=THREE.Vector3,$=id=>document.getElementById(id);
const clamp01=v=>v<0?0:v>1?1:v,lerp=(a,b,k)=>a+(b-a)*k,sst=(a,b,x)=>{const t=clamp01((x-a)/(b-a));return t*t*(3-2*t)};
function srand(seed){let s=(seed>>>0)||1;return ()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296}}
const R2=v=>Math.round(v*100)/100,R1=v=>Math.round(v*10)/10;
const VOID=0;          // the abyss floor far below the platforms: falling there sends you back to your last safe spot
const BASEH=40;        // where a floor's entry landing stands
const X0=90;           // floors sit away from the world's centre (World 2's code keeps the centre clear)
// ---------------------------------------------------------------- pictures: brick, stone, wood, painted on canvases once
const TXC={};
function cvs(n){const c=document.createElement('canvas');c.width=c.height=n;return c}
function noise2(seed){const r=srand(seed),P=new Float32Array(512);for(let i=0;i<512;i++)P[i]=r();return (x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;const h=(a,b)=>P[((a*73856093)^(b*19349663))&511];
 const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);return lerp(lerp(h(xi,yi),h(xi+1,yi),u),lerp(h(xi,yi+1),h(xi+1,yi+1),u),v)}}
// a brick wall picture: running bond, each brick its own shade, chipped corners, soot and mortar; plus its bumps and its shine
function brickSet(key,o){if(TXC[key])return TXC[key];o=Object.assign({hue:10,sat:.5,lit:.36,var:.09,mortar:[150,140,128],rows:8,cols:4,soot:.25,seed:7},o||{});
 const N=512,c=cvs(N),g=c.getContext('2d'),hc=cvs(N),hg=hc.getContext('2d'),rc=cvs(N),rg=rc.getContext('2d');const rnd=srand(o.seed),nz=noise2(o.seed+3);
 const mc='rgb('+o.mortar.join(',')+')';g.fillStyle=mc;g.fillRect(0,0,N,N);hg.fillStyle='#202020';hg.fillRect(0,0,N,N);rg.fillStyle='#f2f2f2';rg.fillRect(0,0,N,N);
 const bh=N/o.rows,bw=N/o.cols,m=5;
 for(let r=0;r<o.rows;r++){const off=(r%2)*bw/2;for(let k=-1;k<=o.cols;k++){const x=k*bw+off,y=r*bh;const l=o.lit+(rnd()-.5)*o.var*2,h=o.hue+(rnd()-.5)*10,s=o.sat+(rnd()-.5)*.15;
   const burnt=rnd()<.12;const L=burnt?l*.62:l;g.fillStyle='hsl('+h+','+Math.round(s*100)+'%,'+Math.round(L*100)+'%)';
   const x0=x+m/2,y0=y+m/2,w=bw-m,hh=bh-m;g.beginPath();const ch=()=>rnd()*3.5;g.moveTo(x0+ch(),y0);g.lineTo(x0+w-ch(),y0+ch()*.4);g.lineTo(x0+w,y0+hh-ch());g.lineTo(x0+ch(),y0+hh);g.closePath();g.fill();
   hg.fillStyle='rgb('+(200+rnd()*40|0)+','+(200+rnd()*40|0)+','+(200+rnd()*40|0)+')';hg.fillRect(x0+1,y0+1,w-2,hh-2);
   rg.fillStyle='rgb('+(170+rnd()*50|0)+',0,0)';rg.fillRect(x0,y0,w,hh);
   // pits and speckles in the face of the brick
   for(let q=0;q<26;q++){const px=x0+rnd()*w,py=y0+rnd()*hh,pr=.6+rnd()*1.8;g.fillStyle='rgba(0,0,0,'+(.08+rnd()*.14)+')';g.beginPath();g.arc(px,py,pr,0,6.3);g.fill();hg.fillStyle='rgba(0,0,0,.35)';hg.beginPath();hg.arc(px,py,pr,0,6.3);hg.fill()}
   for(let q=0;q<10;q++){const px=x0+rnd()*w,py=y0+rnd()*hh;g.fillStyle='rgba(255,230,200,'+(.05+rnd()*.08)+')';g.fillRect(px,py,1+rnd()*2,1)}
   // a darker lower edge and a lit upper edge: the brick reads as a block
   const gr=g.createLinearGradient(0,y0,0,y0+hh);gr.addColorStop(0,'rgba(255,220,190,.10)');gr.addColorStop(.25,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(0,0,0,.22)');g.fillStyle=gr;g.fillRect(x0,y0,w,hh)}}
 // soot and grime over the whole wall
 const im=g.getImageData(0,0,N,N),d=im.data;for(let y=0;y<N;y++)for(let x=0;x<N;x++){const k=(y*N+x)*4;const s=nz(x/64,y/64)*.6+nz(x/16,y/16)*.4;const f=1-o.soot*Math.max(0,s-.45)*1.6;d[k]*=f;d[k+1]*=f;d[k+2]*=f}g.putImageData(im,0,0);
 const map=new THREE.CanvasTexture(c);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.encoding=THREE.sRGBEncoding;map.anisotropy=Math.min(8,R.capabilities.getMaxAnisotropy());
 const nm=new THREE.CanvasTexture(heightToNormal(hc,2.2));nm.wrapS=nm.wrapT=THREE.RepeatWrapping;
 const rm=new THREE.CanvasTexture(rc);rm.wrapS=rm.wrapT=THREE.RepeatWrapping;
 return TXC[key]={map,nm,rm,size:o.size||4}}
function heightToNormal(hc,str){const N=hc.width,h=hc.getContext('2d').getImageData(0,0,N,N).data,o=cvs(N),og=o.getContext('2d'),im=og.createImageData(N,N),d=im.data;
 const H=(x,y)=>h[(((y+N)%N)*N+((x+N)%N))*4]/255;
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const dx=(H(x+1,y)-H(x-1,y))*str,dy=(H(x,y+1)-H(x,y-1))*str;let nx=-dx,ny=-dy,nz=1;const l=Math.hypot(nx,ny,nz);const k=(y*N+x)*4;d[k]=(nx/l*.5+.5)*255;d[k+1]=(ny/l*.5+.5)*255;d[k+2]=(nz/l*.5+.5)*255;d[k+3]=255}
 og.putImageData(im,0,0);return o}
// cut stone (the caps on top of every column, the stairs' treads, the door frames)
function stoneSet(){if(TXC.stone)return TXC.stone;const N=256,c=cvs(N),g=c.getContext('2d'),hc=cvs(N),hg=hc.getContext('2d'),rnd=srand(91),nz=noise2(17);
 g.fillStyle='#8a8478';g.fillRect(0,0,N,N);hg.fillStyle='#bbb';hg.fillRect(0,0,N,N);
 const slabs=[[0,0,128,128],[128,0,128,128],[0,128,128,128],[128,128,128,128]];slabs.forEach(([x,y,w,h])=>{const l=48+rnd()*14;g.fillStyle='hsl(38,8%,'+l+'%)';g.fillRect(x+3,y+3,w-6,h-6);hg.fillStyle='#e0e0e0';hg.fillRect(x+3,y+3,w-6,h-6)});
 const im=g.getImageData(0,0,N,N),d=im.data;for(let y=0;y<N;y++)for(let x=0;x<N;x++){const k=(y*N+x)*4,s=nz(x/20,y/20)*.7+nz(x/6,y/6)*.3;const f=.82+s*.3;d[k]*=f;d[k+1]*=f;d[k+2]*=f}g.putImageData(im,0,0);
 const map=new THREE.CanvasTexture(c);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.encoding=THREE.sRGBEncoding;const nm=new THREE.CanvasTexture(heightToNormal(hc,1.4));nm.wrapS=nm.wrapT=THREE.RepeatWrapping;
 return TXC.stone={map,nm,size:3}}
function woodSet(){if(TXC.wood)return TXC.wood;const N=256,c=cvs(N),g=c.getContext('2d'),rnd=srand(5),nz=noise2(41);
 const im=g.createImageData(N,N),d=im.data;for(let y=0;y<N;y++)for(let x=0;x<N;x++){const k=(y*N+x)*4,plank=Math.floor(y/32),s=nz(x/40+plank*7,y/4)*.6+nz(x/8,y/2)*.4;const gap=(y%32)<2?.45:1;const b=(.55+s*.45)*gap;d[k]=120*b+plank*3;d[k+1]=78*b;d[k+2]=44*b;d[k+3]=255}
 g.putImageData(im,0,0);const map=new THREE.CanvasTexture(c);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.encoding=THREE.sRGBEncoding;return TXC.wood={map,size:4}}
// the floors' themes: brick colour, mortar, light, fog, the abyss glow far below
const THEMES=[
 {n:'red',brick:{hue:9,sat:.52,lit:.36},fog:0x1a0d08,glow:0xff6a20,amb:0x8a6048,key:0xffd6a8},
 {n:'soot',brick:{hue:14,sat:.35,lit:.27,soot:.45,seed:11},fog:0x0e0907,glow:0xff4a10,amb:0x6a5040,key:0xffc890},
 {n:'clay',brick:{hue:22,sat:.55,lit:.42,seed:23,mortar:[170,160,140]},fog:0x1c120a,glow:0xffa040,amb:0x9a7050,key:0xffe0b0},
 {n:'brown',brick:{hue:18,sat:.38,lit:.31,seed:31},fog:0x150c08,glow:0xff8030,amb:0x80604a,key:0xffd0a0},
 {n:'royal',brick:{hue:350,sat:.42,lit:.30,seed:47,mortar:[175,160,120]},fog:0x140808,glow:0xffc040,amb:0x8a5a50,key:0xfff0c0}];
function brickMat(th){const k='bm'+th.n;if(TXC[k])return TXC[k];const T=brickSet('b'+th.n,th.brick);
 return TXC[k]=new THREE.MeshStandardMaterial({map:T.map,normalMap:T.nm,normalScale:new THREE.Vector2(.9,.9),roughnessMap:T.rm,roughness:1,metalness:0,envMapIntensity:.35})}
function stoneMat(){if(TXC.sm)return TXC.sm;const T=stoneSet();return TXC.sm=new THREE.MeshStandardMaterial({map:T.map,normalMap:T.nm,roughness:.86,metalness:0,envMapIntensity:.4})}
function woodMat(){if(TXC.wm)return TXC.wm;const T=woodSet();return TXC.wm=new THREE.MeshStandardMaterial({map:T.map,roughness:.8,metalness:0,envMapIntensity:.3})}
// one box with texture coordinates taken from where it stands in the world (1 brick picture every S units): any size, no stretching,
// and every box in a floor joins one shape (one draw for all the brick of a floor)
function boxW(x0,x1,y0,y1,z0,z1,S,out,faces){const P=out.p,N=out.n,U=out.u,I=out.i;const F=faces||63;
 const quad=(a,b,c,d,n,uv)=>{const s=P.length/3;[a,b,c,d].forEach(v=>P.push(v[0],v[1],v[2]));for(let k=0;k<4;k++)N.push(n[0],n[1],n[2]);uv.forEach(q=>U.push(q[0]/S,q[1]/S));I.push(s,s+1,s+2,s,s+2,s+3)};
 if(F&1)quad([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],[0,1,0],[[x0,z1],[x1,z1],[x1,z0],[x0,z0]]);                 // top
 if(F&2)quad([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],[0,-1,0],[[x0,z0],[x1,z0],[x1,z1],[x0,z1]]);                // bottom
 if(F&4)quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[0,0,1],[[x0,y0],[x1,y0],[x1,y1],[x0,y1]]);                 // +z
 if(F&8)quad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[0,0,-1],[[-x1,y0],[-x0,y0],[-x0,y1],[-x1,y1]]);            // -z
 if(F&16)quad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[1,0,0],[[-z1,y0],[-z0,y0],[-z0,y1],[-z1,y1]]);            // +x
 if(F&32)quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[-1,0,0],[[z0,y0],[z1,y0],[z1,y1],[z0,y1]])}               // -x
function geoOf(out){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(out.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(out.n,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(out.u,2));g.setIndex(out.i);g.computeBoundingSphere();g.computeBoundingBox();return g}
const newOut=()=>({p:[],n:[],u:[],i:[]});
// ---------------------------------------------------------------- one floor: generated from the floor number and the run's seed, so every
// player builds the very same floor. Platforms are brick columns rising out of the abyss (stone caps on top); they never overlap, so there is
// one height under every point. Gaps are sized for the game's own jump (a single jump clears about 14 paces and climbs about 7).
const FLOOR_NAMES=['The Lobby','The 78th Lil Nag Brigade','The Chapel of Do Not Press That','The Laundromat of Destiny','The Phoenix\'s Penthouse','The Dojo of the Undead','Bomb Buddy Basement',
 'The Wizard\'s Waiting Room','Swamped','Future Shock','The Barbershop Gauntlet','The Boss Lounge','Stairway to Ma\'s House','The Bread Factory','Collard Green Gardens',
 'The Brigade Annex','The Laundromat of Destiny II','The Group Chat','Ma\'s House (Finally)','Nagrock\'s Comeback Tour'];
const FLOOR_NAMES2={21:'The Maze of Nag',27:'Lost and Found',36:'The Hedge of Allegiance',45:'The Maze of Nag II',54:'Wrong Turn Terrace',63:'The Labyrinth of Lil Nags',72:'The Maze of Nag III',81:'Dead End Drive',90:'The Last Maze',22:'The Treasury',24:'Lights Out',28:'The Gauntlet',29:'The Ballroom',32:'The Elevator Shaft',34:'Ma\'s Kitchen',38:'The Mirror Floor',39:'The Opening Act',40:'Nagrock\'s Comeback Tour II',50:'The Halfway House',60:'Nagrock\'s Comeback Tour III',80:'Nagrock\'s Farewell Tour (Not Really)',99:'The Last Landing'};
function floorName(n){if(n<=FLOOR_NAMES.length)return FLOOR_NAMES[n-1];if(FLOOR_NAMES2[n])return FLOOR_NAMES2[n];const a=['Golden','Crooked','Leaning','Haunted','Greasy','Holy','Broke','Shiny','Busted','Royal','Lonely','Loud','Slippery','Smoky','Fancy'],
 b=['Landing','Stacks','Steps','Balcony','Kitchen','Hallway','Vault','Rafters','Cellar','Ballroom','Arcade','Courtyard','Chapel','Garage','Pantry'];const r=srand(n*977);return a[(r()*a.length)|0]+' '+b[(r()*b.length)|0]}
// who lives on which floor (the horde's kinds; more of them, tougher, the higher you go)
// (the owner, Oct 21 05:54: "all the characters should be flowing through the game": every kind is on every floor, from the first one up;
// the bombs, the Zombie Samurai's squad and the Afro Ninja Samurai join them on the way up: c_main spawnFloor / g_special skinsTick)
function floorKinds(n){const K=['doubloon','toast','redcap','zombie','stink'];if(n>=2)K.push('tiki');return K}
function genFloor(n,seed){const rnd=srand((seed|0)*7919+n*104729+13),ri=(a,b)=>a+Math.floor(rnd()*(b-a+1)),rf=(a,b)=>a+rnd()*(b-a);
 const SP=(typeof specialOf==='function'&&specialOf(n))||null;const th=SP&&SP.theme?SP.theme:THEMES[(n-1)%THEMES.length];const P=[],M=[],G=[];if(n===9)return swarmFloor(n,seed);if(typeof bigOf==='function'&&bigOf(n))return bigFloor(n,seed,SP,th);   // (every floor but the swarm, the Halfway House and the top is a big one: l_big.js)
 const add=(x0,x1,z0,z1,top,kind,o)=>{const p=Object.assign({x0,x1,z0,z1,top,kind,i:P.length},o||{});P.push(p);return p};
 // the landing you arrive on: the market stand and the way you came in
 const entry=add(X0-20,X0+20,0,26,BASEH,'entry',{cp:true});
 let cz=0,ch=BASEH,cx=X0,lastW=40;
 const XL=X0-46,XR=X0+46,cl=(x,w)=>Math.max(XL+w/2,Math.min(XR-w/2,x)),chH=h=>Math.max(30,Math.min(64,h));
 const nseg=5+Math.min(7,Math.floor(n/3)),kinds=SP&&SP.kinds?SP.kinds:floorKinds(n);
 const types=SP&&SP.layout?SP.layout:n<=1?['steps','plaza','stairs','plaza','bridge']:mazeOf(n)?(n===21?['plaza','maze','steps','maze','plaza']:['steps','plaza','maze','stairs','plaza']):null;
 for(let s=0;s<nseg;s++){let ty=types?types[s%types.length]:['steps','plaza','stairs','bridge','movers','zigzag','plaza','steps'][ri(0,7)];
  if(types&&s>=types.length)ty='plaza';if(s===nseg-1&&ty!=='plaza')ty='plaza';
  if(ty==='maze'){const m=mazeSeg(add,rnd,cz,ch,n,G,kinds);cz=m.z0;ch=m.top;cx=m.outX;lastW=58;continue}
  if(ty==='steps'){const k=ri(3,5);for(let i=0;i<k;i++){const sz=rf(6.5,9),gap=rf(5,10),dh=rf(-4,4.5),dx=rf(-12,12);const x=cl(cx+dx,sz),z1=cz-gap,top=chH(ch+dh);add(x-sz/2,x+sz/2,z1-sz,z1,top,'step');cz=z1-sz;ch=top;cx=x;lastW=sz}}
  else if(ty==='plaza'){const w=rf(28,40),d=rf(22,32),gap=rf(5,9),top=chH(ch+rf(-3,4)),x=cl(cx+rf(-8,8),w);const p=add(x-w/2,x+w/2,cz-gap-d,cz-gap,top,'plaza',{cp:true});
   // a few raised blocks to fight around (all of them climbable)
   const nb=ri(1,3);for(let b=0;b<nb;b++){const bw=rf(3,5),bd=rf(3,5),bx=rf(p.x0+bw,p.x1-bw),bz=rf(p.z0+bd+2,p.z1-bd-2);p.blocks=p.blocks||[];p.blocks.push({x0:bx-bw/2,x1:bx+bw/2,z0:bz-bd/2,z1:bz+bd/2,top:top+rf(1.6,4)})}
   G.push({pi:p.i,n:Math.min(9,3+Math.floor(n/4)+ri(0,2)),kinds});cz=p.z0;ch=top;cx=x;lastW=w}   // (never more than nine to a landing: the climb gets harder by their health and their hits, not by a crowd a phone cannot draw)
  else if(ty==='stairs'){const k=ri(6,9),w=rf(10,14),dir=ch<44?1:ch>54?-1:(rnd()<.5?1:-1),gap=rnd()<.5?0:rf(5,8),x=cl(cx+rf(-6,6),w);let z=cz-gap;
   for(let i=0;i<k;i++){const top=chH(ch+dir*1.2);add(x-w/2,x+w/2,z-3.2,z,top,'stair');z-=3.2;ch=top}cz=z;cx=x;lastW=w}
  else if(ty==='bridge'){const w=rf(4.2,5.5),len=rf(28,42),gap=rf(5,9),top=chH(ch+rf(-2,2)),x=cl(cx+rf(-10,10),w);const p=add(x-w/2,x+w/2,cz-gap-len,cz-gap,top,'bridge');
   G.push({pi:p.i,n:Math.min(6,2+Math.floor(n/6)),kinds});cz=p.z0;ch=top;cx=x;lastW=w}
  else if(ty==='movers'){const span=rf(22,32),ax=rnd()<.5?'x':'y',top=chH(ch+rf(-1,2)),x=cl(cx,10);
   const mz=cz-span/2;M.push({x,z:mz,w:8.5,d:8.5,top,ax,amp:ax==='x'?rf(9,14):rf(3.5,6),per:rf(4.5,6.5),ph:rnd()*6.28,i:M.length});
   const sz=rf(8,10);const p=add(x-sz/2,x+sz/2,cz-span-sz,cz-span,top,'step');cz=p.z0;ch=top;cx=x;lastW=sz}
  else if(ty==='zigzag'){const k=ri(4,6);let side=rnd()<.5?-1:1;for(let i=0;i<k;i++){const w=rf(5,7),d=rf(9,12),gap=rf(3,6),x=cl(X0+side*rf(6,14),w),top=chH(ch+rf(-2.5,2.5));add(x-w/2,x+w/2,cz-gap-d,cz-gap,top,'step');cz-=gap+d;ch=top;cx=x;side=-side}lastW=7}}
 // side branches (the owner: "don't make them linear"): from one or two of the plazas a short bridge leads out to a side landing with loot
 // (coins, a potion, a quest's lost thing or a cousin to find), guarded by a couple of the floor's own
 {const pl=P.filter(q=>q.kind==='plaza'&&!q.maze);const want=pl.length?Math.min(pl.length,n<=2?1:1+(rnd()<.6?1:0)):0;let made=0;
  for(let i=0;i<pl.length&&made<want;i++){const q=pl[(i+ri(0,pl.length-1))%pl.length];if(q.side)continue;const len=rf(7,11),sw=13;let side=rnd()<.5?-1:1;
   for(let k=0;k<2&&!q.side;k++,side=-side){const bx0=side>0?q.x1:q.x0-len,bx1=side>0?q.x1+len:q.x0;
    const LX0=side>0?bx1:bx0-sw,LX1=side>0?bx1+sw:bx0;if(LX0<XL-14+2.5||LX1>XR+14-2.5)continue;const z=lerp(q.z0+7,q.z1-7,rnd()),top=chH(q.top+rf(-1.5,2.5));
    add(bx0,bx1,z-2.2,z+2.2,q.top,'bridge',{side:1});const L=add(LX0,LX1,z-sw/2,z+sw/2,top,'side',{cp:true,from:q.i});if((made+n)%2)L.chest=1;else L.loot=1;q.side=1;G.push({pi:L.i,n:2,kinds});made++}}}
 // a secret ledge (the owner: "and more"): off the side of a plaza, no bridge, a jump away and a little lower, where the best loot waits
 {const pl=P.filter(q=>q.kind==='plaza'&&!q.maze&&!q.side);if(pl.length&&n>=3&&rnd()<.5){const q=pl[ri(0,pl.length-1)];const side=rnd()<.5?-1:1,gap=rf(9,11.5),sw=10;
   const LX0=side>0?q.x1+gap:q.x0-gap-sw,LX1=LX0+sw;if(LX0>=XL-14+2.5&&LX1<=XR+14-2.5){const z=lerp(q.z0+6,q.z1-6,rnd()),top=chH(q.top-rf(2,4));add(LX0,LX1,z-5,z+5,top,'side',{cp:true,secret:1,chest:1,from:q.i})}}}
 // the guardian's landing and the gate up
 const exW=40,exD=34,exTop=chH(ch+rf(-1,3)),ex=add(X0-exW/2,X0+exW/2,cz-8-exD,cz-8,exTop,'exit',{cp:true});
 const gate={x:X0,z:ex.z0+1.2,w:10,h:13,top:exTop};
 const zEnd=ex.z0-6;
 // the church floor: its biggest plaza holds the church (nobody spawns there, no blocks)
 if(SP&&SP.church){const big=P.filter(q=>q.kind==='plaza').sort((a,b)=>(b.x1-b.x0)*(b.z1-b.z0)-(a.x1-a.x0)*(a.z1-a.z0))[0];if(big){big.church=1;big.blocks=[];for(let i=G.length-1;i>=0;i--)if(G[i].pi===big.i)G.splice(i,1)}}
 const lock=n>=4&&!(SP&&(SP.rest||SP.nag))&&n!==9&&n<100&&rnd()<.3?1:0;   // a locked gate now and then: find its key
 const puz=puzzlePlan(n,seed,P,SP,rnd,entry);
 {const keep=G.filter(g=>P[g.pi]&&P[g.pi].maze),rest=G.filter(g=>!(P[g.pi]&&P[g.pi].maze));const kn=keep.reduce((a,g)=>a+g.n,0),tot=rest.reduce((a,g)=>a+g.n,0),cap=Math.max(8,26+Math.min(16,Math.floor(n/4))-kn);if(tot>cap){const k=cap/tot;rest.forEach(g=>{g.n=Math.max(2,Math.round(g.n*k))})}}   // (the maze keeps its full crew)   // (a floor never holds more than ~40: the climb gets harder by health and hits, not by a crowd)
 return {n,seed,th,P,M,G,entry,exit:ex,gate,zEnd,kinds,lock,puz,guard:SP&&SP.guard?SP.guard:kinds.filter(k=>k!=='stink')[(n-1)%kinds.filter(k=>k!=='stink').length],skin:SP&&SP.skin||'',gname:SP&&SP.gname||'',extra:SP&&SP.extra||null,nag:SP&&SP.nag?1:0,bombs:SP&&SP.bombs?1:0,rest:SP&&SP.rest?1:0,big:SP&&SP.big||0,dress:SP&&SP.dress||'',dark:SP&&SP.dark?1:0,treasure:SP&&SP.treasure?1:0,name:floorName(n),zMin:zEnd-8,zMax:34,xMin:XL-14,xMax:XR+14}}
// the maze floors: 21, then every ninth from 27 (27, 36, 45 ... 90)
function mazeOf(n){return n===21||(n>=27&&n<100&&n%9===0)}
// a landing walled into a maze (walls two jumps tall: nobody climbs them, nobody walks through them), one way in at the near edge, one way
// out at the far edge (never straight across), the floor's crew waiting in the corridors
function mazeSeg(add,rnd,cz,ch,n,G,kinds){const C=6,cs=9,wt=1.6,W=C*cs+wt,gap=6,top=Math.max(30,Math.min(64,ch)),x0=X0-W/2;
 // an apron strip in front of the walls (you land on it and walk to the way in), the walled landing, an apron beyond (the way out leads onto it)
 const za1=cz-gap,za0=za1-7;add(x0,x0+W,za0,za1,top,'step',{cp:true});const z1=za0,z0=z1-W;
 const p=add(x0,x0+W,z0,z1,top,'plaza',{cp:true,maze:1,C,cs,wt});p.blocks=[];const WH=top+27;   // (taller than the highest triple jump: no hopping over)
 const vis=[],E=[],Sw=[];for(let i=0;i<C;i++){vis.push([]);E.push([]);Sw.push([]);for(let j=0;j<C;j++){vis[i].push(false);E[i].push(true);Sw[i].push(true)}}   // E[i][j]: a wall east of cell (i,j); Sw: a wall south (towards +z)
 const st=[[(rnd()*C)|0,(rnd()*C)|0]];vis[st[0][0]][st[0][1]]=true;
 while(st.length){const [i,j]=st[st.length-1];const nb=[];if(i>0&&!vis[i-1][j])nb.push([i-1,j,'w']);if(i<C-1&&!vis[i+1][j])nb.push([i+1,j,'e']);if(j>0&&!vis[i][j-1])nb.push([i,j-1,'n']);if(j<C-1&&!vis[i][j+1])nb.push([i,j+1,'s']);
  if(!nb.length){st.pop();continue}const [ni,nj,d]=nb[(rnd()*nb.length)|0];if(d==='e')E[i][j]=false;else if(d==='w')E[ni][nj]=false;else if(d==='s')Sw[i][j]=false;else Sw[ni][nj]=false;vis[ni][nj]=true;st.push([ni,nj])}
 // cells are numbered from the far (north, -z) edge: j=0 is the far row, j=C-1 the near row (where you come in)
 const cx=i=>x0+wt+i*cs,cz0=j=>z0+wt+j*cs;const wall=(bx0,bx1,bz0,bz1)=>p.blocks.push({x0:bx0,x1:bx1,z0:bz0,z1:bz1,top:WH,wall:1});
 for(let i=0;i<C;i++)for(let j=0;j<C;j++){if(E[i][j]&&i<C-1)wall(cx(i)+cs-wt,cx(i)+cs,cz0(j)-wt,cz0(j)+cs);if(Sw[i][j]&&j<C-1)wall(cx(i)-wt,cx(i)+cs,cz0(j)+cs-wt,cz0(j)+cs)}
 const inCol=((rnd()*C)|0),outCol=(inCol+2+((rnd()*(C-3))|0))%C;   // in at the near edge, out at the far edge, never the same column
 const gapAt=(col,zz0,zz1)=>{const gx0=cx(col)+cs/2-2.6,gx1=cx(col)+cs/2+2.6;wall(x0,gx0,zz0,zz1);wall(gx1,x0+W,zz0,zz1)};
 gapAt(inCol,z1-wt,z1);gapAt(outCol,z0,z0+wt);wall(x0,x0+wt,z0,z1);wall(x0+W-wt,x0+W,z0,z1);p.inX=cx(inCol)+cs/2;p.outX=cx(outCol)+cs/2;
 // a sealed room: one dead end is walled off by a secret door (loose bricks with light in the cracks: push them), a chest behind it
 {const opens=(i,j)=>{const o=[];if(i>0&&!E[i-1][j])o.push('w');if(i<C-1&&!E[i][j])o.push('e');if(j>0&&!Sw[i][j-1])o.push('n');if(j<C-1&&!Sw[i][j])o.push('s');return o};
  const dead=[];for(let i=0;i<C;i++)for(let j=0;j<C;j++){if((i===inCol&&j===C-1)||(i===outCol&&j===0))continue;const o=opens(i,j);if(o.length===1)dead.push([i,j,o[0]])}
  if(dead.length){const [i,j,d]=dead[(rnd()*dead.length)|0];let b;
   if(d==='e')b={x0:cx(i)+cs-wt,x1:cx(i)+cs,z0:cz0(j)-wt,z1:cz0(j)+cs};else if(d==='w')b={x0:cx(i)-wt,x1:cx(i),z0:cz0(j)-wt,z1:cz0(j)+cs};
   else if(d==='s')b={x0:cx(i)-wt,x1:cx(i)+cs,z0:cz0(j)+cs-wt,z1:cz0(j)+cs};else b={x0:cx(i)-wt,x1:cx(i)+cs,z0:cz0(j)-wt,z1:cz0(j)};
   Object.assign(b,{top:WH,wall:1,sdoor:1,face:d});p.blocks.push(b);p.xchest={x:cx(i)+(cs-wt)/2,z:cz0(j)+(cs-wt)/2,src:'secret'};p.sealed=[i,j]}}
 G.push({pi:p.i,n:Math.min(9,4+Math.floor(n/5)),kinds});const out=add(x0,x0+W,z0-7,z0,top,'step',{cp:true});return {z0:out.z0,top,outX:p.outX,p}}
// ---- the floor's puzzle (from floor 3; the owner, Oct 21 11:59: "secret doors... a lock puzzle, puzzles throughout the whole"): a vault
// keep with a dial lock whose three symbols are carved on stones around the floor; plates that light up in an order you then step back in;
// or a ring of lanterns to light, where each one you touch flips its neighbours too. A maze floor's maze is its puzzle (and hides a sealed
// room). Everything here comes from the floor number and the run's seed: the same puzzle on every screen.
const PZSYM=['🪙','👑','💀','⭐','💎','🔥'];
function puzzlePlan(n,seed,P,SP,rnd,entry){if(n<3||n>=100||n===9||mazeOf(n)||(SP&&(SP.rest||SP.nag)))return null;
 const pl=P.filter(q=>q.kind==='plaza'&&!q.maze&&!q.church&&!q.nopuz&&(q.x1-q.x0)>=26&&(q.z1-q.z0)>=20);if(!pl.length)return null;
 const q=pl[(rnd()*pl.length)|0],t=['lock','plates','lanterns','busts','braziers'][(n+((seed>>>4)&7))%5];const cx=(q.x0+q.x1)/2,cz=(q.z0+q.z1)/2;
 const clear=(x0,x1,z0,z1)=>{q.blocks=(q.blocks||[]).filter(b=>b.x1<x0||b.x0>x1||b.z1<z0||b.z0>z1)};
 if(t==='lock'){const side=rnd()<.5?-1:1,kx0=side<0?q.x0+1.5:q.x1-11.5,kx1=kx0+10,kz0=q.z0+1.5,kz1=kz0+10,wt=1.2,top=q.top+27;clear(kx0-2,kx1+2,kz0-2,kz1+3);
  const w=(x0,x1,z0,z1,o)=>{const b=Object.assign({x0,x1,z0,z1,top,wall:1,keep:1},o||{});q.blocks.push(b);return b};
  w(kx0,kx1,kz0,kz0+wt);w(kx0,kx0+wt,kz0,kz1);w(kx1-wt,kx1,kz0,kz1);w(kx0,kx0+3,kz1-wt,kz1);w(kx0+7,kx1,kz1-wt,kz1);const door=w(kx0+3,kx0+7,kz1-wt,kz1,{vdoor:1});
  const sy=[];while(sy.length<3){const k=(rnd()*PZSYM.length)|0;if(!sy.includes(k))sy.push(k)}
  const spots=P.filter(p=>p!==q&&(p.kind==='plaza'||p.kind==='side'||p.kind==='entry'||(p.kind==='step'&&(p.x1-p.x0)>=6.5))&&!p.maze&&!p.church&&!p.secret);
  const clues=[];for(let k=0;k<3;k++){for(let tries=0;tries<24;tries++){const p=spots.length?spots[(rnd()*spots.length)|0]:entry;const x=p.kind==='entry'?p.x0+3:lerp(p.x0+2,p.x1-2,rnd()),z=p.kind==='entry'?p.z0+4+k*3:lerp(p.z0+2,p.z1-2,rnd());
    if((p.blocks||[]).some(b=>x>b.x0-1.5&&x<b.x1+1.5&&z>b.z0-1.5&&z<b.z1+1.5))continue;if(clues.some(c=>Math.hypot(c.x-x,c.z-z)<4))continue;clues.push({x,z,top:p.top,k,s:sy[k]});break}}
  return {t,pi:q.i,keep:{x0:kx0,x1:kx1,z0:kz0,z1:kz1,door},code:sy,clues,chest:{x:kx0+5,z:kz0+4.6,top:q.top,src:'vault'}}}
 clear(cx-9,cx+9,cz-10,cz+10);
 if(t==='plates'){const L=4+(n>30?1:0)+(n>60?1:0),seq=[];for(let k=0;k<L;k++){let v;do{v=(rnd()*4)|0}while(seq.length&&v===seq[seq.length-1]);seq.push(v)}
  return {t,pi:q.i,x:cx,z:cz,top:q.top,plates:[[-3.4,-3.4],[3.4,-3.4],[-3.4,3.4],[3.4,3.4]].map(([dx,dz])=>({x:cx+dx,z:cz+dz})),start:{x:cx,z:cz+7.5},seq,chest:{x:cx,z:cz,top:q.top,src:'puzzle',hidden:1}}}
 // the busts: four old kings' busts round a gold sun in the floor, each looking the wrong way; turning one (a quarter turn) drags the next one
 // round with it: get all four looking at the sun. Scrambled by turning them back from solved, so there is always a way
 if(t==='busts'){const r=[0,0,0,0],k=n>60?4:n>30?3:2;for(let m=0;m<k;m++){const i=(rnd()*4)|0;r[i]=(r[i]+1)%4;r[(i+1)%4]=(r[(i+1)%4]+1)%4}if(r.every(v=>!v)){r[0]=1;r[1]=1}
  return {t,pi:q.i,x:cx,z:cz,top:q.top,busts:[[0,-5.5],[5.5,0],[0,5.5],[-5.5,0]].map(([dx,dz],i)=>({x:cx+dx,z:cz+dz,face:Math.atan2(-dx,-dz),r:r[i]})),chest:{x:cx,z:cz,top:q.top,src:'puzzle',hidden:1}}}
 // the braziers: four cold braziers, two on this landing and two on landings further off (or all four here, at the corners, when there are
 // none); one you light burns for a while (the shortest run round all four and the climbs, with time to spare): get all four burning at once
 if(t==='braziers'){const own=[{x:q.x0+2.5,z:q.z0+2.5,p:q},{x:q.x1-2.5,z:q.z1-2.5,p:q}];const mid=p=>[(p.x0+p.x1)/2,(p.z0+p.z1)/2];
  const cand=P.filter(p=>p!==q&&(p.kind==='plaza'||(p.kind==='step'&&(p.x1-p.x0)>=6&&(p.z1-p.z0)>=6))&&!p.maze&&!p.church&&!p.secret&&!p.wide&&Math.abs(p.top-q.top)<=9).map(p=>{const m=mid(p);return {p,d:Math.hypot(m[0]-cx,m[1]-cz)}}).filter(o=>o.d>14&&o.d<70).sort((a,b)=>a.d-b.d);
  const far=[];if(cand.length>=2){const a=cand[(rnd()*Math.min(3,cand.length))|0];far.push(a);const ma=mid(a.p);const rest=cand.filter(o=>o!==a&&Math.hypot(mid(o.p)[0]-ma[0],mid(o.p)[1]-ma[1])>12);if(rest.length)far.push(rest[(rnd()*Math.min(3,rest.length))|0])}
  const spot=p=>{for(let k=0;k<12;k++){const x=lerp(p.x0+2.5,p.x1-2.5,rnd()),z=lerp(p.z0+2.5,p.z1-2.5,rnd());if(p.kind==='plaza'&&Math.hypot(x-(p.x0+3),z-(p.z1-3))<4.5)continue;return {x,z,p}}return {x:(p.x0+p.x1)/2,z:(p.z0+p.z1)/2,p}};
  const pts=far.length===2?own.concat(far.map(o=>spot(o.p))):[{x:q.x0+2.5,z:q.z0+2.5,p:q},{x:q.x1-2.5,z:q.z0+2.5,p:q},{x:q.x1-2.5,z:q.z1-2.5,p:q},{x:q.x0+2.5,z:q.z1-7,p:q}];
  pts.forEach(o=>{o.p.blocks=(o.p.blocks||[]).filter(b=>b.x1<o.x-2.2||b.x0>o.x+2.2||b.z1<o.z-2.2||b.z0>o.z+2.2)});
  const cost=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z)+2.5*Math.abs(a.p.top-b.p.top);let best=1e9;const go=(at,left,s)=>{if(!left.length){best=Math.min(best,s);return}left.forEach((o,k)=>go(o,left.filter((_,j)=>j!==k),s+(at?cost(at,o):0)))};go(null,pts,0);
  const dur=Math.round(Math.max(16,Math.min(40,8+best/(5+n/40))));
  return {t,pi:q.i,x:cx,z:cz,top:q.top,braz:pts.map(o=>({x:o.x,z:o.z,top:o.p.top})),dur,run:Math.round(best),chest:{x:cx,z:cz,top:q.top,src:'puzzle',hidden:1}}}
 const N=5,on=[1,1,1,1,1];const flips=2+((rnd()*2)|0);for(let k=0;k<flips;k++){const i=(rnd()*N)|0;[i,(i+1)%N,(i+N-1)%N].forEach(j=>{on[j]^=1})}if(on.every(v=>v)){on[0]=0;on[1]=0;on[N-1]=0}   // (never already solved)
 return {t,pi:q.i,x:cx,z:cz,top:q.top,lan:[...Array(N)].map((_,i)=>({x:cx+Math.sin(i/N*6.283)*5.2,z:cz+Math.cos(i/N*6.283)*5.2})),on,chest:{x:cx,z:cz,top:q.top,src:'puzzle',hidden:1}}}
// ---------------------------------------------------------------- the floor's ground, asked for everywhere (you, the enemies, the effects)
function moverPos(m,t){const k=Math.sin((t||0)*6.2832/m.per+m.ph);return m.ax==='x'?{x:m.x+k*m.amp,z:m.z,y:m.top}:m.ax==='z'?{x:m.x,z:m.z+k*m.amp,y:m.top}:{x:m.x,z:m.z,y:m.top+(k+1)*.5*m.amp}}
function floorClock(){return clk.getElapsedTime()-W4.t0+W4.tOff}
function buildGrid(F){const s=8;let x0=1e9,z0=1e9,x1=-1e9,z1=-1e9;const all=[];F.P.forEach(p=>{all.push(p);(p.blocks||[]).forEach(b=>{b.top0=b.top;all.push(b)})});
 all.forEach(p=>{x0=Math.min(x0,p.x0);x1=Math.max(x1,p.x1);z0=Math.min(z0,p.z0);z1=Math.max(z1,p.z1)});x0-=1;z0-=1;
 const gw=Math.ceil((x1-x0)/s)+2,gd=Math.ceil((z1-z0)/s)+2;const grid=new Array(gw*gd);for(let i=0;i<grid.length;i++)grid[i]=null;
 all.forEach(p=>{for(let gz=Math.floor((p.z0-z0)/s);gz<=Math.floor((p.z1-z0)/s);gz++)for(let gx=Math.floor((p.x0-x0)/s);gx<=Math.floor((p.x1-x0)/s);gx++){const k=gz*gw+gx;(grid[k]||(grid[k]=[])).push(p)}});
 Object.assign(F,{gs:s,gx0:x0,gz0:z0,gw,gd,grid})}
function towerH(x,z){const F=W4.F;if(!F)return VOID;let h=VOID;
 if(F.M.length){const t=floorClock();for(const m of F.M){const p=moverPos(m,t);if(Math.abs(x-p.x)<=m.w/2&&Math.abs(z-p.z)<=m.d/2&&p.y>h)h=p.y}}
 const gx=Math.floor((x-F.gx0)/F.gs),gz=Math.floor((z-F.gz0)/F.gs);if(gx<0||gz<0||gx>=F.gw||gz>=F.gd)return h;const L=F.grid[gz*F.gw+gx];if(!L)return h;
 for(const p of L){if(x>=p.x0&&x<=p.x1&&z>=p.z0&&z<=p.z1&&p.top>h)h=p.top}return h}
// ---------------------------------------------------------------- building it: one shape of brick, one of stone, a few movers, the hall,
// the abyss glowing far below, torches, the gate
function buildFloor(F){const G=new THREE.Group();G.name='w4floor';const th=F.th;const bm=brickMat(th),sm=stoneMat();
 const B=newOut(),Sx=newOut(),BS=4.2,SS=3;
 F.P.forEach(p=>{const top=p.top;boxW(p.x0,p.x1,VOID-2,top-.9,p.z0,p.z1,BS,B,61);boxW(p.x0-.22,p.x1+.22,top-.9,top,p.z0-.22,p.z1+.22,SS,Sx,63);
  (p.blocks||[]).forEach(b=>{if(b.sdoor||b.vdoor||b.nobrick)return;if(b.wall){boxW(b.x0,b.x1,top,b.top-.4,b.z0,b.z1,BS,B,60);boxW(b.x0-.08,b.x1+.08,b.top-.4,b.top,b.z0-.08,b.z1+.08,SS,Sx,63)}else{boxW(b.x0,b.x1,top,b.top-.5,b.z0,b.z1,BS,B,60);boxW(b.x0-.12,b.x1+.12,b.top-.5,b.top,b.z0-.12,b.z1+.12,SS,Sx,63)}})});
 // the hall: four walls of brick rising out of the abyss, a stone band where the floor's landings are
 const wx0=F.xMin,wx1=F.xMax,wz0=F.zMin,wz1=F.zMax,WT=4,WH=150;
 boxW(wx0-WT,wx0,VOID-2,WH,wz0-WT,wz1+WT,BS,B,16);boxW(wx1,wx1+WT,VOID-2,WH,wz0-WT,wz1+WT,BS,B,32);boxW(wx0,wx1,VOID-2,WH,wz0-WT,wz0,BS,B,4);boxW(wx0,wx1,VOID-2,WH,wz1,wz1+WT,BS,B,8);
 [BASEH-1.6,BASEH+24].forEach(y=>{boxW(wx0-.6,wx0,y,y+1.4,wz0,wz1,SS,Sx,16);boxW(wx1,wx1+.6,y,y+1.4,wz0,wz1,SS,Sx,32)});
 const bmesh=new THREE.Mesh(geoOf(B),bm);bmesh.receiveShadow=true;bmesh.castShadow=true;G.add(bmesh);
 const smesh=new THREE.Mesh(geoOf(Sx),sm);smesh.receiveShadow=true;smesh.castShadow=true;G.add(smesh);
 // the movers: stone slabs with gold trim
 F.mv=F.M.map(m=>{const g=new THREE.Group();const o=newOut();boxW(-m.w/2,m.w/2,-1.3,0,-m.d/2,m.d/2,SS,o,63);const s=new THREE.Mesh(geoOf(o),sm);s.castShadow=s.receiveShadow=true;g.add(s);
  const tr=new THREE.Mesh(new THREE.BoxGeometry(m.w+.3,.3,m.d+.3),new THREE.MeshStandardMaterial({color:0xd9a425,metalness:1,roughness:.32}));tr.position.y=-1.15;g.add(tr);
  const glow=new THREE.Mesh(new THREE.PlaneGeometry(m.w*1.4,m.d*1.4),new THREE.MeshBasicMaterial({color:0xffb040,transparent:true,opacity:.18,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));glow.rotation.x=-Math.PI/2;glow.position.y=-1.4;g.add(glow);G.add(g);return g});
 // the abyss: far below, a slow glow of embers and a haze you can't see the bottom of
 const ab=new THREE.Mesh(new THREE.PlaneGeometry(wx1-wx0+20,wz1-wz0+20),new THREE.MeshBasicMaterial({color:th.glow,transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
 ab.rotation.x=-Math.PI/2;ab.position.set((wx0+wx1)/2,VOID+1,(wz0+wz1)/2);G.add(ab);F.abyss=ab;
 const haze=new THREE.Mesh(new THREE.PlaneGeometry(wx1-wx0+20,wz1-wz0+20),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.6,depthWrite:false}));haze.rotation.x=-Math.PI/2;haze.position.set((wx0+wx1)/2,VOID+14,(wz0+wz1)/2);G.add(haze);
 // torches on the walls (a few real lights; the rest glow on their own): one draw for all the brackets, one for the cups, one per flame layer
 F.flames=[];const TI=[],LI=[];const torchAt=(x,y,z,face,lit)=>{TI.push([x,y,z,face]);if(lit)LI.push([x,y,z,face])};
 let lights=0;for(let z=wz1-12;z>wz0+6;z-=26){const y=BASEH+9;torchAt(wx0,y,z,Math.PI/2,lights<4&&Math.abs(z)%52<26);torchAt(wx1,y,z,-Math.PI/2,lights<4&&Math.abs(z)%52>=26);if(Math.abs(z)%52<52)lights++}
 {const put=(geo,mat,items,shadow)=>{const before=new Set(world.children);instLayer=1;const m=inst(geo,mat,items,shadow!==false);instLayer=0;world.children.filter(o=>!before.has(o)).forEach(o=>{world.remove(o);G.add(o)});return m};
  const off=(it,dx,dy,dz)=>[it[0]+Math.sin(it[3])*dz+Math.cos(it[3])*dx,it[1]+dy,it[2]+Math.cos(it[3])*dz-Math.sin(it[3])*dx,it[3],1];
  put(new THREE.BoxGeometry(.35,.35,1.4),sm,TI.map(it=>off(it,0,0,.6)));put(new THREE.CylinderGeometry(.45,.3,.5,10),new THREE.MeshStandardMaterial({color:0x2a2420,metalness:.8,roughness:.4}),TI.map(it=>off(it,0,.3,1.2)));
  F.torch={items:TI.map(it=>off(it,0,.65,1.2)),im:[]};for(let k=0;k<3;k++){const im=new THREE.InstancedMesh(new THREE.ConeGeometry(.42-k*.1,1.3-k*.25,8).translate(0,.5+k*.08,0),new THREE.MeshBasicMaterial({color:[0xff5a10,0xffa02a,0xfff0a0][k],transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),TI.length);
   im.frustumCulled=false;im.layers.set(1);G.add(im);F.torch.im.push(im)}
  LI.forEach(it=>{const L=new THREE.PointLight(0xffa050,1.8,46,1.6);const q=off(it,0,1.4,2.2);L.position.set(q[0],q[1],q[2]);G.add(L)})}
 // windows high in the walls: daylight from outside the tower (the panes, the frames and the shafts of light: one draw each)
 {const WI=[],SH=[];for(let z=wz1-30;z>wz0+20;z-=60){[[wx0+.05,Math.PI/2],[wx1-.05,-Math.PI/2]].forEach(([x,ry])=>{WI.push([x,BASEH+40,z,ry,1]);if(!F.dark)SH.push([x+(ry>0?14:-14),BASEH+16,z,ry,1])})}
  const put=(geo,mat,items,shadow)=>{if(!items.length)return;const before=new Set(world.children);instLayer=1;inst(geo,mat,items,shadow!==false);instLayer=0;world.children.filter(o=>!before.has(o)).forEach(o=>{world.remove(o);G.add(o)})};
  put(new THREE.PlaneGeometry(6,11),new THREE.MeshBasicMaterial({color:F.dark?0x141c30:0xbfd8ff,toneMapped:false}),WI,false);
  put(new THREE.BoxGeometry(.8,12.4,7.4).translate(0,0,0),sm,WI.map(it=>[it[0]+(it[3]>0?-.3:.3)-(it[3]>0?.05:-.05),it[1],it[2],0,1]),false);
  // (the pane faces the hall; the shaft leans into the hall: built leaning, placed by its window's side)
  put(new THREE.PlaneGeometry(7,70).rotateZ(-.55),new THREE.MeshBasicMaterial({color:0xfff2d8,transparent:true,opacity:.05,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}),SH.filter(it=>it[3]>0).map(it=>[it[0],it[1],it[2],0,1]),false);
  put(new THREE.PlaneGeometry(7,70).rotateZ(.55),new THREE.MeshBasicMaterial({color:0xfff2d8,transparent:true,opacity:.05,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}),SH.filter(it=>it[3]<0).map(it=>[it[0],it[1],it[2],0,1]),false)}
 // the gate up: a stone arch in the far wall, iron bars that rise when the guardian falls, a stair of light behind
 {const g=F.gate,A=new THREE.Group();A.position.set(g.x,g.top,g.z);const fr=newOut();boxW(-g.w/2-2,-g.w/2,0,g.h,-1.5,1.5,SS,fr,63);boxW(g.w/2,g.w/2+2,0,g.h,-1.5,1.5,SS,fr,63);boxW(-g.w/2-2,g.w/2+2,g.h,g.h+2.2,-1.6,1.6,SS,fr,63);
  A.add(new THREE.Mesh(geoOf(fr),sm));const lightP=new THREE.Mesh(new THREE.PlaneGeometry(g.w,g.h),new THREE.MeshBasicMaterial({color:0xffe6a0,toneMapped:false}));lightP.position.set(0,g.h/2,-1.4);A.add(lightP);
  const bars=new THREE.Group();const im=new THREE.MeshStandardMaterial({color:0x2c2622,metalness:.85,roughness:.45});for(let i=0;i<9;i++){const b=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,g.h,8),im);b.position.set(-g.w/2+.6+i*(g.w-1.2)/8,g.h/2,0);bars.add(b)}
  for(const y of [2.2,g.h-1.6]){const c=new THREE.Mesh(new THREE.BoxGeometry(g.w,.35,.35),im);c.position.y=y;bars.add(c)}A.add(bars);F.bars=bars;
  const L=new THREE.PointLight(0xffd080,2.2,40,1.5);L.position.set(0,g.h*.6,-3);A.add(L);G.add(A);F.gateG=A}
 try{floorLook(F,G)}catch(e){console.warn('floor look',e)}try{secretBuild(F,G)}catch(e){console.warn('secrets',e)}try{puzzleBuild(F,G)}catch(e){console.warn('puzzle',e)}try{chestBuild(F,G)}catch(e){console.warn('chests',e)}
 G.traverse(o=>{o.layers.set(1)});return G}
// ---------------------------------------------------------------- entering the tower, the floors, falling, the gate, everyone together
const SAVEK='msTower1';
function saveLoad(){try{return JSON.parse(localStorage.getItem(SAVEK)||'{}')||{}}catch(e){return {}}}
function saveNow(){try{const o=saveLoad();o.best=Math.max(o.best|0,W4.fl|0);o.coins=W4.coins|0;o.bag=W4.bag;o.up=W4.up;o.manaMax=W4.manaMax;o.seed=W4.seed;localStorage.setItem(SAVEK,JSON.stringify(o))}catch(e){}}
W4.up=W4.up||{dmg:0,hp:0,mana:0,bag:0,spd:0};
// a black curtain for the moves between places
function curtain(on,ms,cb){let c=$('w4fade');if(!c){c=document.createElement('div');c.id='w4fade';c.style.cssText='position:fixed;inset:0;z-index:70;background:#000;opacity:0;pointer-events:none;transition:opacity .35s';document.body.appendChild(c)}
 c.style.transition='opacity '+((ms||350)/1000)+'s';requestAnimationFrame(()=>{c.style.opacity=on?1:0});if(cb)setTimeout(cb,(ms||350)+30)}
// the world swap: whatever world you were in goes away; you, your pets and your powers stay
// a floor's own shapes are freed when you leave it (a hundred floors must not pile up in the graphics memory); shared shapes are marked and kept
function w4Dispose(G){if(!G)return;const seen=new Set();const walk=o=>{if(o.userData&&o.userData.keepGeo)return;const g=o.geometry;if(g&&!seen.has(g)&&!(g.userData&&g.userData.shared)){seen.add(g);try{g.dispose()}catch(e){}}o.children.forEach(walk)};walk(G);W4.freed=(W4.freed|0)+seen.size}
function clearWorld(){try{w4Dispose(W4.G);W4.G=null}catch(e){}try{if(W4.heroL){if(W4.heroL.parent)W4.heroL.parent.remove(W4.heroL);W4.heroL=null}}catch(e){}try{if(window.W3&&W3.on){W3.on=false;if(typeof boss!=='undefined')boss=null;const rw=$('w3rw');if(rw)rw.remove();const bb=$('bossbar');if(bb)bb.style.display='none'}}catch(e){}
 try{if(typeof musicW2==='function')musicW2(null)}catch(e){}
 {const bb=$('bossbar');if(bb)bb.style.display='none';W4.bbOn=false}
 while(world.children.length)world.remove(world.children[0]);
 enemies=[];bombs=[];projectiles=[];floaters=[];try{boss=null}catch(e){}
 Object.assign(L2,{minis:[],chickens:[],bullets:[],jaws:[],parts:[],rockets:[],spawnPts:[[X0,-60]],endPortal:null,portal:null,golem:null,golemPre:null,portalPre:null,miniPre:null,hordeN:0,volc:[],glowL:null,ash:null,embers:null,drops:[]});
 if(L2.dome&&L2.dome.parent)L2.dome.parent.remove(L2.dome);
 if(hero)world.add(hero);if(typeof dogG!=='undefined'&&dogG)world.add(dogG);if(typeof breadG!=='undefined'&&breadG)world.add(breadG);
 for(const id in MP.players){const P=MP.players[id];if(P.g)world.add(P.g)}}
// light and air inside the tower: a warm key light from the windows above, the abyss glowing up from below, a soft haze
function towerAir(th,outside){try{SUN_DIR.set(-.35,.82,.45).normalize();
 // outside: the swamp's own sky and sun (a low warm sun: long shadows, glowing haze; the sky's light is what the gold and the water reflect)
 if(outside&&typeof setupSky==='function'){try{setupSky(new THREE.Vector3(-.55,.3,.78).normalize())}catch(e){}}sun.color.setHex(outside?0xfff0d6:th.key);sun.intensity=outside?2.4:1.55;hemi.color.setHex(outside?0xc8d8ff:th.amb);hemi.groundColor.setHex(outside?0x5a4a3a:0x3a1a0a);hemi.intensity=outside?.95:th.n==='dark'?.2:.62;if(th.n==='dark')sun.intensity=.35;
 L2.fogK=outside?.0016:.0042;L2.expK=1;if(S.fog){S.fog.color.setHex(outside?0xc8d4e0:th.fog);S.fog.density=L2.fogK*((SET&&SET.fogD)||1)}R.toneMappingExposure=((SET&&SET.exposure)||1)*(outside?1:th.n==='dark'?.8:1.08);
 if(typeof sky!=='undefined'&&sky)sky.visible=!!outside;if(typeof water!=='undefined'&&water)water.visible=!!outside;if(typeof waterMesh!=='undefined'&&waterMesh)waterMesh.visible=!!outside;if(typeof sunGlare!=='undefined'&&sunGlare)sunGlare.visible=!!outside;
 if(W4.skyM){W4.skyM.visible=!outside}else{const g=new THREE.SphereGeometry(1800,24,12);const m=new THREE.MeshBasicMaterial({color:0x090504,side:THREE.BackSide,fog:false,depthWrite:false});W4.skyM=new THREE.Mesh(g,m);W4.skyM.layers.set(1);W4.skyM.visible=!outside}
 if(W4.skyM.parent!==S)S.add(W4.skyM)}catch(e){console.warn('tower air',e)}}
// ---- going in: from the giant Dabloon's fall (World 3), from the settings' testing button, or because the host went in
W4.enter=function(fromNet,o){if(W4.on&&!o)return;o=o||{};if(MP.on&&MP.client&&!fromNet){toast('The host leads the way into the tower.');return}
 const sv=saveLoad();W4.seed=o.seed||((MP.on&&!MP.client)||!MP.on?(sv.seed||((Math.random()*1e9)|0)):W4.seed||1);
 if(!fromNet){W4.coins=sv.coins|0;if(Array.isArray(sv.bag))W4.bag=sv.bag;if(sv.up)W4.up=Object.assign(W4.up,sv.up);if(sv.manaMax)W4.manaMax=sv.manaMax}
 else{const sv2=saveLoad();W4.coins=sv2.coins|0;if(Array.isArray(sv2.bag))W4.bag=sv2.bag;if(sv2.up)W4.up=Object.assign(W4.up,sv2.up);if(sv2.manaMax)W4.manaMax=sv2.manaMax}
 if(MP.on&&!fromNet)mpQueue({k:'w4go',s:W4.seed});
 W4.on=true;W4.fl=0;try{if(typeof normalForm==='function')normalForm()}catch(e){}try{if(typeof gogo!=='undefined'&&gogo&&typeof setGogo==='function')setGogo(false)}catch(e){}
 if(!L2.on){L2.on=true;L2.diff=L2.diff||'normal';L2.hpMul=L2.hpMul||1;L2.dmgIn=L2.dmgIn||1;L2.pwr0=L2.pwr0||1;L2.dmgMul=L2.dmgMul||1;L2.hpMax=L2.hpMax||140;L2.size0=L2.size0||1;L2.spd0=L2.spd0||1;L2.lvl0=L2.lvl0||level;L2.fistMul=L2.fistMul||1;L2.kills=L2.kills|0}
 L2.ended=true;L2.phase='w4';if(typeof paused!=='undefined'&&paused&&typeof setPaused==='function')setPaused(false,true);
 bagInit();applyUps();
 curtain(true,400,()=>{try{buildOutside()}catch(e){console.error('tower outside',e)}curtain(false,700)})};
W4.skipTo=function(){if(typeof toggleSettings==='function')toggleSettings(false);if(MP.on&&MP.client){toast('Only the host can take everyone to the tower.');return}
 if(!L2.on){L2.on=true;L2.diff='normal';L2.hpMul=1;L2.dmgIn=1;L2.pwr0=1;L2.dmgMul=1;L2.hpMax=140;L2.size0=1;L2.spd0=1;L2.lvl0=level;L2.fistMul=1;L2.kills=0;L2.akMul=L2.akMul||1;L2.rate=L2.rate||1;playerHP=L2.hpMax}
 if(!inv.items.ak)inv.items.ak=1;W4.enter(false)};
// ---- the tower from outside: a plaza of cobbles, the tower rising into the clouds, its door, and the Dabloon waiting there
function buildOutside(){clearWorld();W4.F=null;W4.out=true;W4.fl=0;heightAt=outsideH;PLAYR=400;MAPSIZE=420;cam.far=4000;cam.updateProjectionMatrix();towerAir(THEMES[0],true);
 const G=new THREE.Group();G.name='w4out';world.add(G);W4.G=G;const th=THEMES[0],bm=brickMat(th),sm=stoneMat();
 // the ground, the lake, the plants, the plaza (g6_look.js: the swamp's own kind of scenery)
 try{outsideLook(G)}catch(e){console.error('tower outside look',e);const pl=new THREE.Mesh(new THREE.CircleGeometry(150,64),new THREE.MeshStandardMaterial({color:0x9a9488,roughness:.9}));pl.rotation.x=-Math.PI/2;G.add(pl)}
 // the tower: a brick drum 140 across, rising 900 into the clouds, ringed with stone bands and lit windows
 const TR=70,TH=900,TZ=-150;const tg=new THREE.CylinderGeometry(TR,TR*1.06,TH,64,40,true);{const P=tg.attributes.position,U=tg.attributes.uv;for(let i=0;i<P.count;i++){const x=P.getX(i),y=P.getY(i)+TH/2,z=P.getZ(i);const a=Math.atan2(x,z);U.setXY(i,a*TR/4.2,y/4.2)}}
 tg.translate(0,TH/2,0);const tw=new THREE.Mesh(tg,bm);tw.position.set(0,0,TZ);tw.castShadow=true;tw.receiveShadow=true;G.add(tw);
 for(let y=36;y<TH;y+=60){const b=new THREE.Mesh(new THREE.TorusGeometry(TR*1.035,1.6,6,64),sm);b.rotation.x=Math.PI/2;b.position.set(0,y,TZ);G.add(b)}
 const winM=new THREE.MeshBasicMaterial({color:0xffc870,toneMapped:false});for(let y=70;y<TH;y+=60)for(let k=0;k<8;k++){const a=k/8*6.283+(y/60)*.4;const w=new THREE.Mesh(new THREE.PlaneGeometry(5,9),winM);w.position.set(Math.sin(a)*(TR*1.04+.2),y,TZ+Math.cos(a)*(TR*1.04+.2));w.rotation.y=a;G.add(w)}
 // the door: a stone arch, two doors of gold-studded wood, banners
 const D=new THREE.Group();D.position.set(0,0,TZ+TR+.5);const fr=newOut();boxW(-11,-8,0,24,-3,3,3,fr,63);boxW(8,11,0,24,-3,3,3,fr,63);boxW(-11,11,24,28,-3.2,3.2,3,fr,63);D.add(new THREE.Mesh(geoOf(fr),sm));
 const dm=new THREE.MeshStandardMaterial({map:woodSet().map,roughness:.75});W4.doors=[-1,1].map(s=>{const p=new THREE.Group();p.position.set(s*8,0,1.2);const d=new THREE.Mesh(new THREE.BoxGeometry(8,24,.8),dm);d.position.set(-s*4,12,0);d.castShadow=true;p.add(d);
  for(let i=0;i<12;i++){const st=new THREE.Mesh(new THREE.SphereGeometry(.28,8,6),new THREE.MeshStandardMaterial({color:0xd9a425,metalness:1,roughness:.3}));st.position.set(-s*(1+(i%3)*3),3+Math.floor(i/3)*5.5,.45);p.add(st)}D.add(p);return p});
 const dark=new THREE.Mesh(new THREE.PlaneGeometry(16,24),new THREE.MeshBasicMaterial({color:0x120804}));dark.position.set(0,12,.6);D.add(dark);
 [-1,1].forEach(s=>{const ban=new THREE.Mesh(new THREE.PlaneGeometry(6,16),new THREE.MeshStandardMaterial({color:0x7a1010,roughness:.8,side:THREE.DoubleSide}));ban.position.set(s*17,18,1.2);D.add(ban);
  const coin=new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.2,.3,24),new THREE.MeshStandardMaterial({color:0xffc83a,metalness:1,roughness:.28,emissive:0x3a2400}));coin.rotation.x=Math.PI/2;coin.position.set(s*17,20,1.45);D.add(coin)});
 G.add(D);W4.door=D;W4.doorZ=TZ+TR+.5;
 // a sign: 100 floors
 const sg=signMesh('DA NAG DOUBLOON\'S TOWER','100 FLOORS · NO REFUNDS');sg.position.set(-26,outsideH(-26,TZ+TR+14),TZ+TR+14);sg.rotation.y=.35;G.add(sg);
 // clouds around the top
 const cm=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.75,depthWrite:false,fog:false});for(let i=0;i<26;i++){const c=new THREE.Mesh(new THREE.SphereGeometry(30+Math.random()*30,10,8),cm);const a=Math.random()*6.283,r=TR+40+Math.random()*120;c.position.set(Math.sin(a)*r,560+Math.random()*300,TZ+Math.cos(a)*r);c.scale.y=.45;G.add(c)}
 G.traverse(o=>o.layers.set(1));
 // where you stand: on the plaza, facing the door
 W4.cp={x:0,z:30};placePlayers(0,30,Math.PI*0);camYaw=0;camPitch=.18;
 // the host of the place: Da Nag Dabloon at his door
 W4.npcs=[];const own=saveLoad().owner;W4.owner=own||W4.owner;const npc=npcMake('doubloon',0,TZ+TR+16,0,own?'Da Nag Dabloon (your butler)':'Da Nag Dabloon',own?ownerLines(own):greetLines());W4.greeter=npc;if(own&&!W4.revealT)setTimeout(()=>{try{statueRise();W4.cine=false;W4.statueK=1}catch(e){}},50);W4.towerC={x:0,z:TZ,r:TR*1.06+2};
 W4.hud();toast('Da Nag Dabloon\'s Tower');}
function signMesh(t1,t2){const c=cvs(512);c.height=256;const g=c.getContext('2d');g.fillStyle='#3a2414';g.fillRect(0,0,512,256);g.strokeStyle='#d9a425';g.lineWidth=10;g.strokeRect(8,8,496,240);
 g.fillStyle='#ffd27a';g.font='900 44px Impact,system-ui';g.textAlign='center';g.fillText(t1,256,108);g.font='800 30px system-ui';g.fillStyle='#f2e2c8';g.fillText(t2,256,170);
 const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;const G=new THREE.Group();const b=new THREE.Mesh(new THREE.PlaneGeometry(16,8),new THREE.MeshStandardMaterial({map:t,roughness:.7}));b.position.y=9;G.add(b);
 const back=new THREE.Mesh(new THREE.BoxGeometry(16.6,8.6,.5),woodMat());back.position.set(0,9,-.3);G.add(back);[-6,6].forEach(x=>{const p=new THREE.Mesh(new THREE.BoxGeometry(.7,9,.7),woodMat());p.position.set(x,4.5,-.3);G.add(p)});return G}
// everyone to a spot (you; and online, the others line up beside you on their own screens as the snapshot moves them)
function placePlayers(x,z,yaw){const side=MP.on&&MP.client?3.5:-3.5;heroPos.set(x+(MP.on?side:0),0,z);try{jH=0;jV=0;jumps=0;flyY=heightAt(heroPos.x,heroPos.z)}catch(e){}
 hero.position.set(heroPos.x,heightAt(heroPos.x,heroPos.z)+.15,heroPos.z);heroYaw=Math.PI+(yaw||0);hero.rotation.y=heroYaw;hero.visible=true;hero.rotation.x=0}
// ---- a floor: build it for everyone, place everyone at its landing, its enemies (the host spawns them; the snapshot shows them)
W4.goFloor=function(n,fromNet,o){o=o||{};if(MP.on&&MP.client&&!fromNet)return;if(W4.busy)return;W4.busy=true;
 if(MP.on&&!fromNet)mpQueue({k:'w4fl',f:n,s:W4.seed});
 curtain(true,350,()=>{try{loadFloor(n)}catch(e){console.error('tower floor '+n,e)}W4.busy=false;curtain(false,600);banner(n)})};
function loadFloor(n){W4.loadT=clk.getElapsedTime();W4.lockSaid=0;if(n>=100){loadTop();saveNow();return}W4.top100=false;W4.gx=[];clearWorld();W4.out=false;W4.fl=n;W4.gate=false;W4.gateK=0;W4.drops.forEach(d=>{if(d.g&&d.g.parent)d.g.parent.remove(d.g)});W4.drops=[];W4.npcs=[];W4.guardI=-1;W4.t0=clk.getElapsedTime();W4.tOff=0;
 const F=genFloor(n,W4.seed);buildGrid(F);W4.F=F;heightAt=towerH;PLAYR=600;MAPSIZE=320;cam.far=2600;cam.updateProjectionMatrix();towerAir(F.th,false);
 const G=buildFloor(F);world.add(G);W4.G=G;
 const e=F.entry;W4.cp={x:(e.x0+e.x1)/2,z:(e.z0+e.z1)/2+4};placePlayers(W4.cp.x,W4.cp.z,0);camYaw=0;camPitch=.32;
 // the market stand on every landing, its keeper behind the counter; the floor's own people
 marketBuild(F);floorPeople(F);floorSpecial(F);radio(n);try{questGen(F)}catch(e){console.warn('tower quest',e)}
 W4.keyOk=false;W4.dial=null;try{dialShow()}catch(e){}if(!MP.on||!MP.client){spawnFloor(F);try{questDrops(F);keyDrop(F)}catch(e){console.warn('tower quest drops',e)}}try{floorRestore(F)}catch(e){console.warn('tower restore',e)}
 W4.bag.forEach((s,i)=>{if(s&&IT[s.it]&&IT[s.it].q)W4.bag[i]=null});   // (lost things from another floor go back to their owner)
 W4.best=Math.max(W4.best|0,n);saveNow();W4.hud();try{updateHUD()}catch(e){}}
function banner(n){const F=W4.F;let b=$('w4ban');if(!b){b=document.createElement('div');b.id='w4ban';document.body.appendChild(b)}
 b.innerHTML='<div class="fn">FLOOR '+n+'</div><div class="nm">'+(F?F.name:'')+'</div>';b.classList.remove('show');void b.offsetWidth;b.classList.add('show');setTimeout(()=>b.classList.remove('show'),3200)}
// the floor's enemies: groups on the plazas and bridges, tougher the higher you climb; the guardian holds the gate
function spawnFloor(F){const n=F.n,hpK=(1+.09*(n-1))*(MP.on?1.3:1),dmK=1+.035*(n-1);
 if(F.rest){W4.guardI=-1;W4.gx=[];W4.gate=true;try{updateHUD()}catch(e){}return}   // the Halfway House: nobody to fight, the gate stands open
 const put=(kind,x,z)=>{const e=l2AddHorde(kind);L2.hordeN=Math.max(0,(L2.hordeN|0)-1);e.x=e.hx=x;e.z=e.hz=z;e.g.position.set(x,towerH(x,z),z);e.mhp=Math.round(e.mhp*hpK);e.hp=e.mhp;e.dmg*=dmK;e.w4=1;e.state='wander';return e};
 F.G.forEach((g,gi)=>{const p=F.P[g.pi];const r=srand(F.seed+n*31+gi*7);const at=()=>{if(g.cx==null)return [lerp(p.x0+2,p.x1-2,r()),lerp(p.z0+2,p.z1-2,r())];for(let k=0;k<14;k++){const a=r()*6.283,d=Math.sqrt(r())*g.r;const x=Math.max(p.x0+2,Math.min(p.x1-2,g.cx+Math.cos(a)*d)),z=Math.max(p.z0+2,Math.min(p.z1-2,g.cz+Math.sin(a)*d));if(k===13||Math.abs(towerH(x,z)-p.top)<.3)return [x,z]}};   // (on open ground: never on a stall, a wall or a boulder)   // (a wide floor's camps keep together round their fire)
  for(let i=0;i<g.n;i++){const kind=g.kinds[(i+gi)%g.kinds.length];let [x,z]=at();for(let k=0;k<20&&(towerH(x,z)>p.top+.6||pzKeepOut(F,x,z));k++){[x,z]=at()}   // (never on a wall or a block, never in a vault or on a puzzle)
   const be=F.bombs?2:n>=2&&!F.swarm?5:0;if(be&&i%be===be-1&&bombs.length<(F.bombs?16:10))putBomb(x,z,hpK);else put(kind,x,z)}});   // bombs on every floor from the second (every other one on the basement floors)
 // the side landings' loot: coins, a potion, now and then a feather (the host drops them; the snapshot shows them to everyone)
 if(F.wide&&typeof wideCoins==='function')wideCoins(F);   // (a wide floor's coin trails)
 F.P.filter(q=>q.loot).forEach((q,i)=>{const cx=(q.x0+q.x1)/2,cz=(q.z0+q.z1)/2,r=srand(F.seed+n*53+i*11);try{dropAdd('coin',10+n,cx-2.2,cz+.5);dropAdd('coin',10+n,cx+2.2,cz-.5);dropAdd(r()<.6?'hp':'mp',1,cx,cz-2.4);if(n>=8&&r()<.3)dropAdd('feather',1,cx,cz+2.4)}catch(e){}});
 const ex=F.exit;const ge=put(F.guard,(ex.x0+ex.x1)/2,(ex.z0+ex.z1)/2+4);ge.mhp=Math.round(ge.mhp*(F.skin?11:7));ge.hp=ge.mhp;ge.dmg*=F.skin?1.8:1.5;ge.reach=(ge.reach||3)*1.5*(F.big?F.big/1.6:1);ge.w4g=1;W4.guardI=enemies.indexOf(ge);guardLook(ge);if(F.skin)skinOn(ge,F.skin);
 // a boss floor can hold the gate with several at once (they all have to fall)
 W4.gx=[];(F.extra||[]).forEach(([kind,skin,name],i)=>{const a=i*2.1+.6,x=(ex.x0+ex.x1)/2+Math.sin(a)*10,z=(ex.z0+ex.z1)/2+4+Math.cos(a)*8;const e=put(kind,x,z);e.mhp=Math.round(e.mhp*(F.nag?6:9));e.hp=e.mhp;e.dmg*=1.6;e.reach=(e.reach||3)*1.5;e.w4g=1;const k=enemies.indexOf(e);W4.gx.push([k,skin,name]);guardLook(e,name);skinOn(e,skin)});
 try{updateHUD()}catch(e){}}
function guardLook(e,name){if(!e||!e.g)return;e.g.scale.setScalar(!name&&W4.F&&W4.F.big||1.6);e.isGuard=true;if(e.hpBar)e.hpBar.scale.set(2.2,2.2,2.2);const F=W4.F;if(F&&!e.gtag){const tg=nameTag(name||F.gname||('Guardian of Floor '+F.n));tg.position.y=(e.hpBar?e.hpBar.position.y:5)+1.2;tg.layers.set(1);e.g.add(tg);e.gtag=tg}}
// ---- every frame
W4.tick=function(t,dt){if(!W4.on)return;try{
 const F=W4.F;
 // a Phoenix Feather in your bag: you rise where you fell, full health (one feather a time)
 if(deadT>0&&!W4.out){const i=W4.bag.findIndex(s=>s&&s.it==='feather');if(i>=0){bagTake(i,1);deadT=0;playerHP=maxHP();hero.rotation.x=0;hero.visible=true;featherFx(heroPos.x,hero.position.y,heroPos.z);try{mpFx('w4p',[R1(heroPos.x),R1(hero.position.y),R1(heroPos.z)])}catch(e){}
  toast('🪶 The Phoenix Feather burns up... and you rise!');saveNow();try{updateHUD()}catch(e){}W4.hud()}}
 if(F){const ft=floorClock();
  // the movers, and you riding one
  F.M.forEach((m,i)=>{const p=moverPos(m,ft),g=F.mv[i];if(!g)return;const ox=g.position.x,oz=g.position.z;g.position.set(p.x,p.y,p.z);
   if(Math.abs(heroPos.x-p.x)<=m.w/2&&Math.abs(heroPos.z-p.z)<=m.d/2&&Math.abs(hero.position.y-.15-p.y)<1.2&&jH<=0){heroPos.x+=p.x-ox;heroPos.z+=p.z-oz}});
  if(F.torch&&frame%2===0){const T=F.torch,M=SWM.M,P=SWM.P,Q=SWM.Q,SC=SWM.SC,E=SWM.E;for(let i=0;i<T.items.length;i++){const it=T.items[i],k=1+Math.sin(t*13+i*1.7)*.12+Math.sin(t*7.3+i)*.08;P.set(it[0],it[1],it[2]);E.set(0,it[3],0);Q.setFromEuler(E);SC.set(k,1+Math.sin(t*11+i*2.1)*.18,k);M.compose(P,Q,SC);T.im.forEach(im=>im.setMatrixAt(i,M))}T.im.forEach(im=>{im.instanceMatrix.needsUpdate=true})}
  if(F.abyss)F.abyss.material.opacity=.45+Math.sin(t*.7)*.1;
  // your last safe landing
  const gy=towerH(heroPos.x,heroPos.z);if(jH<=0&&deadT<=0){for(const p of F.P){if(p.cp&&heroPos.x>=p.x0&&heroPos.x<=p.x1&&heroPos.z>=p.z0&&heroPos.z<=p.z1&&Math.abs(gy-p.top)<.5){W4.cp={x:heroPos.x,z:heroPos.z};break}}}
  // a fall into the abyss: back to your last safe landing, a little hurt
  if(hero.position.y<BASEH-26&&deadT<=0){const cp=W4.cp||{x:X0,z:10};heroPos.set(cp.x,0,cp.z);jH=0;jV=0;jumps=0;try{flyY=towerH(cp.x,cp.z)}catch(e){}hero.position.y=towerH(cp.x,cp.z)+.15;
   try{hurtPlayer(Math.max(1,Math.round(maxHP()*.12)))}catch(e){}floatText(heroPos.x,hero.position.y+4,heroPos.z,'WHOA!','#ffd27a',2.6);try{curtain(true,120,()=>curtain(false,300))}catch(e){}}
  // the guardian falls: the gate rises (the host decides; the snapshot tells everyone)
  if(!MP.client&&!W4.gate&&W4.guardI>=0){const g=enemies[W4.guardI];if((!g||g.hp<=0)&&(W4.gx||[]).every(([k])=>!enemies[k]||enemies[k].hp<=0)){if(F.lock&&!keyGot()){if(!W4.lockSaid){W4.lockSaid=1;try{bossYell('THE GATE IS LOCKED',keyWhere(F)+(F.back?' (Or find the back stairs.)':''))}catch(e){}W4.hud()}}else{W4.gate=true;gateOpenFx();if(g&&F.skin==='jk'){try{dropAdd('key',1,g.x,g.z)}catch(e){}}}}}
  if(!MP.client&&F.lock&&!W4.keyOk&&frame%15===0&&keyGot()){try{bossYell('THE GATE KEY','You have it. The gate will open when the guardian falls.')}catch(e){}W4.hud()}
  if(W4.gate&&F.bars){W4.gateK=Math.min(1,(W4.gateK||0)+dt*.6);F.bars.position.y=W4.gateK*(F.gate.h+1)}
  // through the gate: up to the next floor
  if(W4.gate&&W4.gateK>.6&&deadT<=0&&!W4.busy){const g=F.gate;if(Math.abs(heroPos.x-g.x)<g.w/2&&heroPos.z<g.z+1.6&&heroPos.z>g.z-6&&Math.abs(hero.position.y-.15-g.top)<3){
   if(!MP.on||!MP.client){if(F.n>=100)W4.top();else W4.goFloor(F.n+1)}else if(t-(W4.nxT||0)>1){W4.nxT=t;mpQueue({k:'w4nx',f:F.n})}}}
  // the music: the climb, and the boss theme once you get near the guardian (until the gate opens); and the boss bar at the top (the whole team's health on a team floor)
  {const g=enemies[W4.guardI];const near=!!(g&&g.hp>0&&!W4.gate&&Math.hypot(heroPos.x-g.x,heroPos.z-g.z)<55);if(frame%20===0)try{musicW2(near||F.dress==='ballroom'?'boss':'run')}catch(e){}   // (DJ Crust only plays the one song)
   const bar=$('bossbar');if(bar){if(near){let hp=Math.max(0,g.hp),mx=Math.max(1,g.mhp||g.hp);(W4.gx||[]).forEach(([k])=>{const q=enemies[k];if(q){hp+=Math.max(0,q.hp);mx+=Math.max(1,q.mhp||q.hp)}});
     if(bar.style.display!=='block')bar.style.display='block';const nm=(F.gname||('Guardian of Floor '+F.n)).toUpperCase()+((W4.gx||[]).length?' & FRIENDS':'');const bn=$('bossn');if(bn&&bn.textContent!==nm)bn.textContent=nm;const bf=$('bossf');if(bf)bf.style.width=Math.max(0,Math.min(100,hp/mx*100)).toFixed(1)+'%'}
    else if(W4.bbOn)bar.style.display='none';W4.bbOn=near}}
  // enemies who fell never come back on this floor
  if(!MP.client)enemies.forEach(e=>{if(e.w4&&e.hp>0&&towerH(e.x,e.z)<BASEH-24){e.hp=0;e.dead=t}})}
 else if(W4.out){// outside: the door opens once he has said his piece
  if(W4.doors&&W4.doorOpen){W4.doorK=Math.min(1,(W4.doorK||0)+dt*.5);W4.doors.forEach((d,i)=>{d.rotation.y=(i?-1:1)*W4.doorK*1.9})}
  if(W4.doorOpen&&W4.doorK>.5&&heroPos.z<W4.doorZ+3&&Math.abs(heroPos.x)<8&&!W4.busy){if(!MP.on||!MP.client)W4.goFloor(W4.startAt||1);else if(t-(W4.nxT||0)>1){W4.nxT=t;mpQueue({k:'w4nx',f:0})}}
  if(heroPos.z<W4.doorZ+1&&!(W4.doorOpen&&W4.doorK>.5)){heroPos.z=W4.doorZ+1}
  {const C=W4.towerC;if(C&&!(W4.doorOpen&&Math.abs(heroPos.x)<8)){const dx=heroPos.x-C.x,dz=heroPos.z-C.z,d=Math.hypot(dx,dz);if(d<C.r&&d>.01){heroPos.x=C.x+dx/d*C.r;heroPos.z=C.z+dz/d*C.r}}}}
 if(W4.top100||W4.statue){topTick(t,dt);if(W4.top100&&hero.position.y<BASEH-26&&deadT<=0){heroPos.set(X0,0,-6);jH=0;jV=0;jumps=0;hero.position.y=BASEH+.15}}
 npcTick(t,dt);dropsTick(t,dt);manaTick(t,dt);skinsTick(t,dt);nagTick(t,dt);try{bigTick(t,dt)}catch(e){if(!W4.bgErr){W4.bgErr=1;console.error('tower big move',e)}}try{questTick(t,dt)}catch(e){if(!W4.qErr){W4.qErr=1;console.error('tower quest',e)}}try{chestTick(t,dt)}catch(e){}try{doorsTick(t,dt);puzzleTick(t,dt)}catch(e){if(!W4.pzErr){W4.pzErr=1;console.error('tower puzzle',e)}}bombBossTick(t,dt);if(W4.F)swarmTick(t,dt);try{floorLookTick(t,dt)}catch(e){}try{aliveTick(t,dt)}catch(e){}try{itWarm()}catch(e){if(!W4.icErr){W4.icErr=1;console.error('tower item pictures',e)}}
 if(frame%10===0)W4.hud()}catch(e){if(!W4.errT||t-W4.errT>5){W4.errT=t;console.error('tower tick',e)}}};
function gateOpenFx(){try{bossYell('THE GATE IS OPEN','The guardian fell. Up you go!');const g=W4.F.gate;floatText(g.x,g.top+14,g.z,'GATE OPEN','#ffe08a',3.2);shake=Math.max(shake,.6)}catch(e){}}
// dying in the tower: you wake on your last safe landing, a little poorer (no lives lost: the tower is long)
W4.respawn=function(){const cp=W4.cp||{x:X0,z:10};heroPos.set(cp.x,0,cp.z);jH=0;jV=0;jumps=0;hero.visible=true;hero.rotation.x=0;playerHP=maxHP();
 const lost=Math.floor((W4.coins|0)*.1);if(lost>0){W4.coins-=lost;toast('Back on your feet. The tower took '+lost+' doubloons for the trouble.')}else toast('Back on your feet.');saveNow();W4.hud()};
W4.top=function(){W4.goFloor(100)};
// ---- online: what the host tells everyone, many times a second
W4.snap=function(){if(!W4.on)return null;return {f:W4.out?0:W4.fl,s:W4.seed,t:R2(W4.F?floorClock():0),g:W4.gate?1:0,gi:W4.guardI,d:W4.drops.map(d=>[d.id,d.it,d.n,R1(d.x),R1(d.z),d.to||0,d.by||0]),o:W4.doorOpen?1:0,st:W4.startAt||1,gk:W4.F&&W4.F.skin||'',gx:W4.gx||[],np:(W4.npcs||[]).map(n=>n.rove?[R2(n.rove.th),R2(n.rove.ct),R2(n.rove.spd),R1(n.rove.wa),n.rove.dir]:0),q:W4.q?[W4.q.done|0,W4.q.yelled?1:0]:0,lk:W4.F&&W4.F.lock?(W4.keyOk?2:1):0,sd:W4.F&&W4.F.doors?W4.F.doors.map(d=>d.open?1:0).join(''):'',pz:pzSnap(),ch:W4.F&&W4.F.chests?W4.F.chests.map(c=>c.open?1:0):0}};
W4.applySnap=function(o){if(!o||!W4.on||W4.busy)return;if(o.s&&o.s!==W4.seed)W4.seed=o.s;
 const want=o.f|0,cur=W4.out?0:W4.fl;if(want!==cur){if(want===0){}else{if(want>=100&&W4.top100)return;if(want<cur&&clk.getElapsedTime()-(W4.loadT||-9)<3)return;   // (a snapshot from before the host's own change arriving after ours: not a trip back down)
   W4.busy=true;curtain(true,250,()=>{try{loadFloor(want)}catch(e){console.error('tower floor',e)}W4.busy=false;curtain(false,500);banner(want)})}return}
 if(W4.F){const lt=floorClock();const d=(+o.t||0)-lt;if(Math.abs(d)>.03)W4.tOff+=Math.abs(d)>2?d:d*.2}
 if(o.g&&!W4.gate){W4.gate=true;gateOpenFx()}
 if(o.gi!==W4.guardI)W4.guardI=o.gi;if(o.gi>=0){const e=enemies[o.gi];if(e){if(!e.isGuard)guardLook(e);if(o.gk&&e.skin!==o.gk)skinOn(e,o.gk)}}
 W4.gx=o.gx||[];W4.gx.forEach(([k,skin,name])=>{const e=enemies[k];if(e){if(!e.isGuard)guardLook(e,name);if(skin&&e.skin!==skin)skinOn(e,skin)}});
 if(Array.isArray(o.np))o.np.forEach((a,i)=>{const n=W4.npcs[i];if(!n||!n.rove||!Array.isArray(a))return;const R=n.rove;let d=(+a[0]||0)-R.th;d=Math.atan2(Math.sin(d),Math.cos(d));R.th+=Math.abs(d)>.6?d:d*.25;R.ct=+a[1]||0;R.spd=+a[2]||0;const w=+a[3]||0;if(Math.abs(w-R.wa)>2){R.wa=w;R.ca=w}R.dir=a[4]<0?-1:1});   // Pete rolls where the host's Pete rolls
 if(o.lk===2&&!W4.keyOk){W4.keyOk=true;W4.hud()}
 if(W4.F&&W4.F.doors&&typeof o.sd==='string')o.sd.split('').forEach((v,i)=>{const D=W4.F.doors[i];if(D&&v==='1'&&!D.open)doorOpen(D,clk.getElapsedTime()-(W4.loadT||0)<3)});if(o.pz)try{pzApply(o.pz)}catch(e){}
 if(W4.F&&W4.F.chests&&Array.isArray(o.ch))o.ch.forEach((v,i)=>{const c=W4.F.chests[i];if(c&&v&&!c.open)MPFX_DO.w4ch(null,[i],0)});
 if(W4.q&&Array.isArray(o.q)){const d=o.q[0]|0;if(d!==W4.q.done){W4.q.done=d;W4.hud()}if(o.q[1]&&!W4.q.yelled)questDone()}
 if(o.o&&!W4.doorOpen){W4.doorOpen=true}W4.startAt=o.st||1;
 dropsSync(o.d||[])};
W4.ev=function(ev,p){const host=!MP.on||!MP.client;
 if(ev.k==='w4go'){if(!W4.on)W4.enter(true,{seed:ev.s})}
 else if(ev.k==='w4fl'){if(!W4.on){W4.seed=ev.s;W4.on=true;L2.on=true;L2.phase='w4';bagInit()}if(ev.s)W4.seed=ev.s;if(W4.fl!==ev.f||W4.out)W4.goFloor(ev.f|0,true)}
 else if(ev.k==='w4nx'&&host&&W4.on){if(W4.out){if(W4.doorOpen)W4.goFloor(W4.startAt||1)}else if(W4.F&&(ev.f|0)===W4.F.n&&W4.gate){if(W4.F.n>=100)W4.top();else W4.goFloor(W4.F.n+1)}}
 else if(ev.k==='w4dr'&&host&&W4.on){dropAdd(ev.it,ev.n|0,+ev.x||0,+ev.z||0,{to:ev.to||0,by:(p&&p.peer)||0})}
 else if(ev.k==='w4tk'&&host&&W4.on){dropRemove(ev.id|0)}
 else if(ev.k==='w4dor'&&W4.on){W4.doorOpen=true;W4.startAt=ev.st||1}
 else if(ev.k==='w4qd'&&host&&W4.q&&W4.q.k==='find'&&!W4.q.done){W4.q.done=1;questDone()}
 else if(ev.k==='w4do'&&host&&W4.F&&W4.F.doors){const D=W4.F.doors[ev.i|0];if(D&&!D.open&&(!D.v||(W4.F.puz&&String(ev.c)===W4.F.puz.code.join('')))){doorOpen(D);try{mpFx('w4sd',[D.i])}catch(e){}if(D.v)try{puzzleSolved('lock')}catch(e){}}}
 else if(ev.k==='w4lt'&&host&&W4.on)lanternTouch(ev.i|0);
 else if(ev.k==='w4bu'&&host&&W4.on)bustTurn(ev.i|0);
 else if(ev.k==='w4bz'&&host&&W4.on)brazLight(ev.i|0);
 else if(ev.k==='w4ch'&&host&&W4.F&&W4.F.chests){const c=W4.F.chests[ev.i|0];if(c&&!c.open){chestOpen(c,true);try{mpFx('w4ch',[c.i])}catch(e){}}}};
W4.pres=function(){return {f:W4.fl,c:W4.coins|0,b:Math.max(1,saveLoad().best|0)}};
// ---- hooks into the game (once): a revive never happens in the tower, kills pay doubloons, deaths cost coins not lives, the F key talks
(function(){const ht=hordeTick;hordeTick=function(e,t,dt){if(!W4.on)return ht(e,t,dt);if(MP.client&&e.hp>(e.mhp||0))e.mhp=e.hp;   // a guest only hears the health: a boss's full health is the most it has seen
  // every swing shows (the arc, the dust, the smoke: swingShow), on the host as it happens and on a guest as the snapshot brings it
  if(e.swing!==e.swShown){const first=e.swShown===undefined;e.swShown=e.swing;if(!first&&e.hp>0&&e.swing>0&&t-e.swing<.6&&typeof swingShow==='function')try{swingShow(e,t)}catch(_){}}
  if(W4.F&&W4.F.dark&&!e.eyes&&e.g&&e.kind!=='stink'){try{e.eyes=[];const y=(e.hpBar?e.hpBar.position.y:4.6)-1.5;[-.32,.32].forEach(x=>{const sp=new THREE.Sprite(AL.eyeM||(AL.eyeM=new THREE.SpriteMaterial({map:TEX.glare,color:0xff3020,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false})));sp.scale.set(.55,.55,1);sp.position.set(x,y,.55);sp.layers.set(1);sp.userData.noUber=true;e.g.add(sp);e.eyes.push(sp)})}catch(_){e.eyes=[]}}
  if(e.eyes&&e.eyes.length){const on=e.hp>0;if(e.eyes[0].visible!==on)e.eyes.forEach(q=>q.visible=on)}
  if(e.kind==='toast'&&!e.smk&&e.g){e.smk=1;let n=0;try{e.g.traverse(o=>{if(o.isSprite&&o.material&&o.material.color&&o.material.color.getHex()===0xc8c8c8&&(++n%3))o.visible=false})}catch(_){}}   // (the bread's blunt smokes five puffs up here, not fifteen: a floor full of bread drew eighty of them)
  if(e.hp<=0&&!e.qk){e.qk=1;try{questKill(e)}catch(_){}}   // (before the stinks go their own way: a stink hunt counts its stinks)
  if(e.kind==='stink')return stinkTick(e,t,dt);
  if(NG.st&&e.skin==='nagrock'&&e.hp>0&&e.g){e.g.position.set(e.x,h0(e),e.z);e.g.rotation.y=e.a;return}   // Nagrock in the middle of a move: the move moves him
  if(e.hp<=0&&t-e.dead>4.5){if(e.g&&e.g.visible)e.g.visible=false;return}
  // on a floor they keep to their own landing (no walking off into the abyss) and wake up when someone comes within thirty paces
  const px=e.x,pz=e.z,h0w=towerH(px,pz);let far=true;if(Math.hypot(heroPos.x-e.x,heroPos.z-e.z)<30||t-(e.w4hit||-9)<6)far=false;else for(const id in MP.players){const q=MP.players[id].st;if(q&&!q.dead&&Math.hypot(q.x-e.x,q.z-e.z)<30){far=false;break}}
  const hold=!!(BG.st&&e.isGuard&&!e.skin&&W4.F&&W4.F.big&&e===enemies[W4.guardI]);   // a big guardian in the middle of his move: his move places him
  const sp=e.spd;if((far||hold)&&!MP.client)e.spd=0;let r;try{r=ht(e,t,dt)}finally{e.spd=sp}
  if(hold&&!MP.client){e.x=px;e.z=pz;e.a=BG.st.a;if(e.g){e.g.position.set(px,h0(e),pz);e.g.rotation.y=e.a}}
  if(!MP.client&&e.hp>0&&!(t-e.block>=0&&t-e.block<1.25)){const hn=towerH(e.x,e.z);if(hn<h0w-2.4||hn>h0w+2.4){   // off the landing or into a wall: slide along it (one axis at a time), else stay
   const ax=towerH(e.x,pz),az=towerH(px,e.z);if(Math.abs(ax-h0w)<=2.4)e.z=pz;else if(Math.abs(az-h0w)<=2.4)e.x=px;else{e.x=px;e.z=pz}if(e.g)e.g.position.set(e.x,towerH(e.x,e.z),e.z)}}return r};
 const kl=l2Kill;l2Kill=function(x,z,xpv){kl(x,z,xpv);if(W4.on&&!MP.client)try{killPay(x,z,xpv)}catch(e){}};
 const ll=livesLose;livesLose=function(){if(W4.on){toast('You got wrecked. Back to your last landing…');return}return ll()};
 const da=doAction;doAction=function(a){if(W4.on&&(a==='openDoor'||a==='door')){if(W4.interact())return}if(W4.on&&a==='inventory'){bagToggle();return}return da(a)};
 const uh=updateHUD;updateHUD=function(){uh();if(W4.on){const k=$('kills');if(k){const n=enemies.filter(x=>x.hp>0).length;k.textContent=W4.out?'Da Nag Dabloon\'s Tower':('Floor '+W4.fl+' · '+(n?n+(n===1?' enemy':' enemies')+' left':'clear!'))}}}})();

// nothing stands inside a vault or on a puzzle
function pzKeepOut(F,x,z){if(F&&F.P&&F.wide&&F.P.some(q=>q.sealedR&&Math.abs(x-q.sealedR[0])<q.sealedR[2]+1&&Math.abs(z-q.sealedR[1])<q.sealedR[2]+1))return true;if(F&&F.P){const m=F.P.find(q=>q.sealed);if(m){const i=m.sealed[0],j=m.sealed[1],x0=m.x0+m.wt+i*m.cs,z0=m.z0+m.wt+j*m.cs;if(x>x0-1&&x<x0+m.cs&&z>z0-1&&z<z0+m.cs)return true}}const P=F&&F.puz;if(!P)return false;if(P.keep){const K=P.keep;return x>K.x0-1&&x<K.x1+1&&z>K.z0-1&&z<K.z1+2.5}if(P.braz&&P.braz.some(q=>Math.hypot(x-q.x,z-q.z)<2.5))return true;return Math.hypot(x-P.x,z-P.z)<9}
// ---------------------------------------------------------------- money, things on the ground, your bag, the market, mana and its moves
// Doubloons drop from everything you beat; health and mana potions, weapons and gear go in your bag (12 slots, the market sells bigger
// bags). Drop anything from the bag, or give it to your friend (it lands at their feet, theirs for a few seconds): both screens show every
// drop. Weapons in your bag are the ones in your weapon wheel.
const IT={coin:{n:'Doubloons',i:'🪙'},hp:{n:'Health Potion',i:'🧪',d:'Heals half your health.',st:10,use:()=>heal(.5)},hp2:{n:'Big Health Potion',i:'❤️‍🔥',d:'Heals you all the way.',st:5,use:()=>heal(1)},
 mp:{n:'Mana Potion',i:'🔷',d:'Fills your mana.',st:10,use:()=>{W4.mana=W4.manaMax;floatText(heroPos.x,hero.position.y+4,heroPos.z,'MANA!','#7ad0ff',2.4);return true}},
 pick:{n:'Afro Pick',i:'💈',d:'Melee. Out of the afro and into somebody\'s face: wide swings, 2.4x your punch.',w:'pick'},
 axe:{n:'Golden Axe',i:'🪓',d:'Melee. The Dabloon\'s own axe. Slow, huge: 3.6x your punch, long reach.',w:'axe'},
 boombox:{n:'Gold Boombox',i:'🔊',d:'Rainbow sound blast.',w:'boombox'},launcher:{n:'Watermelon Launcher',i:'🍉',d:'Lobs whole melons.',w:'launcher'},ak:{n:'AK-47',i:'🔫',d:'Never stops firing.',w:'ak'},
 feather:{n:'Phoenix Feather',i:'🪶',d:'Brings you back where you fell, once, full health. (Used up when you go down.)',st:3},
 key:{n:'Brigade Key',i:'🗝️',d:'A gold key on a chain. Somebody upstairs wants it.',st:1}};
W4.bag=W4.bag||[];
function bagSize(){return 12+4*(W4.up.bag|0)}
function bagFit(){if(!Array.isArray(W4.bag))W4.bag=[];while(W4.bag.length<bagSize())W4.bag.push(null)}
function bagInit(){bagFit();
 if(!W4.bag.some(s=>s)){['ak','launcher','boombox'].forEach(w=>{if(inv.items[w])bagPut(w,1)});if(inv.items.pick)bagPut('pick',1);bagPut('hp',2)}
 bagSync()}
function bagCount(it){return W4.bag.reduce((a,s)=>a+(s&&s.it===it?s.n:0),0)}
function bagPut(it,n){const D=IT[it];if(!D)return 0;let left=n|0;if(D.st){for(const s of W4.bag){if(left<=0)break;if(s&&s.it===it&&s.n<D.st){const k=Math.min(D.st-s.n,left);s.n+=k;left-=k}}}
 for(let i=0;i<W4.bag.length&&left>0;i++){if(!W4.bag[i]){const k=D.st?Math.min(D.st,left):1;W4.bag[i]={it,n:k};left-=k}}bagSync();return (n|0)-left}
function bagTake(i,n){const s=W4.bag[i];if(!s)return null;const k=Math.min(s.n,n||s.n);s.n-=k;if(s.n<=0)W4.bag[i]=null;bagSync();return {it:s.it,n:k}}
function bagFree(it){const D=IT[it];if(D&&D.st&&W4.bag.some(s=>s&&s.it===it&&s.n<D.st))return true;return W4.bag.some(s=>!s)}
// weapons in the bag are the weapons in your wheel (and the one in your hands goes back to fists if you let it go)
function bagSync(){if(!W4.on)return;['ak','launcher','boombox'].forEach(w=>{if(bagCount(w))inv.items[w]=1;else delete inv.items[w]});inv.items.pick=bagCount('pick')||bagCount('axe')||bagCount('scythe')?1:0;if(!inv.items.pick)delete inv.items.pick;
 try{const cur=charApi&&charApi.weapon();if(cur&&cur!=='fists'&&!inv.items[cur]){charApi.equip('fists')}}catch(e){}
 if(W4.melee&&!bagCount(W4.melee))W4.melee=null;if(W4.bagOpen)bagRender();saveSoon()}
let saveT=0;function saveSoon(){clearTimeout(saveT);saveT=setTimeout(saveNow,600)}
function heal(k){const mh=maxHP();if(playerHP>=mh){toast('Already at full health.');return false}playerHP=Math.min(mh,playerHP+Math.round(mh*k));updateHUD();floatText(heroPos.x,hero.position.y+4,heroPos.z,'+HEALTH','#7aff9a',2.4);try{mpFx('w4g',[R1(heroPos.x),R1(hero.position.y),R1(heroPos.z)])}catch(e){}return true}
// ---- things on the ground (the host keeps the list; everyone draws it)
const DRG={coin:null};
function dropMesh(it,n){const g=new THREE.Group();if(it==='coin'){if(!DRG.coin){DRG.coin=new THREE.CylinderGeometry(.55,.55,.14,18);DRG.coin.rotateX(Math.PI/2);DRG.cm=new THREE.MeshStandardMaterial({color:0xffc83a,metalness:1,roughness:.28,emissive:0x4a3000})}
  const k=Math.min(4,1+Math.floor((n||1)/6));for(let i=0;i<k;i++){const c=new THREE.Mesh(DRG.coin,DRG.cm);c.position.set((i%2)*.5-.25,1+i*.3,(i>1?.3:0));g.add(c)}}
 else{const sp=new THREE.Sprite(emojiMat(IT[it]?IT[it].i:'❔'));sp.scale.set(2,2,1);sp.position.y=1.5;g.add(sp)}
 const ring=new THREE.Mesh(new THREE.RingGeometry(.8,1.15,24),new THREE.MeshBasicMaterial({color:it==='coin'?0xffd040:0x9fe4ff,transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending}));ring.rotation.x=-Math.PI/2;ring.position.y=.06;g.add(ring);
 g.traverse(o=>o.layers.set(1));return g}
const EMC={};function emojiMat(ch){if(EMC[ch])return EMC[ch];const c=cvs(128),g=c.getContext('2d');g.font='96px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(ch,64,70);
 const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return EMC[ch]=new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false})}
function dropAdd(it,n,x,z,o){if(!IT[it]||n<=0)return null;const d=Object.assign({id:++W4.dropN+(MP.on&&MP.client?5e5:0),it,n,x,z,t:clk.getElapsedTime()},o||{});d.g=dropMesh(it,n);d.g.position.set(x,towerHere(x,z),z);world.add(d.g);W4.drops.push(d);return d}
function towerHere(x,z){return heightAt(x,z)}
function dropRemove(id){const i=W4.drops.findIndex(d=>d.id===id);if(i<0)return;const d=W4.drops[i];if(d.g&&d.g.parent)d.g.parent.remove(d.g);W4.drops.splice(i,1)}
function dropsSync(list){const want=new Set();list.forEach(a=>{const id=a[0]|0;want.add(id);if(W4.taken&&W4.taken.has(id))return;if(!W4.drops.some(d=>d.id===id)){const d={id,it:a[1],n:a[2]|0,x:+a[3],z:+a[4],t:clk.getElapsedTime(),net:1,to:a[5]||0,by:a[6]||0,mine:!!(a[6]&&MP.me&&a[6]===MP.me)};d.g=dropMesh(d.it,d.n);d.g.position.set(d.x,towerHere(d.x,d.z),d.z);world.add(d.g);W4.drops.push(d)}});
 for(let i=W4.drops.length-1;i>=0;i--){const d=W4.drops[i];if(!want.has(d.id)){if(d.g&&d.g.parent)d.g.parent.remove(d.g);W4.drops.splice(i,1)}}}
// walking over a drop picks it up (your own drops wait three seconds; a gift is the friend's for eight)
function dropsTick(t,dt){const me=MP.on?MP.me:null;for(let i=W4.drops.length-1;i>=0;i--){const d=W4.drops[i];if(!d.g)continue;d.g.rotation.y+=dt*2.2;
  if(d.pop){const k=Math.min(1,(t-d.pop[3])/.55);const gy=towerHere(d.x,d.z);d.g.position.set(lerp(d.pop[0],d.x,k),lerp(d.pop[1],gy,k)+Math.sin(k*Math.PI)*2.6,lerp(d.pop[2],d.z,k));if(k>=1)d.pop=null;continue}   // flying out of a chest
  d.g.position.y=towerHere(d.x,d.z)+Math.sin(t*3+d.id)*.12;if(d.hold&&t<d.hold)continue;
  if(deadT>0)continue;const dist=Math.hypot(heroPos.x-d.x,heroPos.z-d.z);if(dist>2.4||Math.abs(hero.position.y-d.g.position.y)>4)continue;
  if(d.mine&&t-d.t<3)continue;if(d.to&&d.to!==me&&t-d.t<8)continue;
  if(d.it==='coin'){W4.coins+=d.n;coinFx(d.n)}else{const got=bagPut(d.it,d.n);if(got<=0){if(t-(W4.fullT||0)>3){W4.fullT=t;toast('Your bag is full.')}continue}if(got<d.n){d.n-=got;continue}toast('Got: '+IT[d.it].i+' '+IT[d.it].n+(d.n>1?' x'+d.n:''))}
  if(d.g.parent)d.g.parent.remove(d.g);W4.drops.splice(i,1);(W4.taken||(W4.taken=new Set())).add(d.id);if(MP.on&&MP.client)mpQueue({k:'w4tk',id:d.id});saveSoon();W4.hud()}}
function coinFx(n){floatText(heroPos.x,hero.position.y+3.6,heroPos.z,'+'+n+' 🪙','#ffd040',2.2);try{dblChing(heroPos.x,heroPos.z,.35,1.2,1)}catch(e){}}
// a beaten enemy pays out (the host drops it; anyone can grab it): doubloons always, now and then a potion
function killPay(x,z,xpv){const n=W4.fl||1;if(xpv<=6&&Math.random()>.25)return;const amt=(2+Math.floor(n*.6)+((Math.random()*4)|0))*(W4.F&&W4.F.treasure?2:1);dropAdd('coin',amt,x+(Math.random()-.5)*2,z+(Math.random()-.5)*2);
 if(Math.random()<.08)dropAdd(Math.random()<.7?'hp':'mp',1,x+(Math.random()-.5)*2,z+(Math.random()-.5)*2);
 // the guardian pays big
 const g=enemies[W4.guardI];if(g&&g.hp<=0&&W4.gPaid!==W4.fl){W4.gPaid=W4.fl;for(let k=0;k<6;k++)dropAdd('coin',6+n,g.x+(Math.random()-.5)*6,g.z+(Math.random()-.5)*6);if(Math.random()<.5||n%5===0)dropAdd('hp2',1,g.x,g.z)}}
// dropping and giving from the bag
function bagDrop(i,toPeer){const s=W4.bag[i];if(!s)return;const taken=bagTake(i);if(!taken)return;let x=heroPos.x+Math.sin(heroYaw)*2.4,z=heroPos.z+Math.cos(heroYaw)*2.4,to=null;
 if(toPeer){const P=MP.players[toPeer];if(P&&P.st){x=P.st.x;z=P.st.z;to=toPeer}}
 if(towerHere(x,z)<BASEH-20){x=heroPos.x;z=heroPos.z}
 if(!MP.on||!MP.client){const d=dropAdd(taken.it,taken.n,x,z,{mine:!to,to:to||0,by:MP.on?MP.me:0});if(d)d.t=clk.getElapsedTime()}else mpQueue({k:'w4dr',it:taken.it,n:taken.n,x:R1(x),z:R1(z),to:to||0});
 toast(to?'Given: '+IT[taken.it].n:'Dropped: '+IT[taken.it].n);saveSoon()}
function bagUse(i){const s=W4.bag[i];if(!s)return;const D=IT[s.it];if(D.w){equipW(s.it);return}if(D.use&&D.use()){bagTake(i,1)}}
// the wheel: its Afro Pick slot now swings the pick (or the axe); every other weapon puts the melee weapon away
(function(){try{WHEEL.forEach(w=>{const go=w.go;if(w.id==='pick'){w.d='Melee (in the tower)';w.go=()=>{if(W4.on){equipW(bagCount('scythe')?'scythe':bagCount('axe')?'axe':'pick');return}go()}}else if(['fists','boombox','launcher','ak'].includes(w.id))w.go=()=>{if(W4.on)W4.melee=null;go()}})}catch(e){console.warn('tower wheel',e)}})();
function equipW(it){const D=IT[it];if(!D||!D.w)return;if(MELEE[D.w]){if(D.w==='scythe')scytheLoad();W4.melee=it;try{charApi.equip('fists')}catch(e){}toast('Equipped: '+D.i+' '+D.n)}else{W4.melee=null;try{if(typeof inv!=='undefined'&&inv.items)inv.items[D.w]=1;charApi.equip(D.w)}catch(e){}toast('Equipped: '+D.i+' '+D.n)}if(W4.bagOpen)bagRender()}   // (a bought gun unlocks on the wheel too)
// ---- the melee weapons: the pick and the axe swing where your fists punch, harder and wider
const MELEE={pick:{mul:2.4,reach:5.6,cd:.42,col:0xffd27a},axe:{mul:3.6,reach:7,cd:.8,col:0xffb030}};
(function(){const pa=playerAttack;playerAttack=function(t){if(!(W4.on&&W4.melee&&charApi&&!charApi.weapon()))return pa(t);   // (bare hands: the hero's weapon() is null)
 const M=MELEE[W4.melee];if(t-lastAttack<M.cd)return;
  const fm=L2.fistMul;L2.fistMul=fm*M.mul;let r;try{r=pa(t)}finally{L2.fistMul=fm}
  // the reach past your fists: everyone in front, out to the weapon's length
  const fx=Math.sin(aimYaw),fz=Math.cos(aimYaw);enemies.forEach(e=>{if(e.hp<=0)return;const dx=e.x-heroPos.x,dz=e.z-heroPos.z,d=Math.hypot(dx,dz);if(d>M.reach)return;const front=d<=1.2||(dx*fx+dz*fz)/d>=.35;
   if(d<=4&&front)return;   // your fists already got that one
   if(!M.spin&&(d<=4||(dx*fx+dz*fz)/d<.3))return;damageEnemy(e,5*PWR()*fm*M.mul,t)});
  for(const b of bombs){if(!bombAlive(b))continue;const dx=b.x-heroPos.x,dz=b.z-heroPos.z,d=Math.hypot(dx,dz);if(d>M.reach)continue;const front=d<=1.2||(dx*fx+dz*fz)/d>=.35;if(d<=4&&front)continue;if(!M.spin&&(d<=4||(dx*fx+dz*fz)/d<.3))continue;damageBomb(b,5*PWR()*fm*M.mul,t)}
  swingFx(heroPos.x,hero.position.y,heroPos.z,aimYaw,W4.melee);try{mpFx('w4s',[R1(heroPos.x),R1(hero.position.y),R1(heroPos.z),R2(aimYaw),Math.max(0,(typeof MKINDS!=='undefined'?MKINDS:['pick','axe','scythe']).indexOf(W4.melee))])}catch(e){}return r}})();
// (every swing reuses the same shapes: the arcs and the tools are made once and copied, so a long climb never piles up memory)
const SW=[],TOOLP={},ARCG={};function toolProto(kind){return TOOLP[kind]||(TOOLP[kind]=kind==='axe'?axeModel():pickModel())}
function arcGeo(M){const k=M.reach+'|'+(M.spin?1:0);return ARCG[k]||(ARCG[k]=M.spin?new THREE.RingGeometry(M.reach*.35,M.reach,40):new THREE.RingGeometry(M.reach*.45,M.reach,24,1,-.9,1.8))}
function swingFx(x,y,z,yaw,kind){const g=new THREE.Group();g.position.set(x,y+2.2,z);g.rotation.y=yaw;const M=MELEE[kind]||MELEE.pick;
 const arc=new THREE.Mesh(arcGeo(M),new THREE.MeshBasicMaterial({color:M.col,transparent:true,opacity:.75,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));arc.rotation.x=-Math.PI/2;arc.rotation.z=Math.PI/2;g.add(arc);
 const tool=kind==='scythe'?scytheModel():toolProto(kind).clone(true);tool.position.set(0,0,M.reach*.6);g.add(tool);g.traverse(o=>o.layers.set(1));world.add(g);SW.push({g,t:clk.getElapsedTime(),tool,arc,spin:!!M.spin,r:M.reach});try{whoosh(x,z,.3,kind==='pick'?.26:.4,kind==='pick'?480:300,kind==='pick'?2800:1700)}catch(_){}}
function swingTick(t){for(let i=SW.length-1;i>=0;i--){const s=SW[i],k=(t-s.t)/(s.spin?.42:.28);if(k>=1){world.remove(s.g);try{s.arc.material.dispose()}catch(e){}SW.splice(i,1);continue}
  if(s.spin){const a=k*6.283;s.tool.position.set(Math.sin(a)*s.r*.55,0,Math.cos(a)*s.r*.55);s.tool.rotation.set(0,a+1.57,0)}else{s.tool.rotation.y=-1.2+k*2.4;s.tool.position.x=Math.sin(-1.2+k*2.4)*2.4}s.arc.material.opacity=.75*(1-k)}}
function pickModel(){const g=new THREE.Group();const gold=new THREE.MeshStandardMaterial({color:0xd9a425,metalness:1,roughness:.3}),blk=new THREE.MeshStandardMaterial({color:0x1a1a1a,roughness:.5});
 const h=new THREE.Mesh(new THREE.BoxGeometry(.5,2.2,.3),blk);h.position.y=-1;g.add(h);const fist=new THREE.Mesh(new THREE.SphereGeometry(.42,10,8),blk);fist.position.y=.25;g.add(fist);
 for(let i=0;i<6;i++){const p=new THREE.Mesh(new THREE.CylinderGeometry(.06,.04,1.6,6),gold);p.position.set(-.5+i*.2,1.2,0);g.add(p)}const bar=new THREE.Mesh(new THREE.BoxGeometry(1.3,.25,.25),gold);bar.position.y=.45;g.add(bar);g.rotation.x=1.2;return g}
function axeModel(){const g=new THREE.Group();const gold=new THREE.MeshStandardMaterial({color:0xffc83a,metalness:1,roughness:.25}),wd=woodMat();const h=new THREE.Mesh(new THREE.CylinderGeometry(.14,.16,3.4,8),wd);g.add(h);
 const b=new THREE.Mesh(new THREE.CylinderGeometry(1.3,1.3,.18,20,1,false,0,Math.PI),gold);b.rotation.z=Math.PI/2;b.position.set(.2,1.3,0);g.add(b);g.rotation.x=1.2;return g}
MPFX_DO.w4s=(P,a,t)=>{if(Array.isArray(a))swingFx(+a[0],+a[1],+a[2],+a[3],['pick','axe','scythe'][a[4]|0]||'pick')};
MPFX_DO.w4g=(P,a,t)=>{if(Array.isArray(a))floatText(+a[0],+a[1]+4,+a[2],'+HEALTH','#7aff9a',2.2)};
// ---- the market: Da Nag Dabloon's stand on every landing (he sells, he talks)
const SHOP=[{it:'hp',p:30},{it:'hp2',p:80},{it:'mp',p:25},{it:'feather',p:260},{it:'pick',p:60,one:1},{it:'axe',p:240,one:1},{it:'ak',p:140,one:1},{it:'launcher',p:160,one:1},{it:'boombox',p:180,one:1},
 {up:'dmg',n:'Weapon Polish',i:'⚔️',d:'+12% damage with everything.',p:k=>Math.round(110*Math.pow(1.45,k))},{up:'hp',n:'Thick Skin',i:'❤️',d:'+15% max health.',p:k=>Math.round(100*Math.pow(1.45,k))},
 {up:'mana',n:'Deep Pockets of Mana',i:'🔷',d:'+25 max mana.',p:k=>Math.round(90*Math.pow(1.45,k))},{up:'spd',n:'Fresh Kicks',i:'👟',d:'+6% speed.',p:k=>Math.round(120*Math.pow(1.5,k))},
 {up:'bag',n:'Bigger Bag',i:'🎒',d:'+4 bag slots.',p:k=>Math.round(140*Math.pow(1.6,k))}];
function applyUps(){const U=W4.up;if(!W4.base){W4.base={dmg:L2.dmgMul||1,hp:L2.hpMax||140,spd:L2.spd0||1}}
 L2.dmgMul=W4.base.dmg*Math.pow(1.12,U.dmg|0);L2.hpMax=Math.round(W4.base.hp*Math.pow(1.15,U.hp|0));L2.spd0=W4.base.spd*Math.pow(1.06,U.spd|0);W4.manaMax=100+25*(U.mana|0);W4.mana=Math.min(W4.mana,W4.manaMax);bagInit();try{updateHUD()}catch(e){}}
function marketBuild(F){const e=F.entry,x=e.x0+7,z=e.z1-7,top=e.top;const G=new THREE.Group();G.position.set(x,top,z);G.rotation.y=Math.PI/2;
 const wm=woodMat(),cloth1=new THREE.MeshStandardMaterial({color:0xb02020,roughness:.8,side:THREE.DoubleSide}),cloth2=new THREE.MeshStandardMaterial({color:0xf2e6c8,roughness:.8,side:THREE.DoubleSide}),gold=new THREE.MeshStandardMaterial({color:0xffc83a,metalness:1,roughness:.3});
 const counter=new THREE.Mesh(new THREE.BoxGeometry(8,2.4,2),wm);counter.position.set(0,1.2,1.4);counter.castShadow=counter.receiveShadow=true;G.add(counter);
 [[-3.8,1.4],[3.8,1.4],[-3.8,-1.8],[3.8,-1.8]].forEach(([px,pz])=>{const p=new THREE.Mesh(new THREE.BoxGeometry(.4,6.4,.4),wm);p.position.set(px,3.2,pz);p.castShadow=true;G.add(p)});
 for(let i=0;i<8;i++){const s=new THREE.Mesh(new THREE.PlaneGeometry(1.06,3.8),i%2?cloth1:cloth2);s.position.set(-3.7+i*1.06,6.6,-.2);s.rotation.x=-1.1;G.add(s)}
 const sign=signMesh('DA NAG MARKET','POTIONS · UPGRADES · NO LOITERING');sign.scale.setScalar(.36);sign.position.set(0,5,2.5);G.add(sign);
 for(let i=0;i<5;i++){const c=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.12,16),gold);c.position.set(-2.6+i*.5,2.5+(i%2)*.12,1.6);c.rotation.x=Math.PI/2*.2;G.add(c)}
 const pot=[0x40d060,0x4080ff,0xff4060];pot.forEach((col,i)=>{const b=new THREE.Mesh(new THREE.SphereGeometry(.38,12,10),new THREE.MeshStandardMaterial({color:col,roughness:.15,metalness:.1,emissive:col,emissiveIntensity:.25}));b.position.set(1.6+i*.9,2.8,1.4);G.add(b)});
 G.traverse(o=>o.layers.set(1));W4.G.add(G);const wx=x+Math.sin(G.rotation.y)*-1.2,wz=z+Math.cos(G.rotation.y)*-1.2;
 W4.market={x,z,top};const k=npcMake('doubloon',x-1.6,z,Math.PI/2,'Da Nag Dabloon',shopLines(),{shop:1,keep:1});k.top=top}
function shopOpen(){W4.shopOpen=true;let el=$('w4shop');if(!el){el=document.createElement('div');el.id='w4shop';el.className='w4panel';document.body.appendChild(el)}shopRender();el.style.display='flex'}
function shopClose(){W4.shopOpen=false;const el=$('w4shop');if(el)el.style.display='none'}
function shopRender(){const el=$('w4shop');if(!el)return;const U=W4.up;let h='<div class="w4box"><div class="w4h"><span>'+coinIc()+' DA NAG MARKET</span><b>'+(W4.coins|0).toLocaleString()+' doubloons</b><button type="button" data-x="1">✕</button></div><div class="w4q">'+esc4(shopQuip())+'</div><div class="w4list">';
 SHOP.forEach((s,i)=>{let name,ic,d,price,ok=true,why='';if(s.up){const k=U[s.up]|0;name=s.n+(k?' '+(k+1):'');ic=s.i;d=s.d;price=s.p(k);if(s.up==='bag'&&k>=5){ok=false;why='maxed'}}
  else{const D=IT[s.it];name=D.n;ic=D.i;d=D.d||'';price=s.p;if(s.one&&(bagCount(s.it)||(s.it!=='pick'&&s.it!=='axe'&&inv.items[s.it]&&!W4.on))){ok=false;why='owned'}if(s.one&&bagCount(s.it)){ok=false;why='owned'}if(ok&&!bagFree(s.it)){ok=false;why='bag full'}}
  const afford=(W4.coins|0)>=price;h+='<div class="w4r"><div class="ic">'+ic+'</div><div class="sp"><div class="nm">'+esc4(name)+'</div><div class="ds">'+esc4(d)+'</div></div><button type="button" class="buy" data-i="'+i+'"'+(ok&&afford?'':' disabled')+'>'+(ok?coinIc()+' '+price:why)+'</button></div>'});
 h+='</div><div class="w4f">Walk away or press F to close · your bag: I · <a href="#" data-leave="1" style="color:#d9a425">leave the tower (back to the swamp)</a></div></div>';el.innerHTML=h;const lv=el.querySelector('[data-leave]');if(lv)lv.onclick=ev=>{ev.preventDefault();if(confirm('Leave the tower and go back to the swamp? Your doubloons, bag and best floor are saved.'))W4.leave()};
 el.querySelector('[data-x]').onclick=shopClose;el.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>shopBuy(+b.dataset.i))}
function shopBuy(i){const s=SHOP[i];if(!s)return;if(s.up){const k=W4.up[s.up]|0,p=s.p(k);if((W4.coins|0)<p)return;W4.coins-=p;W4.up[s.up]=k+1;applyUps();if(s.up==='hp'){playerHP=maxHP();updateHUD()}toast('Bought: '+s.n+' '+(k+2>1?'(level '+(k+1)+')':''))}
 else{if((W4.coins|0)<s.p||!bagFree(s.it))return;W4.coins-=s.p;bagPut(s.it,1);toast('Bought: '+IT[s.it].i+' '+IT[s.it].n)}
 try{dblChing(heroPos.x,heroPos.z,.5,1,3)}catch(e){}W4.quipN=(W4.quipN|0)+1;saveNow();shopRender();W4.hud()}
const esc4=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// ---- the bag (I): every slot, what's in it, use / equip / drop / give
function bagToggle(v){W4.bagOpen=v===undefined?!W4.bagOpen:v;let el=$('w4bag');if(!el){el=document.createElement('div');el.id='w4bag';el.className='w4panel';document.body.appendChild(el)}el.style.display=W4.bagOpen?'flex':'none';if(W4.bagOpen)bagRender()}
function bagRender(){const el=$('w4bag');if(!el)return;bagFit();const sel=W4.bagSel|0,s=W4.bag[sel];const cur=(charApi&&charApi.weapon())||'fists';
 let h='<div class="w4box"><div class="w4h"><span>🎒 YOUR BAG</span><b>'+coinIc()+' '+(W4.coins|0).toLocaleString()+'</b><button type="button" data-x="1">✕</button></div><div class="w4grid">';
 W4.bag.forEach((q,i)=>{const D=q&&IT[q.it];const eq=q&&D.w&&(MELEE[D.w]?W4.melee===q.it&&cur==='fists':cur===D.w&&!W4.melee);h+='<button type="button" class="w4s'+(i===sel?' sel':'')+(eq?' eq':'')+'" data-s="'+i+'">'+(q?'<span class="e">'+D.i+'</span>'+(q.n>1?'<span class="c">'+q.n+'</span>':''):'')+'</button>'});
 h+='</div>';if(s){const D=IT[s.it];const peers=MP.on?Object.keys(MP.players).filter(id=>MP.players[id].st):[];
  h+='<div class="w4d"><div class="nm">'+D.i+' '+esc4(D.n)+(s.n>1?' × '+s.n:'')+'</div><div class="ds">'+esc4(D.d||'')+'</div><div class="w4b">'+(D.w?'<button type="button" data-a="use">Equip</button>':D.use?'<button type="button" data-a="use">Use</button>':'')+
   '<button type="button" data-a="drop">Drop</button>'+peers.map(id=>'<button type="button" data-g="'+id+'">Give to '+esc4((MP.players[id].name||'your friend').slice(0,14))+'</button>').join('')+'</div></div>'}
 else h+='<div class="w4d"><div class="ds">Pick a slot. Weapons here are the weapons in your wheel (Tab). Potions: 1-3 keys use mana moves, H drinks a health potion.</div></div>';
 h+='</div>';el.innerHTML=h;el.querySelector('[data-x]').onclick=()=>bagToggle(false);el.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{W4.bagSel=+b.dataset.s;bagRender()});
 el.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{if(b.dataset.a==='use')bagUse(sel);else bagDrop(sel);bagRender()});el.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{bagDrop(sel,b.dataset.g);bagRender()})}
// ---- mana and the three mana moves (1, 2, 3; on a pad: D-pad left/down/up)
const SK=[{k:'1',n:'Afro Shockwave',i:'💥',c:35,cd:2.5},{k:'2',n:'Coin Barrage',i:'🪙',c:20,cd:.9},{k:'3',n:'Golden Glow',i:'✨',c:45,cd:6}];W4.skT=[-9,-9,-9];
function manaTick(t,dt){W4.mana=Math.min(W4.manaMax,W4.mana+dt*(5+.6*(W4.up.mana|0)));coinsTick(t,dt);swingTick(t);
 // a controller: D-pad up, RB and LT are the three mana moves, D-pad right drinks a potion (D-pad left stays the dodge, D-pad down talks)
 if(typeof padNow!=='undefined'&&padNow&&padNow.length){[12,5,6].forEach((b,i)=>{const d=!!padNow[b];if(d&&!W4['pd'+b]&&!W4.out&&!uiBlock()&&!(typeof pmPanel==='function'&&pmPanel()))skill(i);W4['pd'+b]=d});{const d=!!padNow[15];if(d&&!W4.pd15&&!uiBlock()&&!(typeof pmPanel==='function'&&pmPanel()))potionKey();W4.pd15=d}}}
function potionKey(){const i=W4.bag.findIndex(s=>s&&(s.it==='hp'||s.it==='hp2'));if(i>=0)bagUse(i);else toast('No health potions. The market sells them.')}
function skill(i){if(!W4.on||deadT>0||W4.out)return;const S=SK[i],t=clk.getElapsedTime();if(t-W4.skT[i]<S.cd)return;if(W4.mana<S.c){floatText(heroPos.x,hero.position.y+4,heroPos.z,'NO MANA','#7ad0ff',2);return}W4.mana-=S.c;W4.skT[i]=t;
 if(i===0){shockFx(heroPos.x,hero.position.y,heroPos.z);try{mpFx('w4w',[R1(heroPos.x),R1(hero.position.y),R1(heroPos.z)])}catch(e){}
  enemies.forEach(e=>{if(e.hp<=0)return;const d=Math.hypot(e.x-heroPos.x,e.z-heroPos.z);if(d<10)damageEnemy(e,(22-d)*PWR(),t)});bombsHit(heroPos.x,heroPos.z,10,16*PWR(),t);shake=Math.max(shake,.7)}
 else if(i===1){const yaw=aimYaw||heroYaw;for(let k=-3;k<=3;k++)coinShot(heroPos.x,hero.position.y+2.2,heroPos.z,yaw+k*.12,true);try{mpFx('w4c',[R1(heroPos.x),R1(hero.position.y+2.2),R1(heroPos.z),R2(yaw)])}catch(e){}}
 else{heal(.35);glowFx(hero)}W4.hud()}
// the keys: 1 2 3 are the mana moves in the tower (taken before the weapon numbers see them), H drinks a potion
addEventListener('keydown',e=>{if(!W4.on||e.repeat)return;const tg=e.target;if(tg&&(tg.tagName==='INPUT'||tg.tagName==='TEXTAREA'))return;if(e.key==='1'||e.key==='2'||e.key==='3'){if(W4.out||uiBlock())return;skill(+e.key-1);e.stopImmediatePropagation();e.preventDefault()}},true);
addEventListener('keydown',e=>{if(!W4.on||e.repeat)return;const tg=e.target;if(tg&&(tg.tagName==='INPUT'||tg.tagName==='TEXTAREA'))return;if(e.key==='h'||e.key==='H')potionKey()});
const RINGS=[];function shockFx(x,y,z){for(let k=0;k<2;k++){const m=new THREE.Mesh(new THREE.TorusGeometry(1,.35,8,48),new THREE.MeshBasicMaterial({color:k?0xffffff:0xffc040,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));m.rotation.x=Math.PI/2;m.position.set(x,y+1,z);m.layers.set(1);world.add(m);RINGS.push({m,t:clk.getElapsedTime()+k*.08})}try{dblChing(x,z,.5,.7,2)}catch(e){}}
const SHOTS=[];function coinShot(x,y,z,yaw,mine){if(!DRG.coin){dropMesh('coin',1)}const m=new THREE.Mesh(DRG.coin,DRG.cm);m.scale.setScalar(.8);m.position.set(x,y,z);m.layers.set(1);world.add(m);SHOTS.push({m,vx:Math.sin(yaw)*46,vz:Math.cos(yaw)*46,life:.8,mine,hit:new Set()})}
function glowFx(o){const m=new THREE.Mesh(new THREE.SphereGeometry(3,18,12),new THREE.MeshBasicMaterial({color:0xffe08a,transparent:true,opacity:.35,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));m.layers.set(1);m.position.y=2.2;o.add(m);RINGS.push({m,t:clk.getElapsedTime(),glow:1})}
function coinsTick(t,dt){for(let i=RINGS.length-1;i>=0;i--){const r=RINGS[i],k=(t-r.t)/(r.glow?1.4:.6);if(k<0)continue;if(k>=1){if(r.m.parent)r.m.parent.remove(r.m);try{r.m.geometry.dispose();r.m.material.dispose()}catch(e){}RINGS.splice(i,1);continue}if(r.glow){r.m.material.opacity=.35*(1-k);r.m.scale.setScalar(1+k*.4)}else{r.m.scale.setScalar(1+k*10);r.m.material.opacity=.9*(1-k)}}
 for(let i=SHOTS.length-1;i>=0;i--){const s=SHOTS[i];s.life-=dt;s.m.position.x+=s.vx*dt;s.m.position.z+=s.vz*dt;s.m.rotation.y+=dt*20;if(s.mine)for(const b of bombs){if(!bombAlive(b)||s.hit.has(b))continue;if(Math.hypot(b.x-s.m.position.x,b.z-s.m.position.z)<2.2){s.hit.add(b);damageBomb(b,11*PWR(),t);s.life=Math.min(s.life,.05)}}if(s.mine)enemies.forEach(e=>{if(e.hp<=0||s.hit.has(e))return;if(Math.hypot(e.x-s.m.position.x,e.z-s.m.position.z)<2.2&&Math.abs(h0(e)+2-s.m.position.y)<4){s.hit.add(e);damageEnemy(e,11*PWR(),t);s.life=Math.min(s.life,.05)}});
  if(s.life<=0){world.remove(s.m);SHOTS.splice(i,1)}}}
MPFX_DO.w4w=(P,a,t)=>{if(Array.isArray(a))shockFx(+a[0],+a[1],+a[2])};
// the feather: a column of phoenix fire where you rise (everyone sees it)
function featherFx(x,y,z){for(let k=0;k<3;k++){const m=new THREE.Mesh(new THREE.CylinderGeometry(1.6-k*.4,2.4-k*.5,9,16,1,true),new THREE.MeshBasicMaterial({color:[0xff5a10,0xffa02a,0xfff0a0][k],transparent:true,opacity:.75,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
  m.position.set(x,y+4.5,z);m.layers.set(1);world.add(m);RINGS.push({m,t:clk.getElapsedTime()+k*.07,glow:1})}try{shockFx(x,y,z)}catch(e){}floatText(x,y+6,z,'RISE!','#ffb040',3)}
MPFX_DO.w4p=(P,a,t)=>{if(Array.isArray(a))featherFx(+a[0],+a[1],+a[2])};
MPFX_DO.w4c=(P,a,t)=>{if(Array.isArray(a))for(let k=-3;k<=3;k++)coinShot(+a[0],+a[1],+a[2],+a[3]+k*.12,false)};
// ---------------------------------------------------------------- the people of the tower: who says what, and the talking itself
// The tower saga: Da Nag Dabloon built (well, paid for) a hundred floors; his hoes are stuck at the top; every floor is run by somebody
// who would rather you didn't get there; the 78th Lil Nag Brigade runs the lower floors; and at the very top there is something to buy
// that everybody has heard of and nobody will describe.
function greetLines(){return [
 'Ayyy, look who finally showed up! Welcome, welcome. They call me Da Nag Dabloon. Solid gold. Hundred percent. Do not bite me. I have been bit.',
 'This right here? My tower. One hundred floors. I built every brick myself. Well. I paid for every brick myself. Same thing, legally.',
 'Here is the situation. My hoes are stuck at the top floor. All of \'em. Floor one hundred. Do not ask me how. It was a whole thing.',
 'Every floor has somebody on it who does NOT want you on the next floor. Beat the guardian, the gate opens, you go up. Simple. Not easy. Simple.',
 'Whatever you knock down drops doubloons. That is basically my cousins you are picking up off the floor. Show some respect when you spend \'em.',
 'I keep a little market on every landing. Potions. Upgrades. A bigger bag. All at fair prices. Fair to me.',
 'Fall off the edge and you wake up on the last landing you stood on. Die and it costs you. Everything in this building costs you. That is called a business.',
 'And at the very top... there is something waiting. Something you can buy. I am not telling you what. People talk. Let \'em talk.',
 'Now go get my hoes. ...I heard how that sounded. Go anyway.']}
function ownerLines(n){return ['Welcome home, Boss. ...I still cannot believe I sold you the tower. I sold you MY tower. For MY coins. That I had already given you.','Floors are still open, Boss. The guardians did not get the memo. I told them. They did not care. Union stuff.']}
function shopLines(){return ['Browse. Do not touch the merchandise with your mouth.']}
const QUIPS=['Health potions. Mana potions. Upgrades. A bigger bag. Everything a growing hero needs, at prices that keep me growing too.',
 'You want a discount? I want a lot of things.','Buy something or stop breathing on my coins.','That axe was MY axe. Now it is a product. Capitalism, baby.',
 'Every doubloon you spend comes back to me eventually. Circle of life.','No refunds. No exchanges. No eye contact.','I take doubloons. I do not take feelings.',
 'Save up, though. Just saying. Something at the top is worth it. ...I said too much.','The potions are fresh. Fresh-ish. Do not read the label.','Phoenix feathers! Real ones! I plucked it myself. It did not like that.'];
function shopQuip(){return QUIPS[(W4.quipN|0)%QUIPS.length]}
// the people on the plazas: whoever they are, they talk; and everybody has heard about the thing at the top
const HINTS=['You heard about the thing at the very top? My cousin saw it. He does not talk anymore. Not because it was scary. He just got everything he ever wanted.',
 'Save your doubloons. I am not saying why. I am saying save. Your. Doubloons.','Whatever is up there costs more than my car. I do not have a car. That is how I know.',
 'A man came down from floor one hundred once. Would not say what he saw. Just kept grinning and buying everybody drinks.','They say it is gold. Everything is gold with that guy. His toilet is gold. I have seen it. Long story.',
 'Do not spend it all on potions. That is what they WANT you to do.','My grandmama said the top floor is where dreams go to get expensive.','Nobody knows what it is. Everybody knows it is worth it. That is called marketing.',
 'The thing at the top? My uncle saw it. He sold his car, his house and his good shoes. He says it was worth the shoes.',
 'Whatever you do, do not blow it all at the market on floor ninety-nine. Trust me. Or do not. But trust me.',
 'They say if you reach the top with fifty thousand doubloons, something changes forever. Mostly your bank account.',
 'Nobody knows what is up there. Except the Dabloon. And the Dabloon never shuts up, except about that.'];
// Supreme Big Nag Eastside of the 78th Lil Nag Brigade (the Jewel King): he turns up all the way up the tower, and he has opinions
const JKLINES=['Supreme Big Nag Eastside. Of the 78th Lil Nag Brigade. Say the whole thing. Every time. I paid for every word of that title.',
 'These jewels? Real. All of \'em. Do not ask me for a receipt. A receipt is just a piece of paper that does not believe in you.',
 'The Dabloon thinks he runs this tower. He runs the elevator budget. Which is zero. Think about that while you climb.',
 'Floor two? I let you have floor two. That was a strategic loss. A business decision. Write that down. Spell it right.',
 'The Brigade does not plan where we show up. We just show up. Every seventh floor or so. That is called a lifestyle.',
 'I heard about the thing at the top. I was gonna buy it. Then I bought more jewels. No regrets. ...A few regrets.',
 'You see this crown? Diamonds. Floor to ceiling. Except the ceiling. The ceiling is on layaway.',
 'My lawyer says I cannot say what is up there. My jeweler says it is up there. My jeweler talks too much.',
 'Nagrock? I know Nagrock. Big dude. Loud. Owes me money. If you see him, tell him the Brigade remembers.'];
// the Zombie Samurai (the owner's model): an undead ronin with the Reaper's own scythe; floor 6 is his dojo
const ZSLINES=['I died with honor in the year sixteen-oh-three. Got back up in sixteen-oh-four. Honor did not cover the second part.',
 'Floor six is my dojo. Shoes off. Head on. That is the only rule. ...The head part is mostly for me.',
 'This scythe was the Reaper\'s. He left it at my place. I am not giving it back. He knows where I live. Everybody knows where I live. It is a graveyard.',
 'Next floor, you and me. Bring a mana potion. Bring two. Bring your mama\'s mana potion.'];
const BANTER={toast:['I am toast. You are toast. We are ALL toast in this economy.','They told me I was bread. I believed them. Look at me now.','Butter me up and I will tell you a secret. ...No? Fine. Climb.','Somebody called me artisanal once. I have been chasing that high ever since.','I got jam on my resume. Strawberry. Hiring managers love it.','Do not toast me. Do NOT toast me. ...Okay, a little. Golden brown. Thank you.'],
 samurai:['I walked here from the swamp. In sandals. Do not talk to me about stairs.','My sword is for honor. And for the guardian on floor nine. Mostly the guardian.','A samurai serves a master. I serve whoever has doubloons. The times have changed.','My master said the path of the warrior is long. He did not say it was a hundred floors. He left that part out.','I meditated on floor twelve for an hour. Somebody stole my sandals. Inner peace is expensive.','They call me Ronin because I have no master. Also because I have no rent money.'],
 bomb:['Do not make any sudden movements. I am very emotional right now.','I was lit when I got here. I am still lit. Different reasons.','Hug? No? Probably smart.','My therapist says I have a short fuse. I told her that is literally my anatomy.','Everybody wants a hug until it is a bomb hug.','I am not mad. I am just... pre-explosive.'],
 zombie:['Braaains... no wait, I mean, BRAIDS. I want braids. Who does braids on this floor?','Being undead in this economy? Two jobs. Minimum.','I came up for the free potions. There were no free potions.','I lost my head once. Found it on floor nine. It was doing better without me.','Do not judge me. You have never climbed stairs with no knees.','I am on a plant-based diet now. Mostly the plants in the lobby.'],
 doubloon:['I am his cousin. Second cousin. Dabloon-in-law. Do not tell him I am up here.','Every coin in this tower is family. You are walking on my uncles.','He says the hoes are at the top. I believe him. I have met his hoes.','Do not let my cousin catch you spending us on potions. He wants us spent on THE THING. Family business.','I got minted in the same batch as him. He got the afro. I got the dent.','Gold does not age. Gold appreciates. Put that on my tombstone. In gold.'],
 pete:['They built a hundred floors and not ONE elevator. Not one. So I got a propeller. Problem solved. Problem flew away.','I have been up and down this tower more times than the Dabloon\'s credit score.','I flew past floor one hundred once. Saw something shiny. Then my battery died. Long way down. Great view though.','The propeller is not a hat. It is a lifestyle. A loud, spinning lifestyle.','Floor seventy has a draft. I almost flew into a wizard. He was not happy. Neither was I.','People ask how I get up a hundred floors. One floor at a time, at a very high RPM.'],
 wizard:['Ah, the one with the afro. I gave you power in the lava. Remember? You are welcome. Keep climbing. I will be... around.','Magic is just science that has not been invoiced yet. Bring mana potions. Trust me.','Floor eight. Remember that number. No reason. Just... remember it.','Mana is like money. You never have enough, and the Dabloon always wants some.','Fireballs are free. Fire insurance is not.','I taught the phoenix that trick where it comes back. Biggest mistake of my career.'],
 brigade:['The 78th Lil Nag Brigade runs the bottom floors. You pay a toll, or you pay a toll.','Supreme Big Nag Eastside does not lose. He does not win either. He just shows up, and things happen.','The Brigade has a code. Rule one: look fly. There is no rule two.','The 78th Lil Nag Brigade was founded on three things: loyalty, jewelry, and showing up uninvited.','We do not take orders. We take turns. And jewels. Mostly jewels.','You want to join the Brigade? First you need a nickname. Second, you need a better nickname.']};
// ---- an NPC: a figure on a landing, a name above, and what they say (F near them to talk)
function npcFigure(kind){try{
 if(kind==='doubloon'){const C=window.dblClone&&dblClone();if(C){C.root.scale.setScalar(DBL.k);return {o:C.root,C}}const m=new THREE.Mesh(lodGeo(dblParts(1)),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.55,metalness:.3}));return {o:m}}
 if(kind==='toast'){const T=toastBuild();return {o:T.g,T}}
 if(kind==='zombie'){const Z=zombieBuild();Z.root.scale.setScalar(1.56);return {o:Z.g,Z}}
 if(kind==='samurai'){const K=samuraiKit();const S0=K.build(K.randP());return {o:S0.g,S:S0}}
 if(kind==='bomb'){const P=bombProtoGet();const g=P.root.clone();g.scale.setScalar(BOMB.SCALE);return {o:g}}
 if(kind==='pete'){const B=peteBuild();if(B)return {o:B.g,pete:B}}
 if(kind==='jk'){const C=typeof jkClone==='function'&&JK.P&&jkClone();if(C){C.root.scale.setScalar(5.2/JK.P.h);return {o:C.root,J:C}}if(typeof jkLoad==='function'&&!JK.fail)jkLoad().catch(()=>{});return {o:jkStandIn(),wait:'jk'}}
 if(kind==='zsam'){const C=typeof zsClone==='function'&&ZS.P&&zsClone();if(C){C.root.scale.setScalar(4.9/ZS.P.h);return {o:C.root,Z2:C}}if(typeof zsLoad==='function'&&!ZS.fail)zsLoad().catch(()=>{});return {o:zsStandIn(),wait:'zsam'}}
 if(kind==='wizard'){const cg=new THREE.Group();const api=buildCharacter(cg);cg.scale.setScalar(.62);upgradeMaterials(cg);try{cg.add(wizRobe())}catch(e){}return {o:cg,api}}
 }catch(e){console.warn('tower npc '+kind,e)}const m=new THREE.Mesh(lodGeo(dblParts(1)),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.55}));return {o:m}}
function npcMake(kind,x,z,yaw,name,lines,o){const top=heightAt(x,z);const g=new THREE.Group();g.userData.keepGeo=1;g.position.set(x,top,z);g.rotation.y=yaw||0;const f=npcFigure(kind);g.add(f.o);
 const tag=nameTag(name);tag.position.y=kind==='zombie'||kind==='jk'?6.4:5.6;g.add(tag);g.traverse(q=>q.layers.set(1));(W4.G||world).add(g);
 const N={g,x,z,yaw:yaw||0,kind,name,lines,i:0,o:o||{},f,top,said:false};if(f.pete){N.tk=(t,dt)=>peteTick(N,t,dt);try{peteRoveInit(N)}catch(e){}}else if(f.api){N.tk=(t,dt)=>{try{f.api.anim(t,false,false,0,false)}catch(e){}}}
 // nobody stands like a statue: the bread shifts its weight, the zombie sways, the samurai breathes and shifts his guard, the bomb idles on its own clip
 else if(f.T){N.tk=(t,dt)=>{try{f.T.anim(t+N.x,'idle',0)}catch(e){}}}
 else if(f.Z&&typeof zombieAnim==='function'){N.tk=(t,dt)=>{try{zombieAnim({Z:f.Z,spd:0,ph:0},t+N.x*.37,dt,false)}catch(e){}}}
 else if(f.S&&typeof samuraiKit==='function'){N.tk=(t,dt)=>{try{samuraiKit().pose(f.S,W4.talk&&W4.talk.N===N?'block':'idle',t+N.z*.29,Math.min(dt,.05),0,5.5,false)}catch(e){}}}
 else if(kind==='bomb'&&typeof bombProtoGet==='function'){try{const P=bombProtoGet(),mx=new THREE.AnimationMixer(f.o);const cl=P.clips.find(c=>c.name==='Idle')||P.clips[0];if(cl){mx.clipAction(cl).play();mx.update(Math.random()*3);N.tk=(t,dt)=>mx.update(dt)}}catch(e){}}if(f.C){N.mx=new THREE.AnimationMixer(f.C.root);const A=N.mx.clipAction((o&&o.dance&&DBL.P.clips.Victory)||DBL.P.clips.Idle||DBL.P.clips.IdleBase);A.play();N.mx.update(Math.random()*5)}
 npcClips(N);npcPack(N);W4.npcs.push(N);return N}
// one draw per person: the figure's pieces are packed (and packed again when a better model steps in)
function npcPack(N){try{if(typeof uberMerge!=='function')return;for(let i=N.g.children.length-1;i>=0;i--){const c=N.g.children[i];if(c.userData&&c.userData.ubM)N.g.remove(c)}delete N.g.userData.ubDone;uberMerge(N.g,{tag:'npc:'+N.kind})}catch(e){console.warn('npc pack',e)}}   // (the packed shape is shared with every other pack of the same pieces: never disposed)
// the Jewel King and the Zombie Samurai talk with their own clips (Talk when you are talking to them, a wave when you walk up, a laugh now and then)
function npcClips(N){const f=N.f;if(f.J){N.mx=new THREE.AnimationMixer(f.J.root);const A={};for(const k in JK.P.clips)A[k]=N.mx.clipAction(JK.P.clips[k]);N.A=A;N.cur=null;N.play=n=>{const a=A[n]||A.Idle;if(!a||a===N.cur)return;a.reset().play();if(N.cur)a.crossFadeFrom(N.cur,.3,false);N.cur=a};N.play('Idle');N.mx.update(Math.random()*4);
  N.tk=(t,dt)=>{const talking=W4.talk&&W4.talk.N===N,d=Math.hypot(heroPos.x-N.g.position.x,heroPos.z-N.g.position.z);if(d<13&&!N.waved){N.waved=t}if(d>20)N.waved=0;
   N.play(talking?'Talk':N.waved&&t-N.waved<3?'Wave':(Math.sin(t*.21+N.x)>.93?'Laugh':'Idle'))}}
 else if(f.Z2){N.mx=new THREE.AnimationMixer(f.Z2.root);const A={};for(const k in ZS.P.clips)A[k]=N.mx.clipAction(ZS.P.clips[k]);A.Idle.play();N.mx.update(Math.random()*2);N.A=A}}
function nameTag(s){const c=cvs(256);c.height=64;const g=c.getContext('2d');g.font='800 30px system-ui';g.textAlign='center';g.fillStyle='rgba(0,0,0,.55)';const w=Math.min(250,g.measureText(s).width+24);g.fillRect(128-w/2,8,w,46);g.fillStyle='#ffe6a0';g.fillText(s,128,42);
 const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false}));sp.scale.set(6,1.5,1);return sp}
// who stands where: one or two people on the plazas, with something to say
function floorPeople(F){const r=srand(F.seed+F.n*131);const pool=['toast','samurai','bomb','zombie','doubloon'];const names={toast:['Burnt Terrence','Lil Crumb','Sourdough Steve'],samurai:['Ronin Ray','Sensei Sandals','Katana Keisha'],bomb:['Fuse Daddy','Tick Tock Tony','Lil Boom'],zombie:['Dead Dwayne','Groaning Greg','Auntie Rot'],doubloon:['Cousin Penny','Uncle Nickel','Dime Piece Darryl']};
 names.pete=['Propeller Pete'];names.wizard=['The Nago Wizard'];const plazas=F.P.filter(p=>p.kind==='plaza'&&!p.maze&&!p.island&&!p.church&&p.wide!=='maze'&&p.wide!=='arena');const SPp=(typeof specialOf==='function'&&specialOf(F.n)||{}).people||[];const taken=new Set(SPp.map(q=>q[1]));const n=Math.min(2,plazas.length);
 for(let i=0;i<n;i++){const p=plazas[(i*2+F.n)%plazas.length];const kind=F.n===2?'samurai':(i===1&&F.n>=4&&F.n<=7)?'wizard':(i===0&&F.n%3===1)?'pete':pool[(F.n+i)%pool.length];const nm=names[kind][(F.n+i)%names[kind].length];if(taken.has(nm)||(SPp.length&&i>=2-SPp.length))continue;   // (a special floor's own people come first; nobody stands on the floor twice)
  const B=F.n===2||F.n%7===2?BANTER.brigade:BANTER[kind];const lines=[B[(F.n*3+i*5)%B.length],B[(F.n*3+i*5+2)%B.length],HINTS[(F.n*2+i)%HINTS.length]];const x=p.x0+3,z=p.z1-3;npcMake(kind,x,z,Math.PI*.25,nm,lines)}
 // Supreme Big Nag Eastside drops by every fourth floor (on the landing you arrive on), and the Zombie Samurai waits on floors 4 and 5 for his own floor
 const e=F.entry;if(F.n>=4&&F.n%4===0){const k=(F.n/4)|0;npcMake('jk',e.x1-5,e.z0+6,-Math.PI*.7,'Supreme Big Nag Eastside',[JKLINES[k%JKLINES.length],JKLINES[(k+3)%JKLINES.length],HINTS[(k+5)%HINTS.length]])}
 if(F.n===4||F.n===5)npcMake('zsam',e.x0+5,e.z0+6,Math.PI*.7,'The Zombie Samurai',F.n===4?ZSLINES.slice(0,2):ZSLINES.slice(2,4))}
// ---- talking (F near someone): one line at a time; the greeter opens the door when he is done
// the Brigade Key (Supreme Big Nag Eastside drops it when he falls on a Brigade floor): bring it to him on any landing for a finder's fee
const KEYLINES=['Hold up. Is that... MY KEY? The Brigade Key! I have been looking for that since floor two. Do not ask me why I locked myself out of my own floor.',
 'Here. Two hundred fifty doubloons. A finder\'s fee. Do not tell the Dabloon I tipped you. He will want a cut. He always wants a cut.'];
function talkOpen(N){{const QL=typeof questTalk==='function'?questTalk(N):null;if(QL){W4.talk={N,i:0,L:QL};talkShow();return}}if(N.kind==='jk'&&!N.o.keyDone){const i=W4.bag.findIndex(s=>s&&s.it==='key');if(i>=0){N.o.keyDone=1;bagTake(i,1);W4.coins=(W4.coins|0)+250;toast('🗝️ Supreme Big Nag Eastside takes his key back: +250 doubloons');try{dblChing(heroPos.x,heroPos.z,.6,1,4)}catch(e){}saveNow();W4.hud();W4.talk={N,i:0,L:KEYLINES};talkShow();return}}
 W4.talk={N,i:0};talkShow()}
function talkShow(){const T=W4.talk;let el=$('w4talk');if(!el){el=document.createElement('div');el.id='w4talk';document.body.appendChild(el)}if(!T){el.style.display='none';return}
 const L=T.L||T.N.lines,last=T.i>=L.length-1;const choose=last&&T.N===W4.greeter&&(!MP.on||!MP.client);const mine=Math.max(1,saveLoad().best|0);let best=mine,who='';if(MP.on)for(const id in MP.players){const b=MP.players[id].w4b|0;if(b>best){best=b;who=MP.players[id].name||'your partner'}}
 if(last&&T.N.o.vault){el.innerHTML='<div class="who">'+esc4(T.N.name)+'</div><div class="say">'+esc4(L[T.i])+'</div><div class="w4b"><button type="button" data-v="1">Buy The Thing · '+coinIc()+' '+TOP_PRICE.toLocaleString()+'</button><button type="button" data-n="1">Not yet</button></div>';el.style.display='block';el.querySelector('[data-v]').onclick=()=>{W4.talk=null;talkShow();vaultBuy()};el.querySelector('[data-n]').onclick=()=>{W4.talk=null;talkShow()};return}
 el.innerHTML='<div class="who">'+esc4(T.N.name)+'</div><div class="say">'+esc4(L[T.i])+'</div><div class="w4b">'+(choose?'<button type="button" data-f="1">Climb from Floor 1</button>'+(best>1?'<button type="button" data-f="'+best+'">Continue: Floor '+best+(who?' ('+esc4(who)+'\'s save)':'')+'</button>':'')+(who&&mine>1?'<button type="button" data-f="'+mine+'">Your save: Floor '+mine+'</button>':''):'<button type="button" data-n="1">'+(last?'Later':'Next ▸')+'</button>')+'</div>';
 el.style.display='block';el.querySelectorAll('[data-n]').forEach(b=>b.onclick=()=>talkNext());el.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{doorGo(+b.dataset.f)})}
function talkNext(){const T=W4.talk;if(!T)return;if(T.i<(T.L||T.N.lines).length-1){T.i++;talkShow();return}if(T.N===W4.greeter&&(!MP.on||!MP.client)){doorGo(1);return}W4.talk=null;talkShow()}
function doorGo(n){W4.talk=null;talkShow();W4.doorOpen=true;W4.startAt=n;if(MP.on&&!MP.client)mpQueue({k:'w4dor',st:n});toast('The door is open. Floor '+n+', here we go.')}
// the things beside chests, doors and puzzles that F can do (a ride, a pickup): each {near:()=>its prompt or null, act:()=>do it}; the
// prompt and F go down the same list in the same order, so the prompt always says what F will do
if(!W4.px)W4.px=[];
// a chest and a secret door both in reach (a chest just round the corner from the loose bricks, say): F means the closer one, and the
// prompt says so
function chestOrDoor(){const ch=typeof chestNear==='function'?chestNear():null,D=typeof doorNear==='function'?doorNear():null;if(!ch||!D)return {ch,D};
 const b=D.b,dd=Math.hypot(heroPos.x-Math.max(b.x0,Math.min(b.x1,heroPos.x)),heroPos.z-Math.max(b.z0,Math.min(b.z1,heroPos.z))),dc=Math.hypot(heroPos.x-ch.x,heroPos.z-ch.z);return dd<dc?{ch:null,D}:{ch,D:null}}
W4.interact=function(){if(W4.talk){talkNext();return true}if(W4.shopOpen){shopClose();return true}
 if(W4.dial){dialClose();return true}
 {const cd=chestOrDoor(),c=cd.ch;if(c){if(MP.on&&MP.client)mpQueue({k:'w4ch',i:c.i});else{chestOpen(c);try{mpFx('w4ch',[c.i])}catch(e){}}return true}
  const D=cd.D;if(D){if(D.v)dialOpen(D);else doorAsk(D);return true}}
 {const L=typeof pzNear==='function'?pzNear():null;if(L){pzTouch(L.i);return true}}
 for(const h of W4.px){try{if(h.near()&&h.act()!==false)return true}catch(e){console.warn('tower interact',e)}}   // (rides, pickups: whatever the prompt said)
 let best=null,bd=7.5;for(const N of W4.npcs){const d=Math.hypot(heroPos.x-N.g.position.x,heroPos.z-N.g.position.z);if(d<bd){bd=d;best=N}}if(!best)return false;
 if(best.o.shop){shopOpen();return true}talkOpen(best);return true};
function npcTick(t,dt){const near=[];if(!Array.isArray(W4.npcs))W4.npcs=[];for(const N of W4.npcs){if(N.tk)N.tk(t,dt);if(N.mx)N.mx.update(dt);else if(N.kind==='doubloon'&&typeof DBL!=='undefined'&&DBL.P&&!N.up){N.up=1;const f=npcFigure('doubloon');if(f.C){N.g.remove(N.f.o);N.g.add(f.o);f.o.traverse(q=>q.layers.set(1));N.f=f;N.mx=new THREE.AnimationMixer(f.C.root);N.mx.clipAction((N.o&&N.o.dance&&DBL.P.clips.Victory)||DBL.P.clips.Idle).play();npcPack(N)}}
  if(N.f.wait&&!N.up2&&((N.f.wait==='jk'&&JK.P)||(N.f.wait==='zsam'&&ZS.P))){N.up2=1;const f=npcFigure(N.kind);if(!f.wait){N.g.remove(N.f.o);N.g.add(f.o);f.o.traverse(q=>q.layers.set(1));N.f=f;N.tk=null;N.mx=null;npcClips(N);npcPack(N)}}
  const d=Math.hypot(heroPos.x-N.g.position.x,heroPos.z-N.g.position.z);if(d<16&&!N.roving){const want=Math.atan2(heroPos.x-N.g.position.x,heroPos.z-N.g.position.z);let dy=want-N.g.rotation.y;dy=Math.atan2(Math.sin(dy),Math.cos(dy));N.g.rotation.y+=dy*Math.min(1,dt*3)}
  if(d<7.5)near.push(N);if(N===W4.greeter&&d<15&&!N.said&&!W4.talk){N.said=true;talkOpen(N)}}
 if(W4.talk&&Math.hypot(heroPos.x-W4.talk.N.g.position.x,heroPos.z-W4.talk.N.g.position.z)>20){W4.talk=null;talkShow()}
 if(W4.shopOpen&&W4.market&&Math.hypot(heroPos.x-W4.market.x,heroPos.z-W4.market.z)>14)shopClose();
 const pr=$('w4prompt');if(pr){const cd=chestOrDoor(),ch=cd.ch,D=!ch&&cd.D,L=!ch&&!D&&typeof pzNear==='function'?pzNear():null;
  let X=null;if(!ch&&!D&&!L)for(const h of W4.px){let l=null;try{l=h.near()}catch(e){}if(l){X=l;break}}const N=!ch&&!D&&!L&&!X?near[0]:null;const any=N||ch||D||L||X;
  if(!(any&&!W4.talk&&!W4.shopOpen&&!W4.dial))ctlPrompt(null);else ctlPrompt(ch?'Open the chest':D?(D.v?'Try the vault\'s dials':'Push the loose bricks'):L?L.label:X?X:(N.o.shop?'Shop with ':'Talk to ')+N.name)}}
// ---------------------------------------------------------------- what you see on screen in the tower: the floor and your doubloons, your
// mana under your health, the three mana moves, the market, the bag, the talking
(function(){const css=document.createElement('style');css.textContent=
 '#w4hud{position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:30;display:none;gap:10px;align-items:center;font:800 14px system-ui;color:#ffe6a0;background:rgba(20,10,4,.62);border:1px solid rgba(217,164,37,.6);border-radius:18px;padding:5px 14px;pointer-events:none;text-shadow:0 1px 2px #000}'+
 '#w4hud .f{color:#ffd27a;letter-spacing:.06em}#w4hud .c{color:#ffd040}'+
 '#w4mana{position:fixed;z-index:30;display:none;height:9px;border-radius:5px;background:rgba(0,0,0,.55);border:1px solid rgba(120,190,255,.6);overflow:hidden}#w4mana i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#2a7aff,#7ad0ff)}'+
 '#w4sk{position:fixed;right:12px;bottom:calc(150px + env(safe-area-inset-bottom,0px));z-index:31;display:none;flex-direction:column;gap:8px}#w4sk button{width:54px;height:54px;border-radius:50%;border:2px solid #7ad0ff;background:rgba(10,20,40,.7);color:#fff;font-size:24px;position:relative;cursor:pointer}'+
 '#w4sk button small{position:absolute;right:-2px;top:-4px;font:800 10px system-ui;background:#2a7aff;border-radius:6px;padding:1px 4px}#w4sk button.off{opacity:.4}#w4sk button b{position:absolute;left:0;right:0;bottom:-14px;font:700 9px system-ui;color:#9fd0ff}'+
 '.w4panel{position:fixed;inset:0;z-index:75;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45)}.w4box{width:min(560px,94vw);max-height:86vh;display:flex;flex-direction:column;background:linear-gradient(#24160c,#120a05);border:2px solid #d9a425;border-radius:14px;box-shadow:0 0 40px rgba(255,180,40,.25);color:#f2e2c8;font:14px system-ui;overflow:hidden}'+
 '.w4h{display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(217,164,37,.18);font:900 18px Bangers,Impact,system-ui;letter-spacing:.05em;color:#ffd27a}.w4h b{margin-left:auto;font:800 14px system-ui;color:#ffd040}.w4h button{background:none;border:0;color:#ffd27a;font-size:20px;cursor:pointer}'+
 '.w4q{padding:8px 14px;font-style:italic;color:#e8d2b0;border-bottom:1px solid rgba(217,164,37,.25)}.w4list{overflow:auto;padding:6px 10px}.w4r{display:flex;align-items:center;gap:10px;padding:7px 4px;border-bottom:1px solid rgba(255,255,255,.06)}.w4r .ic{font-size:26px;width:34px;text-align:center}.w4r .sp{flex:1}.w4r .nm{font-weight:800;color:#ffe6a0}.w4r .ds{font-size:12px;color:#cdb898}'+
 '.w4r .buy{min-width:84px;padding:7px 10px;border-radius:9px;border:1px solid #d9a425;background:#3a2410;color:#ffd040;font-weight:800;cursor:pointer}.w4r .buy:disabled{opacity:.45;cursor:default}.w4f{padding:8px 14px;font-size:12px;color:#a89070;text-align:center}'+
 '.w4grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(54px,1fr));gap:6px;padding:12px}.w4s{height:54px;border-radius:9px;border:1px solid rgba(217,164,37,.35);background:rgba(255,255,255,.04);position:relative;cursor:pointer;color:#fff}.w4s .e{font-size:26px}.w4s .c{position:absolute;right:4px;bottom:2px;font:800 11px system-ui;color:#ffd040}'+
 '.w4s.sel{border-color:#ffd040;box-shadow:0 0 0 2px rgba(255,208,64,.45)}.w4s.eq{background:rgba(217,164,37,.22)}.w4d{padding:10px 14px;border-top:1px solid rgba(217,164,37,.25)}.w4d .nm{font-weight:800;color:#ffe6a0;font-size:16px}.w4d .ds{font-size:13px;color:#cdb898;margin:4px 0 8px}'+
 '.w4b{display:flex;flex-wrap:wrap;gap:8px}.w4b button{padding:8px 12px;border-radius:9px;border:1px solid #d9a425;background:#3a2410;color:#ffe6a0;font-weight:800;cursor:pointer}'+
 '#w4talk{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);width:min(680px,94vw);z-index:72;display:none;background:linear-gradient(#24160c,#120a05);border:2px solid #d9a425;border-radius:14px;padding:12px 16px;color:#f2e2c8;font:15px/1.45 system-ui;box-shadow:0 8px 30px rgba(0,0,0,.6)}'+
 '#w4talk .who{font:900 17px Bangers,Impact,system-ui;letter-spacing:.06em;color:#ffd27a;margin-bottom:4px}#w4talk .say{margin-bottom:10px}'+
 '#w4prompt{position:fixed;left:50%;bottom:calc(120px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:31;display:none;font:800 14px system-ui;color:#ffe6a0;background:rgba(20,10,4,.7);border:1px solid #d9a425;border-radius:10px;padding:6px 12px;pointer-events:none}'+
 '#w4quest{position:fixed;left:12px;top:calc(150px + env(safe-area-inset-top,0px));z-index:58;background:rgba(10,6,4,.62);border:1px solid rgba(217,164,37,.45);border-radius:8px;padding:5px 10px;font:600 13px/1.3 system-ui;color:#f2e2c8;pointer-events:none;max-width:min(340px,60vw)}#w4quest b{color:#ffd27a}#w4quest i{font-style:normal;color:#9fe4ff}#w4lock{position:fixed;left:12px;top:calc(186px + env(safe-area-inset-top,0px));z-index:58;background:rgba(40,8,4,.7);border:1px solid rgba(255,120,60,.55);border-radius:8px;padding:5px 10px;font:600 13px/1.3 system-ui;color:#ffd8c0;pointer-events:none;max-width:min(340px,60vw);display:none}#w4lock b{color:#ff9a60}'+
 '#w4dial{position:fixed;inset:0;z-index:66;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45)}#w4dial .w4box{background:rgba(24,16,10,.96);border:2px solid #d9a425;border-radius:14px;padding:14px 18px;min-width:min(380px,92vw);color:#f2e2c8;font:600 14px system-ui}#w4dial .w4h{display:flex;justify-content:space-between;align-items:center;font:900 18px Bangers,Impact,system-ui;letter-spacing:.06em;color:#ffd27a;margin-bottom:10px}#w4dial .dl{display:flex;gap:14px;justify-content:center}#w4dial .dc{display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px;border-radius:10px;border:2px solid transparent}#w4dial .dc.on{border-color:#ffd27a;background:rgba(255,210,122,.08)}#w4dial .dc small{color:#d9a425;font:900 14px Georgia,serif}#w4dial .sy{font-size:44px;line-height:1.1;min-width:64px;text-align:center}#w4dial button{background:#3a2414;color:#ffe6a0;border:1px solid #d9a425;border-radius:8px;padding:6px 14px;font:800 15px system-ui;cursor:pointer}#w4dial .w4b{display:flex;justify-content:center;margin-top:12px}#w4dial .ms{text-align:center;margin-top:8px;color:#e8d8b0;font-size:13px}'+
 '#w4radio{position:fixed;left:50%;top:calc(70px + env(safe-area-inset-top,0px));transform:translate(-50%,-12px);width:min(560px,92vw);z-index:61;opacity:0;pointer-events:none;transition:opacity .5s,transform .5s;background:rgba(22,13,5,.9);border:1.5px solid #d9a425;border-radius:12px;padding:9px 14px;color:#f2e2c8;font:14px/1.4 system-ui;box-shadow:0 6px 22px rgba(0,0,0,.55)}#w4radio.show{opacity:1;transform:translate(-50%,0)}#w4radio .who{font:900 15px Bangers,Impact,system-ui;letter-spacing:.06em;color:#ffd27a;margin-bottom:2px}#w4radio .who span{font:600 11px system-ui;color:#c9b48a;letter-spacing:0}'+
 '#w4ban{position:fixed;left:50%;top:22%;transform:translate(-50%,-10px);z-index:60;text-align:center;opacity:0;transition:opacity .5s,transform .5s;pointer-events:none;text-shadow:0 3px 10px #000}#w4ban.show{opacity:1;transform:translate(-50%,0)}'+
 '#w4ban .fn{font:900 54px Bangers,Impact,system-ui;letter-spacing:.08em;color:#ffd27a}#w4ban .nm{font:800 20px system-ui;color:#f2e2c8}';
 document.head.appendChild(css)})();
W4.hud=function(){let h=$('w4hud');if(!h){h=document.createElement('div');h.id='w4hud';document.body.appendChild(h);const m=document.createElement('div');m.id='w4mana';m.innerHTML='<i></i>';document.body.appendChild(m);
  const sk=document.createElement('div');sk.id='w4sk';sk.innerHTML=SK.map((s,i)=>'<button type="button" data-k="'+i+'" title="'+s.n+' ('+s.c+' mana) · key '+s.k+'">'+s.i+'<small>'+s.k+'</small><b>'+s.c+'</b></button>').join('');document.body.appendChild(sk);
  sk.querySelectorAll('button').forEach(b=>b.onpointerdown=e=>{e.stopPropagation();skill(+b.dataset.k)});const p=document.createElement('div');p.id='w4prompt';document.body.appendChild(p)}
 const on=W4.on;h.style.display=on?'flex':'none';$('w4mana').style.display=on?'block':'none';$('w4sk').style.display=on&&!W4.out?'flex':'none';try{questHud()}catch(e){}if(!on)return;
 h.innerHTML=(W4.out?'<span class="f">🧱 THE TOWER</span>':'<span class="f">🧱 FLOOR '+W4.fl+' / 100</span>')+'<span class="c">'+coinIc()+' '+(W4.coins|0).toLocaleString()+'</span><span>🔷 '+Math.round(W4.mana)+'</span>';
 // the mana bar sits right under your health bar
 const hb=$('hpf')&&$('hpf').parentElement;const mb=$('w4mana');if(hb){const r=hb.getBoundingClientRect();mb.style.left=r.left+'px';mb.style.top=(r.bottom+4)+'px';mb.style.width=r.width+'px'}else{mb.style.left='12px';mb.style.top='60px';mb.style.width='180px'}
 mb.firstChild.style.width=(W4.mana/W4.manaMax*100)+'%';const t=clk.getElapsedTime();$('w4sk').querySelectorAll('button').forEach((b,i)=>b.classList.toggle('off',W4.mana<SK[i].c||t-W4.skT[i]<SK[i].cd))};
// ---- floor 100: the top of the tower
W4.top=function(){W4.goFloor(100)};
// ---- the controller drives the tower's own menus too (the market, the bag, the talking), like every other menu in the game: the D-pad or the
// left stick moves the yellow highlight, A presses, B backs out
try{if(typeof PM_PANELS!=='undefined')['w4shop','w4bag','w4talk','w4dial'].forEach(id=>{if(!PM_PANELS.includes(id))PM_PANELS.push(id)});
 if(typeof pmBack==='function'){const pb=pmBack;pmBack=function(){const id=PM.panel&&PM.panel.id;if(id==='w4shop'){shopClose();return}if(id==='w4bag'){bagToggle(false);return}if(id==='w4talk'){W4.talk=null;talkShow();return}if(id==='w4dial'){dialClose();return}pb()}}}catch(e){console.warn('tower pad menus',e)}
// the hint bar in the tower: its own keys (talk, the bag, the mana moves, a potion) in front of the usual ones
try{if(typeof KBM_HINT!=='undefined'){KBM_HINT.w4lock='<b>Click the game</b> to aim · <b>Left</b> attack · <b>Right</b> aim · <b>Q</b> dodge · WASD run · Space jump (×3) · <b>F</b> talk / shop · <b>I</b> bag · <b>1 2 3</b> mana moves · <b>H</b> potion · Tab wheel · <b>Esc</b> frees the mouse';
  KBM_HINT.w4nolock='WASD run · drag to look · <b>Click</b> / X attack · <b>Q</b> dodge · Space jump (×3) · <b>F</b> talk / shop · <b>I</b> bag · <b>1 2 3</b> mana moves · <b>H</b> potion · Tab wheel · Esc settings';
  const hs=kbmHintSet;kbmHintSet=function(mode){if(W4.on&&(mode==='lock'||mode==='nolock'))mode='w4'+mode;return hs(mode)}}}catch(e){console.warn('tower hints',e)}
try{if(typeof padHint==='function'){const ph=padHint;padHint=function(){if(!W4.on)return ph();const n=a=>{const c=BINDS[a]&&BINDS[a][2];return c?bindName(c).replace('🎮 ',''):'—'};
  return '🎮 <b>Left stick</b> run · <b>Right stick</b> look · <b>'+n('jump')+'</b> jump (×3) · <b>'+n('attack')+'</b> attack · <b>D-pad ←</b> dodge · <b>D-pad ↓</b> talk / shop · <b>D-pad ↑ · RB · LT</b> mana moves · <b>D-pad →</b> potion · <b>'+n('wheel')+'</b> weapons · <b>'+n('inventory')+'</b> bag · <b>'+n('pause')+'</b> pause'}}}catch(e){}
// ---- THE JEWEL KING ("Supreme Big Nag Eastside of the 78th Lil Nag Brigade"): the owner's model packed for the game — two skinned meshes
// (body; face with its 31 expressions) sharing one material, one 76-bone skeleton, 7 clips (Idle Walk Talk Laugh Angry Wave Surprise).
// He is 2.14 m tall in the file (feet at y=0) and faces +Z. jkLoad() -> Promise of {root, h, clips:{name->AnimationClip}};
// jkClone() -> {root, meshes} with its own skeleton (play clips with new THREE.AnimationMixer(root)). Data: w4/jewelking.js beside the page.
const JK={P:null,p:null,fail:false};
function jkData(){if(window.JEWELKING_GLB)return Promise.resolve(window.JEWELKING_GLB);const base=window.MS_ASSET_BASE||'',urls=[base+'w4/jewelking.js',base+'jewelking.js'];
 const viaFetch=u=>fetch(u).then(r=>{if(!r.ok)throw new Error('http '+r.status);return r.text()}).then(t=>{const k='JEWELKING_GLB="',i=t.indexOf(k),j=t.lastIndexOf('"');if(i<0||j<=i+1000)throw new Error('bad jewel king data');return window.JEWELKING_GLB=t.slice(i+k.length,j)});
 const viaTag=u=>new Promise((res,rej)=>{const s=document.createElement('script');s.src=u;s.async=true;s.onload=()=>window.JEWELKING_GLB?res(window.JEWELKING_GLB):rej(new Error('jewel king data missing'));s.onerror=()=>rej(new Error('jewel king data could not load'));document.head.appendChild(s)});
 const at=k=>k>=urls.length?Promise.reject(new Error('the jewel king could not load')):viaFetch(urls[k]).catch(()=>viaTag(urls[k])).catch(()=>at(k+1));return at(0)}
function jkLoad(){return JK.p||(JK.p=new Promise((res,rej)=>{let n=0;const w=()=>{if(THREE.GLTFLoader)res();else if(++n>300)rej(new Error('GLTFLoader missing'));else setTimeout(w,100)};w()})
 .then(jkData).then(b64=>{const raw=atob(b64),u=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)u[i]=raw.charCodeAt(i);return new Promise((res,rej)=>new THREE.GLTFLoader().parse(u.buffer,'',res,rej))})
 .then(g=>{const root=g.scene;root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});root.updateMatrixWorld(true);
  const b=new THREE.Box3().setFromObject(root),clips={};(g.animations||[]).forEach(c=>{clips[c.name]=c});
  return JK.P={root,h:Math.max(.5,b.max.y-b.min.y),clips}}).catch(e=>{console.warn('Jewel King:',e);JK.fail=true;throw e}))}
function jkClone(){const P=JK.P;if(!P)return null;const c=P.root.clone(true),bn={},sk=new Map(),meshes=[];c.traverse(o=>{if(o.isBone)bn[o.name]=o});
 c.traverse(o=>{if(o.isSkinnedMesh){const s=o.skeleton;let ns=sk.get(s);if(!ns){ns=new THREE.Skeleton(s.bones.map(b=>bn[b.name]),s.boneInverses);sk.set(s,ns)}o.bind(ns,o.bindMatrix);meshes.push(o)}});
 return {root:c,meshes}}
// ---------------------------------------------------------------- THE ZOMBIE SAMURAI (the owner's upload Zombie_Samurai): an undead ronin
// with the Reaper's own scythe. The file is fifteen rigid parts on node animations (Idle, Walk, Attack). At load the parts become one
// skeleton (a bone per part, same names, same rest pose, so the clips drive it unchanged) and two skinned meshes (him; his scythe): each
// one on screen costs 2 draws instead of 15 and looks the same. His colour and detail pictures stay at the owner's 2048 (the rest 1024,
// the scythe's 512: it is a sliver of the screen in his hands). The glow is the file's own 3x (KHR_materials_emissive_strength, which
// this three.js does not read by itself). Data: w4/zsam.js beside the page, loaded the first time he is needed.
const ZS={P:null,p:null,fail:false};
function zsData(){if(window.ZSAM_GLB)return Promise.resolve(window.ZSAM_GLB);const base=window.MS_ASSET_BASE||'',urls=[base+'w4/zsam.js',base+'zsam.js'];
 const viaFetch=u=>fetch(u).then(r=>{if(!r.ok)throw new Error('http '+r.status);return r.text()}).then(t=>{const k='ZSAM_GLB="',i=t.indexOf(k),j=t.lastIndexOf('"');if(i<0||j<=i+1000)throw new Error('bad zombie samurai data');return t.slice(i+k.length,j)});
 const viaTag=u=>new Promise((res,rej)=>{const s=document.createElement('script');s.src=u;s.async=true;s.onload=()=>window.ZSAM_GLB?res(window.ZSAM_GLB):rej(new Error('zombie samurai data missing'));s.onerror=()=>rej(new Error('zombie samurai data could not load'));document.head.appendChild(s)});
 const at=k=>k>=urls.length?Promise.reject(new Error('the zombie samurai could not load')):viaFetch(urls[k]).catch(()=>viaTag(urls[k])).catch(()=>at(k+1));return at(0)}
function zsLoad(){return ZS.p||(ZS.p=new Promise((res,rej)=>{let n=0;const w=()=>{if(THREE.GLTFLoader)res();else if(++n>300)rej(new Error('GLTFLoader missing'));else setTimeout(w,100)};w()})
 .then(zsData).then(b64=>{const raw=atob(b64),u=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)u[i]=raw.charCodeAt(i);window.ZSAM_GLB=null;return new Promise((res,rej)=>new THREE.GLTFLoader().parse(u.buffer,'',res,rej))})
 .then(zsPrep).catch(e=>{console.warn('Zombie Samurai:',e);ZS.fail=true;throw e}))}
function emisStrength(g,mat){const MJ=(g.parser&&g.parser.json&&g.parser.json.materials)||[];const d=MJ.find(m=>m.name===mat.name);const x=d&&d.extensions&&d.extensions.KHR_materials_emissive_strength;return x&&x.emissiveStrength>0?x.emissiveStrength:1}
function zsPrep(g){const src=g.scene;src.position.set(0,0,0);src.rotation.set(0,0,0);src.scale.set(1,1,1);src.updateMatrixWorld(true);
 const root=new THREE.Group();root.name='zsRoot';const bones=[],bi=new Map();
 const mk=(o,parent)=>{const b=new THREE.Bone();b.name=o.name;b.position.copy(o.position);b.quaternion.copy(o.quaternion);b.scale.copy(o.scale);parent.add(b);bi.set(o,bones.length);bones.push(b);o.children.forEach(c=>mk(c,b))};
 src.children.slice().forEach(c=>mk(c,root));root.updateMatrixWorld(true);
 const groups=new Map();src.traverse(o=>{if(o.isMesh){const m=o.material;if(!groups.has(m))groups.set(m,[]);groups.get(m).push(o)}});
 const skel=new THREE.Skeleton(bones);const meshes=[];const p=new THREE.Vector3(),nm=new THREE.Matrix3();
 groups.forEach((parts,mat)=>{let nv=0,ni=0;parts.forEach(o=>{nv+=o.geometry.attributes.position.count;ni+=o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count});
  const hasT=parts.every(o=>o.geometry.attributes.tangent),hasU=parts.every(o=>o.geometry.attributes.uv);
  const P=new Float32Array(nv*3),N=new Float32Array(nv*3),T=hasT?new Float32Array(nv*4):null,U=hasU?new Float32Array(nv*2):null,SI=new Uint16Array(nv*4),SW=new Float32Array(nv*4),I=nv<65536?new Uint16Array(ni):new Uint32Array(ni);
  let v=0,ii=0;parts.forEach(o=>{const A=o.geometry.attributes,M=o.matrixWorld,n=A.position.count,b=bi.get(o);nm.getNormalMatrix(M);
   for(let k=0;k<n;k++){const j=v+k;p.fromBufferAttribute(A.position,k).applyMatrix4(M);P[j*3]=p.x;P[j*3+1]=p.y;P[j*3+2]=p.z;
    p.fromBufferAttribute(A.normal,k).applyMatrix3(nm).normalize();N[j*3]=p.x;N[j*3+1]=p.y;N[j*3+2]=p.z;
    if(T){const t=A.tangent;p.set(t.getX(k),t.getY(k),t.getZ(k)).transformDirection(M);T[j*4]=p.x;T[j*4+1]=p.y;T[j*4+2]=p.z;T[j*4+3]=t.getW(k)}
    if(U){U[j*2]=A.uv.getX(k);U[j*2+1]=A.uv.getY(k)}SI[j*4]=b;SW[j*4]=1}
   const ix=o.geometry.index;if(ix){for(let k=0;k<ix.count;k++)I[ii+k]=ix.getX(k)+v;ii+=ix.count}else{for(let k=0;k<n;k++)I[ii+k]=v+k;ii+=n}v+=n});
  const G=new THREE.BufferGeometry();G.setAttribute('position',new THREE.BufferAttribute(P,3));G.setAttribute('normal',new THREE.BufferAttribute(N,3));if(T)G.setAttribute('tangent',new THREE.BufferAttribute(T,4));if(U)G.setAttribute('uv',new THREE.BufferAttribute(U,2));
  G.setAttribute('skinIndex',new THREE.BufferAttribute(SI,4));G.setAttribute('skinWeight',new THREE.BufferAttribute(SW,4));G.setIndex(new THREE.BufferAttribute(I,1));G.computeBoundingSphere();G.computeBoundingBox();
  const m=mat;m.skinning=true;if(T)m.vertexTangents=true;m.emissiveIntensity=emisStrength(g,m);m.needsUpdate=true;
  const sm=new THREE.SkinnedMesh(G,m);sm.name=parts.length>1?'zsBody':'zsScythe';sm.castShadow=true;sm.receiveShadow=true;root.add(sm);sm.updateMatrixWorld(true);sm.bind(skel,new THREE.Matrix4());meshes.push(sm)});
 parts0Free(src);const bb=new THREE.Box3();meshes.forEach(m=>{m.geometry.computeBoundingBox();bb.union(m.geometry.boundingBox)});
 const clips={};(g.animations||[]).forEach(c=>{clips[c.name]=c});
 return ZS.P={root,h:Math.max(.5,bb.max.y-Math.min(0,bb.min.y)),clips,skel}}
function parts0Free(src){src.traverse(o=>{if(o.isMesh&&o.geometry)o.geometry.dispose()})}
function zsClone(){const P=ZS.P;if(!P)return null;const c=P.root.clone(true),bn={},meshes=[];c.traverse(o=>{if(o.isBone)bn[o.name]=o});
 const sk=new THREE.Skeleton(P.skel.bones.map(b=>bn[b.name]),P.skel.boneInverses);c.traverse(o=>{if(o.isSkinnedMesh){o.bind(sk,o.bindMatrix);meshes.push(o)}});return {root:c,meshes}}
// until he has loaded: the horde's own zombie stands in (the owner's other zombie)
function zsStandIn(){try{const Z=zombieBuild();Z.root.scale.setScalar(1.56);return Z.g}catch(e){return new THREE.Group()}}
// ...and Supreme Big Nag Eastside's stand-in (a robe, a gold chain, a crown) for the second or two his model takes
function jkStandIn(){const g=new THREE.Group();const M=c=>new THREE.MeshStandardMaterial({color:c,roughness:.5,metalness:c===0xd9a425?.9:.1});
 const robe=new THREE.Mesh(new THREE.CylinderGeometry(.9,1.4,3.4,12),M(0x4a1a6a));robe.position.y=1.7;g.add(robe);const head=new THREE.Mesh(new THREE.SphereGeometry(.62,14,10),M(0x6a3f22));head.position.y=3.9;g.add(head);
 const crown=new THREE.Mesh(new THREE.CylinderGeometry(.55,.45,.5,8,1,true),M(0xd9a425));crown.position.y=4.55;g.add(crown);const chain=new THREE.Mesh(new THREE.TorusGeometry(.75,.1,6,18),M(0xd9a425));chain.position.y=3.1;chain.rotation.x=1.2;g.add(chain);return g}
// ---------------------------------------------------------------- NAGROCK'S COMEBACK TOUR (floor 20, then 40, 60 and 80): the Abyssal Tyrant
// from World 3, cut down to fit a landing, holding the gate together with the tower's other bosses (the owner: "Nagrock teamed with 2-4+
// bosses", "remixed/new attacks", "his arena"). His model is World 3's own (the same download, built once; if you came up from World 3 it
// is already there): until it is ready his horde body stands in under his name. His landing burns like his arena (basalt and lava light).
// On top of his body's swings he has five moves, remixed from World 3 for a landing: the Cleave (a wide sector in front), the Spin (a ring
// around him: jump it), the Abyss Slam (a crater ahead and a wave: jump the wave), the Impale (a long line of spikes) and the Comeback Leap
// (he lands on you). The host decides and deals the damage; every screen draws the same warning and the same blast.
const NAGTH={n:'nagrock',brick:{hue:4,sat:.18,lit:.17,soot:.62,seed:66,mortar:[90,40,30]},fog:0x1a0403,glow:0xff2a08,amb:0x6a2a20,key:0xffa080};
const NGA={cleave:{clip:'Attack_1',hit:.91,shape:'sector',r:18,half:.66,dmg:24},
 spin:{clip:'Attack_2',hit:1.0,shape:'circle',r:13,dmg:22,jump:1},
 slam:{clip:'Attack_3',hit:1.3,shape:'circle',r:7.5,dist:9,dmg:30,wave:15},
 impale:{clip:'Attack_4',hit:1.05,shape:'line',len:34,w:3.2,dmg:30},
 leap:{clip:'Attack_5',hit:2.09,shape:'circle',r:10,dmg:34,leap:1}};
const NGAN=Object.keys(NGA);
const NG={p:null,ready:false,fail:false,st:null,next:0,fx:[],n:0,taunt:0};
const NGTAUNT=['NAGROCK IS BACK.','YOU THOUGHT I WAS DONE? I WAS ON TOUR.','THE ABYSS HAS A NEW ADDRESS.','I BROUGHT FRIENDS. YOU BROUGHT A PICK.','KNEEL. OR JUMP. JUMPING IS ALSO FINE.'];
function nagLoad(){if(NG.p)return NG.p;if(!window.W3||typeof W3.preload!=='function'){NG.fail=true;return NG.p=Promise.reject(new Error('World 3 is not on this page'))}
 NG.p=Promise.resolve().then(()=>W3.preload()).then(TY=>{if(!TY||!TY.g)throw new Error('no model');NG.ready=true;return TY}).catch(e=>{console.warn('Nagrock',e);NG.fail=true;throw e});return NG.p}
// his look: World 3's model, sixteen paces tall, inside the guardian's body
function nagSkin(g){const TY=W3.TY;if(TY.g.parent)TY.g.parent.remove(TY.g);const w=new THREE.Group();w.add(TY.g);TY.g.position.set(0,0,0);TY.g.rotation.set(0,0,0);TY.g.scale.setScalar(TY.SC);TY.g.visible=true;
 TY.g.traverse(o=>{o.visible=true});w.updateMatrixWorld(true);let h=0;try{const bb=new THREE.Box3().setFromObject(TY.g);h=bb.max.y-bb.min.y}catch(e){}
 const want=10;   // inside the guardian's body (x1.6): sixteen paces
 if(h>.5)TY.g.scale.setScalar(TY.SC*want/h);else TY.g.scale.setScalar(TY.SC*.23);g.add(w);
 const tp=W3._dbg&&W3._dbg.tyPlay;if(tp)tp('Idle_1',0,1);
 return (e,t,dt)=>{if(!tp)return;let want='Idle_1',ts=1;const S=NG.st;
  if(e.hp<=0)want='Die';else if(S&&t-S.t0<S.A.hit+.7)want=S.A.clip;else{const sw=t-e.swing;if(sw>=0&&sw<1.1)want='Attack_1';else if(e.mvK){want='Walk';ts=1.3}}
  if(TY.curName!==want)tp(want,.22,ts);try{TY.mixer.update(dt)}catch(_){}}}
// ---- the moves (host): pick one by distance, face the target, and land it at the clip's own hit time
function nagTick(t,dt){const F=W4.F;nagFxTick(t,dt);if(!F||!F.nag)return;const e=enemies[W4.guardI];
 if(!e||e.hp<=0||e.skin!=='nagrock'){NG.st=null;return}
 const S=NG.st;
 if(S){// he holds still for his move (the leap carries him), his body does not swing on its own meanwhile
  const k=t-S.t0;if(S.A.leap){const a=clamp((k-.85)/(S.A.hit-.85),0,1),s=a*a*(3-2*a);if(!MP.client){e.x=lerp(S.x,S.tx,s);e.z=lerp(S.z,S.tz,s)}}else if(!MP.client){e.x=S.x;e.z=S.z}
  e.a=S.a;if(!MP.client)e.swing=Math.max(e.swing||0,t-.2);
  if(!S.hit&&k>=S.A.hit){S.hit=true;if(!MP.client)nagHit(S,e)}
  if(k>S.A.hit+.9){NG.st=null;NG.next=t+lerp(2.4,4.8,clamp(e.hp/e.mhp,0,1))*(MP.on?.85:1)}return}
 if(MP.client||t<NG.next)return;const tp=mpTarget(e.x,e.z);if(!tp||tp.dead)return;const d=Math.hypot(tp.x-e.x,tp.z-e.z);if(d>70)return;
 let k;const r=Math.random();if(d>24)k=r<.55?'leap':'impale';else if(d<12)k=r<.4?'spin':r<.75?'cleave':'slam';else k=r<.35?'slam':r<.65?'impale':r<.85?'cleave':'leap';
 const a=Math.atan2(tp.x-e.x,tp.z-e.z);let tx=tp.x,tz=tp.z;if(k==='leap'){const L=W4.F.exit;tx=clamp(tx,L.x0+3,L.x1-3);tz=clamp(tz,L.z0+3,L.z1-3)}
 nagStart(NGAN.indexOf(k),e.x,e.z,a,tx,tz,t);try{mpFx('w4n',[NGAN.indexOf(k),R1(e.x),R1(e.z),R2(a),R1(tx),R1(tz)])}catch(_){}
 if(t>NG.taunt){NG.taunt=t+14;try{bossYell('NAGROCK',NGTAUNT[(NG.n++)%NGTAUNT.length])}catch(_){}}}
function nagStart(i,x,z,a,tx,tz,t){const k=NGAN[i|0]||'cleave',A=NGA[k];NG.st={k,A,x,z,a,tx,tz,t0:t,hit:false};nagWarn(NG.st)}
MPFX_DO.w4n=(P,a,t)=>{if(!Array.isArray(a)||!W4.F||!W4.F.nag)return;nagStart(+a[0],+a[1],+a[2],+a[3],+a[4],+a[5],clk.getElapsedTime())};
// where it lands (the same on every screen)
function nagArea(S){const A=S.A;if(A.shape==='circle'){const cx=A.leap?S.tx:S.x+Math.sin(S.a)*(A.dist||0),cz=A.leap?S.tz:S.z+Math.cos(S.a)*(A.dist||0);return {shape:'circle',cx,cz,r:A.r}}
 if(A.shape==='sector')return {shape:'sector',cx:S.x,cz:S.z,r:A.r,a:S.a,half:A.half};return {shape:'line',cx:S.x,cz:S.z,a:S.a,len:A.len,w:A.w}}
function inArea(G,px,pz){const dx=px-G.cx,dz=pz-G.cz;if(G.shape==='circle')return Math.hypot(dx,dz)<G.r;
 if(G.shape==='sector'){const d=Math.hypot(dx,dz);if(d>G.r)return false;if(d<2)return true;return Math.abs(Math.atan2(Math.sin(Math.atan2(dx,dz)-G.a),Math.cos(Math.atan2(dx,dz)-G.a)))<G.half}
 const ux=Math.sin(G.a),uz=Math.cos(G.a),along=dx*ux+dz*uz,side=Math.abs(dx*uz-dz*ux);return along>-1&&along<G.len&&side<G.w/2}
// the host: who got hit (a jump clears the Spin and the Slam's wave)
function nagHit(S,e){const G=nagArea(S),A=S.A,dmg=Math.round(A.dmg*(.8+.02*(W4.fl||20))*(L2.dmgIn||1));
 const each=(x,z,y,air,hurt)=>{let hit=inArea(G,x,z);if(A.jump&&air)hit=false;if(!hit&&A.wave&&!air){const d=Math.hypot(x-G.cx,z-G.cz);if(d>=G.r&&d<A.wave)hit=true;if(hit)return hurt(Math.round(dmg*.5))}if(hit)hurt(dmg)};
 if(deadT<=0)each(heroPos.x,heroPos.z,hero.position.y,jH>1.2||hero.position.y>towerH(heroPos.x,heroPos.z)+1.6,d=>hurtPlayer(d));
 if(MP.on&&MP.host)for(const id in MP.players){const p=MP.players[id],q=p.st;if(!q||q.dead)continue;each(q.x,q.z,q.y,(q.y||0)>towerH(q.x,q.z)+1.6,d=>mpOut(id,{k:'hurt',dmg:d}))}}
// ---- the warning on the ground (filling up until the blow), then the blast: drawn from the same numbers everywhere
const NGM={};function ngMat(c,o){const k=c+'|'+o;return NGM[k]||(NGM[k]=new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:o,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}))}
function ngShape(G,y,grow){const P=[];const tri=(a,b,c)=>P.push(a[0],y,a[1],b[0],y,b[1],c[0],y,c[1]);
 if(G.shape==='circle'||G.shape==='sector'){const a0=G.shape==='sector'?G.a-G.half:0,a1=G.shape==='sector'?G.a+G.half:Math.PI*2,n=G.shape==='sector'?24:48,r=G.r*grow;
  for(let i=0;i<n;i++){const u=a0+(a1-a0)*i/n,v=a0+(a1-a0)*(i+1)/n;tri([G.cx,G.cz],[G.cx+Math.sin(u)*r,G.cz+Math.cos(u)*r],[G.cx+Math.sin(v)*r,G.cz+Math.cos(v)*r])}}
 else{const ux=Math.sin(G.a),uz=Math.cos(G.a),L=G.len*grow,w=G.w/2,a=[G.cx-uz*w,G.cz+ux*w],b=[G.cx+uz*w,G.cz-ux*w],c=[b[0]+ux*L,b[1]+uz*L],d=[a[0]+ux*L,a[1]+uz*L];tri(a,b,c);tri(a,c,d)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));return g}
function nagWarn(S){const G=nagArea(S),y=towerH(G.cx,G.cz)+.25;const grp=new THREE.Group();grp.layers.set(1);
 const L0=G.shape==='line'?Object.assign({},G,{cx:0,cz:0,a:0}):Object.assign({},G,{cx:0,cz:0});
 const base=new THREE.Mesh(ngShape(L0,y,1),ngMat(0xff2a10,.22));const fill=new THREE.Mesh(ngShape(L0,y+.05,1),ngMat(0xff7a20,.4));base.layers.set(1);fill.layers.set(1);grp.add(base,fill);
 [base,fill].forEach(m=>{m.position.set(G.cx,0,G.cz);if(G.shape==='line')m.rotation.y=G.a});
 if(S.A.wave){const wv=new THREE.Mesh(ngShape({shape:'circle',cx:G.cx,cz:G.cz,r:S.A.wave},y-.02,1),ngMat(0xff2a10,.08));wv.layers.set(1);grp.add(wv)}
 world.add(grp);NG.fx.push({S,G,grp,base,fill,t0:clk.getElapsedTime(),y})}
function nagFxTick(t,dt){for(let i=NG.fx.length-1;i>=0;i--){const f=NG.fx[i],k=(t-f.t0)/f.S.A.hit;
  if(k<1){const s=Math.max(.02,k);if(f.G.shape==='line')f.fill.scale.set(1,1,s);else f.fill.scale.set(s,1,s);f.base.material=ngMat(0xff2a10,(Math.sin(t*14)>0?.28:.18))}
  else if(!f.boom){f.boom=t;f.grp.visible=false;nagBoom(f)}
  if(f.boom&&t-f.boom>1.2){if(f.grp.parent)f.grp.parent.remove(f.grp);f.grp.traverse(o=>{if(o.geometry)o.geometry.dispose()});NG.fx.splice(i,1)}}
 for(let i=NGB.length-1;i>=0;i--){const b=NGB[i],k=(t-b.t)/b.d;if(k>=1){if(b.m.parent)b.m.parent.remove(b.m);if(b.m.geometry)b.m.geometry.dispose();NGB.splice(i,1);continue}b.tk(b.m,k)}}
const NGB=[];
function nagBoom(f){const G=f.G,y=f.y,S=f.S;const add=(m,d,tk)=>{m.layers.set(1);world.add(m);NGB.push({m,t:clk.getElapsedTime(),d,tk})};   // every piece has its own shape: freed when it is done
 try{shake=Math.max(shake,Math.hypot(heroPos.x-G.cx,heroPos.z-G.cz)<40?1.4:.4)}catch(e){}
 if(G.shape==='line'){// a row of spikes out of the brick, then gone
  const n=Math.max(6,Math.round(G.len/2.4)),ux=Math.sin(G.a),uz=Math.cos(G.a);for(let i=0;i<n;i++){const s=new THREE.Mesh(new THREE.ConeGeometry(1.1,5.5,6),ngMat(i%2?0xffd080:0xff5020,.9));const d=1.5+i*(G.len-1.5)/n;
   s.position.set(G.cx+ux*d,y,G.cz+uz*d);s.rotation.set((Math.random()-.5)*.4,0,(Math.random()-.5)*.4);add(s,.9,(m,k)=>{const u=Math.min(1,k*6);m.scale.set(1,u*(1-Math.max(0,k-.7)/.3),1);m.position.y=y+2.6*u-1})}}
 else{// fire out of the ground: a flash disc, two rings racing out, embers
  const r=G.shape==='sector'?G.r:G.r;const disc=new THREE.Mesh(ngShape(G,y+.3,1),ngMat(0xffb040,.75));add(disc,.45,(m,k)=>{m.material=ngMat(0xffb040,+(.75*(1-k)).toFixed(2))});
  for(let j=0;j<2;j++){const ring=new THREE.Mesh(new THREE.TorusGeometry(1,.5,6,40),ngMat(j?0xffffff:0xff6a20,.9));ring.rotation.x=Math.PI/2;ring.position.set(G.cx,y+.6,G.cz);
   const R=S.A.wave||r;add(ring,.7+j*.15,(m,k)=>{m.scale.set(1+k*R,1+k*R,1);m.material=ngMat(j?0xffffff:0xff6a20,+(.9*(1-k)).toFixed(2))})}
  for(let j=0;j<10;j++){const p=new THREE.Mesh(new THREE.SphereGeometry(.5,6,5),ngMat(0xff8030,.9)),u=Math.random()*6.283,s=Math.random()*r;const x=G.cx+Math.sin(u)*s,z=G.cz+Math.cos(u)*s,vy=8+Math.random()*10;
   add(p,1,(m,k)=>{m.position.set(x,y+vy*k-9*k*k,z);m.scale.setScalar(1-k)})}}
 try{const d=Math.hypot(heroPos.x-G.cx,heroPos.z-G.cz);mechBoomSnd(Math.max(.15,1-d/90)*.9,0)}catch(e){}}
// the floor itself: lava light, embers and his name over the gate
function nagFloor(F){if(!F.nag)return;W4.ngLoad=true;NG.st=null;NG.next=clk.getElapsedTime()+6;nagLoad().catch(()=>{})}
// ---------------------------------------------------------------- floor 7, BOMB BUDDY BASEMENT (and 17, 27, ...): World 2's cigarette bombs
// live down here. They hunt you across their landing, spit lit cigarettes from fourteen paces, and when they run out of cigarettes they
// rush you and blow. Their boss, Big Fuse Daddy (the bomb's own model, three times the size), holds the gate and keeps calling buddies.
// The bombs are the game's own (the host runs them, the snapshot carries them to everyone), with three tower rules: once blown they never
// come back, they keep to their landing, and they doze until somebody comes within 34 paces. Every weapon, pet and mana move hits them.
function putBomb(x,z,hpK,o){l2AddBomb();const b=bombs[bombs.length-1];b.x=b.hx=x;b.z=b.hz=z;b.hp=Math.round(b.hp*(hpK||1));b.mhpW4=b.hp;b.w4=1;b.g.position.set(x,towerH(x,z),z);if(o)Object.assign(b,o);return b}
(function(){const bu=bombsUpdate;bombsUpdate=function(t,dt){if(!(W4.on&&W4.F))return bu(t,dt);const old=bombs.map(b=>[b.x,b.z]);
  if(!MP.client)for(const b of bombs){if(b.state==='gone')b.dead=t}   // (the game brings a blown bomb back six seconds after it went: never, up here)
  bu(t,dt);
  if(!MP.client)for(let i=0;i<bombs.length;i++){const b=bombs[i],o=old[i];if(!o||b.state==='gone')continue;
   let near=Math.hypot(heroPos.x-b.x,heroPos.z-b.z)<34;if(!near)for(const id in MP.players){const q=MP.players[id].st;if(q&&!q.dead&&Math.hypot(q.x-b.x,q.z-b.z)<34){near=true;break}}
   const h1=towerH(b.x,b.z),hw=towerH(o[0],o[1]);if(!near||h1<hw-2.4||h1>hw+2.4||h1<BASEH-24){b.x=o[0];b.z=o[1];b.g.position.set(b.x,h0(b),b.z)}}
  for(const b of bombs)if(b.mhpW4&&b.hpF){const k=Math.max(0,Math.min(1,b.hp/b.mhpW4));b.hpF.scale.x=Math.max(.001,k);b.hpF.position.x=-(1-k)*.6}}})();
// the tower's own weapons reach them too (the afro pick, the axe, the scythe; the shockwave; the coin barrage)
function bombsHit(x,z,r,dmg,t,front){let n=0;for(const b of bombs){if(!bombAlive(b))continue;const dx=b.x-x,dz=b.z-z,d=Math.hypot(dx,dz);if(d>r)continue;if(front&&d>1.2&&(dx*front[0]+dz*front[1])/d<.3)continue;damageBomb(b,dmg,t);n++}return n}
// Big Fuse Daddy's look: the bomb's model, scaled up, with its own clips (Walk, Rush, Spit when he swings, Idle)
function bigBombSkin(g){const P=bombProtoGet();const c=P.root.clone();c.scale.setScalar(BOMB.SCALE*2.1);c.traverse(o=>{if(o.isMesh){o.castShadow=true;o.frustumCulled=false}});g.add(c);
 const mx=new THREE.AnimationMixer(c),A={};P.clips.forEach(cl=>A[cl.name]=mx.clipAction(cl));if(A.Spit){A.Spit.setLoop(THREE.LoopOnce);A.Spit.clampWhenFinished=true}if(A.Explode){A.Explode.setLoop(THREE.LoopOnce);A.Explode.clampWhenFinished=true}
 let cur=null;const play=n=>{const a=A[n]||A.Idle;if(!a||a===cur)return;a.reset().play();if(cur)a.crossFadeFrom(cur,.15,false);cur=a};play('Idle');
 return (e,t,dt)=>{const sw=t-e.swing;play(e.hp<=0?'Explode':sw>=0&&sw<.9?'Spit':e.mvK?(e.spd>7?'Rush':'Walk'):'Idle');mx.update(dt)}}
// he calls buddies: a bomb out of nowhere at his side that rushes the nearest of you (the host; at most six of them at a time)
function bombBossTick(t,dt){const F=W4.F;if(!F||!F.bombs||MP.client)return;const e=enemies[W4.guardI];if(!e||e.hp<=0||e.skin!=='bigbomb')return;
 if(t<(W4.bbT||0))return;const tp=mpTarget(e.x,e.z);if(!tp||tp.dead||Math.hypot(tp.x-e.x,tp.z-e.z)>40){W4.bbT=t+1;return}
 const alive=bombs.filter(b=>b.buddy&&bombAlive(b)).length;W4.bbT=t+lerp(3.2,5.5,clamp(e.hp/e.mhp,0,1));if(alive>=6)return;
 const a=Math.random()*6.283,x=e.x+Math.sin(a)*5,z=e.z+Math.cos(a)*5;if(towerH(x,z)<BASEH-20)return;
 putBomb(x,z,1+.09*(F.n-1),{buddy:1,ammo:0,state:'rush'});if(t>(W4.bbY||0)){W4.bbY=t+14;try{bossYell('BIG FUSE DADDY',['GET HIM, BABY BOY!','THAT ONE IS MY FAVORITE. DO NOT TELL THE OTHERS.','BUDDY SYSTEM!','RUN IT!'][(W4.bbN=(W4.bbN|0)+1)%4])}catch(_){}}}
// ---------------------------------------------------------------- floor 11, THE BARBERSHOP GAUNTLET (and 21, 31, ...): Lord Belly, World 1's own
// boss, retired from the swamp and cutting hair. His look is the game's Belly Lord rig (the one World 2's minis are cloned from), walking
// his heavy walk and raising his arm for the slam when he swings.
function bellySkin(g){const m=cloneBossRig(miniProtoGet());m.g.position.set(0,0,0);m.g.rotation.set(0,0,0);m.g.scale.setScalar(1);m.mini=true;m.stepT=0;m.g.updateMatrixWorld(true);
 let h=0;try{const bb=new THREE.Box3().setFromObject(m.g);h=bb.max.y-bb.min.y}catch(e){}m.g.scale.setScalar(h>.5?8.4/h:(typeof MINI_SC!=='undefined'?MINI_SC:.4));
 m.g.traverse(o=>{o.layers.set(1);if(o.isMesh){o.castShadow=true;o.frustumCulled=false}});g.add(m.g);
 return (e,t,dt)=>{try{bellyWalk(m,t,!!e.mvK,t-(e.swing||-9))}catch(_){}}}
// ---------------------------------------------------------------- the tower saga, on the intercom: Da Nag Dabloon talks to you from the
// lobby as you climb (he "installed an intercom on every floor"), and between his jokes the story moves: his tenants, his rivals, his hoes
// at the top, and the thing up there that he keeps almost telling you about. The same lines on every screen (it is the floor that speaks).
const INTERCOM={
 1:'Testing, testing. This thing on? It is your boy, Da Nag Dabloon, on the intercom. I put one on every floor. Well. I paid a guy. Same thing.',
 2:'That is the 78th Lil Nag Brigade on floor two. They rent month to month. They have never paid a month.',
 3:'Heads up: floor three is a church. Do not press the buttons. The last guy pressed the buttons. We do not talk about the last guy.',
 5:'That bird? I do not know how it got in. I DO know it does not pay rent.',
 6:'The Zombie Samurai was my very first tenant. He paid in exposure. I died a little. He died a lot.',
 7:'The basement is full of bombs. They are family. Their family. Not mine. Mine is gold.',
 8:'The Nago Wizard used to work for me. Then he read the fine print. Now he wants a raise. In power. Is that a thing? That sounds like a thing.',
 9:'Floor nine is... crowded. Somebody up there bought a copier. I am not saying it was me. I am saying I have a receipt.',
 10:'You met... you? That is a lot. Take a potion. Take two. Do not ask future you about money. I asked. He said "buy doubloons." Smart man.',
 11:'Lord Belly retired from the swamp and opened a barbershop up here. He gave me a lineup. I am solid gold. You cannot line up gold. He found a way.',
 12:'I hear the boss lounge is fully booked. I booked it. For you. Mistakes were made.',
 13:'Stairs. Six floors of stairs. Ma does not believe in elevators. Ma does not believe in a lot of things. Me, mostly.',
 15:'Somebody planted a swamp on fifteen. I did not approve a swamp. I approved a "garden". Same guy who did the intercom.',
 16:'The Brigade opened a second office. They call it the Annex. I call it the same guys, one floor up, twice the attitude.',
 17:'Quick update on my hoes: still stuck. Still at the top. Still texting me. All caps. Every one of them.',
 21:'Twenty-one is a maze. I did not order a maze. I ordered walls. The guy kept building walls. He is still in there somewhere.',
 27:'Lost and Found. Everything anybody ever dropped in this tower ends up on twenty-seven. Including, apparently, you.',
 36:'The Hedge of Allegiance. It is bricks, not hedges. The hedges died. Everything that was alive on that floor is now bricks. Do not ask.',
 22:'Floor twenty-two is the Treasury. Every coin in here is mine. Every coin you pick up in here is... also mine. We will settle up at the top.',
 24:'Lights out on twenty-four. The bill was four doubloons. FOUR. I have four doubloons. I just do not have them on me.',
 28:'The Gauntlet. One bridge, no railings. The railings were extra. Everything is extra. I am extra.',
 29:'The Ballroom. My cousins have been dancing in there since the grand opening. There was no grand opening. They started early.',
 32:'They finally built the elevator. It is a tiki. It has a face. It is named Otis. Do not press his buttons. Do NOT press his buttons.',
 34:'Ma moved her kitchen up here after... the thing you did at her house. She is cooking. Eat something. Eat FAST.',
 38:'There are three of you on thirty-eight. I only let ONE of you in. Somebody is sneaking around with a time door. ...It was the Wizard.',
 39:'Nagrock plays forty. These two open for him. I am not saying go easy. I am saying they signed a two-floor contract and I need them alive for the encore.',
 20:'Nagrock? NAGROCK? I thought he was banished to the abyss. Turns out the abyss has an exit. Who built that? ...I built that.',
 25:'Quarter of the way up. You are doing great. I mean that. I have money on you. Supreme Big Nag Eastside bet against you. He bet a crown.',
 30:'Thirty floors. You know what is on floor thirty? Same as twenty-nine, but higher. Keep going.',
 35:'If you see Propeller Pete, tell him the elevator is not coming. It was never coming. The elevator was a feeling.',
 40:'Floor forty. The elevator is still under construction. It has been under construction since I built the tower. That is the business model.',
 45:'My cousin Penny says you have been picking us up off the floor and spending us. That is fine. That is literally what we are for. Still weird.',
 50:'HALFWAY! True story: a man once climbed this tower with nothing but an afro and a dream. Made it to fifty. Went back down for snacks. Do not be that man.',
 55:'Supreme Big Nag Eastside wants his crown back from the bet. I told him the bet is not over. He told me some words. Brigade words.',
 60:'My hoes say hi. Also they say hurry up. Also they say bring snacks. I am just the messenger. A very rich messenger.',
 65:'Fun fact: the bricks get more expensive the higher you go. Not because they are better. Because they are higher. That is called real estate.',
 70:'Seventy. Even the guardians up here have guardians. It is guardians all the way up.',
 75:'Something you should know about the top. It is not what you think. It is better. ...I said too much. Forget I said that. Unless you are saving doubloons. Then remember it.',
 80:'Floor eighty. Nagrock again? That man does a farewell tour every twenty floors. He is never leaving.',
 85:'Your bag is heavy. Your heart is heavy. My tower is heavy. That is why it has so many floors. Structural.',
 90:'Ten floors left. My hoes can see you from the window. They are waving. Wave back. ...Do NOT wave back, there is a guy with a scythe behind you.',
 95:'Save your doubloons. I am serious now. Look at my face. This is my serious face. It is gold. It is always this face.',
 99:'Last floor before the top. Whatever happens up there... I am proud of you. Also, you owe me for the intercom.'};
function radio(n){const s=INTERCOM[n];if(!s)return;const F=W4.F;setTimeout(()=>{if(W4.F!==F||!W4.on)return;let el=$('w4radio');if(!el){el=document.createElement('div');el.id='w4radio';document.body.appendChild(el)}
  el.innerHTML='<div class="who">📻 Da Nag Dabloon <span>(on the intercom)</span></div><div class="say">'+esc4(s)+'</div>';el.classList.remove('show');void el.offsetWidth;el.classList.add('show');clearTimeout(W4.radioT);W4.radioT=setTimeout(()=>el.classList.remove('show'),Math.max(7000,s.length*75))},5200)}
// ---------------------------------------------------------------- THE LOOK (the owner, Oct 21 05:57: "all the levels should have the same texture and
// everything else quality as all the previously made stuff"). The tower's outside is World 1's own kind of ground: a painted heightfield with
// the swamp's ground pictures, a lake with the reflecting water, grass blades, ferns, flowers, bushes, trees and rocks built from the very
// same shapes and wind-blown materials as the swamp (the page's inst/cardGeo/foliageMat helpers). Inside, every floor is dressed: carpet
// runners with gold borders, stone pillars with gold capitals, banners, chandeliers of candles, heaps of doubloons, barrels and crates,
// embers rising out of the abyss and dust drifting in the window light. Everything that repeats is instanced (one draw per shape).
const LOOK={grassM:null,fernM:null,tufts:null,fernG:null,trees:null,dust:null,embers:null,gold:null};
function lookMats(){if(LOOK.grassM)return;LOOK.grassM=foliageMat(TEX.grass,TEX.grassA,WP.grass);LOOK.fernM=foliageMat(TEX.fern,TEX.fernA,WP.fern);
 LOOK.tufts=cardGeo([0,1,2].map(k=>{const a=k*Math.PI/3;return{c:[0,.55,0],n:[Math.cos(a),0,Math.sin(a)],ln:[0,1,0],up:[0,1,0],s:1.15,v:[.45,1]}}));
 LOOK.fernG=shade(quadGeo([0,1,2,3,4,5].map(k=>{const a=k/6*6.28,c=Math.cos(a),s=Math.sin(a);return[[0,.2,0],[c*.25,.3,s*.25],[c*1.1,.9,s*1.1],[c*.0,1.0,s*.0]]})));
 const barkM=new THREE.MeshStandardMaterial({map:TEX.bark,normalMap:TEX.barkN,normalScale:new THREE.Vector2(.9,.9),roughness:.95,metalness:0,envMapIntensity:.45});
 const barkOf=(hex,p)=>{const m=barkM.clone();m.color.setHex(hex);return p?windify(m,p):m};const leafOf=p=>foliageMat(TEX.leaf,TEX.leafA,p),needleOf=p=>foliageMat(TEX.needle,TEX.needleA,p);
 const branch=(len,r,tilt,rotY,yb,out=0)=>new THREE.CylinderGeometry(r*.5,r,len,6).translate(0,len/2,0).rotateZ(tilt).rotateY(rotY).translate(Math.cos(rotY)*out,yb,-Math.sin(rotY)*out);
 LOOK.trees={
  oak:{bark:barkOf(0xa07850,WP.oak),leaf:leafOf(WP.oak),trunk:new THREE.CylinderGeometry(.45,.85,3.6,10).translate(0,1.8,0),parts:[0,1,2,3].map(k=>new THREE.CylinderGeometry(.12,.32,1.3,5).rotateZ(1.2).rotateY(k*1.57+.4).translate(0,.3,0)).concat([branch(2.8,.28,.9,0,3.0),branch(2.6,.26,-.95,2.1,3.1),branch(2.4,.24,.8,4.2,3.4),branch(2.0,.2,-.5,1.0,4.0)]),
   canopy:cardGeo(sphereCardList([[0,5.6,0,2.3],[2.1,4.8,.5,1.7],[-1.9,4.9,-1.0,1.6],[.6,4.5,1.9,1.5],[-.5,6.8,-.3,1.4],[-1.2,4.3,1.5,1.3],[1.4,6.2,-1.3,1.2]],4.2,901)),cols:[0x4f8f3a,0x5aa044,0x66a84a,0x468a38]},
  maple:{bark:barkOf(0x9a948c,WP.maple),leaf:leafOf(WP.maple),trunk:new THREE.CylinderGeometry(.3,.5,3.8,9).translate(0,1.9,0),parts:[branch(2.2,.18,.7,.5,3.4),branch(2.0,.16,-.8,2.6,3.5),branch(1.8,.15,.6,4.4,3.6)],
   canopy:cardGeo(sphereCardList([[0,5.4,0,2.4,.7],[1.6,4.6,.8,1.7,.7],[-1.5,4.7,-.8,1.6,.7],[.3,6.4,-.4,1.4,.7],[-.9,4.2,1.4,1.3,.7],[1.2,6.0,-1.2,1.2,.7],[-1.4,5.9,.9,1.1,.7]],4.4,902)),cols:[0xd8502e,0xe86a30,0xf09a3a,0xc83a2a,0xf0a84a]},
  spr:{bark:barkOf(0x8a6a4e,WP.spr),leaf:needleOf(WP.spr),trunk:new THREE.CylinderGeometry(.18,.36,3.0,7).translate(0,1.5,0),parts:[],canopy:cardGeo(coneCardList([0,1,2,3,4,5].map(k=>[2.0+k*1.25,2.2,2.1-k*.3]),3.6,904)),cols:[0x2f6a48,0x376f50,0x3f7a58]}};
 LOOK.bush=cardGeo(sphereCardList([[0,.55,0,.95],[.6,.5,.3,.62],[-.5,.55,-.3,.58]],6.5,907));LOOK.bushM=leafOf(WP.bush);
 LOOK.rockM=new THREE.MeshStandardMaterial({map:TEX.rock,normalMap:TEX.rockN,normalScale:new THREE.Vector2(1,1),roughness:.92,metalness:0,flatShading:true,color:0xa3aba1});
 // (these shapes are built once and used every time you are outside: never freed)
 [LOOK.tufts,LOOK.fernG,LOOK.bush].forEach(g=>{g.userData.shared=1});for(const k in LOOK.trees){const Tq=LOOK.trees[k];[Tq.trunk,Tq.canopy].concat(Tq.parts).forEach(g=>{g.userData.shared=1})}}
// ---- the outside: World 1's kind of ground round the tower, a lake, and the plants of the swamp
function outsideLook(G){lookMats();W4.outFlames=[];const r=srand(4242),n1=noise2(77),n2=noise2(78),n3=noise2(79);const TZ=-150,TR=70;const fbm=(n,x,y,o)=>{let a=0,amp=1,f=1,nm=0;for(let k=0;k<(o||4);k++){a+=n(x*f,y*f)*amp;nm+=amp;amp*=.5;f*=2}return a/nm};
 const lake={x:-125,z:-20,r:46},plazaR=62;const pd=(x,z)=>Math.hypot(x,z+12);
 const H=(x,z)=>{const d=pd(x,z),dt=Math.hypot(x,z-TZ);let y=(fbm(n1,x*.012+3,z*.012+3,4)-.45)*9+fbm(n2,x*.08,z*.08,3)*.9;
  y+=Math.max(0,(Math.hypot(x,z)-300)*.06);   // hills rising towards the edge of the world
  y*=1-smooth(plazaR+26,plazaR,d);y*=1-smooth(TR+34,TR+6,dt);   // flat round the plaza and the tower
  const dl=Math.hypot(x-lake.x,z-lake.z);y=Math.min(y,lerp(y,WL-2.6,smooth(lake.r,lake.r*.3,dl)));return y};
 W4.outH=H;
 // the ground: painted like the swamp (grass, moss, mud in the hollows, dirt on the slopes, sand by the water), the swamp's ground pictures on top
 const SZ=1100,SEG=200,geo=new THREE.PlaneGeometry(SZ,SZ,SEG,SEG);geo.rotateX(-Math.PI/2);geo.translate(0,0,-60);const P=geo.attributes.position,col=[];
 const gC=T.grass.map(c=>new THREE.Color(c)),mossC=new THREE.Color(T.moss),mudC=new THREE.Color(T.mud),dirtC=new THREE.Color(T.dirt),sandC=new THREE.Color(T.sand),cobC=new THREE.Color(0x9a9488);
 for(let i=0;i<P.count;i++){const x=P.getX(i),z=P.getZ(i),y=H(x,z);P.setY(i,y);const slope=(Math.abs(H(x+1.2,z)-y)+Math.abs(H(x,z+1.2)-y))/1.2;
  let c=gC[Math.abs(Math.floor((n3(x*.03,z*.03)+1)*7))%gC.length].clone();c.lerp(mossC,smooth(.45,.7,n2(x*.08+9,z*.08+9)));c.lerp(mudC,smooth(.55,.8,n1(x*.04+30,z*.04+30))*smooth(1.5,-.5,y));
  c.lerp(dirtC,smooth(.5,1.1,slope));if(y<WL+1.4)c.lerp(sandC,smooth(WL+1.4,WL+.2,y));c.lerp(cobC,smooth(plazaR+3,plazaR-2,pd(x,z)));c.multiplyScalar(1.02+n2(x*.3,z*.3)*.3);col.push(c.r,c.g,c.b)}
 geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));geo.computeVertexNormals();
 const ground=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,map:TEX.ground,normalMap:TEX.groundN,normalScale:new THREE.Vector2(.85,.85),roughness:.96,metalness:0,envMapIntensity:.4}));ground.receiveShadow=true;G.add(ground);
 // the plaza: cobbles with a gold ring, a cobbled path to the door
 const sm=stoneSet();const cobM=new THREE.MeshStandardMaterial({map:(()=>{const t=sm.map.clone();t.needsUpdate=true;t.repeat.set(30,30);return t})(),normalMap:(()=>{const t=sm.nm.clone();t.needsUpdate=true;t.repeat.set(30,30);return t})(),color:0xb0a898,roughness:.82,metalness:0,envMapIntensity:.35});
 const pl=new THREE.Mesh(new THREE.CircleGeometry(plazaR,72),cobM);pl.rotation.x=-Math.PI/2;pl.position.set(0,.06,-12);pl.receiveShadow=true;G.add(pl);
 const path=new THREE.Mesh(new THREE.PlaneGeometry(14,TR+30),cobM);path.rotation.x=-Math.PI/2;path.position.set(0,.07,TZ+TR+15);path.receiveShadow=true;G.add(path);
 const gold=new THREE.MeshStandardMaterial({color:0xd9a425,metalness:1,roughness:.3,envMapIntensity:1.2});const ring=new THREE.Mesh(new THREE.RingGeometry(plazaR-3.2,plazaR-2.2,72),gold);ring.rotation.x=-Math.PI/2;ring.position.set(0,.1,-12);G.add(ring);
 const ring2=new THREE.Mesh(new THREE.RingGeometry(9,10,48),gold);ring2.rotation.x=-Math.PI/2;ring2.position.set(0,.1,-12);G.add(ring2);
 // a low stone wall round the plaza with lanterns on its posts
 const stoneM=stoneMat();for(let k=0;k<36;k++){const a=k/36*6.283;if(Math.abs(Math.sin(a))<.12&&Math.cos(a)<0)continue;   // open towards the door
  const x=Math.sin(a)*(plazaR+4),z=-12+Math.cos(a)*(plazaR+4);const w=new THREE.Mesh(new THREE.BoxGeometry(10.4,1.6,1.2),stoneM);w.position.set(x,H(x,z)+.8,z);w.rotation.y=a;w.castShadow=w.receiveShadow=true;G.add(w);
  if(k%6===0){const p=new THREE.Mesh(new THREE.BoxGeometry(1.6,4.2,1.6),stoneM);p.position.set(x,H(x,z)+2.1,z);G.add(p);const l=new THREE.Mesh(new THREE.SphereGeometry(.55,10,8),new THREE.MeshBasicMaterial({color:0xffd27a,toneMapped:false}));l.position.set(x,H(x,z)+4.9,z);G.add(l)}}
 // the water: the swamp's reflecting water (the lake sits below it; the ground hides it everywhere else)
 try{if(typeof setupWater==='function'&&!water&&!waterMesh)setupWater();if(water)water.visible=true;if(waterMesh)waterMesh.visible=true}catch(e){console.warn('tower water',e)}
 // the plants: the swamp's own shapes (instanced, wind-blown), nothing on the plaza, the path or in the lake
 const items={grass:[],fern:[],flower:[],bush:[],rock:[],cattail:[],oak:[],maple:[],spr:[]};const ok=(x,z,minY,minD)=>{const y=H(x,z);return y>minY&&pd(x,z)>plazaR+(minD||2)&&Math.hypot(x,z-TZ)>TR+6&&!(Math.abs(x)<9&&z<-40&&z>TZ)};
 const rndIn=R=>{const d=Math.sqrt(r())*R,a=r()*6.283;return [Math.sin(a)*d,-60+Math.cos(a)*d]};const GRASS_C=[0xa9c86a,0x93b85a,0xbcd27c];
 {const patches=[];for(let k=0;k<60;k++){const [x,z]=rndIn(330);patches.push([x,z,8+r()*16])}
  for(let i=0;i<7000;i++){let x,z;if(r()<.7){const p=patches[(r()*patches.length)|0];const a=r()*6.283,d=Math.sqrt(r())*p[2];x=p[0]+Math.sin(a)*d;z=p[1]+Math.cos(a)*d}else[x,z]=rndIn(340);if(!ok(x,z,WL+.5))continue;items.grass.push([x,H(x,z),z,r()*6.283,.7+r()*.8,GRASS_C[(r()*3)|0],.9+r()*1.2])}}
 for(let i=0;i<380;i++){const [x,z]=rndIn(340);if(!ok(x,z,WL+.7))continue;items.fern.push([x,H(x,z),z,r()*6.283,.8+r()*.9,[0x3f7a30,0x4a8a3a,0x5a9a44][(r()*3)|0]])}
 for(let i=0;i<320;i++){const [x,z]=rndIn(300);if(!ok(x,z,WL+.8))continue;items.flower.push([x,H(x,z),z,r()*6.283,.8+r()*.7,T.flower[(r()*T.flower.length)|0]])}
 for(let i=0;i<200;i++){const [x,z]=rndIn(340);if(!ok(x,z,WL+.8,6))continue;items.bush.push([x,H(x,z),z,r()*6.283,.7+r()*.9,T.leaf[(r()*T.leaf.length)|0]])}
 for(let i=0;i<90;i++){const [x,z]=rndIn(380);if(!ok(x,z,WL-2,4))continue;items.rock.push([x,H(x,z)-.3,z,r()*6.283,.6+r()*1.8,undefined,.6+r()*.9])}
 for(let i=0;i<260;i++){const [x,z]=rndIn(360);const y=H(x,z);if(y>WL-.3&&y<WL+1.1)items.cattail.push([x,y,z,r()*6.283,.8+r()*.6])}
 for(let i=0;i<170;i++){const [x,z]=rndIn(370);if(!ok(x,z,WL+1,12))continue;const y=H(x,z),s=.9+r()*.8,t=r();if(y>24)continue;const near=Math.hypot(x-lake.x,z-lake.z)<lake.r+14;
  if(t<.3||y>12)items.spr.push([x,y,z,r()*6.283,s,LOOK.trees.spr.cols[(r()*3)|0]]);else if(t<.62)items.maple.push([x,y,z,r()*6.283,s,LOOK.trees.maple.cols[(r()*5)|0]]);else items.oak.push([x,y,z,r()*6.283,s*(near?.9:1),LOOK.trees.oak.cols[(r()*4)|0]])}
 const noCol=a=>a.map(it=>[it[0],it[1],it[2],it[3],it[4],undefined,it[6]]);const before=new Set(world.children);const put=m=>m;
 instLayer=1;
 for(const k of ['oak','maple','spr']){const Tq=LOOK.trees[k],L=items[k];if(!L.length)continue;put(inst(Tq.trunk,Tq.bark,noCol(L)));Tq.parts.forEach(g=>put(inst(g,Tq.bark,noCol(L))));put(inst(Tq.canopy,Tq.leaf,L))}
 put(inst(LOOK.bush,LOOK.bushM,items.bush));put(inst(LOOK.fernG,LOOK.fernM,items.fern,false));put(inst(LOOK.tufts,LOOK.grassM,items.grass,false));
 put(inst(new THREE.CylinderGeometry(.03,.03,.6,4).translate(0,.3,0),windStd(0x4c8a3a,WP.flower),items.flower,false));put(inst(shade(new THREE.SphereGeometry(.17,6,5).translate(0,.65,0)),windStd({vertexColors:true,roughness:.72},WP.flower),items.flower,false));
 put(inst(new THREE.DodecahedronGeometry(1,0).scale(1.2,.7,1),LOOK.rockM,items.rock));
 put(inst(new THREE.CylinderGeometry(.03,.04,1.6,4).translate(0,.8,0),windStd(0x6a7a3a,WP.cattail),items.cattail,false));put(inst(new THREE.CylinderGeometry(.08,.08,.4,6).translate(0,1.65,0),windStd(0x5a3a22,WP.cattail),items.cattail,false));
 instLayer=0;
 // (inst adds its draws to the world itself: move them into the outside group, so leaving the outside clears them with everything else)
 const sweep=()=>{world.children.filter(o=>!before.has(o)&&o!==G).forEach(o=>{world.remove(o);G.add(o);before.add(o)})};sweep();
 // the tower's foot: ivy climbing the brick, buttresses, two torches at the door, a stone stair
 const ivy=[];for(let i=0;i<170;i++){const a=Math.PI+(r()-.5)*2.6,h=2+r()*38,x=Math.sin(a)*(TR*1.045+.3),z=TZ+Math.cos(a)*(TR*1.045+.3);if(Math.abs(x)<13&&h<30)continue;ivy.push([x,h,z,a,1.1+r()*1.1,T.leaf[(r()*T.leaf.length)|0]])}
 {const g=cardGeo([0,1].map(k=>({c:[0,0,0],n:[Math.sin(k*1.3),.2,Math.cos(k*1.3)],ln:[0,1,0],up:[0,1,0],s:2.2,v:[.5,1]})));instLayer=1;inst(g,LOOK.bushM,ivy,false);instLayer=0;sweep()}
 for(let k=0;k<10;k++){const a=k/10*6.283;if(Math.abs(a-Math.PI)<.5)continue;const b=new THREE.Mesh(new THREE.BoxGeometry(5,30,7),stoneM);b.position.set(Math.sin(a)*(TR*1.05+2),15,TZ+Math.cos(a)*(TR*1.05+2));b.rotation.y=a;b.castShadow=b.receiveShadow=true;G.add(b)}
 [-1,1].forEach(s=>{const tg=new THREE.Group();tg.position.set(s*14,0,TZ+TR+1.5);const pole=new THREE.Mesh(new THREE.CylinderGeometry(.3,.4,9,8),stoneM);pole.position.y=4.5;tg.add(pole);const fl=new THREE.Mesh(new THREE.ConeGeometry(.9,2.6,8),new THREE.MeshBasicMaterial({color:0xffa030,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));fl.position.y=10.2;tg.add(fl);W4.outFlames=(W4.outFlames||[]).concat([fl]);
  const L=new THREE.PointLight(0xffa050,2.2,60,1.5);L.position.y=10.5;tg.add(L);G.add(tg)});
 for(let i=0;i<3;i++){const st=new THREE.Mesh(new THREE.BoxGeometry(30-i*4,1.2,3),stoneM);st.position.set(0,.6+i*1.1,TZ+TR+8-i*3);st.receiveShadow=true;G.add(st)}
 G.traverse(o=>{o.layers.set(1)})}
function outsideH(x,z){return W4.outH?W4.outH(x,z):0}
// ---- inside: the dressing of a floor
function clothTex(hex){const k='cl'+hex;if(TXC[k])return TXC[k];const c=cvs(256);const g=c.getContext('2d');const C=new THREE.Color(hex);g.fillStyle='#'+C.getHexString();g.fillRect(0,0,256,256);
 const d=g.getImageData(0,0,256,256),p=d.data;for(let i=0;i<p.length;i+=4){const v=(Math.random()-.5)*26,w=((i/4)%256)%4<2?6:-6;p[i]=Math.max(0,Math.min(255,p[i]+v+w));p[i+1]=Math.max(0,Math.min(255,p[i+1]+v*.6));p[i+2]=Math.max(0,Math.min(255,p[i+2]+v*.6))}g.putImageData(d,0,0);
 g.strokeStyle='rgba(255,210,90,.9)';g.lineWidth=10;g.strokeRect(6,6,244,244);g.strokeStyle='rgba(255,230,140,.5)';g.lineWidth=3;g.strokeRect(20,20,216,216);
 const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.wrapS=t.wrapT=THREE.RepeatWrapping;return TXC[k]=t}
function bannerTex(hex){const k='bn'+hex;if(TXC[k])return TXC[k];const c=cvs(128);c.height=256;const g=c.getContext('2d');const C=new THREE.Color(hex);g.fillStyle='#'+C.getHexString();g.fillRect(0,0,128,256);
 g.fillStyle='rgba(0,0,0,.18)';for(let y=0;y<256;y+=8)g.fillRect(0,y,128,3);g.strokeStyle='#d9a425';g.lineWidth=6;g.strokeRect(6,6,116,244);g.fillStyle='#ffc83a';g.beginPath();g.arc(64,110,34,0,6.283);g.fill();g.fillStyle='#'+C.getHexString();g.font='900 44px Impact,system-ui';g.textAlign='center';g.fillText('$',64,126);
 g.fillStyle='#d9a425';g.beginPath();g.moveTo(0,256);g.lineTo(64,214);g.lineTo(128,256);g.fill();const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return TXC[k]=t}
function floorLook(F,G){const r=srand(F.seed*31+F.n*977+5);const th=F.th,sm=stoneMat();const gold=new THREE.MeshStandardMaterial({color:0xd9a425,metalness:1,roughness:.28,envMapIntensity:1.3});
 const carpetHex=F.dress==='ballroom'?0x2a1050:th.n==='royal'?0x3a1060:th.n==='nagrock'?0x1a0a0a:th.n==='soot'?0x5a1414:0x7a1212;const cm=new THREE.MeshStandardMaterial({map:clothTex(carpetHex),roughness:.92,metalness:0});
 // carpet runners down the middle of every landing, pillars at the corners of the big ones, a gold ring in the centre of the plazas
 const pillars=[],caps=[],coins=[],crates=[],barrels=[],cands=[],chand=[],bars=[];
 F.P.forEach(p=>{const w=p.x1-p.x0,d=p.z1-p.z0;if(w<8||d<8)return;const cw=Math.min(6,w*.3);const big=!!p.wide,run=!big||['motor','arena','market','chapel'].includes(p.wide);   // (a big floor's districts dress themselves: the runner only down the Motor Pool, the Market, the Chapel and the Arena)
  if(run){const cg=new THREE.PlaneGeometry(cw,d-2);{const uv=cg.attributes.uv,rep=Math.max(1,Math.round((d-2)/cw));for(let i=0;i<uv.count;i++)uv.setY(i,uv.getY(i)*rep)}const c=new THREE.Mesh(cg,cm);
  c.rotation.x=-Math.PI/2;c.position.set((p.x0+p.x1)/2,p.top+.04,(p.z0+p.z1)/2);c.receiveShadow=true;G.add(c)}
  if(p.kind==='plaza'||p.kind==='exit'||p.kind==='entry'){const px=[p.x0+2.2,p.x1-2.2],pz=[p.z0+2.2,p.z1-2.2];px.forEach(x=>pz.forEach(z=>{if(Math.abs(x-(p.x0+p.x1)/2)<4)return;pillars.push([x,p.top,z,0,1]);caps.push([x,p.top+9.2,z,0,1]);cands.push([x,p.top+9.6,z,0,1])}));
   if(p.kind==='plaza'){const n=big?0:3+((r()*4)|0);for(let k=0;k<n;k++){const x=lerp(p.x0+2,p.x1-2,r()),z=lerp(p.z0+2,p.z1-2,r());if(Math.abs(x-(p.x0+p.x1)/2)<cw/2+.6)continue;const m=(r()*3)|0;if(m===0)barrels.push([x,p.top,z,r()*6.283,1]);else if(m===1)crates.push([x,p.top+.9,z,r()*6.283,1]);else{const nn=8+((r()*14)|0);for(let q=0;q<nn;q++){const a=r()*6.283,dd=r()*1.6;coins.push([x+Math.sin(a)*dd,p.top+.1+r()*.9*(1-dd/1.6),z+Math.cos(a)*dd,r()*6.283,1])}}}
    chand.push([(p.x0+p.x1)/2,p.top+14+r()*4,(p.z0+p.z1)/2,0,1])}
   if(F.dress==='ballroom'){if(p.kind!=='plaza')chand.push([(p.x0+p.x1)/2,p.top+14,(p.z0+p.z1)/2,0,1]);for(let z=p.z0+4;z<p.z1-3;z+=4){cands.push([p.x0+1.2,p.top+.9,z,0,1]);cands.push([p.x1-1.2,p.top+.9,z,0,1])}}
   if(F.dress==='treasure'){const n=5+((r()*4)|0);for(let k=0;k<n;k++){const x=lerp(p.x0+3,p.x1-3,r()),z=lerp(p.z0+3,p.z1-3,r());if(Math.abs(x-(p.x0+p.x1)/2)<cw/2+1)continue;const nn=18+((r()*26)|0);for(let q=0;q<nn;q++){const a=r()*6.283,dd=r()*2.4;coins.push([x+Math.sin(a)*dd,p.top+.1+r()*1.6*(1-dd/2.4),z+Math.cos(a)*dd,r()*6.283,1])}
     if(r()<.7){const nb=3+((r()*5)|0),bx=x+(r()-.5)*4,bz=z+(r()-.5)*4;for(let q=0;q<nb;q++)bars.push([bx+(q%2)*.7-.35,p.top+.22+Math.floor(q/2)*.44,bz+(r()-.5)*.2,(q%2?.1:0)+(r()-.5)*.2,1])}}}}});
 const put=(geo,mat,items,shadow)=>{if(!items.length)return null;const before=new Set(world.children);instLayer=1;const m=inst(geo,mat,items,shadow!==false);instLayer=0;world.children.filter(o=>!before.has(o)).forEach(o=>{world.remove(o);G.add(o)});return m};
 put(new THREE.CylinderGeometry(.9,1.1,9.2,12).translate(0,4.6,0),sm,pillars);put(new THREE.CylinderGeometry(1.4,1.0,.8,12).translate(0,.4,0),gold,caps);
 put(new THREE.ConeGeometry(.45,1.4,7).translate(0,.9,0),new THREE.MeshBasicMaterial({color:0xffb040,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),cands,false);
 put(new THREE.CylinderGeometry(.42,.42,.08,14),gold,coins,false);put(new THREE.BoxGeometry(1.3,.42,.62),gold,bars,false);
 if(F.dress==='garden')try{gardenLook(F,G,put,r)}catch(e){console.warn('garden',e)}
 const plank=new THREE.MeshStandardMaterial({map:TEX.plank,normalMap:TEX.plankN,roughness:.8,metalness:0});put(new THREE.BoxGeometry(1.8,1.8,1.8),plank,crates);put(new THREE.CylinderGeometry(.8,.9,2.2,12).translate(0,1.1,0),plank,barrels);
 put(new THREE.TorusGeometry(.95,.1,6,16).translate(0,1.1,0),new THREE.MeshStandardMaterial({color:0x2c2622,metalness:.85,roughness:.45}),barrels,false);
 // chandeliers: a gold ring of candles on a chain, swinging ever so slightly
 if(chand.length){const cg=new THREE.Group();const ring=new THREE.TorusGeometry(2.6,.14,6,24);const cm2=new THREE.CylinderGeometry(.04,.04,30,4).translate(0,15,0);
  put(ring,gold,chand,false);put(cm2,new THREE.MeshStandardMaterial({color:0x2c2622,metalness:.85,roughness:.45}),chand,false);
  const cnd=[];chand.forEach(c=>{for(let k=0;k<8;k++){const a=k/8*6.283;cnd.push([c[0]+Math.sin(a)*2.6,c[1]+.15,c[2]+Math.cos(a)*2.6,0,.7])}});put(new THREE.CylinderGeometry(.08,.08,.7,6).translate(0,.35,0),new THREE.MeshStandardMaterial({color:0xf1e6cf,roughness:.6}),cnd,false);
  put(new THREE.ConeGeometry(.3,.9,6).translate(0,1.1,0),new THREE.MeshBasicMaterial({color:0xffc060,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),cnd,false);
  const glow=new THREE.SpriteMaterial({map:TEX.glare,color:0xffb050,transparent:true,opacity:.45,depthWrite:false,blending:THREE.AdditiveBlending});chand.forEach(c=>{const s=new THREE.Sprite(glow);s.scale.set(14,14,1);s.position.set(c[0],c[1]+.6,c[2]);G.add(s)})}
 // banners on the hall walls, between the torches, and arches over the windows (instanced: one draw for the cloth, one for the rods, one for the arches)
 const bt=bannerTex(carpetHex===0x1a0a0a?0x3a0808:carpetHex);const bm=new THREE.MeshStandardMaterial({map:bt,roughness:.85,side:THREE.DoubleSide});const BN=[],RD=[],AR=[];
 for(let z=F.zMax-25;z>F.zMin+8;z-=26){[[F.xMin+.4,Math.PI/2],[F.xMax-.4,-Math.PI/2]].forEach(([x,ry])=>{BN.push([x,BASEH+16,z,ry,1]);RD.push([x+(ry>0?.3:-.3),BASEH+21.2,z,0,1])})}
 for(let z=F.zMax-30;z>F.zMin+20;z-=60){[[F.xMin+.5,Math.PI/2],[F.xMax-.5,-Math.PI/2]].forEach(([x,ry])=>{AR.push([x,BASEH+45.5,z,ry,1])})}
 put(new THREE.PlaneGeometry(5,10),bm,BN,false);put(new THREE.CylinderGeometry(.14,.14,6.2,6).rotateX(Math.PI/2),gold,RD,false);put(new THREE.TorusGeometry(4.2,.7,6,16,Math.PI),sm,AR,false);
 // embers rising out of the abyss, and dust drifting in the window light (instanced; moved along in floorLookTick)
 const em=new THREE.InstancedMesh(new THREE.SphereGeometry(.22,5,4),new THREE.MeshBasicMaterial({color:th.glow,transparent:true,opacity:.85,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),160);em.frustumCulled=false;em.layers.set(1);G.add(em);
 const E=[];for(let i=0;i<160;i++)E.push({x:lerp(F.xMin,F.xMax,r()),z:lerp(F.zMin,F.zMax,r()),y:VOID+2+r()*30,v:2+r()*4,ph:r()*6.283});
 const du=new THREE.InstancedMesh(new THREE.PlaneGeometry(.18,.18),new THREE.MeshBasicMaterial({color:0xfff0d0,transparent:true,opacity:.35,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}),220);du.frustumCulled=false;du.layers.set(1);G.add(du);if(F.dark)du.count=0;
 const D=[];for(let i=0;i<(F.dark?0:220);i++)D.push({x:lerp(F.xMin,F.xMax,r()),z:lerp(F.zMin,F.zMax,r()),y:BASEH+2+r()*30,ph:r()*6.283,s:.6+r()*1.2});
 F.look={em,E,du,D}}
function gardenLook(F,G,put,r){lookMats();const items={grass:[],fern:[],flower:[],bush:[],oak:[]};const GRASS_C=[0xa9c86a,0x93b85a,0xbcd27c];
 F.P.forEach(p=>{const w=p.x1-p.x0,d=p.z1-p.z0;if(w<8||d<8)return;const cw=Math.min(6,w*.3),cx=(p.x0+p.x1)/2;const open=(x,z)=>Math.abs(x-cx)>cw/2+.5&&!(p.blocks||[]).some(b=>x>b.x0-.5&&x<b.x1+.5&&z>b.z0-.5&&z<b.z1+.5)&&!(p.kind==='exit'&&z<p.z0+8&&Math.abs(x-cx)<8)&&!(p.kind==='entry'&&x<p.x0+12&&z>p.z1-12);
  const n=Math.min(420,Math.round(w*d*.5));for(let i=0;i<n;i++){const x=lerp(p.x0+1,p.x1-1,r()),z=lerp(p.z0+1,p.z1-1,r());if(!open(x,z))continue;items.grass.push([x,p.top+.02,z,r()*6.283,.6+r()*.7,GRASS_C[(r()*3)|0],.9+r()*1.1])}
  for(let i=0;i<Math.round(w*d*.03);i++){const x=lerp(p.x0+1.5,p.x1-1.5,r()),z=lerp(p.z0+1.5,p.z1-1.5,r());if(!open(x,z))continue;items.fern.push([x,p.top,z,r()*6.283,.7+r()*.7,[0x3f7a30,0x4a8a3a,0x5a9a44][(r()*3)|0]])}
  for(let i=0;i<Math.round(w*d*.04);i++){const x=lerp(p.x0+1,p.x1-1,r()),z=lerp(p.z0+1,p.z1-1,r());if(!open(x,z))continue;items.flower.push([x,p.top,z,r()*6.283,.8+r()*.6,T.flower[(r()*T.flower.length)|0]])}
  const nb=Math.round((w+d)*.12);for(let i=0;i<nb;i++){const side=(r()*4)|0,x=side<2?lerp(p.x0+1.5,p.x1-1.5,r()):(side===2?p.x0+1.5:p.x1-1.5),z=side<2?(side===0?p.z0+1.5:p.z1-1.5):lerp(p.z0+1.5,p.z1-1.5,r());if(!open(x,z))continue;items.bush.push([x,p.top,z,r()*6.283,.6+r()*.7,T.leaf[(r()*T.leaf.length)|0]])}
  if(p.kind==='plaza'&&w>=30&&d>=24){const x=r()<.5?p.x0+5:p.x1-5,z=p.z0+5+r()*(d-10);if(open(x,z))items.oak.push([x,p.top,z,r()*6.283,.75+r()*.25,LOOK.trees.oak.cols[(r()*4)|0]])}});
 const noCol=a=>a.map(it=>[it[0],it[1],it[2],it[3],it[4],undefined,it[6]]);const Tq=LOOK.trees.oak;if(items.oak.length){put(Tq.trunk,Tq.bark,noCol(items.oak));Tq.parts.forEach(g=>put(g,Tq.bark,noCol(items.oak)));put(Tq.canopy,Tq.leaf,items.oak)}
 put(LOOK.bush,LOOK.bushM,items.bush);put(LOOK.fernG,LOOK.fernM,items.fern,false);put(LOOK.tufts,LOOK.grassM,items.grass,false);
 put(new THREE.CylinderGeometry(.03,.03,.6,4).translate(0,.3,0),windStd(0x4c8a3a,WP.flower),items.flower,false);put(shade(new THREE.SphereGeometry(.17,6,5).translate(0,.65,0)),windStd({vertexColors:true,roughness:.72},WP.flower),items.flower,false)}
function floorLookTick(t,dt){if(W4.out&&W4.outFlames)W4.outFlames.forEach((f,i)=>{const k=1+Math.sin(t*13+i*1.7)*.12;f.scale.set(k,1+Math.sin(t*11+i*2.1)*.18,k)});
 const F=W4.F;if(!F||!F.look||frame%2)return;const L=F.look,M=SWM.M,P=SWM.P,Q=SWM.Q,SC=SWM.SC;Q.set(0,0,0,1);
 for(let i=0;i<L.E.length;i++){const e=L.E[i];e.y+=e.v*dt*2;if(e.y>BASEH+14){e.y=VOID+2;e.x=lerp(F.xMin,F.xMax,Math.random());e.z=lerp(F.zMin,F.zMax,Math.random())}const k=Math.max(0,1-(e.y-VOID)/(BASEH+12-VOID));P.set(e.x+Math.sin(t*1.3+e.ph)*1.5,e.y,e.z+Math.cos(t*1.1+e.ph)*1.5);SC.setScalar(.4+k*.9);M.compose(P,Q,SC);L.em.setMatrixAt(i,M)}
 L.em.instanceMatrix.needsUpdate=true;
 for(let i=0;i<L.D.length;i++){const d=L.D[i];P.set(d.x+Math.sin(t*.27+d.ph)*3,d.y+Math.sin(t*.19+d.ph*2)*2,d.z+Math.cos(t*.23+d.ph)*3);SC.setScalar(d.s);M.compose(P,Q,SC);L.du.setMatrixAt(i,M)}L.du.instanceMatrix.needsUpdate=true}
// ---------------------------------------------------------------- ALIVE (the owner, Oct 21 06:30: "don't half-ass the attack motions... smoke, a
// little fire blast out of the nozzle, a bullet just released... everything should flow"). Every swing in the tower shows: a sweeping arc of
// light in front of whoever swings (its colour and size their own) with a whoosh, dust where a heavy blow lands, the Zombie Samurai's violet
// crescent, Supreme Big Nag Eastside's gold burst, Lord Belly's ground-slam ring, Big Fuse Daddy's fire belch with smoke, a Stinksheet'O's green
// slap, smoke curling off the bread's rifles after every shot, your own AK-47 firing again in the tower (its smoke and sparks too, and the same
// off your partner's rifle), and the pick, the axe and the scythe staying in your hands (the game used to force the AK back every frame).
const AL={fx:[],geo:{},smokeM:null,snd:{b:null,last:0}};
function alArcGeo(r){const k=Math.round(r*2);return AL.geo[k]||(AL.geo[k]=new THREE.RingGeometry(r*.35,r,22,1,-1.1,2.2).rotateX(-Math.PI/2).rotateY(Math.PI/2))}
function alMat(col){return new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false})}
function alSmokeMat(){return AL.smokeM||(AL.smokeM=new THREE.SpriteMaterial({map:TEX.cloud||TEX.glare,color:0x9a9a9a,transparent:true,opacity:.45,depthWrite:false}))}
// a whoosh: a band of noise sweeping up and back down (heard by how far away it is; never more than one every 70 ms)
function whoosh(x,z,vol,len,f0,f1){try{const ac=audioCtx();if(!ac)return;const d=Math.hypot(x-heroPos.x,z-heroPos.z);const k=(d<12?1:Math.max(0,1-(d-12)/50))*(vol||.22);if(k<.03)return;const now=performance.now();if(now-AL.snd.last<70)return;AL.snd.last=now;
 if(!AL.snd.b){const b=ac.createBuffer(1,(ac.sampleRate*1.5)|0,ac.sampleRate),q=b.getChannelData(0);for(let i=0;i<q.length;i++)q[i]=Math.random()*2-1;AL.snd.b=b}
 const T=ac.currentTime,L=len||.26,src=ac.createBufferSource();src.buffer=AL.snd.b;const f=ac.createBiquadFilter();f.type='bandpass';f.Q.value=1.1;f.frequency.setValueAtTime(f0||500,T);f.frequency.exponentialRampToValueAtTime(f1||2600,T+L*.55);f.frequency.exponentialRampToValueAtTime((f0||500)*.6,T+L);
 const g=ac.createGain();g.gain.setValueAtTime(.0001,T);g.gain.exponentialRampToValueAtTime(k,T+L*.22);g.gain.exponentialRampToValueAtTime(.0001,T+L);src.connect(f);f.connect(g);g.connect(ac.destination);src.start(T);src.stop(T+L+.05)}catch(_){}}
// an arc of light sweeping across the front of whoever swings (y: at their hands), then gone; delay: the wind-up before the blade comes round
function swipeFx(x,y,z,yaw,o){o=o||{};const r=o.r||4,g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=yaw;const m=new THREE.Mesh(alArcGeo(r),alMat(o.col||0xffffff));m.rotation.y=-.9;if(o.tilt)m.rotation.x=o.tilt;g.add(m);g.traverse(q=>q.layers.set(1));if(o.delay)g.visible=false;world.add(g);
 AL.fx.push({g,m,t:clk.getElapsedTime()+(o.delay||0),d:o.d||.26,k:'arc',sweep:o.sweep||1.8,s0:o.s0||.6,x,z,snd:o.snd===undefined?1:o.snd,r});return g}
function burstFx(x,y,z,col,n,v){if(splatBits.length>260)return;for(let i=0;i<(n||8);i++){const s=new THREE.Mesh(fxG('SphereGeometry(.14,5,4)',()=>new THREE.SphereGeometry(.14,5,4)),fxM({color:col,transparent:true,opacity:.95}));s.position.set(x,y,z);s.userData.t=clk.getElapsedTime();s.userData.v=[(Math.random()-.5)*(v||6),2+Math.random()*(v||6),(Math.random()-.5)*(v||6)];s.layers.set(1);world.add(s);splatBits.push(s)}}
function smokeFx(x,y,z,n,big){if(AL.fx.length>90)return;for(let i=0;i<(n||3);i++){const s=new THREE.Sprite(alSmokeMat().clone());const k=(big?1.4:.7)*(.7+Math.random()*.6);s.scale.set(k,k,1);s.position.set(x+(Math.random()-.5)*.4,y+(Math.random()-.5)*.3,z+(Math.random()-.5)*.4);s.layers.set(1);world.add(s);
 AL.fx.push({g:s,t:clk.getElapsedTime()+i*.05,d:.9+Math.random()*.5,k:'smoke',vx:(Math.random()-.5)*1.2,vy:1.2+Math.random()*1.2,vz:(Math.random()-.5)*1.2,s:k})}}
function ringFx2(x,y,z,col,r){const m=new THREE.Mesh(new THREE.TorusGeometry(1,.3,6,36),alMat(col));m.rotation.x=Math.PI/2;m.position.set(x,y+.4,z);m.layers.set(1);world.add(m);AL.fx.push({g:m,m,t:clk.getElapsedTime(),d:.5,k:'ring',r:r||7})}
function aliveTick(t,dt){for(let i=AL.fx.length-1;i>=0;i--){const f=AL.fx[i],k=(t-f.t)/f.d;if(k<0)continue;if(k>=1){if(f.g.parent)f.g.parent.remove(f.g);if(f.m&&f.m.material)f.m.material.dispose();if(f.k==='ring'&&f.m.geometry)f.m.geometry.dispose();if(f.k==='smoke'&&f.g.material)f.g.material.dispose();AL.fx.splice(i,1);continue}
  if(f.k==='arc'){if(!f.on){f.on=1;f.g.visible=true;if(f.snd)whoosh(f.x,f.z,.2+f.r*.02,Math.max(.2,f.d*1.1),f.r>4?380:520,f.r>4?2200:3000)}const e=1-(1-k)*(1-k);f.m.rotation.y=-.9+e*f.sweep;f.m.material.opacity=.85*(1-k*k);const s=f.s0+(1-f.s0)*Math.min(1,k*3);f.m.scale.set(s,1,s)}
  else if(f.k==='smoke'){f.g.position.x+=f.vx*dt;f.g.position.y+=f.vy*dt;f.g.position.z+=f.vz*dt;const s=f.s*(1+k*1.6);f.g.scale.set(s,s,1);f.g.material.opacity=.45*(1-k);f.g.material.rotation+=dt*.6}
  else if(f.k==='ring'){const s=1+k*f.r;f.m.scale.set(s,s,1);f.m.material.opacity=.85*(1-k)}}}
// who swung, and how it shows (the host and every guest alike: a swing is a swing on every screen). The arcs come round when the hand does.
function swingShow(e,t){(AL.log||(AL.log=[])).push({k:e.kind,sk:e.skin||'',t:+t.toFixed(2)});if(AL.log.length>60)AL.log.shift();const sc=e.g&&e.g.scale?e.g.scale.x||1:1,big=sc,sk=e.skin||'',y=h0(e)+1.9*sc,x=e.x+Math.sin(e.a)*1.2*sc,z=e.z+Math.cos(e.a)*1.2*sc,later=(ms,f)=>setTimeout(()=>{try{if(e.hp>0||ms<400)f()}catch(_){}},ms);
 if(sk==='nagrock')return;   // (his moves draw their own)
 // a big guardian without a borrowed look (Ma Dabloon, the Accountant, Otis, Big Cousin Quarter, Tiki Tama): his blow shakes the landing
 if(e.isGuard&&!sk&&sc>2){later(e.kind==='zombie'?520:400,()=>{const fx=e.x+Math.sin(e.a)*2.6*sc,fz=e.z+Math.cos(e.a)*2.6*sc;ringFx2(fx,h0(e),fz,e.kind==='doubloon'?0xffd040:0xd0b090,5+sc*1.5);dustPuff(fx,h0(e),fz,clk.getElapsedTime());whoosh(e.x,e.z,.35,.38,150,700);shake=Math.max(shake,.25)})}
 if(sk==='zsam'){swipeFx(x,y+.6,z,e.a,{col:0xb070ff,r:5.2,d:.34,sweep:2.4,tilt:.35,delay:.22});later(400,()=>burstFx(e.x+Math.sin(e.a)*3*big,h0(e)+1.2,e.z+Math.cos(e.a)*3*big,0xc090ff,6,5))}
 else if(sk==='jk'){later(420,()=>{ringFx2(e.x+Math.sin(e.a)*2.4,h0(e),e.z+Math.cos(e.a)*2.4,0xffd040,6);burstFx(e.x+Math.sin(e.a)*2.4,h0(e)+1.5,e.z+Math.cos(e.a)*2.4,0xffe08a,12,8);whoosh(e.x,e.z,.3,.3,200,900);dblChing(e.x,e.z,.5,.8,2)})}
 else if(sk==='belly'){later(650,()=>{const fx=e.x+Math.sin(e.a)*4.8,fz=e.z+Math.cos(e.a)*4.8;ringFx2(fx,h0(e),fz,0xd0b090,9);dustPuff(fx,h0(e),fz,clk.getElapsedTime());whoosh(e.x,e.z,.35,.4,120,600);shake=Math.max(shake,.35)})}
 else if(sk==='bigbomb'){later(300,()=>{const fx=e.x+Math.sin(e.a)*2.6,fz=e.z+Math.cos(e.a)*2.6;burstFx(fx,h0(e)+3.4,fz,0xff8020,14,9);burstFx(fx,h0(e)+3.4,fz,0xffd040,8,7);smokeFx(fx,h0(e)+3.8,fz,5,true);swipeFx(e.x,h0(e)+3.2,e.z,e.a,{col:0xff7020,r:6,d:.3,sweep:1.2,s0:.3,snd:0});whoosh(e.x,e.z,.3,.35,900,300)})}
 else if(sk==='samurai'){swipeFx(x,y+.3,z,e.a,{col:0xe8f4ff,r:3.6,d:.22,sweep:2.6,tilt:-.4,delay:.16})}
 else if(sk==='giantgogo'||sk==='future'||sk==='wizard'){swipeFx(x,y+.4*sc,z,e.a,{col:sk==='wizard'?0x80c0ff:0x303030,r:2.6*sc,d:.24,sweep:1.6});later(sk==='giantgogo'?260:120,()=>burstFx(e.x+Math.sin(e.a)*2.2*sc,h0(e)+1.6*sc,e.z+Math.cos(e.a)*2.2*sc,sk==='wizard'?0x9fd8ff:0xffffff,6,5+sc))}
 else if(sk==='bigtoast'||e.kind==='toast')return;   // (the rifle: see toastShot below)
 else if(e.kind==='doubloon'){swipeFx(x,y+.4,z,e.a,{col:0xffd040,r:2.8*big,d:.22,sweep:1.6,delay:.1});later(440,()=>burstFx(e.x+Math.sin(e.a)*2.2*big,h0(e)+1.6,e.z+Math.cos(e.a)*2.2*big,0xffe080,5,5))}
 else if(e.kind==='zombie'){swipeFx(x,y,z,e.a,{col:0xa0ffb0,r:3.4*big,d:.3,sweep:2,tilt:.5,delay:.24});later(520,()=>dustPuff(e.x+Math.sin(e.a)*2.6*big,h0(e),e.z+Math.cos(e.a)*2.6*big,clk.getElapsedTime()))}
 else if(e.kind==='redcap'){swipeFx(x,y,z,e.a,{col:0xff6060,r:3*big,d:.2,sweep:2.2,delay:.14})}
 else if(e.kind==='tiki'){swipeFx(x,y+.4,z,e.a,{col:0xffb060,r:3.4*big,d:.28,sweep:2,tilt:.3,delay:.1});later(380,()=>burstFx(e.x+Math.sin(e.a)*2.8*big,h0(e)+1,e.z+Math.cos(e.a)*2.8*big,0xc08040,5,4))}
 else if(e.kind==='stink'){swipeFx(x,h0(e)+1.1,z,e.a,{col:0x90ff60,r:2,d:.18,sweep:2.4,tilt:.6});burstFx(x,h0(e)+1.2,z,0x9fff70,4,3)}
 else swipeFx(x,y,z,e.a,{col:0xffffff,r:3*big,d:.25,sweep:2})}
// the bread's rifle: smoke off the muzzle after every shot (the shot's own tracer and flash are the game's)
(function(){if(typeof toastShot!=='function')return;const ts=toastShot;toastShot=function(e,tp){const r=ts(e,tp);if(W4.on){try{const sc=e.g&&e.g.scale?e.g.scale.x||1:1,sx=e.x+Math.sin(e.a)*1.2*sc,sz=e.z+Math.cos(e.a)*1.2*sc,sy=h0(e)+2.2*sc;smokeFx(sx,sy,sz,2,sc>1.3)}catch(_){}}return r}})();
// your own AK-47 fires in the tower (the game only fired it in World 2's phases), and only when it is the weapon in your hands (you may be
// holding the afro pick, the axe or the scythe instead: the game used to force the AK back into your hands every frame). Smoke curls off
// the muzzle and sparks fly out of it as it fires.
function alMuzzle(){const p=charApi&&charApi.AK?charApi.AK.userData.muzzle.clone():new THREE.Vector3(heroPos.x,hero.position.y+2.4,heroPos.z);if(charApi&&charApi.AK)charApi.AK.localToWorld(p);return p}
(function(){if(typeof akTick!=='function')return;const ak=akTick;akTick=function(t,dt){if(!W4.on)return ak(t,dt);if(W4.out||deadT>0||paused||!charApi||charApi.weapon()!=='ak')return;const ph=L2.phase,ls=L2.lastShot;L2.phase='run';try{ak(t,dt)}finally{L2.phase=ph}
 if(L2.lastShot!==ls){AL.akN=(AL.akN|0)+1;try{const p=alMuzzle();if(AL.akN%2===0)smokeFx(p.x,p.y,p.z,1,false);if(AL.akN%3===0){const fx=Math.sin(aimYaw),fz=Math.cos(aimYaw);burstFx(p.x+fx*.4,p.y,p.z+fz*.4,0xffc050,2,4)}}catch(_){}}}})();
(function(){if(typeof MPFX_DO!=='object'||typeof MPFX_DO.ak!=='function')return;const pk=MPFX_DO.ak;MPFX_DO.ak=function(P,a,t){const r=pk(P,a,t);if(W4.on&&Array.isArray(a)){try{const p=new THREE.Vector3(+a[0],+a[1],+a[2]);if(P.api&&P.api.AK){const AK=P.api.AK;AK.updateWorldMatrix(true,false);const m=AK.userData.muzzle.clone();AK.localToWorld(m);if(m.distanceTo(p)<8)p.copy(m)}
 AL.pkN=(AL.pkN|0)+1;if(AL.pkN%2===0)smokeFx(p.x,p.y,p.z,1,false);if(AL.pkN%3===0)burstFx(p.x,p.y,p.z,0xffc050,2,4)}catch(_){}}return r}})();
// ---------------------------------------------------------------- the big guardians' own moves (Big Cousin Quarter, Tiki Tama, Ma Dabloon,
// the Accountant, Otis the elevator, Ma cooking: any guardian twice the size without a borrowed look). On top of the body's swings he has
// three moves with Nagrock's kind of warning on the ground: the Stomp (a circle round him and a wave running out: jump the wave), the
// Charge (he rushes down a line: step aside) and the Sweep (a wide arc in front). The host decides and deals the damage; every screen draws
// the same warning and the same blast (MPFX 'w4b'), and the guardian's body swings with the blow (the arc, the ring and the dust of
// g7_alive). His taunts are the floor's own.
const BGA={stomp:{hit:1.15,shape:'circle',r:9,dmg:26,wave:14},charge:{hit:.95,shape:'line',len:26,w:5.5,dmg:28,dash:1},sweep:{hit:.9,shape:'sector',r:12,half:.8,dmg:24}};
const BGAN=Object.keys(BGA);const BG={st:null,next:0,n:0,taunt:0};
const BGTAUNT={13:['TWENTY-FIVE CENTS OF PAIN.','MA SAID NOBODY GETS UP THESE STAIRS.','I AM THE ELDEST. I GO FIRST. I HIT FIRST.'],17:['SPIN CYCLE!','NO OUTSIDE DETERGENT.','REGIONAL. MANAGER.'],19:['I AM NOT MAD.','SHOES. OFF.','ELEVEN CHILDREN AND NOT ONE OF THEM LISTENS.'],
 22:['THAT IS COMING OUT OF YOUR TOTAL.','COUNTED. TWICE.','I DO NOT ROUND UP.'],32:['GOING UP.','WHAT FLOOR? ...WRONG ANSWER.','DO NOT PRESS MY BUTTONS.'],34:['DINNER IS SERVED.','DO NOT TOUCH THE STOVE.','EAT. FAST.']};
function bigGuard(){const F=W4.F;if(!F||!F.big||F.nag||F.rest)return null;const e=enemies[W4.guardI];if(!e||e.hp<=0||e.skin)return null;return e}
function bigTick(t,dt){const e=bigGuard();if(!e){BG.st=null;return}const S=BG.st,F=W4.F;
 if(S){const k=t-S.t0;
  if(S.A.dash){const a=clamp((k-(S.A.hit-.35))/.6,0,1),s=a*a*(3-2*a);if(!MP.client){const nx=lerp(S.x,S.tx,s),nz=lerp(S.z,S.tz,s),h0=towerH(e.x,e.z),h1=towerH(nx,nz);if(Math.abs(h1-h0)<=2.4){e.x=nx;e.z=nz}}}else if(!MP.client){e.x=S.x;e.z=S.z}   // he holds still for the blow (the charge carries him, never off the landing or into a wall)
  e.a=S.a;if(!S.sw&&k>=S.A.hit-.45){S.sw=true;if(!MP.client)e.swing=t}   // the body's own swing lands with the blow
  if(!S.hit&&k>=S.A.hit){S.hit=true;if(!MP.client)nagHit(S,e)}
  if(k>S.A.hit+.8){BG.st=null;BG.next=t+lerp(3.2,6,clamp(e.hp/e.mhp,0,1))*(MP.on?.85:1)}return}
 if(MP.client||t<BG.next)return;const tp=mpTarget(e.x,e.z);if(!tp||tp.dead)return;const d=Math.hypot(tp.x-e.x,tp.z-e.z);if(d>44)return;
 const r=Math.random();let k;if(d>14)k=r<.6?'charge':'stomp';else k=r<.45?'stomp':r<.8?'sweep':'charge';
 const a=Math.atan2(tp.x-e.x,tp.z-e.z);let tx=tp.x,tz=tp.z;
 if(k==='charge'){const L=F.exit;const ux=Math.sin(a),uz=Math.cos(a);tx=clamp(e.x+ux*BGA.charge.len*.8,L.x0+3,L.x1-3);tz=clamp(e.z+uz*BGA.charge.len*.8,L.z0+3,L.z1-3)}   // he ends his rush on his own landing
 bigStart(BGAN.indexOf(k),e.x,e.z,a,tx,tz,t);try{mpFx('w4b',[BGAN.indexOf(k),R1(e.x),R1(e.z),R2(a),R1(tx),R1(tz)])}catch(_){}
 if(t>BG.taunt){BG.taunt=t+13;const T=BGTAUNT[F.n]||['YOU WANT THE GATE? COME AND GET IT.','BIG. AND NOT HAPPY.','THIS IS MY LANDING.'];try{bossYell((F.gname||'THE GUARDIAN').toUpperCase(),T[(BG.n++)%T.length])}catch(_){}}}
function bigStart(i,x,z,a,tx,tz,t){const k=BGAN[i|0]||'stomp',A=BGA[k];BG.st={k,A,x,z,a,tx,tz,t0:t,hit:false,sw:false};nagWarn(BG.st)}
MPFX_DO.w4b=(P,a,t)=>{if(!Array.isArray(a)||!W4.F||!W4.F.big)return;bigStart(+a[0],+a[1],+a[2],+a[3],+a[4],+a[5],clk.getElapsedTime())};
// ---------------------------------------------------------------- QUESTS (the owner, Oct 21 10:29: "put mazes, quests and more; don't make them
// linear"). From floor 2 on, one of the floor's people has a job for you: find the things they lost on the floor (dropped on the side
// landings and in the corners), clear a crew of one kind, or find a cousin who wandered off down a side bridge. The quest is the floor's
// (built from the floor number, the same on every screen); the host keeps the score and the snapshot carries it; the reward (doubloons, a
// big potion, now and then a feather) is yours when you go back and tell them, once per player. A line on the HUD keeps track.
const QIT=[['keepsake','💍','Keepsake Ring'],['battery','🔋','Propeller Battery'],['jewel','💎','Brigade Jewel'],['recipe','📜','Secret Recipe'],['record','💿','Scratched Record']];
QIT.forEach(([k,i,n])=>{IT[k]={n,i,d:'Somebody on this floor lost it. Bring it back.',st:9,q:1}});IT.gkey={n:'Gate Key',i:'🔑',d:'Opens the locked gate on this floor.',st:1,q:1};
// a locked gate (F.lock): the key waits out on a side landing (a corner if the floor has none); the host drops it, anyone can pick it up
function keyDrop(F){if(!F.lock||MP.client)return;const r=srand(F.seed*29+F.n*7+1);const sides=F.P.filter(p=>p.kind==='side'&&!p.secret);let x,z;if(sides.length){const p=sides[(r()*sides.length)|0];x=(p.x0+p.x1)/2-1.5;z=(p.z0+p.z1)/2-1.5}else{const pl=F.P.filter(p=>p.kind==='plaza'&&!p.maze);const p=pl[(r()*pl.length)|0]||F.entry;x=r()<.5?p.x0+2.5:p.x1-2.5;z=p.z0+2.5}
 try{dropAdd('gkey',1,x,z)}catch(e){}}
function keyGot(){const F=W4.F;if(!F||!F.lock)return true;if(MP.client)return !!W4.keyOk;return !W4.drops.some(d=>d.it==='gkey')&&(W4.keyOk=true)}
const QKIND={tiki:'Tiki Tamas',zombie:'zombies',redcap:'Red Caps',doubloon:'Doubloons',toast:'loaves',stink:'Stinksheet\'Os'};
const QNAMES=['Cousin Quarter','Lil Dime','Auntie Change','Nephew Nickel','Cousin Penny Two','Uncle Buck'];
function questGen(F){W4.q=null;if(!F||F.n<2||F.rest||F.swarm||F.n>=100)return;const r=srand(F.seed*17+F.n*331+9);const people=W4.npcs.filter(N=>N!==W4.greeter&&!N.o.shop&&!N.o.vault&&!N.o.qfind);if(!people.length)return;
 const giver=people[(r()*people.length)|0];const sides=F.P.filter(q=>q.kind==='side');const kinds=F.kinds.filter(k=>QKIND[k]);let k=r();
 let q;if(k<.45){const it=QIT[F.n%QIT.length][0],n=2+(F.n>10?1:0)+(F.n>40?1:0);q={k:'fetch',it,n,done:0}}
 else if(k<.8||!sides.length){const cnt={};F.G.forEach((g,gi)=>{const be=F.bombs?2:F.n>=2&&!F.swarm?4:0;for(let i=0;i<g.n;i++){if(be&&i%be===be-1)continue;const kd=g.kinds[(i+gi)%g.kinds.length];cnt[kd]=(cnt[kd]||0)+1}});   // (what the floor will actually hold)
  const ok=kinds.filter(kd=>(cnt[kd]||0)>=2);if(!ok.length)return;const kind=ok[(r()*ok.length)|0],n=Math.min(cnt[kind],3+Math.min(3,Math.floor(F.n/12)));q={k:'hunt',kind,n,done:0}}
 else{const L=sides[(r()*sides.length)|0];const who=QNAMES[(F.n+((r()*6)|0))%QNAMES.length];q={k:'find',who,n:1,done:0,pi:L.i};
  const N=npcMake('doubloon',(L.x0+L.x1)/2+2,(L.z0+L.z1)/2-2,Math.PI*.8,who,['Dinner? ...Already? I just got here. I was looking at the view. There is no view. There is an abyss.','Tell them I am on my way. Tell them I said thanks. Do not tell them about the abyss thing.'],{qfind:1});q.N=N}
 q.giver=giver;q.claimed=false;W4.q=q;giver.o.quest=1;W4.hud()}
// where the lost things are (the host drops them): the side landings first, then open corners of the plazas
function questDrops(F){const q=W4.q;if(!q||q.k!=='fetch'||MP.client)return;const r=srand(F.seed*23+F.n*77+3);const spots=[];F.P.filter(p=>p.kind==='side').forEach(p=>spots.push([(p.x0+p.x1)/2+1.5,(p.z0+p.z1)/2+1.5]));
 const pl=F.P.filter(p=>p.kind==='plaza'&&!p.maze&&!p.church);const shut=(p,x,z)=>(p.sealedR&&Math.hypot(x-p.sealedR[0],z-p.sealedR[1])<9)||(p.sealedM&&Math.hypot(x-p.sealedM[0],z-p.sealedM[1])<8)||(F.back&&Math.hypot(x-F.back.x,z-F.back.z)<6);   // (never behind a sealed door)
 for(let k=0;k<60&&spots.length<q.n;k++){const p=pl[(r()*pl.length)|0];if(!p)break;const x=lerp(p.x0+2,p.x1-2,r()),z=lerp(p.z0+2,p.z1-2,r());if(Math.abs(towerH(x,z)-p.top)>.6||pzKeepOut(F,x,z)||shut(p,x,z))continue;if(spots.some(s=>Math.hypot(s[0]-x,s[1]-z)<8))continue;spots.push([x,z])}
 while(spots.length<q.n){const p=F.entry;spots.push([lerp(p.x0+3,p.x1-3,r()),lerp(p.z0+3,p.z1-3,r())])}
 spots.slice(0,q.n).forEach(([x,z])=>{try{dropAdd(q.it,1,x,z)}catch(e){}})}
function questText(q){if(!q)return '';const it=IT[q.it];if(q.k==='fetch')return 'Find '+q.n+' '+it.i+' '+it.n+(q.n>1?'s':'');if(q.k==='hunt')return 'Clear '+q.n+' '+QKIND[q.kind];return 'Find '+q.who+' down a side bridge'}
function questAsk(q){const it=IT[q.it],g=q.giver;if(q.k==='fetch')return ['Before you go. I dropped '+q.n+' '+it.n+(q.n>1?'s':'')+' somewhere on this floor. Over in the districts somewhere. I do not remember which. Find them and I will make it worth your while.','They look like this: '+it.i+'. You cannot miss them. I missed them. But you cannot.'];
 if(q.k==='hunt')return ['This floor is crawling with '+QKIND[q.kind]+'. Clear '+q.n+' of them for me and come back. I pay in doubloons. Real ones.'];
 return ['My cousin '+q.who+' wandered off down one of the side bridges. Find him and tell him dinner is ready. Then come back and tell me he is alive.']}
function questThanks(q){if(q.k==='fetch')return ['You found them! All of them! I owe you. Here: doubloons, a big potion, and my respect. The respect is the valuable part.'];if(q.k==='hunt')return ['Cleared. Clean. I can hear myself think again. Here, take this.'];return ['He is alive? And he said thanks? That does not sound like him. Here, this is for you.']}
// the host keeps score: the lost things are counted by what is left on the floor, the crew by what fell, the cousin by who talked to him
function questTick(t,dt){const q=W4.q;if(!q||MP.client)return;if(q.k==='fetch'){const left=W4.drops.filter(d=>d.it===q.it).length;const d=Math.max(0,Math.min(q.n,q.n-left));if(d!==q.done){q.done=d;W4.hud();if(d>=q.n)questDone()}}}
function questKill(e){const q=W4.q;if(!q||MP.client||q.k!=='hunt'||e.kind!==q.kind||e.qc)return;e.qc=1;q.done=Math.min(q.n,q.done+1);W4.hud();if(q.done>=q.n)questDone()}
function questDone(){const q=W4.q;if(!q||q.yelled)return;q.yelled=1;try{bossYell('QUEST DONE','Go and tell '+q.giver.name)}catch(e){}W4.hud()}
// talking: the giver asks, then thanks and pays (once per player); the cousin is found
function questTalk(N){const q=W4.q;if(!q)return null;if(N.o.qfind&&q.k==='find'){if(!q.done){if(!MP.client){q.done=1;questDone()}else mpQueue({k:'w4qd'})}return null}
 if(N!==q.giver)return null;if(q.done>=q.n&&!q.claimed){q.claimed=true;try{saveMark('q',0)}catch(e){}for(let i=W4.bag.length-1;i>=0;i--){const s=W4.bag[i];if(s&&IT[s.it]&&IT[s.it].q&&s.it!=='gkey')W4.bag[i]=null}   // (the lost things go back to their owner)
  try{dblChing(heroPos.x,heroPos.z,.6,1,4)}catch(e){}if(q.loot&&typeof lootGive==='function')lootGive(q.loot);else{W4.coins=(W4.coins|0)+30+5*(W4.fl|0);bagPut('hp2',1);toast('🏅 Quest reward');saveNow();W4.hud()}return questThanks(q).concat(N.lines.slice(0,1))}
 if(q.claimed)return null;const tw=q.loot&&RAR[q.loot.tier]?['Do it and I will make it worth it. '+(q.loot.tier==='l'||q.loot.tier==='m'?'I mean REALLY worth it. ':'')+'('+RAR[q.loot.tier].n+' reward)']:[];return questAsk(q).concat(tw,N.lines)}
// the line on the HUD
function questHud(){try{lockHud()}catch(e){}let el=$('w4quest');if(!el){el=document.createElement('div');el.id='w4quest';document.body.appendChild(el)}const q=W4.q;if(!q||!W4.on||W4.out||q.claimed){el.style.display='none';return}
 el.style.display='block';const rw=q.loot&&typeof lootLabel==='function'?'<br><small>Reward: '+lootLabel(q.loot)+'</small>':'';el.innerHTML=(q.done>=q.n?'<b>QUEST DONE</b> · tell '+esc4(q.giver.name):'<b>QUEST</b> · '+esc4(questText(q))+' · <i>'+q.done+'/'+q.n+'</i>')+rw}
function lockHud(){let el=$('w4lock');if(!el){el=document.createElement('div');el.id='w4lock';document.body.appendChild(el)}const F=W4.F;if(!W4.on||W4.out||!F||!F.lock||keyGot()){el.style.display='none';return}el.style.display='block';el.innerHTML='<b>🔑 THE GATE IS LOCKED</b> · '+esc4(keyWhere(F).replace(/^The key is /,'the key is ').replace(/\.$/,''))}
// ---------------------------------------------------------------- TREASURE CHESTS: every other side landing holds a chest instead of loose
// loot (a plank box with gold bands and a lid, a glow under the lid). Walk up and press the door key: the lid swings open, doubloons and a
// potion spill out, and on the higher floors a weapon you do not own yet. The host opens it (a guest asks); the snapshot keeps every lid
// the same on every screen. Opened chests stay open.
const CH={geo:null};
function chestBuild(F,G){F.chests=[];const wm=woodMat(),gold=new THREE.MeshStandardMaterial({color:0xd9a425,metalness:1,roughness:.3});
 const specs=F.P.filter(q=>q.chest).map(q=>({x:(q.x0+q.x1)/2,z:(q.z0+q.z1)/2+2.5,top:q.top,src:q.secret?'secret':'chest',rot:Math.PI}));try{secretChests(F).forEach(c=>specs.push(Object.assign({rot:0},c)))}catch(e){}
 specs.forEach((q,i)=>{const x=q.x,z=q.z,top=q.top;const g=new THREE.Group();g.position.set(x,top,z);g.rotation.y=q.rot;
  let lid;try{if(typeof chestMesh!=='function')throw 0;const C=chestMesh(q.src||'chest');g.add(C.g);lid=C.lid}catch(_){   // (the plain box if the made one cannot be)
   const box=new THREE.Mesh(new THREE.BoxGeometry(2.6,1.5,1.7),wm);box.position.y=.75;box.castShadow=box.receiveShadow=true;g.add(box);
   [-.9,.9].forEach(bx=>{const b=new THREE.Mesh(new THREE.BoxGeometry(.22,1.56,1.76),gold);b.position.set(bx,.75,0);g.add(b)});
   lid=new THREE.Group();lid.position.set(0,1.5,-.85);const lm=new THREE.Mesh(new THREE.BoxGeometry(2.6,.5,1.7),wm);lm.position.set(0,.25,.85);lm.castShadow=true;lid.add(lm);
   [-.9,.9].forEach(bx=>{const b=new THREE.Mesh(new THREE.BoxGeometry(.22,.56,1.76),gold);b.position.set(bx,.25,.85);lid.add(b)});const lock=new THREE.Mesh(new THREE.BoxGeometry(.4,.4,.2),gold);lock.position.set(0,.1,1.75);lid.add(lock);g.add(lid)}
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:TEX.glare,color:0xffc040,transparent:true,opacity:.0,depthWrite:false,blending:THREE.AdditiveBlending}));glow.scale.set(5,5,1);glow.position.y=1.6;g.add(glow);
  g.traverse(o=>o.layers.set(1));G.add(g);if(q.hidden){g.visible=false;g.position.y=top-2.6}F.chests.push({i,x,z,top,g,lid,glow,open:false,k:0,src:q.src||'chest',hidden:!!q.hidden})})}
function chestTick(t,dt){const F=W4.F;if(!F||!F.chests)return;for(const c of F.chests){if(c.rise!==undefined&&c.rise<1){c.rise=Math.min(1,c.rise+dt/1.4);const e=c.rise*c.rise*(3-2*c.rise);c.g.position.y=c.top-2.6*(1-e);c.glow.material.opacity=.8*(1-c.rise)+.2}   // (a puzzle's chest rises out of the floor)
  if(c.open&&c.k<1){c.k=Math.min(1,c.k+dt*1.8);const e=1-(1-c.k)*(1-c.k);c.lid.rotation.x=-1.9*e;c.glow.material.opacity=.7*Math.sin(Math.min(1,c.k)*Math.PI)}}}
function chestNear(){const F=W4.F;if(!F||!F.chests)return null;let best=null,bd=4.2;for(const c of F.chests){if(c.open||c.hidden||(c.rise!==undefined&&c.rise<.9))continue;const d=Math.hypot(heroPos.x-c.x,heroPos.z-c.z);if(d<bd&&Math.abs(hero.position.y-c.top)<3){bd=d;best=c}}return best}
// what is inside (the host decides from the floor; everyone sees the drops)
function chestOpen(c,byPeer){if(!c||c.open)return;c.open=true;try{saveMark('c',c.i)}catch(e){}const F=W4.F,n=F.n;try{bossYell('TREASURE!','The chest on floor '+n+' opens.');dblChing(c.x,c.z,.7,1.1,4)}catch(e){}
 if(MP.client)return;const r=srand(F.seed*41+n*13+c.i),t0=clk.getElapsedTime();const L=lootRoll(c.src||'chest',n,r);if(c.src==='chest'||!c.src)L.items.push([r()<.5?'hp':'mp',1]);   // (everything flies out of the chest and lands around it)
 lootSpill(L,c.x,c.top+1.6,c.z,t0)}
MPFX_DO.w4ch=(P,a,t)=>{const F=W4.F;if(!F||!F.chests||!Array.isArray(a))return;const c=F.chests[a[0]|0];if(c&&!c.open){c.open=true;try{bossYell('TREASURE!','The chest on floor '+F.n+' opens.');dblChing(c.x,c.z,.7,1.1,4)}catch(e){}}};

// a puzzle's chest comes up out of the floor when the puzzle is solved (on every screen)
function chestReveal(src){const F=W4.F;if(!F||!F.chests)return;F.chests.forEach(c=>{if(c.hidden&&c.src===src){c.hidden=false;c.rise=0;c.g.visible=true;c.glow.material.opacity=.8;try{dblChing(c.x,c.z,.6,1.3,4)}catch(e){}}})}
// ---------------------------------------------------------------- the special floors: somebody important holds the gate, with their own
// look (a "skin" on a horde body: the host's snapshot carries which one, so everyone sees the same guardian). Floor 2: the 78th Lil Nag
// Brigade and Supreme Big Nag Eastside himself. Floor 3: a church (the World 1 church, its buttons do nothing here). Floor 8: the Nago
// Wizard, who was helping you until floor 8. Floor 10: you, from the future, in Black Black Go-Go Mode.
const DARKTH={n:'dark',brick:{hue:14,sat:.2,lit:.13,soot:.7,seed:88,mortar:[40,34,30]},fog:0x030203,glow:0x80200a,amb:0x1a1418,key:0x30283a};
const SPECIAL={
 2:{guard:'zombie',skin:'jk',gname:'Supreme Big Nag Eastside',kinds:['redcap','doubloon','toast','zombie','stink','tiki'],yell:['SUPREME BIG NAG EASTSIDE','of the 78th Lil Nag Brigade. This is a Brigade floor. Pay the toll.'],
  people:[['samurai','Brigade Private Ronin',['Welcome to Brigade territory. The toll is everything you have. The Supreme takes it personally. He takes everything personally.','He wears more jewels than the Dabloon has cousins. Do not stare at the jewels. That is how he gets you.']]]},
 3:{church:true,people:[['samurai','Reverend Ronin',['Welcome to the chapel, child. Do not press the buttons on the door. They do not do anything up here. We had a whole thing about it.','The good book says a hundred floors is a test of faith. The bad book says it is a test of cardio. Both are right.']]]},
 // floor 4: the Laundromat of Destiny (the spin cycle: moving platforms all the way, Tiki Tama minding the machines)
 4:{guard:'tiki',gname:'Tiki Tama, Spin Cycle Manager',layout:['steps','movers','plaza','movers','zigzag','movers','plaza'],yell:['THE SPIN CYCLE','Everything in here moves. The floors, the machines, your stomach. Tiki Tama says no outside detergent.']},
 5:{guard:'zombie',skin:'phoenix',gname:'The Phoenix (Again)',yell:['THE PHOENIX','Belly Lord\'s bird rose from the ashes. Again. It does that. It is honestly exhausting.'],
  people:[['zombie','Dead Dwayne',['That bird died in the swamp. Then it came back. Then it died again. Then it moved in up here. Rent free. Literally. It does not pay rent.']]]},
 // floor 14: the Bread Factory (all bread, all armed; the Head Baker at the gate is a loaf the size of a house)
 14:{guard:'toast',skin:'bigtoast',gname:'The Head Baker',kinds:['toast','doubloon','redcap','stink','zombie','tiki'],yell:['THE BREAD FACTORY','Every loaf in here has an AK. The Head Baker has two. And a hairnet.'],
  people:[['toast','Sourdough Steve',['They promoted me to supervisor. Of myself. I am the only one on my shift who is not armed. That is how they know I am management.','The Head Baker shoots crumbs at seventy miles an hour. Do not stand still. Do not stand in a line. Do not stand near the jam.']]]},
 // floor 18: the Group Chat (everybody talking at once; the Group Admin removes people)
 18:{guard:'redcap',skin:'samurai',gname:'The Group Admin',yell:['THE GROUP CHAT','Forty-seven unread messages. All of them about you. The Group Admin is typing...'],
  people:[['doubloon','Dime Piece Darryl',['Who added the guy with the afro to the chat? ...Oh. You are IN the chat. Hey. Big fan.']],['bomb','Tick Tock Tony',['Reply all one more time. I DARE you. I am VERY explodable right now.']],['zombie','Groaning Greg',['I left the chat in 2019. They keep adding me back. Death did not stop them.']]]},
 // floor 19: Ma's House (Finally): the Dabloon's Ma, twice his size, not mad, just disappointed
 19:{guard:'doubloon',big:2.7,gname:'Ma Dabloon',kinds:['doubloon','toast','zombie','redcap','stink','tiki'],yell:['MA DOUBLOON','She is not mad. She is just disappointed. ...Okay, she is also mad.'],
  people:[['doubloon','Uncle Nickel',['You made it to Ma\'s house! Take your shoes off. Do not touch the plastic on the couch. The plastic is older than the tower.','Ma raised eleven of us. She can raise a hand at you. Duck when she jumps.']]]},
 6:{guard:'zombie',skin:'zsam',gname:'The Zombie Samurai',kinds:['zombie','doubloon','toast','redcap','stink','tiki'],yell:['THE ZOMBIE SAMURAI','Shoes off. Head on. Scythe out. Welcome to the dojo.'],
  people:[['samurai','Sensei Sandals',['He was my student. Then he died. Then he came back and started teaching. Same class. Same room. Better attendance.','His squad is all over the upper floors now. If it walks slow and swings a scythe, do not stand there and watch it. I did. Look at me.']]]},
 7:{guard:'zombie',skin:'bigbomb',gname:'Big Fuse Daddy',bombs:1,kinds:['toast','redcap','doubloon','zombie','stink','tiki'],yell:['BIG FUSE DADDY','Welcome to the basement. Everybody down here is family. Everybody down here is also a bomb.'],
  people:[['bomb','Lil Boom',['That is my daddy up there. Big Fuse Daddy. He calls everybody buddy. Then they explode. That is just how we say hello.','If one of us runs out of cigarettes, he runs at you. Do not hug him. I know he looks like he wants a hug.']]]},
 8:{guard:'zombie',skin:'wizard',gname:'The Nago Wizard',yell:['THE NAGO WIZARD','I helped you on World 2. I gave you power. Now... I want it back.'],
  people:[['toast','Lil Crumb',['The Nago Wizard was cool on the lower floors. Then somebody told him the thing at the top is for sale. Now he wants it. Everybody wants it.']]]},
 9:{yell:['SWAMPED','Three hundred of you. Some of them in Go-Go Mode. One of them the size of a building.'],
  people:[['bomb','Fuse Daddy',['They are ALL you. Every single one. Somebody upstairs has a copier. I am not saying it is the Dabloon. I am saying he owns a copier.']]]},
 11:{guard:'zombie',skin:'belly',gname:'Lord Belly (Retired)',kinds:['toast','zombie','redcap','tiki','doubloon','stink'],yell:['LORD BELLY (RETIRED)','He left the swamp for a quiet life. He opened a barbershop. Sit down. NEXT!'],
  people:[['samurai','Ronin Ray',['Lord Belly runs this barbershop now. Retired from the swamp. Says he wanted something peaceful. He gave me a fade. I did not ask for a fade.','When he wants you out of the chair he does the belly slam. You will know when. The whole floor knows when.']]]},
 12:{guard:'zombie',skin:'future',gname:'You (From The Future)',extra:[['zombie','phoenix','The Phoenix'],['zombie','wizard','The Nago Wizard'],['zombie','giantgogo','Your Black Black Go-Go Twin']],yell:['THE BOSS LOUNGE','Everybody who wanted you dead, in one room. They pooled their money. It was a whole thing.'],
  people:[['pete','Propeller Pete',['Four bosses. One room. No elevator. I am going to sit this one out. I am going to sit ALL of them out. I am already sitting. It is a chair.']]]},
 // floor 50: the Halfway House (no guardian, the gate stands open: the Dabloon's cousins throw a party and everybody drops by)
 50:{rest:1,yell:['THE HALFWAY HOUSE','Floor fifty. No guardian. Just cousins, snacks and a speaker that only plays one song.'],
  people:[['doubloon','Cousin Penny',['Welcome to the Halfway House! Fifty floors down, fifty to go. Grab a plate. The plates are also my cousins. Do not eat off them.','Rest up. Upstairs it gets... spicy. Nagrock spicy.']],
   ['pete','Propeller Pete',['This is where I charge my battery. Also my soul. Mostly the battery.','From here up, the bosses start bringing friends. Like, a lot of friends. Bring potions. Bring feathers.']],
   ['jk','Supreme Big Nag Eastside',['Even the Brigade takes a day off. This is that day. Do not tell anybody I danced.','I still have money on you, by the way. Do not embarrass me in front of the crown.']],
   ['zsam','The Zombie Samurai',['A party for the living. I came anyway. Nobody checks.','Floor ninety-nine. Remember that number. Everybody you beat is going to be there. All at once.']]]},
 // floor 99: the Last Landing (everybody you ever beat, together, with Nagrock in front)
 99:{guard:'zombie',skin:'nagrock',gname:'Nagrock (Final Form... Probably)',nag:1,theme:NAGTH,kinds:['zombie','redcap','doubloon','tiki','toast','stink'],extra:[['zombie','jk','Supreme Big Nag Eastside'],['zombie','belly','Lord Belly (Retired)'],['zombie','zsam','The Zombie Samurai'],['zombie','future','You (From The Future)']],
  yell:['THE LAST LANDING','Everybody who ever wanted you gone. One floor. One gate. Floor one hundred is right there.'],
  people:[['doubloon','Uncle Nickel',['This is it. The last landing. After this gate it is the roof, the view, my hoes, and... the thing.','Beat all of them. Every single one. Then come up. I will be waiting. I have been waiting since floor one. My feet hurt.']]]},
 20:{guard:'zombie',skin:'nagrock',gname:'Nagrock',nag:1,theme:NAGTH,kinds:['zombie','redcap','doubloon','toast','stink','tiki'],extra:[['zombie','jk','Supreme Big Nag Eastside'],['zombie','phoenix','The Phoenix'],['zombie','zsam','The Zombie Samurai']],
  yell:['NAGROCK\'S COMEBACK TOUR','He heard you were climbing. He brought friends. He brought EVERYBODY.'],
  people:[['pete','Propeller Pete',['Nagrock is up there. With a whole crew. I have seen this movie. Everybody dies except the guy with the propeller.','Pro tip: when the ground glows, move. When it glows in a ring around him, jump. When Nagrock glows... I do not know. Nobody has lived that long.']]]},
 10:{guard:'zombie',skin:'future',gname:'You (From The Future)',yell:['YOU. FROM THE FUTURE.','I came back to stop you from buying it. Trust me. ...Okay, do not trust me. FIGHT me.'],
  people:[['doubloon','Cousin Penny',['That guy looks just like you. Black Black Go-Go Mode and everything. He says he is you from the future. He also says the thing at the top ruined his life. In a good way? He would not say.']]]},
 // floor 13: Stairway to Ma's House (stairs, stairs, stairs; Ma's eldest holds the top of them)
 13:{guard:'doubloon',big:2.3,gname:'Big Cousin Quarter',layout:['stairs','steps','stairs','plaza','stairs','zigzag','stairs','plaza'],kinds:['doubloon','redcap','toast','zombie','stink','tiki'],yell:['STAIRWAY TO MA\'S HOUSE','Six floors of stairs. Ma does not believe in elevators. Ma does not believe in you.'],
  people:[['doubloon','Dime Piece Darryl',['Ma\'s house is six floors up. Take the stairs. Everybody takes the stairs. Ma says an elevator is just a room that lies to you.','Big Cousin Quarter is on the last step. He is the eldest. He is worth twenty-five cents and he knows it.']],['pete','Propeller Pete',['Stairs. Thirteen floors of this and they put in STAIRS. I am rolling up these. Watch me. Do not help. ...Okay, help a little.']]]},
 // floor 15: Collard Green Gardens (the swamp's plants growing on every landing; the Groundskeeper cuts the grass, and you)
 15:{guard:'zombie',skin:'zsam',gname:'The Groundskeeper',dress:'garden',kinds:['zombie','tiki','doubloon','toast','redcap','stink'],yell:['COLLARD GREEN GARDENS','Somebody planted a swamp on floor fifteen. The Groundskeeper cuts the grass with a scythe. He cuts everything with a scythe.'],
  people:[['zombie','Auntie Rot',['I planted all of this. Collards, ferns, the little flowers. The Groundskeeper waters it. With a scythe. I do not ask how.','Do not step on the collards. Step on the Red Caps. They are not collards. I checked.']],['toast','Sourdough Steve',['Fresh greens, fresh bread. This floor is a whole sandwich. The Groundskeeper is the knife.']]]},
 // floor 16: the Brigade Annex (the 78th Lil Nag Brigade's second office: the Supreme with two Captains at the gate)
 16:{guard:'zombie',skin:'jk',gname:'Supreme Big Nag Eastside (Annex)',kinds:['redcap','doubloon','toast','zombie','stink','tiki'],extra:[['redcap','samurai','Brigade Captain Keisha'],['redcap','samurai','Brigade Captain Ray']],
  yell:['THE BRIGADE ANNEX','The 78th opened a second office. Same Supreme. Two Captains. Twice the toll.'],
  people:[['samurai','Brigade Private Ronin',['Welcome to the Annex. It is like the Brigade floor but the carpet is newer and the toll is doubled. The Supreme calls it a franchise.','The two Captains at the gate fight as one. The Supreme fights as three. Math was never the Brigade\'s thing. Jewels were.']]]},
 // floor 17: the Laundromat of Destiny II (the spin cycle again, now with bombs in the dryers; Tiki Tama got promoted)
 17:{guard:'tiki',big:2.3,gname:'Tiki Tama, Regional Manager',layout:['movers','plaza','movers','zigzag','movers','plaza','movers','plaza'],bombs:1,kinds:['tiki','toast','redcap','doubloon','zombie','stink'],
  yell:['THE SPIN CYCLE II','Regional Manager now. Same machines. Somebody left bombs in the dryers. Tiki Tama says that is a you problem.'],
  people:[['bomb','Tick Tock Tony',['We got in the dryers. All of us. It was warm. Then the manager turned them on. Now we are all a little... tumbled.','Do not stand on a machine while it moves. Do not stand next to me while I tick. Those are the two rules. I only follow one.']]]},
 // floor 22: the Treasury (every coin in the tower, counted twice; the Accountant does not round up; kills pay double in here)
 22:{guard:'doubloon',big:2.4,gname:'The Accountant',dress:'treasure',treasure:1,kinds:['doubloon','redcap','toast','zombie','stink','tiki'],yell:['THE TREASURY','Every coin in the tower. Counted. Twice. The Accountant does not round up. He rounds YOU up.'],
  people:[['doubloon','Cousin Penny',['Welcome to the Treasury! Everything in here is counted. Touch a pile and the Accountant knows. He knows anyway. He counts in his sleep.','Everybody you beat in here pays double. It is the only floor where the Dabloon loses money. He hates this floor.']],['pete','Propeller Pete',['I asked for a loan once. The Accountant asked for my chair as collateral. I said it is literally attached to me. He said that is not a no.']]]},
 // floor 24: Lights Out (nobody paid the light bill: night in the windows, a lamp in your hand, and the Wizard on the night shift)
 24:{guard:'zombie',skin:'wizard',gname:'The Night Shift Wizard',dark:1,theme:DARKTH,kinds:['zombie','redcap','doubloon','toast','stink','tiki'],yell:['LIGHTS OUT','Somebody did not pay the light bill. It was the Dabloon. It is always the Dabloon.'],
  people:[['toast','Burnt Terrence',['Lights out on twenty-four. The Dabloon says it is a vibe. It is not a vibe. I walked into a wall. I am bread. I have no eyes. It still hurt.','The Wizard glows. Follow the glow. Then punch the glow.']]]},
 // floor 28: the Gauntlet (one long way of bridges and moving slabs, no railings; everybody on it wants you off it)
 28:{guard:'redcap',skin:'samurai',gname:'The Gatekeeper',layout:['bridge','movers','bridge','zigzag','bridge','movers','bridge','plaza'],kinds:['redcap','zombie','toast','doubloon','stink','tiki'],yell:['THE GAUNTLET','One bridge. No railings. Everybody on it wants you off it.'],
  people:[['samurai','Katana Keisha',['The Gatekeeper trained me. Then he failed me. Then he fed me to the bridge. I walked it anyway. You can walk it too. Walk it SIDEWAYS.','Jump the gaps. Do not jump the Red Caps. They jump back.']]]},
 // floor 29: the Ballroom (chandeliers on every landing, the cousins dancing, DJ Crust on the decks at the gate)
 29:{guard:'toast',skin:'bigtoast',gname:'DJ Crust',dress:'ballroom',layout:['plaza','steps','plaza','stairs','plaza','movers','plaza'],kinds:['doubloon','toast','redcap','zombie','stink','tiki'],yell:['THE BALLROOM','Formal attire required. You are wearing an afro and a grudge. Close enough.'],
  people:[['doubloon','Cousin Penny',['Welcome to the Ballroom! Do not touch the chandeliers. Do not touch the cousins. The cousins ARE the chandeliers, spiritually.'],{dance:1}],['doubloon','Dime Piece Darryl',['DJ Crust only plays one song. It is a good song. It has been a good song for nine hours.'],{dance:1}],['doubloon','Uncle Nickel',['I have been dancing since floor fifty. My knees are gone. My cousins are gone. The song is still here.'],{dance:1}]]},
 // floor 32: the Elevator Shaft (they finally built an elevator: it is a tiki, it goes AT you; a climb of stairs up the shaft)
 32:{guard:'tiki',big:2.5,gname:'Otis, The Elevator Operator',layout:['stairs','steps','stairs','stairs','plaza','stairs','zigzag','plaza'],kinds:['tiki','redcap','zombie','doubloon','toast','stink'],yell:['THE ELEVATOR SHAFT','They finally built an elevator. It is a tiki. It does not go up. It goes AT you.'],
  people:[['pete','Propeller Pete',['Thirty-two floors and they finally built the elevator. Look at it. It has a face. It is named Otis. It asked me what floor and then it hit me.','The buttons are on his belly. Do not press the buttons. We had a whole thing about buttons on floor three.']]]},
 // floor 34: Ma's Kitchen (Ma is cooking; the bread is armed, the bombs are in the oven, do not touch the stove)
 34:{guard:'doubloon',big:2.6,gname:'Ma Dabloon (Cooking)',bombs:1,kinds:['toast','doubloon','zombie','redcap','stink','tiki'],yell:['MA\'S KITCHEN','Ma is cooking. The bread is armed. The bombs are in the oven. Do not touch the stove.'],
  people:[['doubloon','Uncle Nickel',['Ma moved the kitchen up here after you wrecked her house. She is not mad. She is cooking. That is worse.','Everything on the stove explodes. Everything in the fridge shoots. Everything on the table is family. Eat something.']],['toast','Lil Crumb',['I was born in this kitchen. Then I was promoted out of this kitchen. Then I was demoted back INTO this kitchen. Ma runs a tight oven.']]]},
 // floor 38: the Mirror Floor (three of you, from three timelines, all of them wrong, all of them armed)
 38:{guard:'zombie',skin:'future',gname:'You (From Last Tuesday)',extra:[['zombie','future','You (From Next Week)'],['zombie','future','You (From The Other Timeline)']],kinds:['zombie','redcap','doubloon','toast','stink','tiki'],
  yell:['THE MIRROR FLOOR','Three of you. All of you wrong. All of you armed. One of you is the real one. It is not you.'],
  people:[['wizard','The Nago Wizard',['I opened a door in time on floor eight. Three of you fell out. I closed the door. Two more fell out. I stopped opening doors.','The one from last Tuesday is the angriest. Last Tuesday was rough for you. You will see.']]]},
 // floor 39: the Opening Act (Nagrock plays floor 40: his opening acts hold floor 39 together, the Zombie Samurai and Lord Belly as a double bill)
 39:{guard:'zombie',skin:'zsam',gname:'The Zombie Samurai (Opening Act)',extra:[['zombie','belly','Lord Belly (Also Opening)']],kinds:['zombie','toast','redcap','doubloon','stink','tiki'],yell:['THE OPENING ACT','Nagrock plays floor forty. These two open for him. They were told to warm up the crowd. The crowd is you.'],
  people:[['pete','Propeller Pete',['Opening acts. Two of them. The Samurai does a scythe thing, the Belly does a slam thing, then Nagrock comes out on forty and does an everything thing. I have the setlist. It is one song: you.']],['zsam','The Zombie Samurai',['I am on this floor AND at the gate. Do not ask how. The dojo teaches many things. Being in two places is a Tuesday.']]]}};
// the floors past the handmade ones repeat the tower's famous faces: the phoenix every ten floors (5, 15, 25...), a church on 13, 23...,
// the Brigade's floor every seven, and you from the future on every tenth
function specialOf(n){if(SPECIAL[n])return SPECIAL[n];if(n<=10)return null;const m=n%10;
 if(n%20===0&&n<100)return Object.assign({},SPECIAL[20],{extra:SPECIAL[20].extra.concat([['zombie','future','You (From The Future)']]),yell:['NAGROCK\'S COMEBACK TOUR','Floor '+n+'. Bigger venue. More friends. Same Nagrock.']});if(m===5)return Object.assign({},SPECIAL[5],{yell:['THE PHOENIX','Back again. Floor '+n+'. It followed you up.']});
 if(m===3)return {church:true,people:SPECIAL[3].people};if(m===1&&n>11)return Object.assign({},SPECIAL[11],{yell:['LORD BELLY (RETIRED)','Floor '+n+'. Second location. Same chair. NEXT!']});if(m===7)return Object.assign({},SPECIAL[7],{yell:['BIG FUSE DADDY','Floor '+n+'. The basement moved up. The family got bigger.']});if(m===6)return Object.assign({},SPECIAL[6],{yell:['THE ZOMBIE SAMURAI','Floor '+n+'. New dojo. Same scythe. Same rules.']});if(m===0)return Object.assign({},SPECIAL[10],{yell:['YOU. FROM THE FUTURE.','Floor '+n+'. I keep coming back. You keep not listening.']});if(n%7===2)return Object.assign({},SPECIAL[2],{yell:['THE BRIGADE IS BACK','The 78th Lil Nag Brigade owns floor '+n+' now. Supreme Big Nag Eastside sends his regards.']});return null}
// a guardian's look: the horde body underneath stays (it moves, hits and gets hit); its own model hides; the skin is drawn instead
function skinMake(id){const g=new THREE.Group();let api=null,cg=null,tick=()=>{};
 try{if(id==='phoenix'&&typeof buildPhoenix==='function'){const P=buildPhoenix(THREE,{scale:.85,autoBurst:false});g.add(P.group);let dv=0;
   tick=(e,t,dt)=>{const sw=t-e.swing;dv=sw>=0&&sw<.8?Math.min(1,dv+dt*5):Math.max(0,dv-dt*2);P.group.position.y=10+Math.sin(t*1.7)*1.2-dv*7;try{P.update(t,dt,{flap:e.mvK?1:.5,bank:Math.sin(t*.9)*.3,dive:dv,hurt:t-(e.flash||-9)<.3?1:0,burst:false})}catch(_){}}}
  else if(id==='future'||id==='wizard'||id==='giantgogo'){cg=new THREE.Group();api=buildCharacter(cg);cg.scale.setScalar(.62*(id==='future'?2.3:id==='giantgogo'?5.5:1.9));upgradeMaterials(cg);g.add(cg);
   if(id==='future'||id==='giantgogo'){try{api.gogo(true)}catch(e){}cg.traverse(o=>{if(o.isMesh&&o.material&&o.material.color&&!o.material.userData.w4dk){o.material=(typeof matCloneSafe==='function'?matCloneSafe(o.material):o.material.clone());o.material.userData.w4dk=1;o.material.color.multiplyScalar(.42);if(o.material.emissive)o.material.emissive.multiplyScalar(1.4)}})}
   else{try{const r=wizRobe();r.scale.setScalar(1);cg.add(r)}catch(e){console.warn('robe',e)}}
   tick=(e,t,dt)=>{const sw=t-e.swing;if(sw>=0&&sw<.1&&e.skPun!==e.swing){e.skPun=e.swing;try{api.punch(t)}catch(_){}}try{api.anim(t,!!e.mvK,sw>=0&&sw<.45,0,false)}catch(_){}}}
  else if(id==='nagrock'&&NG.ready&&window.W3&&W3.TY&&W3.TY.g){tick=nagSkin(g)}
  else if(id==='bigbomb'&&typeof bombProtoGet==='function'){tick=bigBombSkin(g)}
  else if(id==='belly'&&typeof miniProtoGet==='function'&&typeof cloneBossRig==='function'){tick=bellySkin(g)}
  else if(id==='bigtoast'&&typeof toastBuild==='function'){const T=toastBuild();T.g.scale.multiplyScalar(2.6);g.add(T.g);
   tick=(e,t,dt)=>{try{T.anim(t,e.mvK?'run':'idle',e.mvK?(e.spd||5):0)}catch(_){}const sw=t-e.swing;T.inner.position.z=sw>=0&&sw<.25?-Math.sin(sw/.25*Math.PI)*.25:0}}
  // World 1's Afro Ninja Samurai (his own jointed build and poses: walk, the slash, a guard now and then)
  else if(id==='samurai'&&typeof samuraiKit==='function'){const K=samuraiKit();const S0=K.build(K.randP());S0.g.scale.setScalar(1.05);g.add(S0.g);
   tick=(e,t,dt)=>{const sw=t-e.swing;let mode='idle',k=0;if(sw>=0&&sw<.6){mode='attack';k=sw/.6}else if(t-(e.flash||-9)<.35)mode='block';else if(e.mvK)mode='walk';try{K.pose(S0,mode,t,Math.min(dt,.05),k,e.mvK?10.5:5.5,true)}catch(_){}}}
  else if(id==='zsam'&&typeof zsClone==='function'&&ZS.P){const C=zsClone();C.root.scale.setScalar(4.6/ZS.P.h);g.add(C.root);const mx=new THREE.AnimationMixer(C.root),A={};for(const n in ZS.P.clips)A[n]=mx.clipAction(ZS.P.clips[n]);let cur=null;
   const play=(n,ts)=>{const a=A[n]||A.Idle;if(!a)return;if(a!==cur){a.reset().play();if(cur)a.crossFadeFrom(cur,.16,false);cur=a}a.timeScale=ts};play('Idle',1);mx.update(Math.random()*2);
   tick=(e,t,dt)=>{const sw=t-e.swing,at=sw>=0&&sw<1.1;play(at?'Attack':e.mvK?'Walk':'Idle',at?1.45:e.mvK?Math.max(.8,Math.min(1.8,(e.spd||6)/5)):1);mx.update(dt)}}
  else if(id==='jk'&&typeof jkClone==='function'&&W4.JK){const C=jkClone();if(C){C.root.scale.setScalar(5.6/W4.JK.h);g.add(C.root);const mx=new THREE.AnimationMixer(C.root),A={};for(const n in W4.JK.clips)A[n]=mx.clipAction(W4.JK.clips[n]);let cur=null;
    const play=n=>{const a=A[n]||A.Idle;if(!a||a===cur)return;a.reset().play();if(cur)a.crossFadeFrom(cur,.2,false);cur=a};play('Idle');
    tick=(e,t,dt)=>{const sw=t-e.swing;play(sw>=0&&sw<1?'Angry':e.mvK?'Walk':(Math.sin(t*.3)>.8?'Laugh':'Idle'));mx.update(dt)}}}}
 catch(e){console.warn('tower skin '+id,e)}
 // (noUber: the horde body underneath is queued for packing into one mesh; a skin attached before that happens must not be packed into it,
 // or it would be drawn by the body's pack, which the skin hides along with the rest of the body)
 g.traverse(o=>{o.layers.set(1);if(o.isMesh){o.castShadow=true;if(id==='nagrock'||id==='phoenix')o.userData.noUber=true}});
 // its own pack: the skin draws in one go (its pieces still ride their joints), and no later pack of the body underneath can swallow it
 if(id!=='nagrock'&&id!=='phoenix')try{if(typeof uberMerge==='function')uberMerge(g,{tag:'skin:'+id})}catch(e){console.warn('skin pack',id,e)}
 return {g,tick,id,empty:!g.children.length}}
function skinOn(e,id){if(!e||!e.g||e.skin===id)return;if(id==='giantgogo'&&!MP.client){e.reach=9;e.dmg*=1.6}if(id==='nagrock'&&!MP.client&&!e.ngUp){e.ngUp=1;e.reach=8.5;e.dmg*=1.5}if(e.sk&&e.sk.g.parent)e.sk.g.parent.remove(e.sk.g);e.skin=id;
 const S=skinMake(id);if(S.empty){e.skin=id;e.sk=null;return}   // no model for it (yet): the horde body stays visible, never an invisible guardian
 const hide=()=>{e.g.children.forEach(c=>{if(c!==e.hpBar&&c!==e.gtag&&(!e.sk||c!==e.sk.g))c.visible=false})};e.sk=S;e.g.add(S.g);hide();e.skHide=hide;
 if(id==='bigbomb'){if(e.gtag)e.gtag.position.y=9.6;if(e.hpBar)e.hpBar.position.y=8.9}if(id==='belly'){if(e.gtag)e.gtag.position.y=10;if(e.hpBar)e.hpBar.position.y=9.3}}
function skinsTick(t,dt){if(!W4.F)return;const squads=W4.F.n>=6&&!W4.F.swarm;for(let i=0;i<enemies.length;i++){const e=enemies[i];
  // from floor 6 on, every other zombie is one of the Zombie Samurai's squad (the same ones on every screen: the rule is the enemy's own slot, which the host's snapshot keeps)
  if(squads&&e.kind==='zombie'&&!e.skin&&e.hp>0&&i%2===0)e.skin='zsam';
  // from floor 5 on, the Afro Ninja Samurai came up from the swamp too: every other Red Cap is one (same rule, the same ones on every screen)
  if(W4.F.n>=5&&e.kind==='redcap'&&!e.skin&&e.hp>0&&i%2===1){e.skin='';skinOn(e,'samurai')}
  // Supreme Big Nag Eastside's and the Zombie Samurai's models load the first time they are needed: until then the horde body stands in, then they step in
  if(e.skin==='jk'&&!e.sk&&e.hp>0){if(W4.JK){e.skin='';skinOn(e,'jk')}else if(typeof jkLoad==='function'&&!W4.jkP){W4.jkP=jkLoad().then(J=>{W4.JK=J}).catch(err=>console.warn('Jewel King',err))}}
  if(e.skin==='zsam'&&!e.sk&&e.hp>0){if(ZS.P){e.skin='';skinOn(e,'zsam')}else if(!ZS.p&&!ZS.fail)zsLoad().catch(()=>{})}
  if(e.skin==='nagrock'&&!e.sk&&e.hp>0){if(NG.ready){e.skin='';skinOn(e,'nagrock');if(e.sk){if(e.gtag)e.gtag.position.y=11;if(e.hpBar)e.hpBar.position.y=10.3}}else if(!NG.p)nagLoad().catch(()=>{})}
  if(!e.sk)continue;if(e.hp<=0){e.sk.g.visible=t-e.dead<1.5;if(e.sk.g.visible)e.sk.g.rotation.x=-Math.min(1.4,(t-e.dead)*1.6);continue}e.sk.g.rotation.x=0;if(frame%30===0&&e.skHide)e.skHide();e.sk.tick(e,t,dt)}}
// the church on floor 3: the World 1 church (its model is already loaded from the swamp), standing on its own landing; you walk round it
function churchPlace(F){if(typeof KEEP==='undefined'||!KEEP.load)return;const p=F.P.find(q=>q.church);if(!p)return;
 KEEP.load().then(m=>{if(!W4.F||W4.F!==F||!KEEP.group)return;const c=KEEP.group.clone(true);c.userData.keepGeo=1;c.position.set(0,0,0);c.rotation.set(0,0,0);c.scale.copy(KEEP.group.scale);c.updateMatrixWorld(true);
  const bb=new THREE.Box3().setFromObject(c),sz=bb.getSize(new THREE.Vector3());const room=Math.min(p.x1-p.x0-8,p.z1-p.z0-8);const k=Math.min(1,room/Math.max(sz.x,sz.z));c.scale.multiplyScalar(k);c.updateMatrixWorld(true);
  const b2=new THREE.Box3().setFromObject(c),ctr=b2.getCenter(new THREE.Vector3());const cx=(p.x0+p.x1)/2,cz=(p.z0+p.z1)/2;c.position.set(cx-ctr.x,p.top-b2.min.y,cz-ctr.z);c.traverse(o=>o.layers.set(1));W4.G.add(c);
  // solid: its walls are a block you walk round (the door stays shut up here)
  const b3=new THREE.Box3().setFromObject(c);const blk={x0:b3.min.x+1,x1:b3.max.x-1,z0:b3.min.z+1,z1:b3.max.z-1,top:p.top+30};p.blocks=(p.blocks||[]);p.blocks.push(blk);buildGrid(F)}).catch(()=>{})}
// the special floor's own people and its guardian's look (host and guests alike: built from the floor number)
function floorSpecial(F){NG.fx.forEach(f=>f.grp.traverse(o=>{if(o.geometry)o.geometry.dispose()}));NGB.forEach(q=>{if(q.m.geometry)q.m.geometry.dispose()});NG.fx.length=0;NGB.length=0;NG.st=null;const S=specialOf(F.n);if(!S)return;if(S.church)churchPlace(F);if(F.nag)nagFloor(F);
 const PL=F.P.filter(q=>q.kind==='plaza');(S.people||[]).forEach(([kind,name,lines,o],i)=>{const p=PL[i];if(p)npcMake(kind,p.x1-4,p.z1-4,-Math.PI*.25,name,lines,o);else{const e=F.entry;npcMake(kind,e.x1-4-((i-PL.length)%4)*6,e.z1-3,-Math.PI*.2,name,lines,o)}});
 // the dark floor: a lamp in your hand (the only light you bring)
 if(F.dark){try{const L=new THREE.PointLight(0xffd8a8,1.7,30,1.4);L.position.set(0,3.2,0);hero.add(L);W4.heroL=L}catch(e){}}
 if(S.yell)setTimeout(()=>{if(W4.F===F)bossYell(S.yell[0],S.yell[1])},2600)}
// ---------------------------------------------------------------- floor 100: the top of the tower. The open sky above the clouds, a roof
// garden, the hoes, Da Nag Dabloon, and the thing everybody talked about all the way up (it costs what it costs).
const TOP_PRICE=50000;
function topH(x,z){const r=Math.hypot(x-X0,z+40);return r<58?BASEH:VOID}
function loadTop(){clearWorld();W4.out=false;W4.fl=100;W4.F=null;W4.top100=true;W4.gate=false;W4.drops=[];W4.npcs=[];W4.guardI=-1;heightAt=topH;PLAYR=600;cam.far=4000;cam.updateProjectionMatrix();towerAir(THEMES[4],true);
 if(S.fog){S.fog.color.setHex(0xf2c890);S.fog.density=.0011}if(typeof sky!=='undefined'&&sky)sky.visible=true;
 const G=new THREE.Group();G.name='w4top';world.add(G);W4.G=G;const sm=stoneMat(),bm=brickMat(THEMES[4]);
 // the roof: a stone disc on the brick drum, battlements round the edge
 const roof=new THREE.Mesh(new THREE.CylinderGeometry(58,58,2,64),sm);roof.position.set(X0,BASEH-1,-40);roof.receiveShadow=true;G.add(roof);
 const drum=new THREE.Mesh(new THREE.CylinderGeometry(58.5,62,BASEH,64,1,true),bm);drum.position.set(X0,BASEH/2-1,-40);G.add(drum);
 for(let i=0;i<40;i++){const a=i/40*6.283;if(i%2)continue;const m=new THREE.Mesh(new THREE.BoxGeometry(4.5,3.5,2.2),bm);m.position.set(X0+Math.sin(a)*57,BASEH+1.6,-40+Math.cos(a)*57);m.rotation.y=a;m.castShadow=true;G.add(m)}
 // clouds below, the sun going down
 const cm=new THREE.MeshBasicMaterial({color:0xfff2e0,transparent:true,opacity:.85,depthWrite:false,fog:false});for(let i=0;i<40;i++){const c=new THREE.Mesh(new THREE.SphereGeometry(40+Math.random()*50,10,8),cm);const a=Math.random()*6.283,r=90+Math.random()*500;c.position.set(X0+Math.sin(a)*r,BASEH-40-Math.random()*40,-40+Math.cos(a)*r);c.scale.y=.35;G.add(c)}
 // the garden: rows of collard greens, a shed, and leaning on the shed... the hoes
 const leaf=new THREE.MeshStandardMaterial({color:0x2f7a2a,roughness:.7,side:THREE.DoubleSide}),dirt=new THREE.MeshStandardMaterial({color:0x4a3020,roughness:1});
 for(let r=0;r<4;r++){const bed=new THREE.Mesh(new THREE.BoxGeometry(26,1,4),dirt);bed.position.set(X0-18,BASEH+.5,-30-r*7);G.add(bed);for(let k=0;k<8;k++){const cl=new THREE.Group();cl.position.set(X0-30+k*3.4,BASEH+1,-30-r*7);for(let q=0;q<5;q++){const l=new THREE.Mesh(new THREE.SphereGeometry(.9,8,6,0,6.3,0,1.4),leaf);l.rotation.set(-.5+Math.random()*.3,q*1.25,0);l.scale.set(1,.5,1.4);l.position.y=.4;cl.add(l)}G.add(cl)}}
 const shed=new THREE.Mesh(new THREE.BoxGeometry(10,8,7),woodMat());shed.position.set(X0+22,BASEH+4,-56);shed.castShadow=true;G.add(shed);const rf=new THREE.Mesh(new THREE.ConeGeometry(8,4,4),new THREE.MeshStandardMaterial({color:0x6a2a1a,roughness:.8}));rf.position.set(X0+22,BASEH+10,-56);rf.rotation.y=Math.PI/4;G.add(rf);
 const steel=new THREE.MeshStandardMaterial({color:0xb8c0c8,metalness:.9,roughness:.35}),gold=new THREE.MeshStandardMaterial({color:0xffc83a,metalness:1,roughness:.25});
 W4.hoes=[];for(let i=0;i<7;i++){const h=new THREE.Group();const st=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,6,8),woodMat());st.position.y=3;h.add(st);const bl=new THREE.Mesh(new THREE.BoxGeometry(1.4,.9,.12),i===3?gold:steel);bl.position.set(.5,6,0);h.add(bl);
  h.position.set(X0+17.4+i*1.4,BASEH,-52.2);h.rotation.z=-.18;G.add(h);W4.hoes.push(h)}
 const hs=signMesh('MY HOES','DO NOT TOUCH · PROPERTY OF DA NAG DOUBLOON');hs.scale.setScalar(.45);hs.position.set(X0+22,BASEH+4.5,-52.4);G.add(hs);
 // the thing: a vault door of solid gold with a price on it
 const V=new THREE.Group();V.position.set(X0-24,BASEH,-70);const vf=new THREE.Mesh(new THREE.CylinderGeometry(7,7,1.6,40),gold);vf.rotation.x=Math.PI/2;vf.position.y=8;V.add(vf);const wheel=new THREE.Mesh(new THREE.TorusGeometry(2.6,.35,10,32),gold);wheel.position.set(0,8,1);V.add(wheel);W4.vaultWheel=wheel;
 const pv=signMesh('???','THE THING · '+TOP_PRICE.toLocaleString()+' DOUBLOONS');pv.scale.setScalar(.5);pv.position.set(0,0,2);V.add(pv);G.add(V);W4.vault={x:X0-24,z:-66};
 G.traverse(o=>o.layers.set(1));
 W4.cp={x:X0,z:-6};placePlayers(X0,-6,0);camYaw=0;camPitch=.25;
 const D=npcMake('doubloon',X0+14,-46,0,'Da Nag Dabloon',topLines());D.o.top=1;W4.topD=D;
 npcMake('doubloon',X0-24,-62,0,'The Thing',['Fifty thousand doubloons. No refunds. No questions. Mostly no questions.'],{vault:1});
 W4.hud();try{updateHUD()}catch(e){}banner(100)}
function topLines(){return ['YOU MADE IT! Floor one hundred! Look at that view. Look at those clouds. I own those clouds. I do not, but look at \'em.',
 'And there they are... MY HOES. My beautiful hoes. Seven of \'em. The gold one is my favourite. She has been through a lot.',
 '...Wait. What did you think I meant? Garden hoes! For the collard greens! A man has to eat! What kind of tower do you think this is?!',
 'Somebody locked my shed and took the key up a hundred floors of brick. Who does that? A monster. A monster does that.',
 'Anyway. You earned it. And now... you can buy it. THE THING. Right over there. Behind the gold door. Fifty thousand doubloons.',
 'I am not gonna tell you what it is. I am gonna tell you this: nobody who bought it ever asked for a refund. Mostly because I do not do refunds.']}
// buying the thing (the host's purchase is everyone's moment; each player can buy their own on their own screen)
function vaultBuy(){if((W4.coins|0)<TOP_PRICE){toast('Fifty thousand doubloons. You have '+(W4.coins|0).toLocaleString()+'. Keep climbing (floors repeat their guardians\' coin).');return}
 W4.coins-=TOP_PRICE;const sv=saveLoad();sv.owner=(MP.name||'You');sv.coins=W4.coins;try{localStorage.setItem(SAVEK,JSON.stringify(Object.assign(sv,{best:Math.max(sv.best|0,100)})))}catch(e){}W4.owner=sv.owner;theReveal()}
// the reveal (a secret all the way up; the people on the floors only ever hinted)
function theReveal(){curtain(true,600,()=>{try{buildOutside();W4.revealT=clk.getElapsedTime();statueRise()}catch(e){console.error(e)}curtain(false,900)});
 setTimeout(()=>{bossYell('YOU BOUGHT THE TOWER','The whole thing. Every brick. Every floor. Da Nag Dabloon works for you now.')},1800)}
function statueRise(){const G=W4.G;if(!G)return;const sg=new THREE.Group();sg.userData.keepGeo=1;sg.position.set(0,900,-150);G.add(sg);W4.statue=sg;
 const gold=new THREE.MeshStandardMaterial({color:0xffc83a,metalness:1,roughness:.22,emissive:0x2a1800});
 const done=o=>{o.traverse(q=>{if(q.isMesh){q.material=gold;q.castShadow=true}q.layers.set(1)});sg.add(o)};
 try{if(typeof P2ME==='function'&&P2ME()&&MSC&&MSC.assets){MSC.assets('p2').then(A=>{const C=createP2(THREE,Object.assign({},A,{height:150}));C.update(0,0,{speed:0});done(C.group)}).catch(()=>{const cg=new THREE.Group();buildCharacter(cg);cg.scale.setScalar(.62*36);done(cg)})}
  else{const cg=new THREE.Group();const api=buildCharacter(cg);try{api.gogo(true)}catch(e){}cg.scale.setScalar(.62*36);done(cg)}}catch(e){console.warn('statue',e)}
 W4.statueK=0;const sign=signMesh((W4.owner||'YOUR').toUpperCase()+'\'S TOWER','FORMERLY DA NAG DOUBLOON\'S');sign.position.set(26,0,-150+70+14);sign.rotation.y=-.35;sign.traverse(o=>o.layers.set(1));G.add(sign);
 // the camera pulls back to look at it, fireworks all round
 W4.fw=[];W4.cine=true;W4.cineT=clk.getElapsedTime()}
function topTick(t,dt){if(W4.vaultWheel)W4.vaultWheel.rotation.z+=dt*.6;if(W4.hoes)W4.hoes.forEach((h,i)=>{h.rotation.z=-.18+Math.sin(t*1.3+i)*.02});
 if(W4.statue){W4.statueK=Math.min(1,(W4.statueK||0)+dt*.25);W4.statue.position.y=880+W4.statueK*20;W4.statue.rotation.y+=dt*.2}
 if(W4.cine){const k=t-W4.cineT;if(k>14){W4.cine=false}else{camYaw=Math.sin(k*.25)*.6;camPitch=-.35;try{camDist=Math.min(900,16+k*140)}catch(e){}
  if(Math.random()<dt*6){const x=(Math.random()-.5)*300,y=700+Math.random()*400,z=-150+(Math.random()-.5)*300;for(let i=0;i<18;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(2.6,6,4),new THREE.MeshBasicMaterial({color:[0xffd040,0xff4060,0x60c0ff,0x80ff80][i%4],transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,fog:false}));
   m.position.set(x,y,z);m.layers.set(1);world.add(m);const a=Math.random()*6.283,e=Math.random()*3-1.5;W4.fw.push({m,vx:Math.cos(a)*Math.cos(e)*60,vy:Math.sin(e)*60,vz:Math.sin(a)*Math.cos(e)*60,life:1.6})}}}}
 if(W4.fw)for(let i=W4.fw.length-1;i>=0;i--){const f=W4.fw[i];f.life-=dt;f.vy-=30*dt;f.m.position.x+=f.vx*dt;f.m.position.y+=f.vy*dt;f.m.position.z+=f.vz*dt;f.m.material.opacity=Math.max(0,f.life/1.6);if(f.life<=0){world.remove(f.m);W4.fw.splice(i,1)}}}
// ---------------------------------------------------------------- floor 9, SWAMPED (the owner, Oct 20 23:20-23:24: "get swamped by 300 plus
// go-go form and normal form stink sheetos and a boss ... a giant black black go-go form stinksheeto"). Three hundred and twenty Stinksheet'Os
// pour across one huge landing, up to 140 at a time, in two looks (normal and Go-Go), drawn as two instanced shapes (two draws for all of
// them); the giant Black Black Go-Go Stinksheet'O holds the gate. They are ordinary members of the enemy list (kind 'stink'), so every
// weapon, pet, melon and mana move hits them and the host's snapshot carries them to everyone.
if(!HORDE_KINDS.includes('stink'))HORDE_KINDS.push('stink');
const SWM={im:null,ig:null,total:320,maxAlive:140,made:0,M:new THREE.Matrix4(),Q:new THREE.Quaternion(),E:new THREE.Euler(),P:new THREE.Vector3(),SC:new THREE.Vector3(1,1,1)};
function stinkGeo(gold){const S=THREE.SphereGeometry,C=THREE.CylinderGeometry,B=THREE.BoxGeometry,SK=0x7a4a2c,AF=gold?0xffc82a:0x15100c,SH=gold?0xd9a425:0x15151a,SN=0x6a3ab0;const k=1;
 return lodGeo([[new C(.16,.18,1.0,7),SK,-.3,.5,0],[new C(.16,.18,1.0,7),SK,.3,.5,0],[new B(.3,.18,.55),SN,-.3,.06,.1],[new B(.3,.18,.55),SN,.3,.06,.1],[new C(.42,.45,.5,10),SH,0,1.2,0],
  [new C(.4,.36,1.0,10),SK,0,1.9,0],[new C(.12,.14,1.0,6).rotateZ(.35),SK,-.62,1.85,0],[new C(.12,.14,1.0,6).rotateZ(-.35),SK,.62,1.85,0],[new S(.42,10,8),SK,0,2.75,.02],
  [new S(.86,12,9),AF,0,3.25,-.12,1.15,.92,1.05],[new S(.09,6,5),0xffffff,-.15,2.82,.38],[new S(.09,6,5),0xffffff,.15,2.82,.38]])}
function swarmMeshes(){if(SWM.im&&SWM.im.parent===world)return;const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.6,metalness:.05});
 SWM.im=new THREE.InstancedMesh(stinkGeo(false),mat,200);SWM.ig=new THREE.InstancedMesh(stinkGeo(true),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.35,metalness:.35,emissive:0x2a1800}),200);
 [SWM.im,SWM.ig].forEach(m=>{m.count=0;m.frustumCulled=false;m.castShadow=true;m.layers.set(1);world.add(m)})}
// the host spawns them in waves from the far side of the landing
// (Stinksheet'Os are on every floor now, a few at a time: they are drawn the same way everywhere; only floor 9 pours them in)
function swarmTick(t,dt){const F=W4.F;if(!F)return;if(!F.swarm&&!enemies.some(e=>e.kind==='stink')){if(SWM.im&&SWM.im.parent===world&&(SWM.im.count||SWM.ig.count)){SWM.im.count=0;SWM.ig.count=0}return}swarmMeshes();
 if(F.swarm&&!MP.client){const alive=enemies.reduce((a,e)=>a+(e.kind==='stink'&&e.hp>0?1:0),0);const big=F.P.find(p=>p.swarm);
  if(big&&SWM.made<SWM.total&&alive<SWM.maxAlive&&t-(SWM.lastT||0)>.12){SWM.lastT=t;for(let k=0;k<3&&SWM.made<SWM.total;k++){
    // reuse a fallen one if we can (the list stays short)
    let e=enemies.find(q=>q.kind==='stink'&&q.hp<=0&&t-q.dead>2.5);if(!e){e=l2AddHorde('stink');L2.hordeN=Math.max(0,(L2.hordeN|0)-1)}
    const x=lerp(big.x0+3,big.x1-3,Math.random()),z=lerp(big.z0+2,big.z0+16,Math.random());Object.assign(e,{x,z,hx:x,hz:z,mhp:Math.round(14*(1+.05*F.n)*(MP.on?1.3:1)),spd:R_(6.5,9),dmg:R_(2,4),cd:R_(.9,1.4),reach:2.4,xp:6,dead:-9,state:'chase',w4:1});e.hp=e.mhp;SWM.made++}}}
 // drawing them all: two instanced shapes, positions straight from the list (the host's, or the snapshot's)
 let n=0,g=0;for(let i=0;i<enemies.length;i++){const e=enemies[i];if(e.kind!=='stink')continue;e.gold=i%3===0;let fall=0;if(e.hp<=0){const k=t-e.dead;if(k>1.4)continue;fall=Math.min(1.5,k*2.2)}
  const y=h0(e)+(e.hp>0?Math.abs(Math.sin(t*9+e.x))*.25:-fall*.3);SWM.E.set(-fall,e.a||0,Math.sin(t*9+e.z)*.08);SWM.Q.setFromEuler(SWM.E);SWM.P.set(e.x,y,e.z);const s=e.gold?1.25:1.12;SWM.SC.set(s,s,s);SWM.M.compose(SWM.P,SWM.Q,SWM.SC);
  if(e.gold){if(g<200)SWM.ig.setMatrixAt(g++,SWM.M)}else if(n<200)SWM.im.setMatrixAt(n++,SWM.M)}
 SWM.im.count=n;SWM.ig.count=g;SWM.im.instanceMatrix.needsUpdate=true;SWM.ig.instanceMatrix.needsUpdate=true}
// one of them, thinking (the host): straight at the nearest player, shoving apart from the others, a slap when close
function stinkTick(e,t,dt){if(e.hp<=0){if(e.g&&e.g.visible)e.g.visible=false;return}const tp=mpTarget(e.x,e.z);if(MP.client||!tp||tp.dead)return;
 if(!(W4.F&&W4.F.swarm)&&Math.hypot(tp.x-e.x,tp.z-e.z)>30&&t-(e.w4hit||-9)>6)return;
 const dx=tp.x-e.x,dz=tp.z-e.z,d=Math.hypot(dx,dz)||1;e.a=Math.atan2(dx,dz);let vx=0,vz=0;if(d>1.8){vx=dx/d;vz=dz/d}
 if(frame%3===(e.hx|0)%3){let sx=0,sz=0,c=0;for(const o of enemies){if(o===e||o.kind!=='stink'||o.hp<=0)continue;const ax=e.x-o.x,az=e.z-o.z,q=ax*ax+az*az;if(q<4&&q>1e-4){const L=Math.sqrt(q);sx+=ax/L*(2-L);sz+=az/L*(2-L);if(++c>6)break}}e.sep=[sx,sz]}
 if(e.sep){vx+=e.sep[0]*.8;vz+=e.sep[1]*.8}const l=Math.hypot(vx,vz);if(l>.01){const nx=e.x+vx/l*e.spd*dt,nz=e.z+vz/l*e.spd*dt;if(towerH(nx,nz)>=towerH(e.x,e.z)-2.4&&towerH(nx,nz)-towerH(e.x,e.z)<1.6){e.x=nx;e.z=nz;e.mvK=true}}
 if(d<e.reach&&t-e.swing>e.cd){e.swing=t;mpHurt(tp,Math.max(1,Math.round(e.dmg*(1+.03*(W4.fl||1)))))}
 if(e.g)e.g.position.set(e.x,h0(e),e.z)}
// floor 9's own shape: the landing, one huge arena, the guardian's landing
function swarmFloor(n,seed){const P=[],G=[];const add=(x0,x1,z0,z1,top,kind,o)=>{const p=Object.assign({x0,x1,z0,z1,top,kind,i:P.length},o||{});P.push(p);return p};
 const entry=add(X0-20,X0+20,0,26,BASEH,'entry',{cp:true});add(X0-6,X0+6,-14,0,BASEH,'bridge');
 const big=add(X0-44,X0+44,-150,-14,BASEH+1.2,'plaza',{cp:true,swarm:1});G.push({pi:big.i,n:10,kinds:['doubloon','toast','zombie','redcap','tiki']});   // (not only Stinksheet'Os: everybody else came to watch)
 const ex=add(X0-20,X0+20,-188,-158,BASEH+3,'exit',{cp:true});const gate={x:X0,z:ex.z0+1.2,w:10,h:13,top:ex.top};const zEnd=ex.z0-6;
 return {n,seed,th:THEMES[(n-1)%THEMES.length],P,M:[],G,entry,exit:ex,gate,zEnd,kinds:['stink'],guard:'zombie',skin:'giantgogo',gname:'Giant Black Black Go-Go Stinksheet\'O',name:floorName(n),zMin:zEnd-8,zMax:34,xMin:X0-60,xMax:X0+60,swarm:1}}
// ---------------------------------------------------------------- the owner's uploads, in the tower: Propeller Pete (the voxel man in the
// powered chair with the propeller hat: an NPC who has been up and down this tower more than anyone) and the Voxel Reaper Scythe (a melee
// weapon from the market: a full spin that cuts everyone around you; its model loads from w4/scythe.js the first time it is needed)
const PT={P:null};
function peteProto(){if(PT.P)return PT.P;const PM=window.PeteModel;if(!PM)return null;const M=PM.buildModel();
 const mats={};Object.keys(M.materials).forEach(k=>{const d=M.materials[k];const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:d.rough===undefined?.7:d.rough,metalness:d.metal||0});
  if(d.base)m.color.setRGB(d.base[0],d.base[1],d.base[2]);if(d.emissive){m.emissive.setRGB(d.emissive[0],d.emissive[1],d.emissive[2]);m.emissiveIntensity=1.2}mats[k]=m});
 const mk=(p,skinned)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p.pos,3));g.setAttribute('normal',new THREE.BufferAttribute(p.nrm,3));g.setAttribute('color',new THREE.BufferAttribute(p.col,3));
  if(skinned){g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(Array.from(p.jnt),4));g.setAttribute('skinWeight',new THREE.BufferAttribute(p.wgt,4))}g.setIndex(new THREE.BufferAttribute(p.idx,1));g.computeBoundingSphere();return g};
 const geos={};M.nodes.forEach(n=>{if(n.mesh)geos[n.name]=n.mesh.map(p=>({g:mk(p,false),m:p.mat}))});
 const sk=(M.skinned||[]).map(s=>({name:s.name,space:s.space,joints:s.joints,prims:s.prims.map(p=>({g:mk(p,true),m:p.mat})),inv:null,bind:null}));
 return PT.P={M,mats,geos,sk,V:M.V}}
function peteBuild(){const P=peteProto();if(!P)return null;const M=P.M;const root=new THREE.Group(),nodes={};
 M.nodes.forEach(n=>{const o=new THREE.Group();o.name=n.name;o.position.set(n.t[0],n.t[1],n.t[2]);o.rotation.set(n.r[0],n.r[1],n.r[2]);if(n.s)o.scale.set(n.s[0],n.s[1],n.s[2]);o.userData.r0=n.r;o.userData.t0=n.t;o.userData.bone=!!n.bone;nodes[n.name]=o});
 M.nodes.forEach(n=>{(n.parent?nodes[n.parent]:root).add(nodes[n.name]);const G=P.geos[n.name];if(G)G.forEach(q=>{const m=new THREE.Mesh(q.g,P.mats[q.m]);m.castShadow=true;m.receiveShadow=true;nodes[n.name].add(m)})});
 const bones=Object.values(nodes).filter(o=>o.userData.bone);bones.forEach(o=>o.rotation.set(0,0,0));root.updateMatrixWorld(true);
 P.sk.forEach(s=>{const space=nodes[s.space];const B=s.joints.map(j=>nodes[j]);s.prims.forEach(q=>{const m=new THREE.SkinnedMesh(q.g,skinMat(P.mats[q.m]));m.castShadow=true;m.frustumCulled=false;space.add(m);m.updateMatrixWorld(true);
   if(!s.inv){const sk0=new THREE.Skeleton(B);s.inv=sk0.boneInverses;s.bind=m.matrixWorld.clone()}m.bind(new THREE.Skeleton(B,s.inv),s.bind)})});
 bones.forEach(o=>{const r=o.userData.r0;o.rotation.set(r[0],r[1],r[2])});
 const wrap=new THREE.Group();wrap.add(root);root.updateMatrixWorld(true);const bb=new THREE.Box3().setFromObject(root);const h=Math.max(.3,bb.max.y-bb.min.y);root.scale.setScalar(4.6/h);root.position.y=-bb.min.y*4.6/h;
 return {g:wrap,root,nodes}}
function peteApply(B,o,dt){const N=B.nodes,V=PT.P.V,bk=1-Math.exp(-dt*12);
 for(const k in o){const n=N[k];if(!n)continue;const r0=n.userData.r0,t0=n.userData.t0,d=o[k],r=n.rotation,p=n.position;if(!d||!d.r)continue;r.set(r.x+(r0[0]+d.r[0]-r.x)*bk,r.y+(r0[1]+d.r[1]-r.y)*bk,r.z+(r0[2]+d.r[2]-r.z)*bk);if(d.t)p.set(p.x+(t0[0]+d.t[0]*V-p.x)*bk,p.y+(t0[1]+d.t[1]*V-p.y)*bk,p.z+(t0[2]+d.t[2]*V-p.z)*bk)}}
function peteAnim(B,t,dt,clip){if(!B||!window.PeteModel)return;const C=PeteModel.CLIPS[clip]||PeteModel.CLIPS.Idle;let o;try{o=PeteModel.pose(clip,t%C.duration)}catch(e){return}peteApply(B,o,dt);const N=B.nodes;if(N.Propeller)N.Propeller.rotation.y+=dt*18}
// ---- rolling (the owner, Oct 21 06:50: "make them actually roll their wheels, like they use their hands to roll their wheels in the chair"):
// Pete roves around his landing in a loop, pushing the hand rims: both hands reach back to the top of the wheels, shove forward (he leans into
// it, the chair surges), lift, swing back and grab again; the wheels turn exactly as far as he travels, the casters spin faster, and he
// stops and rests his hands when somebody comes up to talk. Online the host drives him and the snapshot keeps him in step on every screen.
const PUSH={per:1.5,spd:3.4};
function petePushPose(u){const S=Math.sin,PI2=Math.PI*2,sst=(a,b,x)=>{x=Math.max(0,Math.min(1,(x-a)/(b-a)));return x*x*(3-2*x)},bump=(x,a,b)=>{if(x<=a||x>=b)return 0;const q=(x-a)/(b-a);return Math.sin(Math.PI*q)**2};
 const s=sst(.08,.6,u),lift=bump(u,.58,1),push=bump(u,.05,.62),ret=sst(.62,.98,u);const a=u<.62?.62-.8*s:-.18+.8*ret;   // the hands along the rims: back (+) to front (-), then back round while lifted
 const o={};const R=(n,x,y,z)=>{o[n]={r:[x,y,z],t:[0,0,0]}};const T=(n,x,y,z)=>{(o[n]||(o[n]={r:[0,0,0],t:[0,0,0]})).t=[x,y,z]};
 R('ArmR',a,0,-.3-lift*.25);R('ForearmR',2.35-lift*.6,0,0);R('ArmL',1.5+a*1.15,.3+lift*.25,0);   // (the hands reach outside the wheels to the rims; on the way back they swing out and clear them)
 const hop=bump(u,.5,.78);   // the shove ends with a little hop: the chair lifts off the bumps and settles, the casters wobble
 R('Torso',.14*push-.04*lift,0,.02*S(PI2*u));R('Head',-.1*push+.05*lift-.04*hop,0,.03*S(PI2*u));T('Chair',0,.25*push+2.4*hop,0);R('Chair',-.015*push-.05*hop,0,.02*S(PI2*u*2)*hop);
 R('LegR',.1*push+.06*hop,0,0);R('LegL',.1*push+.06*hop,0,0);R('Joystick',0,0,0);R('Caster_R',0,.1*S(PI2*u)+.25*S(PI2*u*3)*hop,0);R('Caster_L',0,-.1*S(PI2*u+1)-.25*S(PI2*u*3+1)*hop,0);return o}
function peteRoveInit(N){const F=W4.F;if(!F||!N.f.pete)return;const p=F.P.find(q=>N.x>=q.x0&&N.x<=q.x1&&N.z>=q.z0&&N.z<=q.z1&&Math.abs(q.top-N.top)<.6);if(!p||p.kind!=='plaza')return;
 // his loop: an ellipse on the landing (a raised block in the way turns him round, so he patrols back and forth between them)
 const rx=Math.min(11,(p.x1-p.x0)/2-6),rz=Math.min(9,(p.z1-p.z0)/2-6);if(rx<3.5||rz<3.5)return;const cx=Math.max(p.x0+rx+4,Math.min(p.x1-rx-4,N.x)),cz=Math.max(p.z0+rz+4,Math.min(p.z1-rz-4,N.z));
 N.rove={cx,cz,rx,rz,th:Math.atan2(N.x-cx,N.z-cz),ct:0,spd:0,wa:0,ca:0,top:p.top,dir:1}}
function peteTick(N,t,dt){const B=N.f.pete,R=N.rove;if(!B)return;if(!R){peteAnim(B,t,dt,'Idle');return}
 // stop for company (anyone within eleven paces, or a talk): hands back on the lap
 let near=Math.hypot(heroPos.x-N.g.position.x,heroPos.z-N.g.position.z)<11||(W4.talk&&W4.talk.N===N);if(!near)for(const id in MP.players){const q=MP.players[id].st;if(q&&!q.dead&&Math.hypot(q.x-N.g.position.x,q.z-N.g.position.z)<11){near=true;break}}
 const host=!MP.on||!MP.client;if(host){const want=near?0:PUSH.spd;R.spd+=(want-R.spd)*Math.min(1,dt*(near?6:2))}
 const u=(R.ct/PUSH.per)%1,surge=.55+.9*(u>.05&&u<.62?Math.sin(Math.PI*(u-.05)/.57)**2:0);const v=R.spd*surge;
 if(R.spd>.05){R.ct+=dt;const ds=v*dt,rad=Math.hypot(R.rx*Math.cos(R.th),R.rz*Math.sin(R.th))||1;const th2=R.th+R.dir*ds/rad,nx=R.cx+R.rx*Math.sin(th2),nz=R.cz+R.rz*Math.cos(th2);
  const h=towerH(nx,nz);if(host&&(h>R.top+.3||h<R.top-.5)){R.dir=-R.dir;R.ct=Math.max(0,R.ct-.4)}else{R.th=th2;R.wa+=ds;R.ca+=ds}}   // a block ahead (or the edge): he turns round
 const x=R.cx+R.rx*Math.sin(R.th),z=R.cz+R.rz*Math.cos(R.th);N.g.position.set(x,R.top,z);N.x=x;N.z=z;N.roving=R.spd>.05;
 if(N.roving){const yaw=Math.atan2(R.dir*R.rx*Math.cos(R.th),-R.dir*R.rz*Math.sin(R.th));let dy=yaw-N.g.rotation.y;dy=Math.atan2(Math.sin(dy),Math.cos(dy));N.g.rotation.y+=dy*Math.min(1,dt*4)}
 if(N.roving)peteApply(B,petePushPose(u),dt);else peteAnim(B,t,dt,'Idle');
 // the wheels turn as far as he has rolled (the rims under his hands; the little casters spin faster), the propeller idles
 const k=B.root.scale.x||1,Nn=B.nodes,wr=.28*k,cr=.094*k;['Wheel_R','Wheel_L'].forEach(n=>{if(Nn[n])Nn[n].rotation.x=R.wa/wr});['CasterWheel_R','CasterWheel_L'].forEach(n=>{if(Nn[n])Nn[n].rotation.x=R.ca/cr});
 if(Nn.Propeller)Nn.Propeller.rotation.y+=dt*(N.roving?7:18)}
// the scythe's model: the owner's voxel scythe (loaded once), a stand-in until then
const SCY={p:null,model:null};
function scytheLoad(){if(SCY.p)return SCY.p;const base=window.MS_ASSET_BASE||'',urls=[base+'w4/scythe.js',base+'scythe.js'];
 const viaFetch=u=>fetch(u).then(r=>{if(!r.ok)throw new Error('http '+r.status);return r.text()}).then(t=>{const i=t.indexOf('"'),j=t.lastIndexOf('"');if(i<0||j<=i+1000)throw new Error('bad scythe data');return t.slice(i+1,j)});
 const viaTag=u=>new Promise((res,rej)=>{const s=document.createElement('script');s.src=u;s.async=true;s.onload=()=>window.SCYTHE_GLB?res(window.SCYTHE_GLB):rej(new Error('scythe data missing'));s.onerror=()=>rej(new Error('scythe could not load'));document.head.appendChild(s)});
 const at=k=>k>=urls.length?Promise.reject(new Error('the scythe could not load')):viaFetch(urls[k]).catch(()=>viaTag(urls[k])).catch(()=>at(k+1));
 return SCY.p=(window.SCYTHE_GLB?Promise.resolve(window.SCYTHE_GLB):at(0)).then(b64=>{const raw=atob(b64),u=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)u[i]=raw.charCodeAt(i);return new Promise((res,rej)=>new THREE.GLTFLoader().parse(u.buffer,'',res,rej))})
  .then(g=>{const m=g.scene;m.traverse(o=>{if(o.isMesh){o.castShadow=true;if(o.material&&o.material.emissive)o.material.emissiveIntensity=emisStrength(g,o.material)}});const bb=new THREE.Box3().setFromObject(m),sz=bb.getSize(new THREE.Vector3());const k=7/Math.max(sz.x,sz.y,sz.z);m.scale.setScalar(k);const c=bb.getCenter(new THREE.Vector3());m.position.set(-c.x*k,-c.y*k,-c.z*k);
   const w=new THREE.Group();w.add(m);SCY.model=w;return w}).catch(e=>{console.warn('scythe',e);return null})}
function scytheModel(){if(SCY.model){const c=SCY.model.clone(true);return c}scytheLoad();if(SCY.stand)return SCY.stand.clone(true);const g=new THREE.Group();SCY.stand=g;const pole=new THREE.Mesh(new THREE.CylinderGeometry(.12,.14,6,8),new THREE.MeshStandardMaterial({color:0x2a1a2a,roughness:.6}));g.add(pole);
 const bl=new THREE.Mesh(new THREE.TorusGeometry(1.8,.18,6,24,Math.PI*.8),new THREE.MeshStandardMaterial({color:0x9a60ff,metalness:.8,roughness:.25,emissive:0x2a0a5a}));bl.position.set(1.2,2.7,0);g.add(bl);return g}
MELEE.scythe={mul:3,reach:8.5,cd:.62,col:0xb070ff,spin:1};
IT.scythe={n:'Voxel Reaper Scythe',i:'⚰️',d:'Melee. A full spin: 3x your punch to everyone around you, 8 paces out.',w:'scythe'};
SHOP.splice(6,0,{it:'scythe',p:420,one:1});
// ---------------------------------------------------------------- LOOT RARITY AND THE SECRET WEAPONS (the owner, Oct 21 11:59: "make sure the
// quests have rewards that carry over, whether it's just something very small like a currency or a single potion or something like a crazy
// ultra rare weapon or other item"; "secret weapons, secret chests"). Every item has a rarity, shown by its colour in the bag, in the toast
// when you get it and on the ring under it on the floor: Common, Uncommon, Rare, Epic, Legendary, Mythic. Five weapons exist only as loot
// (quests, puzzles, vaults, secret rooms): the Brigade Scepter (epic), the Ancestors' Golden Pick and the Diamond Dabloon Axe (legendary),
// Nagrock's Abyss Cleaver and the Golden AK-47 (mythic). Everything you get goes in your bag or your pocket, which the tower saves: it all
// carries over from floor to floor and from one visit to the next.
const RAR={c:{n:'Common',col:'#e8e2d4',hex:0xe8e2d4},u:{n:'Uncommon',col:'#7aff9a',hex:0x7aff9a},r:{n:'Rare',col:'#6ac8ff',hex:0x6ac8ff},e:{n:'Epic',col:'#c890ff',hex:0xc890ff},l:{n:'Legendary',col:'#ffb040',hex:0xffb040},m:{n:'Mythic',col:'#ff5a5a',hex:0xff5a5a}};
const RARO=['c','u','r','e','l','m'];
{const set=(k,r)=>{if(IT[k])IT[k].rar=r};['coin','hp','mp'].forEach(k=>set(k,'c'));['hp2','pick','ak','launcher','boombox','gkey'].forEach(k=>set(k,'u'));['feather','axe','key'].forEach(k=>set(k,'r'));set('scythe','e');
 Object.keys(IT).forEach(k=>{if(IT[k].q&&!IT[k].rar)IT[k].rar='u'})}
// the loot-only weapons
Object.assign(MELEE,{scepter:{mul:3.8,reach:7.5,cd:.5,col:0xc070ff},gpick:{mul:4.6,reach:7,cd:.36,col:0xffe070},daxe:{mul:6.2,reach:9,cd:.78,col:0x9fe8ff},cleaver:{mul:5.4,reach:10,cd:.55,col:0xff3a10,spin:1}});
Object.assign(IT,{scepter:{n:'The Brigade Scepter',i:'🔱',d:'Epic melee. Supreme Big Nag Eastside\'s spare. A wide purple arc: 3.8x your punch, 7.5 paces out.',w:'scepter',rar:'e',loot:1},
 gpick:{n:'The Ancestors\' Golden Pick',i:'✨',d:'Legendary melee. Every afro that ever was, in one pick. Fast and wide: 4.6x your punch.',w:'gpick',rar:'l',loot:1},
 daxe:{n:'The Diamond Dabloon Axe',i:'💠',d:'Legendary melee. The Dabloon\'s best axe, cut from one diamond. Slow, enormous: 6.2x your punch, 9 paces out.',w:'daxe',rar:'l',loot:1},
 cleaver:{n:'Nagrock\'s Abyss Cleaver',i:'🗡️',d:'Mythic melee. He left it on a landing. A full spin of fire: 5.4x your punch to everyone around you, 10 paces out.',w:'cleaver',rar:'m',loot:1},
 goldak:{n:'The Golden AK-47',i:'🏆',d:'Mythic. The AK-47, in gold, with gold rounds: 1.8x the damage. Equip it like the AK.',w:'ak',gold:1,rar:'m',loot:1}});
const MKINDS=['pick','axe','scythe','scepter','gpick','daxe','cleaver'];
const MBEST=['cleaver','daxe','gpick','scepter','scythe','axe','pick'];   // the wheel's melee slot takes the best one you own
// their models (made once, copied for each swing)
function scepterModel(){const g=new THREE.Group();const gold=new THREE.MeshStandardMaterial({color:0xd9a425,metalness:1,roughness:.25}),orb=new THREE.MeshStandardMaterial({color:0x8a40ff,emissive:0x5010c0,emissiveIntensity:1.6,roughness:.15,metalness:.2});
 const st=new THREE.Mesh(new THREE.CylinderGeometry(.1,.14,3.6,8),gold);g.add(st);const o=new THREE.Mesh(new THREE.SphereGeometry(.42,14,10),orb);o.position.y=2.05;g.add(o);
 for(let i=0;i<3;i++){const p=new THREE.Mesh(new THREE.ConeGeometry(.12,.7,6),gold);const a=i/3*6.283;p.position.set(Math.sin(a)*.36,1.95,Math.cos(a)*.36);p.rotation.set(Math.cos(a)*.5,0,-Math.sin(a)*.5);g.add(p)}g.rotation.x=1.2;return g}
function goldPickModel(){const g=pickModel();const gold=new THREE.MeshStandardMaterial({color:0xffe070,metalness:1,roughness:.12,emissive:0x6a4a00,emissiveIntensity:.8});g.traverse(o=>{if(o.isMesh)o.material=gold});return g}
function diamondAxeModel(){const g=axeModel();const dia=new THREE.MeshStandardMaterial({color:0x9fe8ff,metalness:.1,roughness:.04,emissive:0x2a6a8a,emissiveIntensity:.9,transparent:true,opacity:.92});g.traverse(o=>{if(o.isMesh&&o.geometry&&o.geometry.type!=='CylinderGeometry'||o.isMesh&&o.geometry.parameters&&o.geometry.parameters.radiusTop>1)o.material=dia});return g}
function cleaverModel(){const g=new THREE.Group();const dark=new THREE.MeshStandardMaterial({color:0x1a0a08,metalness:.8,roughness:.35}),edge=new THREE.MeshStandardMaterial({color:0xff3a10,emissive:0xff2a00,emissiveIntensity:2,roughness:.3});
 const h=new THREE.Mesh(new THREE.CylinderGeometry(.13,.16,2.4,8),dark);h.position.y=-.6;g.add(h);const b=new THREE.Mesh(new THREE.BoxGeometry(.16,2.6,1.5),dark);b.position.set(0,1.6,.45);g.add(b);
 const e=new THREE.Mesh(new THREE.BoxGeometry(.18,2.6,.14),edge);e.position.set(0,1.6,1.2);g.add(e);g.rotation.x=1.2;return g}
{const TM={pick:()=>pickModel(),axe:()=>axeModel(),scepter:scepterModel,gpick:goldPickModel,daxe:diamondAxeModel,cleaver:cleaverModel};
 toolProto=function(kind){return TOOLP[kind]||(TOOLP[kind]=(TM[kind]||TM.pick)())}}
// the swing on the partner's screen names the weapon by its place in MKINDS
MPFX_DO.w4s=(P,a,t)=>{if(Array.isArray(a))swingFx(+a[0],+a[1],+a[2],+a[3],MKINDS[a[4]|0]||'pick')};
// the legendary swings leave something behind: the golden pick sparkles, the diamond axe rings, the cleaver burns
(function(){const sf=swingFx;swingFx=function(x,y,z,yaw,kind){const r=sf(x,y,z,yaw,kind);try{const M=MELEE[kind]||MELEE.pick,fx=x+Math.sin(yaw)*M.reach*.6,fz=z+Math.cos(yaw)*M.reach*.6;
  if(kind==='gpick')burstFx(fx,y+2,fz,0xffe070,10,6);else if(kind==='daxe'){ringFx2(fx,y,fz,0x9fe8ff,5);burstFx(fx,y+2,fz,0xdff8ff,8,5)}else if(kind==='cleaver'){ringFx2(x,y,z,0xff4a10,M.reach*.55);burstFx(x,y+2,z,0xff6a20,12,8);smokeFx(x,y+1.5,z,2,true)}else if(kind==='scepter')burstFx(fx,y+2.2,fz,0xb070ff,8,5)}catch(_){}return r}})();
// equipping: the wheel's melee slot takes your best melee weapon; the Golden AK is the AK, in gold
(function(){const eq=equipW;equipW=function(it){const D=IT[it];W4.goldAk=!!(D&&D.gold);const r=eq(it);try{goldAkLook(W4.goldAk&&charApi&&charApi.weapon()==='ak')}catch(e){}return r};
 try{WHEEL.forEach(w=>{if(w.id==='pick'){w.go=()=>{if(W4.on){const b=MBEST.find(k=>bagCount(k)>0)||'pick';equipW(b);return}equipW('pick')}}else if(w.id==='ak'){const go=w.go;w.go=()=>{if(W4.on){W4.melee=null;W4.goldAk=bagCount('goldak')>0}go();try{goldAkLook(W4.goldAk)}catch(e){}}}})}catch(e){console.warn('tower wheel loot',e)}})();
const GOLDM={};function goldAkLook(on){const A=charApi&&charApi.AK;if(!A)return;if(!GOLDM.m)GOLDM.m=new THREE.MeshStandardMaterial({color:0xffc83a,metalness:1,roughness:.22,emissive:0x3a2600});
 A.traverse(o=>{if(!o.isMesh||(o.material&&o.material.side===THREE.BackSide))return;if(on){if(!o.userData.m0)o.userData.m0=o.material;o.material=GOLDM.m}else if(o.userData.m0){o.material=o.userData.m0}})}
// the golden rounds: the AK wrapper fires them (1.8x damage, gold tracers)
(function(){const ak=akTick;akTick=function(t,dt){if(!(W4.on&&W4.goldAk))return ak(t,dt);const m=L2.akMul,tm=L2.trMat;L2.akMul=m*1.8;if(!GOLDM.tr)GOLDM.tr=new THREE.MeshBasicMaterial({color:0xffe060,toneMapped:false});L2.trMat=GOLDM.tr;try{return ak(t,dt)}finally{L2.akMul=m;L2.trMat=tm}}})();
// ---- the rolls: what a quest, a chest, a vault or a secret room gives (the higher the floor, the better the odds)
const ROLL={quest:[45,30,15,7,2.5,.5],chest:[40,32,18,7,2.5,.5],vault:[0,30,35,22,10,3],secret:[0,0,48,32,15,5],puzzle:[10,32,30,18,8,2]};
function lootRoll(src,n,r){const W=ROLL[src]||ROLL.chest;const up=Math.min(1.8,1+n/90);const ww=W.map((v,i)=>v*(i>=2?up:1));const tot=ww.reduce((a,b)=>a+b,0);let x=r()*tot,k=0;while(k<5&&x>=ww[k]){x-=ww[k];k++}const tier=RARO[k];
 const pick=L=>L[(r()*L.length)|0];const have=it=>bagCount(it)>0||(W4.melee===it);
 // every tier gives an item of its own rarity (one you do not have yet, when it is a weapon), and more doubloons the rarer it is
 if(tier==='c')return {tier,items:[[pick(['hp','mp']),1]],coins:15+3*n};
 if(tier==='u'){const w=['pick','ak','launcher','boombox'].filter(k=>!have(k));return {tier,items:[w.length&&r()<.35?[pick(w),1]:['hp2',r()<.5?1:2]],coins:25+4*n}}
 if(tier==='r'){const w=['axe'].filter(k=>!have(k));return {tier,items:[w.length&&r()<.4?[w[0],1]:['feather',1]],coins:40+5*n}}
 if(tier==='e'){const w=['scepter','scythe'].filter(k=>!have(k));return {tier,items:[w.length?[pick(w),1]:['feather',2]],coins:w.length?60+6*n:200+8*n}}
 if(tier==='l'){const w=['gpick','daxe'].filter(k=>!have(k));return {tier,items:[w.length?[pick(w),1]:['feather',3]],coins:w.length?80+8*n:400+10*n}}
 const wm=['cleaver','goldak'].filter(k=>!have(k));return {tier,items:[wm.length?[pick(wm),1]:['feather',3]],coins:wm.length?120+10*n:800+15*n}}
function lootLabel(L){const t=RAR[L.tier];const it=L.items[0]&&IT[L.items[0][0]];return '<span style="color:'+t.col+'">'+t.n+'</span>'+(it&&IT[L.items[0][0]].rar!=='c'&&L.tier!=='c'&&L.tier!=='u'?' · '+esc4(it.n):'')}
// straight into your bag and pocket (a quest's reward)
function lootGive(L){W4.coins=(W4.coins|0)+(L.coins|0);const got=[];L.items.forEach(([it,k])=>{const n=bagPut(it,k);if(n>0)got.push(IT[it].i+' '+IT[it].n+(n>1?' x'+n:''));else dropAdd(it,k,heroPos.x+1.5,heroPos.z)});
 const t=RAR[L.tier];toast(t.n.toUpperCase()+' reward: +'+(L.coins|0)+' doubloons'+(got.length?' + '+got.join(', '):''));try{const e=document.getElementById('toast');e.style.color=t.col;clearTimeout(W4.toastC);W4.toastC=setTimeout(()=>{e.style.color=''},3200)}catch(e){}
 if(L.tier==='l'||L.tier==='m'){try{bossYell(t.n.toUpperCase()+'!',got.join(', ')||'Something shiny');dblChing(heroPos.x,heroPos.z,.8,.9,6);shake=Math.max(shake,.5)}catch(e){}}saveNow();W4.hud()}
// out of a chest: everything flies out and lands around it (the host drops it)
function lootSpill(L,x,y,z,t0){if(MP.client)return;const put=(it,k,dx,dz)=>{try{const d=dropAdd(it,k,x+dx,z+dz,{hold:t0+1.1});if(d)d.pop=[x,y,z,t0+Math.random()*.25]}catch(e){}};
 const c=L.coins|0;put('coin',Math.ceil(c/3),-2.2,2.6);put('coin',Math.ceil(c/3),2.2,3);put('coin',Math.max(1,c-2*Math.ceil(c/3)),0,4.2);L.items.forEach(([it,k],i)=>put(it,k,(i%2?1.4:-1.4),5.4+i*.8));
 if(L.tier!=='c'&&L.tier!=='u'){const t=RAR[L.tier];try{bossYell(t.n.toUpperCase()+' LOOT!',L.items.map(([it])=>IT[it].n).join(', '));mpFx('t',[R1(x),R1(y+5),R1(z),t.n.toUpperCase()+'!',t.col,3])}catch(e){}}}
// the bag and the drops show the rarity (the slot's border, the name, the ring under it on the floor)
(function(){const br=bagRender;bagRender=function(){const r=br.apply(this,arguments);try{const el=$('w4bag');if(el)el.querySelectorAll('.w4s[data-s]').forEach(b=>{const q=W4.bag[+b.dataset.s];const R=q&&IT[q.it]&&RAR[IT[q.it].rar];b.style.boxShadow=R&&IT[q.it].rar!=='c'?'inset 0 0 0 2px '+R.col:''});
  const s=W4.bag[W4.bagSel|0],nm=el&&el.querySelector('.w4d .nm');if(s&&nm&&IT[s.it]&&RAR[IT[s.it].rar]){const R=RAR[IT[s.it].rar];nm.style.color=R.col;nm.insertAdjacentHTML('beforeend',' <small style="opacity:.8">· '+R.n+'</small>')}}catch(e){}return r}})();
(function(){const dm=dropMesh;dropMesh=function(it,n){const g=dm(it,n);try{const R=RAR[IT[it]&&IT[it].rar];if(R&&IT[it].rar!=='c'&&it!=='coin'){g.children.forEach(c=>{if(c.geometry&&c.geometry.type==='RingGeometry'){c.material=c.material.clone();c.material.color.setHex(R.hex);c.material.opacity=.9}});
  if(IT[it].rar==='l'||IT[it].rar==='m'){const b=new THREE.Mesh(new THREE.CylinderGeometry(.5,.9,14,12,1,true),new THREE.MeshBasicMaterial({color:R.hex,transparent:true,opacity:.22,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));b.position.y=7;b.layers.set(1);g.add(b)}}}catch(e){}return g}})();   // (a legendary or mythic drop sends a beam of light up)
// a quest's reward is promised up front (the same on every screen: the floor decides it)
(function(){const qg=questGen;questGen=function(F){qg(F);const q=W4.q;if(!q)return;q.loot=lootRoll('quest',F.n,srand(F.seed*61+F.n*19+5))}})();
// ---------------------------------------------------------------- THE ITEMS, MADE PROPERLY (the owner, Oct 21 12:39: "make sure those items
// models have life, shine, depth, texture, hi rez hi quality models"; "should be able to hover over items in ur bag and it gives details on
// items, damage, sell price, everything, speed"). Every item is a real model now (it was a flat emoji on the floor): glass flasks with the
// potion sloshing inside and bubbles rising, a phoenix feather that sheds embers, gold with engraving you can see the light catch, wood grain,
// leather grips, cut gems, a record with its grooves, a battery with a working propeller, and every weapon (the five secret ones too). The
// same model is the thing on the floor, the weapon in a swing, and (photographed once) the picture in your bag; hover a bag slot (or pick
// it) for everything about it: damage, speed, reach, what it heals, stack, buy and sell price. Selling: at Da Nag Market.
const ITX={},ITM={};
function itRng(s){return function(){s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function itCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h||w;return c}
function itTex(c,lin,rx,ry){const t=new THREE.CanvasTexture(c);if(!lin)t.encoding=THREE.sRGBEncoding;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;if(rx)t.repeat.set(rx,ry||rx);return t}
// a normal map from a picture's brightness (bright is high): the depth the light catches
function itNormal(c,str,rx,ry){const w=c.width,h=c.height,src=c.getContext('2d').getImageData(0,0,w,h).data,o=itCanvas(w,h),g=o.getContext('2d'),img=g.createImageData(w,h),d=img.data;
 const L=new Float32Array(w*h);for(let i=0;i<w*h;i++)L[i]=(src[i*4]*.3+src[i*4+1]*.59+src[i*4+2]*.11)/255;const H=(x,y)=>L[((y+h)%h)*w+((x+w)%w)];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=(H(x+1,y)-H(x-1,y))*str,dy=(H(x,y+1)-H(x,y-1))*str,l=Math.hypot(dx,dy,1),i=(y*w+x)*4;d[i]=(-dx/l*.5+.5)*255;d[i+1]=(dy/l*.5+.5)*255;d[i+2]=(1/l*.5+.5)*255;d[i+3]=255}
 g.putImageData(img,0,0);return itTex(o,true,rx,ry)}
function itNoise(g,w,h,amt,r){const im=g.getImageData(0,0,w,h),d=im.data;for(let i=0;i<d.length;i+=4){const n=(r()-.5)*amt;d[i]+=n;d[i+1]+=n;d[i+2]+=n}g.putImageData(im,0,0)}
// ---- the pictures (drawn once, the same on every screen)
function txWood(tone){const k='wood'+tone;if(ITX[k])return ITX[k];const c=itCanvas(256,512),g=c.getContext('2d'),r=itRng(tone.length*97+7);const B=tone==='ebony'?[44,30,26]:tone==='mahog'?[118,50,30]:[140,90,50];
 g.fillStyle='rgb('+B+')';g.fillRect(0,0,256,512);
 for(let i=0;i<90;i++){const x0=r()*256,dk=.5+r()*.4;g.strokeStyle='rgba('+B.map(v=>v*dk|0)+','+(.2+r()*.45)+')';g.lineWidth=.6+r()*2.4;g.beginPath();for(let y=0;y<=512;y+=8){const x=x0+Math.sin(y*.011+i)*7+Math.sin(y*.047+i*2.3)*1.6;if(y)g.lineTo(x,y);else g.moveTo(x,y)}g.stroke()}
 for(let i=0;i<40;i++){const x0=r()*256;g.strokeStyle='rgba(255,230,190,'+(.04+r()*.06)+')';g.lineWidth=1+r()*3;g.beginPath();g.moveTo(x0,0);for(let y=0;y<=512;y+=16)g.lineTo(x0+Math.sin(y*.013+i)*7,y);g.stroke()}
 for(let i=0;i<2;i++){const x=50+r()*156,y=80+r()*352;for(let k=9;k>0;k--){g.strokeStyle='rgba('+B.map(v=>v*.45|0)+',.32)';g.lineWidth=1.3;g.beginPath();g.ellipse(x,y,k*2.4,k*6,0,0,7);g.stroke()}}
 itNoise(g,256,512,16,r);return ITX[k]={map:itTex(c),nm:itNormal(c,2.6)}}
function txLeather(){if(ITX.lea)return ITX.lea;const c=itCanvas(256,256),g=c.getContext('2d'),r=itRng(11);g.fillStyle='#2a1a10';g.fillRect(0,0,256,256);
 for(let i=-12;i<24;i++){const y0=i*22;const gr=g.createLinearGradient(0,y0,0,y0+20);gr.addColorStop(0,'#3a2416');gr.addColorStop(.5,'#6a4428');gr.addColorStop(1,'#3a2416');g.fillStyle=gr;g.save();g.translate(0,0);g.beginPath();g.moveTo(0,y0);g.lineTo(256,y0+70);g.lineTo(256,y0+88);g.lineTo(0,y0+18);g.closePath();g.fill();
  g.fillStyle='rgba(220,190,140,.5)';for(let x=6;x<256;x+=12){g.fillRect(x,y0+3+x*70/256,3,1.5)}g.restore()}
 itNoise(g,256,256,22,r);return ITX.lea={map:itTex(c,false,1,3),nm:itNormal(c,3.2,1,3)}}
function txEngrave(){if(ITX.eng)return ITX.eng;const c=itCanvas(256,256),g=c.getContext('2d'),r=itRng(23);g.fillStyle='#808080';g.fillRect(0,0,256,256);g.lineCap='round';
 const scroll=(x,y,s,dir)=>{g.beginPath();for(let a=0;a<12.5;a+=.12){const rr=s*(1-a/14);const px=x+Math.cos(a*dir)*rr,py=y+Math.sin(a*dir)*rr;if(a)g.lineTo(px,py);else g.moveTo(px,py)}g.stroke()};
 g.strokeStyle='#d0d0d0';g.lineWidth=3.2;g.shadowColor='#ffffff';g.shadowBlur=2;for(let i=0;i<16;i++)scroll(r()*256,r()*256,16+r()*16,r()<.5?1:-1);
 g.strokeStyle='#4a4a4a';g.lineWidth=2;g.shadowBlur=0;for(let i=0;i<22;i++){const x=r()*256,y=r()*256,a=r()*6.28;g.beginPath();g.ellipse(x,y,9,3.5,a,0,7);g.stroke()}
 for(let i=0;i<120;i++){g.fillStyle='rgba(255,255,255,'+(.15+r()*.2)+')';g.fillRect(r()*256,r()*256,1.5,1.5)}return ITX.eng={nm:itNormal(c,3.4,2,2)}}
function txBrushed(){if(ITX.br)return ITX.br;const c=itCanvas(256,128),g=c.getContext('2d'),r=itRng(5);g.fillStyle='#808080';g.fillRect(0,0,256,128);for(let i=0;i<500;i++){const y=r()*128,v=110+r()*40|0;g.fillStyle='rgba('+v+','+v+','+v+','+(.25+r()*.4)+')';g.fillRect(r()*256-60,y,40+r()*160,.8)}
 return ITX.br={nm:itNormal(c,1.4,2,2)}}
function txCork(){if(ITX.cork)return ITX.cork;const c=itCanvas(128,128),g=c.getContext('2d'),r=itRng(9);g.fillStyle='#b88a58';g.fillRect(0,0,128,128);for(let i=0;i<700;i++){const v=r();g.fillStyle=v<.5?'rgba(90,56,26,.6)':'rgba(230,200,150,.5)';g.beginPath();g.arc(r()*128,r()*128,.6+r()*1.8,0,7);g.fill()}return ITX.cork={map:itTex(c),nm:itNormal(c,2)}}
function txCoin(){if(ITX.coin)return ITX.coin;const N=256,c=itCanvas(N,N),g=c.getContext('2d');g.fillStyle='#6a6a6a';g.fillRect(0,0,N,N);const m=N/2;
 g.fillStyle='#e0e0e0';g.beginPath();g.arc(m,m,127,0,7);g.arc(m,m,113,0,7,true);g.fill();g.fillStyle='#5a5a5a';g.beginPath();g.arc(m,m,112,0,7);g.fill();
 g.fillStyle='#c8c8c8';for(let k=0;k<44;k++){const a=k/44*6.283;g.beginPath();g.arc(m+Math.cos(a)*104,m+Math.sin(a)*104,2.6,0,7);g.fill()}
 g.font='900 22px Georgia,serif';g.textAlign='center';g.textBaseline='middle';const txt='★ DA NAG DOUBLOON ★ BRIGADE ';for(let k=0;k<txt.length;k++){const a=-Math.PI/2+(k-txt.length/2)/txt.length*6.283;g.save();g.translate(m+Math.cos(a)*86,m+Math.sin(a)*86);g.rotate(a+Math.PI/2);g.fillStyle='#d8d8d8';g.fillText(txt[k],0,0);g.restore()}
 g.shadowColor='#ffffff';g.shadowBlur=3;g.fillStyle='#e8e8e8';g.beginPath();g.moveTo(m-34,m+18);g.lineTo(m-40,m-22);g.lineTo(m-20,m-4);g.lineTo(m,m-34);g.lineTo(m+20,m-4);g.lineTo(m+40,m-22);g.lineTo(m+34,m+18);g.closePath();g.fill();g.fillRect(m-36,m+22,72,12);
 g.shadowBlur=0;g.fillStyle='#6a6a6a';[[-40,-22],[0,-34],[40,-22]].forEach(([x,y])=>{g.beginPath();g.arc(m+x,m+y,5,0,7);g.fill()});g.fillStyle='#ffffff';[[-40,-22],[0,-34],[40,-22]].forEach(([x,y])=>{g.beginPath();g.arc(m+x,m+y,3.5,0,7);g.fill()});
 // the colour: gold, darker in the hollows
 const col=itCanvas(N,N),cg=col.getContext('2d'),src=g.getImageData(0,0,N,N).data,im=cg.createImageData(N,N),d=im.data;for(let i=0;i<N*N;i++){const h=src[i*4]/255,k=.62+.5*h;d[i*4]=Math.min(255,255*k);d[i*4+1]=Math.min(255,196*k);d[i*4+2]=Math.min(255,84*k);d[i*4+3]=255}cg.putImageData(im,0,0);
 return ITX.coin={map:itTex(col),nm:itNormal(c,4)}}
function txLava(){if(ITX.lava)return ITX.lava;const N=512,c=itCanvas(N,N),g=c.getContext('2d'),h=itCanvas(N,N),hg=h.getContext('2d'),r=itRng(31);g.fillStyle='#000';g.fillRect(0,0,N,N);hg.fillStyle='#909090';hg.fillRect(0,0,N,N);
 const crack=(x,y,a,len,w,depth)=>{const pts=[[x,y]];for(let i=0;i<len;i++){a+=(r()-.5)*.9;x+=Math.cos(a)*9;y+=Math.sin(a)*9;pts.push([x,y]);if(depth<3&&r()<.08)crack(x,y,a+(r()<.5?1:-1)*(.6+r()*.6),len*.5|0,w*.7,depth+1)}
  [[w*4,'rgba(255,60,0,.35)'],[w*2,'#ff5a10'],[w*.8,'#ffd890']].forEach(([lw,st])=>{g.strokeStyle=st;g.lineWidth=lw;g.lineJoin='round';g.beginPath();pts.forEach(([px,py],i)=>i?g.lineTo(px,py):g.moveTo(px,py));g.stroke()});
  hg.strokeStyle='#202020';hg.lineWidth=w*1.6;hg.beginPath();pts.forEach(([px,py],i)=>i?hg.lineTo(px,py):hg.moveTo(px,py));hg.stroke()};
 for(let i=0;i<9;i++)crack(r()*N,r()*N,r()*6.28,30+r()*30,2.4+r()*1.6,0);itNoise(hg,N,N,30,r);
 return ITX.lava={em:itTex(c,false,.42,.42),nm:itNormal(h,3,.42,.42)}}
function txVinyl(){if(ITX.vin)return ITX.vin;const N=512,c=itCanvas(N,N),g=c.getContext('2d'),h=itCanvas(N,N),hg=h.getContext('2d'),r=itRng(41),m=N/2;g.fillStyle='#0c0c0e';g.fillRect(0,0,N,N);hg.fillStyle='#808080';hg.fillRect(0,0,N,N);
 for(let rr=66;rr<252;rr+=1.6){const v=r();hg.strokeStyle=v<.5?'#9a9a9a':'#5a5a5a';hg.lineWidth=.9;hg.beginPath();hg.arc(m,m,rr,0,7);hg.stroke();g.strokeStyle='rgba(60,60,70,'+(r()*.35)+')';g.lineWidth=.8;g.beginPath();g.arc(m,m,rr,0,7);g.stroke()}
 [120,170,212].forEach(rr=>{hg.strokeStyle='#808080';hg.lineWidth=4;hg.beginPath();hg.arc(m,m,rr,0,7);hg.stroke()});
 const gr=g.createRadialGradient(m,m,0,m,m,62);gr.addColorStop(0,'#e83030');gr.addColorStop(1,'#9a1010');g.fillStyle=gr;g.beginPath();g.arc(m,m,62,0,7);g.fill();g.fillStyle='#ffd27a';g.font='900 15px Georgia,serif';g.textAlign='center';g.fillText('NAG RECORDS',m,m-26);g.font='700 12px system-ui';g.fillText('Lil Nag Brigade',m,m+30);g.fillStyle='#111';g.beginPath();g.arc(m,m,6,0,7);g.fill();
 hg.fillStyle='#808080';hg.beginPath();hg.arc(m,m,64,0,7);hg.fill();
 g.strokeStyle='rgba(220,220,230,.55)';g.lineWidth=1.6;g.beginPath();g.arc(m+40,m-30,190,2.2,2.9);g.stroke();hg.strokeStyle='#202020';hg.lineWidth=2.4;hg.beginPath();hg.arc(m+40,m-30,190,2.2,2.9);hg.stroke();
 return ITX.vin={map:itTex(c),nm:itNormal(h,2.2)}}
function txFeather(){if(ITX.fea)return ITX.fea;const W=256,H=512,c=itCanvas(W,H),g=c.getContext('2d'),r=itRng(51);g.clearRect(0,0,W,H);const mx=W/2;
 const half=t=>Math.pow(Math.sin(Math.PI*Math.min(1,t*1.05)),.65)*112*(t<.12?t/.12*.6+.4:1);   // t: 0 the tip (top) .. 1 the base
 const col=t=>{const S=[[0,[255,236,140]],[.25,[255,170,40]],[.55,[240,70,20]],[.85,[150,14,10]],[1,[70,6,6]]];for(let i=1;i<S.length;i++)if(t<=S[i][0]){const k=(t-S[i-1][0])/(S[i][0]-S[i-1][0]);return S[i-1][1].map((v,j)=>v+(S[i][1][j]-v)*k|0)}return S[S.length-1][1]};
 for(let y=8;y<H-40;y+=1.15){const t=y/H,w=half(t)*(r()<.04?.75:1);const cc=col(t);[-1,1].forEach(s=>{if(r()<.025)return;g.strokeStyle='rgba('+cc+','+(.75+r()*.25)+')';g.lineWidth=1.2;g.beginPath();g.moveTo(mx,y);g.quadraticCurveTo(mx+s*w*.55,y-w*.18,mx+s*w,y-w*.42);g.stroke()})}
 g.strokeStyle='rgba(255,250,220,.95)';g.lineWidth=5;g.beginPath();g.moveTo(mx,0);g.lineTo(mx,H);g.stroke();
 return ITX.fea={map:itTex(c)}}
function txMelon(){if(ITX.mel)return ITX.mel;const c=itCanvas(256,256),g=c.getContext('2d'),r=itRng(61);g.fillStyle='#3a9a40';g.fillRect(0,0,256,256);for(let k=0;k<9;k++){const x0=k*256/9;g.fillStyle='#164e1c';g.beginPath();g.moveTo(x0,0);for(let y=0;y<=256;y+=8)g.lineTo(x0+8+Math.sin(y*.15+k)*4+r()*3,y);for(let y=256;y>=0;y-=8)g.lineTo(x0+17+Math.sin(y*.12+k*2)*4+r()*3,y);g.fill()}
 itNoise(g,256,256,18,r);return ITX.mel={map:itTex(c)}}
function txLabel(kind){const k='lab'+kind;if(ITX[k])return ITX[k];const c=itCanvas(256,128),g=c.getContext('2d'),r=itRng(kind.length*13);g.fillStyle='#ead8a8';g.fillRect(0,0,256,128);for(let i=0;i<30;i++){g.fillStyle='rgba(150,110,60,'+(r()*.12)+')';g.beginPath();g.arc(r()*256,r()*128,4+r()*20,0,7);g.fill()}
 g.strokeStyle='#7a5228';g.lineWidth=3;g.strokeRect(6,6,244,116);g.textAlign='center';g.textBaseline='middle';
 if(kind==='hp'){g.fillStyle='#c01020';g.font='900 64px serif';g.fillText('♥',128,58);g.font='800 18px Georgia,serif';g.fillStyle='#4a2a10';g.fillText('HEALTH',128,106)}
 else if(kind==='hp2'){g.fillStyle='#e03010';g.font='900 56px serif';g.fillText('♥',128,54);g.fillStyle='#4a2a10';g.font='900 20px Georgia,serif';g.fillText('BIG · FULL',128,104)}
 else if(kind==='mp'){g.fillStyle='#1a60d0';g.font='900 56px serif';g.fillText('✦',128,56);g.fillStyle='#1a2a50';g.font='800 18px Georgia,serif';g.fillText('MANA',128,104)}
 else if(kind==='bat'){const gr=g.createLinearGradient(0,0,256,0);gr.addColorStop(0,'#d02020');gr.addColorStop(.5,'#f0c020');gr.addColorStop(1,'#2050d0');g.fillStyle=gr;g.fillRect(0,0,256,128);g.fillStyle='#111';g.fillRect(0,40,256,48);g.fillStyle='#ffe040';g.font='900 26px system-ui';g.fillText('PROP·CELL ⚡',128,65)}
 return ITX[k]={map:itTex(c)}}
function txRecipe(){if(ITX.rec)return ITX.rec;const c=itCanvas(512,256),g=c.getContext('2d'),r=itRng(71);g.fillStyle='#ecdcae';g.fillRect(0,0,512,256);for(let i=0;i<40;i++){g.fillStyle='rgba(140,100,50,'+(r()*.1)+')';g.beginPath();g.arc(r()*512,r()*256,6+r()*30,0,7);g.fill()}
 g.fillStyle='#5a2a10';g.font='900 30px Georgia,serif';g.textAlign='left';g.fillText('Secret Recipe',24,44);g.strokeStyle='#3a2a1a';g.lineWidth=1.6;for(let l=0;l<6;l++){const y=78+l*28;g.beginPath();g.moveTo(26,y);for(let x=26;x<330;x+=6)g.lineTo(x,y+Math.sin(x*.3+l)*2.5+(r()-.5)*1.4);g.stroke()}
 g.strokeStyle='#5a3010';g.lineWidth=3;g.beginPath();g.ellipse(420,140,58,34,0,0,7);g.stroke();g.beginPath();g.moveTo(380,128);g.lineTo(458,128);g.moveTo(388,150);g.lineTo(452,150);g.stroke();g.fillStyle='rgba(120,60,20,.2)';g.beginPath();g.arc(140,210,26,0,7);g.fill();
 return ITX.rec={map:itTex(c)}}
// ---- the light the items shine in: a warm studio of soft boxes (made once; every item material reflects it, so gold reads as gold and not
// as whatever sky is overhead, and the game and the codex page look the same)
function itEnv(){if(ITX.env!==undefined)return ITX.env;ITX.env=null;try{const RR=(typeof R!=='undefined'&&R&&R.isWebGLRenderer)?R:null;if(!RR)return null;const es=new THREE.Scene();
 const sg=new THREE.SphereGeometry(20,48,24),P=sg.attributes.position,C=new Float32Array(P.count*3),top=new THREE.Color(1,.86,.66).multiplyScalar(.62),mid=new THREE.Color(.26,.19,.13),bot=new THREE.Color(.04,.03,.025),c=new THREE.Color();
 for(let i=0;i<P.count;i++){const h=P.getY(i)/40+.5;if(h>.5)c.copy(mid).lerp(top,Math.pow((h-.5)*2,1.6));else c.copy(bot).lerp(mid,h*2);C[i*3]=c.r;C[i*3+1]=c.g;C[i*3+2]=c.b}sg.setAttribute('color',new THREE.BufferAttribute(C,3));
 es.add(new THREE.Mesh(sg,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide})));
 const box=(x,y,z,w,h,col,k)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(col).multiplyScalar(k),side:THREE.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);es.add(m)};
 box(8,10,6,10,5,0xfff0d8,2.3);box(-10,4,-6,6,10,0x9ad0ff,1.2);box(-6,8,10,8,4,0xffffff,1);box(10,-2,-8,4,8,0xffc070,.7);
 const pm=new THREE.PMREMGenerator(RR);ITX.env=pm.fromScene(es,.02).texture;pm.dispose()}catch(e){console.warn('item light',e)}return ITX.env}
// ---- the materials
function itMat(k){if(ITM[k])return ITM[k];const S=(o)=>new THREE.MeshStandardMaterial(o),P=(o)=>new THREE.MeshPhysicalMaterial(o);let m;
 const gem=(c,e)=>P({color:c,metalness:0,roughness:0,transmission:.22,transparent:true,clearcoat:1,clearcoatRoughness:0,envMapIntensity:2.4,flatShading:true,emissive:e||0x000000,emissiveIntensity:1});
 switch(k){
  case 'gold':m=S({color:0xf0b638,metalness:1,roughness:.26,normalMap:txEngrave().nm,normalScale:new THREE.Vector2(.35,.35),envMapIntensity:1.3});break;
  case 'goldE':m=S({color:0xf2b236,metalness:1,roughness:.24,normalMap:txEngrave().nm,normalScale:new THREE.Vector2(.9,.9),envMapIntensity:1.35});break;
  case 'goldP':m=S({color:0xf5b938,metalness:1,roughness:.12,envMapIntensity:1.4,emissive:0x2a1800,emissiveIntensity:.4});break;
  case 'wgold':m=S({color:0xf4f0e8,metalness:1,roughness:.12,envMapIntensity:1.5});break;
  case 'steel':m=S({color:0xc4cad2,metalness:1,roughness:.28,normalMap:txBrushed().nm,normalScale:new THREE.Vector2(.3,.3),envMapIntensity:1.2});break;
  case 'chrome':m=S({color:0xffffff,metalness:1,roughness:.06,envMapIntensity:1.6});break;
  case 'gun':m=S({color:0x1e2024,metalness:.75,roughness:.45,normalMap:txBrushed().nm,normalScale:new THREE.Vector2(.35,.35),envMapIntensity:.45});break;
  case 'iron':m=S({color:0x4a4644,metalness:.9,roughness:.5,normalMap:txBrushed().nm,normalScale:new THREE.Vector2(.6,.6)});break;
  case 'dsteel':{const L=txLava();m=S({color:0x221c1a,metalness:.85,roughness:.42,normalMap:L.nm,normalScale:new THREE.Vector2(.9,.9),emissiveMap:L.em,emissive:0xffffff,emissiveIntensity:2.4,envMapIntensity:.8});break}
  case 'wood':case 'ebony':case 'mahog':{const T=txWood(k==='wood'?'oak':k);m=S({map:T.map,normalMap:T.nm,normalScale:new THREE.Vector2(.6,.6),roughness:k==='ebony'?.4:.6,metalness:0,envMapIntensity:.7});break}
  case 'leather':{const T=txLeather();m=S({map:T.map,normalMap:T.nm,normalScale:new THREE.Vector2(1,1),roughness:.68,metalness:0});break}
  case 'black':m=P({color:0x0a0a0c,metalness:0,roughness:.45,clearcoat:.35,clearcoatRoughness:.2,envMapIntensity:.3});break;
  case 'rubber':m=S({color:0x1a1a1a,roughness:.8,metalness:0});break;
  case 'glass':m=P({color:0xf2f8ff,metalness:0,roughness:.02,transmission:.98,transparent:true,clearcoat:.6,clearcoatRoughness:.02,envMapIntensity:1.1,depthWrite:false});break;
  case 'glassT':m=P({color:0x2a2a30,metalness:0,roughness:.05,transmission:.7,transparent:true,clearcoat:1,envMapIntensity:1.6,depthWrite:false});break;
  case 'liqR':m=S({color:0x8a0008,emissive:0x900008,emissiveIntensity:.45,roughness:.15,metalness:0,transparent:true,opacity:.97,envMapIntensity:.5});break;
  case 'liqF':m=S({color:0xb02000,emissive:0xd02800,emissiveIntensity:.5,roughness:.15,metalness:0,transparent:true,opacity:.97,envMapIntensity:.5});break;
  case 'liqB':m=S({color:0x0828a0,emissive:0x0a3ad0,emissiveIntensity:.45,roughness:.15,metalness:0,transparent:true,opacity:.97,envMapIntensity:.5});break;
  case 'cork':{const T=txCork();m=S({map:T.map,normalMap:T.nm,roughness:.85});break}
  case 'wax':m=P({color:0x6a060c,roughness:.42,metalness:0,clearcoat:.3,envMapIntensity:.6});break;
  case 'parch':m=S({color:0xecdcae,roughness:.85,metalness:0,side:THREE.DoubleSide});break;
  case 'ivory':m=S({color:0xf6ecd6,roughness:.35,metalness:0});break;
  case 'coin':{const T=txCoin();m=S({map:T.map,normalMap:T.nm,normalScale:new THREE.Vector2(1.1,1.1),metalness:1,roughness:.24,envMapIntensity:1.35});break}
  case 'vinyl':{const T=txVinyl();m=P({map:T.map,normalMap:T.nm,normalScale:new THREE.Vector2(.7,.7),roughness:.3,metalness:.2,clearcoat:.9,clearcoatRoughness:.15});break}
  case 'olive':m=S({color:0x3e4a22,envMapIntensity:.5,roughness:.6,metalness:.3,normalMap:txBrushed().nm,normalScale:new THREE.Vector2(.5,.5)});break;
  case 'melon':m=P({map:txMelon().map,roughness:.3,metalness:0,clearcoat:.6,clearcoatRoughness:.2});break;
  case 'ruby':m=gem(0xd0001a,0x4a0006);break;case 'sapph':m=gem(0x1038e0,0x020a40);break;case 'emer':m=gem(0x00b048,0x003010);break;case 'amet':m=gem(0x9a20f0,0x2a0050);break;
  case 'dia':m=P({color:0xf4fdff,metalness:0,roughness:0,transmission:.5,transparent:true,clearcoat:1,clearcoatRoughness:0,envMapIntensity:3,flatShading:true,emissive:0x0a1a24,emissiveIntensity:1});break;case 'pink':m=gem(0xf03a9a,0x3a0020);break;
  case 'diablade':m=P({color:0x7ee2ff,metalness:0,roughness:0,transmission:.45,transparent:true,clearcoat:1,clearcoatRoughness:0,envMapIntensity:2.6,flatShading:true,emissive:0x0a5a78,emissiveIntensity:.9});break;
  case 'orbcore':m=S({color:0x8a30e0,emissive:0x8a20ff,emissiveIntensity:1.5,roughness:.2});break;
  case 'orbglass':m=P({color:0xa060f0,metalness:0,roughness:0,transmission:.8,transparent:true,clearcoat:1,envMapIntensity:1.8,depthWrite:false});break;
  case 'edge':m=S({color:0xffe0b0,emissive:0xff6a18,emissiveIntensity:3.2,roughness:.3,metalness:.2});break;
  case 'rune':m=S({color:0x60f0ff,emissive:0x20d0ff,emissiveIntensity:2.2,roughness:.2});break;
  case 'cone':m=S({color:0x202024,roughness:.75,metalness:0,side:THREE.DoubleSide});break;
  case 'red':m=P({color:0xd02020,roughness:.25,metalness:.1,clearcoat:.8});break;case 'blue':m=P({color:0x2060e0,roughness:.25,metalness:.1,clearcoat:.8});break;
  default:m=S({color:0xff00ff})}
 if(m&&!m.envMap){const E=itEnv();if(E)m.envMap=E}return ITM[k]=m}
// ---- the shapes
const IV2=(x,y)=>new THREE.Vector2(x,y);
function itLathe(pts,seg){return new THREE.LatheGeometry(pts.map(p=>IV2(p[0],p[1])),seg||32)}
// a box with every edge rounded (w wide, h tall, d deep, corners r)
function itRBox(w,h,d,r,seg){const b=Math.max(.004,Math.min(r,d/2)*.9),bs=b*.95,W=Math.max(.01,w-2*bs),H=Math.max(.01,h-2*bs),rr=Math.max(.004,Math.min(r-bs,W/2-.002,H/2-.002)),s=new THREE.Shape();
 s.moveTo(-W/2+rr,-H/2);s.lineTo(W/2-rr,-H/2);s.quadraticCurveTo(W/2,-H/2,W/2,-H/2+rr);s.lineTo(W/2,H/2-rr);s.quadraticCurveTo(W/2,H/2,W/2-rr,H/2);s.lineTo(-W/2+rr,H/2);s.quadraticCurveTo(-W/2,H/2,-W/2,H/2-rr);s.lineTo(-W/2,-H/2+rr);s.quadraticCurveTo(-W/2,-H/2,-W/2+rr,-H/2);
 const D=Math.max(.002,d-2*b),g=new THREE.ExtrudeGeometry(s,{depth:D,bevelEnabled:true,bevelThickness:b,bevelSize:bs,bevelSegments:seg||3,curveSegments:5});g.translate(0,0,-D/2);return g}
function itExtrude(shape,d,bev,seg,cs){const b=bev||0,g=new THREE.ExtrudeGeometry(shape,{depth:Math.max(.002,d-2*b),bevelEnabled:b>0,bevelThickness:b,bevelSize:b*.9,bevelSegments:seg||2,curveSegments:cs||12});g.translate(0,0,-Math.max(.002,d-2*b)/2);return g}
function itTube(pts,r,seg,rs){return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(p[0],p[1],p[2]||0))),seg||32,r,rs||8,false)}
// put a mesh in a group: position, rotation, scale
function itAdd(G,geo,mat,p,r,s){const m=new THREE.Mesh(geo,typeof mat==='string'?itMat(mat):mat);if(p)m.position.set(p[0],p[1],p[2]||0);if(r)m.rotation.set(r[0],r[1],r[2]||0,r[3]||'XYZ');if(s)(typeof s==='number'?m.scale.setScalar(s):m.scale.set(s[0],s[1],s[2]));G.add(m);return m}
// the still parts of a model drawn together (one draw per material): a model costs a few draws, not dozens
function itMerge(G){const by=new Map();G.children.slice().forEach(c=>{if(!c.isMesh||c.isInstancedMesh||c.userData.keep||c.children.length||Array.isArray(c.material))return;if(!by.has(c.material))by.set(c.material,[]);by.get(c.material).push(c)});
 by.forEach((list,mat)=>{if(list.length<2)return;let tot=0;const parts=list.map(c=>{c.updateMatrix();const g=(c.geometry.index?c.geometry.toNonIndexed():c.geometry.clone());g.applyMatrix4(c.matrix);if(!g.attributes.normal)g.computeVertexNormals();tot+=g.attributes.position.count;return g});
  const P=new Float32Array(tot*3),N=new Float32Array(tot*3),U=new Float32Array(tot*2);let o=0;parts.forEach(g=>{const n=g.attributes.position.count;P.set(g.attributes.position.array,o*3);N.set(g.attributes.normal.array,o*3);if(g.attributes.uv)U.set(g.attributes.uv.array.subarray(0,n*2),o*2);o+=n;g.dispose()});
  list.forEach(c=>G.remove(c));const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(P,3));geo.setAttribute('normal',new THREE.BufferAttribute(N,3));geo.setAttribute('uv',new THREE.BufferAttribute(U,2));G.add(new THREE.Mesh(geo,mat))});return G}
// a soft round glow (behind a gem, inside an orb, round a rare drop)
function itGlowTex(){if(ITX.glow)return ITX.glow;const c=itCanvas(128,128),g=c.getContext('2d'),gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.25,'rgba(255,255,255,.55)');gr.addColorStop(.6,'rgba(255,255,255,.12)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);return ITX.glow=itTex(c)}
function itStarTex(){if(ITX.star)return ITX.star;const c=itCanvas(64,64),g=c.getContext('2d');const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.2,'rgba(255,255,255,.5)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);
 g.strokeStyle='rgba(255,255,255,.9)';g.lineWidth=2;g.beginPath();g.moveTo(32,2);g.lineTo(32,62);g.moveTo(2,32);g.lineTo(62,32);g.stroke();return ITX.star=itTex(c)}
function itGlow(G,col,s,p,op){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:itGlowTex(),color:col,transparent:true,opacity:op==null?.6:op,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));sp.scale.set(s,s,1);if(p)sp.position.set(p[0],p[1],p[2]||0);sp.userData.keep=1;G.add(sp);return sp}
// a brilliant-cut gem (table on top, pointed underneath), r across
function itGemGeo(r,seg){return itLathe([[0,-r*.95],[r,-.05*r],[r*.98,.08*r],[r*.62,r*.42],[0,r*.42]],seg||10)}
// ---- the potions: a glass flask, the potion inside (it glows), bubbles rising through it, a cork or a stopper, a label
function itProfR(P,y){for(let i=1;i<P.length;i++){if(P[i][1]>=y){const a=P[i-1],b=P[i],k=(y-a[1])/Math.max(1e-6,b[1]-a[1]);return a[0]+(b[0]-a[0])*k}}return P[P.length-1][0]}
const POTP={hp:[[0,0],[.28,0],[.44,.07],[.53,.26],[.52,.48],[.42,.66],[.2,.8],[.145,.86],[.14,1.06],[.18,1.1],[.16,1.13],[0,1.13]],
 hp2:[[0,0],[.3,0],[.5,.07],[.63,.28],[.65,.5],[.6,.72],[.44,.9],[.2,1.02],[.16,1.08],[.155,1.3],[.2,1.35],[.18,1.38],[0,1.38]],
 mp:[[0,0],[.25,0],[.29,.03],[.31,.1],[.31,.72],[.26,.86],[.13,.97],[.115,1.24],[.15,1.28],[.14,1.31],[0,1.31]]};
const POTF={hp:.6,hp2:.76,mp:.8};
function itSmooth(P,k){const o=[P[0]];for(let i=0;i<P.length-1;i++){const a=P[Math.max(0,i-1)],b=P[i],c=P[i+1],d=P[Math.min(P.length-1,i+2)];if(b[0]===0||c[0]===0||i===0){o.push(c);continue}
 for(let j=1;j<=k;j++){const t=j/k,t2=t*t,t3=t2*t;o.push([0,1].map(q=>.5*((2*b[q])+(-a[q]+c[q])*t+(2*a[q]-5*b[q]+4*c[q]-d[q])*t2+(-a[q]+3*b[q]-3*c[q]+d[q])*t3)))}}return o}
Object.keys(POTP).forEach(k=>{POTP[k]=itSmooth(POTP[k],4)});
function potionModel(kind){const G=new THREE.Group(),P=POTP[kind],fill=POTF[kind],top=P[P.length-1][1];
 const L=[[0,.035],[itProfR(P,.035)*.88,.035]];P.forEach(p=>{if(p[1]>.04&&p[1]<fill)L.push([p[0]*.9,p[1]])});L.push([itProfR(P,fill)*.9,fill],[0,fill]);
 const liq=itAdd(G,itLathe(L,36),kind==='hp'?'liqR':kind==='hp2'?'liqF':'liqB');liq.renderOrder=1;liq.userData.keep=1;liq.name='liq';
 const gl=itAdd(G,itLathe(P,48),'glass');gl.renderOrder=3;gl.userData.keep=1;
 const bub=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),new THREE.MeshBasicMaterial({color:kind==='mp'?0xd8f0ff:0xffe4c8,transparent:true,opacity:.8,toneMapped:false}),7);bub.name='bub';bub.renderOrder=2;bub.userData.keep=1;bub.userData.fill=fill;bub.userData.k=kind;G.add(bub);
 {const M=new THREE.Matrix4();for(let i=0;i<7;i++){M.makeScale(.02,.02,.02);M.setPosition(0,-9,0);bub.setMatrixAt(i,M)}}
 const ny=itProfR(P,top-.1);
 if(kind==='mp'){itAdd(G,itLathe([[0,0],[.15,0],[.16,.05],[.15,.12],[0,.12]],24),'chrome',[0,top-.06,0]);const cr=itAdd(G,new THREE.OctahedronGeometry(.13,0),'sapph',[0,top+.2,0],null,[1,1.7,1]);cr.userData.keep=1;cr.name='cr';itGlow(G,0x4aa0ff,.7,[0,top+.2,0],.5)}
 else if(kind==='hp2'){itAdd(G,itLathe([[0,0],[.2,0],[.22,.05],[.2,.12],[.12,.16],[0,.17]],28),'goldP',[0,top-.05,0]);
  const H=new THREE.Group();H.position.set(0,top+.28,0);itAdd(H,new THREE.SphereGeometry(.095,14,10),'ruby',[-.07,.04,0]);itAdd(H,new THREE.SphereGeometry(.095,14,10),'ruby',[.07,.04,0]);itAdd(H,new THREE.ConeGeometry(.135,.2,16),'ruby',[0,-.08,0],[Math.PI,0,0]);H.name='heart';G.add(H);
  // the gold cage round the flask
  for(let k=0;k<4;k++){const a=k/4*Math.PI*2+Math.PI/4,pts=[];for(let y=.05;y<=.98;y+=.08)pts.push([Math.sin(a)*(itProfR(P,y)+.022),y,Math.cos(a)*(itProfR(P,y)+.022)]);itAdd(G,itTube(pts,.022,28,6),'goldP')}
  itAdd(G,new THREE.TorusGeometry(.672,.03,8,64),'goldP',[0,.5,0],[Math.PI/2,0,0]);itAdd(G,new THREE.TorusGeometry(.32,.03,8,40),'goldP',[0,.04,0],[Math.PI/2,0,0])}
 else{itAdd(G,itLathe([[0,0],[.135,0],[.155,.2],[.145,.25],[0,.26]],20),'cork',[0,top-.1,0]);itAdd(G,new THREE.TorusGeometry(ny+.012,.026,8,32),'wax',[0,top-.16,0],[Math.PI/2,0,0])}
 // the label, round the front of the flask
 {const y0=kind==='mp'?.32:kind==='hp2'?.38:.28,h=kind==='mp'?.3:.22,r=itProfR(P,y0)+.006,len=kind==='mp'?2.1:1.25;const lb=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,24,1,true,-len/2,len),new THREE.MeshStandardMaterial({map:txLabel(kind).map,roughness:.8,metalness:0}));lb.position.y=y0;lb.renderOrder=4;lb.userData.keep=1;G.add(lb)}
 itGlow(G,kind==='mp'?0x3a8aff:kind==='hp2'?0xff6a20:0xff2040,1.5,[0,fill*.5,0],.32).name='glow';
 return itMerge(G)}
// ---- the phoenix feather: a curling vane of red to gold barbs on a pale quill; it sheds embers and sways
function featherModel(){const G=new THREE.Group();const T=txFeather();const geo=new THREE.PlaneGeometry(1.05,2.3,10,44),p=geo.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i)+1.15,t=y/2.3;p.setXYZ(i,x+Math.sin(t*3.1)*.06,y,Math.sin(t*Math.PI*.95)*.28-x*x*.42)}geo.computeVertexNormals();
 const m=new THREE.MeshStandardMaterial({map:T.map,alphaTest:.32,side:THREE.DoubleSide,emissiveMap:T.map,emissive:0xffffff,emissiveIntensity:.5,roughness:.5,metalness:0});const v=itAdd(G,geo,m);v.name='vane';v.userData.keep=1;
 itAdd(G,itTube([[0,.12,.04],[.005,-.15,.05],[.02,-.42,.09]],.026,14,8),'ivory');itGlow(G,0xff7a20,1.8,[0,1.1,.1],.28);
 return G}
// ---- keys: the Brigade Key (gold, an ornate bow, a chain) and a floor's Gate Key (black iron, a glowing rune)
function keyModel(kind){const G=new THREE.Group(),gate=kind==='gkey',M1=gate?'iron':'goldE',M2=gate?'iron':'gold';
 itAdd(G,new THREE.TorusGeometry(gate?.28:.3,gate?.075:.055,14,48),M1,[0,1.05,0]);
 if(gate){const r=itAdd(G,new THREE.SphereGeometry(.12,20,14),'rune',[0,1.05,0]);r.userData.keep=1;r.name='rune';itGlow(G,0x30d0ff,1.1,[0,1.05,.05],.55);itAdd(G,new THREE.TorusGeometry(.17,.025,8,32),'gold',[0,1.05,0])}
 else{for(let k=0;k<4;k++){const a=k/4*Math.PI*2+Math.PI/4;itAdd(G,new THREE.TorusGeometry(.1,.022,8,24),'goldP',[Math.sin(a)*.12,1.05+Math.cos(a)*.12,0])}itAdd(G,itGemGeo(.07,8),'ruby',[0,1.05,.02],[Math.PI/2,0,0])}
 itAdd(G,itLathe([[0,.66],[.09,.66],[.105,.7],[.075,.72],[.095,.75],[.085,.78],[0,.78]],24),M1);
 itAdd(G,itLathe([[0,-.62],[.06,-.62],[.065,-.58],[.052,-.5],[.05,.66],[0,.66]],20),M2);
 const s=new THREE.Shape();if(gate){s.moveTo(0,-.62);s.lineTo(.42,-.62);s.lineTo(.42,-.5);s.lineTo(.3,-.5);s.lineTo(.3,-.42);s.lineTo(.42,-.42);s.lineTo(.42,-.26);s.lineTo(.2,-.26);s.lineTo(.2,-.18);s.lineTo(0,-.18)}
 else{s.moveTo(0,-.6);s.lineTo(.36,-.6);s.lineTo(.36,-.52);s.lineTo(.26,-.52);s.lineTo(.26,-.45);s.lineTo(.36,-.45);s.lineTo(.36,-.36);s.lineTo(.22,-.36);s.lineTo(.22,-.3);s.lineTo(.3,-.3);s.lineTo(.3,-.22);s.lineTo(0,-.22)}
 itAdd(G,itExtrude(s,gate?.11:.08,.015,2),M1);
 if(!gate)for(let k=0;k<6;k++){const l=itAdd(G,new THREE.TorusGeometry(.075,.018,8,20),'gold',[Math.sin(k*.5)*.12,1.4+k*.13,0],[0,k%2?Math.PI/2:0,0])}
 return itMerge(G)}
// ---- the doubloon: raised rim, beaded border, the crown, the words round the edge
function coinGeo(){if(ITX.coinG)return ITX.coinG;const g=itLathe([[0,.07],[.46,.07],[.5,.088],[.55,.078],[.565,0],[.55,-.078],[.5,-.088],[.46,-.07],[0,-.07]],48);const p=g.attributes.position,u=g.attributes.uv;
 for(let i=0;i<p.count;i++)u.setXY(i,.5+p.getX(i)/1.13,.5-p.getZ(i)/1.13*(p.getY(i)>=0?1:-1));return ITX.coinG=g}
function coinModel(){const G=new THREE.Group();itAdd(G,coinGeo(),'coin',[0,0,0],[Math.PI/2,0,0]);return G}
// ---- the quest's lost things
function ringModel(){const G=new THREE.Group();itAdd(G,new THREE.TorusGeometry(.34,.075,20,72),'goldP');itAdd(G,itLathe([[0,-.04],[.11,-.04],[.15,.05],[.135,.08],[0,.08]],24),'wgold',[0,.4,0]);
 const gm=itAdd(G,itGemGeo(.15,12),'pink',[0,.55,0]);gm.userData.keep=1;for(let k=0;k<4;k++){const a=k/4*Math.PI*2+Math.PI/4;itAdd(G,new THREE.CylinderGeometry(.018,.022,.16,6),'wgold',[Math.sin(a)*.13,.5,Math.cos(a)*.13],[Math.cos(a)*.35,0,-Math.sin(a)*.35])}
 itGlow(G,0xff90d0,.9,[0,.55,0],.45);return itMerge(G)}
function batteryModel(){const G=new THREE.Group();const lb=new THREE.MeshStandardMaterial({map:txLabel('bat').map,roughness:.35,metalness:.3});itAdd(G,new THREE.CylinderGeometry(.3,.3,.82,40,1,true),lb);
 itAdd(G,itLathe([[0,-.47],[.27,-.47],[.3,-.44],[.305,-.41],[0,-.41]],36),'steel');itAdd(G,itLathe([[0,.41],[.305,.41],[.3,.44],[.27,.47],[.1,.47],[.1,.55],[.08,.57],[0,.57]],36),'steel');
 const pr=new THREE.Group();pr.position.y=.62;pr.name='prop';itAdd(pr,new THREE.CylinderGeometry(.05,.05,.1,12),'chrome');[0,Math.PI].forEach((a,i)=>{const b=itAdd(pr,itRBox(.42,.035,.12,.015,1),i?'blue':'red',[Math.cos(a)*.24,.02,-Math.sin(a)*.24],[.35*(i?-1:1),a,0])});G.add(pr);pr.userData.keep=1;
 itGlow(G,0x60c8ff,.9,[0,.66,0],.0).name='zap';return itMerge(G)}
function jewelModel(){const G=new THREE.Group();const gm=itAdd(G,itGemGeo(.42,12),'ruby',[0,0,0],[Math.PI/2,0,0]);gm.userData.keep=1;
 for(let k=0;k<4;k++){const a=k/4*Math.PI*2+Math.PI/4;itAdd(G,itTube([[Math.sin(a)*.3,Math.cos(a)*.3,-.18],[Math.sin(a)*.44,Math.cos(a)*.44,-.02],[Math.sin(a)*.4,Math.cos(a)*.4,.1]],.03,10,6),'goldP')}
 itAdd(G,new THREE.TorusGeometry(.42,.035,10,48),'goldP',[0,0,-.06]);itAdd(G,new THREE.TorusGeometry(.1,.025,8,24),'goldP',[0,.52,-.06]);itGlow(G,0xff2040,1.6,[0,0,.1],.4);return itMerge(G)}
function recipeModel(){const G=new THREE.Group();const geo=new THREE.PlaneGeometry(1,.56,16,4),p=geo.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i);p.setZ(i,Math.sin(x*2.6)*.04)}geo.computeVertexNormals();
 itAdd(G,geo,new THREE.MeshStandardMaterial({map:txRecipe().map,roughness:.85,side:THREE.DoubleSide}));
 [-.52,.52].forEach(x=>{itAdd(G,new THREE.CylinderGeometry(.07,.07,.62,20),'parch',[x,0,0]);itAdd(G,new THREE.CylinderGeometry(.03,.03,.7,10),'mahog',[x,0,0])});
 itAdd(G,new THREE.CylinderGeometry(.1,.1,.03,24),'wax',[.28,-.18,.06],[Math.PI/2,0,0]);itAdd(G,itRBox(.06,.3,.01,.005,1),'wax',[.24,-.34,.05],[0,0,.3]);itAdd(G,itRBox(.06,.28,.01,.005,1),'wax',[.33,-.33,.05],[0,0,-.25]);return itMerge(G)}
function recordGeo(){if(ITX.recG)return ITX.recG;const g=new THREE.CylinderGeometry(.62,.62,.03,72,1),p=g.attributes.position,u=g.attributes.uv;for(let i=0;i<p.count;i++)u.setXY(i,.5+p.getX(i)/1.26,.5-p.getZ(i)/1.26);return ITX.recG=g}
function recordModel(){const G=new THREE.Group();itAdd(G,recordGeo(),'vinyl',[0,0,0],[Math.PI/2,0,0]);return G}
// ---- the weapons (built upright, the handle down the middle: the same model swings, lies on the floor and sits in the bag)
function bezPt(a,b,c,d,t){const u=1-t;return [u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]]}
// the Golden Axe and the Diamond Dabloon Axe: a waisted haft with a leather grip, a gold socket, a bearded crescent blade with its edge
// picked out, a spike behind and a stone set in the blade
function axeModel2(kind){const G=new THREE.Group(),dia=kind==='daxe',WM=dia?'ebony':'wood',BM=dia?'diablade':'goldE',MM=dia?'wgold':'gold';
 itAdd(G,itLathe([[0,-1.98],[.1,-1.98],[.135,-1.94],[.15,-1.86],[.135,-1.78],[.12,-1.7],[.115,-.6],[.11,.4],[.115,1.2],[.125,1.62],[.11,1.76],[0,1.78]],28),WM);
 itAdd(G,itLathe([[.126,-1.66],[.134,-1.6],[.134,-.62],[.126,-.56]],28),'leather');
 itAdd(G,itLathe([[0,-2.22],[.08,-2.22],[.15,-2.13],[.17,-2.04],[.14,-1.98],[0,-1.98]],28),MM);itAdd(G,new THREE.TorusGeometry(.135,.026,8,28),MM,[0,-1.68,0],[Math.PI/2,0,0]);itAdd(G,new THREE.TorusGeometry(.135,.026,8,28),MM,[0,-.56,0],[Math.PI/2,0,0]);
 itAdd(G,itLathe([[0,1.04],[.16,1.04],[.2,1.09],[.185,1.18],[.175,1.6],[.2,1.68],[.165,1.76],[0,1.79]],28),MM);
 const P0=[1.02,2.2],P1=[1.44,1.88],P2=[1.62,1.26],P3=[1.42,.6];const s=new THREE.Shape();s.moveTo(.1,1.66);s.bezierCurveTo(.45,1.72,.8,1.94,P0[0],P0[1]);s.bezierCurveTo(P1[0],P1[1],P2[0],P2[1],P3[0],P3[1]);
 s.bezierCurveTo(1.12,.72,.82,.88,.62,.97);s.bezierCurveTo(.4,1.05,.22,1.1,.1,1.15);s.lineTo(.1,1.66);
 const bl=itAdd(G,itExtrude(s,dia?.17:.12,dia?.065:.045,dia?1:3,dia?6:28),BM);if(dia)bl.userData.keep=1;
 const E=[];for(let k=0;k<=24;k++){const p=bezPt(P0,P1,P2,P3,k/24);E.push([p[0]+.035,p[1],0])}const ed=itAdd(G,itTube(E,dia?.028:.036,40,8),dia?'rune':'chrome');ed.userData.keep=1;ed.name='edge';
 itAdd(G,new THREE.ConeGeometry(.075,.44,12),MM,[-.38,1.4,0],[0,0,Math.PI/2]);
 [1,-1].forEach(z=>itAdd(G,itGemGeo(.095,10),dia?'sapph':'ruby',[.72,1.42,z*(dia?.095:.075)],[z*Math.PI/2,0,0]));
 if(dia)itGlow(G,0x9fe8ff,2.4,[.9,1.4,0],.3).name='halo';return itMerge(G)}
// the Afro Pick and the Ancestors' Golden Pick: a raised fist for a handle, a bar, seven long tines
function pickModel2(kind){const G=new THREE.Group(),gold=kind==='gpick',HM=gold?'goldP':'black',FM=gold?'goldE':'black',TM=gold?'wgold':'goldP';
 itAdd(G,itRBox(.46,1.9,.27,.12,3),HM,[0,-1.06,0]);itAdd(G,itRBox(.52,.12,.31,.05,2),gold?'wgold':'gold',[0,-1.98,0]);
 itAdd(G,itRBox(.76,.52,.44,.16,3),FM,[0,.06,-.04]);   // the back of the hand
 [-.27,-.09,.09,.27].forEach((x,i)=>{const up=i===1||i===2?.03:0;itAdd(G,itRBox(.18,.2,.34,.08,3),FM,[x,.34+up,.02]);itAdd(G,itRBox(.17,.27,.15,.07,3),FM,[x,.2+up,.24]);itAdd(G,itRBox(.15,.12,.12,.05,2),FM,[x,.04+up,.2])});   // four curled fingers: knuckle, middle, tip
 itAdd(G,itRBox(.42,.15,.16,.065,3),FM,[-.06,.1,.36],[0,0,-.2]);itAdd(G,itRBox(.2,.2,.18,.08,3),FM,[-.33,.04,.24],[0,0,.4]);   // the thumb across the frontif(!gold)itAdd(G,new THREE.TorusGeometry(.1,.028,8,24),'goldP',[.09,.31,.3]);
 itAdd(G,itRBox(1.38,.2,.24,.08,3),TM,[0,.6,0]);for(let k=0;k<7;k++)itAdd(G,itLathe([[0,0],[.058,0],[.055,.6],[.043,1.1],[.024,1.42],[0,1.52]],14),TM,[-.57+k*.19,.68,0]);
 if(gold){const d=itAdd(G,itGemGeo(.12,10),'dia',[0,.1,.33],[Math.PI/2,0,0]);d.userData.keep=1;itGlow(G,0xfff0a0,2,[0,1,0],.32).name='halo'}return itMerge(G)}
// the Brigade Scepter: an engraved gold staff, gems round the collar, a cage of four gold prongs round a glass orb with a purple fire in it
function scepterModel2(){const G=new THREE.Group();
 itAdd(G,itLathe([[0,-2.02],[.12,-2],[.16,-1.92],[.11,-1.84],[.09,-1.3],[.13,-1.24],[.09,-1.18],[.08,-.2],[.12,-.14],[.08,-.08],[.075,.86],[.11,.94],[.15,1.08],[.19,1.24],[.16,1.34],[.1,1.38],[0,1.4]],28),'goldE');
 for(let k=0;k<4;k++){const a=k/4*Math.PI*2;itAdd(G,itGemGeo(.065,8),k%2?'emer':'sapph',[Math.sin(a)*.19,1.17,Math.cos(a)*.19],[Math.PI/2,a,0,'YXZ'])}
 for(let k=0;k<4;k++){const a=k/4*Math.PI*2+Math.PI/4,c=Math.cos(a),n=Math.sin(a);itAdd(G,itTube([[n*.12,1.36,c*.12],[n*.4,1.6,c*.4],[n*.5,1.97,c*.5],[n*.36,2.36,c*.36],[n*.07,2.52,c*.07]],.034,28,8),'goldP')}
 const og=itAdd(G,new THREE.SphereGeometry(.4,40,28),'orbglass',[0,1.96,0]);og.renderOrder=3;og.userData.keep=1;
 const oc=itAdd(G,new THREE.IcosahedronGeometry(.19,1),'orbcore',[0,1.96,0]);oc.userData.keep=1;oc.name='core';itGlow(G,0xb060ff,1.7,[0,1.96,0],.6).name='halo';
 itAdd(G,new THREE.SphereGeometry(.065,14,10),'goldP',[0,2.56,0]);itAdd(G,itRBox(.06,.3,.06,.02,1),'goldP',[0,2.74,0]);itAdd(G,itRBox(.2,.06,.06,.02,1),'goldP',[0,2.79,0]);return itMerge(G)}
// Nagrock's Abyss Cleaver: one slab of black steel with lava in its cracks, a hole by the spine, the edge white-hot, a wrapped haft and an iron spike
function cleaverModel2(){const G=new THREE.Group();
 itAdd(G,itLathe([[0,-1.5],[.1,-1.5],[.14,-1.44],[.13,-1.36],[.115,-1.3],[.11,.3],[.13,.45],[.12,.9],[0,.92]],24),'ebony');itAdd(G,itLathe([[.124,-1.28],[.132,-1.22],[.132,.2],[.124,.26]],24),'leather');
 itAdd(G,new THREE.ConeGeometry(.12,.38,10),'iron',[0,-1.69,0],[Math.PI,0,0]);itAdd(G,new THREE.TorusGeometry(.14,.032,8,24),'iron',[0,-1.42,0],[Math.PI/2,0,0]);
 const s=new THREE.Shape();s.moveTo(-.12,.55);s.lineTo(-.12,3.25);s.quadraticCurveTo(-.1,3.42,.1,3.44);s.lineTo(1.38,3.6);s.quadraticCurveTo(1.62,3.5,1.6,3.2);s.bezierCurveTo(1.66,2.4,1.62,1.5,1.5,.9);s.quadraticCurveTo(1.38,.62,1.1,.6);s.lineTo(.1,.62);s.quadraticCurveTo(-.06,.6,-.12,.55);
 const h=new THREE.Path();h.absarc(.32,3.02,.17,0,Math.PI*2,true);s.holes.push(h);itAdd(G,itExtrude(s,.13,.05,3,20),'dsteel');
 const E=[];for(let k=0;k<=24;k++){const p=bezPt([1.6,3.2],[1.66,2.4],[1.62,1.5],[1.5,.9],k/24);E.push([p[0]+.035,p[1],0])}const ed=itAdd(G,itTube(E,.034,40,6),'edge');ed.userData.keep=1;ed.name='edge';
 [.8,1.3,1.8,2.3].forEach(y=>[1,-1].forEach(z=>itAdd(G,new THREE.SphereGeometry(.05,10,8),'iron',[.04,y,z*.075])));itGlow(G,0xff4a10,2.8,[.8,2.1,0],.2).name='halo';return itMerge(G)}
// the Gold Boombox: engraved gold, two speakers that thump, a cassette behind smoked glass, buttons, a chrome handle and an aerial
function boomboxModel(){const G=new THREE.Group();itAdd(G,itRBox(2.4,1.3,.7,.22,4),'goldP');itAdd(G,itRBox(2.2,1.08,.06,.12,2),'gun',[0,-.03,.34]);
 [-.7,.7].forEach((x,i)=>{itAdd(G,new THREE.TorusGeometry(.35,.05,12,44),'chrome',[x,-.1,.39]);const c=itAdd(G,itLathe([[.33,0],[.26,-.055],[.15,-.12],[.09,-.14],[0,-.14]],36),'cone',[x,-.1,.4],[Math.PI/2,0,0]);c.userData.keep=1;c.name='cone'+i;
  itAdd(G,new THREE.SphereGeometry(.09,18,10,0,Math.PI*2,0,Math.PI/2),'chrome',[x,-.1,.29],[Math.PI/2,0,0]);itAdd(G,new THREE.TorusGeometry(.085,.02,8,24),'chrome',[x,.37,.38]);itAdd(G,new THREE.SphereGeometry(.07,14,8,0,Math.PI*2,0,Math.PI/2),'cone',[x,.37,.36],[Math.PI/2,0,0])});
 const w=itAdd(G,itRBox(.5,.34,.04,.05,2),'glassT',[0,.06,.385]);w.renderOrder=3;w.userData.keep=1;[-.11,.11].forEach(x=>{itAdd(G,new THREE.CylinderGeometry(.07,.07,.02,18),'ivory',[x,.06,.36],[Math.PI/2,0,0])});
 for(let k=0;k<5;k++)itAdd(G,itRBox(.12,.07,.12,.025,2),k===2?'red':'chrome',[-.36+k*.18,.67,.12]);
 itAdd(G,itTube([[-.85,.6,0],[-.86,.92,0],[-.66,1.1,0],[.66,1.1,0],[.86,.92,0],[.85,.6,0]],.05,40,10),'chrome');
 itAdd(G,new THREE.CylinderGeometry(.018,.025,1.5,8),'chrome',[1.02,1.25,-.22],[0,0,-.32]);itAdd(G,new THREE.SphereGeometry(.045,12,8),'chrome',[1.26,1.96,-.22]);return itMerge(G)}
// the Watermelon Launcher: an olive tube with bands, a wooden grip and stock, a sight, a whole watermelon in the mouth
function launcherModel(){const G=new THREE.Group(),Z=[0,0,-Math.PI/2];
 itAdd(G,itLathe([[0,-1.2],[.28,-1.2],[.33,-1.16],[.33,-1],[.3,-.95],[.3,.95],[.34,1],[.38,1.1],[.38,1.22],[.33,1.25],[0,1.25]],36),'olive',[0,0,0],Z);
 [-.6,.2].forEach(x=>itAdd(G,new THREE.TorusGeometry(.322,.035,8,40),'gun',[x,0,0],[0,Math.PI/2,0]));
 itAdd(G,itRBox(.22,.62,.2,.07,3),'wood',[-.25,-.5,0],[0,0,.25]);itAdd(G,new THREE.TorusGeometry(.14,.025,6,20,Math.PI),'gun',[-.02,-.33,0],[0,0,Math.PI]);itAdd(G,itRBox(.04,.14,.04,.012,1),'gun',[-.04,-.38,0],[0,0,.3]);
 itAdd(G,itRBox(.26,.4,.2,.08,3),'wood',[.55,-.4,0],[0,0,-.1]);itAdd(G,itRBox(.8,.36,.2,.1,3),'wood',[-1.5,-.12,0],[0,0,.12]);itAdd(G,itRBox(.1,.44,.22,.04,2),'rubber',[-1.92,-.17,0],[0,0,.12]);
 itAdd(G,itRBox(.5,.1,.1,.03,2),'gun',[.2,.36,0]);itAdd(G,new THREE.TorusGeometry(.08,.018,8,20),'gun',[.42,.48,0],[0,Math.PI/2,0]);
 itAdd(G,new THREE.SphereGeometry(.34,40,28),'melon',[1.36,0,0],[0,0,Math.PI/2],[1,1.22,1]);return itMerge(G)}
// the AK-47 and the Golden AK-47 (gold and engraving, a rich dark stock, a ruby in the grip)
function akModel2(gold){const G=new THREE.Group(),M=gold?'goldP':'gun',W=gold?'ebony':'mahog',B=gold?'goldP':'gun';
 itAdd(G,itRBox(1.2,.3,.2,.04,2),M);itAdd(G,new THREE.CylinderGeometry(.1,.1,1.12,18,1,false,0,Math.PI),M,[-.02,.15,0],[0,0,Math.PI/2]);
 itAdd(G,new THREE.CylinderGeometry(.045,.045,1.5,14),B,[1.35,.05,0],[0,0,Math.PI/2]);itAdd(G,itLathe([[0,0],[.06,0],[.066,.03],[.066,.2],[.056,.22],[0,.22]],16),B,[2.1,.05,0],Z_);
 itAdd(G,itRBox(.06,.2,.04,.015,1),B,[1.95,.17,0]);itAdd(G,new THREE.TorusGeometry(.07,.015,6,16,Math.PI),B,[1.95,.2,0],[0,Math.PI/2,0]);
 itAdd(G,new THREE.CylinderGeometry(.05,.05,.7,12),B,[1.05,.16,0],[0,0,Math.PI/2]);itAdd(G,itRBox(.5,.1,.14,.04,2),W,[.82,.17,0]);itAdd(G,itRBox(.7,.2,.18,.06,3),W,[.92,-.04,0]);
 const ms=new THREE.Shape();ms.moveTo(.05,-.12);ms.lineTo(.33,-.12);ms.quadraticCurveTo(.42,-.55,.64,-.95);ms.lineTo(.38,-1.03);ms.quadraticCurveTo(.18,-.6,.05,-.12);itAdd(G,itExtrude(ms,.13,.02,2,14),M);
 const gs=new THREE.Shape();gs.moveTo(-.38,-.12);gs.lineTo(-.18,-.12);gs.lineTo(-.28,-.62);gs.quadraticCurveTo(-.36,-.7,-.46,-.62);gs.lineTo(-.38,-.12);itAdd(G,itExtrude(gs,.14,.03,2,10),W);
 itAdd(G,new THREE.TorusGeometry(.12,.018,6,20,Math.PI),B,[-.02,-.15,0],[0,0,Math.PI]);itAdd(G,itRBox(.03,.12,.03,.01,1),B,[-.04,-.2,0],[0,0,.3]);
 const ss=new THREE.Shape();ss.moveTo(-.58,.1);ss.lineTo(-1.8,-.06);ss.lineTo(-1.82,-.5);ss.lineTo(-1.62,-.5);ss.quadraticCurveTo(-1.1,-.22,-.58,-.12);ss.lineTo(-.58,.1);itAdd(G,itExtrude(ss,.16,.03,2,10),W);
 itAdd(G,itRBox(.06,.5,.18,.02,1),M,[-1.83,-.27,0],[0,0,-.04]);itAdd(G,itRBox(.42,.04,.02,.01,1),B,[-.05,.08,.11],[0,0,-.12]);
 itAdd(G,itRBox(.16,.1,.12,.03,2),B,[.5,.27,0]);itAdd(G,itRBox(.04,.06,.1,.01,1),B,[.5,.34,0]);   // the rear sight
 [-.4,-.15,.15,.4].forEach(x=>[1,-1].forEach(z=>itAdd(G,new THREE.SphereGeometry(.018,8,6),B,[x,-.07,z*.102])));   // rivets down the receiver
 itAdd(G,new THREE.CylinderGeometry(.014,.014,.8,8),B,[1.62,-.04,0],[0,0,Math.PI/2]);   // the cleaning rod under the barrel
 itAdd(G,new THREE.TorusGeometry(.045,.012,6,16),B,[1.28,-.12,0],[Math.PI/2,0,0]);itAdd(G,new THREE.TorusGeometry(.045,.012,6,16),B,[-1.7,-.5,0],[Math.PI/2,0,0]);   // sling loops
 itAdd(G,itRBox(.08,.62,.025,.01,1),M,[.39,-.55,0],[0,0,.42]);   // a rib down the magazine
 if(gold){[1,-1].forEach(z=>itAdd(G,itGemGeo(.05,8),'ruby',[-.33,-.36,z*.085],[z*Math.PI/2,0,0]));itGlow(G,0xffd060,2.6,[0,0,0],.18).name='halo'}return itMerge(G)}
const Z_=[0,0,-Math.PI/2];
// ---- the register: each item's model, how big it shows on the floor and how it leans; made once, copied for every use
const ITV={hp:{mk:()=>potionModel('hp'),sz:.62},hp2:{mk:()=>potionModel('hp2'),sz:.7},mp:{mk:()=>potionModel('mp'),sz:.62},feather:{mk:featherModel,sz:.9,tilt:.35},
 key:{mk:()=>keyModel('key'),sz:.72,tilt:.5},gkey:{mk:()=>keyModel('gkey'),sz:.72,tilt:.5},keepsake:{mk:ringModel,sz:.55},battery:{mk:batteryModel,sz:.6},jewel:{mk:jewelModel,sz:.58},recipe:{mk:recipeModel,sz:.66,tilt:.15},record:{mk:recordModel,sz:.66},
 coin:{mk:coinModel,sz:.5},pick:{mk:()=>pickModel2('pick'),sz:1,tilt:.55},gpick:{mk:()=>pickModel2('gpick'),sz:1,tilt:.55},axe:{mk:()=>axeModel2('axe'),sz:1,tilt:.55},daxe:{mk:()=>axeModel2('daxe'),sz:1.05,tilt:.55},
 scepter:{mk:scepterModel2,sz:1.05,tilt:.45},cleaver:{mk:cleaverModel2,sz:1.15,tilt:.5},scythe:{mk:()=>typeof scytheModel==='function'?scytheModel():null,sz:1.1,tilt:.5,late:1},
 boombox:{mk:boomboxModel,sz:.85},launcher:{mk:launcherModel,sz:1,tilt:.12},ak:{mk:()=>akModel2(false),sz:1,tilt:.12},goldak:{mk:()=>akModel2(true),sz:1,tilt:.12}};
const ITP={};
// the size of a model by its meshes (not its glows)
function itBounds(o){const B=new THREE.Box3(),b=new THREE.Box3();o.updateMatrixWorld(true);o.traverse(m=>{if(m.isMesh&&!m.isInstancedMesh&&m.geometry){if(!m.geometry.boundingBox)m.geometry.computeBoundingBox();b.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld);B.union(b)}});return B}
// the model (a fresh copy, centred, with its own moving parts): null if the item has none (the scythe until its model has loaded counts)
function itemModel(it){const V=ITV[it];if(!V)return null;let P=ITP[it];if(!P||(V.late&&P.stand&&typeof SCY!=='undefined'&&SCY.model)){let m=null;try{m=V.mk()}catch(e){console.warn('item model',it,e)}if(!m)return null;const B=itBounds(m),c=B.getCenter(new THREE.Vector3()),R=B.getSize(new THREE.Vector3()).length()/2||1;
  const w=new THREE.Group();m.position.sub(c);w.add(m);P=ITP[it]={g:w,R,stand:!!(V.late&&!(typeof SCY!=='undefined'&&SCY.model))}}
 const g=P.g.clone(true);g.userData.R=P.R;g.userData.it=it;itLive(it,g);return g}
// what moves: bubbles in the potions, embers off the feather, the scepter's fire, the cleaver's heat, the boombox's speakers, the battery's
// propeller and its sparks, a glint now and then off gold and gems
function itLive(it,g){const fs=[];const find=n=>g.getObjectByName(n);const t0=Math.random()*10;
 const bub=find('bub');if(bub){const P=POTP[bub.userData.k],fill=bub.userData.fill,M=new THREE.Matrix4(),B=[0,1,2,3,4,5,6].map(i=>({a:i*2.4,r:.25+((i*37)%10)/14,y:(i/7)*fill,s:.018+(i%3)*.009,v:.1+(i%4)*.05}));
  fs.push((t,dt)=>{B.forEach((b,i)=>{b.y+=b.v*dt;if(b.y>fill-.03)b.y=.06;const rr=itProfR(P,b.y)*.78*b.r,a=b.a+t*.6;M.makeScale(b.s,b.s,b.s);M.setPosition(Math.sin(a)*rr,b.y,Math.cos(a)*rr);bub.setMatrixAt(i,M)});bub.instanceMatrix.needsUpdate=true})}
 const cr=find('cr');if(cr)fs.push((t,dt)=>{cr.rotation.y+=dt*1.2});const ht=find('heart');if(ht)fs.push((t,dt)=>{const k=1+Math.max(0,Math.sin((t+t0)*5))**6*.15;ht.scale.setScalar(k)});
 const vane=find('vane');if(vane){const sp=[];for(let i=0;i<6;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:itStarTex(),color:0xffa030,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));s.scale.setScalar(.12);s.userData.keep=1;vane.parent.add(s);sp.push({s,life:i/6})}
  fs.push((t,dt)=>{vane.rotation.z=Math.sin((t+t0)*1.3)*.06;sp.forEach(e=>{e.life+=dt*.5;if(e.life>1){e.life=0;e.x=(Math.random()-.5)*.6;e.y=.3+Math.random()*1.8}const k=e.life;e.s.position.set(e.x||0,(e.y||1)+k*.9,.1+k*.2);e.s.material.opacity=Math.sin(k*Math.PI)*.9;e.s.scale.setScalar(.06+.1*(1-k))})})}
 const core=find('core');if(core){const halo=find('halo');fs.push((t,dt)=>{core.rotation.y+=dt*1.6;core.rotation.x+=dt*.7;const k=1+Math.sin((t+t0)*3.2)*.12;core.scale.setScalar(k);if(halo)halo.material.opacity=.45+Math.sin((t+t0)*3.2)*.18})}
 else{const halo=find('halo');if(halo){const o0=halo.material.opacity;halo.material=halo.material.clone();fs.push((t,dt)=>{halo.material.opacity=o0*(.75+Math.sin((t+t0)*2.4)*.35)})}}
 const c0=find('cone0'),c1=find('cone1');if(c0&&c1)fs.push((t,dt)=>{const b=(t+t0)*2.1%1,k=1+Math.pow(Math.max(0,1-b*3),2)*.5;c0.scale.set(1,k,1);c1.scale.set(1,k,1)});
 const pr=find('prop'),zap=find('zap');if(pr)fs.push((t,dt)=>{pr.rotation.y+=dt*16;if(zap){zap.material.opacity=Math.random()<.08?.9:zap.material.opacity*.8}});if(zap)zap.material=zap.material.clone();
 // a glint off the shiny ones
 const RR=g.userData.R||1;if(['keepsake','jewel','gpick','daxe','goldak','scepter','key','axe','coin','hp2','record'].includes(it)){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:itStarTex(),color:0xffffff,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));s.userData.keep=1;g.add(s);let at=t0%2.5,pos=null;
  fs.push((t,dt)=>{const ph=(t+t0)%2.6;if(ph<.05||!pos){pos=[(Math.random()-.5)*RR*.9,(Math.random()-.3)*RR*.9,RR*.35];s.position.set(pos[0],pos[1],pos[2])}const k=ph<.5?Math.sin(ph/.5*Math.PI):0;s.material.opacity=k;s.scale.setScalar(.05+k*RR*.35);s.material.rotation=ph*2})}
 g.userData.anim=fs.length?(t,dt)=>{for(const f of fs)f(t,dt)}:null}
// ---- on the floor: the model in place of the old flat picture (the rarity ring and the legendary beam stay), coins with their faces
function itCoinPrep(){if(DRG.up)return;DRG.coin=coinGeo().clone();DRG.coin.rotateX(Math.PI/2);DRG.cm=itMat('coin');DRG.up=1}
function itGlowMark(g){g.traverse(o=>{if(o.isSprite&&o.material&&o.material.map===ITX.glow)o.userData.glow=1})}
(function(){const dm=dropMesh;dropMesh=function(it,n){if(it==='coin')try{itCoinPrep()}catch(e){}const g=dm(it,n);if(it==='coin')return g;
 try{const m=itemModel(it);if(m){g.children.filter(c=>c.isSprite).forEach(c=>g.remove(c));const V=ITV[it]||{},sz=V.sz||.8;m.scale.setScalar(sz/(m.userData.R||1));const hold=new THREE.Group();hold.add(m);hold.position.y=sz+.5;hold.rotation.z=V.tilt||0;g.add(hold);
   const R=typeof RAR!=='undefined'&&IT[it]&&RAR[IT[it].rar];if(R&&IT[it].rar!=='c')itGlow(hold,R.hex,sz*3.4,[0,0,-.2],.26);g.userData.anim=m.userData.anim;g.userData.hold=hold;g.traverse(o=>o.layers.set(1))}}catch(e){console.warn('item drop',it,e)}return g}})();
(function(){const dt0=dropsTick;dropsTick=function(t,dt){dt0(t,dt);for(const d of W4.drops){const a=d.g&&d.g.userData.anim;if(a)try{a(t,dt)}catch(e){}}}})();
// ---- in a swing: the same models (centred, leaning forward the way the old ones did)
(function(){const tp=toolProto;toolProto=function(kind){if(TOOLP[kind])return TOOLP[kind];let m=null;try{m=itemModel(kind)}catch(e){}if(!m)return tp(kind);const g=new THREE.Group();g.add(m);g.rotation.x=1.2;return TOOLP[kind]=g}})();
// ---- the bag's pictures: each model photographed once (lit warm from the front, cool from behind, the sky in its shine), cut out clean
const ICO={url:{},q:null,n:0};
function itemIcon(it){return ICO.url[it]||null}
function itIconMake(it){if(ICO.url[it])return ICO.url[it];if(typeof R==='undefined'||!R||!R.getContext)return null;const m=itemModel(it);if(!m)return null;if(ITP[it]&&ITP[it].stand)return null;   // (the scythe waits for its own model)
 const N=512;if(!ICO.sc){const Sc=new THREE.Scene();Sc.add(new THREE.HemisphereLight(0xfff2dc,0x2a1c14,.45));const k=new THREE.DirectionalLight(0xfff0d8,1.8);k.position.set(3,5,4);Sc.add(k);const r=new THREE.DirectionalLight(0x9ad0ff,1.2);r.position.set(-4,2,-3);Sc.add(r);const f=new THREE.DirectionalLight(0xffffff,.35);f.position.set(-3,-1,4);Sc.add(f);
  ICO.sc=Sc;ICO.cam=new THREE.PerspectiveCamera(26,1,.01,100);ICO.rt=new THREE.WebGLRenderTarget(N,N);ICO.rt.texture.encoding=THREE.sRGBEncoding;ICO.buf=new Uint8Array(N*N*4)}
 const Sc=ICO.sc,cam=ICO.cam,V=ITV[it]||{};Sc.environment=(typeof S!=='undefined'&&S&&S.environment)||null;const w=new THREE.Group();m.rotation.z=-(V.tilt||0)*1.15;w.add(m);Sc.add(w);if(m.userData.anim)try{m.userData.anim(1.3,.016)}catch(e){}
 const Rr=m.userData.R||1;itGlowMark(m);m.traverse(o=>{if(o.userData.glow&&o.scale.x>Rr*1.3)o.visible=false});const B=itBounds(w),c=B.getCenter(new THREE.Vector3()),rad=B.getSize(new THREE.Vector3()).length()/2||1;w.position.sub(c);
 const d=rad/Math.sin(13*Math.PI/180)*1.02,yaw=.5,pit=.26;cam.position.set(Math.sin(yaw)*Math.cos(pit)*d,Math.sin(pit)*d,Math.cos(yaw)*Math.cos(pit)*d);cam.near=d*.2;cam.far=d*3;cam.lookAt(0,0,0);cam.updateProjectionMatrix();
 const pt=R.getRenderTarget(),pc=R.getClearColor(new THREE.Color()).getHex(),pa=R.getClearAlpha(),pe=R.toneMappingExposure;let ok=true;
 try{R.setRenderTarget(ICO.rt);R.setClearColor(0x000000,0);R.toneMappingExposure=.9;R.clear(true,true,true);R.render(Sc,cam);R.readRenderTargetPixels(ICO.rt,0,0,N,N,ICO.buf)}catch(e){ok=false;console.warn('item picture',it,e)}
 finally{R.setRenderTarget(pt);R.setClearColor(pc,pa);R.toneMappingExposure=pe;Sc.remove(w)}if(!ok)return null;
 const cv=itCanvas(N,N),g=cv.getContext('2d'),im=g.createImageData(N,N),o8=im.data,b=ICO.buf,row=N*4;let seen=0;for(let y=0;y<N;y++){const sy=(N-1-y)*row,dy=y*row;for(let x=0;x<row;x+=4){const a=b[sy+x+3];if(a){seen++;const k=255/a;o8[dy+x]=Math.min(255,b[sy+x]*k);o8[dy+x+1]=Math.min(255,b[sy+x+1]*k);o8[dy+x+2]=Math.min(255,b[sy+x+2]*k);o8[dy+x+3]=a}}}
 if(seen<200)return null;g.putImageData(im,0,0);const o=itCanvas(176,176),og=o.getContext('2d');og.imageSmoothingEnabled=true;og.imageSmoothingQuality='high';og.drawImage(cv,0,0,176,176);return ICO.url[it]=o.toDataURL('image/png')}
// one picture a frame once the tower is up (the bag and the shop show them as they come)
function itWarm(){if(!W4.on||W4.busy)return;if(!ICO.q){ICO.q=Object.keys(ITV).filter(k=>k!=='coin');try{if(typeof scytheLoad==='function')scytheLoad()}catch(e){}}
 ICO.fail=ICO.fail||{};for(let k=0;k<ICO.q.length;k++){const it=ICO.q[k];if(ICO.url[it]||(ICO.fail[it]|0)>=3)continue;if(it==='scythe'&&!(typeof SCY!=='undefined'&&SCY.model))continue;const u=itIconMake(it);if(u){if(W4.bagOpen)bagRender();if(W4.shopOpen)shopRender()}else ICO.fail[it]=(ICO.fail[it]|0)+1;return}}
// ---- everything about an item: what it does to them (worked out from your upgrades as they stand), how fast, how far, what it heals, its value
const SELL={hp:12,hp2:32,mp:10,feather:105,pick:24,axe:96,ak:56,launcher:64,boombox:72,scythe:420,scepter:650,gpick:1200,daxe:1500,cleaver:2600,goldak:3000};
function sellPrice(it){const D=IT[it];if(!D||D.q||it==='key'||it==='gkey'||it==='coin')return 0;return SELL[it]||0}
function atMarket(){return !!(W4.on&&W4.market&&Math.hypot(heroPos.x-W4.market.x,heroPos.z-W4.market.z)<14)}
function itKind(it){const D=IT[it];if(!D)return '';if(D.w&&MELEE[D.w])return 'Melee weapon';if(D.w)return D.gold?'Gun':it==='boombox'?'Sound weapon':it==='launcher'?'Launcher':'Gun';if(it==='hp'||it==='hp2'||it==='mp')return 'Potion';if(D.q||it==='gkey'||it==='key')return 'Quest item';if(it==='feather')return 'Revive';return 'Item'}
function itStats(it){const D=IT[it];if(!D)return [];const rows=[],f=v=>v>=100?Math.round(v).toLocaleString():String(Math.round(v*10)/10);const pw=(L2.pwr0||1)*(L2.dmgMul||1),punch=5*pw*(L2.fistMul||1),w=D.w,M=w&&MELEE[w];
 if(M){const dm=punch*M.mul;rows.push(['Damage',f(dm)+' a hit','('+M.mul+'× your punch)'],['Speed',f(1/M.cd)+' swings a second',M.cd>=.7?'heavy':M.cd<=.4?'quick':''],['Damage a second',f(dm/M.cd),''],['Reach',M.reach+' paces',''],['Hits',M.spin?'everyone around you':'everyone in a wide arc in front',M.spin?'(a full spin)':''])}
 else if(w==='ak'){const g=D.gold?1.8:1,dm=(L2.akDmg||4)*(L2.akMul||1)*(L2.dmgMul||1)*g,rt=(L2.rate||7.5)*.94;rows.push(['Damage',f(dm)+' a round',D.gold?'(gold rounds: 1.8×)':''],['Speed',f(rt)+' rounds a second','fully automatic'],['Damage a second',f(dm*rt),''],['Range','72 paces','it aims itself'],['Ammo','never runs out',''])}
 else if(w==='launcher'){const dm=10*pw;rows.push(['Damage',f(dm)+' a melon','on a direct hit'],['Speed','2 melons a second',''],['Damage a second',f(dm*2),''],['Range','60 paces','lobbed: it comes down on them'])}
 else if(w==='boombox'){const dm=10*pw*(L2.boomMul||1);rows.push(['Damage',f(dm)+' a blast',''],['Speed',f(1/.7)+' blasts a second',''],['Damage a second',f(dm/.7),''],['Range','12 paces','through everyone in its path'])}
 else if(it==='hp'||it==='hp2'){const mh=typeof maxHP==='function'?maxHP():100,k=it==='hp'?.5:1;rows.push(['Heals',(k*100)+'% of your health','(+'+Math.round(mh*k)+' right now)'],['Use','H, or Use here',''])}
 else if(it==='mp')rows.push(['Fills','all your mana','(to '+(W4.manaMax|0)+')'],['Use','Use here','']);
 else if(it==='feather')rows.push(['Effect','back on your feet where you fell','full health, once: used up when you go down']);
 else if(D.q||it==='key'||it==='gkey')rows.push(['For',it==='gkey'?'this floor\'s locked gate':it==='key'?'somebody upstairs who wants it':'somebody on this floor who lost it','']);
 if(D.st)rows.push(['Stacks','up to '+D.st+' in a slot',''],['You have',bagCount(it)+'','']);return rows}
function itemCard(it,n,eq){const D=IT[it];if(!D)return '';const Rr=(typeof RAR!=='undefined'&&RAR[D.rar])||{n:'Common',col:'#e8e2d4'},ic=itemIcon(it),st=itStats(it),sell=sellPrice(it),buy=(SHOP.find(s=>s.it===it)||{}).p;
 return '<div class="itc" style="--rc:'+Rr.col+'"><div class="ith">'+(ic?'<img src="'+ic+'" alt="">':'<span class="ie">'+D.i+'</span>')+'<div><div class="itn">'+esc4(D.n)+(n>1?' <small>× '+n+'</small>':'')+'</div><div class="itr">'+Rr.n+' · '+itKind(it)+(eq?' · <b>in your hands</b>':'')+'</div></div></div>'+
  (st.length?'<table class="its">'+st.map(r=>'<tr><td>'+r[0]+'</td><td>'+esc4(r[1])+(r[2]?' <small>'+esc4(r[2])+'</small>':'')+'</td></tr>').join('')+'</table>':'')+'<div class="itd">'+esc4(D.d||'')+'</div>'+
  '<div class="itv">'+(sell?'Sells for <b>'+coinIc()+' '+sell.toLocaleString()+'</b>':'<span>Can\'t be sold</span>')+(buy?' · in the shop: '+coinIc()+' '+buy.toLocaleString():D.loot?' · <i>never in a shop: found only</i>':'')+'</div></div>'}
function itEq(q){const D=IT[q.it];if(!D||!D.w)return false;const cur=(charApi&&charApi.weapon())||'fists';return MELEE[D.w]?W4.melee===q.it&&cur==='fists':cur===D.w&&!W4.melee&&(!D.gold===!W4.goldAk)}
const TIP={x:-1,y:-1,on:null};
function tipShow(it,n,eq,x,y){let el=$('w4tip');if(!el){el=document.createElement('div');el.id='w4tip';document.body.appendChild(el)}el.innerHTML=itemCard(it,n,eq);el.style.display='block';TIP.on=it;tipMove(x,y)}
function tipMove(x,y){TIP.x=x;TIP.y=y;const el=$('w4tip');if(!el||el.style.display==='none')return;const w=el.offsetWidth,h=el.offsetHeight;let L=x+18,T=y+14;if(L+w>innerWidth-8)L=x-w-18;if(T+h>innerHeight-8)T=Math.max(8,innerHeight-h-8);el.style.left=Math.max(8,L)+'px';el.style.top=T+'px'}
function tipHide(){TIP.on=null;const el=$('w4tip');if(el)el.style.display='none'}
function tipBind(b,get){b.addEventListener('pointerenter',ev=>{if(ev.pointerType==='touch')return;const q=get();if(q)tipShow(q.it,q.n,itEq(q),ev.clientX,ev.clientY)});b.addEventListener('pointermove',ev=>{if(ev.pointerType!=='touch')tipMove(ev.clientX,ev.clientY)});b.addEventListener('pointerleave',tipHide)}
// selling (only at Da Nag Market): a rare or better thing asks once more before it goes
function bagSell(i){const s=W4.bag[i];if(!s)return false;const D=IT[s.it],p=sellPrice(s.it);if(!p||!atMarket())return false;if(['r','e','l','m'].includes(D.rar)&&W4.sellAsk!==i){W4.sellAsk=i;bagRender();return false}W4.sellAsk=null;
 const t=bagTake(i,1);if(!t)return false;W4.coins=(W4.coins|0)+p;toast('Sold to Da Nag Dabloon: '+D.n+' · +🪙 '+p.toLocaleString());try{dblChing(heroPos.x,heroPos.z,.6,1.1,4)}catch(e){}saveNow();W4.hud();if(W4.bagOpen)bagRender();return true}
// the bag: pictures in the slots, the card when you hover one (or pick it), the Sell button at the market
(function(){const br=bagRender;bagRender=function(){const r=br.apply(this,arguments);try{const el=$('w4bag');if(!el)return r;if(W4.sellAsk!=null&&W4.sellAsk!==(W4.bagSel|0))W4.sellAsk=null;
 el.querySelectorAll('.w4s[data-s]').forEach(b=>{const i=+b.dataset.s,q=W4.bag[i];if(!q)return;const ic=itemIcon(q.it),e=b.querySelector('.e');if(ic&&e)e.outerHTML='<img class="ii" src="'+ic+'" alt="">';tipBind(b,()=>W4.bag[i])});
 const sel=W4.bagSel|0,s=W4.bag[sel],dd=el.querySelector('.w4d');if(s&&dd){const nm=dd.querySelector('.nm'),ds=dd.querySelector('.ds');if(nm)nm.remove();if(ds)ds.outerHTML=itemCard(s.it,s.n,itEq(s));
  const bx=dd.querySelector('.w4b'),p=sellPrice(s.it);if(bx&&p){const at=atMarket(),ask=W4.sellAsk===sel;bx.insertAdjacentHTML('beforeend','<button type="button" data-sell="1"'+(at?'':' disabled')+(ask?' style="background:#7a1a10;border-color:#ff6a4a"':'')+'>'+(ask?'Sure? Sell it for '+coinIc()+' ':'Sell · '+coinIc()+' ')+p.toLocaleString()+'</button>');
   if(!at)bx.insertAdjacentHTML('afterend','<div class="ith2">Sell things at Da Nag Market: the stand by the door on every floor.</div>');const sb=bx.querySelector('[data-sell]');if(sb)sb.onclick=()=>bagSell(sel)}}
 if(TIP.on){const h=document.elementFromPoint(TIP.x,TIP.y),b=h&&h.closest&&h.closest('#w4bag .w4s[data-s]');const q=b&&W4.bag[+b.dataset.s];if(q)tipShow(q.it,q.n,itEq(q),TIP.x,TIP.y);else tipHide()}}catch(e){console.warn('bag cards',e)}return r}})();
(function(){const bt=bagToggle;bagToggle=function(v){const r=bt(v);if(!W4.bagOpen){tipHide();W4.sellAsk=null}return r}})();
// the shop: the same pictures, the same card on hover, and a way to the bag to sell
(function(){const sr=shopRender;shopRender=function(){const r=sr.apply(this,arguments);try{const el=$('w4shop');if(!el)return r;el.querySelectorAll('.w4r').forEach(row=>{const b=row.querySelector('[data-i]'),S0=b&&SHOP[+b.dataset.i];if(!S0||!S0.it)return;const ic=itemIcon(S0.it),c=row.querySelector('.ic');if(ic&&c)c.innerHTML='<img class="ii" src="'+ic+'" alt="">';tipBind(row,()=>({it:S0.it,n:1}))});
 const f=el.querySelector('.w4f');if(f&&!f.querySelector('[data-sellbag]')){f.insertAdjacentHTML('afterbegin','<a href="#" data-sellbag="1" style="color:#ffd040;font-weight:800">Sell from your bag</a> · ');f.querySelector('[data-sellbag]').onclick=ev=>{ev.preventDefault();tipHide();shopClose();bagToggle(true)}}}catch(e){console.warn('shop cards',e)}return r}})();
(function(){const sc=shopClose;shopClose=function(){tipHide();return sc.apply(this,arguments)}})();
// the look of the cards
(function(){const st=document.createElement('style');st.textContent='#w4tip{position:fixed;z-index:95;display:none;pointer-events:none;width:310px;max-width:86vw}'+
 '.itc{background:linear-gradient(#26180d,#120a05);border:2px solid var(--rc);border-radius:12px;padding:10px 12px;box-shadow:0 10px 30px rgba(0,0,0,.65);color:#f2e2c8;font:13px system-ui}'+
 '.itc .ith{display:flex;gap:10px;align-items:center}.itc .ith img{width:88px;height:88px;object-fit:contain;background:radial-gradient(circle,rgba(255,255,255,.1),rgba(255,255,255,0) 70%);border-radius:10px;filter:drop-shadow(0 5px 8px rgba(0,0,0,.6))}.itc .ie{font-size:54px;width:88px;text-align:center}'+
 '.itc .itn{font:800 16px system-ui;color:var(--rc);line-height:1.2}.itc .itn small{color:#ffd040}.itc .itr{font:600 12px system-ui;color:#cdb898;margin-top:3px}.itc .itr b{color:#7aff9a}'+
 '.itc .its{width:100%;border-collapse:collapse;margin:8px 0 6px}.itc .its td{padding:3px 0;border-bottom:1px solid rgba(217,164,37,.15);vertical-align:top}.itc .its td:first-child{color:#d9a425;font-weight:700;width:36%;padding-right:8px;white-space:nowrap}.itc .its small{color:#9a8a70}'+
 '.itc .itd{font-size:12.5px;color:#cdb898;line-height:1.35}.itc .itv{margin-top:8px;color:#f2e2c8}.itc .itv b{color:#ffd040}.itc .itv span{color:#9a8a70}.itc .itv i{color:#c890ff}'+
 '.w4d .itc{border-width:1px;box-shadow:none;background:rgba(0,0,0,.18);margin-bottom:8px}.w4d .ith2{font-size:12px;color:#9a8a70;margin-top:6px}'+
 '.w4s img.ii{width:46px;height:46px;object-fit:contain;filter:drop-shadow(0 2px 3px rgba(0,0,0,.7));pointer-events:none;margin-top:3px}.w4r .ic img.ii{width:44px;height:44px;object-fit:contain;filter:drop-shadow(0 2px 3px rgba(0,0,0,.7))}';document.head.appendChild(st)})();
// ---- the treasure chests, made properly too: planked wood (grain and seams you can see), metal bands with rivets and corner caps, a domed
// lid with its own bands, a lock plate with a keyhole; the wood and the metal tell you what kind of chest it is (an oak chest with gold, a
// secret room's black chest with white gold and emeralds, a vault's iron-bound chest, a puzzle's purple chest); open, it shows a heap of gold
function txPlanks(tone){const k='plk'+tone;if(ITX[k])return ITX[k];const c=itCanvas(256,256),g=c.getContext('2d'),r=itRng(tone.length*31+5);const B=tone==='ebony'?[46,32,28]:tone==='purple'?[72,36,80]:tone==='iron'?[70,52,40]:[128,82,46];
 for(let j=0;j<5;j++){const sh=.85+r()*.3;g.fillStyle='rgb('+B.map(v=>v*sh|0)+')';g.fillRect(0,j*51.2,256,51.2);for(let i=0;i<14;i++){g.strokeStyle='rgba('+B.map(v=>v*.6|0)+','+(.25+r()*.3)+')';g.lineWidth=.8+r()*1.6;g.beginPath();const y0=j*51.2+r()*51;g.moveTo(0,y0);for(let x=0;x<=256;x+=16)g.lineTo(x,y0+Math.sin(x*.03+i)*3);g.stroke()}
  g.fillStyle='rgba(20,12,6,.75)';g.fillRect(0,j*51.2,256,2.6)}itNoise(g,256,256,14,r);return ITX[k]={map:itTex(c,false,1,1),nm:itNormal(c,2.4,1,1)}}
function chestMesh(src){const T={chest:['oak','gold','ruby'],secret:['ebony','wgold','emer'],vault:['iron','steel','sapph'],puzzle:['purple','goldP','amet']}[src]||['oak','gold','ruby'];
 const P=txPlanks(T[0]),wood=new THREE.MeshStandardMaterial({map:P.map,normalMap:P.nm,normalScale:new THREE.Vector2(.8,.8),roughness:.7,metalness:0});const E=itEnv();if(E){wood.envMap=E;wood.envMapIntensity=.4}const met=itMat(T[1]),gem=itMat(T[2]);
 const g=new THREE.Group(),body=new THREE.Group();g.add(body);const add=(par,geo,mat,p,r)=>{const m=new THREE.Mesh(geo,mat);m.position.set(p[0],p[1],p[2]);if(r)m.rotation.set(r[0],r[1],r[2]);par.add(m);return m};
 add(body,itRBox(2.6,1.5,1.7,.06,2),wood,[0,.75,0]);
 [-.9,.9].forEach(x=>{add(body,itRBox(.24,1.56,1.78,.04,2),met,[x,.75,0]);[.3,.75,1.2].forEach(y=>[1,-1].forEach(z=>add(body,new THREE.SphereGeometry(.045,8,6),met,[x,y,z*.9])))});
 add(body,itRBox(2.68,.14,1.78,.04,2),met,[0,.07,0]);add(body,itRBox(2.68,.12,1.78,.04,2),met,[0,1.44,0]);
 [-1,1].forEach(x=>[-1,1].forEach(z=>add(body,itRBox(.3,.3,.3,.06,2),met,[x*1.22,.15,z*.78])));
 // inside: a heap of gold (seen once the lid is up)
 {const cg=coinGeo(),cm=itMat('coin'),im=new THREE.InstancedMesh(cg,cm,26),M=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),r=itRng(7);for(let i=0;i<26;i++){e.set(r()*.6-.3,r()*6,r()*.6-.3);q.setFromEuler(e);M.compose(new THREE.Vector3(r()*2-1,1.32+r()*.14+(Math.abs(r()-.5)<.2?.08:0),r()*1.2-.6),q,new THREE.Vector3(.42,.42,.42));im.setMatrixAt(i,M)}body.add(im)}
 itMerge(body);
 // the lid: a dome hinged at the back, with its bands and the lock plate
 const lid=new THREE.Group();lid.position.set(0,1.5,-.85);g.add(lid);const dome=new THREE.CylinderGeometry(.85,.85,2.6,28,1,false,0,Math.PI);dome.rotateZ(Math.PI/2);dome.scale(1,.62,1);
 add(lid,dome,wood,[0,0,.85]);add(lid,new THREE.BoxGeometry(2.6,.04,1.7),wood,[0,.02,.85]);
 [-.9,.9].forEach(x=>{const tb=new THREE.TorusGeometry(.86,.06,8,28,Math.PI);tb.rotateY(Math.PI/2);tb.scale(1,.62,1);add(lid,tb,met,[x,0,.85])});
 add(lid,itRBox(.44,.5,.1,.04,2),met,[0,.02,1.74]);const kh=add(lid,new THREE.CircleGeometry(.06,12),new THREE.MeshBasicMaterial({color:0x0a0604}),[0,.07,1.796]);add(lid,new THREE.PlaneGeometry(.05,.14),kh.material,[0,-.03,1.796]);
 add(lid,itGemGeo(.08,8),gem,[0,.36,1.62],[Math.PI/2-.5,0,0]);itMerge(lid);
 g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});return {g,lid}}
// ---------------------------------------------------------------- SECRETS: secret doors and vaults (the owner, Oct 21 11:59: "secret doors and
// stuff like that, different secrets, secret weapons, secret chests... a lock puzzle"). A maze hides a sealed room behind loose bricks
// (light leaks through the cracks: walk up and push); a floor's vault keep has a gold door with three dials, and its code is carved on three
// stones around the floor. Behind both waits a chest on the secret or vault tables (the epic, legendary and mythic weapons live there). The
// host opens doors (a guest asks); every screen sees the same doors open (MPFX 'w4sd' and the snapshot).
const SEC={};
function secretBuild(F,G){F.doors=[];const bm=brickMat(F.th),sm=stoneMat();
 F.P.forEach(p=>(p.blocks||[]).forEach(b=>{if(!b.sdoor&&!b.vdoor)return;const w=b.x1-b.x0,d=b.z1-b.z0,h=b.top-p.top;const g=new THREE.Group();g.position.set((b.x0+b.x1)/2,p.top,(b.z0+b.z1)/2);
  if(b.sdoor){const o=newOut();boxW(-w/2,w/2,0,h-.4,-d/2,d/2,4.2,o,60);const m=new THREE.Mesh(geoOf(o),bm);m.castShadow=m.receiveShadow=true;g.add(m);const o2=newOut();boxW(-w/2-.08,w/2+.08,h-.4,h,-d/2-.08,d/2+.08,3,o2,63);g.add(new THREE.Mesh(geoOf(o2),sm));
   // light leaking through the cracks: thin glowing seams on both faces, low down where a hand would push
   const cm=new THREE.MeshBasicMaterial({color:0xffc070,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});const thin=w<d;
   for(let k=0;k<5;k++){const y=1+k*1.15+Math.sin(k*2.3)*.3,len=1.2+((k*7)%3)*.5;const s=new THREE.Mesh(thin?new THREE.BoxGeometry(w+.06,.07,len):new THREE.BoxGeometry(len,.07,d+.06),cm);s.position.set(thin?0:Math.sin(k*1.7)*w*.25,y,thin?Math.cos(k*1.3)*d*.25:0);g.add(s)}
   g.userData.crack=cm}
  else{// the vault door: a round steel door in a gold ring, bolts round the rim, three dials across its middle, a spoked wheel, the sign above
   const steel=new THREE.MeshStandardMaterial({color:0x3c4048,metalness:.95,roughness:.28}),dark=new THREE.MeshStandardMaterial({color:0x22252b,metalness:.9,roughness:.4}),gold=new THREE.MeshStandardMaterial({color:0xd9a425,metalness:1,roughness:.22,emissive:0x3a2600,emissiveIntensity:.4});
   const fz=d/2+.02;const slab=new THREE.Mesh(new THREE.BoxGeometry(w,Math.min(h,8),d),dark);slab.position.y=Math.min(h,8)/2;slab.castShadow=true;g.add(slab);
   const top=new THREE.Mesh(new THREE.BoxGeometry(w,Math.max(.1,h-8),d),bm);top.position.y=8+(h-8)/2;g.add(top);
   const disc=new THREE.Mesh(new THREE.CylinderGeometry(1.85,1.85,.3,36),steel);disc.rotation.x=Math.PI/2;disc.position.set(0,3.9,fz+.12);g.add(disc);
   const ring=new THREE.Mesh(new THREE.TorusGeometry(1.92,.16,10,40),gold);ring.position.set(0,3.9,fz+.28);g.add(ring);
   for(let k=0;k<12;k++){const a=k/12*6.283;const bo=new THREE.Mesh(new THREE.SphereGeometry(.1,8,6),gold);bo.position.set(Math.sin(a)*1.62,3.9+Math.cos(a)*1.62,fz+.3);g.add(bo)}
   [-.75,0,.75].forEach((dx,i)=>{const dial=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.18,20),gold);dial.rotation.x=Math.PI/2;dial.position.set(dx,4.55,fz+.36);g.add(dial);const tick=new THREE.Mesh(new THREE.BoxGeometry(.05,.22,.05),dark);tick.position.set(0,.18,0);tick.rotation.x=-Math.PI/2;dial.add(tick);g.userData['dial'+i]=dial});
   const wh=new THREE.Group();wh.position.set(0,3.25,fz+.42);const rim=new THREE.Mesh(new THREE.TorusGeometry(.62,.07,8,28),gold);wh.add(rim);for(let k=0;k<4;k++){const sp=new THREE.Mesh(new THREE.BoxGeometry(1.2,.08,.08),gold);sp.rotation.z=k*Math.PI/4;wh.add(sp)}g.add(wh);g.userData.wheel=wh;
   const fr=new THREE.Mesh(new THREE.BoxGeometry(w+.6,.45,d+.5),gold);fr.position.y=8;g.add(fr);[-1,1].forEach(sd=>{const c=new THREE.Mesh(new THREE.BoxGeometry(.4,8,d+.4),gold);c.position.set(sd*(w/2+.1),4,0);g.add(c)});
   const sg=signMesh('THE DOUBLOON\'S VAULT','THREE DIALS · THREE STONES');sg.scale.setScalar(.36);sg.position.set(0,6.6,fz+.6);g.add(sg)}
  g.traverse(o=>o.layers.set(1));G.add(g);F.doors.push({i:F.doors.length,b,p,g,h,open:false,k:0,v:!!b.vdoor})}));
 // the vault's code, carved on three stones (each says which dial it is for)
 F.stones=[];const pz=F.puz;if(pz&&pz.t==='lock')pz.clues.forEach(c=>{const g=new THREE.Group();g.position.set(c.x,c.top,c.z);g.rotation.y=Math.atan2(F.entry.x0-c.x,F.entry.z1-c.z)*0+((c.k*1.3)%1)*.6;
  const base=new THREE.Mesh(new THREE.BoxGeometry(1.8,.5,1.1),sm);base.position.y=.25;g.add(base);const slab=new THREE.Mesh(new THREE.BoxGeometry(1.5,2.2,.4),sm);slab.position.y=1.6;g.add(slab);
  const t=stoneTex(['I','II','III'][c.k],PZSYM[c.s]);[1,-1].forEach(sd=>{const f=new THREE.Mesh(new THREE.PlaneGeometry(1.3,1.9),new THREE.MeshStandardMaterial({map:t,roughness:.9,transparent:true}));f.position.set(0,1.6,sd*.21);if(sd<0)f.rotation.y=Math.PI;g.add(f)});
  const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:TEX.glare,color:0xffd27a,transparent:true,opacity:.35,depthWrite:false,blending:THREE.AdditiveBlending}));gl.scale.set(4,4,1);gl.position.y=1.8;g.add(gl);
  g.traverse(o=>o.layers.set(1));G.add(g);F.stones.push({g,c})})}
const STX={};function stoneTex(num,sym){const k=num+sym;if(STX[k])return STX[k];const c=cvs(256);c.height=360;const g=c.getContext('2d');g.fillStyle='rgba(0,0,0,0)';g.fillRect(0,0,256,360);g.fillStyle='#e8d8b0';g.font='900 64px Georgia,serif';g.textAlign='center';g.fillText(num,128,90);
 g.font='150px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';g.fillText(sym,128,270);g.strokeStyle='rgba(232,216,176,.7)';g.lineWidth=6;g.strokeRect(16,16,224,328);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return STX[k]=t}
// the doors: the nearest one you could open, opening one (it sinks into the floor), and the ground it frees
function doorNear(){const F=W4.F;if(!F||!F.doors)return null;let best=null,bd=1e9;for(const D of F.doors){if(D.open)continue;const b=D.b,cx=Math.max(b.x0,Math.min(b.x1,heroPos.x)),cz=Math.max(b.z0,Math.min(b.z1,heroPos.z)),d=Math.hypot(heroPos.x-cx,heroPos.z-cz);
  if(d<3.2&&d<bd&&Math.abs(hero.position.y-.15-D.p.top)<2.5){bd=d;best=D}}return best}
function doorOpen(D,quiet){if(!D||D.open)return;D.open=true;D.t0=clk.getElapsedTime();const F=W4.F;try{if(!quiet){shake=Math.max(shake,.6);sfxRumble(D.g.position.x,D.g.position.z);dustPuff(D.g.position.x,D.p.top,D.g.position.z,clk.getElapsedTime());
   bossYell(D.v?'THE VAULT OPENS':'A SECRET DOOR!',D.v?'The dials click. The door sinks into the floor.':'The loose bricks give. There is a room behind them.')}}catch(e){}
 // its ground frees at once (the door is going down): you, your partner and the enemies can walk through
 const i=D.p.blocks.indexOf(D.b);if(i>=0)D.p.blocks.splice(i,1);if(D.b.lintel){const j=D.p.blocks.indexOf(D.b.lintel);if(j>=0)D.p.blocks.splice(j,1)}buildGrid(F);try{saveMark('d',D.i)}catch(e){}}
function doorsTick(t,dt){const F=W4.F;if(!F||!F.doors)return;for(const D of F.doors){if(D.open&&D.k<1){if(D.g.userData.wheel)D.g.userData.wheel.rotation.z+=dt*5;D.k=Math.min(1,D.k+dt/(D.v?2.2:1.6));const e=D.k*D.k*(3-2*D.k);D.g.position.y=D.p.top-e*(D.h+.5);if(D.k>=1)D.g.visible=false}
  else if(!D.open&&D.g.userData.crack)D.g.userData.crack.opacity=.55+Math.sin(t*2.2+D.i)*.3}}
// a low rumble (the door grinding down)
function sfxRumble(x,z){try{const ac=audioCtx();if(!ac)return;const d=Math.hypot(x-heroPos.x,z-heroPos.z),k=Math.max(0,1-d/80)*.5;if(k<.03)return;const T=ac.currentTime;const o=ac.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(48,T);o.frequency.linearRampToValueAtTime(32,T+1.5);
 const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=180;const g=ac.createGain();g.gain.setValueAtTime(.0001,T);g.gain.exponentialRampToValueAtTime(k,T+.15);g.gain.exponentialRampToValueAtTime(.0001,T+1.6);o.connect(f);f.connect(g);g.connect(ac.destination);o.start(T);o.stop(T+1.7)}catch(e){}}
// the host opens a door for everyone (a guest asks the host)
function doorAsk(D,code){if(!D)return;if(MP.on&&MP.client){mpQueue({k:'w4do',i:D.i,c:code||0});return}doorOpen(D);try{mpFx('w4sd',[D.i])}catch(e){}}
MPFX_DO.w4sd=(P,a,t)=>{const F=W4.F;if(!F||!F.doors||!Array.isArray(a))return;const D=F.doors[a[0]|0];if(D&&!D.open)doorOpen(D)};
// ---- the dial lock: three columns of symbols; the arrows (or W/S, the D-pad, a tap) turn them, Enter tries
function dialOpen(D){W4.dial={D,v:[0,0,0],sel:0,msg:''};dialShow()}
function dialShow(){let el=$('w4dial');if(!el){el=document.createElement('div');el.id='w4dial';document.body.appendChild(el)}const S=W4.dial;if(!S){el.style.display='none';return}
 el.innerHTML='<div class="w4box"><div class="w4h"><span>🔒 THE DOUBLOON\'S VAULT</span><button type="button" data-x="1">✕</button></div><div class="dl">'+[0,1,2].map(i=>'<div class="dc'+(S.sel===i?' on':'')+'"><small>'+['I','II','III'][i]+'</small><button type="button" data-u="'+i+'">▲</button><div class="sy">'+PZSYM[S.v[i]]+'</div><button type="button" data-d="'+i+'">▼</button></div>').join('')+
  '</div><div class="w4b"><button type="button" data-t="1">Try the lock</button></div><div class="ms">'+esc4(S.msg||'Three stones on this floor know the code. Each one says which dial.')+'</div></div>';el.style.display='flex';
 el.querySelectorAll('button').forEach(b=>b.onpointerdown=e=>e.stopPropagation());el.querySelector('[data-x]').onclick=()=>dialClose();el.querySelector('[data-t]').onclick=()=>dialTry();
 el.querySelectorAll('[data-u]').forEach(b=>b.onclick=()=>dialTurn(+b.dataset.u,1));el.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>dialTurn(+b.dataset.d,-1))}
function dialTurn(i,dir){const S=W4.dial;if(!S)return;S.sel=i;S.v[i]=(S.v[i]+dir+PZSYM.length)%PZSYM.length;S.msg='';try{dblChing(heroPos.x,heroPos.z,.12,2.2,1)}catch(e){}const g=S.D.g.userData['dial'+i];if(g)g.rotation.y=S.v[i]*1.05;dialShow()}
function dialTry(){const S=W4.dial;if(!S)return;const F=W4.F,code=F.puz&&F.puz.code;if(code&&S.v.every((v,i)=>v===code[i])){const D=S.D;dialClose();doorAsk(D,S.v.join(''));try{puzzleSolved('lock')}catch(e){}return}
 S.msg='Clunk. Not it.';try{shake=Math.max(shake,.15);const ac=audioCtx();if(ac){const T=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();o.type='square';o.frequency.value=110;g.gain.setValueAtTime(.12,T);g.gain.exponentialRampToValueAtTime(.0001,T+.25);o.connect(g);g.connect(ac.destination);o.start(T);o.stop(T+.3)}}catch(e){}dialShow()}
function dialClose(){W4.dial=null;dialShow()}
addEventListener('keydown',e=>{const S=W4.dial;if(!S||!W4.on)return;const k=e.key;let used=true;
 if(k==='ArrowLeft'||k==='a'||k==='A'){S.sel=(S.sel+2)%3;dialShow()}else if(k==='ArrowRight'||k==='d'||k==='D'){S.sel=(S.sel+1)%3;dialShow()}else if(k==='ArrowUp'||k==='w'||k==='W')dialTurn(S.sel,1);else if(k==='ArrowDown'||k==='s'||k==='S')dialTurn(S.sel,-1);
 else if(k==='Enter'||k===' ')dialTry();else if(k==='Escape'||k==='f'||k==='F')dialClose();else used=false;if(used){e.preventDefault();e.stopImmediatePropagation()}},true);
// the vault and the secret room give up their chests when their doors are open (the chest builder knows them: F.xchests)
function secretChests(F){const L=[];F.P.forEach(p=>{if(p.xchest)L.push({x:p.xchest.x,z:p.xchest.z,top:p.top,src:p.xchest.src})});(F.wchests||[]).forEach(c=>{if(!F.P.some(p=>p.xchest&&p.xchest.x===c.x&&p.xchest.z===c.z))L.push(Object.assign({},c))});if(F.puz&&F.puz.chest)L.push(Object.assign({},F.puz.chest));return L}
// ---- what you found stays found (the owner, Oct 21 12:12: "save everything between sessions... you keep what you had before"): opened
// doors, looted chests, solved puzzles and claimed quests are written in your save by the tower's seed and the floor, so coming back to a
// floor (alone, with your partner or with somebody new) finds them as you left them, and nothing pays out twice
function saveKey(){return (W4.seed|0)+':'+(W4.fl|0)+(W4.F&&W4.F.bigf?':b':'')}   // (a big floor is a new floor: what you found on the old one does not carry over to it)
function saveMark(kind,i){try{const o=saveLoad();o.found=o.found||{};const k=saveKey()+':'+kind+i;if(o.found[k])return;o.found[k]=1;if(kind!=='c')o.nfound=(o.nfound|0)+1;localStorage.setItem(SAVEK,JSON.stringify(o))}catch(e){}}
function saveHas(kind,i){try{const o=saveLoad();return !!(o.found&&o.found[saveKey()+':'+kind+i])}catch(e){return false}}
// a floor you have been on before: its doors open, its emptied chests open and empty, its solved puzzle solved, its quest done
function floorRestore(F){if(MP.on&&MP.client)return;(F.doors||[]).forEach(D=>{if(saveHas('d',D.i)){doorOpen(D,true);D.k=1;D.g.visible=false}});
 const S=PZ.st;if(S&&saveHas('p',0)){pzRestore();(F.chests||[]).forEach(c=>{if(c.hidden&&c.src==='puzzle'){c.hidden=false;c.g.visible=true;c.g.position.y=c.top;c.rise=1}})}
 (F.chests||[]).forEach(c=>{if(saveHas('c',c.i)){c.open=true;c.k=1;c.lid.rotation.x=-1.9;c.glow.material.opacity=0}});if(W4.q&&saveHas('q',0)){W4.q.claimed=true;W4.q.done=W4.q.n;W4.q.yelled=1}}
// the room's other players: what floor their own save reached (the host offers to continue from the furthest)
(function(){if(typeof mpPeers!=='function')return;const mp=mpPeers;mpPeers=function(ch){const r=mp(ch);try{(ch.peers||[]).forEach(p=>{const P=MP.players[p.peer];if(P&&p.presence&&p.presence.w4)P.w4b=p.presence.w4.b|0})}catch(e){}return r}})();
// ---------------------------------------------------------------- PUZZLES (the owner, Oct 21 11:59: "puzzles throughout the whole... every few
// floors or even every floor"). Every floor from 3 (but the rest stop, the swarm, Nagrock's floors and the mazes, which are puzzles of their
// own) carries one, chosen from the floor: the VAULT (a dial lock: k_secret.js), the PLATES (step on the start stone: four plates light up
// one by one, with a note each; step on them in the same order; a wrong step and they go dark), the LANTERNS (a ring of five: touching one
// flips it and its two neighbours; light all five), the FOUR KINGS (four stone busts round a gold sun in the floor, each looking the wrong
// way: turning one a quarter turn drags the next one round with it; get all four looking at the sun) or the BRAZIERS (four cold braziers,
// two here and two on landings further off: a lit one burns for a while; get all four burning at once, alone at a run or split up with a
// partner). Solved, a chest rises out of the floor in the middle (the puzzle loot table). The host keeps the puzzle's state; a guest's touch
// goes to the host; the snapshot shows everyone the same lights, the same heads and the same fires.
const PZ={st:null};
function puzzleBuild(F,G){PZ.st=null;const P=F.puz;if(!P||P.t==='lock')return;const sm=stoneMat();const S={t:P.t,solved:false,g:[],t0:0};PZ.st=S;
 const tabletAt=(x,z,lines)=>{const g=new THREE.Group();g.position.set(x,P.top,z);const s=new THREE.Mesh(new THREE.BoxGeometry(3.4,2.4,.35),sm);s.position.y=1.5;g.add(s);const c=cvs(512);c.height=360;const x2=c.getContext('2d');x2.fillStyle='#2a2018';x2.fillRect(0,0,512,360);x2.fillStyle='#ffd27a';x2.textAlign='center';
  x2.font='900 44px Georgia,serif';x2.fillText(lines[0],256,70);x2.font='600 30px system-ui';x2.fillStyle='#f2e2c8';lines.slice(1).forEach((l,i)=>x2.fillText(l,256,130+i*44));const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;
  [1,-1].forEach(sd=>{const f=new THREE.Mesh(new THREE.PlaneGeometry(3.1,2.15),new THREE.MeshBasicMaterial({map:t}));f.position.set(0,1.5,sd*.18);if(sd<0)f.rotation.y=Math.PI;g.add(f)});g.traverse(o=>o.layers.set(1));G.add(g)};
 if(P.t==='plates'){const cols=[0xff5a3a,0x5ac8ff,0x7aff6a,0xffd040];S.cols=cols;S.seq=P.seq;S.i=0;S.phase='idle';S.on=-1;S.pl=[];
  P.plates.forEach((q,i)=>{const g=new THREE.Group();g.position.set(q.x,P.top,q.z);const base=new THREE.Mesh(new THREE.CylinderGeometry(1.6,1.75,.3,24),sm);base.position.y=.15;g.add(base);
   const m=new THREE.MeshStandardMaterial({color:cols[i],emissive:cols[i],emissiveIntensity:.08,roughness:.5,metalness:.2});const top=new THREE.Mesh(new THREE.CylinderGeometry(1.35,1.35,.12,24),m);top.position.y=.34;g.add(top);
   const L=new THREE.PointLight(cols[i],0,14,1.6);L.position.y=1.6;g.add(L);g.traverse(o=>o.layers.set(1));G.add(g);S.pl.push({x:q.x,z:q.z,m,L,k:0})});
  {const q=P.start,g=new THREE.Group();g.position.set(q.x,P.top,q.z);const b=new THREE.Mesh(new THREE.CylinderGeometry(1.3,1.45,.3,20),sm);b.position.y=.15;g.add(b);const m=new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xffe8b0,emissiveIntensity:.6,roughness:.4});
   const top=new THREE.Mesh(new THREE.CylinderGeometry(1.05,1.05,.12,20),m);top.position.y=.34;g.add(top);g.traverse(o=>o.layers.set(1));G.add(g);S.startM=m;S.start=q}
  tabletAt(P.x,P.z+10.5,['THE PLATES','Step on the white stone.','Watch the plates light up,','then step on them in that order.'])}
 else if(P.t==='busts')bustsBuild(P,S,G,sm,tabletAt);
 else if(P.t==='braziers')brazBuild(P,S,G,sm,tabletAt);
 else{S.on=P.on.slice();S.lan=[];const pole=new THREE.MeshStandardMaterial({color:0x2c2622,metalness:.85,roughness:.45});
  P.lan.forEach((q,i)=>{const g=new THREE.Group();g.position.set(q.x,P.top,q.z);const p=new THREE.Mesh(new THREE.CylinderGeometry(.12,.16,3.2,8),pole);p.position.y=1.6;g.add(p);
   const m=new THREE.MeshStandardMaterial({color:0x6a5030,emissive:0xffa030,emissiveIntensity:0,transparent:true,opacity:.9,roughness:.3});const glass=new THREE.Mesh(new THREE.BoxGeometry(.8,1,.8),m);glass.position.y=3.6;g.add(glass);
   const cap=new THREE.Mesh(new THREE.ConeGeometry(.65,.5,4),pole);cap.position.y=4.35;cap.rotation.y=Math.PI/4;g.add(cap);const L=new THREE.PointLight(0xffa040,0,16,1.5);L.position.y=3.6;g.add(L);
   const fl=new THREE.Mesh(new THREE.ConeGeometry(.22,.55,8),new THREE.MeshBasicMaterial({color:0xffc060,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));fl.position.y=3.55;g.add(fl);
   g.traverse(o=>o.layers.set(1));G.add(g);S.lan.push({x:q.x,z:q.z,top:P.top,m,L,fl})});
  const ped=new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.8,.9,16),sm);ped.position.set(P.x,P.top+.45,P.z);ped.layers.set(1);G.add(ped);
  tabletAt(P.x,P.z+9.5,['THE LANTERNS','Light all five.','Touching one flips it','and its two neighbours.'])}}
// ---- the four kings: a stone bust on a plinth (shoulders, a bearded head with a nose you can read the way it looks by, a gold crown with a
// red stone), eyes that burn red while it looks away and gold once it looks at the sun, and then a thin gold gaze down to the sun
const PZM={};
function pzGold(){return PZM.gold||(PZM.gold=new THREE.MeshStandardMaterial({color:0xe8b440,metalness:.9,roughness:.32,emissive:0x3a2400,emissiveIntensity:.4}))}
function pzIron(){return PZM.iron||(PZM.iron=new THREE.MeshStandardMaterial({color:0x2e2a28,metalness:.8,roughness:.5}))}
function sunTex(){if(PZM.sun)return PZM.sun;const c=cvs(512),g=c.getContext('2d');g.fillStyle='#2a2018';g.beginPath();g.arc(256,256,256,0,7);g.fill();g.strokeStyle='#8a6a30';g.lineWidth=10;g.beginPath();g.arc(256,256,238,0,7);g.stroke();
 g.fillStyle='#f0c050';for(let k=0;k<16;k++){const a=k/16*Math.PI*2,r0=118,r1=k%2?196:224;g.beginPath();g.moveTo(256+Math.cos(a-.13)*r0,256+Math.sin(a-.13)*r0);g.lineTo(256+Math.cos(a)*r1,256+Math.sin(a)*r1);g.lineTo(256+Math.cos(a+.13)*r0,256+Math.sin(a+.13)*r0);g.fill()}
 g.beginPath();g.arc(256,256,112,0,7);g.fill();g.fillStyle='#2a2018';g.beginPath();g.ellipse(256,256,58,30,0,0,7);g.fill();g.fillStyle='#f0c050';g.beginPath();g.arc(256,256,22,0,7);g.fill();
 const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return PZM.sun=t}
// one king: plinth, shoulders, a bearded head (its nose shows where it looks), a gold crown with a red stone, eyes that burn red or gold, and
// the thin gold gaze that shows once it looks at the sun (5.5 ahead of the plinth, the eyes 3.1 above the floor)
function bustMake(sm,beamM){const g=new THREE.Group(),gold=pzGold();
 const ped=new THREE.Mesh(new THREE.BoxGeometry(1.5,1.4,1.5),sm);ped.position.y=.7;g.add(ped);const cap=new THREE.Mesh(new THREE.BoxGeometry(1.75,.2,1.75),sm);cap.position.y=1.5;g.add(cap);
 const hd=new THREE.Group();hd.position.y=1.6;g.add(hd);
 const ch=new THREE.Mesh(new THREE.SphereGeometry(.75,20,12),sm);ch.scale.set(1.25,.62,.8);ch.position.y=.42;hd.add(ch);
 const nk=new THREE.Mesh(new THREE.CylinderGeometry(.26,.3,.4,14),sm);nk.position.y=.92;hd.add(nk);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.55,24,16),sm);head.scale.set(.95,1.05,1);head.position.y=1.42;hd.add(head);
 const nose=new THREE.Mesh(new THREE.ConeGeometry(.12,.36,10),sm);nose.rotation.x=Math.PI/2;nose.position.set(0,1.38,.6);hd.add(nose);
 const brd=new THREE.Mesh(new THREE.ConeGeometry(.34,.62,14),sm);brd.rotation.x=Math.PI;brd.position.set(0,1.02,.3);hd.add(brd);
 [-.21,.21].forEach(x=>{const b=new THREE.Mesh(new THREE.BoxGeometry(.2,.05,.08),sm);b.position.set(x,1.58,.47);b.rotation.z=x>0?-.18:.18;hd.add(b)});   // the brows
 const eyeM=new THREE.MeshStandardMaterial({color:0x201010,emissive:0xff3020,emissiveIntensity:.6,roughness:.4});[-.19,.19].forEach(x=>{const e=new THREE.Mesh(new THREE.SphereGeometry(.085,10,8),eyeM);e.position.set(x,1.5,.49);hd.add(e)});
 const cr=new THREE.Mesh(new THREE.CylinderGeometry(.47,.51,.26,18),gold);cr.position.y=1.9;hd.add(cr);for(let k=0;k<6;k++){const a=k/6*Math.PI*2,sp=new THREE.Mesh(new THREE.ConeGeometry(.085,.26,8),gold);sp.position.set(Math.sin(a)*.44,2.15,Math.cos(a)*.44);hd.add(sp);const b=new THREE.Mesh(new THREE.SphereGeometry(.04,8,6),gold);b.position.set(Math.sin(a)*.44,2.3,Math.cos(a)*.44);hd.add(b)}
 const gem=new THREE.Mesh(new THREE.SphereGeometry(.08,10,8),new THREE.MeshStandardMaterial({color:0xc01020,emissive:0x600008,emissiveIntensity:.8,roughness:.2,metalness:.3}));gem.position.set(0,1.9,.5);hd.add(gem);
 const ey=1.6+1.5,run=5.5-.55,L=Math.hypot(run,ey);const beam=new THREE.Mesh(new THREE.CylinderGeometry(.05,.12,L,8,1,true),(beamM||new THREE.MeshBasicMaterial({color:0xffd060,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false})).clone());
 beam.position.set(0,1.5-ey/2,.55+run/2);beam.rotation.x=-Math.atan2(run,ey);beam.userData.noUber=1;beam.visible=false;hd.add(beam);return {g,hd,eyeM,beam}}
function bustsBuild(P,S,G,sm,tabletAt){S.r=P.busts.map(b=>b.r);S.tgt=S.r.slice();S.ang=S.r.slice();S.bu=[];const grp=new THREE.Group();
 const sunM=new THREE.MeshStandardMaterial({map:sunTex(),emissiveMap:sunTex(),emissive:0xffc860,emissiveIntensity:.15,roughness:.6,metalness:.3});const sun=new THREE.Mesh(new THREE.CircleGeometry(2.1,40),sunM);sun.rotation.x=-Math.PI/2;sun.position.set(P.x,P.top+.04,P.z);sun.userData.noUber=1;grp.add(sun);S.sunM=sunM;
 const beamM=new THREE.MeshBasicMaterial({color:0xffd060,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
 P.busts.forEach((b,i)=>{const B=bustMake(sm,beamM);B.g.position.set(b.x,P.top,b.z);B.hd.rotation.y=b.face+S.ang[i]*Math.PI/2;grp.add(B.g);S.bu.push({x:b.x,z:b.z,top:P.top,face:b.face,hd:B.hd,eyeM:B.eyeM,beam:B.beam,k:0})});
 grp.traverse(o=>o.layers.set(1));G.add(grp);try{if(typeof uberMerge==='function')uberMerge(grp,{tag:'pz:busts'})}catch(e){console.warn('busts pack',e)}
 tabletAt(P.x,P.z+9.5,['THE FOUR KINGS','Turn them till all four','look at the sun.','Turning one turns its neighbour.'])}
// one brazier: an iron stand and bowl with a bronze rim, coals that glow while it burns, a three-tongued fire and its light; a ring of embers on
// the rim counts the seconds left
function brazierMake(){const g=new THREE.Group(),iron=pzIron(),gold=pzGold();const fm=c=>new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.85,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
 const base=new THREE.Mesh(new THREE.CylinderGeometry(.75,.9,.25,16),iron);base.position.y=.125;g.add(base);[0,1,2].forEach(k=>{const a=k/3*Math.PI*2,f=new THREE.Mesh(new THREE.ConeGeometry(.1,.5,8),iron);f.position.set(Math.sin(a)*.62,.3,Math.cos(a)*.62);f.rotation.set(Math.cos(a)*.5,0,-Math.sin(a)*.5);g.add(f)});
 const col=new THREE.Mesh(new THREE.CylinderGeometry(.16,.26,1.5,12),iron);col.position.y=1;g.add(col);const kn=new THREE.Mesh(new THREE.SphereGeometry(.24,14,10),gold);kn.position.y=1.1;g.add(kn);
 const bowl=new THREE.Mesh(new THREE.CylinderGeometry(.95,.42,.55,20),iron);bowl.position.y=1.95;g.add(bowl);const rim=new THREE.Mesh(new THREE.TorusGeometry(.95,.07,8,28),gold);rim.rotation.x=Math.PI/2;rim.position.y=2.22;g.add(rim);
 const coalM=new THREE.MeshStandardMaterial({color:0x1c1410,emissive:0xff5a10,emissiveIntensity:0,roughness:.9});const coal=new THREE.Mesh(new THREE.CylinderGeometry(.84,.84,.1,20),coalM);coal.position.y=2.17;g.add(coal);
 for(let k=0;k<7;k++){const a=k*2.4,r=k?.45:0,lump=new THREE.Mesh(new THREE.DodecahedronGeometry(.16,0),coalM);lump.position.set(Math.sin(a)*r,2.25,Math.cos(a)*r);lump.rotation.set(k,k*2,0);g.add(lump)}
 const fl=new THREE.Group();fl.position.y=2.2;const f1=new THREE.Mesh(new THREE.ConeGeometry(.58,1.6,12),fm(0xff7a20));f1.position.y=.8;fl.add(f1);const f2=new THREE.Mesh(new THREE.ConeGeometry(.32,1.05,10),fm(0xffd060));f2.position.y=.52;fl.add(f2);
 const f3=new THREE.Mesh(new THREE.ConeGeometry(.3,.9,8),fm(0xff9a30));f3.position.set(.28,.45,.1);f3.rotation.z=-.3;fl.add(f3);const f4=new THREE.Mesh(new THREE.ConeGeometry(.26,.8,8),fm(0xff6a10));f4.position.set(-.26,.4,-.12);f4.rotation.z=.32;fl.add(f4);fl.visible=false;g.add(fl);
 const L=new THREE.PointLight(0xff8a30,0,18,1.6);L.position.y=3;g.add(L);
 const em=new THREE.InstancedMesh(new THREE.SphereGeometry(.07,6,4),new THREE.MeshBasicMaterial({color:0xffb040,toneMapped:false}),12);const M4=new THREE.Matrix4();for(let k=0;k<12;k++){const a=k/12*Math.PI*2;M4.makeTranslation(Math.sin(a)*.95,2.3,Math.cos(a)*.95);em.setMatrixAt(k,M4)}em.count=0;g.add(em);
 return {g,fl,L,coalM,em}}
function brazBuild(P,S,G,sm,tabletAt){S.till=P.braz.map(()=>0);S.bz=[];S.dur=P.dur;
 P.braz.forEach((q,i)=>{const B=brazierMake();B.g.position.set(q.x,q.top,q.z);B.g.traverse(o=>o.layers.set(1));G.add(B.g);S.bz.push({x:q.x,z:q.z,top:q.top,g:B.g,fl:B.fl,L:B.L,coalM:B.coalM,em:B.em,k:0})});
 tabletAt(P.x,P.z-9.5,['THE BRAZIERS','Light all four at once.','A fire burns '+P.dur+' seconds:','two here, two further on.'])}
// the host: who stands where (you and everyone else), the plates' show and their order, the lanterns' state, the heads turning, the fires
function puzzleTick(t,dt){const S=PZ.st,F=W4.F;if(!S||!F||!F.puz)return;
 if(S.t==='plates'){S.pl.forEach((q,i)=>{const want=S.lit===i||S.on===i||S.solved?1:0;q.k+=(want-q.k)*Math.min(1,dt*10);q.m.emissiveIntensity=.08+q.k*1.6;q.L.intensity=q.k*2.4});if(S.startM)S.startM.emissiveIntensity=S.phase==='idle'&&!S.solved?.4+Math.sin(t*3)*.3:.1;
  if(MP.client||S.solved)return;const feet=[[heroPos.x,heroPos.z,deadT<=0]];for(const id in MP.players){const q=MP.players[id].st;if(q&&!q.dead)feet.push([q.x,q.z,true])}
  const on=i=>feet.some(([x,z,a])=>a&&Math.hypot(x-S.pl[i].x,z-S.pl[i].z)<1.5),onStart=feet.some(([x,z,a])=>a&&Math.hypot(x-S.start.x,z-S.start.z)<1.3);
  if(S.phase==='idle'){if(onStart&&!S.wasStart){S.phase='show';S.t0=t;S.i=0;S.lit=-1;pzSync()}}
  else if(S.phase==='show'){const k=Math.floor((t-S.t0-.6)/.8);const lit=k>=0&&k<S.seq.length&&(t-S.t0-.6-k*.8)<.55?S.seq[k]:-1;if(lit!==S.lit){S.lit=lit;if(lit>=0)pzNote(lit);pzSync()}if(k>=S.seq.length){S.phase='input';S.lit=-1;S.i=0;S.prev=[0,1,2,3].map(on);pzSync()}}
  else if(S.phase==='input'){for(let i=0;i<4;i++){const now=on(i);if(now&&!S.prev[i]){if(S.seq[S.i]===i){S.i++;S.on=i;pzNote(i);setTimeout(()=>{if(S.on===i)S.on=-1},500);if(S.i>=S.seq.length){pzSolve();break}}else{S.phase='idle';S.on=-1;pzBuzz();pzSync();break}pzSync()}S.prev[i]=now}}
  S.wasStart=onStart}
 else if(S.t==='busts'){if(S.sunM)S.sunM.emissiveIntensity=S.solved?.9+Math.sin(t*2.5)*.25:.15;
  S.bu.forEach((q,i)=>{const d=S.tgt[i]-S.ang[i];S.ang[i]+=Math.sign(d)*Math.min(Math.abs(d),dt*2.4);q.hd.rotation.y=q.face+S.ang[i]*Math.PI/2;
   const look=S.r[i]===0&&Math.abs(S.tgt[i]-S.ang[i])<.04?1:0;q.k+=(look-q.k)*Math.min(1,dt*6);q.eyeM.emissive.setRGB(1,.19+q.k*.6,.12-q.k*.06);q.eyeM.emissiveIntensity=.6+q.k*2.2;
   q.beam.material.opacity=q.k*(S.solved?.55:.35)*(.85+Math.sin(t*6+i)*.15);q.beam.visible=q.k>.03})}
 else if(S.t==='braziers'){const host=!MP.client;S.bz.forEach((q,i)=>{const till=S.till[i];let left=till===Infinity?S.dur:till>t?till-t:0;
   if(host&&till&&till!==Infinity&&t>=till&&!S.solved){S.till[i]=0;left=0;brazOut(q)}
   const f=left>0?Math.min(1,left/S.dur):0,sput=left>0&&left<4&&till!==Infinity?(Math.sin(t*31+i*7)>.2?1:.35):1,want=left>0?1:0;q.k+=(want-q.k)*Math.min(1,dt*7);
   const s=(.45+.55*f)*q.k*sput;q.fl.visible=s>.04;if(q.fl.visible){q.fl.scale.set(.85+s*.2,s*(1+Math.sin(t*13+i*3)*.12),.85+s*.2);q.fl.rotation.y=t*1.7+i}
   q.L.intensity=2.6*s;q.coalM.emissiveIntensity=q.k*(.6+f*1.4);q.em.count=left>0?Math.max(1,Math.ceil(f*12)):0})}
 else{S.lan.forEach((q,i)=>{const v=S.on[i]?1:0;q.k=(q.k||0)+(v-(q.k||0))*Math.min(1,dt*8);q.m.emissiveIntensity=q.k*2.2;q.L.intensity=q.k*2;q.fl.visible=q.k>.3;q.fl.scale.set(1,1+Math.sin(t*12+i)*.15,1)})}}
// what you can touch from where you stand (and how near: on the same level, a couple of steps off)
function pzNear(){const S=PZ.st;if(!S||S.solved)return null;const arr=S.t==='lanterns'?S.lan:S.t==='busts'?S.bu:S.t==='braziers'?S.bz:null;if(!arr)return null;let best=-1,bd=S.t==='busts'?2.7:2.8;
 const hy=typeof hero!=='undefined'&&hero?hero.position.y:0;arr.forEach((q,i)=>{const d=Math.hypot(heroPos.x-q.x,heroPos.z-q.z);if(d<bd&&Math.abs(hy-(q.top==null?hy:q.top))<4){bd=d;best=i}});if(best<0)return null;
 return {i:best,label:S.t==='lanterns'?'Touch the lantern':S.t==='busts'?'Turn the king\'s bust':(S.till[best]>clk.getElapsedTime()?'Stoke the brazier':'Light the brazier')}}
function pzTouch(i){const S=PZ.st;if(!S||S.solved||i<0)return;if(S.t==='lanterns')lanternTouch(i);else if(S.t==='busts')bustTurn(i);else if(S.t==='braziers')brazLight(i)}
function lanternNear(){const S=PZ.st;if(!S||S.t!=='lanterns'||S.solved)return -1;let best=-1,bd=2.8;S.lan.forEach((q,i)=>{const d=Math.hypot(heroPos.x-q.x,heroPos.z-q.z);if(d<bd){bd=d;best=i}});return best}
function lanternTouch(i){const S=PZ.st;if(!S||S.solved||i<0)return;if(MP.on&&MP.client){mpQueue({k:'w4lt',i});return}const N=S.on.length;[i,(i+1)%N,(i+N-1)%N].forEach(j=>{S.on[j]^=1});pzNote(i%4);if(S.on.every(v=>v))pzSolve();else pzSync()}
// a quarter turn (and the next one round with it): stone grinding on stone
function bustTurn(i){const S=PZ.st;if(!S||S.t!=='busts'||S.solved||i<0||i>3)return;if(MP.on&&MP.client){mpQueue({k:'w4bu',i});return}
 [i,(i+1)%4].forEach(j=>{S.r[j]=(S.r[j]+3)%4;S.tgt[j]-=1});pzGrind(S.bu[i].x,S.bu[i].z);if(S.r.every(v=>v===0))setTimeout(()=>{if(PZ.st===S)pzSolve()},450);else pzSync()}
// light (or stoke) a brazier: it burns its full time from now; all four burning: solved, and they burn on for good
function brazLight(i){const S=PZ.st;if(!S||S.t!=='braziers'||S.solved||i<0||i>=S.till.length)return;if(MP.on&&MP.client){mpQueue({k:'w4bz',i});return}
 const t=clk.getElapsedTime(),was=S.till[i]>t;S.till[i]=t+S.dur;brazUp(S.bz[i],was);const n=S.till.filter(v=>v>t).length;
 if(n>=S.till.length){S.till=S.till.map(()=>Infinity);pzSolve()}else{if(!was)toast('🔥 '+n+' of '+S.till.length+' braziers burning');pzSync()}}
function brazUp(q,stoke){try{whoosh(q.x,q.z,stoke?.25:.4,stoke?.3:.45,stoke?600:250,stoke?1600:1400);burstFx(q.x,q.top+2.6,q.z,0xffa030,stoke?4:9,3.5)}catch(e){}}
function brazOut(q){try{whoosh(q.x,q.z,.18,.7,2400,300);smokeFx(q.x,q.top+2.8,q.z,4,true)}catch(e){}}
function pzSolve(){const S=PZ.st;if(!S||S.solved)return;S.solved=true;S.lit=-1;S.on=S.t==='plates'?-1:S.on;pzSync();puzzleSolved(S.t)}
// solved: on every screen the chest rises and the floor says so
function puzzleSolved(t){try{bossYell('PUZZLE SOLVED',t==='lock'?'The vault is open.':t==='busts'?'The four kings look at the sun...':t==='braziers'?'All four fires burn...':'Something rises out of the floor...');dblChing(heroPos.x,heroPos.z,.7,1.4,5)}catch(e){}if(t!=='lock')try{chestReveal('puzzle')}catch(e){}try{saveMark('p',0)}catch(e){}}
// the notes the plates and lanterns play (C, E, G, high C)
function pzNote(i){try{const ac=audioCtx();if(!ac)return;const T=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();o.type='triangle';o.frequency.value=[523,659,784,1047][i%4];g.gain.setValueAtTime(.0001,T);g.gain.exponentialRampToValueAtTime(.18,T+.02);g.gain.exponentialRampToValueAtTime(.0001,T+.5);o.connect(g);g.connect(ac.destination);o.start(T);o.stop(T+.55)}catch(e){}}
function pzBuzz(){try{shake=Math.max(shake,.15);const ac=audioCtx();if(!ac)return;const T=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();o.type='sawtooth';o.frequency.value=90;g.gain.setValueAtTime(.12,T);g.gain.exponentialRampToValueAtTime(.0001,T+.4);o.connect(g);g.connect(ac.destination);o.start(T);o.stop(T+.45);toast('Wrong plate. Step on the white stone to see them again.')}catch(e){}}
// stone on stone: low filtered noise with a slow judder, half a second
function pzGrind(x,z){try{const ac=audioCtx();if(!ac)return;const d=Math.hypot(x-heroPos.x,z-heroPos.z),k=(d<10?1:Math.max(0,1-(d-10)/40))*.35;if(k<.03)return;const T=ac.currentTime,n=Math.floor(ac.sampleRate*.5),b=ac.createBuffer(1,n,ac.sampleRate),a=b.getChannelData(0);
 for(let i=0;i<n;i++){const u=i/n;a[i]=(Math.random()*2-1)*(.55+.45*Math.sin(u*Math.PI*14))*Math.sin(Math.PI*Math.min(1,u*1.15))}const s=ac.createBufferSource();s.buffer=b;const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=380;f.Q.value=2.5;const g=ac.createGain();g.gain.value=k;
 s.connect(f);f.connect(g);g.connect(ac.destination);s.start(T)}catch(e){}}
// the snapshot: [kind, solved, phase, lit, step, state] (state: the lanterns' lights, the kings' quarter turns, the fires' seconds left)
function pzSync(){}
function pzSnap(){const S=PZ.st;if(!S)return 0;const kd={plates:1,lanterns:2,busts:3,braziers:4}[S.t]||0,t=clk.getElapsedTime();
 const st=S.t==='lanterns'?S.on.join(''):S.t==='busts'?S.r.join(''):S.t==='braziers'?S.till.map(v=>v===Infinity?'x':v>t?(v-t).toFixed(1):'0').join(','):'';
 return [kd,S.solved?1:0,['idle','show','input'].indexOf(S.phase||'idle'),S.lit==null?-1:S.lit,S.t==='plates'?S.on:-1,st]}
function pzApply(a){const S=PZ.st;if(!S||!Array.isArray(a))return;
 if(S.t==='plates'){const lit=a[3]|0;if(lit!==S.lit&&lit>=0)pzNote(lit);S.lit=lit;S.phase=['idle','show','input'][a[2]|0]||'idle';const on=a[4]|0;if(on!==S.on&&on>=0)pzNote(on);S.on=on}
 else if(S.t==='lanterns'){if(typeof a[5]==='string'&&a[5].length===S.on.length)S.on=a[5].split('').map(Number)}
 else if(S.t==='busts'){if(typeof a[5]==='string'&&a[5].length===4){let moved=-1;a[5].split('').map(Number).forEach((v,i)=>{const d=((v-S.r[i])%4+4)%4;if(d){S.tgt[i]+=d===3?-1:d===1?1:-2;S.r[i]=v;if(moved<0)moved=i}});if(moved>=0)pzGrind(S.bu[moved].x,S.bu[moved].z)}}
 else if(S.t==='braziers'){if(typeof a[5]==='string'){const t=clk.getElapsedTime(),v=a[5].split(',');if(v.length===S.till.length)v.forEach((s,i)=>{const was=S.till[i]===Infinity||S.till[i]>t;if(s==='x'){S.till[i]=Infinity;return}const left=+s||0;
   if(left>0){const nt=t+left;if(!was)brazUp(S.bz[i],false);else if(nt>S.till[i]+1.5)brazUp(S.bz[i],true);S.till[i]=nt}else{if(was)brazOut(S.bz[i]);S.till[i]=0}})}}
 if(a[1]&&!S.solved){S.solved=true;if(S.t==='busts')S.r=[0,0,0,0];if(S.t==='braziers')S.till=S.till.map(()=>Infinity);puzzleSolved(S.t)}}
// a floor you come back to with the puzzle solved in your save
function pzRestore(){const S=PZ.st;if(!S)return;S.solved=true;S.lit=-1;if(S.t==='plates')S.on=-1;else if(S.t==='lanterns')S.on=S.on.map(()=>1);else if(S.t==='busts'){S.r=[0,0,0,0];S.tgt=[0,0,0,0];S.ang=[0,0,0,0]}else if(S.t==='braziers')S.till=S.till.map(()=>Infinity)}
// ---------------------------------------------------------------- THE WIDE FLOORS (the owner, Oct 21 13:02: "If there are any huge levels make a
// mount u can ride or a vehicle or both. With huge levels don't make them to empty"). Five floors are wide open: one great plain three
// hundred paces across, nine districts of a hundred paces each, the guardian's gate at the far end. You can walk it, but the Brigade Motor
// Pool by the door lends you a swamp gator (saddled) or a gold lowrider (hydraulics); l_ride.js rides them. Every district has its own
// business: Market Row (stalls, people, a coin trail, a pickpocket gang), the Ruins (broken walls, a camp, a sealed vault behind loose
// bricks), the Gardens (hedges, trees, the floor's puzzle), the Lowrider Loop (a race round the island: beat the clock for a chest), the
// Quarry (a sunken pit, mesas, a camp at the bottom), Camp Town (tents, a fire, the biggest camp), the Arena (a ring wall, a crowd, a chest
// in the middle) and Lookout Mesa (a spiral ramp to a secret chest at the top). Everything comes from the floor number and the seed.
const WIDE=[25,42,64,78,94];
function wideOf(n){return WIDE.includes(n)}
const WIDENAME={25:'The Wide Open',42:'Eastside Plains',64:'The Big Backyard',78:'Lowrider Country',94:'The Last Wide Open'};
Object.assign(FLOOR_NAMES2,WIDENAME);
const WDW=100,WDD=96,WDX=[X0-150,X0-50,X0+50],WDZ=[0,-96,-192],WDK=[['market','motor','ruins'],['garden','loop','quarry'],['camp','arena','mesa']];
function wideFloor(n,seed,SP,th){const rnd=srand((seed|0)*7919+n*104729+77),rf=(a,b)=>a+rnd()*(b-a),ri=(a,b)=>a+Math.floor(rnd()*(b-a+1));
 const P=[],G=[];const add=(x0,x1,z0,z1,top,kind,o)=>{const p=Object.assign({x0,x1,z0,z1,top,kind,i:P.length},o||{});P.push(p);return p};
 const kinds=SP&&SP.kinds?SP.kinds:floorKinds(n),up=n>60?1:0;
 const entry=add(X0-20,X0+20,0,26,BASEH,'entry',{cp:true});
 const D={};for(let j=0;j<3;j++)for(let i=0;i<3;i++){const k=WDK[j][i];D[k]=add(WDX[i],WDX[i]+WDW,WDZ[j]-WDD,WDZ[j],k==='quarry'?BASEH-6:BASEH,'plaza',{cp:true,wide:k,blocks:[],nopuz:k!=='garden'})}
 const blk=(p,x0,x1,z0,z1,h,o)=>{const b=Object.assign({x0:Math.min(x0,x1),x1:Math.max(x0,x1),z0:Math.min(z0,z1),z1:Math.max(z0,z1),top:p.top+h},o||{});p.blocks.push(b);return b};
 const C=p=>[(p.x0+p.x1)/2,(p.z0+p.z1)/2];const camp=(p,x,z,r,k)=>G.push({pi:p.i,n:k+up,kinds,cx:x,cz:z,r});
 const props=[],coins=[],chests=[],stations=[];const prop=(k,x,z,o)=>props.push(Object.assign({k,x,z},o||{}));
 // ---- a low wall round the edge of the plain (a jump clears it; nobody rolls off by accident), gaps for the way in and the way out
 const edge=(p,side,gap)=>{const T=1.2,h=2.2;const seg=(a,b)=>{if(b-a<.5)return;if(side==='w')blk(p,p.x0,p.x0+T,a,b,h);else if(side==='e')blk(p,p.x1-T,p.x1,a,b,h);else if(side==='n')blk(p,a,b,p.z1-T,p.z1,h);else blk(p,a,b,p.z0,p.z0+T,h)};
  const lo=side==='w'||side==='e'?p.z0:p.x0,hi=side==='w'||side==='e'?p.z1:p.x1;if(gap){seg(lo,gap[0]);seg(gap[1],hi)}else seg(lo,hi)};
 ['market','garden','camp'].forEach(k=>edge(D[k],'w'));['ruins','quarry','mesa'].forEach(k=>edge(D[k],'e'));edge(D.market,'n');edge(D.ruins,'n');edge(D.motor,'n',[X0-20,X0+20]);
 edge(D.camp,'s');edge(D.mesa,'s');edge(D.arena,'s',[X0-12,X0+12]);
 // ---- the Brigade Motor Pool: the stable (a fenced pen, the gator in it) west of the door, the garage (and the lowrider out front) east,
 // a fountain in the middle, signposts to everywhere
 {const p=D.motor,[cx,cz]=C(p);const sx=cx-28,sz=cz+22;const T=.5,h=1.3;blk(p,sx-9,sx+9,sz+7,sz+7+T,h);blk(p,sx-9,sx+9,sz-7-T,sz-7,h);blk(p,sx-9-T,sx-9,sz-7,sz+7,h);blk(p,sx+9,sx+9+T,sz-7,sz-2,h);blk(p,sx+9,sx+9+T,sz+2,sz+7,h);
  prop('stable',sx,sz);stations.push({k:'gator',x:sx+3,z:sz,ix:sx+11,iz:sz,face:Math.PI/2});
  const gx=cx+30,gz=cz+24;blk(p,gx-9,gx+9,gz-6,gz+6,7.5,{prop:1});prop('garage',gx,gz);stations.push({k:'car',x:gx-15,z:gz-2,ix:gx-15,iz:gz+2.6,face:-Math.PI/2});
  // the coop (a little white chapel of a henhouse) where Deacon Drumstick waits, south-east of the fountain
  const kx=cx+28,kz=cz-30;blk(p,kx-3.2,kx+3.2,kz-2.6,kz+2.6,4.4,{prop:1});prop('coop',kx,kz);stations.push({k:'drum',x:kx-8,z:kz,ix:kx-8,iz:kz+3.4,face:-Math.PI/2});
  blk(p,cx-4.5,cx+4.5,cz-14.5,cz-5.5,1.1);prop('fountain',cx,cz-10);prop('sign',cx+8,cz+30,{txt:['BRIGADE MOTOR POOL','Gator west · lowrider east · the Deacon by the coop','Walk up to one and press F']});
  prop('post',cx-12,cz-30,{to:['◀ MARKET ROW','▼ THE LOOP','▶ THE RUINS']});prop('lamp',cx-20,cz+4);prop('lamp',cx+20,cz+4);prop('lamp',cx-20,cz-36);prop('lamp',cx+20,cz-36)}
 // ---- Market Row: a lane of stalls, a coin trail down the middle, a pickpocket gang at the far end, a chest past them
 {const p=D.market,[cx,cz]=C(p);for(let k=0;k<5;k++){const x=p.x1-14-k*17;[1,-1].forEach(s=>{const z=cz+s*11;blk(p,x-4,x+4,z-1,z+1,1.15);prop('stall',x,z,{face:s>0?Math.PI:0,c:(k+(s>0?0:2))%4})})}
  for(let k=0;k<14;k++)coins.push([p.x1-8-k*6,cz+Math.sin(k*.9)*2.2,3+((k*7)%4)]);camp(p,p.x0+18,cz,8,4);chests.push({x:p.x0+8,z:cz,top:p.top,src:'chest',rot:-Math.PI/2});
  prop('crates',p.x0+14,cz+16);prop('crates',p.x1-30,cz-20);prop('lamp',cx,cz+18);prop('lamp',cx,cz-18);prop('sign',p.x1-8,cz+20,{txt:['MARKET ROW','Everything must go','(mind your pockets)']})}
 // ---- the Ruins: broken walls (low enough to climb, most of them), a camp among them, a sealed vault with loose bricks in its door
 {const p=D.ruins,[cx,cz]=C(p);for(let k=0;k<12;k++){const x=rf(p.x0+10,p.x1-26),z=rf(p.z0+8,p.z1-10),L=rf(6,15),h=[2.6,3.8,5.2,7,9][ri(0,4)];if(Math.hypot(x-(p.x1-16),z-(p.z0+16))<20)continue;if(rnd()<.5)blk(p,x,x+L,z,z+1.3,h);else blk(p,x,x+1.3,z,z+L,h)}
  const vx=p.x1-16,vz=p.z0+16,wt=1.2,top=27;const w=(x0,x1,z0,z1,o)=>blk(p,x0,x1,z0,z1,top,Object.assign({wall:1,keep:1},o||{}));w(vx-6,vx+6,vz-6,vz-6+wt);w(vx-6,vx-6+wt,vz-6,vz+6);w(vx+6-wt,vx+6,vz-6,vz+6);w(vx-6,vx-2,vz+6-wt,vz+6);w(vx+2,vx+6,vz+6-wt,vz+6);
  w(vx-2,vx+2,vz+6-wt,vz+6,{sdoor:1,face:0});p.sealedR=[vx,vz,6];p.xchest={x:vx,z:vz-1.5,src:'secret'};camp(p,cx-6,cz+6,12,6);prop('rubble',cx+10,cz-14);prop('rubble',cx-22,cz+18);prop('torchpost',vx-9,vz+9);prop('torchpost',vx+9,vz+9)}
 // ---- the Gardens: hedge rows, trees, flower beds, the floor's puzzle on the open lawn
 {const p=D.garden,[cx,cz]=C(p);const hx=p.x0+6;for(let k=0;k<5;k++){const z=p.z1-8-k*7,gap=rf(.25,.75),L=38;const g0=hx+L*gap-3,g1=g0+6;blk(p,hx,g0,z-.7,z+.7,3.1,{hedge:1});blk(p,g1,hx+L,z-.7,z+.7,3.1,{hedge:1})}
  for(let k=0;k<16;k++){const x=rf(p.x0+6,p.x1-6),z=rf(p.z0+6,p.z0+40);if(x>cx-22&&x<cx+22&&z>cz-22)continue;prop('tree',x,z,{s:rf(.8,1.3)})}for(let k=0;k<6;k++)prop('flowers',rf(p.x0+48,p.x1-8),rf(p.z1-36,p.z1-6));
  camp(p,p.x0+20,p.z0+14,8,4);chests.push({x:p.x0+10,z:p.z1-24,top:p.top,src:'chest',rot:Math.PI/2})}
 // ---- the Lowrider Loop: the island in the middle (a statue of the Dabloon on his best day), the track round it, four arches to ride through
 {const p=D.loop,[cx,cz]=C(p);blk(p,cx-17,cx+17,cz-15,cz+15,1.6);prop('statue',cx,cz,{top:p.top+1.6});const R1=[[cx,cz+36,0],[cx+36,cz,Math.PI/2],[cx,cz-36,0],[cx-36,cz,Math.PI/2]];
  R1.forEach((a,i)=>prop('arch',a[0],a[1],{face:a[2],i}));prop('sign',cx-26,p.z1-6,{txt:['THE LOWRIDER LOOP','Through the four arches,','start to finish. Beat the clock.']});F_RACE.set(n,{gates:R1.map(a=>({x:a[0],z:a[1],face:a[2]})),par:[34,46,64]});
  for(let k=0;k<10;k++){const a=k/10*Math.PI*2;prop('cone',cx+Math.cos(a)*21,cz+Math.sin(a)*19)}}
 // ---- the Quarry: a pit six paces down. A stair of ten steps climbs out west (to the Loop) and another south (towards the Mesa and the gate);
 // rock mesas stand in it, a camp at the bottom, a chest on the tallest mesa with a ladder of boulders up its side
 {const p=D.quarry,[cx,cz]=C(p);const R=.6,N=10,run=1.6;
  for(let s=1;s<=N;s++){const a=p.x0+(N-s)*run;blk(p,a,a+run,cz-6,cz+6,s*R,{rock:1,stair:1})}
  for(let s=1;s<=N;s++){const a=p.z0+(N-s)*run;blk(p,cx+18,cx+30,a,a+run,s*R,{rock:1,stair:1})}
  const mesas=[[cx+8,cz-16,9,8,7.5],[cx-14,cz+14,7,7,5],[cx+24,cz+20,6,9,4],[cx-26,cz-24,8,6,6.2]];mesas.forEach(([x,z,w,d,h])=>blk(p,x-w/2,x+w/2,z-d/2,z+d/2,h,{rock:1,climb:h>7?1:0}));
  // the boulders up the tall one (it stands x+3.5..+12.5, z-20..-12, 7.5 up): five of them, each 1.25 above the last, up its west face and
  // round onto its north side, each overlapping the last so there is no gap to drop through; from the fifth it is 1.25 to the top
  [[.3,3.5,-22,-18.8],[.3,3.5,-19,-15.8],[.3,3.5,-16,-12.8],[.3,3.5,-13,-9.6],[3.3,6.5,-12.2,-9]].forEach(([a,b,c,d],i)=>blk(p,cx+a,cx+b,cz+c,cz+d,1.25*(i+1),{rock:1,boulder:1}));
  chests.push({x:cx+8,z:cz-16,top:p.top+7.5,src:'chest',rot:0});camp(p,cx-4,cz,14,7);for(let k=0;k<8;k++)coins.push([cx-30+k*7,cz+30,4]);prop('crane',p.x1-14,p.z0+14);
  prop('sign',p.x0+20,cz+10,{txt:['THE QUARRY','Stairs west and south.','Mind the drop.']})}
 // ---- Camp Town: tents round a fire, a palisade on two sides, the biggest camp, the chief's chest in his tent
 {const p=D.camp,[cx,cz]=C(p);blk(p,p.x0+6,p.x1-6,p.z1-8,p.z1-6.8,4.2,{fence:1});blk(p,p.x1-8,p.x1-6.8,p.z0+20,p.z1-8,4.2,{fence:1});
  for(let k=0;k<7;k++){const a=k/7*Math.PI*2+.3;prop('tent',cx+Math.cos(a)*24,cz+Math.sin(a)*20,{face:-a+Math.PI/2,big:k===0})}prop('campfire',cx,cz);camp(p,cx,cz,18,8);
  const a0=.3;chests.push({x:cx+Math.cos(a0)*24,z:cz+Math.sin(a0)*20,top:p.top,src:'chest',rot:-a0+Math.PI/2})}
 // ---- the Arena: an eight-sided wall with a gate north and south (the way to the guardian), stands outside, a crowd inside, a chest in the middle
 {const p=D.arena,[cx,cz]=C(p);const R=30,wt=1.4,h=8;for(let k=0;k<8;k++){const a0=k/8*Math.PI*2+Math.PI/8,a1=(k+1)/8*Math.PI*2+Math.PI/8;const am=(a0+a1)/2;if(Math.abs(Math.sin(am))>.9)continue;   // (the north and south sides are the gates)
   const x0=cx+Math.cos(a0)*R,z0=cz+Math.sin(a0)*R,x1=cx+Math.cos(a1)*R,z1=cz+Math.sin(a1)*R;const steps=8;for(let s=0;s<steps;s++){const x=x0+(x1-x0)*(s+.5)/steps,z=z0+(z1-z0)*(s+.5)/steps;blk(p,x-wt,x+wt,z-wt,z+wt,h,{arena:1})}}
  for(let s=0;s<3;s++){blk(p,cx-R-6-s*2.4,cx-R-3.6-s*2.4,cz-14,cz+14,1.2*(s+1));blk(p,cx+R+3.6+s*2.4,cx+R+6+s*2.4,cz-14,cz+14,1.2*(s+1))}
  camp(p,cx,cz,16,8);chests.push({x:cx,z:cz,top:p.top,src:'chest',rot:0});prop('banner',cx-R,cz-16);prop('banner',cx+R,cz-16);prop('banner',cx-R,cz+16);prop('banner',cx+R,cz+16)}
 // ---- Lookout Mesa: a tall mesa with a stair cut round its outside, a secret chest on top, coins up the stair, a camp at its foot.
 // The stair goes once round, anticlockwise from the south-east corner: up the east face, along the north, down the west, along the south.
 // Each face is six steps (its far corner is the last of them), each step 0.6 up; the twenty-third stands 0.6 under the top.
 {const p=D.mesa,[cx,cz]=C(p);const mh=14.4,half=13,W=4.2,R=.6,NS=6,L=2*half+W,sl=L/NS;blk(p,cx-half,cx+half,cz-half,cz+half,mh,{rock:1,mesa:1});
  const stair=[];let k=0;
  for(let f=0;f<4;f++)for(let s=0;s<NS;s++){k++;const h=k*R;if(h>mh-R+1e-6)break;let x0,x1,z0,z1;
   if(f===0){x0=cx+half;x1=x0+W;z0=cz-half+s*sl;z1=z0+sl}else if(f===1){z0=cz+half;z1=z0+W;x1=cx+half-s*sl;x0=x1-sl}
   else if(f===2){x0=cx-half-W;x1=cx-half;z1=cz+half-s*sl;z0=z1-sl}else{z0=cz-half-W;z1=cz-half;x0=cx-half+s*sl;x1=x0+sl}
   blk(p,x0,x1,z0,z1,h,{rock:1,stair:1,stepK:k});stair.push([(x0+x1)/2,(z0+z1)/2,h])}
  stair.forEach(([x,z,h],i)=>{if(i%3===1)coins.push([x,z,2+(i>15?2:0)])});
  p.xchests=[{x:cx,z:cz,top:p.top+mh,src:'secret'}];camp(p,p.x0+18,p.z1-18,9,5);prop('flag',cx+half-2,cz-half+2,{top:p.top+mh});prop('telescope',cx-half+3,cz+half-3,{top:p.top+mh});
  prop('sign',cx+half+W+3,cz-half-6,{txt:['LOOKOUT MESA','Stairs start here.','Somebody left something up top.']})}
 // ---- the guardian's landing past the Arena's south gate
 const ex=add(X0-20,X0+20,-288-34,-288,BASEH,'exit',{cp:true});const gate={x:X0,z:ex.z0+1.2,w:10,h:13,top:ex.top};const zEnd=ex.z0-6;
 Object.values(D).forEach(p=>{if(p.xchests)p.xchests.forEach(c=>chests.push(c))});
 const lock=n>=4&&rnd()<.3?1:0;const puz=puzzlePlan(n,seed,P,SP,rnd,entry);
 return {n,seed,th,P,M:[],G,entry,exit:ex,gate,zEnd,kinds,lock,puz,guard:SP&&SP.guard?SP.guard:kinds.filter(k=>k!=='stink')[(n-1)%kinds.filter(k=>k!=='stink').length],skin:SP&&SP.skin||'',gname:SP&&SP.gname||'',extra:SP&&SP.extra||null,
  nag:0,bombs:0,rest:0,big:SP&&SP.big||0,dress:'',dark:0,treasure:0,name:floorName(n),zMin:zEnd-8,zMax:34,xMin:X0-156,xMax:X0+156,wide:1,props,coins,wchests:chests,stations}}
const F_RACE=new Map();
// ---- what stands on a wide floor (built with the floor; the still pieces of a material drawn together, a few moving parts kept apart)
function wSignTex(lines,w,h,bg,fg){const c=cvs(512);c.height=Math.round(512*h/w);const g=c.getContext('2d');g.fillStyle=bg||'#3a2614';g.fillRect(0,0,c.width,c.height);g.strokeStyle='#d9a425';g.lineWidth=10;g.strokeRect(8,8,c.width-16,c.height-16);g.textAlign='center';g.textBaseline='middle';
 const n=lines.length;lines.forEach((l,i)=>{g.fillStyle=i===0?'#ffd27a':(fg||'#f2e2c8');g.font=(i===0?'900 ':'600 ')+Math.round(c.height/(n+1.2)*(i===0?.62:.46))+'px Georgia,serif';g.fillText(l,c.width/2,c.height*(i+.8)/(n+.6))});const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return t}
function wClothTex(c1,c2){const c=cvs(128),g=c.getContext('2d');for(let i=0;i<8;i++){g.fillStyle=i%2?c1:c2;g.fillRect(i*16,0,16,128)}const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t}
function wideLook(F,G){if(!F.wide)return;const L=new THREE.Group(),K=new THREE.Group();G.add(L);G.add(K);F.wlive=[];const wm=woodMat(),sm=stoneMat(),gold=itMat('goldP'),iron=itMat('iron');
 const M=(geo,mat,x,y,z,rx,ry,rz,par)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);if(rx||ry||rz)m.rotation.set(rx||0,ry||0,rz||0);(par||L).add(m);return m};
 const topAt=(x,z)=>towerH(x,z);const cloth=[0xb02020,0x2050b0,0x2a8a3a,0xd09020].map((c,i)=>new THREE.MeshStandardMaterial({map:wClothTex('#'+c.toString(16).padStart(6,'0'),'#f2e6c8'),roughness:.8,side:THREE.DoubleSide}));
 const hay=new THREE.MeshStandardMaterial({color:0xd8b048,roughness:.95}),fruit=[0xe03020,0xf0b020,0x40a030,0x8040c0].map(c=>new THREE.MeshStandardMaterial({color:c,roughness:.5}));
 const glowAt=(x,y,z,col,s,op)=>{const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:itGlowTex(),color:col,transparent:true,opacity:op||.5,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));sp.position.set(x,y,z);sp.scale.set(s,s,1);K.add(sp);return sp};
 const trees=[],fol=[],cones=[],rocks=[],flw=[];
 F.props.forEach(o=>{const y0=o.top!=null?o.top:topAt(o.x,o.z),x=o.x,z=o.z;
  if(o.k==='stable'){[[-8,-6],[8,-6],[-8,6],[8,6]].forEach(([dx,dz])=>M(new THREE.CylinderGeometry(.28,.32,6.4,8),wm,x+dx,y0+3.2,z+dz));[[-1],[1]].forEach(([s])=>M(new THREE.BoxGeometry(17.6,.35,7.6),wm,x,y0+6.6+.9,z+s*3.4,s*.24,0,0));
   for(let k=0;k<4;k++)M(new THREE.BoxGeometry(1.6,1,1.1),hay,x-6+k*1.8,y0+.5,z-5.2+(k%2)*.2);M(new THREE.BoxGeometry(4,.9,1.2),wm,x+4,y0+.45,z-5);
   const s=M(new THREE.PlaneGeometry(6,1.6),new THREE.MeshBasicMaterial({map:wSignTex(['GATOR STABLE'],6,1.6),side:THREE.DoubleSide}),x+8.6,y0+5.2,z,0,Math.PI/2,0,K)}
  else if(o.k==='garage'){const d=M(new THREE.PlaneGeometry(8,5.6),new THREE.MeshStandardMaterial({color:0x8a9098,metalness:.7,roughness:.45,map:wClothTex('#8a9098','#6a7078')}),x-9.05,y0+2.8,z,0,-Math.PI/2,0,K);
   M(new THREE.PlaneGeometry(10,2.2),new THREE.MeshBasicMaterial({map:wSignTex(['LOWRIDERS'],10,2.2,'#120a20','#ff70d0'),side:THREE.DoubleSide,toneMapped:false}),x-9.1,y0+6.4,z,0,-Math.PI/2,0,K);glowAt(x-10,y0+6.4,z,0xff60d0,8,.25);
   M(new THREE.BoxGeometry(.3,.3,12.4),gold,x-9.1,y0+7.6,z)}
  else if(o.k==='fountain'){M(new THREE.CylinderGeometry(.7,.9,3,12),sm,x,y0+1.5,z);const c=M(coinGeo(),itMat('coin'),x,y0+4.6,z,Math.PI/2,0,0,K);c.scale.setScalar(2.4);F.wlive.push(t=>{c.rotation.y=t*.6});
   const w=M(new THREE.CylinderGeometry(3.9,3.9,.12,32),new THREE.MeshStandardMaterial({color:0x2a6aa0,transparent:true,opacity:.75,roughness:.05,metalness:.3}),x,y0+.05,z,0,0,0,K);
   const sp=new THREE.MeshBasicMaterial({color:0xbfe8ff,transparent:true,opacity:.35,blending:THREE.AdditiveBlending,depthWrite:false});for(let k=0;k<4;k++){const a=k/4*Math.PI*2;const j=M(new THREE.ConeGeometry(.25,2.6,6,1,true),sp,x+Math.cos(a)*1.4,y0+1.6,z+Math.sin(a)*1.4,Math.sin(a)*.5,0,-Math.cos(a)*.5,K)}}
  else if(o.k==='sign'){const t=o.txt;M(new THREE.CylinderGeometry(.18,.2,4.6,8),wm,x-2.6,y0+2.3,z);M(new THREE.CylinderGeometry(.18,.2,4.6,8),wm,x+2.6,y0+2.3,z);M(new THREE.BoxGeometry(6,2.6,.25),wm,x,y0+3.4,z);
   [1,-1].forEach(s=>M(new THREE.PlaneGeometry(5.6,2.3),new THREE.MeshBasicMaterial({map:wSignTex(t,5.6,2.3)}),x,y0+3.4,z+s*.14,0,s>0?0:Math.PI,0,K))}
  else if(o.k==='post'){M(new THREE.CylinderGeometry(.2,.24,6,8),wm,x,y0+3,z);o.to.forEach((l,i)=>{const b=M(new THREE.BoxGeometry(4.2,.9,.18),wm,x+(i===0?-1.6:i===2?1.6:0),y0+5.2-i*1.2,z);[1,-1].forEach(s=>M(new THREE.PlaneGeometry(4,.8),new THREE.MeshBasicMaterial({map:wSignTex([l],4,.8)}),b.position.x,b.position.y,z+s*.1,0,s>0?0:Math.PI,0,K))})}
  else if(o.k==='lamp'){M(new THREE.CylinderGeometry(.14,.2,6,8),iron,x,y0+3,z);M(new THREE.BoxGeometry(.8,1,.8),new THREE.MeshStandardMaterial({color:0x3a2a10,emissive:0xffb050,emissiveIntensity:1.6}),x,y0+6.4,z,0,0,0,K);M(new THREE.ConeGeometry(.7,.5,4),iron,x,y0+7.1,z,0,Math.PI/4,0);glowAt(x,y0+6.4,z,0xffb050,5,.35)}
  else if(o.k==='stall'){const f=o.face||0,cs=Math.cos(f),sn=Math.sin(f);const P=(dx,dz)=>[x+dx*cs+dz*sn,z-dx*sn+dz*cs];[[-4,-1.2],[4,-1.2],[-4,1.4],[4,1.4]].forEach(([dx,dz])=>{const [px,pz]=P(dx,dz);M(new THREE.CylinderGeometry(.13,.15,4.2,6),wm,px,y0+2.1,pz)});
   const r=M(new THREE.PlaneGeometry(9,3.6),cloth[o.c|0],x,y0+4.3,z,0,f,0);r.rotation.order='YXZ';r.rotation.set(-Math.PI/2+.25,f,0);
   for(let k=0;k<6;k++){const [px,pz]=P(-3.2+k*1.3,0);M(new THREE.SphereGeometry(.28,10,8),fruit[(k+(o.c|0))%4],px,y0+1.45,pz)}}
  else if(o.k==='crates'){for(let k=0;k<3;k++)M(new THREE.BoxGeometry(1.6,1.6,1.6),wm,x+(k===2?.8:k*1.7),y0+.8+(k===2?1.6:0),z,0,k*.3,0);M(new THREE.CylinderGeometry(.7,.7,1.6,14),wm,x-1.8,y0+.8,z+.6)}
  else if(o.k==='rubble'){for(let k=0;k<5;k++)rocks.push([x+Math.sin(k*2.1)*2.4,y0+.4,z+Math.cos(k*1.7)*2.2,k,.7+((k*37)%5)*.15])}
  else if(o.k==='torchpost'){M(new THREE.CylinderGeometry(.14,.18,3.4,8),iron,x,y0+1.7,z);const fl=M(new THREE.ConeGeometry(.32,1,8),new THREE.MeshBasicMaterial({color:0xffa030,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),x,y0+3.8,z,0,0,0,K);glowAt(x,y0+3.9,z,0xff8a30,3.4,.45);F.wlive.push(t=>{fl.scale.set(1,1+Math.sin(t*13+x)*.18,1)})}
  else if(o.k==='tree'){const s=o.s||1;trees.push([x,y0+2.2*s,z,0,s]);fol.push([x,y0+5*s,z,x,s*1.4],[x+.9*s,y0+4.2*s,z+.6*s,z,s],[x-.8*s,y0+4.4*s,z-.7*s,x+z,s*1.05])}
  else if(o.k==='flowers'){for(let k=0;k<12;k++)flw.push([x+Math.sin(k*2.4)*2,y0+.25,z+Math.cos(k*1.9)*2,k,.8+(k%3)*.2])}
  else if(o.k==='statue'){M(new THREE.BoxGeometry(6,3,6),sm,x,y0+1.5,z);M(new THREE.BoxGeometry(6.6,.4,6.6),gold,x,y0+3.2,z);const c=M(coinGeo(),itMat('coin'),x,y0+8.6,z,Math.PI/2,0,0,K);c.scale.setScalar(9);F.wlive.push(t=>{c.rotation.y=t*.35});glowAt(x,y0+8.6,z,0xffc040,16,.18)}
  else if(o.k==='arch'){const f=o.face||0,cs=Math.cos(f),sn=Math.sin(f),sp=11;[-1,1].forEach(s=>M(new THREE.BoxGeometry(1.4,9,1.4),sm,x+s*sp*cs,y0+4.5,z-s*sp*sn));const b=M(new THREE.BoxGeometry(sp*2+1.4,1.4,1.4),sm,x,y0+9.5,z,0,f,0);
   const ban=M(new THREE.PlaneGeometry(10,2.2),new THREE.MeshBasicMaterial({map:wSignTex([o.i===0?'START · FINISH':'ARCH '+(o.i+1)],10,2.2,'#101010','#ffffff'),side:THREE.DoubleSide}),x,y0+8.2,z,0,f,0,K);
   const gl=M(new THREE.PlaneGeometry(sp*2,8.6),new THREE.MeshBasicMaterial({color:0xffd040,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}),x,y0+4.3,z,0,f,0,K);(F.archG||(F.archG=[]))[o.i]=gl}
  else if(o.k==='cone')cones.push([x,y0+.5,z,0,1]);
  else if(o.k==='coop'){const wh=new THREE.MeshStandardMaterial({color:0xf2eee4,roughness:.72}),pr=new THREE.MeshStandardMaterial({color:0x4a1a52,roughness:.55,metalness:.1});
   M(new THREE.BoxGeometry(6.4,3.6,5.2),wh,x,y0+1.8,z);const sh=new THREE.Shape();sh.moveTo(-3.7,0);sh.lineTo(0,2.3);sh.lineTo(3.7,0);sh.lineTo(-3.7,0);const rg=new THREE.ExtrudeGeometry(sh,{depth:5.8,bevelEnabled:false});rg.translate(0,0,-2.9);M(rg,pr,x,y0+3.6,z);
   M(new THREE.BoxGeometry(1.3,1.7,1.3),wh,x,y0+6.3,z+1.4);M(new THREE.ConeGeometry(1.05,2,4),pr,x,y0+8.15,z+1.4,0,Math.PI/4,0);M(new THREE.SphereGeometry(.34,14,8,0,Math.PI*2,0,Math.PI/2),gold,x,y0+5.85,z+1.4);
   M(new THREE.BoxGeometry(.12,2.4,1.8),wm,x-3.22,y0+1.2,z);M(new THREE.BoxGeometry(.12,1.1,1.1),new THREE.MeshStandardMaterial({color:0x8ab8e0,emissive:0x2a4a6a,emissiveIntensity:.7}),x-3.22,y0+2.5,z+1.9);
   M(new THREE.BoxGeometry(3.4,.16,4.6),hay,x-5.2,y0+.08,z);for(let k=0;k<3;k++)M(new THREE.BoxGeometry(1.4,.9,1),hay,x+1.6-k*1.6,y0+.45,z-3.4);
   M(new THREE.CylinderGeometry(.16,.18,3.6,8),wm,x-6.6,y0+1.8,z-3.6);M(new THREE.BoxGeometry(4.4,1.5,.2),wm,x-6.6,y0+3.4,z-3.6);
   [1,-1].forEach(sd=>M(new THREE.PlaneGeometry(4.2,1.3),new THREE.MeshBasicMaterial({map:wSignTex(['DEACON PARKING ONLY','Violators will be fried'],4.2,1.3,'#2a0a2e','#ffe6a0')}),x-6.6,y0+3.4,z-3.6+sd*.11,0,sd>0?0:Math.PI,0,K))}
  else if(o.k==='crane'){M(new THREE.BoxGeometry(.5,12,.5),wm,x-3,y0+6,z,0,0,.25);M(new THREE.BoxGeometry(.5,12,.5),wm,x+3,y0+6,z,0,0,-.25);M(new THREE.BoxGeometry(9,.5,.5),wm,x,y0+11.6,z);M(new THREE.CylinderGeometry(.04,.04,6,4),iron,x+2,y0+8.6,z);M(new THREE.CylinderGeometry(.8,.6,1,10),iron,x+2,y0+5.2,z)}
  else if(o.k==='tent'){const s=o.big?1.6:1,f=o.face||0;const t=M(new THREE.ConeGeometry(3.2*s,4.2*s,4,1,true),cloth[(Math.round(x+z)&3)],x,y0+2.1*s,z,0,f+Math.PI/4,0);M(new THREE.CylinderGeometry(.08,.08,4.8*s,6),wm,x,y0+2.4*s,z);if(o.big){M(new THREE.PlaneGeometry(1.6,1),new THREE.MeshBasicMaterial({map:wSignTex(['CHIEF'],1.6,1),side:THREE.DoubleSide}),x,y0+5.4*s,z,0,f,0,K)}}
  else if(o.k==='campfire'){for(let k=0;k<5;k++){const a=k/5*Math.PI*2;M(new THREE.CylinderGeometry(.18,.22,2.2,8),wm,x+Math.cos(a)*.5,y0+.3,z+Math.sin(a)*.5,Math.PI/2-.3,a,0)}const fm=[0xff5a10,0xffa02a,0xfff0a0].map(c=>new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.85,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
   const fs=fm.map((m,k)=>M(new THREE.ConeGeometry(1-k*.25,2.6-k*.5,8),m,x,y0+1.3-k*.1,z,0,0,0,K));const lt=new THREE.PointLight(0xff8a30,2.4,34,1.6);lt.position.set(x,y0+2.6,z);K.add(lt);glowAt(x,y0+1.8,z,0xff7a20,7,.4);F.wlive.push(t=>{fs.forEach((f,k)=>f.scale.set(1,1+Math.sin(t*(9+k*3))*.15,1));lt.intensity=2.2+Math.sin(t*17)*.3})}
  else if(o.k==='banner'){M(new THREE.CylinderGeometry(.12,.14,9,8),iron,x,y0+4.5,z);const b=M(new THREE.PlaneGeometry(2.4,4),new THREE.MeshBasicMaterial({map:wSignTex(['78th','LIL NAG','BRIGADE'],2.4,4,'#5a0a10'),side:THREE.DoubleSide}),x+1.3,y0+6.6,z,0,0,0,K);F.wlive.push(t=>{b.rotation.y=Math.sin(t*1.3+x)*.25})}
  else if(o.k==='flag'){M(new THREE.CylinderGeometry(.1,.12,7,8),iron,x,y0+3.5,z);const f=M(new THREE.PlaneGeometry(3,1.9),new THREE.MeshStandardMaterial({color:0xd9a425,side:THREE.DoubleSide,emissive:0x3a2a00}),x+1.5,y0+6.2,z,0,0,0,K);F.wlive.push(t=>{f.rotation.y=Math.sin(t*2.2)*.35})}
  else if(o.k==='telescope'){[0,1,2].forEach(k=>{const a=k/3*Math.PI*2;M(new THREE.CylinderGeometry(.05,.05,2.2,6),iron,x+Math.cos(a)*.45,y0+1,z+Math.sin(a)*.45,Math.sin(a)*.25,0,-Math.cos(a)*.25)});M(new THREE.CylinderGeometry(.14,.22,2.2,14),gold,x,y0+2.2,z,0,0,1.1)}});
 // the many small things: one draw each (trunks, leaves, cones, rocks, flowers)
 const inst=(geo,mat,list)=>{if(!list.length)return;const im=new THREE.InstancedMesh(geo,mat,list.length),m=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),sv=new THREE.Vector3();list.forEach((it,i)=>{e.set(0,(it[3]||0)*1.7,0);q.setFromEuler(e);sv.setScalar(it[4]||1);m.compose(new THREE.Vector3(it[0],it[1],it[2]),q,sv);im.setMatrixAt(i,m)});K.add(im)};
 inst(new THREE.CylinderGeometry(.3,.45,4.4,8),wm,trees);inst(new THREE.IcosahedronGeometry(1.9,1),new THREE.MeshStandardMaterial({color:0x2f7a34,roughness:.85,flatShading:true}),fol);
 {const cg=new THREE.ConeGeometry(.45,1,12);inst(cg,new THREE.MeshStandardMaterial({color:0xff6a10,roughness:.5}),cones)}inst(new THREE.DodecahedronGeometry(.8,0),sm,rocks);inst(new THREE.SphereGeometry(.22,8,6),new THREE.MeshStandardMaterial({color:0xe85090,roughness:.6,emissive:0x300818}),flw);
 // the still pieces, one draw per material
 try{itMerge(L)}catch(e){console.warn('wide merge',e)}}
(function(){const fl=floorLook;floorLook=function(F,G){const r=fl(F,G);if(F&&F.wide)try{wideLook(F,G)}catch(e){console.warn('wide look',e)}return r}})();
// the moving parts of a wide floor (the fountain's coin, the fire, the flags), and its coin trails (the host drops them when the floor loads)
(function(){const wt=W4.tick;W4.tick=function(t,dt){const r=wt.apply(this,arguments);try{const F=W4.F;if(F&&F.wlive)for(const f of F.wlive)f(t)}catch(e){}return r}})();
function wideCoins(F){if(!F||!F.wide||MP.client)return;(F.coins||[]).forEach(([x,z,k])=>{try{dropAdd('coin',k,x,z)}catch(e){}})}
// ---------------------------------------------------------------- THE BIG FLOORS (the owner, Oct 21 13:51-13:54: "These levels should be big, like
// World 1 is way too small... All of these maps should be bigger than World 1"; "I don't want to run through these linear missions... multiple
// ways to finish, multiple quests per level... a maze and a quest outside the maze and a quest inside the maze, and then some secrets and then
// other things"; "take your time... quality"). Every floor but the swarm (9), the Halfway House (50) and the top (100) is a plain of districts,
// three across and three deep (four deep from floor 35): each district a hundred paces square with its own business, from a library of fifteen.
// The Motor Pool is always by the door (the rides), the Arena always at the far end (the guardian and the gate); between them, chosen by the
// floor's numbers: Market Row, the Ruins (a sealed vault), the Gardens (the floor's puzzle), the Lowrider Loop (a race), the Quarry (a pit with
// stairs out), Camp Town, Lookout Mesa (a stair round it to a secret on top), the Maze (something lost inside, a chest in its heart, a sealed
// room), the Gap (the abyss: stepping stones, a bridge and a moving slab out to an island), the Cookout (Uncle Earl's grill), the Court (hoops:
// dunk for doubloons), the Boneyard (a mausoleum with loose bricks), the Junkyard (wrecks to climb), and the Chapel on church floors.
// Two ways up: through the gate past the guardian, or the back stairs, in a little hut behind loose bricks somewhere on the floor.
const BIGW=100,BIGD=96,BIGX=[X0-150,X0-50,X0+50];
function bigOf(n){if(n===9||n>=100||n<1)return false;const SP=typeof specialOf==='function'&&specialOf(n);return !(SP&&SP.rest)}
function bigRows(n){const SP=typeof specialOf==='function'&&specialOf(n);return n>=35||(SP&&SP.layout)?4:3}   // (a floor with its own run gives the Gauntlet three cells and keeps nine districts beside it)
const BIGNAME={gauntlet:'the Gauntlet',market:'Market Row',motor:'the Motor Pool',ruins:'the Ruins',garden:'the Gardens',loop:'the Lowrider Loop',quarry:'the Quarry',camp:'Camp Town',arena:'the Arena',mesa:'Lookout Mesa',
 maze:'the Maze',gap:'the Gap',cookout:'the Cookout',court:'the Court',yard:'the Boneyard',junk:'the Junkyard',chapel:'the Chapel'};
// ---- which district goes where: the Motor Pool by the door, the Arena at the end, the rest from the floor's numbers (a maze always, two on a
// maze floor; the Gardens when the floor has a puzzle; a camp always; the Gap only on the sides, never by the door; nothing twice but camps)
function bigPlan(n,seed,rows,SP){if(typeof wideOf==='function'&&wideOf(n)&&rows===3)return WDK.map(r=>r.slice());const r=srand((seed|0)*313+n*7717+11);
 const G=[];for(let j=0;j<rows;j++)G.push([null,null,null]);G[0][1]='motor';G[rows-1][1]='arena';
 // a floor with its own handmade run (the Stairway, the Laundromat, the Gauntlet...) keeps it: down the whole east side, below the first row
 const layout=SP&&SP.layout;if(layout)for(let j=1;j<rows;j++)G[j][2]='gauntlet';
 const free=[];for(let j=0;j<rows;j++)for(let i=0;i<3;i++)if(!G[j][i])free.push([i,j]);
 const shuffle=a=>{for(let k=a.length-1;k>0;k--){const q=(r()*(k+1))|0;[a[k],a[q]]=[a[q],a[k]]}return a};shuffle(free);
 const put=(k,ok)=>{const at=free.findIndex(([i,j])=>!G[j][i]&&(!ok||ok(i,j)));if(at<0)return false;const [i,j]=free[at];G[j][i]=k;return true};
 if(SP&&SP.church)put('chapel',(i,j)=>j>0&&j<rows-1);
 put('maze',(i,j)=>j>0);if(mazeOf(n)||rows>3)put('maze',(i,j)=>j>0&&!(G[j][i===0?1:i-1]==='maze'));
 const puz=n>=3&&!mazeOf(n)&&!(SP&&(SP.nag||SP.rest));if(puz)put('garden');
 if(!layout&&r()<.55)put('gap',(i,j)=>i!==1&&j>0&&!(j>0&&G[j-1][i]==='gap'));
 put('camp');
 const pool=shuffle(['market','ruins','loop','quarry','mesa','cookout','court','yard','junk','camp','ruins','cookout']);
 for(const k of pool){if(!free.some(([i,j])=>!G[j][i]))break;if(k!=='camp'&&G.some(row=>row.includes(k)))continue;if(k==='quarry'){put(k,(i,j)=>j>0&&G[j-1][i]!=='gap'&&!(G[j+1]&&G[j+1][i]==='gap')&&G[j][i===0?1:i-1]!=='gap'&&G[j][i===2?1:i+1]!=='gap');continue}put(k)}
 while(free.some(([i,j])=>!G[j][i]))put('camp');return G}
function bigFloor(n,seed,SP,th){const rnd=srand((seed|0)*7919+n*104729+77),rf=(a,b)=>a+rnd()*(b-a),ri=(a,b)=>a+Math.floor(rnd()*(b-a+1));const rows=bigRows(n),plan=bigPlan(n,seed,rows,SP);
 const P=[],M=[],G=[];const add=(x0,x1,z0,z1,top,kind,o)=>{const p=Object.assign({x0,x1,z0,z1,top,kind,i:P.length},o||{});P.push(p);return p};
 const kinds=SP&&SP.kinds?SP.kinds:floorKinds(n),up=n>60?1:0;
 const entry=add(X0-20,X0+20,0,26,BASEH,'entry',{cp:true});
 const props=[],coins=[],chests=[],stations=[],people=[];
 const X={n,seed,rnd,rf,ri,kinds,up,P,M,G,add,props,coins,chests,stations,people,SP,plan,rows,
  blk:(p,x0,x1,z0,z1,h,o)=>{const b=Object.assign({x0:Math.min(x0,x1),x1:Math.max(x0,x1),z0:Math.min(z0,z1),z1:Math.max(z0,z1),top:p.top+h},o||{});(p.blocks||(p.blocks=[])).push(b);return b},
  prop:(k,x,z,o)=>props.push(Object.assign({k,x,z},o||{})),camp:(p,x,z,r,k,o)=>G.push(Object.assign({pi:p.i,n:Math.max(2,k+up),kinds,cx:x,cz:z,r},o||{})),C:p=>[(p.x0+p.x1)/2,(p.z0+p.z1)/2]};
 // the districts: each cell's own plaza (the Gap has none: it is the abyss with a way across), then its business
 const D={},cells={};for(let j=0;j<rows;j++)for(let i=0;i<3;i++){const k=plan[j][i],x0=BIGX[i],x1=x0+BIGW,z1=-j*BIGD,z0=z1-BIGD;
  const cell={i,j,k,x0,x1,z0,z1,outer:{w:i===0,e:i===2,n:j===0,s:j===rows-1}};cells[i+','+j]=cell;
  if(k==='gap'||k==='gauntlet'){cell.p=null;continue}
  const p=add(x0,x1,z0,z1,k==='quarry'?BASEH-6:BASEH,'plaza',{cp:true,wide:k,blocks:[],nopuz:k!=='garden',cell});cell.p=p;if(!D[k])D[k]=p}
 // a low wall round the outside of the plain (a jump clears it: nobody rolls off by accident), with the way in and the way out left open
 const edge=(p,side,gap)=>{const T=1.2,h=2.2;const seg=(a,b)=>{if(b-a<.5)return;if(side==='w')X.blk(p,p.x0,p.x0+T,a,b,h,{edge:1});else if(side==='e')X.blk(p,p.x1-T,p.x1,a,b,h,{edge:1});else if(side==='n')X.blk(p,a,b,p.z1-T,p.z1,h,{edge:1});else X.blk(p,a,b,p.z0,p.z0+T,h,{edge:1})};
  const lo=side==='w'||side==='e'?p.z0:p.x0,hi=side==='w'||side==='e'?p.z1:p.x1;if(gap){seg(lo,gap[0]);seg(gap[1],hi)}else seg(lo,hi)};
 Object.values(cells).forEach(c=>{const p=c.p;if(!p||p.top<BASEH-.1)return;if(c.outer.w)edge(p,'w');if(c.outer.e)edge(p,'e');if(c.outer.n)edge(p,'n',c.k==='motor'?[X0-20,X0+20]:null);if(c.outer.s)edge(p,'s',c.k==='arena'?[X0-12,X0+12]:null)});
 Object.values(cells).forEach(c=>{const g=(i,j)=>cells[i+','+j];c.nb={w:g(c.i-1,c.j),e:g(c.i+1,c.j),n:g(c.i,c.j-1),s:g(c.i,c.j+1)}});
 X.cells=cells;Object.values(cells).forEach(c=>{const B=BIGD_B[c.k];if(B)try{B(c.p,X,c)}catch(e){console.warn('district',c.k,e)}});
 // the back stairs: a little brick hut with loose bricks for a door, in one of the quieter districts; inside, the stairs up past the guardian
 {const cand=Object.values(cells).filter(c=>c.p&&['market','ruins','camp','cookout','court','yard','junk','quarry','mesa','loop'].includes(c.k)&&!c.p.church);   // (not the Gardens: the floor's puzzle clears its corner there)
  for(let t=0;t<30&&cand.length&&!X.back;t++){const c=cand[(rnd()*cand.length)|0],p=c.p;const x=rf(p.x0+12,p.x1-12),z=rf(p.z0+12,p.z1-12);if(Math.abs(towerH0(P,x,z,p)-p.top)>.01)continue;
   {let clr=true;for(const a of [-4.7,-2.4,0,2.4,4.7])for(const b of [-4.7,-2.4,0,2.4,4.7])if(Math.abs(towerH0(P,x+a,z+b,p)-p.top)>.01)clr=false;if(!clr)continue}   // (its whole footprint and a step round it on open ground)
   if(p.sealedR&&Math.hypot(p.sealedR[0]-x,p.sealedR[1]-z)<16||p.sealedM&&Math.hypot(p.sealedM[0]-x,p.sealedM[1]-z)<14)continue;
   if(props.some(o=>Math.hypot(o.x-x,o.z-z)<9)||chests.some(o=>Math.hypot(o.x-x,o.z-z)<8)||G.some(g=>g.pi===p.i&&Math.hypot(g.cx-x,g.cz-z)<g.r+4))continue;
   const h=6,wt=.9,s=3.2,face=['n','s','e','w'][(rnd()*4)|0];const w=(a,b,cc,d,o)=>X.blk(p,a,b,cc,d,h,Object.assign({wall:1,keep:1,hut:1},o||{}));
   if(face==='s')w(x-s,x+s,z-s,z-s+wt,{sdoor:1,face:'s'});else w(x-s,x+s,z-s,z-s+wt);if(face==='n')w(x-s,x+s,z+s-wt,z+s,{sdoor:1,face:'n'});else w(x-s,x+s,z+s-wt,z+s);
   if(face==='w')w(x-s,x-s+wt,z-s+wt,z+s-wt,{sdoor:1,face:'w'});else w(x-s,x-s+wt,z-s+wt,z+s-wt);if(face==='e')w(x+s-wt,x+s,z-s+wt,z+s-wt,{sdoor:1,face:'e'});else w(x+s-wt,x+s,z-s+wt,z+s-wt);
   {const hw=p.blocks.filter(b=>b.hut);roofWalls(p,X,hw.filter(b=>!b.sdoor).map(b=>[b.x0,b.x1,b.z0,b.z1]),hw.find(b=>b.sdoor))}
   X.back={x,z,pi:p.i,face,where:BIGNAME[c.k]};X.prop('backstairs',x,z,{face})}}
 // the guardian's landing past the Arena's south gate
 const zb=-rows*BIGD;const ex=add(X0-20,X0+20,zb-34,zb,BASEH,'exit',{cp:true});const gate={x:X0,z:ex.z0+1.2,w:10,h:13,top:ex.top};const zEnd=ex.z0-6;
 Object.values(cells).forEach(c=>{if(c.p&&c.p.xchests)c.p.xchests.forEach(q=>chests.push(q))});
 const lock=n>=4&&!(SP&&(SP.rest||SP.nag))&&rnd()<.3?1:0;const puz=puzzlePlan(n,seed,P,SP,rnd,entry);
 // a floor never holds a crowd a phone cannot draw: the camps share out about forty, the maze keeps its own
 {const tot=G.reduce((a,g)=>a+g.n,0),cap=34+Math.min(18,Math.floor(n/4))+rows*3;if(tot>cap){const k=cap/tot;G.forEach(g=>{g.n=Math.max(2,Math.round(g.n*k))})}}
 return {n,seed,th,P,M,G,entry,exit:ex,gate,zEnd,kinds,lock,puz,guard:SP&&SP.guard?SP.guard:kinds.filter(k=>k!=='stink')[(n-1)%kinds.filter(k=>k!=='stink').length],skin:SP&&SP.skin||'',gname:SP&&SP.gname||'',extra:SP&&SP.extra||null,
  nag:SP&&SP.nag?1:0,bombs:SP&&SP.bombs?1:0,rest:0,big:SP&&SP.big||0,dress:SP&&SP.dress||'',dark:SP&&SP.dark?1:0,treasure:SP&&SP.treasure?1:0,name:floorName(n),zMin:zEnd-8,zMax:34,xMin:X0-156,xMax:X0+156,
  wide:1,bigf:1,rows,plan,props,coins,wchests:chests,stations,people:X.people,back:X.back||null,hoops:X.hoops||[],quests:X.quests||[],djs:X.djs||[]}}
// the ground height from a list of plazas (the grid is not built yet while a floor is being laid out)
function towerH0(P,x,z,only){let h=VOID;const L=only?[only]:P;for(const p of L){if(x>=p.x0&&x<=p.x1&&z>=p.z0&&z<=p.z1){if(p.top>h)h=p.top;(p.blocks||[]).forEach(b=>{if(x>=b.x0&&x<=b.x1&&z>=b.z0&&z<=b.z1&&b.top>h)h=b.top})}}return h}
// ---- the library: one builder a district (p: its plaza; X: the floor being made; c: its cell, with which sides are the outside)
const BIGD_B={};
BIGD_B.motor=(p,X)=>{const [cx,cz]=X.C(p),blk=X.blk,prop=X.prop,stations=X.stations;const sx=cx-28,sz=cz+22;const T=.5,h=1.3;blk(p,sx-9,sx+9,sz+7,sz+7+T,h);blk(p,sx-9,sx+9,sz-7-T,sz-7,h);blk(p,sx-9-T,sx-9,sz-7,sz+7,h);blk(p,sx+9,sx+9+T,sz-7,sz-2,h);blk(p,sx+9,sx+9+T,sz+2,sz+7,h);
 prop('stable',sx,sz);stations.push({k:'gator',x:sx+3,z:sz,ix:sx+11,iz:sz,face:Math.PI/2});
 const gx=cx+30,gz=cz+24;blk(p,gx-9,gx+9,gz-6,gz+6,7.5,{prop:1});prop('garage',gx,gz);stations.push({k:'car',x:gx-15,z:gz-2,ix:gx-15,iz:gz+2.6,face:-Math.PI/2});
 const kx=cx+28,kz=cz-30;blk(p,kx-3.2,kx+3.2,kz-2.6,kz+2.6,4.4,{prop:1});prop('coop',kx,kz);stations.push({k:'drum',x:kx-8,z:kz,ix:kx-8,iz:kz+3.4,face:-Math.PI/2});
 const mx=cx-30,mz=cz-24;prop('mpad',mx,mz);stations.push({k:'melon',x:mx,z:mz,ix:mx+5,iz:mz+3.5,face:Math.PI*.5});
 blk(p,cx-4.5,cx+4.5,cz-14.5,cz-5.5,1.1);prop('fountain',cx,cz-10);prop('sign',cx+8,cz+30,{txt:['BRIGADE MOTOR POOL','Gator · lowrider · the Deacon · the Mothership','Walk up to one and press F']});
 const nb=k=>BIGNAME[k]||'';const P0=X.plan;const L=nb(P0[0][0]),Rr=nb(P0[0][2]),S=nb(P0[1][1]);prop('post',cx-12,cz-30,{to:['◀ '+L.replace(/^the /,'').toUpperCase(),'▼ '+S.replace(/^the /,'').toUpperCase(),'▶ '+Rr.replace(/^the /,'').toUpperCase()]});
 prop('lamp',cx-20,cz+4);prop('lamp',cx+20,cz+4);prop('lamp',cx-20,cz-36);prop('lamp',cx+20,cz-36)};
BIGD_B.market=(p,X)=>{const [cx,cz]=X.C(p),blk=X.blk,prop=X.prop;for(let k=0;k<5;k++){const x=p.x1-14-k*17;[1,-1].forEach(s=>{const z=cz+s*11;blk(p,x-4,x+4,z-1,z+1,1.15);prop('stall',x,z,{face:s>0?Math.PI:0,c:(k+(s>0?0:2))%4})})}
 for(let k=0;k<14;k++)X.coins.push([p.x1-8-k*6,cz+Math.sin(k*.9)*2.2,3+((k*7)%4)]);X.camp(p,p.x0+18,cz,8,4);X.chests.push({x:p.x0+8,z:cz,top:p.top,src:'chest',rot:-Math.PI/2});
 prop('crates',p.x0+14,cz+16);prop('crates',p.x1-30,cz-20);prop('lamp',cx,cz+18);prop('lamp',cx,cz-18);prop('sign',p.x1-8,cz+20,{txt:['MARKET ROW','Everything must go','(mind your pockets)']})};
BIGD_B.ruins=(p,X)=>{const [cx,cz]=X.C(p),blk=X.blk,prop=X.prop,rf=X.rf,ri=X.ri,rnd=X.rnd;for(let k=0;k<12;k++){const x=rf(p.x0+10,p.x1-26),z=rf(p.z0+8,p.z1-10),L=rf(6,15),h=[2.6,3.8,5.2,7,9][ri(0,4)];if(Math.hypot(x-(p.x1-16),z-(p.z0+16))<20)continue;if(rnd()<.5)blk(p,x,x+L,z,z+1.3,h);else blk(p,x,x+1.3,z,z+L,h)}
 const vx=p.x1-16,vz=p.z0+16,wt=1.2,top=27;const w=(x0,x1,z0,z1,o)=>blk(p,x0,x1,z0,z1,top,Object.assign({wall:1,keep:1},o||{}));w(vx-6,vx+6,vz-6,vz-6+wt);w(vx-6,vx-6+wt,vz-6,vz+6);w(vx+6-wt,vx+6,vz-6,vz+6);w(vx-6,vx-2,vz+6-wt,vz+6);w(vx+2,vx+6,vz+6-wt,vz+6);
 w(vx-2,vx+2,vz+6-wt,vz+6,{sdoor:1,face:0});p.sealedR=[vx,vz,6];p.xchest={x:vx,z:vz-1.5,src:'secret'};X.camp(p,cx-6,cz+6,12,6);prop('rubble',cx+10,cz-14);prop('rubble',cx-22,cz+18);prop('torchpost',vx-9,vz+9);prop('torchpost',vx+9,vz+9)};
BIGD_B.garden=(p,X)=>{const [cx,cz]=X.C(p),blk=X.blk,prop=X.prop,rf=X.rf;const hx=p.x0+6;for(let k=0;k<5;k++){const z=p.z1-8-k*7,gap=rf(.25,.75),L=38;const g0=hx+L*gap-3,g1=g0+6;blk(p,hx,g0,z-.7,z+.7,3.1,{hedge:1});blk(p,g1,hx+L,z-.7,z+.7,3.1,{hedge:1})}
 for(let k=0;k<16;k++){const x=rf(p.x0+6,p.x1-6),z=rf(p.z0+6,p.z0+40);if(x>cx-22&&x<cx+22&&z>cz-22)continue;prop('tree',x,z,{s:rf(.8,1.3)})}for(let k=0;k<6;k++)prop('flowers',rf(p.x0+48,p.x1-8),rf(p.z1-36,p.z1-6));
 X.camp(p,p.x0+20,p.z0+14,8,4);X.chests.push({x:p.x0+10,z:p.z1-24,top:p.top,src:'chest',rot:Math.PI/2})};
BIGD_B.loop=(p,X)=>{const [cx,cz]=X.C(p),blk=X.blk,prop=X.prop;blk(p,cx-17,cx+17,cz-15,cz+15,1.6);prop('statue',cx,cz,{top:p.top+1.6});const R1=[[cx,cz+36,0],[cx+36,cz,Math.PI/2],[cx,cz-36,0],[cx-36,cz,Math.PI/2]];
 R1.forEach((a,i)=>prop('arch',a[0],a[1],{face:a[2],i}));prop('sign',cx-26,p.z1-6,{txt:['THE LOWRIDER LOOP','Through the four arches,','start to finish. Beat the clock.']});if(!F_RACE.has(X.n))F_RACE.set(X.n,{gates:R1.map(a=>({x:a[0],z:a[1],face:a[2]})),par:[34,46,64]});
 for(let k=0;k<10;k++){const a=k/10*Math.PI*2;prop('cone',cx+Math.cos(a)*21,cz+Math.sin(a)*19)}};
// the Quarry: six paces down; a stair of ten steps climbs out towards each neighbour (never the outside), rock mesas in it, a camp at the bottom,
// a chest on the tallest mesa with a ladder of boulders up its side
BIGD_B.quarry=(p,X,c)=>{const [cx,cz]=X.C(p),blk=X.blk,prop=X.prop;const R=.6,N=10,run=1.6;const ok=s=>c&&c.nb?!!(c.nb[s]&&c.nb[s].k!=='gap'):s!=='e';const o={w:!ok('w'),e:!ok('e'),n:!ok('n'),s:!ok('s')};
 if(!o.w)for(let s=1;s<=N;s++){const a=p.x0+(N-s)*run;blk(p,a,a+run,cz-6,cz+6,s*R,{rock:1,stair:1})}
 if(!o.e)for(let s=1;s<=N;s++){const a=p.x1-(N-s+1)*run;blk(p,a,a+run,cz-6,cz+6,s*R,{rock:1,stair:1})}
 if(!o.s)for(let s=1;s<=N;s++){const a=p.z0+(N-s)*run;blk(p,cx+18,cx+30,a,a+run,s*R,{rock:1,stair:1})}
 if(!o.n)for(let s=1;s<=N;s++){const a=p.z1-(N-s+1)*run;blk(p,cx-30,cx-18,a,a+run,s*R,{rock:1,stair:1})}
 const mesas=[[cx+8,cz-16,9,8,7.5],[cx-14,cz+14,7,7,5],[cx+24,cz+20,6,9,4],[cx-26,cz-24,8,6,6.2]];mesas.forEach(([x,z,w,d,h])=>blk(p,x-w/2,x+w/2,z-d/2,z+d/2,h,{rock:1,climb:h>7?1:0}));
 [[.3,3.5,-22,-18.8],[.3,3.5,-19,-15.8],[.3,3.5,-16,-12.8],[.3,3.5,-13,-9.6],[3.3,6.5,-12.2,-9]].forEach(([a,b,cc,d],i)=>blk(p,cx+a,cx+b,cz+cc,cz+d,1.25*(i+1),{rock:1,boulder:1}));
 X.chests.push({x:cx+8,z:cz-16,top:p.top+7.5,src:'chest',rot:0});X.camp(p,cx-4,cz,14,7);for(let k=0;k<8;k++)X.coins.push([cx-30+k*7,cz+30,4]);prop('crane',p.x1-14,p.z0+14);
 prop('sign',p.x0+20,cz+10,{txt:['THE QUARRY','Stairs out on every side','that is not a wall. Mind the drop.']})};
BIGD_B.camp=(p,X)=>{const [cx,cz]=X.C(p),blk=X.blk,prop=X.prop;blk(p,p.x0+6,p.x1-6,p.z1-8,p.z1-6.8,4.2,{fence:1});blk(p,p.x1-8,p.x1-6.8,p.z0+20,p.z1-8,4.2,{fence:1});
 for(let k=0;k<7;k++){const a=k/7*Math.PI*2+.3;prop('tent',cx+Math.cos(a)*24,cz+Math.sin(a)*20,{face:-a+Math.PI/2,big:k===0})}prop('campfire',cx,cz);X.camp(p,cx,cz,18,8);
 const a0=.3;X.chests.push({x:cx+Math.cos(a0)*24,z:cz+Math.sin(a0)*20,top:p.top,src:'chest',rot:-a0+Math.PI/2})};
BIGD_B.arena=(p,X)=>{const [cx,cz]=X.C(p),blk=X.blk,prop=X.prop;const R=30,wt=1.4,h=8;for(let k=0;k<8;k++){const a0=k/8*Math.PI*2+Math.PI/8,a1=(k+1)/8*Math.PI*2+Math.PI/8;const am=(a0+a1)/2;if(Math.abs(Math.sin(am))>.9)continue;
  const x0=cx+Math.cos(a0)*R,z0=cz+Math.sin(a0)*R,x1=cx+Math.cos(a1)*R,z1=cz+Math.sin(a1)*R;const steps=8;for(let s=0;s<steps;s++){const x=x0+(x1-x0)*(s+.5)/steps,z=z0+(z1-z0)*(s+.5)/steps;blk(p,x-wt,x+wt,z-wt,z+wt,h,{arena:1})}}
 for(let s=0;s<3;s++){blk(p,cx-R-6-s*2.4,cx-R-3.6-s*2.4,cz-14,cz+14,1.2*(s+1));blk(p,cx+R+3.6+s*2.4,cx+R+6+s*2.4,cz-14,cz+14,1.2*(s+1))}
 X.camp(p,cx,cz,16,8);X.chests.push({x:cx,z:cz,top:p.top,src:'chest',rot:0});prop('banner',cx-R,cz-16);prop('banner',cx+R,cz-16);prop('banner',cx-R,cz+16);prop('banner',cx+R,cz+16)};
BIGD_B.mesa=(p,X)=>{const [cx,cz]=X.C(p),blk=X.blk,prop=X.prop;const mh=14.4,half=13,W=4.2,R=.6,NS=6,L=2*half+W,sl=L/NS;blk(p,cx-half,cx+half,cz-half,cz+half,mh,{rock:1,mesa:1});const stair=[];let k=0;
 for(let f=0;f<4;f++)for(let s=0;s<NS;s++){k++;const h=k*R;if(h>mh-R+1e-6)break;let x0,x1,z0,z1;
  if(f===0){x0=cx+half;x1=x0+W;z0=cz-half+s*sl;z1=z0+sl}else if(f===1){z0=cz+half;z1=z0+W;x1=cx+half-s*sl;x0=x1-sl}else if(f===2){x0=cx-half-W;x1=cx-half;z1=cz+half-s*sl;z0=z1-sl}else{z0=cz-half-W;z1=cz-half;x0=cx-half+s*sl;x1=x0+sl}
  blk(p,x0,x1,z0,z1,h,{rock:1,stair:1,stepK:k});stair.push([(x0+x1)/2,(z0+z1)/2,h])}
 stair.forEach(([x,z,h],i)=>{if(i%3===1)X.coins.push([x,z,2+(i>15?2:0)])});p.xchests=[{x:cx,z:cz,top:p.top+mh,src:'secret'}];X.camp(p,p.x0+18,p.z1-18,9,5);prop('flag',cx+half-2,cz-half+2,{top:p.top+mh});prop('telescope',cx-half+3,cz+half-3,{top:p.top+mh});
 prop('sign',cx+half+W+3,cz-half-6,{txt:['LOOKOUT MESA','Stairs start here.','Somebody left something up top.']})};
// ---- the Maze: walls too tall to jump, a way in from every neighbour; something lost at one dead end (the maze's own quest), a chest at the
// dead end farthest from every way in, a sealed room behind loose bricks at a third, a crew inside
BIGD_B.maze=(p,X,c)=>{const C=8,cs=12,wt=1.6,W=C*cs+wt,Dp=C*11.6+wt;const x0=p.x0+(BIGW-W)/2,z1=p.z1-(BIGD-Dp)/2,z0=z1-Dp,csz=(Dp-wt)/C;const WH=27,rnd=X.rnd;
 const vis=[],E=[],Sw=[];for(let i=0;i<C;i++){vis.push([]);E.push([]);Sw.push([]);for(let j=0;j<C;j++){vis[i].push(false);E[i].push(true);Sw[i].push(true)}}
 const st=[[(rnd()*C)|0,(rnd()*C)|0]];vis[st[0][0]][st[0][1]]=true;
 while(st.length){const [i,j]=st[st.length-1];const nb=[];if(i>0&&!vis[i-1][j])nb.push([i-1,j,'w']);if(i<C-1&&!vis[i+1][j])nb.push([i+1,j,'e']);if(j>0&&!vis[i][j-1])nb.push([i,j-1,'n']);if(j<C-1&&!vis[i][j+1])nb.push([i,j+1,'s']);
  if(!nb.length){st.pop();continue}const [ni,nj,d]=nb[(rnd()*nb.length)|0];if(d==='e')E[i][j]=false;else if(d==='w')E[ni][nj]=false;else if(d==='s')Sw[i][j]=false;else Sw[ni][nj]=false;vis[ni][nj]=true;st.push([ni,nj])}
 // a few extra openings: more than one way through (it is a maze, not a corridor)
 for(let k=0;k<5;k++){const i=(rnd()*(C-1))|0,j=(rnd()*(C-1))|0;if(rnd()<.5)E[i][j]=false;else Sw[i][j]=false}
 // cells: j=0 is the north (+z) row here; walls east of (i,j) and south of (i,j)
 const cx=i=>x0+wt+i*cs,cz1=j=>z1-wt-j*csz;const wall=(a,b,cc,d,o)=>p.blocks.push(Object.assign({x0:Math.min(a,b),x1:Math.max(a,b),z0:Math.min(cc,d),z1:Math.max(cc,d),top:p.top+WH,wall:1,maze:1},o||{}));
 for(let i=0;i<C;i++)for(let j=0;j<C;j++){if(E[i][j]&&i<C-1)wall(cx(i)+cs-wt,cx(i)+cs,cz1(j)-csz,cz1(j)+wt);if(Sw[i][j]&&j<C-1)wall(cx(i)-wt,cx(i)+cs,cz1(j)-csz,cz1(j)-csz+wt)}
 // the outside walls with a way in from each side that has a neighbour (or the plain beyond the district's own margin)
 const o=c?c.outer:{},ins=[];const side=(s,k)=>{const g0=(s==='n'||s==='s'?k*cs+cs/2:k*csz+csz/2)-2.6,g1=g0+5.2;if(s==='n'||s==='s'){const zz=s==='n'?z1-wt:z0;wall(x0,x0+wt+g0,zz,zz+wt);wall(x0+wt+g1,x0+W,zz,zz+wt)}else{const xx=s==='w'?x0:x0+W-wt,za=z1-wt-g0,zb=z1-wt-g1;wall(xx,xx+wt,za,z1);wall(xx,xx+wt,z0,zb)}};
 ['n','s','w','e'].forEach(s=>{if(o[s]){if(s==='n'||s==='s'){const zz=s==='n'?z1-wt:z0;wall(x0,x0+W,zz,zz+wt)}else{const xx=s==='w'?x0:x0+W-wt;wall(xx,xx+wt,z0,z1)}return}const k=(rnd()*C)|0;side(s,k);ins.push([s,k])});
 p.maze=1;p.mz={C,cs,csz,wt,x0,z1,ins};
 // the cells you can reach and how far each is from the nearest way in (to put the best things deepest)
 const open=(i,j,d)=>d==='e'?i<C-1&&!E[i][j]:d==='w'?i>0&&!E[i-1][j]:d==='s'?j<C-1&&!Sw[i][j]:j>0&&!Sw[i][j-1];const dist=[];for(let i=0;i<C;i++){dist.push([]);for(let j=0;j<C;j++)dist[i].push(1e9)}
 const Q=[];ins.forEach(([s,k])=>{const i=s==='w'?0:s==='e'?C-1:k,j=s==='n'?0:s==='s'?C-1:k;dist[i][j]=0;Q.push([i,j])});
 while(Q.length){const [i,j]=Q.shift();[['e',1,0],['w',-1,0],['s',0,1],['n',0,-1]].forEach(([d,di,dj])=>{if(!open(i,j,d))return;const a=i+di,b=j+dj;if(dist[a][b]>dist[i][j]+1){dist[a][b]=dist[i][j]+1;Q.push([a,b])}})}
 const cen=(i,j)=>[cx(i)+(cs-wt)/2,cz1(j)-(csz-wt)/2];const dead=[];for(let i=0;i<C;i++)for(let j=0;j<C;j++){const n=['e','w','s','n'].filter(d=>open(i,j,d)).length;if(n===1&&dist[i][j]<1e9)dead.push([i,j,dist[i][j]])}dead.sort((a,b)=>b[2]-a[2]);
 if(dead[0]){const [x,z]=cen(dead[0][0],dead[0][1]);X.chests.push({x,z,top:p.top,src:'chest',rot:0});p.mzHeart=[x,z]}
 if(dead[1]){const [x,z]=cen(dead[1][0],dead[1][1]);p.mzLost=[x,z]}
 // the sealed room: the third deepest dead end, walled off by loose bricks across its one way out
 if(dead[2]){const [i,j]=dead[2];const d=['e','w','s','n'].find(dd=>open(i,j,dd));let b;
  if(d==='e')b={x0:cx(i)+cs-wt,x1:cx(i)+cs,z0:cz1(j)-csz,z1:cz1(j)};else if(d==='w')b={x0:cx(i)-wt,x1:cx(i),z0:cz1(j)-csz,z1:cz1(j)};else if(d==='s')b={x0:cx(i),x1:cx(i)+cs-wt,z0:cz1(j)-csz,z1:cz1(j)-csz+wt};else b={x0:cx(i),x1:cx(i)+cs-wt,z0:cz1(j)-wt,z1:cz1(j)};
  Object.assign(b,{top:p.top+WH,wall:1,sdoor:1,face:d,maze:1});p.blocks.push(b);const [x,z]=cen(i,j);p.xchest={x,z,src:'secret'};p.sealed=[i,j]}
 X.camp(p,cx(C>>1),cz1(C>>1),30,Math.min(9,4+Math.floor(X.n/5)),{maze:1});X.prop('sign',x0+W/2+(ins.find(q=>q[0]==='n')?ins.find(q=>q[0]==='n')[1]*cs-W/2+cs/2:0),z1+3,{txt:['THE MAZE','Something got lost in here.','Somebody always goes in after it.']})};
// ---- the Gap: no ground at all, only the abyss far below. Stepping stones from the north to an island in the middle (a chest, a crew),
// a narrow bridge off its south side, a moving slab out to its middle-column side; a floor that likes moving things gets more of them
BIGD_B.gap=(p,X,c)=>{const x0=c.x0,x1=c.x1,z0=c.z0,z1=c.z1,cx=(x0+x1)/2,cz=(z0+z1)/2,rf=X.rf,ri=X.ri,rnd=X.rnd;const L=X.SP&&X.SP.layout||[],mv=L.filter(k=>k==='movers').length,top=BASEH+1.2;
 const isl=X.add(cx-13,cx+13,cz-13,cz+13,top,'plaza',{cp:true,wide:'gap',island:1,blocks:[],nopuz:1,cell:c});c.p=isl;X.chests.push({x:cx+6,z:cz+6,top,src:'chest',rot:Math.PI/4});X.camp(isl,cx-3,cz-3,7,3);
 // north: stepping stones (or, on a moving floor, slabs that slide)
 {const n=3,a=z1-3.6,b=cz+13+4,span=(a-b)/n;let x=cx+rf(-6,6);for(let k=0;k<n;k++){const sz=Math.min(6.8,span-3.8),zz1=a-k*span,zz0=zz1-sz,h=BASEH+(top-BASEH)*(k+1)/(n+1)+rf(-1,1);x=Math.max(x0+8,Math.min(x1-8,x+rf(-7,7)));
   if(mv&&k===1)X.M.push({x,z:(zz0+zz1)/2,w:7,d:7,top:h,ax:'x',amp:rf(4,6),per:rf(4.5,6),ph:rnd()*6.28,i:X.M.length});else X.add(x-sz/2,x+sz/2,zz0,zz1,h,'step',{cp:k===1})}}
 // south: a narrow bridge off the island to the district below (or the plain's edge if there is none)
 if(!c.outer.s)X.add(cx-1.6,cx+1.6,z0,cz-13,top-.6,'bridge',{});
 // the middle-column side: a slab that slides between the edge and the island
 {const side=c.i===0?1:-1,ex=side>0?x1:x0,ix=side>0?cx+13:cx-13,mid=(ex+ix)/2,gap=Math.abs(ex-ix);X.M.push({x:mid,z:cz+(rnd()-.5)*8,w:8.5,d:8.5,top,ax:'x',amp:Math.max(3,gap/2-4.8),per:rf(5,7),ph:rnd()*6.28,i:X.M.length})}
 X.prop('sign',cx+(c.i===0?14:-14),z1+3,{txt:['THE GAP','Mind your step.','There is a lot of nothing down there.'],top:BASEH})};
// ---- the Gauntlet: a floor that had its own handmade run keeps it, down the whole east side below the first row: the run's own pieces in its
// own order (stepping stones, stairs, bridges, moving slabs, a zigzag, landings with a crew), over the abyss, ending on a landing beside the
// Arena. The plain to the west is the easy way; the Gauntlet is the floor as it was
BIGD_B.gauntlet=(p,X,c)=>{if(X.gDone)return;X.gDone=1;const L=X.SP&&X.SP.layout||['steps','plaza','stairs','bridge'];const rf=X.rf,ri=X.ri,rnd=X.rnd;const x0=c.x0+4,x1=c.x1-4,zTop=c.z1,zBot=-X.rows*BIGD,end=zBot+30;
 const cl=(x,w)=>Math.max(x0+w/2,Math.min(x1-w/2,x)),chH=h=>Math.max(BASEH-6,Math.min(BASEH+14,h));let cz=zTop,ch=BASEH,cx=(x0+x1)/2;const mark={stair:0,bridge:0,mover:0};
 // each piece only if it fits above the last landing (the run must end beside the Arena, not past it)
 for(let s=0;s<40;s++){const ty=L[s%L.length];const room=cz-end;if(room<30)break;
  if(ty==='steps'){const k=Math.min(3,Math.floor((room-10)/13));if(k<1)continue;for(let i=0;i<k;i++){const sz=rf(6.5,7.5),gap=rf(4,5.5),dh=rf(-2.5,2.5);const x=cl(cx+rf(-10,10),sz),z1=cz-gap,top=chH(ch+dh);X.add(x-sz/2,x+sz/2,z1-sz,z1,top,'step',{gnt:1});cz=z1-sz;ch=top;cx=x}}
  else if(ty==='plaza'){if(room<36)continue;const w=rf(24,32),d=Math.min(rf(16,22),room-14),gap=rf(4,6),top=chH(ch+rf(-2,2.5)),x=cl(cx+rf(-6,6),w);const q=X.add(x-w/2,x+w/2,cz-gap-d,cz-gap,top,'plaza',{cp:true,gnt:1,blocks:[],nopuz:1});
   const nb=ri(1,2);for(let b=0;b<nb;b++){const bw=rf(3,4.5),bd=rf(3,4.5),bx=rf(q.x0+bw,q.x1-bw),bz=rf(q.z0+bd+2,q.z1-bd-2);q.blocks.push({x0:bx-bw/2,x1:bx+bw/2,z0:bz-bd/2,z1:bz+bd/2,top:top+rf(1.4,3.2)})}
   X.G.push({pi:q.i,n:3+Math.floor(X.n/12)+X.up,kinds:X.kinds});cz=q.z0;ch=top;cx=x}
  else if(ty==='stairs'){const k=Math.min(ri(6,9),Math.floor((room-12)/3.2));if(k<3)continue;const w=rf(10,13),dir=ch<BASEH+2?1:ch>BASEH+10?-1:(rnd()<.5?1:-1),gap=rnd()<.5?0:rf(4,5),x=cl(cx+rf(-6,6),w);let z=cz-gap;
   for(let i=0;i<k;i++){const top=chH(ch+dir*1.2);X.add(x-w/2,x+w/2,z-3.2,z,top,'stair',{gnt:1});z-=3.2;ch=top;mark.stair++}cz=z;cx=x}
  else if(ty==='bridge'){const len=Math.min(rf(24,32),room-14);if(len<14)continue;const w=rf(4.2,5.5),gap=rf(4,6),top=chH(ch+rf(-1.5,1.5)),x=cl(cx+rf(-8,8),w);const q=X.add(x-w/2,x+w/2,cz-gap-len,cz-gap,top,'bridge',{gnt:1});X.G.push({pi:q.i,n:2+Math.floor(X.n/15),kinds:X.kinds});cz=q.z0;ch=top;cx=x;mark.bridge++}
  else if(ty==='movers'){if(room<40)continue;const span=rf(18,22),ax=rnd()<.5?'x':'y',top=chH(ch+rf(-1,1.5)),x=cl(cx,10);X.M.push({x,z:cz-span/2,w:8.5,d:8.5,top,ax,amp:ax==='x'?rf(6,10):rf(3,5),per:rf(4.5,6.5),ph:rnd()*6.28,i:X.M.length});
   const sz=rf(8,9);X.add(x-sz/2,x+sz/2,cz-span-sz,cz-span,top,'step',{gnt:1,cp:true});cz=cz-span-sz;ch=top;cx=x;mark.mover++}
  else if(ty==='zigzag'){const k=Math.min(3,Math.floor((room-10)/14));if(k<1)continue;let side=rnd()<.5?-1:1;for(let i=0;i<k;i++){const w=rf(5,7),d=rf(8,9.5),gap=rf(3,4.5),x=cl((x0+x1)/2+side*rf(8,16),w),top=chH(ch+rf(-2,2));X.add(x-w/2,x+w/2,cz-gap-d,cz-gap,top,'step',{gnt:1});cz-=gap+d;ch=top;cx=x;side=-side}}}
 // the last landing: level with the Arena and up against it; stairs down (or up) to its level first, if the run ended high or low
 if(Math.abs(ch-BASEH)>1.3){const dir=ch>BASEH?-1:1,x=cl(cx,10);let z=cz-2;while(Math.abs(ch-BASEH)>1.3&&z-3.2>zBot+16){ch+=dir*1.2;X.add(x-5,x+5,z-3.2,z,ch,'stair',{gnt:1});z-=3.2}cz=z}
 const fz1=cz-(Math.abs(ch-BASEH)>1.3?3:0),fx0=c.x0,fx1=Math.max(c.x0+30,Math.min(x1,cx+6));const fin=X.add(fx0,fx1,Math.min(zBot,fz1-16),fz1,BASEH,'plaza',{cp:true,gnt:1,blocks:[],nopuz:1,gend:1});X.chests.push({x:fx0+6,z:(fin.z0+fin.z1)/2,top:BASEH,src:'chest',rot:-Math.PI/2});
 X.prop('sign',(x0+x1)/2,zTop-3,{txt:['THE GAUNTLET','The floor the way it was.','The plain is the easy way round.'],top:BASEH});X.gMark=mark};
// ---- the Cookout: Uncle Earl's backyard. A fence with gaps, two grills smoking, picnic tables, the DJ table and its speakers (they thump),
// coolers, lawn chairs, the spades table; crashers to clear; Uncle Earl has a job for you
BIGD_B.cookout=(p,X)=>{const [cx,cz]=X.C(p),blk=X.blk,prop=X.prop,rf=X.rf;const fx0=p.x0+10,fx1=p.x1-10,fz0=p.z0+10,fz1=p.z1-10,h=2.4,T=.4;
 const fence=(a,b,cc,d)=>blk(p,a,b,cc,d,h,{fence:1,nobrick:1,picket:1});fence(fx0,cx-6,fz1-T,fz1);fence(cx+6,fx1,fz1-T,fz1);fence(fx0,cx-10,fz0,fz0+T);fence(cx+10,fx1,fz0,fz0+T);fence(fx0,fx0+T,fz0,cz-6);fence(fx0,fx0+T,cz+6,fz1);fence(fx1-T,fx1,fz0,cz-6);fence(fx1-T,fx1,cz+6,fz1);
 prop('grill',cx-18,cz+18);prop('grill',cx-10,cz+20);blk(p,cx-20,cx-8,cz+16.5,cz+21.5,1.1,{prop:1,nobrick:1,deck:1});
 for(let k=0;k<4;k++){const x=cx+6+k*9,z=cz+12;blk(p,x-2,x+2,z-1.2,z+1.2,1,{prop:1,nobrick:1});prop('ptable',x,z)}
 blk(p,cx+18,cx+30,cz-24,cz-18,1.2,{nobrick:1,deck:1});prop('djbooth',cx+24,cz-21);(X.djs||(X.djs=[])).push([cx+24,cz-21]);prop('speaker',cx+16,cz-22);prop('speaker',cx+32,cz-22);
 prop('spades',cx-22,cz-14);blk(p,cx-24,cx-20,cz-16,cz-12,1,{prop:1,nobrick:1});for(let k=0;k<5;k++)prop('cooler',cx-30+k*3.2,cz-28);for(let k=0;k<6;k++){const a=k/6*Math.PI*2;prop('chair',cx+Math.cos(a)*7,cz+Math.sin(a)*6,{face:-a})}
 prop('sign',cx,fz1+3,{txt:['THE COOKOUT','Uncle Earl\'s backyard','Invitation required (laminated)']});prop('lamp',fx0+4,fz1-4);prop('lamp',fx1-4,fz0+4);
 X.camp(p,cx+4,cz-6,14,5,{crash:1});X.chests.push({x:fx1-5,z:fz1-5,top:p.top,src:'chest',rot:Math.PI*.75});X.people.push({kind:'doubloon',x:cx-14,z:cz+14,yaw:Math.PI*.75,name:'Uncle Earl',q:'cookout'})};
// ---- the Court: a full court (lines on the ground, two hoops, bleachers); jump through a hoop for a dunk (the first on each hoop pays);
// a crew running the court; a chest under the bleachers
BIGD_B.court=(p,X)=>{const [cx,cz]=X.C(p),blk=X.blk,prop=X.prop;prop('court',cx,cz);[[cz+31,1],[cz-31,-1]].forEach(([z,dir])=>{prop('hoop',cx,z,{dir});(X.hoops||(X.hoops=[])).push({x:cx,z,y:p.top+4.2,i:(X.hoops||[]).length})});
 for(let s=0;s<3;s++){blk(p,cx+24+s*2.6,cx+26.6+s*2.6,cz-22,cz+22,1.1*(s+1),{bleach:1,nobrick:1});blk(p,cx-26.6-s*2.6,cx-24-s*2.6,cz-22,cz+22,1.1*(s+1),{bleach:1,nobrick:1})}
 const T=.3,h=3.6;[[cx-36,cx+36,cz+40,cz+40+T],[cx-36,cx+36,cz-40-T,cz-40]].forEach(([a,b,cc,d])=>{blk(p,a,cx-5,cc,d,h,{fence:1,nobrick:1,chain:1});blk(p,cx+5,b,cc,d,h,{fence:1,nobrick:1,chain:1})});
 X.camp(p,cx,cz,20,6);X.chests.push({x:cx+33,z:cz+26,top:p.top,src:'chest',rot:-Math.PI/2});X.people.push({kind:'samurai',x:cx-34,z:cz+8,yaw:Math.PI/2,name:'Coach Cash',q:'court'});prop('sign',cx-30,cz+44,{txt:['THE COURT','Jump through a hoop:','that is a dunk. Dunks pay.']});prop('lamp',cx-38,cz-38);prop('lamp',cx+38,cz+38)};
// a roofed room (the mausoleum, the back-stairs hut): its roof is only drawn, so its walls go on up out of sight to 27 (past any jump: nobody
// lands on the roof and drops through it), and an unseen lintel stands over the loose bricks until they are pushed in (doorOpen takes it)
function roofWalls(p,X,segs,door){segs.forEach(([a,b,c,d])=>X.blk(p,a,b,c,d,27,{wall:1,nobrick:1,unseen:1}));if(door)door.lintel=X.blk(p,door.x0,door.x1,door.z0,door.z1,27,{wall:1,nobrick:1,unseen:1})}
// ---- the Boneyard: rows of headstones, dead trees, a mausoleum with loose bricks in its door (a secret chest inside), the dead walking
BIGD_B.yard=(p,X)=>{const [cx,cz]=X.C(p),blk=X.blk,prop=X.prop,rf=X.rf,ri=X.ri;for(let j=0;j<5;j++)for(let i=0;i<7;i++){if(X.rnd()<.2)continue;const x=p.x0+14+i*11+rf(-1,1),z=p.z1-14-j*13+rf(-1,1);if(Math.hypot(x-(cx+22),z-(cz-20))<14)continue;const h=rf(1.2,2.4);blk(p,x-.8,x+.8,z-.25,z+.25,h,{tomb:1,nobrick:1});prop('tomb',x,z,{h,v:ri(0,2)})}
 const mx=cx+22,mz=cz-20,s=5,wt=1,h=7;const w=(a,b,cc,d,o)=>blk(p,a,b,cc,d,h,Object.assign({wall:1,keep:1},o||{}));w(mx-s,mx+s,mz-s,mz-s+wt);w(mx-s,mx-s+wt,mz-s,mz+s);w(mx+s-wt,mx+s,mz-s,mz+s);w(mx-s,mx-1.6,mz+s-wt,mz+s);w(mx+1.6,mx+s,mz+s-wt,mz+s);
 const dr=w(mx-1.6,mx+1.6,mz+s-wt,mz+s,{sdoor:1,face:0});p.xchest={x:mx,z:mz-1,src:'secret'};p.sealedM=[mx,mz,s];prop('mausoleum',mx,mz,{s});
 roofWalls(p,X,[[mx-s,mx+s,mz-s,mz-s+wt],[mx-s,mx-s+wt,mz-s,mz+s],[mx+s-wt,mx+s,mz-s,mz+s],[mx-s,mx-1.6,mz+s-wt,mz+s],[mx+1.6,mx+s,mz+s-wt,mz+s]],dr);
 for(let k=0;k<7;k++)prop('deadtree',rf(p.x0+8,p.x1-8),rf(p.z0+8,p.z1-8),{s:rf(.8,1.3)});X.people.push({kind:'zombie',x:p.x0+12,z:p.z1-12,yaw:Math.PI*.75,name:'Reverend Bones',q:'yard'});X.camp(p,cx-10,cz+4,22,7,{kinds:['zombie','zombie','stink']});prop('sign',p.x0+10,p.z1-4,{txt:['THE BONEYARD','Visiting hours: never.','Do not touch the mausoleum.']})};
// ---- the Junkyard: wrecks stacked to climb, tire piles, a crane with a magnet, scrap; a crew; a chest on top of the big stack
BIGD_B.junk=(p,X)=>{const [cx,cz]=X.C(p),blk=X.blk,prop=X.prop,rf=X.rf;for(let k=0;k<10;k++){const x=rf(p.x0+10,p.x1-10),z=rf(p.z0+10,p.z1-10);if(Math.hypot(x-cx,z-cz)<16)continue;const a=X.rnd()<.5?0:Math.PI/2,w=a?2.4:5.2,d=a?5.2:2.4;blk(p,x-w/2,x+w/2,z-d/2,z+d/2,1.5,{nobrick:1});prop('wreck',x,z,{a,c:k%4})}
 // the big stack: three wrecks up, each a step (a jump) above the last, a chest on top
 [[0,0,1.5],[3.2,0,3.0],[6.4,0,4.5],[6.4,3.6,6.0]].forEach(([dx,dz,h],i)=>{blk(p,cx-2.6+dx,cx+2.6+dx,cz-1.2+dz,cz+1.2+dz,h,{nobrick:1,stack:1});prop('wreck',cx+dx,cz+dz,{a:0,c:i,y:h-1.5})});X.chests.push({x:cx+6.4,z:cz+3.6,top:p.top+6,src:'chest',rot:0});
 for(let k=0;k<6;k++){const x=rf(p.x0+8,p.x1-8),z=rf(p.z0+8,p.z1-8),n=1+((k*7)%3);blk(p,x-1.2,x+1.2,z-1.2,z+1.2,.55*n,{nobrick:1});prop('tires',x,z,{n})}
 prop('crane',p.x0+16,p.z0+16);X.camp(p,cx-16,cz-16,16,6);prop('sign',p.x1-10,p.z1-4,{txt:['THE JUNKYARD','Everything here ran once.','Some of it still does.']})};
// ---- the Chapel: the church stands on its own ground here; nobody spawns in it
BIGD_B.chapel=(p,X)=>{p.church=1;p.blocks=[];const [cx,cz]=X.C(p);X.prop('lamp',cx-30,cz+30);X.prop('lamp',cx+30,cz+30);X.prop('sign',cx-20,p.z1-4,{txt:['THE CHAPEL','Service at eleven.','Do not press the buttons.']})};
// ---------------------------------------------------------------- what the new districts look like (the still pieces of each material drawn
// together; the grills smoke, the turntables turn, the speakers thump, the back stairs glow)
function txCourt(){if(ITX.court)return ITX.court;const W=1024,H=1024,c=itCanvas(W,H),g=c.getContext('2d'),r=itRng(201);
 for(let i=0;i<W;i+=32){const k=.85+r()*.25;g.fillStyle='rgb('+(196*k|0)+','+(140*k|0)+','+(78*k|0)+')';g.fillRect(i,0,32,H);g.fillStyle='rgba(60,30,10,.25)';g.fillRect(i,0,1.5,H);for(let y=r()*200;y<H;y+=150+r()*200){g.fillRect(i,y,32,1.2)}}
 for(let i=0;i<9000;i++){g.fillStyle='rgba(80,40,10,'+(r()*.08)+')';g.fillRect(r()*W,r()*H,2,1)}
 g.strokeStyle='#f8f4ea';g.lineWidth=7;g.strokeRect(40,40,W-80,H-80);g.beginPath();g.moveTo(40,H/2);g.lineTo(W-40,H/2);g.stroke();g.beginPath();g.arc(W/2,H/2,110,0,7);g.stroke();
 g.fillStyle='rgba(122,26,30,.85)';g.beginPath();g.arc(W/2,H/2,104,0,7);g.fill();g.fillStyle='#ffd040';g.font='900 54px Georgia,serif';g.textAlign='center';g.fillText('78',W/2,H/2+18);
 [[40,1],[H-40,-1]].forEach(([y,s])=>{g.fillStyle='rgba(122,26,30,.85)';g.fillRect(W/2-120,s>0?y:y-260,240,260);g.strokeRect(W/2-120,s>0?y:y-260,240,260);g.beginPath();g.arc(W/2,y+s*260,120,s>0?0:Math.PI,s>0?Math.PI:Math.PI*2);g.stroke();
  g.beginPath();g.arc(W/2,y+s*30,380,s>0?.25:Math.PI+.25,s>0?Math.PI-.25:Math.PI*2-.25);g.stroke()});
 return ITX.court={map:itTex(c)}}
function txChain(){if(ITX.chain)return ITX.chain;const c=itCanvas(64),g=c.getContext('2d');g.clearRect(0,0,64,64);g.strokeStyle='rgba(230,235,240,1)';g.lineWidth=3;g.beginPath();g.moveTo(0,32);g.lineTo(32,0);g.lineTo(64,32);g.lineTo(32,64);g.closePath();g.stroke();const t=itTex(c,false,1,1);return ITX.chain=t}
function txCheck(){if(ITX.check)return ITX.check;const c=itCanvas(128,128),g=c.getContext('2d');for(let i=0;i<8;i++)for(let j=0;j<8;j++){g.fillStyle=(i+j)%2?'#c81e22':'#f6efe2';g.fillRect(i*16,j*16,16,16)}return ITX.check={map:itTex(c,false,2,2)}}
function txRust(k){const key='rust'+k;if(ITX[key])return ITX[key];const c=itCanvas(256,256),g=c.getContext('2d'),r=itRng(300+k);const base=['#7a2a1a','#2a4a7a','#3a5a2a','#8a7a3a'][k%4];g.fillStyle=base;g.fillRect(0,0,256,256);
 for(let i=0;i<120;i++){g.fillStyle='rgba('+(120+r()*60|0)+','+(50+r()*30|0)+',20,'+(.2+r()*.5)+')';g.beginPath();g.arc(r()*256,r()*256,4+r()*26,0,7);g.fill()}for(let i=0;i<3000;i++){g.fillStyle='rgba(30,14,6,'+(r()*.3)+')';g.fillRect(r()*256,r()*256,2,2)}
 return ITX[key]={map:itTex(c),nm:itNormal(c,3)}}
function txGround(k){const key='gr'+k;if(ITX[key])return ITX[key];const c=itCanvas(256),g=c.getContext('2d'),r=itRng(k.length*97+5);
 const base={grass:'#3c6a24',lawn:'#4a7a2a',dead:'#5a5a2e',dirt:'#6a4a2a',sand:'#b8955a',asph:'#2c2c2e',gravel:'#6a6460'}[k]||'#555';g.fillStyle=base;g.fillRect(0,0,256,256);
 if(k==='grass'||k==='lawn'||k==='dead'){for(let i=0;i<9000;i++){const x=r()*256,y=r()*256,l=2+r()*5;g.strokeStyle=k==='dead'?'rgba('+(110+r()*60|0)+','+(100+r()*40|0)+',40,.5)':'rgba('+(30+r()*50|0)+','+(90+r()*80|0)+','+(20+r()*30|0)+',.55)';g.lineWidth=1;g.beginPath();g.moveTo(x,y);g.lineTo(x+(r()-.5)*2,y-l);g.stroke()}
  if(k==='lawn')for(let i=0;i<8;i++){g.fillStyle='rgba(255,255,255,.035)';g.fillRect(i*32,0,16,256)}}
 else if(k==='asph'){for(let i=0;i<14000;i++){const v=40+r()*50|0;g.fillStyle='rgba('+v+','+v+','+(v+4)+',.6)';g.fillRect(r()*256,r()*256,1.5,1.5)}}
 else{for(let i=0;i<7000;i++){const v=r();g.fillStyle=k==='sand'?'rgba('+(200+v*40|0)+','+(160+v*40|0)+','+(100+v*30|0)+',.5)':k==='gravel'?'rgba('+(80+v*90|0)+','+(78+v*80|0)+','+(70+v*70|0)+',.8)':'rgba('+(70+v*60|0)+','+(45+v*40|0)+',20,.5)';const s=k==='gravel'?1+r()*3:1+r()*2;g.fillRect(r()*256,r()*256,s,s)}}
 const t=itTex(c,false,24,24);return ITX[key]={map:t,nm:itNormal(c,k==='gravel'?2.5:1.2,24,24)}}
// one material for each look (a prop's colours and textures), shared by every copy of it on every floor: a few draws, not hundreds
const SMBC={};function SMB(o){const k=JSON.stringify(o,(key,v)=>v&&v.isTexture?'tex:'+v.uuid:v);return SMBC[k]||(SMBC[k]=new THREE.MeshStandardMaterial(o))}
function bigLook(F,G){if(!F.bigf)return;const L=new THREE.Group(),K=new THREE.Group();G.add(L);G.add(K);F.blive=F.blive||[];const wm=woodMat(),sm=stoneMat(),gold=itMat('goldP'),iron=itMat('iron'),blk=itMat('black'),chrome=itMat('chrome');
 const M=(geo,mat,x,y,z,rx,ry,rz,par)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);if(rx||ry||rz)m.rotation.set(rx||0,ry||0,rz||0);(par||L).add(m);return m};const topAt=(x,z)=>towerH(x,z);
 const smokeM=new THREE.SpriteMaterial({map:itGlowTex(),color:0xd8d0c8,transparent:true,opacity:.2,depthWrite:false});const glow=(x,y,z,col,s,op)=>{const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:itGlowTex(),color:col,transparent:true,opacity:op||.5,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));sp.position.set(x,y,z);sp.scale.set(s,s,1);K.add(sp);return sp};
 const rib=SMB({color:0x6a2a10,roughness:.45,metalness:0}),dog=SMB({color:0xb05a30,roughness:.4}),coal=SMB({color:0x2a1008,emissive:0xff4a10,emissiveIntensity:1.6}),plate=SMB({color:0xf8f6f0,roughness:.3});
 const stone=SMB({color:0x8a8a86,roughness:.9,map:stoneSet().map}),moss=SMB({color:0x4a5a3a,roughness:.95});
 // the ground of each district: a lawn at the cookout, grass in the gardens, dead grass in the Boneyard, dirt in the camp and the quarry,
 // sand in the arena, gravel in the junkyard, asphalt on the Loop
 const GK={cookout:'lawn',garden:'grass',yard:'dead',camp:'dirt',quarry:'dirt',arena:'sand',junk:'gravel',loop:'asph'};
 F.P.forEach(p=>{const k=GK[p.wide];if(!k||!p.cell)return;const T=txGround(k),w=p.x1-p.x0,d=p.z1-p.z0;const m=new THREE.Mesh(new THREE.PlaneGeometry(w-.2,d-.2),SMB({map:T.map,normalMap:T.nm,roughness:.95,metalness:0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
  m.material.map.repeat.set(w/8,d/8);m.material.normalMap.repeat.set(w/8,d/8);m.rotation.x=-Math.PI/2;m.position.set((p.x0+p.x1)/2,p.top+.025,(p.z0+p.z1)/2);m.receiveShadow=true;K.add(m)});
 // the blocks drawn as what they are: picket fences, chain-link, wooden bleachers and decks
 const pk=SMB({color:0xf4f1ea,roughness:.6}),chainM=SMB({color:0xc8ccd2,metalness:.8,roughness:.35,transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false}),post=itMat('steel');
 F.P.forEach(p=>(p.blocks||[]).forEach(b=>{if(!b.nobrick)return;const w=b.x1-b.x0,d=b.z1-b.z0,h=b.top-p.top,cx=(b.x0+b.x1)/2,cz=(b.z0+b.z1)/2,along=w>d,L=Math.max(w,d);
  if(b.picket){const n=Math.max(2,Math.round(L/.45));for(let k=0;k<n;k++){const t=-L/2+(k+.5)*L/n;M(new THREE.BoxGeometry(along?.32:.12,h*.92,along?.12:.32),pk,cx+(along?t:0),p.top+h*.46,cz+(along?0:t))}
   [h*.3,h*.72].forEach(y=>M(new THREE.BoxGeometry(along?L:.08,.16,along?.08:L),pk,cx,p.top+y,cz))}
  else if(b.chain){const n=Math.max(2,Math.round(L/3));for(let k=0;k<=n;k++){const t=-L/2+k*L/n;M(new THREE.CylinderGeometry(.06,.06,h,8),post,cx+(along?t:0),p.top+h/2,cz+(along?0:t))}M(new THREE.CylinderGeometry(.05,.05,L,8),post,cx,p.top+h,cz,along?0:Math.PI/2,0,along?Math.PI/2:0);
   const pl=M(new THREE.PlaneGeometry(L,h),chainM,cx,p.top+h/2,cz,0,along?0:Math.PI/2,0,K);pl.material.map=pl.material.map||txChain();pl.material.map.repeat.set(L/1.2,h/1.2)}
  else if(b.bleach||b.deck)M(itRBox(w,h,d,.06,2),itMat('wood'),cx,p.top+h/2,cz)}));
 F.props.forEach(o=>{const y0=o.top!=null?o.top:topAt(o.x,o.z),x=o.x,z=o.z;
  if(o.k==='grill'){[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a,b])=>M(new THREE.CylinderGeometry(.06,.06,1.1,6),iron,x+a*.7,y0+.55,z+b*.4));const bar=M(new THREE.CylinderGeometry(.6,.6,1.8,24,1,false,0,Math.PI),blk,x,y0+1.25,z,0,0,Math.PI/2);bar.scale.set(1,1,1);
   const lid=M(new THREE.CylinderGeometry(.6,.6,1.8,24,1,false,0,Math.PI),blk,x,y0+1.25,z-.6,Math.PI*.35,0,Math.PI/2);M(new THREE.BoxGeometry(1.7,.04,1.1),iron,x,y0+1.3,z);for(let k=0;k<6;k++)M(new THREE.BoxGeometry(.18,.08,.9),coal,x-.6+k*.24,y0+.95,z);
   M(new THREE.BoxGeometry(.9,.12,.5),rib,x-.35,y0+1.38,z);for(let k=0;k<4;k++)M(new THREE.CylinderGeometry(.05,.05,.5,8),dog,x+.35+k*.12,y0+1.36,z,Math.PI/2,0,0);glow(x,y0+1.1,z,0xff6a20,2.2,.35);
   const pf=[];for(let k=0;k<5;k++){const s=new THREE.Sprite(smokeM.clone());s.position.set(x,y0+1.6,z);K.add(s);pf.push(s)}F.blive.push(t=>{pf.forEach((s,k)=>{const q=(t*.35+k/5)%1;s.position.set(x+Math.sin(t*.7+k)*.4*q,y0+1.6+q*5,z+q*.6);const sc=.6+q*2.4;s.scale.set(sc,sc,1);s.material.opacity=Math.sin(q*Math.PI)*.22})})}
  else if(o.k==='ptable'){M(new THREE.BoxGeometry(4,.12,2.2),wm,x,y0+1.05,z);M(new THREE.PlaneGeometry(4.1,2.3),SMB({map:txCheck().map,roughness:.8}),x,y0+1.115,z,-Math.PI/2,0,0);
   [-1,1].forEach(s=>{M(new THREE.BoxGeometry(4,.1,.5),wm,x,y0+.6,z+s*1.5);[-1.6,1.6].forEach(a=>M(new THREE.BoxGeometry(.12,1.05,.12),wm,x+a,y0+.52,z+s*.8,s*.45,0,0))});
   for(let k=0;k<3;k++){M(new THREE.CylinderGeometry(.3,.26,.04,16),plate,x-1.2+k*1.2,y0+1.14,z-.4);M(new THREE.CylinderGeometry(.09,.07,.24,10),SMB({color:k%2?0xc81e22:0x2a6ad8,roughness:.4}),x-1+k*1.2,y0+1.24,z+.5)}}
  else if(o.k==='djbooth'){M(new THREE.BoxGeometry(5,1.1,1.6),blk,x,y0+.55,z);M(new THREE.BoxGeometry(5.1,.08,1.7),SMB({color:0x3a3a40,metalness:.75,roughness:.32}),x,y0+1.12,z);const tt=[];[-1.4,1.4].forEach(a=>{M(new THREE.BoxGeometry(1.3,.12,1.2),SMB({color:0x2a2a2e,metalness:.5,roughness:.4}),x+a,y0+1.2,z);
     const d=M(new THREE.CylinderGeometry(.5,.5,.03,32),itMat('vinyl'),x+a,y0+1.28,z,0,0,0,K);const lb=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,.035,24),SMB({color:a<0?0xc81e22:0xe0a020,roughness:.5}));lb.position.y=.002;d.add(lb);const sp=new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,.08,8),chrome);sp.position.y=.03;d.add(sp);tt.push(d);
     M(new THREE.CylinderGeometry(.02,.02,.7,8),chrome,x+a+.5,y0+1.36,z-.15,Math.PI/2,0,.5);M(new THREE.CylinderGeometry(.05,.05,.1,12),chrome,x+a+.55,y0+1.3,z-.45);M(new THREE.BoxGeometry(.08,.04,.14),blk,x+a+.33,y0+1.36,z+.17)});
   {const bn=new THREE.Mesh(new THREE.PlaneGeometry(4.6,.8),new THREE.MeshBasicMaterial({map:wSignTex(['DJ UNCLE EARL','EST. 1979 · NO REQUESTS'],4.6,.8,'#2a0a3a','#ffd040')}));bn.position.set(x,y0+.6,z+.81);K.add(bn);
    for(let k=0;k<14;k++)M(new THREE.SphereGeometry(.06,8,6),SMB({color:0xffffff,emissive:[0xff3060,0xffd040,0x40a0ff][k%3],emissiveIntensity:2}),x-2.35+k*(4.7/13),y0+1.06,z+.84)}M(new THREE.BoxGeometry(.8,.14,.9),SMB({color:0x101014,metalness:.4,roughness:.4}),x,y0+1.22,z);
   for(let k=0;k<6;k++)M(new THREE.CylinderGeometry(.04,.04,.06,8),SMB({color:0xffffff,emissive:[0xff2050,0x20ff80,0x2080ff][k%3],emissiveIntensity:2}),x-.3+(k%3)*.3,y0+1.31,z-.25+((k/3)|0)*.5);F.blive.push(t=>{tt.forEach(d=>d.rotation.y=t*3.5)});
   const sp=glow(x,y0+2.2,z,0xff40c0,6,.18);F.blive.push(t=>{sp.material.color.setHSL((t*.15)%1,.9,.6)})}
  else if(o.k==='speaker'){M(new THREE.BoxGeometry(2,3.4,1.6),blk,x,y0+1.7,z);M(new THREE.BoxGeometry(1.84,3.24,.04),SMB({color:0x0c0c0e,roughness:.85}),x,y0+1.7,z+.8);[[-1,0],[1,0],[-1,1],[1,1]].forEach(([sx,sy])=>M(new THREE.BoxGeometry(.24,.24,.24),iron,x+sx*.92,y0+.12+sy*3.16,z+.7));const cones=[];[[0,2.5,.5],[0,1.1,.9]].forEach(([a,b,s])=>{M(new THREE.TorusGeometry(s,.08,8,28),chrome,x+a,y0+b,z+.82);const c=M(new THREE.ConeGeometry(s*.92,.35,28,1,true),SMB({color:0x1a1a1c,roughness:.7,side:THREE.DoubleSide}),x+a,y0+b,z+.7,-Math.PI/2,0,0,K);const cap=new THREE.Mesh(new THREE.SphereGeometry(s*.24,16,8,0,Math.PI*2,0,Math.PI/2),SMB({color:0x2a2a30,roughness:.3,metalness:.3}));cap.position.y=-.1;cap.rotation.x=Math.PI;c.add(cap);cones.push(c)});
   F.blive.push(t=>{const k=Math.max(0,Math.sin(t*12.6))**6;cones.forEach(c=>{c.scale.set(1,1+k*.5,1)})})}
  else if(o.k==='spades'){M(new THREE.CylinderGeometry(1.1,1.1,.08,24),SMB({color:0x1a5a2a,roughness:.8}),x,y0+1.02,z);M(new THREE.CylinderGeometry(.08,.12,1,8),iron,x,y0+.5,z);
   for(let k=0;k<4;k++){const a=k/4*Math.PI*2;M(new THREE.BoxGeometry(.6,.05,.6),wm,x+Math.cos(a)*1.6,y0+.55,z+Math.sin(a)*1.6);M(new THREE.BoxGeometry(.6,.7,.06),wm,x+Math.cos(a)*1.9,y0+.9,z+Math.sin(a)*1.9,0,-a+Math.PI/2,0)}
   for(let k=0;k<9;k++)M(new THREE.BoxGeometry(.18,.01,.26),SMB({color:k%3?0xf8f6f0:0xc81e22,roughness:.5}),x-.4+(k%3)*.3,y0+1.07+k*.004,z-.3+((k/3)|0)*.3,0,k*.4,0)}
  else if(o.k==='cooler'){const col=[0xc81e22,0x2a6ad8,0xe8e4d8][(Math.round(x)&3)%3];M(itRBox(1.3,.8,.8,.1,3),new THREE.MeshPhysicalMaterial({color:col,roughness:.35,clearcoat:.5}),x,y0+.4,z);M(itRBox(1.36,.16,.86,.06,2),SMB({color:0xf4f2ee,roughness:.4}),x,y0+.86,z)}
  else if(o.k==='chair'){const f=o.face||0,fr=SMB({color:0xc8ccd2,metalness:.8,roughness:.3}),wb=SMB({color:[0x2a8a4a,0x2a6ad8,0xe0a020][(Math.round(z)&3)%3],roughness:.7,side:THREE.DoubleSide});
   const g=new THREE.Group();g.position.set(x,y0,z);g.rotation.y=f;L.add(g);M(new THREE.BoxGeometry(.9,.06,.8),wb,0,.5,0,0,0,0,g);M(new THREE.BoxGeometry(.9,.9,.06),wb,0,.95,-.42,-.25,0,0,g);[-1,1].forEach(s=>{M(new THREE.CylinderGeometry(.03,.03,1.2,6),fr,s*.45,.45,0,.6,0,0,g);M(new THREE.CylinderGeometry(.03,.03,1.2,6),fr,s*.45,.45,0,-.6,0,0,g)})}
  else if(o.k==='court'){const c=M(new THREE.PlaneGeometry(64,78),SMB({map:txCourt().map,roughness:.45,metalness:0,envMapIntensity:.6}),x,y0+.03,z,-Math.PI/2,0,0);c.receiveShadow=true}
  else if(o.k==='hoop'){const s=o.dir||1;M(new THREE.CylinderGeometry(.16,.2,5.4,12),iron,x,y0+2.7,z+s*2.4);M(new THREE.BoxGeometry(.3,.3,1.7),iron,x,y0+5.2,z+s*1.6);
   M(new THREE.BoxGeometry(3.2,2,.12),new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.1,transmission:.4,transparent:true,clearcoat:1}),x,y0+5,z+s*.78);M(new THREE.BoxGeometry(1.1,.8,.13),new THREE.MeshBasicMaterial({color:0xff5a10}),x,y0+4.6,z+s*.71);
   M(new THREE.BoxGeometry(.3,.08,.2),SMB({color:0xff5a10,metalness:.6,roughness:.35}),x,y0+4.2,z+s*.66);const rim=M(new THREE.TorusGeometry(.62,.05,10,32),SMB({color:0xff5a10,metalness:.6,roughness:.35}),x,y0+4.2,z,Math.PI/2,0,0);const net=M(new THREE.CylinderGeometry(.6,.36,.9,16,3,true),new THREE.MeshBasicMaterial({color:0xffffff,wireframe:true,transparent:true,opacity:.8}),x,y0+3.75,z);
   (F.hoopG||(F.hoopG=[])).push(net)}
  else if(o.k==='tomb'){const h=o.h||1.6,v=o.v|0;M(new THREE.BoxGeometry(1.5,h-.4,.45),stone,x,y0+(h-.4)/2,z);if(v===0)M(new THREE.CylinderGeometry(.75,.75,.45,20,1,false,0,Math.PI),stone,x,y0+h-.4,z,Math.PI/2,0,Math.PI/2);else if(v===1){M(new THREE.BoxGeometry(.25,.9,.3),stone,x,y0+h+.05,z);M(new THREE.BoxGeometry(.8,.25,.3),stone,x,y0+h+.15,z)}else M(new THREE.ConeGeometry(.5,.8,4),stone,x,y0+h,z,0,Math.PI/4,0);
   M(new THREE.BoxGeometry(1.6,.2,.9),moss,x,y0+.1,z+.3)}
  else if(o.k==='mausoleum'){const s=o.s||5;M(new THREE.BoxGeometry(s*2+1,.8,s*2+1),sm,x,y0+7.4,z);const sh=new THREE.Shape();sh.moveTo(-s-.5,0);sh.lineTo(0,2.2);sh.lineTo(s+.5,0);sh.lineTo(-s-.5,0);const rg=new THREE.ExtrudeGeometry(sh,{depth:s*2+1,bevelEnabled:false});rg.translate(0,0,-(s*2+1)/2);M(rg,sm,x,y0+7.8,z);
   [-1,1].forEach(a=>M(new THREE.CylinderGeometry(.35,.4,7,14),sm,x+a*2.6,y0+3.5,z+s+.4));const t=M(new THREE.PlaneGeometry(5,1.1),new THREE.MeshBasicMaterial({map:wSignTex(['THE FAMILY'],5,1.1,'#5a5a56','#2a2a28')}),x,y0+7.4,z+s+.52,0,0,0,K)}
  else if(o.k==='deadtree'){const s=o.s||1,bk=SMB({color:0x2a2018,roughness:.95});M(new THREE.CylinderGeometry(.18*s,.38*s,5*s,8),bk,x,y0+2.5*s,z,0,0,.08);for(let k=0;k<5;k++){const a=k*1.3+x,h=2.6+k*.5;M(new THREE.CylinderGeometry(.05*s,.12*s,2.4*s,6),bk,x+Math.cos(a)*.6*s,y0+h*s,z+Math.sin(a)*.6*s,Math.sin(a)*.9,0,Math.cos(a)*.9)}}
  else if(o.k==='wreck'){const T=txRust(o.c|0),mat=SMB({map:T.map,normalMap:T.nm,metalness:.55,roughness:.6}),g=new THREE.Group();g.position.set(x,y0+(o.y||0),z);g.rotation.y=o.a||0;L.add(g);
   M(itRBox(5,.9,2.2,.3,3),mat,0,.75,0,0,0,0,g);M(itRBox(2.6,.75,2,.3,3),mat,-.2,1.5,0,0,0,0,g);M(new THREE.BoxGeometry(2.3,.6,2.02),SMB({color:0x101418,roughness:.2,metalness:.3}),-.2,1.5,0,0,0,0,g);
   [[-1.7,1],[1.7,1],[-1.7,-1],[1.7,-1]].forEach(([a,b],k)=>{if(k===2)return;M(new THREE.CylinderGeometry(.42,.42,.3,16),itMat('rubber'),a,.35,b*1.05,Math.PI/2,0,0,g)})}
  else if(o.k==='mpad'){M(new THREE.CylinderGeometry(3.6,3.8,.16,40),SMB({color:0x2a2a30,roughness:.5,metalness:.3}),x,y0+.08,z);M(new THREE.TorusGeometry(3.3,.08,8,48),SMB({color:0xffd040,emissive:0xffa020,emissiveIntensity:.8}),x,y0+.17,z,Math.PI/2,0,0);
   const t=M(new THREE.CircleGeometry(2.4,40),new THREE.MeshBasicMaterial({map:wSignTex(['M'],2,2,'#1a5a20','#ff5060'),transparent:true}),x,y0+.17,z,-Math.PI/2,0,0,K);
   for(let k=0;k<6;k++){const a=k/6*Math.PI*2;const l=M(new THREE.SphereGeometry(.12,10,8),SMB({color:0xffffff,emissive:0x40ff60,emissiveIntensity:2}),x+Math.cos(a)*3.45,y0+.22,z+Math.sin(a)*3.45,0,0,0,K);F.blive.push(tt=>{l.visible=((tt*3|0)%6)!==k})}}
  else if(o.k==='tires'){for(let k=0;k<(o.n||1);k++)M(new THREE.TorusGeometry(.8,.3,10,24),itMat('rubber'),x+Math.sin(k*2.1)*.08,y0+.3+k*.55,z,Math.PI/2,0,k*.4)}
  else if(o.k==='backstairs'){M(new THREE.BoxGeometry(7.4,.5,7.4),sm,x,y0+6.25,z);const sg=new THREE.Mesh(new THREE.PlaneGeometry(4.6,1.2),new THREE.MeshBasicMaterial({map:wSignTex(['STAFF ONLY','(the back stairs)'],4.6,1.2,'#1a1a1a','#e0e0e0')}));
   const f=o.face,d=3.3;sg.position.set(x+(f==='e'?d:f==='w'?-d:0),y0+5,z+(f==='n'?d:f==='s'?-d:0));sg.rotation.y=f==='e'?Math.PI/2:f==='w'?-Math.PI/2:f==='s'?Math.PI:0;K.add(sg);
   {const d2=f==='n'?[0,-1]:f==='s'?[0,1]:f==='e'?[-1,0]:[1,0];for(let k=0;k<4;k++){const h=.35*(k+1),o2=-1.2+k*.75;M(d2[0]?new THREE.BoxGeometry(.75,h,2.6):new THREE.BoxGeometry(2.6,h,.75),sm,x+d2[0]*o2,y0+h/2,z+d2[1]*o2)}}const hole=M(new THREE.PlaneGeometry(2.4,2.4),new THREE.MeshBasicMaterial({color:0xffd070,transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),x,y0+.04,z,-Math.PI/2,0,0,K);
   const gl=glow(x,y0+1.2,z,0xffc050,4.5,.4);const lt=new THREE.PointLight(0xffc060,1.4,12,1.8);lt.position.set(x,y0+2,z);K.add(lt);F.blive.push(t=>{const k=.45+Math.sin(t*2.4)*.12;hole.material.opacity=k;gl.material.opacity=k*.8})}});
 try{itMerge(L)}catch(e){console.warn('big merge',e)}}
(function(){const fl=floorLook;floorLook=function(F,G){const r=fl.apply(this,arguments);if(F&&F.bigf)try{bigLook(F,G)}catch(e){console.warn('big look',e)}return r}})();
(function(){const wt=W4.tick;W4.tick=function(t,dt){const r=wt.apply(this,arguments);try{const F=W4.F;if(F&&F.blive)for(const f of F.blive)f(t);bigFlTick(t,dt)}catch(e){if(!W4.bgErr){W4.bgErr=1;console.error('big floor',e)}}return r}})();
// ---------------------------------------------------------------- the floor's own business: the people in the districts, the back stairs, the dunks
(function(){const fp=floorPeople;floorPeople=function(F){const r=fp.apply(this,arguments);try{if(F&&F.bigf){(F.people||[]).forEach(q=>{const L=BIGPPL[q.name]||['Mind how you go.'];npcMake(q.kind,q.x,q.z,q.yaw||0,q.name,L.slice(),{dist:q.q||'',qfind:1})});
   // somebody at each way into the maze; the lost one deep inside it
   F.P.forEach(p=>{if(!p.maze||!p.mz)return;const mz=p.mz,q=mz.ins[0];if(!q)return;const [s,k]=q,o=s==='n'?[mz.x0+mz.wt+k*mz.cs+mz.cs/2+3,mz.z1+2.5]:s==='s'?[mz.x0+mz.wt+k*mz.cs+mz.cs/2+3,mz.z1-mz.C*mz.csz-mz.wt-2.5]:s==='w'?[mz.x0-2.5,mz.z1-mz.wt-k*mz.csz-mz.csz/2-3]:[mz.x0+mz.C*mz.cs+mz.wt+2.5,mz.z1-mz.wt-k*mz.csz-mz.csz/2-3];
    p.mzDoor=o;npcMake('zombie',o[0],o[1],0,'Auntie Change',BIGPPL['Auntie Change'].slice(),{dist:'maze',qfind:1})})}}catch(e){console.warn('big people',e)}return r}})();
const BIGPPL={
 'Uncle Earl':['Welcome to the cookout, nephew. You are not my nephew. At a cookout everybody is my nephew.','Some fools crashed my cookout and they are not leaving. Run them off and there is a plate for you. A real plate. Not a paper one.','Do not touch the potato salad. I do not know who made it. Nobody knows who made it. It just appeared.'],
 'Auntie Change':['My nephew Lil Dime went in that maze after a dollar he saw on the ground. That was Tuesday.','Go in there and find him. Tell him the dollar was mine and I want it back. Then tell him I love him. In that order.','Walls in there are too tall to jump. Do not even try. Lil Dime tried. That is how he got in there.'],
 'Coach Cash':['This is my court. You want a game? Dunk on both of those rims and I will tell people you are nice.','Jump. Jump again in the air. Go through the hoop. That is a dunk. I do not make the rules. I just made that one.','Nobody has dunked here since 1996. And that was me. Off a trampoline.'],
 'Reverend Bones':['The Boneyard is restless tonight, child. The dead do not stay down on this floor. They are very committed to the bit.','Lay them to rest. All of them that are walking. Then come see me. The church provides.','And stay out of that mausoleum. ...Unless you push the loose bricks. Then it is God\'s will.']};
// the cookout has music: a bassline, a kick, a snare, a hat (a hundred beats a minute), louder the closer you get to Uncle Earl's DJ table,
// scheduled a beat ahead on the sound clock; quiet under the tower's own music, gone once you walk away
const GROOVE={on:false,next:0,beat:0};const GBASS=[41.2,41.2,49,55,61.7,55,49,46.2];
function grooveTick(){const F=W4.F;if(!F||!F.djs||!F.djs.length||W4.busy){GROOVE.on=false;return}let d=1e9;F.djs.forEach(([x,z])=>{d=Math.min(d,Math.hypot(heroPos.x-x,heroPos.z-z))});const k=d<45?Math.min(1,(45-d)/30):0;if(k<=0){GROOVE.on=false;return}
 const ac=audioCtx();if(!ac)return;const now=ac.currentTime,spb=.6;if(!GROOVE.on||GROOVE.next<now){GROOVE.on=true;GROOVE.next=now+.05}
 while(GROOVE.next<now+.5){const T=GROOVE.next,b=GROOVE.beat,v=.07*k;
  // kick on 1 and 3, snare on 2 and 4, a hat on every half beat, the bass walking under it
  const kick=(T0)=>{const o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.setValueAtTime(110,T0);o.frequency.exponentialRampToValueAtTime(40,T0+.12);g.gain.setValueAtTime(v*2.2,T0);g.gain.exponentialRampToValueAtTime(.0001,T0+.25);o.connect(g);g.connect(ac.destination);o.start(T0);o.stop(T0+.26)};
  const noise=(T0,dur,hp,amp)=>{const N=Math.floor(ac.sampleRate*dur),bf=ac.createBuffer(1,N,ac.sampleRate),a=bf.getChannelData(0);for(let i=0;i<N;i++)a[i]=(Math.random()*2-1)*Math.pow(1-i/N,2);const s=ac.createBufferSource();s.buffer=bf;const f=ac.createBiquadFilter();f.type='highpass';f.frequency.value=hp;const g=ac.createGain();g.gain.value=amp;s.connect(f);f.connect(g);g.connect(ac.destination);s.start(T0)};
  if(b%2===0)kick(T);else noise(T,.18,1200,v*1.2);noise(T,.05,7000,v*.5);noise(T+spb/2,.05,7000,v*.35);
  {const f=GBASS[b%GBASS.length],o=ac.createOscillator(),lp=ac.createBiquadFilter(),g=ac.createGain();o.type='sawtooth';o.frequency.value=f*2;lp.type='lowpass';lp.frequency.value=420;g.gain.setValueAtTime(v*1.4,T);g.gain.exponentialRampToValueAtTime(.0001,T+spb*.9);o.connect(lp);lp.connect(g);g.connect(ac.destination);o.start(T);o.stop(T+spb)}
  GROOVE.next+=spb;GROOVE.beat++}}
(function(){const wt=W4.tick;W4.tick=function(t,dt){const r=wt.apply(this,arguments);try{grooveTick()}catch(e){}return r}})();
// the gate key on a big floor: out in the open in one of the far districts (never the Motor Pool, the arena, the maze, the island or a sealed
// room), on flat ground nobody has to climb to; the same spot on every machine (the floor's own numbers pick it), so the HUD can say where
function bigKeySpot(F){if(!F||!F.bigf||!F.lock)return null;if(F.ks!==undefined)return F.ks;const r=srand(F.seed*29+F.n*7+1),OK={market:1,ruins:1,garden:1,loop:1,camp:1,mesa:1,cookout:1,court:1,yard:1,junk:1,quarry:1};
 const H=(x,z)=>towerH0(F.P,x,z),flat=(x,z,t)=>[[0,0],[1.6,0],[-1.6,0],[0,1.6],[0,-1.6]].every(([a,b])=>Math.abs(H(x+a,z+b)-t)<.05);
 const avoid=[];F.P.forEach(p=>{if(p.sealedR)avoid.push(p.sealedR);if(p.sealedM)avoid.push(p.sealedM)});if(F.back)avoid.push([F.back.x,F.back.z]);
 const E=F.entry,ex=(E.x0+E.x1)/2,ez=(E.z0+E.z1)/2,d=p=>Math.hypot((p.x0+p.x1)/2-ex,(p.z0+p.z1)/2-ez);
 const C=F.P.filter(p=>p.wide&&OK[p.wide]&&!p.maze&&!p.island&&p.cell).sort((a,b)=>d(b)-d(a)),pool=C.slice(0,Math.max(1,Math.ceil(C.length/2)));
 for(let k=0;k<80&&pool.length;k++){const p=pool[(r()*pool.length)|0];const x=p.x0+7+r()*(p.x1-p.x0-14),z=p.z0+7+r()*(p.z1-p.z0-14);
  if(!flat(x,z,p.top)||avoid.some(([a,b])=>Math.hypot(a-x,b-z)<11)||(F.wchests||[]).some(c=>Math.hypot(c.x-x,c.z-z)<4))continue;return F.ks={x,z,where:BIGNAME[p.wide]||'out there'}}
 return F.ks=null}
function keyWhere(F){const k=bigKeySpot(F);return k?'The key is somewhere in '+k.where+'.':'The key is somewhere on this floor.'}
(function(){const kd=keyDrop;keyDrop=function(F){try{const k=bigKeySpot(F);if(k&&!MP.client){dropAdd('gkey',1,k.x,k.z);return}}catch(e){console.warn('tower key',e)}return kd.apply(this,arguments)}})();
// the back stairs: once their door is open, stand in the hut and up you go (the guardian never even sees you); a guest asks the host
function backOpen(F){F=F||W4.F;if(!F||!F.back||!F.doors)return false;return F.doors.some(D=>D.open&&D.b.hut)}
function bigFlTick(t,dt){const F=W4.F;if(!F||!F.bigf||W4.busy||deadT>0)return;
 if(F.back&&backOpen(F)){const b=F.back;if(Math.hypot(heroPos.x-b.x,heroPos.z-b.z)<1.9&&Math.abs(hero.position.y-.15-towerH(b.x,b.z))<2){if(!W4.bkSaid){W4.bkSaid=1;try{bossYell('THE BACK STAIRS','Staff only. You are staff now. Up you go.')}catch(e){}}
   if(!MP.on||!MP.client){if(!W4.bkT||t-W4.bkT>2){W4.bkT=t;try{saveMark('b',0)}catch(e){}W4.goFloor(F.n+1)}}else if(t-(W4.nxT||0)>1){W4.nxT=t;mpQueue({k:'w4bk',f:F.n})}}}
 // the hoops: go through a rim in the air (up or down) and it is a dunk; the first on each rim on a floor pays
 (F.hoops||[]).forEach(h=>{const dx=heroPos.x-h.x,dz=heroPos.z-h.z,inR=Math.hypot(dx,dz)<1.05,y=hero.position.y+.9;const was=h.side;h.side=y>h.y?1:-1;
  if(inR&&was&&was!==h.side&&typeof jH==='number'&&jH>0){if(t-(h.t||-9)<1)return;h.t=t;const net=F.hoopG&&F.hoopG[h.i];if(net){net.scale.set(1,1.4,1);setTimeout(()=>{try{net.scale.set(1,1,1)}catch(e){}},260)}
   if(!MP.on||!MP.client)(F.dunked||(F.dunked={}))[h.i]=1;else mpQueue({k:'w4dk',i:h.i});const first=!saveHas('h',h.i);try{dblChing(h.x,h.z,.6,1.6,first?5:2);shake=Math.max(shake,.25)}catch(e){}if(first){saveMark('h',h.i);const c=12+F.n;W4.coins=(W4.coins|0)+c;saveNow();W4.hud();try{bossYell('DUNK!','Rim '+(h.i+1)+'. +'+c+' doubloons. Coach Cash saw that.')}catch(e){}}else toast('Dunk! (the rim already paid)');try{bigJobsTick()}catch(e){}}})}
(function(){const ev=W4.ev;W4.ev=function(e,p){if(e&&e.k==='w4bk'&&(!MP.on||!MP.client)&&W4.on&&W4.F&&(e.f|0)===W4.F.n&&backOpen()){if(W4.F.n>=100)W4.top();else W4.goFloor(W4.F.n+1);return}return ev.apply(this,arguments)}})();
// ---------------------------------------------------------------- the floor's other jobs (the owner: "multiple quests per level... a quest
// outside the maze and a quest inside the maze"). Besides the floor's quest from somebody by the door: Auntie Change at the maze wants Lil Dime
// found (he is deep inside it); Uncle Earl wants the crashers run off his cookout; Coach Cash wants both rims dunked; Reverend Bones wants the
// Boneyard's dead laid to rest. Each pays (doubloons and a roll for the bag) when you go back and tell them, once per player; the host keeps
// the score and the snapshot carries it; a line each on the HUD.
const JOBS={list:[]};
function jobArea(a,x,z){return x>=a[0]&&x<=a[1]&&z>=a[2]&&z<=a[3]}
function bigJobs(F){JOBS.list=[];if(!F||!F.bigf)return;const r=srand(F.seed*37+F.n*211+3),N=nm=>W4.npcs.find(q=>q.name===nm);
 F.P.forEach(p=>{if(!p.maze||!p.mzLost||JOBS.list.some(j=>j.k==='find'))return;const g=W4.npcs.find(q=>q.o&&q.o.dist==='maze');if(!g)return;const [x,z]=p.mzLost;
  const lost=npcMake('doubloon',x,z,r()*6.28,'Lil Dime',['A dollar! I saw a dollar! ...It was a leaf. I have been in here since Tuesday chasing a leaf.','Auntie sent you? Tell her I am fine. Tell her I said thanks. Do not tell her about the leaf.'],{jfind:1,qfind:1});
  JOBS.list.push({k:'find',giver:g,lost,n:1,done:0,txt:'Find Lil Dime in the maze'})});
 (F.people||[]).forEach(q=>{const g=N(q.name);if(!g)return;const c=F.P.find(p=>p.wide===q.q&&p.cell);const a=c?[c.x0,c.x1,c.z0,c.z1]:null;
  if(q.q==='cookout'&&a)JOBS.list.push({k:'clear',giver:g,area:a,n:0,done:0,txt:'Run the crashers off the Cookout'});
  else if(q.q==='yard'&&a)JOBS.list.push({k:'clear',giver:g,area:a,n:0,done:0,txt:'Lay the Boneyard\'s dead to rest'});
  else if(q.q==='court')JOBS.list.push({k:'dunk',giver:g,n:(F.hoops||[]).length||2,done:0,txt:'Dunk on both rims at the Court'})});
 JOBS.list.forEach((j,i)=>{j.i=i;j.claimed=false;j.loot=lootRoll('quest',F.n,srand(F.seed*67+F.n*29+i*13));if(saveHas('j',i)){j.claimed=true;j.done=j.n||1;j.yelled=1}})}
// how many there are to clear (counted once the floor's crews have spawned) and the dunks you already have
function bigJobsTick(){const F=W4.F;if(!F)return;JOBS.list.forEach(j=>{if(j.claimed)return;if(j.k==='clear'&&!j.n&&(!MP.on||!MP.client)){const k=enemies.filter(e=>e.hp>0&&!e.isGuard&&jobArea(j.area,e.x,e.z)).length;if(k)j.n=Math.min(8,k)}
  if(j.k==='dunk'&&(!MP.on||!MP.client)){const d=(F.hoops||[]).filter(h=>F.dunked&&F.dunked[h.i]).length;if(d!==j.done){j.done=Math.min(j.n,d);if(j.done>=j.n)jobDone(j)}}});jobsHud()}
function jobDone(j){if(j.yelled)return;j.yelled=1;try{bossYell('JOB DONE','Go and tell '+j.giver.name)}catch(e){}jobsHud()}
// the crews: a fall inside a clear job's district counts
(function(){const qk=questKill;questKill=function(e){const r=qk.apply(this,arguments);try{if(!MP.on||!MP.client)JOBS.list.forEach(j=>{if(j.k!=='clear'||j.claimed||e.jc&&e.jc[j.i]||!j.n)return;if(!jobArea(j.area,e.x,e.z))return;(e.jc||(e.jc={}))[j.i]=1;j.done=Math.min(j.n,j.done+1);if(j.done>=j.n)jobDone(j);jobsHud()})}catch(x){}return r}})();
// talking: the lost one is found; a giver asks, then thanks and pays
const JOBASK={find:['Lil Dime is in that maze somewhere. Deep. Go get him and come back and tell me.'],clear:['Clear them out. All of them. Then come see me.'],dunk:['Two rims. Two dunks. Then come see me.']};
const JOBTHX={find:['He is alive! And he said thanks? That does not sound like him at all. Here, baby. Take this. Do not argue with me.'],clear:['Look at that. Peace and quiet. Here: this is for you. Do not tell anybody I am generous.'],dunk:['Both rims! I take back everything I said about you. I did not say it out loud, but I take it back. Here.']};
(function(){const qt=questTalk;questTalk=function(N){try{for(const j of JOBS.list){if(j.k==='find'&&N===j.lost){if(!j.done){if(!MP.on||!MP.client){j.done=1;jobDone(j)}else mpQueue({k:'w4jf',i:j.i})}return null}
   if(N!==j.giver)continue;if((j.done>=(j.n||1))&&j.n&&!j.claimed||(j.k==='find'&&j.done&&!j.claimed)){j.claimed=true;try{saveMark('j',j.i)}catch(e){}try{dblChing(heroPos.x,heroPos.z,.6,1,4)}catch(e){}try{lootGive(j.loot)}catch(e){}jobsHud();return JOBTHX[j.k].concat(N.lines.slice(0,1))}
   if(!j.claimed)return (j.k==='clear'&&j.n?['There are '+j.n+' of them. '+JOBASK.clear[0]]:JOBASK[j.k]).concat(['('+(RAR[j.loot.tier]?RAR[j.loot.tier].n:'a')+' reward)'],N.lines)}}catch(e){console.warn('jobs talk',e)}return qt.apply(this,arguments)}})();
// the HUD: a line each, under the floor's quest
function jobsHud(){let el=$('w4jobs');if(!el){el=document.createElement('div');el.id='w4jobs';document.body.appendChild(el)}const L=JOBS.list.filter(j=>!j.claimed);if(!W4.on||W4.out||!W4.F||!L.length){el.style.display='none';return}
 let qb=0;['w4quest','w4lock'].forEach(id=>{const q=$(id);if(q&&q.style.display!=='none')qb=Math.max(qb,q.getBoundingClientRect().bottom)});el.style.top=(qb?qb+6:150)+'px';el.style.display='block';
 el.innerHTML=L.map(j=>{const n=j.n||1,d=Math.min(n,j.done|0);return d>=n?'<div><b>JOB DONE</b> · tell '+esc4(j.giver.name)+'</div>':'<div><b>JOB</b> · '+esc4(j.txt)+(j.k==='find'?'':' · <i>'+d+'/'+(j.n?n:'?')+'</i>')+'</div>'}).join('')}
(function(){const h=W4.hud;W4.hud=function(){const r=h.apply(this,arguments);try{jobsHud()}catch(e){}return r}})();
(function(){const qg=questGen;questGen=function(F){const r=qg.apply(this,arguments);try{bigJobs(F)}catch(e){console.warn('jobs',e)}return r}})();
(function(){const sn=W4.snap;W4.snap=function(){const o=sn.apply(this,arguments);if(o&&JOBS.list.length)o.jb=JOBS.list.map(j=>[j.done|0,j.yelled?1:0,j.n|0]);return o}})();
(function(){const ap=W4.applySnap;W4.applySnap=function(o){const r=ap.apply(this,arguments);try{if(o&&Array.isArray(o.jb))o.jb.forEach((a,i)=>{const j=JOBS.list[i];if(!j||!Array.isArray(a))return;if(a[2])j.n=a[2];if(a[0]!==j.done){j.done=a[0];jobsHud()}if(a[1]&&!j.yelled)jobDone(j)})}catch(e){}return r}})();
(function(){const ev=W4.ev;W4.ev=function(e,p){if(e&&e.k==='w4jf'&&(!MP.on||!MP.client)){const j=JOBS.list[e.i|0];if(j&&j.k==='find'&&!j.done){j.done=1;jobDone(j)}return}if(e&&e.k==='w4dk'&&(!MP.on||!MP.client)&&W4.F){(W4.F.dunked||(W4.F.dunked={}))[e.i|0]=1;bigJobsTick();return}return ev.apply(this,arguments)}})();
(function(){const wt=W4.tick;W4.tick=function(t,dt){const r=wt.apply(this,arguments);try{if(JOBS.list.length&&((t*2)|0)!==JOBS.ht){JOBS.ht=(t*2)|0;bigJobsTick()}}catch(e){}return r}})();
(function(){const st=document.createElement('style');st.textContent='#w4jobs{position:fixed;left:12px;top:calc(186px + env(safe-area-inset-top,0px));z-index:58;background:rgba(10,6,4,.62);border:1px solid rgba(217,164,37,.45);border-radius:8px;padding:5px 10px;font:600 13px/1.4 system-ui;color:#f2e2c8;pointer-events:none;max-width:min(340px,60vw)}#w4jobs b{color:#ffd27a}#w4jobs i{font-style:normal;color:#9fe4ff}';document.head.appendChild(st)})();
// ---------------------------------------------------------------- THE RIDES (the owner, Oct 21 13:02: "make a mount u can ride or a vehicle or
// both"). On a wide floor the Brigade Motor Pool lends you a SWAMP GATOR (saddled: fast, jumps, bites when you attack) or a GOLD LOWRIDER
// (a convertible with hydraulics: faster still, hops on jump, its horn and a hydraulic slam when you attack, and anybody in front of it at
// speed gets run over). F at the stable or the garage to get on, F again to get off. You sit in the saddle or behind the wheel; your
// partner sees you ride (the ride goes out with your presence). The Lowrider Loop times you through its arches for a reward.
const RIDE={on:null,g:null,t0:0,att:-9,parts:null,spd:0,hop:0,lastX:0,lastZ:0,race:null};
// ---- the swamp gator: scaled hide (a picture of scutes and a bump map of the same), a pale belly, a long jaw with teeth that opens, bulging
// eyes with slit pupils, a ridged back and tail, four splayed legs with claws; a leather saddle with gold trim, a blanket, stirrups, reins
function txGatorHide(){if(ITX.gator)return ITX.gator;const W=512,H=512,c=itCanvas(W,H),g=c.getContext('2d'),h=itCanvas(W,H),hg=h.getContext('2d'),r=itRng(81);
 g.fillStyle='#3d4a22';g.fillRect(0,0,W,H);hg.fillStyle='#606060';hg.fillRect(0,0,W,H);
 const rows=16,cols=12;for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const w=W/cols,hh=H/rows,x=i*w+(j%2?w/2:0),y=j*hh;const sh=.85+r()*.3;
  g.fillStyle='rgb('+[61*sh+10|0,74*sh+10|0,34*sh|0]+')';g.beginPath();g.roundRect?g.roundRect(x+2,y+2,w-4,hh-4,8):g.rect(x+2,y+2,w-4,hh-4);g.fill();
  const gr=hg.createRadialGradient(x+w/2,y+hh/2,2,x+w/2,y+hh/2,w*.6);gr.addColorStop(0,'#d8d8d8');gr.addColorStop(1,'#707070');hg.fillStyle=gr;hg.beginPath();hg.roundRect?hg.roundRect(x+3,y+3,w-6,hh-6,8):hg.rect(x+3,y+3,w-6,hh-6);hg.fill();
  if(r()<.35){g.fillStyle='rgba(20,26,10,.5)';g.beginPath();g.arc(x+w/2,y+hh/2,w*.18,0,7);g.fill()}}
 for(let i=0;i<4000;i++){g.fillStyle='rgba('+(r()<.5?'20,24,8':'120,130,70')+','+(r()*.15)+')';g.fillRect(r()*W,r()*H,1.5,1.5)}
 return ITX.gator={map:itTex(c,false,2,2),nm:itNormal(h,3,2,2)}}
function txBelly(){if(ITX.belly)return ITX.belly;const c=itCanvas(256,256),g=c.getContext('2d'),r=itRng(83);g.fillStyle='#c8c08a';g.fillRect(0,0,256,256);for(let j=0;j<16;j++){g.fillStyle='rgba(120,110,60,.35)';g.fillRect(0,j*16,256,2)}for(let i=0;i<10;i++){g.fillStyle='rgba(120,110,60,.25)';g.fillRect(i*26,0,2,256)}
 return ITX.belly={map:itTex(c,false,1,3),nm:itNormal(c,2,1,3)}}
function txEye(){if(ITX.eye)return ITX.eye;const c=itCanvas(128,128),g=c.getContext('2d');const gr=g.createRadialGradient(64,64,4,64,64,64);gr.addColorStop(0,'#fff27a');gr.addColorStop(.7,'#e0a020');gr.addColorStop(1,'#6a4a10');g.fillStyle=gr;g.fillRect(0,0,128,128);g.fillStyle='#120a04';g.beginPath();g.ellipse(64,64,9,40,0,0,7);g.fill();return ITX.eye=itTex(c)}
function gatorModel(){const G=new THREE.Group(),T=txGatorHide(),Bt=txBelly();const hide=new THREE.MeshStandardMaterial({map:T.map,normalMap:T.nm,normalScale:new THREE.Vector2(1.2,1.2),roughness:.62,metalness:0,envMapIntensity:.6}),belly=new THREE.MeshStandardMaterial({map:Bt.map,normalMap:Bt.nm,roughness:.7,envMapIntensity:.5});
 const ivory=itMat('ivory'),dark=new THREE.MeshStandardMaterial({color:0x1a120a,roughness:.5});const S=(r,w,h)=>new THREE.SphereGeometry(r,w||28,h||20);
 const add=(par,geo,mat,p,sc,rot)=>{const m=new THREE.Mesh(geo,mat);m.position.set(p[0],p[1],p[2]);if(sc)m.scale.set(sc[0],sc[1],sc[2]);if(rot)m.rotation.set(rot[0],rot[1],rot[2]);par.add(m);return m};
 const body=new THREE.Group();body.name='gbody';G.add(body);
 add(body,S(1),hide,[0,.92,0],[1.05,.5,1.95]);add(body,S(1),belly,[0,.72,.05],[.92,.32,1.75]);add(body,S(1),hide,[0,.95,1.75],[.78,.44,.85]);
 // the head (it nods a little as it walks) and the jaw that opens
 const head=new THREE.Group();head.name='ghead';head.position.set(0,.98,2.35);body.add(head);
 add(head,S(1),hide,[0,.05,.25],[.6,.36,.7]);add(head,S(1),hide,[0,-.02,1.15],[.42,.19,1.05]);add(head,S(.2,12,8),dark,[-.12,.12,2.12]);add(head,S(.2,12,8),dark,[.12,.12,2.12]).scale.setScalar(.25);head.children[head.children.length-2].scale.setScalar(.25);
 [-1,1].forEach(s=>{add(head,S(.17),hide,[s*.26,.28,.2]);const e=add(head,S(.12,16,12),new THREE.MeshStandardMaterial({map:txEye(),emissive:0x6a4a00,emissiveIntensity:.5,roughness:.2}),[s*.29,.33,.26]);e.rotation.y=s*.6});
 {const tg=new THREE.ConeGeometry(.04,.14,6);for(let k=0;k<11;k++){[-1,1].forEach(s=>{add(head,tg,ivory,[s*(.36-k*.012),-.12,.5+k*.15],null,[Math.PI,0,0])})}}
 const jaw=new THREE.Group();jaw.name='gjaw';jaw.position.set(0,-.1,.25);head.add(jaw);add(jaw,S(1),belly,[0,-.06,.92],[.38,.13,1.0]);{const tg=new THREE.ConeGeometry(.035,.12,6);for(let k=0;k<10;k++)[-1,1].forEach(s=>add(jaw,tg,ivory,[s*(.32-k*.012),.04,.4+k*.15]))}
 const mouth=add(jaw,S(1),new THREE.MeshStandardMaterial({color:0xa03040,roughness:.6}),[0,.01,.9],[.3,.04,.9]);
 // the ridges down the back: three rows of scutes
 {const sg=new THREE.ConeGeometry(.09,.2,4);for(let k=0;k<13;k++){const z=-1.5+k*.27;[-.3,0,.3].forEach((x,j)=>{const y=.92+.5*Math.sqrt(Math.max(0,1-(z/1.95)**2))*Math.sqrt(Math.max(0,1-(x/1.05)**2));add(body,sg,hide,[x,y+.02,z],[1,j===1?1.3:1,1.4])})}}
 // the tail: seven segments, each a little smaller, each swinging after the one before
 let par=body,z=-1.75;const tail=[];for(let k=0;k<7;k++){const seg=new THREE.Group();seg.position.set(0,k?0:.86,k?-.62:z);par.add(seg);const s=1-k*.12;add(seg,S(1),hide,[0,0,-.32],[.5*s,.3*s,.48]);
  const sg=new THREE.ConeGeometry(.07*s,.2*s,4);[-.16*s,.16*s].forEach(x=>add(seg,sg,hide,[x,.26*s,-.3],[1,1.3,1.4]));tail.push(seg);par=seg}
 // the legs: shoulder/hip, the foot splayed out, five claws
 const legs=[];[[-.88,1.15,1],[.88,1.15,1],[-.88,-.95,-1],[.88,-.95,-1]].forEach(([x,z,f],i)=>{const L=new THREE.Group();L.position.set(x,.72,z);body.add(L);const s=Math.sign(x);
  add(L,S(1,16,12),hide,[s*.18,-.12,0],[.28,.22,.3]);const low=new THREE.Group();low.position.set(s*.36,-.28,0);L.add(low);add(low,new THREE.CylinderGeometry(.12,.1,.42,10),hide,[0,-.08,0],null,[0,0,s*.35]);
  const ft=add(low,S(1,14,10),hide,[s*.1,-.3,.1],[.22,.08,.3]);const cg=new THREE.ConeGeometry(.03,.14,5);for(let c=0;c<5;c++){const a=(c-2)*.28;add(low,cg,ivory,[s*.1+Math.sin(a)*.2,-.32,.1+Math.cos(a)*.3],null,[Math.PI/2,0,0])}legs.push({L,low,ph:i===0||i===3?0:Math.PI,s})});
 // the saddle: blanket, seat, gold trim and horn, stirrups, reins up to the jaw
 const sad=new THREE.Group();sad.position.set(0,1.38,.35);body.add(sad);const blanket=new THREE.MeshStandardMaterial({color:0x8a1018,roughness:.85,side:THREE.DoubleSide});
 add(sad,itRBox(1.7,.06,1.5,.03,2),blanket,[0,-.04,0],null,[.04,0,0]);[-1,1].forEach(s=>add(sad,itRBox(.06,.5,1.4,.03,2),blanket,[s*.86,-.28,0],null,[0,0,s*.25]));
 add(sad,itRBox(1.05,.22,1.1,.1,3),itMat('leather'),[0,.1,0]);add(sad,itRBox(1.1,.05,1.16,.02,2),itMat('goldP'),[0,.02,0]);add(sad,itRBox(.9,.3,.18,.08,3),itMat('leather'),[0,.28,-.48]);
 add(sad,new THREE.CylinderGeometry(.06,.08,.3,10),itMat('goldP'),[0,.33,.5]);add(sad,S(.09,12,8),itMat('goldP'),[0,.5,.5]);
 [-1,1].forEach(s=>{add(sad,itRBox(.06,.7,.08,.02,1),itMat('leather'),[s*.6,-.3,.05]);add(sad,new THREE.TorusGeometry(.1,.025,6,16),itMat('goldP'),[s*.62,-.7,.05],null,[0,Math.PI/2,0])});
 {const rp=(s)=>[[s*.08,1.88,.85],[s*.25,1.6,1.7],[s*.32,1.08,2.65]];[-1,1].forEach(s=>{const m=new THREE.Mesh(itTube(rp(s),.018,16,5),itMat('leather'));body.add(m)})}
 [body,head,jaw,sad].concat(tail,legs.map(l=>l.L),legs.map(l=>l.low)).forEach(g=>{try{itMerge(g)}catch(e){}});   // (a few draws per part, not a hundred)
 G.userData.parts={body,head,jaw,tail,legs,seat:1.56};return G}
// ---- the gold lowrider (the owner, Oct 21 13:51-13:53: "if it's a car, make sure it has metallic and shine... not just a polygon block";
// "there should be airbags on each tire so you can raise and lower each tire... independently work all of them"). A long, low '64 convertible:
// candy-gold paint with metal flake under a deep clear coat, chrome everywhere (bumpers with bullets, a grille of bars, quad headlights and six
// round taillights in chrome bezels, a side spear, rocker trim, mirrors, a hood ornament), white tuck-and-roll benches, a chain steering
// wheel, gold-and-chrome wire wheels with whitewalls and two-bar spinners, and under each corner a chrome hydraulic ram you can see working
function txFlake(){if(ITX.flake)return ITX.flake;const c=itCanvas(256,256),g=c.getContext('2d'),r=itRng(97);g.fillStyle='#8080ff';g.fillRect(0,0,256,256);for(let i=0;i<9000;i++){const a=r()*6.283,k=40+r()*80;g.fillStyle='rgb('+(128+Math.cos(a)*k|0)+','+(128+Math.sin(a)*k|0)+',255)';g.fillRect(r()*256,r()*256,1.4,1.4)}
 const t=itTex(c,true,9,9);return ITX.flake=t}
function txSeat(){if(ITX.seat)return ITX.seat;const c=itCanvas(256,256),g=c.getContext('2d');g.fillStyle='#f4efe4';g.fillRect(0,0,256,256);for(let i=0;i<256;i+=32){const gr=g.createLinearGradient(i,0,i+32,0);gr.addColorStop(0,'#c9bfa8');gr.addColorStop(.15,'#f8f4ea');gr.addColorStop(.85,'#ece6d8');gr.addColorStop(1,'#b8ae96');g.fillStyle=gr;g.fillRect(i,0,32,256)}
 g.fillStyle='rgba(120,100,70,.5)';for(let i=0;i<256;i+=32)for(let y=4;y<256;y+=8)g.fillRect(i+1,y,1.5,3);return ITX.seat={map:itTex(c),nm:itNormal(c,3)}}
function txPlate(){if(ITX.plate)return ITX.plate;const c=itCanvas(256,128),g=c.getContext('2d');g.fillStyle='#f4f0e0';g.fillRect(0,0,256,128);g.strokeStyle='#1a3a8a';g.lineWidth=6;g.strokeRect(5,5,246,118);g.fillStyle='#1a3a8a';g.font='900 18px system-ui';g.textAlign='center';g.fillText('TOWER STATE',128,30);
 g.fillStyle='#101010';g.font='900 56px Georgia,serif';g.fillText('NAG 78',128,94);g.font='700 13px system-ui';g.fillStyle='#8a1010';g.fillText('LOW AND SLOW',128,118);return ITX.plate=itTex(c)}
const HYD={L:2.17,W:1.0,MAX:.62,base:.46};   // half the wheelbase, half the track, how far a ram lifts its corner, the wheel's radius
function lowriderModel(){const G=new THREE.Group();const E=itEnv();
 const paint=new THREE.MeshPhysicalMaterial({color:0x9e5c06,metalness:.86,roughness:.3,clearcoat:1,clearcoatRoughness:.02,normalMap:txFlake(),normalScale:new THREE.Vector2(.2,.2),envMapIntensity:1.45});if(E)paint.envMap=E;
 const chrome=itMat('chrome'),goldP=itMat('goldP'),rub=new THREE.MeshStandardMaterial({color:0x0b0b0b,roughness:.86,envMapIntensity:.25}),T=txSeat(),seatM=new THREE.MeshStandardMaterial({map:T.map,normalMap:T.nm,normalScale:new THREE.Vector2(.8,.8),roughness:.42});if(E){seatM.envMap=E;seatM.envMapIntensity=.6}
 const glassM=itMat('glassT'),tail=new THREE.MeshStandardMaterial({color:0x7a0000,emissive:0xff1408,emissiveIntensity:1.3,roughness:.2}),head=new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xfff0c8,emissiveIntensity:1.5,roughness:.1});
 const body=new THREE.Group();body.name='cbody';G.add(body);const add=(geo,mat,p,r,sc)=>{const m=new THREE.Mesh(geo,mat);m.position.set(p[0],p[1],p[2]);if(r)m.rotation.set(r[0],r[1],r[2]);if(sc)m.scale.set(sc[0],sc[1],sc[2]);body.add(m);return m};
 const ex=(shape,w,b,bs)=>{const g=itExtrude(shape,w,b,bs||5,28);g.rotateY(-Math.PI/2);return g};
 // the body's side: a long hood, the tub where you sit, the trunk deck with little fins; arches over the wheels
 const s=new THREE.Shape();const WA=(cx)=>{s.lineTo(cx+.58,.47);s.absarc(cx,.47,.58,0,Math.PI,false);s.lineTo(cx-.58,.47)};
 s.moveTo(-3.34,.52);s.quadraticCurveTo(-3.42,.85,-3.32,1.12);s.lineTo(-3.18,1.27);s.quadraticCurveTo(-2.4,1.2,-1.5,1.2);s.lineTo(-1.45,.64);s.lineTo(.88,.64);s.lineTo(.95,1.16);s.quadraticCurveTo(2.2,1.13,3.15,1.07);s.quadraticCurveTo(3.42,1.02,3.42,.8);s.quadraticCurveTo(3.42,.55,3.3,.5);
 WA(2.2);s.lineTo(-1.57,.47);WA(-2.15);s.lineTo(-3.25,.47);s.quadraticCurveTo(-3.32,.48,-3.34,.52);
 add(ex(s,2.24,.15),paint,[0,0,0]);
 // a crowned hood and trunk (not a flat slab), lips round the wheel arches, the folded top in its boot behind the back seat
 {const cr=(z0,z1,y)=>{const g=new THREE.CylinderGeometry(1.02,1.02,Math.abs(z1-z0),40,1,false,-Math.PI/2*.62,Math.PI*.62);g.rotateX(Math.PI/2);g.rotateZ(Math.PI/2);g.scale(1,.11,1);const m=add(g,paint,[0,y,(z0+z1)/2]);return m};cr(1.0,3.15,1.12);cr(-3.15,-1.6,1.16);
  [[2.2,.47],[-2.15,.47]].forEach(([z,y])=>[-1,1].forEach(sd=>{const lip=new THREE.TorusGeometry(.6,.045,8,32,Math.PI);lip.rotateY(Math.PI/2);add(lip,paint,[sd*1.13,y,z])}));
  const boot=new THREE.MeshStandardMaterial({color:0xf2ece2,roughness:.55});if(E)boot.envMap=E;add(itRBox(2.0,.3,.5,.14,4),boot,[0,1.22,-1.66])}
 // the doors (up to the belt line), the dash, the windshield in its chrome frame, the tuck-and-roll benches, the chain steering wheel
 [-1,1].forEach(sd=>{const d=new THREE.Shape();d.moveTo(-1.5,.56);d.lineTo(-1.5,1.2);d.quadraticCurveTo(-.3,1.19,.95,1.16);d.lineTo(.95,.56);const m=add(ex(d,.12,.04,3),paint,[sd*1.07,0,0])});
 add(itRBox(2.08,.34,.42,.1,3),paint,[0,1.12,.66]);[-.45,.3].forEach(x=>{add(new THREE.CylinderGeometry(.07,.07,.03,18),chrome,[x,1.27,.62],[Math.PI/2-.6,0,0]);add(new THREE.CircleGeometry(.055,18),new THREE.MeshBasicMaterial({color:0xfff6dc}),[x,1.276,.633],[-.6,0,0])});
 {const w=add(itRBox(2.04,.6,.035,.03,1),glassM,[0,1.53,.86],[-.52,0,0]);w.renderOrder=3;add(itTube([[-1.05,1.24,.98],[-1.02,1.78,.75],[1.02,1.78,.75],[1.05,1.24,.98]],.032,28,8),chrome,[0,0,0])}
 [[-.3,0],[-1.15,1]].forEach(([z])=>{add(itRBox(1.94,.3,.74,.13,3),seatM,[0,.74,z]);add(itRBox(1.94,.64,.22,.1,3),seatM,[0,1.06,z-.43],[-.13,0,0]);add(itTube([[-.97,1.38,z-.47],[0,1.4,z-.49],[.97,1.38,z-.47]],.035,16,6),chrome,[0,0,0])});
 {const ch=new THREE.Group();ch.position.set(-.45,1.22,.34);ch.rotation.x=-.95;body.add(ch);const link=new THREE.TorusGeometry(.045,.014,6,12);for(let k=0;k<22;k++){const a=k/22*Math.PI*2,l=new THREE.Mesh(link,chrome);l.position.set(Math.cos(a)*.21,Math.sin(a)*.21,0);l.rotation.set(0,k%2?Math.PI/2:0,a);ch.add(l)}
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.05,14),goldP);hub.rotation.x=Math.PI/2;ch.add(hub);[0,2.1,4.2].forEach(a=>{const sp=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.2,6),chrome);sp.position.set(Math.cos(a)*.1,Math.sin(a)*.1,0);sp.rotation.z=a+Math.PI/2;ch.add(sp)});
  add(new THREE.CylinderGeometry(.03,.03,.5,10),chrome,[-.45,1.08,.55],[-.95,0,0])}
 // chrome: bumpers with bullets, the grille, the quad headlights, six taillights, the spear down each side, the rocker trim, mirrors, the ornament
 [[3.43,.6,1],[-3.38,.62,-1]].forEach(([z,y,f])=>{add(itRBox(2.5,.22,.26,.1,4),chrome,[0,y,z]);[-.62,.62].forEach(x=>add(new THREE.SphereGeometry(.11,16,12),chrome,[x,y,z+f*.13],null,[1,1,1.5]))});
 add(itRBox(1.36,.34,.06,.05,2),new THREE.MeshStandardMaterial({color:0x101010,roughness:.4}),[0,.86,3.37]);for(let k=0;k<5;k++)add(itRBox(1.32,.04,.06,.015,1),chrome,[0,.73+k*.065,3.4]);add(new THREE.CylinderGeometry(.09,.09,.04,20),goldP,[0,.86,3.43],[Math.PI/2,0,0]);
 [-1,1].forEach(sd=>{[.63,.92].forEach(x=>{add(new THREE.CircleGeometry(.12,22),head,[sd*x,.86,3.415]);add(new THREE.TorusGeometry(.13,.025,8,24),chrome,[sd*x,.86,3.41])});
  for(let k=0;k<3;k++){const x=sd*(.42+k*.3);add(new THREE.CylinderGeometry(.11,.11,.04,20),tail,[x,1.0,-3.41],[Math.PI/2,0,0]);add(new THREE.TorusGeometry(.12,.022,8,22),chrome,[x,1.0,-3.42])}
  add(itTube([[sd*1.14,.95,-3.0],[sd*1.155,.97,-.6],[sd*1.155,.97,1.2],[sd*1.14,.93,3.0]],.024,28,6),chrome,[0,0,0]);add(itRBox(.04,.07,4.0,.02,1),chrome,[sd*1.13,.58,.1]);
  add(new THREE.SphereGeometry(.075,12,10),chrome,[sd*1.1,1.3,.72],null,[1,.8,1.3]);add(new THREE.CylinderGeometry(.015,.015,.14,6),chrome,[sd*1.08,1.22,.72]);
  add(new THREE.CylinderGeometry(.06,.07,.38,14),chrome,[sd*.55,.42,-3.42],[Math.PI/2,0,0])});
 add(new THREE.ConeGeometry(.07,.26,12),goldP,[0,1.2,3.05],[Math.PI/2.2,0,0]);add(new THREE.SphereGeometry(.05,10,8),goldP,[0,1.17,2.95]);
 {const pl=add(new THREE.PlaneGeometry(.62,.31),new THREE.MeshStandardMaterial({map:txPlate(),roughness:.5}),[0,.8,-3.4],[0,Math.PI,0]);}
 // a pinstriped "78" on the trunk
 {const c=itCanvas(256,128),g=c.getContext('2d');g.clearRect(0,0,256,128);g.strokeStyle='#5a0a0a';g.lineWidth=3;g.beginPath();g.moveTo(10,64);g.bezierCurveTo(60,10,100,10,128,64);g.bezierCurveTo(156,118,196,118,246,64);g.stroke();g.fillStyle='#5a0a0a';g.font='900 54px Georgia,serif';g.textAlign='center';g.fillText('78',128,82);
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;const d=add(new THREE.PlaneGeometry(1.4,.7),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}),[0,1.226,-2.35],[-Math.PI/2,0,0])}
 itMerge(body);
 // the wheels (each its own group: it rolls, the fronts steer, it can hang in the air) and a chrome ram over each one
 const wheels=new THREE.Group();wheels.name='cwheels';G.add(wheels);const wl=[];const spokeG=new THREE.CylinderGeometry(.007,.007,.36,4);
 [[-HYD.W,HYD.L+.03,'FL'],[HYD.W,HYD.L+.03,'FR'],[-HYD.W,-HYD.L+.02,'RL'],[HYD.W,-HYD.L+.02,'RR']].forEach(([x,z,id],i)=>{const w=new THREE.Group();w.position.set(x,HYD.base,z);wheels.add(w);const sp=new THREE.Group();w.add(sp);const sd=Math.sign(x);
  const tyre=new THREE.Mesh(new THREE.TorusGeometry(.34,.12,16,36),rub);tyre.rotation.y=Math.PI/2;sp.add(tyre);const ww=new THREE.Mesh(new THREE.RingGeometry(.28,.38,36),new THREE.MeshStandardMaterial({color:0xf6f4ee,roughness:.5,side:THREE.DoubleSide}));ww.rotation.y=sd*Math.PI/2;ww.position.x=sd*.115;sp.add(ww);
  const dish=new THREE.Mesh(itLathe([[.27,-.06],[.27,.04],[.2,.07],[.1,.09],[0,.1]],32),chrome);dish.rotation.z=-sd*Math.PI/2;dish.position.x=sd*.02;sp.add(dish);
  for(let k=0;k<24;k++){const a=k/24*Math.PI*2,b=a+(k%2?.35:-.35);const sk=new THREE.Mesh(spokeG,k%3?chrome:goldP);sk.position.set(sd*.08,(Math.sin(a)*.25+Math.sin(b)*.05)/2,(Math.cos(a)*.25+Math.cos(b)*.05)/2);sk.rotation.x=-(a+b)/2;sp.add(sk)}
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,.12,16),goldP);hub.rotation.z=Math.PI/2;hub.position.x=sd*.1;sp.add(hub);itMerge(sp);
  const spin=new THREE.Group();spin.position.x=sd*.17;[0,1].forEach(k=>{const b=new THREE.Mesh(itRBox(.04,.36,.07,.02,1),goldP);b.rotation.x=k*Math.PI/2;spin.add(b)});const knob=new THREE.Mesh(new THREE.SphereGeometry(.05,10,8),goldP);spin.add(knob);itMerge(spin);w.add(spin);
  const ram=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,1,14),chrome);ram.position.set(x-sd*.18,HYD.base,z);G.add(ram);const sleeve=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.22,14),goldP);G.add(sleeve);
  wl.push({id,w,sp,spin,ram,sleeve,x,z,front:z>0})});
 G.userData.parts={body,wheels:wl,seat:.88,seatX:-.45,seatZ:-.3,car:1};return G}
// ---- the hydraulics: four rams, each up or down on its own switch, easing there (up on the pump, down on a rush of air); the body rests on the
// three highest supports: raise one corner and the wheel beside it on the same axle comes up off the ground (three-wheel motion), raise a pair
// and that end stands up, raise all four and she sits up tall on every wheel; the dance mode runs the classic moves; jump pops her off the ground
function hydNew(){return {tgt:[0,0,0,0],e:[0,0,0,0],dance:0,dI:0,dT:0,pop:-9,sw:-9}}
const HYD_DANCE=[[1,1,0,0],[0,0,0,0],[0,0,1,1],[0,0,0,0],[1,0,1,0],[0,1,0,1],[1,0,1,0],[0,1,0,1],[1,0,0,0],[0,0,0,0],[0,1,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]];
function hydTick(H,dt,t){if(H.dance){H.dT-=dt;if(H.dT<=0){H.dI=(H.dI+1)%HYD_DANCE.length;H.tgt=HYD_DANCE[H.dI].slice();H.dT=.42}}
 for(let i=0;i<4;i++){const d=H.tgt[i]-H.e[i];H.e[i]+=Math.sign(d)*Math.min(Math.abs(d),dt*(d>0?3.2:5.2))}}
function hydCorners(e){const L=e.map(v=>v*HYD.MAX),D1=L[0]+L[3],D2=L[1]+L[2],c=L.slice(),lift=[0,0,0,0];
 if(Math.abs(D1-D2)>1e-4){if(D1>D2){const k=L[0]>=L[3]?1:2;c[k]=L[k]+(D1-D2)*.72;lift[k]=(D1-D2)*.72}else{const k=L[1]>=L[2]?0:3;c[k]=L[k]+(D2-D1)*.72;lift[k]=(D2-D1)*.72}}return {c,lift}}   // (the hanging corner rides a little under the raised one: the body leans into it, the way a three-wheeler does)
function carPose(P,H,t,dt,v,yawR,air,att){const {c,lift}=hydCorners(H.e);const front=(c[0]+c[1])/2,rear=(c[2]+c[3])/2,left=(c[0]+c[2])/2,right=(c[1]+c[3])/2,y0=(c[0]+c[1]+c[2]+c[3])/4;
 const pop=t-H.pop,pk=pop>=0&&pop<.7?Math.sin(pop/.7*Math.PI):0,slam=t-att,sk=slam>=0&&slam<.6?Math.sin(slam/.6*Math.PI*2)*Math.exp(-slam*3):0;
 const pitch=Math.atan2(front-rear,2*HYD.L)+(air?.1:0)+pk*.18,roll=Math.atan2(right-left,2*HYD.W)-Math.max(-.08,Math.min(.08,yawR*.04));
 const B=P.body;B.position.y=y0+pk*.25-sk*.22;B.rotation.set(-pitch,0,roll);B.updateMatrix();
 P.wheels.forEach((w,i)=>{w.sp.rotation.x+=v*dt/HYD.base;w.spin.rotation.x-=dt*7;if(w.front)w.w.rotation.y=Math.max(-.45,Math.min(.45,yawR*.35));const hang=lift[i]+(air?.12:0);w.w.position.y=HYD.base+hang;
  // the ram: from the wheel's hub up to the body above it (its length is how far that corner stands up)
  const top=new THREE.Vector3(w.x*.82,.98,w.z).applyMatrix4(B.matrix),bot=new THREE.Vector3(w.x*.82,HYD.base+hang,w.z),len=Math.max(.05,top.y-bot.y);w.ram.position.set(bot.x,(top.y+bot.y)/2,bot.z);w.ram.scale.set(1,len,1);w.sleeve.position.set(bot.x,top.y-.11,bot.z)})}
// ---- getting on and off
const RIDES={gator:{n:'the swamp gator',who:'Kevin',mul:2.1,mk:gatorModel},car:{n:'the gold lowrider',who:'the lowrider',mul:2.9,mk:lowriderModel},drum:{n:'Deacon Drumstick',who:'the Deacon',mul:2.45,mk:drumModel},melon:{n:'The Melon Mothership',who:'the Mothership',mul:2.6,mk:melonModel}};
function rideStations(){return (W4.F&&W4.F.wide&&W4.F.stations)||[]}
function rideNear(){if(RIDE.on||!W4.on||!W4.F||!W4.F.wide||deadT>0)return null;let best=null,bd=6.5;rideStations().forEach(s=>{const d=Math.hypot(heroPos.x-s.ix,heroPos.z-s.iz);if(d<bd&&Math.abs(hero.position.y-towerH(s.ix,s.iz))<4){bd=d;best=s}});return best}
function rideHips(cg){if(!cg)return [];if(cg.userData.hips)return cg.userData.hips;const H=cg.children.filter(c=>!c.isMesh&&Math.abs(Math.abs(c.position.x)-.32)<.03&&Math.abs(c.position.y-1.1)<.03).sort((a,b)=>a.position.x-b.position.x);cg.userData.hips=H;return H}
// sitting: astride the gator (legs out round its sides), in the car (legs out in front under the dash)
function ridePose(cg,k){const H=rideHips(cg);H.forEach(h=>{const s=Math.sign(h.position.x)||1;if(k==='gator'){h.rotation.set(-1.05,0,s*.62)}else if(k==='drum'){h.rotation.set(-.95,0,s*.8)}else if(k==='melon'){h.rotation.set(-1.35,0,s*.12)}else{h.rotation.set(-1.45,0,s*.06)}})}
function rideInstall(){if(!charApi||charApi.__ride)return;const a=charApi.anim;charApi.anim=function(t,moving,swim,air,run){if(!RIDE.on)return a.call(this,t,moving,swim,air,run);const r=a.call(this,t,false,false,0,false);try{ridePose(heroCG,RIDE.on)}catch(e){}return r};charApi.__ride=1}
const _rsV=new THREE.Vector3();
function rideSeat(cg,k,parts){const sc=cg.scale.y||.62,hipY=1.1*sc;if(k==='gator'){cg.position.set(0,parts.seat-hipY+.04,.32);return}
 // on the Deacon you sit his saddle and go where his body goes: up and down with his stride, round with his spin
 if(k==='drum'){const B=parts.body,ry=B.rotation.y,y=parts.seat+(B.position.y-1.5)-hipY+.04;cg.position.set(Math.sin(ry)*parts.seatZ,y,Math.cos(ry)*parts.seatZ);cg.rotation.set(B.rotation.x,ry,B.rotation.z);return}
 if(k==='melon'){const B=parts.body,S=parts.S||1;cg.position.set(0,S*(parts.seat+(B.position.y-1.15))-hipY+.04,S*parts.seatZ);cg.rotation.set(B.rotation.x,0,B.rotation.z);return}
 // in the car you sit in the body and ride its hydraulics with it: the seat moves (and tips) as the body does
 const B=parts.body;B.updateMatrix();_rsV.set(parts.seatX,parts.seat-hipY+.02,parts.seatZ).applyMatrix4(B.matrix);cg.position.copy(_rsV);cg.rotation.set(B.rotation.x,0,B.rotation.z)}
function rideOn(k){if(RIDE.on||!RIDES[k]||!hero||!W4.F||!W4.F.wide)return false;rideInstall();const g=RIDES[k].mk();g.traverse(o=>{o.layers.set(0);if(o.isMesh)o.castShadow=true});hero.add(g);
 RIDE.on=k;RIDE.g=g;RIDE.parts=g.userData.parts;RIDE.t0=clk.getElapsedTime();RIDE.ph=0;RIDE.spd=0;RIDE.lastX=heroPos.x;RIDE.lastZ=heroPos.z;RIDE.yaw0=heroYaw;
 if(heroCG){RIDE.cg0=heroCG.position.clone();rideSeat(heroCG,k,RIDE.parts)}rideSpeed();try{W4.hud()}catch(e){}
 toast(k==='gator'?'You saddle up Kevin the gator. Attack bites. F gets you off.':k==='melon'?'You board the Melon Mothership. Jump lifts it, hold jump to glide (right over the Gap), attack spits seeds. F lands it.':k==='drum'?'You saddle up Deacon Drumstick. Attack: the bone spin. Hold jump in the air: he flutters. F gets you off.':'You take the gold lowrider. Jump hops it, attack plays the horn and slams. F gets you off.');try{k==='gator'?rideGrowl(heroPos.x,heroPos.z):k==='drum'?drumBawk(heroPos.x,heroPos.z,1):k==='melon'?hydSoundAny(true,4):rideHorn(heroPos.x,heroPos.z,1)}catch(e){}return true}
function rideOff(quiet){if(!RIDE.on)return;try{hero.remove(RIDE.g);w4Dispose(RIDE.g)}catch(e){}try{const h=$('w4hyd');if(h)h.style.display='none';const rb=$('w4ridebar');if(rb)rb.style.display='none'}catch(e){}if(heroCG){if(RIDE.cg0)heroCG.position.copy(RIDE.cg0);rideHips(heroCG).forEach(h=>h.rotation.set(0,0,0))}const k=RIDE.on;RIDE.on=null;RIDE.g=null;RIDE.parts=null;try{applyUps()}catch(e){}
 if(!quiet)toast(k==='gator'?'You hop off Kevin. He waits. He is very patient.':k==='melon'?'You land the Mothership. It hums. It is a happy melon.':k==='drum'?'You climb down off the Deacon. He fluffs his crust. He does not have feathers. He fluffs it anyway.':'You park the lowrider. It looks good parked.');try{W4.hud()}catch(e){}}
function rideSpeed(){if(!RIDE.on)return;L2.spd0=(W4.base?W4.base.spd:1)*Math.pow(1.06,W4.up.spd|0)*RIDES[RIDE.on].mul}
(function(){const au=applyUps;applyUps=function(){const r=au.apply(this,arguments);if(RIDE.on)rideSpeed();return r}})();
// ---- moving: the gator's legs walk in step with the ground it covers, its tail swings, its head nods; the car's wheels roll the distance it
// goes, the front ones steer, the spinners never stop, the body leans into turns and kicks up on its hydraulics when it hops
function rideAnim(parts,k,t,dt,v,yawR,air,att){if(!parts)return;if(k==='gator'){const P=parts;P.ph=(P.ph||0)+v*dt*1.55;const run=Math.min(1,v/9);P.legs.forEach(L=>{const a=Math.sin(P.ph+L.ph);L.L.rotation.x=a*.62*run;L.L.rotation.z=L.s*(.1+Math.max(0,-a)*.25*run);L.low.rotation.x=Math.max(0,a)*.5*run});
  P.body.position.y=Math.abs(Math.sin(P.ph))*.05*run+(air?.08:0);P.body.rotation.z=Math.sin(P.ph)*.04*run;P.head.rotation.x=Math.sin(P.ph*2)*.04*run-(air?.15:0);P.head.rotation.y=Math.sin(t*.7)*.06*(1-run);
  P.tail.forEach((s,i)=>{s.rotation.y=Math.sin(P.ph*.5-i*.55+t*(1-run)*1.3)*(.08+.05*i)*(.4+run)+yawR*.04*i;s.rotation.x=air?.05*i:0});const bite=t-att;P.jaw.rotation.x=bite>=0&&bite<.45?Math.sin(bite/.45*Math.PI)*.75:Math.max(0,Math.sin(t*.4))*.04}
 else if(k==='drum')drumAnim(parts,t,dt,v,yawR,air,att);
 else if(k==='melon')melonAnim(parts,t,dt,v,yawR,air,att);
 else{const H=parts.hyd||(parts.hyd=hydNew());hydTick(H,dt,t);carPose(parts,H,t,dt,v,yawR,air,att)}}
function rideTick(t,dt){if(!RIDE.on)return;if(!W4.on||!W4.F||!W4.F.wide||deadT>0){rideOff(true);return}
 const d=Math.hypot(heroPos.x-RIDE.lastX,heroPos.z-RIDE.lastZ);RIDE.lastX=heroPos.x;RIDE.lastZ=heroPos.z;const v=dt>0&&d<20?d/dt:0;RIDE.spd+=(v-RIDE.spd)*Math.min(1,dt*8);
 let dy=heroYaw-(RIDE.yaw0||heroYaw);dy=Math.atan2(Math.sin(dy),Math.cos(dy));RIDE.yaw0=heroYaw;RIDE.yawR=(RIDE.yawR||0)+((dt>0?dy/dt:0)-(RIDE.yawR||0))*Math.min(1,dt*6);
 const air=typeof jH==='number'&&jH>0;RIDE.parts.ph=RIDE.parts.ph||0;
 // the Mothership lifts higher off a jump and, held, glides down slow enough to cross the Gap
 if(RIDE.on==='melon'&&typeof jV==='number'){if(air&&!RIDE.air0&&jV>0)jV*=1.25;const gl=air&&jV<0&&typeof held==='function'&&held('jump');if(gl&&jV<-1.8)jV=-1.8;RIDE.parts.glide=gl}
 if(RIDE.on==='drum'){const fl=air&&typeof jV==='number'&&jV<0&&typeof held==='function'&&held('jump');RIDE.parts.flut=fl;if(fl&&jV<-4.2)jV=-4.2;if(fl&&!RIDE.fl0)drumBawk(heroPos.x,heroPos.z,0);RIDE.fl0=fl}
 if(RIDE.on==='car'){const H=RIDE.parts.hyd||(RIDE.parts.hyd=hydNew());if(air&&!RIDE.air0){H.pop=t;try{mpFx('w4rp',[1])}catch(e){}hydSound(true,4)}if(!air&&RIDE.air0)hydSound(false,1);hydPad(t)}RIDE.air0=air;
 rideAnim(RIDE.parts,RIDE.on,t,dt,RIDE.spd,RIDE.yawR,air,RIDE.att);try{hydPanel(false);rideBar()}catch(e){}
 if(heroCG){if(RIDE.on==='gator'){heroCG.rotation.x=0;heroCG.rotation.y=0}rideSeat(heroCG,RIDE.on,RIDE.parts)}   // (no flips in the saddle: the jump's own flip runs before this and is undone)
 // the lowrider runs people over (once a half second each, and it has to be going)
 if(RIDE.on==='car'&&RIDE.spd>9){const fx=Math.sin(heroYaw),fz=Math.cos(heroYaw);for(const e of enemies){if(e.hp<=0||e.isGuard&&e.skin)continue;const dx=e.x-heroPos.x,dz=e.z-heroPos.z,along=dx*fx+dz*fz,side=Math.abs(-dx*fz+dz*fx);if(along>-1&&along<4.2&&side<1.9&&t-(e.ramT||-9)>.5){e.ramT=t;damageEnemy(e,5*PWR()*2.2,t);rideThud(e.x,e.z)}}}}
// ---- attacking from the saddle: the gator bites (everything in front of its jaws); the lowrider plays its horn and slams down on its
// hydraulics (a ring of hurt round it)
function rideAttack(t){if(t-RIDE.att<(RIDE.on==='gator'?.55:RIDE.on==='drum'?.75:RIDE.on==='melon'?.6:1.1))return;RIDE.att=t;const fx=Math.sin(heroYaw),fz=Math.cos(heroYaw);
 if(RIDE.on==='gator'){const cx=heroPos.x+fx*3.2,cz=heroPos.z+fz*3.2,dmg=5*PWR()*3.2;enemies.forEach(e=>{if(e.hp<=0)return;const dx=e.x-heroPos.x,dz=e.z-heroPos.z,d=Math.hypot(dx,dz);if(d<6.8&&(d<1.5||(dx*fx+dz*fz)/d>.35))damageEnemy(e,dmg,t)});
  bombs.forEach(b=>{if(!bombAlive(b))return;if(Math.hypot(b.x-cx,b.z-cz)<3.6)damageBomb(b,dmg,t)});rideChomp(cx,cz);try{whoosh(cx,cz,.3,.3,500,2400)}catch(e){}}
 else if(RIDE.on==='drum')drumAttack(t);
 else if(RIDE.on==='melon')melonAttack(t);
 else{const dmg=5*PWR()*2.6;enemies.forEach(e=>{if(e.hp>0&&Math.hypot(e.x-heroPos.x,e.z-heroPos.z)<7.5)damageEnemy(e,dmg,t)});bombs.forEach(b=>{if(bombAlive(b)&&Math.hypot(b.x-heroPos.x,b.z-heroPos.z)<7.5)damageBomb(b,dmg,t)});
  try{ringFx2(heroPos.x,hero.position.y,heroPos.z,0xffd060,7.5);smokeFx(heroPos.x,hero.position.y+.4,heroPos.z,4,true);shake=Math.max(shake,.25)}catch(e){}rideHorn(heroPos.x,heroPos.z,2)}
 try{mpFx('w4ra',[R1(heroPos.x),R1(hero.position.y),R1(heroPos.z),R2(heroYaw),RIDE.on==='gator'?0:RIDE.on==='drum'?2:RIDE.on==='melon'?3:1])}catch(e){}}
(function(){const pa=playerAttack;playerAttack=function(t){if(W4.on&&RIDE.on){rideAttack(t);return}return pa.apply(this,arguments)}})();
// ---- the sounds: a gator's chomp and growl, the horn (the old five-note one), the thump of somebody under the bumper
function rideTone(f,type,t0,dur,vol){const ac=audioCtx();if(!ac)return;const T=ac.currentTime+t0,o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(.0001,T);g.gain.exponentialRampToValueAtTime(vol,T+.02);g.gain.setValueAtTime(vol,T+dur*.8);g.gain.exponentialRampToValueAtTime(.0001,T+dur);o.connect(g);g.connect(ac.destination);o.start(T);o.stop(T+dur+.05)}
function rideNear2(x,z){const d=Math.hypot(x-heroPos.x,z-heroPos.z);return d<14?1:Math.max(0,1-(d-14)/60)}
function rideHorn(x,z,kind){try{const k=rideNear2(x,z)*.09;if(k<.01)return;const N=kind===2?[[392,.12],[392,.12],[392,.12],[523,.3],[659,.36]]:[[440,.16],[554,.28]];let t0=0;N.forEach(([f,d])=>{rideTone(f,'square',t0,d,k);rideTone(f*1.5,'sawtooth',t0,d,k*.4);t0+=d+.03})}catch(e){}}
function rideChomp(x,z){try{const k=rideNear2(x,z)*.3;if(k<.02)return;rideTone(110,'sawtooth',0,.12,k);rideTone(70,'square',.05,.16,k*.8)}catch(e){}}
function rideGrowl(x,z){try{const k=rideNear2(x,z)*.18;if(k<.02)return;rideTone(62,'sawtooth',0,.7,k);rideTone(66,'square',.05,.6,k*.5)}catch(e){}}
function rideThud(x,z){try{const k=rideNear2(x,z)*.3;if(k<.02)return;rideTone(80,'triangle',0,.18,k);shake=Math.max(shake,.12)}catch(e){}}
// ---- F: on at the stable or the garage, off anywhere (unless a chest, a door or a puzzle piece is right there: those come first)
// the Mothership has one jump (it lifts higher, then glides): no double or triple jump off it, so nobody rides it onto a 27-pace wall
(function(){if(typeof tryJump!=='function')return;const tj=tryJump;tryJump=function(t){if(W4.on&&RIDE.on==='melon'&&typeof jumps==='number'&&jumps>=1)return;return tj.apply(this,arguments)}})();
// somebody standing closer to you than the ride's spot gets the F (and the prompt): you can always talk to the keepers, quest givers included
function rideNpcFirst(s){const ds=Math.hypot(heroPos.x-s.ix,heroPos.z-s.iz);return (W4.npcs||[]).some(N=>N&&N.g&&Math.hypot(heroPos.x-N.g.position.x,heroPos.z-N.g.position.z)<Math.min(ds,7.5))}
W4.px.push({near:()=>{if(!W4.on||!W4.F||!W4.F.wide)return null;if(RIDE.on)return RIDE.on==='gator'?'Get off Kevin':RIDE.on==='drum'?'Get down off the Deacon':RIDE.on==='melon'?'Land the Mothership':'Park the lowrider';const s=rideNear();if(s&&rideNpcFirst(s))return null;return s?(s.k==='gator'?'Saddle up Kevin the gator':s.k==='drum'?'Saddle up Deacon Drumstick':s.k==='melon'?'Board the Melon Mothership':'Take the gold lowrider'):null},
 act:()=>{if(RIDE.on){rideOff();return true}const s=rideNear();if(s){rideOn(s.k);return true}return false}});
// ---- the rides wait at their stations (Kevin in his pen, the lowrider out front of the garage, the Deacon at his coop), idling, until
// somebody takes one out (yours or your partner's: the parked one steps out of sight while it is being ridden)
(function(){const fl=floorLook;floorLook=function(F,G){const r=fl.apply(this,arguments);try{if(F&&F.wide&&F.stations){F.parked=[];F.stations.forEach(s=>{if(!RIDES[s.k])return;const g=RIDES[s.k].mk();g.position.set(s.x,towerH(s.x,s.z),s.z);g.rotation.y=s.face||0;g.traverse(o=>{if(o.isMesh)o.castShadow=true});G.add(g);F.parked.push({k:s.k,g,parts:g.userData.parts})})}}catch(e){console.warn('parked rides',e)}return r}})();
function rideParkTick(t,dt){const F=W4.F;if(!F||!F.parked)return;const out={};if(RIDE.on)out[RIDE.on]=1;if(MP.on)for(const id in MP.players){const P=MP.players[id];if(P&&P.w4rd&&P.rdK)out[P.w4rd]=1}
 F.parked.forEach(p=>{p.g.visible=!out[p.k];if(!p.g.visible||Math.hypot(p.g.position.x-heroPos.x,p.g.position.z-heroPos.z)>110)return;try{rideAnim(p.parts,p.k,t,dt,0,0,false,-9)}catch(e){}})}
// ---- off when the floor changes (the ride stays on its own floor); the camera sits back a little for the car
(function(){const lf=loadFloor;loadFloor=function(){if(RIDE.on)rideOff(true);RIDE.race=null;return lf.apply(this,arguments)}})();
(function(){const wt=W4.tick;W4.tick=function(t,dt){const r=wt.apply(this,arguments);try{rideTick(t,dt);rideRaceTick(t,dt);rideParkTick(t,dt)}catch(e){if(!W4.rdErr){W4.rdErr=1;console.error('tower ride',e)}}return r}})();
// ---- your partner sees you ride: the ride goes out with your presence; their screen builds it under you, seats you and moves it with you
(function(){const pr=W4.pres;W4.pres=function(){const o=pr.apply(this,arguments);o.rd=RIDE.on||0;const H=RIDE.on==='car'&&RIDE.parts&&RIDE.parts.hyd;if(H){o.rh=H.tgt.reduce((m,v,i)=>m|(v?1<<i:0),0);o.rh2=H.dance?1:0}return o}})();
(function(){if(typeof mpPeers!=='function')return;const mp=mpPeers;mpPeers=function(ch){const r=mp.apply(this,arguments);try{(ch.peers||[]).forEach(p=>{const P=MP.players[p.peer];if(P&&p.presence&&p.presence.w4){P.w4rd=p.presence.w4.rd||0;P.w4rh=p.presence.w4.rh|0;P.w4rd2=p.presence.w4.rh2|0}else if(P)P.w4rd=0})}catch(e){}return r}})();
function rideRemote(P,st,t,dt){const want=W4.on&&W4.F&&W4.F.wide&&P.w4rd&&RIDES[P.w4rd]?P.w4rd:0;if(P.rdK!==want){if(P.rdG&&P.g)P.g.remove(P.rdG);P.rdG=null;P.rdK=want;if(P.cg){rideHips(P.cg).forEach(h=>h.rotation.set(0,0,0));if(!want&&P.cg0)P.cg.position.copy(P.cg0)}
  if(want&&P.g){const g=RIDES[want].mk();g.traverse(o=>o.layers.set(0));P.g.add(g);P.rdG=g;if(P.cg&&!P.cg0)P.cg0=P.cg.position.clone()}}
 if(!P.rdG||!P.cg)return;const parts=P.rdG.userData.parts,c=P.g.position;const d=Math.hypot(c.x-(P.rdX==null?c.x:P.rdX),c.z-(P.rdZ==null?c.z:P.rdZ));P.rdX=c.x;P.rdZ=c.z;const v=dt>0&&d<20?d/dt:0;P.rdV=(P.rdV||0)+(v-(P.rdV||0))*Math.min(1,dt*8);
 let dy=P.g.rotation.y-(P.rdY==null?P.g.rotation.y:P.rdY);dy=Math.atan2(Math.sin(dy),Math.cos(dy));P.rdY=P.g.rotation.y;P.rdYR=(P.rdYR||0)+((dt>0?dy/dt:0)-(P.rdYR||0))*Math.min(1,dt*6);
 if(want==='car'){const H=parts.hyd||(parts.hyd=hydNew());const m=P.w4rh|0;if(!(P.w4rd2&1)){H.dance=0;H.tgt=[m&1?1:0,m&2?1:0,m&4?1:0,m&8?1:0]}else if(!H.dance){H.dance=1;H.dT=0}if(P.rdPop>0&&P.rdPop!==H.pop0){H.pop0=P.rdPop;H.pop=P.rdPop}}
 rideAnim(parts,want,t,dt,P.rdV,P.rdYR,(st.m|0)===4,P.rdAtt||-9);if(want!=='car'){P.cg.rotation.x=0;P.cg.rotation.y=0}rideSeat(P.cg,want,parts);ridePose(P.cg,want)}
(function(){if(typeof mpAvatarFx!=='function')return;const af=mpAvatarFx;mpAvatarFx=function(P,st,t,dt){const r=af.apply(this,arguments);try{rideRemote(P,st,t,dt)}catch(e){}return r}})();
MPFX_DO.w4ra=(P,a,t)=>{if(!Array.isArray(a))return;if(P)P.rdAtt=t;const x=+a[0],y=+a[1],z=+a[2];if(+a[4]===3){melonSeeds(x,y+1.6,z,+a[3])}else if(+a[4]===2){try{ringFx2(x,y+.4,z,0xffb040,6.6);dustPuff(x,y,z,t)}catch(e){}drumBawk(x,z,1)}else if(+a[4]===1){try{ringFx2(x,y,z,0xffd060,7.5);smokeFx(x,y+.4,z,4,true)}catch(e){}rideHorn(x,z,2)}else rideChomp(x+Math.sin(+a[3])*3.2,z+Math.cos(+a[3])*3.2)};
// ---- the Lowrider Loop: ride through the start arch and the clock runs; the other three arches in order, then the start again: your time.
// Under the floor's times a chest's worth of loot (the first finish on a floor in your save pays; later ones just chase your best time)
function rideRaceTick(t,dt){const F=W4.F,R0=F&&F.wide&&F_RACE.get(F.n);const el=$('w4race');if(!R0){if(el)el.style.display='none';RIDE.race=null;return}
 const at=i=>{const g=R0.gates[i],u=[Math.cos(g.face),-Math.sin(g.face)],n=[Math.sin(g.face),Math.cos(g.face)],dx=heroPos.x-g.x,dz=heroPos.z-g.z;return Math.abs(dx*u[0]+dz*u[1])<10.5&&Math.abs(dx*n[0]+dz*n[1])<2.4&&hero.position.y<towerH(g.x,g.z)+9};
 const R=RIDE.race;if(deadT>0&&R){RIDE.race=null;toast('Race over: you went down.');return}
 if(!R){if(at(0)&&t-(RIDE.raceEnd||-9)>3){RIDE.race={t0:t,next:1,on:RIDE.on||'feet'};rideHorn(heroPos.x,heroPos.z,1);try{bossYell('THE LOWRIDER LOOP','Go! Arch 2 next. The clock is running.')}catch(e){}}}
 else{const i=R.next%4;if(at(i)){if(i===0){const time=t-R.t0;RIDE.race=null;RIDE.raceEnd=t;raceFinish(time,R0)}else{R.next++;try{dblChing(heroPos.x,heroPos.z,.5,1.2+i*.15,2)}catch(e){}}}
  if(t-R.t0>180){RIDE.race=null;toast('Race over: three minutes is a long lap.')}}
 (F.archG||[]).forEach((g,i)=>{if(!g)return;const want=RIDE.race?(RIDE.race.next%4===i?.32+Math.sin(t*6)*.12:0):(i===0?.12+Math.sin(t*2)*.06:0);g.material.opacity+=(want-g.material.opacity)*Math.min(1,dt*6)});
 if(el){const near=Math.hypot(heroPos.x-R0.gates[0].x,heroPos.z-R0.gates[0].z)<70;if(RIDE.race){el.style.display='block';const tt=t-RIDE.race.t0;el.innerHTML='<b>THE LOWRIDER LOOP</b> '+raceClock(tt)+' · next: '+(RIDE.race.next%4===0?'the finish':'arch '+(RIDE.race.next%4+1))+'<small>beat '+raceClock(R0.par[0])+' · '+raceClock(R0.par[1])+' · '+raceClock(R0.par[2])+'</small>'}
  else if(near){el.style.display='block';const best=raceBest(F.n);el.innerHTML='<b>THE LOWRIDER LOOP</b> ride through the start arch'+(best?' · your best '+raceClock(best):'')+'<small>beat '+raceClock(R0.par[0])+' · '+raceClock(R0.par[1])+' · '+raceClock(R0.par[2])+' for loot</small>'}else el.style.display='none'}}
function raceClock(s){const m=Math.floor(s/60),r=s-m*60;return m+':'+(r<10?'0':'')+r.toFixed(1)}
function raceBest(n){try{const o=saveLoad();return o.race&&o.race[W4.seed+':'+n]||0}catch(e){return 0}}
function raceFinish(time,R0){const n=W4.fl;let best=raceBest(n);const nb=!best||time<best;try{const o=saveLoad();o.race=o.race||{};if(nb)o.race[W4.seed+':'+n]=Math.round(time*10)/10;localStorage.setItem(SAVEK,JSON.stringify(o))}catch(e){}
 const tier=time<R0.par[0]?'secret':time<R0.par[1]?'vault':time<R0.par[2]?'chest':null;const paid=typeof saveHas==='function'&&saveHas('r',0);
 if(tier&&!paid){const L=lootRoll(tier,n,srand((W4.seed|0)*13+n*71+(Math.round(time*10)|0)));lootGive(L);try{saveMark('r',0)}catch(e){}try{bossYell('LAP: '+raceClock(time),'Under '+raceClock(time<R0.par[0]?R0.par[0]:time<R0.par[1]?R0.par[1]:R0.par[2])+'. '+(nb?'A new best. ':'')+'The Loop pays.')}catch(e){}}
 else{const c=8+n;W4.coins=(W4.coins|0)+c;saveNow();W4.hud();try{bossYell('LAP: '+raceClock(time),(nb?'A new best! ':'')+(tier?'The Loop already paid you on this floor: +'+c+' doubloons for the lap.':'Too slow for the loot. +'+c+' doubloons for trying.'))}catch(e){}}}
(function(){const st=document.createElement('style');st.textContent='#w4race{position:fixed;left:50%;top:calc(58px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:60;display:none;background:rgba(20,12,6,.82);border:1px solid #d9a425;border-radius:10px;padding:6px 14px;color:#f2e2c8;font:700 15px system-ui;text-align:center;pointer-events:none;font-variant-numeric:tabular-nums}#w4race b{color:#ffd040;margin-right:6px}#w4race small{display:block;font:600 11.5px system-ui;color:#cdb898}';document.head.appendChild(st);
 const el=document.createElement('div');el.id='w4race';document.body.appendChild(el)})();
// ---- the motor pool's people: Lowrider Lou by the garage, Gator Greg by the pen
(function(){const fp=floorPeople;floorPeople=function(F){const r=fp.apply(this,arguments);try{if(F&&F.wide&&F.stations){const g=F.stations.find(s=>s.k==='car'),k=F.stations.find(s=>s.k==='gator');
  if(g)npcMake('doubloon',g.x+6,g.z+10,Math.PI*.8,'Lowrider Lou',['This is a 1964 Dabloon DeVille. Gold flake, white leather, hydraulics on every corner. Bring her back without a scratch.','Jump makes her hop. Attack plays the horn and slams her down. People get out of the way. Mostly.','A hundred-floor tower with a car in it. Do not ask me how she got up here. I do not want to talk about the elevator.']);
  const ml=F.stations.find(s=>s.k==='melon');if(ml)npcMake('samurai',ml.x-4,ml.z+6,Math.PI*.7,'Captain Rind',['The Melon Mothership. Seedless? No. Fearless. Jump and she lifts. Hold jump and she glides. You can glide clean over the Gap if you get a running start.','Attack spits seeds. Seventy miles an hour. Do not ask me how I clocked it. I had a lot of free time.','Bring her back in one piece. She is a melon. She bruises.']);
  const d=F.stations.find(s=>s.k==='drum');if(d)npcMake('doubloon',d.x+1,d.z-5.5,-Math.PI*.6,'Brother Earl',['That is the Deacon. Deacon Drumstick. He was supposed to be Sunday dinner. Then Pastor laid hands on him and he got up and walked. Ran, actually. He has not stopped.','Attack and he spins that bone like he is ushering folks to their seats. Firmly. Hold jump in the air and he flutters. He does not have wings. Do not bring up the wings.','Extra crispy. Very sensitive about it. Do not squeeze him and do not let anybody put hot sauce on him. He considers that a baptism and he is already saved.']);
  if(k)npcMake('zombie',k.ix+3,k.iz-6,-Math.PI*.4,'Gator Greg',['His name is Kevin. He bites. Not you. Probably not you.','Saddle is real leather. Kevin is a real gator. The reins are mostly for show.','If he starts rolling over, get off. That is a death roll. That is not a nap.'])}}catch(e){console.warn('motor pool people',e)}return r}})();
// ---- the switch box: the four corners (Q E Z C), the pairs (T front, B back; the arrow pairs on a controller), all of them (R), the dance (N),
// on a controller hold LB and flick the right stick at a corner (the D-pad does the pairs, Y all, X the dance); or click the switches
function hydSet(i,v){const H=RIDE.on==='car'&&RIDE.parts&&RIDE.parts.hyd;if(!H)return;H.dance=0;const L=Array.isArray(i)?i:[i];const up=v==null?!L.every(k=>H.tgt[k]):!!v;L.forEach(k=>{H.tgt[k]=up?1:0});hydSound(up,L.length);hydPanel(true)}
function hydAll(){const H=RIDE.on==='car'&&RIDE.parts&&RIDE.parts.hyd;if(!H)return;hydSet([0,1,2,3],!H.tgt.every(v=>v))}
function hydDance(){const H=RIDE.on==='car'&&RIDE.parts&&RIDE.parts.hyd;if(!H)return;H.dance=H.dance?0:1;H.dT=0;if(!H.dance){H.tgt=[0,0,0,0];hydSound(false,4)}else rideHorn(heroPos.x,heroPos.z,1);hydPanel(true)}
function hydSoundAny(up,n){const H=RIDE.parts;try{const k=rideNear2(heroPos.x,heroPos.z)*.12;if(k<.01)return;const ac=audioCtx();if(!ac)return;const T=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();o.type='sawtooth';o.frequency.setValueAtTime(90,T);o.frequency.exponentialRampToValueAtTime(320,T+.5);g.gain.setValueAtTime(.0001,T);g.gain.exponentialRampToValueAtTime(k,T+.05);g.gain.exponentialRampToValueAtTime(.0001,T+.6);o.connect(g);g.connect(ac.destination);o.start(T);o.stop(T+.62)}catch(e){}}
function hydSound(up,n){try{const k=rideNear2(heroPos.x,heroPos.z)*.12;if(k<.01)return;const ac=audioCtx();if(!ac)return;const T=ac.currentTime;
 if(up){const o=ac.createOscillator(),g=ac.createGain();o.type='sawtooth';o.frequency.setValueAtTime(70,T);o.frequency.exponentialRampToValueAtTime(190+n*12,T+.28);g.gain.setValueAtTime(.0001,T);g.gain.exponentialRampToValueAtTime(k,T+.03);g.gain.exponentialRampToValueAtTime(.0001,T+.34);o.connect(g);g.connect(ac.destination);o.start(T);o.stop(T+.36)}
 else{const N=Math.floor(ac.sampleRate*.45),b=ac.createBuffer(1,N,ac.sampleRate),a=b.getChannelData(0);for(let i=0;i<N;i++)a[i]=(Math.random()*2-1)*Math.pow(1-i/N,1.6);const s=ac.createBufferSource();s.buffer=b;const f=ac.createBiquadFilter();f.type='highpass';f.frequency.value=1800;const g=ac.createGain();g.gain.value=k*(n>2?1.4:1);s.connect(f);f.connect(g);g.connect(ac.destination);s.start(T)}}catch(e){}}
addEventListener('keydown',e=>{if(!W4.on||RIDE.on!=='car'||e.repeat)return;const tg=e.target;if(tg&&(tg.tagName==='INPUT'||tg.tagName==='TEXTAREA'))return;const k=(e.key||'').toLowerCase();
 const map={q:0,e:1,z:2,c:3};let used=true;if(k in map)hydSet(map[k]);else if(k==='t')hydSet([0,1]);else if(k==='b')hydSet([2,3]);else if(k==='r')hydAll();else if(k==='n')hydDance();else used=false;if(used){e.preventDefault();e.stopImmediatePropagation()}},true);
(function(){if(typeof openWheel!=='function')return;const ow=openWheel;openWheel=function(){if(W4.on&&RIDE.on==='car')return;return ow.apply(this,arguments)}})();
(function(){const da=doAction;doAction=function(a){if(W4.on&&RIDE.on==='car'&&typeof padNow!=='undefined'&&padNow&&padNow[4]&&(a==='door'||a==='openDoor'||a==='wheel'))return;return da.apply(this,arguments)}})();
// a controller: hold LB, flick the right stick at a corner; the D-pad's arms do the pairs; Y all up or down; X the dance (the camera holds still)
function hydPad(t){if(RIDE.on!=='car'||typeof padNow==='undefined'||!padNow)return;const lb=!!padNow[4];const S=RIDE.hp||(RIDE.hp={prev:[],cam:null,fl:0});
 if(lb&&!S.cam)S.cam=[camYaw,camPitch];if(!lb)S.cam=null;
 if(lb){camYaw=S.cam[0];camPitch=S.cam[1];let gp=null;try{const ps=navigator.getGamepads?navigator.getGamepads():[];gp=ps[typeof gpIdx==='number'&&gpIdx>=0?gpIdx:0]}catch(e){}
  if(gp){const x=gp.axes[2]||0,y=gp.axes[3]||0,m=Math.hypot(x,y);if(m>.7&&!S.fl){S.fl=1;hydSet(y<0?(x<0?0:1):(x<0?2:3))}else if(m<.35)S.fl=0}
  const edge=b=>padNow[b]&&!S.prev[b];if(edge(12))hydSet([0,1]);if(edge(13))hydSet([2,3]);if(edge(14))hydSet([0,2]);if(edge(15))hydSet([1,3]);if(edge(3))hydAll();if(edge(2))hydDance()}
 S.prev=padNow.slice()}
(function(){const st=document.createElement('style');st.textContent='#w4hyd{position:fixed;right:max(14px,env(safe-area-inset-right,0px));bottom:calc(150px + env(safe-area-inset-bottom,0px));z-index:58;display:none;width:236px;background:linear-gradient(rgba(30,18,8,.94),rgba(12,7,3,.94));border:1px solid #d9a425;border-radius:14px;padding:10px 12px 9px;color:#f2e2c8;font:12px system-ui;box-shadow:0 8px 26px rgba(0,0,0,.55);user-select:none}'+
 '#w4hyd h4{margin:0 0 6px;font:900 12px system-ui;letter-spacing:.14em;color:#ffd040;text-align:center}#w4hyd .car{position:relative;width:212px;height:150px;margin:0 auto}#w4hyd .car svg{position:absolute;inset:0}'+
 '#w4hyd .sw{position:absolute;width:46px;height:40px;border-radius:12px;border:1px solid #6a5636;background:#1c130b;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;transition:background .15s,box-shadow .15s}'+
 '#w4hyd .sw.on{background:radial-gradient(#ffcf4a,#b07a10);box-shadow:0 0 14px rgba(255,200,60,.75);border-color:#ffe08a}#w4hyd .sw i{font-style:normal;font:900 9.5px system-ui;color:#cdb898;letter-spacing:.04em}#w4hyd .sw.on i{color:#2a1a04}'+
 '#w4hyd .row{display:flex;gap:5px;justify-content:center;margin-top:6px}#w4hyd .b{flex:1;display:flex;align-items:center;justify-content:center;gap:4px;padding:4px 2px;border-radius:9px;border:1px solid #6a5636;background:#1c130b;cursor:pointer;font:800 10.5px system-ui;color:#e8d8bc}#w4hyd .b.on{background:#7a5a10;border-color:#ffd040}'+
 '#w4hyd .pad{margin-top:6px;font:600 10.5px system-ui;color:#b8a184;text-align:center;line-height:1.5}#w4hyd kbd.kc{min-width:18px;height:18px;font-size:10.5px;padding:0 4px}#w4hyd svg.pg{width:auto;height:18px}';document.head.appendChild(st);
 const el=document.createElement('div');el.id='w4hyd';document.body.appendChild(el);el.addEventListener('pointerdown',e=>{e.stopPropagation();const b=e.target.closest('[data-h]');if(!b)return;e.preventDefault();const h=b.dataset.h;if(h==='all')hydAll();else if(h==='dance')hydDance();else if(h==='hop'){try{jumpQueued=true}catch(_){}}else hydSet(JSON.parse(h))})})();
function hydPanel(force){const el=$('w4hyd');if(!el)return;const H=RIDE.on==='car'&&RIDE.parts&&RIDE.parts.hyd;if(!H){if(el.style.display!=='none')el.style.display='none';return}
 const key=H.tgt.join('')+(H.dance?'d':'')+(typeof PADLAST!=='undefined'&&PADLAST?'p':'k');if(!force&&el.dataset.k===key&&el.style.display==='block')return;el.dataset.k=key;
 const sw=(i,x,y,k)=>'<div class="sw'+(H.tgt[i]?' on':'')+'" data-h="'+i+'" style="left:'+x+'px;top:'+y+'px">'+kcap(k)+'<i>'+['FRONT L','FRONT R','BACK L','BACK R'][i]+'</i></div>';
 el.innerHTML='<h4>HYDRAULICS</h4><div class="car"><svg viewBox="0 0 212 150"><rect x="66" y="12" width="80" height="126" rx="26" fill="#3a2a10" stroke="#d9a425" stroke-width="2"/><rect x="76" y="44" width="60" height="44" rx="8" fill="#1a1208" stroke="#8a6a30"/><path d="M80 18h52" stroke="#ffd27a" stroke-width="2"/><text x="106" y="10" text-anchor="middle" font-size="8" font-weight="900" fill="#cdb898" font-family="system-ui">FRONT</text></svg>'+
  sw(0,10,14,'Q')+sw(1,156,14,'E')+sw(2,10,96,'Z')+sw(3,156,96,'C')+'</div>'+
  '<div class="row"><span class="b'+(H.tgt[0]&&H.tgt[1]?' on':'')+'" data-h="[0,1]">'+kcap('T')+'Front</span><span class="b'+(H.tgt[2]&&H.tgt[3]?' on':'')+'" data-h="[2,3]">'+kcap('B')+'Back</span><span class="b'+(H.tgt.every(v=>v)?' on':'')+'" data-h="all">'+kcap('R')+'All</span></div>'+
  '<div class="row"><span class="b'+(H.dance?' on':'')+'" data-h="dance">'+kcap('N')+'Dance</span><span class="b" data-h="hop">'+kcap('Space')+'Hop</span></div>'+
  '<div class="pad">'+ctlPadSvg(4)+' hold + '+ctlStickSvg('R','all')+' corner · '+ctlPadSvg(4)+' + '+ctlPadSvg(12)+ctlPadSvg(13)+ctlPadSvg(14)+ctlPadSvg(15)+' pairs<br>'+ctlPadSvg(4)+' + '+ctlPadSvg(3)+' all · '+ctlPadSvg(4)+' + '+ctlPadSvg(2)+' dance · '+ctlMouseSvg(0)+' click a switch</div>';el.style.display='block'}
MPFX_DO.w4rp=(P,a,t)=>{if(P)P.rdPop=t};
// ---- the ride's own controls, always on screen while you ride (the owner: "never wonder how do I do this")
(function(){const st=document.createElement('style');st.textContent='#w4ridebar{position:fixed;left:50%;bottom:calc(76px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:57;display:none;padding:6px 12px;border-radius:12px;background:rgba(18,10,4,.82);border:1px solid rgba(217,164,37,.6);box-shadow:0 4px 16px rgba(0,0,0,.45)}#w4ridebar .rt{font:900 11px system-ui;letter-spacing:.12em;color:#ffd040;margin-right:10px}';document.head.appendChild(st);const el=document.createElement('div');el.id='w4ridebar';document.body.appendChild(el)})();
function rideBar(){const el=$('w4ridebar');if(!el)return;if(!RIDE.on){if(el.style.display!=='none')el.style.display='none';return}const key=RIDE.on+(typeof PADLAST!=='undefined'&&PADLAST?'p':'k');if(el.dataset.k===key&&el.style.display==='flex')return;el.dataset.k=key;
 const what=RIDE.on==='gator'?'Bite':RIDE.on==='drum'?'Bone spin':RIDE.on==='melon'?'Seed spitter':'Horn + slam';el.innerHTML='<span class="rt">'+(RIDE.on==='gator'?'ON KEVIN':RIDE.on==='car'?'IN THE LOWRIDER':RIDE.on==='drum'?'ON THE DEACON':RIDE.on==='melon'?'IN THE MOTHERSHIP':'RIDING')+'</span>'+ctlRow([{a:'attack',t:what},{a:'jump',t:RIDE.on==='car'?'Hop':RIDE.on==='drum'?'Jump · hold: flutter':RIDE.on==='melon'?'Lift · hold: glide':'Jump'},{a:'sprint',t:'Faster'},{a:'door',kb:ctlOf('openDoor').kb,t:'Get off'}]);el.style.display='flex';el.style.alignItems='center'}
// ---------------------------------------------------------------- DEACON DRUMSTICK (the owner, Oct 21 13:52: "why not a fried chicken... a fried
// drumstick with reins that you can kind of ride... make it high quality"). A drumstick as long as a gator, fried to a deep gold: the crust is a
// lathe shape pushed in and out by noise (craggy, never smooth), coloured darker in its cracks, with a picture of the batter, a bump map of the
// same and an oily clear coat; crispy flakes stuck all over it; the bone out the back with its knuckle. It runs on two chicken legs (fried
// thighs, scaled yellow shanks, three toes and a back toe, claws), wears little gold spectacles and a purple bow tie, and carries a church-
// purple blanket, a saddle, stirrups, a bridle round its front and the reins to your hands. Steam comes off the top: fresh out the fryer.
// Attack spins him round and the bone sweeps everybody close; hold jump in the air and he flutters down. Brother Earl keeps him by the coop.
function dnHash(x,y,z){let h=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(z|0,1440662683);h=Math.imul(h^h>>>13,1274126177);return((h^h>>>16)>>>0)/4294967296}
function dnNoise(x,y,z){const X=Math.floor(x),Y=Math.floor(y),Z=Math.floor(z),s=t=>t*t*(3-2*t),u=s(x-X),v=s(y-Y),w=s(z-Z),L=(a,b,t)=>a+(b-a)*t,c=(i,j,k)=>dnHash(X+i,Y+j,Z+k);
 return L(L(L(c(0,0,0),c(1,0,0),u),L(c(0,1,0),c(1,1,0),u),v),L(L(c(0,0,1),c(1,0,1),u),L(c(0,1,1),c(1,1,1),u),v),w)}
// the batter: hundreds of lumps (lighter on their tops, dark between), cracks, pepper and spice; the same lumps make the bump map
function txCrust(){if(ITX.crust)return ITX.crust;const W=512,c=itCanvas(W),g=c.getContext('2d'),h=itCanvas(W),hg=h.getContext('2d'),r=itRng(151);
 g.fillStyle='#a8581a';g.fillRect(0,0,W,W);hg.fillStyle='#707070';hg.fillRect(0,0,W,W);
 for(let i=0;i<1700;i++){const x=r()*W,y=r()*W,s=3+r()*12,k=r();const col=k<.14?'#6a300a':k<.5?'#c06c1c':k<.84?'#d88a2a':'#f2b450';
  for(const [dx,dy] of [[0,0],[W,0],[-W,0],[0,W],[0,-W]]){const X=x+dx,Y=y+dy;if(X<-s||X>W+s||Y<-s||Y>W+s)continue;
   const gr=g.createRadialGradient(X-s*.3,Y-s*.3,s*.1,X,Y,s);gr.addColorStop(0,col);gr.addColorStop(1,'rgba(110,50,10,0)');g.fillStyle=gr;g.beginPath();g.arc(X,Y,s,0,7);g.fill();
   const hr=hg.createRadialGradient(X,Y,0,X,Y,s);hr.addColorStop(0,'rgba(255,255,255,'+(.45+k*.5).toFixed(2)+')');hr.addColorStop(1,'rgba(112,112,112,0)');hg.fillStyle=hr;hg.beginPath();hg.arc(X,Y,s,0,7);hg.fill()}}
 g.strokeStyle='rgba(64,24,4,.5)';hg.strokeStyle='rgba(16,16,16,.55)';for(let i=0;i<150;i++){let x=r()*W,y=r()*W;g.lineWidth=hg.lineWidth=1+r()*2.2;g.beginPath();hg.beginPath();g.moveTo(x,y);hg.moveTo(x,y);for(let k=0;k<5;k++){x+=(r()-.5)*26;y+=(r()-.5)*26;g.lineTo(x,y);hg.lineTo(x,y)}g.stroke();hg.stroke()}
 for(let i=0;i<5200;i++){g.fillStyle=r()<.62?'rgba(36,14,4,'+(.3+r()*.5).toFixed(2)+')':'rgba(255,224,150,'+(.2+r()*.4).toFixed(2)+')';g.fillRect(r()*W,r()*W,1.4,1.4)}
 return ITX.crust={map:itTex(c,false,3,2),nm:itNormal(h,4.5,3,2)}}
// a chicken's shank: rings of yellow scales
function txShank(){if(ITX.shank)return ITX.shank;const c=itCanvas(128,256),g=c.getContext('2d');g.fillStyle='#e0a030';g.fillRect(0,0,128,256);
 for(let j=0;j<16;j++){const y=j*16,gr=g.createLinearGradient(0,y,0,y+16);gr.addColorStop(0,'#f8cc5c');gr.addColorStop(.7,'#d8901e');gr.addColorStop(1,'#7a4a0c');g.fillStyle=gr;g.fillRect(0,y,128,16);
  g.strokeStyle='rgba(110,64,8,.55)';g.lineWidth=1.3;for(let i=0;i<4;i++){const x=i*32+(j%2)*16;g.beginPath();g.moveTo(x,y);g.lineTo(x,y+16);g.stroke()}}
 return ITX.shank={map:itTex(c,false,1,1),nm:itNormal(c,3,1,1)}}
function drumMats(){if(ITM.drumC)return ITM;const T=txCrust(),S=txShank(),E=itEnv();
 ITM.drumC=new THREE.MeshPhysicalMaterial({map:T.map,normalMap:T.nm,normalScale:new THREE.Vector2(1.25,1.25),vertexColors:true,roughness:.5,metalness:0,clearcoat:.55,clearcoatRoughness:.38,envMapIntensity:.9});
 ITM.drumF=new THREE.MeshPhysicalMaterial({map:T.map,normalMap:T.nm,color:0xffe0a0,roughness:.55,metalness:0,clearcoat:.4,clearcoatRoughness:.45,envMapIntensity:.8});
 ITM.drumB=new THREE.MeshPhysicalMaterial({color:0xf0e2c4,roughness:.36,metalness:0,clearcoat:.35,clearcoatRoughness:.3,envMapIntensity:.7});
 ITM.drumS=new THREE.MeshStandardMaterial({map:S.map,normalMap:S.nm,normalScale:new THREE.Vector2(.9,.9),roughness:.55,metalness:0,envMapIntensity:.6});
 ITM.drumK=new THREE.MeshStandardMaterial({color:0x2a1e14,roughness:.35,metalness:.1});
 ITM.drumP=new THREE.MeshPhysicalMaterial({color:0x4a1670,roughness:.6,metalness:0,sheen:new THREE.Color(0xb080ff),side:THREE.DoubleSide});
 ITM.drumW=new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.12,metalness:0,clearcoat:1,clearcoatRoughness:.05});
 ITM.drumI=new THREE.MeshStandardMaterial({color:0x0c0806,roughness:.2,metalness:0});
 [ITM.drumC,ITM.drumF,ITM.drumB,ITM.drumS,ITM.drumK,ITM.drumP,ITM.drumW,ITM.drumI].forEach(m=>{if(E)m.envMap=E});return ITM}
// the crust's shape: the profile (radius along the length, bulb in front) smoothed into 80 rings of 112, pushed in and out by three
// octaves of noise (ridged: craggy, not wavy); the cracks come out darker in the vertex colours. The seam and the tip get one normal each.
function drumGeo(){if(ITX.drumGeo)return ITX.drumGeo;
 const P=DRUMP.slice().reverse();
 const pts=new THREE.SplineCurve(P.map(p=>new THREE.Vector2(p[0],p[1]))).getPoints(80);pts[pts.length-1].x=0;
 const SEG=112,g=new THREE.LatheGeometry(pts,SEG);g.computeVertexNormals();const pos=g.attributes.position,nor=g.attributes.normal,n=pos.count,np=pts.length;
 const col=new Float32Array(n*3),dsp=new Float32Array(n);
 for(let i=0;i<n;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);const r=Math.hypot(x,z);const end=y<-1.42?Math.max(0,1-(-1.42-y)/.16):1;
  const rg=1-Math.abs(2*dnNoise(x*4.2+7,y*4.2,z*4.2)-1),n2=dnNoise(x*11+3,y*11,z*11),n3=dnNoise(x*27,y*27+5,z*27);
  const d=(rg*.075+(n2-.5)*.05+(n3-.5)*.022)*end*(r<.05?0:1);dsp[i]=d;pos.setXYZ(i,x+nor.getX(i)*d,y+nor.getY(i)*d,z+nor.getZ(i)*d);
  const k=Math.max(0,Math.min(1,.55+d*7));col[i*3]=.62+.42*k;col[i*3+1]=.5+.45*k;col[i*3+2]=.42+.4*k}
 g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeVertexNormals();
 // one normal at the seam (the first and last ring of the lathe) and one at the tip
 const N=g.attributes.normal,v=new THREE.Vector3();for(let j=0;j<np;j++){const a=j,b=SEG*np+j;v.set(N.getX(a)+N.getX(b),N.getY(a)+N.getY(b),N.getZ(a)+N.getZ(b)).normalize();N.setXYZ(a,v.x,v.y,v.z);N.setXYZ(b,v.x,v.y,v.z)}
 v.set(0,0,0);for(let i=0;i<=SEG;i++){const a=i*np+np-1;v.x+=N.getX(a);v.y+=N.getY(a);v.z+=N.getZ(a)}v.normalize();for(let i=0;i<=SEG;i++)N.setXYZ(i*np+np-1,v.x,v.y,v.z);
 g.rotateX(Math.PI/2);g.computeBoundingSphere();g.userData.shared=true;return ITX.drumGeo=g}
// the radius of the crust at a point along its length (the smoothed profile, before the noise)
const DRUMP=[[0,2.06],[.36,2.02],[.62,1.92],[.8,1.74],[.91,1.48],[.95,1.16],[.93,.8],[.86,.42],[.75,.04],[.62,-.34],[.5,-.68],[.41,-.98],[.35,-1.22],[.31,-1.4],[.26,-1.52],[.19,-1.58]];
function drumR(z){const P=DRUMP;if(z>=P[0][1])return 0;for(let i=1;i<P.length;i++){if(P[i][1]<=z){const a=P[i-1],b=P[i],k=(z-a[1])/(b[1]-a[1]);return a[0]+(b[0]-a[0])*k}}return .19}
function drumModel(){const G=new THREE.Group(),M=drumMats(),r=itRng(173);
 const add=(par,geo,mat,p,sc,rot)=>{const m=new THREE.Mesh(geo,mat);m.position.set(p[0],p[1],p[2]);if(sc)m.scale.set(sc[0],sc[1],sc[2]);if(rot)m.rotation.set(rot[0],rot[1],rot[2]);par.add(m);return m};
 const body=new THREE.Group();body.name='dbody';body.position.y=1.5;G.add(body);
 add(body,drumGeo(),M.drumC,[0,0,0]);
 // crispy flakes stuck on: little broken bits of batter, more on top and round the bulb than underneath
 {const fl=new THREE.Group();for(let k=0;k<150;k++){const z=-1.3+r()*3.2,a=r()*Math.PI*2;if(Math.sin(a)<-.45&&r()<.7)continue;const R=drumR(z)+.02,s=.05+r()*.09;
   const m=add(fl,new THREE.IcosahedronGeometry(1,0),M.drumF,[Math.cos(a)*R,Math.sin(a)*R,z],[s*(1+r()),s*(.5+r()*.5),s*(1+r())],[r()*3,r()*3,r()*3])}body.add(fl);itMerge(fl)}
 // the bone out the back: the shaft, the knuckle (two knobs and the cartilage cap), a ragged collar of crust where the meat ends
 {const b=new THREE.Group();b.name='dbone';b.position.set(0,0,-1.5);body.add(b);
  const sh=new THREE.CylinderGeometry(.13,.17,1.0,20,1);sh.rotateX(Math.PI/2);add(b,sh,M.drumB,[0,0,-.5]);
  [-1,1].forEach(s=>add(b,new THREE.SphereGeometry(.22,24,16),M.drumB,[s*.12,.02,-1.08],[1,.9,1.05]));add(b,new THREE.SphereGeometry(.17,20,14),M.drumB,[0,-.03,-1.18],[1.3,.8,.8]);
  const col=new THREE.TorusGeometry(.2,.09,10,28);add(b,col,M.drumF,[0,0,-.02],[1,1,.8]);for(let k=0;k<9;k++){const a=k/9*Math.PI*2;add(b,new THREE.IcosahedronGeometry(.07+r()*.04,0),M.drumF,[Math.cos(a)*.23,Math.sin(a)*.23,-.08-r()*.08])}
  itMerge(b)}
 // the face: two big eyes (white, with a black pupil and a glint) behind gold spectacles, a smile, a purple bow tie under it
 {const f=new THREE.Group();f.name='dface';body.add(f);const z=1.76,R=drumR(z);
  const eyes=[];[-1,1].forEach(s=>{const dir=new THREE.Vector2(s*.42,.9).normalize(),e=new THREE.Group();e.position.set(dir.x*(R-.02),dir.y*(R-.02),z);f.add(e);e.lookAt(dir.x*2.2,dir.y*1.6+.4,z+3.2);
   add(e,new THREE.SphereGeometry(.21,24,18),M.drumW,[0,0,0],[1,1,.62]);add(e,new THREE.SphereGeometry(.095,18,14),M.drumI,[0,0,.12],[1,1,.5]);add(e,new THREE.SphereGeometry(.03,10,8),M.drumW,[.035,.04,.16]);
   const lid=new THREE.Mesh(new THREE.SphereGeometry(.225,24,12,0,Math.PI*2,0,Math.PI*.5),M.drumF);lid.position.set(0,0,0);lid.scale.set(1,1,.66);lid.rotation.x=-.55;lid.name='lid';e.add(lid);
   const ring=add(e,new THREE.TorusGeometry(.25,.022,10,36),itMat('goldP'),[0,0,.16]);eyes.push({e,lid})});
  const br=new THREE.Mesh(itTube([[-.16,.71,z+.16],[0,.77,z+.2],[.16,.71,z+.16]],.018,12,6),itMat('goldP'));f.add(br);
  [-1,1].forEach(s=>{const a=new THREE.Mesh(itTube([[s*.5,.62,z+.12],[s*.66,.6,z-.25],[s*.7,.55,z-.55]],.014,10,5),itMat('goldP'));f.add(a)});
  f.add(new THREE.Mesh(itTube([[-.2,.33,z+.3],[-.08,.26,z+.34],[.08,.26,z+.34],[.2,.33,z+.3]],.022,16,6),M.drumI));
  const bt=new THREE.Group();bt.position.set(0,-.16,2.1);f.add(bt);bt.rotation.x=.3;[-1,1].forEach(s=>{const w=new THREE.ConeGeometry(.13,.3,4,1);w.rotateZ(s*Math.PI/2);add(bt,w,M.drumP,[s*.15,0,0],[1,1,.5])});add(bt,new THREE.SphereGeometry(.06,12,10),M.drumP,[0,0,.01]);
  G.userData.eyes=eyes}
 // the bridle round the bulb, gold rings at its sides; the blanket, the saddle (gold trim, a horn), the stirrups
 {const z=1.18,R=drumR(z);const br=new THREE.TorusGeometry(R+.03,.04,8,64);add(body,br,itMat('leather'),[0,0,z]);[-1,1].forEach(s=>add(body,new THREE.TorusGeometry(.08,.022,8,20),itMat('goldP'),[s*(R+.06),.05,z],null,[0,Math.PI/2,0]))}
 const sad=new THREE.Group();sad.position.set(0,.93,.25);body.add(sad);
 {const bl=new THREE.CylinderGeometry(.93,.93,1.5,40,1,true,-Math.PI*.36,Math.PI*.72);bl.rotateX(Math.PI/2);bl.rotateZ(Math.PI);add(sad,bl,M.drumP,[0,-.93,0]);
  const tr=new THREE.CylinderGeometry(.945,.945,1.52,40,1,true,-Math.PI*.36,.035);tr.rotateX(Math.PI/2);tr.rotateZ(Math.PI);[-1,1].forEach(s=>{const t=add(sad,tr,itMat('goldP'),[0,-.93,0]);t.rotation.y=s>0?0:Math.PI})}
 add(sad,itRBox(.82,.2,.95,.09,3),itMat('leather'),[0,.08,0]);add(sad,itRBox(.86,.04,1.0,.02,2),itMat('goldP'),[0,0,0]);add(sad,itRBox(.74,.28,.16,.07,3),itMat('leather'),[0,.24,-.42]);
 add(sad,new THREE.CylinderGeometry(.05,.07,.26,10),itMat('goldP'),[0,.27,.44]);add(sad,new THREE.SphereGeometry(.08,12,8),itMat('goldP'),[0,.42,.44]);
 [-1,1].forEach(s=>{add(sad,itRBox(.05,.95,.07,.02,1),itMat('leather'),[s*.72,-.5,.02],null,[0,0,s*.32]);add(sad,new THREE.TorusGeometry(.1,.024,6,16),itMat('goldP'),[s*.9,-1.0,.02],null,[0,Math.PI/2,0])});
 itMerge(sad);
 // the reins: from the bridle's rings up to where your hands are
 {const z=1.18,R=drumR(z);[-1,1].forEach(s=>{const m=new THREE.Mesh(itTube([[s*(R+.06),.05,z],[s*.6,.82,.98],[s*.13,1.44,.78]],.018,16,5),itMat('leather'));body.add(m)})}
 // the legs: a fried thigh, a scaled shank, a foot of three toes and a back toe, dark claws; hip, ankle and toes all move
 const legs=[];[-1,1].forEach((s,i)=>{const H=new THREE.Group();H.position.set(s*.44,-.68,.3);body.add(H);
  add(H,new THREE.SphereGeometry(.26,24,18),M.drumF,[0,-.1,.04],[.85,1.05,.95]);const K=new THREE.Group();K.position.set(0,-.36,.08);H.add(K);
  add(K,new THREE.SphereGeometry(.075,14,10),M.drumS,[0,0,0]);const sh=new THREE.CylinderGeometry(.07,.058,.42,16,1);add(K,sh,M.drumS,[0,-.2,-.06],null,[.3,0,0]);
  const Fo=new THREE.Group();Fo.position.set(0,-.4,-.13);K.add(Fo);add(Fo,new THREE.SphereGeometry(.07,14,10),M.drumS,[0,0,0]);
  const toes=[];[[-.42,.27],[0,.31],[.42,.27],[Math.PI,.15]].forEach(([a,L],k)=>{const T=new THREE.Group();T.rotation.y=a;Fo.add(T);const t1=new THREE.CylinderGeometry(.04,.034,L,10,1);t1.rotateX(Math.PI/2);add(T,t1,M.drumS,[0,-.035,L/2]);
   const c=new THREE.ConeGeometry(.032,.11,8);c.rotateX(Math.PI/2);add(T,c,M.drumK,[0,-.04,L+.04]);toes.push(T)});
  legs.push({H,K,Fo,toes,ph:i?Math.PI:0,s})});
 // steam off the top (it rises, spreads and fades, four puffs out of step)
 const steam=[];for(let k=0;k<4;k++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:itGlowTex(),color:0xfff6e8,transparent:true,opacity:0,depthWrite:false}));sp.position.set((r()-.5)*.6,.95,-.3+r()*1.2);body.add(sp);steam.push({sp,o:k/4,x:sp.position.x,z:sp.position.z})}
 G.userData.parts={body,legs,steam,eyes:G.userData.eyes,bone:body.getObjectByName('dbone'),seat:2.62,seatZ:.25,ph:0,blink:2+r()*3};return G}
// ---- moving: a bird's run (the hip swings, the shank folds up under him as the foot comes forward, the toes curl off the ground and spread
// to land), the body bobs and rolls, the bone wags, he blinks; steam always; a spin when he attacks; a flutter (legs pedalling) in the air
function drumAnim(P,t,dt,v,yawR,air,att){const run=Math.min(1,v/10),fl=air&&P.flut;P.ph+=(fl?14:v*1.9+(air?6:0))*dt;
 P.legs.forEach(L=>{const a=P.ph+L.ph,sw=Math.sin(a),lift=Math.max(0,Math.cos(a)),k=air?1:run;
  L.H.rotation.x=-sw*.72*k+(air?-.35:0);L.K.rotation.x=(air?.8:lift*1.05*k)+(1-k)*.05;L.Fo.rotation.x=air?-.4:-(lift*.7*k)+sw*.15*k;L.toes.forEach((T,i)=>{T.rotation.x=i<3?(air?.5:lift*.6*k):0})});
 const bob=Math.abs(Math.sin(P.ph))*.1*run;P.body.position.y=1.5+bob+(air?.05:0)+(run<.1?Math.sin(t*2.2)*.02:0);P.body.rotation.z=Math.sin(P.ph)*.06*run-yawR*.03;P.body.rotation.x=-run*.06+(air?-.12:0);
 if(P.bone)P.bone.rotation.y=Math.sin(P.ph*.5)*.12*run+Math.sin(t*1.3)*.05;
 // the attack: one full turn in half a second, eased
 const sp=t-att;P.body.rotation.y=sp>=0&&sp<.5?(1-Math.pow(1-sp/.5,3))*Math.PI*2:0;
 // a blink now and then (both lids come down)
 if(t>P.blink){P.blink=t+2.4+Math.random()*3.5;P.bk=t}const bk=t-(P.bk||-9),cl=bk>=0&&bk<.16?Math.sin(bk/.16*Math.PI):0;(P.eyes||[]).forEach(E=>{E.lid.rotation.x=-.55+cl*1.5});
 P.steam.forEach(S=>{const k=(t*.55+S.o)%1;S.sp.position.set(S.x+Math.sin(t+S.o*9)*.12,.95+k*1.6,S.z-run*k*.8);const s=.35+k*1.0;S.sp.scale.set(s,s,1);S.sp.material.opacity=Math.sin(k*Math.PI)*.2*(1-run*.5)})}
function drumAttack(t){const dmg=5*PWR()*2.8,R=6.6;enemies.forEach(e=>{if(e.hp>0&&Math.hypot(e.x-heroPos.x,e.z-heroPos.z)<R)damageEnemy(e,dmg,t)});bombs.forEach(b=>{if(bombAlive(b)&&Math.hypot(b.x-heroPos.x,b.z-heroPos.z)<R)damageBomb(b,dmg,t)});
 try{ringFx2(heroPos.x,hero.position.y+.4,heroPos.z,0xffb040,R);dustPuff(heroPos.x,hero.position.y,heroPos.z,t)}catch(e){}drumBawk(heroPos.x,heroPos.z,1)}
// his voice: a bawk (two quick notes) and the sizzle of hot oil
function drumBawk(x,z,big){try{const k=rideNear2(x,z)*.12;if(k<.01)return;rideTone(big?840:760,'square',0,.07,k);rideTone(big?620:560,'square',.08,.14,k*.8);rideTone(big?1240:1100,'sawtooth',.0,.05,k*.25);
 const ac=audioCtx();if(!ac)return;const T=ac.currentTime,N=Math.floor(ac.sampleRate*.5),b=ac.createBuffer(1,N,ac.sampleRate),a=b.getChannelData(0);for(let i=0;i<N;i++)a[i]=(Math.random()*2-1)*Math.pow(1-i/N,1.2)*(.6+.4*Math.random());
 const s=ac.createBufferSource();s.buffer=b;const f=ac.createBiquadFilter();f.type='highpass';f.frequency.value=3200;const g=ac.createGain();g.gain.value=k*.5;s.connect(f);f.connect(g);g.connect(ac.destination);s.start(T)}catch(e){}}
// ---------------------------------------------------------------- THE MELON MOTHERSHIP (the owner, Oct 21 13:52: "maybe a flying watermelon ship or
// something"). Half a watermelon, flat side up, flying: the rind in its dark and light stripes, the white band at the rim, a red deck with
// black seeds, a gold-rimmed cockpit seat, rind-slice wings, a wooden propeller behind, four thrusters glowing under it. It hovers over the
// ground, bobbing, and it does what nothing else does: jump and it lifts, hold jump and it glides (it comes down very slowly, so a running
// start carries you a long way: right over the Gap). Attack fires a spread of seeds. Captain Rind keeps it on its pad in the Motor Pool.
function txRind(){if(ITX.rind)return ITX.rind;const c=itCanvas(512,256),g=c.getContext('2d'),r=itRng(271);g.fillStyle='#2f8a34';g.fillRect(0,0,512,256);
 for(let k=0;k<14;k++){const x0=k*512/14;g.fillStyle='#0f4a16';g.beginPath();g.moveTo(x0,0);for(let y=0;y<=256;y+=8)g.lineTo(x0+10+Math.sin(y*.09+k)*6+r()*3,y);for(let y=256;y>=0;y-=8)g.lineTo(x0+22+Math.sin(y*.07+k*2)*6+r()*3,y);g.fill()}
 for(let i=0;i<6000;i++){g.fillStyle='rgba('+(r()<.5?'10,40,10':'120,190,90')+','+(r()*.18)+')';g.fillRect(r()*512,r()*256,1.5,1.5)}return ITX.rind={map:itTex(c),nm:itNormal(c,2.2)}}
function melonModel(){const G=new THREE.Group(),T=txRind();const rind=new THREE.MeshPhysicalMaterial({map:T.map,normalMap:T.nm,normalScale:new THREE.Vector2(.6,.6),roughness:.35,metalness:0,clearcoat:.7,clearcoatRoughness:.15,envMapIntensity:.8});
 const white=new THREE.MeshStandardMaterial({color:0xeef4d0,roughness:.5}),flesh=new THREE.MeshPhysicalMaterial({map:txStash('wmfc').map,roughness:.3,clearcoat:.6,clearcoatRoughness:.15,envMapIntensity:.6}),seed=new THREE.MeshStandardMaterial({color:0x120806,roughness:.25});
 const body=new THREE.Group();body.name='mbody';body.position.y=1.15;G.add(body);
 // the hull: the lower half of a long melon (flat side up), the white band, the red deck just inside it
 const hull=new THREE.SphereGeometry(1,64,32,0,Math.PI*2,Math.PI/2,Math.PI/2);hull.scale(1.3,.85,2.3);const h=new THREE.Mesh(hull,rind);body.add(h);
 const band=new THREE.Mesh(new THREE.TorusGeometry(1,.06,10,72),white);band.rotation.x=Math.PI/2;band.scale.set(1.28,2.28,1);band.position.y=.02;body.add(band);
 const deck=new THREE.Mesh(new THREE.CircleGeometry(1,64),flesh);deck.rotation.x=-Math.PI/2;deck.scale.set(1.22,2.22,1);deck.position.y=.03;body.add(deck);
 for(let k=0;k<26;k++){const a=k*2.4,rr=.3+((k*37)%60)/100;const s=new THREE.Mesh(new THREE.SphereGeometry(.05,10,6),seed);s.scale.set(1,.4,1.7);s.position.set(Math.cos(a)*rr*1.1,.06,Math.sin(a)*rr*2);s.rotation.y=a;body.add(s)}
 // the cockpit: a gold-rimmed seat with a back, a little windshield, a stick
 const seat=new THREE.Group();seat.position.set(0,.06,-.35);body.add(seat);itAdd(seat,itRBox(.8,.22,.7,.08,3),'leather',[0,.11,0]);itAdd(seat,itRBox(.8,.7,.16,.07,3),'leather',[0,.45,-.38],[.18,0,0]);itAdd(seat,itRBox(.86,.05,.76,.02,2),'goldP',[0,.01,0]);
 itAdd(body,new THREE.CylinderGeometry(.03,.04,.5,8),'chrome',[0,.3,.35],[.4,0,0]);itAdd(body,new THREE.SphereGeometry(.07,12,8),new THREE.MeshStandardMaterial({color:0xd02020,roughness:.3}),[0,.53,.44]);
 const ws=new THREE.Mesh(new THREE.SphereGeometry(.7,32,12,Math.PI*.2,Math.PI*.6,0,Math.PI*.38),itMat('glass'));ws.position.set(0,.05,.75);ws.scale.set(1,.9,.6);body.add(ws);
 // the wings: two rind slices, and the tail fin
 const wing=(s)=>{const w=new THREE.Group();w.position.set(s*1.2,-.1,-.2);body.add(w);const sh=new THREE.Shape();sh.moveTo(0,-.55);sh.quadraticCurveTo(1.3*1,0,0,.55);sh.lineTo(0,-.55);const g=itExtrude(sh,.1,.03,3,24);g.rotateX(Math.PI/2);if(s<0)g.rotateY(Math.PI);const m=new THREE.Mesh(g,rind);w.add(m);w.userData.s=s;return w};const wings=[wing(-1),wing(1)];
 {const sh=new THREE.Shape();sh.moveTo(0,0);sh.quadraticCurveTo(.1,.9,-.7,1);sh.lineTo(-.5,0);sh.lineTo(0,0);const g=itExtrude(sh,.08,.02,2,16);g.rotateY(Math.PI/2);const f=new THREE.Mesh(g,rind);f.position.set(0,-.05,-1.9);body.add(f)}
 // the propeller behind: a wooden hub and two blades
 const prop=new THREE.Group();prop.position.set(0,.15,-2.35);body.add(prop);itAdd(prop,new THREE.CylinderGeometry(.12,.16,.3,14),'goldP',[0,0,0],[Math.PI/2,0,0]);[0,1].forEach(k=>{const b=itAdd(prop,itRBox(.16,1.3,.05,.03,2),'wood',[0,0,-.05]);b.rotation.z=k*Math.PI;b.position.set(0,0,-.05);b.geometry=b.geometry.clone();b.geometry.translate(0,.65,0)});
 // the thrusters underneath, glowing; a glow on the ground under it
 const thr=[];[[-.7,-1],[.7,-1],[-.7,1],[.7,1]].forEach(([x,z])=>{itAdd(body,new THREE.CylinderGeometry(.16,.22,.3,16),'gun',[x,-.72,z*1.2]);const f=new THREE.Mesh(new THREE.ConeGeometry(.16,.6,12,1,true),new THREE.MeshBasicMaterial({color:0xffa040,transparent:true,opacity:.75,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));f.position.set(x,-1.05,z*1.2);f.rotation.x=Math.PI;body.add(f);thr.push(f)});
 const pad=new THREE.Sprite(new THREE.SpriteMaterial({map:itGlowTex(),color:0xffb050,transparent:true,opacity:.35,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));pad.scale.set(4,4,1);pad.position.y=.15;G.add(pad);
 // a proper ship: the whole thing a size up (the seat and the bob scale with it)
 G.scale.setScalar(1.3);G.userData.parts={body,wings,prop,thr,pad,seat:1.43,seatZ:-.35,S:1.3,ph:0,lift:0};return G}
function melonAnim(P,t,dt,v,yawR,air,att){const run=Math.min(1,v/12);P.ph+=dt;P.lift+=((air?.6:0)-P.lift)*Math.min(1,dt*4);
 P.body.position.y=1.15+Math.sin(t*2.1)*.09+P.lift;P.body.rotation.z=-yawR*.08+Math.sin(t*1.3)*.03;P.body.rotation.x=-run*.08+(air?-.1:0);
 P.prop.rotation.z+=dt*(6+v*2.5);P.wings.forEach(w=>{w.rotation.z=w.userData.s*(Math.sin(t*(air?9:2.4))*(air?.25:.05))});
 const k=.6+run*.6+(air?.5:0);P.thr.forEach((f,i)=>{f.scale.set(1,k+Math.sin(t*30+i)*.15,1)});P.pad.material.opacity=air?.12:.3+Math.sin(t*3)*.05;
 const sp=t-att;if(sp>=0&&sp<.25)P.body.rotation.x+=.12}
// the seed spitter: a spread of seeds out in front, hurting everybody along the way
function melonAttack(t){const fx=Math.sin(heroYaw),fz=Math.cos(heroYaw),dmg=5*PWR()*2.4;enemies.forEach(e=>{if(e.hp<=0)return;const dx=e.x-heroPos.x,dz=e.z-heroPos.z,d=Math.hypot(dx,dz);if(d>11||d<.5)return;if((dx*fx+dz*fz)/d<.7)return;damageEnemy(e,dmg,t)});
 bombs.forEach(b=>{if(!bombAlive(b))return;const dx=b.x-heroPos.x,dz=b.z-heroPos.z,d=Math.hypot(dx,dz);if(d<11&&d>.5&&(dx*fx+dz*fz)/d>=.7)damageBomb(b,dmg,t)});
 melonSeeds(heroPos.x,hero.position.y+1.6,heroPos.z,heroYaw)}
const MSEED={list:[]};function melonSeeds(x,y,z,yaw){try{if(!MSEED.geo){MSEED.geo=new THREE.SphereGeometry(.12,8,6);MSEED.geo.scale(1,.5,1.6);MSEED.mat=new THREE.MeshStandardMaterial({color:0x120806,roughness:.2})}
 for(let k=0;k<7;k++){const a=yaw+(k-3)*.11,m=new THREE.Mesh(MSEED.geo,MSEED.mat);m.position.set(x,y,z);m.rotation.y=a;world.add(m);MSEED.list.push({m,vx:Math.sin(a)*34,vz:Math.cos(a)*34,vy:1+Math.random(),t:0})}
 const ac=audioCtx();if(ac){const k=rideNear2(x,z)*.1;if(k>.01)for(let i=0;i<3;i++)rideTone(900-i*120,'square',i*.05,.04,k)}}catch(e){}}
function melonSeedTick(dt){for(let i=MSEED.list.length-1;i>=0;i--){const s=MSEED.list[i];s.t+=dt;s.vy-=14*dt;s.m.position.x+=s.vx*dt;s.m.position.y+=s.vy*dt;s.m.position.z+=s.vz*dt;if(s.t>.4){world.remove(s.m);MSEED.list.splice(i,1)}}}
(function(){const wt=W4.tick;W4.tick=function(t,dt){const r=wt.apply(this,arguments);try{if(MSEED.list.length)melonSeedTick(dt)}catch(e){}return r}})();
// ---------------------------------------------------------------- THE STASH (the owner, Oct 21 13:51: "add in collectibles... make it so there's a
// screen so you can see, oh, I've got all the... golden fro pick, the watermelon fried chicken... I've got six of those in level two, I'm missing
// one in level three, like, a screen where I can see all that"). Every floor hides seven of one thing (the thing changes floor to floor, twelve
// kinds in all): up on top of things, out on secret ledges, in mazes, in the air over the gaps, behind sealed doors. Walk into one to grab it.
// They are yours (your partner finds their own) and your save keeps them. All seven on a floor pays out. J (or the button in your bag, or the
// counter under the floor number) opens THE STASH: every kind, every floor you have reached, what you have, what is missing and where to look.
const STASH=[
 ['frop','Golden Fro Pick','Solid gold, fist on the handle. It has seen things. It has seen your hairline.'],
 ['sauce','Hot Sauce','Goes on everything. Eggs. Pizza. Ice cream, once, at a cookout, and nobody talked about it after.'],
 ['joker','The Big Joker','The highest card in spades. Slap it on the table and say something slick. You have earned that.'],
 ['wmfc','Watermelon Fried Chicken','Somebody\'s auntie invented it at a cookout in \'04. Nobody asked for it. Everybody went back for seconds.'],
 ['durag','Silk Durag','Three hundred and sixty waves under there. Do not touch them. Do not even look at them too hard.'],
 ['invite','The Cookout Invitation','Laminated. Signed by your cousin. You are in. Do not bring potato salad unless somebody asked you to.'],
 ['tupper','Grandma\'s Good Tupperware','The lid does not match. It never matched. Bring it back or do not come back.'],
 ['fan','Church Fan','A funeral home ad on the back, a sunset on the front. It has cooled four generations of the front pew.'],
 ['remote','The Remote','Still in the plastic wrap. Has been since 1997. Nobody touches the remote but Granddaddy.'],
 ['chain','Big Gold Chain','Heavy. Real heavy. Your neck is going to need a chiropractor. Worth it.'],
 ['red','The Red Flavor','Not cherry. Not strawberry. Red. It is its own flavor. Two cups of sugar, minimum.'],
 ['clip','Gold Clippers','The barbershop\'s finest. An edge-up so sharp you could cut paper with your hairline.']];
const STK=k=>'col_'+k;function stashKind(n){return STASH[((n|0)-1+1200)%STASH.length]}
// ---- the pictures on them
function txStash(kind){const k='st_'+kind;if(ITX[k])return ITX[k];let c,g,b=null;const r=itRng(kind.length*31+7);const T=(t,x,y,f,col,al)=>{g.font=f;g.fillStyle=col;g.textAlign=al||'center';g.fillText(t,x,y)};
 if(kind==='sauce'){c=itCanvas(512,192);g=c.getContext('2d');g.fillStyle='#f4ecd8';g.fillRect(0,0,512,192);g.fillStyle='#b01010';g.fillRect(0,0,512,20);g.fillRect(0,172,512,20);
  g.fillStyle='#d41818';g.beginPath();g.moveTo(62,62);g.bezierCurveTo(140,30,196,96,150,156);g.bezierCurveTo(124,176,96,120,62,62);g.fill();g.fillStyle='rgba(255,255,255,.35)';g.beginPath();g.ellipse(112,82,18,7,-.4,0,7);g.fill();g.fillStyle='#2a8a20';g.fillRect(50,50,24,14);
  T('TOWER',214,92,'900 62px Georgia,serif','#8a0a0a','left');T('HOT SAUCE',218,136,'800 32px Georgia,serif','#1a1a1a','left');T('Goes on everything. EVERYTHING.',220,160,'600 15px system-ui','#3a2a1a','left')}
 else if(kind==='joker'){c=itCanvas(256,360);g=c.getContext('2d');g.fillStyle='#fbf8f0';g.fillRect(0,0,256,360);g.strokeStyle='#c01020';g.lineWidth=6;g.strokeRect(12,12,232,336);
  g.fillStyle='#c01020';[[64,90],[128,70],[192,90]].forEach(([x,y],i)=>{g.beginPath();g.moveTo(84,150);g.lineTo(x,y);g.lineTo(172,150);g.fill();g.fillStyle=i===1?'#1a1a1a':'#c01020';g.beginPath();g.arc(x,y,9,0,7);g.fill();g.fillStyle=i?'#c01020':'#1a1a1a'});
  g.fillStyle='#f2c8a0';g.beginPath();g.arc(128,186,44,0,7);g.fill();g.fillStyle='#1a1a1a';g.beginPath();g.arc(112,178,5,0,7);g.arc(144,178,5,0,7);g.fill();g.strokeStyle='#1a1a1a';g.lineWidth=4;g.beginPath();g.arc(128,192,22,.2,Math.PI-.2);g.stroke();
  T('BIG',128,272,'900 46px Georgia,serif','#c01020');T('JOKER',128,318,'900 40px Georgia,serif','#1a1a1a');T('J',30,48,'900 30px Georgia,serif','#c01020');T('★',30,76,'900 20px serif','#c01020');
  b=itCanvas(256,360);const h=b.getContext('2d');h.fillStyle='#a8101c';h.fillRect(0,0,256,360);h.strokeStyle='rgba(255,255,255,.55)';h.lineWidth=2;for(let i=-360;i<360;i+=18){h.beginPath();h.moveTo(i,0);h.lineTo(i+360,360);h.stroke();h.beginPath();h.moveTo(i+360,0);h.lineTo(i,360);h.stroke()}h.strokeStyle='#fff';h.lineWidth=8;h.strokeRect(14,14,228,332)}
 else if(kind==='invite'){c=itCanvas(512,340);g=c.getContext('2d');const gr=g.createLinearGradient(0,0,0,340);gr.addColorStop(0,'#fff6e0');gr.addColorStop(1,'#f2dcae');g.fillStyle=gr;g.fillRect(0,0,512,340);g.strokeStyle='#c8961e';g.lineWidth=10;g.strokeRect(14,14,484,312);g.lineWidth=2;g.strokeRect(28,28,456,284);
  T('YOU ARE INVITED',256,84,'900 40px Georgia,serif','#7a1a10');T('TO THE COOKOUT',256,132,'800 34px Georgia,serif','#3a2410');T('Saturday · Uncle Earl\'s backyard',256,182,'italic 600 22px Georgia,serif','#3a2410');T('From 2 till the streetlights come on',256,214,'italic 600 20px Georgia,serif','#3a2410');
  g.fillStyle='#2a2a2a';g.beginPath();g.ellipse(256,268,40,14,0,0,Math.PI);g.fill();g.fillRect(250,268,12,30);g.fillStyle='#ff7a20';for(let i=0;i<4;i++){g.beginPath();g.ellipse(232+i*16,258,5,9,0,0,7);g.fill()}T('Bring: nothing. Seriously.',256,316,'700 16px system-ui','#7a1a10')}
 else if(kind==='fan'){c=itCanvas(320,360);g=c.getContext('2d');const gr=g.createLinearGradient(0,0,0,360);gr.addColorStop(0,'#3a1a6a');gr.addColorStop(.45,'#e0602a');gr.addColorStop(.75,'#ffd070');gr.addColorStop(1,'#ffe8b0');g.fillStyle=gr;g.fillRect(0,0,320,360);
  g.fillStyle='#fff4c0';g.beginPath();g.arc(160,250,46,0,7);g.fill();g.fillStyle='#2a1a2a';g.fillRect(60,262,200,98);g.beginPath();g.moveTo(130,262);g.lineTo(160,200);g.lineTo(190,262);g.fill();g.fillRect(156,168,8,36);g.fillRect(148,178,24,7);
  T('BLESSED',160,92,'900 40px Georgia,serif','#fff2c8');T('& HIGHLY FAVORED',160,124,'italic 700 20px Georgia,serif','#ffe0a0');
  b=itCanvas(320,360);const h=b.getContext('2d');h.fillStyle='#f4eee0';h.fillRect(0,0,320,360);h.fillStyle='#2a3a6a';h.font='900 26px Georgia,serif';h.textAlign='center';h.fillText('PEACEFUL REST',160,120);h.fillText('FUNERAL HOME',160,152);h.font='italic 600 18px Georgia,serif';h.fillText('"We\'ll be there."',160,196);h.font='600 14px system-ui';h.fillText('Since 1962 · Ask about our layaway',160,236)}
 else if(kind==='tape'){c=itCanvas(256,64);g=c.getContext('2d');g.fillStyle='#efe4b8';g.fillRect(0,0,256,64);for(let i=0;i<60;i++){g.fillStyle='rgba(120,100,50,.08)';g.fillRect(r()*256,r()*64,3,1)}T('GRANDMA\'S',128,30,'italic 900 26px "Comic Sans MS",cursive','#1a2a8a');T('bring it BACK',128,56,'italic 800 18px "Comic Sans MS",cursive','#a01010')}
 else if(kind==='red'){c=itCanvas(256,96);g=c.getContext('2d');g.fillStyle='rgba(255,255,255,0)';g.clearRect(0,0,256,96);T('RED',128,52,'900 46px Georgia,serif','#fff');T('FLAVOR',128,84,'900 22px Georgia,serif','#ffe0e0')}
 else if(kind==='wmfc'){c=itCanvas(256,256);g=c.getContext('2d');g.fillStyle='#e02838';g.fillRect(0,0,256,256);for(let i=0;i<400;i++){g.fillStyle='rgba('+(r()<.5?'255,120,130':'160,10,30')+','+(.15+r()*.2)+')';g.fillRect(r()*256,r()*256,2+r()*3,2+r()*3)}
  for(let i=0;i<26;i++){const x=20+r()*216,y=20+r()*180;g.fillStyle='#120806';g.beginPath();g.ellipse(x,y,4,7,r()*3,0,7);g.fill();g.fillStyle='rgba(255,255,255,.4)';g.beginPath();g.ellipse(x-1,y-2,1,2,0,0,7);g.fill()}}
 const o={map:itTex(c)};if(b)o.back=itTex(b);return ITX[k]=o}
// ---- the twelve, one model each (the item library's materials: they shine, they have depth, they move a little)
function stHotSauce(){const G=new THREE.Group();const P=[[0,0],[.2,0],[.215,.04],[.215,.56],[.18,.66],[.095,.76],[.08,.82],[.08,1.0],[0,1.0]];
 itAdd(G,itLathe(P,40),'glass');itAdd(G,itLathe([[0,.02],[.19,.02],[.2,.55],[.165,.64],[.08,.74],[.068,.8],[0,.8]],32),new THREE.MeshPhysicalMaterial({color:0xb01208,roughness:.2,metalness:0,clearcoat:.6,emissive:0x5a0400,emissiveIntensity:.45,envMapIntensity:.8}));
 const lb=new THREE.CylinderGeometry(.218,.218,.34,48,1,true,-Math.PI*.62,Math.PI*1.24);itAdd(G,lb,new THREE.MeshStandardMaterial({map:txStash('sauce').map,roughness:.45,side:THREE.DoubleSide}),[0,.3,0]);
 const cap=itAdd(G,new THREE.CylinderGeometry(.1,.1,.16,24),'ivory',[0,1.06,0]);for(let k=0;k<16;k++){const a=k/16*Math.PI*2;itAdd(G,itRBox(.012,.15,.02,.005,1),'ivory',[Math.sin(a)*.1,1.06,Math.cos(a)*.1],[0,a,0])}
 itAdd(G,new THREE.SphereGeometry(.1,20,10,0,Math.PI*2,0,Math.PI/2),'ivory',[0,1.14,0],null,[1,.5,1]);return itMerge(G)}
function stJoker(){const G=new THREE.Group();const T=txStash('joker');const shape=new THREE.Shape();const w=.36,h=.5,rr=.05;shape.moveTo(-w+rr,-h);shape.lineTo(w-rr,-h);shape.quadraticCurveTo(w,-h,w,-h+rr);shape.lineTo(w,h-rr);shape.quadraticCurveTo(w,h,w-rr,h);shape.lineTo(-w+rr,h);shape.quadraticCurveTo(-w,h,-w,h-rr);shape.lineTo(-w,-h+rr);shape.quadraticCurveTo(-w,-h,-w+rr,-h);
 const fg=new THREE.ShapeGeometry(shape,6),uv=fg.attributes.uv,p=fg.attributes.position;for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)+w)/(2*w),(p.getY(i)+h)/(2*h));
 const mk=m=>new THREE.MeshPhysicalMaterial({map:m,roughness:.3,metalness:0,clearcoat:.8,clearcoatRoughness:.1,envMapIntensity:.7});
 const f=itAdd(G,fg,mk(T.map),[0,0,.006]);const bk=itAdd(G,fg.clone(),mk(T.back),[0,0,-.006],[0,Math.PI,0]);const ed=new THREE.ExtrudeGeometry(shape,{depth:.01,bevelEnabled:false});ed.translate(0,0,-.005);itAdd(G,ed,new THREE.MeshStandardMaterial({color:0xf8f4ea,roughness:.6}));
 G.rotation.x=-.2;itGlow(G,0xffe0a0,1.3,[0,0,0],.25);return itMerge(G)}
// the plate: a paper plate (fluted rim, a grease spot or two) with a watermelon wedge stood up at the back (rind, the white, the red, black
// seeds on both faces) and a fried drumstick leaning on it, the Deacon's own crust shrunk down, the bone end up off the plate
function txPaper(){if(ITX.paper)return ITX.paper;const c=itCanvas(512,64),g=c.getContext('2d');g.fillStyle='#808080';g.fillRect(0,0,512,64);for(let k=0;k<96;k++){const x=k*512/96,gr=g.createLinearGradient(x,0,x+512/96,0);gr.addColorStop(0,'#5a5a5a');gr.addColorStop(.5,'#b0b0b0');gr.addColorStop(1,'#5a5a5a');g.fillStyle=gr;g.fillRect(x,0,512/96+1,64)}
 const s=itCanvas(256,256),q=s.getContext('2d'),r=itRng(608);[[150,96,30],[92,160,22],[176,170,14]].forEach(([x,y,R])=>{for(let i=0;i<60;i++){q.fillStyle='rgba(214,150,60,'+(.03+r()*.05)+')';q.beginPath();q.ellipse(x+(r()-.5)*R,y+(r()-.5)*R,R*(.3+r()*.5),R*(.25+r()*.4),r()*3,0,7);q.fill()}});
 return ITX.paper={nm:itNormal(c,2.2),spot:itTex(s)}}
function stWMFC(){const G=new THREE.Group();drumMats();const PT=txPaper();
 const paper=new THREE.MeshStandardMaterial({color:0xf6f2e6,roughness:.85,metalness:0,normalMap:PT.nm,normalScale:new THREE.Vector2(.35,.35)});
 itAdd(G,itLathe([[0,0],[.78,0],[.93,.05],[1.04,.12],[1.07,.135],[1.05,.15],[.92,.075],[.76,.026],[0,.026]],72),paper);
 const sp=new THREE.CircleGeometry(.74,40);sp.rotateX(-Math.PI/2);const spm=new THREE.MeshStandardMaterial({map:PT.spot,transparent:true,roughness:.35,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});itAdd(G,sp,spm,[0,.028,0]).userData.keep=1;
 // the wedge: three sectors of one circle, the point up; the rind the full radius, the white inside it, the red flesh standing proud of both
 const R=1,ha=.56,th=.32;const sec=(r)=>{const sh=new THREE.Shape();sh.moveTo(0,0);sh.lineTo(Math.cos(-Math.PI/2-ha)*r,Math.sin(-Math.PI/2-ha)*r);sh.absarc(0,0,r,-Math.PI/2-ha,-Math.PI/2+ha,false);sh.lineTo(0,0);
  const gg=new THREE.ExtrudeGeometry(sh,{depth:th,bevelEnabled:true,bevelThickness:.02,bevelSize:.02,bevelSegments:3,curveSegments:36});gg.translate(0,0,-th/2);return gg};
 const W=new THREE.Group();W.position.set(-.3,R+.035,-.28);W.rotation.set(-.08,.62,0);G.add(W);
 itAdd(W,sec(R),itMat('melon'));itAdd(W,sec(R-.07),new THREE.MeshStandardMaterial({color:0xeaf2c8,roughness:.5}),[0,0,0],null,[1,1,1.03]);
 const fm=new THREE.MeshPhysicalMaterial({map:txStash('wmfc').map,roughness:.32,clearcoat:.6,clearcoatRoughness:.18,envMapIntensity:.6});itAdd(W,sec(R-.12),fm,[0,0,0],null,[1,1,1.07]);
 const sd=new THREE.MeshStandardMaterial({color:0x140806,roughness:.25,metalness:0});const sg=new THREE.SphereGeometry(.026,10,6);
 [-1,1].forEach(f=>{for(let k=0;k<9;k++){const a=-Math.PI/2+(k-4)*.105,rr=.56+((k*37)%5)*.04;const m=itAdd(W,sg,sd,[Math.cos(a)*rr,Math.sin(a)*rr,f*(th/2*1.07+.024)],[0,0,a+Math.PI/2],[1,1.7,.45])}});
 // the drumstick, lying on the plate in front, leaning on the wedge, the bone end up
 const d=new THREE.Group();d.position.set(.3,.36,.4);d.rotation.set(0,.3,-.28);G.add(d);const dm=new THREE.Mesh(drumGeo(),ITM.drumC);dm.scale.setScalar(.26);dm.rotation.y=Math.PI/2;d.add(dm);
 const bn=new THREE.CylinderGeometry(.036,.044,.28,14);bn.rotateZ(Math.PI/2);itAdd(d,bn,ITM.drumB,[-.54,0,0]);itAdd(d,new THREE.SphereGeometry(.058,14,10),ITM.drumB,[-.7,.02,.02]);itAdd(d,new THREE.SphereGeometry(.058,14,10),ITM.drumB,[-.7,-.03,-.02]);
 itAdd(d,new THREE.TorusGeometry(.055,.025,8,18),ITM.drumF,[-.42,0,0],[0,Math.PI/2,0]);
 itMerge(W);itMerge(d);itGlow(G,0xff8070,1.4,[0,.5,0],.18);return itMerge(G)}
function stDurag(){const G=new THREE.Group();const silk=new THREE.MeshPhysicalMaterial({color:0x3a0c5a,roughness:.22,metalness:.15,clearcoat:.6,clearcoatRoughness:.12,sheen:new THREE.Color(0xd0a0ff),envMapIntensity:1.1,side:THREE.DoubleSide});
 itAdd(G,new THREE.SphereGeometry(.46,40,24,0,Math.PI*2,0,Math.PI*.52),silk,[0,0,0],null,[1,.82,1.12]);itAdd(G,new THREE.TorusGeometry(.47,.04,10,48,Math.PI*1.1),silk,[0,.03,0],[Math.PI/2,0,Math.PI*-.05]);
 itAdd(G,itTube([[0,.38,.5],[0,.47,0],[0,.38,-.5]],.012,20,6),silk);
 // the two tails down the back: ribbons that ripple
 [-1,1].forEach(s=>{const rg=new THREE.PlaneGeometry(.16,1.15,1,28),p=rg.attributes.position;for(let i=0;i<p.count;i++){const y=p.getY(i),k=(.575-y)/1.15;p.setZ(i,Math.sin(k*5+s)*.07*k);p.setX(i,p.getX(i)+s*k*.12)}rg.computeVertexNormals();
  const m=itAdd(G,rg,silk,[s*.14,-.42,-.5],[.5,0,0]);m.name='tail'+(s>0?1:0)});
 itGlow(G,0xc080ff,1.2,[0,.1,0],.25);return G}
function stInvite(){const G=new THREE.Group();const T=txStash('invite');const w=.9,h=.6;const card=new THREE.BoxGeometry(w,h,.012);const mats=[0,1,2,3].map(()=>new THREE.MeshStandardMaterial({color:0xf2dcae,roughness:.6}));
 mats.push(new THREE.MeshPhysicalMaterial({map:T.map,roughness:.25,clearcoat:1,clearcoatRoughness:.04,envMapIntensity:.9}));mats.push(new THREE.MeshPhysicalMaterial({color:0xf2e6c8,roughness:.3,clearcoat:1,clearcoatRoughness:.05}));
 const m=new THREE.Mesh(card,mats);G.add(m);m.userData.keep=1;itAdd(G,itRBox(w+.06,h+.06,.02,.03,3),new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.05,transmission:.9,transparent:true,clearcoat:1,envMapIntensity:1.2,depthWrite:false}));G.rotation.x=-.25;itGlow(G,0xffe8a0,1.3,[0,0,0],.22);return G}
function stTupper(){const G=new THREE.Group();itAdd(G,itRBox(.8,.36,.58,.08,4),new THREE.MeshPhysicalMaterial({color:0xf6f2e6,roughness:.38,metalness:0,transmission:.55,transparent:true,clearcoat:.3,envMapIntensity:.7,depthWrite:false}),[0,0,0]);
 // what is in it (it is always something): greens on one side, mac and cheese on the other
 itAdd(G,itRBox(.34,.2,.48,.06,3),new THREE.MeshStandardMaterial({color:0x2a5a14,roughness:.8}),[-.18,-.05,0]);itAdd(G,itRBox(.34,.22,.48,.06,3),new THREE.MeshStandardMaterial({color:0xf0b828,roughness:.6}),[.18,-.04,0]);
 itAdd(G,itRBox(.86,.07,.64,.03,3),new THREE.MeshPhysicalMaterial({color:0x2a6ad8,roughness:.3,clearcoat:.5}),[0,.2,0]);itAdd(G,itRBox(.6,.02,.42,.02,2),new THREE.MeshPhysicalMaterial({color:0x2a6ad8,roughness:.3}),[0,.245,0]);
 const tp=new THREE.PlaneGeometry(.5,.125);itAdd(G,tp,new THREE.MeshStandardMaterial({map:txStash('tape').map,roughness:.7}),[0,.258,.06],[-Math.PI/2,0,0]);itGlow(G,0x80b0ff,1.2,[0,.1,0],.2);return itMerge(G)}
function stFan(){const G=new THREE.Group();const T=txStash('fan');const sh=new THREE.Shape();sh.moveTo(-.34,-.3);sh.lineTo(.34,-.3);sh.lineTo(.36,.18);sh.quadraticCurveTo(.3,.42,0,.44);sh.quadraticCurveTo(-.3,.42,-.36,.18);sh.lineTo(-.34,-.3);
 const fg=new THREE.ShapeGeometry(sh,12),uv=fg.attributes.uv,p=fg.attributes.position;for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)+.36)/.72,(p.getY(i)+.3)/.74);
 itAdd(G,fg,new THREE.MeshStandardMaterial({map:T.map,roughness:.75}),[0,.3,.004]);itAdd(G,fg.clone(),new THREE.MeshStandardMaterial({map:T.back,roughness:.75}),[0,.3,-.004],[0,Math.PI,0]);
 itAdd(G,itRBox(.08,.9,.02,.01,1),'wood',[0,-.12,0]);G.rotation.z=.12;itGlow(G,0xffb060,1.2,[0,.3,0],.2);return itMerge(G)}
function stRemote(){const G=new THREE.Group();itAdd(G,itRBox(.24,.9,.08,.05,4),'black');const BM={},bm=c=>BM[c]||(BM[c]=new THREE.MeshStandardMaterial({color:c,roughness:.4}));const bt=(x,y,c,r)=>itAdd(G,new THREE.CylinderGeometry(r||.022,r||.022,.02,14),bm(c),[x,y,.045],[Math.PI/2,0,0]);
 bt(-.06,.36,0xd02020,.03);for(let j=0;j<4;j++)for(let i=0;i<3;i++)bt(-.06+i*.06,.18-j*.07,0xd8d8d8);bt(0,-.18,0x30a030,.035);bt(-.06,-.28,0x2050d0);bt(.06,-.28,0xe0c020);
 itAdd(G,itRBox(.3,.98,.13,.06,4),new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.08,transmission:.88,transparent:true,clearcoat:1,clearcoatRoughness:.05,envMapIntensity:1.4,depthWrite:false}));
 // the creases in the plastic
 {const cm=new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.1,transparent:true,opacity:.35,depthWrite:false});for(let k=0;k<5;k++)itAdd(G,itTube([[-.15,-.4+k*.2,.066],[0,-.37+k*.2,.07],[.15,-.41+k*.2,.066]],.004,8,4),cm)}G.rotation.x=-.3;return itMerge(G)}
function stChain(){const G=new THREE.Group();const lk=new THREE.TorusGeometry(.055,.02,10,20);const N=26;for(let k=0;k<N;k++){const a=(k/(N-1))*Math.PI*1.3-Math.PI*.15,x=Math.cos(a+Math.PI)*.42,y=Math.sin(a+Math.PI)*.5+.5;itAdd(G,lk,'goldP',[x,y,0],[0,k%2?Math.PI/2:0,a+Math.PI/2])}
 const md=itAdd(G,new THREE.CylinderGeometry(.24,.24,.05,40),'coin',[0,-.18,0],[Math.PI/2,0,0]);itAdd(G,new THREE.TorusGeometry(.24,.03,10,40),'goldP',[0,-.18,0]);for(let k=0;k<8;k++){const a=k/8*Math.PI*2;const d=itAdd(G,itGemGeo(.035,8),'dia',[Math.cos(a)*.24,-.18+Math.sin(a)*.24,.03],[Math.PI/2,0,0]);d.userData.keep=1}
 itAdd(G,new THREE.TorusGeometry(.05,.016,8,16),'goldP',[0,.08,0]);itGlow(G,0xffd050,1.5,[0,-.1,0],.3);return itMerge(G)}
function stRed(){const G=new THREE.Group();const P=[[0,0],[.3,0],[.32,.04],[.34,.7],[.36,.78],[.38,.8],[0,.8]];itAdd(G,itLathe([[0,0],[.3,0],[.32,.04],[.34,.7],[.38,.8],[.36,.8],[.32,.7],[.3,.04],[0,.04]],48),'glass');
 itAdd(G,itLathe([[0,.04],[.29,.04],[.31,.62],[0,.62]],40),new THREE.MeshPhysicalMaterial({color:0xe0101a,roughness:.1,metalness:0,transmission:.35,transparent:true,clearcoat:.5,emissive:0x8a0008,emissiveIntensity:.5,envMapIntensity:.7}));
 {const im=new THREE.MeshPhysicalMaterial({color:0xeaf6ff,roughness:.05,transmission:.85,transparent:true,clearcoat:1,depthWrite:false});for(let k=0;k<4;k++)itAdd(G,itRBox(.11,.1,.11,.025,2),im,[Math.cos(k*1.7)*.14,.6,Math.sin(k*1.7)*.14],[k,k*2,0])}
 itAdd(G,new THREE.TorusGeometry(.18,.035,10,24,Math.PI),'glass',[.36,.42,0],[0,0,-Math.PI/2]);itAdd(G,new THREE.ConeGeometry(.08,.14,12,1,true),'glass',[-.37,.78,0],[0,0,Math.PI/2+.4]);
 const lb=new THREE.CylinderGeometry(.345,.345,.2,40,1,true,-Math.PI*.4,Math.PI*.8);itAdd(G,lb,new THREE.MeshBasicMaterial({map:txStash('red').map,transparent:true,depthWrite:false}),[0,.32,0]);itGlow(G,0xff3040,1.3,[0,.35,0],.3);return G}
function stClip(){const G=new THREE.Group();const body=itLathe([[0,0],[.15,0],[.17,.08],[.16,.55],[.12,.68],[0,.7]],40);const b=itAdd(G,body,'goldE',[0,0,0],null,[1,1,.62]);
 itAdd(G,itRBox(.34,.06,.12,.02,2),'steel',[0,.72,0]);for(let k=0;k<14;k++)itAdd(G,itRBox(.012,.06,.03,.004,1),'steel',[-.16+k*.0246,.77,0]);itAdd(G,itRBox(.06,.12,.03,.015,2),'black',[0,.38,.105]);
 itAdd(G,itTube([[0,0,0],[.05,-.18,.04],[.2,-.3,-.05],[.35,-.25,.05],[.45,-.38,0]],.018,24,6),'black');itGlow(G,0xffd050,1.3,[0,.35,0],.28);return itMerge(G)}
Object.assign(ITV,{col_frop:{mk:()=>pickModel2('gpick'),sz:.9,tilt:.55},col_sauce:{mk:stHotSauce,sz:.7},col_joker:{mk:stJoker,sz:.75},col_wmfc:{mk:stWMFC,sz:.85},col_durag:{mk:stDurag,sz:.75},col_invite:{mk:stInvite,sz:.8},
 col_tupper:{mk:stTupper,sz:.75},col_fan:{mk:stFan,sz:.8},col_remote:{mk:stRemote,sz:.7,tilt:.3},col_chain:{mk:stChain,sz:.8},col_red:{mk:stRed,sz:.75},col_clip:{mk:stClip,sz:.75,tilt:.3}});
// ---- where they are: candidate spots across the floor, best first (secret ledges, tops of mesas, sealed vaults, mazes, on top of things,
// in the air over the gaps between stepping stones), seven picked well apart. The same on every screen: it is all the floor's numbers.
function colSpots(F){if(F.cspots)return F.cspots;const r=srand((F.seed|0)*41+F.n*977+5),C=[];const add=(x,z,y,sc,where,pi)=>C.push({x,z,y,sc:sc+r()*1.5,where,pi});
 const nameOf=p=>p.gnt?'the Gauntlet':p.wide?((typeof BIGNAME!=='undefined'&&BIGNAME[p.wide])||'out there'):p.maze?'the maze':p.kind==='side'?(p.secret?'a secret ledge':'a side landing'):p.kind==='exit'?'the guardian\'s landing':p.kind==='plaza'?'a plaza':'the way up';
 const chestNear=(x,z)=>(F.wchests||[]).some(c=>Math.hypot(c.x-x,c.z-z)<4)||(F.P.some(q=>(q.chest)&&Math.hypot((q.x0+q.x1)/2-x,(q.z0+q.z1)/2-z)<4));
 const openAt=(x,z,top)=>Math.abs(towerH(x,z)-top)<.05&&Math.abs(towerH(x+1.6,z)-top)<.05&&Math.abs(towerH(x-1.6,z)-top)<.05&&Math.abs(towerH(x,z+1.6)-top)<.05&&Math.abs(towerH(x,z-1.6)-top)<.05;
 F.P.forEach((p,pi)=>{if(p.kind==='entry')return;const w=nameOf(p);
  if(p.kind==='side'){const x=p.x0+2.2+r()*(p.x1-p.x0-4.4),z=p.z0+2.2;if(Math.abs(towerH(x,z)-p.top)<.05)add(x,z,p.top+1.2,p.secret?11:7,'out on '+w,pi);return}
  if(p.sealedR){const [vx,vz]=p.sealedR;add(vx+2.5,vz+2,p.top+1.2,13,'in the sealed vault in the Ruins (push the loose bricks)',pi)}
  if(p.sealedM){const [mx,mz]=p.sealedM;add(mx+2,mz+1,p.top+1.2,13,'in the mausoleum in the Boneyard (push the loose bricks)',pi)}
  if(p.mzLost){const [x,z]=p.mzLost;add(x,z,p.top+1.2,12,'deep in the maze',pi)}
  (p.blocks||[]).forEach(b=>{if(b.sdoor||b.vdoor||b.keep||b.wall)return;const h=b.top-p.top,cx=(b.x0+b.x1)/2,cz=(b.z0+b.z1)/2;if(Math.abs(towerH(cx,cz)-b.top)>.05)return;
   if(b.mesa){add(b.x0+3,b.z1-3,b.top+1.2,14,'on top of '+w+' (the stairs go round it)',pi);return}
   if(b.climb){add(cx-1.5,cz+1.5,b.top+1.2,12,'on the tall rock in '+w+' (climb the boulders)',pi);return}
   if(b.stair||b.boulder||b.arena||b.fence||b.prop||b.hut||b.edge||b.maze||b.tomb)return;if(h>1.5&&h<=6.4&&(b.x1-b.x0)>=1.2&&(b.z1-b.z0)>=1.2){const big=(b.x1-b.x0)>8&&(b.z1-b.z0)>8,x=big?b.x0+2.5:cx,z=big?b.z1-2.5:cz;if(Math.abs(towerH(x,z)-b.top)<.05)add(x,z,b.top+1.2,4+h*.9,'up on top of something in '+w,pi)}});
  if(p.maze){for(let k=0;k<10;k++){const x=p.x0+3+r()*(p.x1-p.x0-6),z=p.z0+3+r()*(p.z1-p.z0-6);if(openAt(x,z,p.top)){add(x,z,p.top+1.2,9+Math.abs(z-p.z1)/20,'in the maze',pi);break}}}
  if(p.kind==='plaza'||p.kind==='exit'||p.wide){const big=p.wide?1:0;for(let k=0;k<(big?8:3);k++){const x=p.x0+3+r()*(p.x1-p.x0-6),z=p.z0+3+r()*(p.z1-p.z0-6);if(openAt(x,z,p.top)&&!chestNear(x,z))add(x,z,p.top+1.2,big?2.5:2,(big?'somewhere in ':'on ')+w,pi)}}});
 // over the gaps: between two stepping stones in a row, at the height of a jump between them
 for(let i=1;i<F.P.length;i++){const a=F.P[i-1],b=F.P[i];if(a.kind!=='step'||b.kind!=='step')continue;const ax=(a.x0+a.x1)/2,az=(a.z0+a.z1)/2,bx=(b.x0+b.x1)/2,bz=(b.z0+b.z1)/2;const gap=Math.min(Math.abs(a.z0-b.z1),Math.abs(b.z0-a.z1));
  if(gap>=3.5&&gap<=10&&Math.abs(a.top-b.top)<3.5)add((ax+bx)/2,(a.z0+b.z1)/2,Math.max(a.top,b.top)+2.4,7,'in the air over a gap (jump for it)',i)}
 C.sort((a,b)=>b.sc-a.sc);const want=7,wide=!!F.wide;const out=[];
 for(const sp of [wide?34:16,wide?22:10,wide?12:5,0]){for(const c of C){if(out.length>=want)break;if(out.includes(c))continue;if(out.some(o=>Math.hypot(o.x-c.x,o.z-c.z)<sp))continue;if(sp>0&&out.filter(o=>o.pi===c.pi).length>=(wide?1:2))continue;out.push(c)}if(out.length>=want)break}
 // a tiny floor with too few places: the rest go round the open ground of the entry
 const E=F.entry;let k=0;while(out.length<want&&k<40){k++;const x=E.x0+3+r()*(E.x1-E.x0-6),z=E.z0+3+r()*(E.z1-E.z0-6);if(Math.abs(towerH(x,z)-E.top)<.05&&!out.some(o=>Math.hypot(o.x-x,o.z-z)<3))out.push({x,z,y:E.top+1.2,sc:0,where:'by the door',pi:0})}
 return F.cspots=out.slice(0,want)}
// ---- your save: which of a floor's seven you have (a mask), and whether that floor has paid out
function colMask(n){try{const o=saveLoad();return (o.col&&o.col[(W4.seed|0)+':'+n])|0}catch(e){return 0}}
function colSet(n,i){try{const o=saveLoad();o.col=o.col||{};const k=(W4.seed|0)+':'+n;o.col[k]=(o.col[k]|0)|(1<<i);localStorage.setItem(SAVEK,JSON.stringify(o));return o.col[k]}catch(e){return 0}}
function colPaid(n,set){try{const o=saveLoad();o.colPaid=o.colPaid||{};const k=(W4.seed|0)+':'+n;if(set){o.colPaid[k]=1;localStorage.setItem(SAVEK,JSON.stringify(o))}return !!o.colPaid[k]}catch(e){return false}}
const bits7=m=>{let c=0;for(let i=0;i<7;i++)if(m&(1<<i))c++;return c};
// ---- on the floor: each one turns, bobs and glints; the ones you have are not there
const COL={list:[],seen:false};
function colBuild(F){COL.list=[];COL.seen=false;if(!F||F.swarm||!W4.G||F.n>=100)return;const S=stashKind(F.n),key=STK(S[0]),have=colMask(F.n),spots=colSpots(F);
 spots.forEach((s,i)=>{if(have&(1<<i))return;const m=itemModel(key);if(!m)return;const V=ITV[key]||{},R=m.userData.R||1,k=(V.sz||.8)/R*1.15;const g=new THREE.Group();g.add(m);m.scale.setScalar(k);m.rotation.z=-(V.tilt||0)*.6;
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:itGlowTex(),color:0xffd870,transparent:true,opacity:.42,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));halo.scale.set(2.6,2.6,1);g.add(halo);
  const beam=new THREE.Mesh(COL.beamGeo||(COL.beamGeo=new THREE.CylinderGeometry(.05,.5,5,12,1,true)),new THREE.MeshBasicMaterial({color:0xffe090,transparent:true,opacity:.1,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));beam.position.y=1.8;g.add(beam);
  g.position.set(s.x,s.y,s.z);g.userData.keepGeo=1;W4.G.add(g);COL.list.push({i,s,g,m,halo,beam,ph:i*1.3})})}
(function(){const fl=floorLook;floorLook=function(F,G){const r=fl.apply(this,arguments);return r}})();
function colTick(t,dt){const F=W4.F;if(!F||!COL.list.length||W4.out)return;const S=stashKind(F.n);
 for(let j=COL.list.length-1;j>=0;j--){const c=COL.list[j];c.m.rotation.y+=dt*1.6;c.g.position.y=c.s.y+Math.sin(t*2.2+c.ph)*.18;c.halo.material.opacity=.32+Math.sin(t*3+c.ph)*.1;c.beam.material.opacity=.07+Math.sin(t*1.7+c.ph)*.03;
  const d=Math.hypot(heroPos.x-c.s.x,heroPos.z-c.s.z);if(!COL.seen&&d<20&&Math.abs(hero.position.y-c.s.y)<10){COL.seen=true;toast(S[1]+'! Seven of them hide on this floor. Walk into one to grab it. '+(typeof PADLAST!=='undefined'&&PADLAST?'Bag ▸ The Stash':'J')+' shows your stash.')}
  if(deadT>0||d>1.9||Math.abs(hero.position.y+1-c.g.position.y)>2.4)continue;
  // got it
  if(c.g.parent)c.g.parent.remove(c.g);COL.list.splice(j,1);const m=colSet(F.n,c.i),n=bits7(m);try{ringFx2(c.s.x,c.s.y-.6,c.s.z,0xffd060,3);dblChing(c.s.x,c.s.z,.6,1.5,4)}catch(e){}
  floatText(c.s.x,c.s.y+1.6,c.s.z,S[1]+' '+n+'/7','#ffd860',2.2);colHud();if(n>=7)colComplete(F.n,S)}}
function colComplete(n,S){if(colPaid(n))return;colPaid(n,true);const L=lootRoll('chest',n,srand((W4.seed|0)*19+n*53+7));const c=40+n*4;W4.coins=(W4.coins|0)+c;try{lootGive(L)}catch(e){}saveNow();W4.hud();
 try{bossYell('THE STASH: ALL SEVEN','Every '+S[1]+' on floor '+n+'. +'+c+' doubloons and something for the bag.')}catch(e){}}
// ---- the counter under the floor number (click it, or J, for the whole stash)
function colHud(){let el=$('w4stashc');if(!el){el=document.createElement('div');el.id='w4stashc';document.body.appendChild(el);el.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();stashToggle(true)})}
 const F=W4.F;if(!W4.on||W4.out||!F||F.swarm||F.n>=100){el.style.display='none';return}const S=stashKind(F.n),n=bits7(colMask(F.n)),ic=itemIcon(STK(S[0]));
 const key=S[0]+n+(ic?1:0)+(typeof PADLAST!=='undefined'&&PADLAST?1:0);if(el.dataset.k!==key){el.dataset.k=key;el.innerHTML=(ic?'<img src="'+ic+'" alt="">':'<span class="q">★</span>')+'<span class="t"><b>'+esc4(S[1])+'</b> '+n+'/7</span>'+ctlKeys({kb:'J',ms:0})}el.style.display='flex'}
(function(){const h=W4.hud;W4.hud=function(){const r=h.apply(this,arguments);try{colHud()}catch(e){}return r}})();
// ---- THE STASH: every kind (how many of it you have found in all), every floor you have reached (its kind, its seven), where to look
function stashToggle(v){W4.stashOpen=v===undefined?!W4.stashOpen:!!v;let el=$('w4stash');if(!el){el=document.createElement('div');el.id='w4stash';el.className='w4panel';document.body.appendChild(el)}if(W4.stashOpen){try{bagToggle(false)}catch(e){}stashRender()}el.style.display=W4.stashOpen?'flex':'none'}
function stashRender(){const el=$('w4stash');if(!el)return;const best=Math.max(1,(saveLoad().best|0),W4.fl|0),top=Math.min(99,best),sel=W4.stashSel||W4.fl||1;let all=0,tot=0;const per={};
 for(let n=1;n<=top;n++){if(n===9)continue;const m=bits7(colMask(n));all+=m;tot+=7;const k=stashKind(n)[0];per[k]=(per[k]||0)+m}
 let h='<div class="w4box"><div class="w4h"><span>★ THE STASH</span><b>'+all+' / '+tot+' found</b><button type="button" data-x="1">✕</button></div><div class="sk">'+
  STASH.map(S=>{const ic=itemIcon(STK(S[0]));return '<div class="sc" title="'+esc4(S[2])+'">'+(ic?'<img src="'+ic+'" alt="">':'<span class="q">★</span>')+'<b>'+esc4(S[1])+'</b><i>'+(per[S[0]]|0)+'</i></div>'}).join('')+'</div><div class="fl">';
 for(let n=1;n<=top;n++){if(n===9)continue;const S=stashKind(n),m=colMask(n),c=bits7(m),ic=itemIcon(STK(S[0]));h+='<button type="button" class="fr'+(n===sel?' sel':'')+(c>=7?' done':'')+'" data-f="'+n+'">'+(ic?'<img src="'+ic+'" alt="">':'')+'<span class="nm">Floor '+n+'<small>'+esc4(S[1])+'</small></span><span class="dots">'+[0,1,2,3,4,5,6].map(i=>'<i class="'+(m&(1<<i)?'on':'')+'"></i>').join('')+'</span><b>'+c+'/7</b></button>'}
 h+='</div>';{const n=sel,S=stashKind(n),m=colMask(n),c=bits7(m);h+='<div class="dt"><div class="nm">Floor '+n+': '+esc4(S[1])+' · '+c+' of 7'+(colPaid(n)?' · paid out':'')+'</div><div class="ds">'+esc4(S[2])+'</div>';
  if(c<7&&n===W4.fl&&W4.F){const sp=colSpots(W4.F);const miss=sp.map((s,i)=>m&(1<<i)?null:s.where).filter(Boolean);const cnt={};miss.forEach(w=>cnt[w]=(cnt[w]||0)+1);h+='<div class="hn"><b>Still out there:</b> '+Object.keys(cnt).map(w=>(cnt[w]>1?cnt[w]+' ':'one ')+esc4(w)).join(' · ')+'</div>'}
  else if(c<7)h+='<div class="hn">'+(W4.out?'Go back up for them: ':'To go back for them, come out to the tower door and pick floor '+n+' here. ')+'Look high, look hidden, look over the gaps.</div>';else h+='<div class="hn ok">All seven. The Stash salutes you.</div>';
  if(W4.out&&(!MP.on||!MP.client)&&n<=best)h+='<div class="w4b"><button type="button" data-go="'+n+'">Take the door to floor '+n+'</button></div>';h+='</div>'}
 h+='</div>';el.innerHTML=h;el.querySelector('[data-x]').onclick=()=>stashToggle(false);el.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{W4.stashSel=+b.dataset.f;stashRender()});{const g=el.querySelector('[data-go]');if(g)g.onclick=()=>{stashToggle(false);doorGo(+g.dataset.go)}}
 try{ctlPanelFoot(el,[{padHtml:CTL_MOVE(),t:'Move'},{pad:0,ms:0,t:'Pick a floor'},{kb:['Esc','J'],pad:1,t:'Close'}])}catch(e){}}
(function(){const sr=stashRender;stashRender=function(){return pmKeep('w4stash',()=>sr.apply(this,arguments))}})();
// J opens and closes it; the bag has a button for it (and a controller gets there through the bag); B or Esc backs out
addEventListener('keydown',e=>{if(!W4.on||e.repeat)return;const tg=e.target;if(tg&&(tg.tagName==='INPUT'||tg.tagName==='TEXTAREA'))return;if((e.key||'').toLowerCase()!=='j')return;stashToggle();e.preventDefault();e.stopImmediatePropagation()},true);
addEventListener('keydown',e=>{if(!W4.on||e.key!=='Escape'||!W4.stashOpen)return;stashToggle(false);e.preventDefault();e.stopImmediatePropagation()},true);
try{if(typeof PM_PANELS!=='undefined'&&!PM_PANELS.includes('w4stash'))PM_PANELS.push('w4stash');if(typeof pmBack==='function'){const pb=pmBack;pmBack=function(){if(PM.panel&&PM.panel.id==='w4stash'){stashToggle(false);return}pb()}}}catch(e){}
(function(){const br=bagRender;bagRender=function(){const r=br.apply(this,arguments);try{const el=$('w4bag'),hd=el&&el.querySelector('.w4h');if(hd&&!hd.querySelector('[data-stash]')&&!W4.out){const b=document.createElement('button');b.type='button';b.dataset.stash='1';b.className='stb';b.innerHTML='★ The Stash <kbd class="kc">J</kbd>';b.onclick=()=>stashToggle(true);hd.insertBefore(b,hd.querySelector('[data-x]'))}}catch(e){}return r}})();
// at the tower door the Dabloon's choices get one more: any floor you have reached, picked in The Stash
(function(){const ts=talkShow;talkShow=function(){const r=ts.apply(this,arguments);try{const T=W4.talk,el=$('w4talk');if(T&&el&&T.N===W4.greeter&&el.querySelector('[data-f]')&&!el.querySelector('[data-stash]')&&(!MP.on||!MP.client)&&(saveLoad().best|0)>1){
  const bx=el.querySelector('.w4b');const b=document.createElement('button');b.type='button';b.dataset.stash='1';b.textContent='Pick any floor (The Stash) ★';b.onclick=()=>{W4.talk=null;talkShow();W4.stashSel=Math.max(1,saveLoad().best|0);stashToggle(true)};bx.appendChild(b)}}catch(e){}return r}})();
// the floor's seven go up when the floor does; the counter and the stash panel keep up
(function(){const lf=loadFloor;loadFloor=function(){const r=lf.apply(this,arguments);try{colBuild(W4.F);colHud()}catch(e){console.warn('stash',e)}return r}})();
(function(){const wt=W4.tick;W4.tick=function(t,dt){const r=wt.apply(this,arguments);try{colTick(t,dt);if(((t*2)|0)!==COL.ht){COL.ht=(t*2)|0;colHud()}}catch(e){if(!W4.stErr){W4.stErr=1;console.error('stash',e)}}return r}})();
(function(){const st=document.createElement('style');st.textContent=
 '#w4stashc{position:fixed;left:50%;top:calc(48px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:31;display:none;align-items:center;gap:8px;padding:3px 10px 3px 4px;border-radius:14px;background:rgba(20,10,4,.66);border:1px solid rgba(217,164,37,.5);cursor:pointer;pointer-events:auto;font:700 12.5px system-ui;color:#f2e2c8;user-select:none}'+
 '#w4stashc img{width:26px;height:26px}#w4stashc b{color:#ffd27a;font-weight:800}#w4stashc .q{width:26px;text-align:center;color:#ffd040}#w4stashc:hover{border-color:#ffd040}'+
 '#w4stash .w4box{width:min(760px,94vw);max-height:min(86vh,760px);display:flex;flex-direction:column}#w4stash .sk{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;padding:8px 10px;border-bottom:1px solid rgba(217,164,37,.25)}'+
 '#w4stash .sc{display:flex;flex-direction:column;align-items:center;gap:1px;padding:4px 2px;border-radius:10px;background:rgba(0,0,0,.22);text-align:center}#w4stash .sc img{width:46px;height:46px}#w4stash .sc b{font:700 10.5px/1.15 system-ui;color:#e8d8bc}#w4stash .sc i{font:900 13px system-ui;font-style:normal;color:#ffd040}'+
 '#w4stash .fl{flex:1;overflow:auto;padding:8px 10px;display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:6px}#w4stash .fr{display:flex;align-items:center;gap:6px;padding:4px 8px 4px 4px;border-radius:10px;border:1px solid #4a3a26;background:#1c130b;color:#f2e2c8;cursor:pointer;text-align:left}'+
 '#w4stash .fr img{width:34px;height:34px}#w4stash .fr .nm{flex:1;font:800 12.5px system-ui;display:flex;flex-direction:column}#w4stash .fr small{font:600 10.5px system-ui;color:#b8a184}#w4stash .fr b{font:900 12px system-ui;color:#ffd040}#w4stash .fr.sel{border-color:#ffd040;background:#2a1c0c}#w4stash .fr.done{background:linear-gradient(#3a2a08,#1c130b)}'+
 '#w4stash .dots{display:flex;gap:2px}#w4stash .dots i{width:7px;height:7px;border-radius:50%;background:#3a2c1c;border:1px solid #6a5636}#w4stash .dots i.on{background:#ffd040;border-color:#ffe08a;box-shadow:0 0 4px #ffd040}'+
 '#w4stash .dt{padding:8px 12px;border-top:1px solid rgba(217,164,37,.25)}#w4stash .dt .nm{font:900 14px system-ui;color:#ffd27a}#w4stash .dt .ds{font:italic 600 12.5px Georgia,serif;color:#e8d8bc;margin:2px 0 4px}#w4stash .hn{font:600 12.5px system-ui;color:#cdb898}#w4stash .hn b{color:#ffd27a}#w4stash .hn.ok{color:#9fe49a;font-weight:800}'+
 '#w4bag .stb{margin-left:auto;margin-right:8px;display:inline-flex;align-items:center;gap:6px;font:800 12px system-ui;color:#ffd040;background:#2a1c0c;border:1px solid #d9a425;border-radius:9px;padding:3px 9px;cursor:pointer}#w4bag .stb kbd.kc{min-width:18px;height:18px;font-size:10.5px}'+
 '@media (max-width:560px){#w4stash .sk{grid-template-columns:repeat(4,1fr)}}';document.head.appendChild(st)})();
// ---------------------------------------------------------------- THE FAMILY ARSENAL (the owner, Oct 21 13:52: "make some weapons and items like
// that", in the Boondocks and Chappelle style). Three melee weapons out of every grandmother's house, found in chests, vaults, secret rooms,
// puzzles and quests: GRANDMA'S CAST IRON (uncommon: slow, heavy, it rings like a bell), GRANDDADDY'S BELT (rare: fast, long, it cracks like
// a whip) and THE HOT COMB (epic: straight off the stove, glowing; every hit sizzles and smokes). Each has its own model (leather and a gold
// buckle; seasoned black iron; steel teeth glowing orange on a wooden handle), its own sound and its own mark in the air.
Object.assign(MELEE,{skillet:{mul:3.3,reach:5.4,cd:.68,col:0x8a8a8a},belt:{mul:2.9,reach:7.5,cd:.4,col:0xd08040},hotcomb:{mul:4.2,reach:6.5,cd:.48,col:0xff5a10}});
Object.assign(IT,{skillet:{n:'Grandma\'s Cast Iron',i:'🍳',d:'Uncommon melee. Seasoned since 1971. Never once washed with soap, and it never will be. Slow and heavy: 3.3x your punch, and it rings.',w:'skillet',rar:'u',loot:1},
 belt:{n:'Granddaddy\'s Belt',i:'🪢',d:'Rare melee. Leather. Older than you. It has never lost. Fast cracks out to 7.5 paces: 2.9x your punch. Do not make him get it.',w:'belt',rar:'r',loot:1},
 hotcomb:{n:'The Hot Comb',i:'🔥',d:'Epic melee. Straight off the stove. It has pressed a thousand heads and now it presses you: 4.2x your punch, and every hit sizzles.',w:'hotcomb',rar:'e',loot:1}});
MKINDS.push('skillet','belt','hotcomb');
MBEST.splice(0,MBEST.length,'cleaver','daxe','gpick','hotcomb','scepter','scythe','belt','skillet','axe','pick');
Object.assign(SELL,{skillet:60,belt:140,hotcomb:700});
// ---- the models (k_items style: the item library's materials, the shapes merged)
function txLeather2(){if(ITX.belt)return ITX.belt;const c=itCanvas(1024,64),g=c.getContext('2d'),r=itRng(331);g.fillStyle='#4a2410';g.fillRect(0,0,1024,64);
 for(let i=0;i<5200;i++){g.fillStyle='rgba('+(r()<.5?'20,8,2':'120,70,30')+','+(r()*.25)+')';g.fillRect(r()*1024,r()*64,2+r()*4,1)}
 // burnished edges, the creases where it folds in the hand and at the top, the stitching down both sides, the holes near the tip
 [[0,5],[59,64]].forEach(([y0,y1])=>{g.fillStyle='rgba(24,10,3,.55)';g.fillRect(0,y0,1024,y1-y0)});
 [[.47,.53],[.02,.09],[.9,.97]].forEach(([u0,u1])=>{for(let k=0;k<14;k++){const x=(u0+(u1-u0)*r())*1024;g.strokeStyle='rgba('+(r()<.5?'150,95,50':'18,8,2')+','+(.25+r()*.3)+')';g.lineWidth=.8+r();g.beginPath();g.moveTo(x,6+r()*8);g.lineTo(x+(r()-.5)*10,58-r()*8);g.stroke()}});
 g.strokeStyle='rgba(230,200,150,.75)';g.setLineDash([6,5]);g.lineWidth=1.6;[9,55].forEach(y=>{g.beginPath();g.moveTo(14,y);g.lineTo(1000,y);g.stroke()});g.setLineDash([]);
 for(let k=0;k<5;k++){const x=812+k*26;g.fillStyle='rgba(150,95,50,.5)';g.beginPath();g.ellipse(x,32,6.5,6.5,0,0,7);g.fill();g.fillStyle='#120602';g.beginPath();g.ellipse(x,32,4.5,4.5,0,0,7);g.fill()}
 return ITX.belt={map:itTex(c),nm:itNormal(c,3)}}
// Granddaddy's belt the way he holds it: doubled over, both ends in his fist (the buckle and the tip side by side at the bottom), the fold at
// the top, the two halves bowing apart a little between. The band is a real strap: flat faces and square edges (each face its own normals),
// the tip cut to a point, the stitching down both sides, the holes by the tip; a heavy gold buckle with its prong on the other end.
function beltModel(){const G0=new THREE.Group(),G=new THREE.Group();G.rotation.y=-.85;G0.add(G);const T=txLeather2();const lm=new THREE.MeshStandardMaterial({map:T.map,normalMap:T.nm,normalScale:new THREE.Vector2(.8,.8),roughness:.5,metalness:0,envMapIntensity:.65,side:THREE.DoubleSide});
 const L=1.75,rf=.1,gmin=.028,bow=.055,Y1=L-rf,gap=y=>{const s=Math.max(0,Math.min(1,y/Y1));return gmin+(rf-gmin)*s+bow*Math.sin(Math.PI*s)};
 const P=[];for(let k=0;k<=24;k++){const y=-.14+(Y1+.14)*k/24;P.push(new THREE.Vector3(-gap(y),y,0))}
 for(let k=1;k<14;k++){const a=Math.PI-Math.PI*k/14;P.push(new THREE.Vector3(Math.cos(a)*rf,Y1+Math.sin(a)*rf,0))}
 for(let k=0;k<=24;k++){const y=Y1-(Y1+.08)*k/24;P.push(new THREE.Vector3(gap(y),y,0))}
 const curve=new THREE.CatmullRomCurve3(P);const W=.26,TH=.045,SEG=300,Z=new THREE.Vector3(0,0,1),p=new THREE.Vector3(),tg=new THREE.Vector3(),nb=new THREE.Vector3();const pos=[],uv=[],idx=[];
 // four faces round the band, two corners each, so the edges stay square
 const F=[[[-1,-1],[1,-1]],[[1,-1],[1,1]],[[1,1],[-1,1]],[[-1,1],[-1,-1]]];
 for(let k=0;k<=SEG;k++){const t=k/SEG;curve.getPointAt(t,p);curve.getTangentAt(t,tg);nb.crossVectors(tg,Z).normalize();
  const tip=t>.955?Math.sqrt(Math.max(0,1-Math.pow((t-.955)/.045,2))):1,w=W*Math.max(.06,tip);
  F.forEach((f,fi)=>f.forEach(([a,b])=>{const q=p.clone().addScaledVector(Z,a*w/2).addScaledVector(nb,b*TH/2);pos.push(q.x,q.y,q.z);uv.push(t,fi%2?(a+1)*.02+.01:(a+1)/2)}))}
 for(let k=0;k<SEG;k++){const o=k*8,n=o+8;for(let f=0;f<4;f++){const a=o+f*2,b=a+1,c=n+f*2,d=c+1;idx.push(a,c,b,b,c,d)}}
 // the two ends capped
 [[0,0],[SEG*8,1]].forEach(([o,e])=>{const q=[o,o+2,o+4,o+6];if(e)idx.push(q[0],q[1],q[2],q[0],q[2],q[3]);else idx.push(q[0],q[2],q[1],q[0],q[3],q[2])});
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();G.add(new THREE.Mesh(g,lm));
 // the buckle at the back strand's end: a heavy gold frame with rounded corners, lying in the strap's own plane, and its prong
 const rr=(sh,w,h,r)=>{sh.moveTo(-w+r,-h);sh.lineTo(w-r,-h);sh.quadraticCurveTo(w,-h,w,-h+r);sh.lineTo(w,h-r);sh.quadraticCurveTo(w,h,w-r,h);sh.lineTo(-w+r,h);sh.quadraticCurveTo(-w,h,-w,h-r);sh.lineTo(-w,-h+r);sh.quadraticCurveTo(-w,-h,-w+r,-h);return sh};
 const fr=rr(new THREE.Shape(),.19,.15,.06);fr.holes.push(rr(new THREE.Path(),.13,.095,.03));const fg=itExtrude(fr,.06,.022,3,10);fg.rotateY(Math.PI/2);
 const bx=-gmin-.004;itAdd(G,fg,'goldP',[bx,-.3,0]);const pr=new THREE.CylinderGeometry(.016,.012,.31,10);itAdd(G,pr,'goldP',[bx-.04,-.3,0]);itAdd(G,new THREE.CylinderGeometry(.022,.022,.3,10),'goldP',[bx,-.16,0],[Math.PI/2,0,0]);
 itGlow(G,0xffd070,1.1,[bx-.05,-.3,.08],.2);return G0}
// Grandma's seasoning: near black, mottled where fifty years of grease baked on, faint rings from the casting, a worn bright spot in the middle
function txSeason(){if(ITX.season)return ITX.season;const c=itCanvas(256,256),g=c.getContext('2d'),r=itRng(417);g.fillStyle='#17120f';g.fillRect(0,0,256,256);
 for(let i=0;i<900;i++){const x=r()*256,y=r()*256,s=2+r()*9;g.fillStyle='rgba('+(r()<.55?'6,4,3':'52,38,28')+','+(.08+r()*.18)+')';g.beginPath();g.ellipse(x,y,s,s*(.5+r()*.5),r()*3,0,7);g.fill()}
 for(let k=0;k<22;k++){g.strokeStyle='rgba(70,56,44,'+(.05+r()*.07)+')';g.lineWidth=1;g.beginPath();g.arc(128,128,8+k*5.4+r()*2,0,7);g.stroke()}
 const rg=g.createRadialGradient(128,128,4,128,128,70);rg.addColorStop(0,'rgba(90,80,72,.22)');rg.addColorStop(1,'rgba(90,80,72,0)');g.fillStyle=rg;g.fillRect(0,0,256,256);
 return ITX.season={map:itTex(c),nm:itNormal(c,1.4)}}
function skilletModel(){const G=new THREE.Group();const iron=new THREE.MeshPhysicalMaterial({color:0x0b0b0c,roughness:.48,metalness:.4,clearcoat:.55,clearcoatRoughness:.3,envMapIntensity:.7});
 itAdd(G,itLathe([[0,0],[.62,0],[.7,.04],[.78,.2],[.8,.26],[.76,.27],[.72,.08],[0,.08]],48),iron);
 itAdd(G,itRBox(.24,.1,1.15,.05,3),iron,[0,.18,-1.25],[-.12,0,0]);itAdd(G,new THREE.TorusGeometry(.07,.025,8,16),iron,[0,.25,-1.72],[Math.PI/2,0,0]);itAdd(G,itRBox(.28,.06,.3,.02,2),iron,[0,.16,-.75],[-.2,0,0]);
 [-1,1].forEach(s=>itAdd(G,new THREE.SphereGeometry(.09,12,8),iron,[s*.76,.24,.2],[0,0,0],[1,.5,1.4]));
 // the cooking face: Grandma's seasoning, a soft oily sheen (not a mirror)
 const S=txSeason();const cg=new THREE.CircleGeometry(.72,48);cg.rotateX(-Math.PI/2);itAdd(G,cg,new THREE.MeshPhysicalMaterial({map:S.map,normalMap:S.nm,normalScale:new THREE.Vector2(.5,.5),roughness:.42,metalness:.35,clearcoat:.3,clearcoatRoughness:.4,envMapIntensity:.45}),[0,.083,0]);return itMerge(G)}
function txTemper(){if(ITX.temper)return ITX.temper;const c=itCanvas(256,128),g=c.getContext('2d'),r=itRng(523);const gr=g.createLinearGradient(0,0,0,128);
 [[0,'#6a2008'],[.1,'#9a4a14'],[.22,'#b8862e'],[.36,'#6a2a78'],[.5,'#28389a'],[.64,'#4a6ea8'],[.8,'#8a929c'],[1,'#9aa0a8']].forEach(([k,col])=>gr.addColorStop(k,col));g.fillStyle=gr;g.fillRect(0,0,256,128);
 for(let i=0;i<700;i++){g.fillStyle='rgba('+(r()<.5?'255,255,255':'0,0,0')+','+(r()*.08)+')';g.fillRect(r()*256,r()*128,8+r()*40,1)}
 return ITX.temper={map:itTex(c),nm:itNormal(c,.8)}}
function txTeeth(){if(ITX.teeth)return ITX.teeth;const c=itCanvas(16,128),g=c.getContext('2d');const gr=g.createLinearGradient(0,0,0,128);gr.addColorStop(0,'#fff0a0');gr.addColorStop(.25,'#ffb030');gr.addColorStop(.7,'#ff4a10');gr.addColorStop(1,'#5a1004');g.fillStyle=gr;g.fillRect(0,0,16,128);return ITX.teeth=itTex(c)}
function hotcombModel(){const G=new THREE.Group();const TT=txTemper(),tm=TT.map.clone();tm.needsUpdate=true;tm.repeat.set(1/.9,1/.32);tm.offset.set(.5,.5);
 const steel=new THREE.MeshPhysicalMaterial({map:tm,normalMap:TT.nm,normalScale:new THREE.Vector2(.25,.25),metalness:.62,roughness:.34,clearcoat:.08,clearcoatRoughness:.3,envMapIntensity:.6});
 const em=txTeeth().clone();em.needsUpdate=true;em.repeat.set(1,1/.64);em.offset.set(0,.5);
 const glow=new THREE.MeshStandardMaterial({color:0xff9050,map:em,emissive:0xffffff,emissiveMap:em,emissiveIntensity:2.4,roughness:.4,metalness:.3});
 itAdd(G,itRBox(.9,.32,.07,.03,3),steel,[0,.62,0]);
 // a tooth: a little wider at the root, rounded off at the tip
 const sh=new THREE.Shape();sh.moveTo(-.016,-.32);sh.lineTo(.016,-.32);sh.lineTo(.011,.29);sh.quadraticCurveTo(0,.33,-.011,.29);sh.lineTo(-.016,-.32);const tg=itExtrude(sh,.036,.006,1,6);
 for(let k=0;k<16;k++){const x=-.4+k*.0533;itAdd(G,tg,glow,[x,1.07,0])}
 itAdd(G,new THREE.CylinderGeometry(.045,.05,.5,12),itMat('steel'),[0,.28,0]);itAdd(G,itLathe([[0,-.8],[.1,-.78],[.115,-.6],[.1,-.2],[.12,-.02],[.08,0],[0,0]],24),'mahog',[0,.05,0]);
 itAdd(G,new THREE.TorusGeometry(.08,.016,8,20),'goldP',[0,-.02,0],[Math.PI/2,0,0]);itGlow(G,0xff5a10,1.6,[0,1.05,0],.45).name='heat';return itMerge(G)}
Object.assign(ITV,{skillet:{mk:skilletModel,sz:.95,tilt:.25},belt:{mk:beltModel,sz:1.05,tilt:.35},hotcomb:{mk:hotcombModel,sz:1,tilt:.45}});
// the swing: each weapon's own shape in the hand for the arc, and its own sound and mark
(function(){const tp=toolProto;toolProto=function(kind){if(kind==='skillet'||kind==='belt'||kind==='hotcomb'){if(TOOLP[kind])return TOOLP[kind];const m=itemModel(kind);const g=new THREE.Group();if(m){const R=m.userData.R||1;m.scale.setScalar(1.9/R);g.add(m)}g.rotation.x=1.2;return TOOLP[kind]=g}return tp(kind)}})();
function armSound(kind,x,z){try{const ac=audioCtx();if(!ac)return;const d=Math.hypot(x-heroPos.x,z-heroPos.z),k=Math.max(0,1-d/60);if(k<.03)return;const T=ac.currentTime;
 if(kind==='skillet'){[220,440,661].forEach((f,i)=>{const o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.value=f*(1+i*.003);g.gain.setValueAtTime(.0001,T);g.gain.exponentialRampToValueAtTime(.16*k/(i+1),T+.005);g.gain.exponentialRampToValueAtTime(.0001,T+1.1);o.connect(g);g.connect(ac.destination);o.start(T);o.stop(T+1.15)})}
 else{const N=Math.floor(ac.sampleRate*(kind==='belt'?.09:.6)),b=ac.createBuffer(1,N,ac.sampleRate),a=b.getChannelData(0);for(let i=0;i<N;i++)a[i]=(Math.random()*2-1)*Math.pow(1-i/N,kind==='belt'?3:1.3);
  const s=ac.createBufferSource();s.buffer=b;const f=ac.createBiquadFilter();f.type='highpass';f.frequency.value=kind==='belt'?2400:3600;const g=ac.createGain();g.gain.value=(kind==='belt'?.45:.18)*k;s.connect(f);f.connect(g);g.connect(ac.destination);s.start(T)}}catch(e){}}
(function(){const sf=swingFx;swingFx=function(x,y,z,yaw,kind){const r=sf(x,y,z,yaw,kind);try{if(kind==='skillet'||kind==='belt'||kind==='hotcomb'){const M=MELEE[kind],fx=x+Math.sin(yaw)*M.reach*.7,fz=z+Math.cos(yaw)*M.reach*.7;armSound(kind,x,z);
  if(kind==='belt')burstFx(fx,y+2.2,fz,0xffe8c0,6,4);else if(kind==='skillet'){ringFx2(fx,y,fz,0xc8c8c8,3.2);shake=Math.max(shake,.12)}else{burstFx(fx,y+2,fz,0xff6a20,10,6);smokeFx(fx,y+1.6,fz,2,true)}}}catch(_){}return r}})();
// the rolls: Grandma's cast iron among the uncommon finds, Granddaddy's belt among the rare, the hot comb among the epic
(function(){const lr=lootRoll;lootRoll=function(src,n,r){const L=lr.apply(this,arguments);try{const have=it=>bagCount(it)>0||W4.melee===it;const k=r();
  if(L.tier==='u'&&k<.3&&!have('skillet'))L.items=[['skillet',1]];else if(L.tier==='r'&&k<.45&&!have('belt'))L.items=[['belt',1]];else if(L.tier==='e'&&k<.4&&!have('hotcomb'))L.items=[['hotcomb',1]]}catch(e){}return L}})();
// ---------------------------------------------------------------- THE DOUBLOON ITSELF (the owner, Oct 21 18:11: the coin beside every price
// has to be HIS coin). The tower's money is the owner's own Funky Roger Dabloon (a fried chicken wing: IN WING WE TRUST; a skull in an afro,
// shades and a bow tie: DOUBLOON · YO HO HO), its game mesh loaded beside the page as w4/coin.js: every coin on the ground and in the codex,
// and the little coin beside every price and every count of doubloons (the HUD, the bag, the market, the cards, the toasts, the floating +n).
var COINI_SRC='data:image/png;base64,'+'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAoXklEQVR4nNWbeZxcV3Xnv/dt9Wpfe1/UrVa31K3VWixLshZb3ncWkQTGGQiMk0wwieFDZpghI4uQZcJiEgIEEwZsMzhYGAgY2xhjW7Zs2ZYlS9bWUkvqfavuqq59efXeu/NHtYxJyEASJjNz/6lPVb1P1b3nnvM75/zOOYJf8dq7F4XnUPYdwH7r54/sHTCKGd13bjzZ7DrW+porpJRSAAghpK5LoWAc7etonPFHaqV37Ttt/czv7kRjF+6+fbi/yv2KX9UP7dmD+sh+XAES4Mt3bdCnstPdpZK1oVCq3Chdd5PjOM0S4fWbqseVP/1zubiRUsWuCkFZVdUZoSiHAz7zCZ/PONIabhn+7fuP1BafFe/ag7J/P86vYt//agHs2YM6sB+5j/rN7P2NlhW5XOWuSrl6i207PQGfoQRDQXzBgGxpa85LKWXn0s6cYejSRaIIAVIipStGL4yFHEeKqcmZYClfEIVcnkLJcnVNvWB6PY8FQ+b9+x6eHgTYC8rpPYh/rSD+xQKQIO7diXpJ1T92e+PuQqX8Mati7QoGvGq8scFduXbFfEtHUwldZ3w6Z0jXMsoVW5lLJv2qQDiOxLZdTENBoshES2NRVxW3qTFqmYZmYdWYnZ71vXHkTCI9N6cUihXHMI3nAgHvn/3Zo8mfQN007j2Ac0nz/k0EsGcP6iXJf/S2pqusavm/2jVrdyQWoWdF70JP/9KcYuja5FTanJ6aDpbzWcOjgSYddBXm0hWkhNYGH8GAwcmhNMs6w5geleRChXzJBs3AF4xaHV0t+aZEuOJRhH36xLnQ0Omh6EI6g2EYPzE83j/51Pdnn/2He/o/KoC7NqDff4Ta3TfE2k1N/GGhWLo7Gg2yeuOa2VWX9Zem5nK+1149ERdWQWuNG1QqDpWqS0tjQE6nykQCBqenLTExmWddX4SoT3I+JdnZH2Lb+mb5+PNjvHF+AeFKsXpZiGzRYiZtEYhG7FVrB1LtjZHS4MlzvsMvHW3K5wr4fb7PV2z5F59/Mj1xaW//pwQg9oLYB+49tzVd5VRLXzVUupeuWLFwxdVbFk6euRi7eH4kHNZrwqsL5vOuTIQ95MuOKLg63VEYnirRltApGCFOnZolETKIemy8DTFWN6ugaMwU4OL5GcbmJau7PDTGvfLomTRBUwrNUKlKj1y3dnl2ydKO9E+eOBiduXg+atlyWFGN99/3eOrZvaDsq5vDL2USyj/38B+5JXGPUy4+o+qe7jve87aRFRtXVZ986uCS1Mi5yOYeU6zrjctcRWM2bYlkWRNj41l8foNMwSHg07BqEtdykbaktztMvuxSLLg88eIURwbTzKaqyJrFNdvbGUuW8ASDQoIYmnbp74rJ1rAQL7/wWuQH3392yfZdl1Vvf/fbR2z0bhzrmY/ckrhnH7h76xf7S13uL/OQ2LPodu65OfagqFXuTLS3F256543JF1892ZydmfDFTEgXpUTziNRcjp7lbcxcGCfc2oghLdIFh4uTBVZ1eGhr8vHKG/MIJA1RHd2jMT5VwjR1etr8HDmXR9M0dlzezOhUAd008JRz+Joayc2myFVVIj5kY1QXr51J0796WWnLFetmvvG17zdW0tMBqZkP3ffD9G8uYoLLL9CEXySAnx7+xuiDtlW6c/s1O6a6Vq2wf/TEwdaeBrSwT5dnZlxx5uwsra0hXMumiqBQsGkKCtoSGk7NpiYVVvTEqNZcVE0hFDaZTpYIBk3CPhVVUxk8l6QxanJ+JIPiOpRtwaunc6xd08zqvgiDp6bI1kx8qkOpUmXTQFxOzBZEuoT96+++YeqVF45rhw+82Kp7fQ99+ge/nBD+dwL4qc3fGH1Qwb5z864tyUhjA68feaNhbZdPXL62BQl89e8v4Ogm509Psnl9G1RylGoALl1dMcIBL7qpoSuC116foW9ZjHjURCI4eTqJqqvEIiaTs0U62kJ4NEHVdikUK8xMLCAQOI4kWxGouqAkDVp8Lh945wDVqs0Pn7vI6bGSvP22rXMHXzrP2ddea/QH60L4RZjwTwlA7N2JeroR2VGKfa1WKd658/pdSTUQ1k69/nps98YW1q1qwfDqKEhef2OaH7w8j7QsTFFl6ZIYXp9ONB5AVwXTcyU8mgBXki3ZGAI8hsLIVAFVQCho4g97EI6LdCVVBD5NgBDoCizkKtRqDlOTGdAMIo1Rdg6EWL6yBdd2oGbzkxdHef7INNfdtCV99PVxe/jYa42Kx/fQhC/9voEkYt8BnJ8nhJ8LgndtQNt3ALutnPgQduXObVfvmPJGYwydPB676coOuX5VC2bAg9BUUBUGehKEKOPXaqxb147HbxIKmZw6NcPMVI7muJeAz6BsQ39/M7GmELaqc9naNjqXJEhlKsRjAVrborS1hYkFTWIxP9lcFVtCS1OIlf3NLOttRMVGK+dYviwOrguGiuI1uHZ7F9duaZc/efJQ7OodfWzcsXVK2JU724qJD+07gH3XBrSfd9Z/JIA9e1DvP0LtD25PbHeq5U83dHbml65abg+ePNmwY10TK3sbhO7T6/G7K6mVarx8bJLuZQmuvrqPeMyLT3Xx+Qw2bexEajrSMChbEI8FUYWGRMPj9eKi4vEarFrZSqXsUHMEZ0cLqJqG1+th/ZpWhKpjV2ukUgVaG/xcd1Uvpk/j8WeGqBYtFAkSgdQ0dmxZIrZd1sJjj73YsGP3BtsTbc4Lt/LpD96c2H7/EWp79qD+b03gUnzdXoo1O3bted3wdL3/7t8ceebHB7pWdXqUTatb8YZMUBSE61IuWhw8PMpctkbXkgj3P/QG2bIkX3K5+z0DrF3bytkLKUqFKr3Lm7k4msFrqJgenZojMTwquqag6SpT0zmWdoQ4ezZJf38zyXQJXQFXUZgZTfLNx87j83tpDClcv6uTYqmGU6lyw9W9BGMBpOuCC07V4tHHz5DMue7Nb7t+5NOf/NsuQ5UjiqrumPClZ96at/xjDdhZR3zbcT/uUVl60ztvHHvp0LGWJQ2KsmZFE76wCaqCUAXlYpUnnh3CG/ZTKtb4m4feAH+UeCLE+dka33pqjGPHp3EcaOtMkM5atLVFkapCsWIDkmrVpma7pBbK2BIUVaO5LUouX2V+voRQVBbm8/zdEyMs6W5hdLbMNw+k+LMvvU6lXCPWFOTRH54iNZ1FKAIpQDMNbtndi+bWlJPH32h5z/vuGDNUd6ntuB/fvx+HnT975jff7NmDuu8AzkffkdjuWpUP9KwaSNdcvGplzrumt0FGE36kpoIrcas2L742TmNblGy2zNe/M8jhixZf/sytfGnfbj77B2sJBE1GZiq0tIYxPTqmJjh3dpZa1UFoCmVb4tUVkskCfq9OV0eUw69PcmE0g24a+AIevH4PhVyVNWvbue8zN/Hwp69h68oIx0YsvvfjEayyQ09vE88cGqaSq9SFICX+sJfbdi+TgyeGvK3NXm/Dkt60rFU/8NHbE9v3HcB5qyn8VAD1F1nKVj8ZCoe0Hbu3LkwPn02s7InS0hQSqGo9vJIux49PMZe1mJrK8bXvXGD5qi7uee868gtZFNPD29+2jm0b2kgvFLFrkovDKbLFGn09cZrjXhzbxSrXWMhViSUCFAtVqqUqLY1+/KZGOlsh6NOZmMyiGB68AS+EvbQvaWTf3Zu5Zksrz56u8ruffI3BCxlCMT8HXxlBCEAIJIK29oi4bEUjTz91KPGOX9u94PP5tXLZ+iQg9/xDDdizB/Vd+3E+ekfzTtzajlUb1iTPnR1KxH2O2tUWk7rXQEoJEuaTRcbTJaJRH1986BQ33L6Br/7VLey5bimxiBcMlScPjPDqkVG6O8KcG1lg1UAzHo/OzEKFYsUlEvLQ1OAnm6/SEPNimhpz6SK1So1CoYqmKpQKVdLzBaJhD889d44ffesYjtdg5Zo2PveftrL3/cspOSqP/WScQt4m58DIuSTCUJGLyLZtQ4e0SwU1NTuW2LBtQ1LWrB0fvaN557v2/1QL3tSAvXtRCoXiJ6LxqOzq6y6m56dCXe1RojGvkMol+kYyPpWlWnPxelRCIQ+r+psgZGJ6DRRNQUFiaAqDIzlKJYt42EOxXAPHQVcV5vMVBALNUAkFPbxxYppc2cEf8DGXrdDRGaOvO0ZTU5BQ0CQ9l0fFJeAzUHUFxWvQPtDGBz9wBbde2cTgcA7DUEAqjE5lwXHrW1UVfGFTrFnRwonXz4S2bFtZDITDslQqfmLv3p+eW9nLIvANdnS7lrWtZ8WyjJSWvyGkiuZ4QGpefRH1Ja5lk8lViEd9mKZBR6PJ/kePMzdXQWkI8zcPHeP0hQxXb+ngQx/YzGuDGfwaTM3k0D0asbAHWa2BZVHLluhuDtLXEUGp1sgulIlFfMzNFZieK2DZErdm89Lr03zsw1ez7aZ+MrMl7vvrQ8ymKmTQKdfg7bvb8PkNPB6NXNGimq8iVAWpAEJhbX+TdKtlUSrm/b0r+zJ21dpmD3Z079+PsxcUjZ0oHMAtZPK/Fw571c7uJdnp0fPt3Qkf0bhPSMmibSko0mVipogRlixZEmX3jqX86MAof3rvk3i9KheHkvzowDD/4wt3cNWGJmZSZb7y7UHefl0PZUMnFDa4ZmsX4bAPTA0UBaQE14GKgyslk5MZzg2nmFso89xLo/z6r21gy5Vd2Mk8f/nlQxx6+SKlfJmZuRz9nT42rYqhSImUEp/fQ3qhSEvUC64AVRIImWLF0gbOnDwdu3L72olTR45HC7n87wEfZieKkCDu3TugTz8/cra7q7196+7NyczUmdb1K5pp74rX7cmVCFUhObbAC0cniSf85PIWsWgATddIJks4Epqag7x6dIp0SfJHH9nOzEiSBx4bxs7nuPu964k3RcDQwbaRUiAvMaOKQBGA44KuUE4X+eo3DhNpbeDX3rYK3XX4xqOnOH5ygp1blhAKeJCawKfAicEZVNeuxxSGSl9bkDUbOpHUMUu4kqmxBZ48eJ5rb7l26uv3/7BxanJ6oml71/J7952uKQKkcyK7RMFt71mxLO24FW8oqBMNmRLXBUXUN+k6JFNFhK5hu+C6EkMXTMwUaF/aQMeSONmizVVXdlFMZ/if3zqG4jFY3mqwenmMeEsERwik4wICISWKAsolYtSRSAS2A964n8bGEKoqmE0VePrFUVLzGW6+po9ly5up1GyKuTL5qkN/XwPtHVGCIS9CU8kXLLDsNw+PK0kkAjJkqmTSC9416wfS0nXanRPZJYK6pZAvl7f4vYYab4qXrHzaHzY9mH6PQIj6j0igJgkFPfgMgaYp9CyNEwh6MT0aU1MZbNtBBS6OZVi1opGxizN88+8O41Fcdl/RDa5EFSBsG2o2bs1GOi7SdpFWDVwXISQaEhzJjTuX4uYLfO1/HOIrX3+F5X2NhCImyWSOQMAkGvUTi/nw+Qx0XSUYMGgIm8Rjvrom2Q4oAqkrGAFDtDSEmJqY9Hf3tJW8hq4Wy+UtQD1BqFnVXeFERPh8hkhny0bQH0LR1Xq8LwQgQREUSzWsmkvUo5HNVTG9oCoKhqljAyG/Rjhs0BhSEU6Va67sIRQwmZzJMTKRwZUS06PRlPATTwRxqzaulGiqQjpdZHa+QLlsg5B4TZXbdvcQDHt54FtHeeXwKJetasbrM7B1HceVzCXzhIIGQb9GJl3CY+pkchVQBEJXf4oxUtLaEubVU9PGwGU+4Q0ERD5f2AU8qO3dMxCYnR/ZZvp8tteDbuoCn89A6ArSckDUbwTpspApMzqRJxwNUC7bvH5ijmW9DcQjXsZnCmBXSc5keergOB9+31ryhRp//c0TzKRK1Kx6kFKzHXymzjuu6ebW21ahSDj66gg/fH6YiZkCxYqkVHEolmtEwx5+e88K1q9s5PtPHyIW1Nl6ZQ/5nIXpUTBVk2yxWs8tXMHoxTStUQMp63giXBAKICSRkBfhuhiq1AOhoL2wkNu2d89AQFs50MDUsxdaGlqayzWrZKr1W6oXa3S1rk5IMDRa2sIwOI/PqxINeTB0lVDESz5fIR7xUM45nJus8NqFKn/x1Te4+qrlXH9VLw0JL96AiRCCXMXhxMkkX3vsHI4UDPTGmFywuPXGfvw+DVXTsBzJzFyRH78wzh99+QQNZo25ksYjz84QCntZ0d+C5QjiMYNMpsjoeIloxKS1yU9Hgw9h6nV3ayiLDIAgGPRITSAy6QWzub25PHxhrKVhoAHt9XPn2lVVCKRrm16DsgDT1HERCFxYxEBZc+le1sCGZJGpZJGmqI9c0cJyIBINIFSBIyVjyTLv+fV1+DX4d7f3E24LghR1QSoKIFm3tZNgwODhb59k4HyKe96/mVBzsP5HjguqygpFsuuaHr7wpcO8fGSGzdubOPjCEHa5wuRYmo6uBLmChapCPGJiOw7NcR8r17bj2g6KqtT9t5S4gKIoeD0qUoKuq44qhDZ37ly7Us5VN5uGFujsbs/NzUz7TY+OoiAUJMKR9U0LcK0aqYkFZmdztDX4SGVK+AIePHo9+hsZTlEuV+mNuXz6cwfp6QgTTnixs1Xccg23VMUtW9ilGm66zMZVCdavbaJ/ZRseQ8HJV3ByFdyqg1usYuctZNXl3bctJ5Mp85nPv4Bu5YklApQsm1QqD4BhGnW7d1wGz84yN5bGLVn1m3fqBJCigqIJ4febzM/O+pcPdOcMQwkUCtXNiqIolgQ0TUXTFCGEwLFsnn36PFPjmXrdzpU4jsSVkqnpHNlshZaWMNJxSKZL5MsWfq9KR3uQq7Z1EQsoWDUXqSgIRaC4LoqmoQiBAiiqinQcnnz6HI8+dhqPqSMEqIpAWYwJVKXugUyPRr5oEQno7NrSQSjupbM9TDRsMpPMoRsK0ZifoN+gWrXrl+UuapKUWLkKT/9oiNR8AY+hYtVsoapKHRtRLEVKKZB1tNdUBRXJD54f4+njC3zz8SEq2VKdmwuaJNqj3PH2NeSLNYq5MgGvRmuzH+lKAobgyOvTXBjP0hxVmJgvIaREKouquIjIQhFIJBOTeZa2B4kHVcam8m/G71x6dSVS08jnShiaQ1uDQUd7iGqpxujFeXRNEPLr6NJFOi6apnDbbatoWBJHD3mQisCpWjzy1EWeOpLikScv4Lrum0kdgCKleAs5UP9UCjB1hUjIIBKo8/ZCUcB2qWXLNIY8NMS9TMzkGZvMUbMlEonq99LTHaVrSYSGkM7+75+kXHJRq9X6ZbgujgtuzUZIl7PDWdatSBDyKDxxcAyhK9i2g7tIjDquRNRqZBcqJFNVFLtKJObHUEDzGSAEfq9GMlVCVaFStjAR2LkKWA4gUDQFr6EQj3oJBwyUS/WSxWzRARQhhIS6u0RKHBd2Xd7KHVub2HN9L6quARK7UqNUspgZX+Di0DyZhTry21UL17LQFEki4WNhocydb+sj5OT54L3PIT0mqioRQqLqAtXUef6lKfLZEtVymZlkgXQyy7eeuICmChRchAKaXwdF5TMPniGqV7nr3as4OZhCM3VW9SXQVSgUqnR2hpmZyjI6liY5k2MhVcSp2ggFhKZx0/ZO3rmjhduvWYorfpYEF0JIzXVdQwiwag4eVUgE+HweelvD4Mo6e+ZKFE1g+AwiPoPbbx3g+OA8qXSR1pYQqVSJhXSJsi6IRL2ceCPFO29YwsNPXOC69+W4692raYqaCAGnBucoZXL8xs29fORPnsNxXe55/2X8xRdf4U9G0lxxWTu6oZJKF/nKw6dIjc/wGzd24NgOXlXiSMhkSkTCJtOzRRCC3t4GutpCeAy1jh2XAiAh8Ea89MT8ULWxbRdHdaVVtVEUcHENzRvyvJKeKRXGhydC11zbX5wcOuOxao7Ua65AUxDSBcdFNXV8Zl2CdtVm+6Y2Xnx5lNHRBfr74uRKDpWqTcinsW1LNy0NAaJBg888MMg3Hiywc2MjR88ssK4vxtVblpAv2Vy5pQuvrpKzXG6+soNDRyd44IGXWN0XZWQyz9TQFL9xYxtr17XhMXRGx7LMz+YJh0xqloMiHTTHYnl3E4aqohkqqlevo2ClBirISw0YrpS1Wk1EmruKp45dDFVrbiGW8LyiXdbXN/HjyZelRKi5XMUFqFZqBBRfPVtTRV0LLAfbcsgXqhSKVUqlGrVKjeRcEQdY2lm3fUVKimWbqckMW7Yu496Qjz/721ME/Cbvevtann1pnO8dnCKTq6BrCs3NAfb+94OEgjq6x0P/ikZ6mg1ePT7L269r49prV5CZL5BOl2hr8uH3GSzkLBZyFTweBVUIRs/PEQqaeL0aQb+Jx68vasGlVB4syyZftEh4NIRQVMdx5WV9fRPaqdNzqKo6PT8zu1TR+/NC1cgXLRG/BAx1/wSui+vWUdzjNQjFAyxd0cSuXQrz6RLp+QLzcwVQFLqXxgkGTYbOzpLNVhhY0UBOenBTFbZc3k40ZJKvSoKGxNU0In6DdKaK47ps2NjBvZ98hiWdITaubuLYsUnWb+hgecRkZDhNNlWgsSHAQF+cRDwAqqBSrFItVJGOi+u6CFlPsVHEYv0CKhVbVGoShKcyPTEd0jTt4qnTcyj79p8uKIryYrVc0uwatZojKZSsRaJiESoloAp0v0GkIUBje4Rw1EetZDExkiI5sUC1UqOnr4ktW7vRhODYkTGaW8NEY0EyJfjgf1gPjsPrh0c4c3qKmbF5SjYMn58jGg+AdLl8ZRyfpnD3f9hIqqhwdqLMzdf1MTw4w9D5eVYMNLNqTRu4konheS6cnWFhNo9p6jS0hEm0RzFDZn3Dlzqv6pEwuXwFG0Eg5K8VczlNUZQX9+0/XdAAdFN7rpjLvzefr0pvIGgVSzmjVqqhm/pPIXORFJE1h1qhSjZbIZer4CqCxvYoibgfp2pzcXCGTL7Kusu7yC8U+fxDx9ixcwWHXxnDdG1SqSJnhxdIzlfw+jRWLQ2RbwpilS32fe4cl61u4rarl/De23v4iy++RGejzvXXD3DmxCSvHx6le1kDvQMtFPMV0sk86bk8pVyZSMRLOOpD8ep1PgBZZ4UWtXg6mcUXDFv5hZIsFgrSYxrPvZkOBz3+Q/PplDMzPefrXx4vpjIpI1+oyljAI6Qr6/bk1nNst+ZQLlvYriTWHCIS8yE0hfRkhqmpHIZX57IrusnM5fnIJ57hnbet47fedxk/efYiV27vJleuEY96GZkqont1Tp5OMXchR7kGl29Zyq5NLdh2me3r4qTes4EvP3yCaMDDpsu7mZ/NMT2xQClXoWNJjJ7lTeQyJfKZMnKRsxSuW69Z6mqdY5DgVGtyOlkQjUt7i8MXpnzlcs1pSDQegjSKBKGuDo+6Qpk4f+Z8rGxpZQeF2bmCuKQ+2A6oap26UhV8IS/NnVGijUHsUo3p83PMzOSJNwfpW9NGNpnjE58+QN9AJ7/1gQ1Iy+Hw8TlKlksobGL6TLw+ncawzqY1CdYuj3LHVR1sGojQ3xvjzHgJXzzCnt0drN/UwwPfPcupExM0tERY3t+MdFwmRlLMTmYIhLx09DUSjPpRVAWha/XDK/WaIYognSqKhUKNxsZE+fQbgzGhqhPqanNUgtDu3Ym6b99p6/evj3w3l56/J5uvWVLx2Au5slYrVNEDRh0EhQBHIHQNXQC2S3GhxPx8AceV9PY3occDpC7M8ZVvHKGm+fkvH74SkBx4/iL3P3iUyWyN33v/egLCYZtoxbUcHCDsN8DQqdRcnnhmmL/+6jG8Pp3f/feX8f5ba/z510t8/+nzeA2N5SvbWLnOx/kzs5QKVeYmFognAniiXmTVridAou65hJTguJwfTaOafjufq1np5JzmMY3v7tt32mInmsaBeqEwEAl+ITWb/NDw0HD4iq0r0nMjpxpnZnOyI5AQUoBYZIWQIC2HqlWjkK/g9Rk0toWZShaYPTnFa8cnGZys8ulP3ojh1zl3coY//6uD9HSGGD03xx//6XMsWxqnv7+RhpgXn0dleLrE4OkkZ8/P8dqZNE1NAT7/pZfp6oxy49Y2fu9dDn9y/xGeOTTKXKpAS0eCgZXNzE1mkY7ErTnIooUw6lFrPaVWkEAxV5EXxtJi5RVb0sdePRsuFKtOornhC5CBA7jaPnD37EHVVowPi1TwxYmLI9tLG1aOlG1VTs3mRUtzCM3vqZdQ5CIY6gqiJvCHTTx+D488do6T5zKcOJcinSrwt395G4nWANMXFvjcF18k1hjmj+7ZgVPIUq46HDuV5DuPnmDj+lZ+9OwwvV1h7n7PAJtXhbllR4kfvpTk3AWTz33+BZqab2L1qkb+4M61/KdPvcDRoSJNTVkCoTH+47sHCHo0VNtFKIuAp9YbMaQrETWH8yNpka+pMhIKFM+fHurSdP0FbcX48J49qPv247zZNLBvH+5H7/D/t4VU+rmzpy74w9FoLldNhcfGM3JpX6OQ7qIWaApUHQyvgUdX+J+PnGDZyg6u3tzJifNpypakty9BdaHClx44yoa+EM+cLtPfn2BhSsHQVFava6coznBxpsyf7t3F0OA8y5bFoWajKIJE3Me+L2bZtbKBv/zCS/z5vmu5Yn0zH//9rQRMlZXdYX7wwjj3ffU4n/joFtRqre71VAXpuAhFQTgOhXxVHj+TFN29PblXXzrpz2UywheK/Ld9+/Luz5TG9u/HeWQP6qe+N3PAEfrzQydPNTa3ds6XLM0Znc6KQrpIPYmtMzt1shTGz89x9HyOzVs7CYW9bFnXzOYVEZLD83zwv/6Yy5YFuG57F7n5NPc/fBqtOcZsTeFrj57l+ecH0bNJHvnWcb7w0BH+y32vcirpUPb5yFQ1TCpsWtvIzZsb+a0P/YC8I7iiP8aGgQSarrF7QxO2AydfHUUxdTDq9J2U4NoObtXm+JkZUXA9Tnf30vnjh99oRDGe/9T3Zg488pau0jc1YP9iyBDwez6eWcg9c/y1o9EVq3rn8zNnm4aGU3Jt0COEvvi4oYAjCQcNysUqh19PsunKVkiXqdguTsmiozVIOltlIWex93fWc3Qow7t+cz9dcYN37O6k/ZZu1q9rB2B5wiEaN/irzz3LbNHhPbvb+fBvrsayHHSlyh3XLkXXBVrAgyfoRfHplEZUFNemIe4Du66Zi1eEtF0mp3PyyJl5sf3aHfM/+dHBaC6bt/1R/8cBsf+tGeFb08O9O+u9QXffEPmSqTq/c907bh/JpGaaglrO29MeY1lvI1KA0Or8ALbDoVfH+Jvvnqd3oI2P/PZGvIYgPZZieq7MV751kl+7po1Nl3WiehQef/wU/cubWLqylROHR4knAsQbAgyemqa7O47t2Bx8cZiN6ztp7Yzx2ssX+eYTF/jje2/Gbwpy8wVqQuXr+08xPZHibTvb2bala5FrBKkKhAulbInvPjWECDSUu7vaZx994NtdllT/5vNPZn730hkvnflnO0QOLAJiUPlkpcbFp3/wVGdb1/Lp2Zx0hyczzE5k6jyj5bzJ8lyxqZNP/PZahk8M84nPHoKQl9jKVhSPia64tDYG0PwGC5kKK5Y10twSoZSvoioCQ6+7V9OjUShUCUeDrFnZSrVcw7Zd2lrDVCzJi8dmoTlIqCvONx87x5kTo/zOO3rZenlnPccXvAl+1WKVA6+MMJsX7vqNq6f3P/T9zprLRU1VPrlnD+olr/dzBXCpd+a+/elJ1et5b6lQ5MBTzzT09G+YSOUdeepCkoW5IsKj1WuGqoLQVZZ0Jfjsf96Ok13gYx/7MQ88cIxH/v44125uprEhCIrAsRx0TcFjariui67WAVEA6pvgBR6PhqoIqiWLhtYIb9vVwd89fJjPf+YQX/riKxSTaf74Q5tZ1tuEWOQS5WIJzC1bHDk+yRvDRXnNjTsmvvPwYw2OVUExPe+974fpybee8eeawKV1qev6D25K3KM4pc9u3rVtSvdHtMz0YGNPR0iu7msS0aZg3RycxfjAdsmlC7x6fIZiocbynihLOiMYho7iUVmYKyAkRBIBiuUamWSeSMyPL+JlciSFoSk0tNe1o5Kr4PcbeGN+ipki09M5jp+eJ+DX2LCqmURzCCkEYjHaE7aDVa7xxuCsfPzQlLh695bk1PCU/fJzL7ZKw/fhzz02f98/1Un+Cxsl20uxrzmV0p3brtuZrAqPZi1cjPW0BFm1vJlEW6jucyUIVVArWBw+PklfV5REZwwqNigC13aplS2URXK1UrKoFquYpo4eNMnPF9AEeCN+pAK1TBnD1FC8BjgOOJJKxaKQr5BoidSDHAnCdcGVFPNVjp6a5tnXZti0bVO6MJ+yX3jqQKNm+n9ho+Qv1Sr7+zdGHzRU585N27ckHT1Icf5iQ1tMFcu7EnR3xcCjIYVg6mKK//7gGdpiKts3NrNuRQM+nw66Vg9RXYk0VGTVwa7Z6B4dNIFdtACB5tHqAY1db4CsFatIKRkZz/LoMyPMZh1u2NTI9df2gKj7+ux8kYNHJzl2sSw3XrFuLj+X5JXnXmp0pPbQfU8s/ItbZd/8/q3N0o5VvnPr7u1Trb299snDL7c2BKW2rD0ie3sahD9iMjKU5FvPTFEq2/iVGqGISTpTZffmNjZvbFvcxqWegEXezpGgK/X3NQekZG6uwPhUjqHJArlsmbKjMDWZxR8LoyB5381LaG4MMT6Vkc+/NiGms4p97Y07p84eO6kdeuZgq2r4HrrviYV/dbP0PxLCh2+OPYhdubOxs7Nw7a3XJl86dLzZdFO+ziY/Az0N8o1zaTE079DstTFMg6pUefHQGDYqf3TXauJxPw9+5wx+U0E3VJa0BAj6DI6fS+P1qFx75RI0TeEr3x7k3EgGqeoEDQUMBc3wUJhboK83zq41MTmTKotXz8xjhJtL11+zceZ7Dz/WODc2HkA3H/rsr7Bd/s3n3jowUa2UP+sL+Lnm1utGclXHnB0baghpVdU0dMaTVXnFyog4crHKXDJPe7MHR/Wwe20Mv1fn/sdGmJnJ4zF1GoPQmAgyeHGBdFFww+UJ3nVrL1//9iBTRcHQ4DT9/a3IQgZL8xLSHbm0xRSTqTJ523T6V6+cC3iUyuPffqKrUizh9Xo//KnH5u/750yN/LITI3IfyL2gfOax+ft0X+DqSqk8/OPv/H1XemTYs3X71lHH35EZTzuyMaqIctWmyS9laqEiS47G6q4Ay7pjZAsWzQkfjgu9S6KUijYlzSTmFawdiFG0HITt0tsZpFCo0hz1UC0U5MplEbm1z8TQXXF83JKh1mWZW2+5anR6aMjzxN99t8uqVIa9/sDV/9zDw79iaOoPb4i1O5r4w9Li0NSajWtn422dpXKl4rtw7mzcoKxF/Cq6gO72CK0tITk8nuepw3PY5bKQHi9LooJ0VeX88AKb1jRw+YqIXNYZZmwqz6HXp0TAr1G1bOaLElfz2SvXDKT8prc0Nzrse/3V402ZTJ6A/99uaOrN9U+NzcUTUXpW9C40LVmSK9WkVirmzWw6FSzlM4ZXB78Bjm1jegzyRYummIkiBHOZKj6z3jidLztUHKjYAqkFrGhjQz4aDlUCurBnRkdDQ2eGoqn5BXT9/9LY3KX1jwYn39G4u5Avf6xasXZFwj41lki4fav65oPxeAlFR+AY8ws5Q9OEMj056xdCCtelXix1XYQQMtbQUNRVxY1Fg5btqpbi2BQWUr5zp4YSqWRSyebKjsc0ngsE/y8PTr51/fzR2fJdlbJ1i+M4PSG/RwmEgnj8/vrorCtle3dHTlEUKRbdoXRcJK4YvzAeUhQhpiZmgtVSURRyeXJFy1VV5YLpNR4Lhbz/74zO/sP1yw5Pszg8/fOuq1RxqiDLqqbOCPH/yfD0P1z/4vF5RQpF/bcfn/9fuKXVw5AIeO8AAAAASUVORK5CYII=';
function coinIc(){return '<img class="dbc" src="'+COINI_SRC+'" alt="doubloons">'}
(function(){const css=document.createElement('style');css.id='w4coincss';css.textContent='.dbc{display:inline-block;width:1.1em;height:1.1em;vertical-align:-.2em;border-radius:50%;margin:0 .04em;box-shadow:0 0 0 1px rgba(0,0,0,.25)}';document.head.appendChild(css)})();
const COINM={p:null,geo:null,mats:null,R:28.25};   // (the mesh is 40 mm across; the tower's coin is 1.13 paces across)
// ---- the model: w4/coin.js beside the page (the base64 GLB the scythe's way), the two parts (faces, edge) merged into one geometry with
// two materials, scaled up, the tower's own environment on the gold
function coinLoad(){if(COINM.p)return COINM.p;const base=window.MS_ASSET_BASE||'',urls=[base+'w4/coin.js',base+'coin.js'];
 const viaFetch=u=>fetch(u).then(r=>{if(!r.ok)throw new Error('http '+r.status);return r.text()}).then(t=>{const i=t.indexOf('"'),j=t.lastIndexOf('"');if(i<0||j<=i+1000)throw new Error('bad coin data');return t.slice(i+1,j)});
 const viaTag=u=>new Promise((res,rej)=>{const s=document.createElement('script');s.src=u;s.async=true;s.onload=()=>window.COIN_GLB?res(window.COIN_GLB):rej(new Error('coin data missing'));s.onerror=()=>rej(new Error('coin could not load'));document.head.appendChild(s)});
 const at=k=>k>=urls.length?Promise.reject(new Error('the coin could not load')):viaFetch(urls[k]).catch(()=>viaTag(urls[k])).catch(()=>at(k+1));
 return COINM.p=(window.COIN_GLB?Promise.resolve(window.COIN_GLB):at(0)).then(b64=>{const raw=atob(b64),u=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)u[i]=raw.charCodeAt(i);return new Promise((res,rej)=>new THREE.GLTFLoader().parse(u.buffer,'',res,rej))})
  .then(gltf=>{const M=coinMerge(gltf.scene);COINM.geo=M.geo;COINM.mats=M.mats;try{coinSwapIn()}catch(e){console.warn('coin swap',e)}return M}).catch(e=>{console.warn('the doubloon model',e);COINM.p=null;throw e})}
function coinMerge(scene){const ms=[];scene.traverse(o=>{if(o.isMesh)ms.push(o)});ms.sort((a,b)=>b.geometry.attributes.position.count-a.geometry.attributes.position.count);
 let nv=0,ni=0;ms.forEach(m=>{nv+=m.geometry.attributes.position.count;ni+=m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count});
 const P=new Float32Array(nv*3),N=new Float32Array(nv*3),U=new Float32Array(nv*2),I=new Uint32Array(ni),g=new THREE.BufferGeometry(),mats=[];let vo=0,io=0;const E=typeof itEnv==='function'?itEnv():null;
 ms.forEach((m,k)=>{const ge=m.geometry,n=ge.attributes.position.count;P.set(ge.attributes.position.array,vo*3);if(ge.attributes.normal)N.set(ge.attributes.normal.array,vo*3);if(ge.attributes.uv)U.set(ge.attributes.uv.array,vo*2);
  const ix=ge.index?ge.index.array:null,cnt=ix?ix.length:n;for(let i=0;i<cnt;i++)I[io+i]=(ix?ix[i]:i)+vo;g.addGroup(io,cnt,k);
  const mt=m.material;mt.side=THREE.FrontSide;mt.metalness=mt.metalnessMap?1:mt.metalness;if(E)mt.envMap=E;mt.envMapIntensity=.9;if(mt.normalMap)mt.normalScale.set(1,-1);mt.needsUpdate=true;mats.push(mt);vo+=n;io+=cnt});
 g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('normal',new THREE.BufferAttribute(N,3));g.setAttribute('uv',new THREE.BufferAttribute(U,2));g.setIndex(new THREE.BufferAttribute(I,1));
 const s=COINM.R;g.scale(s,s,s);g.computeBoundingSphere();g.computeBoundingBox();g.userData.shared=true;return {geo:g,mats}}
// ---- once it is here: the coins already lying on the floor, the ones still to drop, the item library's coin (the codex, the bag's pictures)
function coinSwapIn(){if(!COINM.geo)return;const old=DRG.coin;DRG.coin=COINM.geo;DRG.cm=COINM.mats;DRG.up=1;
 (W4.drops||[]).forEach(d=>{if(d.it!=='coin'||!d.g)return;d.g.traverse(o=>{if(o.isMesh&&(o.geometry===old||o.geometry.type==='CylinderGeometry'||o.geometry.type==='LatheGeometry')){o.geometry=COINM.geo;o.material=COINM.mats}})});
 try{if(typeof ITP!=='undefined')delete ITP.coin}catch(e){}}
(function(){const cm=coinModel;coinModel=function(){if(COINM.geo){const G=new THREE.Group();G.add(new THREE.Mesh(COINM.geo,COINM.mats));return G}return cm.apply(this,arguments)}})();
if(typeof ITV!=='undefined'&&ITV.coin)ITV.coin.mk=function(){return coinModel()};   // (the library captured the old function by value)
try{SK[1].i=coinIc()}catch(e){}   // (the Coin Barrage button)
(function(){const lf=loadFloor;loadFloor=function(){try{coinLoad()}catch(e){}return lf.apply(this,arguments)}})();
// ---- the little coin in the words: a toast with a coin in it, and the floating "+12" over your head with the coin drawn beside it
(function(){const t0=toast;toast=function(msg){if(typeof msg==='string'&&msg.indexOf('🪙')>=0){try{const e=document.getElementById('toast');if(e){e.innerHTML=esc4(msg).replace(/🪙/g,coinIc());e.style.opacity=1;toastT=3;return}}catch(x){}}return t0.apply(this,arguments)}})();
(function(){const f0=floatText,CI=new Image();CI.src=COINI_SRC;const cache=new Map();
 floatText=function(x,y,z,txt,col,size){if(typeof txt!=='string'||txt.indexOf('🪙')<0)return f0.apply(this,arguments);const clean=txt.replace(/\s*🪙\s*/g,' ').trim();if(!(CI.complete&&CI.naturalWidth))return f0.call(this,x,y,z,clean+' doubloons',col,size);
  size=size||2.4;const key=clean+'|'+col;let ct=cache.get(key);
  if(!ct){const F="56px 'Bangers', Impact, sans-serif";const c=document.createElement('canvas'),g=c.getContext('2d');g.font=F;const tw=g.measureText(clean).width,need=tw+28+64;const W=need<=128?128:need<=256?256:512;c.width=W;c.height=96;
   g.font=F;g.textAlign='left';g.textBaseline='alphabetic';const x0=Math.max(4,(W-need)/2+6);g.lineWidth=8;g.strokeStyle='#000';g.strokeText(clean,x0,66);g.fillStyle=col;g.fillText(clean,x0,66);
   g.save();g.shadowColor='rgba(0,0,0,.6)';g.shadowBlur=4;g.drawImage(CI,x0+tw+10,16,56,56);g.restore();
   ct=new THREE.CanvasTexture(c);ct.encoding=THREE.sRGBEncoding;(ct.userData||(ct.userData={})).w=c.width/512;ct.generateMipmaps=false;ct.minFilter=THREE.LinearFilter;if(cache.size>=120){const k0=cache.keys().next().value;cache.get(k0).dispose();cache.delete(k0)}cache.set(key,ct)}
  if(floaters.length>=90){const old=floaters.shift();world.remove(old);old.material.dispose()}
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:ct,transparent:true,depthTest:false}));sp.scale.set(size*2.6*(ct.userData.w||1),size*.5,1);sp.position.set(x,y,z);sp.userData.t=0;world.add(sp);floaters.push(sp)}})();
// ---------------------------------------------------------------- THE CONTROLS, ALWAYS ON SCREEN (the owner, Oct 21 13:52: "make sure you show
// the key control for keyboard and controller and mouse"; "You should never be on a screen and wonder, oh, how do I get past this? Is it A?
// Is it right click? Is it space? It should always tell me, and it should be designed very nice"). Every prompt in the tower, every panel's
// footer and the ride's own panel show the keyboard key (a key cap), the controller button (its own colour and shape) and the mouse (the
// button lit on a little mouse). The keys come from your own bindings, so a rebind shows; whatever you touched last comes first; and a prompt
// can be clicked or tapped as well.
const CTLC={A:'#3fbf3f',B:'#e04848',X:'#3a7be0',Y:'#f0c020'};
function ctlPadSvg(i){const n=i==='dp'?'D-pad':(typeof PADN!=='undefined'&&PADN[i])||('Button '+i),W=(w,body)=>'<svg class="pg" viewBox="0 0 '+w+' 24" width="'+w+'" height="24" aria-label="'+n+'">'+body+'</svg>';
 if(i<=3){const L='ABXY'[i],c=CTLC[L];return W(24,'<circle cx="12" cy="12" r="10.6" fill="#141414" stroke="'+c+'" stroke-width="1.8"/><circle cx="12" cy="12" r="8" fill="'+c+'" opacity=".16"/><text x="12" y="16.3" text-anchor="middle" font-size="12.5" font-weight="900" fill="'+c+'" font-family="system-ui">'+L+'</text>')}
 if(i===4||i===5)return W(34,'<rect x="1.5" y="5" width="31" height="14" rx="7" fill="#141414" stroke="#cfcfcf" stroke-width="1.4"/><text x="17" y="16" text-anchor="middle" font-size="10" font-weight="900" fill="#eee" font-family="system-ui">'+(i===4?'LB':'RB')+'</text>');
 if(i===6||i===7)return W(28,'<path d="M5 21V9a9 9 0 0 1 18 0v12z" fill="#141414" stroke="#cfcfcf" stroke-width="1.4"/><text x="14" y="18" text-anchor="middle" font-size="9.5" font-weight="900" fill="#eee" font-family="system-ui">'+(i===6?'LT':'RT')+'</text>');
 if(i===8||i===9)return W(30,'<rect x="2" y="6" width="26" height="12" rx="6" fill="#141414" stroke="#cfcfcf" stroke-width="1.3"/><text x="15" y="15.6" text-anchor="middle" font-size="8.5" font-weight="900" fill="#eee" font-family="system-ui">'+(i===8?'VIEW':'MENU')+'</text>');
 if(i===10||i===11)return W(24,'<circle cx="12" cy="12" r="10.4" fill="#141414" stroke="#cfcfcf" stroke-width="1.4"/><text x="12" y="15.8" text-anchor="middle" font-size="10" font-weight="900" fill="#eee" font-family="system-ui">'+(i===10?'LS':'RS')+'</text>');
 if(i==='dp'||(i>=12&&i<=15)){const on=i==='dp'?-1:i-12;const arm=(k,d)=>'<path d="'+d+'" fill="'+(on<0||k===on?'#ffd040':'#2a2a2a')+'" stroke="#cfcfcf" stroke-width="1.1"/>';return W(24,arm(0,'M9 2h6v7l-3 3-3-3z')+arm(1,'M9 22h6v-7l-3-3-3 3z')+arm(2,'M2 9v6h7l3-3-3-3z')+arm(3,'M22 9v6h-7l-3-3 3-3z'))}
 return '<kbd class="kc">'+n+'</kbd>'}
// a stick: which one, and an arrow (or the four) for the way to push it
function ctlStickSvg(s,dir){const ar={u:'M12 3l4 5h-8z',d:'M12 21l4-5h-8z',l:'M3 12l5-4v8z',r:'M21 12l-5-4v8z',ul:'M5 5l6 1-5 5z',ur:'M19 5l-6 1 5 5z',dl:'M5 19l6-1-5-5z',dr:'M19 19l-6-1 5-5z'};const ds=dir==='all'?['u','d','l','r']:[dir];
 return '<svg class="pg" viewBox="0 0 24 24" width="24" height="24" aria-label="'+(s==='L'?'Left':'Right')+' stick"><circle cx="12" cy="12" r="10.4" fill="#141414" stroke="#cfcfcf" stroke-width="1.4"/><circle cx="12" cy="12" r="4.2" fill="#3a3a3a"/>'+ds.map(d=>'<path d="'+ar[d]+'" fill="#ffd040"/>').join('')+'<text x="12" y="14.6" text-anchor="middle" font-size="6.5" font-weight="900" fill="#ddd" font-family="system-ui">'+s+'</text></svg>'}
function ctlMouseSvg(b){if(b==='hover')return '<svg class="pg" viewBox="0 0 30 24" width="30" height="24" aria-label="Point at it"><path d="M9 1.5C4.8 1.5 2 4.6 2 8.5v7C2 19.6 5 22.5 9 22.5s7-2.9 7-7v-7C16 4.6 13.2 1.5 9 1.5z" fill="#141414" stroke="#cfcfcf" stroke-width="1.3"/><path d="M9 2.2V10" stroke="#5a5a5a" stroke-width=".9"/><path d="M19 5l9 7.2-4.1.5 2.4 4.6-1.9 1-2.4-4.6-3 2.8z" fill="#ffd040" stroke="#141414" stroke-width=".9" stroke-linejoin="round"/></svg>';
 const f=k=>k===b?'#ffd040':'#2a2a2a';return '<svg class="pg" viewBox="0 0 18 24" width="18" height="24" aria-label="'+((typeof MOUSEN!=='undefined'&&MOUSEN[b])||'Click')+'"><path d="M9 1.5C4.8 1.5 2 4.6 2 8.5v7C2 19.6 5 22.5 9 22.5s7-2.9 7-7v-7C16 4.6 13.2 1.5 9 1.5z" fill="#141414" stroke="#cfcfcf" stroke-width="1.3"/>'+
 '<path d="M9 2.2C5.4 2.2 2.8 4.9 2.8 8.6V10H8.4V2.2z" fill="'+f(0)+'"/><path d="M9.6 2.2V10h5.6V8.6c0-3.7-2.6-6.4-5.6-6.4z" fill="'+f(2)+'"/><rect x="8.1" y="4" width="1.8" height="4" rx=".9" fill="'+f(1)+'" stroke="#cfcfcf" stroke-width=".6"/></svg>'}
const kcap=s=>'<kbd class="kc">'+esc4(s)+'</kbd>';
// what an action is bound to: [keyboard label, controller button, mouse button]
function ctlOf(a){const b=(typeof BINDS!=='undefined'&&BINDS[a])||[];let kb=null,pad=null,ms=null;b.forEach(c=>{if(!c)return;if(c[0]==='k'&&kb==null)kb=bindName(c);else if(c[0]==='m'&&ms==null)ms=+c.slice(2);else if(c[0]==='p'&&pad==null)pad=+c.slice(2)});return {kb,pad,ms}}
// one row of controls: items like {a:'attack'} (from your bindings) or {kb:'Q',pad:4,ms:0,stick:['R','ul']}; the device you used last comes first
function ctlKeys(it){const o=it.a?ctlOf(it.a):{};const kb=it.kb!==undefined?it.kb:o.kb,pad=it.pad!==undefined?it.pad:o.pad,ms=it.ms!==undefined?it.ms:o.ms;
 const K=kb?(Array.isArray(kb)?kb.map(kcap).join(''):kcap(kb)):'',P=it.padHtml?it.padHtml:it.stick?(it.pad!=null?ctlPadSvg(pad)+'<i class="pl">+</i>':'')+ctlStickSvg(it.stick[0],it.stick[1]):pad!=null?ctlPadSvg(pad):'',M=ms!=null?ctlMouseSvg(ms):(it.click?ctlMouseSvg(0):'');
 const g=[];const pad1=typeof PADLAST!=='undefined'&&PADLAST;if(pad1){if(P)g.push(P);if(K)g.push(K);if(M)g.push(M)}else{if(K)g.push(K);if(M)g.push(M);if(P)g.push(P)}return '<span class="ck">'+g.join('<i class="sl">/</i>')+'</span>'}
function ctlRow(items){return '<div class="crow">'+items.map(it=>'<span class="ci">'+ctlKeys(it)+'<b>'+esc4(it.t)+'</b></span>').join('')+'</div>'}
// ---- the prompt: what you can do right here, with all three ways to do it; click it (or tap it) to do it
const CTLP={last:''};
function ctlPrompt(label,items){const pr=$('w4prompt');if(!pr)return;if(!label){pr.style.display='none';CTLP.last='';return}
 const key=label+'|'+(typeof PADLAST!=='undefined'&&PADLAST?1:0)+'|'+JSON.stringify(items||'');if(CTLP.last!==key){CTLP.last=key;pr.innerHTML=ctlKeys(Object.assign({a:'door',kb:ctlOf('openDoor').kb,click:1},items&&items[0]||{}))+'<b class="pt">'+esc4(label)+'</b>'+(items&&items.length>1?items.slice(1).map(it=>'<span class="pe">'+ctlKeys(it)+'<em>'+esc4(it.t)+'</em></span>').join(''):'')}
 pr.style.display='flex'}
(function(){const pr=()=>$('w4prompt');const hook=()=>{const p=pr();if(!p||p.dataset.ctl)return;p.dataset.ctl=1;p.style.pointerEvents='auto';p.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();try{W4.interact()}catch(_){}})};
 const iv=setInterval(()=>{if(pr()){hook();clearInterval(iv)}},500)})();
// ---- the panels' footers: how to choose, how to close (and Escape closes any tower panel)
function ctlFoot(items){return '<div class="cfoot">'+ctlRow(items)+'</div>'}
addEventListener('keydown',e=>{if(!W4.on||e.key!=='Escape')return;let used=true;if(W4.dial)dialClose();else if(W4.talk){W4.talk=null;talkShow()}else if(W4.shopOpen)shopClose();else if(W4.bagOpen)bagToggle(false);else if(typeof JR!=='undefined'&&JR.open)journalToggle(false);else used=false;if(used){e.preventDefault();e.stopImmediatePropagation()}},true);
(function(){const st=document.createElement('style');st.textContent=
 '#w4prompt{display:none;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;pointer-events:auto;cursor:pointer;padding:7px 14px 7px 10px;border-radius:14px;background:linear-gradient(rgba(36,22,10,.92),rgba(16,9,4,.92));border:1px solid rgba(217,164,37,.85);box-shadow:0 6px 22px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,220,140,.18);max-width:min(560px,92vw)}'+
 '#w4prompt:hover{border-color:#ffd040}#w4prompt .pt{font:800 15px system-ui;color:#ffe6a0;letter-spacing:.01em}#w4prompt .pe{display:inline-flex;align-items:center;gap:6px;padding-left:10px;border-left:1px solid rgba(217,164,37,.35)}#w4prompt .pe em{font:700 12.5px system-ui;color:#cdb898;font-style:normal}'+
 '.ck{display:inline-flex;align-items:center;gap:4px}.ck .sl{font-style:normal;color:#8a765e;font:700 12px system-ui;margin:0 1px}.ck .pl{font-style:normal;color:#cdb898;font:800 11px system-ui}'+
 'kbd.kc{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:24px;padding:0 6px;box-sizing:border-box;border-radius:6px;background:linear-gradient(#f4ead6,#cdbb98);color:#2a1a0a;font:900 12.5px system-ui;border:1px solid #6a5636;box-shadow:0 2px 0 #6a5636,inset 0 1px 0 #fff8e8;margin-bottom:2px}'+
 'svg.pg{display:inline-block;vertical-align:middle;filter:drop-shadow(0 1px 1px rgba(0,0,0,.5))}'+
 '.crow{display:flex;flex-wrap:wrap;gap:6px 16px;align-items:center;justify-content:center}.crow .ci{display:inline-flex;align-items:center;gap:6px}.crow .ci b{font:700 12.5px system-ui;color:#e8d8bc}'+
 '.cfoot{border-top:1px solid rgba(217,164,37,.25);padding:8px 12px;background:rgba(0,0,0,.18)}';document.head.appendChild(st)})();
// ---- every tower panel says, at its foot, what moves, chooses and closes on each device. A controller works them all (the D-pad or the left
// stick moves the gold ring, A presses, B backs out: the game's own menu rules); the keyboard closes them with Esc; the mouse clicks
const CTL_MOVE=()=>ctlPadSvg('dp')+'<i class="sl">/</i>'+ctlStickSvg('L','all');
// a panel draws itself afresh after every press; the controller's gold ring stays on the same button (or on your bag slot) instead of
// jumping back to the first one
const ctlSig=b=>b.tagName+'|'+[...b.attributes].filter(a=>a.name.startsWith('data-')).map(a=>a.name+'='+a.value).join('&');
function pmKeep(id,fn){const el0=$(id);const had=typeof PM!=='undefined'&&PM.el&&el0&&el0.contains(PM.el)?ctlSig(PM.el):null;const r=fn();
 if(had)try{const el=$(id),L=pmItems(el);const m=L.find(b=>ctlSig(b)===had)||(id==='w4bag'?L.find(b=>b.dataset.s===String(W4.bagSel|0)):null)||L[0]||null;PM.el=null;pmFocus(m)}catch(e){}return r}
function ctlPanelFoot(el,items){if(!el)return;const box=el.querySelector('.w4box')||el;const old=box.querySelector(':scope>.cfoot');if(old)old.remove();box.insertAdjacentHTML('beforeend',ctlFoot(items))}
(function(){const ts=talkShow;talkShow=function(){const A=arguments;return pmKeep('w4talk',()=>{const r=ts.apply(this,A);try{const T=W4.talk,el=$('w4talk');if(T&&el&&el.style.display!=='none'){const L=T.L||T.N.lines,last=T.i>=L.length-1,many=el.querySelectorAll('.w4b button').length>1;
  ctlPanelFoot(el,many?[{padHtml:CTL_MOVE(),t:'Move'},{pad:0,ms:0,t:'Choose'},{kb:'Esc',pad:1,t:'Close'}]:[{kb:ctlOf('openDoor').kb,pad:0,ms:0,t:last?'Done':'Next'},{kb:'Esc',pad:1,t:'Close'}])}}catch(e){console.warn('talk foot',e)}return r})}})();
(function(){const sr=shopRender;shopRender=function(){const A=arguments;return pmKeep('w4shop',()=>{const r=sr.apply(this,A);try{const el=$('w4shop');if(el){const f=el.querySelector('.w4f');if(f)for(const n of [...f.childNodes])if(n.nodeType===3&&/Walk away/.test(n.textContent))n.textContent=n.textContent.replace(/Walk away or press F to close · your bag: I · /,'');
  ctlPanelFoot(el,[{padHtml:CTL_MOVE(),ms:'hover',t:'Look'},{pad:0,ms:0,t:'Buy'},{kb:['Esc',ctlOf('openDoor').kb],pad:1,t:'Close'},{kb:ctlOf('inventory').kb,t:'Bag'}])}}catch(e){console.warn('shop foot',e)}return r})}})();
(function(){const br=bagRender;bagRender=function(){const A=arguments;return pmKeep('w4bag',()=>{const r=br.apply(this,A);try{const el=$('w4bag');if(el)ctlPanelFoot(el,[{padHtml:CTL_MOVE(),ms:'hover',t:'Look'},{pad:0,ms:0,t:'Pick · use'},{kb:['Esc',ctlOf('inventory').kb],pad:1,t:'Close'}])}catch(e){console.warn('bag foot',e)}return r})}})();
(function(){const ds=dialShow;dialShow=function(){const A=arguments;return pmKeep('w4dial',()=>{const r=ds.apply(this,A);try{const el=$('w4dial');if(W4.dial&&el)ctlPanelFoot(el,[{kb:['←','→'],padHtml:CTL_MOVE(),t:'Pick a dial'},{kb:['↑','↓'],pad:0,ms:0,t:'Turn'},{kb:'Enter',t:'Try it'},{kb:'Esc',pad:1,t:'Close'}])}catch(e){console.warn('dial foot',e)}return r})}})();
// a controller's gold ring on a bag slot or a shop row shows that thing's card, the same card the mouse gets by pointing
(function(){if(typeof pmFocus!=='function')return;const pf=pmFocus;pmFocus=function(e){const r=pf.apply(this,arguments);try{if(!W4.on)return r;const b=e&&e.closest&&e.closest('#w4bag .w4s[data-s],#w4shop .w4r');
  if(!b){if(CTLP.tip){CTLP.tip=0;tipHide()}return r}const rc=b.getBoundingClientRect();let q=null;if(b.matches('.w4s'))q=W4.bag[+b.dataset.s];else{const bt=b.querySelector('[data-i]'),S0=bt&&SHOP[+bt.dataset.i];if(S0&&S0.it)q={it:S0.it,n:1}}
  if(q){CTLP.tip=1;tipShow(q.it,q.n,itEq(q),rc.right+10,rc.top)}else if(CTLP.tip){CTLP.tip=0;tipHide()}}catch(x){}return r}})();
// leaving the tower: back to the swamp (a fresh start of the page, like World 3's "back to the swamp")
W4.leave=function(){saveNow();location.reload()};
// for the tests (and for poking around in the console)
W4.dbg={bagToggle,bagRender,bagPut,bagUse,bagDrop,equipW,shopOpen,shopClose,shopRender,skill,dropAdd,genFloor,towerH,loadFloor,saveLoad,IT,SHOP,loadTop,vaultBuy,skinOn,SPECIAL,specialOf,JK,ZS,NG,NGA,nagStart,nagLoad,zsLoad,jkLoad,npcMake,putBomb,bombsHit,inArea,nagArea,bombBossTick,skinsTick,nagTick,AL,swingShow,whoosh,smokeFx,swipeFx,burstFx,ringFx2,SW,bagPut,bagCount,peteApply,petePushPose,peteTick,peteRoveInit,BG,BGA,bigTick,bigStart,bigGuard,questGen,questTalk,questDrops,questText,QIT,mazeOf,talkShow,talkOpen,talkNext,dropsTick,chestNear,chestOpen,RAR,lootRoll,lootGive,doorNear,doorOpen,dialOpen,dialTurn,dialTry,dialClose,PZ,lanternNear,lanternTouch,pzNear,pzTouch,bustTurn,brazLight,pzRestore,RIDE,rideOn,rideOff,rideHips,rideNear,F_RACE,wideOf,wideFloor,itemModel,itemIcon,itIconMake,itemCard,itStats,sellPrice,bagSell,atMarket,ITV,ITP,ICO,itWarm,tipShow,tipHide,colSpots,colMask,colBuild,stashToggle,stashRender,stashKind,STASH,COL,RIDES,drumModel,ctlPrompt,ctlOf,pmKeep,bigOf,bigFloor,bigPlan,bigRows,JOBS,BIGNAME,backOpen,doorOpen,puzzleTick,saveHas,saveMark,pzKeepOut,MKINDS,MELEE,MBEST,SELL,MSEED,melonModel,GROOVE,grooveTick,beltModel,skilletModel,hotcombModel,bigFlTick,jobArea,bigKeySpot,keyWhere,stWMFC,COINM,coinLoad,coinIc,coinModel};
})();
