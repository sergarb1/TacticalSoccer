import { describe, it, expect } from 'vitest';
import { createMatch, doMove, doPass, doShoot, doSteal, endTurn } from '../src/game/match';
import { nextAiAction } from '../src/ai/strategy';
import { DIFFICULTY } from '../src/ai/difficulty';
import type { GameState, MatchConfig } from '../src/game/types';

function invariantCheck(s: GameState, step: number): void {
  expect(s.ap, `AP negativo en paso ${step}`).toBeGreaterThanOrEqual(0);
  const cells = s.players.map((p) => `${p.pos.col},${p.pos.row}`);
  expect(new Set(cells).size, `posición duplicada en paso ${step}`).toBe(cells.length);
  for (const p of s.players) {
    expect(p.pos.col).toBeGreaterThanOrEqual(0);
    expect(p.pos.col).toBeLessThanOrEqual(14);
    expect(p.pos.row).toBeGreaterThanOrEqual(0);
    expect(p.pos.row).toBeLessThanOrEqual(9);
  }
  if (s.ball.carrier !== null) {
    const c = s.players.find((p) => p.id === s.ball.carrier);
    expect(c, `portador ${s.ball.carrier} inexistente en paso ${step}`).toBeDefined();
    if (c) expect([c.pos.col, c.pos.row]).toEqual([s.ball.pos.col, s.ball.pos.row]);
  }
}

/** Dirige una partida completa con la IA por ambos lados o con un lado tonto. */
function playMatch(seed: number, level: 'easy' | 'normal' | 'hard'): GameState {
  const base: MatchConfig = {
    home: { teamId: 'sur', formation: '4-4-2' },
    away: { teamId: 'puerto', formation: '3-5-2' },
    mode: 'ai',
    aiTeam: 1,
    aiLevel: level,
    seed
  };
  const s = createMatch(base);
  let safety = 4000;

  while (s.phase === 'playing' && safety-- > 0) {
    invariantCheck(s, s.teamTurns);
    const action = nextAiAction(s);
    if (action) {
      let r;
      switch (action.kind) {
        case 'move': r = doMove(s, action.playerId, action.dest); break;
        case 'pass': r = doPass(s, action.playerId, action.targetId); break;
        case 'shoot': r = doShoot(s, action.playerId); break;
        case 'steal': r = doSteal(s, action.playerId, action.victimId); break;
      }
      if (r && !r.ok) {
        // La estrategia nunca debe proponer acciones ilegales:
        // si lo hace, la prueba falla con contexto.
        throw new Error(`IA ${level}: acción ilegal ${JSON.stringify(action)} -> ${r.code} ${r.message}`);
      }
      continue;
    }
    endTurn(s);
  }
  expect(s.phase).toBe('fulltime');
  expect(safety).toBeGreaterThan(0);
  return s;
}

describe('IA - partidas completas', () => {
  it('partida completa fácil es legal y llega al pitido final', () => {
    const s = playMatch(1, 'easy');
    expect(s.score[0] + s.score[1]).toBeGreaterThanOrEqual(0);
  });

  it('partida completa normal es legal y llega al pitido final', () => {
    const s = playMatch(7, 'normal');
    expect(s.stats[0].shots + s.stats[1].shots).toBeGreaterThan(0);
  });

  it('partida completa difícil es legal y llega al pitido final', () => {
    const s = playMatch(42, 'hard');
    expect(s.phase).toBe('fulltime');
  });

  it('todas las partidas se terminan con varios seeds distintos', () => {
    for (const seed of [3, 11, 99]) {
      const s = playMatch(seed, 'normal');
      expect(s.phase).toBe('fulltime');
    }
  });

  it('los niveles existen los tres', () => {
    expect(Object.keys(DIFFICULTY).sort()).toEqual(['easy', 'hard', 'normal']);
  });
});
