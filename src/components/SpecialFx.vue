<script setup lang="ts">
/**
 * Modal animado de acción especial: estalla en pantalla cuando alguien
 * suelta un Tiro Billetes, una Vaselina o un Hachazo. Puramente
 * cosmético (la lógica queda en el motor) y se autodisuelve.
 */
defineProps<{
  kind: 'billetes' | 'vaselina' | 'hachazo';
  icon: string;
  title: string;
  sub: string;
}>();
</script>

<template>
  <div class="special-layer" :class="kind">
    <div class="special-card">
      <div class="burst" aria-hidden="true">
        <i v-for="n in 8" :key="n" class="spark" :style="{ '--i': n }"></i>
      </div>
      <div class="icon">{{ icon }}</div>
      <div class="title">{{ title }}</div>
      <div class="sub">{{ sub }}</div>
    </div>
  </div>
</template>

<style scoped>
.special-layer {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(6, 16, 11, 0.55);
  backdrop-filter: blur(2px);
  z-index: 60;
  pointer-events: none;
  animation: layer-fade 2.2s ease forwards;
}
.special-card {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 0.3rem;
  padding: 1.4rem 2.4rem;
  border-radius: 18px;
  background: linear-gradient(160deg, rgba(16, 37, 27, 0.97), rgba(24, 56, 40, 0.97));
  border: 2px solid var(--gold);
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.65);
  animation: card-pop 0.42s cubic-bezier(0.18, 1.42, 0.6, 1) both, card-wobble 2.2s ease 0.42s forwards;
}
.burst { position: absolute; inset: 0; pointer-events: none; }
.spark {
  position: absolute;
  top: 50%; left: 50%;
  width: 10px; height: 10px;
  border-radius: 50%;
  background: var(--gold);
  transform: rotate(calc(var(--i) * 45deg)) translateY(0) scale(0);
  animation: spark-fly 0.9s ease-out 0.15s forwards;
}
.icon { font-size: 3.2rem; animation: icon-spin 1.1s ease both; }
.title {
  font-family: 'Bebas Neue', 'Arial Narrow', sans-serif;
  letter-spacing: 0.22em;
  font-size: 2rem;
  color: var(--gold);
  text-shadow: 0 3px 10px rgba(0, 0, 0, 0.55);
}
.sub { color: var(--text-dim); font-size: 0.9rem; max-width: 26ch; text-align: center; }

/* color por modalidad */
.special-layer.billetes .special-card { border-color: #79d98a; }
.special-layer.billetes .spark { background: #79d98a; }
.special-layer.vaselina .special-card { border-color: #8ec6ff; }
.special-layer.vaselina .spark { background: #8ec6ff; }
.special-layer.hachazo .special-card { border-color: #ff8b6b; }
.special-layer.hachazo .spark { background: #ff8b6b; }

@keyframes layer-fade { 0%, 78% { opacity: 1; } 100% { opacity: 0; } }
@keyframes card-pop { 0% { transform: scale(0.55) rotate(-4deg); opacity: 0; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
@keyframes card-wobble { 0%, 100% { transform: scale(1); } 88% { transform: scale(0.96); } }
@keyframes spark-fly {
  0% { transform: rotate(calc(var(--i) * 45deg)) translateY(0) scale(0); opacity: 1; }
  100% { transform: rotate(calc(var(--i) * 45deg)) translateY(-70px) scale(1); opacity: 0; }
}
@keyframes icon-spin {
  0% { transform: rotate(-24deg) scale(0.4); opacity: 0; }
  60% { transform: rotate(10deg) scale(1.2); opacity: 1; }
  100% { transform: rotate(0) scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .special-layer, .special-card, .spark, .icon { animation-duration: 0.01s !important; }
}
</style>
