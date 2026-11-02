/**
 * Defensa: robos de balón a corta distancia, plantarse a cortar
 * (postura 'cut') y utilidades de presión.
 */
import { PROB, STEAL_RANGE, CUT_RANGE, HACK_RANGE, HARDEN_STEAL_BONUS } from './config';
import { cheby } from './field';
import { carrier, isOccupied } from './rules';
import type { Cell, GameState, Player, SoundName } from './types';

/** Probabilidad (0..100) de robar el balón al portador. */
export function stealChance(state: GameState, defender: Player, victim: Player): number {
  // Defensa endurecida del equipo: robos con bonus mientras dure el turno rival.
  const hardened = state.harden?.[defender.team] ? HARDEN_STEAL_BONUS : 0;
  const raw = 32 + (defender.stats.defense - 5) * 4 - (victim.stats.control - 5) * 4 + hardened;
  return Math.round(Math.max(PROB.stealMin, Math.min(PROB.stealMax, raw)));
}

/** Jugadores rivales a los que se puede intentar robar (barriendo adyacencias). */
export function stealTargets(state: GameState, defender: Player): Player[] {
  const c = carrier(state);
  if (!c || c.team === defender.team) return [];
  if (cheby(defender.pos, c.pos) > STEAL_RANGE) return [];
  return [c];
}

/**
 * Objetivos para plantarse a cortar: el portador rival a chebyshev ≤ 2.
 * No se tira dados: es una postura, no un arranque.
 */
export function cutTargets(state: GameState, defender: Player): Player[] {
  const c = carrier(state);
  if (!c || c.team === defender.team) return [];
  if (cheby(defender.pos, c.pos) > CUT_RANGE) return [];
  return [c];
}

/**
 * Objetivos válidos para el «hachazo» robador: el portador rival a una
 * casilla (como el robo) o a dos SOLO si está en línea recta y nadie se
 * interpone en el camino: a dos en diagonal o con lluvia de encapuchados
 * en medio, el machete no llega.
 */
export function hackTargets(state: GameState, defender: Player): Player[] {
  const c = carrier(state);
  if (!c || c.team === defender.team) return [];
  const dist = cheby(defender.pos, c.pos);
  if (dist > HACK_RANGE) return [];
  if (dist <= STEAL_RANGE) return [c];
  // a 2 casillas: solo en línea recta (misma fila o misma columna) y sin
  // ningún jugador en la casilla intermedia.
  const dx = Math.abs(defender.pos.col - c.pos.col);
  const dy = Math.abs(defender.pos.row - c.pos.row);
  if (dx !== 0 && dy !== 0) return [];
  const mid: Cell = {
    col: (defender.pos.col + c.pos.col) / 2,
    row: (defender.pos.row + c.pos.row) / 2
  };
  if (isOccupied(state, mid)) return [];
  return [c];
}

/** Descripción jugable del efecto de la postura de corte (para la UI). */
export function cutEffectDescription(): string {
  return 'Se planta y tapa: +corte de pases y tiros que pasen por su línea durante el turno rival.';
}

export interface StealResult {
  success: boolean;
  sound: SoundName;
}

/** Resuelve un intento de robo (modifica estado si tiene éxito).
 * `bonus` suma puntos a la probabilidad (hachazo robador). */
export function resolveSteal(
  state: GameState,
  defender: Player,
  victim: Player,
  rng: () => number,
  sound: (n: SoundName) => void,
  bonus = 0
): StealResult {
  const chance = Math.min(PROB.stealMax + 7, stealChance(state, defender, victim) + bonus);
  const success = rng() * 100 < chance;
  if (success) {
    state.ball.carrier = defender.id;
    state.ball.pos = { ...defender.pos };
    state.stats[defender.team].steals += 1;
    sound('steal');
    return { success: true, sound: 'steal' };
  }
  sound('stealFail');
  return { success: false, sound: 'stealFail' };
}

/**
 * ¿Hay algún jugador del equipo dado en postura de corte cerca del punto?
 * Usada por pases y tiros para calcular cortes activos.
 */
export function cuttingDefendersNear(state: GameState, team: 0 | 1, point: Cell, radius: number): number {
  let n = 0;
  for (const p of state.players) {
    if (p.team !== team || p.stance !== 'cut') continue;
    if (cheby(p.pos, point) <= radius) n++;
  }
  return n;
}
