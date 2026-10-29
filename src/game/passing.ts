/**
 * Pases: alcance, probabilidad de éxito y resolución con interceptaciones.
 */
import { PROB, PRESSURE_CAP, passRange } from './config';
import { cheby, distToSegment, clampCell } from './field';
import { pressureAt, enemyOf, teamPlayers, playerById } from './rules';
import type { Cell, GameState, Player, SoundName } from './types';

export interface PassOption {
  targetId: number;
  dist: number;
  chance: number; // 0..100
}

/** Presión enemiga total sobre dos puntos (pase y receptor), cada una con tope. */
function passPressure(state: GameState, from: Cell, to: Cell, enemyTeam: 0 | 1): number {
  // máx. 2 rivales cerca del pasador y 2 cerca del receptor
  const nearFrom = Math.min(pressureAt(state, from, enemyTeam), 2);
  const nearTo = Math.min(pressureAt(state, to, enemyTeam), 2);
  // un rival cerca de la línea media del pase entorpece
  const mid: { col: number; row: number } = { col: (from.col + to.col) / 2, row: (from.row + to.row) / 2 };
  let onLine = 0;
  for (const p of state.players) {
    if (p.team !== enemyTeam) continue;
    const d = Math.max(Math.abs(p.pos.col - mid.col), Math.abs(p.pos.row - mid.row));
    if (d <= 1) onLine++;
    if (onLine >= 2) break;
  }
  return nearFrom * 7 + nearTo * 5 + Math.min(onLine, 2) * 4;
}

/** Probabilidad (0..100) de completar el pase from->to. */
export function passChance(state: GameState, passer: Player, target: Player): number {
  const dist = cheby(passer.pos, target.pos);
  const raw =
    88 -
    (dist - 1) * 5 +
    (passer.stats.pass - 5) * 3 -
    passPressure(state, passer.pos, target.pos, enemyOf(passer.team));
  return Math.round(Math.max(PROB.passMin, Math.min(PROB.passMax, raw)));
}

/** Compañeros receptor válidos, ordenados por dorsal, con % de éxito. */
export function passOptionsFor(state: GameState, passer: Player): PassOption[] {
  const options: PassOption[] = [];
  const maxDist = passRange(passer.stats.pass);
  for (const t of teamPlayers(state, passer.team).filter((p) => p.id !== passer.id)) {
    const dist = cheby(passer.pos, t.pos);
    if (dist > maxDist) continue;
    options.push({ targetId: t.id, dist, chance: passChance(state, passer, t) });
  }
  return options;
}

/** Punto medio de la trayectoria (para dejar el balón en un pase fallido). */
function midpoint(a: Cell, b: Cell): Cell {
  return clampCell({ col: Math.round((a.col + b.col) / 2), row: Math.round((a.row + b.row) / 2) });
}

/** Rival mejor situado para interceptar el pase (a ≤1 casilla de la trayectoria). */
function bestInterceptor(
  state: GameState,
  from: Cell,
  to: Cell,
  enemyTeam: 0 | 1
): { player: Player; chance: number } | null {
  let best: { player: Player; chance: number } | null = null;
  for (const p of state.players) {
    if (p.team !== enemyTeam) continue;
    const d = distToSegment(p.pos, from, to);
    if (d > 1) continue;
    const chance = Math.max(5, 30 + (p.stats.defense - 5) * 4 - d * 15);
    if (!best || chance > best.chance) best = { player: p, chance };
  }
  return best;
}

export interface PassResult {
  success: boolean;
  interceptorId: number | null;
  loosePos: Cell;
  sound: SoundName;
}

/**
 * Resuelve un pase completo (modifica estado: posesión, balón).
 * - Éxito: el receptor toma posesión.
 * - Fallo: puede ser interceptado por un rival cerca de la trayectoria;
 *   si nadie corta, el balón queda suelto en el punto medio del pase.
 */
export function resolvePass(
  state: GameState,
  passer: Player,
  target: Player,
  rng: () => number,
  events: Array<{ type: string; [k: string]: unknown }> | null,
  sound: (n: SoundName) => void
): PassResult {
  void events;
  const chance = passChance(state, passer, target);
  const success = rng() * 100 < chance;
  const from = passer.pos;
  const to = target.pos;

  if (success) {
    sound('pass');
    state.ball.carrier = target.id;
    state.ball.pos = { ...to };
    return { success: true, interceptorId: null, loosePos: to, sound: 'pass' };
  }

  // Fallo: el balón va medio camino. Un rival bien situado puede cortarlo.
  const interceptor = bestInterceptor(state, from, to, enemyOf(passer.team));
  const loose = midpoint(from, to);
  if (interceptor && rng() * 100 < interceptor.chance) {
    sound('passFail');
    state.ball.carrier = interceptor.player.id;
    state.ball.pos = { ...interceptor.player.pos };
    return { success: false, interceptorId: interceptor.player.id, loosePos: interceptor.player.pos, sound: 'passFail' };
  }
  sound('passFail');
  state.ball.carrier = null;
  state.ball.pos = loose;
  return { success: false, interceptorId: null, loosePos: loose, sound: 'passFail' };
}

/** Reutilizable por la IA para valorar el riesgo de pérdida. */
export function passRiskPercent(state: GameState, passer: Player, target: Player): number {
  return 100 - passChance(state, passer, target);
}
