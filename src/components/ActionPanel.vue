<script setup lang="ts">
import { computed } from 'vue';
import type { GameState, ShotKind, TeamId } from '../game/types';
import { SHOT_COST, SHOT_LABEL, AP_PER_TURN, METER_MAX } from '../game/config';

const props = defineProps<{
  state: GameState;
  selectedId: number | null;
  mode: string;
  passOptionsList?: Array<{ targetId: number; chance: number; name: string; num: number }>;
  stealOptions?: Array<{ victimId: number; chance: number; name: string }>;
  /** Rival con balón al alcance del hachazo (robo premium). */
  hackOptions?: Array<{ victimId: number; chance: number; name: string; dist: number }>;
  /** Rival con balón al alcance del corte (postura «cut»). */
  cutOptions?: Array<{ carrierId: number; name: string; dist: number }>;
  /** Previsualización por tipo de disparo. */
  shotReads?: { normal: ShotReadUi | null; billetes: ShotReadUi | null; vaselina: ShotReadUi | null };
}>();

interface ShotReadUi { goal: number; description: string }

const emit = defineEmits<{
  (e: 'move'): void;
  (e: 'pass-mode'): void;
  (e: 'pass-to', targetId: number): void;
  (e: 'shoot-arm'): void;
  (e: 'shoot', kind: ShotKind): void;
  (e: 'shoot-cancel'): void;
  (e: 'steal', victimId: number): void;
  (e: 'hack-mode'): void;
  (e: 'hack', victimId: number): void;
  (e: 'cut-mode'): void;
  (e: 'cut', carrierId: number): void;
  (e: 'end-turn'): void;
  (e: 'steal-mode'): void;
  (e: 'cancel'): void;
}>();

/* Reactivos: si se leen una sola vez, la selección del campo no
   actualizaría los botones y «Mover» parecería no responder. */
const selected = computed(() =>
  props.selectedId === null
    ? null
    : props.state.players.find((p) => p.id === props.selectedId) ?? null
);
const isOwn = computed(() => selected.value !== null && selected.value.team === props.state.currentTeam);
const hasBall = computed(() => selected.value !== null && props.state.ball.carrier === selected.value.id);
const canAct = computed(() => isOwn.value && props.state.phase === 'playing' && props.state.ap > 0);

/** ¿Hay AP y acciones especiales suficientes para este disparo? */
function canShoot(kind: ShotKind): boolean {
  const hasSpecial = kind === 'normal' || props.state.specials[stateTeam()] > 0;
  return (
    canAct.value &&
    hasBall.value &&
    selected.value !== null &&
    !selected.value.hasActed &&
    hasSpecial &&
    props.state.ap >= SHOT_COST[kind]
  );
}

function stateTeam(): TeamId {
  return props.state.currentTeam;
}

/** La barra del equipo con la mano (para pintar los segmentos). */
const meter = computed(() => props.state.meter[stateTeam()]);
const specials = computed(() => props.state.specials[stateTeam()]);
const canHack = computed(
  () => canAct.value && hasBall.value === false && isOwn.value &&
    selected.value !== null && !selected.value.hasActed &&
    specials.value > 0 && props.state.ap >= 1
);

const shotKinds: ShotKind[] = ['normal', 'billetes', 'vaselina'];
const shotCost = (k: ShotKind): number => SHOT_COST[k];
const shotLabel = (k: ShotKind): string => SHOT_LABEL[k];
const shotDesc = (k: ShotKind): string | null => props.shotReads?.[k]?.description ?? null;
</script>

<template>
  <section class="panel action-panel">
    <div class="row top">
      <strong>{{ selected ? selected.name : 'Acciones' }}</strong>
      <span class="meter-box">
        <span class="meter-label">Especiales {{ specials }}</span>
        <span class="meter-cells" title="Barra de especiales: gol encajado, gol especial o robo la llenan">
          <i v-for="n in METER_MAX" :key="n" :class="{ fill: meter >= n }"></i>
        </span>
      </span>
      <span class="ap-badge">PA {{ state.ap }}/{{ AP_PER_TURN }}</span>
    </div>

    <div class="hint">{{ state.message }}</div>

    <!-- flujo de disparo: elige tipo con % a la vista -->
    <template v-if="mode === 'shooting'">
      <div class="shot-box">
        <span>Elige el golpeo (el % es la probabilidad de gol):</span>
        <div class="chips">
          <button
            v-for="k in shotKinds"
            :key="k"
            :class="{ gold: k !== 'normal' }"
            :disabled="!canShoot(k)"
            @click="emit('shoot', k)"
          >
            {{ shotLabel(k) }} ({{ shotCost(k) }} PA) · {{ shotReads?.[k]?.goal ?? 0 }}%
          </button>
          <button class="ghost" @click="emit('shoot-cancel')">Cancelar</button>
        </div>
        <p v-for="k in shotKinds" v-show="shotDesc(k)" :key="`d-${k}`" class="hint">
          <template v-if="shotDesc(k)"><b>{{ shotLabel(k) }}:</b> {{ shotDesc(k) }}</template>
        </p>
      </div>
    </template>

    <!-- hachazo robador: robo premium con acciones especiales -->
    <template v-else-if="mode === 'hacking'">
      <div class="chips">
        <button v-if="(hackOptions ?? []).length === 0" disabled>Ningún rival con balón al alcance del hachazo</button>
        <button v-for="o in hackOptions ?? []" :key="o.victimId" :class="{ gold: true }" @click="emit('hack', o.victimId)">
          ⚡ Hachazo a {{ o.name }} ({{ o.chance }}% · a {{ o.dist }})
        </button>
        <button class="ghost" @click="emit('cancel')">Cancelar</button>
      </div>
      <p class="hint">El hachazo gasta 1 PA y una acción especial: llega a 2 casillas y roba con más garra. Si aciertas, tu barra también carga.</p>
    </template>

    <!-- robos disponibles -->
    <template v-else-if="mode === 'stealing'">
      <div class="chips">
        <button v-if="(stealOptions ?? []).length === 0" disabled>No hay rivales con balón a la vista</button>
        <button v-for="o in stealOptions ?? []" :key="o.victimId" @click="emit('steal', o.victimId)">
          Robar a {{ o.name }} ({{ o.chance }}%)
        </button>
        <button class="ghost" @click="emit('cancel')">Cancelar</button>
      </div>
    </template>

    <!-- plantarse a cortar: el rival con balón al alcance -->
    <template v-else-if="mode === 'cutting'">
      <div class="chips">
        <button v-if="(cutOptions ?? []).length === 0" disabled>Ningún rival con balón al alcance del corte</button>
        <button v-for="o in cutOptions ?? []" :key="o.carrierId" @click="emit('cut', o.carrierId)">
          Plantarse ante {{ o.name }} (a {{ o.dist }} casilla/s)
        </button>
        <button class="ghost" @click="emit('cancel')">Cancelar</button>
      </div>
      <p class="hint">La postura dura hasta tu próximo turno: corta más pases y tapa tiros rivales por tu línea.</p>
    </template>

    <!-- pases disponibles -->
    <template v-else-if="mode === 'passing'">
      <div class="chips">
        <button v-if="(passOptionsList ?? []).length === 0" disabled>Ningún compañero está al alcance</button>
        <button v-for="o in passOptionsList ?? []" :key="o.targetId" @click="emit('pass-to', o.targetId)">
          {{ o.num }} · {{ o.name }} ({{ o.chance }}%)
        </button>
        <button class="ghost" @click="emit('cancel')">Cancelar</button>
      </div>
    </template>

    <!-- acciones base -->
    <template v-else>
      <div class="buttons">
        <button :disabled="!canAct || !selected || selected.hasMoved" @click="emit('move')">Mover (1)</button>
        <button :disabled="!canAct || !hasBall || !selected || selected.hasActed" @click="emit('pass-mode')">Pasar (1)</button>
        <button :disabled="!canShoot('normal')" @click="emit('shoot-arm')">Chutar (1)</button>
        <button :disabled="!canAct || hasBall || !isOwn || !selected || selected.hasActed" @click="emit('steal-mode')">Robar (1)</button>
        <button :disabled="!canHack" @click="emit('hack-mode')">⚡ Hachazo</button>
        <button :disabled="!canAct || hasBall || !isOwn || !selected || selected.hasActed" @click="emit('cut-mode')">Cortar (1)</button>
        <button class="primary end-turn" :disabled="state.phase !== 'playing'" @click="emit('end-turn')">⏭ Terminar turno</button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.action-panel { padding: 0.8rem 1rem; display: grid; gap: 0.55rem; }
.row.top { display: flex; justify-content: space-between; align-items: center; }
.ap-badge {
  font-size: 0.78rem; font-weight: 800; color: var(--gold);
  border: 1px solid var(--gold); padding: 0.1rem 0.5rem; border-radius: 999px;
}
.meter-box { display: inline-flex; align-items: center; gap: 0.4rem; }
.meter-label { font-size: 0.68rem; font-weight: 700; color: var(--text-dim); }
.meter-cells { display: inline-flex; gap: 3px; }
.meter-cells i {
  width: 10px; height: 10px; border-radius: 3px;
  background: #0f2419; border: 1px solid #1d4231;
}
.meter-cells i.fill {
  background: linear-gradient(90deg, var(--gold), #b8860b);
  border-color: var(--gold);
}
/* el segmento recién ganado late al ganar su sitio */
.meter-cells i.fill:last-child {
  animation: meter-pulse 1.4s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .meter-cells i.fill:last-child { animation: none; }
}
.hint { font-size: 0.82rem; color: var(--text-dim); min-height: 2.1em; }
.buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
.end-turn { grid-column: 1 / -1; }
.chips { display: flex; flex-wrap: wrap; gap: 0.45rem; }
.shot-box { display: grid; gap: 0.5rem; font-weight: 700; }
</style>
