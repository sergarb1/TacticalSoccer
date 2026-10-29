<script setup lang="ts">
import { computed, ref } from 'vue';
import { FORMATIONS, TEAMS, teamById, buildRoster, formationById } from '../game/formations';
import type { MatchConfig } from '../game/types';

const emit = defineEmits<{
  (e: 'start', cfg: MatchConfig): void;
  (e: 'back'): void;
}>();

const savedAiLevel = ref<'easy' | 'normal' | 'hard'>('normal');
const homeId = ref('sur');
const awayId = ref('norte');
const homeFormation = ref('1-2-1');
const awayFormation = ref('2-1-1');
const mode = ref<'hotseat' | 'ai'>('ai');
const aiLevel = ref<'easy' | 'normal' | 'hard'>(savedAiLevel.value);

const home = computed(() => teamById(homeId.value));
const away = computed(() => teamById(awayId.value));

const homeRoster = computed(() => {
  try {
    return buildRoster(home.value, homeFormation.value);
  } catch {
    return [];
  }
});
const awayRoster = computed(() => {
  try {
    return buildRoster(away.value, awayFormation.value);
  } catch {
    return [];
  }
});

const homeFormationName = computed(() => formationById(homeFormation.value).name);
const awayFormationName = computed(() => formationById(awayFormation.value).name);


function start(): void {
  if (homeId.value === awayId.value) {
    // evita el mismo equipo en ambos lados
    const other = TEAMS.find((t) => t.id !== homeId.value);
    if (!other) return;
    awayId.value = other.id;
    awayFormation.value = FORMATIONS[0].id;
  }
  const cfg: MatchConfig = {
    home: { teamId: homeId.value, formation: homeFormation.value },
    away: { teamId: awayId.value, formation: awayFormation.value },
    mode: mode.value,
    aiTeam: mode.value === 'ai' ? 1 : null,
    aiLevel: aiLevel.value,
    seed: Math.floor(Math.random() * 4294967295)
  };
  emit('start', cfg);
}

const statLabels = [
  ['speed', 'VEL'], ['pass', 'PAS'], ['shoot', 'TIRO'], ['defense', 'DEF'], ['control', 'CTR'], ['stamina', 'RES']
] as const;
</script>

<template>
  <div class="setup">
    <h1 class="title-logo">TACTICAL <span class="accent">SOCCER</span></h1>
    <p class="subtitle">Preparación del partido</p>

    <div class="columns">
      <section class="panel col home-col">
        <h2>Equipo local</h2>
        <p class="tag tag-home">Rojo · ataca hacia la derecha</p>
        <select v-model="homeId">
          <option v-for="t in TEAMS" :value="t.id">{{ t.name }} ({{ t.style }})</option>
        </select>
        <p class="desc">{{ home.desc }}</p>
        <select v-model="homeFormation">
          <option v-for="f in FORMATIONS" :value="f.id">{{ f.name }}</option>
        </select>
        <ul class="roster">
          <li v-for="r in homeRoster" :key="r.name">
            <span class="num">{{ r.num }}</span>
            <span class="nname">{{ r.name }}</span>
            <span class="role">{{ r.role }}</span>
            <span class="attrs">{{ statLabels.map(([k, l]) => `${l}${r.stats[k]}`).join(' ') }}</span>
          </li>
        </ul>
      </section>

      <section class="panel col mode-col">
        <h2>Modo de juego</h2>
        <label><input v-model="mode" type="radio" value="hotseat" /> Dos jugadores (mismo dispositivo)</label>
        <label><input v-model="mode" type="radio" value="ai" /> Contra la máquina (IA azul)</label>
        <div v-if="mode === 'ai'" class="ai-levels">
          <p class="desc">Dificultad de la IA:</p>
          <label><input v-model="aiLevel" type="radio" value="easy" /> Fácil</label>
          <label><input v-model="aiLevel" type="radio" value="normal" /> Normal</label>
          <label><input v-model="aiLevel" type="radio" value="hard" /> Difícil</label>
        </div>
        <p class="desc">{{ homeFormationName }} · {{ awayFormationName }}</p>
        <button v-if="mode === 'hotseat'" class="ghost small">Cada jugador maneja un equipo por turnos.</button>
      </section>

      <section class="panel col away-col">
        <h2>Equipo visitante</h2>
        <p class="tag tag-away">Azul · ataca hacia la izquierda</p>
        <select v-model="awayId">
          <option v-for="t in TEAMS" :value="t.id">{{ t.name }} ({{ t.style }})</option>
        </select>
        <p class="desc">{{ away.desc }}</p>
        <select v-model="awayFormation">
          <option v-for="f in FORMATIONS" :value="f.id">{{ f.name }}</option>
        </select>
        <ul class="roster">
          <li v-for="r in awayRoster" :key="r.name">
            <span class="num">{{ r.num }}</span>
            <span class="nname">{{ r.name }}</span>
            <span class="role">{{ r.role }}</span>
            <span class="attrs">{{ statLabels.map(([k, l]) => `${l}${r.stats[k]}`).join(' ') }}</span>
          </li>
        </ul>
      </section>
    </div>

    <div class="actions">
      <button class="ghost" @click="emit('back')">← Volver</button>
      <button class="gold big" @click="start">Comenzar partido</button>
    </div>
  </div>
</template>

<style scoped>
.setup { max-width: 1180px; margin: 0 auto; padding: 1.2rem 1rem 3rem; }
.subtitle { color: var(--text-dim); margin: 0.2rem 0 1rem; }
.columns { display: grid; grid-template-columns: 1fr 0.8fr 1fr; gap: 1rem; align-items: start; }
.col { padding: 1rem; }
h2 { margin-bottom: 0.2rem; }
.tag { font-size: 0.75rem; margin: 0 0 0.6rem; }
.tag-home { color: var(--home); }
.tag-away { color: var(--away); }
.desc { font-size: 0.78rem; color: var(--text-dim); margin: 0.5rem 0; }
select { width: 100%; }
.roster { list-style: none; margin: 0.6rem 0 0; padding: 0; display: grid; gap: 3px; font-size: 0.72rem; }
.roster li { display: grid; grid-template-columns: 22px 1fr 42px auto; gap: 6px; align-items: baseline; padding: 2px 4px; border-radius: 6px; }
.roster li:hover { background: rgba(255, 255, 255, 0.05); }
.num { font-weight: 800; text-align: right; }
.nname { }
.role { color: var(--text-dim); }
.attrs { color: var(--text-dim); font-variant-numeric: tabular-nums; }
.mode-col { display: grid; gap: 0.5rem; }
label { font-size: 0.85rem; display: flex; gap: 0.4rem; align-items: center; }
.ai-levels { border-left: 2px solid var(--panel-border); padding-left: 0.7rem; display: grid; gap: 0.3rem; }
.small { font-size: 0.75rem; }
.actions { display: flex; justify-content: center; gap: 1rem; margin-top: 1.4rem; }
.big { font-size: 1.05rem; padding: 0.7rem 2.2rem; }
@media (max-width: 980px) { .columns { grid-template-columns: 1fr; } }
</style>
