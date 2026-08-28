import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());

// jsdom has no layout engine, so canvas-backed components need these stubs to
// resolve pointer coordinates the same way a real browser would.
if (typeof HTMLCanvasElement !== 'undefined' && !HTMLCanvasElement.prototype.getContext) {
  HTMLCanvasElement.prototype.getContext = () => null;
}
