// ─────────────────────────────────────────────
// 귀여운 효과음 (Web Audio로 직접 합성 — 소리 파일 없음)
// ─────────────────────────────────────────────

export type SoundName = 'click' | 'add' | 'move' | 'paint' | 'erase' | 'loop' | 'success' | 'error' | 'oops' | 'save';

let muted = false;
let ctx: AudioContext | null = null;

export function setMuted(m: boolean) {
  muted = m;
}

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.08) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export function play(name: SoundName) {
  if (muted) return;
  try {
    switch (name) {
      case 'click':
        tone(660, 0, 0.06, 'triangle', 0.05);
        break;
      case 'add':
        tone(523, 0, 0.07, 'triangle', 0.06);
        tone(784, 0.05, 0.08, 'triangle', 0.05);
        break;
      case 'move':
        tone(440, 0, 0.05, 'sine', 0.03);
        break;
      case 'paint':
        tone(880, 0, 0.08, 'triangle', 0.06);
        break;
      case 'erase':
        tone(330, 0, 0.08, 'sine', 0.05);
        break;
      case 'loop':
        tone(587, 0, 0.05, 'sine', 0.03);
        break;
      case 'save':
        tone(659, 0, 0.08, 'triangle', 0.06);
        tone(988, 0.08, 0.12, 'triangle', 0.05);
        break;
      case 'success':
        [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.22, 'triangle', 0.07));
        break;
      case 'oops':
        tone(392, 0, 0.12, 'sine', 0.06);
        tone(330, 0.11, 0.16, 'sine', 0.06);
        break;
      case 'error':
        tone(300, 0, 0.12, 'square', 0.03);
        tone(240, 0.12, 0.18, 'square', 0.03);
        break;
    }
  } catch {
    /* 소리가 안 나도 앱은 계속 동작 */
  }
}
