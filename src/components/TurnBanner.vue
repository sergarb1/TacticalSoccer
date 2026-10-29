<script setup lang="ts">
import { TEAM_COLORS } from '../game/config';
import type { TeamId } from '../game/types';

defineProps<{
  text: string | null;
  kind: 'turn' | 'goal' | 'info';
  team?: TeamId | null;
}>();
</script>

<template>
  <transition name="fade">
    <div v-if="text" class="banner-layer" :class="kind === 'goal' ? 'goal' : ''">
      <div
        class="turn-banner banner-body"
        :style="kind === 'goal' && team !== null && team !== undefined
          ? { background: `linear-gradient(90deg, ${TEAM_COLORS[team].dark}, ${TEAM_COLORS[team].main})` }
          : {}"
      >
        {{ kind === 'goal' ? '¡GOL!' : '' }} {{ text }}
      </div>
    </div>
  </transition>
</template>

<style scoped>
.banner-layer {
  position: fixed;
  inset-inline: 0;
  top: 16%;
  display: flex;
  justify-content: center;
  pointer-events: none;
  z-index: 40;
}
.banner-body {
  padding: 0.9rem 2.2rem;
  font-size: 1.6rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  border-radius: 14px;
  background: linear-gradient(90deg, rgba(16, 37, 27, 0.95), rgba(24, 56, 40, 0.95));
  border: 1px solid var(--panel-border);
  box-shadow: var(--shadow);
}
.goal .banner-body { color: #fff; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6); }
</style>
