<script setup lang="ts">
import { computed } from 'vue';
import { TOKEN_R, cellToPx } from '../composables/boardLayout';
import type { Player } from '../game/types';

const props = defineProps<{
  player: Player;
  selected: boolean;
  isCarrier: boolean;
  isTurnOf: boolean;
  interactive: boolean;
}>();

const emit = defineEmits<{ (e: 'token-click', id: number): void }>();

const pos = computed(() => cellToPx(props.player.pos));
/** bal\u00f3n mini de posesi\u00f3n, sobre la parte superior-derecha de la ficha */
const mbX = TOKEN_R * 0.92;
const mbY = -TOKEN_R * 0.95;
const colors = computed(() =>
  props.player.team === 0
    ? { main: 'var(--home)', dark: 'var(--home-dark)' }
    : { main: 'var(--away)', dark: 'var(--away-dark)' }
);
const dim = computed(() => (props.player.hasMoved && props.player.hasActed ? 0.55 : props.player.hasMoved || props.player.hasActed ? 0.8 : 1));
</script>

<template>
  <g
    class="token"
    :class="{ interactive }"
    :style="{ transform: `translate(${pos.x}px, ${pos.y}px)` }"
    :opacity="dim"
    @click="emit('token-click', player.id)"
  >
    <!-- sombra en el suelo (efecto pseudo-3D) -->
    <ellipse :cy="TOKEN_R * 0.85" :rx="TOKEN_R * 1.02" :ry="TOKEN_R * 0.5" fill="rgba(0,0,0,0.35)" />
    <!-- anillo de selección -->
    <circle
      v-if="selected"
      class="selected-ring"
      :r="TOKEN_R + 6"
      fill="none"
      stroke="var(--gold)"
      stroke-width="3"
    />
    <!-- ficha -->
    <circle :r="TOKEN_R" :fill="colors.main" :stroke="colors.dark" stroke-width="3" />
    <circle :r="TOKEN_R - 5" fill="rgba(255,255,255,0.16)" />
    <text
      :y="TOKEN_R * 0.36"
      text-anchor="middle"
      font-size="15"
      font-weight="800"
      fill="#fff"
      style="paint-order: stroke; stroke: rgba(0,0,0,0.45); stroke-width: 3px; pointer-events: none"
    >{{ player.num }}</text>
    <!-- anillo de turno: jugador puede aún actuar -->
    <circle
      v-if="isTurnOf"
      :r="TOKEN_R + 2.5"
      fill="none"
      stroke="#fff"
      stroke-opacity="0.35"
      stroke-width="1.5"
      stroke-dasharray="4 5"
    />
    <!-- indicador de posesión: balón mini grande y legible -->
    <g v-if="isCarrier" class="mini-ball" pointer-events="none">
      <circle :cx="mbX" :cy="mbY + 2" r="10.5" fill="rgba(0,0,0,0.35)" />
      <circle :cx="mbX" :cy="mbY" r="9.5" fill="#fdfdfd" stroke="#181818" stroke-width="1.5" />
      <path
        d="M 0 -3.6 L 3.4 -1.1 L 2.1 2.9 L -2.1 2.9 L -3.4 -1.1 Z"
        :transform="`translate(${mbX},${mbY + 1.3})`"
        fill="#181818"
      />
    </g>
  </g>
</template>

<style scoped>
.token { cursor: default; transition: transform 0.22s cubic-bezier(0.3, 1.1, 0.5, 1); }
.token.interactive { cursor: pointer; }
.token.interactive:hover circle[r='21'] { filter: brightness(1.25); }
@media (prefers-reduced-motion: reduce) {
  .token { transition: none; }
}
</style>
