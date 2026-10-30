/**
 * Estrategia de la IA: decide la siguiente acción del equipo sin DOM.
 * Basada en puntuaciones heurísticas (ataque, defensa, riesgo y apoyo),
 * parametrizada por el nivel de dificultad. Solo usa el estado visible.
 */
import { DIFFICULTY } from './difficulty';
import {
  attackScore, passValue, defendScore, supportScore, goalColOf
} from './evaluation';
import { reachable } from '../game/movement';
import { passOptionsFor } from '../game/passing';
import { readShot } from '../game/shooting';
import { stealTargets, stealChance, hackTargets } from '../game/defense';
import { HACK_BONUS, STEAL_RANGE } from '../game/config';
import { carrier, teamPlayers } from '../game/rules';
import { cheby } from '../game/field';
import type { AiLevel } from '../game/types';
import type { Cell, GameState } from '../game/types';
import type { DifficultyProfile } from './difficulty';

export type AiDecision =
  | { kind: 'move'; playerId: number; dest: Cell }
  | { kind: 'pass'; playerId: number; targetId: number }
  | { kind: 'shoot'; playerId: number; shotKind?: 'normal' | 'billetes' | 'vaselina' }
  | { kind: 'hack'; playerId: number; victimId: number }
  | { kind: 'steal'; playerId: number; victimId: number }
  | null;

function rand(state: GameState): number {
  // tirada ligada al rng del estado: determinista y sin ventajas ocultas
  const s = state.rng;
  state.rng = (s * 1664525 + 1013904223) >>> 0;
  return ((state.rng >>> 8) % 1000) / 1000;
}

/** Decide la siguiente acción del equipo actual (si es el equipo de la IA). */
export function nextAiAction(state: GameState): AiDecision {
  if (state.phase !== 'playing') return null;
  const team = state.currentTeam;
  if (state.config.mode !== 'ai' || state.config.aiTeam !== team) return null;
  if (state.ap <= 0) return null; // sin AP no hay ninguna acción posible
  const prof = DIFFICULTY[state.config.aiLevel as AiLevel];
  const jitter = () => rand(state) * prof.jitter;

  const players = teamPlayers(state, team).filter((p) => !p.hasMoved || !p.hasActed);
  const c = carrier(state);

  /* ---------------- balón suelto ---------------- */
  if (!c) {
    const candidates = players.filter((p) => !p.hasMoved && !p.hasActed);
    const sorted = candidates
      .map((p) => ({ p, d: cheby(p.pos, state.ball.pos) }))
      .sort((a, b) => a.d - b.d);
    for (const { p } of sorted.slice(0, 2)) {
      const r = reachable(state, p);
      let best: { dest: Cell; d: number } | null = null;
      for (const path of r.paths.values()) {
        const dest = path[path.length - 1];
        const d = cheby(dest, state.ball.pos);
        if (!best || d < best.d) best = { dest, d };
      }
      if (best && best.d < cheby(p.pos, state.ball.pos)) {
        return { kind: 'move', playerId: p.id, dest: best.dest };
      }
    }
    return null; // nadie mejora: la UI llamará a endTurn
  }

  /* ---------------- tenemos el balón ---------------- */
  if (c.team === team) {
    // 1) disparar si la ocasión es buena; con 2 AP y distancia larga, si el
    //    normal no llega pero el Tiro Billetes sí, se saca la cartera.
    if (!c.hasActed && state.ap > 0) {
      const read = readShot(state, c);
      if (read.goal >= prof.shootThreshold) return { kind: 'shoot', playerId: c.id };
      if (state.ap >= 2 && state.specials[team] > 0) {
        // Vaselina cuando el ángulo la rescata (el tiro normal se hunde).
        const vaselina = readShot(state, c, 'vaselina');
        if (vaselina.dist <= 6 && vaselina.goal >= 30 && vaselina.goal >= read.goal + 12) {
          return { kind: 'shoot', playerId: c.id, shotKind: 'vaselina' };
        }
        const billetes = readShot(state, c, 'billetes');
        if (billetes.dist >= 5.5 && billetes.goal >= prof.shootThreshold * 0.8) {
          return { kind: 'shoot', playerId: c.id, shotKind: 'billetes' };
        }
      }
    }
    // 2) mejor pase posible si mejora la posición y el riesgo compensa
    if (!c.hasActed && state.ap > 0) {
      const options = passOptionsFor(state, c);
      let bestPass: { targetId: number; value: number } | null = null;
      for (const o of options) {
        const t = state.players.find((p) => p.id === o.targetId)!;
        if (100 - o.chance > prof.riskAversion * 100) continue; // pase demasiado arriesgado
        const v = passValue(state, c, t) + jitter();
        if (!bestPass || v > bestPass.value) bestPass = { targetId: o.targetId, value: v };
      }
      const stay = attackScore(state, c, c.pos);
      if (bestPass && bestPass.value > stay + prof.passImprovement) {
        return { kind: 'pass', playerId: c.id, targetId: bestPass.targetId };
      }
    }
    // 3) mover al portador hacia el arco
    if (!c.hasMoved && state.ap > 0) {
      const r = reachable(state, c);
      let best: { dest: Cell; score: number } | null = null;
      for (const path of r.paths.values()) {
        const dest = path[path.length - 1];
        const s = attackScore(state, c, dest) + jitter();
        if (!best || s > best.score) best = { dest, score: s };
      }
      if (best && best.score > attackScore(state, c, c.pos) + prof.moveImprovement) {
        return { kind: 'move', playerId: c.id, dest: best.dest };
      }
    }
    // 4) apoyos y (¡sorpresa!) media retirada según sea menester
    if (state.ap > 0 && prof.supportMoves > 0) {
      const move = pickSupportMove(state, team, prof);
      if (move) return move;
    }
    return null;
  }

  /* ---------------- el rival tiene el balón ---------------- */
  if (state.ap > 0) {
    // 1) robo al portador adyacente si el margen compensa; si el robo
    //    normal no compensa pero el hachazo sí, se gasta la especial.
    let bestSteal: { id: number; victim: number; chance: number } | null = null;
    let bestHack: { id: number; victim: number; chance: number } | null = null;
    const canSpecial = state.specials[team] > 0;
    for (const p of players.filter((q) => !q.hasActed && !q.hasMoved)) {
      for (const v of stealTargets(state, p)) {
        const chance = stealChance(state, p, v);
        if (!bestSteal || chance > bestSteal.chance) {
          bestSteal = { id: p.id, victim: v.id, chance };
        }
        if (canSpecial) {
          const hc = stealChance(state, p, v) + HACK_BONUS;
          if (!bestHack || hc > bestHack.chance) bestHack = { id: p.id, victim: v.id, chance: hc };
        }
      }
      if (canSpecial) {
        for (const v of hackTargets(state, p)) {
          if (cheby(p.pos, v.pos) <= STEAL_RANGE) continue; // esos ya salen en el robo normal
          const hc = stealChance(state, p, v) + HACK_BONUS;
          if (!bestHack || hc > bestHack.chance) bestHack = { id: p.id, victim: v.id, chance: hc };
        }
      }
    }
    if (bestSteal && bestSteal.chance >= prof.stealThreshold) {
      return { kind: 'steal', playerId: bestSteal.id, victimId: bestSteal.victim };
    }
    if (
      bestHack &&
      bestHack.chance >= prof.stealThreshold + 10 &&
      (!bestSteal || bestSteal.chance < bestHack.chance - 10)
    ) {
      return { kind: 'hack', playerId: bestHack.id, victimId: bestHack.victim };
    }
    // 2) reubicación defensiva (tápeta entre el balón y mi portería)
    if (prof.positionalIQ) {
      const move = pickDefensiveMove(state, team, prof);
      if (move) return move;
    }
  }
  return null;
}

/** Mueve al mejor candidato de apoyo a su casilla de mayor valor. */
function pickSupportMove(
  state: GameState,
  team: 0 | 1,
  prof: DifficultyProfile
): { kind: 'move'; playerId: number; dest: Cell } | null {
  if (prof.supportMoves <= 0) return null;
  const candidates = teamPlayers(state, team).filter(
    (p) => !p.hasMoved && !p.hasActed && state.ball.carrier !== p.id
  );
  let best: { id: number; dest: Cell; gain: number } | null = null;
  for (const p of candidates) {
    const r = reachable(state, p);
    for (const path of r.paths.values()) {
      const dest = path[path.length - 1];
      const s = supportScore(state, p, dest) + defendScore(state, p, dest) * 0.3;
      const gain = s - supportScore(state, p, p.pos);
      if (!best || gain > best.gain) best = { id: p.id, dest, gain };
    }
  }
  if (best && best.gain > 4) return { kind: 'move', playerId: best.id, dest: best.dest };
  return null;
}

/** Coloca jugadores entre el balón rival y la portería propia. */
function pickDefensiveMove(
  state: GameState,
  team: 0 | 1,
  prof: DifficultyProfile
): { kind: 'move'; playerId: number; dest: Cell } | null {
  const candidates = teamPlayers(state, team).filter(
    (p) => !p.hasMoved && !p.hasActed && p.role !== 'POR'
  );
  let best: { id: number; dest: Cell; gain: number } | null = null;
  for (const p of candidates.slice(0, 6)) {
    const r = reachable(state, p);
    for (const path of r.paths.values()) {
      const dest = path[path.length - 1];
      const s = defendScore(state, p, dest) + rand(state) * prof.jitter;
      const gain = s - defendScore(state, p, p.pos);
      if (!best || gain > best.gain) best = { id: p.id, dest, gain };
    }
  }
  if (best && best.gain > 5) return { kind: 'move', playerId: best.id, dest: best.dest };
  return null;
}

export { goalColOf };
