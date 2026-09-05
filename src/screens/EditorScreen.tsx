import { useState } from 'react';
import type { ModBlock, ModItem, ModMob, ModProject, ModRule } from '../bedrock/types';
import { TexturePreview } from '../components/TexturePreview';
import { ITEM_PRESETS } from '../bedrock/presets';
import { actionSpec, triggerSpec } from '../bedrock/rulePresets';
import { ruleProblem } from '../bedrock/rules';
import { describeContents } from '../bedrock/project';
import { isTextureEmpty } from '../bedrock/texture';
import type { SaveState } from '../storage/useAutosave';
import { Icon } from '../components/Icon';

interface Props {
  project: ModProject;
  saveState: SaveState;
  exporting: boolean;
  onBack: () => void;
  onExport: () => void;
  onAddItem: () => void;
  onEditItem: (item: ModItem) => void;
  onDeleteItem: (item: ModItem) => void;
  onAddBlock: () => void;
  onEditBlock: (block: ModBlock) => void;
  onDeleteBlock: (block: ModBlock) => void;
  onAddMob: () => void;
  onEditMob: (mob: ModMob) => void;
  onDeleteMob: (mob: ModMob) => void;
  onAddRule: () => void;
  onEditRule: (rule: ModRule) => void;
  onDeleteRule: (rule: ModRule) => void;
  onEditIcon: () => void;
}

function saveLabel(state: SaveState): string {
  switch (state) {
    case 'saving':
      return 'Saving…';
    case 'saved':
      return 'Saved';
    case 'error':
      return 'Couldn’t save';
    default:
      return 'Saved';
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
  onAddBlock,
  onEditBlock,
  onDeleteBlock,
  onAddMob,
  onEditMob,
  onDeleteMob,
  onAddRule,
  onEditRule,
  onDeleteRule,
  onEditIcon,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const blocks = project.blocks ?? [];
  const mobs = project.mobs ?? [];
  const rules = project.rules ?? [];

  // Rules are dropped silently by the generator when they cannot run, so the
  // warning has to happen here, before export — same split as "this item has
  // no picture". Resolution goes through the project's own lists rather than
  // final identifiers, which is all the UI needs to spot a dangling subject.
  const ruleCtx = {
    item: (id: string) => (project.items.some((i) => i.id === id) ? id : null),
    block: (id: string) => (blocks.some((b) => b.id === id) ? id : null),
    mob: (id: string) => (mobs.some((m) => m.id === id) ? id : null),
  };
  const ruleProblems = new Map(
    rules.map((rule) => [rule.id, ruleProblem(rule, ruleCtx)] as const).filter(([, p]) => p),
  );
  const emptyTextures = [
    ...project.items.filter((i) => isTextureEmpty(i.texture)),
    ...blocks.filter((b) => isTextureEmpty(b.texture)),
    ...mobs.filter((m) => isTextureEmpty(m.texture)),
  ];
  // Same split as the blank-picture warning: the export is perfectly valid,
  // it just will not say what the kid expects once they are in the game.
  const unnamed = [
    ...project.items.filter((i) => !i.name.trim()),
    ...blocks.filter((b) => !b.name.trim()),
    ...mobs.filter((m) => !m.name.trim()),
  ];
  const thingCount = project.items.length + blocks.length + mobs.length;

  return (
    <div className="stack">
      <div className="row">
        <button className="btn btn--ghost" onClick={onBack}>
          <Icon name="arrowLeft" size={17} /> My Mods
        </button>
        <span className="spacer" />
        <span className={`pill pill--${saveState}`}>{saveLabel(saveState)}</span>
      </div>

      <div className="card editor-head">
        <button className="icon-button" onClick={onEditIcon} aria-label="Change mod icon">
          <TexturePreview texture={project.icon} size={88} label="Mod icon" />
          <span className="tiny"><Icon name="pencil" size={14} className="icon--inline" /> Icon</span>
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
            <Icon name="plus" size={17} /> Add an item
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
                        <Icon name="check" size={17} />
                      </button>
                      <button
                        className="btn btn--ghost btn--icon"
                        aria-label="Keep it"
                        onClick={() => setConfirmDelete(null)}
                      >
                        <Icon name="close" size={17} />
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn--danger btn--icon mod-card__delete"
                      aria-label={`Delete ${item.name || 'this item'}`}
                      onClick={() => setConfirmDelete(item.id)}
                    >
                      <Icon name="trash" size={17} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="stack">
        <div className="row">
          <h2>Blocks</h2>
          <span className="spacer" />
          <button className="btn btn--sky" onClick={onAddBlock}>
            <Icon name="plus" size={17} /> Add a block
          </button>
        </div>

        {blocks.length === 0 && (
          <div className="card card--flat empty">
            <p className="muted">
              No blocks yet. Blocks are things you place in the world, like stone or glass.
            </p>
          </div>
        )}

        {blocks.length > 0 && (
          <ul className="mod-list grid-auto">
            {blocks.map((block) => (
              <li key={block.id} className="mod-card">
                <button
                  className="mod-card__open"
                  aria-label={`Edit ${block.name || 'this block'}`}
                  onClick={() => onEditBlock(block)}
                >
                  <TexturePreview texture={block.texture} size={64} label={`${block.name || 'Block'} texture`} />
                  <span className="mod-card__name">{block.name || 'Unnamed block'}</span>
                  <span className="tiny muted"><Icon name="cube" size={14} className="icon--inline" /> Block</span>
                </button>
                {confirmDelete === block.id ? (
                  <div className="mod-card__confirm">
                    <button
                      className="btn btn--danger btn--icon"
                      aria-label={`Really delete ${block.name || 'this block'}`}
                      onClick={() => {
                        onDeleteBlock(block);
                        setConfirmDelete(null);
                      }}
                    >
                      <Icon name="check" size={17} />
                    </button>
                    <button
                      className="btn btn--ghost btn--icon"
                      aria-label="Keep it"
                      onClick={() => setConfirmDelete(null)}
                    >
                      <Icon name="close" size={17} />
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn--danger btn--icon mod-card__delete"
                    aria-label={`Delete ${block.name || 'this block'}`}
                    onClick={() => setConfirmDelete(block.id)}
                  >
                    <Icon name="trash" size={17} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="stack">
        <div className="row">
          <h2>Creatures</h2>
          <span className="spacer" />
          <button className="btn btn--sky" onClick={onAddMob}>
            <Icon name="plus" size={17} /> Add a creature
          </button>
        </div>

        {mobs.length === 0 && (
          <div className="card card--flat empty">
            <p className="muted">No creatures yet. Make an animal or a monster that walks around!</p>
          </div>
        )}

        {mobs.length > 0 && (
          <ul className="mod-list grid-auto">
            {mobs.map((mob) => (
              <li key={mob.id} className="mod-card">
                <button
                  className="mod-card__open"
                  aria-label={`Edit ${mob.name || 'this creature'}`}
                  onClick={() => onEditMob(mob)}
                >
                  <TexturePreview texture={mob.texture} size={64} label={`${mob.name || 'Creature'} skin`} />
                  <span className="mod-card__name">{mob.name || 'Unnamed creature'}</span>
                  <span className="tiny muted"><Icon name="paw" size={14} className="icon--inline" /> Creature</span>
                </button>
                {confirmDelete === mob.id ? (
                  <div className="mod-card__confirm">
                    <button
                      className="btn btn--danger btn--icon"
                      aria-label={`Really delete ${mob.name || 'this creature'}`}
                      onClick={() => {
                        onDeleteMob(mob);
                        setConfirmDelete(null);
                      }}
                    >
                      <Icon name="check" size={17} />
                    </button>
                    <button
                      className="btn btn--ghost btn--icon"
                      aria-label="Keep it"
                      onClick={() => setConfirmDelete(null)}
                    >
                      <Icon name="close" size={17} />
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn--danger btn--icon mod-card__delete"
                    aria-label={`Delete ${mob.name || 'this creature'}`}
                    onClick={() => setConfirmDelete(mob.id)}
                  >
                    <Icon name="trash" size={17} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="stack">
        <div className="row">
          <h2>Rules</h2>
          <span className="spacer" />
          <button className="btn btn--sky" onClick={onAddRule}>
            <Icon name="plus" size={17} /> Add a rule
          </button>
        </div>

        {rules.length === 0 && (
          <div className="card card--flat empty">
            <p className="muted">
              No rules yet. A rule makes something happen — “when someone uses my gem, strike
              lightning!”
            </p>
          </div>
        )}

        {rules.length > 0 && (
          <ul className="mod-list grid-auto">
            {rules.map((rule) => {
              const problem = ruleProblems.get(rule.id);
              return (
                <li key={rule.id} className="mod-card">
                  <button
                    className="mod-card__open"
                    aria-label={`Edit ${rule.name || 'this rule'}`}
                    onClick={() => onEditRule(rule)}
                  >
                    <span className="mod-card__glyph" aria-hidden>
                      {triggerSpec(rule.trigger).emoji}
                      {actionSpec(rule.action).emoji}
                    </span>
                    <span className="mod-card__name">{rule.name || 'Unnamed rule'}</span>
                    <span className="tiny muted">
                      {problem ?? actionSpec(rule.action).label}
                    </span>
                  </button>
                  {confirmDelete === rule.id ? (
                    <div className="mod-card__confirm">
                      <button
                        className="btn btn--danger btn--icon"
                        aria-label={`Really delete ${rule.name || 'this rule'}`}
                        onClick={() => {
                          onDeleteRule(rule);
                          setConfirmDelete(null);
                        }}
                      >
                        <Icon name="check" size={17} />
                      </button>
                      <button
                        className="btn btn--ghost btn--icon"
                        aria-label="Keep it"
                        onClick={() => setConfirmDelete(null)}
                      >
                        <Icon name="close" size={17} />
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn--danger btn--icon mod-card__delete"
                      aria-label={`Delete ${rule.name || 'this rule'}`}
                      onClick={() => setConfirmDelete(rule.id)}
                    >
                      <Icon name="trash" size={17} />
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
            {thingCount === 0 && rules.length === 0
              ? 'Your mod works even when it’s empty — but it’s more fun with stuff in it!'
              : `Your mod has ${describeContents(project)} in it.`}
          </p>
          {emptyTextures.length > 0 && (
            <p className="warn tiny">
              <Icon name="warning" size={15} className="icon--inline" /> {emptyTextures.length === 1 ? 'One thing has' : `${emptyTextures.length} things have`} a blank
              picture. They’ll be invisible in the game!
            </p>
          )}
          {unnamed.length > 0 && (
            <p className="warn tiny">
              <Icon name="warning" size={15} className="icon--inline" /> {unnamed.length === 1 ? 'One thing still needs' : `${unnamed.length} things still need`} a
              name. The game will just call {unnamed.length === 1 ? 'it “Unnamed”' : 'them “Unnamed”'}.
            </p>
          )}
          {ruleProblems.size > 0 && (
            <p className="warn tiny">
              <Icon name="warning" size={15} className="icon--inline" /> {ruleProblems.size === 1 ? 'One rule isn’t' : `${ruleProblems.size} rules aren’t`} finished
              yet, so {ruleProblems.size === 1 ? 'it' : 'they'} won’t be in your mod.
            </p>
          )}
        </div>
        <button className="btn btn--big" onClick={onExport} disabled={exporting}>
          {exporting ? ('Packing…') : (<>
                <Icon name="download" size={17} /> Download my mod
              </>)}
        </button>
      </div>
    </div>
  );
}
