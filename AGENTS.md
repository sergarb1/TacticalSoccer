# AGENTS.md — instrucciones para agentes en este repo

Guía para cualquier agente de IA (o persona) que trabaje en Tactical Soccer · Gañan Edition.

## Qué es este proyecto

Juego de fútbol táctico por turnos **5v5 en un campo de 13×7 casillas con vista isométrica**,
hecho como web app estática e **instalable (PWA, offline).** Stack: **Vue 3 + TypeScript + Vite + SVG**, sin backend ni
servicios externos: todo el cálculo ocurre en el navegador y los ajustes guardados viven en
`localStorage`.

- Demo pública: https://sergarb1.github.io/TacticalSoccer/
- Repo: https://github.com/sergarb1/TacticalSoccer

## Comandos

```bash
npm ci                    # instalar dependencias
npx vitest run            # pruebas (motor + partidas completas de IA + copa)
npx vue-tsc --noEmit      # typecheck (revisa también los .vue)
npm run build             # typecheck + build de producción en dist/
```

Todo cambio debe pasar los tres pasos antes de considerarse terminado. Las 40 pruebas
(en `tests/engine.spec.ts`, `tests/ai.spec.ts` y `tests/cup.spec.ts`) deben seguir pasando.

## Arquitectura y convenciones

- **Motor puro** en `src/game/`: sin DOM ni `Math.random` directo; usa el RNG con semilla
  del estado (`s.rng`). Las reglas (costes AP, probabilidad de gol, alcance) están
  centralizadas en `src/game/config.ts` — cambia ahí, no en los módulos.
- **IA** en `src/ai/`: solo propone acciones legales; `tests/ai.spec.ts` verifica
  invariantes jugando partidas completas. Si tocas el motor, el guard de AP y las
  validaciones de `rules.ts` no se pueden saltar.
- **UI** en `src/components/` + `src/composables/useGame.ts` (tienda central). La UI
  consume los eventos del motor y no los interpreta dos veces.
- **Toroneos y liga**: copa (`src/game/cup.ts` + `useCup`) y liga (`src/game/league.ts`
  + `useLeague`), ambas con simulador headless reutilizando el motor de la IA. Los
  empates de copa se dirimen con tanda de penaltis 1v1 (`src/game/penalties.ts`),
  jugable en el tablero; en liga el empate puntúa y no hay tanda.
- **Cosmética que NUNCA toca el motor ni el RNG**: narración
  (`src/game/commentary.ts`), banners de tanda (`penaltyBanner` en `useGame`), modal
  de especiales (`SpecialFx.vue` + `specialFx`), meteoros (clases `weather-*` en
  `App.vue`, elegidas por la semilla) y sonidos (`src/game/sounds.ts`).
- **Palmarés** (`src/game/records.ts`): victorias, racha, copas y MVP en localStorage.
  Cosmético/estadístico: si un cambio lo invalida, se descarta con gracia.
- **Retos por semilla** (`src/game/seedcode.ts`): el campo de FP determina la partida;
  se comparte como «código del reto» desde la pantalla final.
- **Todo el texto visible está en español** (con sabor intencionalmente valencianista,
  «Gañan Edition»). Mantén ese tono en la UI y en la narración.
- Formato del campo: 13 columnas × 7 filas (campo grande con más alcance de
  movimiento y pase), portería de 1 casilla en la fila `GOAL_CENTER_ROW`,
  5 jugadores por equipo (1 POR + 4 de campo), 3 AP por turno, tiros
  especiales «Tiro Billetes» y «Vaselina» (2 AP, gasta usos `SPECIALS_PER_MATCH` +
  barras `METER_MAX`), postura de corte (`cut`), «Hachazo» robador y «Endurecer
  defensa» (1 PA en el turno propio, refuerza robos/cortes/tapones del rival).
  Saque de centro para el equipo que ENCAJA el gol; a mitad de parte saca el
  visitante; portero a 2+ casillas de su arco regala gol al rival
  (`FAR_KEEPER_*` en config). `src/game/serialize.ts` valida esa estructura: si
  cambias el formato, actualiza el validador (y sube la clave de
  `STORAGE_KEYS` cuando el cambio sea incompatible) para que las partidas
  guardadas se descarten con gracia.
- **Comentarios y commits en español**; títulos de commit cortos y descriptivos.
- Los nombres de los futbolistas son homenajes ficticios (leyendas del Valencia CF);
  no usar nombres reales de jugadores activos ni escudos/marcas reales.

## PWA / offline

- `public/manifest.webmanifest` + `public/sw.js` (caché runtime) + `public/icons/icon.svg`.
- Registro del SW solo en producción (`src/main.ts`). No romper el registro: si
  cambias rutas del SW, sube su constante `CACHE`.

## Assets y licencias (importante)

- Arte y sonidos sintetizados propios, más:
  - Tipografía **Bebas Neue** (SIL OFL 1.1) en `public/fonts/` — NO sustituirla por una
    fuente sin licencia OFL o autoalojada desde CDN comercial.
  - Sonidos **CC0 de Kenney** (pack Ultrasound) en `public/sfx/` y sprites CC0
    (*Sports Pack*) en `public/sprites/`.
- Cualquier asset nuevo debe ser CC0/MIT/OFL u otra licencia permisiva, autoalojado en
  `public/`, y declararse en `ATTRIBUTIONS.md`. Prohibido meter recursos comerciales o
  con licencia dudosa.
- La atribución de IA generadora no es necesaria en los commits de este repo.

## Despliegue

Cada push a `main` dispara `.github/workflows/deploy.yml` (Pages, Node 22):
`npm ci → vitest → build → deploy`. No borrar ni renombrar el workflow; si el build
falla en CI, el site live no se actualiza — arreglar y reempujar.
