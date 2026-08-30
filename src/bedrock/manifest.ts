import {
  MANIFEST_FORMAT_VERSION,
  MIN_ENGINE_VERSION,
  SCRIPT_ENTRY,
  SCRIPT_MODULE_VERSION,
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
  type: 'data' | 'resources' | 'script';
  uuid: string;
  version: Version3;
  /** Script modules only. */
  language?: 'javascript';
  entry?: string;
}

/**
 * Two genuinely different shapes share the one `dependencies` array:
 * a pack dependency is a `uuid` plus a `[x,y,z]` array, while a script-module
 * dependency is a `module_name` plus a *string* semver. Mixing them up is
 * silent — the pack simply refuses to load.
 */
export type PackDependency = { uuid: string; version: Version3 };
export type ScriptDependency = { module_name: string; version: string };
export type ManifestDependency = PackDependency | ScriptDependency;

/** Narrow to the pack-to-pack half of the `dependencies` array. */
export function isPackDependency(dep: ManifestDependency): dep is PackDependency {
  return 'uuid' in dep;
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
export interface BehaviorManifestOptions {
  /**
   * Whether this mod ships rules. A pack with no rules must not declare a
   * script module: it would add a dependency that can fail to resolve, in
   * exchange for running an empty file. Keeping it conditional means every
   * mod built before Phase 4 generates byte-identical output.
   */
  scripts?: boolean;
}

export function buildBehaviorManifest(
  project: ModProject,
  options: BehaviorManifestOptions = {},
): Manifest {
  const version = [...project.version] as Version3;
  const minEngine = [...MIN_ENGINE_VERSION] as Version3;
  const modules: ManifestModule[] = [
    {
      description: packDescription(project),
      type: 'data',
      uuid: project.uuids.bpModule,
      version,
    },
  ];
  const dependencies: ManifestDependency[] = [
    {
      uuid: project.uuids.rpHeader,
      version,
    },
  ];

  if (options.scripts) {
    modules.push({
      description: packDescription(project),
      type: 'script',
      language: 'javascript',
      entry: SCRIPT_ENTRY,
      uuid: project.uuids.bpScript,
      version,
    });
    dependencies.push({
      module_name: '@minecraft/server',
      version: SCRIPT_MODULE_VERSION,
    });
  }

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
    modules,
    dependencies,
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
