import { useState } from 'react';
import { toNamespace } from '../bedrock/ids';
import { Icon } from '../components/Icon';

interface Props {
  onCreate: (name: string, description: string) => void;
  onCancel: () => void;
}

/**
 * The one place a kid types free text. Everything is optional-ish: an empty
 * name still yields a valid pack called "My Mod", so there is no way to get
 * stuck behind a validation error.
 */
export function NewModScreen({ onCreate, onCancel }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const finalName = name.trim() || 'My Mod';

  return (
    <form
      className="card stack"
      onSubmit={(e) => {
        e.preventDefault();
        onCreate(finalName, description);
      }}
    >
      <h1>Name your mod</h1>

      <div className="field">
        <label className="field__label" htmlFor="mod-name">
          What’s it called?
        </label>
        <input
          id="mod-name"
          className="input"
          value={name}
          maxLength={40}
          placeholder="Ruby Mod"
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
        />
        <p className="field__hint">
          Inside Minecraft this becomes <code>{toNamespace(finalName)}</code>. We fix the spelling for you.
        </p>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="mod-desc">
          What does it do? <span className="muted">(you can skip this)</span>
        </label>
        <textarea
          id="mod-desc"
          className="textarea"
          value={description}
          maxLength={180}
          placeholder="Adds super shiny ruby tools!"
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="row">
        <button type="submit" className="btn btn--go btn--big">
          Let’s go <Icon name="arrowRight" size={17} />
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Back
        </button>
      </div>
    </form>
  );
}
