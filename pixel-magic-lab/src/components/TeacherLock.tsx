import { useState, type FormEvent, type ReactNode } from 'react';
import { Icon } from './Icon';
import { PASSWORD_MIN, checkTeacherPassword, hasTeacherPassword, setTeacherPassword } from '../lib/teacherLock';

// 선생님 도구 잠금: 처음에는 비밀번호 만들기, 그다음부터는 비밀번호 넣기.
// 팝업을 닫으면 다시 잠겨요 (다음에 열 때 또 물어봐요).

export function TeacherLock({ children }: { children: (lock: { changePassword: () => void }) => ReactNode }) {
  const [state, setState] = useState<'create' | 'enter' | 'open'>(() => (hasTeacherPassword() ? 'enter' : 'create'));
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPw('');
    setPw2('');
    setError(null);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (state === 'enter') {
      if (checkTeacherPassword(pw)) {
        reset();
        setState('open');
      } else {
        setError('비밀번호가 달라요. 다시 넣어 주세요.');
        setPw('');
      }
      return;
    }
    if (pw.length < PASSWORD_MIN) return setError(`비밀번호는 ${PASSWORD_MIN}글자 이상으로 정해 주세요.`);
    if (pw !== pw2) return setError('두 번 넣은 비밀번호가 달라요.');
    if (!setTeacherPassword(pw)) return setError('저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.');
    reset();
    setState('open');
  };

  if (state === 'open') return <>{children({ changePassword: () => (reset(), setState('create')) })}</>;

  const creating = state === 'create';
  return (
    <form className="teacher-lock" onSubmit={submit}>
      <span className="tl-ico" aria-hidden>
        <Icon name="lock" size={30} />
      </span>
      <h3>{creating ? '선생님 비밀번호 만들기' : '선생님 비밀번호'}</h3>
      <p className="note">
        {creating
          ? '학생들이 설정을 바꾸지 않도록 비밀번호를 정해 주세요. 이 컴퓨터의 브라우저에만 저장돼요.'
          : '선생님 도구를 열려면 비밀번호를 넣어 주세요.'}
      </p>
      <label className="tl-field">
        <span>비밀번호</span>
        <input
          type="password"
          autoComplete={creating ? 'new-password' : 'current-password'}
          value={pw}
          onChange={(e) => (setPw(e.target.value), setError(null))}
          data-autofocus
          aria-invalid={!!error}
          aria-describedby={error ? 'tl-error' : undefined}
        />
      </label>
      {creating && (
        <label className="tl-field">
          <span>한 번 더</span>
          <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => (setPw2(e.target.value), setError(null))} />
        </label>
      )}
      {error && (
        <p className="tl-error" id="tl-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary">
        {creating ? '비밀번호 정하기' : '열기'}
      </button>
      {creating && <p className="note">비밀번호를 잊으면 브라우저의 사이트 데이터를 지워야 풀려요. 이때 학생 작품도 함께 지워져요.</p>}
    </form>
  );
}
