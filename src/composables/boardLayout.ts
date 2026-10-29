/**
 * Geometría de pintado del tablero (SVG). Solo la capa visual:
 * el motor trabaja en casillas enteras; aquí las convertimos a píxeles.
 */

export const CELL = 60;
export const MARGIN_X = 44;
export const MARGIN_Y = 36;
export const COLS = 15;
export const ROWS = 10;

export const VB_W = MARGIN_X * 2 + COLS * CELL;
export const VB_H = MARGIN_Y * 2 + ROWS * CELL;

/** Centro (px) de la casilla. */
export function cellToPx(c: { col: number; row: number }): { x: number; y: number } {
  return {
    x: MARGIN_X + c.col * CELL + CELL / 2,
    y: MARGIN_Y + c.row * CELL + CELL / 2
  };
}

/** Borde superior-izquierda (px) de la casilla. */
export function cellTopLeft(c: { col: number; row: number }): { x: number; y: number } {
  return { x: MARGIN_X + c.col * CELL, y: MARGIN_Y + c.row * CELL };
}

/** Esquinas del campo de juego en píxeles. */
export const PITCH = {
  x: MARGIN_X,
  y: MARGIN_Y,
  w: COLS * CELL,
  h: ROWS * CELL
};

/** Casilla a partir de coordenadas SVG. */
export function svgToCell(x: number, y: number): { col: number; row: number } | null {
  const col = Math.floor((x - MARGIN_X) / CELL);
  const row = Math.floor((y - MARGIN_Y) / CELL);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
  return { col, row };
}

/** Radio de las fichas de jugador. */
export const TOKEN_R = 21;
