/**
 * Sound engine procédural Vertxia — Web Audio API pure, zéro fichier audio.
 *
 * Pourquoi pas de fichiers ? 3 raisons :
 *   1. Licensing : aucun fichier audio = zéro risque DMCA / royalties / attribution
 *   2. Bundle : 0 KB d'assets audio dans /public, tout est généré en JS
 *   3. Cohérence pitch : Vertxia "génère" un site 3D depuis une URL — cohérent
 *      qu'il génère AUSSI le sound design en procédural
 *
 * Architecture :
 *   - SoundEngine.init() crée l'AudioContext (requiert user gesture)
 *   - SoundEngine.startDrone() lance le drone ambient (3 sine oscillators
 *     en harmonie + LFO slow filter modulation + reverb-ish via delay feedback)
 *   - SoundEngine.click() / .hover() / .reveal() / .whoosh() jouent des
 *     UI sounds synthétisés (envelope ADSR sur sine/triangle filtré)
 *
 * Note auto-play policy : les navigateurs bloquent l'audio sans user gesture.
 * On init le context sur le 1er click/scroll/touch utilisateur.
 */

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let droneNodes: { osc: OscillatorNode; gain: GainNode; lfo?: OscillatorNode }[] = [];
let droneActive = false;
let muted = false;

const MASTER_VOLUME = 0.35;
const DRONE_VOLUME = 0.18;

/**
 * Crée et retourne l'AudioContext, en initialisant à la première demande.
 * Doit être appelé après un user gesture (click, touch, keydown).
 */
function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : MASTER_VOLUME;
    masterGain.connect(ctx.destination);
  }
  // Resume si le context est suspended (autoplay policy)
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

/**
 * Mute / unmute global. Persiste dans localStorage pour rappel entre pages.
 */
function setMuted(value: boolean) {
  muted = value;
  if (masterGain && ctx) {
    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.setTargetAtTime(
      value ? 0 : MASTER_VOLUME,
      ctx.currentTime,
      0.05
    );
  }
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("vertxia_audio_muted", value ? "1" : "0");
    } catch {
      // localStorage peut throw en mode privé
    }
  }
}

function isMuted(): boolean {
  return muted;
}

/**
 * Restaure le state mute depuis localStorage. À appeler au mount global.
 */
function restoreMutedState() {
  if (typeof window === "undefined") return;
  try {
    muted = localStorage.getItem("vertxia_audio_muted") === "1";
  } catch {
    muted = false;
  }
}

/**
 * Lance le drone ambient — 3 sine oscillators en intervalle (root + quinte + octave)
 * avec LFO lent qui module le cutoff d'un lowpass, donnant un effet "souffle".
 * Idle until stopDrone().
 */
function startDrone() {
  const audio = getContext();
  if (!audio || !masterGain || droneActive) return;
  droneActive = true;

  // Filtre commun lowpass pour adoucir le tout
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 800;
  filter.Q.value = 0.7;

  // LFO sur le filtre — modulation lente du cutoff
  const lfo = audio.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.08; // 0.08 Hz = ~12s période
  const lfoGain = audio.createGain();
  lfoGain.gain.value = 250;
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();

  // 3 oscillators : fondamental (D2 = 73.42 Hz), quinte (A2 = 110), octave (D3 = 146.83)
  const freqs = [73.42, 110, 146.83];
  freqs.forEach((freq, i) => {
    const osc = audio.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;

    // Détune léger pour épaisseur (chorus-ish)
    osc.detune.value = (i - 1) * 7;

    const gain = audio.createGain();
    // Fade-in 4s sur chaque oscillator
    gain.gain.setValueAtTime(0, audio.currentTime);
    gain.gain.linearRampToValueAtTime(
      DRONE_VOLUME / freqs.length,
      audio.currentTime + 4
    );

    osc.connect(gain).connect(filter);
    osc.start();
    droneNodes.push({ osc, gain, lfo: i === 0 ? lfo : undefined });
  });

  filter.connect(masterGain);
}

/**
 * Stop le drone avec fade-out de 1.5s pour éviter le pop.
 */
function stopDrone() {
  if (!ctx || !droneActive) return;
  droneActive = false;
  const now = ctx.currentTime;

  droneNodes.forEach(({ osc, gain, lfo }) => {
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(0, now, 0.3);
    osc.stop(now + 1.5);
    if (lfo) lfo.stop(now + 1.5);
  });
  droneNodes = [];
}

/**
 * Joue un click synthétisé : envelope courte sur sine 1.2 kHz, filtre hi-pass,
 * pitch drop pour effet "click matériel" satisfaisant.
 */
function click() {
  const audio = getContext();
  if (!audio || !masterGain) return;

  const now = audio.currentTime;
  const osc = audio.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.08);

  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.4, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

  osc.connect(gain).connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.15);
}

/**
 * Joue un hover : sine très court 800 Hz, volume très bas, pour feedback léger.
 */
function hover() {
  const audio = getContext();
  if (!audio || !masterGain) return;

  const now = audio.currentTime;
  const osc = audio.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 800;

  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  osc.connect(gain).connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.1);
}

/**
 * Reveal — sweep tonal montant qui ponctue les chapter reveals au scroll.
 * Sine 200→600 Hz avec filtre bandpass, envelope plus longue.
 */
function reveal() {
  const audio = getContext();
  if (!audio || !masterGain) return;

  const now = audio.currentTime;
  const osc = audio.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(200, now);
  osc.frequency.exponentialRampToValueAtTime(600, now + 0.4);

  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1000;
  filter.Q.value = 8;

  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.15, now + 0.1);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

  osc.connect(filter).connect(gain).connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.7);
}

/**
 * Whoosh — bruit blanc filtré qui glisse, pour transitions / cuts.
 * Plus dramatique que click/hover, à utiliser sur les moments clés.
 */
function whoosh() {
  const audio = getContext();
  if (!audio || !masterGain) return;

  const now = audio.currentTime;
  const bufferSize = audio.sampleRate * 0.5; // 0.5s de bruit
  const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.5;
  }

  const noise = audio.createBufferSource();
  noise.buffer = buffer;

  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 2;
  filter.frequency.setValueAtTime(300, now);
  filter.frequency.exponentialRampToValueAtTime(4000, now + 0.45);

  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.25, now + 0.1);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

  noise.connect(filter).connect(gain).connect(masterGain);
  noise.start(now);
  noise.stop(now + 0.55);
}

export const SoundEngine = {
  init: getContext,
  startDrone,
  stopDrone,
  click,
  hover,
  reveal,
  whoosh,
  setMuted,
  isMuted,
  restoreMutedState,
};
