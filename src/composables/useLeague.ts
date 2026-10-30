/**
 * Composición Vue de la Liga Gañán: guarda y carga la tabla en localStorage,
 * lanza el partido de la jornada, registra su resultado y simula los cruces
 * que no le tocan (IA contra IA, sin DOM). Los empates puntúan sin penaltis.
 */
import { computed, ref } from 'vue';
import { STORAGE_KEYS } from '../game/config';
import { simulateAiMatch } from '../game/cup';
import {
  createLeague, recordDay, userLeagueMatchConfig, userFixture, LEAGUE_DAYS
} from '../game/league';
import type { LeagueState } from '../game/league';
import type { AiLevel, MatchConfig } from '../game/types';

const league = ref<LeagueState | null>(null);

function load(): LeagueState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.league);
    if (!raw) return null;
    const data = JSON.parse(raw) as LeagueState;
    if (!data || !Array.isArray(data.fixtures) || !data.userTeam) return null;
    return data;
  } catch {
    return null;
  }
}

function persist(): void {
  try {
    if (league.value) localStorage.setItem(STORAGE_KEYS.league, JSON.stringify(league.value));
    else localStorage.removeItem(STORAGE_KEYS.league);
  } catch {
    /* sin almacenamiento: la liga vive solo en memoria */
  }
}

league.value = load();

/* ------------------------------------------------------------- */

/** Crea una liga nueva con el equipo elegido. */
function newLeague(userTeam: string, level: AiLevel): void {
  const seed = (Date.now() ^ Math.floor(Math.random() * 4294967295)) >>> 0;
  league.value = createLeague(userTeam, seed, level);
  persist();
}

/** Abandonar: borra la liga (con confirmación en la UI). */
function abandonLeague(): void {
  league.value = null;
  persist();
}

/** Config del partido de la jornada del usuario (o null). */
export function startLeagueMatch(): MatchConfig | null {
  const l = league.value;
  if (!l || l.champion !== null) return null;
  return userLeagueMatchConfig(l, (Date.now() ^ 0x5f3759df) >>> 0);
}

/** Registra el partido del usuario (siempre team 0 en el tablero) y simula el resto de la jornada. */
export function recordLeagueResult(score: [number, number]): void {
  const l = league.value;
  if (!l) return;
  const uf = userFixture(l);
  if (!uf) return;
  recordDay(l, [{ index: uf.index, score: [score[0], score[1]] }]);
  persist();
  simLeagueDay();
}

/** Simula los cruces pendientes de la jornada actual. */
function simLeagueDay(): void {
  const l = league.value;
  if (!l || l.champion !== null) return;
  const day = l.fixtures[l.dayIndex];
  if (!day) return;
  for (let i = 0; i < day.length; i++) {
    const f = day[i];
    if (f.played) continue;
    const res = simulateAiMatch({
      home: { teamId: f.a, formation: '2-2' },
      away: { teamId: f.b, formation: '2-2' },
      mode: 'aivsai',
      aiTeam: null,
      aiLevel: l.aiLevel,
      seed: (Date.now() + i * 7717) >>> 0,
      league: true
    });
    recordDay(l, [{ index: i, score: [res.score[0], res.score[1]] }]);
  }
  persist();
}

export function useLeague() {
  return {
    league: computed(() => league.value),
    save: newLeague,
    abandon: abandonLeague,
    days: LEAGUE_DAYS,
    hasState: computed(() => league.value !== null)
  };
}
