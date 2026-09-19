import type { API_HashEntry } from 'storybook/internal/types';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { CONTEXT_MENU_ID } from '../constants';

const openTagEditor = vi.fn();
vi.mock('../components/TagEditorHost', () => ({ openTagEditor }));

const added: Record<string, any> = {};
vi.mock('storybook/manager-api', () => ({
  types: { experimental_CONTEXT_MENU: 'context-menu' },
  addons: {
    register: (_id: string, callback: () => void) => callback(),
    add: (id: string, config: unknown) => {
      added[id] = config;
    },
  },
}));

beforeAll(async () => {
  await import('../manager');
});

const entry = (overrides: Partial<API_HashEntry>) => ({ id: 'x', name: 'X', ...overrides }) as API_HashEntry;

const itemsFor = (context: API_HashEntry) => added[CONTEXT_MENU_ID].items({ context });

describe('context menu entries', () => {
  it.each([
    ['component', entry({ type: 'component' })],
    ['story', entry({ type: 'story' })],
    ['attached MDX docs', entry({ type: 'docs', tags: ['attached-mdx'] })],
    ['unattached MDX docs', entry({ type: 'docs', tags: ['unattached-mdx'] })],
  ])('offers Edit tags on a %s entry', (_label, context) => {
    expect(itemsFor(context)).toMatchObject([{ id: 'edit-tags', title: 'Edit tags' }]);
  });

  it.each([
    ['autodocs page', entry({ type: 'docs', tags: ['autodocs'] })],
    ['docs entry with no tags', entry({ type: 'docs' })],
    ['group', entry({ type: 'group' })],
    ['root', entry({ type: 'root' })],
  ])('offers nothing on a %s', (_label, context) => {
    expect(itemsFor(context)).toEqual([]);
  });

  it('keeps the item on an MDX page that also carries autodocs', () => {
    const context = entry({ type: 'docs', tags: ['autodocs', 'attached-mdx'] });

    expect(itemsFor(context)).toHaveLength(1);
  });

  it('opens the editor anchored to the menu trigger', () => {
    const context = entry({ type: 'component' });
    const triggerRef = { current: null };

    itemsFor(context)[0].onClick({} as any, { triggerRef });

    expect(openTagEditor).toHaveBeenCalledWith({ entry: context, triggerRef });
  });
});
