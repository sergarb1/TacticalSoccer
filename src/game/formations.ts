/**
 * Formaciones y catálogo de equipos. Módulo puro.
 * Cada formación define posiciones normalizadas del propio medio del equipo
 * (x de 0 a 0.5 propio, y de 0 a 1); el motor las refleja según el lado.
 */
import { FIELD_COLS, FIELD_ROWS, KICKOFF_CELL } from './config';
import { hashSeed } from './rng';
import { isOccupied, enemyOf } from './rules';
import { inField, allCells, cheby } from './field';
import type { GameState, MatchConfig, Player, Role, Stats, TeamId } from './types';

export interface FormationPos {
  role: Role;
  label: string; // nombre táctico para la UI
  /** x normalizado en el propio campo (0=portería propia, 0.5=medio campo). */
  x: number;
  y: number;
  /** bandera: el jugador de saque se recoloca junto al balón. */
  striker?: boolean;
}

export interface Formation {
  id: string;
  name: string;
  positions: FormationPos[];
}

const GK = (y = 0.45): FormationPos => ({ role: 'POR', label: 'Portero', x: 0.05, y });

/** Formaciones de 5 contra 5: un portero y cuatro jugadores de campo. */
export const FORMATIONS: Formation[] = [
  {
    id: '1-2-1',
    name: '1-2-1 Rombo',
    positions: [
      GK(),
      { role: 'DFC', label: 'Central', x: 0.18, y: 0.5 },
      { role: 'MC', label: 'Interior izq.', x: 0.34, y: 0.28 },
      { role: 'MC', label: 'Interior der.', x: 0.34, y: 0.72 },
      { role: 'DC', label: 'Delantero', x: 0.45, y: 0.5, striker: true }
    ]
  },
  {
    id: '2-1-1',
    name: '2-1-1 Sólida',
    positions: [
      GK(),
      { role: 'DFC', label: 'Central izq.', x: 0.17, y: 0.3 },
      { role: 'DFC', label: 'Central der.', x: 0.17, y: 0.7 },
      { role: 'MC', label: 'Mediocentro', x: 0.35, y: 0.5, striker: true },
      { role: 'DC', label: 'Delantero', x: 0.46, y: 0.5 }
    ]
  },
  {
    id: '2-2',
    name: '2-2 Casi todo al ataque',
    positions: [
      GK(),
      { role: 'DFC', label: 'Central izq.', x: 0.16, y: 0.33 },
      { role: 'DFC', label: 'Central der.', x: 0.16, y: 0.67 },
      { role: 'DC', label: 'Delantero izq.', x: 0.42, y: 0.3, striker: true },
      { role: 'DC', label: 'Delantero der.', x: 0.42, y: 0.7 }
    ]
  },
  {
    id: '3-1',
    name: '3-1 Catón',
    positions: [
      GK(),
      { role: 'DFC', label: 'Central izq.', x: 0.15, y: 0.22 },
      { role: 'DFC', label: 'Libero', x: 0.12, y: 0.5 },
      { role: 'DFC', label: 'Central der.', x: 0.15, y: 0.78 },
      { role: 'DC', label: 'Delantero', x: 0.42, y: 0.5, striker: true }
    ]
  }
];

export function formationById(id: string): Formation {
  const f = FORMATIONS.find((x) => x.id === id);
  if (!f) throw new Error(`Formación desconocida: ${id}`);
  return f;
}

/* ------------------------------------------------------------------ */
/* Catálogo de equipos                                                 */
/* ------------------------------------------------------------------ */

export type Style = 'equilibrado' | 'ofensivo' | 'defensivo' | 'táctico';

export interface TeamDef {
  id: string;
  name: string;
  short: string;
  style: Style;
  desc: string;
  /** 5 nombres, sin orden concreto. Initial + apellido en español. */
  roster: string[];
}

export const TEAMS: TeamDef[] = [
  {
    id: 'sur',
    name: 'Garra Che',
    short: 'GRR',
    style: 'ofensivo',
    desc: 'Cañoneros de banda a banda; sus defensas sufren un poco.',
    roster: ['Kily', 'Villa', 'Guedes', 'Nani', 'Paco']
  },
  {
    id: 'norte',
    name: 'Muro Che',
    short: 'MRU',
    style: 'defensivo',
    desc: 'Defensa de cemento y un portero con manoplas de gigante.',
    roster: ['Cañizares', 'Ayala', 'Marchena', 'Caneira', 'Palop']
  },
  {
    id: 'valle',
    name: 'Turia FC',
    short: 'TUR',
    style: 'equilibrado',
    desc: 'Equilibrados como el río que riega la ciudad.',
    roster: ['Parejo', 'Silva', 'Mata', 'Bernat', 'Alba']
  },
  {
    id: 'puerto',
    name: 'Litoral Che',
    short: 'LIT',
    style: 'táctico',
    desc: 'Toque elegante y muchísimo fútbol entre líneas.',
    roster: ['Mendieta', 'Aimed', 'Farinós', 'Zahovic', 'Carboni']
  },
  {
    id: 'senyera',
    name: 'Senyera CF',
    short: 'SNR',
    style: 'ofensivo',
    desc: 'Sale a morder cada balón; dicen que vestida de albaricoque.',
    roster: ['Tolo', 'Chimo', 'Pere', 'Ximo', 'Antolí']
  },
  {
    id: 'horta',
    name: 'Horta Che',
    short: 'HRC',
    style: 'táctico',
    desc: 'Toques cortos por la huerta y apertura a banda con la zancada base.',
    roster: ['Rigo', 'Segrelles', 'Mari', 'Colom', 'Banyuls']
  },
  {
    id: 'ribera',
    name: 'Ribera del Júcar',
    short: 'RBJ',
    style: 'equilibrado',
    desc: 'Ni un paso atrás ni tres por delante: equilibrio de vega.',
    roster: ['Jover', 'Trenca', 'Almela', 'Boticario', 'Sentis']
  },
  {
    id: 'marjal',
    name: 'Marjal FC',
    short: 'MRJ',
    style: 'defensivo',
    desc: 'Riachuelo dee agua parada: todo lo que entra, se queda embarrado.',
    roster: ['Visca', 'Baldó', 'Renar', 'Sans', 'Rabiella']
  }
];

export function teamById(id: string): TeamDef {
  const t = TEAMS.find((x) => x.id === id);
  if (!t) throw new Error(`Equipo desconocido: ${id}`);
  return t;
}

/* ------------------------------------------------------------------ */
/* Atributos por rol + estilo del equipo (deterministas)               */
/* ------------------------------------------------------------------ */

interface Archetype {
  speed: number; pass: number; shoot: number; defense: number; control: number; stamina: number; reflexes: number;
}

const ARCH: Record<Role, Archetype> = {
  POR: { speed: 4, pass: 4, shoot: 1, defense: 3, control: 3, stamina: 7, reflexes: 8 },
  DFC: { speed: 5, pass: 5, shoot: 2, defense: 8, control: 5, stamina: 7, reflexes: 1 },
  LI: { speed: 7, pass: 6, shoot: 3, defense: 6, control: 6, stamina: 8, reflexes: 1 },
  LD: { speed: 7, pass: 6, shoot: 3, defense: 6, control: 6, stamina: 8, reflexes: 1 },
  MCD: { speed: 6, pass: 6, shoot: 3, defense: 7, control: 6, stamina: 8, reflexes: 1 },
  MC: { speed: 6, pass: 7, shoot: 5, defense: 5, control: 7, stamina: 8, reflexes: 1 },
  EI: { speed: 8, pass: 6, shoot: 6, defense: 3, control: 7, stamina: 7, reflexes: 1 },
  ED: { speed: 8, pass: 6, shoot: 6, defense: 3, control: 7, stamina: 7, reflexes: 1 },
  DC: { speed: 7, pass: 4, shoot: 8, defense: 3, control: 6, stamina: 7, reflexes: 1 }
};

const STYLE_BIAS: Record<Style, Partial<Record<keyof Stats, number>>> = {
  ofensivo: { shoot: 1, speed: 1, defense: -1 },
  defensivo: { defense: 1, reflexes: 1, shoot: -1 },
  equilibrado: { stamina: 1 },
  táctico: { pass: 1, control: 1, shoot: -1 }
};

const clamp10 = (v: number): number => Math.max(1, Math.min(10, v));

/** Dorsales estándar de un equipo de 5 (portero + 4). */
const NUMBERS_FIVE = [1, 4, 8, 10, 9];

export interface BuiltPlayer {
  name: string;
  num: number;
  role: Role;
  stats: Stats;
}

/** Genera la alineación de un equipo según formación + estilo (determinista). */
export function buildRoster(team: TeamDef, formationId: string): BuiltPlayer[] {
  const seed = hashSeed(team.id + '|' + formationId);
  const f = formationById(formationId);
  const bias = STYLE_BIAS[team.style];
  return f.positions.map((pos, i) => {
    // Pequeña variación determinista por jugador para no repetir perfiles
    let h = (seed + i * 2654435761) >>> 0;
    const jitter = ((h >>> 8) % 3) - 1; // -1..1
    const base = ARCH[pos.role];
    const stat = (k: keyof Stats) => clamp10(base[k] + (bias[k] ?? 0) + ((h >>> 16) % 2 ? 0 : jitter));
    return {
      name: team.roster[i] ?? `Jugador ${i + 1}`,
      num: NUMBERS_FIVE[i] ?? i + 1,
      role: pos.role,
      stats: {
        speed: stat('speed'),
        pass: stat('pass'),
        shoot: stat('shoot'),
        defense: stat('defense'),
        control: stat('control'),
        stamina: stat('stamina'),
        reflexes: pos.role === 'POR' ? clamp10(8 + ((h >>> 20) % 3)) : 1
      }
    };
  });
}

/* ------------------------------------------------------------------ */
/* Colocación inicial                                                  */
/* ------------------------------------------------------------------ */

/** Posición absoluta (col,row) de una posición normalizada para un lado. */
export function absolutePos(norm: { x: number; y: number }, team: TeamId): { col: number; row: number } {
  const col = team === 0 ? norm.x * FIELD_COLS : (1 - norm.x) * FIELD_COLS;
  const row = norm.y * FIELD_ROWS;
  return {
    col: Math.max(0, Math.min(FIELD_COLS - 1, Math.round(col))),
    row: Math.max(0, Math.min(FIELD_ROWS - 1, Math.round(row)))
  };
}

/** Coloca a los 10 jugadores (5 por equipo) según sus formaciones. */
export function placeTeams(state: GameState, cfg: MatchConfig): void {
  state.players = [];
  let id = 0;
  const build = (setup: typeof cfg.home, t: TeamId) => {
    const team = teamById(setup.teamId);
    const roster = buildRoster(team, setup.formation);
    const f = formationById(setup.formation);
    roster.forEach((bp, i) => {
      const abs = absolutePos(f.positions[i], t);
      state.players.push({
        id,
        team: t,
        name: bp.name,
        num: bp.num,
        role: bp.role,
        stats: bp.stats,
        pos: abs,
        hasMoved: false,
        hasActed: false,
        stance: 'none'
      });
      id++;
    });
  };
  build(cfg.home, 0);
  build(cfg.away, 1);
  resolveOverlaps(state);
}

/**
 * Colocación de saque de centro: las formaciones de ambos equipos, el balón
 * en el centro y el jugador más adelantado del equipo que saca, junto al balón.
 */
export function applyKickoff(state: GameState, kickTeam: TeamId): void {
  const cfg = state.config;
  placeTeams(state, cfg);
  state.ball.pos = { ...KICKOFF_CELL };
  state.ball.carrier = null;
  for (const p of state.players) {
    p.hasMoved = false;
    p.hasActed = false;
  }
  // El equipo que saca coloca a su jugador más adelantado junto al balón.
  let striker: Player | null = null;
  let bestX = -1;
  for (const p of state.players) {
    if (p.team !== kickTeam) continue;
    const adv = kickTeam === 0 ? p.pos.col : FIELD_COLS - 1 - p.pos.col;
    if (p.role === 'POR') continue;
    if (adv > bestX) {
      bestX = adv;
      striker = p;
    }
  }
  if (striker) {
    const candidates: Array<{ col: number; row: number }> = [
      { col: KICKOFF_CELL.col + (kickTeam === 0 ? -1 : 1), row: KICKOFF_CELL.row },
      { col: KICKOFF_CELL.col, row: KICKOFF_CELL.row - 1 },
      { col: KICKOFF_CELL.col, row: KICKOFF_CELL.row + 1 },
      { col: KICKOFF_CELL.col + (kickTeam === 0 ? -1 : 1), row: KICKOFF_CELL.row - 1 },
      { col: KICKOFF_CELL.col + (kickTeam === 0 ? -1 : 1), row: KICKOFF_CELL.row + 1 }
    ];
    for (const c of candidates) {
      if (inField(c) && !isOccupied(state, c as { col: number; row: number }, striker.id)) {
        striker.pos = { ...c };
        break;
      }
    }
  }
  // Nadie (excepto el jugador del saque) invade la zona central del balón:
  // quien esté a <=1 casilla del centro retrocede hacia su portería.
  for (const p of state.players) {
    if (striker && p.id === striker.id) continue;
    if (Math.abs(p.pos.col - KICKOFF_CELL.col) <= 1 && Math.abs(p.pos.row - KICKOFF_CELL.row) <= 1) {
      const back = p.team === 0 ? -1 : 1;
      const colOut = (col: number): boolean =>
        Math.abs(col - KICKOFF_CELL.col) > 1 || Math.abs(p.pos.row - KICKOFF_CELL.row) > 1;
      const candidates = [
        { col: p.pos.col + back * 2, row: p.pos.row },
        { col: p.pos.col + back * 2, row: p.pos.row - 1 },
        { col: p.pos.col + back * 2, row: p.pos.row + 1 },
        { col: p.pos.col + back * 4, row: p.pos.row },
        { col: p.pos.col + back * 4, row: p.pos.row - 1 },
        { col: p.pos.col + back * 4, row: p.pos.row + 1 },
        { col: p.pos.col + back * 6, row: p.pos.row }
      ];
      for (const dest of candidates) {
        if (
          inField(dest) &&
          !isOccupied(state, dest, p.id) &&
          colOut(dest.col)
        ) {
          p.pos = dest;
          break;
        }
      }
    }
  }
  resolveOverlaps(state);
}

/** Mueve jugadores que hayan caído en la misma casilla a la casilla libre más cercana. */
export function resolveOverlaps(state: GameState): void {
  const seen = new Set<string>();
  const occupied = new Set<string>();
  for (const p of state.players) {
    const key = `${p.pos.col},${p.pos.row}`;
    if (!seen.has(key)) {
      seen.add(key);
      occupied.add(key);
      continue;
    }
    const dest = nearestFreeCell(state, p.pos, occupied);
    p.pos = dest;
    occupied.add(`${dest.col},${dest.row}`);
  }
}

/** Busca la casilla libre más cercana a `from` (evita las del set dado). */
export function nearestFreeCell(state: GameState, from: { col: number; row: number }, extraBlocked?: Set<string>): { col: number; row: number } {
  const free = allCells().filter((c) => {
    if (extraBlocked?.has(`${c.col},${c.row}`)) return false;
    return !isOccupied(state, c);
  });
  if (free.length === 0) return from;
  let best = free[0];
  let bd = cheby(from, free[0]);
  for (const c of free) {
    const d = cheby(from, c);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}
