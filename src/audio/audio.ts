/**
 * Audio: procedural SFX + procedural synthwave music, with optional file overrides
 * from public/assets/audio/manifest.json ({ sfx: {name: file}, music: {name: file} }).
 */
import { rand } from '../core/math';

export type Sfx =
  | 'slash' | 'slashHeavy' | 'stab' | 'hit' | 'hitHeavy' | 'crit' | 'parry' | 'block' | 'guardBreak'
  | 'dash' | 'perfect' | 'hurt' | 'shoot' | 'shootBig' | 'laserCharge' | 'laser' | 'explosion'
  | 'charge' | 'chargeReady' | 'roar' | 'ui' | 'uiConfirm' | 'skill' | 'stagger' | 'execute'
  | 'thunder' | 'teleport' | 'slam' | 'death' | 'spawn' | 'ult' | 'rankUp' | 'heal' | 'clank';

export type MusicMode = 'menu' | 'combat' | 'boss' | 'off';

class AudioSys {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfxBus!: GainNode;
  musicBus!: GainNode;
  noiseBuf!: AudioBuffer;
  volume = 0.8;
  musicVolume = 0.55;
  private last = new Map<string, number>();
  private files = new Map<string, AudioBuffer>();
  private musicFiles = new Map<string, AudioBuffer>();
  private musicSrc: AudioBufferSourceNode | null = null;
  private musicFileName = '';

  // music sequencer
  mode: MusicMode = 'off';
  intensity = 0; // 0..3
  private bpm = 124;
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  lastBeat = 0;
  private beats: number[] = [];

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    const ctx: AudioContext = new AC();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.15;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicVolume;
    this.musicBus.connect(this.master);
    const len = ctx.sampleRate * 1.5;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.loadManifest();
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  private async loadManifest() {
    try {
      const res = await fetch('assets/audio/manifest.json');
      if (!res.ok) return;
      const m = await res.json();
      const load = async (name: string, file: string, into: Map<string, AudioBuffer>) => {
        try {
          const r = await fetch('assets/audio/' + file);
          if (!r.ok) return;
          const buf = await this.ctx!.decodeAudioData(await r.arrayBuffer());
          into.set(name, buf);
        } catch { /* ignore missing/invalid files */ }
      };
      for (const [k, v] of Object.entries(m.sfx ?? {})) load(k, v as string, this.files);
      for (const [k, v] of Object.entries(m.music ?? {})) load(k, v as string, this.musicFiles);
    } catch { /* manifest optional */ }
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx) this.master.gain.value = v;
  }
  setMusicVolume(v: number) {
    this.musicVolume = v;
    if (this.ctx) this.musicBus.gain.value = v;
  }

  // ---------- primitives ----------
  private env(g: GainNode, t: number, vol: number, a: number, d: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  tone(freq: number, type: OscillatorType, dur: number, vol: number, slideTo?: number, delay = 0, attack = 0.004, dest?: AudioNode) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 1), t + dur);
    this.env(g, t, vol, attack, dur);
    o.connect(g).connect(dest ?? this.sfxBus);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  }
  noise(dur: number, vol: number, ftype: BiquadFilterType, f0: number, f1?: number, q = 1, delay = 0, attack = 0.003, dest?: AudioNode) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = ftype;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    this.env(g, t, vol, attack, dur);
    s.connect(f).connect(g).connect(dest ?? this.sfxBus);
    s.start(t, rand(0, 0.5));
    s.stop(t + attack + dur + 0.05);
  }

  /** online host: mirror every sound / music change to the clients */
  hook: ((kind: 'sfx' | 'music', a: string, b: number) => void) | null = null;
  play(name: Sfx, vol = 1) {
    this.hook?.('sfx', name, vol);
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const prev = this.last.get(name) ?? -1;
    if (now - prev < 0.035) return;
    this.last.set(name, now);
    const file = this.files.get(name);
    if (file) {
      const s = this.ctx.createBufferSource();
      s.buffer = file;
      s.playbackRate.value = rand(0.95, 1.05);
      const g = this.ctx.createGain();
      g.gain.value = vol;
      s.connect(g).connect(this.sfxBus);
      s.start();
      return;
    }
    const v = vol;
    switch (name) {
      case 'slash':
        this.noise(0.13, 0.32 * v, 'bandpass', 1800, 6500, 1.2);
        this.tone(520, 'sawtooth', 0.07, 0.04 * v, 160);
        break;
      case 'slashHeavy':
        this.noise(0.28, 0.4 * v, 'bandpass', 900, 3800, 0.9);
        this.tone(200, 'sawtooth', 0.2, 0.08 * v, 60);
        break;
      case 'stab':
        this.noise(0.07, 0.3 * v, 'highpass', 3000, 8000, 1);
        this.tone(900, 'triangle', 0.05, 0.05 * v, 400);
        break;
      case 'hit':
        this.tone(190, 'sine', 0.13, 0.55 * v, 45);
        this.noise(0.07, 0.3 * v, 'highpass', 2500, undefined, 0.7);
        break;
      case 'hitHeavy':
        this.tone(130, 'sine', 0.3, 0.7 * v, 32);
        this.noise(0.2, 0.45 * v, 'lowpass', 2500, 300, 0.8);
        this.tone(70, 'square', 0.12, 0.12 * v, 35);
        break;
      case 'crit':
        this.tone(200, 'sine', 0.16, 0.6 * v, 40);
        this.tone(1100, 'square', 0.09, 0.08 * v, 2400);
        this.noise(0.1, 0.35 * v, 'highpass', 4000, undefined, 0.7);
        break;
      case 'parry':
        for (const [f, d] of [[1870, 0.7], [2790, 0.55], [4150, 0.4], [935, 0.9]] as const) this.tone(f, 'sine', d, 0.16 * v);
        this.noise(0.06, 0.5 * v, 'highpass', 5000, undefined, 0.5);
        this.tone(90, 'sine', 0.35, 0.6 * v, 40);
        break;
      case 'block':
        this.tone(330, 'square', 0.06, 0.12 * v, 200);
        this.noise(0.1, 0.35 * v, 'bandpass', 1600, 900, 2);
        break;
      case 'clank':
        this.tone(620, 'square', 0.05, 0.07 * v, 500);
        this.tone(1240, 'sine', 0.2, 0.08 * v);
        this.noise(0.05, 0.25 * v, 'bandpass', 3000, undefined, 3);
        break;
      case 'guardBreak':
        this.tone(400, 'sawtooth', 0.4, 0.2 * v, 60);
        this.noise(0.35, 0.5 * v, 'lowpass', 3000, 200, 1);
        break;
      case 'dash':
        this.noise(0.17, 0.28 * v, 'bandpass', 500, 2600, 1.4);
        break;
      case 'perfect':
        this.noise(0.25, 0.25 * v, 'bandpass', 3000, 600, 1.5);
        this.tone(1200, 'sine', 0.45, 0.14 * v, 2400);
        this.tone(1800, 'sine', 0.45, 0.08 * v, 3600, 0.05);
        break;
      case 'hurt':
        this.tone(260, 'sawtooth', 0.25, 0.2 * v, 70);
        this.noise(0.15, 0.4 * v, 'lowpass', 2000, 300);
        break;
      case 'shoot':
        this.tone(760, 'square', 0.07, 0.05 * v, 280);
        break;
      case 'shootBig':
        this.tone(300, 'sawtooth', 0.18, 0.1 * v, 90);
        this.noise(0.12, 0.15 * v, 'bandpass', 1200, 400);
        break;
      case 'laserCharge':
        this.tone(110, 'sawtooth', 0.7, 0.07 * v, 880, 0, 0.5);
        break;
      case 'laser':
        this.tone(70, 'sawtooth', 0.7, 0.18 * v, 55);
        this.noise(0.7, 0.2 * v, 'bandpass', 900, 500, 0.8);
        break;
      case 'explosion':
        this.noise(0.65, 0.65 * v, 'lowpass', 1800, 90, 0.7);
        this.tone(90, 'sine', 0.55, 0.7 * v, 28);
        break;
      case 'charge':
        this.tone(220, 'triangle', 0.55, 0.08 * v, 880, 0, 0.3);
        break;
      case 'chargeReady':
        this.tone(1320, 'sine', 0.25, 0.12 * v);
        this.tone(1980, 'sine', 0.25, 0.06 * v, undefined, 0.04);
        break;
      case 'roar':
        this.tone(95, 'sawtooth', 1.1, 0.22 * v, 55, 0, 0.1);
        this.tone(142, 'sawtooth', 1.1, 0.14 * v, 70, 0, 0.1);
        this.noise(1.0, 0.3 * v, 'lowpass', 900, 200, 1, 0, 0.1);
        break;
      case 'ui':
        this.tone(880, 'sine', 0.05, 0.1 * v);
        break;
      case 'uiConfirm':
        this.tone(660, 'square', 0.08, 0.06 * v, 1320);
        this.tone(1320, 'sine', 0.2, 0.08 * v, undefined, 0.06);
        break;
      case 'skill':
        this.tone(220, 'sawtooth', 0.3, 0.1 * v, 1300);
        this.noise(0.3, 0.25 * v, 'bandpass', 600, 4000, 1);
        break;
      case 'ult':
        this.tone(110, 'sawtooth', 0.9, 0.18 * v, 880, 0, 0.05);
        this.tone(165, 'sawtooth', 0.9, 0.12 * v, 1320, 0, 0.05);
        this.noise(0.8, 0.35 * v, 'bandpass', 300, 6000, 1);
        break;
      case 'stagger':
        this.tone(110, 'sine', 1.3, 0.4 * v);
        this.tone(166, 'sine', 1.1, 0.25 * v);
        this.tone(330, 'triangle', 0.8, 0.08 * v);
        this.noise(0.2, 0.3 * v, 'lowpass', 1500, 200);
        break;
      case 'execute':
        this.tone(80, 'sine', 0.6, 0.8 * v, 25);
        this.noise(0.5, 0.6 * v, 'lowpass', 4000, 150);
        for (const f of [1500, 2250, 3400]) this.tone(f, 'sine', 0.8, 0.1 * v);
        break;
      case 'thunder':
        this.noise(0.25, 0.4 * v, 'highpass', 1500, 6000, 0.5);
        this.tone(2000, 'square', 0.05, 0.04 * v, 400);
        break;
      case 'teleport':
        this.tone(1600, 'sine', 0.18, 0.1 * v, 200);
        this.noise(0.15, 0.15 * v, 'bandpass', 4000, 800, 2);
        break;
      case 'slam':
        this.tone(60, 'sine', 0.6, 0.9 * v, 22);
        this.noise(0.5, 0.6 * v, 'lowpass', 1200, 80, 0.7);
        break;
      case 'death':
        this.tone(440, 'sawtooth', 1.4, 0.18 * v, 40);
        this.noise(1.2, 0.5 * v, 'lowpass', 3000, 60, 0.6);
        this.tone(55, 'sine', 1.4, 0.6 * v, 25);
        break;
      case 'spawn':
        this.tone(300, 'triangle', 0.3, 0.06 * v, 1200);
        break;
      case 'rankUp':
        this.tone(880, 'square', 0.06, 0.05 * v);
        this.tone(1320, 'square', 0.12, 0.05 * v, undefined, 0.06);
        break;
      case 'heal':
        this.tone(660, 'sine', 0.3, 0.1 * v, 990);
        this.tone(990, 'sine', 0.35, 0.08 * v, 1320, 0.1);
        break;
    }
  }

  // ---------- music ----------
  setMusic(mode: MusicMode, intensity = this.intensity) {
    this.hook?.('music', mode, intensity);
    this.intensity = intensity;
    if (mode === this.mode) return;
    this.mode = mode;
    this.stopMusicFile();
    if (!this.ctx) return;
    const file = this.musicFiles.get(mode);
    if (file && mode !== 'off') {
      const s = this.ctx.createBufferSource();
      s.buffer = file;
      s.loop = true;
      s.connect(this.musicBus);
      s.start();
      this.musicSrc = s;
      this.musicFileName = mode;
    }
    this.nextTime = this.ctx.currentTime + 0.05;
    this.step = 0;
  }
  private stopMusicFile() {
    if (this.musicSrc) {
      try { this.musicSrc.stop(); } catch { /* already stopped */ }
      this.musicSrc = null;
      this.musicFileName = '';
    }
  }
  /** seconds since last kick drum, for visual pulse */
  beatPhase() {
    if (!this.ctx) return 1;
    const spb = 60 / this.bpm;
    if (this.musicFileName) return (this.ctx.currentTime % spb) / spb;
    const now = this.ctx.currentTime;
    while (this.beats.length && this.beats[0] <= now) this.lastBeat = this.beats.shift()!;
    return Math.max(0, Math.min(1, (now - this.lastBeat) / spb));
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || this.mode === 'off' || this.musicFileName) return;
    const stepDur = 60 / this.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 128;
    }
  }

  private playStep(step: number, t: number) {
    const ctx = this.ctx!;
    const bus = this.musicBus;
    const delay = Math.max(0, t - ctx.currentTime);
    const s16 = step % 16;
    const bar = Math.floor(step / 16) % 8;
    // Am - F - C - G (x2), roots in Hz
    const prog = [
      [110, [220, 261.6, 329.6]],
      [87.3, [174.6, 220, 261.6]],
      [130.8, [261.6, 329.6, 392]],
      [98, [196, 246.9, 293.7]],
    ] as const;
    const [root, chord] = prog[Math.floor(bar / 2) % 4];
    const lvl = this.mode === 'menu' ? 0 : this.mode === 'combat' ? Math.max(1, this.intensity) : Math.max(2, this.intensity);
    const d = delay;
    {
      // pad on bar starts
      if (s16 === 0 && bar % 2 === 0) {
        for (const f of chord) {
          this.tone(f / 2, 'sawtooth', 3.6, lvl === 0 ? 0.035 : 0.022, undefined, d, 0.6, bus);
          this.tone((f / 2) * 1.006, 'sawtooth', 3.6, lvl === 0 ? 0.03 : 0.018, undefined, d, 0.6, bus);
        }
      }
      if (lvl >= 1) {
        // kick on quarters
        if (s16 % 4 === 0) {
          this.tone(150, 'sine', 0.22, 0.55, 40, d, 0.002, bus);
          this.beats.push(t);
        }
        // bass offbeat 8ths
        if (s16 % 2 === 0) {
          const f = s16 % 4 === 2 ? root : root * (s16 === 14 ? 1.5 : 1);
          this.tone(f / 2, 'sawtooth', 0.16, 0.1, undefined, d, 0.004, bus);
          this.tone(f / 2, 'square', 0.12, 0.04, undefined, d, 0.004, bus);
        }
        // hats
        if (s16 % 4 === 2 || (lvl >= 3 && s16 % 2 === 1)) this.noise(0.04, lvl >= 3 ? 0.06 : 0.08, 'highpass', 8000, undefined, 0.5, d, 0.001, bus);
      } else if (s16 % 4 === 0) this.beats.push(t);
      if (lvl >= 2) {
        if (s16 === 4 || s16 === 12) {
          this.noise(0.16, 0.2, 'bandpass', 1800, 900, 0.8, d, 0.002, bus);
          this.tone(200, 'triangle', 0.1, 0.12, 120, d, 0.002, bus);
        }
      }
      // arpeggio
      if (lvl === 0 ? s16 % 4 === 0 : lvl >= 2) {
        const notes = [chord[0], chord[1], chord[2], chord[1] * 2, chord[2], chord[1]];
        const n = notes[step % notes.length] * (lvl >= 3 ? 2 : 1);
        this.tone(n, 'square', 0.09, lvl === 0 ? 0.025 : 0.03, undefined, d, 0.003, bus);
      }
      if (lvl >= 3 && s16 === 0) {
        this.tone(chord[2] * 2, 'sawtooth', 0.8, 0.03, chord[1] * 2, d, 0.02, bus);
      }
    }
  }
}

export const audio = new AudioSys();
export const sfx = (n: Sfx, v = 1) => audio.play(n, v);
