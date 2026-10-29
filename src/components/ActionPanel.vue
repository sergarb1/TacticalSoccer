<script setup lang="ts">
import { computed } from 'vue';
import type { GameState } from '../game/types';

const props = defineProps<{
  state: GameState;
  selectedId: number | null;
  mode: string;
  passOptionsList?: Array<{ targetId: number; chance: number; name: string; num: number }>;
  stealOptions?: Array<{ victimId: number; chance: number; name: string }>;
}>();

const emit = defineEmits<{
  (e: 'move'): void;
  (e: 'pass-mode'): void;
  (e: 'pass-to', targetId: number): void;
  (e: 'shoot-arm'): void;
  (e: 'shoot-confirm'): void;
  (e: 'shoot-cancel'): void;
  (e: 'steal', victimId: number): void;
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
</script>

<template>
  <section class="panel action-panel">
    <div class="row top">
      <strong>{{ selected ? selected.name : 'Acciones' }}</strong>
      <span class="ap-badge">PA {{ state.ap }}/3</span>
    </div>

    <div class="hint">{{ state.message }}</div>

    <!-- flujo de disparo -->
    <template v-if="mode === 'shooting'">
      <div class="shot-box">
        <span>¿Confirmar el disparo?</span>
        <div class="buttons">
          <button class="gold" @click="emit('shoot-confirm')">¡Chutar!</button>
          <button class="ghost" @click="emit('shoot-cancel')">Cancelar</button>
        </div>
      </div>
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
        <button :disabled="!canAct || !selected || selected.hasMoved" @click="emit('move')">🏃 Mover (1)</button>
        <button :disabled="!canAct || !hasBall || !selected || selected.hasActed" @click="emit('pass-mode')">🤝 Pasar (1)</button>
        <button :disabled="!canAct || !hasBall || !selected || selected.hasActed" @click="emit('shoot-arm')">⚡ Chutar (1)</button>
        <button :disabled="!canAct || hasBall || !isOwn || !selected || selected.hasActed" @click="emit('steal-mode')">🛡️ Defender (1)</button>
        <button class="primary end-turn" :disabled="state.phase !== 'playing' || state.ap === 0 && false" @click="emit('end-turn')">⏭ Terminar turno</button>
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
.hint { font-size: 0.82rem; color: var(--text-dim); min-height: 2.1em; }
.buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
.end-turn { grid-column: 1 / -1; }
.chips { display: flex; flex-wrap: wrap; gap: 0.45rem; }
.shot-box { display: grid; gap: 0.5rem; font-weight: 700; }
</style>
