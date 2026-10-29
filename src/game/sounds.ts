/**
 * Efectos de sonido generados por código (WebAudio). Sin ficheros externos.
 * Cada sonido es una secuencia corta de notas con envolvente simple.
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
  const c = ensureCtx();
  if (!c) return;
  const notes = SOUNDS[name];
  if (!notes) return;
  for (const n of notes) playNote(c, n, options.volume);
}
