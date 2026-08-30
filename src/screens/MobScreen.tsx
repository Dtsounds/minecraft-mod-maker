import { useState } from 'react';
import type { MobDrop, ModItem, ModMob } from '../bedrock/types';
import {
  MOB_DAMAGE,
  MOB_DROP_COUNT,
  MOB_FOODS,
  MOB_HEALTH,
  MOB_MOODS,
  MOB_SIZE,
  MOB_SPEED,
} from '../bedrock/mobPresets';
import { MOB_RIGS, mobRig } from '../bedrock/mobGeometry';
import { Slider } from '../components/Slider';
import { TexturePreview } from '../components/TexturePreview';
import { PixelEditor } from '../components/PixelEditor/PixelEditor';
import { VANILLA_ITEMS } from '../bedrock/vanillaItems';
import { isTextureEmpty, resizeTexture } from '../bedrock/texture';
import { mobIdentifier } from '../bedrock/mob';
import { starterMobTexture } from '../components/mobStarter';

interface Props {
  mob: ModMob;
  items: ModItem[];
  namespace: string;
  onChange: (mob: ModMob) => void;
  onDone: () => void;
}

type Step = 'basics' | 'look' | 'stats' | 'behavior';

const STEPS: { id: Step; label: string; emoji: string }[] = [
  { id: 'basics', label: 'Name', emoji: '🏷️' },
  { id: 'look', label: 'Picture', emoji: '🎨' },
  { id: 'stats', label: 'Powers', emoji: '💪' },
  { id: 'behavior', label: 'Behaviour', emoji: '🧠' },
];

export function MobScreen({ mob, items, namespace, onChange, onDone }: Props) {
  const [step, setStep] = useState<Step>('basics');
  const [drawing, setDrawing] = useState(false);

  const patch = (changes: Partial<ModMob>) => onChange({ ...mob, ...changes });
  const rig = mobRig(mob.rig);
  const drop: MobDrop = mob.drop ?? { kind: 'nothing' };

  if (drawing) {
    return (
      <div className="card">
        <PixelEditor
          texture={mob.texture}
          title={`Draw ${mob.name || 'your creature'}`}
          allowResize={false}
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
        <TexturePreview texture={mob.texture} size={48} label="Creature preview" />
        <strong>{mob.name || 'Unnamed creature'}</strong>
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
            <label className="field__label" htmlFor="mob-name">
              Name it
            </label>
            <input
              id="mob-name"
              className="input"
              value={mob.name}
              maxLength={40}
              placeholder="Fluff Beast"
              autoComplete="off"
              onChange={(e) => patch({ name: e.target.value })}
            />
            <p className="field__hint">
              In the game it’ll be <code>{mobIdentifier(namespace, mob)}</code>
            </p>
          </div>

          <div className="stack">
            <span className="field__label">What shape is its body?</span>
            <div className="kind-grid" role="group" aria-label="Body shape">
              {MOB_RIGS.map((spec) => (
                <button
                  key={spec.id}
                  className={`kind ${mob.rig === spec.id ? 'kind--on' : ''}`}
                  aria-pressed={mob.rig === spec.id}
                  onClick={() =>
                    patch({
                      rig: spec.id,
                      texture: resizeTexture(mob.texture, spec.textureSize),
                    })
                  }
                >
                  <span className="kind__emoji" aria-hidden>
                    {spec.emoji}
                  </span>
                  <span className="kind__label">{spec.label}</span>
                  <span className="tiny muted">{spec.blurb}</span>
                </button>
              ))}
            </div>
            <p className="tiny muted">
              You can’t change the body shape itself — but you can paint it however you like.
            </p>
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
            <TexturePreview texture={mob.texture} size={160} label="Creature skin" />
            <div className="stack">
              <button className="btn btn--big" onClick={() => setDrawing(true)}>
                ✏️ Paint its skin
              </button>
              <button
                className="btn btn--ghost"
                onClick={() => patch({ texture: starterMobTexture(rig, '#c99a63') })}
              >
                🎁 Start me off
              </button>
              {isTextureEmpty(mob.texture) && (
                <p className="warn tiny">⚠️ Its skin is blank — it’ll be invisible!</p>
              )}
              <p className="tiny muted">
                The skin is one flat picture that wraps around the body. The coloured blocks show
                which bit is the head, body and legs.
              </p>
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
          <Slider spec={MOB_HEALTH} value={mob.health} onChange={(health) => patch({ health })} />
          <Slider spec={MOB_SPEED} value={mob.speed} onChange={(speed) => patch({ speed })} />
          <Slider spec={MOB_SIZE} value={mob.size} onChange={(size) => patch({ size })} />
          {mob.mood === 'mean' && (
            <Slider spec={MOB_DAMAGE} value={mob.damage} onChange={(damage) => patch({ damage })} />
          )}

          <div className="stack">
            <span className="field__label">What do you get when you beat it?</span>
            <div className="row" role="group" aria-label="What it drops">
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
                onClick={() => patch({ drop: { kind: 'vanilla', id: 'minecraft:leather' } })}
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
                {VANILLA_ITEMS.map((v) => (
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
              <Slider spec={MOB_DROP_COUNT} value={mob.dropCount} onChange={(dropCount) => patch({ dropCount })} />
            )}
          </div>

          <div className="row">
            <button className="btn btn--go" onClick={() => setStep('behavior')}>
              Next: behaviour →
            </button>
          </div>
        </div>
      )}

      {step === 'behavior' && (
        <div className="card stack">
          <h2>How does it act?</h2>

          <div className="kind-grid" role="group" aria-label="Mood">
            {MOB_MOODS.map((spec) => (
              <button
                key={spec.mood}
                className={`kind ${mob.mood === spec.mood ? 'kind--on' : ''}`}
                aria-pressed={mob.mood === spec.mood}
                onClick={() => patch({ mood: spec.mood })}
              >
                <span className="kind__emoji" aria-hidden>
                  {spec.emoji}
                </span>
                <span className="kind__label">{spec.label}</span>
                <span className="tiny muted">{spec.blurb}</span>
              </button>
            ))}
          </div>

          <label className="toggle">
            <input
              type="checkbox"
              checked={mob.tameable}
              onChange={(e) =>
                patch({
                  tameable: e.target.checked,
                  tameFood: e.target.checked ? (mob.tameFood ?? MOB_FOODS[0]!.id) : mob.tameFood,
                })
              }
            />
            <span className="toggle__label">You can tame it</span>
          </label>
          {mob.tameable && (
            <FoodPicker
              label="Tame it with"
              value={mob.tameFood}
              onPick={(tameFood) => patch({ tameFood })}
            />
          )}

          <label className="toggle">
            <input
              type="checkbox"
              checked={mob.breedable}
              onChange={(e) =>
                patch({
                  breedable: e.target.checked,
                  breedFood: e.target.checked ? (mob.breedFood ?? MOB_FOODS[0]!.id) : mob.breedFood,
                })
              }
            />
            <span className="toggle__label">Two of them can make a baby</span>
          </label>
          {mob.breedable && (
            <FoodPicker
              label="Feed them"
              value={mob.breedFood}
              onPick={(breedFood) => patch({ breedFood })}
            />
          )}

          <label className="toggle">
            <input
              type="checkbox"
              checked={mob.rideable}
              onChange={(e) => patch({ rideable: e.target.checked })}
            />
            <span className="toggle__label">You can ride it</span>
          </label>

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

function FoodPicker({
  label,
  value,
  onPick,
}: {
  label: string;
  value: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <div className="stack">
      <span className="field__label">{label}</span>
      <div className="recipe__palette" role="group" aria-label={label}>
        {MOB_FOODS.map((food) => (
          <button
            key={food.id}
            className={`ingredient ${value === food.id ? 'ingredient--on' : ''}`}
            aria-pressed={value === food.id}
            aria-label={food.label}
            onClick={() => onPick(food.id)}
          >
            <span className="chip" style={{ background: '#5c4680' }}>
              <span aria-hidden>{food.emoji}</span>
            </span>
            <span className="tiny">{food.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
