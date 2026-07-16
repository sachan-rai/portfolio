# Sachan Rai — Portfolio

A single-page portfolio site for a Computer Engineering student at the University of Waterloo, styled as a semiconductor datasheet. Built as a standalone static site — plain HTML, CSS, and vanilla JavaScript with no build step.

Imported from a [Claude Design](https://claude.ai/design) concept ("Portfolio v3") and implemented as a fully deployable static site.

## Features

- **Panel deck** — eight datasheet "pages" navigated by scroll, arrow keys, swipe, the header nav, or the dot rail, with a progress bar and page counter. Each panel scrolls internally first and only advances the deck once it hits its edge.
- **Bring-up boot sequence** — a terminal-style POST screen on first load, skippable by click and shown once per session (`sessionStorage`).
- **Oscilloscope hero** — a canvas trace behind the name that bulges toward the pointer's x position.
- **Probe HUD** — crosshair rules that follow the pointer and read out either coordinates or the label of whatever `[data-probe]` element sits under it (fine-pointer devices only).
- **Lab / daylight themes** — the SR-2026 chip on the cover is a power toggle that swaps the whole palette; the choice persists in `localStorage`.
- **In-page resume viewer** — Hardware / Software resumes render to `<canvas>` via [PDF.js](https://mozilla.github.io/pdf.js/) (vendored locally in `vendor/`, loaded same-origin — no CDN, no cross-origin worker), with the PDF's real hyperlinks recreated as clickable overlays and a download button.

All animation respects `prefers-reduced-motion`.

## Structure

```
index.html   markup + styles
main.js      panel deck, boot, oscilloscope, probe HUD, theme, PDF viewer
assets/      resume PDFs
vendor/      PDF.js library + worker (vendored, same-origin)
```

## Running locally

It's fully static, but the resume viewer uses `fetch` + a Web Worker, so serve it over HTTP rather than opening the file directly:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## Deploying to GitHub Pages

Push to GitHub, then enable **Settings → Pages → Deploy from branch → `main` / root**.
