/**
 * Every sound on the site, made on the spot with Web Audio: no files to download, so nothing waits on them.
 * Small building blocks (a tone with a pitch slide, a burst of filtered noise, a short echo) make up the clicks
 * of the page, the cat, the cows and the gondola on the hill, and pill mode's rifle, shotgun, knife and footsteps.
 *
 * The browser only allows sound after a click or a key, so the context wakes on the first one. Muting is
 * remembered (the speaker at the corner of the page).
 */
type Opt = { gain?: number; pan?: number; rate?: number; at?: number };
export type Surface = 'grass' | 'leaves' | 'snow' | 'water' | 'wood' | 'dirt';

class Sfx {
  ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private verb: ConvolverNode | null = null;
  private verbIn: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private beds = new Map<string, { stop: () => void; gain: GainNode }>();
  private listeners = new Set<() => void>();
  private last = new Map<string, number>();
  muted = false;
  /** pill mode's volume setting, 0..1 */
  volume = 1;

  constructor() {
    if (typeof window === 'undefined') return;
    try {
      this.muted = window.localStorage.getItem('sound') === 'off';
    } catch {
      /* storage blocked */
    }
    const wake = () => this.unlock();
    for (const t of ['pointerdown', 'keydown', 'touchstart'] as const) window.addEventListener(t, wake, { passive: true });
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  subscribe(f: () => void) {
    this.listeners.add(f);
    return () => {
      this.listeners.delete(f);
    };
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      window.localStorage.setItem('sound', m ? 'off' : 'on');
    } catch {
      /* storage blocked */
    }
    if (this.out && this.ctx) this.out.gain.setTargetAtTime(m ? 0 : 0.8 * this.volume, this.ctx.currentTime, 0.05);
    this.listeners.forEach((f) => f());
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.out && this.ctx) this.out.gain.setTargetAtTime(this.muted ? 0 : 0.8 * this.volume, this.ctx.currentTime, 0.05);
  }

  unlock() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC({ latencyHint: 'interactive' });
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.connect(ctx.destination);
      this.out = ctx.createGain();
      this.out.gain.value = this.muted ? 0 : 0.8 * this.volume;
      this.out.connect(comp);
      // white noise, made once
      const n = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = n;
      // a small room: a decaying noise tail, for the shots' echo through the trees
      const len = ctx.sampleRate * 1.6;
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const ch = ir.getChannelData(c);
        for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
      }
      this.verb = ctx.createConvolver();
      this.verb.buffer = ir;
      this.verbIn = ctx.createGain();
      this.verbIn.gain.value = 0.35;
      this.verbIn.connect(this.verb);
      this.verb.connect(this.out);
      this.listeners.forEach((f) => f());
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  // --- building blocks -------------------------------------------------------------------------------------
  dest(o: Opt, verb = 0) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = o.gain ?? 1;
    let node: AudioNode = g;
    if (o.pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      g.connect(p);
      node = p;
    }
    node.connect(this.out!);
    if (verb > 0) {
      const v = ctx.createGain();
      v.gain.value = verb;
      node.connect(v);
      v.connect(this.verbIn!);
    }
    return g;
  }

  /** A tone: `f0` sliding to `f1`, quick attack, exponential fall. */
  tone(to: AudioNode, t: number, f0: number, f1: number, dur: number, type: OscillatorType = 'sine', gain = 0.3, attack = 0.004) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(to);
    o.start(t);
    o.stop(t + dur + 0.02);
    return o;
  }

  /** A burst of noise through a filter whose centre slides from `f0` to `f1`. */
  hiss(to: AudioNode, t: number, dur: number, type: BiquadFilterType, f0: number, f1: number, gain = 0.3, q = 1, attack = 0.002) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(to);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.02);
  }

  /** True if the named sound may play now (keeps a held key or a fast loop from machine-gunning it). */
  gate(name: string, gap: number) {
    const now = performance.now();
    if (now - (this.last.get(name) ?? -1e9) < gap * 1000) return false;
    this.last.set(name, now);
    return true;
  }

  private ok() {
    return !!this.ctx && !!this.out && !this.muted && this.ctx.state === 'running';
  }

  /** Plays a named sound. Unknown names are quietly ignored. */
  play(name: string, o: Opt = {}) {
    if (!this.ok()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + (o.at ?? 0);
    const r = o.rate ?? 1;
    const fn = SOUNDS[name];
    if (fn) fn.call(this, t, o, r);
  }

  /** A footstep on a surface, every few strides a little different. */
  step(surface: Surface, o: Opt = {}) {
    if (!this.ok()) return;
    const t = this.ctx!.currentTime;
    const d = this.dest(o);
    const v = 0.85 + Math.random() * 0.3;
    if (surface === 'grass') {
      // one soft step in grass: a hush of blades brushed and pressed, a muffled heel under it
      const w = 0.94 + Math.random() * 0.12;
      this.hiss(d, t, 0.11, 'bandpass', 2600 * w, 1700 * w, 0.07, 0.8, 0.018);
      this.hiss(d, t + 0.035, 0.09, 'bandpass', 1900 * w, 1300 * w, 0.05, 0.8, 0.015);
      this.hiss(d, t, 0.07, 'lowpass', 380, 200, 0.09, 0.7, 0.006);
      return;
    }
    if (surface === 'snow') {
      this.hiss(d, t, 0.16, 'bandpass', 1400 * v, 700, 0.16, 0.9, 0.02);
      this.hiss(d, t + 0.03, 0.1, 'highpass', 3000, 2500, 0.05);
    } else if (surface === 'leaves') {
      for (let i = 0; i < 4; i++) this.hiss(d, t + i * 0.025 + Math.random() * 0.02, 0.06, 'bandpass', 3200 * v, 2200, 0.08, 1.2);
      this.hiss(d, t, 0.08, 'lowpass', 500, 300, 0.1);
    } else if (surface === 'water') {
      this.hiss(d, t, 0.22, 'bandpass', 900 * v, 400, 0.14, 1.5, 0.01);
      this.tone(d, t + 0.02, 300 * v, 600 * v, 0.08, 'sine', 0.05);
    } else if (surface === 'wood') {
      this.tone(d, t, 180 * v, 110, 0.07, 'triangle', 0.15);
      this.hiss(d, t, 0.04, 'bandpass', 1200, 800, 0.06);
    } else {
      this.hiss(d, t, 0.09, 'lowpass', 900 * v, 300, 0.14, 0.7);
      this.hiss(d, t, 0.05, 'bandpass', 2400 * v, 1800, 0.04, 1);
    }
  }

  /**
   * A bed of sound that keeps going until stopped: the wind in the wood with birds in it (by season), the cat's
   * purr. Starting one that's already playing only changes its volume.
   */
  bed(name: string, on: boolean, level = 1, season = 'summer') {
    const have = this.beds.get(name);
    if (!on) {
      if (have) {
        this.beds.delete(name);
        have.stop();
      }
      return;
    }
    if (!this.ctx || !this.out) return;
    const ctx = this.ctx;
    if (have) {
      have.gain.gain.setTargetAtTime(level, ctx.currentTime, 0.4);
      return;
    }
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(level, ctx.currentTime, 0.8);
    g.connect(this.out);
    const stops: (() => void)[] = [];
    // wind: noise through a slowly wandering lowpass
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = name === 'hollow' ? 260 : season === 'winter' ? 700 : 420;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = ctx.createGain();
    lg.gain.value = lp.frequency.value * 0.5;
    lfo.connect(lg);
    lg.connect(lp.frequency);
    const wg = ctx.createGain();
    wg.gain.value = name === 'purr' ? 0 : season === 'winter' ? 0.07 : 0.045;
    src.connect(lp);
    lp.connect(wg);
    wg.connect(g);
    src.start();
    lfo.start();
    stops.push(() => {
      src.stop();
      lfo.stop();
    });
    // the life in it, now and then
    let timer = 0;
    const life = () => {
      if (!this.ok()) return;
      const t = ctx.currentTime + 0.05;
      if (name === 'purr') {
        for (let i = 0; i < 8; i++) {
          this.hiss(g, t + i * 0.32, 0.26, 'lowpass', 160, 120, 0.22, 2, 0.08);
          this.tone(g, t + i * 0.32, 26, 24, 0.26, 'sawtooth', 0.04, 0.08);
        }
        return;
      }
      if (name === 'hollow') {
        if (season === 'summer' && Math.random() < 0.7) for (let i = 0; i < 6; i++) this.tone(g, t + i * 0.07, 4300, 4200, 0.03, 'square', 0.006);
        else if (Math.random() < 0.3) {
          // an owl, far off
          this.tone(g, t, 410, 380, 0.35, 'sine', 0.025, 0.06);
          this.tone(g, t + 0.55, 400, 360, 0.6, 'sine', 0.022, 0.08);
        }
        return;
      }
      if (season === 'winter') {
        if (Math.random() < 0.25) this.play('crow', { gain: 0.25, pan: Math.random() * 1.6 - 0.8 });
        return;
      }
      this.play(Math.random() < 0.5 ? 'bird' : 'bird2', { gain: 0.25 + Math.random() * 0.3, pan: Math.random() * 1.8 - 0.9, rate: 0.85 + Math.random() * 0.35 });
    };
    const tickLife = () => {
      life();
      timer = window.setTimeout(tickLife, name === 'purr' ? 2560 : (season === 'winter' ? 5000 : 1800) + Math.random() * 4000);
    };
    timer = window.setTimeout(tickLife, 600);
    stops.push(() => clearTimeout(timer));
    this.beds.set(name, {
      gain: g,
      stop: () => {
        g.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
        setTimeout(() => stops.forEach((s) => s()), 1500);
      },
    });
  }

}

type Fn = (this: Sfx, t: number, o: Opt, r: number) => void;
const pent = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];

/** The library. Each takes the start time, the options, and a rate (pitch) multiplier. */
const SOUNDS: Record<string, Fn> = {
  // --- the page ---
  tick(t, o, r) {
    if (!this.gate('tick', 0.03)) return;
    this.tone(this.dest(o), t, 1900 * r, 1500 * r, 0.03, 'sine', 0.05);
  },
  click(t, o, r) {
    const d = this.dest(o);
    this.tone(d, t, 620 * r, 280 * r, 0.06, 'sine', 0.22);
    this.hiss(d, t, 0.02, 'highpass', 3000, 3000, 0.05);
  },
  pop(t, o, r) {
    this.tone(this.dest(o), t, 300 * r, 900 * r, 0.08, 'sine', 0.2);
  },
  plop(t, o, r) {
    this.tone(this.dest(o), t, 900 * r, 240 * r, 0.12, 'sine', 0.2);
  },
  whoosh(t, o, r) {
    this.hiss(this.dest(o), t, 0.45, 'bandpass', 300 * r, 2400 * r, 0.12, 0.8, 0.15);
  },
  chime(t, o, r) {
    const d = this.dest(o, 0.4);
    [0, 2, 4].forEach((k, i) => this.tone(d, t + i * 0.07, pent[k] * r, pent[k] * r, 0.6, 'triangle', 0.08));
  },
  collect(t, o, r) {
    const d = this.dest(o, 0.4);
    [0, 2, 4, 7].forEach((k, i) => this.tone(d, t + i * 0.06, pent[k] * r, pent[k] * r, 0.35, 'square', 0.04));
  },
  paper(t, o) {
    const d = this.dest(o);
    for (let i = 0; i < 5; i++) this.hiss(d, t + i * 0.03, 0.05, 'bandpass', 3500 + Math.random() * 2000, 2500, 0.06, 2);
  },
  season(t, o, r) {
    this.hiss(this.dest(o), t, 0.8, 'bandpass', 400, 3000, 0.08, 0.7, 0.3);
    SOUNDS.chime.call(this, t + 0.25, o, r);
  },
  // --- things on the page and in the wood ---
  meow(t, o, r) {
    const ctx = this.ctx!;
    const d = this.dest(o, 0.2);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(520 * r, t);
    osc.frequency.linearRampToValueAtTime(760 * r, t + 0.18);
    osc.frequency.linearRampToValueAtTime(480 * r, t + 0.5);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 3;
    f.frequency.setValueAtTime(900, t);
    f.frequency.linearRampToValueAtTime(1600, t + 0.2);
    f.frequency.linearRampToValueAtTime(800, t + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    osc.connect(f);
    f.connect(g);
    g.connect(d);
    osc.start(t);
    osc.stop(t + 0.6);
  },
  moo(t, o, r) {
    const d = this.dest(o, 0.3);
    this.tone(d, t, 120 * r, 96 * r, 0.9, 'sawtooth', 0.09, 0.15);
    this.tone(d, t, 241 * r, 190 * r, 0.9, 'triangle', 0.04, 0.15);
  },
  cowbell(t, o, r) {
    const d = this.dest(o, 0.3);
    for (const [f, g] of [[545, 0.12], [812, 0.08], [1350, 0.03]]) this.tone(d, t, f * r, f * r * 0.99, 0.7, 'square', g * 0.5);
  },
  marmot(t, o, r) {
    const d = this.dest(o, 0.5);
    this.tone(d, t, 2300 * r, 2600 * r, 0.16, 'sine', 0.18, 0.01);
  },
  bird(t, o, r) {
    const d = this.dest(o, 0.25);
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) this.tone(d, t + i * 0.11, 3200 * r, 4400 * r, 0.07, 'sine', 0.07);
  },
  bird2(t, o, r) {
    const d = this.dest(o, 0.25);
    this.tone(d, t, 4800 * r, 2600 * r, 0.18, 'sine', 0.06);
    this.tone(d, t + 0.22, 2600 * r, 3900 * r, 0.12, 'sine', 0.05);
  },
  crow(t, o, r) {
    const d = this.dest(o, 0.4);
    for (let i = 0; i < 2; i++) {
      this.tone(d, t + i * 0.35, 520 * r, 380 * r, 0.22, 'sawtooth', 0.05);
      this.hiss(d, t + i * 0.35, 0.22, 'bandpass', 1100, 800, 0.05, 2);
    }
  },
  gondola(t, o, r) {
    const d = this.dest(o, 0.3);
    this.tone(d, t, 180 * r, 170 * r, 0.25, 'triangle', 0.06);
    this.hiss(d, t, 0.3, 'bandpass', 800, 600, 0.03, 3);
  },
  boing(t, o, r) {
    this.tone(this.dest(o), t, 200 * r, 700 * r, 0.25, 'triangle', 0.18);
  },
  water(t, o, r) {
    const d = this.dest(o);
    this.tone(d, t, 400 * r, 1200 * r, 0.1, 'sine', 0.1);
    this.hiss(d, t, 0.25, 'bandpass', 1200, 500, 0.08, 1);
  },
  rustle(t, o) {
    const d = this.dest(o);
    for (let i = 0; i < 6; i++) this.hiss(d, t + i * 0.04 + Math.random() * 0.03, 0.08, 'bandpass', 2800 + Math.random() * 1600, 2000, 0.05, 1.2);
  },
  floppy(t, o) {
    const d = this.dest(o);
    this.hiss(d, t, 0.12, 'bandpass', 2200, 1500, 0.08, 2);
    this.tone(d, t + 0.12, 140, 80, 0.08, 'square', 0.12);
    // the drive grinding as it reads
    for (let i = 0; i < 7; i++) this.tone(d, t + 0.25 + i * 0.09, 95 + (i % 2) * 30, 90, 0.07, 'square', 0.04);
  },
  eject(t, o) {
    const d = this.dest(o);
    this.tone(d, t, 300, 160, 0.06, 'square', 0.08);
    this.hiss(d, t + 0.03, 0.12, 'bandpass', 1800, 2600, 0.06, 2);
  },
  boot(t, o) {
    const d = this.dest(o, 0.2);
    this.tone(d, t, 880, 880, 0.12, 'square', 0.05);
    this.tone(d, t + 0.13, 1320, 1320, 0.18, 'square', 0.04);
  },
  pill(t, o) {
    const d = this.dest(o, 0.5);
    this.tone(d, t, 300, 1200, 0.6, 'sine', 0.12, 0.05);
    this.hiss(d, t, 1, 'bandpass', 200, 4000, 0.06, 0.6, 0.4);
  },
  // --- pill mode ---
  rifle(t, o) {
    const d = this.dest(o, 0.9);
    this.hiss(d, t, 0.08, 'highpass', 1500, 800, 0.55);
    this.hiss(d, t, 0.35, 'lowpass', 1800, 120, 0.6, 0.7);
    this.tone(d, t, 120, 40, 0.3, 'sine', 0.6);
  },
  shotgun(t, o) {
    const d = this.dest(o, 1.1);
    this.hiss(d, t, 0.12, 'highpass', 900, 500, 0.5);
    this.hiss(d, t, 0.55, 'lowpass', 1200, 80, 0.8, 0.6);
    this.tone(d, t, 90, 32, 0.45, 'sine', 0.75);
  },
  pump(t, o) {
    const d = this.dest(o);
    this.tone(d, t, 900, 500, 0.03, 'square', 0.08);
    this.hiss(d, t, 0.12, 'bandpass', 1600, 900, 0.12, 2);
    this.tone(d, t + 0.2, 1100, 600, 0.03, 'square', 0.1);
    this.hiss(d, t + 0.2, 0.08, 'bandpass', 2000, 1200, 0.12, 2);
  },
  bolt(t, o) {
    const d = this.dest(o);
    [0, 0.09, 0.22, 0.31].forEach((dt, i) => {
      this.tone(d, t + dt, 1400 - i * 120, 700, 0.025, 'square', 0.06);
      this.hiss(d, t + dt, 0.05, 'bandpass', 2600, 2000, 0.06, 3);
    });
  },
  shell(t, o, r) {
    const d = this.dest(o);
    for (let i = 0; i < 3; i++) this.tone(d, t + 0.25 + i * 0.12 * (1 - i * 0.2), 4200 * r, 4100 * r, 0.05, 'sine', 0.05 / (i + 1));
  },
  hull(t, o) {
    const d = this.dest(o);
    for (let i = 0; i < 2; i++) this.tone(d, t + 0.3 + i * 0.15, 700, 500, 0.05, 'triangle', 0.05 / (i + 1));
  },
  shellIn(t, o) {
    const d = this.dest(o);
    this.tone(d, t, 1600, 900, 0.03, 'square', 0.07);
    this.hiss(d, t, 0.06, 'bandpass', 2400, 1800, 0.07, 3);
  },
  magOut(t, o) {
    const d = this.dest(o);
    this.tone(d, t, 700, 400, 0.04, 'square', 0.07);
    this.hiss(d, t, 0.1, 'bandpass', 1500, 1000, 0.06, 2);
  },
  magIn(t, o) {
    const d = this.dest(o);
    this.tone(d, t, 500, 300, 0.05, 'square', 0.1);
    this.tone(d, t + 0.06, 1500, 1300, 0.03, 'square', 0.07);
  },
  dry(t, o) {
    this.tone(this.dest(o), t, 2200, 1800, 0.03, 'square', 0.06);
  },
  swing(t, o, r) {
    this.hiss(this.dest(o), t, 0.16, 'bandpass', 900 * r, 3400 * r, 0.14, 1.6, 0.04);
  },
  stab(t, o) {
    const d = this.dest(o);
    this.tone(d, t, 160, 70, 0.12, 'sine', 0.3);
    this.hiss(d, t, 0.14, 'lowpass', 1200, 300, 0.18);
  },
  flip(t, o, r) {
    const d = this.dest(o);
    this.tone(d, t, 3100 * r, 2600 * r, 0.025, 'square', 0.04);
    this.hiss(d, t, 0.03, 'highpass', 5000, 5000, 0.03);
  },
  deploy(t, o) {
    const d = this.dest(o);
    this.hiss(d, t, 0.15, 'bandpass', 900, 1600, 0.07, 1);
    this.tone(d, t + 0.12, 1300, 900, 0.03, 'square', 0.05);
  },
  zoom(t, o) {
    const d = this.dest(o);
    this.tone(d, t, 1900, 1700, 0.02, 'square', 0.04);
    this.hiss(d, t, 0.12, 'bandpass', 1200, 2000, 0.03, 2);
  },
  breathIn(t, o) {
    this.hiss(this.dest(o), t, 0.6, 'bandpass', 500, 1300, 0.06, 1, 0.3);
  },
  breathOut(t, o) {
    this.hiss(this.dest(o), t, 0.9, 'bandpass', 1400, 400, 0.1, 0.8, 0.05);
  },
  heart(t, o) {
    const d = this.dest(o);
    this.tone(d, t, 60, 40, 0.12, 'sine', 0.3);
    this.tone(d, t + 0.18, 55, 38, 0.12, 'sine', 0.22);
  },
  jump(t, o) {
    this.hiss(this.dest(o), t, 0.1, 'bandpass', 700, 1100, 0.06, 1);
  },
  land(t, o, r) {
    const d = this.dest(o);
    this.tone(d, t, 90 * r, 50, 0.1, 'sine', 0.2);
    this.hiss(d, t, 0.1, 'lowpass', 700, 200, 0.1);
  },
  hit(t, o) {
    const d = this.dest(o);
    this.tone(d, t, 1800, 1600, 0.04, 'square', 0.06);
  },
  kill(t, o, r) {
    const d = this.dest(o, 0.4);
    this.tone(d, t, 880 * r, 880 * r, 0.18, 'triangle', 0.12);
    this.tone(d, t + 0.07, 1318 * r, 1318 * r, 0.3, 'triangle', 0.1);
  },
  medal(t, o, r) {
    const d = this.dest(o, 0.5);
    [0, 2, 4, 5].forEach((k, i) => this.tone(d, t + i * 0.05, pent[k] * r, pent[k] * r, 0.4, 'square', 0.035));
  },
  thud(t, o) {
    const d = this.dest(o);
    this.tone(d, t, 140, 60, 0.12, 'sine', 0.22);
    this.hiss(d, t, 0.15, 'lowpass', 900, 200, 0.12);
  },
  wood(t, o, r) {
    const d = this.dest(o, 0.3);
    this.tone(d, t, 420 * r, 250 * r, 0.09, 'triangle', 0.18);
    this.hiss(d, t, 0.06, 'bandpass', 1800, 900, 0.12, 2);
  },
  dirt(t, o) {
    const d = this.dest(o, 0.2);
    this.tone(d, t, 110, 60, 0.1, 'sine', 0.18);
    this.hiss(d, t, 0.25, 'lowpass', 1500, 200, 0.14);
  },
  snow(t, o) {
    this.hiss(this.dest(o, 0.2), t, 0.25, 'bandpass', 1300, 500, 0.14, 0.8);
  },
  splash(t, o, r) {
    const d = this.dest(o, 0.3);
    this.hiss(d, t, 0.45, 'bandpass', 1500 * r, 500, 0.2, 0.9);
    this.tone(d, t, 500 * r, 1500 * r, 0.12, 'sine', 0.08);
  },
  metal(t, o) {
    const d = this.dest(o, 0.4);
    for (const f of [2300, 3100, 4700]) this.tone(d, t, f, f * 0.98, 0.35, 'sine', 0.05);
  },
  glass(t, o) {
    const d = this.dest(o, 0.4);
    for (let i = 0; i < 12; i++) this.tone(d, t + Math.random() * 0.25, 3000 + Math.random() * 5000, 2500, 0.15, 'sine', 0.035);
    this.hiss(d, t, 0.3, 'highpass', 4000, 3000, 0.1);
  },
  /** Wood bursting (Mira's barrel): the crack of the planks, splinters, the boards knocking down onto the grass. */
  board(t, o) {
    const d = this.dest({ ...o, gain: (o.gain ?? 1) * 1.3 }, 0.6);
    // the crack: sharp and bright, then the crunch of wood giving way
    this.hiss(d, t, 0.06, 'highpass', 2600, 1800, 0.5);
    this.tone(d, t, 210, 70, 0.32, 'sine', 0.45);
    for (let i = 0; i < 5; i++) this.hiss(d, t + 0.01 + i * 0.035 + Math.random() * 0.02, 0.09, 'bandpass', 1400 + Math.random() * 1600, 600, 0.22, 1.4);
    this.hiss(d, t, 0.5, 'lowpass', 2400, 260, 0.3, 0.7);
    // splinters ticking off
    for (let i = 0; i < 7; i++) this.tone(d, t + 0.05 + Math.random() * 0.25, 2600 + Math.random() * 2400, 1800, 0.03, 'square', 0.03);
    // the boards falling, knocking on each other and the ground
    for (let i = 0; i < 9; i++) {
      const at = t + 0.18 + i * 0.07 + Math.random() * 0.06;
      const f = 180 + Math.random() * 240;
      this.tone(d, at, f, f * 0.6, 0.08, 'triangle', 0.16 * (1 - i * 0.07));
      this.hiss(d, at, 0.05, 'bandpass', 1100 + Math.random() * 700, 700, 0.06, 2);
    }
  },
  /** The shop sign swinging on its bar: an old hinge creak. */
  creak(t, o, r) {
    const d = this.dest(o, 0.2);
    const f = 260 + Math.random() * 120;
    this.tone(d, t, f * r, f * 1.35 * r, 0.22, 'sawtooth', 0.025, 0.04);
    this.hiss(d, t, 0.2, 'bandpass', 900, 1300, 0.03, 6, 0.05);
  },
  // --- Mira's shop and the cases ---
  /** Coins on the counter. */
  buy(t, o, r) {
    const d = this.dest(o, 0.35);
    [0, 0.07, 0.15].forEach((dt, i) => {
      this.tone(d, t + dt, (2350 + i * 260) * r, (2300 + i * 260) * r, 0.22, 'sine', 0.07);
      this.tone(d, t + dt, (4700 + i * 500) * r, (4600 + i * 500) * r, 0.12, 'sine', 0.025);
    });
    this.hiss(d, t, 0.05, 'highpass', 6000, 5000, 0.04);
  },
  /** Not enough points: a soft wooden knock and a low note. */
  deny(t, o) {
    const d = this.dest(o);
    this.tone(d, t, 190, 150, 0.12, 'triangle', 0.14);
    this.tone(d, t + 0.1, 150, 120, 0.16, 'triangle', 0.12);
  },
  /** Coins poured out: selling a skin. */
  sell(t, o) {
    const d = this.dest(o, 0.35);
    for (let i = 0; i < 9; i++) {
      const f = 2000 + Math.random() * 2600;
      this.tone(d, t + i * 0.045 + Math.random() * 0.02, f, f * 0.98, 0.14, 'sine', 0.05);
    }
  },
  /** The case's latches flipping and the lid coming up. */
  unlock(t, o) {
    const d = this.dest(o, 0.3);
    this.tone(d, t, 1300, 700, 0.04, 'square', 0.09);
    this.tone(d, t + 0.09, 1250, 680, 0.04, 'square', 0.09);
    this.hiss(d, t + 0.16, 0.4, 'bandpass', 600, 2400, 0.08, 0.8, 0.12);
    this.tone(d, t + 0.18, 300, 420, 0.25, 'triangle', 0.05);
  },
  /** One item of the reel going past the marker. */
  reel(t, o, r) {
    if (!this.gate('reel', 0.018)) return;
    const d = this.dest(o);
    this.tone(d, t, 2300 * r, 1900 * r, 0.025, 'square', 0.035);
    this.hiss(d, t, 0.02, 'highpass', 5000, 5000, 0.03);
  },
  /** What came out of the case, grander the rarer it is: rate 1 is common, up to 5 for a ★. */
  reveal(t, o, r) {
    const d = this.dest(o, 0.6);
    const tier = Math.max(1, Math.min(5, Math.round(r)));
    const notes = [0, 2, 4, 5, 7, 9, 11, 12].slice(0, 2 + tier);
    notes.forEach((k, i) => {
      const f = 523.25 * Math.pow(2, k / 12);
      this.tone(d, t + i * 0.075, f, f, 0.5, 'triangle', 0.09);
      if (tier >= 3) this.tone(d, t + i * 0.075, f * 2, f * 2, 0.35, 'sine', 0.03);
    });
    if (tier >= 4) {
      const end = t + notes.length * 0.075;
      for (const f of [1046.5, 1318.5, 1568]) this.tone(d, end, f, f, 1.1, 'triangle', 0.06, 0.02);
      this.hiss(d, end, 0.9, 'highpass', 6000, 9000, 0.05, 0.7, 0.05);
    }
    if (tier >= 5) for (let i = 0; i < 14; i++) this.tone(d, t + 0.6 + i * 0.05, 3000 + Math.random() * 3000, 2600, 0.2, 'sine', 0.03);
  },
  /** Putting a skin on a weapon. */
  equip(t, o) {
    const d = this.dest(o, 0.3);
    this.tone(d, t, 900, 1300, 0.05, 'square', 0.05);
    this.tone(d, t + 0.06, 1760, 1760, 0.25, 'triangle', 0.07);
    this.hiss(d, t, 0.12, 'bandpass', 1800, 2600, 0.05, 2);
  },
  /** Mira says hello: a little two-note hum. */
  hello(t, o) {
    const d = this.dest(o, 0.3);
    this.tone(d, t, 660, 740, 0.16, 'sine', 0.09, 0.02);
    this.tone(d, t + 0.18, 880, 830, 0.24, 'sine', 0.09, 0.02);
  },
  /** Mira, when a bullet goes past her: a startled squeak. */
  eep(t, o) {
    const d = this.dest(o, 0.2);
    this.tone(d, t, 900, 1500, 0.12, 'sine', 0.12, 0.01);
    this.tone(d, t + 0.12, 1300, 1000, 0.1, 'sine', 0.06);
  },
  /** A little wooden knock for the menus. */
  ui(t, o, r) {
    if (!this.gate('ui', 0.04)) return;
    const d = this.dest(o);
    this.tone(d, t, 520 * r, 360 * r, 0.05, 'triangle', 0.1);
  },
  squeak(t, o, r) {
    this.tone(this.dest(o), t, 1400 * r, 2200 * r, 0.09, 'sine', 0.1);
  },
  burst(t, o) {
    const d = this.dest(o, 0.4);
    this.hiss(d, t, 0.2, 'lowpass', 2500, 400, 0.25);
    this.tone(d, t, 220, 90, 0.15, 'sine', 0.2);
  },
  flap(t, o) {
    const d = this.dest(o);
    for (let i = 0; i < 6; i++) this.hiss(d, t + i * 0.06, 0.05, 'bandpass', 900, 700, 0.07, 1);
  },
};

export const sfx = new Sfx();
