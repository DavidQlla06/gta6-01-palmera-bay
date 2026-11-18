// Palmera Bay — sound.
// One job: every sound is synthesised with WebAudio — engine hum, police
// siren, pickup blip, mission jingle. No audio files, no network.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
  }

  /** Must be called from a user gesture at least once. */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      // Engine: low sawtooth whose pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
      // Siren: two-tone square wave, toggled by update().
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'square';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.ctx.destination);
      this.sirenOsc.start();
    } catch (e) {
      this.ctx = null; // audio unavailable — the game plays on silently
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.ctx) {
      if (this.engineGain) this.engineGain.gain.value = muted ? 0 : this.engineGain.gain.value;
      if (this.sirenGain) this.sirenGain.gain.value = 0;
    }
  }

  /** Engine hum follows the driven car's speed (0 when on foot). */
  update(dt, speed, wanted) {
    if (!this.ctx || this.muted) return;
    this.sirenTimer += dt;
    if (this.engineGain) {
      const target = speed > 0.5 ? 0.03 + Math.min(0.06, Math.abs(speed) * 0.0016) : 0;
      this.engineGain.gain.value += (target - this.engineGain.gain.value) * 0.2;
      this.engineOsc.frequency.value = 55 + Math.abs(speed) * 4;
    }
    if (this.sirenGain) {
      if (wanted > 0) {
        this.sirenGain.gain.value = 0.018;
        this.sirenOsc.frequency.value = Math.floor(this.sirenTimer * 1.6) % 2 === 0 ? 700 : 950;
      } else {
        this.sirenGain.gain.value = 0;
      }
    }
  }

  blip(freq = 880, seconds = 0.12, type = 'sine', volume = 0.12) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + seconds);
  }

  pickup() { this.blip(880, 0.12); setTimeout(() => this.blip(1320, 0.14), 90); }

  /** Short rising jingle for a completed job. */
  missionJingle() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.22, 'triangle', 0.14), i * 120));
  }

  bustedSting() {
    const notes = [392, 330, 262];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.3, 'sawtooth', 0.08), i * 160));
  }
}
