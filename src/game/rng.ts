/**
 * Generador aleatorio determinista persistido en el estado de la partida
 * (mulberry32). Permite reproducir partidas en pruebas fijando state.rng.
 */

export interface RngStep {
  value: number;
  state: number;
}

/** Un paso de mulberry32: devuelve el valor y el nuevo estado. */
export function randomStep(state: number): RngStep {
  let a = (state + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: a };
}

/**
 * Pequeña corriente de aleatorios ligada al estado de la partida.
 * Cada llamada avanza `state.rng`, así que el orden de las tiradas es
 * determinista y reproducible.
 */
export class Stream {
  private state: number;
  onStep?: (s: number) => void;

  constructor(state: number, onStep?: (s: number) => void) {
    this.state = state >>> 0;
    this.onStep = onStep;
  }

  next(): number {
    const s = randomStep(this.state);
    this.state = s.state;
    this.onStep?.(this.state);
    return s.value;
  }

  /** Entero en [min, maxExcl). */
  int(min: number, maxExcl: number): number {
    return min + Math.floor(this.next() * (maxExcl - min));
  }
}

/** Semilla reproducible a partir de una cadena (catálogo de equipos). */
export function hashSeed(text: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
