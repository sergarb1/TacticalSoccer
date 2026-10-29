<script setup lang="ts">
import { computed } from 'vue';
import {
  CELL, MARGIN_X, MARGIN_Y, COLS, ROWS, VB_W, VB_H, PITCH,
  cellToPx, cellTopLeft, svgToCell, TOKEN_R
} from '../composables/boardLayout';
import { GOAL_ROWS } from '../game/config';
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

/* --- geometría del dibujo --- */
const pitchX = PITCH.x;
const pitchY = PITCH.y;
const pitchW = PITCH.w;
const pitchH = PITCH.h;
const stripes = Array.from({ length: COLS }, (_, i) => i);
const goalTopY = MARGIN_Y + GOAL_ROWS[0] * CELL;
const goalBoxH = (GOAL_ROWS[1] - GOAL_ROWS[0] + 1) * CELL;
const GOAL_DEPTH = 20;

const sortedPlayers = computed(() =>
  [...props.state.players].sort((a, b) => a.pos.row - b.pos.row || a.num - b.num)
);

function tokenIsInteractive(p: Player): boolean {
  return props.state.phase === 'playing' && props.state.players.some((q) => q.id === p.id);
}

/* --- balón --- */
const ballPos = computed(() => {
  if (props.ballFx) return cellToPx(props.ballFx.target);
  return cellToPx(props.state.ball.pos);
});

/** Convierte el clic en casilla usando la matriz de pantalla del SVG. */
function onSvgClick(ev: MouseEvent): void {
  const svg = ev.currentTarget as SVGSVGElement;
  const pt = svg.createSVGPoint();
  pt.x = ev.clientX;
  pt.y = ev.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return;
  const p = pt.matrixTransform(ctm.inverse());
  const cell = svgToCell(p.x, p.y);
  if (cell && !isHighlight(cell)) emit('cell-click', cell);
}

/* --- resaltados de movimiento --- */
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

const goalLeftSideTeam0 = computed(() => props.state.currentTeam === 0);
</script>

<template>
  <div class="board-wrap">
    <svg :viewBox="`0 0 ${VB_W} ${VB_H}`" class="board-svg" role="img" aria-label="Campo de fútbol" @click="onSvgClick">
      <defs>
        <radialGradient id="vign" cx="0.5" cy="0.42" r="0.75">
          <stop offset="0.62" stop-color="rgba(0,0,0,0)" />
          <stop offset="1" stop-color="rgba(0,0,0,0.28)" />
        </radialGradient>
      </defs>

      <!-- marco exterior del estadio -->
      <rect x="8" y="8" :width="VB_W - 16" :height="VB_H - 16" rx="18" fill="#12281a" />
      <rect x="14" y="14" :width="VB_W - 28" :height="VB_H - 28" rx="14" fill="#1a3d26" />

      <!-- césped a rayas -->
      <rect
        v-for="i in stripes"
        :key="`g${i}`"
        :x="pitchX + (i - 1) * CELL"
        :y="pitchY"
        :width="CELL"
        :height="pitchH"
        :fill="(i - 1) % 2 === 0 ? 'var(--grass-0)' : 'var(--grass-1)'"
      />

      <!-- líneas blancas -->
      <g stroke="var(--line)" fill="none" stroke-width="3">
        <rect :x="pitchX + 1.5" :y="pitchY + 1.5" :width="pitchW - 3" :height="pitchH - 3" />
        <line :x1="pitchX + pitchW / 2" :y1="pitchY" :x2="pitchX + pitchW / 2" :y2="pitchY + pitchH" />
        <circle :cx="pitchX + pitchW / 2" :cy="pitchY + pitchH / 2" :r="52" />
        <circle :cx="pitchX + pitchW / 2" :cy="pitchY + pitchH / 2" :r="3.4" fill="var(--line)" stroke="none" />
        <rect :x="pitchX + 1.5" :y="pitchY + pitchH / 2 - 150" width="132" height="300" />
        <rect :x="pitchX + 1.5" :y="pitchY + pitchH / 2 - 60" width="53" height="120" />
        <rect :x="pitchX + pitchW - 133.5" :y="pitchY + pitchH / 2 - 150" width="132" height="300" />
        <rect :x="pitchX + pitchW - 54.5" :y="pitchY + pitchH / 2 - 60" width="53" height="120" />
        <circle :cx="pitchX + 110" :cy="pitchY + pitchH / 2" r="3" fill="var(--line)" stroke="none" />
        <circle :cx="pitchX + pitchW - 110" :cy="pitchY + pitchH / 2" r="3" fill="var(--line)" stroke="none" />
        <path :d="`M ${pitchX + 132} ${pitchY + pitchH / 2 - 42} A 55 55 0 0 1 ${pitchX + 132} ${pitchY + pitchH / 2 + 42}`" />
        <path :d="`M ${pitchX + pitchW - 132} ${pitchY + pitchH / 2 - 42} A 55 55 0 0 0 ${pitchX + pitchW - 132} ${pitchY + pitchH / 2 + 42}`" />
      </g>

      <!-- portería izquierda y derecha (espejadas) -->
      <g>
        <g :transform="`translate(${pitchX - GOAL_DEPTH}, ${goalTopY})`">
          <rect :width="GOAL_DEPTH" :height="goalBoxH" fill="rgba(240,248,244,0.22)" stroke="var(--line)" stroke-width="2.5" />
          <g stroke="rgba(240,248,244,0.5)" stroke-width="1">
            <line v-for="n in 4" :key="`gv${n}`" :x1="(n * GOAL_DEPTH) / 4" :y1="0" :x2="(n * GOAL_DEPTH) / 4" :y2="goalBoxH" />
            <line v-for="n in 5" :key="`gh${n}`" :x1="0" :y1="(n * goalBoxH) / 5" :x2="GOAL_DEPTH" :y2="(n * goalBoxH) / 5" />
          </g>
        </g>
        <g :transform="`translate(${pitchX + pitchW + GOAL_DEPTH}, ${goalTopY}) scale(-1,1)`">
          <rect :width="GOAL_DEPTH" :height="goalBoxH" fill="rgba(240,248,244,0.22)" stroke="var(--line)" stroke-width="2.5" />
          <g stroke="rgba(240,248,244,0.5)" stroke-width="1">
            <line v-for="n in 4" :key="`gvR${n}`" :x1="(n * GOAL_DEPTH) / 4" :y1="0" :x2="(n * GOAL_DEPTH) / 4" :y2="goalBoxH" />
            <line v-for="n in 5" :key="`ghR${n}`" :x1="0" :y1="(n * goalBoxH) / 5" :x2="GOAL_DEPTH" :y2="(n * goalBoxH) / 5" />
          </g>
        </g>
      </g>

      <!-- viñeta -->
      <rect :x="pitchX" :y="pitchY" :width="pitchW" :height="pitchH" fill="url(#vign)" pointer-events="none" />

      <!-- resaltado del arco al armar el disparo -->
      <g v-if="shotArmed && shotPercent !== null" pointer-events="none">
        <rect
          v-if="goalLeftSideTeam0"
          :x="pitchX + pitchW - 2"
          :y="goalTopY - 4"
          width="8"
          :height="goalBoxH + 8"
          fill="none"
          stroke="var(--gold)"
          stroke-width="3"
          stroke-dasharray="7 5"
          rx="6"
        />
        <rect
          v-else
          :x="pitchX - 6"
          :y="goalTopY - 4"
          width="8"
          :height="goalBoxH + 8"
          fill="none"
          stroke="var(--gold)"
          stroke-width="3"
          stroke-dasharray="7 5"
          rx="6"
        />
        <text
          v-if="goalLeftSideTeam0"
          :x="pitchX + pitchW - 52"
          :y="goalTopY - 14"
          font-size="19"
          font-weight="800"
          fill="var(--gold)"
          text-anchor="middle"
        >{{ shotPercent }}% gol</text>
        <text
          v-else
          :x="pitchX + 52"
          :y="goalTopY - 14"
          font-size="19"
          font-weight="800"
          fill="var(--gold)"
          text-anchor="middle"
        >{{ shotPercent }}% gol</text>
      </g>

      <!-- casillas de movimiento resaltadas -->
      <g>
        <rect
          v-for="hl in highlightsShown"
          :key="`hl-${hl.col}-${hl.row}`"
          :x="cellTopLeft(hl).x + 5"
          :y="cellTopLeft(hl).y + 5"
          :width="CELL - 10"
          :height="CELL - 10"
          rx="9"
          fill="rgba(255,255,255,0.22)"
          stroke="rgba(255,255,255,0.65)"
          stroke-width="1.6"
          stroke-dasharray="5 5"
          class="hl-cell"
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
            :y="(l.y1 + l.y2) / 2 - 8"
            font-size="15"
            font-weight="800"
            fill="#0e1f16"
            text-anchor="middle"
            style="paint-order: stroke; stroke: #fff; stroke-width: 4px"
          >{{ l.chance }}%</text>
        </template>
      </g>

      <!-- fichas -->
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

      <!-- balón -->
      <g :transform="`translate(${ballPos.x},${ballPos.y - 4})`" pointer-events="none">
        <ellipse cy="9" rx="7" ry="3.4" fill="rgba(0,0,0,0.4)" />
        <circle r="7" fill="#fff" stroke="#1c1c1c" stroke-width="1.6" />
        <circle r="2.4" fill="#1c1c1c" />
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
  fill: rgba(255, 255, 255, 0.4);
}
</style>
