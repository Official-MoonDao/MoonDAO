/**
 * Catch sound, synthesised with Web Audio: no sample files to load.
 *
 *  - engines: a low roar with crackle that grows with the throttle
 *  - wind: the rush of the fall, louder the faster the ship is moving
 *  - the double sonic boom after the flip
 *  - the arms closing, the catch, a splash, and explosions of any size
 *
 * Nothing sounds until `unlock()` is called from a tap or key press, which is
 * the only time a browser lets audio start.
 */
import type { CatchAudio } from './engine'

export class CatchSound implements CatchAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private engineGain: GainNode | null = null
  private engineTone: BiquadFilterNode | null = null
  private crackleGain: GainNode | null = null
  private rumbleGain: GainNode | null = null
  private windGain: GainNode | null = null
  private noise: AudioBuffer | null = null
  private _muted = false

  get muted(): boolean {
    return this._muted
  }

  set muted(m: boolean) {
    this._muted = m
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.03)
  }

  /** Start the audio graph. Must be called from a user gesture. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    const Ctor: typeof AudioContext | undefined = window.AudioContext ?? (window as any).webkitAudioContext
    if (!Ctor) return
    try {
      const ctx = new Ctor()
      this.ctx = ctx
      const limiter = ctx.createDynamicsCompressor()
      limiter.threshold.value = -10
      limiter.ratio.value = 8
      limiter.connect(ctx.destination)
      const master = ctx.createGain()
      master.gain.value = this._muted ? 0 : 0.8
      master.connect(limiter)
      this.master = master

      // Two seconds of brown noise, looped: the raw material for every roar.
      const len = ctx.sampleRate * 2
      const buf = ctx.createBuffer(1, len, ctx.sampleRate)
      const d = buf.getChannelData(0)
      let last = 0
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1
        last = (last + 0.02 * white) / 1.02
        d[i] = last * 3.5
      }
      this.noise = buf
      const loop = () => {
        const src = ctx.createBufferSource()
        src.buffer = buf
        src.loop = true
        src.start()
        return src
      }

      // Engines: filtered noise for the roar, a low sine for the weight, hissy crackle on top.
      const tone = ctx.createBiquadFilter()
      tone.type = 'lowpass'
      tone.frequency.value = 200
      const eg = ctx.createGain()
      eg.gain.value = 0
      loop().connect(tone)
      tone.connect(eg)
      eg.connect(master)
      this.engineTone = tone
      this.engineGain = eg

      const rumble = ctx.createOscillator()
      rumble.type = 'sine'
      rumble.frequency.value = 38
      const rg = ctx.createGain()
      rg.gain.value = 0
      rumble.connect(rg)
      rg.connect(master)
      rumble.start()
      this.rumbleGain = rg

      const hiss = ctx.createBiquadFilter()
      hiss.type = 'highpass'
      hiss.frequency.value = 1400
      const cg = ctx.createGain()
      cg.gain.value = 0
      // A slow wobble makes the crackle sputter rather than hiss.
      const wob = ctx.createOscillator()
      wob.frequency.value = 23
      const wobGain = ctx.createGain()
      wobGain.gain.value = 0.5
      const am = ctx.createGain()
      am.gain.value = 0.5
      wob.connect(wobGain)
      wobGain.connect(am.gain)
      wob.start()
      loop().connect(hiss)
      hiss.connect(am)
      am.connect(cg)
      cg.connect(master)
      this.crackleGain = cg

      // Wind.
      const band = ctx.createBiquadFilter()
      band.type = 'bandpass'
      band.frequency.value = 520
      band.Q.value = 0.5
      const wg = ctx.createGain()
      wg.gain.value = 0
      loop().connect(band)
      band.connect(wg)
      wg.connect(master)
      this.windGain = wg
    } catch {
      this.ctx = null
    }
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend()
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume()
  }

  dispose() {
    try {
      void this.ctx?.close()
    } catch {}
    this.ctx = null
  }

  setFlight(throttle: number, speed: number) {
    const ctx = this.ctx
    if (!ctx || !this.engineGain || !this.engineTone || !this.crackleGain || !this.rumbleGain || !this.windGain) return
    const t = ctx.currentTime
    const th = Math.max(0, Math.min(1, throttle))
    // Lit is never quiet: the idle roar is plainly there, in a band small
    // speakers can play, and BURN opens it up and adds the crackle.
    const lit = th > 0
    this.engineGain.gain.setTargetAtTime(lit ? 0.34 + 0.5 * Math.pow(th, 0.8) : 0, t, 0.08)
    this.engineTone.frequency.setTargetAtTime(520 + 1500 * th, t, 0.1)
    this.crackleGain.gain.setTargetAtTime(lit ? 0.035 + 0.15 * th * th : 0, t, 0.08)
    this.rumbleGain.gain.setTargetAtTime(lit ? 0.12 + 0.22 * th : 0, t, 0.1)
    this.windGain.gain.setTargetAtTime(Math.min(0.22, (speed / 90) * 0.2), t, 0.25)
  }

  /** A burst of the looped noise through a filter, with its own envelope. */
  private burst(opts: { at?: number; type: BiquadFilterType; from: number; to: number; gain: number; attack: number; decay: number }) {
    const ctx = this.ctx
    if (!ctx || !this.master || !this.noise) return
    const t0 = ctx.currentTime + (opts.at ?? 0)
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const f = ctx.createBiquadFilter()
    f.type = opts.type
    f.frequency.setValueAtTime(opts.from, t0)
    f.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t0 + opts.decay)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(opts.gain, t0 + opts.attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.attack + opts.decay)
    src.connect(f)
    f.connect(g)
    g.connect(this.master)
    src.start(t0, Math.random() * 1.5)
    src.stop(t0 + opts.attack + opts.decay + 0.1)
  }

  /** A sine that drops in pitch: the body of a thump. */
  private thump(at: number, from: number, to: number, gain: number, decay: number) {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const t0 = ctx.currentTime + at
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(from, t0)
    o.frequency.exponentialRampToValueAtTime(to, t0 + decay)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay)
    o.connect(g)
    g.connect(this.master)
    o.start(t0)
    o.stop(t0 + decay + 0.05)
  }

  /** Two sharp cracks a quarter of a second apart, each with a low tail. */
  boom() {
    for (const at of [0, 0.26]) {
      // Pitched high enough for a phone speaker, with a hard crack on the front.
      this.thump(at, 240, 55, 1, 0.45)
      this.burst({ at, type: 'lowpass', from: 5200, to: 260, gain: 1, attack: 0.003, decay: 0.5 })
      this.burst({ at, type: 'highpass', from: 2400, to: 1200, gain: 0.5, attack: 0.002, decay: 0.07 })
    }
  }

  explosion(size: number) {
    const s = Math.max(0.2, Math.min(1.6, size))
    this.thump(0, 70, 22, Math.min(1, 0.6 + 0.4 * s), 1.4 * (0.6 + 0.4 * s))
    this.burst({ type: 'lowpass', from: 3200, to: 70, gain: Math.min(1, 0.55 + 0.4 * s), attack: 0.01, decay: 2.2 * (0.5 + 0.5 * s) })
    // Debris and fire after the bang.
    this.burst({ at: 0.25, type: 'bandpass', from: 900, to: 200, gain: 0.18 * s, attack: 0.3, decay: 2.8 })
  }

  /** Steel on steel: a handful of ringing partials. */
  clang() {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const t0 = ctx.currentTime
    const base = 150 + Math.random() * 40
    for (const [ratio, gain, decay] of [
      [1, 0.2, 1.3],
      [1.58, 0.14, 1.0],
      [2.41, 0.1, 0.8],
      [3.76, 0.07, 0.55],
      [5.3, 0.04, 0.35],
    ]) {
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.value = base * ratio
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.006)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay)
      o.connect(g)
      g.connect(this.master)
      o.start(t0)
      o.stop(t0 + decay + 0.05)
    }
    this.burst({ type: 'highpass', from: 1800, to: 900, gain: 0.2, attack: 0.003, decay: 0.12 })
  }

  splash() {
    this.burst({ type: 'bandpass', from: 1500, to: 500, gain: 0.5, attack: 0.03, decay: 1.4 })
    this.thump(0, 60, 30, 0.4, 0.5)
  }

  /** A short tone under each call from the tower. */
  radio() {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const t0 = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = 1900
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(0.04, t0 + 0.01)
    g.gain.setValueAtTime(0.04, t0 + 0.07)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11)
    o.connect(g)
    g.connect(this.master)
    o.start(t0)
    o.stop(t0 + 0.15)
  }
}
