import { useState } from 'react';
import type { ItemKind, ModItem } from '../bedrock/types';
import { ARMOR_SLOTS, ITEM_PRESETS, ITEM_PRESET_ORDER, PROJECTILE_KINDS } from '../bedrock/presets';
import { Slider } from '../components/Slider';
import { TexturePreview } from '../components/TexturePreview';
import { PixelEditor } from '../components/PixelEditor/PixelEditor';
import { RecipeGrid } from '../components/RecipeGrid';
import { SWATCHES, applySwatch } from '../components/swatches';
import { recipeHasIngredients } from '../bedrock/recipe';
import { isTextureEmpty } from '../bedrock/texture';
import { itemIdentifier } from '../bedrock/item';

interface Props {
  item: ModItem;
  namespace: string;
  onChange: (item: ModItem) => void;
  onDone: () => void;
}

type Step = 'basics' | 'look' | 'stats' | 'recipe';

const STEPS: { id: Step; label: string; emoji: string }[] = [
  { id: 'basics', label: 'Name', emoji: '🏷️' },
  { id: 'look', label: 'Picture', emoji: '🎨' },
  { id: 'stats', label: 'Powers', emoji: '💪' },
  { id: 'recipe', label: 'Recipe', emoji: '🧪' },
];

/**
 * The item creator.
 *
 * Every control writes straight through to the project via `onChange`, so
 * there is no separate draft to lose and autosave picks up each change. The
 * sliders come from the preset spec, which is also what the generator clamps
 * against — the UI and the JSON layer cannot drift apart.
 */
export function ItemScreen({ item, namespace, onChange, onDone }: Props) {
  const [step, setStep] = useState<Step>('basics');
  const [drawing, setDrawing] = useState(false);
  const preset = ITEM_PRESETS[item.kind];

  const patch = (changes: Partial<ModItem>) => onChange({ ...item, ...changes });

  if (drawing) {
    return (
      <div className="card">
        <PixelEditor
          texture={item.texture}
          title={`Draw ${item.name || 'your item'}`}
          onCancel={() => setDrawing(false)}
          onSave={(texture) => {
            patch({ texture });
            setDrawing(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="row">
        <button className="btn btn--ghost" onClick={onDone}>
          ← Back to my mod
        </button>
        <span className="spacer" />
        <TexturePreview texture={item.texture} size={48} label="Item preview" />
        <strong>{item.name || 'Unnamed item'}</strong>
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
            <label className="field__label" htmlFor="item-name">
              Name it
            </label>
            <input
              id="item-name"
              className="input"
              value={item.name}
              maxLength={40}
              placeholder="Ruby Sword"
              autoComplete="off"
              onChange={(e) => patch({ name: e.target.value })}
            />
            <p className="field__hint">
              In the game it’ll be <code>{itemIdentifier(namespace, item)}</code>
            </p>
          </div>

          <div className="stack">
            <span className="field__label">What kind of thing is it?</span>
            <div className="kind-grid" role="group" aria-label="Item type">
              {ITEM_PRESET_ORDER.map((kind: ItemKind) => {
                const p = ITEM_PRESETS[kind];
                return (
                  <button
                    key={kind}
                    className={`kind ${item.kind === kind ? 'kind--on' : ''}`}
                    aria-pressed={item.kind === kind}
                    onClick={() => patch({ kind })}
                  >
                    <span className="kind__emoji" aria-hidden>
                      {p.emoji}
                    </span>
                    <span className="kind__label">{p.label}</span>
                    <span className="tiny muted">{p.blurb}</span>
                  </button>
                );
              })}
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
          <div className="row">
            <TexturePreview texture={item.texture} size={128} label="Item texture" />
            <div className="stack">
              <button className="btn btn--big" onClick={() => setDrawing(true)}>
                ✏️ Draw it myself
              </button>
              {isTextureEmpty(item.texture) && (
                <p className="warn tiny">⚠️ It’s blank right now — it’ll be invisible in the game!</p>
              )}
            </div>
          </div>

          <div className="stack">
            <span className="field__label">…or start from one of these</span>
            <div className="swatch-grid" role="group" aria-label="Starter pictures">
              {SWATCHES.map((swatch) => (
                <button
                  key={swatch.id}
                  className="starter"
                  aria-label={`Use the ${swatch.label} picture`}
                  onClick={() => patch({ texture: applySwatch(swatch, item.texture.size) })}
                >
                  <TexturePreview texture={applySwatch(swatch, 16)} size={56} label="" />
                  <span className="tiny">{swatch.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="row">
            <button className="btn btn--go" onClick={() => setStep('stats')}>
              Next: powers →
            </button>
          </div>
        </div>
      )}

      {step === 'stats' && (
        <div className="card stack">
          <h2>How strong is it?</h2>
          <p className="muted">
            {preset.emoji} {preset.label} — {preset.blurb}
          </p>

          {preset.sliders.length === 0 && <p className="muted">This kind of item has nothing to tweak. Nice and simple!</p>}

          {preset.sliders.map((spec) => (
            <Slider
              key={spec.key}
              spec={spec}
              value={item[spec.key]}
              onChange={(value) => patch({ [spec.key]: value } as Partial<ModItem>)}
            />
          ))}

          {preset.hasArmorSlotPicker && (
            <div className="stack">
              <span className="field__label">Where do you wear it?</span>
              <div className="row" role="group" aria-label="Armor slot">
                {ARMOR_SLOTS.map((slot) => (
                  <button
                    key={slot.slot}
                    className={`btn ${item.armorSlot === slot.slot ? '' : 'btn--ghost'}`}
                    aria-pressed={item.armorSlot === slot.slot}
                    onClick={() => patch({ armorSlot: slot.slot })}
                  >
                    {slot.emoji} {slot.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {preset.hasProjectilePicker && (
            <div className="stack">
              <span className="field__label">What happens when it lands?</span>
              <div className="kind-grid" role="group" aria-label="What it does when it lands">
                {PROJECTILE_KINDS.map((spec) => (
                  <button
                    key={spec.kind}
                    className={`kind ${item.projectileKind === spec.kind ? 'kind--on' : ''}`}
                    aria-pressed={item.projectileKind === spec.kind}
                    onClick={() => patch({ projectileKind: spec.kind })}
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
          )}

          {item.kind === 'bow' && (
            <p className="note">
              💡 Your bow shoots normal arrows, so keep some in your bag. In Creative you don’t need any.
            </p>
          )}

          {preset.hasAlwaysEatToggle && (
            <label className="toggle">
              <input
                type="checkbox"
                checked={item.canAlwaysEat}
                onChange={(e) => patch({ canAlwaysEat: e.target.checked })}
              />
              <span className="toggle__label">You can eat it even when you’re not hungry</span>
            </label>
          )}

          <div className="row">
            <button className="btn btn--go" onClick={() => setStep('recipe')}>
              Next: recipe →
            </button>
          </div>
        </div>
      )}

      {step === 'recipe' && (
        <div className="card stack">
          <h2>How do you craft it?</h2>

          <label className="toggle">
            <input
              type="checkbox"
              checked={item.recipe.enabled}
              onChange={(e) => patch({ recipe: { ...item.recipe, enabled: e.target.checked } })}
            />
            <span className="toggle__label">Let players craft this in a crafting table</span>
          </label>

          {!item.recipe.enabled && (
            <p className="muted">
              Off for now — you’ll still be able to get it from the creative menu with <code>/give</code>.
            </p>
          )}

          {item.recipe.enabled && (
            <>
              <RecipeGrid
                grid={item.recipe.grid}
                count={item.recipe.count}
                resultTexture={item.texture}
                resultName={item.name}
                onChange={(grid) => patch({ recipe: { ...item.recipe, grid } })}
                onCountChange={(count) => patch({ recipe: { ...item.recipe, count } })}
              />
              {!recipeHasIngredients(item.recipe.grid) && (
                <p className="warn tiny">
                  ⚠️ The grid is empty, so no recipe will be added. Put something in a square!
                </p>
              )}
            </>
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
