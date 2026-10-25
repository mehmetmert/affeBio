/* ============================================================================
   affeBio — MODÜL 3: Gen'den Proteine & Gen Düzenleme Tezgahı
   3.1 Santral Dogma: girilen DNA dizisinin 3B çift sarmalı, canlı transkripsiyon
       (mRNA) ve ribozomda translasyon (amino asit zinciri) animasyonu.
   3.2 CRISPR-Cas9 kavramsal laboratuvarı → js/mod3-crispr.js (Mod3Crispr)
   3.3 Sanal biyoteknoloji (PCR + jel) → js/mod3-biotech.js (Mod3Biotech)
   Bu dosya alt sekme geçişini ve çalışma durumunu her iki modüle iletir.
   ============================================================================ */
(function () {
  'use strict';

  const { CODON_TABLE, AA_INFO, MUTATIONS } = window.BioData;
  const { createViewer3D, makeSpriteLabel, clamp } = window.BioCore;
  const $ = (id) => document.getElementById(id);

  const BASE_COLOR = { A: '#00e8a8', T: '#ff3366', G: '#a855f7', C: '#f59e0b', U: '#ff3366' };
  const COMPLEMENT = { A: 'T', T: 'A', G: 'C', C: 'G' };

  const state = {
    activeSub: '3_1',
    moduleRunning: false,
    dna: 'ATGGCCTTTAAATAG',
    playing: false,
    playT: 0,
    revealCount: 0
  };

  let viewer3d = null;

  function sanitizeDNA(raw) {
    return (raw || '').toUpperCase().replace(/[^ATGC]/g, '').slice(0, 42);
  }

  function transcribe(dna) {
    return dna.split('').map((b) => (b === 'T' ? 'U' : b)).join('');
  }

  function translate(mrna) {
    const chain = [];
    for (let i = 0; i + 3 <= mrna.length; i += 3) {
      const codon = mrna.slice(i, i + 3);
      const aa = CODON_TABLE[codon];
      if (!aa) break;
      const info = AA_INFO[aa] || { c: '#94a3b8', full: aa };
      chain.push({ codon, aa, full: info.full, color: info.c, stop: aa === 'STOP' });
      if (aa === 'STOP') break;
    }
    return chain;
  }

  function mk(geo, mat, pos) {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    return m;
  }

  function buildHelix(root, dna) {
    const g = new THREE.Group();
    const n = dna.length;
    const step = 0.42, radius = 0.85, turnsPerBase = 0.34;
    const backboneMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4 });
    const pathA = [], pathB = [];
    for (let i = 0; i < n; i++) {
      const y = (i - (n - 1) / 2) * step;
      const ang = i * turnsPerBase * Math.PI;
      pathA.push(new THREE.Vector3(Math.cos(ang) * radius, y, Math.sin(ang) * radius));
      pathB.push(new THREE.Vector3(Math.cos(ang + Math.PI) * radius, y, Math.sin(ang + Math.PI) * radius));
    }
    if (n > 1) {
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pathA), Math.max(8, n * 3), 0.045, 6, false), backboneMat));
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pathB), Math.max(8, n * 3), 0.045, 6, false), backboneMat));
    }
    for (let i = 0; i < n; i++) {
      const base = dna[i];
      const comp = COMPLEMENT[base];
      const a = pathA[i], b = pathB[i];
      const rungMat = new THREE.MeshBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.4 });
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, b]), 2, 0.016, 5, false), rungMat));
      const matA = new THREE.MeshStandardMaterial({ color: BASE_COLOR[base], emissive: BASE_COLOR[base], emissiveIntensity: 0.35, roughness: 0.35 });
      const matB = new THREE.MeshStandardMaterial({ color: BASE_COLOR[comp], emissive: BASE_COLOR[comp], emissiveIntensity: 0.35, roughness: 0.35 });
      g.add(mk(new THREE.SphereGeometry(0.1, 12, 10), matA, [a.x, a.y, a.z]));
      g.add(mk(new THREE.SphereGeometry(0.1, 12, 10), matB, [b.x, b.y, b.z]));
    }
    g.position.x = -2.6;
    root.add(g);
    return { group: g, height: n * step };
  }

  const CHAIN_SPACING = 0.95;

  function buildChain(root, chain, visibleCount) {
    const g = new THREE.Group();
    chain.forEach((aa, i) => {
      if (i >= visibleCount) return;
      const mat = new THREE.MeshStandardMaterial({ color: aa.stop ? 0x475569 : aa.color, roughness: 0.4, emissive: aa.stop ? 0x1e293b : aa.color, emissiveIntensity: aa.stop ? 0 : 0.25 });
      const sph = mk(new THREE.SphereGeometry(aa.stop ? 0.12 : 0.24, 16, 12), mat, [i * CHAIN_SPACING, 0, 0]);
      g.add(sph);
      if (i > 0) {
        const bondMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.6 });
        const bond = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, CHAIN_SPACING, 6), bondMat);
        bond.position.set((i - 0.5) * CHAIN_SPACING, 0, 0);
        bond.rotation.z = Math.PI / 2;
        g.add(bond);
      }
      if (!aa.stop) {
        const lb = makeSpriteLabel(aa.aa, '#e2e8f0', 0.3);
        lb.position.set(i * CHAIN_SPACING, 0.55, 0);
        g.add(lb);
      }
    });
    g.position.set(2.2, 0, 0);
    root.add(g);
    return g;
  }

  function rebuildScene() {
    if (!viewer3d) return;
    viewer3d.clear();
    const dna = state.dna || 'ATG';
    const mrna = transcribe(dna);
    const chain = translate(mrna);
    const root = viewer3d.root;
    buildHelix(root, dna);
    const visible = state.playing ? state.revealCount : chain.length;
    buildChain(root, chain, visible);
    // Kamerayı hem sarmalın tam yüksekliğine hem de amino asit zincirinin genişliğine
    // göre geriye çekerek her iki yapının da kesilmeden görünmesini sağla.
    const helixHalfHeight = (dna.length * 0.42) / 2;
    const chainReach = 2.2 + Math.max(0, visible - 1) * CHAIN_SPACING;
    const halfFovRad = (42 / 2) * (Math.PI / 180);
    const dist = Math.max(10, (Math.max(helixHalfHeight, chainReach) / Math.tan(halfFovRad)) * 1.15);
    viewer3d.setDistance(dist);
    viewer3d.onFrame((dt) => {
      if (!state.playing) return;
      state.playT += dt;
      if (state.playT > 0.55 && state.revealCount < chain.length) {
        state.playT = 0;
        state.revealCount++;
        rebuildScene();
        updateInfoPanel(dna, mrna, chain);
        if (state.revealCount >= chain.length) state.playing = false;
      }
    });
  }

  function renderCodonTable(mrna, chain) {
    const box = $('genCodonList');
    if (!box) return;
    if (!chain.length) { box.innerHTML = '<small style="color:var(--muted);">Geçerli bir başlangıç kodonu (AUG) bulunamadı.</small>'; return; }
    box.innerHTML = chain.map((c, i) => `
      <span class="lab-chip" style="color:${c.stop ? 'var(--muted)' : c.color};border-color:${c.stop ? 'var(--border)' : c.color};">
        ${c.codon} → ${c.stop ? 'STOP' : c.aa}
      </span>
    `).join('');
  }

  function updateInfoPanel(dna, mrna, chain) {
    if ($('genDnaStr')) $('genDnaStr').textContent = dna;
    if ($('genMrnaStr')) $('genMrnaStr').textContent = mrna;
    if ($('genProteinLen')) $('genProteinLen').textContent = `${chain.filter((c) => !c.stop).length} amino asit`;
    if ($('genSym')) $('genSym').textContent = `${chain.filter((c) => !c.stop).length}aa`;
    renderCodonTable(mrna, chain);
  }

  function applyDNA(raw) {
    const clean = sanitizeDNA(raw);
    state.dna = clean || 'ATG';
    state.playing = false;
    state.revealCount = translate(transcribe(state.dna)).length;
    if ($('genDnaInput')) $('genDnaInput').value = state.dna;
    rebuildScene();
    updateInfoPanel(state.dna, transcribe(state.dna), translate(transcribe(state.dna)));
  }

  function playAnimation() {
    state.playing = true;
    state.revealCount = 0;
    state.playT = 0.5;
  }

  function switchSubtab(subId) {
    state.activeSub = subId;
    document.querySelectorAll('#mod3 .subtab-btn').forEach((b) => b.classList.toggle('active', b.dataset.sub === subId));
    ['3_1', '3_2', '3_3'].forEach((id) => {
      const pane = $(`mod3_sub_${id}`);
      if (pane) pane.hidden = id !== subId;
    });
    if (viewer3d) viewer3d.setRunning(state.moduleRunning && subId === '3_1');
    window.Mod3Crispr?.setActive(subId === '3_2');
    window.Mod3Biotech?.setActive(subId === '3_3');
  }

  function setRunning(r) {
    state.moduleRunning = r;
    if (viewer3d) viewer3d.setRunning(r && state.activeSub === '3_1');
    window.Mod3Crispr?.setRunning(r);
    window.Mod3Biotech?.setRunning(r);
  }

  function applyPreset(preset) {
    if (preset.sub) switchSubtab(preset.sub);
    if (preset.dna) applyDNA(preset.dna);
    if (preset.sub === '3_2') window.Mod3Crispr?.applyPreset(preset);
    if (preset.sub === '3_3') window.Mod3Biotech?.applyPreset(preset);
    window.AffeBio?.onSubtabChanged();
  }

  const DNA_EXAMPLES = ['ATGGCCTTTAAATAG', 'ATGCATTAGCCGTAA', 'ATGAAACCCGGGTAA', 'ATGTGGGCATTTTAA'];

  function init() {
    viewer3d = createViewer3D($('bioStage3D_3'), { distance: 11, tilt: 0.1, spin: -0.3, minDistance: 4, maxDistance: 40 });

    const examplesBox = $('genDnaExamples');
    if (examplesBox) {
      examplesBox.innerHTML = DNA_EXAMPLES.map((s) => `<span class="lab-chip" data-seq="${s}">${s}</span>`).join('');
      examplesBox.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-seq]');
        if (chip) applyDNA(chip.dataset.seq);
      });
    }

    $('genDnaInput')?.addEventListener('change', (e) => applyDNA(e.target.value));
    $('genTranscribeBtn')?.addEventListener('click', () => applyDNA($('genDnaInput') ? $('genDnaInput').value : state.dna));
    $('genPlayBtn')?.addEventListener('click', playAnimation);

    document.querySelectorAll('#mod3 .subtab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        switchSubtab(btn.dataset.sub);
        window.AffeBio?.onSubtabChanged();
      });
    });

    window.Mod3Crispr?.init();
    window.Mod3Biotech?.init();

    applyDNA(state.dna);
    switchSubtab('3_1');
  }

  window.Mod3Genetics = {
    init,
    switchSubtab,
    applyPreset,
    getActiveSub: () => `bio${state.activeSub}`,
    setRunning
  };
})();
