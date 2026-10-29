/**
 * Reglas transversales: legalidad de acciones, presión y utilidades.
 * Módulo puro: todas las funciones reciben y devuelven datos.
 */
import { COST, PRESSURE_RADIUS, PRESSURE_CAP, fatigueLevels, moveRange } from './config';
import { cheby } from './field';
import type { Cell, GameState, Player } from './types';

export function getPlayer(state: GameState, id: number): Player | undefined {
  return state.players.find((p) => p.id === id);
}

export function playerById(state: GameState, id: number): Player {
  const p = getPlayer(state, id);
  if (!p) throw new Error(`Jugador desconocido: ${id}`);
  return p;
}

export function carrier(state: GameState): Player | null {
  if (state.ball.carrier === null) return null;
  const c = getPlayer(state, state.ball.carrier);
  return c ?? null;
}

export function teamOf(p: Player): 0 | 1 {
  return p.team;
}

/** ¿Es el turno del equipo de este jugador y el partido sigue en juego? */
export function isTurnOf(state: GameState, p: Player): boolean {
  return state.phase === 'playing' && p.team === state.currentTeam;
}

/** Comprobaciones genéricas antes de cualquier acción. */
export function commonGuard(
  state: GameState,
  p: Player,
  opts: { needAp: number; moved?: boolean; acted?: boolean }
): { ok: true } | { ok: false; code: string; message: string } {
  if (state.phase !== 'playing') return { ok: false, code: 'phase_ended', message: 'El partido ha terminado.' };
  if (p.team !== state.currentTeam) return { ok: false, code: 'not_your_turn', message: 'No es el turno de este equipo.' };
  if (state.ap < opts.needAp) return { ok: false, code: 'no_ap', message: 'No tienes suficientes puntos de acción.' };
  if (opts.moved && p.hasMoved) return { ok: false, code: 'already_moved', message: 'Este jugador ya se ha movido este turno.' };
  if (opts.acted && p.hasActed) return { ok: false, code: 'already_acted', message: 'Este jugador ya ha actuado este turno.' };
  return { ok: true };
}

/**
 * Niveles de fatiga de un jugador en el minuto actual (0..2).
 * Usado por movimiento para recortar el alcance en partidos largos.
 */
export function fatigueOf(p: Player, state: GameState): number {
  return fatigueLevels(p.stats.stamina, state.teamTurns);
}

/** Alcance de movimiento efectivo de un jugador (con o sin balón, con fatiga). */
export function effectiveMoveRange(p: Player, state: GameState): number {
  const carrying = state.ball.carrier === p.id;
  return moveRange(p.stats.speed, carrying, fatigueOf(p, state));
}

/**
 * Presión enemiga sobre una casilla: número de rivales a chebyshev ≤ 2,
 * limitado a PRESSURE_CAP para no hacer las acciones imposibles.
 */
export function pressureAt(state: GameState, cell: Cell, enemyTeam: 0 | 1): number {
  let n = 0;
  for (const p of state.players) {
    if (p.team !== enemyTeam) continue;
    if (cheby(p.pos, cell) <= PRESSURE_RADIUS) n++;
    if (n >= PRESSURE_CAP) break;
  }
  return Math.min(n, PRESSURE_CAP);
}

export function enemyOf(team: 0 | 1): 0 | 1 {
  return team === 0 ? 1 : 0;
}

/** Jugadores de un equipo, ordenados por dorsal. */
export function teamPlayers(state: GameState, team: 0 | 1): Player[] {
  return state.players.filter((p) => p.team === team).sort((a, b) => a.num - b.num);
}

/** ¿Casilla ocupada por algún jugador (distinto del dado)? */
export function isOccupied(state: GameState, cell: Cell, exceptId?: number): boolean {
  return state.players.some((p) => p.id !== exceptId && p.pos.col === cell.col && p.pos.row === cell.row);
}

export const COSTS = COST;
