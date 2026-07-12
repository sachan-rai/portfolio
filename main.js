/* ============================================================
   Sachan Rai — portfolio interactions
   Ported from the original Claude Design component to vanilla JS:
   custom circle cursor, scroll-reveal header, and an in-page
   PDF.js resume viewer (no iframe, no new tab).
   ============================================================ */
(() => {
  'use strict';

  const RESUMES = {
    hardware: {
      path: 'assets/Sachan_Rai_Hardware_Resume.pdf',
      title: 'resume — hardware.pdf',
      file: 'Sachan_Rai_Hardware_Resume.pdf',
    },
    software: {
      path: 'assets/Sachan_Rai_Software_Resume.pdf',
      title: 'resume — software.pdf',
      file: 'Sachan_Rai_Software_Resume.pdf',
    },
  };

  /* ---- CUSTOM CIRCLE CURSOR --------------------------------------
     Ring lerps toward the pointer each frame; dot snaps to it.
     Ring grows over links/buttons. Imperative rAF, no re-renders. */
  const ring = document.getElementById('cursor-ring');
  const dot = document.getElementById('cursor-dot');
  // enable only on devices with a fine pointer (skip touch)
  if (window.matchMedia && window.matchMedia('(pointer: fine)').matches) {
    document.documentElement.classList.add('custom-cursor');
    let mx = -100, my = -100, rx = -100, ry = -100, seen = false;
    const LERP = 0.16; // lower = floatier ring

    window.addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      if (!seen) { seen = true; rx = mx; ry = my; dot.style.opacity = 1; ring.style.opacity = 1; }
      dot.style.transform = 'translate(' + mx + 'px,' + my + 'px)';
      const hot = e.target.closest && e.target.closest('a, button');
      const s = hot ? 52 : 34;
      ring.style.width = s + 'px';
      ring.style.height = s + 'px';
      ring.style.margin = '-' + (s / 2) + 'px 0 0 -' + (s / 2) + 'px';
    }, { passive: true });

    document.documentElement.addEventListener('mouseleave', () => {
      dot.style.opacity = 0; ring.style.opacity = 0; seen = false;
    });

    const tick = () => {
      rx += (mx - rx) * LERP;
      ry += (my - ry) * LERP;
      ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px)';
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---- SCROLL-REVEAL HEADER --------------------------------------
     Top bar slides in once the hero name has scrolled out of sight. */
  const header = document.getElementById('site-header');
  const heroName = document.getElementById('hero-name');
  const onScroll = () => {
    const limit = heroName ? heroName.offsetTop + heroName.offsetHeight : 300;
    header.classList.toggle('revealed', window.scrollY > limit);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- RESUME DROPDOWN -------------------------------------------- */
  const toggle = document.getElementById('resume-toggle');
  const menu = document.getElementById('resume-menu');
  const caret = document.getElementById('resume-caret');
  const setMenu = (open) => {
    menu.classList.toggle('open', open);
    caret.textContent = open ? '▴' : '▾';
  };
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    setMenu(!menu.classList.contains('open'));
  });
  document.addEventListener('click', () => setMenu(false));

  /* ---- IN-PAGE PDF VIEWER ----------------------------------------- */
  const backdrop = document.getElementById('viewer-backdrop');
  const panel = backdrop.querySelector('.viewer-panel');
  const stack = document.getElementById('pdf-stack');
  const titleEl = document.getElementById('viewer-title');
  const downloadEl = document.getElementById('viewer-download');
  const closeBtn = document.getElementById('viewer-close');

  let renderToken = 0;

  const lockScroll = (on) => {
    const v = on ? 'hidden' : '';
    document.documentElement.style.overflow = v;
    document.body.style.overflow = v;
  };

  const closeViewer = () => {
    renderToken++;
    lockScroll(false);
    backdrop.classList.remove('open');
    stack.innerHTML = '<span id="pdf-status">loading pages…</span>';
  };

  async function renderPdf(kind) {
    const meta = RESUMES[kind];
    if (!meta) return;
    const token = ++renderToken;
    try {
      // wait for pdf.js (usually instant)
      for (let i = 0; i < 100 && !window.pdfjsLib; i++) await new Promise(r => setTimeout(r, 50));
      const pdfjs = window.pdfjsLib;
      if (!pdfjs) throw new Error('pdf.js failed to load');
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      const doc = await pdfjs.getDocument(meta.path).promise;
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
        wrap.style.cssText = 'position:relative; flex:0 0 auto; width:' + width + 'px; border-radius:6px; box-shadow:0 4px 18px rgba(0,0,0,0.4); overflow:hidden;';

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
          const links = annotations.filter(a => a.subtype === 'Link' && a.url && a.rect);
          const layerVp = page.getViewport({ scale });
          links.forEach(a => {
            const [x1, y1, x2, y2] = layerVp.convertToViewportRectangle(a.rect);
            const left = Math.min(x1, x2), top = Math.min(y1, y2);
            const el = document.createElement('a');
            el.href = a.url; el.target = '_blank'; el.rel = 'noopener'; el.title = a.url;
            el.style.cssText = 'position:absolute; left:' + left + 'px; top:' + top + 'px; width:'
              + Math.abs(x2 - x1) + 'px; height:' + Math.abs(y2 - y1) + 'px; z-index:2; cursor:pointer;';
            wrap.appendChild(el);
          });
        } catch (e) { /* no annotations — page stays view-only */ }
      }
    } catch (err) {
      if (token === renderToken) {
        stack.innerHTML = '<span style="font-family:monospace;font-size:13px;color:#c98a8a;padding:30px 0;">could not load PDF — use download instead</span>';
      }
    }
  }

  const openViewer = (kind) => {
    const meta = RESUMES[kind];
    if (!meta) return;
    setMenu(false);
    titleEl.textContent = meta.title;
    downloadEl.href = meta.path;
    downloadEl.setAttribute('download', meta.file);
    lockScroll(true);
    backdrop.classList.add('open');
    renderPdf(kind);
  };

  menu.querySelectorAll('button[data-resume]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openViewer(btn.getAttribute('data-resume'));
    });
  });

  backdrop.addEventListener('click', closeViewer);
  panel.addEventListener('click', (e) => e.stopPropagation());
  closeBtn.addEventListener('click', closeViewer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && backdrop.classList.contains('open')) closeViewer();
  });
})();
