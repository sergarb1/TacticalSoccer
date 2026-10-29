/**
 * Geometría del campo y utilidades de distancia (módulo puro).
 */
import { FIELD_COLS, FIELD_ROWS } from './config';
import type { Cell } from './types';

/** ¿La casilla pertenece al campo? */
export function inField(c: Cell): boolean {
  return c.col >= 0 && c.col < FIELD_COLS && c.row >= 0 && c.row < FIELD_ROWS;
}

/** Distancia de Chebyshev: en una rejilla con diagonales, mover 1 casilla cuesta 1. */
export function cheby(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}

/** Distancia euclídea (usada en geometría de tiro, con filas y columnas a escala 1:1). */
export function euclid(a: Cell, b: { col: number; row: number }): number {
  return Math.hypot(a.col - b.col, a.row - b.row);
}

/**
 * Distancia de un punto a un segmento (en unidades de casilla).
 * Usada para saber si un defensor intercepta la trayectoria de un pase/disparo.
 */
export function distToSegment(p: { col: number; row: number }, a: Cell, b: Cell): number {
  const vx = b.col - a.col;
  const vy = b.row - a.row;
  const len2 = vx * vx + vy * vy;
  if (len2 === 0) return Math.hypot(p.col - a.col, p.row - a.row);
  let t = ((p.col - a.col) * vx + (p.row - a.row) * vy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.col - (a.col + t * vx), p.row - (a.row + t * vy));
}

/** Toda la lista de casillas válidas del campo. */
export function allCells(): Cell[] {
  const out: Cell[] = [];
  for (let row = 0; row < FIELD_ROWS; row++) {
    for (let col = 0; col < FIELD_COLS; col++) out.push({ col, row });
  }
  return out;
}

export function clampCell(c: Cell): Cell {
  return {
    col: Math.max(0, Math.min(FIELD_COLS - 1, c.col)),
    row: Math.max(0, Math.min(FIELD_ROWS - 1, c.row))
  };
}
