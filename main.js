/* ============================================================
   Sachan Rai — portfolio interactions
   Ported from the original Claude Design component to vanilla JS:
   custom circle cursor, scroll-reveal header, and an in-page
   resume viewer (native <iframe> PDF rendering — no dependencies).
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

  /* ---- IN-PAGE RESUME VIEWER -------------------------------------
     Native browser PDF rendering inside a styled modal via <iframe>.
     No external library — works on any static host. */
  const backdrop = document.getElementById('viewer-backdrop');
  const panel = backdrop.querySelector('.viewer-panel');
  const frame = document.getElementById('pdf-frame');
  const titleEl = document.getElementById('viewer-title');
  const downloadEl = document.getElementById('viewer-download');
  const closeBtn = document.getElementById('viewer-close');

  const lockScroll = (on) => {
    const v = on ? 'hidden' : '';
    document.documentElement.style.overflow = v;
    document.body.style.overflow = v;
  };

  const openViewer = (kind) => {
    const meta = RESUMES[kind];
    if (!meta) return;
    setMenu(false);
    titleEl.textContent = meta.title;
    downloadEl.href = meta.path;
    downloadEl.setAttribute('download', meta.file);
    // #view=FitH fits the page to the viewer width in the native viewer
    frame.src = meta.path + '#view=FitH';
    lockScroll(true);
    backdrop.classList.add('open');
  };

  const closeViewer = () => {
    lockScroll(false);
    backdrop.classList.remove('open');
    frame.src = 'about:blank'; // stop rendering / free memory
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
