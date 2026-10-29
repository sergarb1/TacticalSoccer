<script setup lang="ts">
import { computed } from 'vue';
import type { GameState } from '../game/types';

const props = defineProps<{ state: GameState }>();
const emit = defineEmits<{ (e: 'again'): void; (e: 'menu'): void }>();

const winner = computed(() =>
  props.state.score[0] > props.state.score[1] ? 'Gana el equipo rojo' :
  props.state.score[1] > props.state.score[0] ? 'Gana el equipo azul' : 'Empate'
);

function possession(team: 0 | 1): number {
  const a = props.state.stats[0].possessionTurns;
  const b = props.state.stats[1].possessionTurns;
  const total = a + b;
  if (total === 0) return 50;
  return Math.round(((team === 0 ? a : b) / total) * 100);
}
</script>

<template>
  <div class="result-overlay">
    <div class="panel result-card">
      <h1 class="score">{{ state.score[0] }} – {{ state.score[1] }}</h1>
      <p class="winner">{{ winner }} · Final del partido</p>

      <table class="stats-table">
        <thead>
          <tr><th></th><th class="th-home">Rojo</th><th class="th-away">Azul</th></tr>
        </thead>
        <tbody>
          <tr><td>Pases/tiros</td><td>{{ state.stats[0].shots }}</td><td>{{ state.stats[1].shots }}</td></tr>
          <tr><td>Tiros a puerta</td><td>{{ state.stats[0].onTarget }}</td><td>{{ state.stats[1].onTarget }}</td></tr>
          <tr><td>Balones robados</td><td>{{ state.stats[0].steals }}</td><td>{{ state.stats[1].steals }}</td></tr>
          <tr><td>Possesión</td><td>{{ possession(0) }}%</td><td>{{ possession(1) }}%</td></tr>
        </tbody>
      </table>

      <div class="actions">
        <button class="gold" @click="emit('again')">Jugar otra vez</button>
        <button class="ghost" @click="emit('menu')">Menú principal</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.result-overlay {
  position: fixed; inset: 0;
  display: grid; place-items: center;
  background: rgba(5, 14, 9, 0.72);
  backdrop-filter: blur(3px);
  z-index: 50;
}
.result-card { padding: 2rem 2.4rem; text-align: center; max-width: 430px; width: min(92vw, 430px); }
.score { font-size: 3rem; font-weight: 900; letter-spacing: 0.1em; }
.winner { color: var(--gold); font-weight: 700; margin: 0.3rem 0 1.2rem; }
.stats-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-bottom: 1.4rem; }
.stats-table td, .stats-table th { padding: 0.35rem 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.08); }
.stats-table thead th { color: var(--text-dim); font-size: 0.8rem; }
.th-home { color: var(--home); }
.th-away { color: var(--away); }
.stats-table td:first-child { text-align: left; color: var(--text-dim); }
.actions { display: flex; gap: 0.8rem; justify-content: center; }
</style>
