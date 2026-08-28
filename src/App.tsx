import { useCallback, useEffect, useState } from 'react';
import { HomeScreen } from './screens/HomeScreen';
import { NewModScreen } from './screens/NewModScreen';
import { EditorScreen } from './screens/EditorScreen';
import { deleteProject, listProjects, saveProject } from './storage/db';
import { useAutosave } from './storage/useAutosave';
import { createProject, bumpVersion } from './bedrock/project';
import { exportProject } from './bedrock/package';
import type { ModItem, ModProject } from './bedrock/types';

type Screen = { name: 'home' } | { name: 'new' } | { name: 'editor' };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [projects, setProjects] = useState<ModProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ModProject | null>(null);
  const [exporting, setExporting] = useState(false);

  const saveState = useAutosave(project);

  const refresh = useCallback(async () => {
    setProjects(await listProjects());
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Every project mutation goes through here so updatedAt stays honest. */
  const update = useCallback((mutate: (draft: ModProject) => ModProject) => {
    setProject((current) => (current ? { ...mutate(current), updatedAt: Date.now() } : current));
  }, []);

  const handleCreate = useCallback(
    async (name: string, description: string) => {
      const created = createProject(name, description);
      await saveProject(created);
      setProject(created);
      setScreen({ name: 'editor' });
      void refresh();
    },
    [refresh],
  );

  const handleExport = useCallback(async () => {
    if (!project) return;
    setExporting(true);
    try {
      // Bump the version so a re-import replaces the previous copy in-game
      // instead of being silently ignored as "already installed".
      const next = { ...project, version: bumpVersion(project), updatedAt: Date.now() };
      setProject(next);
      await saveProject(next);
      await exportProject(next);
    } finally {
      setExporting(false);
    }
  }, [project]);

  const handleDeleteProject = useCallback(
    async (target: ModProject) => {
      await deleteProject(target.id);
      void refresh();
    },
    [refresh],
  );

  const handleDeleteItem = useCallback(
    (item: ModItem) => {
      update((draft) => ({ ...draft, items: draft.items.filter((i) => i.id !== item.id) }));
    },
    [update],
  );

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
        {screen.name === 'home' && (
          <HomeScreen
            projects={projects}
            loading={loading}
            onNew={() => setScreen({ name: 'new' })}
            onOpen={(p) => {
              setProject(p);
              setScreen({ name: 'editor' });
            }}
            onDelete={handleDeleteProject}
          />
        )}

        {screen.name === 'new' && (
          <NewModScreen onCreate={handleCreate} onCancel={() => setScreen({ name: 'home' })} />
        )}

        {screen.name === 'editor' && project && (
          <EditorScreen
            project={project}
            saveState={saveState}
            exporting={exporting}
            onBack={() => {
              setScreen({ name: 'home' });
              void refresh();
            }}
            onExport={handleExport}
            onAddItem={() => {
              /* Milestone 3 */
            }}
            onEditItem={() => {
              /* Milestone 3 */
            }}
            onDeleteItem={handleDeleteItem}
            onEditIcon={() => {
              /* Milestone 2 */
            }}
          />
        )}
      </main>
    </div>
  );
}
