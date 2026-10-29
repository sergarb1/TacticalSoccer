/**
 * Defensa: robos de balón a corta distancia y utilidades de presión.
 */
import { PROB, STEAL_RANGE } from './config';
import { cheby } from './field';
import { enemyOf, carrier } from './rules';
import type { GameState, Player, SoundName } from './types';

/** Probabilidad (0..100) de robar el balón al portador. */
export function stealChance(state: GameState, defender: Player, victim: Player): number {
  void state;
  const raw = 32 + (defender.stats.defense - 5) * 4 - (victim.stats.control - 5) * 4;
  return Math.round(Math.max(PROB.stealMin, Math.min(PROB.stealMax, raw)));
}

/** Jugadores rivales a los que se puede intentar robar (barriendo adyacencias). */
export function stealTargets(state: GameState, defender: Player): Player[] {
  const c = carrier(state);
  if (!c || c.team === defender.team) return [];
  if (cheby(defender.pos, c.pos) > STEAL_RANGE) return [];
  return [c];
}

export interface StealResult {
  success: boolean;
  sound: SoundName;
}

/** Resuelve un intento de robo (modifica estado si tiene éxito). */
export function resolveSteal(
  state: GameState,
  defender: Player,
  victim: Player,
  rng: () => number,
  sound: (n: SoundName) => void
): StealResult {
  void enemyOf;
  const chance = stealChance(state, defender, victim);
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
