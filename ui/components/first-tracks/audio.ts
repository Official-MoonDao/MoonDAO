/**
 * First Tracks sound, synthesised with Web Audio: no sample files to load.
 *
 * There is no air on the Moon, so this is what mission control hears: the
 * rover's motors as telemetry (a hum that rises with speed and labours when
 * the wheels dig in), a click as each command goes up the link, and tones for
 * the things that matter (a target imaged, the first 10 m, a rock, the end).
 *
 * Nothing sounds until `unlock()` is called from a tap or key press, which is
 * the only time a browser lets audio start.
 */
import type { FirstTracksAudio } from './engine'

export class FirstTracksSound implements FirstTracksAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private motor: OscillatorNode | null = null
  private motor2: OscillatorNode | null = null
  private motorGain: GainNode | null = null
  private motorTone: BiquadFilterNode | null = null
  private _muted = false
  private lastSend = 0

  get muted(): boolean {
    return this._muted
  }

  set muted(m: boolean) {
    this._muted = m
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.03)
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
      master.gain.value = this._muted ? 0 : 0.7
      master.connect(limiter)
      this.master = master

      // Motors: two detuned saws through a low-pass, silent until the rover moves.
      const tone = ctx.createBiquadFilter()
      tone.type = 'lowpass'
      tone.frequency.value = 300
      tone.Q.value = 2
      const gain = ctx.createGain()
      gain.gain.value = 0
      const a = ctx.createOscillator()
      a.type = 'sawtooth'
      a.frequency.value = 48
      const b = ctx.createOscillator()
      b.type = 'sawtooth'
      b.frequency.value = 48.7
      a.connect(tone)
      b.connect(tone)
      tone.connect(gain)
      gain.connect(master)
      a.start()
      b.start()
      this.motor = a
      this.motor2 = b
      this.motorGain = gain
      this.motorTone = tone
    } catch {
      this.ctx = null
    }
  }

  suspend() {
    if (this.ctx?.state === 'running') void this.ctx.suspend()
  }

  resume() {
    if (this.ctx?.state === 'suspended') void this.ctx.resume()
  }

  drive(speed: number, strain: number) {
    const ctx = this.ctx
    if (!ctx || !this.motor || !this.motor2 || !this.motorGain || !this.motorTone) return
    const t = ctx.currentTime
    const f = 44 + speed * 62 - strain * 14
    this.motor.frequency.setTargetAtTime(f, t, 0.08)
    this.motor2.frequency.setTargetAtTime(f * 1.012 + strain * 3, t, 0.08)
    this.motorTone.frequency.setTargetAtTime(240 + speed * 520, t, 0.1)
    this.motorGain.gain.setTargetAtTime(speed > 0.02 ? 0.05 + speed * 0.09 + strain * 0.05 : 0, t, 0.12)
  }

  private tone(freq: number, at: number, dur: number, gain: number, type: OscillatorType = 'sine', slideTo?: number) {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const t = ctx.currentTime + at
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    g.connect(this.master)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  cue(kind: 'send' | 'bump' | 'jolt' | 'imaged' | 'egress' | 'ten' | 'bad' | 'good' | 'tick') {
    const ctx = this.ctx
    if (!ctx) return
    switch (kind) {
      case 'send':
        // A held key changes the command many times a second on a stick: keep the clicks sparse.
        if (ctx.currentTime - this.lastSend < 0.09) return
        this.lastSend = ctx.currentTime
        this.tone(1250, 0, 0.045, 0.05, 'square')
        break
      case 'jolt':
        // A wheel climbing a small rock: a short, dull knock.
        this.tone(170, 0, 0.09, 0.16, 'triangle', 90)
        break
      case 'bump':
        this.tone(120, 0, 0.22, 0.4, 'triangle', 48)
        break
      case 'imaged':
        this.tone(880, 0, 0.12, 0.18)
        this.tone(1320, 0.1, 0.2, 0.18)
        break
      case 'egress':
        this.tone(520, 0, 0.14, 0.16)
        this.tone(780, 0.12, 0.22, 0.16)
        break
      case 'ten':
        this.tone(660, 0, 0.12, 0.2)
        this.tone(880, 0.11, 0.12, 0.2)
        this.tone(1320, 0.22, 0.32, 0.2)
        break
      case 'good':
        this.tone(660, 0, 0.14, 0.2)
        this.tone(990, 0.13, 0.14, 0.2)
        this.tone(1320, 0.26, 0.14, 0.2)
        this.tone(1760, 0.39, 0.4, 0.2)
        break
      case 'bad':
        this.tone(300, 0, 0.5, 0.26, 'sawtooth', 70)
        break
      case 'tick':
        this.tone(440, 0, 0.3, 0.14)
        break
    }
  }

  stopAll() {
    if (this.ctx && this.motorGain) this.motorGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05)
  }

  dispose() {
    try {
      void this.ctx?.close()
    } catch {}
    this.ctx = null
  }
}
