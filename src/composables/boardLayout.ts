/**
 * Geometría de pintado del tablero (SVG) con proyección isométrica.
 * Solo la capa visual: el motor trabaja en casillas enteras; aquí las
 * convertimos a píxeles (rombos 2:1) y de vuelta con la misma matemática.
 * Todas las medidas se derivan de las dimensiones del campo en config,
 * así que cambiar el tamaño del campo no rompe la vista.
 */
import { FIELD_COLS, FIELD_ROWS } from '../game/config';

export const COLS = FIELD_COLS;
export const ROWS = FIELD_ROWS;

/** Diagonal horizontal del rombo (px). */
export const TILE_W = 124;
/** Diagonal vertical del rombo (px). */
export const TILE_H = 64;
const HW = TILE_W / 2;
const HH = TILE_H / 2;

/** Margen de aire alrededor del campo (px de viewBox). */
const MARGIN_X = 34;
const MARGIN_TOP = 62; // deja sitio a las fichas por encima del vértice norte

/** El césped exterior sobresale del área de juego en unidades de casilla. */
const GRASS_PAD_X = 0.45;
const GRASS_PAD_Y = 0.25;

/** Origen de la proyección en el viewBox. */
export const OX = Math.round(MARGIN_X + HW * (ROWS - 1 + GRASS_PAD_X + GRASS_PAD_Y));
export const OY = MARGIN_TOP;

/** Extensión horizontal del campo (con el césped) en unidades de casilla. */
const SPAN_X = COLS + ROWS - 2 + (GRASS_PAD_X + GRASS_PAD_Y) * 2;
/** Extensión vertical del campo (con el césped) en unidades de casilla. */
const SPAN_Y = COLS + ROWS - 2 + 1.35;

export const VB_W = Math.round(MARGIN_X * 2 + HW * SPAN_X);
export const VB_H = Math.round(OY + HH * SPAN_Y + 36);

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
