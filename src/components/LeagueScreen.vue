<script setup lang="ts">
import { computed, ref } from 'vue';
import { useLeague, startLeagueMatch } from '../composables/useLeague';
import { leagueTeamName, standings, userFixture, LEAGUE_DAYS } from '../game/league';
import { TEAMS } from '../game/formations';
import type { AiLevel, MatchConfig } from '../game/types';

const emit = defineEmits<{
  (e: 'play', cfg: MatchConfig): void;
  (e: 'back'): void;
}>();

const leagueCtl = useLeague();
const league = leagueCtl.league;
const pick = ref(TEAMS[0]?.id ?? 'sur');
const level = ref<AiLevel>('normal');
const confirmingQuit = ref(false);

const table = computed(() => (league.value ? standings(league.value) : []));
const championName = computed(() => (league.value?.champion ? leagueTeamName(league.value.champion) : null));
const fixture = computed(() => (league.value ? userFixture(league.value) : null));
const dayNo = computed(() => (league.value ? Math.min(league.value.dayIndex + 1, LEAGUE_DAYS) : 0));

function createLeague(): void {
  confirmingQuit.value = false;
  leagueCtl.save(pick.value, level.value);
}

function playMatch(): void {
  const cfg = startLeagueMatch();
  if (cfg) emit('play', cfg);
}

/** puntos y nombre de la fila para la tabla html. */
function points(r: { won: number; drawn: number }): number {
  return r.won * 3 + r.drawn * 1;
}
</script>

<template>
  <div class="league">
    <h1 class="title-logo">LIGA <span class="accent">GAÑÁN</span> 🏅</h1>
    <p class="subtitle">7 jornadas, todos contra todos: ganar 3 puntos, empatar 1. Sin penaltis: aquí el empate vale.</p>

    <!-- Creación de la liga -->
    <section v-if="!league" class="panel create">
      <h2>Elige tu equipo</h2>
      <div class="team-grid">
        <button
          v-for="t in TEAMS"
          :key="t.id"
          class="team-card"
          :class="{ picked: pick === t.id }"
          @click="pick = t.id"
        >
          <span class="tname">{{ t.name }}</span>
          <span class="tstyle">{{ t.style }}</span>
        </button>
      </div>
      <p class="desc">Dificultad de la IA en tus partidos y en los simulados:</p>
      <div class="levels">
        <label><input v-model="level" type="radio" value="easy" /> Fácil</label>
        <label><input v-model="level" type="radio" value="normal" /> Normal</label>
        <label><input v-model="level" type="radio" value="hard" /> Difícil</label>
      </div>
      <div class="actions">
        <button class="gold big" @click="createLeague">🏁 Empezar la Liga</button>
        <button class="ghost" @click="emit('back')">← Volver</button>
      </div>
    </section>

    <!-- Tabla en vivo -->
    <section v-else class="panel table-panel">
      <h2>Clasificación · jornadas: {{ dayNo }}/{{ LEAGUE_DAYS }}</h2>

      <p v-if="championName" class="champ-banner">
        🏆 ¡{{ championName }} gana la Liga Gañán!
      </p>
      <p v-else-if="fixture" class="hint">
        Jornada {{ dayNo }}: te toca contra <b>{{ fixture.a === league.userTeam ? leagueTeamName(fixture.b) : leagueTeamName(fixture.a) }}</b>.
      </p>
      <p v-else class="hint">Jornada en disputa: se simulan los cruces que no son tuyos.</p>

      <table class="standings">
        <thead>
          <tr><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>PTS</th></tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in table" :key="r.team" :class="{ mine: r.team === league.userTeam, first: i === 0 }">
            <td>{{ i + 1 }}. {{ leagueTeamName(r.team) }}</td>
            <td>{{ r.played }}</td><td>{{ r.won }}</td><td>{{ r.drawn }}</td><td>{{ r.lost }}</td>
            <td>{{ r.gf }}</td><td>{{ r.ga }}</td>
            <td><b>{{ points(r) }}</b></td>
          </tr>
        </tbody>
      </table>

      <div class="actions">
        <button v-if="!championName && fixture" class="gold big" @click="playMatch">▶ Jugar mi partido</button>
        <button v-else-if="!championName" class="primary big" @click="leagueCtl.abandon()">🔁 Reiniciar jornada</button>
        <button v-else class="gold big" @click="leagueCtl.abandon()">🏁 Nueva Liga</button>
        <button v-if="!confirmingQuit && !championName" class="ghost" @click="confirmingQuit = true">Abandonar la Liga</button>
        <button v-if="confirmingQuit && !championName" class="danger" @click="leagueCtl.abandon(); confirmingQuit = false">¿Seguro? Borrar la tabla</button>
        <button class="ghost" @click="emit('back')">← Volver</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.league { max-width: 900px; margin: 0 auto; padding: 1.2rem 1rem 3rem; }
.subtitle { color: var(--text-dim); margin: 0.2rem 0 1rem; }
.create, .table-panel { padding: 1.2rem; display: grid; gap: 0.8rem; }
.team-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.5rem; }
.team-card {
  background: var(--panel-border); color: var(--text); border: 2px solid transparent;
  border-radius: 10px; padding: 0.6rem; text-align: left; cursor: pointer;
  display: grid; gap: 2px;
}
.team-card.picked { border-color: var(--gold); background: rgba(246, 195, 66, 0.12); }
.tname { font-weight: 800; }
.tstyle { font-size: 0.72rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.1em; }
.desc { font-size: 0.8rem; color: var(--text-dim); margin: 0; }
.levels { display: flex; gap: 1rem; }
.levels label { font-size: 0.85rem; display: flex; gap: 0.35rem; align-items: center; }
.champ-banner { color: var(--gold); font-size: 1.1rem; font-weight: 700; margin: 0; }
.hint { font-size: 0.85rem; color: var(--text-dim); margin: 0; }
.standings { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.standings th, .standings td { padding: 0.3rem 0.4rem; border-bottom: 1px solid rgba(255,255,255,0.08); text-align: center; }
.standings th { color: var(--text-dim); font-size: 0.72rem; }
.standings td:first-child { text-align: left; }
.standings tr.mine { background: rgba(246, 195, 66, 0.1); }
.standings tr:first-child td { color: var(--gold); }
.actions { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-top: 0.4rem; }
.big { font-size: 1rem; padding: 0.6rem 1.6rem; }
.danger { background: #7a2334; }
</style>
