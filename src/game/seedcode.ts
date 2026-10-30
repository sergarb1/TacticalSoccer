/**
 * Código-secreto del partido: la semilla RNG en base 36 con formato corto
 * para retos. Dado un código, la partida se parece está pintada: mismos
 * equipos, misma formación y la suerte se enrollea exactamente igual.
 */
export const SEED_CODE_PAD = 7;

/** Código compartible de la semilla (7 símbolos en base 36). */
export function seedCode(seed: number): string {
  return (seed >>> 0).toString(36).toUpperCase().padStart(SEED_CODE_PAD, '0');
}

/** Parsea un código de reto; ¿null? si no es válido. */
export function parseSeedCode(code: string): number | null {
  const clean = code.trim().toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^0+(?=.)/, '');
  if (!clean || clean.length > SEED_CODE_PAD) return null;
  const n = parseInt(clean, 36);
  if (!Number.isFinite(n) || n < 0) return null;
  return n >>> 0;
}
