/**
 * Melodía de victoria y preferencia de silencio (solo cliente; research D-212). El sonido se genera
 * con Web Audio (sin archivos ni dependencias). Toda llamada a Web Audio y a `localStorage` va en
 * `try/catch`: si el navegador la bloquea, el sorteo continúa sin sonido y sin errores visibles.
 */

const MUTED_KEY = "sorteo:silencio";

/** Arpegio ascendente: E3, E4, G4, B4, D5, E5, G5, B5 (Hz). */
const NOTES_HZ = [164.81, 329.63, 392.0, 493.88, 587.33, 659.25, 783.99, 987.77] as const;
const NOTE_SPACING_S = 0.09;
const NOTE_MIN_DURATION_S = 2.2;
const MASTER_VOLUME = 0.25;
const LOWPASS_HZ = 1100;

let audioContext: AudioContext | null = null;

function createContext(): AudioContext | null {
  const Constructor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Constructor ? new Constructor() : null;
}

/**
 * Crea o reanuda el `AudioContext`. Hay que llamarla dentro de un gesto del usuario (el clic de
 * «Girar») para que el navegador no bloquee el sonido al terminar el giro.
 */
export function primeAudio(): void {
  try {
    audioContext ??= createContext();
    if (audioContext && audioContext.state === "suspended") {
      void audioContext.resume().catch(() => undefined);
    }
  } catch {
    // Sin audio disponible: el sorteo sigue sin sonido.
  }
}

/** Valor en memoria: respaldo cuando `localStorage` no está disponible (la preferencia dura la página). */
let memoryMuted = false;
const mutedListeners = new Set<() => void>();

/** Preferencia de silencio del dispositivo; compatible con `useSyncExternalStore`. */
export function getMuted(): boolean {
  try {
    const stored = window.localStorage.getItem(MUTED_KEY);
    if (stored !== null) {
      return stored === "1";
    }
  } catch {
    // Almacenamiento no disponible: se usa el valor en memoria.
  }
  return memoryMuted;
}

export function setMuted(value: boolean): void {
  memoryMuted = value;
  try {
    window.localStorage.setItem(MUTED_KEY, value ? "1" : "0");
  } catch {
    // Almacenamiento no disponible: la preferencia solo vale mientras la página siga abierta.
  }
  mutedListeners.forEach((listener) => listener());
}

/** Avisa cuando cambia la preferencia (en esta pestaña o en otra). */
export function subscribeMuted(callback: () => void): () => void {
  mutedListeners.add(callback);
  const onStorage = (event: StorageEvent): void => {
    if (event.key === MUTED_KEY) {
      callback();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    mutedListeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

/** Reproduce la melodía de victoria, salvo que esté silenciada o no haya audio disponible. */
export function playVictory(): void {
  if (getMuted()) {
    return;
  }
  try {
    audioContext ??= createContext();
    const context = audioContext;
    if (!context) {
      return;
    }
    const master = context.createGain();
    master.gain.value = MASTER_VOLUME;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = LOWPASS_HZ;
    filter.connect(master);
    master.connect(context.destination);

    const start = context.currentTime + 0.02;
    NOTES_HZ.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const noteStart = start + index * NOTE_SPACING_S;
      const duration = NOTE_MIN_DURATION_S + (index % 3) * 0.4;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.5, noteStart + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + duration);
      oscillator.connect(gain);
      gain.connect(filter);
      oscillator.start(noteStart);
      oscillator.stop(noteStart + duration + 0.05);
    });
  } catch {
    // Sin audio disponible: el sorteo sigue sin sonido.
  }
}
