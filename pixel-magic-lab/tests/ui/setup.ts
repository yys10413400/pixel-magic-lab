import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom 에 없는 브라우저 기능을 가볍게 채워요
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
if (!document.elementFromPoint) document.elementFromPoint = () => null;

afterEach(() => {
  cleanup();
  localStorage.clear();
});
