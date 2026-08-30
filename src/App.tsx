import { useCallback, useEffect, useState } from 'react';
import { HomeScreen } from './screens/HomeScreen';
import { NewModScreen } from './screens/NewModScreen';
import { EditorScreen } from './screens/EditorScreen';
import { PixelEditor } from './components/PixelEditor/PixelEditor';
import { ItemScreen } from './screens/ItemScreen';
import { BlockScreen } from './screens/BlockScreen';
import { MobScreen } from './screens/MobScreen';
import { RuleScreen } from './screens/RuleScreen';
import { ExportScreen } from './screens/ExportScreen';
import { deleteProject, listProjects, saveProject } from './storage/db';
import { useAutosave } from './storage/useAutosave';
import { createProject, createItem, createBlock, createMob, createRule, bumpVersion } from './bedrock/project';
import { exportProject } from './bedrock/package';
import type { ModBlock, ModItem, ModMob, ModProject, ModRule } from './bedrock/types';

type Screen =
  | { name: 'home' }
  | { name: 'new' }
  | { name: 'editor' }
  | { name: 'icon' }
  | { name: 'item'; itemId: string }
  | { name: 'block'; blockId: string }
  | { name: 'mob'; mobId: string }
  | { name: 'rule'; ruleId: string }
  | { name: 'exported'; fileName: string };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [projects, setProjects] = useState<ModProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ModProject | null>(null);
  const [exporting, setExporting] = useState(false);

  const saveState = useAutosave(project);

  const editingItem =
    screen.name === 'item' ? (project?.items.find((i) => i.id === screen.itemId) ?? null) : null;

  const editingBlock =
    screen.name === 'block' ? ((project?.blocks ?? []).find((b) => b.id === screen.blockId) ?? null) : null;

  const editingMob =
    screen.name === 'mob' ? ((project?.mobs ?? []).find((m) => m.id === screen.mobId) ?? null) : null;

  const editingRule =
    screen.name === 'rule' ? ((project?.rules ?? []).find((r) => r.id === screen.ruleId) ?? null) : null;

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
      const fileName = await exportProject(next);
      setScreen({ name: 'exported', fileName });
    } finally {
      setExporting(false);
    }
  }, [project]);

  /** Re-download without leaving the "how to install" screen. */
  const handleDownloadAgain = useCallback(async () => {
    if (!project) return;
    setExporting(true);
    try {
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

  const handleAddItem = useCallback(() => {
    const item = createItem('sword');
    update((draft) => ({ ...draft, items: [...draft.items, item] }));
    setScreen({ name: 'item', itemId: item.id });
  }, [update]);

  const handleItemChange = useCallback(
    (next: ModItem) => {
      update((draft) => ({
        ...draft,
        items: draft.items.map((i) => (i.id === next.id ? next : i)),
      }));
    },
    [update],
  );

  const handleAddBlock = useCallback(() => {
    const block = createBlock();
    update((draft) => ({ ...draft, blocks: [...(draft.blocks ?? []), block] }));
    setScreen({ name: 'block', blockId: block.id });
  }, [update]);

  const handleBlockChange = useCallback(
    (next: ModBlock) => {
      update((draft) => ({
        ...draft,
        blocks: (draft.blocks ?? []).map((b) => (b.id === next.id ? next : b)),
      }));
    },
    [update],
  );

  const handleDeleteBlock = useCallback(
    (block: ModBlock) => {
      update((draft) => ({ ...draft, blocks: (draft.blocks ?? []).filter((b) => b.id !== block.id) }));
    },
    [update],
  );

  const handleAddMob = useCallback(() => {
    const mob = createMob();
    update((draft) => ({ ...draft, mobs: [...(draft.mobs ?? []), mob] }));
    setScreen({ name: 'mob', mobId: mob.id });
  }, [update]);

  const handleMobChange = useCallback(
    (next: ModMob) => {
      update((draft) => ({
        ...draft,
        mobs: (draft.mobs ?? []).map((m) => (m.id === next.id ? next : m)),
      }));
    },
    [update],
  );

  const handleDeleteMob = useCallback(
    (mob: ModMob) => {
      update((draft) => ({ ...draft, mobs: (draft.mobs ?? []).filter((m) => m.id !== mob.id) }));
    },
    [update],
  );

  const handleAddRule = useCallback(() => {
    const rule = createRule();
    update((draft) => ({ ...draft, rules: [...(draft.rules ?? []), rule] }));
    setScreen({ name: 'rule', ruleId: rule.id });
  }, [update]);

  const handleRuleChange = useCallback(
    (next: ModRule) => {
      update((draft) => ({
        ...draft,
        rules: (draft.rules ?? []).map((r) => (r.id === next.id ? next : r)),
      }));
    },
    [update],
  );

  const handleDeleteRule = useCallback(
    (rule: ModRule) => {
      update((draft) => ({ ...draft, rules: (draft.rules ?? []).filter((r) => r.id !== rule.id) }));
    },
    [update],
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

        {screen.name === 'exported' && project && (
          <ExportScreen
            project={project}
            fileName={screen.fileName}
            busy={exporting}
            onBack={() => setScreen({ name: 'editor' })}
            onDownloadAgain={handleDownloadAgain}
          />
        )}

        {screen.name === 'item' && project && editingItem && (
          <ItemScreen
            item={editingItem}
            namespace={project.namespace}
            onChange={handleItemChange}
            onDone={() => setScreen({ name: 'editor' })}
          />
        )}

        {screen.name === 'block' && project && editingBlock && (
          <BlockScreen
            block={editingBlock}
            items={project.items}
            namespace={project.namespace}
            onChange={handleBlockChange}
            onDone={() => setScreen({ name: 'editor' })}
          />
        )}

        {screen.name === 'mob' && project && editingMob && (
          <MobScreen
            mob={editingMob}
            items={project.items}
            namespace={project.namespace}
            onChange={handleMobChange}
            onDone={() => setScreen({ name: 'editor' })}
          />
        )}

        {screen.name === 'rule' && project && editingRule && (
          <RuleScreen
            rule={editingRule}
            items={project.items}
            blocks={project.blocks ?? []}
            mobs={project.mobs ?? []}
            onChange={handleRuleChange}
            onDone={() => setScreen({ name: 'editor' })}
          />
        )}

        {screen.name === 'icon' && project && (
          <div className="card">
            <PixelEditor
              texture={project.icon}
              title="Draw your mod's icon"
              onCancel={() => setScreen({ name: 'editor' })}
              onSave={(icon) => {
                update((draft) => ({ ...draft, icon }));
                setScreen({ name: 'editor' });
              }}
            />
          </div>
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
            onAddItem={handleAddItem}
            onEditItem={(item) => setScreen({ name: 'item', itemId: item.id })}
            onAddBlock={handleAddBlock}
            onEditBlock={(block) => setScreen({ name: 'block', blockId: block.id })}
            onDeleteBlock={handleDeleteBlock}
            onAddMob={handleAddMob}
            onEditMob={(mob) => setScreen({ name: 'mob', mobId: mob.id })}
            onDeleteMob={handleDeleteMob}
            onAddRule={handleAddRule}
            onEditRule={(rule) => setScreen({ name: 'rule', ruleId: rule.id })}
            onDeleteRule={handleDeleteRule}
            onDeleteItem={handleDeleteItem}
            onEditIcon={() => setScreen({ name: 'icon' })}
          />
        )}
      </main>
    </div>
  );
}
