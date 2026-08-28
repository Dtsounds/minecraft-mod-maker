import {
  MANIFEST_FORMAT_VERSION,
  MIN_ENGINE_VERSION,
} from './versions';
import type { ModProject } from './types';

export type Version3 = [number, number, number];

export interface ManifestHeader {
  name: string;
  description: string;
  uuid: string;
  version: Version3;
  min_engine_version: Version3;
}

export interface ManifestModule {
  description: string;
  type: 'data' | 'resources';
  uuid: string;
  version: Version3;
}

export interface ManifestDependency {
  uuid: string;
  version: Version3;
}

export interface Manifest {
  format_version: typeof MANIFEST_FORMAT_VERSION;
  header: ManifestHeader;
  modules: ManifestModule[];
  dependencies?: ManifestDependency[];
  metadata?: {
    authors?: string[];
    generated_with?: Record<string, string[]>;
    product_type?: 'addon';
  };
}

/** Description shown under the pack name in-game. Never allowed to be empty. */
function packDescription(project: ModProject): string {
  const trimmed = project.description.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 200) : `A mod made with Bedrock Mod Maker`;
}

const GENERATED_WITH = { bedrock_mod_maker: ['1.0.0'] };

/**
 * Behavior pack manifest.
 *
 * `dependencies` is a TOP-LEVEL section (not nested under `header`) — this is
 * the one detail most hand-written add-ons get wrong. It points at the
 * resource pack's *header* uuid, with a matching version, so Minecraft
 * activates the two packs together.
 */
export function buildBehaviorManifest(project: ModProject): Manifest {
  const version = [...project.version] as Version3;
  const minEngine = [...MIN_ENGINE_VERSION] as Version3;
  return {
    format_version: MANIFEST_FORMAT_VERSION,
    header: {
      // The two halves live in separate tabs in-game, but naming them
      // identically makes it impossible to tell at a glance whether both are
      // switched on — which is the single most common reason a kid's items
      // turn up invisible. Suffixing each makes the pair obvious.
      name: project.name,
      description: packDescription(project),
      uuid: project.uuids.bpHeader,
      version,
      min_engine_version: minEngine,
    },
    modules: [
      {
        description: packDescription(project),
        type: 'data',
        uuid: project.uuids.bpModule,
        version,
      },
    ],
    dependencies: [
      {
        uuid: project.uuids.rpHeader,
        version,
      },
    ],
    metadata: {
      generated_with: GENERATED_WITH,
      product_type: 'addon',
    },
  };
}

/**
 * Resource pack manifest.
 *
 * The RP deliberately declares NO dependencies. The link is one-directional:
 * BP -> RP, and only that.
 *
 * An earlier version of this file also pointed the RP back at the BP, on the
 * theory that a mutual link would keep the two halves enabled together. It
 * does the opposite: Minecraft cannot resolve the cycle and refuses the
 * import with "missing one or more dependencies". Caught by importing a
 * generated .mcaddon into a real Bedrock client on 2026-08-28.
 *
 * The one-directional form is what Microsoft's manifest reference shows --
 * its resource pack example carries no `dependencies` section at all.
 * Activating the behavior pack in a world pulls its resource pack in
 * automatically, which is the behaviour the mutual link was reaching for.
 */
export function buildResourceManifest(project: ModProject): Manifest {
  const version = [...project.version] as Version3;
  const minEngine = [...MIN_ENGINE_VERSION] as Version3;
  return {
    format_version: MANIFEST_FORMAT_VERSION,
    header: {
      name: `${project.name} Art`,
      description: packDescription(project),
      uuid: project.uuids.rpHeader,
      version,
      min_engine_version: minEngine,
    },
    modules: [
      {
        description: packDescription(project),
        type: 'resources',
        uuid: project.uuids.rpModule,
        version,
      },
    ],
    metadata: {
      generated_with: GENERATED_WITH,
      product_type: 'addon',
    },
  };
}
