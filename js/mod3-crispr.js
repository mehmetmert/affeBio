/* ============================================================================
   affeBio — MODÜL 3.2: CRISPR-Cas9 Kavramsal Laboratuvarı
   Kısaltılmış, ŞEMATİK bir eğitim dizisi üzerinde (gerçek bir genom dizisi
   değildir) ders kitabı düzeyindeki mantığı adım adım gösterir:
   (1) PAM kuralıyla rehber RNA seçimi, (2) Cas9 taraması + R-döngüsü,
   (3) PAM'in 3 bç yukarısında küt kesim, (4) NHEJ ya da HDR onarımı ve
   bunun okuma çerçevesine / proteine etkisi (6. kodon: GAG↔GTG, Glu↔Val).
   ============================================================================ */
(function () {
  'use strict';

  const { CODON_TABLE } = window.BioData;
  const { fitCanvas } = window.BioCore;
  const $ = (id) => document.getElementById(id);

  const BASE_COLOR = { A: '#00e8a8', T: '#ff3366', G: '#a855f7', C: '#f59e0b', U: '#ff3366' };
  const COMP = { A: 'T', T: 'A', G: 'C', C: 'G' };

  // Şematik eğitim dizisi: 13 kodon, 6. kodon mutant GTG (Val). Sağlıklı halde GAG (Glu).
  const MUTANT = 'ATGGCTAACCTTACAGTGGAAGGTAAATCCGCATGGTAA';
  const MUT_INDEX = 16;
  const HEALTHY = MUTANT.slice(0, MUT_INDEX) + 'A' + MUTANT.slice(MUT_INDEX + 1);
  const CODON6 = [15, 16, 17];
  const SILENT_INDEX = 14; // ACA→ACC (Thr→Thr): tohum bölgesinde sessiz değişiklik

  // Aday pencereler (20 nt). pamAt = pencerenin hemen 3′ ucundaki 3 bazın başlangıcı.
  const CANDIDATES = [
    { id: 'C', start: 5 },
    { id: 'A', start: 0 },
    { id: 'D', start: 16 },
    { id: 'B', start: 13 }
  ].map((c) => {
    const pamAt = c.start + 20;
    const pam = MUTANT.slice(pamAt, pamAt + 3);
    const valid = pam.length === 3 && pam[1] === 'G' && pam[2] === 'G';
    return { ...c, pamAt, pam, valid, cutAfter: pamAt - 4, seq: MUTANT.slice(c.start, c.start + 20) };
  });

  const STEPS = [
    { title: 'Rehber RNA seçimi', dur: 0 },
    { title: 'Tarama ve bağlanma', dur: 3200 },
    { title: 'Çift zincir kesimi', dur: 1400 },
    { title: 'Hücresel onarım', dur: 1600 }
  ];

  const state = {
    active: false,
    running: true,
    step: 0,
    guideId: null,
    repair: null,
    nhejSeed: 7,
    stepStart: 0,
    raf: null,
    timers: []
  };

  let canvas = null;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function guide() { return CANDIDATES.find((c) => c.id === state.guideId) || null; }

  function translate(dna) {
    const out = [];
    for (let i = 0; i + 3 <= dna.length; i += 3) {
      const codon = dna.slice(i, i + 3).replace(/T/g, 'U');
      const aa = CODON_TABLE[codon] || '?';
      out.push({ codon, aa, stop: aa === 'STOP' });
      if (aa === 'STOP') break;
    }
    return out;
  }

  /* --------------------------------------------------------------------------
     ONARIM SONUCU
     -------------------------------------------------------------------------- */
  function computeRepair() {
    const g = guide();
    if (!g || !state.repair) return null;
    const cut = g.cutAfter;
    if (state.repair === 'hdr') {
      const dist = Math.abs(cut - MUT_INDEX);
      const chars = MUTANT.split('');
      chars[MUT_INDEX] = 'A';
      const silent = dist <= 6;
      if (silent) chars[SILENT_INDEX] = 'C';
      const seq = chars.join('');
      const changed = [MUT_INDEX].concat(silent ? [SILENT_INDEX] : []);
      const eff = Math.round(45 * Math.exp(-dist / 8));
      return { kind: 'hdr', seq, changed, inserted: [], deletedAt: null, delta: 0, dist, eff, silent };
    }
    const rnd = mulberry32(state.nhejSeed * 9973 + cut);
    const r = rnd();
    let delta;
    if (r < 0.36) delta = -1; else if (r < 0.66) delta = 1; else if (r < 0.86) delta = -2; else delta = -3;
    let seq, inserted = [], deletedAt = null;
    if (delta > 0) {
      const b = 'ACGT'[Math.floor(rnd() * 4)];
      seq = MUTANT.slice(0, cut + 1) + b + MUTANT.slice(cut + 1);
      inserted = [cut + 1];
    } else {
      seq = MUTANT.slice(0, cut + 1) + MUTANT.slice(cut + 1 - delta);
      deletedAt = cut + 1;
    }
    return { kind: 'nhej', seq, changed: [], inserted, deletedAt, delta };
  }

  /* --------------------------------------------------------------------------
     ÇİZİM
     -------------------------------------------------------------------------- */
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function stepProgress() {
    const dur = STEPS[state.step].dur;
    if (!dur) return 1;
    return Math.min(1, (performance.now() - state.stepStart) / dur);
  }

  function drawLetter(ctx, ch, x, y, size, color, alpha) {
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = color;
    ctx.fillText(ch, x, y);
    ctx.globalAlpha = 1;
  }

  function draw() {
    if (!canvas) return;
    const fc = fitCanvas(canvas);
    if (!fc) return;
    const { ctx, w, h } = fc;
    ctx.clearRect(0, 0, w, h);

    const g = guide();
    const result = state.step >= 3 ? computeRepair() : null;
    const seq = result ? result.seq : MUTANT;
    const N = seq.length;
    const cw = Math.max(11, Math.min(24, (w - 50) / (N + 1)));
    const x0 = (w - cw * N) / 2;
    const yTop = h * 0.34;
    const yBot = h * 0.34 + Math.max(42, cw * 2.3);
    const font = Math.round(cw * 0.72);
    const p = easeInOut(stepProgress());

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = `600 ${Math.max(10, Math.round(cw * 0.48))}px Inter, sans-serif`;
    ctx.fillStyle = '#64748b';
    ctx.fillText('Şematik eğitim dizisi · üst: kodlayan zincir 5′→3′ · alt: kalıp zincir 3′→5′', w / 2, yBot + cw * 5.4);

    const xOf = (i) => x0 + (i + 0.5) * cw;

    // Bağlanma/kesim sonrası kayma
    let sep = 0;
    if (g && state.step === 1) sep = Math.max(0, (p - 0.55) / 0.45);
    if (g && state.step === 2) sep = 1;
    const sepPx = sep * 18;
    const dropPx = sep * 32;
    const cutGap = g && state.step === 2 ? p * 10 : (g && state.step === 3 && !result ? 10 : 0);
    const inWindow = (i) => g && i >= g.start && i < g.start + 20;
    const shiftX = (i) => (g && cutGap && i > g.cutAfter ? cutGap : 0);

    // Kodon parantezleri
    ctx.font = `600 ${Math.max(9, Math.round(cw * 0.42))}px "JetBrains Mono", monospace`;
    for (let c = 0; c * 3 < N; c++) {
      const i0 = c * 3, i1 = Math.min(N - 1, c * 3 + 2);
      const xa = x0 + i0 * cw + 2 + shiftX(i0), xb = x0 + (i1 + 1) * cw - 2 + shiftX(i1);
      const isC6 = c === 5;
      ctx.strokeStyle = isC6 ? '#f59e0b' : 'rgba(148,163,184,0.35)';
      ctx.lineWidth = isC6 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(xa, yTop - cw * 1.25 - sepPx); ctx.lineTo(xa, yTop - cw * 1.45 - sepPx);
      ctx.lineTo(xb, yTop - cw * 1.45 - sepPx); ctx.lineTo(xb, yTop - cw * 1.25 - sepPx);
      ctx.stroke();
      ctx.fillStyle = isC6 ? '#f59e0b' : '#64748b';
      ctx.fillText(String(c + 1), (xa + xb) / 2, yTop - cw * 1.8 - sepPx);
    }

    // Aday pencere / PAM vurguları (adım 0 ve sonrası)
    if (g && state.step < 3) {
      const wx = x0 + g.start * cw, wwid = 20 * cw;
      ctx.fillStyle = g.valid ? 'rgba(0,232,168,0.12)' : 'rgba(255,51,102,0.12)';
      ctx.fillRect(wx, yTop - cw * 0.75 - sepPx, wwid + (cutGap ? cutGap : 0), cw * 1.5);
      if (g.pam.length === 3) {
        ctx.fillStyle = g.valid ? 'rgba(245,158,11,0.22)' : 'rgba(148,163,184,0.18)';
        ctx.fillRect(x0 + g.pamAt * cw + shiftX(g.pamAt), yTop - cw * 0.75, 3 * cw, cw * 1.5);
        ctx.fillStyle = g.valid ? '#f59e0b' : '#94a3b8';
        ctx.font = `700 ${Math.max(9, Math.round(cw * 0.45))}px Inter, sans-serif`;
        ctx.fillText(g.valid ? 'PAM (NGG)' : `${g.pam} ≠ NGG`, x0 + (g.pamAt + 1.5) * cw + shiftX(g.pamAt), yBot + cw * 1.2);
      }
    }

    // Sarmal omurgaları
    ctx.strokeStyle = 'rgba(148,163,184,0.55)';
    ctx.lineWidth = 2;
    const drawBackbone = (y, off) => {
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const lift = inWindow(i) ? off : 0;
        const x = xOf(i) + shiftX(i);
        if (i === 0) ctx.moveTo(x - cw / 2, y + lift);
        if (g && cutGap && i === g.cutAfter + 1) { ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - cw / 2, y + lift); }
        ctx.lineTo(x, y + lift);
      }
      ctx.stroke();
    };
    drawBackbone(yTop + cw * 0.62, -sepPx);
    drawBackbone(yBot - cw * 0.62, dropPx);

    // Bazlar
    ctx.font = `800 ${font}px "JetBrains Mono", monospace`;
    for (let i = 0; i < N; i++) {
      const x = xOf(i) + shiftX(i);
      const top = seq[i];
      const lift = inWindow(i) ? sepPx : 0;
      if (result && (result.changed.includes(i) || result.inserted.includes(i))) {
        ctx.fillStyle = result.kind === 'hdr' ? 'rgba(0,232,168,0.28)' : 'rgba(255,51,102,0.3)';
        ctx.fillRect(x - cw / 2 + 1, yTop - cw * 0.7, cw - 2, (yBot - yTop) + cw * 1.4);
      }
      drawLetter(ctx, top, x, yTop - lift, font, BASE_COLOR[top]);
      drawLetter(ctx, COMP[top], x, yBot + (inWindow(i) ? dropPx : 0), font, BASE_COLOR[COMP[top]], 0.85);
      if (!inWindow(i) || sep < 0.2) {
        ctx.strokeStyle = 'rgba(148,163,184,0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, yTop + cw * 0.5); ctx.lineTo(x, yBot - cw * 0.5); ctx.stroke();
      }
    }
    if (result && result.deletedAt != null) {
      const x = x0 + result.deletedAt * cw;
      ctx.fillStyle = '#ff3366';
      ctx.font = `800 ${Math.max(10, Math.round(cw * 0.6))}px Inter, sans-serif`;
      ctx.fillText(`▼ Δ${-result.delta}`, x, yTop - cw * 2.75);
    }

    // gRNA (kalıp zincirle eşleşir)
    if (g && g.valid && (state.step === 1 || state.step === 2)) {
      const a = state.step === 1 ? Math.max(0, (p - 0.55) / 0.45) : 1;
      const gy = yBot + dropPx - cw * 1.05;
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(226,232,240,0.1)';
      ctx.strokeStyle = 'rgba(226,232,240,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const gx = x0 + g.start * cw + 1, gw = 20 * cw - 2 + (g.cutAfter < g.start + 20 ? cutGap : 0);
      if (ctx.roundRect) ctx.roundRect(gx, gy - cw * 0.5, gw, cw, cw * 0.4); else ctx.rect(gx, gy - cw * 0.5, gw, cw);
      ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.font = `800 ${Math.round(font * 0.85)}px "JetBrains Mono", monospace`;
      for (let i = g.start; i < g.start + 20; i++) {
        const ch = MUTANT[i] === 'T' ? 'U' : MUTANT[i];
        drawLetter(ctx, ch, xOf(i) + shiftX(i), gy, font, '#f8fafc', a);
      }
      ctx.globalAlpha = a;
      ctx.fillStyle = '#e2e8f0';
      ctx.font = `700 ${Math.max(9, Math.round(cw * 0.45))}px Inter, sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText('gRNA', Math.max(30, x0 + g.start * cw - 5), gy);
      ctx.textAlign = 'center';
      ctx.globalAlpha = 1;
    }

    // Cas9 kompleksi
    if (g && g.valid && (state.step === 1 || state.step === 2)) {
      const targetCx = x0 + (g.start + 11.5) * cw;
      const startCx = x0 - cw * 4;
      const t = state.step === 1 ? Math.min(1, p / 0.55) : 1;
      const cx = startCx + (targetCx - startCx) * t;
      const rx = 12.5 * cw, ry = (yBot - yTop) / 2 + cw * 2.3;
      const cy = (yTop + yBot) / 2;
      ctx.fillStyle = 'rgba(168,85,247,0.13)';
      ctx.strokeStyle = 'rgba(168,85,247,0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c084fc';
      ctx.font = `800 ${Math.max(11, Math.round(cw * 0.6))}px Inter, sans-serif`;
      ctx.fillText(t < 1 ? 'Cas9 · PAM arıyor…' : 'Cas9 bağlandı', cx, cy + ry + 14);
    }

    // Kesim işareti
    if (g && g.valid && state.step >= 2 && !result) {
      const xc = x0 + (g.cutAfter + 1) * cw + cutGap / 2;
      ctx.strokeStyle = '#ff3366';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(xc, yTop - cw * 2.6); ctx.lineTo(xc, yBot + cw * 1.6); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `${Math.round(cw * 1.1)}px sans-serif`;
      ctx.fillText('✂', xc, yTop - cw * 3.4);
    }

    // Protein satırı (sahne altında)
    const prot = translate(seq);
    const pyy = h - 46;
    ctx.font = `700 ${Math.max(10, Math.round(cw * 0.5))}px "JetBrains Mono", monospace`;
    const pw = Math.min(64, (w - 40) / Math.max(13, prot.length));
    const px0 = (w - pw * prot.length) / 2;
    prot.forEach((aa, i) => {
      const x = px0 + i * pw;
      const isC6 = i === 5;
      ctx.fillStyle = aa.stop ? 'rgba(100,116,139,0.35)' : (isC6 ? 'rgba(245,158,11,0.25)' : 'rgba(0,232,168,0.1)');
      ctx.strokeStyle = isC6 ? '#f59e0b' : 'rgba(148,163,184,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x + 2, pyy - 13, pw - 4, 26, 6) : ctx.rect(x + 2, pyy - 13, pw - 4, 26);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = aa.stop ? '#94a3b8' : (isC6 ? '#fbbf24' : '#e2e8f0');
      ctx.fillText(aa.stop ? 'STOP' : aa.aa, x + pw / 2, pyy);
    });
    ctx.fillStyle = '#64748b';
    ctx.font = `600 10.5px Inter, sans-serif`;
    ctx.fillText('Bu dizinin çevrildiği protein (6. amino asit vurgulu)', w / 2, pyy - 26);
  }

  function loop() {
    state.raf = null;
    if (!state.active || !state.running) return;
    draw();
    state.raf = requestAnimationFrame(loop);
  }
  function startLoop() { if (!state.raf && state.active && state.running) state.raf = requestAnimationFrame(loop); }

  /* --------------------------------------------------------------------------
     PANEL
     -------------------------------------------------------------------------- */
  function chipRow(prot, ref) {
    return prot.map((aa, i) => {
      const diff = ref && ref[i] && ref[i].aa !== aa.aa;
      const c6 = i === 5;
      const style = c6 ? 'border-color:#f59e0b;color:#fbbf24;' : (diff ? 'border-color:#ff3366;color:#fda4af;' : '');
      return `<span class="lab-chip" style="${style}">${aa.stop ? 'STOP' : aa.aa}</span>`;
    }).join('');
  }

  const CAPTIONS = [
    'Cas9, rehber RNA\'nın 20 nükleotitlik dizisini ancak hemen 3′ ucunda <b>NGG</b> (PAM) bulunan bir bölgede kullanabilir. Soldan bir aday pencere seçin.',
    'Cas9–gRNA kompleksi DNA boyunca PAM dizilerini tarar. Uygun PAM\'e oturunca DNA açılır (R-döngüsü) ve gRNA kalıp zincirle baz eşleşmesi yapar.',
    'Eşleşme tamamlanınca Cas9\'un iki kesim bölgesi (HNH ve RuvC) iki zinciri de PAM\'in 3 baz yukarısından keser: küt uçlu çift zincir kırığı.',
    'Hücre kırığı onarır. NHEJ hızlı ama hataya açıktır (küçük ekleme/silmeler); HDR ise verilen şablonu kopyalayarak hassas düzeltme yapar.'
  ];

  function updatePanel() {
    const g = guide();
    const result = state.step >= 3 ? computeRepair() : null;

    const list = $('crisprGuideList');
    if (list) {
      list.innerHTML = CANDIDATES.map((c) => `
        <button class="lab-card${state.guideId === c.id ? ' active' : ''}" data-guide="${c.id}">
          <b class="crispr-mono">${c.id} · ${c.seq}<span style="color:${c.valid ? '#f59e0b' : '#64748b'};"> ${c.pam || '—'}</span></b>
          <small>Konum ${c.start + 1}–${c.start + 20} · ${c.valid ? 'PAM uygun' : 'PAM yok'}</small>
        </button>`).join('');
    }

    const msg = $('crisprGuideMsg');
    if (msg) {
      if (!g) msg.innerHTML = '<span style="color:var(--muted);">Henüz bir aday seçilmedi.</span>';
      else if (!g.valid) msg.innerHTML = `<span style="color:#fda4af;">✗ Geçersiz: pencerenin hemen ardından gelen <b>${g.pam || 'dizi sonu'}</b>, NGG kalıbına uymuyor. Cas9 bu bölgeye bağlanamaz.</span>`;
      else {
        const d = Math.abs(g.cutAfter - MUT_INDEX);
        msg.innerHTML = `<span style="color:var(--cyan);">✓ Geçerli: PAM = <b>${g.pam}</b>. Kesim ${g.cutAfter + 1}. ve ${g.cutAfter + 2}. bazlar arasında; mutasyona uzaklık <b>${d} bç</b>${d <= 3 ? ' (ideal)' : ' (uzak — HDR verimi düşer)'}.</span>`;
      }
    }

    const steps = $('crisprStepList');
    if (steps) {
      steps.innerHTML = STEPS.map((s, i) => `<li class="${i === state.step ? 'active' : (i < state.step ? 'done' : '')}">${i + 1}. ${s.title}</li>`).join('');
    }
    if ($('crisprStepBadge')) $('crisprStepBadge').textContent = `${state.step + 1}/4`;
    if ($('crisprBackBtn')) $('crisprBackBtn').disabled = state.step === 0;
    if ($('crisprNextBtn')) $('crisprNextBtn').disabled = state.step >= 3 || !g || !g.valid;
    if ($('crisprCaption')) $('crisprCaption').innerHTML = CAPTIONS[state.step];

    const repairSec = $('crisprRepairSection');
    if (repairSec) repairSec.classList.toggle('is-locked', state.step < 3);
    document.querySelectorAll('#mod3_sub_3_2 [data-repair]').forEach((b) => b.classList.toggle('active', b.dataset.repair === state.repair));
    if ($('crisprRetryBtn')) $('crisprRetryBtn').disabled = !(state.step >= 3 && state.repair === 'nhej');

    const hint = $('crisprRepairHint');
    if (hint) {
      if (state.step < 3) hint.textContent = 'Onarım yolu, kesim adımından sonra seçilebilir.';
      else if (!state.repair) hint.textContent = 'Bir onarım yolu seçin.';
      else if (state.repair === 'hdr') hint.innerHTML = 'Donör şablon 6. kodonu <b>GTG→GAG</b> yapar' + (result && result.silent ? '; sessiz <b>ACA→ACC</b> (Thr) değişikliği yeniden kesimi önler.' : '.');
      else hint.textContent = 'NHEJ uçları doğrudan birleştirir; her denemede farklı bir ekleme/silme olabilir.';
    }

    const before = translate(MUTANT);
    const healthy = translate(HEALTHY);
    if ($('crisprProtHealthy')) $('crisprProtHealthy').innerHTML = chipRow(healthy);
    if ($('crisprProtBefore')) $('crisprProtBefore').innerHTML = chipRow(before, healthy);
    const afterSeq = result ? result.seq : null;
    const after = afterSeq ? translate(afterSeq) : null;
    if ($('crisprProtAfter')) $('crisprProtAfter').innerHTML = after ? chipRow(after, healthy) : '<small style="color:var(--muted);">Onarım sonrası burada görünecek.</small>';
    if ($('crisprMrnaAfter')) $('crisprMrnaAfter').textContent = (afterSeq || MUTANT).replace(/T/g, 'U');

    if ($('crisprTelGuide')) $('crisprTelGuide').textContent = g ? `${g.id} (${g.start + 1}–${g.start + 20})` : '—';
    if ($('crisprTelPam')) $('crisprTelPam').textContent = g ? `${g.pam || '—'} ${g.valid ? '✓' : '✗'}` : '—';
    if ($('crisprTelCut')) $('crisprTelCut').textContent = g && g.valid ? `${g.cutAfter + 1} | ${g.cutAfter + 2}` : '—';
    const c6 = (after || before)[5];
    if ($('crisprTelCodon6')) $('crisprTelCodon6').textContent = c6 ? `${c6.codon} → ${c6.stop ? 'STOP' : c6.aa}` : '—';
    if ($('crisprTelFrame')) $('crisprTelFrame').textContent = result ? (result.delta % 3 === 0 ? 'Korundu' : `Kaydı (${result.delta > 0 ? '+' : ''}${result.delta})`) : 'Korundu';
    const protLen = (after || before).filter((a) => !a.stop).length;
    if ($('crisprTelLen')) $('crisprTelLen').textContent = `${protLen} aa`;

    const outcome = $('crisprOutcome');
    if (outcome) {
      if (!result) {
        outcome.innerHTML = '<span style="color:var(--muted);">Başlangıç: 6. kodon GTG → <b>Val</b>. Sağlıklı halde GAG → <b>Glu</b>. Bu tek baz farkı, orak hücre hastalığındaki değişimin mantığını temsil eder.</span>';
      } else if (result.kind === 'hdr') {
        outcome.innerHTML = `<span style="color:var(--cyan);">✓ Hassas düzeltme: 6. amino asit yeniden <b>Glu</b>. Protein sağlıklı referansla aynı.</span><br><small style="color:var(--muted);">Kesimin mutasyona uzaklığı ${result.dist} bç → bu modelde tahmini HDR verimi ≈ %${result.eff}. Gerçek hücrelerde HDR, NHEJ'e göre çok daha nadirdir ve ağırlıkla bölünen hücrelerde görülür.</small>`;
      } else {
        const len = after.filter((a) => !a.stop).length;
        const early = after.some((a) => a.stop) && len < before.length - 1;
        const kind = result.delta > 0 ? `+${result.delta} baz ekleme` : `${-result.delta} baz silme`;
        outcome.innerHTML = result.delta % 3 === 0
          ? `<span style="color:#fbbf24;">⚠ ${kind}: okuma çerçevesi korundu ama bir amino asit kayboldu (çerçeve içi silme).</span>`
          : `<span style="color:#fda4af;">✗ ${kind}: <b>çerçeve kayması</b>. Kesimden sonraki tüm kodonlar değişti${early ? ' ve <b>erken STOP</b> oluştu' : ''} → protein ${len} aa.</span><br><small style="color:var(--muted);">Bu, bir geni "susturmak" (nakavt) için kullanılır; ama mutasyonu düzeltmez.</small>`;
      }
    }
  }

  /* --------------------------------------------------------------------------
     AKIŞ
     -------------------------------------------------------------------------- */
  function clearTimers() { state.timers.forEach(clearTimeout); state.timers = []; }

  function setStep(n) {
    const g = guide();
    if (n > 0 && (!g || !g.valid)) return;
    state.step = Math.max(0, Math.min(3, n));
    if (state.step < 3) state.repair = null;
    state.stepStart = performance.now();
    updatePanel();
    draw();
    startLoop();
  }

  function selectGuide(id) {
    clearTimers();
    state.guideId = id;
    state.repair = null;
    state.step = 0;
    state.stepStart = performance.now();
    updatePanel();
    draw();
  }

  function setRepair(kind) {
    if (state.step < 3) return;
    state.repair = kind;
    state.stepStart = performance.now();
    updatePanel();
    draw();
  }

  function reset() {
    clearTimers();
    state.guideId = null;
    state.repair = null;
    state.nhejSeed = 7;
    setStep(0);
  }

  function autoplay(repairKind) {
    clearTimers();
    if (!guide() || !guide().valid) selectGuide('A');
    setStep(1);
    state.timers.push(setTimeout(() => setStep(2), STEPS[1].dur + 500));
    state.timers.push(setTimeout(() => setStep(3), STEPS[1].dur + STEPS[2].dur + 1000));
    state.timers.push(setTimeout(() => setRepair(repairKind || 'hdr'), STEPS[1].dur + STEPS[2].dur + 2000));
  }

  /* --------------------------------------------------------------------------
     DIŞA AÇILAN API
     -------------------------------------------------------------------------- */
  function init() {
    canvas = $('crisprCanvas');
    if (!canvas) return;
    $('crisprGuideList')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-guide]');
      if (b) selectGuide(b.dataset.guide);
    });
    $('crisprNextBtn')?.addEventListener('click', () => { clearTimers(); setStep(state.step + 1); });
    $('crisprBackBtn')?.addEventListener('click', () => { clearTimers(); setStep(state.step - 1); });
    $('crisprAutoBtn')?.addEventListener('click', () => autoplay('hdr'));
    $('crisprResetBtn')?.addEventListener('click', reset);
    document.querySelectorAll('#mod3_sub_3_2 [data-repair]').forEach((b) => {
      b.addEventListener('click', () => { clearTimers(); setRepair(b.dataset.repair); });
    });
    $('crisprRetryBtn')?.addEventListener('click', () => {
      if (state.repair !== 'nhej') return;
      state.nhejSeed++;
      setRepair('nhej');
    });
    const wrap = canvas.parentElement;
    if (wrap && window.ResizeObserver) new ResizeObserver(() => { if (state.active) draw(); }).observe(wrap);
    updatePanel();
  }

  function setActive(on) {
    state.active = on;
    if (on) { updatePanel(); draw(); startLoop(); } else clearTimers();
  }

  function setRunning(r) {
    state.running = r;
    if (r) startLoop();
  }

  function applyPreset(preset) {
    if (preset.guide) selectGuide(preset.guide);
    if (preset.autoplay) autoplay(preset.repair);
    else if (preset.repair && guide() && guide().valid) { setStep(3); setRepair(preset.repair); }
  }

  window.Mod3Crispr = { init, setActive, setRunning, applyPreset };
})();
