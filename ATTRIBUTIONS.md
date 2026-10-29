# Atribuciones

## Recursos externos

- **Fuente «Bebas Neue»** por Ryoichi Tsunekichi, licencia SIL Open Font License
  1.1. Auto-alojada en `public/fonts/bebasneue.woff2` y usada como tipografía
  base de la interfaz.
- **Sonidos de impacto** del pack *Ultrasound* de [Kenney](https://kenney.nl)
  (CC0/public domain), auto-alojados en `public/sfx/*.wav` y usados como
  muestras de paso/robo con respaldo sintetizado vía Web Audio.

Todo el resto del contenido visual y sonoro fue creado expresamente para este
proyecto:

- **Gráficos**: dibujados con SVG y CSS propios (campo de fútbol a rayas,
  líneas reglamentarias, porterías con red, fichas circulares de los equipos,
  balón, minimapa, iconográficos y logotipo del menú).
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
