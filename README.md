# artyomsimitian.com

Personal portfolio for Artyom Simitian: CS senior at CSU Northridge building backend
systems, data pipelines, and algorithm visualizers.

**Live:** https://artyomsimitian.com

## Stack

Plain HTML, CSS, and vanilla JavaScript. No build step, no framework: open `index.html`
or serve the folder with any static host.

- `index.html`: single page: hero, stack, projects, experience, about, contact
- `style.css`: all styles (theme tokens in `:root`, responsive rules at the bottom)
- `script.js`: the sorting-name hero (generator-based sorts), the six live project demos (canvas, SVG, DOM), active nav link
- `assets/`: WebP images, favicon, résumé PDF

Fonts: Manrope for display and body text, IBM Plex Mono for data labels, via Google Fonts.

## Updating content

- **Add a project:** copy one `<article class="project">` block in `index.html` and edit the
  `data-demo` name, stack line, title, description, and links. Demos live in `script.js` as `demos.<name>`; a static image works too: put it in
  `assets/` as a ~1200 px-wide WebP.
- **Change colors:** edit the tokens in `:root` in `style.css` (`--surface`, `--text`, `--accent` blue, `--warm` orange). The soft shadows come from `--shade` and `--light`.
- **Résumé:** replace `assets/Artyom Simitian Resume 2026.pdf` and update the two links that
  point at it.

## Local preview

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## License

Personal portfolio: content and images © Artyom Simitian. Feel free to borrow the structure.
