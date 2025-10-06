# MMSports — Project Site (v1.2)

Repositorio con landing y subproyectos bajo `/WebSites`, listo para **GitHub Pages** con **Actions**.

## Contenido
- `index.html` — portada del repo.
- `WebSites/` — landing interna y subapps:
  - `WebSites/TennisSimulator/` (v2: logístico + Monte Carlo, odds, IC95%)
  - `WebSites/NFLSimulator/` (placeholder; integra tu versión con `tools/`)
- `assets/site.js` y `assets/site.css` — navbar + footer globales (v1.2.0).
- `.github/workflows/pages.yml` — workflow de despliegue.
- `.nojekyll`
- `tools/` — scripts para integrar **NFLSimulator** desde repo o carpeta local `NFL`.

## Publicación (Project Site)
1) Crea el repo **MMSports** en tu cuenta GitHub.
2) Copia estos archivos en la **raíz** del repo y haz push a `main`:
   ```bash
   git init
   git add .
   git commit -m "MMSports v1.2 — inicial"
   git branch -M main
   git remote add origin https://github.com/<TU_USUARIO>/MMSports.git
   git push -u origin main
   ```
3) En **Settings → Pages**, elige **GitHub Actions** como fuente.
4) Tu sitio quedará en: `https://<TU_USUARIO>.github.io/MMSports/`

## Integrar tu NFLSimulator
- **Remoto**: `NFL_REPO_URL=https://github.com/<TU_USUARIO>/NFLSimulator.git ./tools/sync_nfslimulator.sh /ruta/a/MMSports`
- **Local** (proyecto `NFL`): `./tools/sync_nfslimulator.sh /ruta/a/MMSports --use-local /ruta/a/NFL`

Los scripts:
- Copian contenidos a `WebSites/NFLSimulator/`
- Promueven `dist/`, `build/` o `public/` si corresponde
- Inyectan navbar/footer y ajustan la ruta a `../../assets/site.js`

