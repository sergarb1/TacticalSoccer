<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { game, pushAmbientLine } from '../composables/useGame';

const props = defineProps<{ state: { teamTurns: number } }>();

const MINUTES_PER_TURN = 3;
const current = computed(() => game.commentary.value[0] ?? null);
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
    <span class="comm-min">📻 {{ minute }}'</span>
    <p v-if="current" :key="current.id" class="comm-text">{{ current.text }}</p>
    <p v-else class="comm-text comm-idle">Los locutores ajustan sus auriculares…</p>
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
  gap: 0.6rem;
  padding: 0.45rem 0.9rem calc(0.45rem + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, rgba(10, 22, 15, 0.94), rgba(6, 14, 10, 0.97));
  border-top: 2px solid rgba(255, 255, 255, 0.12);
  max-width: 1100px;
  margin: 0 auto;
}
.comm-min {
  flex: 0 0 auto;
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--gold);
  white-space: nowrap;
}
.comm-text {
  margin: 0;
  font-size: 0.88rem;
  font-style: italic;
  color: #f2efe6;
  animation: comm-in 0.35s ease;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.comm-idle { color: rgba(242, 239, 230, 0.55); }
@keyframes comm-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}
</style>
