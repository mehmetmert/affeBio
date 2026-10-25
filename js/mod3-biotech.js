/* ============================================================================
   affeBio — MODÜL 3.3: Sanal Biyoteknoloji Laboratuvarı
   (a) PCR termal döngüleyici: denatürasyon / bağlanma / uzama basamakları,
       döngü sayısı, primer Tm ve verim → canlı sıcaklık profili, şematik
       zincir animasyonu ve lojistik (reaktif tükenmeli) amplifikasyon eğrisi.
       Bağlanma sıcaklığı Tm'nin çok altındaysa özgül olmayan ürünler, çok
       üstündeyse verim kaybı oluşur.
   (b) Agaroz jel elektroforezi: merdiven (ladder), PCR ürünü ve hazır
       örnekler; agaroz %, voltaj ve süreye bağlı göç (∝ −log10 boyut), UV
       altında parlayan bantlar ve merdivene göre boyut tahmini.
   ============================================================================ */
(function () {
  'use strict';

  const { fitCanvas } = window.BioCore;
  const $ = (id) => document.getElementById(id);

  const PRODUCT_BP = 500;
  const N0 = 1000;
  const NMAX = 1e12;

  const pcr = {
    params: { denatT: 95, denatS: 30, annealT: 58, annealS: 30, extT: 72, extS: 45, cycles: 30, tm: 60, eff: 0.92 },
    running: false,
    done: false,
    cycle: 0,
    phase: 0,
    phaseT: 0,
    history: [],
    spec: N0,
    nonspec: 0,
    dimer: 0
  };

  const LADDER = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1500, 2000, 3000];
  const gel = {
    pct: 1.0, volt: 100, time: 35,
    progress: 0,
    running: false,
    uv: true,
    lanes: { ladder: true, pcr: true, a: true, b: true, c: true },
    selected: null,
    hitboxes: []
  };

  const state = { active: false, running: true, mode: 'pcr', raf: null, lastT: 0 };
  let canvas = null;

  /* --------------------------------------------------------------------------
     PCR MODELİ
     -------------------------------------------------------------------------- */
  function factors() {
    const p = pcr.params;
    let denatF = p.denatT >= 94 ? 1 : p.denatT >= 90 ? 0.35 + 0.65 * (p.denatT - 90) / 4 : 0.04;
    denatF *= Math.min(1, 0.55 + p.denatS / 40);
    const d = p.annealT - p.tm;
    const annealF = d > 2 ? Math.exp(-Math.pow((d - 2) / 3, 2)) : 1;
    const spec = 1 / (1 + Math.exp(-(d + 10) / 1.6));
    const needS = (PRODUCT_BP / 1000) * 60;
    const extF = Math.min(1, p.extS / needS) * Math.exp(-Math.pow((p.extT - 72) / 4.5, 2));
    const e = Math.max(0, Math.min(1, p.eff * denatF * annealF * extF));
    return { denatF, annealF, spec, extF, e, d };
  }

  function resetPcr() {
    pcr.running = false;
    pcr.done = false;
    pcr.cycle = 0;
    pcr.phase = 0;
    pcr.phaseT = 0;
    pcr.spec = N0;
    pcr.nonspec = 0;
    pcr.dimer = 0;
    pcr.history = [{ cycle: 0, spec: N0, nonspec: 0 }];
  }

  function stepCycle() {
    const f = factors();
    const tot = pcr.spec + pcr.nonspec + pcr.dimer;
    const room = Math.max(0, 1 - tot / NMAX);
    // Özgül ürün tam verimle çoğalır; düşük bağlanma sıcaklığı ise her döngüde
    // (kalıp miktarıyla orantılı) yanlış bağlanma olayları "tohumlar". Kısa yan
    // ürünler biraz daha hızlı çoğalır ve aynı reaktif havuzu için yarışır.
    const specGain = pcr.spec * f.e * room;
    const nsSeed = (pcr.spec + N0) * (1 - f.spec) * f.e * 0.02;
    const nsGain = (pcr.nonspec * Math.min(1, f.e * 1.05) + nsSeed) * room;
    const dimerGain = (f.d < -8 ? (pcr.dimer * Math.min(1, f.e * 1.1) + 200 * f.e) : 0) * room;
    pcr.spec += specGain;
    pcr.nonspec += nsGain;
    pcr.dimer += dimerGain;
    pcr.cycle++;
    pcr.history.push({ cycle: pcr.cycle, spec: pcr.spec, nonspec: pcr.nonspec + pcr.dimer });
    if (pcr.cycle >= pcr.params.cycles) { pcr.running = false; pcr.done = true; }
  }

  function finishPcr() {
    if (pcr.done) return;
    if (pcr.cycle === 0 && !pcr.running) resetPcr();
    while (!pcr.done) stepCycle();
    pcr.running = false;
    updatePanel();
    draw();
  }

  const PHASE_NAMES = ['Denatürasyon', 'Bağlanma (annealing)', 'Uzama (extension)'];
  const PHASE_COLORS = ['#ff3366', '#38bdf8', '#00e8a8'];
  const CYCLE_SECONDS = 0.42;

  function tickPcr(dt) {
    if (!pcr.running) return;
    pcr.phaseT += dt / (CYCLE_SECONDS / 3);
    while (pcr.phaseT >= 1 && pcr.running) {
      pcr.phaseT -= 1;
      pcr.phase++;
      if (pcr.phase > 2) { pcr.phase = 0; stepCycle(); }
      updatePanel();
    }
  }

  /* --------------------------------------------------------------------------
     JEL MODELİ
     -------------------------------------------------------------------------- */
  function laneBands(key) {
    if (key === 'ladder') return LADDER.map((s) => ({ size: s, amt: s === 500 || s === 1000 ? 1 : 0.62 }));
    if (key === 'a') return [{ size: 3000, amt: 0.85 }, { size: 750, amt: 0.6 }];
    if (key === 'b') return [{ size: 6000, amt: 0.9, smear: true }];
    if (key === 'c') return [{ size: 1250, amt: 0.75 }, { size: 350, amt: 0.7 }];
    if (key === 'pcr') {
      if (pcr.cycle === 0) return [];
      const out = [];
      const sAmt = Math.min(1, Math.max(0, (Math.log10(pcr.spec) - 7.5) / 4));
      if (sAmt > 0.03) out.push({ size: PRODUCT_BP, amt: sAmt });
      const nsAmt = Math.min(1, Math.max(0, (Math.log10(pcr.nonspec + 1) - 9.6) / 2));
      if (nsAmt > 0.03) { out.push({ size: 180, amt: nsAmt * 0.8 }); out.push({ size: 1200, amt: nsAmt * 0.6 }); }
      const dAmt = Math.min(1, Math.max(0, (Math.log10(pcr.dimer + 1) - 9.6) / 2));
      if (dAmt > 0.03) out.push({ size: 50, amt: dAmt * 0.7 });
      return out;
    }
    return [];
  }

  const LANE_DEFS = [
    { key: 'ladder', label: 'M', name: 'DNA merdiveni (100–3000 bç)' },
    { key: 'pcr', label: 'PCR', name: 'PCR ürününüz (hedef 500 bç)' },
    { key: 'a', label: 'A', name: 'Örnek A: kesilmiş plazmit' },
    { key: 'b', label: 'B', name: 'Örnek B: genomik DNA' },
    { key: 'c', label: 'C', name: 'Örnek C: bilinmeyen' }
  ];

  function migration(size) {
    const m = Math.max(0, (3.903 - Math.log10(size)) / 2.204);
    const gamma = 0.6 + 0.6 * gel.pct;
    const S = 0.97 * (gel.volt / 100) * (gel.time / 35) / Math.sqrt(gel.pct);
    return S * Math.pow(m, gamma);
  }

  function estimateSize(dist) {
    const pts = LADDER.map((s) => ({ s, d: migration(s) })).filter((p) => p.d <= 1).sort((a, b) => a.d - b.d);
    if (pts.length < 2) return null;
    let a = pts[0], b = pts[1];
    for (let i = 0; i < pts.length - 1; i++) {
      if (dist >= pts[i].d && dist <= pts[i + 1].d) { a = pts[i]; b = pts[i + 1]; break; }
      if (dist > pts[pts.length - 1].d) { a = pts[pts.length - 2]; b = pts[pts.length - 1]; }
    }
    const t = (dist - a.d) / (b.d - a.d || 1);
    return Math.round(Math.pow(10, Math.log10(a.s) + t * (Math.log10(b.s) - Math.log10(a.s))));
  }

  function tickGel(dt) {
    if (!gel.running) return;
    gel.progress = Math.min(1, gel.progress + dt / 4);
    if (gel.progress >= 1) { gel.running = false; updatePanel(); }
  }

  /* --------------------------------------------------------------------------
     ÇİZİM: PCR
     -------------------------------------------------------------------------- */
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  }

  function drawPanelFrame(ctx, x, y, w, h, title) {
    rr(ctx, x, y, w, h, 10);
    ctx.fillStyle = 'rgba(4,10,8,0.55)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, x + 10, y + 8);
  }

  function drawPcr(ctx, w, h) {
    const p = pcr.params;
    const pad = 14;
    const h1 = h * 0.33, h2 = h * 0.27, h3 = h - h1 - h2 - pad * 4;
    const y1 = pad, y2 = y1 + h1 + pad, y3 = y2 + h2 + pad;
    const W = w - pad * 2;

    // 1) Sıcaklık profili
    drawPanelFrame(ctx, pad, y1, W, h1, 'Sıcaklık profili (°C) — döngü ilerledikçe çizilir');
    const tx0 = pad + 40, tx1 = pad + W - 12, ty0 = y1 + 26, ty1 = y1 + h1 - 20;
    const tMin = 40, tMax = 100;
    const ty = (T) => ty1 - ((T - tMin) / (tMax - tMin)) * (ty1 - ty0);
    ctx.strokeStyle = 'rgba(148,163,184,0.15)';
    ctx.fillStyle = '#64748b';
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    [50, 60, 70, 80, 90].forEach((T) => {
      ctx.beginPath(); ctx.moveTo(tx0, ty(T)); ctx.lineTo(tx1, ty(T)); ctx.stroke();
      ctx.fillText(String(T), tx0 - 6, ty(T));
    });
    const segDur = [p.denatS, p.annealS, p.extS];
    const cycDur = segDur[0] + segDur[1] + segDur[2];
    const total = p.cycles * cycDur;
    const tx = (s) => tx0 + (s / total) * (tx1 - tx0);
    const temps = [p.denatT, p.annealT, p.extT];
    const shownCycles = pcr.done ? p.cycles : pcr.cycle + (pcr.running ? 1 : 0);
    ctx.lineWidth = 2;
    for (let c = 0; c < shownCycles; c++) {
      for (let ph = 0; ph < 3; ph++) {
        const isCurrent = pcr.running && c === pcr.cycle && ph === pcr.phase;
        if (pcr.running && c === pcr.cycle && ph > pcr.phase) break;
        const s0 = c * cycDur + segDur.slice(0, ph).reduce((a, b) => a + b, 0);
        const frac = isCurrent ? pcr.phaseT : 1;
        const s1 = s0 + segDur[ph] * frac;
        ctx.strokeStyle = PHASE_COLORS[ph];
        ctx.beginPath();
        const prevT = ph === 0 ? (c === 0 ? 25 : temps[2]) : temps[ph - 1];
        ctx.moveTo(tx(s0), ty(Math.max(tMin, prevT)));
        ctx.lineTo(tx(s0), ty(temps[ph]));
        ctx.lineTo(tx(s1), ty(temps[ph]));
        ctx.stroke();
      }
    }
    // Tm çizgisi
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(245,158,11,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(tx0, ty(p.tm)); ctx.lineTo(tx1, ty(p.tm)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '700 10px "JetBrains Mono", monospace';
    const tmLabel = `Primer Tm ${p.tm}°C`;
    const tmW = ctx.measureText(tmLabel).width + 10;
    ctx.fillStyle = 'rgba(4,10,8,0.85)';
    ctx.fillRect(tx1 - tmW, ty(p.tm) - 8, tmW, 16);
    ctx.fillStyle = '#f59e0b';
    ctx.textAlign = 'right';
    ctx.fillText(tmLabel, tx1 - 5, ty(p.tm));

    // 2) Şematik
    drawPanelFrame(ctx, pad, y2, W, h2, '');
    const ph = pcr.running ? pcr.phase : (pcr.done ? 2 : 0);
    const prog = pcr.running ? pcr.phaseT : 1;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '800 12px Inter, sans-serif';
    ctx.fillStyle = PHASE_COLORS[ph];
    const label = pcr.running ? `Döngü ${pcr.cycle + 1}/${p.cycles} · ${PHASE_NAMES[ph]} · ${[p.denatT, p.annealT, p.extT][ph]}°C`
      : pcr.done ? `Tamamlandı · ${p.cycles} döngü` : 'Hazır — PCR\'ı başlatın';
    ctx.fillText(label, pad + 10, y2 + 8);
    const sx0 = pad + W * 0.12, sx1 = pad + W * 0.88, smid = y2 + h2 * 0.58;
    const gap = ph === 0 ? 8 + 26 * prog : 34;
    const f = factors();
    // Kalıp zincirler
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#38bdf8';
    ctx.beginPath(); ctx.moveTo(sx0, smid - gap / 2); ctx.lineTo(sx1, smid - gap / 2); ctx.stroke();
    ctx.strokeStyle = '#f472b6';
    ctx.beginPath(); ctx.moveTo(sx0, smid + gap / 2); ctx.lineTo(sx1, smid + gap / 2); ctx.stroke();
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillText('5′', sx0 - 6, smid - gap / 2); ctx.fillText('3′', sx0 - 6, smid + gap / 2);
    ctx.textAlign = 'left';
    ctx.fillText('3′', sx1 + 6, smid - gap / 2); ctx.fillText('5′', sx1 + 6, smid + gap / 2);
    if (ph >= 1) {
      const bind = ph === 1 ? Math.min(1, prog * 1.4) * Math.min(1, f.annealF + 0.15) : Math.min(1, f.annealF + 0.15);
      const pl = (sx1 - sx0) * 0.12;
      const ext = ph === 2 ? prog * Math.min(1, f.extF) : 0;
      ctx.globalAlpha = bind;
      // İleri primer (alt zincire bağlanır, sağa uzar)
      ctx.strokeStyle = '#fbbf24';
      ctx.beginPath(); ctx.moveTo(sx0, smid + gap / 2 - 9); ctx.lineTo(sx0 + pl + (sx1 - sx0 - pl) * ext, smid + gap / 2 - 9); ctx.stroke();
      // Geri primer (üst zincire bağlanır, sola uzar)
      ctx.beginPath(); ctx.moveTo(sx1, smid - gap / 2 + 9); ctx.lineTo(sx1 - pl - (sx1 - sx0 - pl) * ext, smid - gap / 2 + 9); ctx.stroke();
      if (ph === 2) {
        ctx.fillStyle = 'rgba(0,232,168,0.85)';
        ctx.beginPath(); ctx.arc(sx0 + pl + (sx1 - sx0 - pl) * ext, smid + gap / 2 - 9, 7, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(sx1 - pl - (sx1 - sx0 - pl) * ext, smid - gap / 2 + 9, 7, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (f.spec < 0.7 && ph >= 1) {
        ctx.strokeStyle = 'rgba(255,51,102,0.8)';
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(sx0 + (sx1 - sx0) * 0.45, smid + gap / 2 - 9); ctx.lineTo(sx0 + (sx1 - sx0) * 0.55, smid + gap / 2 - 9); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#fda4af';
        ctx.font = '700 10px Inter, sans-serif';
        ctx.fillText('yanlış bölgeye bağlanma', sx0 + (sx1 - sx0) * 0.42, smid + gap / 2 + 14);
      }
    }
    ctx.lineCap = 'butt';
    ctx.font = '600 10px Inter, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('mavi/pembe: kalıp zincirler · sarı: primerler · yeşil: Taq polimeraz', pad + W - 10, y2 + h2 - 6);

    // 3) Amplifikasyon eğrisi
    drawPanelFrame(ctx, pad, y3, W, h3, 'Kopya sayısı (log₁₀) — ideal 2ⁿ ile karşılaştırma');
    const gx0 = pad + 40, gx1 = pad + W - 12, gy0 = y3 + 26, gy1 = y3 + h3 - 22;
    const lmin = 3, lmax = 13;
    const gy = (v) => gy1 - ((Math.log10(Math.max(1, v)) - lmin) / (lmax - lmin)) * (gy1 - gy0);
    const gxc = (c) => gx0 + (c / p.cycles) * (gx1 - gx0);
    ctx.strokeStyle = 'rgba(148,163,184,0.15)';
    ctx.fillStyle = '#64748b';
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let l = lmin; l <= lmax; l += 2) {
      ctx.beginPath(); ctx.moveTo(gx0, gy(Math.pow(10, l))); ctx.lineTo(gx1, gy(Math.pow(10, l))); ctx.stroke();
      ctx.fillText(`10^${l}`, gx0 - 4, gy(Math.pow(10, l)));
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let c = 0; c <= p.cycles; c += Math.max(5, Math.round(p.cycles / 6))) ctx.fillText(String(c), gxc(c), gy1 + 4);
    // ideal 2^n
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(148,163,184,0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let c = 0; c <= p.cycles; c++) {
      const v = Math.min(N0 * Math.pow(2, c), Math.pow(10, lmax));
      if (c === 0) ctx.moveTo(gxc(c), gy(v)); else ctx.lineTo(gxc(c), gy(v));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.save();
    ctx.beginPath();
    ctx.rect(gx0, gy0 - 2, gx1 - gx0, gy1 - gy0 + 4);
    ctx.clip();
    const plotSeries = (key, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      pcr.history.forEach((pt, i) => {
        const v = key === 'spec' ? pt.spec : pt.nonspec;
        if (i === 0) ctx.moveTo(gxc(pt.cycle), gy(v)); else ctx.lineTo(gxc(pt.cycle), gy(v));
      });
      ctx.stroke();
    };
    plotSeries('spec', '#00e8a8');
    if (pcr.history.some((pt) => pt.nonspec >= Math.pow(10, lmin))) plotSeries('nonspec', '#ff3366');
    ctx.restore();
    ctx.font = '700 10.5px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#00e8a8'; ctx.fillText('— özgül ürün (500 bç)', gx0 + 8, gy0 + 2);
    ctx.fillStyle = '#ff3366'; ctx.fillText('— özgül olmayan ürün', gx0 + 150, gy0 + 2);
    ctx.fillStyle = '#94a3b8'; ctx.fillText('- - ideal 2ⁿ', gx0 + 290, gy0 + 2);
  }

  /* --------------------------------------------------------------------------
     ÇİZİM: JEL
     -------------------------------------------------------------------------- */
  function drawGel(ctx, w, h) {
    const lanes = LANE_DEFS.filter((l) => gel.lanes[l.key]);
    const gx = w * 0.16, gw = w * 0.68, gy = 54, gh = h - 110;
    gel.hitboxes = [];

    // Elektrotlar
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 13px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('(−) katot', gx + gw + 12, gy + 12);
    ctx.fillStyle = '#ff3366';
    ctx.fillText('(+) anot', gx + gw + 12, gy + gh - 12);
    ctx.textAlign = 'center';
    ctx.font = '600 10.5px Inter, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('DNA negatif yüklüdür → + kutba doğru göç eder', gx + gw / 2, gy + gh + 22);

    // Jel gövdesi
    rr(ctx, gx, gy, gw, gh, 10);
    if (gel.uv) {
      const grd = ctx.createLinearGradient(0, gy, 0, gy + gh);
      grd.addColorStop(0, '#1b0b2e'); grd.addColorStop(1, '#0d0618');
      ctx.fillStyle = grd;
    } else {
      ctx.fillStyle = 'rgba(203,213,225,0.16)';
    }
    ctx.fill();
    ctx.strokeStyle = gel.uv ? 'rgba(168,85,247,0.45)' : 'rgba(203,213,225,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const laneW = gw / Math.max(1, lanes.length);
    const wellY = gy + 18, runLen = gh - 40;
    const bandW = Math.min(64, laneW * 0.62);

    lanes.forEach((lane, li) => {
      const cx = gx + laneW * (li + 0.5);
      // Kuyucuk
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(cx - bandW / 2, wellY - 6, bandW, 7);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '800 11px "JetBrains Mono", monospace';
      ctx.fillText(lane.label, cx, gy - 10);

      const bands = laneBands(lane.key);
      if (lane.key === 'pcr' && !bands.length) {
        ctx.fillStyle = '#64748b';
        ctx.font = '600 9.5px Inter, sans-serif';
        ctx.fillText(pcr.cycle === 0 ? 'PCR yok' : 'ürün yok', cx, wellY + 22);
      }
      bands.forEach((b) => {
        const dFinal = migration(b.size);
        const d = dFinal * gel.progress;
        const y = wellY + d * runLen;
        if (d > 1) return;
        if (gel.uv && gel.progress > 0) {
          ctx.save();
          ctx.shadowColor = 'rgba(255,140,60,0.9)';
          ctx.shadowBlur = 14 * b.amt;
          if (b.smear) {
            const grd = ctx.createLinearGradient(0, wellY, 0, y + 30);
            grd.addColorStop(0, `rgba(255,170,90,${0.9 * b.amt})`);
            grd.addColorStop(1, 'rgba(255,170,90,0)');
            ctx.fillStyle = grd;
            ctx.fillRect(cx - bandW / 2, wellY, bandW, Math.max(4, y + 30 - wellY));
          } else {
            ctx.fillStyle = `rgba(255,${150 + Math.round(70 * b.amt)},${90 + Math.round(60 * b.amt)},${0.35 + 0.65 * b.amt})`;
            rr(ctx, cx - bandW / 2, y - 3, bandW, 6, 3);
            ctx.fill();
          }
          ctx.restore();
          const isSel = gel.selected && gel.selected.lane === lane.key && gel.selected.size === b.size;
          if (isSel) {
            ctx.strokeStyle = '#00e8a8';
            ctx.lineWidth = 2;
            rr(ctx, cx - bandW / 2 - 4, y - 7, bandW + 8, 14, 4);
            ctx.stroke();
          }
          gel.hitboxes.push({ x: cx - bandW / 2 - 4, y: y - 8, w: bandW + 8, h: 16, lane: lane.key, size: b.size });
        }
        if (lane.key === 'ladder' && gel.uv && gel.progress > 0.25 && !b.smear) {
          ctx.fillStyle = '#c4b5fd';
          ctx.font = '600 9.5px "JetBrains Mono", monospace';
          ctx.textAlign = 'right';
          ctx.fillText(`${b.size}`, gx - 6, y);
          ctx.textAlign = 'center';
        }
      });

      // Yükleme boyaları (UV kapalıyken görünür; yaklaşık 300 bç ve 4000 bç ile birlikte göçer)
      if (!gel.uv) {
        [{ size: 300, col: 'rgba(59,130,246,0.85)' }, { size: 4000, col: 'rgba(34,211,238,0.6)' }].forEach((dye) => {
          const d = migration(dye.size) * gel.progress;
          if (d > 1) return;
          ctx.fillStyle = dye.col;
          rr(ctx, cx - bandW / 2, wellY + d * runLen - 3, bandW, 6, 3);
          ctx.fill();
        });
      }
    });

    // Göç dışına çıkan bantlar uyarısı
    const lost = lanes.some((l) => laneBands(l.key).some((b) => migration(b.size) * gel.progress > 1));
    ctx.textAlign = 'left';
    ctx.font = '700 11px Inter, sans-serif';
    ctx.fillStyle = gel.uv ? '#fbbf24' : '#94a3b8';
    const status = gel.running ? `Elektroforez çalışıyor… %${Math.round(gel.progress * 100)}`
      : gel.progress >= 1 ? (lost ? '⚠ Bazı küçük parçalar jelin sonundan çıktı (süre/voltaj fazla)' : 'Koşu tamamlandı — bir banda tıklayın')
      : 'Kuyucuklar yüklendi — elektroforezi başlatın';
    ctx.fillText(status, 16, 20);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`%${gel.pct.toFixed(1)} agaroz · ${gel.volt} V · ${gel.time} dk · ${gel.uv ? 'UV açık' : 'UV kapalı'}`, w - 16, 20);
  }

  function draw() {
    if (!canvas) return;
    const fc = fitCanvas(canvas);
    if (!fc) return;
    const { ctx, w, h } = fc;
    ctx.clearRect(0, 0, w, h);
    if (state.mode === 'pcr') drawPcr(ctx, w, h); else drawGel(ctx, w, h);
  }

  function loop(t) {
    state.raf = null;
    if (!state.active || !state.running) return;
    const dt = Math.min(0.05, (t - (state.lastT || t)) / 1000);
    state.lastT = t;
    tickPcr(dt);
    tickGel(dt);
    draw();
    state.raf = requestAnimationFrame(loop);
  }
  function startLoop() {
    if (!state.raf && state.active && state.running) { state.lastT = 0; state.raf = requestAnimationFrame(loop); }
  }

  /* --------------------------------------------------------------------------
     PANEL
     -------------------------------------------------------------------------- */
  function fmt(n) {
    if (n < 1e4) return Math.round(n).toLocaleString('tr-TR');
    const e = Math.floor(Math.log10(n));
    return `${(n / Math.pow(10, e)).toFixed(2)}×10^${e}`;
  }

  function pcrStatus() {
    const f = factors();
    const p = pcr.params;
    const msgs = [];
    if (p.denatT < 90) msgs.push(['bad', 'Denatürasyon sıcaklığı çok düşük: çift zincir ayrılamıyor, neredeyse hiç kopya oluşmaz.']);
    else if (p.denatT < 94) msgs.push(['warn', 'Denatürasyon sınırda: zincirlerin bir kısmı ayrılmıyor, verim düşüyor.']);
    if (f.d > 2) msgs.push([f.annealF < 0.3 ? 'bad' : 'warn', `Bağlanma sıcaklığı Tm'nin ${f.d.toFixed(0)}°C üstünde: primerler kalıba tutunamıyor → verim düşük.`]);
    if (f.d < -5) msgs.push([f.spec < 0.5 ? 'bad' : 'warn', `Bağlanma sıcaklığı Tm'nin ${(-f.d).toFixed(0)}°C altında: primerler benzer dizilere de bağlanıyor → özgül olmayan bantlar${f.d < -8 ? ' ve primer dimerleri' : ''}.`]);
    if (f.extF < 0.9) msgs.push(['warn', `Uzama yetersiz: ${PRODUCT_BP} bç için ~${Math.round(PRODUCT_BP / 1000 * 60)} s @72°C gerekir (Taq ≈ 1 kb/dk).`]);
    if (!msgs.length) msgs.push(['ok', 'Koşullar ideal aralıkta: Tm−5°C ≤ bağlanma ≤ Tm+2°C, yeterli denatürasyon ve uzama.']);
    return msgs;
  }

  function updatePanel() {
    const f = factors();
    const p = pcr.params;
    if ($('btTelCycle')) $('btTelCycle').textContent = `${pcr.cycle}/${p.cycles}`;
    if ($('btTelTotal')) $('btTelTotal').textContent = fmt(pcr.spec + pcr.nonspec + pcr.dimer);
    if ($('btTelSpec')) {
      const tot = pcr.spec + pcr.nonspec + pcr.dimer;
      $('btTelSpec').textContent = pcr.cycle ? `%${Math.round(100 * pcr.spec / tot)}` : '—';
    }
    if ($('btTelIdeal')) $('btTelIdeal').textContent = fmt(N0 * Math.pow(2, pcr.cycle));
    if ($('btTelEff')) $('btTelEff').textContent = `%${Math.round(f.e * 100)} / döngü`;
    if ($('btTelPhase')) $('btTelPhase').textContent = pcr.running ? PHASE_NAMES[pcr.phase].split(' ')[0] : (pcr.done ? 'Bitti' : 'Hazır');
    const st = $('btPcrStatus');
    if (st) st.innerHTML = pcrStatus().map(([k, m]) => `<p class="bt-msg ${k}">${m}</p>`).join('');

    Object.keys(p).forEach((k) => {
      const out = document.querySelector(`[data-out="${k}"]`);
      if (out) out.textContent = k === 'eff' ? `%${Math.round(p[k] * 100)}` : (/S$/.test(k) ? `${p[k]} s` : (k === 'cycles' ? p[k] : `${p[k]}°C`));
    });
    if ($('btPcrRun')) $('btPcrRun').textContent = pcr.running ? '⏸ Duraklat' : (pcr.done ? '↻ Yeniden Çalıştır' : (pcr.cycle ? '▶ Devam Et' : '▶ PCR\'ı Başlat'));

    if ($('btOutPct')) $('btOutPct').textContent = `%${gel.pct.toFixed(1)}`;
    if ($('btOutVolt')) $('btOutVolt').textContent = `${gel.volt} V`;
    if ($('btOutTime')) $('btOutTime').textContent = `${gel.time} dk`;
    if ($('btGelUv')) { $('btGelUv').classList.toggle('active', gel.uv); $('btGelUv').textContent = gel.uv ? '🔦 UV Açık' : '🔦 UV Kapalı'; }
    if ($('btGelRun')) $('btGelRun').textContent = gel.running ? '⏸ Durdur' : (gel.progress >= 1 ? '↻ Yeniden Yükle & Koş' : '▶ Elektroforezi Başlat');
    document.querySelectorAll('#mod3_sub_3_3 [data-lane]').forEach((b) => b.classList.toggle('off', !gel.lanes[b.dataset.lane]));

    const info = $('btGelBandInfo');
    if (info) {
      if (!gel.selected) info.innerHTML = '<span style="color:var(--muted);">Koşu bittikten sonra UV altında bir banda tıklayın; boyutu merdivene göre tahmin edilir.</span>';
      else {
        const lane = LANE_DEFS.find((l) => l.key === gel.selected.lane);
        const est = estimateSize(migration(gel.selected.size));
        info.innerHTML = `<b>${lane.name}</b><br>Göç mesafesi: %${Math.round(migration(gel.selected.size) * 100)} · Tahmini boyut ≈ <b style="color:var(--cyan);">${est ? est.toLocaleString('tr-TR') : '—'} bç</b><br><small style="color:var(--muted);">Gerçek değer: ${gel.selected.size.toLocaleString('tr-TR')} bç ${gel.selected.size > 3000 ? '(merdivenin üst sınırının dışında — tahmin güvenilmez)' : ''}</small>`;
      }
    }

    document.querySelectorAll('#mod3_sub_3_3 .bt-pcr-only').forEach((el) => { el.hidden = state.mode !== 'pcr'; });
    document.querySelectorAll('#mod3_sub_3_3 .bt-gel-only').forEach((el) => { el.hidden = state.mode !== 'gel'; });
    document.querySelectorAll('#mod3_sub_3_3 [data-bt-mode]').forEach((b) => b.classList.toggle('active', b.dataset.btMode === state.mode));
  }

  /* --------------------------------------------------------------------------
     OLAYLAR
     -------------------------------------------------------------------------- */
  const PCR_PRESETS = {
    ideal: { denatT: 95, denatS: 30, annealT: 57, annealS: 30, extT: 72, extS: 45, cycles: 30, tm: 60, eff: 0.92 },
    low: { annealT: 48 },
    high: { annealT: 66 },
    shortExt: { extS: 10 },
    coldDenat: { denatT: 88 }
  };

  function setParam(k, v) {
    pcr.params[k] = v;
    const inp = document.querySelector(`#mod3_sub_3_3 input[data-param="${k}"]`);
    if (inp && +inp.value !== v) inp.value = v;
    if (pcr.cycle && !pcr.running) resetPcr();
    updatePanel();
    draw();
  }

  function setMode(m) {
    state.mode = m;
    updatePanel();
    draw();
  }

  function init() {
    canvas = $('btCanvas');
    if (!canvas) return;
    resetPcr();

    document.querySelectorAll('#mod3_sub_3_3 input[data-param]').forEach((inp) => {
      inp.value = pcr.params[inp.dataset.param];
      inp.addEventListener('input', () => setParam(inp.dataset.param, +inp.value));
    });
    document.querySelectorAll('#mod3_sub_3_3 [data-bt-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.btMode)));
    document.querySelectorAll('#mod3_sub_3_3 [data-pcr-preset]').forEach((b) => b.addEventListener('click', () => {
      const pr = PCR_PRESETS[b.dataset.pcrPreset];
      Object.keys(PCR_PRESETS.ideal).forEach((k) => setParam(k, pr[k] != null ? pr[k] : PCR_PRESETS.ideal[k]));
      resetPcr();
      updatePanel();
      draw();
    }));

    $('btPcrRun')?.addEventListener('click', () => {
      if (pcr.done) resetPcr();
      pcr.running = !pcr.running;
      updatePanel();
      startLoop();
    });
    $('btPcrFinish')?.addEventListener('click', finishPcr);
    $('btPcrReset')?.addEventListener('click', () => { resetPcr(); updatePanel(); draw(); });
    $('btPcrToGel')?.addEventListener('click', () => {
      if (!pcr.done) finishPcr();
      gel.lanes.pcr = true;
      gel.progress = 0;
      gel.selected = null;
      setMode('gel');
    });

    [['btGelPct', 'pct'], ['btGelVolt', 'volt'], ['btGelTime', 'time']].forEach(([id, key]) => {
      const inp = $(id);
      if (!inp) return;
      inp.value = gel[key];
      inp.addEventListener('input', () => {
        gel[key] = +inp.value;
        gel.selected = null;
        updatePanel();
        draw();
      });
    });
    $('btGelRun')?.addEventListener('click', () => {
      if (gel.running) { gel.running = false; updatePanel(); return; }
      if (gel.progress >= 1) gel.progress = 0;
      gel.selected = null;
      gel.running = true;
      updatePanel();
      startLoop();
    });
    $('btGelUv')?.addEventListener('click', () => { gel.uv = !gel.uv; updatePanel(); draw(); });
    $('btGelReset')?.addEventListener('click', () => { gel.progress = 0; gel.running = false; gel.selected = null; updatePanel(); draw(); });
    document.querySelectorAll('#mod3_sub_3_3 [data-lane]').forEach((b) => b.addEventListener('click', () => {
      gel.lanes[b.dataset.lane] = !gel.lanes[b.dataset.lane];
      gel.selected = null;
      updatePanel();
      draw();
    }));

    canvas.addEventListener('click', (e) => {
      if (state.mode !== 'gel') return;
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const hit = gel.hitboxes.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
      gel.selected = hit ? { lane: hit.lane, size: hit.size } : null;
      updatePanel();
      draw();
    });

    const wrap = canvas.parentElement;
    if (wrap && window.ResizeObserver) new ResizeObserver(() => { if (state.active) draw(); }).observe(wrap);
    updatePanel();
  }

  function setActive(on) {
    state.active = on;
    if (on) { updatePanel(); draw(); startLoop(); }
  }

  function setRunning(r) {
    state.running = r;
    if (r) startLoop();
  }

  function applyPreset(preset) {
    if (preset.mode) setMode(preset.mode);
    if (preset.pcr && PCR_PRESETS[preset.pcr]) {
      const pr = PCR_PRESETS[preset.pcr];
      Object.keys(PCR_PRESETS.ideal).forEach((k) => setParam(k, pr[k] != null ? pr[k] : PCR_PRESETS.ideal[k]));
      resetPcr();
      if (preset.run) { pcr.running = true; startLoop(); }
      updatePanel();
    }
    if (preset.gelPct) { gel.pct = preset.gelPct; if ($('btGelPct')) $('btGelPct').value = gel.pct; updatePanel(); draw(); }
  }

  window.Mod3Biotech = { init, setActive, setRunning, applyPreset };
})();
