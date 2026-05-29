/**
 * AudioEngine — moteur audio Web Audio API natif (0 dépendance externe).
 *
 * Génère le drone ambient continu (deux oscillateurs sine grave + filtre
 * low-pass) qui constitue la "respiration" du site, et des chimes ADSR
 * synthétisés à la volée pour les transitions entre sillages.
 *
 * Pourquoi pas Howler.js : on génère TOUT en synth — pas de fichier mp3
 * à héberger, drone customisable, chimes ajustables à l'octave près.
 * Trade-off : moins "réaliste" qu'un sample, mais signature plus singulière.
 *
 * Activation : le drone démarre au premier click (gesture requis par
 * Chrome/Safari pour AudioContext). On wrap dans une promesse.
 */

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private drone: { osc1: OscillatorNode; osc2: OscillatorNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
  private started = false;
  private muted = false;
  private masterVolume = 0.35;

  /**
   * Initialise et démarre le drone. À appeler depuis un user gesture.
   * Returns true if successful, false if AudioContext blocked.
   */
  async start(): Promise<boolean> {
    if (this.started) return true;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      if (this.ctx.state === "suspended") {
        await this.ctx.resume();
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.masterVolume;
      this.master.connect(this.ctx.destination);
      this.startDrone();
      this.started = true;
      return true;
    } catch (e) {
      console.warn("AudioContext failed:", e);
      return false;
    }
  }

  /**
   * Drone ambient : deux oscillateurs sine en quinte juste (55Hz / 82.4Hz)
   * filtrés en low-pass + modulation lente du cutoff pour vie organique.
   */
  private startDrone() {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.value = 55; // A1 — fondamentale grave
    const osc2 = this.ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = 82.4; // E2 — quinte juste

    // Filtre low-pass modulé par LFO pour ondulation lente
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 300;
    filter.Q.value = 4;

    // LFO sur la fréquence du filtre — respiration lente
    const lfo = this.ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.08; // une oscillation toutes les 12 sec
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 80;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start(now);

    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.18, now + 6); // fade-in 6s

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    osc1.start(now);
    osc2.start(now);

    this.drone = { osc1, osc2, filter, gain };
  }

  /**
   * Chime ADSR — triangle wave avec enveloppe.
   * Joué à l'entrée dans une nouvelle chambre.
   */
  chime(frequency: number, duration = 3.2) {
    if (!this.ctx || !this.master || this.muted) return;
    const now = this.ctx.currentTime;

    // Fondamentale
    const osc = this.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = frequency;

    // Harmonique octave plus haute (légère, pour brillance)
    const oscH = this.ctx.createOscillator();
    oscH.type = "sine";
    oscH.frequency.value = frequency * 2;

    const gain = this.ctx.createGain();
    gain.gain.value = 0;

    const gainH = this.ctx.createGain();
    gainH.gain.value = 0;

    // ADSR enveloppe — attaque douce, decay lent, sustain bas, release long
    gain.gain.linearRampToValueAtTime(0.12, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    gainH.gain.linearRampToValueAtTime(0.04, now + 0.06);
    gainH.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.7);

    osc.connect(gain);
    oscH.connect(gainH);
    gain.connect(this.master);
    gainH.connect(this.master);

    osc.start(now);
    oscH.start(now);
    osc.stop(now + duration + 0.1);
    oscH.stop(now + duration + 0.1);
  }

  /**
   * Whisper subtil — utilisé pour mouvements de particules.
   * Bruit blanc filtré + envelope très courte.
   */
  whisper(intensity = 0.04) {
    if (!this.ctx || !this.master || this.muted) return;
    const now = this.ctx.currentTime;

    const bufferSize = 4096;
    const noise = this.ctx.createScriptProcessor
      ? this.ctx.createScriptProcessor(bufferSize, 1, 1)
      : null;
    // Méthode simple : noise via OfflineAudioContext-rendered buffer
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.3;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1800;
    filter.Q.value = 2;

    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(intensity, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(now);

    // Cleanup
    if (noise) noise.disconnect();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.linearRampToValueAtTime(
        muted ? 0 : this.masterVolume,
        this.ctx.currentTime + 0.3
      );
    }
  }

  isMuted() {
    return this.muted;
  }

  isStarted() {
    return this.started;
  }

  destroy() {
    if (this.drone) {
      this.drone.osc1.stop();
      this.drone.osc2.stop();
    }
    if (this.ctx) this.ctx.close();
    this.started = false;
  }
}

/**
 * Singleton — une seule instance par session.
 */
let _engine: AudioEngine | null = null;
export function getAudioEngine(): AudioEngine {
  if (!_engine) _engine = new AudioEngine();
  return _engine;
}
