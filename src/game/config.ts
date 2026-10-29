/**
 * Configuración centralizada de las reglas del juego.
 * Todo lo ajustable (costes, probabilidades, dimensiones) vive aquí para
 * poder modificar el equilibrio sin tocar la lógica.
 */
import type { TeamId } from './types';

/** Dimensiones del campo en casillas. 15x10 casillas, porterías en las filas 4 y 5. */
export const FIELD_COLS = 15;
export const FIELD_ROWS = 10;
/** Filas ocupadas por la boca de la portería. */
export const GOAL_ROWS = [4, 5] as const;
/** Fila central (centro del arco): usada como objetivo de disparo. */
export const GOAL_CENTER_ROW = 4.5;
/** Lugar de saque central. */
export const KICKOFF_CELL = { col: 7, row: 4 };

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

/** Alcance de movimiento: 1 + velocidad/3 (redondeo abajo), en casillas. */
export function moveRange(speed: number, carryingBall: boolean, fatigueLevels: number): number {
  let range = 1 + Math.floor(speed / 3) - fatigueLevels;
  if (carryingBall) range -= 1;
  return Math.max(1, range);
}

/**
 * Fatiga acumulada por la resistencia: 0, 1 o 2 niveles de penalización
 * según el minuto del partido y la resistencia del jugador.
 * (Aproximación deliberada: sin temperatura ni estado físico instantáneo.)
 */
export function fatigueLevels(stamina: number, teamTurns: number): number {
  let levels = 0;
  if (teamTurns >= 9 && stamina < 7) levels += 1;
  if (teamTurns >= 19 && stamina < 6) levels += 1;
  return levels;
}

/** Alcance máximo de pase: 4 + pase/2 casillas. */
export function passRange(pass: number): number {
  return 4 + Math.floor(pass / 2);
}

/** Radio (distancia de chebyshev) en el que un rival presiona. */
export const PRESSURE_RADIUS = 2;
/** Presión máxima considerada (para no castigar en exceso). */
export const PRESSURE_CAP = 3;

/** Distancia de chebyshev máxima para intentar robar el balón. */
export const STEAL_RANGE = 1;

export const TEAM_NAMES = ['Local', 'Visitante'] as const;
/** Colores perfiles: el equipo local siempre juega de rojo y el visitante de azul. */
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
