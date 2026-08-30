import { useState } from 'react';
import type { ModBlock, ModItem, ModMob, ModRule, RuleTarget } from '../bedrock/types';
import {
  ACTIONS,
  MAX_RULE_MESSAGE,
  RULE_EFFECTS,
  RULE_SOUNDS,
  SUMMONABLE,
  actionSpec,
  triggerSpec,
  TRIGGERS,
} from '../bedrock/rulePresets';
import { Slider } from '../components/Slider';
import { TexturePreview } from '../components/TexturePreview';
import { VANILLA_ITEMS } from '../bedrock/vanillaItems';

interface Props {
  rule: ModRule;
  items: ModItem[];
  blocks: ModBlock[];
  mobs: ModMob[];
  onChange: (rule: ModRule) => void;
  onDone: () => void;
}

type Step = 'when' | 'then';

const STEPS: { id: Step; label: string; emoji: string }[] = [
  { id: 'when', label: 'When…', emoji: '⏰' },
  { id: 'then', label: '…do this', emoji: '✨' },
];

/** The kid's own creations that a given trigger can watch. */
function subjectsFor(
  kind: ReturnType<typeof triggerSpec>['subject'],
  items: ModItem[],
  blocks: ModBlock[],
  mobs: ModMob[],
): { id: string; name: string; texture: ModItem['texture']; fallback: string }[] {
  if (kind === 'item')
    return items.map((i) => ({ id: i.id, name: i.name, texture: i.texture, fallback: 'Unnamed item' }));
  if (kind === 'block')
    return blocks.map((b) => ({ id: b.id, name: b.name, texture: b.texture, fallback: 'Unnamed block' }));
  if (kind === 'mob')
    return mobs.map((m) => ({ id: m.id, name: m.name, texture: m.texture, fallback: 'Unnamed creature' }));
  return [];
}

export function RuleScreen({ rule, items, blocks, mobs, onChange, onDone }: Props) {
  const [step, setStep] = useState<Step>('when');
  const patch = (changes: Partial<ModRule>) => onChange({ ...rule, ...changes });

  const tSpec = triggerSpec(rule.trigger);
  const aSpec = actionSpec(rule.action);
  const subjects = subjectsFor(tSpec.subject, items, blocks, mobs);

  /** Shared renderer for the two "vanilla thing or one of mine" pickers. */
  const targetPicker = (
    value: RuleTarget,
    set: (target: RuleTarget) => void,
    vanilla: { id: string; label: string; emoji: string }[],
    mine: { id: string; name: string; fallback: string }[],
    mineLabel: string,
  ) => (
    <div className="stack">
      {mine.length > 0 && (
        <>
          <span className="field__label">{mineLabel}</span>
          <div className="pick-grid" role="group" aria-label={mineLabel}>
            {mine.map((entry) => {
              const on = value.kind === 'mine' && value.refId === entry.id;
              return (
                <button
                  key={entry.id}
                  className={`pick ${on ? "pick--on" : ""}`}
                  aria-pressed={on}
                  onClick={() => set({ kind: 'mine', refId: entry.id })}
                >
                  <span aria-hidden>⭐</span>
                  <span>{entry.name || entry.fallback}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <span className="field__label">Or something from Minecraft</span>
      <div className="pick-grid" role="group" aria-label="Minecraft things">
        {vanilla.map((entry) => {
          const on = value.kind === 'vanilla' && value.id === entry.id;
          return (
            <button
              key={entry.id}
              className={`pick ${on ? "pick--on" : ""}`}
              aria-pressed={on}
              onClick={() => set({ kind: 'vanilla', id: entry.id })}
            >
              <span aria-hidden>{entry.emoji}</span>
              <span>{entry.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="stack">
      <div className="row">
        <button className="btn btn--ghost" onClick={onDone}>
          ← Back to my mod
        </button>
        <span className="spacer" />
        <strong>{rule.name || 'Unnamed rule'}</strong>
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

      {/* A plain-language read-back of the whole rule, always visible. It is
          the only place a kid can check the rule says what they meant. */}
      <div className="card card--flat">
        <p className="rule-sentence">
          <strong>When</strong> {tSpec.label.toLowerCase()}
          {tSpec.subject !== 'none' && (
            <>
              {' — '}
              <em>
                {subjects.find((s) => s.id === rule.subjectId)?.name ||
                  (rule.subjectId ? 'something deleted' : 'nothing picked yet')}
              </em>
            </>
          )}
          {', '}
          <strong>then</strong> {aSpec.label.toLowerCase()}.
        </p>
      </div>

      {step === 'when' && (
        <div className="card stack">
          <div className="field">
            <label className="field__label" htmlFor="rule-name">
              Call this rule something (just for you)
            </label>
            <input
              id="rule-name"
              className="input"
              value={rule.name}
              maxLength={40}
              placeholder="Lightning gem"
              autoComplete="off"
              onChange={(e) => patch({ name: e.target.value })}
            />
          </div>

          <span className="field__label">What starts it?</span>
          <div className="kind-grid" role="group" aria-label="Trigger">
            {TRIGGERS.map((spec) => (
              <button
                key={spec.trigger}
                className={`kind ${rule.trigger === spec.trigger ? 'kind--on' : ''}`}
                aria-pressed={rule.trigger === spec.trigger}
                onClick={() =>
                  patch({
                    trigger: spec.trigger,
                    // The old subject belongs to a different list now.
                    subjectId: spec.subject === tSpec.subject ? rule.subjectId : null,
                  })
                }
              >
                <span className="kind__emoji" aria-hidden>
                  {spec.emoji}
                </span>
                <span className="kind__label">{spec.label}</span>
                <span className="kind__blurb">{spec.blurb}</span>
              </button>
            ))}
          </div>

          {tSpec.subject !== 'none' && (
            <div className="stack">
              <span className="field__label">Which one?</span>
              {subjects.length === 0 ? (
                <p className="warn tiny">⚠️ {tSpec.emptyHint}</p>
              ) : (
                <div className="pick-grid" role="group" aria-label="Which one">
                  {subjects.map((entry) => (
                    <button
                      key={entry.id}
                      className={`pick ${rule.subjectId === entry.id ? 'pick--on' : ''}`}
                      aria-pressed={rule.subjectId === entry.id}
                      onClick={() => patch({ subjectId: entry.id })}
                    >
                      <TexturePreview texture={entry.texture} size={28} label="" />
                      <span>{entry.name || entry.fallback}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {step === 'then' && (
        <div className="card stack">
          <span className="field__label">What happens?</span>
          <div className="kind-grid" role="group" aria-label="Action">
            {ACTIONS.map((spec) => (
              <button
                key={spec.action}
                className={`kind ${rule.action === spec.action ? 'kind--on' : ''}`}
                aria-pressed={rule.action === spec.action}
                onClick={() => patch({ action: spec.action })}
              >
                <span className="kind__emoji" aria-hidden>
                  {spec.emoji}
                </span>
                <span className="kind__label">{spec.label}</span>
                <span className="kind__blurb">{spec.blurb}</span>
              </button>
            ))}
          </div>

          {aSpec.hasEffectPicker && (
            <div className="stack">
              <span className="field__label">Which effect?</span>
              <div className="pick-grid" role="group" aria-label="Effect">
                {RULE_EFFECTS.map((entry) => (
                  <button
                    key={entry.effect}
                    className={`pick ${rule.effect === entry.effect ? 'pick--on' : ''}`}
                    aria-pressed={rule.effect === entry.effect}
                    onClick={() => patch({ effect: entry.effect })}
                  >
                    <span aria-hidden>{entry.emoji}</span>
                    <span>{entry.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {aSpec.hasSoundPicker && (
            <div className="stack">
              <span className="field__label">Which sound?</span>
              <div className="pick-grid" role="group" aria-label="Sound">
                {RULE_SOUNDS.map((entry) => (
                  <button
                    key={entry.sound}
                    className={`pick ${rule.sound === entry.sound ? 'pick--on' : ''}`}
                    aria-pressed={rule.sound === entry.sound}
                    onClick={() => patch({ sound: entry.sound })}
                  >
                    <span aria-hidden>{entry.emoji}</span>
                    <span>{entry.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {aSpec.hasMessageBox && (
            <div className="field">
              <label className="field__label" htmlFor="rule-message">
                What should it say?
              </label>
              <input
                id="rule-message"
                className="input"
                value={rule.message}
                maxLength={MAX_RULE_MESSAGE}
                placeholder="You found the secret!"
                autoComplete="off"
                onChange={(e) => patch({ message: e.target.value })}
              />
              {!rule.message.trim() && (
                <p className="warn tiny">⚠️ Type something, or this rule won’t do anything.</p>
              )}
            </div>
          )}

          {aSpec.hasSummonPicker &&
            targetPicker(
              rule.summonTarget,
              (summonTarget) => patch({ summonTarget }),
              SUMMONABLE,
              mobs.map((m) => ({ id: m.id, name: m.name, fallback: 'Unnamed creature' })),
              'One of my creatures',
            )}

          {aSpec.hasGivePicker &&
            targetPicker(
              rule.giveTarget,
              (giveTarget) => patch({ giveTarget }),
              VANILLA_ITEMS.map((v) => ({ id: v.id, label: v.label, emoji: v.glyph })),
              items.map((i) => ({ id: i.id, name: i.name, fallback: 'Unnamed item' })),
              'One of my items',
            )}

          {aSpec.sliders.map((spec) => (
            <Slider
              key={spec.key}
              spec={spec}
              value={(rule as unknown as Record<string, number>)[spec.key] ?? spec.min}
              onChange={(value) => patch({ [spec.key]: value } as unknown as Partial<ModRule>)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
