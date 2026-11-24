// Palmera Bay — synthesised sound, no audio files.
// Everything is WebAudio oscillators and filtered noise, started only
// after the player's first gesture (browsers block audio before that).

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.sirenHigh = false;
  }

  /** Call from a user gesture (click / keydown). Safe to call repeatedly. */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    // Engine: a low sawtooth whose pitch follows speed, through a lowpass.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();
    // Siren: a sine that flips between two tones while wanted > 0.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'sine';
    this.sirenOsc.frequency.value = 720;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.ctx.destination);
    this.sirenOsc.start();
  }

  setMuted(m) {
    this.muted = m;
    if (this.ctx) this.ctx.destination.gain?.setValueAtTime?.(0, 0);
    if (this.engineGain) this.engineGain.gain.value = 0;
    if (this.sirenGain) this.sirenGain.gain.value = 0;
  }

  /** Per-frame: engine pitch from speed, siren wail from wanted level. */
  update(speed, wanted, dt) {
    if (!this.ctx || this.muted) return;
    const norm = Math.min(1, Math.abs(speed) / 40);
    this.engineGain.gain.value = 0.02 + norm * 0.05;
    this.engineOsc.frequency.value = 52 + norm * 130;
    if (wanted > 0) {
      this.sirenTimer += dt;
      if (this.sirenTimer > 0.42) {
        this.sirenTimer = 0;
        this.sirenHigh = !this.sirenHigh;
        this.sirenOsc.frequency.value = this.sirenHigh ? 960 : 690;
      }
      this.sirenGain.gain.value = 0.016 + wanted * 0.004;
    } else {
      this.sirenGain.gain.value = 0;
    }
  }

  /** Short UI blip. */
  blip(freq = 660, dur = 0.09, vol = 0.08) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const gn = this.ctx.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    gn.gain.setValueAtTime(vol, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(gn);
    gn.connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** Two-note pickup chime. */
  pickup() {
    this.blip(880, 0.08, 0.07);
    setTimeout(() => this.blip(1318, 0.12, 0.07), 80);
  }

  /** Mission-complete jingle: a rising four-note run. */
  jingle() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => setTimeout(() => this.blip(f, 0.16, 0.09), i * 110));
  }

  /** Dull thud for a crash or a punch landing. */
  thud() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const gn = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.16);
    gn.gain.setValueAtTime(0.16, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(gn);
    gn.connect(this.ctx.destination);
    o.start(t);
    o.stop(t + 0.2);
  }
}
