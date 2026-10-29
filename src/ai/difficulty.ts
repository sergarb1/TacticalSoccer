/**
 * Parámetros de personalidad para cada nivel de dificultad.
 * La IA usa los mismos datos que el jugador (estado visible); el nivel
 * solo cambia umbrales, la exploración y la calidad táctica.
 */
export interface DifficultyProfile {
  /** Dispara por encima de esta probabilidad de gol (%). */
  shootThreshold: number;
  /** Umbral para pasar si mejora la posición del balón (puntos). */
  passImprovement: number;
  /** Umbral para mover al portador si mejora (puntos). */
  moveImprovement: number;
  /** Umbral para intentar el robo (%). */
  stealThreshold: number;
  /** Ruido aleatorio añadido a las puntuaciones (0..N puntos). */
  jitter: number;
  /** Movimientos tácticos de apoyo/defensa adicionales por turno. */
  supportMoves: number;
  /** ¿Reubica a los jugadores sin balón con criterio defensivo? */
  positionalIQ: boolean;
  /** ¿Evita pases con riesgo alto? */
  riskAversion: number; // 0..1
}

export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTY: Record<Difficulty, DifficultyProfile> = {
  easy: {
    shootThreshold: 50,
    passImprovement: 14,
    moveImprovement: 10,
    stealThreshold: 60,
    jitter: 35,
    supportMoves: 0,
    positionalIQ: false,
    riskAversion: 0.2
  },
  normal: {
    shootThreshold: 30,
    passImprovement: 8,
    moveImprovement: 6,
    stealThreshold: 35,
    jitter: 14,
    supportMoves: 1,
    positionalIQ: true,
    riskAversion: 0.55
  },
  hard: {
    shootThreshold: 22,
    passImprovement: 5,
    moveImprovement: 4,
    stealThreshold: 25,
    jitter: 3,
    supportMoves: 2,
    positionalIQ: true,
    riskAversion: 0.8
  }
};
