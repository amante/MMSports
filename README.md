# MMSports v1.3.0

**Fix pack v1.3.0** sobre la base v1-2-full:

- ✅ IDs críticos presentes: `fileInput`, `dropzone`, `carousel`, `playersTable`, `summary`, `prevBtn`, `nextBtn`, `playerSearch`.
- ✅ Inclusión por CDN: Tailwind + SheetJS/XLSX.
- ✅ **Validaciones** de headers y tipos con panel de advertencias.
- ✅ **Cálculo de restante** y **estado (cumple)** con coloreado.
- ✅ **Propagación** de cambios desde Jugadores hacia Cartillas.
- ✅ **Persistencia local** (LocalStorage `mmsports_*`) + Export/Import JSON.
- ✅ **Modo impresión en columnas** (Auto / 2 / 3).
- ✅ **Animación de victoria** (confetti) cuando todas las cartillas se cumplen.
- ✅ **Manejo de CSV** robusto (comillas, campos con comas).
- ✅ **Workflow GitHub Pages** `.github/workflows/pages.yml` incluido.

## Estructura de datos esperada

### Cartillas
- `Cartilla`, `Jugador`, `Estadistica`, `Condicion` (`>=` o `<=`), `Objetivo`, `Actual?`

### Jugadores
- `Jugador`, `Estadistica`, `Valor`

> Coincidencia por (`Jugador`, `Estadistica`) case-insensitive.

## Uso
1. Abrir `index.html` o publicar en GitHub Pages.
2. Cargar `.xlsx` con hojas **Cartillas**/**Jugadores** o `.csv` conforme a plantillas.
3. Editar valores de jugadores y observar propagación.
4. Exportar/Importar estado desde los botones del topbar.
5. Elegir columnas para impresión desde el selector (Auto/2/3) y usar **Imprimir**.

## Notas
- Build 2025-10-13.
- Este paquete sobrescribe/estandariza la UI; si tenías estilos/IDs distintos, ajusta referencias en tu código si hace falta.
