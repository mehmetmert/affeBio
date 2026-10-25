/* ============================================================================
   affeBio (affeLab: Biology) — Çekirdek Motor
   İçerik:
   1. 4. Dereceden Runge-Kutta (RK4) Sayısal İntegratör (Av-Avcı, Aksiyon Potansiyeli)
   2. Three.js 3B Sahne Yöneticisi (Orbit, Pinch-to-Zoom) — affePhysics ile ortak çekirdek
   3. 2B Kanvas Yardımcıları (fitCanvas, drawVectorArrow)
   ============================================================================ */
(function () {
  'use strict';

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  /* ==========================================================================
     1. 4. DERECEDEN RUNGE-KUTTA (RK4) ÇÖZÜCÜ
     ========================================================================== */
  function rk4Step(y, t, dt, deriv) {
    const n = y.length;
    const k1 = deriv(y, t);
    const y2 = new Array(n);
    for (let i = 0; i < n; i++) y2[i] = y[i] + 0.5 * dt * k1[i];
    const k2 = deriv(y2, t + 0.5 * dt);

    const y3 = new Array(n);
    for (let i = 0; i < n; i++) y3[i] = y[i] + 0.5 * dt * k2[i];
    const k3 = deriv(y3, t + 0.5 * dt);

    const y4 = new Array(n);
    for (let i = 0; i < n; i++) y4[i] = y[i] + dt * k3[i];
    const k4 = deriv(y4, t + dt);

    const next = new Array(n);
    for (let i = 0; i < n; i++) {
      next[i] = y[i] + (dt / 6.0) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    }
    return next;
  }

  /* ==========================================================================
     2. THREE.JS 3B SAHNE YÖNETİCİSİ (Orbit sürükleme, Pinch-to-Zoom, Oto-dönüş)
     ========================================================================== */
  function createViewer3D(container, opts = {}) {
    if (!window.THREE || !container) return null;
    container.innerHTML = '';

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (e) {
      container.innerHTML = '<div style="padding:24px;color:#94a3b8;">WebGL başlatılamadı.</div>';
      return null;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000);
    let targetDist = opts.distance || 16;
    let curDist = targetDist;
    let minD = opts.minDistance || 3.5;
    let maxD = opts.maxDistance || 65;
    camera.position.set(0, 0, curDist);

    const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x081310, 0.95);
    scene.add(hemi);
    const dir1 = new THREE.DirectionalLight(0xffffff, 0.95);
    dir1.position.set(10, 14, 16);
    scene.add(dir1);
    const dir2 = new THREE.DirectionalLight(0x00e8a8, 0.55);
    dir2.position.set(-12, -10, -10);
    scene.add(dir2);
    const dir3 = new THREE.DirectionalLight(0xa855f7, 0.45);
    dir3.position.set(0, -14, 8);
    scene.add(dir3);

    const root = new THREE.Group();
    scene.add(root);

    const st = {
      rotX: opts.tilt ?? 0.35,
      rotY: opts.spin ?? -0.45,
      velX: 0,
      velY: 0,
      autoRotate: opts.autoRotate !== false,
      dragging: false,
      lx: 0,
      ly: 0,
      running: true,
      pinchDist: 0,
      pointers: new Map()
    };

    const dom = renderer.domElement;
    dom.style.touchAction = 'none';
    dom.style.cursor = 'grab';

    dom.addEventListener('pointerdown', (e) => {
      st.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      dom.setPointerCapture(e.pointerId);
      if (st.pointers.size === 1) {
        st.dragging = true;
        st.lx = e.clientX;
        st.ly = e.clientY;
        dom.style.cursor = 'grabbing';
      } else if (st.pointers.size === 2) {
        const pts = Array.from(st.pointers.values());
        st.pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      }
    });

    dom.addEventListener('pointermove', (e) => {
      if (!st.pointers.has(e.pointerId)) return;
      st.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (st.pointers.size === 2) {
        const pts = Array.from(st.pointers.values());
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (st.pinchDist > 10) {
          const ratio = st.pinchDist / Math.max(10, d);
          targetDist = clamp(targetDist * ratio, minD, maxD);
        }
        st.pinchDist = d;
        return;
      }
      if (!st.dragging) return;
      st.velY = (e.clientX - st.lx) * 0.0075;
      st.velX = (e.clientY - st.ly) * 0.0075;
      st.rotY += st.velY;
      st.rotX = clamp(st.rotX + st.velX, -1.52, 1.52);
      st.lx = e.clientX;
      st.ly = e.clientY;
    });

    const endPtr = (e) => {
      st.pointers.delete(e.pointerId);
      if (st.pointers.size === 0) {
        st.dragging = false;
        dom.style.cursor = 'grab';
      }
    };
    dom.addEventListener('pointerup', endPtr);
    dom.addEventListener('pointercancel', endPtr);

    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      targetDist = clamp(targetDist * (e.deltaY > 0 ? 1.09 : 0.91), minD, maxD);
    }, { passive: false });

    function resize() {
      const w = container.clientWidth || 600;
      const h = container.clientHeight || 480;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    new ResizeObserver(resize).observe(container);
    resize();

    const frameCallbacks = [];
    const clock = new THREE.Clock();
    let elapsed = 0;

    function animate() {
      requestAnimationFrame(animate);
      if (!st.running) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      elapsed += dt;

      if (!st.dragging) {
        st.velX *= 0.92;
        st.velY *= 0.92;
        st.rotY += st.velY;
        st.rotX = clamp(st.rotX + st.velX, -1.52, 1.52);
        if (st.autoRotate) st.rotY += dt * 0.25;
      }

      curDist += (targetDist - curDist) * 0.12;
      camera.position.z = curDist;
      root.rotation.set(st.rotX, st.rotY, 0);

      for (let i = 0; i < frameCallbacks.length; i++) {
        frameCallbacks[i](dt, elapsed);
      }
      renderer.render(scene, camera);
    }
    animate();

    function clear() {
      frameCallbacks.length = 0;
      while (root.children.length > 0) {
        const child = root.children[0];
        root.remove(child);
        child.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((m) => {
              if (m.map) m.map.dispose();
              m.dispose();
            });
          }
        });
      }
    }

    return {
      scene,
      camera,
      renderer,
      root,
      clear,
      onFrame(fn) { frameCallbacks.push(fn); },
      setDistance(d) { targetDist = clamp(d, minD, maxD); },
      setAutoRotate(v) { st.autoRotate = v; },
      setRotation(rx, ry) { st.rotX = clamp(rx, -1.52, 1.52); st.rotY = ry; st.velX = 0; st.velY = 0; },
      setRunning(v) { st.running = v; if (v) { clock.getDelta(); resize(); } },
      resize
    };
  }

  function makeSpriteLabel(text, color = '#00e8a8', scale = 0.8) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const g = c.getContext('2d');
    g.font = '800 54px Inter, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 8;
    g.strokeStyle = 'rgba(4, 10, 8, 0.9)';
    g.strokeText(text, 128, 64);
    g.fillStyle = color;
    g.fillText(text, 128, 64);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(scale * 2, scale, 1);
    sp.renderOrder = 20;
    return sp;
  }

  /* ==========================================================================
     3. 2B KANVAS YARDIMCILARI (Osiloskop, Popülasyon Grafiği)
     ========================================================================== */
  function fitCanvas(canvas) {
    if (!canvas) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(200, Math.floor(rect.width));
    const h = Math.max(120, Math.floor(rect.height));
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h, dpr };
  }

  function drawLineChart(ctx, w, h, series, opts = {}) {
    const padL = opts.padL ?? 36, padR = opts.padR ?? 12, padT = opts.padT ?? 14, padB = opts.padB ?? 22;
    const pw = w - padL - padR, ph = h - padT - padB;
    let maxY = opts.maxY;
    let maxX = opts.maxX;
    if (maxY == null) {
      maxY = 1e-6;
      series.forEach((s) => s.points.forEach((p) => { if (p.y > maxY) maxY = p.y; }));
      maxY *= 1.08;
    }
    if (maxX == null) {
      maxX = 1e-6;
      series.forEach((s) => s.points.forEach((p) => { if (p.x > maxX) maxX = p.x; }));
    }
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1;
    for (let g = 1; g <= 3; g++) {
      const y = padT + (ph * g) / 4;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    }
    series.forEach((s) => {
      if (!s.points.length) return;
      ctx.beginPath();
      s.points.forEach((p, i) => {
        const x = padL + (p.x / Math.max(1e-6, maxX)) * pw;
        const y = padT + ph - (p.y / Math.max(1e-6, maxY)) * ph;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = s.color || '#00e8a8';
      ctx.lineWidth = 2.1;
      ctx.stroke();
    });
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.fillText((opts.yLabel || ''), padL + 4, padT + 10);
    ctx.fillText((opts.xMaxLabel || maxX.toFixed(0)), w - padR - 40, h - 6);
    return { padL, padR, padT, padB, pw, ph, maxX, maxY };
  }

  window.BioCore = {
    clamp,
    rk4Step,
    createViewer3D,
    makeSpriteLabel,
    fitCanvas,
    drawLineChart
  };
})();
