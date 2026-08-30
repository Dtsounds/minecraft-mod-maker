import { useState } from 'react';
import type { BlockDrop, ModBlock, ModItem, Texture } from '../bedrock/types';
import { BLOCK_LOOKS, BLOCK_TOOLS, DROP_COUNT, GLOW, HARDNESS } from '../bedrock/blockPresets';
import { Slider } from '../components/Slider';
import { TexturePreview } from '../components/TexturePreview';
import { PixelEditor } from '../components/PixelEditor/PixelEditor';
import { RecipeGrid } from '../components/RecipeGrid';
import { SWATCHES, applySwatch } from '../components/swatches';
import { VANILLA_ITEMS, VANILLA_GROUPS, lookupVanilla } from '../bedrock/vanillaItems';
import { recipeHasIngredients } from '../bedrock/recipe';
import { isTextureEmpty } from '../bedrock/texture';
import { blockIdentifier } from '../bedrock/block';

interface Props {
  block: ModBlock;
  items: ModItem[];
  namespace: string;
  onChange: (block: ModBlock) => void;
  onDone: () => void;
}

type Step = 'basics' | 'look' | 'breaking' | 'recipe';
type Face = 'texture' | 'textureTop' | 'textureBottom';

const STEPS: { id: Step; label: string; emoji: string }[] = [
  { id: 'basics', label: 'Name', emoji: '🏷️' },
  { id: 'look', label: 'Picture', emoji: '🎨' },
  { id: 'breaking', label: 'Breaking', emoji: '⛏️' },
  { id: 'recipe', label: 'Recipe', emoji: '🧪' },
];

export function BlockScreen({ block, items, namespace, onChange, onDone }: Props) {
  const [step, setStep] = useState<Step>('basics');
  const [drawing, setDrawing] = useState<Face | null>(null);

  const patch = (changes: Partial<ModBlock>) => onChange({ ...block, ...changes });

  if (drawing) {
    const labels: Record<Face, string> = {
      texture: block.faceMode === 'all' ? 'every side' : 'the sides',
      textureTop: 'the top',
      textureBottom: 'the bottom',
    };
    return (
      <div className="card">
        <PixelEditor
          texture={block[drawing] as Texture}
          title={`Draw ${labels[drawing]}`}
          onCancel={() => setDrawing(null)}
          onSave={(texture) => {
            patch({ [drawing]: texture } as Partial<ModBlock>);
            setDrawing(null);
          }}
        />
      </div>
    );
  }

  const drop: BlockDrop = block.drop ?? { kind: 'self' };

  return (
    <div className="stack">
      <div className="row">
        <button className="btn btn--ghost" onClick={onDone}>
          ← Back to my mod
        </button>
        <span className="spacer" />
        <TexturePreview texture={block.texture} size={48} label="Block preview" />
        <strong>{block.name || 'Unnamed block'}</strong>
      </div>

      <nav className="steps" aria-label="Steps">
        {STEPS.map((s) => (
          <button
            key={s.id}
            className={`step ${step === s.id ? 'step--on' : ''}`}
            aria-current={step === s.id ? 'step' : undefined}
            onClick={() => setStep(s.id)}
          >
            <span aria-hidden>{s.emoji}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </nav>

      {step === 'basics' && (
        <div className="card stack">
          <h2>What is it?</h2>
          <div className="field">
            <label className="field__label" htmlFor="block-name">
              Name it
            </label>
            <input
              id="block-name"
              className="input"
              value={block.name}
              maxLength={40}
              placeholder="Ruby Ore"
              autoComplete="off"
              onChange={(e) => patch({ name: e.target.value })}
            />
            <p className="field__hint">
              In the game it’ll be <code>{blockIdentifier(namespace, block)}</code>
            </p>
          </div>

          <div className="stack">
            <span className="field__label">How does it look?</span>
            <div className="kind-grid" role="group" aria-label="Block look">
              {BLOCK_LOOKS.map((spec) => (
                <button
                  key={spec.look}
                  className={`kind ${block.look === spec.look ? 'kind--on' : ''}`}
                  aria-pressed={block.look === spec.look}
                  onClick={() => patch({ look: spec.look })}
                >
                  <span className="kind__emoji" aria-hidden>
                    {spec.emoji}
                  </span>
                  <span className="kind__label">{spec.label}</span>
                  <span className="tiny muted">{spec.blurb}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="row">
            <button className="btn btn--go" onClick={() => setStep('look')}>
              Next: draw it →
            </button>
          </div>
        </div>
      )}

      {step === 'look' && (
        <div className="card stack">
          <h2>What does it look like?</h2>

          <label className="toggle">
            <input
              type="checkbox"
              checked={block.faceMode === 'topSideBottom'}
              onChange={(e) => patch({ faceMode: e.target.checked ? 'topSideBottom' : 'all' })}
            />
            <span className="toggle__label">Give the top and bottom their own pictures (like grass)</span>
          </label>

          <div className="row">
            {(
              [
                ['texture', block.faceMode === 'all' ? 'All sides' : 'Sides'],
                ...(block.faceMode === 'topSideBottom'
                  ? ([
                      ['textureTop', 'Top'],
                      ['textureBottom', 'Bottom'],
                    ] as [Face, string][])
                  : []),
              ] as [Face, string][]
            ).map(([face, label]) => (
              <div key={face} className="stack face-slot">
                <span className="field__label">{label}</span>
                <TexturePreview texture={block[face] as Texture} size={96} label={`${label} texture`} />
                <button className="btn" onClick={() => setDrawing(face)}>
                  ✏️ Draw {label.toLowerCase()}
                </button>
                {isTextureEmpty(block[face] as Texture) && <p className="warn tiny">⚠️ Blank</p>}
              </div>
            ))}
          </div>

          <div className="stack">
            <span className="field__label">…or start the sides from one of these</span>
            <div className="swatch-grid" role="group" aria-label="Starter pictures">
              {SWATCHES.map((swatch) => (
                <button
                  key={swatch.id}
                  className="starter"
                  aria-label={`Use the ${swatch.label} picture`}
                  onClick={() => patch({ texture: applySwatch(swatch, block.texture.size) })}
                >
                  <TexturePreview texture={applySwatch(swatch, 16)} size={56} label="" />
                  <span className="tiny">{swatch.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="row">
            <button className="btn btn--go" onClick={() => setStep('breaking')}>
              Next: breaking →
            </button>
          </div>
        </div>
      )}

      {step === 'breaking' && (
        <div className="card stack">
          <h2>Breaking it</h2>

          <Slider spec={HARDNESS} value={block.hardness} onChange={(hardness) => patch({ hardness })} />
          <Slider spec={GLOW} value={block.glow} onChange={(glow) => patch({ glow })} />

          <div className="stack">
            <span className="field__label">What do you need to break it?</span>
            <div className="row" role="group" aria-label="Required tool">
              {BLOCK_TOOLS.map((spec) => (
                <button
                  key={spec.tool}
                  className={`btn ${block.tool === spec.tool ? '' : 'btn--ghost'}`}
                  aria-pressed={block.tool === spec.tool}
                  onClick={() => patch({ tool: spec.tool })}
                >
                  {spec.emoji} {spec.label}
                </button>
              ))}
            </div>
            {block.tool !== 'any' && (
              <p className="tiny muted">
                With the wrong tool it still breaks, but you get nothing — same as mining stone by hand.
              </p>
            )}
          </div>

          <div className="stack">
            <span className="field__label">What do you get when it breaks?</span>
            <div className="row" role="group" aria-label="What it drops">
              <button
                className={`btn ${drop.kind === 'self' ? '' : 'btn--ghost'}`}
                aria-pressed={drop.kind === 'self'}
                onClick={() => patch({ drop: { kind: 'self' } })}
              >
                🧱 The block
              </button>
              <button
                className={`btn ${drop.kind === 'nothing' ? '' : 'btn--ghost'}`}
                aria-pressed={drop.kind === 'nothing'}
                onClick={() => patch({ drop: { kind: 'nothing' } })}
              >
                🚫 Nothing
              </button>
              <button
                className={`btn ${drop.kind === 'vanilla' ? '' : 'btn--ghost'}`}
                aria-pressed={drop.kind === 'vanilla'}
                onClick={() => patch({ drop: { kind: 'vanilla', id: 'minecraft:diamond' } })}
              >
                💎 A Minecraft item
              </button>
              {items.length > 0 && (
                <button
                  className={`btn ${drop.kind === 'myItem' ? '' : 'btn--ghost'}`}
                  aria-pressed={drop.kind === 'myItem'}
                  onClick={() => patch({ drop: { kind: 'myItem', itemId: items[0]!.id } })}
                >
                  ✨ One of my items
                </button>
              )}
            </div>

            {drop.kind === 'vanilla' && (
              <div className="recipe__palette" role="group" aria-label="Which Minecraft item">
                {VANILLA_GROUPS.flatMap((g) => VANILLA_ITEMS.filter((v) => v.group === g.key)).map((v) => (
                  <button
                    key={v.id}
                    className={`ingredient ${drop.id === v.id ? 'ingredient--on' : ''}`}
                    aria-pressed={drop.id === v.id}
                    aria-label={v.label}
                    onClick={() => patch({ drop: { kind: 'vanilla', id: v.id } })}
                  >
                    <span className="chip" style={{ background: v.color }}>
                      <span aria-hidden>{v.glyph}</span>
                    </span>
                    <span className="tiny">{v.label}</span>
                  </button>
                ))}
              </div>
            )}

            {drop.kind === 'myItem' && (
              <div className="recipe__palette" role="group" aria-label="Which of my items">
                {items.map((item) => (
                  <button
                    key={item.id}
                    className={`ingredient ${drop.itemId === item.id ? 'ingredient--on' : ''}`}
                    aria-pressed={drop.itemId === item.id}
                    aria-label={item.name || 'Unnamed item'}
                    onClick={() => patch({ drop: { kind: 'myItem', itemId: item.id } })}
                  >
                    <TexturePreview texture={item.texture} size={42} label="" />
                    <span className="tiny">{item.name || 'Unnamed'}</span>
                  </button>
                ))}
              </div>
            )}

            {drop.kind !== 'nothing' && (
              <Slider spec={DROP_COUNT} value={block.dropCount} onChange={(dropCount) => patch({ dropCount })} />
            )}
          </div>

          <div className="row">
            <button className="btn btn--go" onClick={() => setStep('recipe')}>
              Next: recipe →
            </button>
          </div>
        </div>
      )}

      {step === 'recipe' && (
        <div className="card stack">
          <h2>How do you make it?</h2>

          <label className="toggle">
            <input
              type="checkbox"
              checked={block.recipe.enabled}
              onChange={(e) => patch({ recipe: { ...block.recipe, enabled: e.target.checked } })}
            />
            <span className="toggle__label">Craft it in a crafting table</span>
          </label>

          {block.recipe.enabled && (
            <>
              <RecipeGrid
                grid={block.recipe.grid}
                count={block.recipe.count}
                resultTexture={block.texture}
                resultName={block.name}
                onChange={(grid) => patch({ recipe: { ...block.recipe, grid } })}
                onCountChange={(count) => patch({ recipe: { ...block.recipe, count } })}
              />
              {!recipeHasIngredients(block.recipe.grid) && (
                <p className="warn tiny">⚠️ The grid is empty, so no recipe will be added.</p>
              )}
            </>
          )}

          <hr className="rule" />

          <label className="toggle">
            <input
              type="checkbox"
              checked={block.smelting.enabled}
              onChange={(e) => patch({ smelting: { ...block.smelting, enabled: e.target.checked } })}
            />
            <span className="toggle__label">Cook it in a furnace</span>
          </label>

          {block.smelting.enabled && (
            <div className="stack">
              <p className="tiny muted">
                Put this in a furnace and get <strong>{block.name || 'your block'}</strong>:
              </p>
              <div className="recipe__palette" role="group" aria-label="What to cook">
                {VANILLA_ITEMS.map((v) => (
                  <button
                    key={v.id}
                    className={`ingredient ${block.smelting.input === v.id ? 'ingredient--on' : ''}`}
                    aria-pressed={block.smelting.input === v.id}
                    aria-label={v.label}
                    onClick={() => patch({ smelting: { ...block.smelting, input: v.id } })}
                  >
                    <span className="chip" style={{ background: v.color }}>
                      <span aria-hidden>{v.glyph}</span>
                    </span>
                    <span className="tiny">{v.label}</span>
                  </button>
                ))}
              </div>
              {!lookupVanilla(block.smelting.input) && (
                <p className="warn tiny">⚠️ Pick something to cook, or no furnace recipe will be added.</p>
              )}
            </div>
          )}

          <div className="row">
            <button className="btn btn--go btn--big" onClick={onDone}>
              ✓ All done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
