import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { EVENTS } from '../constants';

type Handler = (payload: any) => void;

const createChannel = () => {
  const handlers = new Map<string, Handler>();
  return {
    on(event: string, handler: Handler) {
      handlers.set(event, handler);
    },
    emit: vi.fn(),
    /** Send a request in and wait for the preset's reply. */
    async request(requestEvent: string, responseEvent: string, payload: object) {
      this.emit.mockClear();
      await handlers.get(requestEvent)?.({ requestId: '1', ...payload });
      const reply = this.emit.mock.calls.find(([event]) => event === responseEvent);
      return reply?.[1];
    },
  };
};

let workspace: string;
let cwd: string;

beforeAll(() => {
  workspace = mkdtempSync(join(tmpdir(), 'tag-editor-'));
  cwd = process.cwd();
  // The preset resolves import paths against the working directory.
  process.chdir(workspace);
});

afterAll(() => {
  process.chdir(cwd);
  rmSync(workspace, { recursive: true, force: true });
});

const { experimental_serverChannel } = await import('../preset');

const options = { configDir: join('.storybook') } as any;

let channel: ReturnType<typeof createChannel>;

beforeEach(async () => {
  channel = createChannel();
  await experimental_serverChannel(channel as any, options);
});

const writeFixture = (name: string, contents: string) => {
  writeFileSync(join(workspace, name), contents);
  return `./${name}`;
};

const read = (importPath: string) => channel.request(EVENTS.TAG_DATA_REQUEST, EVENTS.TAG_DATA_RESPONSE, { importPath });

const save = (importPath: string, localTags: string[], exportName?: string) =>
  channel.request(EVENTS.SAVE_TAGS_REQUEST, EVENTS.SAVE_TAGS_RESPONSE, {
    importPath,
    localTags,
    exportName,
  });

const CSF = `import { Button } from './Button';

const meta = { component: Button, tags: ['stable'] };
export default meta;

export const Primary = { tags: ['focused'] };
export const Plain = {};
`;

describe('reading tags', () => {
  it('reads the meta tags of a CSF file, with the default layers', async () => {
    const importPath = writeFixture('Read.stories.ts', CSF);

    const response = await read(importPath);

    expect(response).toMatchObject({ editable: true, localTags: ['stable'] });
    expect(response.inheritedLayers.map((layer: any) => layer.source)).toEqual(['defaults', 'preview']);
  });

  it('reads a story and offers the meta as a component layer', async () => {
    const importPath = writeFixture('Story.stories.ts', CSF);

    const response = await channel.request(EVENTS.TAG_DATA_REQUEST, EVENTS.TAG_DATA_RESPONSE, {
      importPath,
      exportName: 'Primary',
    });

    expect(response).toMatchObject({ editable: true, localTags: ['focused'] });
    expect(response.inheritedLayers.at(-1)).toEqual({ source: 'component', tags: ['stable'] });
  });

  it('refuses an export it cannot find', async () => {
    const importPath = writeFixture('Missing.stories.ts', CSF);

    await expect(
      channel.request(EVENTS.TAG_DATA_REQUEST, EVENTS.TAG_DATA_RESPONSE, {
        importPath,
        exportName: 'Nope',
      }),
    ).resolves.toMatchObject({ editable: false, reason: expect.stringContaining('Nope') });
  });

  it('refuses files it cannot edit', async () => {
    await expect(read('./styles.css')).resolves.toMatchObject({
      editable: false,
      reason: expect.stringContaining('CSF and MDX'),
    });
  });

  it('refuses paths outside the project', async () => {
    await expect(read(relative(workspace, '/etc/passwd.stories.ts'))).resolves.toMatchObject({
      editable: false,
      reason: expect.stringContaining('outside the project'),
    });
  });

  it('refuses tags it cannot evaluate', async () => {
    const importPath = writeFixture(
      'Dynamic.stories.ts',
      `const meta = { tags: someVariable };\nexport default meta;\n`,
    );

    // csf-tools rejects the file while parsing, so the reason comes from there.
    await expect(read(importPath)).resolves.toMatchObject({
      editable: false,
      reason: expect.stringContaining('tags'),
    });
  });

  it('reads an MDX page', async () => {
    const importPath = writeFixture(
      'Page.mdx',
      `import { Meta } from '@storybook/addon-docs/blocks';\n\n<Meta title="T" tags={['note']} />\n`,
    );

    await expect(read(importPath)).resolves.toMatchObject({
      editable: true,
      localTags: ['note'],
    });
  });

  it('adds the tags of the stories an MDX page attaches to', async () => {
    writeFixture('Attached.stories.ts', CSF);
    const importPath = writeFixture(
      'Attached.mdx',
      `import { Meta } from '@storybook/addon-docs/blocks';
import * as Stories from './Attached.stories';

<Meta of={Stories} tags={['note']} />
`,
    );

    const response = await read(importPath);

    expect(response).toMatchObject({ editable: true, localTags: ['note'] });
    expect(response.inheritedLayers.at(-1)).toEqual({ source: 'component', tags: ['stable'] });
  });

  it('skips the component layer when the attached stories cannot be found', async () => {
    const importPath = writeFixture(
      'Dangling.mdx',
      `import { Meta } from '@storybook/addon-docs/blocks';
import * as Stories from './DoesNotExist.stories';

<Meta of={Stories} />
`,
    );

    const response = await read(importPath);

    expect(response.editable).toBe(true);
    expect(response.inheritedLayers.map((layer: any) => layer.source)).toEqual(['defaults', 'preview']);
  });

  it('reads project tags from the preview config', async () => {
    mkdirSync(join(workspace, '.storybook'), { recursive: true });
    writeFileSync(join(workspace, '.storybook', 'preview.ts'), `export default { tags: ['from-preview'] };\n`);
    const importPath = writeFixture('WithPreview.stories.ts', CSF);

    const response = await read(importPath);

    expect(response.inheritedLayers).toContainEqual({
      source: 'preview',
      tags: ['from-preview'],
    });

    rmSync(join(workspace, '.storybook'), { recursive: true, force: true });
  });
});

describe('saving tags', () => {
  it('writes meta tags back to the file', async () => {
    const importPath = writeFixture('Save.stories.ts', CSF);

    await expect(save(importPath, ['a', '!b'])).resolves.toMatchObject({ ok: true });
    expect(readFileSync(join(workspace, 'Save.stories.ts'), 'utf8')).toMatch(/tags: \["a", "!b"\]/);
  });

  it('writes story tags onto the story, leaving the meta alone', async () => {
    const importPath = writeFixture('SaveStory.stories.ts', CSF);

    await expect(save(importPath, ['sharp'], 'Primary')).resolves.toMatchObject({ ok: true });

    const contents = readFileSync(join(workspace, 'SaveStory.stories.ts'), 'utf8');
    expect(contents).toMatch(/tags: \['stable'\]/);
    expect(contents).toMatch(/export const Primary = \{ tags: \["sharp"\] \}/);
  });

  it('removes the property when no tags remain', async () => {
    const importPath = writeFixture('Clear.stories.ts', CSF);

    await expect(save(importPath, [])).resolves.toMatchObject({ ok: true });

    const contents = readFileSync(join(workspace, 'Clear.stories.ts'), 'utf8');
    expect(contents).not.toMatch(/tags: \['stable'\]/);
    // Only the meta loses its tags; the stories keep theirs.
    expect(contents).toMatch(/export const Primary = \{ tags: \['focused'\] \}/);
  });

  it('writes MDX tags without disturbing the prose', async () => {
    const importPath = writeFixture(
      'SavePage.mdx',
      `import { Meta } from '@storybook/addon-docs/blocks';\n\n<Meta title="T" />\n\n# Hello\n`,
    );

    await expect(save(importPath, ['note'])).resolves.toMatchObject({ ok: true });

    const contents = readFileSync(join(workspace, 'SavePage.mdx'), 'utf8');
    expect(contents).toContain(`<Meta title="T" tags={['note']} />`);
    expect(contents).toContain('# Hello');
  });

  it('rejects a tag list with invalid names', async () => {
    const importPath = writeFixture('Invalid.stories.ts', CSF);

    await expect(save(importPath, ['two words'])).resolves.toMatchObject({
      ok: false,
      error: 'Invalid tag list.',
    });
  });

  it('rejects files it cannot edit', async () => {
    await expect(save('./styles.css', ['a'])).resolves.toMatchObject({ ok: false });
  });
});
