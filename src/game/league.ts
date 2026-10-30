/**
 * Liga Gañán: torneo de liga a una vuelta con los 8 equipos del catálogo
 * —7 jornadas, 4 partidos por jornada. Lógica pura del calendario y de la
 * tabla; los cruces que no son del usuario se simulan con el mismo motor
 * (IA contra IA, headless). Los empates puntúan 1 punto (sin penaltis).
 */
import { simulateAiMatch } from './cup';
import { TEAMS } from './formations';
import { cupRng } from './cup';
import type { MatchConfig } from './types';

export interface LeagueRow {
  team: string; // id del catálogo
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
}

export interface LeagueState {
  fixtures: Array<Array<{ a: string; b: string; played: boolean; score: [number, number] | null }>>;
  dayIndex: number; // jornada actual
  userTeam: string;
  aiLevel: 'easy' | 'normal' | 'hard';
  champion: string | null;
}

export const LEAGUE_DAYS = 7;
export const LEAGUE_POINTS_WIN = 3;
export const LEAGUE_POINTS_DRAW = 1;

export function emptyRow(team: string): LeagueRow {
  return { team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0 };
}

/**
 * Calendario round-robin de una vuelta para 8 equipos (método del círculo,
 * con el equipo «fantasma» en el índice último).
 */
export function buildFixtures(teamIds: string[]): LeagueState['fixtures'] {
  const n = teamIds.length;
  const ring = teamIds.slice(0, n - 1);
  const fixed = teamIds[n - 1];
  const fixtures: LeagueState['fixtures'] = [];
  for (let round = 0; round < n - 1; round++) {
    const day: LeagueState['fixtures'][number] = [];
    const order = [fixed, ...ring.map((_, k) => ring[(round + k) % ring.length])];
    void order;
    day.push({ a: fixed, b: ring[round % ring.length], played: false, score: null });
    for (let k = 1; k < n / 2; k++) {
      const p1 = ring[(round + k) % ring.length];
      const p2 = ring[(round - k + ring.length * 2) % ring.length];
      day.push({ a: p1, b: p2, played: false, score: null });
    }
    fixtures.push(day);
  }
  return fixtures;
}

/** Crea una liga nueva: calendario barajado y el usuario en su sorteo. */
export function createLeague(userTeam: string, seed: number, aiLevel: 'easy' | 'normal' | 'hard'): LeagueState {
  const ids = TEAMS.map((t) => t.id);
  const rnd = cupRng(seed);
  const shuffled = [...ids].sort(() => rnd() - 0.5); // barajada ligera, la agricultura del círculo hace el resto
  return { fixtures: buildFixtures(shuffled), dayIndex: 0, userTeam, aiLevel, champion: null };
}

/** Nombre visible de un equipo de la liga. */
export function leagueTeamName(teamId: string): string {
  return TEAMS.find((t) => t.id === teamId)?.name ?? teamId;
}

/** Encuentro pendiente del equipo del usuario en la jornada actual. */
export function userFixture(state: LeagueState): { index: number; a: string; b: string } | null {
  const day = state.fixtures[state.dayIndex];
  if (!day) return null;
  const index = day.findIndex((f) => !f.played && (f.a === state.userTeam || f.b === state.userTeam));
  if (index === -1) return null;
  return { index, a: day[index].a, b: day[index].b };
}

/** Atribuye un resultado a las filas de la tabla. */
function applyScore(rows: Map<string, LeagueRow>, a: string, b: string, score: [number, number]): void {
  const ra = rows.get(a)!;
  const rb = rows.get(b)!;
  ra.played += 1; rb.played += 1;
  ra.gf += score[0]; ra.ga += score[1];
  rb.gf += score[1]; rb.ga += score[0];
  if (score[0] > score[1]) { ra.won += 1; rb.lost += 1; }
  else if (score[1] > score[0]) { rb.won += 1; ra.lost += 1; }
  else { ra.drawn += 1; rb.drawn += 1; }
}

/** Filtrado para derribar el estado (solo lectura en la UI): tabla ordenada. */
export function standings(state: LeagueState): LeagueRow[] {
  const rows = new Map<string, LeagueRow>(TEAMS.map((t) => [t.id, emptyRow(t.id)]));
  for (const day of state.fixtures) {
    for (const f of day) {
      if (f.played && f.score) applyScore(rows, f.a, f.b, f.score);
    }
  }
  return [...rows.values()].sort((x, y) => {
    const px = x.won * LEAGUE_POINTS_WIN + x.drawn * LEAGUE_POINTS_DRAW;
    const py = y.won * LEAGUE_POINTS_WIN + y.drawn * LEAGUE_POINTS_DRAW;
    if (px !== py) return py - px;
    const dxx = x.gf - x.ga; const dyy = y.gf - y.ga;
    if (dxx !== dyy) return dyy - dxx;
    if (x.gf !== y.gf) return y.gf - x.gf;
    return leagueTeamName(x.team).localeCompare(leagueTeamName(y.team));
  });
}

/** Puntos de la tabla sin ordenar: para el check del campeón. */
function points(row: LeagueRow): number {
  return row.won * LEAGUE_POINTS_WIN + row.drawn * LEAGUE_POINTS_DRAW;
}

/**
 * Registra la jornada: marca todos los partidos de la jornada con sus
 * marcadores y avanza. Los empates se quedan empatados (liga, no copa).
 */
export function recordDay(state: LeagueState, results: Array<{ index: number; score: [number, number] }>): void {
  const day = state.fixtures[state.dayIndex];
  if (!day) return;
  const rows = new Map<string, LeagueRow>(TEAMS.map((t) => [t.id, emptyRow(t.id)]));
  for (const prevDay of state.fixtures) {
    for (const f of prevDay) {
      if (f.played && f.score) applyScore(rows, f.a, f.b, f.score);
    }
  }
  for (const res of results) {
    const f = day[res.index];
    if (!f || f.played) continue;
    f.played = true;
    f.score = res.score;
    applyScore(rows, f.a, f.b, res.score);
  }
  // ¿Acabó la jornada? Avanza (o proclama campeón si era la 7ª).
  if (day.every((f) => f.played)) {
    if (state.dayIndex >= LEAGUE_DAYS - 1) {
      const table = [...rows.values()];
      const champion = table.sort((x, y) => points(y) - points(x) || (y.gf - y.ga) - (x.gf - x.ga))[0];
      state.champion = champion?.team ?? null;
    } else {
      state.dayIndex = state.dayIndex + 1;
    }
  }
}

/** ¿La jornada ya vaticina al campeón imposible de alcanzar? (lectura UI) */
export function isSeasonOver(state: LeagueState): boolean {
  return state.champion !== null;
}

/** Config de partido para el encuentro del usuario (siempre de rojo). */
export function userLeagueMatchConfig(state: LeagueState, seed: number): MatchConfig | null {
  const uf = userFixture(state);
  if (!uf) return null;
  const rival = uf.a === state.userTeam ? uf.b : uf.a;
  return {
    home: { teamId: state.userTeam, formation: '2-2' },
    away: { teamId: rival, formation: '2-2' },
    mode: 'ai',
    aiTeam: 1,
    aiLevel: state.aiLevel,
    seed,
    league: true
  };
}
