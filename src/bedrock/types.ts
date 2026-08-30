/**
 * The project state. This is what gets autosaved to IndexedDB and what the
 * generator layer turns into a .mcaddon. It is plain serialisable data — no
 * classes, no functions, no Blobs — so it round-trips through structured
 * clone without surprises.
 */

/** A texture authored in the pixel editor: raw RGBA pixels, row-major. */
export interface Texture {
  /** Edge length in pixels (16, 32 or 64 — always square). */
  size: number;
  /**
   * `size * size` entries, row-major, each an `#rrggbb` string or null for a
   * fully transparent pixel.
   */
  pixels: (string | null)[];
}

export type ItemKind =
  | 'sword'
  | 'pickaxe'
  | 'axe'
  | 'shovel'
  | 'bow'
  | 'throwable'
  | 'armor'
  | 'food'
  | 'plain';

/** What flies out of a throwing weapon. */
export type ProjectileKind = 'arrow' | 'snowball' | 'egg';

export type ArmorSlot = 'head' | 'chest' | 'legs' | 'feet';

/** One crafting-grid slot: a vanilla item id like `minecraft:diamond`, or null. */
export type RecipeSlot = string | null;

export interface Recipe {
  enabled: boolean;
  /** Exactly 9 entries, row-major 3x3. */
  grid: RecipeSlot[];
  /** How many of the new item one craft produces. */
  count: number;
}

export interface ModItem {
  id: string;
  /** Kid-typed display name, e.g. "Ruby Sword". */
  name: string;
  kind: ItemKind;
  texture: Texture;
  /** Extra attack damage. Sword/axe/pickaxe/shovel. */
  power: number;
  /** max_durability — "how many hits before it breaks". Tools + armor. */
  durability: number;
  /** Mining speed multiplier for pickaxe/axe/shovel. */
  digSpeed: number;
  /** Armor only. */
  armorSlot: ArmorSlot;
  /** Armor points. Armor only. */
  protection: number;
  /** Food only: half-drumsticks restored. */
  nutrition: number;
  /** Food only: can be eaten at full hunger. */
  canAlwaysEat: boolean;
  /** Plain items only: how many stack in one inventory slot. */
  stackSize: number;
  /** Bow only: how long you pull it back before it's at full power. */
  drawTime: number;
  /** Throwing weapon only: how hard it flies. */
  throwPower: number;
  /** Throwing weapon only: which projectile it becomes in flight. */
  projectileKind: ProjectileKind;
  recipe: Recipe;
}

/** How a block's faces are textured. */
export type BlockFaceMode = 'all' | 'topSideBottom';

/** Kid-facing look, mapped to a render_method in the generator. */
export type BlockLook = 'solid' | 'seeThrough' | 'cutout';

/** Which tool a block needs before it drops anything. */
export type BlockTool = 'any' | 'pickaxe' | 'axe' | 'shovel';

/** What a block drops when broken. */
export type BlockDrop =
  | { kind: 'self' }
  | { kind: 'nothing' }
  | { kind: 'vanilla'; id: string }
  | { kind: 'myItem'; itemId: string };

export interface Smelting {
  enabled: boolean;
  /** Vanilla item id that smelts into this block. */
  input: string | null;
}

export interface ModBlock {
  id: string;
  name: string;
  faceMode: BlockFaceMode;
  /** Used for every face in 'all' mode, and the four sides otherwise. */
  texture: Texture;
  textureTop: Texture;
  textureBottom: Texture;
  look: BlockLook;
  /** "How many hits to break" — mapped to seconds_to_destroy. */
  hardness: number;
  /** minecraft:light_emission, 0-15. */
  glow: number;
  tool: BlockTool;
  drop: BlockDrop;
  dropCount: number;
  recipe: Recipe;
  smelting: Smelting;
}

export type MobRigId = 'quadruped' | 'biped' | 'bird';
export type MobMood = 'friendly' | 'shy' | 'mean';

/** What a mob drops when defeated. */
export type MobDrop =
  | { kind: 'nothing' }
  | { kind: 'vanilla'; id: string }
  | { kind: 'myItem'; itemId: string };

export interface ModMob {
  id: string;
  name: string;
  rig: MobRigId;
  texture: Texture;
  health: number;
  speed: number;
  damage: number;
  size: number;
  mood: MobMood;
  tameable: boolean;
  tameFood: string | null;
  rideable: boolean;
  breedable: boolean;
  breedFood: string | null;
  drop: MobDrop;
  dropCount: number;
}

/** What starts a rule running. */
export type TriggerKind =
  | 'useItem'
  | 'breakBlock'
  | 'placeBlock'
  | 'hitMob'
  | 'mobDies'
  | 'playerJoins';

/** What the rule does when it fires. */
export type ActionKind =
  | 'effect'
  | 'message'
  | 'lightning'
  | 'explode'
  | 'summon'
  | 'giveItem'
  | 'playSound'
  | 'setOnFire';

/** Vanilla potion effect id, minus the `minecraft:` prefix. */
export type RuleEffect =
  | 'speed'
  | 'jump_boost'
  | 'strength'
  | 'regeneration'
  | 'resistance'
  | 'fire_resistance'
  | 'night_vision'
  | 'invisibility'
  | 'water_breathing'
  | 'slow_falling'
  | 'levitation'
  | 'slowness'
  | 'weakness'
  | 'poison';

export type RuleSound = string;

/** Something the rule points at: a vanilla id, or one of the kid's own. */
export type RuleTarget =
  | { kind: 'none' }
  | { kind: 'vanilla'; id: string }
  | { kind: 'mine'; refId: string };

/**
 * One "When X happens, do Y" rule.
 *
 * Flat like ModItem: every action's fields live on the same record and the
 * preset decides which are actually read. That keeps storage round-tripping
 * trivial and means switching action type never loses the other settings.
 */
export interface ModRule {
  id: string;
  /** Kid-typed label, purely for their own list. Never reaches the game. */
  name: string;
  enabled: boolean;
  trigger: TriggerKind;
  /**
   * Which of the kid's own creations the trigger watches — the `id` of a
   * ModItem, ModBlock or ModMob. Null only for triggers that need no subject.
   */
  subjectId: string | null;
  action: ActionKind;
  effect: RuleEffect;
  strength: number;
  seconds: number;
  message: string;
  radius: number;
  fireSeconds: number;
  summonTarget: RuleTarget;
  summonCount: number;
  giveTarget: RuleTarget;
  giveCount: number;
  sound: RuleSound;
}

export interface ModProject {
  id: string;
  name: string;
  description: string;
  /** Derived from name at creation, then frozen so identifiers stay stable. */
  namespace: string;
  icon: Texture;
  /** Stable UUIDs — regenerating these on every export would make Minecraft
   *  treat each download as a brand-new pack instead of an update. */
  uuids: {
    bpHeader: string;
    bpModule: string;
    rpHeader: string;
    rpModule: string;
    /** Script module. Only emitted when the mod actually has rules. */
    bpScript: string;
  };
  /** Bumped on each export so re-imports replace the old copy. */
  version: [number, number, number];
  items: ModItem[];
  blocks: ModBlock[];
  mobs: ModMob[];
  rules: ModRule[];
  createdAt: number;
  updatedAt: number;
}

/** A file destined for the zip. Text files are strings; PNGs are bytes. */
export type PackFile =
  | { path: string; kind: 'text'; content: string }
  | { path: string; kind: 'binary'; content: Uint8Array };

export interface BuiltAddon {
  fileName: string;
  files: PackFile[];
}
