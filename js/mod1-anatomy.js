/* ============================================================================
   affeBio — MODÜL 1: 3B İnsan Anatomisi Laboratuvarı (GERÇEK VERİ SÜRÜMÜ)
   Kaynak veri: BodyParts3D 4.0 (The Database Center for Life Science, Japonya)
   2.234 gerçek anatomik mesh, 3.432 adlandırılmış FMA kavramı, 15 vücut sistemi.
   Lisans: CC BY 4.0 — kaynak ve lisans metni sahne altında sürekli gösterilir.

   Veri akışı: models/atlas.json (manifest: parça konumları + sınırlayıcı
   kutular) + models/body-N.bin.gz (15 parça, binary mesh verisi, gzip).
   Her .bin dosyası ham bir ArrayBuffer'dır; atlas.json'daki her "part" bu
   buffer içinde bayt ofseti olarak konum/normal/indeks verir (float32 konum,
   normalize edilmiş int16 normal, uint32 indeks). Aynı sisteme ait tüm
   parçalar TEK bir BufferGeometry'de birleştirilir (performans için ~15 çizim
   çağrısı); tıklama seçimi ise birleştirilmiş geometri üzerindeki üçgenin
   orijinal parçaya CPU tarafı bir "partIndex" dizisiyle geri eşlenmesiyle
   yapılır — GPU shader tabanlı patlama/görünürlük sistemi (orijinal referans
   uygulamanın kullandığı) bilinçli olarak basitleştirilmiştir.
   ============================================================================ */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const AD = window.AnatomyData;
  const { createViewer3D } = window.BioCore;

  const MODEL_BASE = 'models/';
  const CHUNK_COUNT = 15;
  const DEFAULT_DIST = 15;
  const TARGET_HEIGHT = 10; // dünya birimi — sahnedeki figürün hedef boyu

  const HIDDEN_BY_DEFAULT = ['integumentary', 'reproductive'];

  // "Bu Dene" görevlerinden gelen kısa isimleri gerçek BodyParts3D parça adlarına eşler.
  const SEARCH_ALIASES = {
    heart: 'wall of ventricle',
    brain: 'midbrain',
    lungs: 'bronch',
    lung: 'bronch'
  };

  const state = {
    activeSub: '1_1',
    loaded: false,
    loadError: null,
    visible: {},
    selectedPartId: null,
    pendingPreset: null
  };

  let viewer3d = null;
  let anatomyGroup = null;
  let highlightBox = null;
  let atlas = null;
  let partsById = new Map();
  let systemParts = {};     // systemId -> Part[]
  let systemMeshes = {};    // systemId -> THREE.Mesh (birleştirilmiş)
  let modelScale = 1;
  let modelCenter = { x: 0, y: 0, z: 0 };
  let raycaster, pointerNDC;

  /* --------------------------------------------------------------------------
     1. VERİ İNDİRME & GZIP ÇÖZME (orijinal referans uygulamadaki ile aynı mantık)
     -------------------------------------------------------------------------- */
  async function fetchAndDecode(url, expectedBytes) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('İndirilemedi: ' + url);
    const payload = await res.arrayBuffer();
    const sig = new Uint8Array(payload, 0, Math.min(2, payload.byteLength));
    const isGzip = sig[0] === 0x1f && sig[1] === 0x8b;
    let buffer = payload;
    if (isGzip) {
      if (typeof DecompressionStream === 'undefined') {
        throw new Error('Bu tarayıcı gzip çözmeyi (DecompressionStream) desteklemiyor. Lütfen güncel bir Chrome/Edge kullanın.');
      }
      const stream = new Blob([payload]).stream().pipeThrough(new DecompressionStream('gzip'));
      buffer = await new Response(stream).arrayBuffer();
    }
    if (expectedBytes && buffer.byteLength !== expectedBytes) {
      throw new Error('Veri parçası eksik indi: ' + url);
    }
    return buffer;
  }

  function setLoadProgress(done, total, label) {
    const bar = $('anatLoadBar');
    const text = $('anatLoadText');
    if (bar) bar.style.width = Math.round((done / total) * 100) + '%';
    if (text) text.textContent = label;
  }

  function showLoadError(message) {
    const box = $('anatLoadBox');
    const text = $('anatLoadText');
    if (box) box.classList.add('is-error');
    if (text) text.textContent = '⚠️ ' + message;
    const status = $('anatLoadStatus');
    if (status) status.textContent = 'Veri yüklenemedi';
  }

  async function loadAtlas() {
    setLoadProgress(0, CHUNK_COUNT + 1, 'Manifest (atlas.json) indiriliyor…');
    const res = await fetch(MODEL_BASE + 'atlas.json');
    if (!res.ok) throw new Error('atlas.json indirilemedi');
    atlas = await res.json();

    let done = 1;
    setLoadProgress(done, CHUNK_COUNT + 1, `Manifest alındı: ${atlas.parts.length} yapı, ${atlas.chunks.length} veri parçası. İndiriliyor…`);

    const chunkBuffers = new Array(atlas.chunks.length);
    await Promise.all(atlas.chunks.map(async (chunkInfo, idx) => {
      const gzName = (chunkInfo.gzip || chunkInfo.url).split('/').pop();
      const buf = await fetchAndDecode(MODEL_BASE + gzName, chunkInfo.bytes);
      chunkBuffers[idx] = buf;
      done++;
      setLoadProgress(done, CHUNK_COUNT + 1, `Veri parçaları indiriliyor… (${done - 1}/${atlas.chunks.length})`);
    }));

    setLoadProgress(CHUNK_COUNT + 1, CHUNK_COUNT + 1, 'Geometriler sistem başına birleştiriliyor…');
    return chunkBuffers;
  }

  /* --------------------------------------------------------------------------
     2. SİSTEM BAŞINA BİRLEŞTİRİLMİŞ GEOMETRİ İNŞASI
     -------------------------------------------------------------------------- */
  function buildSystemGeometries(chunkBuffers) {
    systemParts = {};
    atlas.parts.forEach((p) => {
      partsById.set(p.id, p);
      (systemParts[p.system] = systemParts[p.system] || []).push(p);
    });

    const meshes = {};
    Object.keys(systemParts).forEach((sysId) => {
      const parts = systemParts[sysId];
      let totalVerts = 0, totalIdx = 0;
      parts.forEach((p) => { totalVerts += p.vertexCount; totalIdx += p.indexCount; });

      const positions = new Float32Array(totalVerts * 3);
      const normals = new Float32Array(totalVerts * 3);
      const partIndexOfVertex = new Int32Array(totalVerts);
      const indices = new Uint32Array(totalIdx);

      let vOff = 0, iOff = 0;
      parts.forEach((p, localIdx) => {
        const buf = chunkBuffers[p.chunk];
        const posArr = new Float32Array(buf, p.positions, p.vertexCount * 3);
        const normArr = new Int16Array(buf, p.normals, p.vertexCount * 3);
        const idxArr = new Uint32Array(buf, p.indices, p.indexCount);

        positions.set(posArr, vOff * 3);
        for (let k = 0; k < normArr.length; k++) normals[vOff * 3 + k] = normArr[k] / 32767;
        for (let k = 0; k < idxArr.length; k++) indices[iOff + k] = idxArr[k] + vOff;
        for (let k = 0; k < p.vertexCount; k++) partIndexOfVertex[vOff + k] = localIdx;

        vOff += p.vertexCount;
        iOff += idxArr.length;
      });

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      geo.setIndex(new THREE.BufferAttribute(indices, 1));

      const sysInfo = AD.SYSTEMS.find((s) => s.id === sysId);
      const color = sysInfo ? sysInfo.color : '#9aa7b1';
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.06, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.system = sysId;
      mesh.userData.parts = parts;
      mesh.userData.partIndexOfVertex = partIndexOfVertex;
      mesh.visible = !HIDDEN_BY_DEFAULT.includes(sysId);
      meshes[sysId] = mesh;
    });
    return meshes;
  }

  function computeGlobalBoundsCenter() {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    atlas.parts.forEach((p) => {
      const [bMin, bMax] = p.bounds;
      if (bMin[0] < minX) minX = bMin[0];
      if (bMin[1] < minY) minY = bMin[1];
      if (bMin[2] < minZ) minZ = bMin[2];
      if (bMax[0] > maxX) maxX = bMax[0];
      if (bMax[1] > maxY) maxY = bMax[1];
      if (bMax[2] > maxZ) maxZ = bMax[2];
    });
    const height = Math.max(0.1, maxY - minY);
    modelScale = TARGET_HEIGHT / height;
    modelCenter = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 };
  }

  /* --------------------------------------------------------------------------
     3. SAHNE İNŞASI
     -------------------------------------------------------------------------- */
  function rebuildScene() {
    if (!viewer3d) return;
    viewer3d.clear();
    anatomyGroup = new THREE.Group();
    anatomyGroup.scale.setScalar(modelScale);
    anatomyGroup.position.set(-modelScale * modelCenter.x, -modelScale * modelCenter.y, -modelScale * modelCenter.z);
    Object.keys(systemMeshes).forEach((sysId) => {
      state.visible[sysId] = systemMeshes[sysId].visible;
      anatomyGroup.add(systemMeshes[sysId]);
    });
    viewer3d.root.add(anatomyGroup);
  }

  function clearHighlight() {
    if (highlightBox && anatomyGroup) {
      anatomyGroup.remove(highlightBox);
      highlightBox.geometry.dispose();
      highlightBox.material.dispose();
      highlightBox = null;
    }
  }

  function highlightPart(part) {
    clearHighlight();
    if (!part || !anatomyGroup) return;
    const [bMin, bMax] = part.bounds;
    const box = new THREE.Box3(
      new THREE.Vector3(bMin[0], bMin[1], bMin[2]),
      new THREE.Vector3(bMax[0], bMax[1], bMax[2])
    );
    highlightBox = new THREE.Box3Helper(box, 0x00e8a8);
    highlightBox.material.transparent = true;
    highlightBox.material.depthTest = false;
    anatomyGroup.add(highlightBox);
  }

  /* --------------------------------------------------------------------------
     4. SEÇİM / BİLGİ KARTI / ARAMA
     -------------------------------------------------------------------------- */
  function systemLabel(sysId) {
    const s = AD.SYSTEMS.find((x) => x.id === sysId);
    return s ? s.name : sysId;
  }

  function selectPart(part, opts) {
    opts = opts || {};
    if (!part) return;
    state.selectedPartId = part.id;
    highlightPart(part);

    if ($('anatInfoTitle')) $('anatInfoTitle').textContent = part.name;
    if ($('anatInfoSystem')) $('anatInfoSystem').textContent = systemLabel(part.system);
    if ($('anatInfoText')) $('anatInfoText').textContent = AD.explanationFor(part.name, part.system);
    if ($('anatInfoCard')) $('anatInfoCard').hidden = false;

    if (!opts.skipZoom && viewer3d) viewer3d.setDistance(6.5);
  }

  function clearSelection() {
    state.selectedPartId = null;
    clearHighlight();
    if ($('anatInfoCard')) $('anatInfoCard').hidden = true;
  }

  function setSystemVisible(sysId, visible) {
    const mesh = systemMeshes[sysId];
    if (!mesh) return;
    mesh.visible = visible;
    state.visible[sysId] = visible;
  }

  function renderSystemLegend() {
    const box = $('anatSystemLegend');
    if (!box) return;
    const systemsPresent = AD.SYSTEMS.filter((s) => systemMeshes[s.id]);
    box.innerHTML = systemsPresent.map((s) => {
      const count = (systemParts[s.id] || []).length;
      const off = state.visible[s.id] === false ? ' off' : '';
      return `<span class="lab-legend-chip${off}" data-key="${s.id}" title="${count} yapı"><i class="sw" style="background:${s.color};box-shadow:0 0 6px ${s.color};"></i>${s.name}</span>`;
    }).join('');
  }

  function renderSearchResults(query) {
    const box = $('anatSearchResults');
    if (!box) return;
    const q = query.trim().toLowerCase();
    if (q.length < 2) { box.innerHTML = ''; return; }
    const matches = atlas.parts
      .filter((p) => p.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.length - b.name.length)
      .slice(0, 60);
    if (!matches.length) {
      box.innerHTML = '<p style="font-size:11.5px;color:var(--muted);padding:6px 2px;">Eşleşme bulunamadı.</p>';
      return;
    }
    box.innerHTML = matches.map((p) => `
      <button class="lab-card${state.selectedPartId === p.id ? ' active' : ''}" data-partid="${p.id}">
        <b style="color:${(AD.SYSTEMS.find((s) => s.id === p.system) || {}).color || '#9aa7b1'};">${p.name}</b>
        <small>${systemLabel(p.system)}</small>
      </button>
    `).join('');
  }

  function resolveQueryToPart(query) {
    const aliased = SEARCH_ALIASES[query.toLowerCase().trim()] || query;
    const q = aliased.toLowerCase().trim();
    const exact = atlas.parts.find((p) => p.name.toLowerCase() === q);
    if (exact) return exact;
    const matches = atlas.parts.filter((p) => p.name.toLowerCase().includes(q));
    if (!matches.length) return null;
    matches.sort((a, b) => a.name.length - b.name.length);
    return matches[0];
  }

  /* --------------------------------------------------------------------------
     5. RAYCAST TIKLAMA SEÇİMİ
     -------------------------------------------------------------------------- */
  function initRaycastPicking() {
    if (!viewer3d) return;
    raycaster = new THREE.Raycaster();
    pointerNDC = new THREE.Vector2();
    const dom = viewer3d.renderer.domElement;
    let downX = 0, downY = 0;
    dom.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; });
    dom.addEventListener('pointerup', (e) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
      if (!state.loaded) return;
      const rect = dom.getBoundingClientRect();
      pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNDC, viewer3d.camera);
      const meshes = Object.values(systemMeshes).filter((m) => m.visible);
      const hit = raycaster.intersectObjects(meshes, false)[0];
      if (!hit || !hit.face) return;
      const mesh = hit.object;
      const localIdx = mesh.userData.partIndexOfVertex[hit.face.a];
      const part = mesh.userData.parts[localIdx];
      if (part) selectPart(part, { skipZoom: true });
    });
  }

  /* --------------------------------------------------------------------------
     6. UI OLAYLARI
     -------------------------------------------------------------------------- */
  function wireUI() {
    $('anatSystemLegend')?.addEventListener('click', (e) => {
      const chip = e.target.closest('.lab-legend-chip');
      if (!chip) return;
      const sysId = chip.dataset.key;
      const next = !(state.visible[sysId] !== false);
      setSystemVisible(sysId, next);
      renderSystemLegend();
    });

    $('anatSearchInput')?.addEventListener('input', (e) => renderSearchResults(e.target.value));

    $('anatSearchResults')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-partid]');
      if (!btn) return;
      const part = partsById.get(btn.dataset.partid);
      if (!part) return;
      setSystemVisible(part.system, true);
      renderSystemLegend();
      selectPart(part);
      renderSearchResults($('anatSearchInput').value);
    });

    $('anatResetViewBtn')?.addEventListener('click', () => {
      clearSelection();
      if (viewer3d) viewer3d.setDistance(DEFAULT_DIST);
    });
  }

  /* --------------------------------------------------------------------------
     7. YÜKLEME AKIŞI
     -------------------------------------------------------------------------- */
  async function loadAll() {
    try {
      const chunkBuffers = await loadAtlas();
      systemMeshes = buildSystemGeometries(chunkBuffers);
      computeGlobalBoundsCenter();
      rebuildScene();
      renderSystemLegend();
      state.loaded = true;

      const overlay = $('anatLoadOverlay');
      if (overlay) overlay.remove();
      const status = $('anatLoadStatus');
      if (status) status.textContent = `🖱️ Döndürmek için sürükleyin · ${atlas.parts.length} gerçek yapıdan birine tıklayın`;

      if (state.pendingPreset) {
        applyPreset(state.pendingPreset);
        state.pendingPreset = null;
      }
    } catch (err) {
      console.error('[affeBio] Anatomi verisi yüklenemedi:', err);
      state.loadError = err.message || String(err);
      showLoadError(state.loadError);
    }
  }

  /* --------------------------------------------------------------------------
     8. DIŞA AÇILAN API
     -------------------------------------------------------------------------- */
  function switchSubtab(subId) {
    state.activeSub = subId;
  }

  function applyPreset(preset) {
    if (!state.loaded) { state.pendingPreset = preset; return; }
    if (preset.focusOrgan) {
      const part = resolveQueryToPart(preset.focusOrgan);
      if (part) {
        setSystemVisible(part.system, true);
        renderSystemLegend();
        selectPart(part);
      }
    }
  }

  function init() {
    viewer3d = createViewer3D($('bioStage3D_1'), { distance: DEFAULT_DIST, tilt: 0.06, spin: -0.4, minDistance: 2.5, maxDistance: 45 });
    initRaycastPicking();
    wireUI();
    if ($('anatAttributionTr')) $('anatAttributionTr').textContent = AD.ATTRIBUTION_TR;
    if ($('anatAttributionEn')) $('anatAttributionEn').innerHTML = `${AD.ATTRIBUTION_EN} <a href="${AD.ATTRIBUTION_URL}" target="_blank" rel="noopener" style="color:var(--cyan);">Lisans ↗</a>`;
    loadAll();
  }

  window.Mod1Anatomy = {
    init,
    switchSubtab,
    applyPreset,
    getActiveSub: () => 'bio1_1',
    setRunning: (r) => viewer3d && viewer3d.setRunning(r)
  };
})();
