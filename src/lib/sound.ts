// Tạo âm thanh bằng Web Audio API thuần túy — không cần file .mp3

type SoundType = "ac" | "wa" | "ce" | "tle";

const MUTE_KEY = "a2oj:sound:muted";

export function isSoundMuted(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(MUTE_KEY) === "1";
  } catch { return false; }
}

export function setSoundMuted(muted: boolean): void {
  try { window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0"); } catch {}
}

export function playSound(type: SoundType): void {
  if (isSoundMuted()) return;
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    // AC: chuỗi nốt vui tươi (C5→E5→G5)
    // WA/CE: nốt thấp buồn (Eb4 rồi D4 giảm)
    // TLE: tone trung tính cảnh báo
    if (type === "ac") {
      playChord(ctx, [523.25, 659.25, 783.99], 0.15); // C5, E5, G5
    } else if (type === "wa" || type === "ce") {
      playTone(ctx, 311.13, 0.3, "sawtooth", 0.1); // Eb4
    } else {
      playTone(ctx, 440, 0.2, "sine", 0.08); // A4 nhẹ
    }
  } catch { /* AudioContext blocked — silent fail */ }
}

function playTone(ctx: AudioContext, freq: number, duration: number, type: OscillatorType, gain: number) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gainNode.gain.setValueAtTime(gain, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playChord(ctx: AudioContext, freqs: number[], duration: number) {
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.06);
    gainNode.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.06);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.06 + duration);
    osc.start(ctx.currentTime + i * 0.06);
    osc.stop(ctx.currentTime + i * 0.06 + duration);
  });
}
