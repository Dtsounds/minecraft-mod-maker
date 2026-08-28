import { useState } from 'react';
import type { ModProject } from '../bedrock/types';
import { TexturePreview } from '../components/TexturePreview';

interface Props {
  project: ModProject;
  fileName: string;
  onBack: () => void;
  onDownloadAgain: () => void;
  busy: boolean;
}

type PlatformId = 'windows' | 'mobile' | 'chromebook' | 'console';

interface Platform {
  id: PlatformId;
  label: string;
  emoji: string;
  steps: string[];
  note?: string;
}

/**
 * Import instructions per platform.
 *
 * The mechanism is the same everywhere: a .mcaddon is registered to
 * Minecraft, so opening the file hands it to the game, which imports both
 * packs and then shows them in the pack lists. The per-platform difference is
 * only *where you tap to open the file*, which is exactly what a kid needs
 * spelled out.
 */
const PLATFORMS: Platform[] = [
  {
    id: 'windows',
    label: 'Windows PC',
    emoji: '💻',
    steps: [
      'Find the file you just downloaded. It’s usually in your Downloads folder.',
      'Double-click it.',
      'Minecraft opens by itself and says it’s importing.',
      'Wait for “Successfully imported”.',
    ],
  },
  {
    id: 'mobile',
    label: 'Phone or Tablet',
    emoji: '📱',
    steps: [
      'Open your Files or Downloads app.',
      'Tap the file you just downloaded.',
      'If it asks what to open it with, choose Minecraft.',
      'Minecraft opens and imports it.',
    ],
    note: 'On an iPad or iPhone you might need to tap Share, then “Copy to Minecraft”.',
  },
  {
    id: 'chromebook',
    label: 'Chromebook',
    emoji: '🖥️',
    steps: [
      'Open the Files app and find your download.',
      'Move the file into the Play files or Linux files folder so Minecraft can see it.',
      'Tap the file and pick Minecraft.',
    ],
    note: 'Chromebooks run the Android version of Minecraft, so the file has to be somewhere Android apps can reach.',
  },
  {
    id: 'console',
    label: 'Xbox / PlayStation / Switch',
    emoji: '🎮',
    steps: [
      'Consoles can’t open add-on files directly.',
      'Import your mod on a PC or phone signed in to the same Microsoft account.',
      'Turn on Realms or cloud sync, and your worlds with the mod will show up on the console.',
    ],
    note: 'This one needs a grown-up’s help.',
  },
];

/**
 * Post-download onboarding. Shown right after the file lands, because that is
 * the exact moment a kid needs to know what to do with it.
 */
export function ExportScreen({ project, fileName, onBack, onDownloadAgain, busy }: Props) {
  const [platform, setPlatform] = useState<PlatformId>('windows');
  const active = PLATFORMS.find((p) => p.id === platform) ?? (PLATFORMS[0] as Platform);
  const itemCount = project.items.length;

  return (
    <div className="stack">
      <div className="card celebrate">
        <TexturePreview texture={project.icon} size={96} label={`${project.name} icon`} />
        <div className="stack celebrate__text">
          <h1>🎉 Your mod is ready!</h1>
          <p>
            <strong>{fileName}</strong> just downloaded
            {itemCount > 0 && <> with {itemCount === 1 ? '1 item' : `${itemCount} items`} inside</>}.
          </p>
          <div className="row">
            <button className="btn btn--ghost" onClick={onDownloadAgain} disabled={busy}>
              {busy ? 'Packing…' : '⬇️ Download it again'}
            </button>
            <button className="btn btn--go" onClick={onBack}>
              ← Keep editing
            </button>
          </div>
        </div>
      </div>

      <section className="card stack">
        <h2>How to open it in Minecraft</h2>
        <p className="muted">Pick what you play on:</p>

        <div className="platform-grid" role="group" aria-label="Choose your device">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              className={`platform ${platform === p.id ? 'platform--on' : ''}`}
              aria-pressed={platform === p.id}
              onClick={() => setPlatform(p.id)}
            >
              <span className="platform__emoji" aria-hidden>
                {p.emoji}
              </span>
              <span>{p.label}</span>
            </button>
          ))}
        </div>

        <ol className="steps-list">
          {active.steps.map((step, index) => (
            <li key={index}>
              <span className="steps-list__num" aria-hidden>
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        {active.note && <p className="note">💡 {active.note}</p>}
      </section>

      <section className="card stack">
        <h2>Then, in the game</h2>
        <ol className="steps-list">
          <li>
            <span className="steps-list__num" aria-hidden>
              1
            </span>
            <span>Make a new world, or edit one you already have.</span>
          </li>
          <li>
            <span className="steps-list__num" aria-hidden>
              2
            </span>
            <span>
              In <strong>Settings</strong>, scroll down to <strong>Add-Ons</strong>.
            </span>
          </li>
          <li>
            <span className="steps-list__num" aria-hidden>
              3
            </span>
            <span>
              Tap <strong>Behavior Packs</strong>, find <strong>{project.name}</strong>, and tap{' '}
              <strong>Activate</strong>.
            </span>
          </li>
          <li>
            <span className="steps-list__num" aria-hidden>
              4
            </span>
            <span>
              Go back and tap <strong>Resource Packs</strong>, find <strong>{project.name}</strong> there, and
              tap <strong>Activate</strong> too. <strong>You need both!</strong>
            </span>
          </li>
          <li>
            <span className="steps-list__num" aria-hidden>
              5
            </span>
            <span>Play! Your stuff is in the creative menu.</span>
          </li>
        </ol>
        <p className="note">
          💡 <strong>If your stuff is invisible</strong>, it’s almost always the resource pack. Go back into{' '}
          <strong>Resource Packs</strong> and make sure <strong>{project.name}</strong> is switched on — the
          behavior pack alone gives you the items, but the resource pack is what gives them their pictures.
        </p>
      </section>
    </div>
  );
}
