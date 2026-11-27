// ─────────────────────────────────────────────
// 선생님 도구 비밀번호
// 서버가 없는 앱이라 이 컴퓨터의 브라우저에만 저장돼요. 비밀번호 자체가 아니라 섞은 값(해시)만 저장해요.
// 학생이 실수로 설정을 바꾸지 않게 막는 "잠금"이에요. 컴퓨터를 다루는 사람이 브라우저 데이터를 지우면 풀려요.
// ─────────────────────────────────────────────

const KEY = 'pml.teacher.v1';
const SALT = 'pixel-magic-lab:teacher';
export const PASSWORD_MIN = 4;

/** 짧은 문자열 해시 (cyrb53). 암호화가 아니라 비밀번호를 그대로 저장하지 않으려는 용도예요. */
export function hashPassword(pw: string): string {
  const str = SALT + pw;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function readHash(): string | null {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as { hash?: unknown };
    return typeof o.hash === 'string' ? o.hash : null;
  } catch {
    return null;
  }
}

export function hasTeacherPassword(): boolean {
  return readHash() !== null;
}

export function setTeacherPassword(pw: string): boolean {
  if (pw.length < PASSWORD_MIN) return false;
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify({ hash: hashPassword(pw) }));
    return true;
  } catch {
    return false;
  }
}

export function checkTeacherPassword(pw: string): boolean {
  const h = readHash();
  return h !== null && h === hashPassword(pw);
}
