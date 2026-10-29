<script setup lang="ts">
import { computed } from 'vue';
import {
  VB_W, VB_H, ISO_MATRIX, allBoardCells, cellToPx, cellPoly, svgToCell
} from '../composables/boardLayout';
import PlayerToken from './PlayerToken.vue';
import type { GameState, Player, Cell } from '../game/types';

const props = defineProps<{
  state: GameState;
  selectedId: number | null;
  mode: string;
  highlightCells: Cell[];
  passOptions: { targetId: number; chance: number; name: string; num: number }[];
  shotArmed: boolean;
  shotPercent: number | null;
  ballFx: { target: Cell; until: number } | null;
}>();

const emit = defineEmits<{
  (e: 'cell-click', cell: Cell): void;
  (e: 'token-click', id: number): void;
}>();

/* --- césped en rombos (tablero de ajedrez isométrico) --- */
const cells = allBoardCells();
function cellFill(c: { col: number; row: number }): string {
  return (c.col + c.row) % 2 === 0 ? 'var(--grass-0)' : 'var(--grass-1)';
}

/** fichas ordenadas por profundidad isométrica (de atrás hacia delante) */
const sortedPlayers = computed(() =>
  [...props.state.players].sort(
    (a, b) => a.pos.col + a.pos.row - (b.pos.col + b.pos.row) || a.num - b.num
  )
);

function tokenIsInteractive(p: Player): boolean {
  return props.state.phase === 'playing' && props.state.players.some((q) => q.id === p.id);
}

/* --- balón --- */
const showGroundBall = computed(() => props.state.ball.carrier === null || props.ballFx !== null);
const ballPos = computed(() => {
  if (props.ballFx) return cellToPx(props.ballFx.target);
  return cellToPx(props.state.ball.pos);
});

/** Convierte el clic en casilla invirtiendo la proyección isométrica. */
function onSvgClick(ev: MouseEvent): void {
  const svg = ev.currentTarget as SVGSVGElement;
  const pt = svg.createSVGPoint();
  pt.x = ev.clientX;
  pt.y = ev.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return;
  const p = pt.matrixTransform(ctm.inverse());
  const cell = svgToCell(p.x, p.y);
  if (cell) emit('cell-click', cell);
}

function isHighlight(c: { col: number; row: number }): boolean {
  return props.mode === 'moving' && props.highlightCells.some((h) => h.col === c.col && h.row === c.row);
}

const highlightsShown = computed(() => (props.mode === 'moving' ? props.highlightCells : []));

/* --- líneas de pase --- */
interface PassLine { x1: number; y1: number; x2: number; y2: number; chance: number }
const passLines = computed<PassLine[]>(() => {
  if (props.mode !== 'passing' || props.state.ball.carrier === null) return [];
  const from = props.state.players.find((p) => p.id === props.state.ball.carrier);
  if (!from) return [];
  const a = cellToPx(from.pos);
  return props.passOptions
    .map((o) => {
      const to = props.state.players.find((p) => p.id === o.targetId);
      if (!to) return null;
      const b = cellToPx(to.pos);
      return { x1: a.x, y1: a.y, x2: b.x, y2: b.y, chance: o.chance };
    })
    .filter((l): l is PassLine => l !== null);
});

/** side del arco atacado por el equipo en turno (0=arco derecho, 1=izquierdo). */
const attackRight = computed(() => props.state.currentTeam === 0);
const goalHintPos = computed(() => (attackRight.value ? { x: 800, y: 400 } : { x: 210, y: 100 }));
</script>

<template>
  <div class="board-wrap">
    <svg :viewBox="`0 0 ${VB_W} ${VB_H}`" class="board-svg" role="img" aria-label="Campo de fútbol isométrico" @click="onSvgClick">
      <defs>
        <radialGradient id="ballShine" cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.95" />
          <stop offset="0.55" stop-color="#ffffff" stop-opacity="0.15" />
          <stop offset="1" stop-color="#23252a" stop-opacity="0.35" />
        </radialGradient>
        <linearGradient id="standGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#14150f" />
          <stop offset="1" stop-color="#1d251a" />
        </linearGradient>
      </defs>

      <!-- grada de fondo -->
      <rect x="6" y="6" :width="VB_W - 12" :height="VB_H - 12" rx="20" fill="url(#standGrad)" />

      <!-- proyección isométrica del campo: todo en espacio-casilla -->
      <g :transform="ISO_MATRIX">
        <!-- césped exterior -->
        <rect x="-0.45" y="-0.25" width="9.9" height="5.5" fill="#0f2d1c" />
        <!-- césped a cuadros -->
        <rect
          v-for="c in cells"
          :key="`c-${c.col}-${c.row}`"
          :x="c.col"
          :y="c.row"
          width="1"
          height="1"
          :fill="cellFill(c)"
        />

        <!-- líneas blancas del campo -->
        <g stroke="var(--line)" fill="none" stroke-width="2.6" vector-effect="non-scaling-stroke">
          <rect x="0" y="0" width="9" height="5" vector-effect="non-scaling-stroke" />
          <line x1="4.5" y1="0" x2="4.5" y2="5" vector-effect="non-scaling-stroke" />
          <circle cx="4.5" cy="2.5" r="1.1" vector-effect="non-scaling-stroke" />
          <rect x="0" y="1" width="2.4" height="3" vector-effect="non-scaling-stroke" />
          <rect x="6.6" y="1" width="2.4" height="3" vector-effect="non-scaling-stroke" />
          <path d="M 2.4 1.9 A 0.72 0.72 0 0 1 2.4 3.1" vector-effect="non-scaling-stroke" />
          <path d="M 6.6 1.9 A 0.72 0.72 0 0 0 6.6 3.1" vector-effect="non-scaling-stroke" />
        </g>
        <circle cx="4.5" cy="2.5" r="0.06" fill="var(--line)" />
        <circle cx="2.1" cy="2.5" r="0.06" fill="var(--line)" />
        <circle cx="6.9" cy="2.5" r="0.06" fill="var(--line)" />

        <!-- porterías con red -->
        <g>
          <rect x="-0.45" y="1" width="0.45" height="3" fill="rgba(240,248,244,0.2)" stroke="var(--line)" stroke-width="2" vector-effect="non-scaling-stroke" />
          <g stroke="rgba(240,248,244,0.45)" stroke-width="1" vector-effect="non-scaling-stroke">
            <line v-for="n in 3" :key="`nvL${n}`" :x1="-0.45 + (n * 0.45) / 4" y1="1" :x2="-0.45 + (n * 0.45) / 4" y2="4" vector-effect="non-scaling-stroke" />
            <line v-for="n in 5" :key="`nhL${n}`" :x1="-0.45" :y1="1 + (n * 3) / 6" x2="0" :y2="1 + (n * 3) / 6" vector-effect="non-scaling-stroke" />
          </g>
          <rect x="9" y="1" width="0.45" height="3" fill="rgba(240,248,244,0.2)" stroke="var(--line)" stroke-width="2" vector-effect="non-scaling-stroke" />
          <g stroke="rgba(240,248,244,0.45)" stroke-width="1" vector-effect="non-scaling-stroke">
            <line v-for="n in 3" :key="`nvR${n}`" :x1="9 + (n * 0.45) / 4" y1="1" :x2="9 + (n * 0.45) / 4" y2="4" vector-effect="non-scaling-stroke" />
            <line v-for="n in 5" :key="`nhR${n}`" :x1="9" :y1="1 + (n * 3) / 6" x2="9.45" :y2="1 + (n * 3) / 6" vector-effect="non-scaling-stroke" />
          </g>
        </g>

        <!-- resaltado del arco al armar el disparo -->
        <g v-if="shotArmed && shotPercent !== null" pointer-events="none">
          <rect
            v-if="attackRight"
            x="8.9"
            y="0.85"
            width="0.62"
            height="3.3"
            fill="none"
            stroke="var(--gold)"
            stroke-width="3"
            stroke-dasharray="7 5"
            vector-effect="non-scaling-stroke"
          />
          <rect
            v-else
            x="-0.52"
            y="0.85"
            width="0.62"
            height="3.3"
            fill="none"
            stroke="var(--gold)"
            stroke-width="3"
            stroke-dasharray="7 5"
            vector-effect="non-scaling-stroke"
          />
        </g>
      </g>

      <!-- % de gol junto al arco atacado -->
      <text
        v-if="shotArmed && shotPercent !== null"
        :x="goalHintPos.x"
        :y="goalHintPos.y"
        font-size="20"
        font-weight="800"
        fill="var(--gold)"
        text-anchor="middle"
        style="paint-order: stroke; stroke: rgba(0,0,0,0.6); stroke-width: 4px"
      >{{ shotPercent }}% gol</text>

      <!-- viñeta -->
      <rect x="6" y="6" :width="VB_W - 12" :height="VB_H - 12" rx="20" fill="rgba(0,0,0,0.18)" pointer-events="none" />

      <!-- casillas de movimiento resaltadas -->
      <g>
        <polygon
          v-for="hl in highlightsShown"
          :key="`hl-${hl.col}-${hl.row}`"
          :points="cellPoly(hl)"
          class="hl-cell"
          fill="rgba(255,255,255,0.25)"
          stroke="rgba(255,255,255,0.7)"
          stroke-width="1.6"
          stroke-dasharray="6 5"
          @click.stop="emit('cell-click', hl)"
        />
      </g>

      <!-- líneas de pase -->
      <g pointer-events="none">
        <template v-for="(l, i) in passLines" :key="`pl-${i}`">
          <line
            :x1="l.x1"
            :y1="l.y1"
            :x2="l.x2"
            :y2="l.y2"
            :stroke="l.chance >= 65 ? '#8ff0a0' : l.chance >= 40 ? 'var(--gold)' : 'var(--danger)'"
            stroke-width="3"
            stroke-dasharray="8 6"
            opacity="0.9"
          />
          <text
            :x="(l.x1 + l.x2) / 2"
            :y="(l.y1 + l.y2) / 2 - 10"
            font-size="16"
            font-weight="800"
            fill="#0e1f16"
            text-anchor="middle"
            style="paint-order: stroke; stroke: #fff; stroke-width: 4px"
          >{{ l.chance }}%</text>
        </template>
      </g>

      <!-- fichas (orden de profundidad isométrica) -->
      <PlayerToken
        v-for="p in sortedPlayers"
        :key="p.id"
        :player="p"
        :interactive="tokenIsInteractive(p)"
        :selected="p.id === selectedId"
        :is-carrier="state.ball.carrier === p.id"
        :is-turn-of="p.team === state.currentTeam"
        @token-click="(id: number) => emit('token-click', id)"
      />

      <!-- anillo del balón suelto -->
      <polygon
        v-if="state.ball.carrier === null && !ballFx"
        :points="cellPoly(state.ball.pos)"
        class="loose-ring"
        fill="none"
        stroke="var(--gold)"
        stroke-width="2.6"
        stroke-dasharray="7 6"
      />

      <!-- balón (grande, con sombra y brillo) -->
      <g v-if="showGroundBall" class="ball-g" pointer-events="none">
        <g :transform="`translate(${ballPos.x},${ballPos.y - 24})`">
          <ellipse cy="26" rx="10" ry="4.6" fill="rgba(0,0,0,0.45)" />
          <circle r="10.5" fill="#fdfdfd" stroke="#181818" stroke-width="1.6" />
          <circle r="10.5" fill="url(#ballShine)" />
          <path d="M 0 -4 L 3.8 -1.2 L 2.3 3.2 L -2.3 3.2 L -3.8 -1.2 Z" transform="translate(0,1.4)" fill="#181818" />
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.board-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
}
.board-svg {
  width: 100%;
  height: auto;
  max-height: 78vh;
  border-radius: 18px;
  box-shadow: var(--shadow);
}
.hl-cell {
  cursor: pointer;
  transition: fill 0.12s ease;
}
.hl-cell:hover {
  fill: rgba(255, 255, 255, 0.45);
}
.loose-ring {
  animation: pulse-ring 1.3s ease-in-out infinite;
  pointer-events: none;
}
@keyframes pulse-ring {
  0%, 100% { stroke-opacity: 1; }
  50% { stroke-opacity: 0.35; }
}
</style>
