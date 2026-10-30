/**
 * Ajustes del usuario persistidos en localStorage (sin servidores).
 */
import { reactive, watch } from 'vue';
import { STORAGE_KEYS } from '../game/config';

export interface Settings {
  sound: boolean;
  /** Música de fondo de ambiente de estadio. */
  music: boolean;
  volume: number; // 0..1
  animations: boolean;
  haptics: boolean;
  tutorialDone: boolean;
  aiLevel: 'easy' | 'normal' | 'hard';
}

const DEFAULTS: Settings = {
  sound: true,
  music: true,
  volume: 0.7,
  animations: true,
  haptics: true,
  tutorialDone: false,
  aiLevel: 'normal'
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      sound: typeof parsed.sound === 'boolean' ? parsed.sound : DEFAULTS.sound,
      music: typeof parsed.music === 'boolean' ? parsed.music : DEFAULTS.music,
      volume: typeof parsed.volume === 'number' ? Math.min(1, Math.max(0, parsed.volume)) : DEFAULTS.volume,
      animations: typeof parsed.animations === 'boolean' ? parsed.animations : DEFAULTS.animations,
      haptics: typeof parsed.haptics === 'boolean' ? parsed.haptics : DEFAULTS.haptics,
      tutorialDone: typeof parsed.tutorialDone === 'boolean' ? parsed.tutorialDone : false,
      aiLevel: parsed.aiLevel === 'easy' || parsed.aiLevel === 'hard' ? parsed.aiLevel : DEFAULTS.aiLevel
    };
  } catch {
    return { ...DEFAULTS };
  }
}

const settings = reactive<Settings>(load());

watch(settings, () => {
  try {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({ ...settings }));
  } catch {
    /* almacenamiento no disponible */
  }
});

export function useSettings() {
  return settings;
}
