/**
 * Tipos del dominio del juego. Módulo puro: sin DOM ni dependencias externas.
 */

export type TeamId = 0 | 1;

/**
 * Roles de los futbolistas.
 * POR  portero · LD lateral derecho · DFC central · LI lateral izquierdo
 * MCD pivote · MC centro · ED extremo derecho · EI extremo izquierdo · DC delantero
 */
export type Role = 'POR' | 'LD' | 'DFC' | 'LI' | 'MCD' | 'MC' | 'ED' | 'EI' | 'DC';

/** Atributos del futbolista (enteros 1..10). reflexes solo es relevante para el portero. */
export interface Stats {
  speed: number;
  pass: number;
  shoot: number;
  defense: number;
  control: number;
  stamina: number;
  reflexes: number;
}

export interface Cell {
  col: number;
  row: number;
}

/** Postura defensiva activa: 'cut' = plantado para cortar pases/tiros rivales. */
export type Stance = 'none' | 'cut';

export interface Player {
  id: number;
  team: TeamId;
  name: string;
  num: number;
  role: Role;
  stats: Stats;
  pos: Cell;
  /** Indicadores por turno: se limpian en cada cambio de turno. */
  hasMoved: boolean;
  hasActed: boolean;
  /** Postura defensiva elegida (persiste durante el turno del rival). */
  stance: Stance;
}

export interface Ball {
  /** null = balón suelto (nadie lo controla). */
  carrier: number | null;
  pos: Cell;
}

export interface TeamStats {
  shots: number;
  onTarget: number;
  possessionTurns: number;
  steals: number;
}

export type MatchMode = 'hotseat' | 'ai' | 'aivsai';
export type AiLevel = 'easy' | 'normal' | 'hard';
export type AiTeam = 0 | 1 | null;
export type MatchPhase = 'playing' | 'fulltime';

export interface TeamSetup {
  /** id del equipo en el catálogo (src/game/formations.ts). */
  teamId: string;
  formation: string;
}

export interface MatchConfig {
  home: TeamSetup;
  away: TeamSetup;
  mode: MatchMode;
  /** En modo 'ai', el equipo controlado por la IA. */
  aiTeam: AiTeam;
  aiLevel: AiLevel;
  seed: number;
  /** El empate se desempata con la tanda 1v1 jugada en el tablero (Copa Capello). */
  cup?: boolean;
}

export type Phase = 'playing' | 'fulltime' | 'penalti';

export interface LogEntry {
  min: number;
  msg: string;
}

export interface GameState {
  /** Version del formato de guardado. */
  v: 1;
  config: MatchConfig;
  phase: Phase;
  /** Segmentos de la barra de acciones especiales (0..METER_MAX). */
  meter: [number, number];
  /** Usos de acciones especiales restantes por equipo (Billetes, Vaselina, Hachazo). */
  specials: [number, number];
  /** Defensa endurecida por equipo: activa durante el turno rival y a consumo. */
  harden: [boolean, boolean];
  /** Fase de penalti: id del lanzador y del portero (designados). */
  penaltyShooterId: number | null;
  penaltyKeeperId: number | null;
  /** Ganador de un desempate por penalti (para copa/torneo). */
  penaltyWinner: TeamId | null;
  /** Contadores de la tanda: lanzamientos y goles por equipo. */
  penaltyShots: [number, number];
  penaltyKicks: [number, number];
  /** Paso de cada tanda: primero se adelanta el portero (1 PA), luego lanza (3 PA). */
  penaltyStep: 'keeper' | 'shooter';
  currentTeam: TeamId;
  /** Puntos de acción disponibles para currentTeam. */
  ap: number;
  /** Número de turno por equipo dentro del medio (0..14). */
  turnInHalf: number;
  /** Turnos por equipo consumidos en total (0..30). */
  teamTurns: number;
  half: 1 | 2;
  score: [number, number];
  players: Player[];
  ball: Ball;
  message: string;
  log: LogEntry[];
  stats: [TeamStats, TeamStats];
  /** Estado del generador aleatorio (mulberry32). */
  rng: number;
  /** Última razón de la salida a 'fulltime' (solo informativa para la UI). */
  finishedMinutes: number;
}

/** Acciones que puede solicitar la UI o la IA sobre el estado. */
export type ActionType = 'move' | 'pass' | 'shoot' | 'steal' | 'cut';

/** Tipos de disparo: normal, cañonazo «Tiro Billetes» y «Vaselina». */
export type ShotKind = 'normal' | 'billetes' | 'vaselina';

/** Eventos replicados a la UI para animaciones y sonidos. */
export type GameEvent =
  | { type: 'move'; playerId: number; path: Cell[]; team: TeamId }
  | { type: 'pass'; from: Cell; to: Cell; success: boolean; midpoint: Cell }
  | { type: 'shot'; shooterId: number; kind: ShotKind; target: Cell; outcome: ShotOutcome; ballDest: Cell | null; goal: boolean }
  | { type: 'steal'; defenderId: number; success: boolean; hachazo?: boolean }
  | { type: 'cut'; defenderId: number; failed: boolean }
  /** Acción de endurecer defensa (consume 1 PA del equipo defensor). */
  | { type: 'harden'; team: TeamId }
  | { type: 'penalty'; shooterId: number; keeperId: number; outcome: 'pending' | 'scored' | 'stopped' }
  /** Resultado de un lanzamiento de la tanda (`decided` = se acabó el desempate). */
  | { type: 'penaltyKick'; team: TeamId; scored: boolean; decided: boolean }
  | { type: 'pickup'; playerId: number }
  /** La barra llena concede una acción especial extra. */
  | { type: 'meter'; team: TeamId; meter: number; full: boolean }
  | { type: 'goal'; team: TeamId }
  | { type: 'turn'; team: TeamId }
  | { type: 'halftime' }
  | { type: 'fulltime' }
  /** Saque de centro / descanso: ambos equipos recolocados, `team` saca. */
  | { type: 'reset'; team: TeamId }
  | { type: 'sound'; name: SoundName };

export type ShotOutcome = 'goal' | 'save' | 'off' | 'block' | 'rebound';
export type SoundName =
  | 'move' | 'pass' | 'passFail' | 'shot' | 'shotSpecial' | 'goal' | 'save'
  | 'steal' | 'stealFail' | 'cut' | 'turn' | 'pickup' | 'kickoff' | 'fulltime';

/** Resultado estándar de una acción del motor. */
export interface ActionResult {
  ok: boolean;
  /** Código machine-legible del error (para la UI). */
  code?: MoveErrorCode | PassErrorCode | ShootErrorCode | StealErrorCode | CutErrorCode | string;
  message: string;
  events: GameEvent[];
}

export type MoveErrorCode =
  | 'not_your_turn' | 'phase_ended' | 'no_ap' | 'already_moved'
  | 'not_reachable' | 'occupied' | 'unknown_player';
export type PassErrorCode =
  | 'not_your_turn' | 'phase_ended' | 'no_ap' | 'already_acted'
  | 'no_ball' | 'bad_target' | 'too_far' | 'unknown_player';
export type ShootErrorCode =
  | 'not_your_turn' | 'phase_ended' | 'no_ap' | 'already_acted' | 'no_ball' | 'no_special';
export type StealErrorCode =
  | 'not_your_turn' | 'phase_ended' | 'no_ap' | 'already_acted' | 'no_carrier' | 'too_far' | 'same_team';
export type HackErrorCode =
  | 'not_your_turn' | 'phase_ended' | 'no_ap' | 'already_acted' | 'no_carrier'
  | 'too_far' | 'same_team' | 'no_special';
export type HardenErrorCode =
  | 'not_your_turn' | 'phase_ended' | 'no_ap';
export type PenaltyErrorCode =
  | 'penalty_step' | 'bad_player' | 'penalty_bad_dest' | 'penalty_no_shooter'
  | 'not_your_turn' | 'no_ap' | 'phase_ended';
export type CutErrorCode =
  | 'not_your_turn' | 'phase_ended' | 'no_ap' | 'already_acted' | 'no_carrier' | 'too_far' | 'unknown_player';
