/**
 * Copa Capello: torneo de eliminación directa con 8 equipos — cuartos,
 * semifinales y final. Lógica pura del bracket y simulador de partidos
 * cabeza abajo (la IA juega por los dos lados, sin DOM).
 *
 * Empates en el torneo: tanda de penaltis 1v1 con el mismo motor; en los
 * partidos simulados resuelve con IA y en los del jugador se juegan en el
 * tablero (config.cup + fase 'penalti').
 */
import { createMatch, doMove, doPass, doShoot, doSteal, doHack, doHarden, endTurn } from './match';
import {
  enterPenalties, doPenaltyKeeperMove, doPenaltyShooterMove, doPenaltyShot, advancePenalty
} from './penalties';
import { nextAiAction, nextAiPenaltyAction } from '../ai/strategy';
import { FORMATIONS, TEAMS } from './formations';
import type { AiLevel, MatchConfig, Phase, TeamId } from './types';

export type CupRoundName = 'Cuartos' | 'Semifinales' | 'Final';

export interface CupPair {
  a: string; // id de equipo
  b: string;
  winner: string | null;
  /** Marcador del encuentro terminado. */
  score: [number, number];
  /** Goles de la tanda de penaltis, si hubo. */
  pens: [number, number] | null;
}

export interface CupState {
  teams: string[]; // 8 ids del catálogo
  userTeam: string;
  roundIndex: 0 | 1 | 2; // 0 cuartos, 1 semis, 2 final
  rounds: CupPair[][];
  champion: string | null;
}

export const ROUND_NAMES: CupRoundName[] = ['Cuartos', 'Semifinales', 'Final'];

/** Generador determinista pequeño (LCG) para barajar y arbitrages. */
export function cupRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function shuffleWith<T>(items: T[], rnd: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Formación por estilo del equipo (la copa es de vestuario conservador). */
function formationOf(teamId: string): string {
  const team = TEAMS.find((t) => t.id === teamId) ?? TEAMS[0];
  const byStyle: Record<string, string> = {
    ofensivo: '3-1',
    defensivo: '1-2-1',
    táctico: '2-1-1',
    equilibrado: '2-2'
  };
  const want = byStyle[team.style] ?? '2-2';
  return FORMATIONS.some((f) => f.id === want) ? want : FORMATIONS[0].id;
}

/** Crea el cuadro: los 8 equipos barajados; el usuario queda en su sorteo. */
export function createCup(userTeam: string, seed: number): CupState {
  const ids = TEAMS.map((t) => t.id);
  const rnd = cupRng(seed);
  const shuffled = shuffleWith(ids, rnd);
  const pairs: CupPair[] = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    pairs.push({ a: shuffled[i], b: shuffled[i + 1], winner: null, score: [0, 0], pens: null });
  }
  return { teams: shuffled, userTeam, roundIndex: 0, rounds: [pairs], champion: null };
}

/** Nombre visible de un equipo del cuadro. */
export function cupTeamName(teamId: string): string {
  return TEAMS.find((t) => t.id === teamId)?.name ?? teamId;
}

/** ¿Terminó toda la ronda actual? */
function roundDone(cup: CupState): boolean {
  return cup.rounds[cup.roundIndex].every((p) => p.winner !== null);
}

/** Registra el resultado de un encuentro y avanza el cuadro. */
export function setCupResult(
  cup: CupState,
  pairIndex: number,
  winner: string,
  score: [number, number],
  pens: [number, number] | null
): void {
  const pair = cup.rounds[cup.roundIndex][pairIndex];
  if (!pair) return;
  pair.winner = winner;
  pair.score = score;
  pair.pens = pens;

  if (!roundDone(cup)) return;
  const winners = cup.rounds[cup.roundIndex].map((p) => p.winner!);
  if (cup.roundIndex >= 2) {
    // Era la final: campeón y a la gloria.
    cup.champion = winners[0] ?? null;
    return;
  }
  const next: CupPair[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    next.push({ a: winners[i], b: winners[i + 1], winner: null, score: [0, 0], pens: null });
  }
  cup.rounds[cup.roundIndex + 1] = next;
  cup.roundIndex = (cup.roundIndex + 1) as 0 | 1 | 2;
}

/** Encuentro pendiente del equipo del usuario en la ronda actual (o null). */
export function userPair(cup: CupState): { pair: CupPair; index: number } | null {
  const round = cup.rounds[cup.roundIndex];
  if (!round) return null;
  const index = round.findIndex((p) => p.winner === null && (p.a === cup.userTeam || p.b === cup.userTeam));
  if (index === -1) return null;
  return { pair: round[index], index };
}

/** ¿Al usuario le toca jugar en la ronda actual? */
export function userMustPlay(cup: CupState): boolean {
  return userPair(cup) !== null && cup.champion === null;
}

/** Config de partido para el encuentro del usuario (siempre de rojo). */
export function userMatchConfig(cup: CupState, aiLevel: AiLevel, seed: number): MatchConfig | null {
  const up = userPair(cup);
  if (!up) return null;
  const rival = up.pair.a === cup.userTeam ? up.pair.b : up.pair.a;
  const roundIdx = cup.roundIndex;
  const cfg: MatchConfig = {
    home: { teamId: cup.userTeam, formation: formationOf(cup.userTeam) },
    away: { teamId: rival, formation: formationOf(rival) },
    mode: 'ai',
    aiTeam: 1,
    aiLevel,
    seed,
    cup: true
  };
  void roundIdx;
  return cfg;
}

/* ------------------------------------------------------------------ */
/* Simulador headless: la IA juega por los dos equipos                   */
/* ------------------------------------------------------------------ */

export interface SimResult {
  score: [number, number];
  pens: [number, number] | null;
  winner: TeamId;
}

/** Ejecuta una partida completa IA contra IA (si empata, tanda). */
export function simulateAiMatch(cfg: MatchConfig): SimResult {
  const s = createMatch({ ...cfg, mode: 'aivsai', aiTeam: null, cup: true });
  let guard = 6000;
  while (s.phase === 'playing' && guard-- > 0) {
    const d = nextAiAction(s);
    if (!d) { endTurn(s); continue; }
    let ok = false;
    switch (d.kind) {
      case 'move': ok = doMove(s, d.playerId, d.dest).ok; break;
      case 'pass': ok = doPass(s, d.playerId, d.targetId).ok; break;
      case 'shoot': ok = doShoot(s, d.playerId, d.shotKind ?? 'normal').ok; break;
      case 'steal': ok = doSteal(s, d.playerId, d.victimId).ok; break;
      case 'hack': ok = doHack(s, d.playerId, d.victimId).ok; break;
      case 'harden': ok = doHarden(s).ok; break;
      default: break;
    }
    if (!ok) endTurn(s);
  }
  // Empate en el torneo: tanda de penaltis 1v1 con el mismo motor.
  // (Re-lectura tipada: el motor muta la fase y TS no ve los cambios.)
  const phaseNow = s.phase as Phase;
  let pens: [number, number] | null = null;
  if (phaseNow === 'fulltime' && s.score[0] === s.score[1]) {
    for (const ev of enterPenalties(s)) void ev;
    guard = 6000;
    while ((s.phase as Phase) === 'penalti' && guard-- > 0) {
      const d = nextAiPenaltyAction(s);
      if (d) {
        const uiTeam = s.currentTeam;
        const step = s.penaltyStep;
        let ok = false;
        if (d.kind === 'penaltyMove') {
          ok = step === 'keeper'
            ? doPenaltyKeeperMove(s, d.playerId, d.dest).ok
            : doPenaltyShooterMove(s, d.playerId, d.dest).ok;
        } else {
          ok = doPenaltyShot(s, d.playerId).ok;
        }
        if (!ok && s.phase === 'penalti' && s.currentTeam === uiTeam && s.penaltyStep === step) {
          advancePenalty(s);
        }
        continue;
      }
      advancePenalty(s);
    }
    pens = [...s.penaltyKicks];
  }
  let winner: TeamId;
  if (s.penaltyWinner !== null) winner = s.penaltyWinner;
  else if (s.score[0] > s.score[1]) winner = 0;
  else if (s.score[1] > s.score[0]) winner = 1;
  else winner = cupRng(s.rng)() < 0.5 ? 0 : 1; // caso imposible: sorteo simbólico
  return { score: [s.score[0], s.score[1]], pens, winner };
}

/** Nombre visible del rival de la ronda para el cupo del usuario. */
export function cupOpponentOf(cup: CupState, pairIndex: number): string | null {
  const pair = cup.rounds[cup.roundIndex]?.[pairIndex];
  if (!pair) return null;
  return pair.a === cup.userTeam ? pair.b : pair.a;
}
