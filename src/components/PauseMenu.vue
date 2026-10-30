<script setup lang="ts">
import { computed } from 'vue';
import { useSettings } from '../composables/useSettings';

const settings = useSettings();

const emit = defineEmits<{
  (e: 'resume'): void;
  (e: 'quit'): void;
}>();

const helpTopics = [
  'Cada turno tienes 3 PA (puntos de acción).',
  'Mover, pasar, chutar y defender cuestan 1 PA.',
  'Un futbolista solo puede moverse o actuar una vez por turno.',
  'Muévete sobre el balón suelto para controlarlo.',
  'Los pases pueden ser interceptados: mira el % antes de decidir.',
  'A mayor distancia y ángulo, menor probabilidad de gol.',
  'Los defensores cercanos al portador presionan y pueden robar.'
];

const volumePercent = computed({
  get: () => Math.round(settings.volume * 100),
  set: (v: number) => (settings.volume = v / 100)
});
</script>

<template>
  <div class="pause-overlay">
    <div class="panel pause-card">
      <h2>Pausa</h2>
      <button class="gold big" @click="emit('resume')">▶ Reanudar</button>

      <div class="setting-row">
        <label>
          <input type="checkbox" v-model="settings.sound" />
          Efectos de sonido
        </label>
      </div>
      <div class="setting-row">
        <label>
          <input type="checkbox" v-model="settings.music" />
          Música de fondo (estadio)
        </label>
      </div>
      <div class="setting-row volume">
        <span>Volumen</span>
        <input type="range" min="0" max="100" v-model.number="volumePercent" />
        <span class="pct">{{ volumePercent }}%</span>
      </div>
      <div class="setting-row">
        <label>
          <input type="checkbox" v-model="settings.animations" />
          Animaciones
        </label>
      </div>
      <div class="setting-row">
        <label>
          <input type="checkbox" v-model="settings.haptics" />
          Vibración (móvil)
        </label>
      </div>

      <details class="help">
        <summary>¿Cómo se juega?</summary>
        <ul>
          <li v-for="(t, i) in helpTopics" :key="i">{{ t }}</li>
        </ul>
      </details>

      <button class="quit" @click="emit('quit')">Abandonar la partida</button>
    </div>
  </div>
</template>

<style scoped>
.pause-overlay {
  position: fixed; inset: 0;
  display: grid; place-items: center;
  background: rgba(5, 14, 9, 0.66);
  backdrop-filter: blur(2px);
  z-index: 60;
}
.pause-card {
  padding: 1.6rem;
  display: grid; gap: 0.8rem;
  width: min(94vw, 380px);
}
h2 { text-align: center; }
.big { width: 100%; }
.setting-row { display: flex; align-items: center; gap: 0.6rem; font-size: 0.9rem; }
.setting-row label { display: flex; gap: 0.45rem; align-items: center; }
.volume input[type='range'] { flex: 1; }
.pct { width: 42px; text-align: right; color: var(--text-dim); font-size: 0.8rem; }
.help summary { cursor: pointer; font-size: 0.9rem; color: var(--gold); }
.help ul { margin: 0.4rem 0 0; padding-left: 1.1rem; color: var(--text-dim); font-size: 0.8rem; display: grid; gap: 0.25rem; }
.quit { color: var(--danger); border-color: var(--danger); }
</style>
