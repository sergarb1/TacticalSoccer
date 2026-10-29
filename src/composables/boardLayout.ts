/**
 * Geometría de pintado del tablero (SVG) con proyección isométrica.
 * Solo la capa visual: el motor trabaja en casillas enteras; aquí las
 * convertimos a píxeles (rombos 2:1) y de vuelta con la misma matemática.
 */

export const COLS = 9;
export const ROWS = 5;

/** Diagonal horizontal del rombo (px). */
export const TILE_W = 124;
/** Diagonal vertical del rombo (px). */
export const TILE_H = 64;
const HW = TILE_W / 2; // 62
const HH = TILE_H / 2; // 32

/** Origen de la proyección en el viewBox. */
export const OX = 380;
export const OY = 52;

export const VB_W = 1010;
export const VB_H = 556;

/** Radio de las fichas de jugador. */
export const TOKEN_R = 21;

/** Centro (px) del rombo de una casilla. */
export function cellToPx(c: { col: number; row: number }): { x: number; y: number } {
  return {
    x: OX + (c.col - c.row) * HW,
    y: OY + (c.col + c.row) * HH + HH
  };
}

/** Vértice superior del rombo de una casilla. */
export function cellTop(c: { col: number; row: number }): { x: number; y: number } {
  return { x: OX + (c.col - c.row) * HW, y: OY + (c.col + c.row) * HH };
}

/** Polígono SVG del rombo de una casilla. */
export function cellPoly(c: { col: number; row: number }): string {
  const { x, y } = cellToPx(c);
  return `${x},${y - HH} ${x + HW},${y} ${x},${y + HH} ${x - HW},${y}`;
}

/** Caras laterales del rombo (para dar grosor 3D al campo). */
export function cellSide(c: { col: number; row: number }): string {
  const { x, y } = cellToPx(c);
  return `${x - HW},${y} ${x},${y + HH} ${x},${y + HH + 9} ${x - HW},${y + 9}`;
}

/** Casilla a partir de coordenadas SVG (invirtiendo la proyección). */
export function svgToCell(x: number, y: number): { col: number; row: number } | null {
  const u = (x - OX) / HW;
  const v = (y - OY) / HH;
  const gx = (u + v) / 2;
  const gy = (v - u) / 2;
  const col = Math.floor(gx);
  const row = Math.floor(gy);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
  return { col, row };
}

/** Punto (gx, gy) en espacio-casilla -> píxeles, como matriz SVG. */
export const ISO_MATRIX = `matrix(${HW},${HH},${-HW},${HH},${OX},${OY})`;

/** Todas las casillas del campo, fila a fila (para pintar el retículo). */
export function allBoardCells(): Array<{ col: number; row: number }> {
  const out: Array<{ col: number; row: number }> = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) out.push({ col, row });
  }
  return out;
}
