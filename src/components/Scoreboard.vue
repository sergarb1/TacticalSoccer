<script setup lang="ts">
import { computed } from 'vue';
import type { GameState, TeamId } from '../game/types';

const props = defineProps<{ state: GameState; paused?: boolean }>();

const emit = defineEmits<{ (e: 'pause'): void }>();

const clock = computed(() => Math.min(90, props.state.teamTurns * 3));
const homeShort = computed(() => props.state.config.home.teamId.toUpperCase());
const awayShort = computed(() => props.state.config.away.teamId.toUpperCase());

function apDotsBold(team: TeamId): number {
  return props.state.currentTeam === team ? props.state.ap : 3;
}
</script>

<template>
  <header class="scoreboard panel">
    <div class="team home" :class="{ active: state.currentTeam === 0 }">
      <span class="chip home-chip">{{ homeShort }}</span>
      <span class="aps">{{ apDotsBold(0) }}/3 PA</span>
    </div>

    <div class="center">
      <div class="score">{{ state.score[0] }} <span class="sep">–</span> {{ state.score[1] }}</div>
      <div class="meta">
        <span class="clock">{{ clock }}'</span>
        <span class="half">{{ state.half === 1 ? '1ª parte' : '2ª parte' }}</span>
        <span class="turn">Turno {{ state.teamTurns + 1 }}/30</span>
      </div>
      <div class="turn-tag" :class="state.currentTeam === 0 ? 'tag-home' : 'tag-away'">
        Turno del {{ state.currentTeam === 0 ? 'equipo rojo' : 'equipo azul' }}
      </div>
    </div>

    <div class="team away" :class="{ active: state.currentTeam === 1 }">
      <span class="chip away-chip">{{ awayShort }}</span>
      <span class="aps">{{ apDotsBold(1) }}/3 PA</span>
    </div>

    <button class="pause-btn" title="Pausa y ajustes" @click="emit('pause')">☰</button>
  </header>
</template>

<style scoped>
.scoreboard {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.9rem;
  width: 100%;
}
.team {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  opacity: 0.55;
  transition: opacity 0.2s ease;
}
.team.active { opacity: 1; }
.team.home { justify-content: flex-start; }
.team.away { justify-content: flex-end; }
.chip {
  font-weight: 800;
  font-size: 0.8rem;
  padding: 0.2rem 0.55rem;
  border-radius: 8px;
  letter-spacing: 0.06em;
  color: #fff;
}
.home-chip { background: linear-gradient(180deg, var(--home), var(--home-dark)); }
.away-chip { background: linear-gradient(180deg, var(--away), var(--away-dark)); }
.aps { font-size: 0.78rem; color: var(--text-dim); }
.center { text-align: center; }
.score {
  font-size: 1.7rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  line-height: 1;
}
.sep { color: var(--text-dim); }
.meta { display: flex; gap: 0.8rem; justify-content: center; font-size: 0.75rem; color: var(--text-dim); margin-top: 2px; }
.clock { font-weight: 700; color: var(--gold); }
.turn-tag {
  font-size: 0.72rem;
  font-weight: 700;
  margin-top: 2px;
}
.tag-home { color: var(--home); }
.tag-away { color: var(--away); }
.pause-btn { font-size: 1.05rem; padding: 0.35rem 0.6rem; }
</style>
