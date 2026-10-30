# HANDOFF.md — estado del proyecto y relevo

Documento de traspaso: qué está hecho, cómo está verificado y qué queda por hacer.
Última actualización: 30/10/2026.

## Estado actual (funcional y desplegado)

**Tactical Soccer · Gañan Edition** — https://sergarb1.github.io/TacticalSoccer/

Juego de fútbol táctico **5v5** por turnos:

- Campo **13×7 casillas** con vista **isométrica** (rombos de césped, portería de
  1 casilla con red, arcos de penalti, líneas reglamentarias). Alcance de
  movimiento 2 + velocidad/4 y de pase 3 + pase/2 para compensar el tamaño.
- **Sprites de jugadores** del pack *Sports Pack* de Kenney (CC0), escalados y
  con anillo de equipo, dorsal y halo verde de «corte» (`public/sprites/`).
- **3 AP por turno**, 30 turnos (2 partes de 15), 8 equipos ficticios y
  formaciones 5v5.
- **Tiros especiales**, con modal animado propio y barras de especiales que se
  llenan con goles encajados/especiales y robos: «Tiro Billetes» (2 AP), 
  «Vaselina» (2 AP) y «Hachazo» robador premium (1 AP + uso especial). El panel
  muestra el % de gol de cada golpeo con iconos.
- **Defensa**: «Cortar» (postura que tapa pases y tiros), «Endurecer» (1 PA:
  robos/cortes/tapones reforzados durante el turno rival) y castigo al portero
  despistado (a 2+ casillas de su arco, cada casilla regala +6% de gol, tope 18%).
- **Saque de centro** para el equipo que encaja el gol; a mitad de parte saca
  el visitante.
- **Tanda de penaltis jugable en el tablero** (`src/game/penalties.ts`): el
  portero dispone de 1 PA para adivinar la esquina y el lanzador de 3 PA para
  moverse y fusilar; con banner dramático (penalti/gol/paradón/tanda decidida),
  silbato, gruñido del estadio y fanfarria final.
- **Copa Capello** 🏆 (`src/game/cup.ts` + `useCup` + `CupScreen.vue`): 8 equipos,
  cuartos/semifinal/final; los cruces no jugados por el usuario se simulan con el
  mismo motor y los empates van a la tanda de penaltis.
- **Liga Gañán** 🏅 (`src/game/league.ts` + `useLeague` + `LeagueScreen.vue`):
  8 equipos a una vuelta (7 jornadas), 3/1 puntos, sin penaltis; tabla con
  clasificación ordenada por puntos, diferencia y goles.
- **Modo IA vs IA (espectador)**: la máquina dirige a ambos equipos.
- **Palmarés** (`records.ts`): victorias, racha, copas ganadas y MVP del partido:
  cargado en las pantallas que lo usan.
- **Compartir y retar**: botón «Compartir» (API nativa/portapapeles) con
  tablón del resultado y «código del reto» de 7 símbolos (`seedcode.ts`) para
  rejugar la misma partida; caja para pegar el código en la preparación.
- **Narración** arriba (barra fija) con comentarista gamberro: líneas para
  especiales, cortes, endurecer, quejas de grada según marcador y minuto.
- **Meteoros cosméticos**: soleado/noche/atardecer/lluvia decididos por la
  semilla del partido (clases `weather-*`, nunca afectan al motor).
- **Plataformas**: escritorio y móvil (layout táctil, botones ≥44px, vibración
  háptica configurable, área segura iPhone).
- **Guardar/continuar** partida en `localStorage`; tutorial de 7 pasos.
- **PWA**: instalable (`manifest.webmanifest`, icono SVG, `theme-color`) y con
  service worker de caché runtime (`public/sw.js`, solo se registra en prod).

## Verificación en vigor

- **40/40 pruebas de Vitest** (`tests/engine.spec.ts`, `tests/ai.spec.ts`,
  `tests/cup.spec.ts`): motor jugado por eventos + invariantes de IA en partidas
  completas (3 niveles, con semilla) + copa completa con tanda y penaltis.
- `vue-tsc --noEmit` sin errores.
- Build de producción OK (~208 kB JS / 27 kB CSS + sprites; caché SW en prod).

## Cambios recientes (últimas rondas)

1. Copa Capello + penaltis 1v1 jugables + modo IA vs IA + «Endurecer defensa».
2. Drama de tanda: banner gigante por lanzamiento y desenlace; sonidos nuevos
   (silbato, gruñido, fanfarria).
3. Modal animado de especiales (Billetes/Vaselina/Hachazo) + saque del que
   encaja + castigo al portero lejano (constantes `FAR_KEEPER_*`).
4. Liga Gañán completa + palmarés/racha/MVP + compartir + retos por semilla.
5. Comentarista gamberro y meteoros cosméticos.
6. PWA instalable con offline (SW solo en producción).

## Pendiente / ideas propu

Por orden de impacto estimado:

- [ ] **Palmarés visible en el menú principal** (los datos ya están en
      `records.ts`; falta pintar tarjetita con copas, racha y último MVP).
- [ ] **IA que recoloca al portero** cuando el rival se acerca (para que el
      castigo al portero lejano muerda en IA vs IA).
- [ ] **Uso de la barra de especiales en la UI** del panel (mostrar usos
      restantes por tipo de especial junto al % ).
- [ ] **Aviso de instalación PWA** («añadir a pantalla de inicio») con
      `beforeinstallprompt`.
- [ ] **Resistencia con efecto real por jugador** (ahora solo penalización
      global aproximada en la 2ª parte).
- [ ] **Fueras de banda y saques de esquina** (limitación conocida declarada
      en README).
- [ ] **Modo valenciano** del narrador (solo español ahora).
- [ ] **Test de MatchResult** (la pantalla final sigue siendo código de UI
      puro sin pruebas; su tanda de penaltis cosmética tampoco).

## Cómo publicar

Push a `main` → workflow `.github/workflows/deploy.yml` hace
`npm ci → vitest → build → deploy-pages`. Vigila `gh run list --repo
sergarb1/TacticalSoccer` (o la pestaña Actions) hasta ver `completed success`.

## Dónde empieza quien pille el relevo

1. Lee `AGENTS.md` (convenciones y comandos).
2. Ejecuta `npx vitest run && npx vue-tsc --noEmit && npm run build`.
3. `npm run dev` para tocar la UI; el motor se prueba contra `tests/`.
4. No toques licencias de assets sin actualizar `ATTRIBUTIONS.md`.
5. La cosmética (banners, modal, meteoros, narración) vive aparte del motor:
   no la mezcles con la lógica del juego.
