/* ============================================================================
   affeBio — MODÜL 4: Biyofizik ve Popülasyon Dinamikleri
   4.1 Nöron Aksiyon Potansiyeli: "hep ya da hiç" eşik kuralı ve
       osiloskop tarzı zar potansiyeli izi.
   4.2 Av-Avcı (Lotka-Volterra): RK4 ile çözülen, canlı çizilen popülasyon grafiği.
   ============================================================================ */
(function () {
  'use strict';

  const { rk4Step, fitCanvas, drawLineChart, clamp } = window.BioCore;
  const $ = (id) => document.getElementById(id);

  const state = {
    activeSub: '4_1',
    running: true,
    neuron: {
      stimulus: 12,
      phase: 'rest', // rest | depol | repol | hyper | refractory
      phaseT: 0,
      trace: [], // {t, v}
      tAccum: 0
    },
    pop: {
      alpha: 1.0, beta: 0.1, delta: 0.075, gamma: 1.5,
      R: 10, F: 5, t: 0,
      series: [], // {t, R, F}
      playing: true
    }
  };

  const THRESHOLD = -55;
  const REST_V = -70;

  function fireIfNeeded() {
    const n = state.neuron;
    if (n.phase === 'rest' && n.stimulus >= 15) {
      n.phase = 'depol';
      n.phaseT = 0;
    }
  }

  function stepNeuron(dt) {
    const n = state.neuron;
    n.phaseT += dt;
    let v = REST_V;
    if (n.phase === 'rest') {
      v = REST_V;
    } else if (n.phase === 'depol') {
      const d = 0.9; // s
      const t = clamp(n.phaseT / d, 0, 1);
      v = REST_V + (30 - REST_V) * (t * t * (3 - 2 * t));
      if (t >= 1) { n.phase = 'repol'; n.phaseT = 0; }
    } else if (n.phase === 'repol') {
      const d = 1.1;
      const t = clamp(n.phaseT / d, 0, 1);
      v = 30 + (-80 - 30) * (t * t * (3 - 2 * t));
      if (t >= 1) { n.phase = 'hyper'; n.phaseT = 0; }
    } else if (n.phase === 'hyper') {
      const d = 1.6;
      const t = clamp(n.phaseT / d, 0, 1);
      v = -80 + (REST_V - -80) * t;
      if (t >= 1) { n.phase = 'rest'; n.phaseT = 0; }
    }
    n.tAccum += dt;
    n.trace.push({ t: n.tAccum, v });
    const WINDOW = 8;
    while (n.trace.length && n.trace[0].t < n.tAccum - WINDOW) n.trace.shift();
    return v;
  }

  function channelPhaseLabel(phase) {
    return {
      rest: 'Dinlenim (−70 mV) · Kanallar kapalı',
      depol: '⚡ Na⁺ kanalları açık — Depolarizasyon',
      repol: '🔵 K⁺ kanalları açık — Repolarizasyon',
      hyper: 'Hiperpolarizasyon (−80 mV)'
    }[phase] || '';
  }

  function drawNeuron() {
    const info = fitCanvas($('bioNeuronCanvas'));
    if (!info) return;
    const { ctx, w, h } = info;
    ctx.clearRect(0, 0, w, h);
    const padL = 42, padR = 12, padT = 14, padB = 22;
    const pw = w - padL - padR, ph = h - padT - padB;
    const vMin = -90, vMax = 40;
    const WINDOW = 8;

    ctx.strokeStyle = 'rgba(148,163,184,0.12)';
    ctx.lineWidth = 1;
    [-70, -55, 0, 30].forEach((vv) => {
      const y = padT + ph - ((vv - vMin) / (vMax - vMin)) * ph;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    });
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.fillText('eşik −55 mV', padL + 4, padT + ph - ((-55 - vMin) / (vMax - vMin)) * ph - 4);

    const n = state.neuron;
    if (n.trace.length > 1) {
      ctx.beginPath();
      n.trace.forEach((p, i) => {
        const x = padL + ((p.t - (n.tAccum - WINDOW)) / WINDOW) * pw;
        const y = padT + ph - ((p.v - vMin) / (vMax - vMin)) * ph;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#00e8a8';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    const last = n.trace[n.trace.length - 1];
    ctx.fillText(`V_m = ${last ? last.v.toFixed(1) : REST_V.toFixed(1)} mV`, w - padR - 110, padT + 10);

    if ($('neuronPhaseText')) $('neuronPhaseText').textContent = channelPhaseLabel(n.phase);
    if ($('neuronVmText')) $('neuronVmText').textContent = `${last ? last.v.toFixed(1) : REST_V.toFixed(1)} mV`;
  }

  function popDeriv(y, t, p) {
    const [R, F] = y;
    return [p.alpha * R - p.beta * R * F, p.delta * p.beta * R * F - p.gamma * F];
  }

  function stepPop(dt) {
    const p = state.pop;
    if (!p.playing) return;
    const y = rk4Step([p.R, p.F], p.t, dt, (yy, tt) => popDeriv(yy, tt, p));
    p.R = clamp(y[0], 0, 9999);
    p.F = clamp(y[1], 0, 9999);
    p.t += dt;
    p.series.push({ t: p.t, R: p.R, F: p.F });
    const WINDOW = 60;
    while (p.series.length && p.series[0].t < p.t - WINDOW) p.series.shift();
  }

  function drawPop() {
    const info = fitCanvas($('bioPopCanvas'));
    if (!info) return;
    const { ctx, w, h } = info;
    ctx.clearRect(0, 0, w, h);
    const p = state.pop;
    const WINDOW = 60;
    const t0 = Math.max(0, p.t - WINDOW);
    const series = [
      { color: '#00e8a8', points: p.series.map((s) => ({ x: s.t - t0, y: s.R })) },
      { color: '#a855f7', points: p.series.map((s) => ({ x: s.t - t0, y: s.F })) }
    ];
    drawLineChart(ctx, w, h, series, { maxX: WINDOW, yLabel: 'Popülasyon', xMaxLabel: `t=${p.t.toFixed(0)}` });

    ctx.fillStyle = '#00e8a8';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillText(`🐇 Tavşan: ${p.R.toFixed(0)}`, w - 150, 16);
    ctx.fillStyle = '#c084fc';
    ctx.fillText(`🦊 Tilki: ${p.F.toFixed(0)}`, w - 150, 32);

    if ($('popRVal')) $('popRVal').textContent = p.R.toFixed(1);
    if ($('popFVal')) $('popFVal').textContent = p.F.toFixed(1);
  }

  let lastT = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    if (!state.running) return;
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    const mod4El = $('mod4');
    if (!mod4El || !mod4El.classList.contains('active')) return;

    if (state.activeSub === '4_1') {
      fireIfNeeded();
      stepNeuron(dt);
      drawNeuron();
    } else if (state.activeSub === '4_2') {
      stepPop(dt * 2.2);
      drawPop();
    }
  }
  requestAnimationFrame(loop);

  function renderPopControls() {
    const p = state.pop;
    const defs = [
      ['alpha', 'α — Tavşan Üreme Hızı', 0.2, 2.5, 0.05],
      ['beta', 'β — Avlanma Katsayısı', 0.01, 0.4, 0.01],
      ['delta', 'δ — Tilki Üreme Verimi', 0.01, 0.3, 0.01],
      ['gamma', 'γ — Tilki Ölüm Hızı', 0.2, 3.0, 0.05]
    ];
    const box = $('popControls');
    if (!box) return;
    box.innerHTML = defs.map(([key, label, min, max, step]) => `
      <div class="ctrl-row">
        <div class="ctrl-label"><span>${label}</span><b id="popVal_${key}">${p[key].toFixed(2)}</b></div>
        <input type="range" min="${min}" max="${max}" step="${step}" value="${p[key]}" data-pk="${key}" />
      </div>
    `).join('');
    box.querySelectorAll('input[type=range]').forEach((inp) => {
      inp.addEventListener('input', (e) => {
        const key = e.target.dataset.pk;
        state.pop[key] = +e.target.value;
        $('popVal_' + key).textContent = (+e.target.value).toFixed(2);
      });
    });
  }

  function resetPop() {
    const p = state.pop;
    p.R = 10; p.F = 5; p.t = 0; p.series = [];
  }

  function switchSubtab(subId) {
    state.activeSub = subId;
    document.querySelectorAll('#mod4 .subtab-btn').forEach((b) => b.classList.toggle('active', b.dataset.sub === subId));
    ['4_1', '4_2'].forEach((id) => {
      const pane = $(`mod4_sub_${id}`);
      if (pane) pane.hidden = id !== subId;
    });
  }

  function applyPreset(preset) {
    if (preset.sub) switchSubtab(preset.sub);
    if (preset.stimulus != null) {
      state.neuron.stimulus = preset.stimulus;
      if ($('neuronStimSlider')) $('neuronStimSlider').value = preset.stimulus;
      if ($('neuronStimVal')) $('neuronStimVal').textContent = preset.stimulus;
    }
    if (preset.beta != null) {
      state.pop.beta = preset.beta;
      renderPopControls();
    }
  }

  function init() {
    renderPopControls();

    $('neuronStimSlider')?.addEventListener('input', (e) => {
      state.neuron.stimulus = +e.target.value;
      if ($('neuronStimVal')) $('neuronStimVal').textContent = e.target.value;
    });
    $('neuronFireBtn')?.addEventListener('click', () => {
      if (state.neuron.phase === 'rest') { state.neuron.phase = 'depol'; state.neuron.phaseT = 0; }
    });

    $('popResetBtn')?.addEventListener('click', resetPop);
    $('popPlayBtn')?.addEventListener('click', (e) => {
      state.pop.playing = !state.pop.playing;
      e.currentTarget.textContent = state.pop.playing ? '⏸ Duraklat' : '▶ Oynat';
      e.currentTarget.classList.toggle('active', state.pop.playing);
    });

    document.querySelectorAll('#mod4 .subtab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        switchSubtab(btn.dataset.sub);
        window.AffeBio?.onSubtabChanged();
      });
    });

    switchSubtab('4_1');
  }

  window.Mod4Biophysics = {
    init,
    switchSubtab,
    applyPreset,
    getActiveSub: () => `bio${state.activeSub}`,
    setRunning: (r) => { state.running = r; lastT = performance.now(); }
  };
})();
