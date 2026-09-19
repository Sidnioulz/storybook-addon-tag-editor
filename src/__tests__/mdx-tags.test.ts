import { describe, expect, it } from 'vitest';

import { findOfImportPath, parseTagsExpression, readMdxTags, writeMdxTags } from '../mdx-tags';

const page = (meta: string, body = '\n# Title\n\nSome *prose*.\n') =>
  `import { Meta } from '@storybook/addon-docs/blocks';\n\n${meta}\n${body}`;

const write = (source: string, tags: string[]) => {
  const result = writeMdxTags(source, tags);
  if (!result.ok) {
    throw new Error(result.reason);
  }
  return result.source;
};

describe('parseTagsExpression', () => {
  it.each([
    ['[]', []],
    [`['a','b']`, ['a', 'b']],
    [`[ 'a' , "b" ]`, ['a', 'b']],
    [`['a',]`, ['a']],
    [`["b,c"]`, ['b,c']],
    [`["it\\'s"]`, ["it's"]],
  ])('reads %s', (expression, expected) => {
    expect(parseTagsExpression(expression)).toEqual(expected);
  });

  it.each(['[foo]', 'notAnArray', '[1, 2]', `['a' 'b']`])('rejects %s', (expression) => {
    expect(parseTagsExpression(expression)).toBeNull();
  });
});

describe('readMdxTags', () => {
  it('reports no tags when the Meta block has none', () => {
    const result = readMdxTags(page('<Meta title="Ex/Intro" />'));

    expect(result).toMatchObject({ ok: true, tags: [] });
  });

  it('reads the tags and the attached identifier', () => {
    const source = `import { Meta } from '@storybook/addon-docs/blocks';
import * as ButtonStories from './Button.stories';

<Meta of={ButtonStories} tags={['a', "b"]} />
`;

    expect(readMdxTags(source)).toMatchObject({
      ok: true,
      tags: ['a', 'b'],
      ofIdentifier: 'ButtonStories',
    });
  });

  it('refuses a file without a Meta block', () => {
    expect(readMdxTags('# Just markdown\n')).toMatchObject({
      ok: false,
      reason: expect.stringContaining('No <Meta> block'),
    });
  });

  it('refuses tags it cannot evaluate', () => {
    expect(readMdxTags(page('<Meta title="T" tags={someVariable} />'))).toMatchObject({
      ok: false,
      reason: expect.stringContaining('cannot be statically analyzed'),
    });
  });

  it('refuses a tags attribute that is not an expression', () => {
    expect(readMdxTags(page('<Meta title="T" tags="a" />'))).toMatchObject({
      ok: false,
      reason: expect.stringContaining('not an array of tags'),
    });
  });
});

describe('writeMdxTags', () => {
  it('adds a tags attribute to a Meta block that has none', () => {
    const source = page('<Meta title="Ex/Intro" />');

    expect(write(source, ['a'])).toContain(`<Meta title="Ex/Intro" tags={['a']} />`);
  });

  it('replaces the existing tags in place', () => {
    const source = page(`<Meta title="T" tags={['old']} />`);

    expect(write(source, ['new', '!other'])).toContain(`<Meta title="T" tags={['new', '!other']} />`);
  });

  it('removes the attribute and its leading space when no tags remain', () => {
    const source = page(`<Meta title="T" tags={['old']} />`);

    expect(write(source, [])).toContain('<Meta title="T" />');
  });

  it('leaves a Meta block with no tags alone when given no tags', () => {
    const source = page('<Meta title="T" />');

    expect(write(source, [])).toBe(source);
  });

  it('keeps every other byte of the file, including MDX expressions', () => {
    const source = page(
      `<Meta title="T" tags={['old']} />`,
      `\n# Title\n\nBraces: <code>{'{'}x{'}'}</code>\n\n- item\n`,
    );
    const result = write(source, ['new']);

    const before = source.split('\n');
    const after = result.split('\n');
    const changed = before.map((line, i) => (line === after[i] ? null : i)).filter((i) => i !== null);

    expect(changed).toHaveLength(1);
    expect(after[changed[0] as number]).toContain(`tags={['new']}`);
  });

  it('preserves the layout of a multiline Meta block', () => {
    const source = page(`<Meta\n  title="T"\n  tags={['old']}\n/>`);
    const result = write(source, ['new']);

    expect(result).toContain(`<Meta\n  title="T"\n  tags={['new']}\n/>`);
  });

  it('round-trips through read', () => {
    const source = page('<Meta title="T" />');
    const written = write(source, ['a', '!b']);

    expect(readMdxTags(written)).toMatchObject({ ok: true, tags: ['a', '!b'] });
  });

  it('refuses a file without a Meta block', () => {
    expect(writeMdxTags('# Nothing here\n', ['a'])).toMatchObject({ ok: false });
  });
});

describe('findOfImportPath', () => {
  it.each([
    [`import * as Stories from './Button.stories';`, 'Stories', './Button.stories'],
    [`import Stories from "../Button.stories";`, 'Stories', '../Button.stories'],
    [`import { Primary as Stories } from './x';`, 'Stories', './x'],
  ])('resolves %s', (statement, identifier, expected) => {
    expect(findOfImportPath([statement], identifier)).toBe(expected);
  });

  it('returns nothing when the identifier is not imported', () => {
    expect(findOfImportPath([`import * as Other from './x';`], 'Stories')).toBeUndefined();
  });
});
