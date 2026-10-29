/**
 * Tienda central del juego (composición Vue). Separa UI de lógica:
 * toda regla vive en src/game; aquí solo se coordina selección, modos de
 * interacción, la ejecución de la IA, sonidos, guardado y animaciones.
 */
import { computed, reactive, ref } from 'vue';
import {
  createMatch, doMove, doPass, doShoot, doSteal, endTurn, teamLabel
} from '../game/match';
import { reachable } from '../game/movement';
import { passOptionsFor } from '../game/passing';
import { readShot } from '../game/shooting';
import { stealChance, stealTargets } from '../game/defense';
import { getPlayer } from '../game/rules';
import { playSound } from '../game/sounds';
import { saveMatch, clearSavedMatch, loadSavedMatch } from '../game/serialize';
import { useSettings } from './useSettings';
import { nextAiAction } from '../ai/strategy';
import type { AiDecision } from '../ai/strategy';
import { commentaryForEvent, ambientLine, type Line } from '../game/commentary';
import type { Cell, GameEvent, GameState, MatchConfig } from '../game/types';

export type InteractionMode = 'idle' | 'moving' | 'passing' | 'stealing' | 'shooting';

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
  /** Últimas frases del narrador (la [0] es la más reciente). */
  commentary: ref<Line[]>([])
};

let lineId = 0;
function pushLine(text: string, kind: Line['kind']): void {
  g.commentary.value = [{ id: ++lineId, text, kind }, ...g.commentary.value].slice(0, 4);
}

export const game = g;

const settings = useSettings();

function soundOpt(): { enabled: boolean; volume: number } {
  return { enabled: settings.sound, volume: settings.volume };
}

function duration(ms: number): number {
  return settings.animations ? ms : 0;
}

/** Consume los eventos del motor para sonidos, animaciones y narración. */
function applyEvents(events: GameEvent[]): void {
  const s = g.state.value;
  for (const e of events) {
    if (e.type === 'sound') playSound(e.name, soundOpt());
    if (e.type === 'shot' && e.ballDest) {
      g.ballFx.value = { target: e.outcome === 'goal' ? e.target : e.ballDest, until: Date.now() };
      window.setTimeout(() => (g.ballFx.value = null), duration(520) + 20);
    }
    // narración: el evento 'goal' ya narra el gol; el resto de disparos sí
    if (s && !(e.type === 'shot' && e.outcome === 'goal')) {
      const line = commentaryForEvent(s, e);
      if (line) pushLine(line, 'event');
    }
  }
}

/** Casillas alcanzables por el jugador seleccionado (para resaltar). */
export function moveHighlights(): Cell[] {
  const state = g.state.value;
  if (!state || state.phase !== 'playing' || g.ui.mode !== 'moving') return [];
  if (g.ui.selectedId === null || state.ap <= 0) return [];
  const p = getPlayer(state, g.ui.selectedId);
  if (!p || p.team !== state.currentTeam || p.hasMoved) return [];
  return [...reachable(state, p).paths.values()].map((path) => path[path.length - 1]);
}

/* Inicio y ciclo de partida ------------------------------------------- */

export function startMatch(cfg: MatchConfig): void {
  clearSavedMatch();
  g.state.value = createMatch(cfg);
  g.ui.selectedId = null;
  g.ui.mode = 'idle';
  g.ui.gameOver = false;
  g.ui.turnBanner = null;
  g.highlightCells.value = [];
  saveMatch(g.state.value);
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
  if (!s || s.phase !== 'playing' || g.ui.busyAi) return;
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
  if (!s || s.phase !== 'playing' || g.ui.busyAi) return;
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

export function actionShotArm(): void {
  const s = g.state.value;
  if (!s || g.ui.selectedId === null) {
    return;
  }
  g.ui.mode = 'shooting';
}

export function actionShotConfirm(): boolean {
  const s = g.state.value;
  if (!s || g.ui.selectedId === null) return false;
  const res = doShoot(s, g.ui.selectedId);
  if (res.ok) {
    applyEvents(res.events);
    saveMatch(s);
    if (s.phase === 'fulltime') g.ui.gameOver = true;
    g.ui.selectedId = s.ball.carrier;
    setMode('idle');
    return true;
  }
  return false;
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

export function finishTurn(): boolean {
  const s = g.state.value;
  if (!s || s.phase !== 'playing') return false;
  const res = endTurn(s);
  if (!res.ok) return false;
  // endTurn muta el estado (TS no puede verlo): relee de forma explícita
  const phaseAfter = (s as { phase: 'playing' | 'fulltime' }).phase;
  applyEvents(res.events);
  saveMatch(s);
  g.ui.selectedId = null;
  g.ui.mode = 'idle';
  g.highlightCells.value = [];
  if (phaseAfter === 'fulltime') {
    g.ui.gameOver = true;
    clearSavedMatch();
    return true;
  }
  g.ui.turnBanner = teamLabel(s, s.currentTeam);
  window.setTimeout(() => (g.ui.turnBanner = null), duration(1300) + 50);
  if (s.config.mode === 'ai' && s.config.aiTeam === s.currentTeam) {
    void runAiTurn();
  }
  return true;
}

/* IA --------------------------------------------------------------------- */

const AI_DELAY = 640;

async function runAiTurn(): Promise<void> {
  const s = g.state.value;
  if (!s) return;
  g.ui.busyAi = true;
  await sleep(duration(600) + 40);
  let guard = 64;
  try {
    while (
      s.phase === 'playing' &&
      s.config.mode === 'ai' &&
      s.config.aiTeam === s.currentTeam &&
      guard-- > 0
    ) {
      const d: AiDecision = nextAiAction(s);
      if (!d) break;
      let ok = false;
      switch (d.kind) {
        case 'move': ok = doMove(s, d.playerId, d.dest).ok; break;
        case 'pass': ok = doPass(s, d.playerId, d.targetId).ok; break;
        case 'shoot': ok = doShoot(s, d.playerId).ok; break;
        case 'steal': ok = doSteal(s, d.playerId, d.victimId).ok; break;
      }
      if (!ok) break;
      saveMatch(s);
      await sleep(duration(AI_DELAY));
    }
  } finally {
    g.ui.busyAi = false;
    if (s.phase === 'playing' && s.config.mode === 'ai' && s.config.aiTeam === s.currentTeam) {
      finishTurn();
    }
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
