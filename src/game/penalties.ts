/**
 * Desempate por penaltis: el 1v1 jugado sobre el tablero.
 *
 * Por cada lanzamiento: el portero se adelanta primero con 1 PA (un paso
 * por la línea del arco, o se queda); después el lanzador elegido del
 * equipo contrario dispone de 3 PA para moverse por el área y chutar.
 * El lanzamiento cruza por la fila del lanzador: si el portero está en esa
 * fila, su parada pesa mucho. Mata-mata tras la tanda reglamentaria de
 * PENALTY_ROUNDS lanzamientos por equipo.
 *
 * Módulo puro: solo muta el GameState que recibe, sin DOM.
 */
import {
  FIELD_COLS, FIELD_ROWS, GOAL_CENTER_ROW, PENALTY_BASE_CHANCE, PENALTY_KEEPER_AP,
  PENALTY_KEEP_GUESS_PENALTY, PENALTY_ROUNDS, PENALTY_SHOOTER_AP,
  PENALTY_STATS_KEEP, PENALTY_STATS_SHOOT, PENALTY_APPROACH_BONUS
} from './config';
import { attackGoalCol, keeperOf } from './shooting';
import { teamPlayers } from './rules';
import { inField } from './field';
import { reachable, cellKey } from './movement';
import { Stream } from './rng';
import type {
  ActionResult, Cell, GameEvent, GameState, Player, TeamId
} from './types';

function matchLabel(t: TeamId): string {
  return t === 0 ? 'equipo rojo' : 'equipo azul';
}

function enemyTeam(t: TeamId): TeamId {
  return t === 0 ? 1 : 0;
}

function playerOf(state: GameState, id: number | null): Player | null {
  return id === null ? null : state.players.find((p) => p.id === id) ?? null;
}

/**
 * Destinos legales del activo de la tanda (para resaltar casillas):
 * portero: un paso a fila contigua en la misma columna del arco;
 * lanzador: casillas del área al alcance.
 */
export function penaltyMoveTargets(state: GameState): Cell[] {
  if (!penaltyGuard(state).ok || state.ap < 1) return [];
  const activeId = state.penaltyStep === 'keeper' ? state.penaltyKeeperId : state.penaltyShooterId;
  if (activeId === null) return [];
  const p = playerOf(state, activeId);
  if (!p || p.team !== state.currentTeam) return [];
  const free = (c: Cell): boolean =>
    !state.players.some((q) => q.id !== p.id && q.pos.col === c.col && q.pos.row === c.row)
    && !(state.ball.carrier !== null && state.ball.pos.col === c.col && state.ball.pos.row === c.row);
  const out: Cell[] = [];
  if (state.penaltyStep === 'keeper') {
    for (const dr of [-1, 1]) {
      const c: Cell = { col: p.pos.col, row: p.pos.row + dr };
      if (inField(c) && free(c)) out.push(c);
    }
    return out;
  }
  const area = shooterArea(p.team);
  const r = reachable(state, p);
  for (const path of r.paths.values()) {
    const dest = path[path.length - 1];
    if (dest.col < area.min || dest.col > area.max) continue;
    if (!free(dest)) continue;
    out.push(dest);
  }
  return out;
}

/** Casilla del punto de penalty para el equipo que ataca por su lado. */
export function penaltySpot(state: GameState, shooterTeam: TeamId): Cell {
  void state;
  const goalEnd = attackGoalCol(shooterTeam) - 1;
  const dir = shooterTeam === 0 ? -1 : 1;
  return { col: Math.max(0, Math.min(FIELD_COLS - 1, goalEnd + dir * 4)), row: GOAL_CENTER_ROW };
}

/** Casilla donde se planta el portero antes del lanzamiento. */
export function penaltyKeeperCell(state: GameState, shooterTeam: TeamId): Cell {
  void state;
  const col = Math.max(0, Math.min(FIELD_COLS - 1, attackGoalCol(shooterTeam) - 1));
  return { col, row: GOAL_CENTER_ROW };
}

/** Límites de columnas del área donde puede moverse el lanzador. */
function shooterArea(shooterTeam: TeamId): { min: number; max: number } {
  return shooterTeam === 0
    ? { min: FIELD_COLS - 6, max: FIELD_COLS - 2 }
    : { min: 1, max: 5 };
}

/** Lanzador por defecto del equipo: el de mejor tiro que no sea portero. */
export function defaultShooter(state: GameState, team: TeamId): Player {
  const cands = teamPlayers(state, team).filter((p) => p.role !== 'POR');
  let best = cands[0];
  for (const p of cands) if (p.stats.shoot > best.stats.shoot) best = p;
  return best;
}

function sameCell(a: Cell | null, c: Cell): boolean {
  return a !== null && a.col === c.col && a.row === c.row;
}

/**
 * Prepara un lanzamiento: recoloca lanzador, portero y resto de jugadores
 * al banquillo de fila lejana, pone el balón en el punto de penalty y le
 * da la palabra al portero (PENALTY_KEEPER_AP antes del lanzamiento).
 */
export function setupPenaltyKick(state: GameState, shooterTeam: TeamId, events: GameEvent[]): void {
  const shooter = defaultShooter(state, shooterTeam);
  const keeperTeam = enemyTeam(shooterTeam);
  const keeper = keeperOf(state, keeperTeam);
  if (!keeper) throw new Error('Tanda de penaltis sin portero: imposible.');

  const spot = penaltySpot(state, shooterTeam);
  const keeperCell = penaltyKeeperCell(state, shooterTeam);

  // El resto se aparta por las filas exteriores (0 y FIELD_ROWS-1),
  // nunca en el spot ni en la casilla del portero.
  const taken: Cell[] = [spot, keeperCell];
  let i = 0;
  for (const p of state.players) {
    if (p.id === keeper.id || p.id === shooter.id) continue;
    let c: Cell = { col: p.team === 0 ? 0 : FIELD_COLS - 1, row: 0 };
    let tries = 0;
    do {
      const row = tries % 2 === 0 ? 0 : FIELD_ROWS - 1;
      const col = p.team === 0 ? 1 + ((i + Math.floor(tries / 2)) % 4) : FIELD_COLS - 2 - ((i + Math.floor(tries / 2)) % 4);
      c = { col: Math.max(0, Math.min(FIELD_COLS - 1, col)), row };
      tries++;
    } while (taken.some((t) => t.col === c.col && t.row === c.row) && tries < 40);
    taken.push(c);
    p.pos = c;
    i++;
    p.hasMoved = false;
    p.hasActed = false;
    p.stance = 'none';
  }

  shooter.pos = { ...spot };
  keeper.pos = { ...keeperCell };
  shooter.hasMoved = false;
  shooter.hasActed = false;
  shooter.stance = 'none';
  keeper.hasMoved = false;
  keeper.hasActed = false;
  keeper.stance = 'none';

  state.ball = { carrier: shooter.id, pos: { ...spot } };
  state.penaltyShooterId = shooter.id;
  state.penaltyKeeperId = keeper.id;
  state.penaltyStep = 'keeper';
  state.currentTeam = keeperTeam;
  state.ap = PENALTY_KEEPER_AP;

  events.push({ type: 'penalty', shooterId: shooter.id, keeperId: keeper.id, outcome: 'pending' });
  state.message = `Penalti del ${matchLabel(shooterTeam)}: ${shooter.name} contra ${keeper.name}. Primero se adelanta el portero.`;
}

/**
 * Entra en la fase de penaltis: limpia endurecimientos, reinicia contadores
 * y prepara el primer lanzamiento (lanza primero el equipo local).
 */
export function enterPenalties(state: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  state.phase = 'penalti';
  state.penaltyShots = [0, 0];
  state.penaltyKicks = [0, 0];
  state.penaltyWinner = null;
  state.harden = [false, false];
  setupPenaltyKick(state, 0, events);
  events.push({ type: 'sound', name: 'whistle' }); // ¡silbato! a la tanda
  return events;
}

/** Guard genérico de la fase de penaltis. */
export function penaltyGuard(state: GameState): { ok: true } | { ok: false; code: string; message: string } {
  if (state.phase !== 'penalti') {
    return { ok: false, code: 'phase_ended', message: 'No estamos en la tanda de penaltis.' };
  }
  return { ok: true };
}

/**
 * Probabilidad de gol del lanzamiento: tiro del lanzador, reflejos del
 * portero, cercanía a la boca del arco y si el portero está en la fila
 * por la que cruza el lanzamiento.
 */
export function penaltyChance(state: GameState, shooter: Player, keeper: Player): number {
  void state;
  const shotRow = shooter.pos.row;
  const goalEnd = attackGoalCol(shooter.team) - 1;
  const dist = Math.max(Math.abs(goalEnd - shooter.pos.col), Math.abs(GOAL_CENTER_ROW - shotRow));
  let chance = PENALTY_BASE_CHANCE;
  chance += (4 - dist) * PENALTY_APPROACH_BONUS;
  chance += (shooter.stats.shoot - 5) * PENALTY_STATS_SHOOT;
  chance -= (keeper.stats.reflexes - 5) * PENALTY_STATS_KEEP;
  if (keeper.pos.row === shotRow) chance -= PENALTY_KEEP_GUESS_PENALTY;
  return Math.round(Math.max(8, Math.min(92, chance)));
}

/** ¿Está matemáticamente decidida la tanda? Devuelve el ganador o null. */
export function decidedWinner(state: GameState): TeamId | null {
  const sa = state.penaltyShots[0];
  const sb = state.penaltyShots[1];
  const ga = state.penaltyKicks[0];
  const gb = state.penaltyKicks[1];
  const leftA = Math.max(0, PENALTY_ROUNDS - sa);
  const leftB = Math.max(0, PENALTY_ROUNDS - sb);
  if (ga > gb + leftB) return 0;
  if (gb > ga + leftA) return 1;
  if (sa === sb && sa >= PENALTY_ROUNDS && ga !== gb) return ga > gb ? 0 : 1;
  return null;
}

function finishShootout(state: GameState, winner: TeamId, events: GameEvent[]): void {
  state.penaltyWinner = winner;
  state.phase = 'fulltime';
  state.message = `La tanda decide: gana el ${matchLabel(winner)} por penaltis (${state.penaltyKicks[0]}-${state.penaltyKicks[1]}).`;
  events.push({ type: 'fulltime' });
  events.push({ type: 'sound', name: 'fanfare' });
}

/** Registra el desenlace de un lanzamiento y prepara el siguiente. */
function settleKick(state: GameState, events: GameEvent[]): void {
  const shooter = playerOf(state, state.penaltyShooterId);
  const keeper = playerOf(state, state.penaltyKeeperId);
  if (!shooter || !keeper) return;
  const team = shooter.team;
  state.penaltyShots[team] += 1;
  state.penaltyKicks[team] += 1;
  state.score[team] += 1;
  state.message = `¡GOL DE PENALTI de ${shooter.name}!`;
  events.push({ type: 'penalty', shooterId: shooter.id, keeperId: keeper.id, outcome: 'scored' });
  events.push({ type: 'penaltyKick', team, scored: true, decided: false });
  events.push({ type: 'sound', name: 'goal' });

  const winner = decidedWinner(state);
  if (winner !== null) {
    finishShootout(state, winner, events);
    return;
  }
  setupPenaltyKick(state, enemyTeam(team), events);
}

function settleMiss(state: GameState, events: GameEvent[]): void {
  const shooter = playerOf(state, state.penaltyShooterId);
  const keeper = playerOf(state, state.penaltyKeeperId);
  if (!shooter || !keeper) return;
  const team = shooter.team;
  state.penaltyShots[team] += 1;
  state.message = keeper.pos.row === shooter.pos.row
    ? `¡PARADÓN de ${keeper.name}! Adivina la esquina y la tada sigue viva.`
    : `El lanzamiento de ${shooter.name} se pierde.`;
  events.push({ type: 'penalty', shooterId: shooter.id, keeperId: keeper.id, outcome: 'stopped' });
  events.push({ type: 'penaltyKick', team, scored: false, decided: false });
  events.push({ type: 'sound', name: 'save' });
  events.push({ type: 'sound', name: 'groan' }); // el estadio se desploma

  const winner = decidedWinner(state);
  if (winner !== null) {
    finishShootout(state, winner, events);
    return;
  }
  setupPenaltyKick(state, enemyTeam(team), events);
}

/**
 * Paso del portero (o quedarse donde está) antes del lanzamiento: solo
 * un paso en la misma columna de la boca del arco.
 */
export function doPenaltyKeeperMove(state: GameState, keeperId: number, dest: Cell): ActionResult {
  const guard = penaltyGuard(state);
  if (!guard.ok) return { ok: false, code: guard.code, message: guard.message, events: [] };
  const keeper = state.players.find((p) => p.id === keeperId);
  if (!keeper) return { ok: false, code: 'bad_player', message: 'Jugador no encontrado.', events: [] };
  if (state.penaltyStep !== 'keeper' || state.penaltyKeeperId !== keeperId) {
    return { ok: false, code: 'penalty_step', message: 'Ahora no mueve el portero.', events: [] };
  }
  if (state.currentTeam !== keeper.team) {
    return { ok: false, code: 'not_your_turn', message: 'No es el turno de este portero.', events: [] };
  }
  if (state.ap < 1) return { ok: false, code: 'no_ap', message: 'El portero ya no tiene PA.', events: [] };
  const sameCol = dest.col === keeper.pos.col;
  const oneRow = Math.abs(dest.row - keeper.pos.row) === 1;
  if (!sameCol || !oneRow || !inField(dest)) {
    return { ok: false, code: 'penalty_bad_dest', message: 'El guardameta solo da un paso en la línea del arco.', events: [] };
  }
  if (state.ball.carrier !== null && state.ball.pos.col === dest.col && state.ball.pos.row === dest.row) {
    return { ok: false, code: 'penalty_bad_dest', message: 'Ahí está el balón.', events: [] };
  }
  if (state.players.some((p) => p.id !== keeper.id && p.pos.col === dest.col && p.pos.row === dest.row)) {
    return { ok: false, code: 'penalty_bad_dest', message: 'Ahí ya hay un futbolista.', events: [] };
  }
  const from = { ...keeper.pos };
  keeper.pos = { ...dest };
  state.ap -= 1;
  const events: GameEvent[] = [];
  events.push({ type: 'move', playerId: keeper.id, path: [from, keeper.pos], team: keeper.team });
  events.push({ type: 'sound', name: 'move' });
  return { ok: true, message: state.message, events };
}

/** Movimiento del lanzador por el área (1 PA por paso). */
export function doPenaltyShooterMove(state: GameState, playerId: number, dest: Cell): ActionResult {
  const guard = penaltyGuard(state);
  if (!guard.ok) return { ok: false, code: guard.code, message: guard.message, events: [] };
  const shooter = state.players.find((p) => p.id === playerId);
  if (!shooter) return { ok: false, code: 'bad_player', message: 'Jugador no encontrado.', events: [] };
  if (state.penaltyStep !== 'shooter' || state.penaltyShooterId !== playerId) {
    return { ok: false, code: 'penalty_step', message: 'Ahora no mueve el lanzador.', events: [] };
  }
  if (state.currentTeam !== shooter.team) {
    return { ok: false, code: 'not_your_turn', message: 'No es el turno de este equipo.', events: [] };
  }
  if (state.ap < 1) return { ok: false, code: 'no_ap', message: 'Sin PA no hay más pasos.', events: [] };
  const area = shooterArea(shooter.team);
  if (!inField(dest) || dest.col < area.min || dest.col > area.max) {
    return { ok: false, code: 'penalty_bad_dest', message: 'El lanzador solo puede moverse dentro del área.', events: [] };
  }
  if (state.players.some((p) => p.id !== shooter.id && p.pos.col === dest.col && p.pos.row === dest.row)) {
    return { ok: false, code: 'penalty_bad_dest', message: 'Ahí ya hay un futbolista.', events: [] };
  }
  const r = reachable(state, shooter);
  const path = r.paths.get(cellKey(dest));
  if (!path) {
    return { ok: false, code: 'penalty_bad_dest', message: 'Casilla fuera de su alcance.', events: [] };
  }
  void sameCell;
  state.ap -= 1;
  shooter.pos = { ...dest };
  shooter.hasMoved = true;
  state.ball.pos = { ...dest };
  const events: GameEvent[] = [];
  events.push({ type: 'move', playerId: shooter.id, path, team: shooter.team });
  events.push({ type: 'sound', name: 'move' });
  return { ok: true, message: state.message, events };
}

/** Lanzamiento del penalti: cruza por la fila del lanzador. */
export function doPenaltyShot(state: GameState, shooterId: number): ActionResult {
  const guard = penaltyGuard(state);
  if (!guard.ok) return { ok: false, code: guard.code, message: guard.message, events: [] };
  const shooter = state.players.find((p) => p.id === shooterId);
  if (!shooter) return { ok: false, code: 'bad_player', message: 'Jugador no encontrado.', events: [] };
  if (state.penaltyStep !== 'shooter' || state.penaltyShooterId !== shooterId) {
    return { ok: false, code: 'penalty_step', message: 'Ahora no lanza este jugador.', events: [] };
  }
  if (state.currentTeam !== shooter.team) {
    return { ok: false, code: 'not_your_turn', message: 'No es el turno de este equipo.', events: [] };
  }
  if (state.ap < 1) return { ok: false, code: 'no_ap', message: 'Sin PA no hay lanzamiento.', events: [] };
  const keeper = playerOf(state, state.penaltyKeeperId);
  if (!keeper) return { ok: false, code: 'bad_player', message: 'Portero no encontrado.', events: [] };

  state.ap -= 1;
  const chance = penaltyChance(state, shooter, keeper);
  const stream = new Stream(state.rng, (s) => (state.rng = s));
  const roll = stream.next() * 100;
  const events: GameEvent[] = [];
  if (roll < chance) {
    settleKick(state, events);
  } else {
    settleMiss(state, events);
  }
  return { ok: true, message: state.message, events };
}

/** Paso dado por terminado: de portero a lanzador, o lanzamiento no hecho. */
export function advancePenalty(state: GameState): ActionResult {
  const guard = penaltyGuard(state);
  if (!guard.ok) return { ok: false, code: guard.code, message: guard.message, events: [] };
  const events: GameEvent[] = [];
  if (state.penaltyStep === 'keeper') {
    state.penaltyStep = 'shooter';
    const shooter = playerOf(state, state.penaltyShooterId);
    if (!shooter) return { ok: false, code: 'bad_player', message: 'Lanzador no encontrado.', events: [] };
    state.currentTeam = shooter.team;
    state.ap = PENALTY_SHOOTER_AP;
    shooter.hasMoved = false;
    shooter.hasActed = false;
    state.message = `${shooter.name} dispone de ${PENALTY_SHOOTER_AP} PA: a colocar el fusilazo.`;
    events.push({ type: 'sound', name: 'turn' });
    return { ok: true, message: state.message, events };
  }
  // Lanzador sin lanzar: cuenta como fallo (nervios).
  const shooter = playerOf(state, state.penaltyShooterId);
  const keeper = playerOf(state, state.penaltyKeeperId);
  if (!shooter || !keeper) return { ok: false, code: 'bad_player', message: 'Tanda inconsistente.', events: [] };
  state.message = `${shooter.name} no llega a lanzar: se le cuelan los nervios.`;
  settleMiss(state, events);
  return { ok: true, message: state.message, events };
}
