/**
 * Configuración centralizada de las reglas del juego.
 * Todo lo ajustable (costes, probabilidades, dimensiones) vive aquí para
 * poder modificar el equilibrio sin tocar la lógica.
 */
import type { TeamId } from './types';

/**
 * Dimensiones del campo en casillas (5 contra 5).
 * Rejilla 9 x 5 con vista isométrica; portería de 3 casillas en cada fondo.
 */
export const FIELD_COLS = 9;
export const FIELD_ROWS = 5;
/** Filas ocupadas por la boca de la portería (arco pequeño: solo el centro). */
export const GOAL_ROWS = [2] as const;
/** Fila central de la boca del arco: objetivo de los disparos. */
export const GOAL_CENTER_ROW = 2;
/** Casilla del saque de centro. */
export const KICKOFF_CELL = { col: 4, row: 2 };

/** Puntos de acción (AP) por turno. */
export const AP_PER_TURN = 3;
/** Cuántos «minutos» de partido avanza cada turno de equipo. */
export const MINUTES_PER_TURN = 3;
/** Turnos por equipo hasta el descanso / final (15 = 45', 30 = 90'). */
export const TURNS_PER_HALF = 15;

export const COST = {
  move: 1,
  pass: 1,
  shoot: 1,
  steal: 1
} as const;

/** Alcance de movimiento: 1 + velocidad/4 (campo pequeño). */
export function moveRange(speed: number, carryingBall: boolean, fatigueLevels: number): number {
  let range = 1 + Math.floor(speed / 4) - fatigueLevels;
  if (carryingBall) range -= 1;
  return Math.max(1, range);
}

/**
 * Fatiga acumulada por la resistencia: 0, 1 o 2 niveles de penalización
 * según el minuto del partido. (Aproximación deliberada.)
 */
export function fatigueLevels(stamina: number, teamTurns: number): number {
  let levels = 0;
  if (teamTurns >= 9 && stamina < 7) levels += 1;
  if (teamTurns >= 19 && stamina < 6) levels += 1;
  return levels;
}

/** Alcance máximo de pase: 2 + pase/3 casillas. */
export function passRange(pass: number): number {
  return 2 + Math.floor(pass / 3);
}

/** Radio (distancia de chebyshev) en el que un rival presiona. */
export const PRESSURE_RADIUS = 2;
/** Presión máxima considerada (para no castigar en exceso). */
export const PRESSURE_CAP = 3;

/** Distancia de chebyshev máxima para intentar robar el balón. */
export const STEAL_RANGE = 1;

export const TEAM_NAMES = ['Local', 'Visitante'] as const;
/** Colores: el equipo local juega de rojo y el visitante de azul. */
export const TEAM_COLORS: Record<TeamId, { main: string; dark: string; light: string; label: string }> = {
  0: { main: '#d64541', dark: '#8f2621', light: '#ff8f80', label: 'Equipo Rojo' },
  1: { main: '#3b7dd8', dark: '#1f4e93', light: '#9dc4ff', label: 'Equipo Azul' }
};

/** Límites de probabilidad (en %) para pases y robos. */
export const PROB = {
  passMin: 8,
  passMax: 97,
  stealMin: 8,
  stealMax: 88
};

/** Claves de localStorage. */
export const STORAGE_KEYS = {
  settings: 'tactical-soccer.settings.v1',
  match: 'tactical-soccer.match.v1'
} as const;
