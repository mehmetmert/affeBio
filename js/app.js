/* ============================================================================
   affeBio (affeLab: Biology) — Ana SPA Yönlendirici, Tema Yöneticisi
   ve scienceWiki "Akademik Bilgi & Teori" Çekmecesi Denetleyicisi
   ============================================================================ */
(function () {
  'use strict';

  const { SCIENCE_WIKI } = window.BioData;
  const $ = (id) => document.getElementById(id);

  const appState = {
    activeModule: 'mod1',
    activeTheoryTab: 'intuitive' // 'intuitive' | 'history' | 'formulas' | 'tasks'
  };

  function getActiveSubKey() {
    switch (appState.activeModule) {
      case 'mod1': return window.Mod1Anatomy ? window.Mod1Anatomy.getActiveSub() : 'bio1_1';
      case 'mod2': return window.Mod2Cell ? window.Mod2Cell.getActiveSub() : 'bio2_1';
      case 'mod3': return window.Mod3Genetics ? window.Mod3Genetics.getActiveSub() : 'bio3_1';
      case 'mod4': return window.Mod4Biophysics ? window.Mod4Biophysics.getActiveSub() : 'bio4_1';
      default: return 'bio1_1';
    }
  }

  function switchModule(modId) {
    appState.activeModule = modId;
    document.querySelectorAll('.nav-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mod === modId);
    });
    document.querySelectorAll('.module-section').forEach((sec) => {
      sec.classList.toggle('active', sec.id === modId);
    });

    window.Mod1Anatomy?.setRunning(modId === 'mod1');
    window.Mod2Cell?.setRunning(modId === 'mod2');
    window.Mod3Genetics?.setRunning(modId === 'mod3');
    window.Mod4Biophysics?.setRunning(modId === 'mod4');
    renderTheoryDrawer();
  }

  function renderMath(tex) {
    if (window.katex) {
      try {
        return window.katex.renderToString(tex, { displayMode: true, throwOnError: false });
      } catch (_) {}
    }
    return `<code>${tex}</code>`;
  }

  function renderInlineMathInText(html) {
    if (!window.katex) return html;
    return html.replace(/\$([^$]+)\$/g, (_, tex) => {
      try {
        return window.katex.renderToString(tex, { displayMode: false, throwOnError: false });
      } catch (_) {
        return tex;
      }
    });
  }

  function renderTheoryDrawer() {
    const key = getActiveSubKey();
    const entry = SCIENCE_WIKI[key] || SCIENCE_WIKI.bio1_1;

    const titleEl = $('theoryDrawerTitle');
    if (titleEl) titleEl.textContent = entry.title;

    document.querySelectorAll('.theory-tab-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.ttab === appState.activeTheoryTab);
    });

    const bodyEl = $('theoryDrawerBody');
    if (!bodyEl) return;

    if (appState.activeTheoryTab === 'intuitive') {
      bodyEl.innerHTML = `
        <div class="theory-card">
          <h4>💡 Sezgisel Biyolojik Mantık (Nasıl Çalışır?)</h4>
          <p>${renderInlineMathInText(entry.intuitive)}</p>
        </div>`;
    } else if (appState.activeTheoryTab === 'history') {
      bodyEl.innerHTML = `
        <div class="theory-card">
          <h4>🏛️ Keşif Tarihi ve Bilim İnsanları</h4>
          <p>${renderInlineMathInText(entry.history)}</p>
        </div>`;
    } else if (appState.activeTheoryTab === 'formulas') {
      bodyEl.innerHTML = entry.formulas.map((f, i) => `
        <div class="theory-card">
          <h4>📐 İlişki ${i + 1}</h4>
          <div class="formula-box">${renderMath(f.tex)}</div>
          <p style="font-size:12.5px;color:var(--muted);">${f.desc}</p>
        </div>
      `).join('');
    } else if (appState.activeTheoryTab === 'tasks') {
      bodyEl.innerHTML = entry.tasks.map((t, idx) => `
        <div class="task-step">
          <div class="task-num">${idx + 1}</div>
          <div style="flex:1;">
            <p style="margin-bottom:8px;">${t.step}</p>
            <button class="action-btn" data-task-idx="${idx}" style="padding:5px 11px;font-size:11.5px;">
              🎯 Bu Kurulumu Simülasyona Uygula
            </button>
          </div>
        </div>
      `).join('');

      bodyEl.querySelectorAll('[data-task-idx]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = +btn.dataset.taskIdx;
          const task = entry.tasks[idx];
          if (task && task.preset) {
            runTaskPreset(task.preset);
            $('theoryDrawerBackdrop').hidden = true;
          }
        });
      });
    }
  }

  function runTaskPreset(preset) {
    const modNum = preset.sub ? preset.sub.split('_')[0] : '1';
    switchModule(`mod${modNum}`);
    const map = {
      '1': window.Mod1Anatomy,
      '2': window.Mod2Cell,
      '3': window.Mod3Genetics,
      '4': window.Mod4Biophysics
    };
    if (map[modNum] && map[modNum].applyPreset) {
      map[modNum].applyPreset(preset);
    }
  }

  function initThemeAndFullscreen() {
    const themeBtn = $('themeToggleBtn');
    const updateThemeLabel = () => {
      const isLight = document.documentElement.dataset.theme === 'light';
      if (themeBtn) {
        themeBtn.textContent = isLight ? '🌙 Karanlık Lab' : '☀️ Aydınlık Tema';
      }
    };
    updateThemeLabel();

    themeBtn?.addEventListener('click', () => {
      const isLight = document.documentElement.dataset.theme === 'light';
      if (isLight) {
        delete document.documentElement.dataset.theme;
        try { localStorage.setItem('affebio_theme', 'dark'); } catch (_) {}
      } else {
        document.documentElement.dataset.theme = 'light';
        try { localStorage.setItem('affebio_theme', 'light'); } catch (_) {}
      }
      updateThemeLabel();
    });

    $('fullscreenBtn')?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    });
  }

  function init() {
    initThemeAndFullscreen();

    document.querySelectorAll('.nav-tab').forEach((btn) => {
      btn.addEventListener('click', () => switchModule(btn.dataset.mod));
    });

    const backdrop = $('theoryDrawerBackdrop');
    $('openTheoryDrawerBtn')?.addEventListener('click', () => {
      renderTheoryDrawer();
      if (backdrop) backdrop.hidden = false;
    });
    $('closeTheoryDrawerBtn')?.addEventListener('click', () => {
      if (backdrop) backdrop.hidden = true;
    });
    backdrop?.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.hidden = true;
    });

    document.querySelectorAll('.theory-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        appState.activeTheoryTab = btn.dataset.ttab;
        renderTheoryDrawer();
      });
    });

    // 4 Biyoloji Modülünü Başlat
    window.Mod1Anatomy?.init();
    window.Mod2Cell?.init();
    window.Mod3Genetics?.init();
    window.Mod4Biophysics?.init();

    renderTheoryDrawer();
  }

  window.AffeBio = {
    switchModule,
    onSubtabChanged: renderTheoryDrawer
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
