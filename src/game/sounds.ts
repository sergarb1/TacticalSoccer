/**
 * Efectos de sonido: capas de muestras CC0 (Kenney Impact Sounds, ver
 * ATTRIBUTIONS.md) para acciones físicas + síntesis WebAudio para el
 * resto. Si una muestra no está disponible, cae a la síntesis.
 */
import type { SoundName } from './types';

let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface Note {
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  slideTo?: number;
  delay?: number;
}

const SOUNDS: Record<SoundName, Note[]> = {
  move: [{ freq: 170, dur: 0.07, type: 'sine', gain: 0.5 }],
  pass: [{ freq: 340, dur: 0.08, type: 'triangle', gain: 0.5 }],
  passFail: [
    { freq: 240, dur: 0.09, type: 'triangle', gain: 0.45 },
    { freq: 170, dur: 0.12, type: 'triangle', gain: 0.4, delay: 0.07 }
  ],
  shot: [{ freq: 80, dur: 0.16, type: 'square', gain: 0.55, slideTo: 55 }],
  shotSpecial: [
    { freq: 60, dur: 0.22, type: 'square', gain: 0.6, slideTo: 40 },
    { freq: 200, dur: 0.1, type: 'triangle', gain: 0.4, delay: 0.05 }
  ],
  cut: [
    { freq: 260, dur: 0.09, type: 'sawtooth', gain: 0.35 },
    { freq: 520, dur: 0.07, type: 'sine', gain: 0.3, delay: 0.06 }
  ],
  goal: [
    { freq: 523, dur: 0.11, type: 'triangle', gain: 0.5 },
    { freq: 659, dur: 0.11, type: 'triangle', gain: 0.5, delay: 0.1 },
    { freq: 784, dur: 0.13, type: 'triangle', gain: 0.55, delay: 0.2 },
    { freq: 1046, dur: 0.28, type: 'triangle', gain: 0.5, delay: 0.32 }
  ],
  save: [
    { freq: 110, dur: 0.12, type: 'square', gain: 0.5 },
    { freq: 150, dur: 0.1, type: 'sine', gain: 0.35, delay: 0.1 }
  ],
  steal: [{ freq: 420, dur: 0.12, type: 'sawtooth', gain: 0.35, slideTo: 200 }],
  stealFail: [{ freq: 200, dur: 0.1, type: 'sawtooth', gain: 0.25, slideTo: 160 }],
  turn: [{ freq: 620, dur: 0.06, type: 'sine', gain: 0.4 }],
  pickup: [{ freq: 500, dur: 0.05, type: 'sine', gain: 0.3 }],
  kickoff: [
    { freq: 392, dur: 0.09, type: 'triangle', gain: 0.4 },
    { freq: 523, dur: 0.12, type: 'triangle', gain: 0.45, delay: 0.09 }
  ],
  fulltime: [
    { freq: 523, dur: 0.14, type: 'triangle', gain: 0.45 },
    { freq: 392, dur: 0.22, type: 'triangle', gain: 0.45, delay: 0.14 }
  ]
};

/* --- muestras CC0 (Kenney, recortadas del pack Impact Sounds) --- */
const SAMPLES: Partial<Record<SoundName, { file: string; vol: number }>> = {
  shot: { file: 'impact-1', vol: 0.9 },   // golpe de balón potente
  save: { file: 'impact-soft-1', vol: 0.8 }, // palmeo del portero
  steal: { file: 'impact-2', vol: 0.75 },  // robo/entrada
  stealFail: { file: 'impact-3', vol: 0.5 },
  pass: { file: 'impact-soft-1', vol: 0.5 },
  move: { file: 'impact-soft-1', vol: 0.35 }
};

const audioCache = new Map<string, HTMLAudioElement>();

function playNote(c: AudioContext, n: Note, vol: number): void {
  const t0 = c.currentTime + (n.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = n.type ?? 'sine';
  osc.frequency.setValueAtTime(n.freq, t0);
  if (n.slideTo) osc.frequency.exponentialRampToValueAtTime(n.slideTo, t0 + n.dur);
  const peak = Math.max(0.001, (n.gain ?? 0.4) * vol);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + n.dur + 0.05);
}

/** Reproduce un sonido si la capa está activa y el volumen > 0. */
export function playSound(name: SoundName, options: { enabled: boolean; volume: number }): void {
  if (!options.enabled || options.volume <= 0) return;
  const sample = SAMPLES[name];
  if (sample) {
    const a = audioCache.get(sample.file) ?? createAudio(sample.file, sample.vol);
    if (a) {
      try {
        a.currentTime = 0;
        a.volume = Math.max(0, Math.min(1, sample.vol * options.volume));
        void a.play();
        return; // muestra reproducida; no se sintetiza
      } catch {
        /* muestra no disponible: cae a WebAudio */
      }
    }
  }
  const c = ensureCtx();
  if (!c) return;
  const notes = SOUNDS[name];
  if (!notes) return;
  for (const n of notes) playNote(c, n, options.volume);
}

function createAudio(file: string, vol: number): HTMLAudioElement | null {
  try {
    const a = new Audio(`${import.meta.env.BASE_URL}sfx/${file}.wav`);
    a.preload = 'auto';
    a.volume = vol;
    audioCache.set(file, a);
    return a;
  } catch {
    return null;
  }
}
