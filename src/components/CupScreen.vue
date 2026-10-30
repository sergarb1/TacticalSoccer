<script setup lang="ts">
import { computed, ref } from 'vue';
import { useCup, startUserMatch } from '../composables/useCup';
import { cupOpponentOf, cupTeamName, userMustPlay, ROUND_NAMES } from '../game/cup';
import { TEAMS, teamById } from '../game/formations';
import type { AiLevel, MatchConfig } from '../game/types';

const emit = defineEmits<{
  (e: 'play', cfg: MatchConfig): void;
  (e: 'back'): void;
}>();

const cupCtl = useCup();
const cup = cupCtl.cup;
const pick = ref(TEAMS[0]?.id ?? 'sur');
const level = ref<AiLevel>('normal');
const confirmingQuit = ref(false);

const userTeamName = computed(() => (cup.value ? cupTeamName(cup.value.userTeam) : ''));
const opponent = computed(() => {
  const c = cup.value;
  if (!c) return null;
  const idx = c.rounds[c.roundIndex]?.findIndex((p) => p.winner === null && (p.a === c.userTeam || p.b === c.userTeam));
  if (idx === undefined || idx === -1) return null;
  return cupOpponentOf(c, idx);
});
const championName = computed(() => (cup.value?.champion ? cupTeamName(cup.value.champion) : null));

function createCup(): void {
  confirmingQuit.value = false;
  cupCtl.save(pick.value, level.value);
}

function playMatch(): void {
  const cfg = startUserMatch();
  if (cfg) emit('play', cfg);
}

/** Pinta los participantes de un encuentro: nombres y marcador si acabó. */
function pairLabel(a: string, b: string): string {
  return `${cupTeamName(a)} vs ${cupTeamName(b)}`;
}
</script>

<template>
  <div class="cup">
    <h1 class="title-logo">COPA <span class="accent">CAPELLO</span> 🏆</h1>
    <p class="subtitle">Eliminación directa: Cuartos, Semifinales y Final. Los empates se deciden con penaltis 1v1 en el tablero.</p>

    <!-- Creación de la copa -->
    <section v-if="!cup" class="panel create">
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
        <button class="gold big" @click="createCup">🏁 Empezar la Copa</button>
        <button class="ghost" @click="emit('back')">← Volver</button>
      </div>
    </section>

    <!-- Cuadro en vivo -->
    <section v-else class="panel bracket">
      <h2>Cuadro · juega: {{ userTeamName }}</h2>

      <p v-if="championName" class="champ-banner">
        🏆 ¡{{ championName }} se lleva la Copa Capello!
      </p>
      <p v-else-if="userMustPlay(cup)" class="hint">
        Te toca: contra <b>{{ opponent ? teamById(opponent)?.name : '—' }}</b>. ¡Partido oficial: si empatas, penaltis!
      </p>
      <p v-else class="hint">Ronda en disputa: los cruces que no son tuyos se simulan.</p>

      <div v-for="(round, ri) in cup.rounds" :key="ri" class="round">
        <h3>{{ ROUND_NAMES[ri] }}</h3>
        <ul>
          <li
            v-for="(p, pi) in round"
            :key="pi"
            :class="{ mine: p.a === cup.userTeam || p.b === cup.userTeam, done: p.winner !== null }"
          >
            <span class="pair">{{ pairLabel(p.a, p.b) }}</span>
            <span v-if="p.winner !== null" class="res">
              {{ p.score[0] }}–{{ p.score[1] }}<template v-if="p.pens"> (pen. {{ p.pens[0] }}–{{ p.pens[1] }})</template>
            </span>
            <span v-else class="res pend">Pendiente</span>
          </li>
        </ul>
      </div>

      <div class="actions">
        <button v-if="!championName && userMustPlay(cup)" class="gold big" @click="playMatch">▶ Jugar mi partido</button>
        <button v-else-if="!championName" class="primary big" @click="cupCtl.simRound()">🎲 Simular cruces</button>
        <button v-else class="gold big" @click="cupCtl.abandon();">🏁 Nueva Copa</button>
        <button v-if="!confirmingQuit" class="ghost" @click="confirmingQuit = true">Abandonar la Copa</button>
        <button v-else class="danger" @click="cupCtl.abandon(); confirmingQuit = false">¿Seguro? Borrar el cuadro</button>
        <button class="ghost" @click="emit('back')">← Volver</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.cup { max-width: 900px; margin: 0 auto; padding: 1.2rem 1rem 3rem; }
.subtitle { color: var(--text-dim); margin: 0.2rem 0 1rem; }
.create, .bracket { padding: 1.2rem; display: grid; gap: 0.8rem; }
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
.round h3 { margin: 0.4rem 0 0.2rem; color: var(--gold); font-size: 0.95rem; }
.round ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.round li { display: flex; justify-content: space-between; gap: 0.6rem; padding: 4px 8px; border-radius: 6px; font-size: 0.85rem; }
.round li.mine { background: rgba(246, 195, 66, 0.1); border: 1px solid var(--gold); }
.round li.done { opacity: 0.85; }
.res { font-variant-numeric: tabular-nums; white-space: nowrap; }
.res.pend { color: var(--text-dim); }
.champ-banner { color: var(--gold); font-size: 1.1rem; font-weight: 700; margin: 0; }
.hint { font-size: 0.85rem; color: var(--text-dim); margin: 0; }
.actions { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-top: 0.4rem; }
.big { font-size: 1rem; padding: 0.6rem 1.6rem; }
.danger { background: #7a2334; }
</style>
