import { useRef, useState } from 'react';
import type { ModProject } from '../bedrock/types';
import { TexturePreview } from '../components/TexturePreview';
import { describeContents } from '../bedrock/project';
import { BACKUP_EXTENSION } from '../storage/backup';

interface Props {
  projects: ModProject[];
  loading: boolean;
  onNew: () => void;
  onOpen: (project: ModProject) => void;
  onDelete: (project: ModProject) => void;
  onBackup: (project: ModProject) => void | Promise<void>;
  /** Resolves to the restored mod's name, or throws with a kid-readable reason. */
  onRestore: (file: File) => Promise<string>;
}

export function HomeScreen({
  projects,
  loading,
  onNew,
  onOpen,
  onDelete,
  onBackup,
  onRestore,
}: Props) {
  // Deleting a whole mod throws away everything a kid made, so it always asks.
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setRestoreError(null);
    setRestoreMessage(null);
    try {
      const name = await onRestore(file);
      setRestoreMessage(`Opened “${name}”.`);
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'That file wouldn’t open.');
    }
  };

  return (
    <div className="stack">
      <div className="hero card">
        <div className="hero__text stack">
          <h1>Make your own Minecraft stuff</h1>
          <p className="muted">
            Draw it, name it, tap one button, and play with it in Minecraft. No typing code. Ever.
          </p>
          <div className="row">
            <button className="btn btn--go btn--big" onClick={onNew}>
              ✨ Make a New Mod
            </button>
            <button className="btn btn--ghost" onClick={() => fileInput.current?.click()}>
              📂 Open a saved mod
            </button>
          </div>
        </div>
        <div className="hero__art" aria-hidden>
          ⛏️
        </div>
      </div>

      {/* Kept out of the tab order deliberately — the visible button above is
          the control; this is only the file picker it opens. */}
      <input
        ref={fileInput}
        type="file"
        accept={`${BACKUP_EXTENSION},application/json`}
        hidden
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          // Clear it, so picking the same file twice still fires a change.
          e.target.value = '';
        }}
      />

      {restoreMessage && <p className="ok tiny">✅ {restoreMessage}</p>}
      {restoreError && <p className="warn tiny">⚠️ {restoreError}</p>}

      <section className="stack">
        <h2>My Mods</h2>
        {loading && <p className="muted">Loading your mods…</p>}
        {!loading && projects.length === 0 && (
          <div className="card card--flat empty">
            <p className="muted">
              You haven’t made anything yet. Tap <strong>Make a New Mod</strong> to start!
            </p>
          </div>
        )}
        {projects.length > 0 && (
          <ul className="mod-list grid-auto">
            {projects.map((project) => (
              <li key={project.id} className="mod-card">
                <button
                  className="mod-card__open"
                  aria-label={`Open ${project.name}`}
                  onClick={() => onOpen(project)}
                >
                  <TexturePreview texture={project.icon} size={72} label={`${project.name} icon`} />
                  <span className="mod-card__name">{project.name}</span>
                  <span className="tiny muted">{describeContents(project)}</span>
                </button>

                <button
                  className="btn btn--ghost btn--icon mod-card__save"
                  aria-label={`Save ${project.name} to a file`}
                  title="Save to a file"
                  onClick={() => void onBackup(project)}
                >
                  💾
                </button>

                {confirmDelete === project.id ? (
                  <div className="mod-card__confirm">
                    <button
                      className="btn btn--danger btn--icon"
                      aria-label={`Really delete ${project.name}`}
                      onClick={() => {
                        onDelete(project);
                        setConfirmDelete(null);
                      }}
                    >
                      ✓
                    </button>
                    <button
                      className="btn btn--ghost btn--icon"
                      aria-label={`Keep ${project.name}`}
                      onClick={() => setConfirmDelete(null)}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn--danger btn--icon mod-card__delete"
                    aria-label={`Delete ${project.name}`}
                    onClick={() => setConfirmDelete(project.id)}
                  >
                    🗑️
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {projects.length > 0 && (
          <p className="tiny muted">
            💾 saves a mod to a file you can keep, copy to another computer, or open again later.
          </p>
        )}
      </section>
    </div>
  );
}
