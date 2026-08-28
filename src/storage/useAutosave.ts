import { useEffect, useRef, useState } from 'react';
import type { ModProject } from '../bedrock/types';
import { saveProject } from './db';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Debounced autosave. A kid dragging a slider fires dozens of state updates a
 * second; we coalesce those into one write ~600ms after they stop.
 */
export function useAutosave(project: ModProject | null, delay = 600): SaveState {
  const [state, setState] = useState<SaveState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSerialized = useRef<string>('');

  useEffect(() => {
    if (!project) return;
    const serialized = JSON.stringify(project);
    if (serialized === lastSerialized.current) return;

    if (timer.current) clearTimeout(timer.current);
    setState('saving');
    timer.current = setTimeout(() => {
      saveProject(project)
        .then(() => {
          lastSerialized.current = serialized;
          setState('saved');
        })
        .catch(() => setState('error'));
    }, delay);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [project, delay]);

  return state;
}
