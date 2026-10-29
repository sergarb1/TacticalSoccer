<script setup lang="ts">
import { computed } from 'vue';
import type { GameState } from '../game/types';

const props = defineProps<{ state: GameState; selectedId: number | null }>();

const ROLES: Record<string, string> = {
  POR: 'Portero', DFC: 'Central', LI: 'Lateral izq.', LD: 'Lateral der.',
  MCD: 'Pivot', MC: 'Mediocentro', EI: 'Extremo izq.', ED: 'Extremo der.', DC: 'Delantero'
};

const player = computed(() =>
  props.selectedId === null ? null : props.state.players.find((p) => p.id === props.selectedId) ?? null
);

const hasBall = computed(() => player.value !== null && props.state.ball.carrier === player.value.id);

const STATS: Array<{ key: 'speed' | 'pass' | 'shoot' | 'defense' | 'control' | 'stamina' | 'reflexes'; label: string }> = [
  { key: 'speed', label: 'Velocidad' },
  { key: 'pass', label: 'Pase' },
  { key: 'shoot', label: 'Tiro' },
  { key: 'defense', label: 'Defensa' },
  { key: 'control', label: 'Control' },
  { key: 'stamina', label: 'Resistencia' },
  { key: 'reflexes', label: 'Parada' }
];

const shownStats = computed(() =>
  player.value && player.value.role !== 'POR'
    ? STATS.filter((s) => s.key !== 'reflexes')
    : STATS
);
</script>

<template>
  <section class="panel player-panel">
    <h3>Futbolista</h3>
    <div v-if="!player" class="empty">Selecciona una ficha del campo.</div>
    <template v-else>
      <div class="header">
        <span class="badge" :class="player.team === 0 ? 'b-home' : 'b-away'">{{ player.num }}</span>
        <div class="who">
          <strong>{{ player.name }}</strong>
          <span class="role">{{ ROLES[player.role] }}</span>
        </div>
        <span v-if="hasBall" class="balling">⚽ con balón</span>
      </div>
      <div class="stats">
        <div v-for="st in shownStats" :key="st.key" class="stat-row">
          <span>{{ st.label }}</span>
          <div class="stat-bar"><i :style="{ width: (player.stats[st.key] * 10) + '%' }" /></div>
          <span class="val">{{ player.stats[st.key] }}</span>
        </div>
      </div>
      <div class="turn-state">
        <span v-if="player.team === state.currentTeam">
          {{ player.hasMoved ? 'Ya se ha movido' : 'Puede moverse' }}
          ·
          {{ player.hasActed ? 'Ya ha actuado' : 'Puede actuar' }}
        </span>
        <span v-else>Equipo rival: solo consulta</span>
      </div>
    </template>
  </section>
</template>

<style scoped>
.player-panel { padding: 0.8rem 1rem; }
h3 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-dim); margin-bottom: 0.5rem; }
.empty { color: var(--text-dim); font-size: 0.85rem; padding: 0.5rem 0; }
.header { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.6rem; }
.badge {
  display: grid; place-items: center;
  width: 34px; height: 34px; border-radius: 50%;
  font-weight: 900; color: #fff;
}
.b-home { background: linear-gradient(180deg, var(--home), var(--home-dark)); }
.b-away { background: linear-gradient(180deg, var(--away), var(--away-dark)); }
.who { display: flex; flex-direction: column; }
.role { font-size: 0.75rem; color: var(--text-dim); }
.balling { font-size: 0.75rem; color: var(--gold); font-weight: 700; margin-left: auto; }
.stats { display: grid; gap: 4px; }
.val { text-align: right; color: var(--text); }
.turn-state { margin-top: 0.6rem; font-size: 0.74rem; color: var(--text-dim); }
</style>
