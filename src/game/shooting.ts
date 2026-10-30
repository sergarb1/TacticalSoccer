/**
 * Disparos: probabilidad según distancia, ángulo, atributos, presión y
 * portero; resolución en cinco resultados posibles. Incluye los disparos
 * especiales («Tiro Billetes»: cañonazo a distancia; «Vaselina»:
 * golpeo angelado que burla al meta) y el efecto de los defensores que
 * se han plantado a cortar (postura 'cut').
 * Módulo puro: modifica el GameState que recibe y devuelve el desenlace.
 */
import { GOAL_CENTER_ROW, FIELD_COLS, FIELD_ROWS, PRESSURE_CAP, SHOT_LABEL, HARDEN_BLOCK_WEIGHT } from './config';
import { euclid, inField } from './field';
import { enemyOf, isOccupied } from './rules';
import type { Cell, GameState, Player, ShotKind, ShotOutcome, SoundName } from './types';

export interface ShotRead {
  kind: ShotKind;
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

/**
 * Defensores cerca de la línea de tiro (pueden bloquear). Los que están
 * en postura de corte tapan con más radio y más entusiasmo.
 */
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
    const d = Math.hypot(p.pos.col - px, p.pos.row - py);
    const radius = p.stance === 'cut' ? 1.7 : 0.9;
    // Defensa endurecida: tapones con más peso mientras dure el turno rival.
    const weight = (p.stance === 'cut' ? 2.2 : 1) + (state.harden?.[p.team] ? HARDEN_BLOCK_WEIGHT : 0);
    if (d <= radius) n += weight;
    if (n >= 3) break;
  }
  return n;
}

export function keeperOf(state: GameState, team: 0 | 1): Player | undefined {
  return state.players.find((p) => p.team === team && p.role === 'POR');
}

/**
 * Casilla de despeje del portero: una contigua libre elegida al azar.
 * Devuelve null si no hay ninguna (entonces retiene el balón).
 */
function clearDestination(state: GameState, keeper: Player, rng: () => number): Cell | null {
  const ownGoalCol = keeper.team === 0 ? 0 : FIELD_COLS;
  const candidates: Cell[] = [];
  for (let dc = -1; dc <= 1; dc++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (dc === 0 && dr === 0) continue;
      const c = { col: keeper.pos.col + dc, row: keeper.pos.row + dr };
      if (inField(c) && !isOccupied(state, c) && Math.abs(c.col - ownGoalCol) > 0.5) {
        candidates.push(c);
      }
    }
  }
  if (candidates.length === 0) return null;
  const idx = Math.floor(rng() * candidates.length) % candidates.length;
  return candidates[idx];
}

/**
 * Lectura de la jugada de tiro, para la previsualización de la UI y la IA.
 * Cada ShotKind tiene su propio talonario de probabilidades:
 * - normal: el tiro de toda la vida.
 * - billetes: cañonazo; la distancia pesa la mitad, pero fuera es un disparate.
 * - vaselina: golpeo con ángulo fino; la vaselina casi no penaliza por
 *   esquina y al portero la sufre, pero necesita más espacio libre.
 */
export function readShot(state: GameState, shooter: Player, kind: ShotKind = 'normal'): ShotRead {
  const target = shotTarget(state, shooter);
  const dist = euclid(shooter.pos, target);
  const dx = Math.abs(target.col - shooter.pos.col);
  const anglePenalty = Math.min(34, (Math.abs(shooter.pos.row - GOAL_CENTER_ROW) / Math.max(1, dx)) * 60);
  const pressure = shootingPressure(state, shooter) * 4;
  const rawBlock = blockersOnLine(state, shooter, target);

  const keeper = keeperOf(state, enemyOf(shooter.team));
  const reflex = keeper ? keeper.stats.reflexes : 5;

  let goal: number;
  let off: number;
  const block = Math.round(Math.min(30, rawBlock * 8));

  switch (kind) {
    case 'billetes': {
      // El Billetes es un cañonazo de media/larga: de cerca es tirar dinero,
      // y lejos la factura de fuera se dispara. La distancia le pesa poco.
      const distTerm = dist * 2.4;
      goal = 48 - distTerm + (shooter.stats.shoot - 5) * 2.5 - anglePenalty * 0.4 - pressure * 0.9 - (reflex - 5) * 1.6;
      goal = Math.max(6, Math.min(88, goal));
      off = 14 + Math.max(0, dist - 2) * 2.4 - (shooter.stats.shoot - 5) * 1.4 + anglePenalty * 0.5;
      off = Math.max(5, Math.min(55, Math.round(off)));
      break;
    }
    case 'vaselina': {
      // La vaselina se basa en el ángulo y en que el portero no llega: de
      // frente y de lejos no justifica sus 2 AP.
      goal = 71 - dist * 8 + (shooter.stats.shoot - 5) * 5 - anglePenalty * 0.25 - pressure * 1.7 - (reflex - 5) * 1.6;
      goal = Math.max(3, Math.min(80, goal));
      off = 3 + Math.max(0, dist - 2) * 1.05 - (shooter.stats.shoot - 5) * 1.05 + anglePenalty * 0.3;
      off = Math.max(2, Math.min(28, Math.round(off)));
      break;
    }
    default: {
      goal = 80 - dist * 10 + (shooter.stats.shoot - 5) * 4.5 - anglePenalty * 0.7 - pressure - (reflex - 5) * 2.2;
      goal = Math.max(3, Math.min(82, goal));
      off = Math.round(Math.max(4, Math.min(30, 6 + Math.max(0, dist - 2) * 1.6 - (shooter.stats.shoot - 5) * 0.8 + anglePenalty * 0.5)));
      break;
    }
  }
  const save = Math.max(0, 100 - Math.round(goal) - Math.round(off) - block); // restante

  return {
    kind,
    goal: Math.round(goal),
    save,
    block,
    off,
    dist: Math.round(dist * 10) / 10,
    anglePenalty: Math.round(anglePenalty),
    description: shotHint(kind, goal, dist, anglePenalty)
  };
}

function shotHint(kind: ShotKind, goalP: number, dist: number, anglePenalty: number): string {
  switch (kind) {
    case 'billetes':
      if (goalP >= 38) return '¡Cañonazo con sello! A cobrarla si entra.';
      if (dist > 6) return 'El Tiro Billetes no teme a la distancia.';
      return 'Billetes de cerca: puro despilfarro.';
    case 'vaselina':
      if (goalP >= 45) return '¡Vaselina de manual! El portero sufre.';
      if (anglePenalty > 18) return 'Vaselina aquí hace milagros con el ángulo.';
      return 'Vaselina: bonita, pero quitando cormos.';
    default:
      break;
  }
  if (goalP >= 55) return '¡Oportunidad clarísima!';
  if (goalP >= 35) return 'Buena ocasión de gol.';
  if (goalP >= 18) return 'Disparo arriesgado.';
  if (dist > 7 && anglePenalty > 20) return 'Muy lejos y en mala posición.';
  return 'Casi imposible de marcar.';
}

export function shotLabel(kind: ShotKind): string {
  return SHOT_LABEL[kind];
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
 * - Rebote: reservado para reglas futuras; el roll no cae aquí.
 */
export function resolveShot(
  state: GameState,
  shooter: Player,
  kind: ShotKind,
  rng: () => number,
  sound: (n: SoundName) => void
): ShotResult {
  const read = readShot(state, shooter, kind);
  const target = shotTarget(state, shooter);
  const roll = rng() * 100;
  const soundShot: SoundName = kind === 'normal' ? 'shot' : 'shotSpecial';

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
      // 38%: el portero despeja a una casilla contigua libre; si no, retiene.
      const dest = rng() < 0.38 ? clearDestination(state, keeper, rng) : null;
      if (dest) {
        state.ball.carrier = null;
        state.ball.pos = dest;
      } else {
        state.ball.carrier = keeper.id;
        state.ball.pos = { ...keeper.pos };
      }
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
    // Un defensor en postura de corte, en el radio del impacto, es el primero en atraparla.
    let taker: Player | null = null;
    let bestD = 2;
    for (const p of state.players) {
      if (p.team === shooter.team) continue;
      const d = Math.hypot(p.pos.col - dest.col, p.pos.row - dest.row);
      const reach = p.stance === 'cut' ? 1.4 : 1;
      if (d <= reach && d < bestD) {
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
    sound(soundShot);
    return { outcome: 'block', ballDest: dest, newCarrierId: taker?.id ?? null, sound: soundShot };
  }

  // Fuera: saque de meta simplificado -> portero rival
  state.stats[shooter.team].shots += 1;
  const keeper = keeperOf(state, enemyOf(shooter.team));
  if (keeper) {
    state.ball.carrier = keeper.id;
    state.ball.pos = { ...keeper.pos };
  }
  sound(soundShot);
  return { outcome: 'off', ballDest: keeper?.pos ?? null, newCarrierId: keeper?.id ?? null, sound: soundShot };
}
