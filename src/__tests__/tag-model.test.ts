import { describe, expect, it } from 'vitest';

import {
  addTag,
  buildTagRows,
  combineTags,
  DEFAULT_TAGS,
  invertTag,
  isReservedTag,
  isValidTag,
  oppositeOf,
  toggleTag,
  type BuildTagRowsInput,
  type TagRow,
} from '../tag-model';
import type { TagLayer } from '../types';

const DEFAULTS: TagLayer = { source: 'defaults', tags: DEFAULT_TAGS };

const build = (overrides: Partial<BuildTagRowsInput> = {}) =>
  buildTagRows({
    draftLocalTags: [],
    savedLocalTags: [],
    inheritedLayers: [DEFAULTS],
    computedTags: [],
    knownTags: [],
    editable: true,
    ...overrides,
  });

const row = (rows: TagRow[], tag: string) => {
  const found = rows.find((candidate) => candidate.tag === tag);
  if (!found) {
    throw new Error(`no row for ${tag}`);
  }
  return found;
};

describe('combineTags', () => {
  it('applies negations in order', () => {
    expect(combineTags('a', 'b', '!a')).toEqual(['b']);
    expect(combineTags('!a', 'a')).toEqual(['a']);
  });
});

describe('buildTagRows', () => {
  it('resolves a tag from the last layer that mentions it', () => {
    const rows = build({
      inheritedLayers: [DEFAULTS, { source: 'preview', tags: ['docs'] }, { source: 'component', tags: ['!docs'] }],
    });

    expect(row(rows, 'docs')).toMatchObject({
      inherited: 'excluded',
      inheritedFrom: 'component',
      effective: 'excluded',
      local: undefined,
    });
  });

  it('lets a local value override inheritance', () => {
    const rows = build({
      draftLocalTags: ['docs'],
      inheritedLayers: [DEFAULTS, { source: 'preview', tags: ['!docs'] }],
    });

    expect(row(rows, 'docs')).toMatchObject({
      local: 'included',
      inherited: 'excluded',
      effective: 'included',
    });
  });

  it('hides tags the indexer derives from file contents', () => {
    const rows = build({ computedTags: ['play-fn', 'attached-mdx', 'dev'] });

    expect(rows.map((candidate) => candidate.tag)).not.toContain('play-fn');
    expect(rows.map((candidate) => candidate.tag)).not.toContain('attached-mdx');
  });

  it('treats tags Storybook applies itself as inherited, so they can be negated', () => {
    const rows = build({ computedTags: ['manifest'] });

    expect(row(rows, 'manifest')).toMatchObject({
      inherited: 'included',
      inheritedFrom: 'defaults',
      derived: false,
      editable: true,
    });
  });

  it('marks unattributable tags as derived and not editable', () => {
    const rows = build({ computedTags: ['from-children'] });

    expect(row(rows, 'from-children')).toMatchObject({
      derived: true,
      editable: false,
      effective: 'included',
    });
    expect(row(rows, 'from-children').disabledReason).toMatch(/derives this tag/);
  });

  it('judges derived on the saved state, so removing a tag does not disable its row', () => {
    const rows = build({
      savedLocalTags: ['focused'],
      draftLocalTags: [],
      computedTags: ['focused'],
    });

    expect(row(rows, 'focused')).toMatchObject({
      derived: false,
      editable: true,
      effective: undefined,
      changed: true,
    });
  });

  it('groups by the saved state so rows do not move while editing', () => {
    const rows = build({
      savedLocalTags: ['kept'],
      draftLocalTags: [],
      knownTags: ['kept', 'spare'],
    });

    expect(row(rows, 'kept').savedEffective).toBe('included');
    expect(row(rows, 'spare').savedEffective).toBeUndefined();
  });

  it('reports what changed against the saved state', () => {
    const rows = build({
      savedLocalTags: ['old'],
      draftLocalTags: ['old', 'fresh'],
      knownTags: ['untouched'],
    });

    expect(row(rows, 'fresh').changed).toBe(true);
    expect(row(rows, 'old').changed).toBe(false);
    expect(row(rows, 'untouched').changed).toBe(false);
  });

  it('reports a flipped value as changed', () => {
    const rows = build({ savedLocalTags: ['a'], draftLocalTags: ['!a'] });

    expect(row(rows, 'a').changed).toBe(true);
  });

  it('carries the read-only reason onto every row', () => {
    const rows = build({
      knownTags: ['a'],
      editable: false,
      readOnlyReason: 'File is locked.',
    });

    expect(row(rows, 'a')).toMatchObject({ editable: false, disabledReason: 'File is locked.' });
  });

  it('sorts applied rows before available ones, alphabetically within each', () => {
    const rows = build({
      savedLocalTags: ['zeta'],
      draftLocalTags: ['zeta'],
      knownTags: ['alpha', 'zeta'],
    });

    expect(rows.map((candidate) => candidate.tag)).toEqual(['dev', 'test', 'zeta', 'alpha']);
  });
});

describe('toggleTag', () => {
  it('declares an inherited tag locally, keeping its value', () => {
    const rows = build({ inheritedLayers: [DEFAULTS, { source: 'preview', tags: ['!docs'] }] });

    expect(toggleTag([], row(rows, 'docs'))).toEqual(['!docs']);
  });

  it('drops a local entry, falling back to inheritance', () => {
    const rows = build({
      draftLocalTags: ['dev'],
      inheritedLayers: [DEFAULTS],
    });

    expect(toggleTag(['dev'], row(rows, 'dev'))).toEqual([]);
  });

  it('declares a tag that nothing supplies', () => {
    const rows = build({ knownTags: ['fresh'] });

    expect(toggleTag([], row(rows, 'fresh'))).toEqual(['fresh']);
  });
});

describe('invertTag', () => {
  it('writes the opposite of an inherited value', () => {
    const rows = build({ inheritedLayers: [DEFAULTS, { source: 'preview', tags: ['docs'] }] });

    expect(invertTag([], row(rows, 'docs'))).toEqual(['!docs']);
  });

  it('re-includes an excluded inherited tag as a local entry, not back to inheriting', () => {
    const inheritedLayers = [DEFAULTS, { source: 'preview' as const, tags: ['docs'] }];

    // Exclude the inherited tag...
    const excluded = invertTag([], row(build({ inheritedLayers }), 'docs'));
    expect(excluded).toEqual(['!docs']);

    // ...then include it again: the entry declares it itself.
    const reincluded = invertTag(excluded, row(build({ draftLocalTags: excluded, inheritedLayers }), 'docs'));
    expect(reincluded).toEqual(['docs']);
  });

  it('leaves unchecking as the way back to inheriting', () => {
    const inheritedLayers = [DEFAULTS, { source: 'preview' as const, tags: ['docs'] }];
    const rows = build({ draftLocalTags: ['docs'], inheritedLayers });

    expect(toggleTag(['docs'], row(rows, 'docs'))).toEqual([]);
  });

  it('flips a local entry that nothing supplies, rather than removing it', () => {
    const rows = build({ draftLocalTags: ['solo'], knownTags: ['solo'] });

    expect(invertTag(['solo'], row(rows, 'solo'))).toEqual(['!solo']);
  });

  it('adds an exclusion for a tag that does not apply yet', () => {
    const rows = build({ knownTags: ['spare'] });

    expect(invertTag([], row(rows, 'spare'))).toEqual(['!spare']);
  });

  it('opposes whatever currently applies', () => {
    const inherited = build({
      inheritedLayers: [DEFAULTS, { source: 'preview', tags: ['!docs'] }],
    });
    expect(oppositeOf(row(inherited, 'docs'))).toBe('included');

    const overridden = build({
      draftLocalTags: ['docs'],
      inheritedLayers: [DEFAULTS, { source: 'preview', tags: ['!docs'] }],
    });
    expect(oppositeOf(row(overridden, 'docs'))).toBe('excluded');
  });
});

describe('addTag', () => {
  it('adds a tag and replaces any existing entry for it', () => {
    expect(addTag(['!a', 'b'], 'a')).toEqual(['b', 'a']);
  });

  it('adds an exclusion when the name starts with a bang', () => {
    expect(addTag(['a'], '!a')).toEqual(['!a']);
  });
});

describe('tag names', () => {
  it.each(['a', 'needs-copy', '!a', 'version:1.0.0'])('accepts %s', (tag) => {
    expect(isValidTag(tag)).toBe(true);
  });

  it.each(['', 'two words', '!!a', 'play-fn'])('rejects %s', (tag) => {
    expect(isValidTag(tag)).toBe(false);
  });

  it('recognises names Storybook derives', () => {
    expect(isReservedTag('play-fn')).toBe(true);
    expect(isReservedTag('!attached-mdx')).toBe(true);
    expect(isReservedTag('dev')).toBe(false);
  });
});
