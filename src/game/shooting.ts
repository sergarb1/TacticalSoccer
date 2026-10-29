/**
 * Disparos: probabilidad según distancia, ángulo, atributos, presión y
 * portero; resolución en cinco resultados posibles.
 * Módulo puro: modifica el GameState que recibe y devuelve el desenlace.
 */
import { GOAL_CENTER_ROW, FIELD_COLS, FIELD_ROWS, PRESSURE_CAP } from './config';
import { euclid } from './field';
import { enemyOf } from './rules';
import type { Cell, GameState, Player, ShotOutcome, SoundName } from './types';

export interface ShotRead {
  goal: number; // 0..100
  save: number;
  block: number;
  off: number;
  dist: number;
  anglePenalty: number;
  description: string;
}

/** Columna objetivo del arco rival para un equipo. */
export function attackGoalCol(team: 0 | 1): number {
  return team === 0 ? FIELD_COLS : 0;
}

/** Punto objetivo del disparo: centro de la boca del arco rival. */
export function shotTarget(state: GameState, shooter: Player): Cell {
  void state;
  return { col: attackGoalCol(shooter.team), row: GOAL_CENTER_ROW };
}

/** Rival a ≤1.5 casillas del tirador (presión al disparar), con tope. */
function shootingPressure(state: GameState, shooter: Player): number {
  let n = 0;
  for (const p of state.players) {
    if (p.team === shooter.team) continue;
    if (euclid(p.pos, shooter.pos) <= 1.5) n++;
    if (n >= PRESSURE_CAP) break;
  }
  return n;
}

/** Defensores de campo cerca de la línea de tiro (pueden bloquear). */
function blockersOnLine(state: GameState, shooter: Player, target: Cell): number {
  let n = 0;
  for (const p of state.players) {
    if (p.team === shooter.team || p.role === 'POR') continue;
    const vx = target.col - shooter.pos.col;
    const vy = target.row - shooter.pos.row;
    const len2 = vx * vx + vy * vy;
    if (len2 === 0) continue;
    let t = ((p.pos.col - shooter.pos.col) * vx + (p.pos.row - shooter.pos.row) * vy) / len2;
    if (t <= 0.05 || t >= 0.95) continue;
    const px = shooter.pos.col + t * vx;
    const py = shooter.pos.row + t * vy;
    if (Math.hypot(p.pos.col - px, p.pos.row - py) <= 0.9) n++;
    if (n >= 2) break;
  }
  return n;
}

export function keeperOf(state: GameState, team: 0 | 1): Player | undefined {
  return state.players.find((p) => p.team === team && p.role === 'POR');
}

/** Lectura de la jugada de tiro, para la previsualización de la UI y la IA. */
export function readShot(state: GameState, shooter: Player): ShotRead {
  const target = shotTarget(state, shooter);
  const dist = euclid(shooter.pos, target);
  const dx = Math.abs(target.col - shooter.pos.col);
  const anglePenalty = Math.min(34, (Math.abs(shooter.pos.row - GOAL_CENTER_ROW) / Math.max(1, dx)) * 60);
  const pressure = shootingPressure(state, shooter) * 4;
  const block = Math.round(Math.min(22, blockersOnLine(state, shooter, target) * 8));

  const keeper = keeperOf(state, enemyOf(shooter.team));
  const reflex = keeper ? keeper.stats.reflexes : 5;

  let goal = 80 - dist * 10 + (shooter.stats.shoot - 5) * 4.5 - anglePenalty * 0.7 - pressure - (reflex - 5) * 2.2;
  goal = Math.max(3, Math.min(82, goal));
  const off = Math.round(Math.max(4, Math.min(30, 6 + Math.max(0, dist - 2) * 1.6 - (shooter.stats.shoot - 5) * 0.8 + anglePenalty * 0.5)));
  const save = Math.max(0, 100 - Math.round(goal) - off - block); // restante

  return {
    goal: Math.round(goal),
    save,
    block,
    off,
    dist: Math.round(dist * 10) / 10,
    anglePenalty: Math.round(anglePenalty),
    description: shotHint(goal, dist, anglePenalty)
  };
}

function shotHint(goalP: number, dist: number, anglePenalty: number): string {
  if (goalP >= 55) return '¡Oportunidad clarísima!';
  if (goalP >= 35) return 'Buena ocasión de gol.';
  if (goalP >= 18) return 'Disparo arriesgado.';
  if (dist > 7 && anglePenalty > 20) return 'Muy lejos y en mala posición.';
  return 'Casi imposible de marcar.';
}

export interface ShotResult {
  outcome: ShotOutcome;
  /** Casilla donde queda el balón tras el disparo (si procede). */
  ballDest: Cell | null;
  /** Jugador que recupera la posesión, si el resultado otorga balón. */
  newCarrierId: number | null;
  sound: SoundName;
}

/**
 * Resuelve un disparo completo.
 * - Gol: suma al marcador (el reinicio del saque lo hace match.ts).
 * - Parada o fuera: balón para el portero rival (saque de meta simplificado).
 * - Bloqueado: balón a dos casillas del tirador hacia el arco; el defensor
 *   más cercano (≤1 casilla) lo atrapa, si no queda suelto.
 * - Rebote: reservado para reglas futuras; en v1 el roll no cae aquí.
 */
export function resolveShot(
  state: GameState,
  shooter: Player,
  rng: () => number,
  sound: (n: SoundName) => void
): ShotResult {
  const read = readShot(state, shooter);
  const target = shotTarget(state, shooter);
  const roll = rng() * 100;

  let acc = read.goal;
  if (roll < acc) {
    state.score[shooter.team] += 1;
    state.stats[shooter.team].shots += 1;
    state.stats[shooter.team].onTarget += 1;
    sound('goal');
    return { outcome: 'goal', ballDest: target, newCarrierId: null, sound: 'goal' };
  }

  acc += read.save;
  if (roll < acc) {
    state.stats[shooter.team].shots += 1;
    state.stats[shooter.team].onTarget += 1;
    const keeper = keeperOf(state, enemyOf(shooter.team));
    if (keeper) {
      state.ball.carrier = keeper.id;
      state.ball.pos = { ...keeper.pos };
    } else {
      state.ball.carrier = null;
      state.ball.pos = { col: target.col === FIELD_COLS ? FIELD_COLS - 1 : 1, row: GOAL_CENTER_ROW };
    }
    sound('save');
    return { outcome: 'save', ballDest: state.ball.pos, newCarrierId: keeper?.id ?? null, sound: 'save' };
  }

  acc += read.block;
  if (roll < acc) {
    state.stats[shooter.team].shots += 1;
    const dirCol = Math.sign(target.col - shooter.pos.col) || 1;
    const dirRow = Math.sign(target.row - shooter.pos.row) || 0;
    const dest: Cell = {
      col: Math.max(0, Math.min(FIELD_COLS - 1, shooter.pos.col + dirCol * 2)),
      row: Math.max(0, Math.min(FIELD_ROWS - 1, shooter.pos.row + dirRow))
    };
    let taker: Player | null = null;
    let bestD = 2;
    for (const p of state.players) {
      if (p.team === shooter.team) continue;
      const d = Math.hypot(p.pos.col - dest.col, p.pos.row - dest.row);
      if (d <= 1 && d < bestD) {
        taker = p;
        bestD = d;
      }
    }
    if (taker) {
      state.ball.carrier = taker.id;
      state.ball.pos = { ...taker.pos };
    } else {
      state.ball.carrier = null;
      state.ball.pos = dest;
    }
    sound('shot');
    return { outcome: 'block', ballDest: dest, newCarrierId: taker?.id ?? null, sound: 'shot' };
  }

  // Fuera: saque de meta simplificado -> portero rival
  state.stats[shooter.team].shots += 1;
  const keeper = keeperOf(state, enemyOf(shooter.team));
  if (keeper) {
    state.ball.carrier = keeper.id;
    state.ball.pos = { ...keeper.pos };
  }
  sound('shot');
  return { outcome: 'off', ballDest: keeper?.pos ?? null, newCarrierId: keeper?.id ?? null, sound: 'shot' };
}
