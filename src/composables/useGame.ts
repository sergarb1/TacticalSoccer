/**
 * Tienda central del juego (composición Vue). Separa UI de lógica:
 * toda regla vive en src/game; aquí solo se coordina selección, modos de
 * interacción, la ejecución de la IA, sonidos, guardado y animaciones.
 */
import { computed, reactive, ref, watch } from 'vue';
import {
  createMatch, doMove, doPass, doShoot, doSteal, doCut, doHack, doHarden, endTurn, teamLabel
} from '../game/match';
import { reachable } from '../game/movement';
import { passOptionsFor } from '../game/passing';
import { readShot } from '../game/shooting';
import { stealChance, stealTargets, cutTargets, hackTargets } from '../game/defense';
import { CUT_RANGE, HACK_RANGE, HACK_BONUS } from '../game/config';
import { getPlayer } from '../game/rules';
import {
  enterPenalties, doPenaltyKeeperMove, doPenaltyShooterMove, doPenaltyShot, advancePenalty,
  penaltyChance, penaltyMoveTargets, penaltyGuard
} from '../game/penalties';
import { playSound } from '../game/sounds';
import { startMusic, stopMusic, setMusicVolume } from '../game/music';
import { saveMatch, clearSavedMatch, loadSavedMatch } from '../game/serialize';
import { useSettings } from './useSettings';
import { nextAiAction, nextAiPenaltyAction, aiControlsTeam } from '../ai/strategy';
import type { AiDecision } from '../ai/strategy';
import { commentaryForEvent, ambientLine, type Line } from '../game/commentary';
import type { Cell, GameEvent, GameState, MatchConfig, Phase, ShotKind, TeamId } from '../game/types';

export type InteractionMode = 'idle' | 'moving' | 'passing' | 'stealing' | 'shooting' | 'cutting' | 'hacking';

/** Modalidades del modal de especiales. */
type SpecialFxKind = 'billetes' | 'vaselina' | 'hachazo';

export interface UiState {
  selectedId: number | null;
  mode: InteractionMode;
  turnBanner: string | null;
  busyAi: boolean;
  gameOver: boolean;
}

const g = {
  state: ref<GameState | null>(null),
  ui: reactive<UiState>({
    selectedId: null,
    mode: 'idle',
    turnBanner: null,
    busyAi: false,
    gameOver: false
  }),
  /** Casillas resaltadas como destinos de movimiento válido. */
  highlightCells: ref<Cell[]>([]),
  /** Balón visual en vuelo (para disparos). */
  ballFx: ref<{ target: Cell; until: number } | null>(null),
  /** Banner dramático de la tanda de penaltis. */
  penaltyBanner: ref<{ text: string; team: TeamId | null; kind: 'goal' | 'info' } | null>(null),
  /** Modal animado de acción especial (Tiro Billetes, Vaselina, Hachazo). */
  specialFx: ref<{ kind: SpecialFxKind; icon: string; title: string; sub: string } | null>(null),
  /** Últimas frases del narrador (la [0] es la más reciente). */
  commentary: ref<Line[]>([])
};

let lineId = 0;
function pushLine(text: string, kind: Line['kind']): void {
  g.commentary.value = [{ id: ++lineId, text, kind }, ...g.commentary.value].slice(0, 4);
}

export const game = g;

const settings = useSettings();

/* Música de fondo: reacciona al ajuste y al volumen en caliente. */
watch(
  () => settings.music,
  (on) => {
    if (on && g.state.value) startMusic(settings.volume);
    else if (!on) stopMusic();
  }
);
watch(
  () => settings.volume,
  (v) => {
    if (settings.music && g.state.value) setMusicVolume(v);
  }
);

function soundOpt(): { enabled: boolean; volume: number } {
  return { enabled: settings.sound, volume: settings.volume };
}

function duration(ms: number): number {
  return settings.animations ? ms : 0;
}

/** Vibración háptica en móvil (ignorada en escritorio y si está apagada). */
function vibrate(pattern: number | number[]): void {
  if (!settings.haptics || typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* algunos navegadores la bloquean sin gesto previo: silencio */
  }
}

export function haptic(pattern: number | number[]): void {
  vibrate(pattern);
}

/** Etiquetas del modal de especiales (icono, título y subtítulo). */
const SPECIAL_FX: Record<SpecialFxKind, { icon: string; title: string; sub: string }> = {
  billetes: { icon: '💸', title: 'TIRO BILLETES', sub: '¡Faro de billetes directo a la red: riesgo y gloria a partes iguales!' },
  vaselina: { icon: '🕊️', title: 'VASELINA', sub: 'El balón se va por arriba: o es golazo del año o risa del estadio.' },
  hachazo: { icon: '⚡', title: 'HACHAZO', sub: '¡A por el balón con guantazo! Roba con más garra y desde más lejos.' }
};

let specialFxTimer: number | null = null;
/** Lanza el modal animado de la acción especial (se autodisuelve). */
function showSpecialFx(kind: 'billetes' | 'vaselina' | 'hachazo'): void {
  const fx = SPECIAL_FX[kind];
  if (!fx) return;
  if (specialFxTimer !== null) window.clearTimeout(specialFxTimer);
  g.specialFx.value = { kind, ...fx };
  specialFxTimer = window.setTimeout(() => {
    g.specialFx.value = null;
    specialFxTimer = null;
  }, 2200);
}

/** Muestra el banner de tanda y lo oculta al rato. */
function flashPenaltyBanner(b: { text: string; team: TeamId | null; kind: 'goal' | 'info' }): void {
  g.penaltyBanner.value = b;
  window.setTimeout(() => (g.penaltyBanner.value = null), 2800);
}

/** Equipo de un jugador del estado (para colorear el banner de tanda). */
function teamOfPlayer(id: number): TeamId | null {
  const s = g.state.value;
  if (!s) return null;
  return s.players.find((p) => p.id === id)?.team ?? null;
}

/** Consume los eventos del motor para sonidos, animaciones y narración. */
function applyEvents(events: GameEvent[]): void {
  const s = g.state.value;
  for (const e of events) {
    if (e.type === 'sound') playSound(e.name, soundOpt());
    // modal de acción especial: tiros especiales y hachazo
    if (e.type === 'shot' && e.kind !== 'normal') showSpecialFx(e.kind);
    if (e.type === 'steal' && e.hachazo) showSpecialFx('hachazo');
    // drama de la tanda: banner grande por lanzamiento y desenlace
    if (e.type === 'penalty') {
      if (e.outcome === 'pending') {
        flashPenaltyBanner({ text: '⚽ ¡PENALTI!', team: null, kind: 'info' });
      } else if (e.outcome === 'scored') {
        const t = teamOfPlayer(e.shooterId);
        flashPenaltyBanner({ text: t === 0 ? 'GOL DE PENALTI · ROJOS' : 'GOL DE PENALTI · AZULES', team: t, kind: 'goal' });
      } else {
        const kt = teamOfPlayer(e.keeperId);
        flashPenaltyBanner({ text: '🧤 ¡PARADÓN! SE LA SACA EL PORTERO', team: kt, kind: 'goal' });
      }
    }
    if (e.type === 'fulltime' && s && s.penaltyWinner !== null) {
      const w = s.penaltyWinner;
      flashPenaltyBanner({
        text: w === 0 ? '¡LA TANDA DECIDE! GANAN LOS ROJOS 🏆' : '¡LA TANDA DECIDE! GANAN LOS AZULES 🏆',
        team: w,
        kind: 'goal'
      });
    }
    // vibración según el tipo de evento (gol/parada/robo tienen patrón propio)
    if (e.type === 'sound') {
      if (e.name === 'goal') vibrate([80, 60, 140]);
      else if (e.name === 'save' || e.name === 'steal') vibrate(40);
      else if (e.name === 'shot') vibrate(30);
    }
    if (e.type === 'shot' && e.ballDest) {
      g.ballFx.value = { target: e.outcome === 'goal' ? e.target : e.ballDest, until: Date.now() };
      window.setTimeout(() => (g.ballFx.value = null), duration(520) + 20);
    }
    // narración: el 'shot' narra también los goles (con el tipo de tiro);
    // el evento 'goal' simple se deja al banner
    if (s && !(e.type === 'shot' && e.outcome === 'goal' && e.kind === 'normal')) {
      const line = commentaryForEvent(s, e);
      if (line) pushLine(line, 'event');
    }
  }
}

/** Casillas alcanzables por el jugador seleccionado (para resaltar). */
export function moveHighlights(): Cell[] {
  const state = g.state.value;
  if (!state || g.ui.mode !== 'moving') return [];
  // En la tanda de penaltis: los destinos legales del activo actual.
  if (state.phase === 'penalti') return penaltyMoveTargets(state);
  if (state.phase !== 'playing') return [];
  if (g.ui.selectedId === null || state.ap <= 0) return [];
  const p = getPlayer(state, g.ui.selectedId);
  if (!p || p.team !== state.currentTeam || p.hasMoved) return [];
  return [...reachable(state, p).paths.values()].map((path) => path[path.length - 1]);
}

/* Inicio y ciclo de partida ------------------------------------------- */

export function startMatch(cfg: MatchConfig): void {
  clearSavedMatch();
  g.state.value = createMatch(cfg);
  if (settings.music) startMusic(settings.volume);
  g.ui.selectedId = null;
  g.ui.mode = 'idle';
  g.ui.gameOver = false;
  g.ui.turnBanner = null;
  g.highlightCells.value = [];
  saveMatch(g.state.value);
  // Modo espectáculo: la máquina saca y dirige ambos equipos.
  if (cfg.mode === 'aivsai') maybeDriveAi();
}

export function tryResume(): GameState | null {
  const saved = loadSavedMatch();
  if (saved) {
    g.state.value = saved;
    g.ui.selectedId = null;
    g.ui.mode = 'idle';
    g.ui.gameOver = saved.phase === 'fulltime';
    g.ui.turnBanner = null;
    g.highlightCells.value = [];
    if (!g.ui.gameOver) maybeDriveAi();
  }
  return saved;
}

export function hasSavedMatch(): boolean {
  return loadSavedMatch() !== null;
}

/** Frase ambiental del narrador (la llama la barra con su temporizador). */
export function pushAmbientLine(): void {
  const s = g.state.value;
  if (!s || s.phase !== 'playing') return;
  pushLine(ambientLine(s), 'ambient');
}

/* Selección y modos ----------------------------------------------------- */

export function selectPlayer(id: number | null): void {
  g.ui.selectedId = id;
  if (g.ui.mode !== 'idle') g.ui.mode = 'idle';
  g.highlightCells.value = [];
}

export function setMode(mode: InteractionMode): void {
  g.ui.mode = mode;
  g.highlightCells.value = mode === 'moving' ? moveHighlights() : [];
}

export function cancelMode(): void {
  g.ui.mode = 'idle';
  g.highlightCells.value = [];
}

/* Interacción con el tablero -------------------------------------------- */

export function boardCellClick(cell: Cell): void {
  const s = g.state.value;
  if (!s || g.ui.busyAi) return;
  // Tanda de penaltis: el click mueve al activo de la tanda (portero o lanzador).
  if (s.phase === 'penalti') {
    if (!penaltyGuard(s).ok) return;
    const activeId = s.penaltyStep === 'keeper' ? s.penaltyKeeperId : s.penaltyShooterId;
    if (g.ui.mode !== 'moving' || g.ui.selectedId === null || g.ui.selectedId !== activeId || activeId === null) return;
    const res = s.penaltyStep === 'keeper'
      ? doPenaltyKeeperMove(s, activeId, cell)
      : doPenaltyShooterMove(s, activeId, cell);
    if (res.ok) {
      applyEvents(res.events);
      saveMatch(s);
      setMode('idle');
      checkGameOver();
      maybeDriveAi();
    } else {
      setMode('idle');
    }
    return;
  }
  if (s.phase !== 'playing') return;
  if (g.ui.mode === 'moving' && g.ui.selectedId !== null) {
    const res = doMove(s, g.ui.selectedId, cell);
    if (res.ok) {
      applyEvents(res.events);
      saveMatch(s);
      setMode('idle');
    } else {
      setMode('idle');
    }
  }
}

export function boardTokenClick(id: number): void {
  const s = g.state.value;
  if (!s || g.ui.busyAi) return;
  // En la tanda solo se puede mirar (el movimiento va por casilla).
  if (s.phase === 'penalti') {
    selectPlayer(id);
    return;
  }
  if (s.phase !== 'playing') return;
  const p = getPlayer(s, id);
  if (!p) return;

  // destino de pase
  if (g.ui.mode === 'passing' && g.ui.selectedId !== null && s.ball.carrier === g.ui.selectedId && p.team === g.state.value!.currentTeam && p.id !== g.ui.selectedId) {
    const opts = passOptionsFor(s, getPlayer(s, g.ui.selectedId)!);
    if (opts.some((o) => o.targetId === id)) {
      const res = doPass(s, g.ui.selectedId, id);
      if (res.ok) {
        applyEvents(res.events);
        saveMatch(s);
        g.ui.selectedId = s.ball.carrier ?? g.ui.selectedId;
        setMode('idle');
        return;
      }
    }
  }
  // selección simple (información propia o ajena)
  if (g.ui.selectedId === id) {
    setMode('idle');
    return;
  }
  selectPlayer(id);
}

/* Acciones del panel ------------------------------------------------------ */

export function actionMove(): void {
  setMode('moving');
}

export function actionPass(targetId: number): void {
  const s = g.state.value;
  if (!s || g.ui.selectedId === null) return;
  const res = doPass(s, g.ui.selectedId, targetId);
  if (res.ok) {
    applyEvents(res.events);
    saveMatch(s);
    g.ui.selectedId = s.ball.carrier ?? g.ui.selectedId;
  }
  setMode('idle');
}

export function shotPreview(): { goal: number; description: string } | null {
  const s = g.state.value;
  if (!s || g.ui.selectedId === null) return null;
  const p = getPlayer(s, g.ui.selectedId)!;
  if (s.ball.carrier !== p.id) return null;
  const read = readShot(s, p);
  return { goal: read.goal, description: read.description };
}

/** Las tres previsualizaciones de disparo del jugador seleccionado. */
export function shotPreviews(): {
  normal: { goal: number; description: string } | null;
  billetes: { goal: number; description: string } | null;
  vaselina: { goal: number; description: string } | null;
} | null {
  const s = g.state.value;
  if (!s || g.ui.selectedId === null) return null;
  const p = getPlayer(s, g.ui.selectedId)!;
  if (s.ball.carrier !== p.id) return null;
  const r = (k: ShotKind) => {
    const read = readShot(s, p, k);
    return { goal: read.goal, description: read.description };
  };
  return { normal: r('normal'), billetes: r('billetes'), vaselina: r('vaselina') };
}

export function actionShotArm(): void {
  const s = g.state.value;
  if (!s || g.ui.selectedId === null) {
    return;
  }
  g.ui.mode = 'shooting';
}

export function actionShotConfirm(kind: ShotKind = 'normal'): boolean {
  const s = g.state.value;
  if (!s || g.ui.selectedId === null) return false;
  const res = doShoot(s, g.ui.selectedId, kind);
  if (res.ok) {
    applyEvents(res.events);
    saveMatch(s);
    checkGameOver();
    g.ui.selectedId = s.ball.carrier;
    setMode('idle');
    return true;
  }
  return false;
}

/** Fin de partido (o entrada en la tanda si la copa lo pide). */
function checkGameOver(): void {
  const s = g.state.value;
  if (!s || s.phase !== 'fulltime') return;
  // En copa, el empate no se queda empatado: tanda de penaltis 1v1.
  if (s.config.cup && s.penaltyWinner === null && s.score[0] === s.score[1]) {
    const events = enterPenalties(s);
    applyEvents(events);
    saveMatch(s);
    g.ui.turnBanner = '¡Tanda de penaltis!';
    window.setTimeout(() => (g.ui.turnBanner = null), duration(1600) + 50);
    maybeDriveAi();
    return;
  }
  g.ui.gameOver = true;
  clearSavedMatch();
  stopMusic();
  void g.state.value; // re-leído por si la copa lo pide después
}

/** ¿Le toca a la máquina ahora mismo (cualquier modo con IA)? */
function aiHasTheBall(): boolean {
  const s = g.state.value;
  if (!s) return false;
  return aiControlsTeam(s, s.currentTeam);
}

/** Arranca el bucle de la IA si el equipo activo es máquina. */
function maybeDriveAi(): void {
  const s = g.state.value;
  if (!s || g.ui.busyAi) return;
  if (s.phase !== 'playing' && s.phase !== 'penalti') return;
  if (!aiHasTheBall()) return;
  void runAiDrive();
}

export function actionSteal(victimId: number): boolean {
  const s = g.state.value;
  if (!s || g.ui.selectedId === null) return false;
  const res = doSteal(s, g.ui.selectedId, victimId);
  if (res.ok) {
    applyEvents(res.events);
    saveMatch(s);
    setMode('idle');
    return true;
  }
  return false;
}

export function stealOpportunities(): Array<{ victimId: number; chance: number; name: string }> {
  const s = g.state.value;
  if (!s || g.ui.selectedId === null) return [];
  const d = getPlayer(s, g.ui.selectedId)!;
  return stealTargets(s, d).map((v) => ({
    victimId: v.id,
    chance: stealChance(s, d, v),
    name: v.name
  }));
}

/** Rivales con balón al alcance del hachazo y con su probabilidad premium. */
export function hackOpportunities(): Array<{ victimId: number; chance: number; name: string; dist: number }> {
  const s = g.state.value;
  if (!s || g.ui.selectedId === null) return [];
  const d = getPlayer(s, g.ui.selectedId)!;
  return hackTargets(s, d).map((v) => ({
    victimId: v.id,
    chance: Math.min(95, stealChance(s, d, v) + HACK_BONUS),
    name: v.name,
    dist: Math.max(Math.abs(d.pos.col - v.pos.col), Math.abs(d.pos.row - v.pos.row))
  }));
}

/** «Hachazo»: robo premium, gasta 1 AP y una acción especial. */
export function actionHack(victimId: number): boolean {
  const s = g.state.value;
  if (!s || g.ui.selectedId === null) return false;
  const res = doHack(s, g.ui.selectedId, victimId);
  if (res.ok) {
    applyEvents(res.events);
    saveMatch(s);
    setMode('idle');
    return true;
  }
  setMode('idle');
  return false;
}

/** Rivales con balón al alcance del corte y a cuántas casillas. */
export function cutOpportunities(): Array<{ carrierId: number; name: string; dist: number }> {
  const s = g.state.value;
  if (!s || g.ui.selectedId === null) return [];
  const d = getPlayer(s, g.ui.selectedId)!;
  return cutTargets(s, d).map((c) => ({
    carrierId: c.id,
    name: c.name,
    dist: Math.max(Math.abs(d.pos.col - c.pos.col), Math.abs(d.pos.row - c.pos.row))
  }));
}

/** Se planta a cortar (postura que cubre el turno rival). */
export function actionCut(): boolean {
  const s = g.state.value;
  if (!s || g.ui.selectedId === null) return false;
  const res = doCut(s, g.ui.selectedId);
  if (res.ok) {
    applyEvents(res.events);
    saveMatch(s);
    setMode('idle');
    return true;
  }
  return false;
}

/** «Endurecer»: 1 AP de todo el equipo; protege durante el turno rival. */
export function actionHarden(): boolean {
  const s = g.state.value;
  if (!s || s.phase !== 'playing') return false;
  const res = doHarden(s);
  if (res.ok) {
    applyEvents(res.events);
    saveMatch(s);
    return true;
  }
  return false;
}

/* Tanda de penaltis ------------------------------------------------------ */

/** Probabilidad de gol del próximo lanzamiento (para el panel). */
export function penaltyChancePreview(): number | null {
  const s = g.state.value;
  if (!s || s.phase !== 'penalti') return null;
  const shooter = s.penaltyShooterId === null ? null : getPlayer(s, s.penaltyShooterId);
  const keeper = s.penaltyKeeperId === null ? null : getPlayer(s, s.penaltyKeeperId);
  if (!shooter || !keeper) return null;
  return penaltyChance(s, shooter, keeper);
}

/** «Listo»: el paso de la tanda se da por terminado (portero o lanzador). */
export function actionPenaltyReady(): boolean {
  const s = g.state.value;
  if (!s || g.ui.busyAi) return false;
  if (!penaltyGuard(s).ok) return false;
  const res = advancePenalty(s);
  if (!res.ok) return false;
  applyEvents(res.events);
  saveMatch(s);
  setMode('idle');
  checkGameOver();
  maybeDriveAi();
  return true;
}

/** Lanzamiento del penalti con el activo de la tanda. */
export function actionPenaltyShoot(): boolean {
  const s = g.state.value;
  if (!s || g.ui.busyAi) return false;
  if (s.penaltyShooterId === null) return false;
  const res = doPenaltyShot(s, s.penaltyShooterId);
  if (!res.ok) return false;
  applyEvents(res.events);
  saveMatch(s);
  setMode('idle');
  checkGameOver();
  maybeDriveAi();
  return true;
}

/** Datos de la tanda para el panel (marcador de lanzamientos y goles). */
export function penaltyPanelInfo(): {
  active: boolean;
  step: 'keeper' | 'shooter' | 'none';
  kicks: [number, number];
  shooterName: string;
  keeperName: string;
} {
  const s = g.state.value;
  if (!s || s.phase !== 'penalti') {
    return { active: false, step: 'none', kicks: [0, 0], shooterName: '', keeperName: '' };
  }
  const shooter = s.penaltyShooterId === null ? null : getPlayer(s, s.penaltyShooterId);
  const keeper = s.penaltyKeeperId === null ? null : getPlayer(s, s.penaltyKeeperId);
  return {
    active: true,
    step: s.penaltyStep,
    kicks: [s.penaltyKicks[0], s.penaltyKicks[1]],
    shooterName: shooter?.name ?? '',
    keeperName: keeper?.name ?? ''
  };
}

export function finishTurn(): boolean {
  const s = g.state.value;
  if (!s || s.phase !== 'playing') return false;
  const res = endTurn(s);
  if (!res.ok) return false;
  // endTurn muta el estado (TS no puede verlo): relee de forma explícita
  const phaseAfter = (s as { phase: Phase }).phase;
  applyEvents(res.events);
  saveMatch(s);
  g.ui.selectedId = null;
  g.ui.mode = 'idle';
  g.highlightCells.value = [];
  if (phaseAfter === 'fulltime') {
    checkGameOver();
    return true;
  }
  g.ui.turnBanner = teamLabel(s, s.currentTeam);
  window.setTimeout(() => (g.ui.turnBanner = null), duration(1300) + 50);
  if (aiHasTheBall()) {
    void runAiDrive();
  }
  return true;
}

/* IA --------------------------------------------------------------------- */

const AI_DELAY = 640;

/**
 * Bucle maestro de la máquina: dirige acciones en el tablero, turnos y
 * (si la tanda toca) los pasos del penalti del equipo activo.
 */
async function runAiDrive(): Promise<void> {
  const s = g.state.value;
  if (!s) return;
  g.ui.busyAi = true;
  await sleep(duration(600) + 40);
  let guard = 260;
  try {
    while (guard-- > 0) {
      // Tanda de penaltis: pasos y lanzamientos del equipo máquina.
      if (s.phase === 'penalti') {
        if (!penaltyGuard(s).ok) break;
        if (!aiHasTheBall()) break;
        const d = nextAiPenaltyAction(s);
        if (d) {
          const ok = d.kind === 'penaltyMove'
            ? (s.penaltyStep === 'keeper'
              ? doPenaltyKeeperMove(s, d.playerId, d.dest).ok
              : doPenaltyShooterMove(s, d.playerId, d.dest).ok)
            : doPenaltyShot(s, d.playerId).ok;
          if (!ok) break;
          saveMatch(s);
          await sleep(duration(d.kind === 'penaltyMove' ? 700 : 950));
          continue;
        }
        const adv = advancePenalty(s);
        if (!adv.ok) break;
        applyEvents(adv.events);
        saveMatch(s);
        await sleep(duration(700));
        continue;
      }
      if (s.phase !== 'playing') break;
      if (!aiHasTheBall()) break;
      const d: AiDecision = nextAiAction(s);
      if (!d) break;
      let ok = false;
      switch (d.kind) {
        case 'move': ok = doMove(s, d.playerId, d.dest).ok; break;
        case 'pass': ok = doPass(s, d.playerId, d.targetId).ok; break;
        case 'shoot': ok = doShoot(s, d.playerId, d.shotKind ?? 'normal').ok; break;
        case 'steal': ok = doSteal(s, d.playerId, d.victimId).ok; break;
        case 'hack': ok = doHack(s, d.playerId, d.victimId).ok; break;
        case 'harden': ok = doHarden(s).ok; break;
        default: break;
      }
      if (!ok) break;
      saveMatch(s);
      await sleep(duration(AI_DELAY));
    }
  } finally {
    g.ui.busyAi = false;
    if (s.phase === 'playing' && aiHasTheBall()) finishTurn();
    // Si la IA acabó la tanda, el resultado queda gobernado por checkGameOver.
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => window.setTimeout(res, ms));
}

/** Pases disponibles para el portador seleccionado (usado por el panel). */
export function currentPassOptions(): { targetId: number; chance: number; name: string; num: number }[] {
  const s = g.state.value;
  if (!s || g.ui.mode !== 'passing') return [];
  if (g.ui.selectedId === null || s.ball.carrier !== g.ui.selectedId) return [];
  const passer = getPlayer(s, g.ui.selectedId)!;
  return passOptionsFor(s, passer).map((o) => {
    const t = getPlayer(s, o.targetId)!;
    return { targetId: o.targetId, chance: o.chance, name: t.name, num: t.num };
  });
}

export function useGame() {
  return {
    state: computed(() => g.state.value),
    ui: g.ui
  };
}
