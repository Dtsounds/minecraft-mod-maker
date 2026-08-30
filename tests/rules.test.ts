// @vitest-environment node
//
// Node, not jsdom: this file parses the generated script with esbuild to prove
// it is valid JavaScript, and esbuild refuses to run against jsdom TextEncoder.
import { describe, expect, it } from 'vitest';
import { transformSync } from 'esbuild';
import { buildAddon } from '../src/bedrock/pack';
import { buildBehaviorManifest, isPackDependency } from '../src/bedrock/manifest';
import { buildRuleTable } from '../src/bedrock/rules';
import { RUNTIME_MARKER, buildScriptMain } from '../src/bedrock/runtime';
import { createItem, createMob, createProject, createRule, normalizeProject } from '../src/bedrock/project';
import { SCRIPT_ENTRY, SCRIPT_MODULE_VERSION } from '../src/bedrock/versions';
import { ACTIONS } from '../src/bedrock/rulePresets';
import type { ModProject, ModRule } from '../src/bedrock/types';

// U+2028/U+2029 built from char codes: written literally they are line
// terminators in JavaScript source, and this very file would stop parsing.
const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);

/** A project with one item and one creature, ready to hang rules off. */
function projectWithSubjects(): ModProject {
  const project = createProject('Rule Mod', 'Rules everywhere');
  project.items = [{ ...createItem('plain'), id: 'item-1', name: 'Magic Gem' }];
  project.mobs = [{ ...createMob(), id: 'mob-1', name: 'Sparkle Beast' }];
  return project;
}

function rule(over: Partial<ModRule>): ModRule {
  return { ...createRule(), ...over };
}

// "Rule Mod" becomes the namespace `rule_mod` — spaces turn into underscores.
const ctxFor = (p: ModProject) => ({
  item: (id: string) => (p.items.some((i) => i.id === id) ? 'rule_mod:magic_gem' : null),
  block: () => null,
  mob: (id: string) => (p.mobs.some((m) => m.id === id) ? 'rule_mod:sparkle_beast' : null),
});

const scriptOf = (addon: ReturnType<typeof buildAddon>) =>
  addon.files.find((f) => f.path.endsWith(SCRIPT_ENTRY));

describe('rule compiler', () => {
  it('resolves a trigger subject to the identifier that actually shipped', () => {
    const project = projectWithSubjects();
    project.rules = [rule({ trigger: 'useItem', subjectId: 'item-1', action: 'lightning' })];

    const table = buildRuleTable(project, ctxFor(project));
    expect(table).toHaveLength(1);
    expect(table[0]?.subject).toBe('rule_mod:magic_gem');
  });

  it('points a rule at the DE-DUPLICATED identifier when two things share a name', () => {
    // Two items called the same thing become magic_gem and magic_gem_2. A rule
    // watching the second must fire on the second, not silently on the first.
    const project = createProject('Rule Mod', '');
    project.items = [
      { ...createItem('plain'), id: 'a', name: 'Magic Gem' },
      { ...createItem('plain'), id: 'b', name: 'Magic Gem' },
    ];
    project.rules = [rule({ trigger: 'useItem', subjectId: 'b', action: 'lightning' })];

    const script = scriptOf(buildAddon(project));
    expect(script?.content).toContain('rule_mod:magic_gem_2');
  });

  it('drops a rule whose subject has been deleted', () => {
    const project = projectWithSubjects();
    project.rules = [rule({ trigger: 'hitMob', subjectId: 'mob-gone', action: 'lightning' })];
    expect(buildRuleTable(project, ctxFor(project))).toHaveLength(0);
  });

  it('drops a disabled rule, an empty message and an unpicked target', () => {
    const project = projectWithSubjects();
    project.rules = [
      rule({ trigger: 'useItem', subjectId: 'item-1', action: 'lightning', enabled: false }),
      rule({ trigger: 'useItem', subjectId: 'item-1', action: 'message', message: '   ' }),
      rule({ trigger: 'useItem', subjectId: 'item-1', action: 'summon' }),
      rule({ trigger: 'useItem', subjectId: 'item-1', action: 'giveItem' }),
    ];
    expect(buildRuleTable(project, ctxFor(project))).toHaveLength(0);
  });

  it('clamps every slider against the action preset, NaN included', () => {
    const project = projectWithSubjects();
    project.rules = [
      rule({
        trigger: 'playerJoins',
        action: 'effect',
        strength: 999,
        seconds: Number.NaN,
      }),
      rule({ trigger: 'playerJoins', action: 'explode', radius: -40 }),
    ];

    const table = buildRuleTable(project, ctxFor(project));
    expect(table[0]?.strength).toBe(5); // STRENGTH max
    expect(table[0]?.seconds).toBe(1); // NaN collapses to the minimum
    expect(table[1]?.radius).toBe(1); // RADIUS min
  });

  it('needs no subject for the join trigger', () => {
    const project = projectWithSubjects();
    project.rules = [rule({ trigger: 'playerJoins', action: 'lightning' })];
    expect(buildRuleTable(project, ctxFor(project))[0]?.subject).toBeNull();
  });
});

describe('generated script', () => {
  /** Parse as a real ES module; throws on any syntax error. */
  const parse = (source: string) => transformSync(source, { loader: 'js', format: 'esm' });

  it('is syntactically valid JavaScript for every action type', () => {
    const project = projectWithSubjects();
    project.rules = ACTIONS.map((spec) =>
      rule({
        trigger: 'playerJoins',
        action: spec.action,
        message: 'hello',
        summonTarget: { kind: 'vanilla', id: 'minecraft:chicken' },
        giveTarget: { kind: 'vanilla', id: 'minecraft:diamond' },
      }),
    );

    const table = buildRuleTable(project, ctxFor(project));
    expect(table).toHaveLength(ACTIONS.length);
    expect(() => parse(buildScriptMain(table))).not.toThrow();
  });

  it('survives adversarial text in a kid-typed message', () => {
    // The whole point of embedding rules as DATA is that no typed string can
    // change the meaning of the file. U+2028 is the interesting one: it is
    // legal inside JSON but is a line terminator in JavaScript source.
    const nasty = [
      `";world.sendMessage("pwned`,
      `back\\slash and "quotes"`,
      `line${LINE_SEP}separator`,
      `</script><script>`,
      `${PARA_SEP}paragraph`,
      `emoji 🎉 and 中文`,
    ];

    for (const message of nasty) {
      const project = projectWithSubjects();
      project.rules = [rule({ trigger: 'playerJoins', action: 'message', message })];
      const table = buildRuleTable(project, ctxFor(project));
      expect(table).toHaveLength(1);
      expect(() => parse(buildScriptMain(table))).not.toThrow();
    }
  });

  it('escapes U+2028 rather than emitting it raw', () => {
    const project = projectWithSubjects();
    project.rules = [rule({ trigger: 'playerJoins', action: 'message', message: 'a b' })];
    const source = buildScriptMain(buildRuleTable(project, ctxFor(project)));
    expect(source).not.toContain(LINE_SEP);
    expect(source).toContain('\\u2028');
  });

  it('ships an IDENTICAL runtime regardless of the rules', () => {
    // The safety argument for Phase 4 rests on this: the executable half never
    // varies, so it is reviewed and tested once. Only the data header differs.
    const a = projectWithSubjects();
    a.rules = [rule({ trigger: 'playerJoins', action: 'lightning' })];
    const b = projectWithSubjects();
    b.rules = ACTIONS.map((s) =>
      rule({
        trigger: 'playerJoins',
        action: s.action,
        message: 'hi',
        summonTarget: { kind: 'vanilla', id: 'minecraft:bee' },
        giveTarget: { kind: 'vanilla', id: 'minecraft:diamond' },
      }),
    );

    const bodyOf = (p: ModProject) => {
      const [, body] = buildScriptMain(buildRuleTable(p, ctxFor(p))).split(RUNTIME_MARKER);
      return body ?? '';
    };

    expect(bodyOf(a)).toBe(bodyOf(b));
    expect(bodyOf(a).length).toBeGreaterThan(500);
  });

  it('stays quiet unless a diagnostic banner is asked for', () => {
    const project = projectWithSubjects();
    project.rules = [rule({ trigger: 'playerJoins', action: 'lightning' })];
    const table = buildRuleTable(project, ctxFor(project));

    expect(buildScriptMain(table)).toContain('const BANNER = null;');
    expect(buildScriptMain(table, { banner: 'LocalTest' })).toContain('const BANNER = "LocalTest";');
  });
});

describe('script module in the manifest', () => {
  it('is absent when the mod has no rules, leaving pre-Phase-4 output untouched', () => {
    const manifest = buildBehaviorManifest(createProject('Plain', ''));
    expect(manifest.modules).toHaveLength(1);
    expect(manifest.modules[0]?.type).toBe('data');
    expect(manifest.dependencies?.every(isPackDependency)).toBe(true);
  });

  it('adds the script module and the @minecraft/server dependency when rules exist', () => {
    const manifest = buildBehaviorManifest(createProject('Scripted', ''), { scripts: true });

    const script = manifest.modules.find((m) => m.type === 'script');
    expect(script?.language).toBe('javascript');
    expect(script?.entry).toBe(SCRIPT_ENTRY);

    const moduleDep = manifest.dependencies?.find((d) => !isPackDependency(d));
    expect(moduleDep).toEqual({
      module_name: '@minecraft/server',
      version: SCRIPT_MODULE_VERSION,
    });
  });

  it('gives the script module its own fifth uuid', () => {
    const project = createProject('Scripted', '');
    const manifest = buildBehaviorManifest(project, { scripts: true });
    const ids = manifest.modules.map((m) => m.uuid).concat(manifest.header.uuid);
    expect(new Set(ids).size).toBe(ids.length);
    expect(project.uuids.bpScript).not.toBe(project.uuids.bpModule);
  });

  it('declares the script dependency as module_name + STRING version', () => {
    // A pack dependency is uuid + [x,y,z]; a script dependency is module_name
    // + a string. Both live in the one array and swapping them fails silently.
    const manifest = buildBehaviorManifest(createProject('Scripted', ''), { scripts: true });
    const dep = manifest.dependencies?.find((d) => !isPackDependency(d));
    expect(typeof (dep as { version: unknown }).version).toBe('string');
    const packDep = manifest.dependencies?.find(isPackDependency);
    expect(Array.isArray(packDep?.version)).toBe(true);
  });
});

describe('packaging with rules', () => {
  it('writes scripts/main.js only when a runnable rule survives', () => {
    const project = projectWithSubjects();
    expect(scriptOf(buildAddon(project))).toBeUndefined();

    // A rule that cannot run must not conjure a script module into existence.
    project.rules = [rule({ trigger: 'hitMob', subjectId: 'deleted', action: 'lightning' })];
    expect(scriptOf(buildAddon(project))).toBeUndefined();

    project.rules = [rule({ trigger: 'playerJoins', action: 'lightning' })];
    expect(scriptOf(buildAddon(project))).toBeDefined();
  });

  it('keeps the behavior manifest first in the file list', () => {
    // The manifest slot is reserved and filled late; ordering must not drift.
    const project = projectWithSubjects();
    project.rules = [rule({ trigger: 'playerJoins', action: 'lightning' })];
    const addon = buildAddon(project);
    expect(addon.files[0]?.path).toBe('Rule_Mod_BP/manifest.json');
    expect(addon.files[0]?.content).toContain('"type": "script"');
  });

  it('round-trips rules through storage normalisation', () => {
    const project = projectWithSubjects();
    project.rules = [
      rule({ trigger: 'useItem', subjectId: 'item-1', action: 'effect', effect: 'jump_boost' }),
    ];
    const reloaded = normalizeProject(JSON.parse(JSON.stringify(project)));
    expect(reloaded.rules).toHaveLength(1);
    expect(reloaded.rules[0]?.effect).toBe('jump_boost');
  });

  it('repairs a hand-edited rule naming a trigger and effect that do not exist', () => {
    const reloaded = normalizeProject({
      name: 'Broken',
      rules: [{ trigger: 'nonsense', action: 'alsoNonsense', effect: 'wat' }],
    } as unknown as Partial<ModProject>);

    expect(reloaded.rules[0]?.trigger).toBe('useItem');
    expect(reloaded.rules[0]?.action).toBe('effect');
    expect(reloaded.rules[0]?.effect).toBe('speed');
  });

  it('mints a script uuid for a project autosaved before Phase 4', () => {
    const legacy = normalizeProject({
      name: 'Old Mod',
      uuids: {
        bpHeader: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        bpModule: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        rpHeader: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        rpModule: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      },
    } as unknown as Partial<ModProject>);

    expect(legacy.uuids.bpScript).toBeTruthy();
    expect(legacy.uuids.bpHeader).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  });
});

describe('script layout', () => {
  it('puts the @minecraft/server import before anything else', () => {
    // Imports hoist, so order is not a correctness issue per spec — but the
    // engine that has to read this is not a spec, and conventional order is free.
    const project = projectWithSubjects();
    project.rules = [rule({ trigger: 'playerJoins', action: 'lightning' })];
    const lines = buildScriptMain(buildRuleTable(project, ctxFor(project))).split('\n');

    const importAt = lines.findIndex((l) => l.startsWith('import '));
    const constAt = lines.findIndex((l) => l.startsWith('const '));
    expect(importAt).toBeGreaterThanOrEqual(0);
    expect(importAt).toBeLessThan(constAt);
  });
});
