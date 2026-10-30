<script setup lang="ts">
import { computed } from 'vue';
import {
  VB_W, VB_H, ISO_MATRIX, allBoardCells, cellToPx, cellPoly, svgToCell
} from '../composables/boardLayout';
import { FIELD_COLS, FIELD_ROWS, GOAL_CENTER_ROW } from '../game/config';
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

/* --- dimensiones del campo (derivadas de config, nunca fijas) --- */
const C = FIELD_COLS;
const R = FIELD_ROWS;
const MID_X = C / 2;
const MID_Y = R / 2;

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
const goalHintPos = computed(() => {
  const g = cellToPx({ col: attackRight.value ? C : 0, row: GOAL_CENTER_ROW });
  return attackRight.value ? { x: g.x + 96, y: g.y - 46 } : { x: g.x - 96, y: g.y - 46 };
});
</script>

<template>
  <div class="board-wrap">
    <svg :viewBox="`0 0 ${VB_W} ${VB_H}`" class="board-svg" role="img" aria-label="Campo de fútbol isométrico" @click="onSvgClick">
      <defs>
        <!-- clip del balón para que los pentágonos no salgan del círculo -->
        <clipPath id="ballClip"><circle r="9.6" /></clipPath>
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
        <rect x="-0.45" y="-0.25" :width="C + 0.9" :height="R + 0.5" fill="#0f2d1c" />
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
          <rect x="0" y="0" :width="C" :height="R" vector-effect="non-scaling-stroke" />
          <line :x1="MID_X" y1="0" :x2="MID_X" :y2="R" vector-effect="non-scaling-stroke" />
          <circle :cx="MID_X" :cy="MID_Y" r="1.15" vector-effect="non-scaling-stroke" />
          <rect x="0" y="1" width="2.4" :height="R - 2" vector-effect="non-scaling-stroke" />
          <rect :x="C - 2.4" y="1" width="2.4" :height="R - 2" vector-effect="non-scaling-stroke" />
          <path :d="`M 2.4 ${MID_Y - 0.6} A 0.72 0.72 0 0 1 2.4 ${MID_Y + 0.6}`" vector-effect="non-scaling-stroke" />
          <path :d="`M ${C - 2.4} ${MID_Y - 0.6} A 0.72 0.72 0 0 0 ${C - 2.4} ${MID_Y + 0.6}`" vector-effect="non-scaling-stroke" />
        </g>
        <circle :cx="MID_X" :cy="MID_Y" r="0.06" fill="var(--line)" />
        <circle cx="2.1" :cy="MID_Y" r="0.06" fill="var(--line)" />
        <circle :cx="C - 2.1" :cy="MID_Y" r="0.06" fill="var(--line)" />

        <!-- porterías pequeñas con red (alto de GOAL_ROWS) -->
        <g>
          <rect x="-0.45" :y="GOAL_CENTER_ROW" width="0.45" height="1" fill="rgba(240,248,244,0.2)" stroke="var(--line)" stroke-width="2" vector-effect="non-scaling-stroke" />
          <g stroke="rgba(240,248,244,0.45)" stroke-width="1" vector-effect="non-scaling-stroke">
            <line v-for="n in 3" :key="`nvL${n}`" :x1="-0.45 + (n * 0.45) / 4" :y1="GOAL_CENTER_ROW" :x2="-0.45 + (n * 0.45) / 4" :y2="GOAL_CENTER_ROW + 1" vector-effect="non-scaling-stroke" />
            <line v-for="n in 2" :key="`nhL${n}`" :x1="-0.45" :y1="GOAL_CENTER_ROW + n / 3" x2="0" :y2="GOAL_CENTER_ROW + n / 3" vector-effect="non-scaling-stroke" />
          </g>
          <rect :x="C" :y="GOAL_CENTER_ROW" width="0.45" height="1" fill="rgba(240,248,244,0.2)" stroke="var(--line)" stroke-width="2" vector-effect="non-scaling-stroke" />
          <g stroke="rgba(240,248,244,0.45)" stroke-width="1" vector-effect="non-scaling-stroke">
            <line v-for="n in 3" :key="`nvR${n}`" :x1="C + (n * 0.45) / 4" :y1="GOAL_CENTER_ROW" :x2="C + (n * 0.45) / 4" :y2="GOAL_CENTER_ROW + 1" vector-effect="non-scaling-stroke" />
            <line v-for="n in 2" :key="`nhR${n}`" :x1="C" :y1="GOAL_CENTER_ROW + n / 3" :x2="C + 0.45" :y2="GOAL_CENTER_ROW + n / 3" vector-effect="non-scaling-stroke" />
          </g>
        </g>

        <!-- banderines de córner en las cuatro esquinas -->
        <g stroke="rgba(244,249,244,0.95)" stroke-width="1.6" vector-effect="non-scaling-stroke">
          <g v-for="(corner, i) in [[0, 0], [C, 0], [0, R], [C, R]]" :key="`flag-${i}`">
            <line :x1="corner[0]" :y1="corner[1]" :x2="corner[0]" :y2="corner[1] - 0.85" vector-effect="non-scaling-stroke" />
            <polygon
              :points="`${corner[0]},${corner[1] - 0.85} ${corner[0] + 0.55},${corner[1] - 0.6} ${corner[0]},${corner[1] - 0.35}`"
              fill="var(--gold)"
              stroke="none"
            />
          </g>
        </g>

        <!-- resaltado del arco al armar el disparo -->
        <g v-if="shotArmed && shotPercent !== null" pointer-events="none">
          <rect
            v-if="attackRight"
            :x="C - 0.1"
            :y="GOAL_CENTER_ROW - 0.2"
            width="0.62"
            height="1.4"
            fill="none"
            stroke="var(--gold)"
            stroke-width="3"
            stroke-dasharray="7 5"
            vector-effect="non-scaling-stroke"
          />
          <rect
            v-else
            :x="-0.52"
            :y="GOAL_CENTER_ROW - 0.2"
            width="0.62"
            height="1.4"
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
        font-size="24"
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
          class="hl-cell breathe"
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
            class="pass-line"
            :stroke="l.chance >= 65 ? '#8ff0a0' : l.chance >= 40 ? 'var(--gold)' : 'var(--danger)'"
            stroke-width="3"
            stroke-dasharray="8 6"
            opacity="0.9"
          />
          <text
            :x="(l.x1 + l.x2) / 2"
            :y="(l.x1 + l.x2) / 2 - 10"
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
        :is-cutting="p.stance === 'cut'"
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

      <!-- balón (grande, con costuras clásicas y brillo; el vuelo se traslada suave) -->
      <g v-if="showGroundBall" class="ball-g" :class="{ fly: ballFx !== null }" pointer-events="none">
        <g :transform="`translate(${ballPos.x},${ballPos.y - 24})`">
          <ellipse cy="26" rx="10" ry="4.6" fill="rgba(0,0,0,0.45)" />
          <circle r="10.5" fill="#fdfdfd" stroke="#181818" stroke-width="1.6" />
          <!-- costuras clásicas: pentágono central + parches alrededor, recortados -->
          <g clip-path="url(#ballClip)">
            <g fill="#1f2126">
              <path d="M0 -3.4 L3.2 -1.05 L2 2.7 L-2 2.7 L-3.2 -1.05 Z" transform="translate(0,1)" />
              <path d="M0 -3.4 L3.2 -1.05 L2 2.7 L-2 2.7 L-3.2 -1.05 Z" transform="translate(0,-10.2) scale(0.9)" />
              <path d="M0 -3.4 L3.2 -1.05 L2 2.7 L-2 2.7 L-3.2 -1.05 Z" transform="translate(8.6,-4.4) rotate(72) scale(0.9)" />
              <path d="M0 -3.4 L3.2 -1.05 L2 2.7 L-2 2.7 L-3.2 -1.05 Z" transform="translate(9.4,5.4) rotate(144) scale(0.9)" />
              <path d="M0 -3.4 L3.2 -1.05 L2 2.7 L-2 2.7 L-3.2 -1.05 Z" transform="translate(-9.4,5.4) rotate(216) scale(0.9)" />
              <path d="M0 -3.4 L3.2 -1.05 L2 2.7 L-2 2.7 L-3.2 -1.05 Z" transform="translate(-8.6,-4.4) rotate(288) scale(0.9)" />
            </g>
            <g stroke="rgba(24,24,24,0.55)" stroke-width="0.8" fill="none">
              <line x1="0" y1="-2.5" x2="0" y2="-9" />
              <line x1="2.9" y1="-1" x2="9" y2="-4.2" />
              <line x1="1.9" y1="3.3" x2="8.6" y2="5.6" />
              <line x1="-1.9" y1="3.3" x2="-8.6" y2="5.6" />
              <line x1="-2.9" y1="-1" x2="-9" y2="-4.2" />
            </g>
          </g>
          <circle r="10.5" fill="url(#ballShine)" />
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
  animation: pulse-ring 1.3s ease-in-out infinite, dash-march 1.4s linear infinite;
  pointer-events: none;
}
.pass-line { animation: dash-march 0.9s linear infinite; pointer-events: none; }
/* el balón en vuelo se traslada con una curva suave (transition de transform) */
.ball-g { transition: transform 0.32s cubic-bezier(0.35, 1.2, 0.45, 1); }
.ball-g.fly circle { animation: ball-squish 0.5s ease-in-out; transform-box: fill-box; transform-origin: center; }
.hl-cell.breathe { animation: hl-breathe 1.5s ease-in-out infinite; }
@keyframes dash-march {
  to { stroke-dashoffset: -28; }
}
@keyframes hl-breathe {
  0%, 100% { fill-opacity: 0.75; }
  50% { fill-opacity: 1; stroke-opacity: 0.5; }
}
@keyframes ball-squish {
  0% { transform: scale(1); }
  30% { transform: scale(0.82, 1.12); }
  60% { transform: scale(1.1, 0.9); }
  100% { transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .loose-ring, .pass-line, .hl-cell.breathe, .ball-g.fly circle { animation: none; }
  .ball-g { transition: none; }
}
@keyframes pulse-ring {
  0%, 100% { stroke-opacity: 1; }
  50% { stroke-opacity: 0.35; }
}
</style>
