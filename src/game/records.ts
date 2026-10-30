/**
 * Palmarés del gañán: estadísticas acumuladas entre partidas guardadas en
 * localStorage. Cosmético (no afecta al motor) y tolerante a partidas viejas:
 * si el JSON no encaja, se descarta con gracia y se empieza de cero.
 */
import { STORAGE_KEYS } from './config';
import type { GameState } from './types';

export interface CupTrophy {
  when: number; // fecha (Date.now)
  teamName: string; // equipo con el que se ganó
  rivalName: string; // rival de la final
  score: [number, number];
  pens: [number, number] | null;
}

export interface MvpEntry {
  when: number;
  playerName: string;
  goals: number;
  steals: number;
  matchLabel: string; // «Rojos 3–1 Azules»
  mvpTeam: string;
}

export interface Records {
  played: number; // partidas del jugador (vs IA), sin contar espectador
  wins: number;
  losses: number;
  draws: number;
  /** Racha actual de victorias (se rompe con derrota; los empates no la tocan). */
  streak: number;
  bestStreak: number;
  cups: CupTrophy[];
  mvps: MvpEntry[];
}

const EMPTY: Records = {
  played: 0, wins: 0, losses: 0, draws: 0, streak: 0, bestStreak: 0, cups: [], mvps: []
};

let cache: Records | null = null;

export function loadRecords(): Records {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.records);
    if (!raw) return (cache = { ...EMPTY });
    const data = JSON.parse(raw) as Partial<Records>;
    if (!data || typeof data !== 'object') return (cache = { ...EMPTY });
    cache = {
      ...EMPTY,
      ...data,
      cups: Array.isArray(data.cups) ? data.cups : [],
      mvps: Array.isArray(data.mvps) ? data.mvps : []
    };
    // Cachear por valor (no referencia) para que la UI reactivo vea cambios.
    return JSON.parse(JSON.stringify(cache)) as Records;
  } catch {
    return (cache = { ...EMPTY });
  }
}

function persist(): void {
  try {
    if (cache) localStorage.setItem(STORAGE_KEYS.records, JSON.stringify(cache));
  } catch {
    /* sin almacenamiento: el palmarés vive solo en memoria */
  }
}

/** Resultado de una partida del jugador contra la máquina (la copa registra aparte). */
export function recordMatchResult(outcome: 'win' | 'loss' | 'draw'): void {
  const r = loadRecords();
  r.played += 1;
  if (outcome === 'win') {
    r.wins += 1;
    r.streak += 1;
    if (r.streak > r.bestStreak) r.bestStreak = r.streak;
  } else if (outcome === 'loss') {
    r.losses += 1;
    r.streak = 0;
  } else {
    r.draws += 1; // los empates no rompen la racha
  }
  persist();
}

/** Copa consigada: añade el trofeo al palmarés. */
export function recordCupWin(trophy: CupTrophy): void {
  const r = loadRecords();
  r.cups.push(trophy);
  if (r.cups.length > 12) r.cups = r.cups.slice(-12); // tope por si se acumulan
  persist();
}

/**
 * MVP del partido: mejor artillero (desempate por robos).
 * `goals`/`steals` vienen de los eventos observados durante la partida.
 */
export function recordMvp(entry: MvpEntry): void {
  const r = loadRecords();
  r.mvps.push(entry);
  if (r.mvps.length > 10) r.mvps = r.mvps.slice(-10);
  persist();
}

/** ¿Se ganó el partido del tablero? (branch 0 = equipo local jugado por el usuario) */
export function outcomeForUser(state: GameState): 'win' | 'loss' | 'draw' {
  const a = state.penaltyWinner !== null ? state.penaltyWinner : state.score[0] > state.score[1] ? 0 : state.score[1] > state.score[0] ? 1 : null;
  if (a === null) return 'draw';
  return a === 0 ? 'win' : 'loss';
}
