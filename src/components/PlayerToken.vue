<script setup lang="ts">
import { computed } from 'vue';
import { TOKEN_R, cellToPx } from '../composables/boardLayout';
import type { Player } from '../game/types';

const props = defineProps<{
  player: Player;
  selected: boolean;
  isCarrier: boolean;
  isTurnOf: boolean;
  isCutting: boolean;
  interactive: boolean;
}>();

const emit = defineEmits<{ (e: 'token-click', id: number): void }>();

const pos = computed(() => cellToPx(props.player.pos));

/** balón mini de posesión, sobre la parte superior-derecha de la ficha */
const mbX = TOKEN_R * 0.92;
const mbY = -TOKEN_R * 0.95;

/** Sprite del pack «Sports» de Kenney (CC0) por rol: pose distinta por rol. */
const SPRITE_BY_ROLE: Record<string, number> = {
  POR: 4,
  DFC: 1,
  LI: 2,
  LD: 2,
  MCD: 2,
  MC: 3,
  EI: 5,
  ED: 5,
  DC: 3
};

const spriteFile = computed(
  () => `${props.player.team === 0 ? 'rojo' : 'azul'}-${SPRITE_BY_ROLE[props.player.role] ?? 1}.png`
);
const spriteUrl = computed(() => `${import.meta.env.BASE_URL}sprites/${spriteFile.value}`);

/** Los sprites miran «hacia abajo»; cada equipo rota para mirar al arco rival. */
const facing = computed(() => (props.player.team === 0 ? 'rotate(90deg)' : 'rotate(-90deg)'));

/** ring del equipo detrás del sprite para distinguir al instante. */
const ringColor = computed(() => (props.player.team === 0 ? 'var(--home)' : 'var(--away)'));

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
    <!-- flag del equipo detrás del sprite para distinguirlo al instante -->
    <circle :r="TOKEN_R" :fill="ringColor" fill-opacity="0.35" :stroke="ringColor" stroke-width="2" />
    <!-- anillo de selección -->
    <circle
      v-if="selected"
      class="selected-ring"
      :r="TOKEN_R + 6"
      fill="none"
      stroke="var(--gold)"
      stroke-width="3"
    />
    <!-- indicador de postura de corte: halo verde de vigilancia -->
    <circle
      v-if="isCutting"
      class="cut-ring"
      :r="TOKEN_R + 10"
      fill="none"
      stroke="#48d76a"
      stroke-width="2.4"
      stroke-dasharray="10 6"
    />
    <!-- envoltorio del sprite: aquí vive la elevación al pasar el ratón -->
    <g class="sprite-hover">
      <image
        class="sprite"
        :href="spriteUrl"
        :width="26"
        :height="38"
        :x="-13"
        :y="-33"
        :style="{ transform: facing }"
        preserveAspectRatio="xMidYMax meet"
        style="image-rendering: auto; pointer-events: none"
      />
    </g>
    <!-- anillo de turno: el jugador aún puede actuar (girando suave) -->
    <circle
      v-if="isTurnOf"
      class="turn-ring"
      :r="TOKEN_R + 2.5"
      fill="none"
      stroke="#fff"
      stroke-opacity="0.35"
      stroke-width="1.5"
      stroke-dasharray="4 5"
    />
    <!-- dorsal bajo la ficha -->
    <text
      :y="TOKEN_R * 0.78 + 9"
      text-anchor="middle"
      font-size="13"
      font-weight="800"
      fill="#fff"
      style="paint-order: stroke; stroke: rgba(0,0,0,0.7); stroke-width: 3px; pointer-events: none"
    >{{ player.num }}</text>
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
/* elevación y sombra al pasar el ratón: se anima el envoltorio para no
   pelear con la rotación de encarar del sprite */
.sprite-hover {
  transition: transform 0.16s ease;
  transform-box: fill-box;
  transform-origin: center bottom;
}
.token.interactive:hover .sprite-hover { transform: translateY(-4px) scale(1.07); }
.sprite { filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.45)); transform-box: fill-box; transform-origin: center center; }
.token.interactive:hover .sprite { filter: drop-shadow(0 5px 4px rgba(0, 0, 0, 0.5)) brightness(1.1); }
.cut-ring { animation: dash-march 1.1s linear infinite; }
.turn-ring { animation: spin-slow 7s linear infinite; transform-box: fill-box; transform-origin: center; }
.mini-ball { animation: bob 1.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
@media (prefers-reduced-motion: reduce) {
  .token { transition: none; }
  .cut-ring, .turn-ring, .mini-ball { animation: none; }
}
</style>
