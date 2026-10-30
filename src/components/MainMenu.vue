<script setup lang="ts">
import { hasSavedMatch } from '../composables/useGame';
import { useSettings } from '../composables/useSettings';

const emit = defineEmits<{
  (e: 'hotseat'): void;
  (e: 'vs-ai'): void;
  (e: 'tutorial'): void;
  (e: 'resume'): void;
  (e: 'cup'): void;
  (e: 'league'): void;
}>();

const hasSave = hasSavedMatch();
const settings = useSettings();
void settings;
</script>

<template>
  <div class="menu">
    <div class="hero">
      <div class="ball-logo"><span>⚽</span></div>
      <h1 class="title-logo">TACTICAL<br /><span class="accent">SOCCER</span></h1>
      <p class="edition gañan">Gañan Edition 🍊</p>
      <p class="tagline">Fútbol táctico por turnos · 3 PA por turno</p>
    </div>

    <div class="panel menu-card">
      <button class="gold big" @click="emit('vs-ai')">🎮 Contra la máquina</button>
      <button class="primary big" @click="emit('hotseat')">👥 Dos jugadores</button>
      <button class="cup big" @click="emit('cup')">🏆 Copa Capello</button>
      <button class="cup big" @click="emit('league')">🏅 Liga Gañán</button>
      <button class="big" @click="emit('tutorial')">🎓 Tutorial</button>
      <button v-if="hasSave" class="big resume" @click="emit('resume')">▶ Continuar partida</button>
      <p class="foot">Gratuito, sin cuentas y sin conexión. Código MIT.</p>
    </div>
  </div>
</template>

<style scoped>
.menu {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 2rem 1rem;
}
.hero { text-align: center; margin-bottom: 1.6rem; }
.ball-logo {
  font-size: 3rem;
  display: grid; place-items: center;
  width: 92px; height: 92px; margin: 0 auto 0.8rem;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #49a354, #1f6d2a 70%);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5), inset 0 -6px 12px rgba(0, 0, 0, 0.3);
}
.title-logo { font-size: clamp(2rem, 6vw, 3.2rem); line-height: 1.05; }
.edition {
  font-family: 'Bebas Neue', 'Arial Narrow', sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.34em;
  color: var(--gold);
  font-size: 1.05rem;
  margin-top: 0.35rem;
  border-bottom: 2px solid var(--gold);
  display: inline-block;
  padding: 0 0.35rem;
}
.tagline { color: var(--text-dim); margin-top: 0.5rem; }
.menu-card {
  display: grid;
  gap: 0.7rem;
  padding: 1.6rem;
  width: min(94vw, 360px);
}
.big { width: 100%; font-size: 1rem; }
.resume { border-color: var(--gold); color: var(--gold); }
.cup { border-color: var(--gold); color: var(--gold); }
.foot { color: var(--text-dim); font-size: 0.75rem; text-align: center; margin: 0.4rem 0 0; }
</style>
