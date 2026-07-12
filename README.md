# Sachan Rai — Portfolio

A single-page portfolio site for a Computer Engineering student at the University of Waterloo. Built as a standalone static site — plain HTML, CSS, and vanilla JavaScript with no build step.

Imported from a [Claude Design](https://claude.ai/design) concept and implemented as a fully deployable static site.

## Features

- **Accent-derived theming** — every surface, border, and chip is derived from a single `--accent` token via CSS `color-mix`, so re-tinting the whole page is a one-line change.
- **Custom circle cursor** — a ring that lerp-follows the pointer and grows over interactive elements (fine-pointer devices only).
- **Scroll-reveal header** — the sticky nav slides in once the hero name scrolls out of view.
- **In-page resume viewer** — Hardware / Software resumes render to canvas via [PDF.js](https://mozilla.github.io/pdf.js/), with the PDF's real hyperlinks recreated as clickable overlays and a download button. No iframe, no new tab.

## Structure

```
index.html   markup + styles
main.js      cursor, header reveal, resume dropdown, PDF viewer
assets/      resume PDFs
```

## Running locally

It's fully static, but the PDF viewer uses `fetch`, so serve it over HTTP rather than opening the file directly:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## Deploying to GitHub Pages

Push to GitHub, then enable **Settings → Pages → Deploy from branch → `main` / root**.
