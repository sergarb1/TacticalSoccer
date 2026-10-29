<script setup lang="ts">
import { computed } from 'vue';
import { COLS, ROWS } from '../composables/boardLayout';
import { GOAL_CENTER_ROW } from '../game/config';
import type { GameState, Player } from '../game/types';

const props = defineProps<{ state: GameState }>();
const emit = defineEmits<{ (e: 'token-click', id: number): void }>();

const W = 190;
const H = 134;
const cw = W / COLS;
const ch = H / ROWS;

interface Dot { p: Player; x: number; y: number }
const dots = computed<Dot[]>(() =>
  [...props.state.players]
    .sort((a, b) => a.pos.row - b.pos.row)
    .map((p) => ({ p, x: p.pos.col * cw + cw / 2, y: p.pos.row * ch + ch / 2 }))
);

const ball = computed(() => ({
  x: props.state.ball.pos.col * cw + cw / 2,
  y: props.state.ball.pos.row * ch + ch / 2
}));

const midRow = computed(() => GOAL_CENTER_ROW * ch);
</script>

<template>
  <section class="panel minimap">
    <h3>Minimapa</h3>
    <svg :viewBox="`0 0 ${W} ${H}`" class="mm-svg">
      <rect :width="W" :height="H" fill="rgba(34,96,48,0.45)" rx="6" />
      <rect x="1.5" y="1.5" :width="W - 3" :height="H - 3" fill="none" stroke="#cfe6d2" stroke-width="1" opacity="0.7" />
      <line :x1="W / 2" y1="1.5" :x2="W / 2" :y2="H - 1.5" stroke="#cfe6d2" stroke-width="1" opacity="0.5" />

      <!-- dirección de ataque del equipo que juega -->
      <g v-if="state.currentTeam === 0">
        <line :x1="W - 26" :y1="midRow" :x2="W - 12" :y2="midRow" stroke="var(--gold)" stroke-width="2" />
        <path :d="`M ${W - 12} ${midRow} l -5 -3.5 v 7 z`" fill="var(--gold)" />
      </g>
      <g v-else>
        <line :x1="12" :y1="midRow" :x2="26" :y2="midRow" stroke="var(--gold)" stroke-width="2" />
        <path :d="`M 12 ${midRow} l 5 -3.5 v 7 z`" fill="var(--gold)" />
      </g>

      <!-- jugadores (seleccionables) -->
      <g v-for="d in dots" :key="d.p.id" class="mm-dot" @click="emit('token-click', d.p.id)">
        <circle
          :cx="d.x"
          :cy="d.y"
          r="3.6"
          :fill="d.p.team === 0 ? 'var(--home)' : 'var(--away)'"
          stroke="#0c1c12"
          stroke-width="1"
        />
        <circle v-if="d.p.id === state.ball.carrier" :cx="d.x" :cy="d.y" r="1.4" fill="#fff" />
      </g>

      <!-- balón -->
      <circle :cx="ball.x" :cy="ball.y" r="2.8" fill="#fff" stroke="#111" stroke-width="0.8" />
    </svg>
  </section>
</template>

<style scoped>
.minimap { padding: 0.7rem 0.85rem; }
h3 { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-dim); margin-bottom: 0.4rem; }
.mm-svg { width: 100%; height: auto; display: block; border-radius: 8px; }
.mm-dot { cursor: pointer; }
</style>
