# MMSports — Project Site (v1.2)

Repositorio listo para **GitHub Pages (Project Site)** con despliegue vía **GitHub Actions**.

## Estructura
- `index.html` — portada.
- `WebSites/` — landing y subapps:
  - `WebSites/TennisSimulator/` (v2 completa)
  - `WebSites/NFLSimulator/` (placeholder; usa `tools/` para integrar tu versión real)
- `assets/site.js` y `assets/site.css` — navbar y footer globales.
- `.github/workflows/pages.yml` — workflow recomendado (incluye `configure-pages`).
- `.nojekyll`
- `tools/` — scripts para integrar NFLSimulator desde repo o carpeta local.

## Publicación
1) Crea el repo **MMSports** en GitHub.
2) Sube estos archivos en la **raíz** del repo (rama `main`).
3) En **Settings → Pages**, selecciona **Source = GitHub Actions**.
4) Verás la URL final en el job **Deploy to GitHub Pages** (debe ser: `https://amante.github.io/MMSports/`).

