import { useEffect, useState } from 'react';
import { listProjects } from './storage/db';
import type { ModProject } from './bedrock/types';

/**
 * Milestone 0 shell: proves React + IndexedDB are wired up. Replaced by the
 * real router in Milestone 1.
 */
export default function App() {
  const [projects, setProjects] = useState<ModProject[] | null>(null);

  useEffect(() => {
    listProjects().then(setProjects);
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="topbar__logo" aria-hidden>
            ⛏️
          </span>
          Bedrock Mod Maker
        </div>
      </header>
      <main className="page">
        <div className="card stack">
          <h1>Scaffold is alive</h1>
          <p className="muted">
            Saved mods found: {projects === null ? 'checking…' : projects.length}
          </p>
        </div>
      </main>
    </div>
  );
}
