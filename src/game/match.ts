/**
 * Motor del partido: crea el estado y aplica las acciones legales.
 * Este módulo contiene toda la mutación del estado. La UI y la IA solo
 * llaman a estas funciones, que devuelven eventos para animar y sonidos.
 * Módulo puro: sin DOM ni dependencias externas (probable con vitest).
 */
import {
  AP_PER_TURN, COST, MINUTES_PER_TURN, TURNS_PER_HALF, TEAM_COLORS
} from './config';
import { Stream } from './rng';
import {
  commonGuard, carrier, getPlayer, enemyOf, teamPlayers, playerById, isOccupied
} from './rules';
import { reachable, cellKey } from './movement';
import { passOptionsFor, resolvePass, passChance } from './passing';
import { readShot, resolveShot, shotTarget, keeperOf } from './shooting';
import { stealTargets, resolveSteal } from './defense';
import { applyKickoff } from './formations';
import { inField } from './field';
import type {
  ActionResult, Cell, GameEvent, GameState, MatchConfig, Player, SoundName, TeamId
} from './types';

export type ActionKindOfTeam = TeamId;

/** Nombres de equipo para los mensajes. */
export function teamName(state: GameState, t: TeamId): string {
  return t === 0 ? state.config.home.teamId : state.config.away.teamId;
}

function emit(events: GameEvent[], name: SoundName): void {
  events.push({ type: 'sound', name });
}

function log(state: GameState, msg: string): void {
  state.message = msg;
  state.log.push({ min: Math.min(90, state.teamTurns * MINUTES_PER_TURN), msg });
  if (state.log.length > 120) state.log.splice(0, state.log.length - 120);
}

/** Crea una partida completa: 22 jugadores colocados y saque de centro. */
export function createMatch(cfg: MatchConfig): GameState {
  const state: GameState = {
    v: 1,
    config: cfg,
    phase: 'playing',
    currentTeam: 0,
    ap: AP_PER_TURN,
    turnInHalf: 0,
    teamTurns: 0,
    half: 1,
    score: [0, 0],
    players: [],
    ball: { carrier: null, pos: { ...{ col: 7, row: 4 } } },
    message: '',
    log: [],
    stats: [
      { shots: 0, onTarget: 0, possessionTurns: 0, steals: 0 },
      { shots: 0, onTarget: 0, possessionTurns: 0, steals: 0 }
    ],
    rng: cfg.seed >>> 0,
    finishedMinutes: 90
  };
  applyKickoff(state, 0);
  log(state, `¡Comienza el partido! Saque de centro del ${teamLabel(state, 0)}.`);
  return state;
}

/** Etiqueta legible del equipo (nombre del catálogo + color). */
export function teamLabel(state: GameState, t: TeamId): string {
  const name = t === 0 ? state.config.home.teamId : state.config.away.teamId;
  return TEAM_COLORS[t].label;
}

export function teamShort(state: GameState, t: TeamId): string {
  void state;
  return t === 0 ? 'Local' : 'Visitante';
}

/* ------------------------------------------------------------------ */
/* Movimiento                                                          */
/* ------------------------------------------------------------------ */

export function doMove(state: GameState, playerId: number, dest: Cell): ActionResult {
  const p = getPlayer(state, playerId);
  if (!p) return { ok: false, code: 'unknown_player', message: 'Jugador no encontrado.', events: [] };
  const guard = commonGuard(state, p, { needAp: COST.move, moved: true });
  if (!guard.ok) return { ok: false, code: guard.code, message: guard.message, events: [] };
  if (!inField(dest)) return { ok: false, code: 'not_reachable', message: 'Esa casilla está fuera del campo.', events: [] };
  if (isOccupied(state, dest, p.id)) return { ok: false, code: 'occupied', message: 'Ahí ya hay un futbolista.', events: [] };

  const r = reachable(state, p);
  const path = r.paths.get(cellKey(dest));
  if (!path) {
    return { ok: false, code: 'not_reachable', message: 'Ese destino queda fuera de su alcance.', events: [] };
  }

  const events: GameEvent[] = [];
  state.ap -= COST.move;
  p.pos = { ...dest };
  p.hasMoved = true;
  if (state.ball.carrier === p.id) state.ball.pos = { ...dest };
  events.push({ type: 'move', playerId: p.id, path, team: p.team });
  emit(events, 'move');

  // Recoger balón suelto si termina encima de él.
  if (state.ball.carrier === null && state.ball.pos.col === dest.col && state.ball.pos.row === dest.row) {
    state.ball.carrier = p.id;
    events.push({ type: 'pickup', playerId: p.id });
    emit(events, 'pickup');
    log(state, `${p.name} controla el balón.`);
  } else {
    log(state, `${p.name} se mueve.`);
  }
  return { ok: true, message: state.message, events };
}

/* ------------------------------------------------------------------ */
/* Pase                                                                */
/* ------------------------------------------------------------------ */

export function doPass(state: GameState, passerId: number, targetId: number): ActionResult {
  const p = getPlayer(state, passerId);
  const t = getPlayer(state, targetId);
  if (!p || !t) return { ok: false, code: 'unknown_player', message: 'Jugador no encontrado.', events: [] };
  const guard = commonGuard(state, p, { needAp: COST.pass, acted: true });
  if (!guard.ok) return { ok: false, code: guard.code, message: guard.message, events: [] };
  if (state.ball.carrier !== p.id) return { ok: false, code: 'no_ball', message: 'Este futbolista no tiene el balón.', events: [] };
  if (t.team !== p.team || t.id === p.id) return { ok: false, code: 'bad_target', message: 'Debes elegir a un compañero.', events: [] };

  const dist = Math.max(Math.abs(p.pos.col - t.pos.col), Math.abs(p.pos.row - t.pos.row));
  const maxDist = 4 + Math.floor(p.stats.pass / 2);
  if (dist > maxDist) {
    const chanceSnapshot = passOptionsFor(state, p).find((o) => o.targetId === t.id);
    void chanceSnapshot;
    return { ok: false, code: 'too_far', message: `El pase es demasiado largo para su puntuación de pase (máx. ${maxDist} casillas).`, events: [] };
  }

  const events: GameEvent[] = [];
  state.ap -= COST.pass;
  p.hasActed = true;
  const from = { ...p.pos };
  const to = { ...t.pos };
  const stream = new Stream(state.rng, (s) => (state.rng = s));
  const res = resolvePass(state, p, t, stream.next.bind(stream), null, (n) => emit(events, n));
  events.push({
    type: 'pass',
    from,
    to,
    success: res.success,
    midpoint: res.loosePos
  });

  if (res.success) {
    log(state, `Pase correcto de ${p.name} a ${t.name}.`);
  } else if (res.interceptorId !== null) {
    const cut = getPlayer(state, res.interceptorId);
    log(state, cut ? `¡Pase interceptado por ${cut.name}!` : '¡Pase cortado!');
  } else {
    log(state, `¡Pase fallido! El balón queda suelto.`);
  }
  autoCollect(state, events);
  return { ok: true, message: state.message, events };
}

/* ------------------------------------------------------------------ */
/* Disparo                                                             */
/* ------------------------------------------------------------------ */

export function doShoot(state: GameState, shooterId: number): ActionResult {
  const p = getPlayer(state, shooterId);
  if (!p) return { ok: false, code: 'unknown_player', message: 'Jugador no encontrado.', events: [] };
  const guard = commonGuard(state, p, { needAp: COST.shoot, acted: true });
  if (!guard.ok) return { ok: false, code: guard.code, message: guard.message, events: [] };
  if (state.ball.carrier !== p.id) return { ok: false, code: 'no_ball', message: 'Este futbolista no tiene el balón.', events: [] };

  const events: GameEvent[] = [];
  state.ap -= COST.shoot;
  p.hasActed = true;
  const read = readShot(state, p);
  const target = shotTarget(state, p);
  const stream = new Stream(state.rng, (s) => (state.rng = s));
  const res = resolveShot(state, p, stream.next.bind(stream), (n) => emit(events, n));
  events.push({
    type: 'shot',
    shooterId: p.id,
    target,
    outcome: res.outcome,
    ballDest: res.ballDest,
    goal: res.outcome === 'goal'
  });

  switch (res.outcome) {
    case 'goal':
      log(state, `¡GOL del ${teamOfTeamId(shooterTeam(p))}! Disparo de ${p.name}.`);
      events.push({ type: 'goal', team: p.team });
      kickoffAfterGoal(state, enemyOf(p.team), events);
      break;
    case 'save':
      log(state, `¡Parada del portero! Despeja el balón.`);
      break;
    case 'off':
      log(state, `El disparo de ${p.name} se marcha fuera.`);
      break;
    case 'block':
      log(state, `Disparo de ${p.name} bloqueado por la defensa.`);
      break;
    case 'rebound':
      log(state, `¡Rebote peligroso!`);
      break;
  }
  autoCollect(state, events);
  return { ok: true, message: state.message, events };
}

function shooterTeam(p: Player): 0 | 1 {
  return p.team;
}
function teamOfTeamId(t: 0 | 1): string {
  return t === 0 ? 'equipo rojo' : 'equipo azul';
}

/* ------------------------------------------------------------------ */
/* Robo / defensa                                                      */
/* ------------------------------------------------------------------ */

export function doSteal(state: GameState, defenderId: number, victimId: number): ActionResult {
  const d = getPlayer(state, defenderId);
  const v = getPlayer(state, victimId);
  if (!d || !v) return { ok: false, code: 'unknown_player', message: 'Jugador no encontrado.', events: [] };
  const guard = commonGuard(state, d, { needAp: COST.steal, acted: true });
  if (!guard.ok) return { ok: false, code: guard.code, message: guard.message, events: [] };
  if (state.ball.carrier === null) return { ok: false, code: 'no_carrier', message: 'El balón está suelto: corre a por él.', events: [] };
  if (v.team === d.team) return { ok: false, code: 'same_team', message: 'Ese futbolista es de tu equipo.', events: [] };
  if (state.ball.carrier !== v.id) return { ok: false, code: 'no_carrier', message: 'Ese futbolista no tiene el balón.', events: [] };
  const targets = stealTargets(state, d);
  if (!targets.some((t) => t.id === v.id)) {
    return { ok: false, code: 'too_far', message: 'El rival con balón está demasiado lejos para intentar el robo.', events: [] };
  }

  const events: GameEvent[] = [];
  state.ap -= COST.steal;
  d.hasActed = true;
  const stream = new Stream(state.rng, (s) => (state.rng = s));
  const res = resolveSteal(state, d, v, stream.next.bind(stream), (n) => emit(events, n));
  events.push({ type: 'steal', defenderId: d.id, success: res.success });
  if (res.success) {
    log(state, `¡${d.name} roba el balón a ${v.name}!`);
  } else {
    log(state, `${d.name} no logra arrebatar el balón.`);
  }
  return { ok: true, message: state.message, events };
}

/* ------------------------------------------------------------------ */
/* Turnos                                                              */
/* ------------------------------------------------------------------ */

/** Pasa el turno al otro equipo, avanza el reloj y gestiona descanso/final. */
export function endTurn(state: GameState): ActionResult {
  if (state.phase !== 'playing') {
    return { ok: false, code: 'phase_ended', message: 'El partido ha terminado.', events: [] };
  }
  const events: GameEvent[] = [];
  state.stats[state.currentTeam].possessionTurns += 1;
  emit(events, 'turn');

  state.teamTurns += 1;
  state.turnInHalf = (state.turnInHalf + 1) % TURNS_PER_HALF;

  const done = state.teamTurns >= TURNS_PER_HALF * 2;
  const halfTime = !done && state.teamTurns === TURNS_PER_HALF;

  if (done) {
    state.phase = 'fulltime';
    state.finishedMinutes = Math.min(90, state.teamTurns * MINUTES_PER_TURN);
    log(state, `Final del partido: ${resultLabel(state)}.`);
    events.push({ type: 'fulltime' });
    emit(events, 'fulltime');
    return { ok: true, message: state.message, events };
  }

  if (halfTime) {
    state.half = 2;
    // Descanso: saca el equipo que no sacó en el primer acto (el visitante).
    applyKickoff(state, 1);
    state.currentTeam = 1;
    state.ap = AP_PER_TURN;
    state.turnInHalf = 0;
    log(state, `Descanso (${resultLabel(state)}). Comienza la segunda parte, saca el ${teamLabel(state, 1)}.`);
    events.push({ type: 'halftime' });
    events.push({ type: 'reset', team: 1 });
    emit(events, 'kickoff');
    return { ok: true, message: state.message, events };
  }

  state.currentTeam = enemyOf(state.currentTeam);
  state.ap = AP_PER_TURN;
  for (const p of state.players) {
    if (p.team === state.currentTeam) {
      p.hasMoved = false;
      p.hasActed = false;
    }
  }
  log(state, `Turno del ${teamLabel(state, state.currentTeam)}.`);
  events.push({ type: 'turn', team: state.currentTeam });
  return { ok: true, message: state.message, events };
}

/** Marka la posesión del equipo al empezar su turno (estadística). */
export function notePossession(state: GameState): void {
  if (state.phase === 'playing' && state.ball.carrier !== null) {
    const c = carrier(state);
    if (c) state.stats[c.team].possessionTurns += 0; // contador por turno en endTurn
  }
}

/** Tras un gol: recoloca a ambos equipos y saca el equipo que encajó. */
function kickoffAfterGoal(state: GameState, kickTeam: TeamId, events: GameEvent[]): void {
  applyKickoff(state, kickTeam);
  state.currentTeam = kickTeam;
  state.ap = AP_PER_TURN;
  log(state, `Saque de centro del ${teamLabel(state, kickTeam)}. Marcador: ${state.score[0]}-${state.score[1]}.`);
  events.push({ type: 'reset', team: kickTeam });
  emit(events, 'kickoff');
}

/** Etiqueta del resultado parcial para mensajes. */
function resultLabel(state: GameState): string {
  return `${state.score[0]}-${state.score[1]}`;
}

/**
 * Recogida automática: si el balón queda suelto en una casilla con un
 * jugador encima, ese jugador toma posesión (prefiriendo al equipo en posesión del turno).
 */
function autoCollect(state: GameState, events: GameEvent[]): void {
  if (state.ball.carrier !== null) return;
  const onCell = state.players.filter(
    (p) => p.pos.col === state.ball.pos.col && p.pos.row === state.ball.pos.row
  );
  const pick = onCell.find((p) => p.team === state.currentTeam) ?? onCell[0];
  if (pick) {
    state.ball.carrier = pick.id;
    events.push({ type: 'pickup', playerId: pick.id });
    emit(events, 'pickup');
    log(state, `${pick.name} recoge el balón suelto.`);
  }
}

/* ------------------------------------------------------------------ */
/* Consultas para la UI / la IA                                        */
/* ------------------------------------------------------------------ */

export function passOptions(state: GameState, playerId: number) {
  const p = playerById(state, playerId);
  return passOptionsFor(state, p);
}

export function shotRead(state: GameState, playerId: number) {
  const p = playerById(state, playerId);
  return readShot(state, p);
}

export function stealable(state: GameState, defenderId: number): Player[] {
  const p = playerById(state, defenderId);
  return stealTargets(state, p);
}

/** Portero de un equipo (para el panel y la IA). */
export { keeperOf };

/** ¿El balón está junto a (o sobre) el jugador? */
export function hasBall(state: GameState, playerId: number): boolean {
  return state.ball.carrier === playerId;
}
