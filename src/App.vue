<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import MainMenu from './components/MainMenu.vue';
import MatchSetup from './components/MatchSetup.vue';
import GameBoard from './components/GameBoard.vue';
import Scoreboard from './components/Scoreboard.vue';
import PlayerPanel from './components/PlayerPanel.vue';
import ActionPanel from './components/ActionPanel.vue';
import MiniMap from './components/MiniMap.vue';
import MatchResult from './components/MatchResult.vue';
import PauseMenu from './components/PauseMenu.vue';
import TurnBanner from './components/TurnBanner.vue';
import TutorialOverlay from './components/TutorialOverlay.vue';
import CommentaryBar from './components/CommentaryBar.vue';
import CupScreen from './components/CupScreen.vue';
import LeagueScreen from './components/LeagueScreen.vue';
import SpecialFx from './components/SpecialFx.vue';
import {
  game, startMatch, tryResume, selectPlayer, boardCellClick, boardTokenClick,
  actionMove, actionPass, actionShotArm, actionShotConfirm, actionSteal, actionCut,
  finishTurn, stealOpportunities, cutOpportunities, hackOpportunities, actionHack, currentPassOptions, shotPreviews, setMode, cancelMode,
  moveHighlights, actionHarden, actionPenaltyReady, actionPenaltyShoot, penaltyPanelInfo, penaltyChancePreview
} from './composables/useGame';
import type { ShotKind } from './game/types';
import type { PenaltyUi } from './components/ActionPanel.vue';
import { stopMusic } from './game/music';
import { useSettings } from './composables/useSettings';
import { useCup, recordUserResult } from './composables/useCup';
import { useLeague, recordLeagueResult } from './composables/useLeague';
import { passOptionsFor } from './game/passing';
import { getPlayer } from './game/rules';
import type { MatchConfig, TeamId } from './game/types';

const screen = ref<'menu' | 'setup' | 'game' | 'cup' | 'league'>('menu');
const paused = ref(false);
const settings = useSettings();
const setupTutorial = ref(false);

const state = computed(() => game.state.value);
const ui = game.ui;
const cupCtl = useCup();
const leagueCtl = useLeague();
const boardHighlights = computed(() => moveHighlights());

/* ------- meteoros cosméticos: el clima lo decide la semilla ------- */
const weatherClass = computed(() => {
  const s = state.value;
  if (!s) return '';
  const w = s.config.seed % 4;
  if (w === 1) return 'weather-night';
  if (w === 2) return 'weather-sunset';
  if (w === 3) return 'weather-rain';
  return ''; // soleado de la buena
});

/* ------- drama de la tanda: banner propio ------- */
const penaltyBanner = computed(() => game.penaltyBanner.value);
/* ------- modal de especiales ------- */
const specialFx = computed(() => game.specialFx.value);

/* ------- datos de la tanda para el panel ------- */
const penaltyUi = computed<PenaltyUi>(() => ({
  ...penaltyPanelInfo(),
  chance: penaltyChancePreview()
}));

/* ------- barra de consejos contextuales ------- */
const contextualTip = computed(() => {
  const s = state.value;
  if (!s) return '';
  if (s.phase === 'penalti') {
    return s.penaltyStep === 'keeper'
      ? 'Tanda: el portero se adelanta primero (1 PA) o se queda quieto; adivina la esquina para pararla.'
      : 'Tanda: muévete (1 PA) y dispara; si el portero adivina tu esquina, la para.';
  }
  switch (ui.mode) {
    case 'moving': return 'Elige una casilla blanca para moverte (gasta 1 PA).';
    case 'passing': return 'Pulsa «Pasar a…» en la lista: el % es la probabilidad de acierto.';
    case 'stealing': return 'Pulsa «Robar» en la lista de rivales al alcance.';
    case 'hacking': return 'Elige a quién soltarle el hachazo: roba con más garra y a más distancia.';
    case 'cutting': return '«Cortar» se planta ante el rival y tapa sus líneas el turno que viene.';
    case 'shooting': return 'Tiro normal (1 PA), Tiro Billetes y Vaselina (2 PA): el más caro arriesga más, pero hace más daño.';
    default: break;
  }
  if (s.ball.carrier === null) return 'Balón suelto: lleva una ficha hasta su rombo dorado para controlarlo.';
  if (ui.selectedId ===null) return 'Pulsa una ficha con anillo blanco: tienes 3 PA para mover, pasar, chutar o defender.';
  const sel = s.players.find((p) => p.id === ui.selectedId);
  if (sel && sel.team === s.currentTeam && s.currentTeam === (s.config.mode === 'ai' ? 0 : s.currentTeam)) {
    return 'Elige una acción de esta ficha en el panel de la derecha, o «Terminar turno».';
  }
  return 'Si te quedas sin ideas: mover al espacio, pasar y chutar pronto gana partidos.';
});

/* ------- aviso «¿primera vez?» ------- */
const nudge = ref(!settings.tutorialDone);
function dismissNudge(): void {
  nudge.value = false;
  settings.tutorialDone = true;
}
function startFromNudge(): void {
  startTutorial();
  nudge.value = false;
}

/* ---------------- banner de gol ---------------- */
const prevScore = ref<[number, number]>([0, 0]);
const goalBanner = ref<{ text: string; team: TeamId } | null>(null);

watch(
  () => state.value?.score,
  (score) => {
    if (!score) return;
    const s = state.value!;
    if (score[0] !== prevScore.value[0] || score[1] !== prevScore.value[1]) {
      const team: TeamId = score[0] !== prevScore.value[0] ? 0 : 1;
      goalBanner.value = {
        text: `GOL!!!! · ${team === 0 ? s.config.home.teamId : s.config.away.teamId.toUpperCase()} · ${s.score[0]}–${s.score[1]}`,
        team
      };
      window.setTimeout(() => (goalBanner.value = null), 3200);
    }
    prevScore.value = [...s.score] as [number, number];
  }
);

/* ---------------- flujo general ---------------- */

function goSetup(tutorial: boolean): void {
  setupTutorial.value = tutorial;
  screen.value = 'setup';
}

function onStart(cfg: MatchConfig): void {
  if (setupTutorial.value) {
    startMatch({ ...cfg, mode: 'ai', aiTeam: 1, aiLevel: 'easy', seed: Math.floor(Math.random() * 4294967295) });
    startTutorial();
  } else {
    startMatch(cfg);
  }
  screen.value = 'game';
}

function onResume(): void {
  const saved = tryResume();
  if (saved) {
    screen.value = 'game';
    setupTutorial.value = false;
  }
}

/* ---------------- Liga Gañán ---------------- */

function onLeaguePlay(cfg: MatchConfig): void {
  startMatch(cfg);
  screen.value = 'game';
}

/** Al terminar el partido de liga: registra y ya simula el resto de la jornada. */
watch(
  () => ui.gameOver,
  (over) => {
    const s = state.value;
    if (!over || !s || !s.config.league || screen.value !== 'game') return;
    recordLeagueResult([s.score[0], s.score[1]]);
    ui.gameOver = false;
    ui.selectedId = null;
    setMode('idle');
    stopMusic();
    screen.value = 'league';
  }
);

/* ---------------- Copa Capello ---------------- */

function onCupPlay(cfg: MatchConfig): void {
  startMatch(cfg);
  screen.value = 'game';
}

/** Al terminar el partido de Copa: registra, simula el resto y vuelve al cuadro. */
watch(
  () => ui.gameOver,
  (over) => {
    const s = state.value;
    if (!over || !s || !s.config.cup || screen.value !== 'game') return;
    const pens = s.penaltyWinner !== null ? ([s.penaltyKicks[0], s.penaltyKicks[1]] as [number, number]) : null;
    const winner: TeamId = pens !== null ? (s.penaltyWinner as TeamId) : s.score[0] > s.score[1] ? 0 : 1;
    recordUserResult([...s.score] as [number, number], winner, pens);
    cupCtl.simRound();
    ui.gameOver = false;
    ui.selectedId = null;
    setMode('idle');
    stopMusic();
    screen.value = 'cup';
  }
);

function quitToMenu(): void {
  stopMusic(); // la cobertura de fondo se apaga al volver al menú
  screen.value = 'menu';
  paused.value = false;
  setupTutorial.value = false;
  tutorial.value.index = 0;
  tutorial.value.active = false;
}

const passOptions = computed(() => {
  const s = state.value;
  if (!s || ui.selectedId === null || s.ball.carrier !== ui.selectedId) return [];
  return passOptionsFor(s, getPlayer(s, ui.selectedId)!).map((o) => {
    const t = getPlayer(s, o.targetId)!;
    return { targetId: o.targetId, chance: o.chance, name: t.name, num: t.num };
  });
});

const stealOptions = computed(() => (ui.mode === 'stealing' ? stealOpportunities() : []));
const hackOptions = computed(() => (ui.mode === 'hacking' ? hackOpportunities() : []));
const cutOptions = computed(() => (ui.mode === 'cutting' ? cutOpportunities() : []));

const shotReads = computed(() => (ui.mode === 'shooting' ? shotPreviews() : null));
const shotRead = computed(() => (ui.mode === 'shooting' ? shotPreviews()?.normal ?? null : null));

function onShot(kind: ShotKind): void {
  actionShotConfirm(kind);
}

/* ---------------- tutorial ---------------- */
interface TutStep {
  title: string;
  text: string;
  /** 'next' = avanza con botón; 'auto' = avanza cuando cambie el estado. */
  wait: 'next' | 'auto';
}

const tutorial = ref({ active: false, index: 0, snapshots: {} as Record<string, unknown> });

const TUT_STEPS: TutStep[] = [
  { title: '1 · Selecciona', text: 'Pulsa sobre tu delantero rojo más cercano al balón. Las fichas de tu equipo llevan anillo blanco.', wait: 'auto' },
  { title: '2 · Muévete', text: 'Pulsa «Mover» y elige la casilla resaltada del balón. Tu jugador lo controlará al llegar.', wait: 'auto' },
  { title: '3 · Pasa', text: 'Con la pelota, pulsa «Pasar» y elige el compañero verde de la lista. El % es la probabilidad de que llegue.', wait: 'auto' },
  { title: '4 · Avanza', text: 'Ahora «Mover» con el jugador que recibió el balón: acércate al arco rival (a la derecha).', wait: 'auto' },
  { title: '5 · ¡Chuta!', text: 'Pulsa «Chutar» para ver la probabilidad de gol y confirma el disparo.', wait: 'auto' },
  { title: '6 · Defiende', text: 'Con un jugador sin balón junto a un rival con pelota, «Defender» intenta un robo. También presiona por cercanía (ajusta pases y tiros rivales).', wait: 'next' },
  { title: '7 · Termina', text: 'Cuando agotes tus 3 PA (o quieras), pulsa «Terminar turno» y responderá la IA azul.', wait: 'auto' }
];

const tutStep = computed(() => TUT_STEPS[tutorial.value.index]);

function startTutorial(): void {
  tutorial.value = { active: true, index: 0, snapshots: {} };
  tutorial.value.snapshots = snapshot();
}

function snapshot(): Record<string, unknown> {
  const s = state.value;
  if (!s) return {};
  return {
    carrier: s.ball.carrier,
    shots: s.stats[0].shots,
    acted: s.players.filter((p) => p.team === 0 && (p.hasMoved || p.hasActed)).length,
    turnKey: `${s.currentTeam}-${s.teamTurns}`
  };
}

const changed = (k: string): boolean => {
  const s = state.value;
  if (!s) return false;
  return JSON.stringify(snapshot()[k]) !== JSON.stringify(tutorial.value.snapshots[k]);
};

watch(
  () => state.value,
  () => {
    const t = tutorial.value;
    if (!t.active || !tutStep.value || tutStep.value.wait !== 'auto') return;
    const step = t.index;
    if (changed('turnKey') && step === 0) return; // aún no: primer paso depende del clic
    let done = false;
    switch (step) {
      case 0: done = ui.selectedId !== null; break;
      case 1: done = changed('carrier') && snapshot().carrier !== null; break;
      case 2: done = changed('acted') || changed('carrier'); break;
      case 3: done = changed('acted') || changed('carrier') || changed('shots'); break;
      case 4: done = changed('shots'); break;
      case 5: done = changed('turnKey'); break;
      default: done = false;
    }
    if (done) {
      tutorial.value.snapshots = snapshot();
      tutorial.value.index = Math.min(t.index + 1, TUT_STEPS.length - 1);
      if (t.index === TUT_STEPS.length - 1 && step === TUT_STEPS.length - 1 - 1 + 1) {
        endTutorial();
      }
    }
  },
  { deep: true }
);

function tutorialNext(): void {
  const t = tutorial.value;
  t.index = Math.min(t.index + 1, TUT_STEPS.length - 1);
  t.snapshots = snapshot();
  if (t.index === TUT_STEPS.length - 1 && TUT_STEPS[t.index].wait === 'next') {
    endTutorial();
  }
}

function skipTutorial(): void {
  endTutorial();
}

function endTutorial(): void {
  tutorial.value.active = false;
  settings.tutorialDone = true;
}
</script>

<template>
  <main>
    <MainMenu
      v-if="screen === 'menu'"
      @hotseat="goSetup(false)"
      @vs-ai="goSetup(false)"
      @tutorial="goSetup(true)"
      @resume="onResume"
      @cup="screen = 'cup'"
      @league="screen = 'league'"
    />

    <MatchSetup v-else-if="screen === 'setup'" @start="onStart" @back="screen = 'menu'" />

    <CupScreen v-else-if="screen === 'cup'" @play="onCupPlay" @back="screen = 'menu'" />

    <LeagueScreen v-else-if="screen === 'league'" @play="onLeaguePlay" @back="screen = 'menu'" />

    <div v-else-if="state" class="game-screen" :class="weatherClass">
      <CommentaryBar :state="state" />
      <Scoreboard :state="state" @pause="paused = true" />

      <div class="game-layout">
        <div class="board-col">
          <GameBoard
            :state="state"
            :selected-id="ui.selectedId"
            :mode="ui.mode"
            :highlight-cells="ui.mode === 'moving' ? boardHighlights : []"
            :pass-options="passOptions"
            :shot-armed="ui.mode === 'shooting'"
            :shot-percent="shotRead?.goal ?? null"
            :ball-fx="game.ballFx.value"
            @cell-click="boardCellClick"
            @token-click="boardTokenClick"
          />

          <div class="panel tip-strip">
            <span class="tip-ico" aria-hidden="true">💡</span>
            <p class="tip-text">{{ contextualTip }}</p>
          </div>

          <div v-if="nudge && !settings.tutorialDone && !tutorial.active" class="panel nudge-card">
            <b>¿Primera vez?</b> El tutorial te enseña a jugar en 7 pasos.
            <div class="nudge-actions">
              <button class="btn gold" @click="startFromNudge">Empezar tutorial</button>
              <button class="btn ghost" @click="dismissNudge">Ocultar</button>
            </div>
          </div>
        </div>

        <div class="side-col">
          <PlayerPanel :state="state" :selected-id="ui.selectedId" />
          <ActionPanel
            :state="state"
            :selected-id="ui.selectedId"
            :mode="ui.mode"
            :pass-options-list="passOptions"
            :steal-options="stealOptions"
            :hack-options="hackOptions"
            :cut-options="cutOptions"
            :shot-reads="shotReads ?? undefined"
            @move="actionMove()"
            @pass-mode="setMode('passing')"
            @pass-to="actionPass($event)"
            @steal-mode="setMode('stealing')"
            @steal="actionSteal($event)"
            @hack-mode="setMode('hacking')"
            @hack="actionHack($event)"
            @cut-mode="setMode('cutting')"
            @cut="actionCut()"
            @shoot-arm="actionShotArm()"
            @shoot="onShot"
            @shoot-cancel="cancelMode()"
            @cancel="cancelMode()"
            @end-turn="finishTurn()"
            :penalty="penaltyUi"
            @harden="actionHarden()"
            @penalty-ready="actionPenaltyReady()"
            @penalty-shoot="actionPenaltyShoot()"
          />
          <MiniMap :state="state" @token-click="boardTokenClick" />
          <section class="panel mini-stats">
            <div class="ms-row"><span>Tiros</span><b>{{ state.stats[0].shots }}</b><b>{{ state.stats[1].shots }}</b></div>
            <div class="ms-row"><span>A puerta</span><b>{{ state.stats[0].onTarget }}</b><b>{{ state.stats[1].onTarget }}</b></div>
            <div class="ms-row"><span>Robos</span><b>{{ state.stats[0].steals }}</b><b>{{ state.stats[1].steals }}</b></div>
          </section>
        </div>
      </div>

      <TurnBanner
        :text="ui.turnBanner ?? null"
        kind="turn"
        :team="state.currentTeam"
      />
      <TurnBanner
        v-if="goalBanner && !penaltyBanner"
        :text="goalBanner.text"
        kind="goal"
        :big="true"
        :team="goalBanner.team"
      />
      <TurnBanner
        v-if="penaltyBanner"
        :text="penaltyBanner.text"
        :kind="penaltyBanner.kind"
        :big="penaltyBanner.kind === 'goal'"
        :team="penaltyBanner.team"
      />

      <SpecialFx
        v-if="specialFx"
        :kind="specialFx.kind"
        :icon="specialFx.icon"
        :title="specialFx.title"
        :sub="specialFx.sub"
      />

      <TutorialOverlay
        v-if="tutorial.active && tutStep"
        :step-title="tutStep.title"
        :step-text="tutStep.text"
        :step-index="tutorial.index"
        :step-total="TUT_STEPS.length"
        @next="tutorialNext"
        @skip="skipTutorial"
      />

      <PauseMenu v-if="paused" @resume="paused = false" @quit="quitToMenu" />

      <MatchResult
        v-if="ui.gameOver"
        :state="state"
        @again="((screen = 'setup'), setupTutorial = false)"
        @menu="quitToMenu"
      />
    </div>
  </main>
</template>

<style scoped>
.game-screen {
  max-width: 1280px;
  margin: 0 auto;
  /* hueco arriba para la narración fija (arriba) y abajo por el botón salir */
  padding: calc(4.3rem + env(safe-area-inset-top)) 0.8rem 1rem;
  display: grid;
  gap: 0.55rem;
  position: relative;
}

/* ------- meteoros cosméticos (el clima lo pinta la semilla) ------- */
.game-screen::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  opacity: 0;
}
.game-screen.weather-night::before {
  background: linear-gradient(180deg, rgba(6, 10, 30, 0.42), rgba(10, 8, 40, 0.55));
  opacity: 1;
}
.game-screen.weather-sunset::before {
  background: linear-gradient(180deg, rgba(255, 140, 60, 0.22), rgba(120, 40, 90, 0.28));
  opacity: 1;
}
.game-screen.weather-rain::before {
  background:
    repeating-linear-gradient(75deg, rgba(170, 200, 255, 0.13) 0 2px, transparent 2px 9px),
    linear-gradient(180deg, rgba(30, 50, 80, 0.3), rgba(20, 35, 60, 0.4));
  opacity: 1;
  animation: rain-drift 0.7s linear infinite;
}
.game-screen > :not(.banner-layer) { position: relative; z-index: 1; }
@keyframes rain-drift {
  from { background-position: 0 0; }
  to { background-position: -22px 40px; }
}
@media (prefers-reduced-motion: reduce) {
  .game-screen.weather-rain::before { animation: none; }
}
.scoreboard { }
.game-layout {
  display: flex;
  gap: 0.7rem;
  align-items: flex-start;
}
.board-col { flex: 1 1 auto; min-width: 0; }
.side-col {
  width: 300px;
  flex: 0 0 300px;
  display: grid;
  gap: 0.55rem;
}
.mini-stats { padding: 0.7rem 0.9rem; font-size: 0.8rem; }
.tip-strip {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.55rem 0.8rem;
  border-left: 3px solid var(--gold);
}
.tip-ico { font-size: 1rem; }
.tip-text { margin: 0; font-size: 0.82rem; color: var(--text-dim); }
.nudge-card {
  padding: 0.7rem 0.9rem;
  border-left: 3px solid var(--gold);
  font-size: 0.82rem;
  display: grid;
  gap: 0.5rem;
}
.nudge-actions { display: flex; gap: 0.5rem; }
.nudge-actions .btn { padding: 0.35rem 0.7rem; font-size: 0.75rem; }
.ms-row { display: grid; grid-template-columns: 1fr auto auto; gap: 0.9rem; padding: 1.5px 0; }
.ms-row span { color: var(--text-dim); }
.ms-row b { min-width: 26px; text-align: right; }
@media (max-width: 1080px) {
  .game-layout { flex-direction: column; }
  .side-col { width: 100%; flex: 1 1 auto; }
}
@media (max-width: 640px) {
  .side-col > .minimap,
  .side-col > .mini-stats { display: none; }
  .board-col { order: -1; }
  .game-screen { padding: calc(3.9rem + env(safe-area-inset-top)) 0.5rem 1rem; gap: 0.5rem; }
  .board-svg { max-height: 62vh; }
}
</style>
