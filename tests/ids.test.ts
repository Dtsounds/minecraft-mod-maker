import { describe, expect, it } from 'vitest';
import {
  clampInt,
  isUuid,
  toAddonFileName,
  toIdentifier,
  toIdentifierSegment,
  toNamespace,
  toPackFolderName,
  uuid,
} from '../src/bedrock/ids';

describe('identifier sanitisation', () => {
  it('lowercases and underscores kid-typed names', () => {
    expect(toIdentifierSegment('Ruby Sword')).toBe('ruby_sword');
    expect(toIdentifierSegment('SUPER  mega   BLADE')).toBe('super_mega_blade');
    expect(toIdentifierSegment("Zoe's Wand!!!")).toBe('zoes_wand');
  });

  it('never returns an empty or invalid segment', () => {
    const nasty = ['', '   ', '!!!', '???', '   ---   ', '\n\t'];
    for (const input of nasty) {
      const out = toIdentifierSegment(input);
      expect(out).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('does not let an identifier start with a digit', () => {
    expect(toIdentifierSegment('3000 Sword')).toMatch(/^[a-z]/);
  });

  it('builds namespaced identifiers', () => {
    expect(toIdentifier('Ruby Mod', 'Ruby Sword')).toBe('ruby_mod:ruby_sword');
  });

  it('derives a namespace from the mod name', () => {
    expect(toNamespace('Zoe Mega Mod')).toBe('zoe_mega_mod');
    expect(toNamespace('')).toBe('mymod');
  });

  it('makes safe pack folder and file names', () => {
    expect(toPackFolderName("Zoe's Mod!")).toBe('Zoes_Mod');
    expect(toPackFolderName('')).toBe('MyMod');
    expect(toAddonFileName('Ruby Mod')).toBe('Ruby_Mod.mcaddon');
  });
});

describe('uuid', () => {
  it('generates valid, unique v4 UUIDs', () => {
    const values = new Set(Array.from({ length: 200 }, () => uuid()));
    expect(values.size).toBe(200);
    for (const value of values) expect(isUuid(value)).toBe(true);
  });
});

describe('clampInt', () => {
  it('clamps and coerces', () => {
    expect(clampInt(5, 1, 10)).toBe(5);
    expect(clampInt(-99, 1, 10)).toBe(1);
    expect(clampInt(9999, 1, 10)).toBe(10);
    expect(clampInt(NaN, 3, 10)).toBe(3);
    expect(clampInt(4.6, 1, 10)).toBe(5);
  });
});
