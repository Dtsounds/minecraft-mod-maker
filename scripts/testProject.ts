/**
 * The shared on-device test mod.
 *
 * Used by BOTH `install-local` (writes into the real client's world) and
 * `serve-test` (runs against a dedicated server). It lives here rather than
 * inside either script so the two cannot drift: a rule verified headless is
 * then exactly the rule the client loads, with no "well, the other script had
 * a slightly different fixture" to chase.
 *
 * Every entry is chosen to exercise a distinct code path, and the console
 * instructions in `install-local` describe what each should look like in game.
 */
import { createProject, createItem, createBlock, createMob, createRule } from '../src/bedrock/project';
import { blankTexture } from '../src/bedrock/texture';
import { mobRig } from '../src/bedrock/mobGeometry';
import { starterMobTexture } from '../src/components/mobStarter';
import type { ModBlock, ModItem, ModMob, ModProject, Texture } from '../src/bedrock/types';

function solidTexture(hex: string): Texture {
  const t = blankTexture(16);
  return { size: 16, pixels: t.pixels.map(() => hex) };
}

export function testProject(): ModProject {
  const project = createProject('LocalTest', 'Installed straight into the dev folders');

  // Fixed, so re-running replaces the pack in place instead of stacking up a
  // new copy every time — which once meant hours of testing a stale build.
  project.uuids = {
    bpHeader: 'b7e4d2a1-3c55-4f18-9a20-71d0e6c4a891',
    bpModule: 'c8f5e3b2-4d66-4a29-8b31-82e1f7d5b902',
    rpHeader: 'd9a6f4c3-5e77-4b3a-9c42-93f2a8e6ca13',
    rpModule: 'eab7a5d4-6f88-4c4b-ad53-a4a3b9f7db24',
    bpScript: 'fbc8b6e5-7a99-4d5c-be64-b5b4cae8ec35',
  };

  // --- Items -----------------------------------------------------------------

  const gem: ModItem = {
    ...createItem('plain'),
    name: 'Test Gem',
    texture: solidTexture('#ff00ff'),
    stackSize: 64,
  };
  const sword: ModItem = {
    ...createItem('sword'),
    name: 'Test Sword',
    texture: solidTexture('#00ff00'),
    power: 9,
    durability: 900,
    recipe: {
      // Emerald, not diamond: diamond-diamond-stick IS vanilla's diamond sword,
      // and colliding with a vanilla recipe makes the server log a duplicate
      // warning that has nothing to do with us.
      enabled: true,
      grid: [null, 'minecraft:emerald', null, null, 'minecraft:emerald', null, null, 'minecraft:stick', null],
      count: 1,
    },
  };
  const snack: ModItem = {
    ...createItem('food'),
    name: 'Test Snack',
    texture: solidTexture('#00ffff'),
    nutrition: 8,
    canAlwaysEat: true,
  };
  /** Bow: shooter + use_modifiers, firing vanilla arrows. */
  const bow: ModItem = {
    ...createItem('bow'),
    name: 'Test Bow',
    texture: solidTexture('#ffb703'),
    drawTime: 4,
    durability: 400,
  };
  /** Throwing weapon: the item itself becomes an arrow entity in flight. */
  const star: ModItem = {
    ...createItem('throwable'),
    name: 'Test Star',
    texture: solidTexture('#ff4d5e'),
    throwPower: 8,
    stackSize: 16,
    projectileKind: 'arrow',
  };
  /** Same, but harmless — checks the projectile picker changes what flies. */
  const snowStar: ModItem = {
    ...createItem('throwable'),
    name: 'Test Snowstar',
    texture: solidTexture('#c6ecff'),
    throwPower: 6,
    stackSize: 16,
    projectileKind: 'snowball',
  };

  project.items = [gem, sword, snack, bow, star, snowStar];

  // --- Blocks ----------------------------------------------------------------

  /** Plain solid block that drops itself; the baseline case. */
  const stone: ModBlock = {
    ...createBlock(),
    name: 'Test Stone',
    texture: solidTexture('#ff8800'),
    hardness: 3,
  };
  /** Glowing, pickaxe-gated, drops diamonds: light_emission, the match_tool
   *  loot condition and a non-self drop, all at once. */
  const ore: ModBlock = {
    ...createBlock(),
    name: 'Test Ore',
    texture: solidTexture('#ffee00'),
    hardness: 6,
    glow: 14,
    tool: 'pickaxe',
    drop: { kind: 'vanilla', id: 'minecraft:diamond' },
    dropCount: 2,
  };
  /** See-through, so render_method "blend" gets exercised. */
  const glass: ModBlock = {
    ...createBlock(),
    name: 'Test Glass',
    texture: solidTexture('#66ddff'),
    look: 'seeThrough',
    hardness: 1,
  };
  /** Distinct top/side/bottom, plus a furnace recipe. */
  const grassy: ModBlock = {
    ...createBlock(),
    name: 'Test Grassy',
    faceMode: 'topSideBottom',
    texture: solidTexture('#8a5f3c'),
    textureTop: solidTexture('#3fbf5f'),
    textureBottom: solidTexture('#5a3a22'),
    hardness: 2,
    smelting: { enabled: true, input: 'minecraft:dirt' },
  };

  project.blocks = [stone, ore, glass, grassy];

  // --- Mobs ------------------------------------------------------------------

  /** Friendly quadruped, tameable and breedable. The baseline creature. */
  const critter: ModMob = {
    ...createMob(),
    name: 'Test Critter',
    rig: 'quadruped',
    texture: starterMobTexture(mobRig('quadruped'), '#c05ad8'),
    health: 20,
    speed: 6,
    mood: 'friendly',
    tameable: true,
    tameFood: 'minecraft:wheat',
    breedable: true,
    breedFood: 'minecraft:wheat',
    drop: { kind: 'vanilla', id: 'minecraft:leather' },
    dropCount: 2,
  };
  /** Hostile biped: exercises attack, melee and player targeting. */
  const brute: ModMob = {
    ...createMob(),
    name: 'Test Brute',
    rig: 'biped',
    texture: starterMobTexture(mobRig('biped'), '#3fbf5f'),
    health: 30,
    speed: 7,
    damage: 5,
    mood: 'mean',
    drop: { kind: 'vanilla', id: 'minecraft:bone' },
    dropCount: 1,
  };
  /** Small, fast, shy bird — rideable and scaled up, so minecraft:scale and
   *  collision-box scaling both get exercised. */
  const birdy: ModMob = {
    ...createMob(),
    name: 'Test Birdy',
    rig: 'bird',
    texture: starterMobTexture(mobRig('bird'), '#ffb703'),
    health: 8,
    speed: 12,
    size: 18,
    mood: 'shy',
    rideable: true,
    drop: { kind: 'vanilla', id: 'minecraft:feather' },
    dropCount: 3,
  };

  project.mobs = [critter, brute, birdy];

  // --- Rules -----------------------------------------------------------------

  /**
   * Five rules covering every distinct path through the runtime in ONE world
   * visit: all three subject kinds, a player-targeted action (addEffect) and
   * dimension-targeted ones, and ItemStack construction.
   *
   * These need real player input to fire, so they are the part `serve-test`
   * cannot check. The runtime's self-test covers the ACTIONS headlessly; these
   * cover the TRIGGERS, and only in the client.
   */
  project.rules = [
    {
      ...createRule(),
      name: 'Gem grants speed',
      trigger: 'useItem',
      subjectId: gem.id,
      action: 'effect',
      effect: 'speed',
      strength: 3,
      seconds: 20,
    },
    {
      ...createRule(),
      name: 'Sword calls lightning',
      trigger: 'useItem',
      subjectId: sword.id,
      action: 'lightning',
    },
    {
      ...createRule(),
      name: 'Stone drops diamonds',
      trigger: 'breakBlock',
      subjectId: stone.id,
      action: 'giveItem',
      giveTarget: { kind: 'vanilla', id: 'minecraft:diamond' },
      giveCount: 3,
    },
    {
      ...createRule(),
      name: 'Glass summons chickens',
      trigger: 'placeBlock',
      subjectId: glass.id,
      action: 'summon',
      summonTarget: { kind: 'vanilla', id: 'minecraft:chicken' },
      summonCount: 3,
    },
    {
      ...createRule(),
      name: 'Critter complains',
      trigger: 'hitMob',
      subjectId: critter.id,
      action: 'message',
      message: 'Ouch! Stop that!',
    },
  ];

  return project;
}
