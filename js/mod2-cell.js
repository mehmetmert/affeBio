/* ============================================================================
   affeBio — MODÜL 2: Hücre Galerisi (7 Hücre Tipi)
   İki görünüm:
   1) GERÇEKÇİ MODEL — gerçek 3B GLB modelleri (bitki, akyuvar, epitel, nöron,
      Gram (+) bakteri duvarı). Organeller modelin üzerindeki tıklanabilir
      işaretçilerle (pin) seçilir. Dokusuz NIH modelleri GPU'da gradyanla
      renklendirilir. Kaynak/lisans: js/cell-data.js "credit" alanları.
   2) ŞEMATİK MOD — bu projeye özgü yordamsal geometri: ders kitabı tarzı
      kesitli hayvan hücresi, kristalı mitokondri, granalı kloroplast, Golgi
      yığını, ER tabakaları, sentriyol, çizgili miyofibril... Her organel
      doğrudan tıklanabilir; "Makromoleküler Kalabalık" modu da buradadır.
   Not: KHR_mesh_quantization ile sıkıştırılmış GLB'lerde r128 CPU tarafında
   konumları de-normalize etmez — bu yüzden model yüzeyine raycast yapılmaz,
   yalnızca pin'lere yapılır.
   ============================================================================ */
(function () {
  'use strict';

  const { CELLS } = window.CellData;
  const { createViewer3D } = window.BioCore;
  const $ = (id) => document.getElementById(id);

  const MODEL_SIZE = 5;
  const state = {
    cellId: 'plant',
    view: 'real',
    crowding: false,
    hiddenKeys: new Set(),
    activeOrganelle: null
  };

  let viewer3d = null;
  let hotspots = [];
  let organelleMats = new Map();
  let realActive = null;
  let buildToken = 0;
  let raycaster, pointerNDC;
  const realCache = new Map();

  const VIEW_DIST = { plant: 9.5, animal: 8.5, whiteBlood: 8.5, epithelial: 7, bacteria: 7.5, neuron: 9.5, muscle: 10.5 };
  // Açık/kesik yüzü kameraya bakacak başlangıç açıları [rotX, rotY].
  const SCHEMA_VIEW = {
    plant: [0.25, -0.35], animal: [0.3, -Math.PI / 4], whiteBlood: [0.3, -Math.PI / 4],
    epithelial: [0.3, -0.6], bacteria: [0.3, -0.35], neuron: [0.2, -0.25], muscle: [0.35, -0.45]
  };
  // Pin koordinatları bu açıdan bakılarak seçildi (kamera açısı a → rotY = -a, yükseklik e → rotX = e).
  const REAL_VIEW = { plant: [0.3, -0.6], whiteBlood: [0.3, -0.6], epithelial: [0.3, -0.6], bacteria: [0.3, -0.6], neuron: [0, 0] };
  const CROWD_EXTENTS = {
    plant: [2.3, 1.7, 1.3], animal: [2.4, 2.4, 2.4], whiteBlood: [2.2, 2.2, 2.2],
    epithelial: [0.85, 1.2, 0.85], bacteria: [1.5, 0.5, 0.5], neuron: [0.8, 0.8, 0.8], muscle: [2.7, 0.66, 0.66]
  };

  /* --------------------------------------------------------------------------
     GENEL YARDIMCILAR
     -------------------------------------------------------------------------- */
  function V(x, y, z) { return new THREE.Vector3(x, y, z); }
  function mk(geo, mat, pos) {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.set(pos.x !== undefined ? pos.x : pos[0], pos.y !== undefined ? pos.y : pos[1], pos.z !== undefined ? pos.z : pos[2]);
    return m;
  }
  function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function tint(color, toward, k) { return new THREE.Color(color).lerp(new THREE.Color(toward), k); }
  function stdMat(color, extra) {
    return new THREE.MeshStandardMaterial(Object.assign({
      color: new THREE.Color(color), roughness: 0.48, metalness: 0.04,
      emissive: new THREE.Color(color), emissiveIntensity: 0.08
    }, extra || {}));
  }
  // İki nokta arasına hizalanmış konik silindir (quaternion ile; Object.assign KULLANILMAZ).
  function limb(a, b, r0, r1, mat, seg) {
    const dir = b.clone().sub(a);
    const len = Math.max(0.0001, dir.length());
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, seg || 8, 1, false), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
    return m;
  }
  // r128'de CapsuleGeometry yok: açık silindir + iki yarımküre (Y ekseni boyunca).
  function capsule(len, r, mat, seg) {
    const s = seg || 14;
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, s, 1, true), mat));
    const top = new THREE.Mesh(new THREE.SphereGeometry(r, s, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    top.position.y = len / 2;
    const bot = new THREE.Mesh(new THREE.SphereGeometry(r, s, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat);
    bot.position.y = -len / 2;
    g.add(top, bot);
    return g;
  }
  function displace(geo, amp, freq, seed) {
    const p = geo.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = (Math.sin(x * freq + seed) + Math.sin(y * freq * 1.3 + seed * 2) + Math.sin(z * freq * 0.9 + seed * 3)) / 3;
      const k = 1 + amp * n;
      p.setXYZ(i, x * k, y * k, z * k);
    }
    geo.computeVertexNormals();
    return geo;
  }
  // Ön-sağ çeyreği (x>0, z>0) kesilmiş küre + iki yarım disk kesit yüzü.
  function cutawaySphere(R, shellMat, faceMat, innerMat, seg, bump) {
    const g = new THREE.Group();
    const sg = seg || 48;
    const shellGeo = new THREE.SphereGeometry(R, sg, Math.round(sg * 0.7), Math.PI, Math.PI * 1.5);
    if (bump) displace(shellGeo, bump.amp, bump.freq, bump.seed);
    g.add(new THREE.Mesh(shellGeo, shellMat));
    if (innerMat) {
      const innerGeo = new THREE.SphereGeometry(R * 0.965, sg, Math.round(sg * 0.7), Math.PI, Math.PI * 1.5);
      g.add(new THREE.Mesh(innerGeo, innerMat));
    }
    const faceR = R * (innerMat ? 0.965 : 0.995);
    const faceB = new THREE.Mesh(new THREE.CircleGeometry(faceR, sg, -Math.PI / 2, Math.PI), faceMat);
    const faceA = new THREE.Mesh(new THREE.CircleGeometry(faceR, sg, -Math.PI / 2, Math.PI), faceMat);
    faceA.rotation.y = -Math.PI / 2;
    g.add(faceA, faceB);
    return g;
  }
  // Kesit yüzlerinden birine (A: x≈0, B: z≈0) yarı gömülü rastgele bir konum.
  function planeSpot(rand, rMin, rMax, avoid, minGap) {
    for (let tries = 0; tries < 60; tries++) {
      const rho = rMin + rand() * (rMax - rMin);
      const a = (rand() - 0.5) * 2.3;
      const depth = 0.04 + rand() * 0.14;
      const p = rand() < 0.5
        ? V(depth, Math.sin(a) * rho, Math.cos(a) * rho)
        : V(Math.cos(a) * rho, Math.sin(a) * rho, depth);
      if (!avoid || avoid.every((o) => p.distanceTo(o.c) > o.r + (minGap || 0.15))) return p;
    }
    return V(0.1, rMax * 0.5, rMax * 0.5);
  }

  /* --------------------------------------------------------------------------
     ORGANEL ŞEKİL FABRİKALARI
     -------------------------------------------------------------------------- */
  function makeMito(len, r, color) {
    const g = new THREE.Group();
    g.add(capsule(len, r, stdMat(color, { transparent: true, opacity: 0.6, depthWrite: false })));
    const inner = stdMat(tint(color, '#fff3dc', 0.45));
    const n = Math.max(3, Math.round(len / (r * 0.85)));
    for (let i = 0; i < n; i++) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(r * 1.45, r * 0.13, r * 0.95), inner);
      plate.position.y = -len / 2 + (i + 0.5) * (len / n);
      plate.rotation.z = i % 2 ? 0.38 : -0.38;
      g.add(plate);
    }
    return g;
  }

  function makeChloroplast(len, r, color) {
    const g = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.SphereGeometry(1, 26, 18), stdMat(color, { transparent: true, opacity: 0.58, depthWrite: false }));
    outer.scale.set(len / 2, r, r * 1.15);
    g.add(outer);
    const granaMat = stdMat(tint(color, '#123d12', 0.45));
    for (let s = 0; s < 4; s++) {
      const x = (-0.6 + s * 0.4) * (len / 2);
      for (let d = 0; d < 4; d++) {
        const disc = mk(new THREE.CylinderGeometry(r * 0.4, r * 0.4, r * 0.11, 14), granaMat, V(x, -r * 0.3 + d * r * 0.2, 0));
        g.add(disc);
      }
    }
    const lam = mk(new THREE.BoxGeometry(len * 0.62, r * 0.05, r * 0.5), granaMat, V(0, 0, 0));
    g.add(lam);
    return g;
  }

  function makeGolgi(size, color) {
    const g = new THREE.Group();
    const mat = stdMat(color, { side: THREE.DoubleSide });
    const stack = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const R = size * (1.25 + i * 0.16);
      const geo = new THREE.SphereGeometry(R, 30, 6, -0.8 + i * 0.04, 1.6 - i * 0.08, Math.PI / 2 - 0.3, 0.6);
      stack.add(new THREE.Mesh(geo, mat));
    }
    stack.position.x = size * 1.55;
    g.add(stack);
    const vesMat = stdMat(tint(color, '#ffffff', 0.3));
    for (let i = 0; i < 6; i++) {
      const a = -0.95 + (i % 2) * 1.9 + (i < 2 ? 0 : (i < 4 ? 0.12 : -0.12)) * (i % 2 ? -1 : 1);
      const R = size * (1.3 + (i % 3) * 0.25);
      g.add(mk(new THREE.SphereGeometry(size * 0.13, 10, 8), vesMat, V(-Math.cos(a) * R + size * 1.55, (i % 3 - 1) * size * 0.25, Math.sin(a) * R)));
    }
    return g;
  }

  function makeER(nucR, color, rand) {
    const g = new THREE.Group();
    const mat = stdMat(color, { side: THREE.DoubleSide, transparent: true, opacity: 0.8, depthWrite: false });
    const riboMat = stdMat('#3fe0b0', { emissiveIntensity: 0.3 });
    for (let i = 0; i < 4; i++) {
      const rad = nucR + 0.22 + i * 0.17;
      const h = 1.5 - i * 0.18;
      const t0 = -0.2, tl = 0.62;
      const sheet = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, h, 40, 1, true, t0, tl), mat);
      sheet.position.y = (i % 2 ? 0.08 : -0.06);
      g.add(sheet);
      for (let k = 0; k < 9; k++) {
        const th = t0 + rand() * tl;
        const y = (rand() - 0.5) * h * 0.9 + sheet.position.y;
        g.add(mk(new THREE.SphereGeometry(0.03, 6, 5), riboMat, V(Math.sin(th) * (rad + 0.04), y, Math.cos(th) * (rad + 0.04))));
      }
    }
    return g;
  }

  function makeNucleus(r, color, rand, opts) {
    const o = opts || {};
    const g = new THREE.Group();
    const envMat = stdMat(color, { side: THREE.DoubleSide });
    const faceMat = stdMat(tint(color, '#ffffff', 0.55), { side: THREE.DoubleSide, emissiveIntensity: 0.04 });
    if (o.cut) {
      g.add(cutawaySphere(r, envMat, faceMat, null, 36));
      const nucleolus = mk(new THREE.SphereGeometry(r * 0.36, 20, 14), stdMat(tint(color, '#1c0b33', 0.5)), V(r * 0.08, r * 0.12, r * 0.08));
      g.add(nucleolus);
      const chromMat = stdMat(tint(color, '#2a1250', 0.35));
      for (let i = 0; i < 18; i++) {
        const p = planeSpot(rand, r * 0.45, r * 0.9);
        g.add(mk(new THREE.SphereGeometry(r * 0.05, 6, 5), chromMat, p.multiplyScalar(0.92)));
      }
    } else {
      g.add(mk(new THREE.SphereGeometry(r, 28, 20), envMat));
    }
    const poreMat = stdMat(tint(color, '#ffffff', 0.35));
    for (let i = 0; i < 16; i++) {
      const phi = Math.PI * (1.05 + rand() * 1.4);
      const el = (rand() - 0.5) * 2.4;
      const dir = V(-Math.cos(phi) * Math.cos(el), Math.sin(el), Math.sin(phi) * Math.cos(el));
      const pore = mk(new THREE.TorusGeometry(r * 0.06, r * 0.018, 6, 12), poreMat, dir.clone().multiplyScalar(r * 1.005));
      pore.lookAt(dir.clone().multiplyScalar(r * 2));
      g.add(pore);
    }
    return g;
  }

  function makeCentriole(s, color) {
    const g = new THREE.Group();
    const mat = stdMat(color, { emissiveIntensity: 0.15 });
    function barrel() {
      const b = new THREE.Group();
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        b.add(mk(new THREE.CylinderGeometry(s * 0.11, s * 0.11, s * 1.6, 6), mat, V(Math.cos(a) * s * 0.5, 0, Math.sin(a) * s * 0.5)));
      }
      return b;
    }
    const b1 = barrel();
    const b2 = barrel();
    b2.rotation.z = Math.PI / 2;
    b2.position.set(s * 1.35, s * 0.5, 0);
    g.add(b1, b2);
    return g;
  }

  function makeBlob(r, color, opts, seed) {
    const geo = displace(new THREE.SphereGeometry(r, 36, 24), 0.09, 2.6, seed || 1);
    return new THREE.Mesh(geo, stdMat(color, opts));
  }

  /* --------------------------------------------------------------------------
     ORGANEL KAYDI (tıklama + vurgulama)
     -------------------------------------------------------------------------- */
  function register(obj, o) {
    obj.traverse((child) => {
      if (!child.isMesh) return;
      child.userData.organelle = o;
      hotspots.push({ mesh: child, organelle: o });
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => {
        if (!m || m.emissiveIntensity === undefined) return;
        if (m.userData.baseEmissive === undefined) m.userData.baseEmissive = m.emissiveIntensity;
        if (!organelleMats.has(o.key)) organelleMats.set(o.key, new Set());
        organelleMats.get(o.key).add(m);
      });
    });
    return obj;
  }
  function cellDef() { return CELLS.find((c) => c.id === state.cellId) || CELLS[0]; }
  function org(key) { return cellDef().organelles.find((x) => x.key === key); }
  function shown(key) { const o = org(key); return o && !o.realOnly && !state.hiddenKeys.has(key); }

  /* --------------------------------------------------------------------------
     ŞEMATİK HÜCRE İNŞACILARI
     -------------------------------------------------------------------------- */
  function buildAnimalCell(def, root, rand) {
    const R = 2.6;
    root.add(cutawaySphere(R,
      new THREE.MeshStandardMaterial({ color: '#e7b3c9', roughness: 0.55 }),
      new THREE.MeshStandardMaterial({ color: '#f5dde8', roughness: 0.9, side: THREE.DoubleSide }),
      new THREE.MeshStandardMaterial({ color: '#f9e6ee', roughness: 0.8, side: THREE.BackSide }), 56));

    const nucC = V(0.05, 0.12, 0.05), nucR = 0.95;
    const avoid = [{ c: nucC, r: nucR + 0.35 }];
    if (shown('nucleus')) root.add(register(Object.assign(makeNucleus(nucR, org('nucleus').color, rand, { cut: true }), {}), org('nucleus')).translateX(nucC.x).translateY(nucC.y).translateZ(nucC.z));
    if (shown('er')) {
      const er = register(makeER(nucR, org('er').color, rand), org('er'));
      er.position.copy(nucC);
      root.add(er);
    }
    if (shown('golgi')) {
      const gp = V(1.35, 1.05, 0.12);
      const golgi = register(makeGolgi(0.46, org('golgi').color), org('golgi'));
      golgi.position.copy(gp);
      golgi.rotation.set(0.2, 0.9, 0.3);
      root.add(golgi);
      avoid.push({ c: gp, r: 0.75 });
    }
    if (shown('centriole')) {
      const cp = V(1.45, -0.55, 0.12);
      const cen = register(makeCentriole(0.22, org('centriole').color), org('centriole'));
      cen.position.copy(cp);
      cen.rotation.set(0.4, 0.3, 0.2);
      root.add(cen);
      avoid.push({ c: cp, r: 0.45 });
    }
    if (shown('mito')) {
      const o = org('mito');
      for (let i = 0; i < o.count; i++) {
        const p = planeSpot(rand, 1.8, 2.1, avoid, 0.08);
        const m = register(makeMito(0.5, 0.17, o.color), o);
        m.position.copy(p);
        m.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
        root.add(m);
        avoid.push({ c: p, r: 0.38 });
      }
    }
    if (shown('lysosome')) {
      const o = org('lysosome');
      for (let i = 0; i < o.count; i++) {
        const p = planeSpot(rand, 1.75, 2.3, avoid, 0.05);
        root.add(register(mk(new THREE.SphereGeometry(o.r, 14, 10), stdMat(o.color)), o).translateX(p.x).translateY(p.y).translateZ(p.z));
        avoid.push({ c: p, r: o.r });
      }
    }
    if (shown('ribosome')) {
      const o = org('ribosome');
      const mat = stdMat(o.color, { emissiveIntensity: 0.3 });
      for (let i = 0; i < o.count; i++) {
        const p = planeSpot(rand, 1.15, 2.4, avoid, 0.02);
        root.add(register(mk(new THREE.SphereGeometry(o.r, 6, 5), mat, p), o));
      }
    }
  }

  function buildWhiteBloodCell(def, root, rand) {
    const R = 2.35;
    const membraneMat = new THREE.MeshStandardMaterial({ color: '#e8ecf6', roughness: 0.6 });
    root.add(cutawaySphere(R, membraneMat,
      new THREE.MeshStandardMaterial({ color: '#dfe5f3', roughness: 0.9, side: THREE.DoubleSide }),
      new THREE.MeshStandardMaterial({ color: '#f3f5fb', roughness: 0.8, side: THREE.BackSide }), 56, { amp: 0.045, freq: 5.5, seed: 2 }));

    const avoid = [];
    if (shown('nucleus')) {
      const o = org('nucleus');
      const mat = stdMat(o.color);
      const lobes = [V(0.12, 0.85, 0.75), V(0.12, 0.05, 1.25), V(0.75, -0.55, 0.12), V(1.3, 0.25, 0.12)];
      const g = new THREE.Group();
      lobes.forEach((p, i) => {
        g.add(mk(new THREE.SphereGeometry(0.48 - (i % 2) * 0.05, 22, 16), mat, p));
        if (i > 0) g.add(limb(lobes[i - 1], p, 0.14, 0.14, mat, 10));
        avoid.push({ c: p, r: 0.5 });
      });
      root.add(register(g, o));
    }
    [['granule', 0.02], ['lysosome', 0.05]].forEach(([key, gap]) => {
      if (!shown(key)) return;
      const o = org(key);
      const mat = stdMat(o.color, { emissiveIntensity: 0.18 });
      for (let i = 0; i < o.count; i++) {
        const p = planeSpot(rand, 0.4, 2.0, avoid, gap);
        root.add(register(mk(new THREE.SphereGeometry(o.r, 10, 8), mat, p), o));
      }
    });
    if (shown('mito')) {
      const o = org('mito');
      for (let i = 0; i < o.count; i++) {
        const p = planeSpot(rand, 0.9, 1.9, avoid, 0.1);
        const m = register(makeMito(0.55, 0.17, o.color), o);
        m.position.copy(p);
        m.rotation.set(rand() * 3, rand() * 3, rand() * 3);
        root.add(m);
        avoid.push({ c: p, r: 0.4 });
      }
    }
    if (shown('pseudopod')) {
      const o = org('pseudopod');
      const mat = stdMat('#e8ecf6', { emissive: new THREE.Color(o.color) });
      const g = new THREE.Group();
      [V(-0.7, 0.5, 0.5), V(-0.35, -0.8, 0.5), V(0.4, 0.85, -0.35)].forEach((d) => {
        const dir = d.normalize();
        const a = dir.clone().multiplyScalar(R * 0.92), b = dir.clone().multiplyScalar(R * 1.55);
        g.add(limb(a, b, 0.42, 0.17, mat, 14));
        g.add(mk(new THREE.SphereGeometry(0.22, 14, 10), mat, b));
      });
      root.add(register(g, o));
    }
  }

  function buildPlantCell(def, root, rand) {
    const W = 5.2, H = 3.8, D = 3.0, T = 0.22;
    if (shown('wall')) {
      const o = org('wall');
      const mat = stdMat(o.color, { roughness: 0.75 });
      const g = new THREE.Group();
      g.add(mk(new THREE.BoxGeometry(W, H, T), mat, V(0, 0, -D / 2)));
      g.add(mk(new THREE.BoxGeometry(T, H, D), mat, V(-W / 2, 0, 0)));
      g.add(mk(new THREE.BoxGeometry(T, H, D), mat, V(W / 2, 0, 0)));
      g.add(mk(new THREE.BoxGeometry(W + T, T, D), mat, V(0, H / 2, 0)));
      g.add(mk(new THREE.BoxGeometry(W + T, T, D), mat, V(0, -H / 2, 0)));
      root.add(register(g, o));
    }
    root.add(mk(new THREE.BoxGeometry(W - 0.4, H - 0.4, D - 0.3), new THREE.MeshStandardMaterial({ color: '#e3f2c9', roughness: 0.9, side: THREE.BackSide }), V(0, 0, 0.05)));

    if (shown('vacuole')) {
      const o = org('vacuole');
      const v = register(makeBlob(1.0, o.color, { transparent: true, opacity: 0.72, depthWrite: false, roughness: 0.2 }, 3), o);
      v.position.set(-0.25, -0.1, -0.3);
      v.scale.set(1.55, 1.05, 0.85);
      root.add(v);
    }
    if (shown('nucleus')) {
      const o = org('nucleus');
      const n = register(makeNucleus(0.62, o.color, rand, { cut: true }), o);
      n.position.set(1.6, 0.85, 0.15);
      root.add(n);
    }
    if (shown('chloro')) {
      const o = org('chloro');
      const spots = [[-1.95, 1.05, 0.35, 0.2], [-1.95, -0.95, 0.55, -0.3], [0.35, 1.35, 0.65, 0], [1.55, -1.2, 0.55, 0.15], [-0.55, -1.4, 0.75, -0.1]];
      spots.slice(0, o.count).forEach(([x, y, z, rz], i) => {
        const c = register(makeChloroplast(0.95, 0.3, o.color), o);
        c.position.set(x, y, z);
        c.rotation.set(0.3, (i % 2) * 0.6, i < 2 ? Math.PI / 2 + rz : rz);
        root.add(c);
      });
    }
    if (shown('mito')) {
      const o = org('mito');
      [[0.95, -0.35, 0.95], [-1.25, 0.45, 1.0], [2.05, 0.05, 0.85]].slice(0, o.count).forEach(([x, y, z], i) => {
        const m = register(makeMito(0.6, 0.18, o.color), o);
        m.position.set(x, y, z);
        m.rotation.set(0.5 * i, 0.8, 1.2 + i);
        root.add(m);
      });
    }
    if (shown('golgi')) {
      const o = org('golgi');
      const gl = register(makeGolgi(0.3, o.color), o);
      gl.position.set(0.75, 0.35, 0.95);
      gl.rotation.set(0.3, 1.2, 0);
      root.add(gl);
    }
  }

  function buildEpithelialCell(def, root, rand) {
    const membMat = new THREE.MeshPhysicalMaterial({
      color: 0xf2b8c6, transparent: true, opacity: 0.16, roughness: 0.25, metalness: 0,
      transmission: 0.4, thickness: 0.3, side: THREE.DoubleSide, depthWrite: false
    });
    root.add(new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.6, 1.9), membMat));
    root.add(new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.6, 1.9, 2, 3, 2), new THREE.MeshBasicMaterial({ color: 0xe58aa0, wireframe: true, transparent: true, opacity: 0.18, depthWrite: false })));

    if (shown('microvilli')) {
      const o = org('microvilli');
      const mat = stdMat(o.color);
      const g = new THREE.Group();
      const grid = 6;
      for (let gx = 0; gx < grid; gx++) {
        for (let gz = 0; gz < grid; gz++) {
          const x = (gx / (grid - 1) - 0.5) * 1.55, z = (gz / (grid - 1) - 0.5) * 1.55;
          g.add(mk(new THREE.CylinderGeometry(0.045, 0.05, 0.36, 7), mat, V(x, 1.48, z)));
          g.add(mk(new THREE.SphereGeometry(0.045, 7, 5), mat, V(x, 1.66, z)));
        }
      }
      root.add(register(g, o));
    }
    if (shown('junction')) {
      const o = org('junction');
      const ring = mk(new THREE.TorusGeometry(1.33, 0.045, 8, 4), stdMat(o.color, { emissiveIntensity: 0.2 }), V(0, 1.18, 0));
      ring.rotation.x = Math.PI / 2;
      ring.rotation.z = Math.PI / 4;
      root.add(register(ring, o));
    }
    if (shown('nucleus')) {
      const o = org('nucleus');
      const n = register(makeNucleus(0.5, o.color, rand, { cut: false }), o);
      n.position.set(0, -0.65, 0);
      n.scale.set(1, 1.25, 1);
      root.add(n);
    }
    if (shown('golgi')) {
      const o = org('golgi');
      const gl = register(makeGolgi(0.2, o.color), o);
      gl.position.set(-0.3, 0.25, 0);
      gl.rotation.set(Math.PI / 2, 0, 0);
      root.add(gl);
    }
    if (shown('mito')) {
      const o = org('mito');
      [[0.55, 0.65, 0.45], [-0.55, 0.75, -0.4], [0.6, -0.1, -0.5], [-0.55, -0.95, 0.45]].slice(0, o.count).forEach(([x, y, z], i) => {
        const m = register(makeMito(0.38, 0.11, o.color), o);
        m.position.set(x, y, z);
        m.rotation.set(0.2 * i, 0, i % 2 ? 0.25 : -0.25);
        root.add(m);
      });
    }
  }

  function buildBacteriaCell(def, root, rand) {
    const rodLen = 2.0, rodR = 0.55;
    const membMat = new THREE.MeshPhysicalMaterial({
      color: 0x9fe3c4, transparent: true, opacity: 0.18, roughness: 0.25, metalness: 0,
      transmission: 0.45, thickness: 0.3, side: THREE.DoubleSide, depthWrite: false
    });
    const rod = capsule(rodLen, rodR, membMat, 22);
    rod.rotation.z = Math.PI / 2;
    root.add(rod);
    const riboMat = stdMat('#3fe0b0', { emissiveIntensity: 0.3 });
    for (let i = 0; i < 70; i++) {
      const x = (rand() - 0.5) * rodLen * 1.1, a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * rodR * 0.8;
      root.add(mk(new THREE.SphereGeometry(0.025, 5, 4), riboMat, V(x, Math.cos(a) * r, Math.sin(a) * r)));
    }
    const plasmid = mk(new THREE.TorusGeometry(0.12, 0.012, 6, 24), stdMat('#c49bff'), V(0.6, 0.2, 0.1));
    plasmid.rotation.set(0.6, 0.3, 0);
    root.add(plasmid);

    if (shown('wall')) {
      const o = org('wall');
      const wall = capsule(rodLen, rodR * 1.12, new THREE.MeshBasicMaterial({ color: o.color, wireframe: true, transparent: true, opacity: 0.35, depthWrite: false }), 16);
      wall.rotation.z = Math.PI / 2;
      root.add(register(wall, o));
    }
    if (shown('nucleoid')) {
      const o = org('nucleoid');
      const geo = new THREE.IcosahedronGeometry(0.42, 2);
      const pa = geo.getAttribute('position');
      for (let i = 0; i < pa.count; i++) {
        const k = 1 + (rand() - 0.5) * 0.3;
        pa.setXYZ(i, pa.getX(i) * k * 1.4, pa.getY(i) * k * 0.8, pa.getZ(i) * k * 0.8);
      }
      geo.computeVertexNormals();
      root.add(register(mk(geo, stdMat(o.color, { transparent: true, opacity: 0.85 }), V(-0.1, 0, 0)), o));
    }
    if (shown('flagellum')) {
      const o = org('flagellum');
      const pts = [];
      for (let i = 0; i <= 50; i++) {
        const t = i / 50, ang = t * 3.2 * Math.PI * 2;
        pts.push(V(rodLen / 2 + rodR * 0.9 + t * 1.7, Math.cos(ang) * 0.11, Math.sin(ang) * 0.11));
      }
      root.add(register(mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 70, 0.035, 6, false), stdMat(o.color)), o));
    }
  }

  function buildBranch(group, mat, from, dir, len, r0, depth, rand, tips) {
    const to = from.clone().add(dir.clone().multiplyScalar(len));
    group.add(limb(from, to, r0, r0 * 0.55, mat, 7));
    if (depth <= 0) { if (tips) tips.push(to); return; }
    for (let c = 0; c < 2; c++) {
      const nd = dir.clone().add(V((rand() - 0.5) * 0.65, (rand() - 0.5) * 0.65, (rand() - 0.5) * 0.65)).normalize();
      buildBranch(group, mat, to, nd, len * 0.62, r0 * 0.6, depth - 1, rand, tips);
    }
  }

  function buildNeuronCell(def, root, rand) {
    if (shown('soma')) {
      const o = org('soma');
      const g = new THREE.Group();
      g.add(mk(new THREE.SphereGeometry(o.r, 26, 18), stdMat(o.color, { transparent: true, opacity: 0.88 })));
      g.add(mk(new THREE.SphereGeometry(o.r * 0.42, 16, 12), stdMat('#3f2470'), V(0.05, 0.05, 0)));
      root.add(register(g, o));
    }
    const start = V(-0.8, -0.1, 0), end = V(-5.0, -0.1, 0);
    if (shown('axon')) {
      const o = org('axon');
      const g = new THREE.Group();
      g.add(limb(start, end, o.r, o.r * 0.7, stdMat(o.color, { emissiveIntensity: 0.15 }), 10));
      const myelin = stdMat('#eef2ff', { emissive: new THREE.Color('#9fb2ff'), emissiveIntensity: 0.05 });
      for (let i = 0; i < 7; i++) {
        const t = (i + 0.5) / 7;
        const seg = mk(new THREE.CylinderGeometry(0.2, 0.2, 0.42, 14), myelin, V(start.x + (end.x - start.x) * t, -0.1, 0));
        seg.rotation.z = Math.PI / 2;
        g.add(seg);
      }
      root.add(register(g, o));
    }
    if (shown('terminal')) {
      const o = org('terminal');
      const g = new THREE.Group();
      const mat = stdMat(o.color, { emissiveIntensity: 0.2 });
      const tips = [];
      buildBranch(g, mat, end, V(-1, -0.25, 0).normalize(), 0.55, 0.06, 2, rand, tips);
      tips.forEach((p) => g.add(mk(new THREE.SphereGeometry(0.075, 10, 8), mat, p)));
      root.add(register(g, o));
    }
    if (shown('dendrite')) {
      const o = org('dendrite');
      const g = new THREE.Group();
      const mat = stdMat(o.color, { emissiveIntensity: 0.1 });
      for (let b = 0; b < 6; b++) {
        const ang = (b / 6) * Math.PI * 2 + rand() * 0.4;
        const incl = 0.25 + rand() * 0.7;
        const dir = V(Math.cos(ang) * Math.cos(incl) + 0.4, Math.sin(incl), Math.sin(ang) * Math.cos(incl)).normalize();
        buildBranch(g, mat, dir.clone().multiplyScalar(0.8), dir, 0.95, 0.09, 2, rand);
      }
      root.add(register(g, o));
    }
  }

  function striationTexture() {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#f2a3ae'; g.fillRect(0, 0, 16, 64);
    g.fillStyle = '#8f1f33'; g.fillRect(0, 14, 16, 36);
    g.fillStyle = '#c4475c'; g.fillRect(0, 29, 16, 6);
    g.fillStyle = '#4a0d18'; g.fillRect(0, 0, 16, 2);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 16);
    return t;
  }

  function buildMuscleCell(def, root, rand) {
    const fiberLen = 5.6, fiberR = 0.72;
    if (shown('sarcolemma')) {
      const o = org('sarcolemma');
      const g = new THREE.Group();
      const shell = mk(new THREE.CylinderGeometry(fiberR, fiberR, fiberLen, 32, 1, true), new THREE.MeshPhysicalMaterial({
        color: o.color, transparent: true, opacity: 0.16, roughness: 0.2, metalness: 0,
        transmission: 0.5, thickness: 0.3, side: THREE.DoubleSide, depthWrite: false, emissive: new THREE.Color(o.color), emissiveIntensity: 0.05
      }));
      g.add(shell);
      const tub = stdMat(o.color, { emissiveIntensity: 0.12 });
      for (let i = 0; i < 9; i++) {
        const ring = mk(new THREE.TorusGeometry(fiberR * 0.995, 0.018, 6, 40), tub, V(0, -fiberLen / 2 + (i + 0.5) * fiberLen / 9, 0));
        ring.rotation.x = Math.PI / 2;
        g.add(ring);
      }
      g.rotation.z = Math.PI / 2;
      root.add(register(g, o));
    }
    if (shown('myofibril')) {
      const o = org('myofibril');
      const mat = stdMat('#ffffff', { map: striationTexture(), emissive: new THREE.Color(o.color), emissiveIntensity: 0.06, roughness: 0.55 });
      const g = new THREE.Group();
      for (let i = 0; i < 19; i++) {
        let y = 0, z = 0;
        if (i > 0) {
          const ring = i <= 6 ? 0.2 : 0.42;
          const n = i <= 6 ? 6 : 12;
          const k = i <= 6 ? i - 1 : i - 7;
          const a = (k / n) * Math.PI * 2 + (i <= 6 ? 0 : 0.26);
          y = Math.sin(a) * ring; z = Math.cos(a) * ring;
        }
        g.add(mk(new THREE.CylinderGeometry(0.085, 0.085, fiberLen * 0.97, 10), mat, V(0, y, z)));
      }
      g.children.forEach((m) => { m.rotation.z = Math.PI / 2; });
      root.add(register(g, o));
    }
    if (shown('nucleus')) {
      const o = org('nucleus');
      const mat = stdMat(o.color);
      const g = new THREE.Group();
      for (let i = 0; i < o.count; i++) {
        const a = (i / o.count) * Math.PI * 2 + rand();
        const n = mk(new THREE.SphereGeometry(o.r, 14, 10), mat, V((i / (o.count - 1) - 0.5) * fiberLen * 0.85, Math.sin(a) * 0.62, Math.cos(a) * 0.62));
        n.scale.set(3.2, 1, 1);
        g.add(n);
      }
      root.add(register(g, o));
    }
    if (shown('mito')) {
      const o = org('mito');
      for (let i = 0; i < o.count; i++) {
        const x = (rand() - 0.5) * fiberLen * 0.85, a = rand() * Math.PI * 2, r = 0.53 + rand() * 0.06;
        const m = register(makeMito(0.26, 0.07, o.color), o);
        m.position.set(x, Math.sin(a) * r, Math.cos(a) * r);
        m.rotation.z = Math.PI / 2;
        root.add(m);
      }
    }
  }

  const BUILDERS = {
    plant: buildPlantCell, animal: buildAnimalCell, whiteBlood: buildWhiteBloodCell,
    epithelial: buildEpithelialCell, bacteria: buildBacteriaCell, neuron: buildNeuronCell, muscle: buildMuscleCell
  };

  function buildCrowding(root, rand, extents) {
    const N = 3200;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const palette = ['#00e8a8', '#a855f7', '#f59e0b', '#38bdf8', '#ec4899'].map((c) => new THREE.Color(c));
    for (let i = 0; i < N; i++) {
      let x, y, z;
      do { x = rand() * 2 - 1; y = rand() * 2 - 1; z = rand() * 2 - 1; } while (x * x + y * y + z * z > 1);
      pos[i * 3] = x * extents[0]; pos[i * 3 + 1] = y * extents[1]; pos[i * 3 + 2] = z * extents[2];
      const c = palette[i % palette.length];
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.1, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }));
    root.add(pts);
    return pts;
  }

  /* --------------------------------------------------------------------------
     GERÇEKÇİ MODEL (GLB) + İŞARETÇİLER
     -------------------------------------------------------------------------- */
  let gltfLoader = null;
  function loader() {
    if (!gltfLoader && THREE.GLTFLoader) gltfLoader = new THREE.GLTFLoader();
    return gltfLoader;
  }

  function haloTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  let haloTex = null;

  function makeLabel(text, color) {
    const fs = 40, pad = 16;
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    g.font = `800 ${fs}px Inter, system-ui, sans-serif`;
    const w = Math.ceil(g.measureText(text).width) + pad * 2, h = Math.round(fs * 1.55);
    c.width = w; c.height = h;
    g.font = `800 ${fs}px Inter, system-ui, sans-serif`;
    const r = 14;
    g.beginPath();
    g.moveTo(r, 2); g.lineTo(w - r, 2); g.quadraticCurveTo(w - 2, 2, w - 2, r);
    g.lineTo(w - 2, h - r); g.quadraticCurveTo(w - 2, h - 2, w - r, h - 2);
    g.lineTo(r, h - 2); g.quadraticCurveTo(2, h - 2, 2, h - r);
    g.lineTo(2, r); g.quadraticCurveTo(2, 2, r, 2); g.closePath();
    g.fillStyle = 'rgba(5, 14, 11, 0.86)'; g.fill();
    g.lineWidth = 4; g.strokeStyle = color; g.stroke();
    g.fillStyle = '#ffffff'; g.textBaseline = 'middle';
    g.fillText(text, pad, h / 2 + 2);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.scale.set(w * 0.0036, h * 0.0036, 1);
    sp.center.set(0.5, -0.35);
    sp.renderOrder = 40;
    return sp;
  }

  function makeShadedMaterial(shade, mesh, pinWorld) {
    const stops = shade.stops.slice(0, 6);
    while (stops.length < 6) stops.push(stops[stops.length - 1]);
    const uniforms = {
      uMode: { value: shade.mode === 'radial' ? 0 : 1 },
      uCenter: { value: V(0, 0, 0) },
      uRadius: { value: 1 },
      uMinY: { value: 0 },
      uMaxY: { value: 1 },
      uStopPos: { value: stops.map((s) => s[0]) },
      uStopCol: { value: stops.map((s) => new THREE.Color(s[1])) }
    };
    if (shade.mode === 'radial' && pinWorld) {
      const c = mesh.worldToLocal(pinWorld.clone());
      const e = mesh.worldToLocal(pinWorld.clone().add(V(shade.radius, 0, 0)));
      uniforms.uCenter.value.copy(c);
      uniforms.uRadius.value = c.distanceTo(e);
    } else if (mesh.geometry.boundingBox) {
      uniforms.uMinY.value = mesh.geometry.boundingBox.min.y;
      uniforms.uMaxY.value = mesh.geometry.boundingBox.max.y;
    }
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.05, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = 'varying vec3 vLocalPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vLocalPos = transformed;');
      sh.fragmentShader = [
        'uniform int uMode; uniform vec3 uCenter; uniform float uRadius; uniform float uMinY; uniform float uMaxY;',
        'uniform float uStopPos[6]; uniform vec3 uStopCol[6]; varying vec3 vLocalPos;',
        'vec3 affeRamp(float t) { vec3 c = uStopCol[0];',
        '  for (int i = 1; i < 6; i++) { float a = uStopPos[i - 1]; float b = uStopPos[i];',
        '    if (t >= a) { float k = b > a ? clamp((t - a) / (b - a), 0.0, 1.0) : 1.0; c = mix(uStopCol[i - 1], uStopCol[i], k); } }',
        '  return c; }'
      ].join('\n') + '\n' + sh.fragmentShader.replace('#include <color_fragment>', [
        '#include <color_fragment>',
        '  float affeT = uMode == 0 ? clamp(length(vLocalPos - uCenter) / uRadius, 0.0, 1.0) : clamp((vLocalPos.y - uMinY) / max(uMaxY - uMinY, 1e-5), 0.0, 1.0);',
        '  diffuseColor.rgb *= affeRamp(affeT);'
      ].join('\n'));
    };
    return mat;
  }

  function buildPins(def, wrapper) {
    if (!haloTex) haloTex = haloTexture();
    const pins = new Map();
    const pinGroup = new THREE.Group();
    Object.entries(def.model.pins || {}).forEach(([key, arr]) => {
      const o = def.organelles.find((x) => x.key === key);
      if (!o) return;
      const surf = V(arr[0], arr[1], arr[2]);
      const n = V(arr[3], arr[4], arr[5]).normalize();
      const head = surf.clone().add(n.clone().multiplyScalar(0.42));
      const g = new THREE.Group();
      const lineGeo = new THREE.BufferGeometry().setFromPoints([surf, head]);
      g.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: o.color, transparent: true, opacity: 0.9 })));
      const dot = mk(new THREE.SphereGeometry(0.075, 14, 10), new THREE.MeshBasicMaterial({ color: o.color }), head);
      g.add(dot);
      g.add(mk(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: o.color }), surf));
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: o.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.position.copy(head);
      halo.scale.setScalar(0.42);
      g.add(halo);
      const hit = mk(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshBasicMaterial({ visible: false }), head);
      hit.userData.organelle = o;
      g.add(hit);
      const label = makeLabel(o.name, o.color);
      label.position.copy(head);
      label.visible = false;
      g.add(label);
      pinGroup.add(g);
      pins.set(key, { group: g, dot, halo, hit, label, organelle: o });
    });
    wrapper.add(pinGroup);
    return pins;
  }

  function fixTexturedMaterial(mesh) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m) => {
      ['map', 'emissiveMap'].forEach((slot) => {
        if (m[slot]) { m[slot].encoding = THREE.LinearEncoding; m[slot].needsUpdate = true; }
      });
      m.side = THREE.DoubleSide;
      if (m.roughness !== undefined) m.roughness = Math.max(0.35, m.roughness);
      m.needsUpdate = true;
    });
  }

  function loadRealModel(def) {
    if (realCache.has(def.id)) return realCache.get(def.id);
    const p = new Promise((resolve, reject) => {
      const ld = loader();
      if (!ld) { reject(new Error('GLTFLoader yüklenemedi (internet bağlantısını kontrol edin).')); return; }
      ld.load(def.model.url, (gltf) => {
        const scene = gltf.scene;
        scene.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(scene);
        const size = box.getSize(V(0, 0, 0)), center = box.getCenter(V(0, 0, 0));
        const s = MODEL_SIZE / Math.max(size.x, size.y, size.z);
        const wrapper = new THREE.Group();
        const holder = new THREE.Group();
        holder.scale.setScalar(s);
        scene.position.sub(center);
        holder.add(scene);
        wrapper.add(holder);
        wrapper.add(new THREE.AmbientLight(0xffffff, def.model.textured ? 0.12 : 0.25));
        wrapper.updateMatrixWorld(true);

        let pinWorld = null;
        if (def.model.shade && def.model.shade.centerPin) {
          const a = def.model.pins[def.model.shade.centerPin];
          if (a) pinWorld = V(a[0], a[1], a[2]);
        }
        scene.traverse((m) => {
          if (!m.isMesh) return;
          if (def.model.textured) fixTexturedMaterial(m);
          else m.material = makeShadedMaterial(def.model.shade, m, pinWorld);
        });
        const pins = buildPins(def, wrapper);
        resolve({ wrapper, pins });
      }, (xhr) => {
        if (xhr && xhr.total) setCellLoad(`3B model indiriliyor… %${Math.round((xhr.loaded / xhr.total) * 100)}`);
      }, (err) => reject(err || new Error('Model indirilemedi')));
    });
    realCache.set(def.id, p);
    p.catch(() => realCache.delete(def.id));
    return p;
  }

  function setCellLoad(text, isError) {
    const ov = $('cellLoadOverlay');
    if (!ov) return;
    if (text == null) { ov.hidden = true; return; }
    ov.hidden = false;
    if ($('cellLoadText')) $('cellLoadText').textContent = text;
    $('cellLoadBox')?.classList.toggle('is-error', !!isError);
  }

  function detachReal() {
    if (realActive && viewer3d) viewer3d.root.remove(realActive.wrapper);
    realActive = null;
  }

  function applyPinVisibility() {
    if (!realActive) return;
    realActive.pins.forEach((p, key) => {
      p.group.visible = !state.hiddenKeys.has(key);
      p.label.visible = key === state.activeOrganelle;
    });
  }

  /* --------------------------------------------------------------------------
     SAHNE İNŞASI
     -------------------------------------------------------------------------- */
  function useReal() {
    const def = cellDef();
    return state.view === 'real' && !!def.model && !state.crowding;
  }

  async function rebuildScene() {
    if (!viewer3d) return;
    const token = ++buildToken;
    detachReal();
    viewer3d.clear();
    hotspots = [];
    organelleMats = new Map();
    const def = cellDef();
    const rand = mulberry(def.id.split('').reduce((a, c) => a + c.charCodeAt(0), 7));
    renderModelCredit();

    if (useReal()) {
      setCellLoad('Gerçekçi 3B model yükleniyor…');
      try {
        const real = await loadRealModel(def);
        if (token !== buildToken) return;
        setCellLoad(null);
        realActive = real;
        viewer3d.root.add(real.wrapper);
        real.pins.forEach((p) => hotspots.push({ mesh: p.hit, organelle: p.organelle }));
        applyPinVisibility();
        viewer3d.setDistance(11);
        viewer3d.setRotation(...(REAL_VIEW[def.id] || [0.3, -0.6]));
        viewer3d.onFrame((dt, t) => {
          real.pins.forEach((p, key) => {
            const on = key === state.activeOrganelle;
            const k = on ? 1 + 0.35 * Math.sin(t * 5) : 1;
            p.dot.scale.setScalar(on ? 1.35 * k : 1);
            p.halo.scale.setScalar(on ? 0.75 * k : 0.42);
          });
        });
      } catch (err) {
        if (token !== buildToken) return;
        console.error('[affeBio] Hücre modeli yüklenemedi:', err);
        setCellLoad('⚠️ Model yüklenemedi. Sayfayı bir yerel sunucu üzerinden açtığınızdan emin olun (file:// çalışmaz). Şematik moda geçebilirsiniz.', true);
      }
      return;
    }

    setCellLoad(null);
    if (state.crowding) {
      const pts = buildCrowding(viewer3d.root, rand, CROWD_EXTENTS[def.id] || [2.5, 2.5, 2.5]);
      viewer3d.onFrame((dt) => { pts.rotation.y += dt * 0.06; });
    } else {
      (BUILDERS[def.shape] || buildAnimalCell)(def, viewer3d.root, rand);
    }
    viewer3d.setDistance(VIEW_DIST[def.shape] || 8.5);
    viewer3d.setRotation(...(SCHEMA_VIEW[def.id] || [0.3, -0.5]));
    viewer3d.onFrame((dt, t) => {
      organelleMats.forEach((mats, key) => {
        const on = key === state.activeOrganelle;
        const glow = on ? 0.32 + 0.28 * (0.5 + 0.5 * Math.sin(t * 5)) : null;
        mats.forEach((m) => { m.emissiveIntensity = on ? glow : m.userData.baseEmissive; });
      });
    });
  }

  /* --------------------------------------------------------------------------
     UI
     -------------------------------------------------------------------------- */
  function visibleOrganelles() {
    const def = cellDef();
    return def.organelles.filter((o) => (useReal() ? true : !o.realOnly));
  }

  function renderLegend() {
    const box = $('cellLegend');
    if (!box) return;
    box.innerHTML = visibleOrganelles().map((o) => {
      const off = state.hiddenKeys.has(o.key) ? ' off' : '';
      return `<span class="lab-legend-chip${off}" data-key="${o.key}"><i class="sw" style="background:${o.color};box-shadow:0 0 6px ${o.color};"></i>${o.name}</span>`;
    }).join('');
  }

  function renderOrganelleList() {
    const box = $('cellOrganelleList');
    if (!box) return;
    const def = cellDef();
    const real = useReal();
    box.innerHTML = visibleOrganelles().map((o) => {
      const noPin = real && !(def.model.pins || {})[o.key];
      return `
      <button class="lab-card${state.activeOrganelle === o.key ? ' active' : ''}" data-key="${o.key}">
        <b style="color:${o.color};">${o.name}</b>
        <small>${o.subtitle}${noPin ? ' · şematik modda görünür' : ''}</small>
      </button>`;
    }).join('');
  }

  function renderSwitches() {
    document.querySelectorAll('.lab-mode-tab[data-cell]').forEach((b) => b.classList.toggle('active', b.dataset.cell === state.cellId));
    const def = cellDef();
    const realBtn = document.querySelector('[data-cellview="real"]');
    const schemaBtn = document.querySelector('[data-cellview="schema"]');
    if (realBtn) {
      realBtn.disabled = !def.model;
      realBtn.title = def.model ? 'Gerçek 3B modeli göster' : 'Bu hücre için açık lisanslı gerçek model yok — gelişmiş şematik model gösteriliyor';
      realBtn.textContent = def.model ? `🧫 ${def.model.label || 'Gerçekçi Model'}` : '🧫 Gerçekçi Model (yok)';
      realBtn.classList.toggle('active', useReal());
    }
    if (schemaBtn) schemaBtn.classList.toggle('active', !useReal());
    const crowdBtn = $('cellCrowdingBtn');
    if (crowdBtn) crowdBtn.classList.toggle('active', state.crowding);
  }

  function renderContextCard() {
    const def = cellDef();
    if ($('cellTypeLabel')) $('cellTypeLabel').textContent = def.type;
    if ($('cellOccurrenceText')) $('cellOccurrenceText').textContent = def.occurrence;
    if ($('cellClinicalText')) $('cellClinicalText').textContent = def.clinical;
  }

  function renderModelCredit() {
    const el = $('cellModelCredit');
    if (!el) return;
    const def = cellDef();
    el.textContent = useReal()
      ? def.model.credit
      : 'Şematik model: affeBio için yordamsal Three.js geometrisiyle çizildi (organelleri doğrudan tıklayabilirsiniz).';
  }

  function selectOrganelle(key) {
    const o = org(key);
    if (!o) return;
    state.activeOrganelle = key;
    renderOrganelleList();
    applyPinVisibility();
    if ($('cellInfoTitle')) $('cellInfoTitle').textContent = o.name;
    if ($('cellInfoSubtitle')) $('cellInfoSubtitle').textContent = o.subtitle;
    if ($('cellInfoAttrs')) {
      $('cellInfoAttrs').innerHTML = (o.attrs || []).map(([label, value]) => `
        <div class="tel-card"><small>${label}</small><b style="font-size:12px;">${value}</b></div>
      `).join('');
    }
    if ($('cellInfoText')) $('cellInfoText').textContent = o.note;
    if ($('cellInfoFact')) $('cellInfoFact').textContent = '💡 ' + o.fact;
    if ($('cellInfoCard')) $('cellInfoCard').hidden = false;
  }

  function refreshAll() {
    renderSwitches();
    renderLegend();
    renderOrganelleList();
    renderContextCard();
    rebuildScene();
  }

  function setCellType(id) {
    const def = CELLS.find((c) => c.id === id);
    if (!def) return;
    state.cellId = id;
    state.hiddenKeys.clear();
    state.crowding = false;
    state.view = def.model ? 'real' : 'schema';
    state.activeOrganelle = null;
    if ($('cellInfoCard')) $('cellInfoCard').hidden = true;
    refreshAll();
    if (def.defaultOrganelle) selectOrganelle(def.defaultOrganelle);
  }

  function setView(view) {
    if (view === 'real' && !cellDef().model) return;
    state.view = view;
    if (view === 'real') state.crowding = false;
    const o = org(state.activeOrganelle);
    if (o && o.realOnly && view === 'schema') {
      state.activeOrganelle = null;
      if ($('cellInfoCard')) $('cellInfoCard').hidden = true;
    }
    refreshAll();
  }

  function toggleCrowding(force) {
    state.crowding = force != null ? force : !state.crowding;
    if (state.crowding) state.view = 'schema';
    refreshAll();
  }

  function initRaycastPicking() {
    raycaster = new THREE.Raycaster();
    pointerNDC = new THREE.Vector2();
    const dom = viewer3d.renderer.domElement;
    let downX = 0, downY = 0;
    dom.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; });
    dom.addEventListener('pointerup', (e) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
      if (state.crowding) return;
      const rect = dom.getBoundingClientRect();
      pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNDC, viewer3d.camera);
      const targets = hotspots.filter((h) => {
        let n = h.mesh;
        while (n) { if (n.visible === false) return false; n = n.parent; }
        return true;
      }).map((h) => h.mesh);
      const hit = raycaster.intersectObjects(targets, false)[0];
      if (hit) selectOrganelle(hit.object.userData.organelle.key);
    });
  }

  function switchSubtab() {}

  function applyPreset(preset) {
    if (preset.cellType) setCellType(preset.cellType);
    if (preset.view) setView(preset.view);
    if (preset.crowding != null) toggleCrowding(preset.crowding);
    if (preset.organelle) selectOrganelle(preset.organelle);
  }

  function init() {
    viewer3d = createViewer3D($('bioStage3D_2'), { distance: 9, tilt: 0.3, spin: -0.6, minDistance: 2.5, maxDistance: 24, autoRotate: false });
    initRaycastPicking();

    document.querySelectorAll('.lab-mode-tab[data-cell]').forEach((btn) => {
      btn.addEventListener('click', () => setCellType(btn.dataset.cell));
    });
    document.querySelectorAll('[data-cellview]').forEach((btn) => {
      btn.addEventListener('click', () => setView(btn.dataset.cellview));
    });
    $('cellCrowdingBtn')?.addEventListener('click', () => toggleCrowding());
    $('cellLegend')?.addEventListener('click', (e) => {
      const chip = e.target.closest('.lab-legend-chip');
      if (!chip) return;
      const key = chip.dataset.key;
      if (state.hiddenKeys.has(key)) state.hiddenKeys.delete(key); else state.hiddenKeys.add(key);
      renderLegend();
      if (useReal()) applyPinVisibility(); else rebuildScene();
    });
    $('cellOrganelleList')?.addEventListener('click', (e) => {
      const card = e.target.closest('[data-key]');
      if (card) selectOrganelle(card.dataset.key);
    });

    setCellType(state.cellId);
  }

  window.Mod2Cell = {
    init,
    switchSubtab,
    applyPreset,
    getActiveSub: () => 'bio2_1',
    setRunning: (r) => viewer3d && viewer3d.setRunning(r)
  };
})();
