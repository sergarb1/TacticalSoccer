/**
 * Pruebas de la Copa Capello: bracket, simulador IA vs IA y flujo completo
 * hasta campeón. Comprueba también que los empates pasan por penaltis.
 */
import { describe, expect, it } from 'vitest';
import {
  createCup, setCupResult, simulateAiMatch, userMatchConfig, userPair, ROUND_NAMES
} from '../src/game/cup';
import { TEAMS } from '../src/game/formations';
import type { MatchConfig } from '../src/game/types';

function seedCfg(a: string, b: string, seed: number): MatchConfig {
  return {
    home: { teamId: a, formation: '2-2' },
    away: { teamId: b, formation: '2-2' },
    mode: 'aivsai',
    aiTeam: null,
    aiLevel: 'normal',
    seed,
    cup: true
  };
}

describe('Copa Capello', () => {
  it('el cuadro crea 4 cruces con los 8 equipos del catálogo', () => {
    const cup = createCup('sur', 12345);
    expect(cup.rounds[0]).toHaveLength(4);
    expect(TEAMS.map((t) => t.id).sort()).toEqual([...new Set(cup.teams)].sort());
    expect(ROUND_NAMES).toEqual(['Cuartos', 'Semifinales', 'Final']);
  });

  it('gana el que gana y si empata hay penaltis con ganador único', () => {
    for (let i = 0; i < 6; i++) {
      const res = simulateAiMatch(seedCfg('sur', 'norte', (i * 9871 + 3) >>> 0));
      const [ga, gb] = res.score;
      if (ga === gb) {
        expect(res.pens).not.toBeNull();
        expect(res.pens![0]).not.toBe(res.pens![1]); // alguien gana la tanda
        expect([0, 1]).toContain(res.winner);
      } else {
        expect(res.winner).toBe(ga > gb ? 0 : 1);
      }
    }
  });

  it('el torneo completo llega a un campeón tras simular cada cruce', () => {
    const cup = createCup('sur', 4242);
    let guard = 12;
    while (cup.champion === null && guard-- > 0) {
      const round = cup.rounds[cup.roundIndex];
      round.forEach((pair, pi) => {
        if (pair.winner !== null) return;
        const res = simulateAiMatch(seedCfg(pair.a, pair.b, (pi + 1) * 7717));
        setCupResult(cup, pi, res.winner === 0 ? pair.a : pair.b, res.score, res.pens);
      });
    }
    expect(cup.champion).not.toBeNull();
    expect(cup.rounds).toHaveLength(3);
  });

  it('el encuentro del usuario lo juega de rojo contra su rival', () => {
    const cup = createCup('norte', 777);
    const up = userPair(cup);
    expect(up).not.toBeNull();
    const cfg = userMatchConfig(cup, 'normal', 99)!;
    expect(cfg.home.teamId).toBe('norte');
    expect(cfg.away.teamId).not.toBe('norte');
    expectcfgAi(cfg);
  });
});

function expectcfgAi(cfg: MatchConfig): void {
  expect(cfg.mode).toBe('ai');
  expect(cfg.cup).toBe(true);
}
