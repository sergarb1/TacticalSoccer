/**
 * Movimiento en la rejilla: alcance (BFS de 8 direcciones), caminos y validez.
 * El movimiento es adyacente-casilla ( Chebyshev ), sin atravesar jugadores
 * ni cortar esquinas en diagonal, y nunca fuera del campo.
 */
import { effectiveMoveRange, isOccupied } from './rules';
import { FIELD_COLS, FIELD_ROWS } from './config';
import { inField } from './field';
import type { Cell, GameState, Player } from './types';

const DIRS: Array<[number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1]
];

export interface Reachable {
  /** mapa clave "col,row" -> camino desde el origen (incluyéndolo). */
  paths: Map<string, Cell[]>;
}

export function cellKey(c: Cell): string {
  return `${c.col},${c.row}`;
}

/**
 * Calcula todas las casillas alcanzables por un jugador (sin contar su
 * propia casilla de partida). Ocupadas por otros jugadores bloquean el paso.
 */
export function reachable(state: GameState, player: Player): Reachable {
  const range = effectiveMoveRange(player, state);
  const paths = new Map<string, Cell[]>();
  const start: Cell = player.pos;
  paths.set(cellKey(start), [start]);
  // BFS por anillos de Chebyshev.
  let frontier: Cell[] = [start];
  for (let step = 0; step < range; step++) {
    const next: Cell[] = [];
    for (const cur of frontier) {
      for (const [dc, dr] of DIRS) {
        const target: Cell = { col: cur.col + dc, row: cur.row + dr };
        if (!inField(target)) continue;
        const key = cellKey(target);
        if (paths.has(key)) continue;
        if (isOccupied(state, target, player.id)) continue;
        // No cortar esquinas en diagonal: las dos casillas ortogonales
        // intermedias deben estar libres (o ser la casilla de origen del walker).
        if (dc !== 0 && dr !== 0) {
          const sideA: Cell = { col: cur.col + dc, row: cur.row };
          const sideB: Cell = { col: cur.col, row: cur.row + dr };
          const blockedA = isOccupied(state, sideA, player.id) || !inField(sideA);
          const blockedB = isOccupied(state, sideB, player.id) || !inField(sideB);
          if (blockedA && blockedB) continue;
        }
        const path = (paths.get(cellKey(cur)) ?? []).concat(target);
        paths.set(key, path);
        next.push(target);
      }
    }
    frontier = next;
  }
  paths.delete(cellKey(start));
  return { paths };
}

/** El destino es legal para mover (sin lanzar el cálculo completo desde la UI). */
export function canMoveTo(state: GameState, player: Player, dest: Cell): { ok: boolean; path?: Cell[]; reason: string } {
  if (!inField(dest)) return { ok: false, reason: 'outside' };
  if (isOccupied(state, dest, player.id)) return { ok: false, reason: 'occupied' };
  const r = reachable(state, player);
  const path = r.paths.get(cellKey(dest));
  if (!path) return { ok: false, reason: 'not_reachable' };
  return { ok: true, path, reason: 'ok' };
}

/** ¿La casilla está en los límites del campo? */
export function isInside(c: Cell): boolean {
  return c.col >= 0 && c.col < FIELD_COLS && c.row >= 0 && c.row < FIELD_ROWS;
}
