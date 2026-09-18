import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

/**
 * Reading and writing the `tags` attribute of the `<Meta>` block in an MDX docs file.
 *
 * Edits are spliced into the original source at the offsets remark reports, so prose, formatting
 * and MDX expressions elsewhere in the file are left byte for byte as they were.
 */

interface Offsets {
  start: number;
  end: number;
}

interface Positioned {
  position?: { start: { offset?: number }; end: { offset?: number } };
}

interface MdxAttribute extends Positioned {
  type: string;
  name?: string | null;
  value?: { type?: string; value?: unknown } | string | null;
}

/** The parts of the mdast nodes this module reads; mdast-util-mdx ships no types of its own. */
interface MdxNode extends Positioned {
  type: string;
  name?: string | null;
  value?: unknown;
  attributes?: MdxAttribute[];
}

interface MetaElement {
  /** Source range of the whole `<Meta … />` element. */
  element: Offsets;
  /** Source range of the `tags` attribute, when it has one. */
  tagsAttribute?: Offsets;
  /** Raw expression the `tags` attribute holds, e.g. `['a', 'b']`. */
  tagsExpression?: string;
  /** Whether `tags` was given a form this module cannot rewrite, e.g. a plain string. */
  tagsUnsupported?: boolean;
  /** Identifier passed to `of={…}`, naming the stories the page attaches to. */
  ofIdentifier?: string;
  /** Raw `import` / `export` statements from the file. */
  esm: string[];
}

const offsetsOf = (node: Positioned): Offsets | undefined => {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return start === undefined || end === undefined ? undefined : { start, end };
};

/** Locate the `<Meta>` block and the pieces of it this module cares about. */
export const findMeta = (source: string): MetaElement | undefined => {
  const tree = unified().use(remarkParse).use(remarkMdx).parse(source);

  let found: MetaElement | undefined;
  const esm: string[] = [];

  const expressionOf = (value: MdxAttribute['value']) =>
    value && typeof value === 'object' && value.type === 'mdxJsxAttributeValueExpression'
      ? String(value.value ?? '')
      : undefined;

  visit(tree, (unistNode) => {
    const node = unistNode as unknown as MdxNode;

    if (node.type === 'mdxjsEsm' && typeof node.value === 'string') {
      esm.push(node.value);
      return;
    }
    if (found || (node.type !== 'mdxJsxFlowElement' && node.type !== 'mdxJsxTextElement')) {
      return;
    }
    if (node.name !== 'Meta') {
      return;
    }
    const element = offsetsOf(node);
    if (!element) {
      return;
    }

    const meta: MetaElement = { element, esm };

    for (const attribute of node.attributes ?? []) {
      if (attribute.type !== 'mdxJsxAttribute') {
        continue;
      }
      if (attribute.name === 'of') {
        meta.ofIdentifier = expressionOf(attribute.value)?.trim();
      }
      if (attribute.name === 'tags') {
        meta.tagsAttribute = offsetsOf(attribute);
        const expression = expressionOf(attribute.value);
        if (expression === undefined) {
          // `tags="a"` — a string attribute rather than an array expression.
          meta.tagsUnsupported = true;
        } else {
          meta.tagsExpression = expression;
        }
      }
    }

    found = meta;
  });

  return found ? { ...found, esm } : undefined;
};

/** Read an array-of-string-literals expression. Returns null for anything else. */
export const parseTagsExpression = (expression: string): string[] | null => {
  const trimmed = expression.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    return null;
  }
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) {
    return [];
  }

  const tags: string[] = [];
  // Walk the literals rather than splitting on commas, which a tag could contain.
  const literal = /\s*(['"])((?:\\.|(?!\1)[^\\])*)\1\s*(,|$)/y;
  literal.lastIndex = 0;
  while (literal.lastIndex < inner.length) {
    const match = literal.exec(inner);
    if (!match) {
      return null;
    }
    tags.push((match[2] ?? '').replace(/\\(.)/g, '$1'));
    if (!match[3]) {
      break;
    }
  }
  return literal.lastIndex >= inner.length ? tags : null;
};

const printTags = (tags: string[]) => `tags={[${tags.map((tag) => `'${tag}'`).join(', ')}]}`;

export type MdxReadResult =
  { ok: true; tags: string[]; ofIdentifier?: string; esm: string[] } | { ok: false; reason: string };

export const readMdxTags = (source: string): MdxReadResult => {
  const meta = findMeta(source);
  if (!meta) {
    return { ok: false, reason: 'No <Meta> block found in this MDX file.' };
  }
  if (meta.tagsUnsupported) {
    return { ok: false, reason: 'The tags attribute of <Meta> is not an array of tags.' };
  }
  if (meta.tagsExpression === undefined) {
    return { ok: true, tags: [], ofIdentifier: meta.ofIdentifier, esm: meta.esm };
  }
  const tags = parseTagsExpression(meta.tagsExpression);
  if (tags === null) {
    return { ok: false, reason: 'Tags of this file cannot be statically analyzed.' };
  }
  return { ok: true, tags, ofIdentifier: meta.ofIdentifier, esm: meta.esm };
};

export type MdxWriteResult = { ok: true; source: string } | { ok: false; reason: string };

/** Replace, add or drop the `tags` attribute, leaving the rest of the file untouched. */
export const writeMdxTags = (source: string, tags: string[]): MdxWriteResult => {
  const meta = findMeta(source);
  if (!meta) {
    return { ok: false, reason: 'No <Meta> block found in this MDX file.' };
  }
  if (meta.tagsUnsupported) {
    return { ok: false, reason: 'The tags attribute of <Meta> is not an array of tags.' };
  }

  if (meta.tagsAttribute) {
    if (tags.length) {
      return {
        ok: true,
        source: source.slice(0, meta.tagsAttribute.start) + printTags(tags) + source.slice(meta.tagsAttribute.end),
      };
    }
    // Take the whitespace that separated it from the previous attribute with it.
    let start = meta.tagsAttribute.start;
    while (start > 0 && /\s/.test(source[start - 1] ?? '')) {
      start -= 1;
    }
    return { ok: true, source: source.slice(0, start) + source.slice(meta.tagsAttribute.end) };
  }

  if (!tags.length) {
    return { ok: true, source };
  }

  const element = source.slice(meta.element.start, meta.element.end);
  const selfClosing = element.lastIndexOf('/>');
  const insertAt = selfClosing === -1 ? element.lastIndexOf('>') : selfClosing;
  if (insertAt === -1) {
    return { ok: false, reason: 'Could not find the end of the <Meta> block.' };
  }

  const before = meta.element.start + insertAt;
  const separator = /\s/.test(source[before - 1] ?? '') ? '' : ' ';
  return {
    ok: true,
    source: source.slice(0, before) + separator + printTags(tags) + ' ' + source.slice(before),
  };
};

/** Find where `of={X}` imports its stories from, so the component's tags can be resolved. */
export const findOfImportPath = (esm: string[], identifier: string): string | undefined => {
  const name = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    // import * as X from '…'  /  import X from '…'
    new RegExp(`import\\s+(?:\\*\\s+as\\s+)?${name}\\s+from\\s+['"]([^'"]+)['"]`),
    // import { X } from '…'  /  import { Y as X } from '…'
    new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s+['"]([^'"]+)['"]`),
  ];
  for (const source of esm) {
    for (const pattern of patterns) {
      const match = pattern.exec(source);
      if (match) {
        return match[1];
      }
    }
  }
  return undefined;
};
