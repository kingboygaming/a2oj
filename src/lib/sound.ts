// Quản lý âm thanh kết quả nộp bài: Web Audio API mặc định + Custom File Upload (.mp3, .wav, .ogg)

export type SoundType = "ac" | "wa" | "ce" | "tle" | "achievement" | "achievement-major";

const MUTE_KEY = "a2oj:sound:muted";
const AC_SOUND_KEY = "a2oj:sound:custom_ac";
const WA_SOUND_KEY = "a2oj:sound:custom_wa";
const VOLUME_KEY = "a2oj:sound:volume";

export const SOUND_CHANGE_EVENT = "a2oj-sound-change";

export function isSoundMuted(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {}
}

export function getSoundVolume(): number {
  try {
    if (typeof window === "undefined") return 0.8;
    const v = window.localStorage.getItem(VOLUME_KEY);
    return v !== null ? Number(v) : 0.8;
  } catch {
    return 0.8;
  }
}

export function setSoundVolume(volume: number): void {
  try {
    window.localStorage.setItem(VOLUME_KEY, String(Math.max(0, Math.min(1, volume))));
  } catch {}
}

export function getCustomSound(type: "ac" | "wa"): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(type === "ac" ? AC_SOUND_KEY : WA_SOUND_KEY);
  } catch {
    return null;
  }
}

export function setCustomSound(type: "ac" | "wa", dataUrl: string | null): void {
  try {
    const key = type === "ac" ? AC_SOUND_KEY : WA_SOUND_KEY;
    if (dataUrl) {
      window.localStorage.setItem(key, dataUrl);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {}
}

export function playSound(type: SoundType): void {
  if (isSoundMuted()) return;
  const volume = getSoundVolume();

  // Kiểm tra nếu có custom audio file
  if (type === "ac") {
    const custom = getCustomSound("ac");
    if (custom) {
      playAudioElement(custom, volume);
      return;
    }
  } else if (type === "wa" || type === "ce") {
    const custom = getCustomSound("wa");
    if (custom) {
      playAudioElement(custom, volume);
      return;
    }
  }

  // Fallback: Web Audio API tổng hợp
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === "ac") {
      playChord(ctx, [523.25, 659.25, 783.99], 0.18, volume); // C5, E5, G5
    } else if (type === "achievement") {
      playChord(ctx, [659.25, 830.61, 987.77], 0.24, volume);
    } else if (type === "achievement-major") {
      playAchievementFanfare(ctx, volume);
    } else if (type === "wa" || type === "ce") {
      playTone(ctx, 311.13, 0.35, "sawtooth", 0.12 * volume); // Eb4
    } else {
      playTone(ctx, 440, 0.22, "sine", 0.1 * volume); // A4 nhẹ
    }
  } catch {
    /* Silent fail if AudioContext is blocked by browser autoplay */
  }
}

function playAchievementFanfare(ctx: AudioContext, volume: number) {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  const spacing = 0.12;

  notes.forEach((frequency, index) => {
    const startTime = ctx.currentTime + index * spacing;
    const duration = index === notes.length - 1 ? 0.52 : 0.22;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, startTime);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.11 * volume, startTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  });

  playScheduledTone(ctx, 261.63, ctx.currentTime + 0.36, 0.48, 0.045 * volume);
}

function playScheduledTone(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  gain: number,
) {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(frequency, startTime);
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(gain, startTime + 0.04);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

function playAudioElement(src: string, volume: number) {
  try {
    const audio = new Audio(src);
    audio.volume = volume;
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        /* Autoplay restriction caught */
      });
    }
  } catch {}
}

function playTone(
  ctx: AudioContext,
  freq: number,
  duration: number,
  type: OscillatorType,
  gain: number,
) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gainNode.gain.setValueAtTime(gain, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playChord(ctx: AudioContext, freqs: number[], duration: number, volume: number) {
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.type = "sine";
    const startTime = ctx.currentTime + i * 0.07;
    osc.frequency.setValueAtTime(freq, startTime);
    gainNode.gain.setValueAtTime(0.09 * volume, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration);
  });
}
