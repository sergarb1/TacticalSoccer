/**
 * Composición Vue de la Copa Capello: guarda y carga el cuadro en
 * localStorage, lanza el partido del usuario, registra su resultado y
 * simula los cruces que no le tocan (IA contra IA, sin DOM).
 */
import { computed, ref } from 'vue';
import { STORAGE_KEYS } from '../game/config';
import {
  createCup, setCupResult, simulateAiMatch, userMatchConfig, userPair
} from '../game/cup';
import type { CupState } from '../game/cup';
import type { AiLevel, MatchConfig, TeamId } from '../game/types';

const cup = ref<CupState | null>(null);
const aiLevel = ref<AiLevel>('normal');

function load(): CupState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.cup);
    if (!raw) return null;
    const data = JSON.parse(raw) as CupState;
    if (!data || !Array.isArray(data.rounds) || !data.userTeam) return null;
    return data;
  } catch {
    return null;
  }
}

function persist(): void {
  try {
    if (cup.value) localStorage.setItem(STORAGE_KEYS.cup, JSON.stringify(cup.value));
    else localStorage.removeItem(STORAGE_KEYS.cup);
  } catch {
    /* sin almacenamiento: la copa vive solo en memoria */
  }
}

cup.value = load();

/* ------------------------------------------------------------- */

/** Crea una copa nueva con el equipo elegido del usuario. */
function newCup(userTeam: string, level: AiLevel): void {
  const seed = (Date.now() ^ Math.floor(Math.random() * 4294967295)) >>> 0;
  cup.value = createCup(userTeam, seed);
  aiLevel.value = level;
  persist();
}

/** Abandonar: borra el cuadro (con confirmación en la UI). */
function abandonCup(): void {
  cup.value = null;
  persist();
}

/** Config del partido que le toca jugar al usuario (o null). */
export function startUserMatch(): MatchConfig | null {
  const c = cup.value;
  if (!c || c.champion !== null) return null;
  const cfg = userMatchConfig(c, aiLevel.value, (Date.now() ^ 0x5f3759df) >>> 0);
  return cfg;
}

/** Registra el resultado del partido del usuario (siempre team 0 en el tablero). */
export function recordUserResult(score: [number, number], winner: TeamId, pens: [number, number] | null): void {
  const c = cup.value;
  if (!c) return;
  const up = userPair(c);
  if (!up) return;
  const winnerId = winner === 0 ? c.userTeam : (up.pair.a === c.userTeam ? up.pair.b : up.pair.a);
  setCupResult(c, up.index, winnerId, score, pens);
  persist();
}

/** Simula los cruces de la ronda que no van a jugar en el tablero. */
function simRound(): void {
  const c = cup.value;
  if (!c || c.champion !== null) return;
  const round = c.rounds[c.roundIndex];
  for (let i = 0; i < round.length; i++) {
    const pair = round[i];
    if (pair.winner !== null) continue;
    const cfg: MatchConfig = {
      home: { teamId: pair.a, formation: '2-2' },
      away: { teamId: pair.b, formation: '2-2' },
      mode: 'aivsai',
      aiTeam: null,
      aiLevel: aiLevel.value,
      seed: (Date.now() + i * 7717) >>> 0,
      cup: true
    };
    const res = simulateAiMatch(cfg);
    setCupResult(c, i, res.winner === 0 ? pair.a : pair.b, res.score, res.pens);
  }
  persist();
}

export function useCup() {
  return {
    cup: computed(() => cup.value),
    aiLevel: computed(() => aiLevel.value),
    save: newCup,
    abandon: abandonCup,
    simRound,
    hasState: computed(() => cup.value !== null)
  };
}
