import type { InheritanceSource, TagLayer, TagValue } from './types';

/** Tags Storybook applies to every entry unless negated. */
export const DEFAULT_TAGS = ['dev', 'test'];

/**
 * Tags the indexer derives from what a file contains. Negating them would not change what the file
 * is, so they are left out of the editor entirely.
 */
export const DERIVED_TAGS = new Set(['play-fn', 'test-fn', 'attached-mdx', 'unattached-mdx', 'stories-mdx']);

/**
 * Tags Storybook applies itself. They can be negated, so they stay editable, but an entry can
 * never simply stop mentioning them: the row falls back to inheriting rather than disappearing.
 */
export const INTERNAL_TAGS = new Set([...DEFAULT_TAGS, 'manifest']);

/** Tags the editor never writes. */
export const RESERVED_TAGS = DERIVED_TAGS;

export const SOURCE_LABELS: Record<InheritanceSource, string> = {
  defaults: 'Storybook defaults',
  preview: 'preview',
  component: 'component',
};

export interface TagRow {
  tag: string;
  /** The entry's own value for this tag, if it declares one. */
  local: TagValue | undefined;
  /** The value inherited from upstream, if any. */
  inherited: TagValue | undefined;
  /** Which layer supplies `inherited`. */
  inheritedFrom: InheritanceSource | undefined;
  /** What applies after the local value overrides inheritance. */
  effective: TagValue | undefined;
  /** What applied when the dialog opened. Rows are grouped by this so they do not jump mid-edit. */
  savedEffective: TagValue | undefined;
  /** Applies, but is attributable to nothing the editor can write. */
  derived: boolean;
  editable: boolean;
  /** Why this row cannot be edited, for a tooltip. */
  disabledReason: string | undefined;
  /** How the draft differs from the last saved state. */
  change: 'added' | 'modified' | undefined;
}

export interface BuildTagRowsInput {
  /** Working copy of the entry's own tags, including negations. */
  draftLocalTags: string[];
  /** Last saved own tags, including negations. */
  savedLocalTags: string[];
  inheritedLayers: TagLayer[];
  /** Final computed tags of the index entry. */
  computedTags: string[];
  /** All tags seen across the project index, offered as additions. */
  knownTags: string[];
  /** Whether the entry's own tags can be edited at all. */
  editable: boolean;
  /** Why the entry cannot be edited, when it cannot. */
  readOnlyReason?: string;
}

const baseName = (raw: string) => (raw.startsWith('!') ? raw.slice(1) : raw);

/** Resolve one tag against a raw list. Later entries win. */
const valueOf = (tags: string[], tag: string): TagValue | undefined => {
  let value: TagValue | undefined;
  for (const entry of tags) {
    if (entry === tag) {
      value = 'included';
    } else if (entry === `!${tag}`) {
      value = 'excluded';
    }
  }
  return value;
};

const resolveInherited = (layers: TagLayer[], tag: string) => {
  let value: TagValue | undefined;
  let source: InheritanceSource | undefined;
  for (const layer of layers) {
    const layerValue = valueOf(layer.tags, tag);
    if (layerValue) {
      value = layerValue;
      source = layer.source;
    }
  }
  return { value, source };
};

/** Resolve a raw tag list with CSF semantics: later entries win, '!tag' removes 'tag'. */
export const combineTags = (...tags: string[]): string[] => {
  const result = new Set<string>();
  for (const tag of tags) {
    if (tag.startsWith('!')) {
      result.delete(tag.slice(1));
    } else {
      result.add(tag);
    }
  }
  return [...result];
};

/**
 * Derive the display rows for an entry from its tag layers and the current draft. Rows that applied
 * when the dialog opened come first, then the tags available to add; both sorted alphabetically.
 * Grouping follows the saved state so that editing a row never makes it jump to the other group.
 */
export const buildTagRows = (input: BuildTagRowsInput): TagRow[] => {
  const { draftLocalTags, savedLocalTags, inheritedLayers, computedTags, knownTags, editable } = input;

  const universe = new Set<string>([
    ...computedTags,
    ...inheritedLayers.flatMap((layer) => layer.tags.map(baseName)),
    ...draftLocalTags.map(baseName),
    ...savedLocalTags.map(baseName),
    ...knownTags,
  ]);

  const rows: TagRow[] = [];

  for (const tag of universe) {
    // Derived from the file's contents; there is nothing to write either way.
    if (DERIVED_TAGS.has(tag)) {
      continue;
    }

    const local = valueOf(draftLocalTags, tag);
    const savedLocal = valueOf(savedLocalTags, tag);
    let { value: inherited, source: inheritedFrom } = resolveInherited(inheritedLayers, tag);

    // Storybook applies these itself, so treat them as inherited: negatable, never droppable.
    if (inherited === undefined && INTERNAL_TAGS.has(tag) && computedTags.includes(tag)) {
      inherited = 'included';
      inheritedFrom = 'defaults';
    }

    const effective = local ?? inherited;
    const savedEffective = savedLocal ?? inherited;

    // Applies, but is attributable to nothing we can write, e.g. tags every child story of a
    // component declares. Judged on the saved state: editing a draft must never reclassify a row
    // as derived just because the entry stopped declaring the tag.
    const derived = savedEffective === undefined && computedTags.includes(tag);

    rows.push({
      tag,
      local,
      inherited,
      inheritedFrom,
      effective: derived ? 'included' : effective,
      savedEffective: derived ? 'included' : savedEffective,
      derived,
      editable: editable && !derived,
      disabledReason: derived
        ? 'Storybook derives this tag from the stories below; it cannot be edited here.'
        : editable
          ? undefined
          : input.readOnlyReason,
      change: savedLocal === local ? undefined : savedLocal === undefined ? 'added' : 'modified',
    });
  }

  return rows.sort(
    (a, b) =>
      Number(a.savedEffective === undefined) - Number(b.savedEffective === undefined) || a.tag.localeCompare(b.tag),
  );
};

const invert = (value: TagValue): TagValue => (value === 'included' ? 'excluded' : 'included');

/**
 * The entry the invert button writes: the opposite of what is inherited, or of what is declared
 * when nothing is inherited.
 */
export const oppositeOf = (row: TagRow): TagValue => invert(row.inherited ?? row.local ?? 'included');

const setLocal = (draft: string[], tag: string, value: TagValue | undefined): string[] => {
  const rest = draft.filter((entry) => entry !== tag && entry !== `!${tag}`);
  return value ? [...rest, value === 'excluded' ? `!${tag}` : tag] : rest;
};

/**
 * Checkbox: declare the tag on the entry, or stop declaring it. Where a tag is inherited, dropping
 * the local entry returns the row to the inherited (indeterminate) value rather than removing it.
 */
export const toggleTag = (draft: string[], row: TagRow): string[] =>
  row.local !== undefined ? setLocal(draft, row.tag, undefined) : setLocal(draft, row.tag, row.inherited ?? 'included');

/** Invert button: write the opposite entry, or drop it to go back to inheriting. */
export const invertTag = (draft: string[], row: TagRow): string[] => {
  const opposite = oppositeOf(row);
  return row.local === opposite && row.inherited !== undefined
    ? setLocal(draft, row.tag, undefined)
    : setLocal(draft, row.tag, opposite);
};

/** Add a tag typed by the user. A leading '!' declares an exclusion. */
export const addTag = (draft: string[], raw: string): string[] => {
  const excluded = raw.startsWith('!');
  return setLocal(draft, baseName(raw), excluded ? 'excluded' : 'included');
};

/** A tag is valid when non-empty, free of whitespace, and not reserved by Storybook. */
export const isValidTag = (raw: string): boolean => /^!?[^\s!]+$/.test(raw) && !RESERVED_TAGS.has(baseName(raw));

/** Whether a name the user typed is one Storybook derives and therefore owns. */
export const isReservedTag = (raw: string): boolean => RESERVED_TAGS.has(baseName(raw));
