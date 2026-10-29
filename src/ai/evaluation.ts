/**
 * Heurísticas de valoración ya la IA. Todas puras sobre el estado.
 * La IA solo usa información visible: posiciones, balón y atributos.
 */
import { FIELD_COLS, GOAL_CENTER_ROW, KICKOFF_CELL } from '../game/config';
import { cheby, euclid, distToSegment } from '../game/field';
import { pressureAt, enemyOf, playerById } from '../game/rules';
import { passChance } from '../game/passing';
import { readShot, shotTarget } from '../game/shooting';
import type { Cell, GameState, Player, TeamId } from '../game/types';

/** Columna de la portería que ataca el equipo. */
export function goalColOf(team: TeamId): number {
  return team === 0 ? FIELD_COLS : 0;
}

/** Casilla de la portería propia. */
export function ownGoalColOf(team: TeamId): number {
  return team === 0 ? 0 : FIELD_COLS;
}

/** Valor de tener el balón en la casilla cell con el jugador carrier. */
export function attackScore(state: GameState, carrier: Player, cell: Cell): number {
  const goalCol = goalColOf(carrier.team);
  const dx = Math.abs(goalCol - cell.col);
  const dy = Math.abs(cell.row - GOAL_CENTER_ROW);
  const dist = Math.hypot(dx, dy);
  let s = 120 - dist * 9;
  s += Math.max(0, 6 - Math.abs(cell.row - 4)) * 6; // remates centrales
  s -= pressureAt(state, cell, enemyOf(carrier.team)) * 6;
  return s;
}

/**
 * Valor de un pase: lo bonne que queda la posición del receptor menos el
 * riesgo de perder el balón (probabilidad de corte/ajuste).
 */
export function passValue(state: GameState, passer: Player, target: Player): number {
  const chance = passChance(state, passer, target);
  const gain = attackScore(state, target, target.pos);
  const current = attackScore(state, passer, passer.pos);
  const risk = (100 - chance) / 100 * 70;
  return gain + (gain - current) * 0.4 - risk;
}

/** ¿Cuánto peligro hay si el jugador rival con balón dispara? (para defender) */
export function threatOf(state: GameState, enemyCarrier: Player): number {
  return readShot(state, enemyCarrier).goal;
}

/**
 * Puntúa casillas de defensa: entre el balón rival y la portería propia,
 * cerca del portador pero sin amontonarse.
 */
export function defendScore(state: GameState, p: Player, cell: Cell): number {
  const enemy = state.players.find((q) => state.ball.carrier === q.id);
  const goalCol = ownGoalColOf(p.team);
  let s = 50;
  if (enemy) {
    const target = { col: goalCol, row: GOAL_CENTER_ROW };
    const d = distToSegment(cell, enemy.pos, target);
    s -= d * 7; // cortar la línea hacia la portería
    const dBall = cheby(cell, enemy.pos);
    s += Math.max(0, 30 - Math.abs(dBall - 2) * 10); // presionar sin pegarse
  }
  s -= pressureAt(state, cell, enemyOf(p.team)) * 2; // no amontonarse con aliados
  return s;
}

/**
 * Puntúa una casilla para un jugador de apoyo en ataque (sin balón):
 * adelantarse, abrir espacios y ofrecer pasarela.
 */
export function supportScore(state: GameState, p: Player, cell: Cell): number {
  const goalCol = goalColOf(p.team);
  const dx = Math.abs(goalCol - cell.col);
  let s = 90 - dx * 7;
  s += Math.max(0, 4 - Math.abs(cell.row - GOAL_CENTER_ROW)) * 4;
  const carrier = state.ball.carrier !== null ? playerById(state, state.ball.carrier) : null;
  if (carrier) {
    const d = cheby(cell, carrier.pos);
    if (d >= 1 && d <= 4) s += 8; // cercano para recibir
    if (d === 0) s -= 20;
  }
  s -= pressureAt(state, cell, enemyOf(p.team)) * 5;
  // casillas ocupadas tratándose individualmente se evitan antes de puntuar
  return s;
}

/** Distancia euclídea a la portería rival (para elegir quién corre al balón). */
export function distToEnemyGoal(state: GameState, p: Player): number {
  const target = { col: goalColOf(p.team), row: GOAL_CENTER_ROW };
  return euclid(p.pos, target);
}

/** Punto de pantalla del balón respecto a la portería propia (para reordenar). */
export function ballTowardOwnGoal(state: GameState, team: TeamId): Cell {
  const ball = KICKOFF_CELL;
  void ball;
  const t = shotTarget(state, playerById(state, state.ball.carrier ?? state.players[0].id));
  return { col: Math.round((t.col + ownGoalColOf(team)) / 2), row: Math.round(t.row) };
}
