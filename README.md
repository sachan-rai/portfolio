# Sachan Rai — Portfolio

A single-page portfolio site for a Computer Engineering student at the University of Waterloo. Built as a standalone static site — plain HTML, CSS, and vanilla JavaScript with no build step.

Imported from a [Claude Design](https://claude.ai/design) concept and implemented as a fully deployable static site.

## Features

- **Accent-derived theming** — every surface, border, and chip is derived from a single `--accent` token via CSS `color-mix`, so re-tinting the whole page is a one-line change.
- **Custom circle cursor** — a ring that lerp-follows the pointer and grows over interactive elements (fine-pointer devices only).
- **Scroll-reveal header** — the sticky nav slides in once the hero name scrolls out of view.
- **In-page resume viewer** — Hardware / Software resumes open in a styled modal, rendered natively by the browser's built-in PDF viewer (`<iframe>`), with a download button. No external libraries.

## Structure

```
index.html   markup + styles
main.js      cursor, header reveal, resume dropdown, PDF viewer
assets/      resume PDFs
```

## Running locally

It's fully static. Serving over HTTP (rather than opening the file directly) is recommended so the resume PDFs load reliably:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## Deploying to GitHub Pages

Push to GitHub, then enable **Settings → Pages → Deploy from branch → `main` / root**.
