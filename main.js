/* ============================================================
   Sachan Rai — portfolio interactions (SR-2026 / "Portfolio v3")

   Ported from the Claude Design component to vanilla JS: an 8-panel
   deck, a bring-up boot overlay, an oscilloscope hero, a probe HUD,
   a lab/daylight theme toggle, and an in-page resume viewer.

   PDF.js is vendored locally (vendor/pdf.min.js + pdf.worker.min.js)
   and loaded same-origin — no CDN, no cross-origin worker. PDFs are
   prefetched to an ArrayBuffer and handed to PDF.js as bytes, which
   is robust across static hosts.
   ============================================================ */
(() => {
  'use strict';

  const PANELS = 8;
  const ACCENT_PAPER = '#c0391b';
  const ACCENT_LAB = '#e0491f';

  // panel index -> header nav item to highlight (3 experience panels share one)
  const NAV_FOR_PANEL = { 1: 's01', 2: 's02', 3: 's02', 4: 's02', 5: 's03', 6: 's04', 7: 's05' };

  const DOT_LABELS = [
    'COVER', '1 — DESCRIPTION', '2.1 — NARRATIVE PROJECTS', '2.2 — CANADIAN ANALYTICAL',
    '2.3 — WATERLOO ROCKETRY', '3 — PROJECTS', '4 — TOOLS', '5 — CONTACT',
  ];

  const RESUMES = {
    hardware: {
      path: 'assets/Sachan_Rai_Hardware_Resume.pdf',
      title: 'SR-2026-HW — hardware resume',
      file: 'Sachan_Rai_Hardware_Resume.pdf',
    },
    software: {
      path: 'assets/Sachan_Rai_Software_Resume.pdf',
      title: 'SR-2026-SW — software resume',
      file: 'Sachan_Rai_Software_Resume.pdf',
    },
  };

  const PALETTES = {
    paper: {
      '--paper': '#f2efe6', '--ink': '#1a1813', '--muted': '#6f695c',
      '--rule': 'rgba(26,24,19,0.18)', '--rule-soft': 'rgba(26,24,19,0.09)',
      '--surface': 'rgba(26,24,19,0.035)', '--led-glow': 'none',
    },
    lab: {
      '--paper': '#171511', '--ink': '#ece7da', '--muted': '#9b9484',
      '--rule': 'rgba(236,231,218,0.22)', '--rule-soft': 'rgba(236,231,218,0.1)',
      '--surface': 'rgba(236,231,218,0.05)', '--led-glow': '0 0 12px 2px var(--accent)',
    },
  };

  const $ = (sel) => document.querySelector(sel);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const root = $('#root');
  const progressEl = $('#progress');
  const counterEl = $('#counter');
  const dotsEl = $('#dots');
  const bootEl = $('#boot');
  const hudV = $('#hud-v');
  const hudH = $('#hud-h');
  const hudTag = $('#hud-tag');
  const scopeCanvas = $('#scope');
  const chipBtn = $('#chip');

  const panels = [...root.querySelectorAll('[data-panel]')];

  let panel = 0;
  let started = false;
  let booting = false;
  let lab = false;
  let viewer = null;      // 'hardware' | 'software' | null
  let mouseX = -9999;
  let mouseY = -9999;
  let refreshHud = () => {}; // set by setupHud on fine-pointer devices

  /* ---- THEME ------------------------------------------------------ */
  // The crosshair a clickable element gets. Native `crosshair` can't be
  // recoloured, so it's redrawn as an SVG cursor in the current accent and
  // handed to CSS as --probe-cursor. Hotspot sits at the intersection.
  const probeCursor = (color) =>
    'url("data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" shape-rendering="crispEdges">'
      + '<path d="M11.5 0v24M0 11.5h24" stroke="' + color + '" stroke-width="1"/></svg>'
    ) + '") 12 12, crosshair';

  const applyTheme = () => {
    const el = document.documentElement;
    Object.entries(PALETTES[lab ? 'lab' : 'paper']).forEach(([k, v]) => el.style.setProperty(k, v));
    const accent = lab ? ACCENT_LAB : ACCENT_PAPER;
    el.style.setProperty('--accent', accent);
    el.style.setProperty('--probe-cursor', probeCursor(accent));
    scopeColors = null; // re-read on next scope frame
  };

  const toggleLab = () => {
    lab = !lab;
    try { localStorage.setItem('sr2026-lab2', lab ? '1' : '0'); } catch (e) { /* private mode */ }
    applyTheme();
    setChipProbe();
    refreshHud(); // the pointer is still on the chip; repaint its now-stale label
  };

  const setChipProbe = () => {
    chipBtn.setAttribute('data-probe',
      lab ? 'POWER: LAB MODE · CLICK FOR DAYLIGHT' : 'POWER: DAYLIGHT · CLICK FOR LAB MODE');
  };

  /* ---- PANEL DECK ------------------------------------------------- */
  const animateIn = (p) => {
    const pops = [...p.querySelectorAll('[data-pop]')];
    if (reduced) {
      pops.forEach((el) => { el.style.opacity = '1'; el.style.transform = 'none'; });
      return;
    }
    pops.forEach((el) => {
      el.style.transition = 'none';
      el.style.opacity = '0';
      el.style.transform = 'translateY(26px)';
    });
    void p.offsetHeight; // flush the reset before staggering back in
    pops.forEach((el, i) => {
      const d = 160 + i * 75;
      el.style.transition = 'opacity .65s cubic-bezier(.16,1,.3,1) ' + d + 'ms, transform .65s cubic-bezier(.16,1,.3,1) ' + d + 'ms';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });
  };

  const goTo = (n) => {
    if (booting) return;
    n = Math.max(0, Math.min(PANELS - 1, n));
    const prev = panel;
    if (n === prev && started) return;
    panel = n;
    started = true;

    const ease = 'transform .75s cubic-bezier(.22,1,.36,1), opacity .55s ease';
    panels.forEach((p, i) => {
      clearTimeout(p._hideT);
      if (i === n) {
        p.style.visibility = 'visible';
        p.style.pointerEvents = 'auto';
        if (i !== prev) {
          p.style.transition = 'none';
          p.style.transform = 'translateY(' + (n > prev ? '9%' : '-9%') + ') scale(.985)';
          p.style.opacity = '0';
          void p.offsetHeight;
        }
        p.style.transition = ease;
        p.style.transform = 'translateY(0) scale(1)';
        p.style.opacity = '1';
        const sc = p.querySelector('[data-scroll]');
        if (sc) sc.scrollTop = 0;
        animateIn(p);
      } else {
        p.style.transition = ease;
        p.style.pointerEvents = 'none';
        p.style.transform = 'translateY(' + (i < n ? '-9%' : '9%') + ') scale(.985)';
        p.style.opacity = '0';
        p._hideT = setTimeout(() => { p.style.visibility = 'hidden'; }, 780);
      }
    });

    progressEl.style.width = (n / (PANELS - 1)) * 100 + '%';
    counterEl.textContent = '0' + (n + 1) + ' / 08';

    const navId = NAV_FOR_PANEL[n] || null;
    root.querySelectorAll('[data-nav]').forEach((l) => {
      l.classList.toggle('active', l.getAttribute('data-nav') === navId);
    });
    dotsEl.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('active', i === n));
  };

  // dot rail
  DOT_LABELS.forEach((label, i) => {
    const b = document.createElement('button');
    b.className = 'dot';
    b.title = label;
    b.setAttribute('data-probe', label);
    b.addEventListener('click', () => goTo(i));
    dotsEl.appendChild(b);
  });

  // chip pin rows (7 pins above and below)
  root.querySelectorAll('.pin-row').forEach((row) => {
    for (let i = 0; i < 7; i++) {
      const pin = document.createElement('div');
      pin.style.cssText = 'width:11px; height:9px; background:var(--ink);';
      row.appendChild(pin);
    }
  });

  root.querySelectorAll('[data-go]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      goTo(Number(a.getAttribute('data-go')));
    });
  });

  chipBtn.addEventListener('click', toggleLab);

  /* ---- DECK NAVIGATION (wheel / keys / touch) ---------------------- */
  // A panel's own [data-scroll] gets first refusal on the gesture; the deck
  // only advances once that inner scroller is at its edge.
  const innerScrollBlocks = (target, goingDown) => {
    const sc = target && target.closest && target.closest('[data-scroll]');
    if (!sc || sc.scrollHeight <= sc.clientHeight + 2) return false;
    const atTop = sc.scrollTop <= 1;
    const atBottom = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1;
    return (goingDown && !atBottom) || (!goingDown && !atTop);
  };

  let lastNav = 0;
  let wheelAcc = 0;

  window.addEventListener('wheel', (e) => {
    if (viewer || booting) return;
    const down = e.deltaY > 0;
    if (innerScrollBlocks(e.target, down)) return;
    const now = performance.now();
    if (now - lastNav < 950) return;
    wheelAcc += e.deltaY;
    if (Math.abs(wheelAcc) > 45) {
      lastNav = now;
      wheelAcc = 0;
      goTo(panel + (down ? 1 : -1));
    }
  }, { passive: true });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && viewer) { closeViewer(); return; }
    if (viewer || booting) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); goTo(panel + 1); }
    else if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); goTo(panel - 1); }
    else if (e.key === 'Home') { e.preventDefault(); goTo(0); }
    else if (e.key === 'End') { e.preventDefault(); goTo(PANELS - 1); }
  });

  let touchY;
  let touchEl;
  window.addEventListener('touchstart', (e) => {
    touchY = e.touches[0].clientY;
    touchEl = e.target;
  }, { passive: true });

  window.addEventListener('touchend', (e) => {
    if (viewer || booting || touchY === undefined) return;
    const dy = touchY - e.changedTouches[0].clientY;
    touchY = undefined;
    if (Math.abs(dy) < 60) return;
    if (innerScrollBlocks(touchEl, dy > 0)) return;
    const now = performance.now();
    if (now - lastNav < 950) return;
    lastNav = now;
    goTo(panel + (dy > 0 ? 1 : -1));
  }, { passive: true });

  /* ---- BOOT / BRING-UP -------------------------------------------- */
  // 1-in-5 loops the probe cannon turns up.
  const cannonFound = Math.random() < 0.2;
  $('#boot-cannon').textContent = cannonFound ? 'FOUND' : 'NOT FOUND';
  $('#boot-cannon').style.color = cannonFound ? '#5da06a' : '#8f8877';
  $('#boot-statues').textContent = cannonFound ? '3/14' : '1/14';

  let bootT1;
  let bootT2;

  const endBoot = () => {
    clearTimeout(bootT1); clearTimeout(bootT2);
    try { sessionStorage.setItem('sr2026-booted', '1'); } catch (e) { /* private mode */ }
    bootEl.hidden = true;
    booting = false;
    goTo(0);
  };

  const startBoot = () => {
    let seen = false;
    try { seen = sessionStorage.getItem('sr2026-booted') === '1'; } catch (e) { /* private mode */ }
    if (seen || reduced) { goTo(0); return; }
    booting = true;
    bootEl.hidden = false;
    bootT1 = setTimeout(() => { bootEl.style.animation = 'boot-out .5s ease both'; }, 1900);
    bootT2 = setTimeout(endBoot, 2400);
  };

  bootEl.addEventListener('click', endBoot);

  /* ---- OSCILLOSCOPE (cover hero) ---------------------------------- */
  // Grid of dots plus a trace that bulges toward the pointer's x position.
  let scopeColors = null;
  let scopeRaf;

  const setupScope = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const fit = () => {
      const r = scopeCanvas.getBoundingClientRect();
      scopeCanvas.width = Math.max(1, r.width * dpr);
      scopeCanvas.height = Math.max(1, r.height * dpr);
    };
    fit();
    new ResizeObserver(fit).observe(scopeCanvas);

    let t = 0;
    const draw = () => {
      scopeRaf = requestAnimationFrame(draw);
      if (document.hidden || panel !== 0) return;

      const ctx = scopeCanvas.getContext('2d');
      const W = scopeCanvas.width;
      const H = scopeCanvas.height;

      if (!scopeColors) {
        const cs = getComputedStyle(document.documentElement);
        scopeColors = {
          accent: cs.getPropertyValue('--accent').trim() || ACCENT_PAPER,
          rule: cs.getPropertyValue('--rule').trim() || 'rgba(26,24,19,0.18)',
        };
      }

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = scopeColors.rule;
      const step = 34 * dpr;
      for (let x = step / 2; x < W; x += step) {
        for (let y = step / 2; y < H; y += step) ctx.fillRect(x, y, dpr, dpr);
      }

      const rect = scopeCanvas.getBoundingClientRect();
      const cx = (mouseX - rect.left) * dpr;
      const mid = H * 0.58;
      const baseA = H * 0.10;

      ctx.beginPath();
      ctx.lineWidth = 1.6 * dpr;
      ctx.strokeStyle = scopeColors.accent;
      ctx.shadowColor = scopeColors.accent;
      ctx.shadowBlur = lab ? 10 * dpr : 0;
      for (let x = 0; x <= W; x += 2 * dpr) {
        const d = (x - cx) / (110 * dpr);
        const boost = Math.exp(-d * d) * H * 0.24;
        const y = mid
          + Math.sin(x / (46 * dpr) + t * 1.6) * baseA
          + Math.sin(x / (13 * dpr) - t * 3.1) * baseA * 0.24
          + Math.sin(x / (7 * dpr) + t * 5.0) * boost * 0.55;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      t += 0.016;
      if (reduced) cancelAnimationFrame(scopeRaf);
    };
    scopeRaf = requestAnimationFrame(draw);
  };

  /* ---- PROBE HUD -------------------------------------------------- */
  const setupHud = () => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    let hudOn = false;
    let hudLabel = '';

    // Resolves the probe under (x,y) itself rather than trusting an event
    // target, so it can also be called when the pointer hasn't moved but the
    // label underneath it has changed.
    const paintHud = (x, y) => {
      if (x < 0 || y < 0) return;
      hudV.style.transform = 'translateX(' + x + 'px)';
      hudH.style.transform = 'translateY(' + y + 'px)';

      const under = document.elementFromPoint(x, y);
      const probe = under && under.closest && under.closest('[data-probe]');
      const label = probe
        ? 'PROBE ▸ ' + probe.getAttribute('data-probe')
        : 'X ' + String(x).padStart(4, '0') + ' · Y ' + String(y).padStart(4, '0');
      if (label !== hudLabel) { hudLabel = label; hudTag.textContent = label; }
      hudTag.style.color = probe ? 'var(--accent)' : 'var(--muted)';

      // flip the tag back inside the viewport near the right/bottom edges
      const flipX = x > window.innerWidth - 220;
      const flipY = y > window.innerHeight - 60;
      hudTag.style.transform = 'translate(' + (x + (flipX ? -12 : 14)) + 'px,'
        + (y + (flipY ? -34 : 16)) + 'px)' + (flipX ? ' translateX(-100%)' : '');
    };

    refreshHud = () => paintHud(mouseX, mouseY);

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!hudOn) {
        hudOn = true;
        [hudV, hudH, hudTag].forEach((el) => { el.style.opacity = 1; });
      }
      paintHud(e.clientX, e.clientY);
    }, { passive: true });

    document.documentElement.addEventListener('mouseleave', () => {
      hudOn = false;
      [hudV, hudH, hudTag].forEach((el) => { el.style.opacity = 0; });
    });
  };

  /* ---- RESUME VIEWER (PDF.js -> canvas) --------------------------- */
  const backdrop = $('#viewer-backdrop');
  const viewerPanel = $('#viewer-panel');
  const stack = $('#pdf-stack');
  const titleEl = $('#viewer-title');
  const downloadEl = $('#viewer-download');

  let renderToken = 0;
  const pdfCache = {}; // kind -> Promise<ArrayBuffer>

  const setStatus = (html) => {
    stack.innerHTML = '<span style="font-family:\'IBM Plex Mono\',monospace; font-size:13px; color:#a49e8e; padding:30px 0; text-align:center;">' + html + '</span>';
  };

  // Same-origin fetch; a non-200 throws with the status so the viewer can
  // say exactly what went wrong (e.g. HTTP 404) instead of a generic error.
  const fetchPdf = (kind) => {
    if (!pdfCache[kind]) {
      pdfCache[kind] = fetch(RESUMES[kind].path).then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' fetching ' + RESUMES[kind].path);
        return r.arrayBuffer();
      });
    }
    return pdfCache[kind];
  };

  async function renderPdf(kind) {
    const token = ++renderToken;
    try {
      const pdfjs = window.pdfjsLib;
      if (!pdfjs) throw new Error('pdf.js library not loaded');
      // same-origin worker — no cross-origin blob/importScripts fallback
      pdfjs.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.js';

      const buf = await fetchPdf(kind);
      if (token !== renderToken) return;

      // slice(): pdf.js transfers the buffer to its worker; keep our copy
      const doc = await pdfjs.getDocument({ data: buf.slice(0) }).promise;
      if (token !== renderToken) return;

      stack.innerHTML = '';
      const width = Math.min(stack.clientWidth - 36, 860);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        if (token !== renderToken) return;
        const base = page.getViewport({ scale: 1 });
        const scale = width / base.width;

        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:relative; flex:0 0 auto; width:' + width + 'px; box-shadow:0 4px 18px rgba(0,0,0,0.4); overflow:hidden;';

        const canvas = document.createElement('canvas');
        const vp = page.getViewport({ scale: scale * dpr });
        canvas.width = vp.width; canvas.height = vp.height;
        canvas.style.cssText = 'width:' + width + 'px; display:block;';
        wrap.appendChild(canvas);
        stack.appendChild(wrap);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;

        // recreate the PDF's real hyperlinks as clickable <a>s over the page
        try {
          const annotations = await page.getAnnotations();
          const layerVp = page.getViewport({ scale });
          annotations.filter((a) => a.subtype === 'Link' && a.url && a.rect).forEach((a) => {
            const [x1, y1, x2, y2] = layerVp.convertToViewportRectangle(a.rect);
            const el = document.createElement('a');
            el.href = a.url; el.target = '_blank'; el.rel = 'noopener'; el.title = a.url;
            el.style.cssText = 'position:absolute; left:' + Math.min(x1, x2) + 'px; top:' + Math.min(y1, y2)
              + 'px; width:' + Math.abs(x2 - x1) + 'px; height:' + Math.abs(y2 - y1) + 'px; z-index:2;';
            wrap.appendChild(el);
          });
        } catch (e) { /* no annotations — page stays view-only */ }
      }
    } catch (err) {
      if (token === renderToken) {
        // surface the real cause; the download button above still works
        setStatus('<span style="color:#c98a8a;">could not load PDF — '
          + String(err && err.message ? err.message : err) + '</span><br><br>use the download button above.');
      }
    }
  }

  const openViewer = (kind) => {
    const meta = RESUMES[kind];
    if (!meta) return;
    viewer = kind;
    titleEl.textContent = meta.title;
    downloadEl.href = meta.path;
    downloadEl.setAttribute('download', meta.file);
    setStatus('loading pages…');
    backdrop.hidden = false;
    renderPdf(kind);
  };

  function closeViewer() {
    renderToken++; // cancel any in-flight render
    viewer = null;
    backdrop.hidden = true;
    setStatus('loading pages…');
  }

  root.querySelectorAll('[data-resume]').forEach((b) => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      openViewer(b.getAttribute('data-resume'));
    });
  });

  backdrop.addEventListener('click', closeViewer);
  viewerPanel.addEventListener('click', (e) => e.stopPropagation());
  $('#viewer-close').addEventListener('click', closeViewer);

  /* ---- INIT ------------------------------------------------------- */
  try {
    // 'sr2026-lab2' — the old 'sr2026-lab' key predates the lab-mode default
    const saved = localStorage.getItem('sr2026-lab2');
    lab = saved !== null ? saved === '1' : true;
  } catch (e) { lab = true; }

  applyTheme();
  setChipProbe();
  setupHud();
  setupScope();
  startBoot();
})();
