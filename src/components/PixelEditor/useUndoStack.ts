import { useCallback, useRef, useState } from 'react';

/**
 * Undo/redo over immutable snapshots.
 *
 * Textures are at most 64x64, so keeping whole snapshots costs a few hundred
 * KB at the depth limit — far simpler and less bug-prone than a command log,
 * and it means undo can never drift out of sync with what's on screen.
 */
export function useUndoStack<T>(initial: T, limit = 60) {
  const [present, setPresent] = useState<T>(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const [, forceRender] = useState(0);

  const bump = () => forceRender((n) => n + 1);

  /** Record the current value in history and move to the next one. */
  const commit = useCallback(
    (next: T) => {
      setPresent((current) => {
        if (Object.is(current, next)) return current;
        past.current = [...past.current, current].slice(-limit);
        future.current = [];
        return next;
      });
      bump();
    },
    [limit],
  );

  /** Replace without touching history — used mid-drag. */
  const replace = useCallback((next: T) => setPresent(next), []);

  /** Push the current value onto history without changing it. */
  const checkpoint = useCallback(() => {
    setPresent((current) => {
      past.current = [...past.current, current].slice(-limit);
      future.current = [];
      return current;
    });
    bump();
  }, [limit]);

  const undo = useCallback(() => {
    setPresent((current) => {
      const previous = past.current.at(-1);
      if (previous === undefined) return current;
      past.current = past.current.slice(0, -1);
      future.current = [current, ...future.current];
      return previous;
    });
    bump();
  }, []);

  const redo = useCallback(() => {
    setPresent((current) => {
      const next = future.current[0];
      if (next === undefined) return current;
      future.current = future.current.slice(1);
      past.current = [...past.current, current];
      return next;
    });
    bump();
  }, []);

  const reset = useCallback((value: T) => {
    past.current = [];
    future.current = [];
    setPresent(value);
    bump();
  }, []);

  return {
    present,
    commit,
    replace,
    checkpoint,
    undo,
    redo,
    reset,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
