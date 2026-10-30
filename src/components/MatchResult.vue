<script setup lang="ts">
import { computed, ref } from 'vue';
import type { GameState } from '../game/types';
import { seedCode } from '../game/seedcode';
import { matchMvp } from '../composables/useGame';

const props = defineProps<{ state: GameState }>();
const emit = defineEmits<{ (e: 'again'): void; (e: 'menu'): void }>();

const draw = computed(() => props.state.score[0] === props.state.score[1]);

const pens = computed<[number, number] | null>(() => {
  if (!draw.value) return null;
  // Tanda de penaltis simulada: 5 lanzamientos por equipo, mata-mata.
  let spo: [number, number] = [0, 0];
  let seed = stateSeed(props.state);
  const rnd = () => {
    seed = (seed * 48271 + 11) % 2147483647;
    return (seed >>> 8) / 8388607;
  };
  for (let i = 0; i < 5; i++) {
    // Los jugadores de campo chutan mejor que el portero para con el arco pequeño.
    const c0 = shootInKeeper(props.state, 0, rnd);
    const c1 = shootInKeeper(props.state, 1, rnd);
    if (c0) spo[0]++;
    if (c1) spo[1]++;
  }
  while (spo[0] === spo[1]) {
    if (shootInKeeper(props.state, 0, rnd)) spo[0]++;
    if (shootInKeeper(props.state, 1, rnd)) spo[1]++;
  }
  return spo;
});

function stateSeed(s: GameState): number {
  // Semilla determinista derivada del estado para que la tanda sea estable
  // (rerender de la UI no la cambia).
  return Math.abs(
    s.score[0] * 977 + s.score[1] * 131 + s.teamTurns * 31 + s.players.length * 7 + 13
  ) % 2147483646 + 1;
}

function shootInKeeper(s: GameState, team: 0 | 1, rnd: () => number): boolean {
  // Probabilidad de marcar: media de chutar de los 4 jugadores de campo
  // contra la parada del portero rival; empalma con shootGoalChance del motor.
  const shooters = s.players.filter((p) => p.team === team && p.role !== 'POR');
  const keeper = s.players.find((p) => p.team === (team === 0 ? 1 : 0) && p.role === 'POR');
  if (!keeper || shooters.length === 0) return rnd() < 0.5;
  const avgShoot = shooters.reduce((acc, p) => acc + p.stats.shoot, 0) / shooters.length;
  const reflexes = keeper.stats.reflexes;
  const base = avgShoot * 8.5 - reflexes * 3.6 - 14; // escala comparable al tiro normal
  return rnd() < Math.max(0.18, Math.min(0.85, base / 100));
}

const winner = computed(() => {
  if (!draw.value) {
    return props.state.score[0] > props.state.score[1] ? 'Gana el equipo rojo' : 'Gana el equipo azul';
  }
  const p = pens.value!;
  return p[0] > p[1] ? 'Gana el equipo rojo en los penaltis' : 'Gana el equipo azul en los penaltis';
});

function possession(team: 0 | 1): number {
  const a = props.state.stats[0].possessionTurns;
  const b = props.state.stats[1].possessionTurns;
  const total = a + b;
  if (total === 0) return 50;
  return Math.round(((team === 0 ? a : b) / total) * 100);
}

/* ------- MVP, código del reto y compartir ------- */
const mvp = computed(() => matchMvp());
const code = computed(() => seedCode(props.state.rng));
const copied = ref(false);
let copyTimer: number | null = null;

function flashCopied(): void {
  copied.value = true;
  if (copyTimer !== null) window.clearTimeout(copyTimer);
  copyTimer = window.setTimeout(() => (copied.value = false), 2200);
}

async function copyCode(): Promise<void> {
  try {
    await navigator.clipboard.writeText(code.value);
    flashCopied();
  } catch { /* portapapeles bloqueado: no revienta la pantalla */ }
}

/** Texto compartible del resultado (tabloncito para mandar por ahí). */
const shareText = computed(() => {
  const s = props.state;
  const pen = draw.value ? ` (pen. ${pens.value![0]}–${pens.value![1]})` : '';
  const mvpLine = mvp.value ? `\n⭐ MVP: ${mvp.value.name} · ${mvp.value.goals} ⚽ / ${mvp.value.steals} 🧤 (${mvp.value.teamName})` : '';
  return `⚽ TACTICAL SOCCER · GAÑÁN EDITION\n${winner.value}${pen}\nMarcador final: ${s.score[0]}–${s.score[1]}${mvpLine}\n🎲 Código del reto: ${code.value}`;
});

async function shareResult(): Promise<void> {
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Tactical Soccer · Gañan Edition', text: shareText.value });
    } else {
      await navigator.clipboard.writeText(shareText.value);
      flashCopied();
    }
  } catch { /* el usuario canceló: sin drama */ }
}
</script>

<template>
  <div class="result-overlay">
    <div class="panel result-card">
      <h1 class="score">{{ state.score[0] }} – {{ state.score[1] }}</h1>
      <p class="winner">{{ winner }} · {{ draw ? 'Decidido en la tanda de penaltis (' + pens![0] + '-' + pens![1] + ')' : 'Final del partido' }}</p>

      <table class="stats-table">
        <thead>
          <tr><th></th><th class="th-home">Rojo</th><th class="th-away">Azul</th></tr>
        </thead>
        <tbody>
          <tr><td>Pases/tiros</td><td>{{ state.stats[0].shots }}</td><td>{{ state.stats[1].shots }}</td></tr>
          <tr><td>Tiros a puerta</td><td>{{ state.stats[0].onTarget }}</td><td>{{ state.stats[1].onTarget }}</td></tr>
          <tr><td>Balones robados</td><td>{{ state.stats[0].steals }}</td><td>{{ state.stats[1].steals }}</td></tr>
          <tr><td>Posesión</td><td>{{ possession(0) }}%</td><td>{{ possession(1) }}%</td></tr>
        </tbody>
      </table>

      <p v-if="mvp" class="mvp-line">⭐ MVP: <b>{{ mvp.name }}</b> · {{ mvp.goals }} ⚽ / {{ mvp.steals }} 🧤 ({{ mvp.teamName }})</p>

      <button class="code-row ghost" :title="'Copiar código del reto: ' + code" @click="copyCode">
        🎲 Código del reto: <b>{{ code }}</b><span v-if="copied" class="copied"> ¡copiado!</span>
      </button>

      <div class="actions">
        <button class="gold share" @click="shareResult">📤 Compartir resultado</button>
        <button class="primary" @click="emit('again')">Jugar otra vez</button>
        <button class="ghost" @click="emit('menu')">Menú</button>
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
.actions { display: flex; flex-wrap: wrap; gap: 0.8rem; justify-content: center; }
.mvp-line { margin: 0 0 0.5rem; color: var(--text-dim); font-size: 0.85rem; }
.code-row {
  margin: 0 auto 0.8rem; font-size: 0.8rem; cursor: pointer;
  border: 1px dashed var(--panel-border); border-radius: 8px; padding: 0.3rem 0.7rem;
}
.code-row b { color: var(--gold); letter-spacing: 0.12em; }
.copied { color: #79d98a; }
.share { font-size: 0.9rem; }
</style>
