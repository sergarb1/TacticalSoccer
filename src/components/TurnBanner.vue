<script setup lang="ts">
import { TEAM_COLORS } from '../game/config';
import type { TeamId } from '../game/types';

withDefaults(
  defineProps<{
    text: string | null;
    kind: 'turn' | 'goal' | 'info';
    team?: TeamId | null;
    big?: boolean;
  }>(),
  { big: false }
);
</script>

<template>
  <transition name="fade">
    <div v-if="text" class="banner-layer" :class="[kind === 'goal' ? 'goal' : '', big ? 'big' : '']">
      <div
        class="turn-banner banner-body"
        :class="{ 'goal-big': big }"
        :style="kind === 'goal' && team !== null && team !== undefined
          ? { background: `linear-gradient(90deg, ${TEAM_COLORS[team].dark}, ${TEAM_COLORS[team].main})` }
          : {}"
      >
        {{ text }}
      </div>
    </div>
  </transition>
</template>

<style scoped>
.banner-layer {
  position: fixed;
  inset-inline: 0;
  top: 16%;
  display: flex;
  justify-content: center;
  pointer-events: none;
  z-index: 40;
}
.banner-body {
  padding: 0.9rem 2.2rem;
  font-size: 1.6rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  border-radius: 14px;
  background: linear-gradient(90deg, rgba(16, 37, 27, 0.95), rgba(24, 56, 40, 0.95));
  border: 1px solid var(--panel-border);
  box-shadow: var(--shadow);
}
/* el gol sale a toda pantalla: se cierra un telón oscuro y la pizarra
   aterriza en medio, como en los estadios grandes */
.banner-layer.goal {
  top: 0;
  bottom: 0;
  align-items: center;
}
.banner-layer.goal::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, rgba(4, 10, 7, 0.3) 25%, rgba(4, 10, 7, 0.75) 100%);
  animation: goal-curtain 3.2s ease forwards;
}
.banner-layer.goal .banner-body { position: relative; }
@keyframes goal-curtain {
  0% { opacity: 0; }
  10% { opacity: 1; }
  82% { opacity: 1; }
  100% { opacity: 0; }
}
.goal .banner-body { color: #fff; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6); }
.big { top: 22%; }
.banner-layer.goal.big { top: 0; }  /* el gol manda: siempre centrado */

/* cambio de turno a toda pantalla: telón neutro, coge aire y se va */
.banner-layer.turn.big {
  top: 0;
  bottom: 0;
  align-items: center;
}
.banner-layer.turn.big::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, rgba(4, 10, 7, 0.28) 20%, rgba(4, 10, 7, 0.82) 100%);
  animation: turn-curtain 1.9s ease forwards;
}
.banner-layer.turn.big .banner-body {
  position: relative;
  font-size: clamp(1.7rem, 6vw, 3.2rem);
  letter-spacing: 0.12em;
  padding: 1rem 2.6rem;
  border-radius: 18px;
  animation: turn-in 1.9s ease forwards;
}
@keyframes turn-curtain {
  0% { opacity: 0; }
  10% { opacity: 1; }
  82% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes turn-in {
  from { transform: scale(0.92); opacity: 0.4; }
  15% { transform: none; opacity: 1; }
  82% { opacity: 1; }
  to { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .banner-layer.turn.big::before { animation: none; opacity: 0.9; }
  .banner-layer.turn.big .banner-body { animation: none; }
}
.goal-big {
  animation: goal-banner-in 3.2s ease forwards;
  font-size: clamp(2.8rem, 11vw, 6rem);
  letter-spacing: 0.14em;
  padding: 1.2rem 3.4rem;
  border-radius: 24px;
  box-shadow: 0 18px 90px rgba(0, 0, 0, 0.65);
}
@media (prefers-reduced-motion: reduce) {
  .goal-big, .banner-layer.goal::before { animation: none; }
  .banner-layer.goal::before { opacity: 0.9; }
}
</style>
