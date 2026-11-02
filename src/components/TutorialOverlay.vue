<script setup lang="ts">
defineProps<{
  stepTitle: string;
  stepText: string;
  stepIndex: number;
  stepTotal: number;
}>();

const emit = defineEmits<{ (e: 'next'): void; (e: 'skip'): void }>();
</script>

<template>
  <div class="tut panel">
    <div class="head">
      <strong>{{ stepTitle }}</strong>
      <span class="count">{{ stepIndex + 1 }}/{{ stepTotal }}</span>
    </div>
    <p class="text">{{ stepText }}</p>
    <div class="buttons">
      <button class="gold" @click="emit('next')">Continuar</button>
      <button class="ghost" @click="emit('skip')">Saltar tutorial</button>
    </div>
  </div>
</template>

<style scoped>
.tut {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 1rem;
  width: min(94vw, 520px);
  padding: 0.8rem 1rem;
  z-index: 45;
}
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem; }
.head strong { color: var(--gold); }
.count { font-size: 0.75rem; color: var(--text-dim); }
.text { margin: 0 0 0.6rem; font-size: 0.9rem; color: var(--text); }
.buttons { display: flex; gap: 0.6rem; }

/* móvil horizontal: esquina discreta arriba a la izquierda, lejos de la radio y del FAB */
@media (max-width: 900px) and (orientation: landscape) {
  .tut {
    left: 0.6rem;
    right: auto;
    transform: none;
    bottom: 3rem;
    width: min(46vw, 320px);
    padding: 0.5rem 0.7rem;
  }
  .text { font-size: 0.78rem; }
  .buttons button { min-height: 36px; padding: 0.35rem 0.6rem; font-size: 0.8rem; }
}
</style>
