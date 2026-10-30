<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { game, pushAmbientLine } from '../composables/useGame';
import { MINUTES_PER_TURN } from '../game/config';

const props = defineProps<{ state: { teamTurns: number } }>();

const current = computed(() => game.commentary.value[0] ?? null);
const previous = computed(() => game.commentary.value[1] ?? null);
const minute = computed(() => Math.min(90, props.state.teamTurns * MINUTES_PER_TURN));

let timer = 0;
onMounted(() => {
  pushAmbientLine();
  timer = window.setInterval(pushAmbientLine, 9000);
});
onUnmounted(() => window.clearInterval(timer));
</script>

<template>
  <footer class="comm-bar" aria-live="polite">
    <div class="comm-minute">
      <span class="comm-ratio">📻 RETRANSMISIÓN</span>
      <strong class="comm-min">{{ minute }}'</strong>
    </div>
    <div class="comm-lines">
      <p v-if="current" :key="current.id" class="comm-text main">{{ current.text }}</p>
      <p v-else class="comm-text main comm-idle">Los locutores ajustan sus auriculares…</p>
      <p v-if="previous" :key="previous.id" class="comm-text echo">{{ previous.text }}</p>
    </div>
  </footer>
</template>

<style scoped>
.comm-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.55rem 1rem calc(0.55rem + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, rgba(10, 22, 15, 0.96), rgba(6, 14, 10, 0.98));
  border-top: 2px solid rgba(232, 184, 63, 0.5);
  box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.35);
  max-width: 1100px;
  margin: 0 auto;
}
.comm-minute {
  flex: 0 0 auto;
  display: grid;
  gap: 0.05rem;
  text-align: center;
}
.comm-ratio {
  font-size: 0.6rem;
  letter-spacing: 0.16em;
  font-weight: 800;
  color: var(--gold);
  white-space: nowrap;
}
.comm-min {
  font-size: 1.7rem;
  line-height: 1;
  color: var(--gold);
  font-variant-numeric: tabular-nums;
}
.comm-lines {
  min-width: 0;
  display: grid;
  gap: 0.12rem;
}
.comm-text {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.comm-text.main {
  font-size: 1.18rem;
  font-weight: 700;
  font-style: italic;
  color: #f6f2e4;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.55);
  animation: comm-in 0.35s ease;
}
.comm-text.echo {
  font-size: 0.92rem;
  color: rgba(242, 239, 230, 0.55);
  font-style: italic;
}
.comm-idle { color: rgba(242, 239, 230, 0.5); font-weight: 400; }
@keyframes comm-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}
</style>
