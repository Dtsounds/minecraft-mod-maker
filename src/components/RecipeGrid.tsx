import { useState } from 'react';
import { VANILLA_GROUPS, VANILLA_ITEMS, lookupVanilla, type VanillaItem } from '../bedrock/vanillaItems';
import { TexturePreview } from './TexturePreview';
import type { RecipeSlot, Texture } from '../bedrock/types';
import { Icon } from './Icon';

interface Props {
  grid: RecipeSlot[];
  count: number;
  resultTexture: Texture;
  resultName: string;
  onChange: (grid: RecipeSlot[]) => void;
  onCountChange: (count: number) => void;
}

/**
 * The 3x3 crafting-grid builder.
 *
 * Drag-and-drop is offered for mouse users, but every action is also
 * reachable by tapping: tap an ingredient to arm it, then tap a slot. Pure
 * drag-and-drop is a bad primary interaction on a touchscreen and unusable
 * with a keyboard, so tap-to-place is the real path and dragging is the
 * bonus.
 */
export function RecipeGrid({ grid, count, resultTexture, resultName, onChange, onCountChange }: Props) {
  const [armed, setArmed] = useState<VanillaItem | null>(null);
  const [group, setGroup] = useState<VanillaItem['group']>('basics');

  const place = (index: number, id: string | null) => {
    const next = grid.slice();
    next[index] = id;
    onChange(next);
  };

  const handleSlotClick = (index: number) => {
    // Tapping a filled slot with nothing armed clears it.
    if (!armed) {
      if (grid[index]) place(index, null);
      return;
    }
    place(index, armed.id);
  };

  return (
    <div className="recipe stack">
      <div className="recipe__bench">
        <div className="recipe__grid" role="group" aria-label="Crafting grid">
          {grid.map((slot, index) => {
            const item = lookupVanilla(slot);
            const row = Math.floor(index / 3) + 1;
            const col = (index % 3) + 1;
            return (
              <button
                key={index}
                className="recipe__slot"
                aria-label={
                  item ? `Slot row ${row} column ${col}, ${item.label}` : `Slot row ${row} column ${col}, empty`
                }
                onClick={() => handleSlotClick(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData('text/plain');
                  if (id) place(index, id);
                }}
              >
                {item ? (
                  <span className="chip" style={{ background: item.color }} title={item.label}>
                    <span aria-hidden>{item.glyph}</span>
                  </span>
                ) : (
                  <span className="recipe__slot-empty" aria-hidden />
                )}
              </button>
            );
          })}
        </div>

        <div className="recipe__arrow" aria-hidden>
          <Icon name="arrowRight" size={26} />
        </div>

        <div className="recipe__result">
          <TexturePreview texture={resultTexture} size={64} label={`${resultName || 'Your item'} texture`} />
          <span className="tiny">{resultName || 'Your item'}</span>
          <label className="recipe__count">
            <span className="tiny muted">Makes</span>
            <input
              className="input recipe__count-input"
              type="number"
              min={1}
              max={64}
              value={count}
              aria-label="How many it makes"
              onChange={(e) => onCountChange(Number(e.target.value))}
            />
          </label>
        </div>
      </div>

      <p className="tiny muted">
        {armed ? (
          <>
            <strong>{armed.label}</strong> is ready — tap a square to put it there.
          </>
        ) : (
          <>Tap an ingredient below, then tap a square. Tap a full square to empty it.</>
        )}
      </p>

      <div className="row recipe__tabs" role="tablist" aria-label="Ingredient groups">
        {VANILLA_GROUPS.map((g) => (
          <button
            key={g.key}
            role="tab"
            aria-selected={group === g.key}
            className={`btn ${group === g.key ? '' : 'btn--ghost'}`}
            onClick={() => setGroup(g.key)}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="recipe__palette" role="group" aria-label="Ingredients">
        {VANILLA_ITEMS.filter((v) => v.group === group).map((item) => (
          <button
            key={item.id}
            className={`ingredient ${armed?.id === item.id ? 'ingredient--on' : ''}`}
            aria-pressed={armed?.id === item.id}
            aria-label={item.label}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('text/plain', item.id)}
            onClick={() => setArmed(armed?.id === item.id ? null : item)}
          >
            <span className="chip" style={{ background: item.color }}>
              <span aria-hidden>{item.glyph}</span>
            </span>
            <span className="tiny">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="row">
        <button className="btn btn--ghost" onClick={() => onChange(new Array(9).fill(null))}>
          <Icon name="eraser" size={17} /> Empty the grid
        </button>
      </div>
    </div>
  );
}
