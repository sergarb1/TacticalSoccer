# ⚽ Tactical Soccer · Gañan Edition

Juego de fútbol táctico **por turnos** para navegador, gratuito y de código abierto.
Dirige un partido completo: mueve fichas, planifica pases, intenta tiros, roba balones
y gana el partido con una IA que juega en serio.

- Sin servidor, sin cuentas, sin publicidad, sin claves API y sin conexión.
- Totalmente ejecutable en GitHub Pages (sitio estático).
- Interfaz en español (es-ES). Pensado para jugar con niños y con profundidad táctica.

---

## 📦 Instalación

Requiere Node.js 20+ y npm.

```bash
npm install      # instala las dependencias de desarrollo
```

## ▶️ Modo desarrollo

```bash
npm run dev      # abre http://localhost:5173
```

## 🏗️ Compilar (producción)

```bash
npm run build    # typecheck (vue-tsc) + build de Vite en ./dist
npm run preview  # sirve ./dist para comprobarlo
```

## ✅ Probar

```bash
npm run test     # 29 pruebas de reglas e IA (Vitest)
npm run check    # solo typecheck
```

Las pruebas cubren: inicio del partido, alternancia de turnos, consumo de AP,
movimiento válido/inválido y restricciones, posesión del balón, resolución de
pases (éxito/fallo/intercepción), disparos (gol/parada/fuera/bloqueo), goles y
marcador, cambios de posesión, descanso, final del partido, guardado/validación
y **partidas completas de la IA** en los tres niveles verificando que nunca
realiza acciones ilegales.

## 🌍 Publicar en GitHub Pages

Este repositorio incluye un workflow (`.github/workflows/deploy.yml`) que
compila y publica automáticamente en GitHub Pages en cada push a `main`.

Si publicas tu propio fork:

1. Sube el código a un repositorio de GitHub.
2. En **Settings → Pages**, elige *Source: GitHub Actions*.
3. Hecho: cada push genera el sitio en `https://<usuario>.github.io/<repo>/`.

El `vite.config.ts` usa `base: './'`, así que el build funciona en cualquier
subcarpeta sin configuración adicional.

---

# 🕹️ Cómo se juega

El partido se disputa sobre un **campo de 9×5 casillas con vista isométrica**:
una cuadrícula de rombos de césped, más compacta y táctica que el fútbol clásico,
con **5 jugadores por equipo** (portero + 4 de campo):
**rojo (local, ataca a la derecha)** contra **azul (visitante, ataca a la izquierda)**.

### Puntos de acción (PA)

Cada turno tu equipo recibe **3 PA** que puedes gastar en acciones:

| Acción | Coste | Descripción |
|---|---|---|
| 🏃 **Mover** | 1 | Desplaza una ficha hasta su alcance (según su Velocidad). |
| 🤝 **Pasar** | 1 | Cede el balón a un compañero dentro del alcance de su atributo Pase. |
| ⚡ **Chutar** | 1 | Intenta marcar en la portería rival. |
| 🛡️ **Defender** | 1 | Un jugador adyacente al portador rival intenta robar. |
| ⏭ **Terminar turno** | — | El rival recibe sus 3 PA. |

Reglas importantes:

- Un mismo futbolista solo puede **moverse una vez** y **actuar una vez** por turno.
- No puedes compartir casilla, salir del campo ni atravesar rivales.
- Mover un jugador **con balón** tiene 1 casilla de alcance menos.
- Si el balón queda **suelto**, cualquier jugador que termine su movimiento sobre
  él lo controla automáticamente.
- Cada turno representa **3 minutos**; el partido dura **90'** (turno 30 con
  descanso y saque del visitante a la 2ª parte).

### Selección e interacción

1. Pulsa una ficha **de tu equipo** para ver su ficha (número, rol, atributos y estado).
2. Pulsa una acción del panel o directamente en el campo:
   - **Mover**: se resaltan las casillas alcanzables; clic en una para moverte.
   - **Pasar**: se dibujan líneas hacia los compañeros con su **probabilidad**; clic en una ficha o chip.
   - **Chutar**: se muestra el **% de gol** y confirmas con el botón.
   - **Defender**: elige a qué rival intentar el robo (y su %).
3. El **minimapa** también permite seleccionar fichas.

El partido se guarda automáticamente tras cada acción; puedes **continuar** desde el menú.

Además, la **barra de consejos** bajo el tablero te dice en cada momento qué
puedes hacer (mover, pasar, robar, ir al balón suelto…), y desde el menú puedes
lanzar un **tutorial guiado de 7 pasos**.

---

# 🧮 Cómo se calculan pases y tiros

Todo está centralizado en `src/game/config.ts` y los módulos de reglas.

### Pase

```
probabilidad = 88
             − 5 × (casillas − 1)          # distancia
             + 3 × (Pase − 5)              # atributo del pasador
             − presión cercana al pasador  # −7 por rival a ≤2 casillas (máx. 2)
             − presión cercana al receptor # −5 por rival (máx. 2)
             − presión sobre la línea      # −4 por rival a ≤1 de la línea del pase (máx. 2)
recortada a [8, 97]
```

Si el pase falla, un rival a ≤1 casilla de la trayectoria puede **interceptar**
(30 + 4 × (Defensa − 5)) o el balón queda suelto en el punto medio.

### Tiro

Se valoran **distancia**, **ángulo** (desvío respecto a la fila del arco),
**presión** del rival (−4 por defensor a ≤1.5 casillas), **atributo Tiro** del
tirador y **Reflejos** del portero rival (−2.2 por punto). Los defensores en la
línea de tiro pueden **bloquear** (8% por defensor, máx. 22%), y existe una
probabilidad de **fuera** y de **parada**. El gol recibe el resto normalizado.
Resultados posibles: gol, parada, fuera, bloqueado y rebote (reservado).

Al marcar gol, la recolocación es automática: saque de centro del equipo encajado.

### Defensa

Un defensor a **1 casilla** (Chebyshev) del portador puede intentar robar:

```
32 + 4 × (Defensa − 5) − 4 × (Control − 5), recortado a [8, 88]
```

Además, la cercanía de rivales **presiona**: encarece pases, resta % al disparo
y la lista de robos disponibles se muestra al pulsar «Defender».

---

# 🤖 Cómo funciona la IA

La IA (`src/ai/`) es heurística y **solo usa la información visible**.

- **Evaluación**: valora posiciones de ataque (distancia y ángulo al arco,
  presión recibida), valor de pases (mejora de posición − riesgo de corte) y
  casillas defensivas (en la línea entre balón y portería propia).
- **Con balón**: chuta si el % de gol supera el umbral del nivel; pasa si algún
  compañero mejora mucho la posición; si no, avanza con el balón al mejor hueco.
- **Sin balón**: roba cuando la probabilidad lo permite y recoloca jugadores
  entre el balón y su portería; con balón suelto manda a los más cercanos.
- **Niveles**: `easy` (umbral alto, mucho ruido, sin táctica), `normal`
  (equilibrado, 1 apoyo) y `hard` (agresivo, aversión al riesgo, 2 apoyos,
  reposicionamiento defensivo).

Las decisiones salen de `nextAiAction()` y se ejecutan a través del mismo motor
que usa el jugador; nunca se propone una acción ilegal (las pruebas lo verifican jugando partidos completos).

---

# 🗂️ Arquitectura

```
src/
  game/        # motor puro, sin DOM (testeable)
    config.ts      # reglas, costes y constantes centralizadas
    types.ts       # Equipo, Jugador, Balón, Turno, Acción, Partido...
    rules.ts       # legalidad, presión, robo, guardas y fatiga
    movement.ts    # BFS de alcance y caminos
    passing.ts     # probabilidad y resolución de pases
    shooting.ts    # probabilidad y resolución de tiros
    defense.ts     # robos de balón
    formations.ts  # formaciones y catálogo de equipos
    match.ts       # acciones del partido (createMatch, doMove, endTurn...)
    serialize.ts   # guardado/validación en localStorage
    sounds.ts      # efectos generados con WebAudio
    field.ts rng.ts
  ai/          # difficulty.ts, evaluation.ts, strategy.ts
  composables/ # useGame.ts (tienda central), useSettings.ts, boardLayout.ts
  components/  # GameBoard, PlayerToken, Scoreboard, PlayerPanel, ActionPanel,
               # MiniMap, MatchSetup, MatchResult, MainMenu, PauseMenu,
               # TurnBanner, TutorialOverlay
tests/         # pruebas Vitest del motor y de la IA
```

**Stack**: Vue 3 + TypeScript + Vite + SVG. Sin dependencias de servicios externos;
todo el cálculo ocurre en el navegador y los ajustes viven en `localStorage`.

---

# 🎨 Recursos y licencias

- **Todo el arte y sonido son propios**, generados con SVG y CSS
  (campo, líneas, porterías, fichas, balón, minimapa) y WebAudio
  (pase, disparo, gol, parada, robo, cambio de turno).
- No se usan fotografías de futbolistas, escudos, logotipos ni recursos
  comerciales o con licencia dudosa.
- Detalles en [ATTRIBUTIONS.md](ATTRIBUTIONS.md).
- **Tipografía Bebas Neue** (SIL OFL 1.1) auto-alojada en `public/fonts/`, usada
  en la interfaz.
- **Sonidos de impacto CC0** del pack *Ultrasound* de Kenney, auto-alojados en
  `public/sfx/` con respaldo sintetizado vía Web Audio.

Las plantillas de nombres de jugadores son ficticias; cualquier parecido es
coincidencia.

---

# 📄 Licencia

MIT — ver [LICENSE](LICENSE).

# 🧪 Limitaciones conocidas

- No hay fueras de banda ni saques de esquina: los pases fallidos dejan el balón
  suelto en la trayectoria y el disparo fuera otorga la pelota al portero
  (saque de meta simplificado).
- La resistencia aplica una penalización aproximada de alcance en la 2ª parte
  (aproximación deliberada, sin estado físico instantáneo).
- El rebote está reservado para futuras reglas; el resto de resultados de tiro
  están implementados.
