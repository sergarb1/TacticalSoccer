/**
 * Configuración centralizada de las reglas del juego.
 * Todo lo ajustable (costes, probabilidades, dimensiones) vive aquí para
 * poder modificar el equilibrio sin tocar la lógica.
 */
import type { ShotKind, TeamId } from './types';

/**
 * Dimensiones del campo en casillas (5 contra 5).
 * Rejilla 13 x 7 con vista isométrica; campo grande para más estrategia,
 * contrapesado con más alcance de movimiento y de pase.
 */
export const FIELD_COLS = 13;
export const FIELD_ROWS = 7;
/** Filas ocupadas por la boca de la portería (arco pequeño: solo el centro). */
export const GOAL_ROWS = [3] as const;
/** Fila central de la boca del arco: objetivo de los disparos. */
export const GOAL_CENTER_ROW = 3;
/** Casilla del saque de centro. */
export const KICKOFF_CELL = { col: 6, row: 3 };

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
  steal: 1,
  cut: 1,
  /** Hachazo robador: robo premium que gasta una acción especial. */
  hack: 1,
  /** Endurecer defensa: 1 AP de todo el equipo durante el turno rival. */
  harden: 1
} as const;

/** Coste en AP de cada tipo de disparo. */
export const SHOT_COST: Record<ShotKind, number> = {
  normal: 1,
  billetes: 2,
  vaselina: 2
};

/** Nombre visible de cada tipo de disparo (para paneles y narración). */
export const SHOT_LABEL: Record<ShotKind, string> = {
  normal: 'Tiro',
  billetes: 'Tiro Billetes',
  vaselina: 'Vaselina'
};

/** Alcance de movimiento: 2 + velocidad/4 (campo grande, jinetes rápidos). */
export function moveRange(speed: number, carryingBall: boolean, fatigueLevels: number): number {
  let range = 2 + Math.floor(speed / 4) - fatigueLevels;
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

/** Alcance máximo de pase: 3 + pase/2 casillas (campo grande). */
export function passRange(pass: number): number {
  return 3 + Math.floor(pass / 2);
}

/** Radio (distancia de chebyshev) en el que un rival presiona. */
export const PRESSURE_RADIUS = 2;
/** Presión máxima considerada (para no castigar en exceso). */
export const PRESSURE_CAP = 3;

/** Distancia de chebyshev máxima para intentar robar el balón. */
export const STEAL_RANGE = 1;
/** Distancia de chebyshev máxima para plantarse a cortar líneas. */
export const CUT_RANGE = 2;

/** Alcance (chebyshev) del Hachazo robador: llega donde el robo normal no llega. */
export const HACK_RANGE = 2;
/** Aumento de probabilidad del Hachazo sobre el robo normal (puntos %). */
export const HACK_BONUS = 25;

/* ------------------------------------------------------------------ */
/* Endurecer defensa                                                    */
/* ------------------------------------------------------------------ */

/** El equipo que endurece roba mejor durante el turno rival (+%). */
export const HARDEN_STEAL_BONUS = 12;
/** Peso extra de tapones de tiro de un equipo endurecido. */
/**
 * Castigo por portero despistado: si el guardameta está a FAR_KEEPER_FROM
 * casillas o más de la boca de su arco (Chebyshev), cada casilla extra
 * regala FAR_KEEPER_BONUS puntos de gol al rival (tope FAR_KEEPER_CAP).
 * Así conviene tener al portero pegado a casa.
 */
export const FAR_KEEPER_FROM = 2;
export const FAR_KEEPER_BONUS = 6;
export const FAR_KEEPER_CAP = 18;

export const HARDEN_BLOCK_WEIGHT = 0.8;
/** Bonus a interceptar pases de un equipo endurecido (plantado a cortar). */
export const HARDEN_INTERCEPT_CUT = 8;
/** Bonus a interceptar pases de un equipo endurecido (sin postura). */
export const HARDEN_INTERCEPT = 5;

/* ------------------------------------------------------------------ */
/* Desempate 1v1: tanda de penaltis jugada en el tablero                */
/* ------------------------------------------------------------------ */

/** PA que tiene el portero para adelantarse antes de cada lanzamiento. */
export const PENALTY_KEEPER_AP = 1;
/** PA del lanzador: moverse por el área y chutar. */
export const PENALTY_SHOOTER_AP = 3;
/** Probabilidad base de marcar el penalti (sin lecturas). */
export const PENALTY_BASE_CHANCE = 58;
/** Penalización si el portero está en la fila cruzada por el lanzamiento. */
export const PENALTY_KEEP_GUESS_PENALTY = 26;
/** Por punto de tiro del lanzador (+). */
export const PENALTY_STATS_SHOOT = 4;
/** Por punto de reflejos del portero (−). */
export const PENALTY_STATS_KEEP = 3;
/** Al acercarse a la boca del arco (+ por casilla ganada). */
export const PENALTY_APPROACH_BONUS = 6;
/** Tanda reglamentaria: tras este número de lanzamientos, mata-mata. */
export const PENALTY_ROUNDS = 5;

/**
 * Barras de acciones especiales: cada barra de METER_MAX segmentos llena
 * concede una acción especial extra (Billetes, Vaselina o Hachazo).
 * Segmentos ganados: gol encajado, gol con disparo especial y robo exitoso.
 */
export const METER_MAX = 3;
/** Usos de acciones especiales que empieza cada equipo por partido. */
export const SPECIALS_PER_MATCH = 2;

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

/** Claves de localStorage (v2: el formato de campo cambió, las partidas
 * guardadas con rejilla 9x5 se descartan con gracia). */
export const STORAGE_KEYS = {
  settings: 'tactical-soccer.settings.v1',
  match: 'tactical-soccer.match.v2',
  cup: 'tactical-soccer.cup.v1',
  league: 'tactical-soccer.league.v1',
  records: 'tactical-soccer.records.v1'
} as const;
