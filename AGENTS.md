# AGENTS.md — instrucciones para agentes en este repo

Guía para cualquier agente de IA (o persona) que trabaje en Tactical Soccer · Gañan Edition.

## Qué es este proyecto

Juego de fútbol táctico por turnos **5v5 en un campo de 9×5 casillas con vista isométrica**,
hecho como web app estática. Stack: **Vue 3 + TypeScript + Vite + SVG**, sin backend ni
servicios externos: todo el cálculo ocurre en el navegador y los ajustes guardados viven en
`localStorage`.

- Demo pública: https://sergarb1.github.io/TacticalSoccer/
- Repo: https://github.com/sergarb1/TacticalSoccer

## Comandos

```bash
npm ci                    # instalar dependencias
npx vitest run            # pruebas (motor + partidas completas de IA)
npx vue-tsc --noEmit      # typecheck (revisa también los .vue)
npm run build             # build de producción en dist/
```

Todo cambio debe pasar los tres pasos antes de considerarse terminado. Las 30 pruebas
deben seguir pasando.

## Arquitectura y convenciones

- **Motor puro** en `src/game/`: sin DOM ni `Math.random` directo; usa el RNG con semilla
  del estado (`s.rng`). Las reglas (costes AP, probabilidad de gol, alcance) están
  centralizadas en `src/game/config.ts` — cambia ahí, no en los módulos.
- **IA** en `src/ai/`: solo propone acciones legales; `tests/ai.spec.ts` verifica
  invariantes jugando partidas completas. Si tocas el motor, el guard de AP y las
  validaciones de `rules.ts` no se pueden saltar.
- **UI** en `src/components/` + `src/composables/useGame.ts` (tienda central). La UI
  consume los eventos del motor y no los interpreta dos veces.
- **Todo el texto visible está en español** (con sabor intencionalmente valencianista,
  «Gañan Edition»). Mantén ese tono en la UI y en la narración
  (`src/game/commentary.ts`, puramente cosmética: NUNCA debe afectar al motor ni al RNG).
- Formato del campo: 13 columnas × 7 filas (campo grande con más alcance de
  movimiento y pase), portería de 1 casilla en la fila `GOAL_CENTER_ROW`,
  5 jugadores por equipo (1 POR + 4 de campo), 3 AP por turno, tiros
  especiales «Tiro Billetes» y «Vaselina» (2 AP) y postura de corte (`cut`)
  como acción defensiva. `src/game/serialize.ts` valida esa estructura: si
  cambias el formato, actualiza el validador (y sube la clave de
  `STORAGE_KEYS` cuando el cambio sea incompatible) para que las partidas
  guardadas se descarten con gracia.
- **Comentarios y commits en español**; títulos de commit cortos y descriptivos.
- Los nombres de los futbolistas son homenajes ficticios (leyendas del Valencia CF);
  no usar nombres reales de jugadores activos ni escudos/marcas reales.

## Assets y licencias (importante)

- Arte y sonidos sintetizados propios, más:
  - Tipografía **Bebas Neue** (SIL OFL 1.1) en `public/fonts/` — NO sustituirla por una
    fuente sin licencia OFL o autoalojada desde CDN comercial.
  - Sonidos **CC0 de Kenney** (pack Ultrasound) en `public/sfx/`.
- Cualquier asset nuevo debe ser CC0/MIT/OFL u otra licencia permisiva, autoalojado en
  `public/`, y declararse en `ATTRIBUTIONS.md`. Prohibido meter recursos comerciales o
  con licencia dudosa.
- La atribución de IA generadora no es necesaria en los commits de este repo.

## Despliegue

Cada push a `main` dispara `.github/workflows/deploy.yml` (Pages, Node 22):
`npm ci → vitest → build → deploy`. No borrar ni renombrar el workflow; si el build
falla en CI, el site live no se actualiza — arreglar y reempujar.
