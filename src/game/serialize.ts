/**
 * Persistencia de la partida en localStorage, con validación robusta:
 * si los datos están corruptos, se descartan en lugar de romper el juego.
 */
import { STORAGE_KEYS } from './config';
import { inField } from './field';
import type { GameState } from './types';

/** Serializa el estado de la partida a JSON. */
export function serializeMatch(state: GameState): string {
  return JSON.stringify({ ...state, v: 1 });
}

/** Validación estructural: ¿pinta razonablemente ser un estado de partida? */
export function validateMatch(data: unknown): GameState | null {
  try {
    const s = data as GameState;
    if (!s || typeof s !== 'object') return null;
    if (s.v !== 1) return null;
    if (!s.config || !s.config.home || !s.config.away) return null;
    if (!Array.isArray(s.players) || s.players.length !== 10) return null;
    if (!s.ball || typeof s.ball.carrier !== 'object' && s.ball.carrier !== null) return null;
    if (!Array.isArray(s.score) || s.score.length !== 2) return null;
    if (s.stats === undefined || s.stats === null || s.stats.length !== 2) return null;
    for (const p of s.players) {
      if (typeof p.id !== 'number' || typeof p.name !== 'string') return null;
      if (!inField(p.pos)) return null;
      if (typeof p.hasMoved !== 'boolean' || typeof p.hasActed !== 'boolean') return null;
      if (!p.stats || typeof p.stats.speed !== 'number') return null;
      // Partidas anteriores al sistema de posturas: se les asigna la neutral.
      if (p.stance !== 'cut' && p.stance !== 'none') p.stance = 'none';
    }
    if (s.ball.carrier !== null && !s.players.some((p) => p.id === s.ball.carrier)) return null;
    if (!inField(s.ball.pos)) return null;
    if (s.phase !== 'playing' && s.phase !== 'fulltime' && s.phase !== 'penalti') return null;
    if (s.currentTeam !== 0 && s.currentTeam !== 1) return null;
    if (typeof s.ap !== 'number' || s.ap < 0 || s.ap > 9) return null;
    // Barras y especiales: partidas anteriores al sistema se les asigna el
    // estado inicial de gracia (barra vacía, 2 especiales).
    if (!Array.isArray(s.meter) || s.meter.length !== 2) s.meter = [0, 0];
    if (!Array.isArray(s.specials) || s.specials.length !== 2) s.specials = [2, 2];
    s.meter = s.meter.map((m) => Math.max(0, Math.min(3, Math.round(Number(m) || 0)))) as [number, number];
    s.specials = s.specials.map((n) => Math.max(0, Math.min(9, Math.round(Number(n) || 0)))) as [number, number];
    // Endurecer y tanda de penaltis: partidas anteriores a estas mecánicas
    // se les asigna el estado inicial con gracia.
    if (!Array.isArray(s.harden) || s.harden.length !== 2) s.harden = [false, false];
    s.harden = [!!s.harden[0], !!s.harden[1]];
    if (s.penaltyShots === undefined || !Array.isArray(s.penaltyShots) || s.penaltyShots.length !== 2) s.penaltyShots = [0, 0];
    if (s.penaltyKicks === undefined || !Array.isArray(s.penaltyKicks) || s.penaltyKicks.length !== 2) s.penaltyKicks = [0, 0];
    if (s.penaltyStep !== 'keeper' && s.penaltyStep !== 'shooter') s.penaltyStep = 'keeper';
    if (s.penaltyShooterId === undefined) s.penaltyShooterId = null;
    if (s.penaltyKeeperId === undefined) s.penaltyKeeperId = null;
    if (s.penaltyWinner === undefined) s.penaltyWinner = null;
    if (!Array.isArray(s.log)) return null;
    if (typeof s.rng !== 'number') return null;
    return s;
  } catch {
    return null;
  }
}

/** Guarda la partida (silencioso si localStorage no está disponible). */
export function saveMatch(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEYS.match, serializeMatch(state));
  } catch {
    /* almacenamiento no disponible: se ignora */
  }
}

/** Carga la partida guardada; null si no existe o está corrupta (y la borra). */
export function loadSavedMatch(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.match);
    if (!raw) return null;
    const parsed = validateMatch(JSON.parse(raw));
    if (!parsed) {
      try {
        localStorage.removeItem(STORAGE_KEYS.match);
      } catch {
        /* ignore */
      }
      return null;
    }
    return parsed;
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEYS.match);
    } catch {
      /* ignore */
    }
    return null;
  }
}

/** Borra la partida guardada (al terminar un partido o al empezar otro). */
export function clearSavedMatch(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.match);
  } catch {
    /* ignore */
  }
}
