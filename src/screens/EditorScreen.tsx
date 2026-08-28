import { useState } from 'react';
import type { ModItem, ModProject } from '../bedrock/types';
import { TexturePreview } from '../components/TexturePreview';
import { ITEM_PRESETS } from '../bedrock/presets';
import { isTextureEmpty } from '../bedrock/texture';
import type { SaveState } from '../storage/useAutosave';

interface Props {
  project: ModProject;
  saveState: SaveState;
  exporting: boolean;
  onBack: () => void;
  onExport: () => void;
  onAddItem: () => void;
  onEditItem: (item: ModItem) => void;
  onDeleteItem: (item: ModItem) => void;
  onEditIcon: () => void;
}

function saveLabel(state: SaveState): string {
  switch (state) {
    case 'saving':
      return 'Saving…';
    case 'saved':
      return 'Saved ✓';
    case 'error':
      return 'Couldn’t save';
    default:
      return 'Saved ✓';
  }
}

export function EditorScreen({
  project,
  saveState,
  exporting,
  onBack,
  onExport,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onEditIcon,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const emptyTextures = project.items.filter((i) => isTextureEmpty(i.texture));

  return (
    <div className="stack">
      <div className="row">
        <button className="btn btn--ghost" onClick={onBack}>
          ← My Mods
        </button>
        <span className="spacer" />
        <span className={`pill pill--${saveState}`}>{saveLabel(saveState)}</span>
      </div>

      <div className="card editor-head">
        <button className="icon-button" onClick={onEditIcon} aria-label="Change mod icon">
          <TexturePreview texture={project.icon} size={88} label="Mod icon" />
          <span className="tiny">✏️ Icon</span>
        </button>
        <div className="stack editor-head__text">
          <h1>{project.name}</h1>
          <p className="muted">{project.description || 'No description yet.'}</p>
        </div>
      </div>

      <section className="stack">
        <div className="row">
          <h2>Items</h2>
          <span className="spacer" />
          <button className="btn btn--sky" onClick={onAddItem}>
            ➕ Add an item
          </button>
        </div>

        {project.items.length === 0 && (
          <div className="card card--flat empty">
            <p className="muted">No items yet. Tap <strong>Add an item</strong> to make your first one!</p>
          </div>
        )}

        {project.items.length > 0 && (
          <ul className="mod-list grid-auto">
            {project.items.map((item) => {
              const preset = ITEM_PRESETS[item.kind];
              return (
                <li key={item.id} className="mod-card">
                  <button
                    className="mod-card__open"
                    aria-label={`Edit ${item.name || 'this item'}`}
                    onClick={() => onEditItem(item)}
                  >
                    <TexturePreview texture={item.texture} size={64} label={`${item.name || 'Item'} texture`} />
                    <span className="mod-card__name">{item.name || 'Unnamed item'}</span>
                    <span className="tiny muted">
                      {preset.emoji} {preset.label}
                    </span>
                  </button>
                  {confirmDelete === item.id ? (
                    <div className="mod-card__confirm">
                      <button
                        className="btn btn--danger btn--icon"
                        aria-label={`Really delete ${item.name || 'this item'}`}
                        onClick={() => {
                          onDeleteItem(item);
                          setConfirmDelete(null);
                        }}
                      >
                        ✓
                      </button>
                      <button
                        className="btn btn--ghost btn--icon"
                        aria-label="Keep it"
                        onClick={() => setConfirmDelete(null)}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn--danger btn--icon mod-card__delete"
                      aria-label={`Delete ${item.name || 'this item'}`}
                      onClick={() => setConfirmDelete(item.id)}
                    >
                      🗑️
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="card export-bar">
        <div className="stack">
          <h2>Ready to play?</h2>
          <p className="muted">
            {project.items.length === 0
              ? 'Your mod works even with no items — but it’s more fun with some!'
              : `Your mod has ${project.items.length === 1 ? '1 item' : `${project.items.length} items`}.`}
          </p>
          {emptyTextures.length > 0 && (
            <p className="warn tiny">
              ⚠️ {emptyTextures.length === 1 ? 'One item has' : `${emptyTextures.length} items have`} a blank
              picture. They’ll be invisible in the game!
            </p>
          )}
        </div>
        <button className="btn btn--big" onClick={onExport} disabled={exporting}>
          {exporting ? 'Packing…' : '⬇️ Download my mod'}
        </button>
      </div>
    </div>
  );
}
