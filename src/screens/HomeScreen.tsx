import type { ModProject } from '../bedrock/types';
import { TexturePreview } from '../components/TexturePreview';

interface Props {
  projects: ModProject[];
  loading: boolean;
  onNew: () => void;
  onOpen: (project: ModProject) => void;
  onDelete: (project: ModProject) => void;
}

export function HomeScreen({ projects, loading, onNew, onOpen, onDelete }: Props) {
  return (
    <div className="stack">
      <div className="hero card">
        <div className="hero__text stack">
          <h1>Make your own Minecraft stuff</h1>
          <p className="muted">
            Draw it, name it, tap one button, and play with it in Minecraft. No typing code. Ever.
          </p>
          <div>
            <button className="btn btn--go btn--big" onClick={onNew}>
              ✨ Make a New Mod
            </button>
          </div>
        </div>
        <div className="hero__art" aria-hidden>
          ⛏️
        </div>
      </div>

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
                  <span className="tiny muted">
                    {project.items.length === 1 ? '1 item' : `${project.items.length} items`}
                  </span>
                </button>
                <button
                  className="btn btn--danger btn--icon mod-card__delete"
                  aria-label={`Delete ${project.name}`}
                  onClick={() => onDelete(project)}
                >
                  🗑️
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
