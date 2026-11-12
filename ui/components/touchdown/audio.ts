/**
 * Touchdown sound: all synthesised with Web Audio, no asset downloads.
 * Nothing is created until `unlock()` runs inside a user gesture.
 */
export class TouchdownAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private engineGain: GainNode | null = null
  private engineFilter: BiquadFilterNode | null = null
  private dustGain: GainNode | null = null
  private droneGain: GainNode | null = null
  private noise: AudioBuffer | null = null
  muted = false

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    const Ctor: typeof AudioContext | undefined =
      typeof window === 'undefined'
        ? undefined
        : window.AudioContext || (window as any).webkitAudioContext
    if (!Ctor) return
    try {
      const ctx = new Ctor()
      this.ctx = ctx
      const master = ctx.createGain()
      master.gain.value = this.muted ? 0 : 0.8
      master.connect(ctx.destination)
      this.master = master

      const len = ctx.sampleRate * 2
      const buf = ctx.createBuffer(1, len, ctx.sampleRate)
      const data = buf.getChannelData(0)
      let last = 0
      for (let i = 0; i < len; i++) {
        // Brown-ish noise: rumble, not hiss.
        last = (last + (Math.random() * 2 - 1) * 0.06) / 1.02
        data[i] = last * 6
      }
      this.noise = buf

      const src = ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 180
      const gain = ctx.createGain()
      gain.gain.value = 0
      src.connect(filter).connect(gain).connect(master)
      src.start()
      this.engineGain = gain
      this.engineFilter = filter

      // Regolith spraying off the surface: a dry hiss that builds near the ground.
      const grit = ctx.createBufferSource()
      grit.buffer = buf
      grit.loop = true
      grit.playbackRate.value = 1.7
      const gritFilter = ctx.createBiquadFilter()
      gritFilter.type = 'highpass'
      gritFilter.frequency.value = 1500
      const gritGain = ctx.createGain()
      gritGain.gain.value = 0
      grit.connect(gritFilter).connect(gritGain).connect(master)
      grit.start()
      this.dustGain = gritGain

      // A quiet two-note drone so the silence of space has a floor.
      const drone = ctx.createGain()
      drone.gain.value = 0.035
      drone.connect(master)
      for (const f of [55, 82.5]) {
        const o = ctx.createOscillator()
        o.type = 'sine'
        o.frequency.value = f
        o.connect(drone)
        o.start()
      }
      this.droneGain = drone
    } catch {
      this.ctx = null
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.03)
    }
  }

  /** 0..1: how hard the plume is scouring the ground. */
  setDust(level: number) {
    if (!this.ctx || !this.dustGain) return
    this.dustGain.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * 0.22, this.ctx.currentTime, 0.12)
  }

  setEngine(on: boolean) {
    if (!this.ctx || !this.engineGain || !this.engineFilter) return
    const t = this.ctx.currentTime
    this.engineGain.gain.setTargetAtTime(on ? 0.3 : 0, t, on ? 0.04 : 0.09)
    this.engineFilter.frequency.setTargetAtTime(on ? 420 : 140, t, 0.08)
  }

  beep(freq = 880, dur = 0.09, type: OscillatorType = 'sine', vol = 0.12, delay = 0) {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime + delay
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.type = type
    o.frequency.value = freq
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(this.master)
    o.start(t)
    o.stop(t + dur + 0.02)
  }

  /**
   * Quindar tones: the beeps that bracket Apollo-era ground transmissions.
   * 2,525 Hz keys the uplink on, 2,475 Hz keys it off, 250 ms each.
   */
  quindar(open: boolean) {
    this.beep(open ? 2525 : 2475, 0.25, 'sine', 0.16)
  }

  /** A breath of radio static under a transmission. */
  staticBurst(dur = 0.6) {
    if (!this.ctx || !this.master || !this.noise) return
    // Starts after the Quindar tone so the tone is heard clean.
    const t = this.ctx.currentTime + 0.27
    const src = this.ctx.createBufferSource()
    src.buffer = this.noise
    const f = this.ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = 2100
    f.Q.value = 0.8
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.11, t + 0.04)
    g.gain.setValueAtTime(0.11, t + dur - 0.08)
    g.gain.linearRampToValueAtTime(0, t + dur)
    src.connect(f).connect(g).connect(this.master)
    src.start(t, Math.random())
    src.stop(t + dur + 0.05)
  }

  /** Transmission start: Quindar on plus static. */
  radio() {
    this.quindar(true)
    this.staticBurst(0.7)
  }

  /** Attitude thruster: a short hiss, quiet enough to sit under the engine. */
  rcs() {
    if (!this.ctx || !this.master || !this.noise) return
    const t = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = this.noise
    const f = this.ctx.createBiquadFilter()
    f.type = 'highpass'
    f.frequency.value = 2600
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.1, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
    src.connect(f).connect(g).connect(this.master)
    src.start(t, Math.random())
    src.stop(t + 0.12)
  }

  /** Master caution: the two-tone warble. */
  caution() {
    for (let i = 0; i < 4; i++) this.beep(i % 2 ? 1060 : 760, 0.14, 'square', 0.03, 0.3 + i * 0.16)
  }

  /** Camera shutter for the photo button. */
  shutter() {
    this.beep(1900, 0.03, 'square', 0.05)
    this.beep(900, 0.05, 'square', 0.05, 0.07)
  }

  alarm() {
    for (let i = 0; i < 3; i++) this.beep(640, 0.16, 'square', 0.05, i * 0.36)
  }

  thud(strength = 1) {
    if (!this.ctx || !this.master || !this.noise) return
    const t = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = this.noise
    const f = this.ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(300 + 500 * strength, t)
    f.frequency.exponentialRampToValueAtTime(50, t + 0.35)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(Math.min(1, 0.35 + 0.5 * strength), t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4 + 0.5 * strength)
    src.connect(f).connect(g).connect(this.master)
    src.start(t, Math.random())
    src.stop(t + 1.4)
  }

  crash() {
    this.thud(1.6)
    this.beep(70, 0.9, 'sawtooth', 0.14)
    this.beep(46, 1.3, 'sine', 0.2, 0.05)
  }

  success() {
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((n, i) => this.beep(n, 0.32, 'triangle', 0.09, i * 0.11))
  }

  sadTrombone() {
    const notes = [311.13, 293.66, 277.18, 233.08]
    notes.forEach((n, i) => this.beep(n, i === 3 ? 0.7 : 0.26, 'sawtooth', 0.045, i * 0.26))
  }

  /** Tab hidden: silence everything (the render loop that would stop the engine sound is paused too). */
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
}
