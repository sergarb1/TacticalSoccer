# Atribuciones

## Recursos externos

- **Fuente «Bebas Neue»** por Ryoichi Tsunekichi, licencia SIL Open Font License
  1.1. Auto-alojada en `public/fonts/bebasneue.woff2` y usada como tipografía
  base de la interfaz.
- **Sonidos de impacto** del pack *Ultrasound* de [Kenney](https://kenney.nl)
  (CC0/public domain), auto-alojados en `public/sfx/*.wav` y usados como
  muestras de paso/robo con respaldo sintetizado vía Web Audio.
- **Sprites de los futbolistas** del pack *Sports Pack* de
  [Kenney](https://kenney.nl) (CC0/public domain; ficha oficial del pack en
  https://kenney.nl/assets/sports-pack). Recortados (5 poses por equipo),
  escalados ×3 y auto-alojados en `public/sprites/rojo-*.png` y
  `public/sprites/azul-*.png`; cada equipo lleva además el anillo de color de
  la paleta del juego. Los balones de fútbol del mismo pack no se usan:
  el balón del tablero sigue siendo SVG propio.

Todo el resto del contenido visual y sonoro fue creado expresamente para este
proyecto:

- **Gráficos**: dibujados con SVG y CSS propios (campo de fútbol a rayas,
  líneas reglamentarias, porterías con red, balón, minimapa, iconográficos y
  logotipo del menú). Los sprites de los jugadores ya no son fichas
  circulares propias: usan el pack de Kenney declarado arriba.
- **Sonido**: generado en tiempo real con la Web Audio API
  (`src/game/sounds.ts`) — tipos de onda y envolventes definidos en código.

## Bibliotecas de software

| Biblioteca | Licencia | Uso |
|---|---|---|
| [Vue 3](https://vuejs.org) | MIT | Framework de interfaz |
| [Vite](https://vitejs.dev) | MIT | Empaquetador/desarrollo |
| [TypeScript](https://typescriptlang.org) | Apache-2.0 | Lenguaje |
| [Vitest](https://vitest.dev) | MIT | Pruebas |
| [vue-tsc](https://github.com/johnsoncodehk/volo) / language-tools | MIT | Typecheck de `.vue` |

Todas las bibliotecas se instalan con `npm` como dependencias de desarrollo o
de runtime, con sus licencias compatibles con MIT.

## Iconografía operativa

Los iconos del panel de acciones (🏃 🤝 ⚡ 🛡️ ⏭) son **emojis del sistema**:
caracteres Unicode estándar, sin licencia adicional.
