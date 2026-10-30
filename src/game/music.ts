/**
 * Música de fondo: síntesis WebAudio propia (sin assets externos).
 * Ambiente de estadio nocturno: multitud (ruido filtrado en bucle) y
 * pads de acordes lentos con progresión ciclica. Capa puramente
 * cosmética, como la narración: nunca toca el motor ni el RNG.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let crowdGain: GainNode | null = null;
let noiseSource: AudioBufferSourceNode | null = null;
let chordTimer = 0;
let chordIndex = 0;

/** Progresión ciclica (acordes en Hz, raíz más quintas/térsicas suaves). */
const CHORDS: number[][] = [
  [146.83, 220.0, 293.66], // Dm:  D3 A3 D4
  [116.54, 174.61, 233.08], // Bb: Bb2 F3 Bb3
  [130.81, 196.0, 261.63], // C:  C3 G3 C4
  [146.83, 220.0, 293.66], // Dm
  [174.61, 261.63, 349.23], // F:  F3 C4 F4
  [164.81, 246.94, 329.63] // Em: E3 B3 E4
];
const CHORD_SECONDS = 4.6;

function ensureCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Ruido de multitud: buffer en bucle filtrado (tribuna lejana). */
function startCrowd(): void {
  const c = ensureCtx();
  if (!c || !master || noiseSource) return;
  const seconds = 3;
  const buffer = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const data = buffer.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < data.length; i++) {
    // ruido "bronceado": más grave y continuo que el blanco puro
    brown = 0.98 * brown + (Math.random() * 2 - 1) * 0.06;
    data[i] = brown * 1.8;
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 520;
  const swell = c.createGain();
  swell.gain.value = 0.5;
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.11; // oleaje lento del ambiente
  const lfoGain = c.createGain();
  lfoGain.gain.value = 0.18;
  lfo.connect(lfoGain).connect(swell.gain);
  crowdGain = c.createGain();
  crowdGain.gain.value = 0.5;
  src.connect(filter).connect(swell).connect(crowdGain).connect(master);
  src.start();
  lfo.start();
  noiseSource = src;
}

function stopCrowd(): void {
  try {
    noiseSource?.stop();
    (noiseSource as AudioBufferSourceNode | null) = null;
  } catch {
    /* ya parado */
  }
}

/** Un pad de acorde con entrada y salida suaves. */
function playChord(c: AudioContext, freqs: number[]): void {
  if (!master) return;
  const t0 = c.currentTime;
  const dur = CHORD_SECONDS + 1.6; // solapa un poco con el siguiente
  for (const f of freqs) {
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = f;
    const detune = c.createOscillator();
    detune.type = 'sine';
    detune.frequency.value = 0.18;
    const detuneGain = c.createGain();
    detuneGain.gain.value = f * 0.004; // coro muy leve
    detune.connect(detuneGain).connect(osc.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.05, t0 + 1.6);
    g.gain.setValueAtTime(0.05, t0 + dur - 1.8);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    detune.start(t0);
    osc.stop(t0 + dur + 0.05);
    detune.stop(t0 + dur + 0.05);
  }
}

/** Arranca la música (idempotente); `vol` 0..1 del ajuste general. */
export function startMusic(volume: number): void {
  if (volume <= 0) return;
  const c = ensureCtx();
  if (!c || !master) return;
  master.gain.cancelScheduledValues(c.currentTime);
  master.gain.linearRampToValueAtTime(Math.min(1, volume * 0.55), c.currentTime + 1.2);
  startCrowd();
  if (chordTimer) return;
  playChord(c, CHORDS[chordIndex % CHORDS.length]);
  chordIndex++;
  chordTimer = window.setInterval(() => {
    const cc = ensureCtx();
    if (!cc) return;
    playChord(cc, CHORDS[chordIndex % CHORDS.length]);
    chordIndex++;
  }, CHORD_SECONDS * 1000);
}

/** Al volumen en caliente (mientras suena). */
export function setMusicVolume(volume: number): void {
  const c = ctx && master ? ctx : ensureCtx();
  if (!c || !master) return;
  master.gain.cancelScheduledValues(c.currentTime);
  if (volume <= 0) {
    master.gain.linearRampToValueAtTime(0.0001, c.currentTime + 0.4);
    return;
  }
  master.gain.linearRampToValueAtTime(Math.min(1, volume * 0.55), c.currentTime + 0.4);
}

/** Para la música (idempotente). */
export function stopMusic(): void {
  if (chordTimer) {
    window.clearInterval(chordTimer);
    chordTimer = 0;
  }
  if (ctx && master) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
  }
  // el ruido se para algo más tarde para no cortar en seco
  window.setTimeout(stopCrowd, 950);
}
