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
  con anillo de equipo, dorsal y halo verde de «corte" (`public/sprites/`).
- **3 AP por turno**, 30 turnos (2 partes de 15), 4 formaciones 5v5.
- **Tiros especiales**: «Tiro Billetes» (2 AP: la distancia penaliza la mitad,
  más riesgo de fuera) y «Vaselina» (2 AP: burla ángulo y portero, necesita
  espacio). Panel con % de gol de cada golpeo y narración propia.
- **«Cortar»** (1 AP): postura defensiva que tapa pases (radio ×2) y bloquea
  tiros del rival durante su turno; se disuelve al llegar tu turno (`Player.stance`).
- **Narración** abajo, ampliada (dos líneas visibles, tipografía mayor y minuto
  grande), con líneas nuevas para billetes/vaselina/cortes.
- **Plataformas**: escritorio y móvil (layout táctil, botones ≥44px, vibración
  háptica configurable, área segura iPhone).
- **Plantillas**: Garra Che, Muro Che, Turia FC, Litoral Che — nombres de
  leyendas valencianistas ficticias.
- **Guardar/continuar** partida en `localStorage` (clave v2: el cambio de campo
  descarta con gracia las partidas del formato 9×5); tutorial de 7 pasos.
- **Despeje del portero**: tras parar hay un 38% de palmada lejos (balón suelto)
  en vez de retención.
- **Tanda de penaltis** determinista en pantalla final si hay empate
  (`MatchResult.vue`, derivada del estado, estable en rerenders).

## Verificación en vigor

- **34/34 pruebas de Vitest** (motor jugado por eventos + invariantes de IA en
  partidas completas, 3 niveles, con semilla; incluye coste/alcance del Tiro
  Billetes, Vaselina por ángulo y postura de corte).
- `vue-tsc --noEmit` sin errores.
- Build de producción OK (bundle ~157 kB JS / 16 kB CSS + sprites).

## Cambios recientes (última ronda)

1. Subtítulo «Gañan Edition» (index.html, menú, README).
2. Tipografía **Bebas Neue** (SIL OFL) autoalojada en `public/fonts/`.
3. Sonidos **CC0 de Kenney** (Ultrasound) en `public/sfx/` con respaldo
   sintetizado WebAudio (`src/game/sounds.ts`).
4. Despeje del portero + test.
5. Transición de fichas (`PlayerToken.vue` con `transform` por style) y
   vibración háptica (`useGame.ts`/`useSettings.ts`).

## Pendiente / ideas propu

Por orden de impacto estimado:

- [ ] **Resistencia con efecto real por jugador** (ahora solo penalización
      global aproximada en la 2ª parte).
- [ ] **Fueras de banda y saques de esquina** (limitación conocida declarada
      en README).
- [ ] **Más formaciones o catálogo de equipos** (4 ahora).
- [ ] **Tutorial ampliable** (app.vue, 7 pasos hardcodeados).
- [ ] **Modo valenciano** del narrador (solo español ahora).
- [ ] **Test de MatchResult** (la tanda de penaltis no está cubierta por
      pruebas; es código de UI puro).
- [ ] **Replays/posiciones** (el minimapa no es cliclo para seleccionar en
      pantallas grandes… está oculto en móvil).

## Cómo publicar

Push a `main` → workflow `.github/workflows/deploy.yml` hace
`npm ci → vitest → build → deploy-pages`. Vigila `gh run list --repo
sergarb1/TacticalSoccer` (o la pestaña Actions) hasta ver `completed success`.

## Dónde empieza quien pille el relevo

1. Lee `AGENTS.md` (convenciones y comandos).
2. Ejecuta `npx vitest run && npx vue-tsc --noEmit && npm run build`.
3. `npm run dev` para tocar la UI; el motor se prueba contra `tests/`.
4. No toques licencias de assets sin actualizar `ATTRIBUTIONS.md`.
