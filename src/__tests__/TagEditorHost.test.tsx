import { waitFor } from '@testing-library/react';
import type { API_HashEntry } from 'storybook/internal/types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ADDON_ID } from '../constants';

vi.mock('storybook/manager-api', () => ({
  addons: { getConfig: () => ({}) },
}));

vi.mock('../channel', () => ({
  channelIO: {
    loadTagData: async () => ({
      requestId: '1',
      editable: true,
      localTags: ['local'],
      inheritedLayers: [{ source: 'preview', tags: ['inherited'] }],
    }),
    saveTags: async () => ({ requestId: '1', ok: true }),
    loadKnownTags: async () => [],
  },
}));

const { openTagEditor } = await import('../components/TagEditorHost');

const entry = {
  type: 'component',
  id: 'example-button',
  name: 'Button',
  importPath: './Button.stories.ts',
  tags: [],
} as unknown as API_HashEntry;

const root = () => document.getElementById(`${ADDON_ID}-root`);

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  root()?.remove();
});

describe('openTagEditor', () => {
  it('mounts the popover into its own root on the page', async () => {
    openTagEditor({ entry, triggerRef: { current: null } });
    await flush();

    expect(root()).toBeTruthy();
    expect(root()?.querySelector('[role="dialog"]')).toBeTruthy();

    // The rows arrive once the channel answers.
    await waitFor(() => expect(root()?.textContent).toContain('local'));
    expect(root()?.textContent).toContain('inherited');
  });

  it('reuses the same root when opened again', async () => {
    openTagEditor({ entry, triggerRef: { current: null } });
    await flush();
    const first = root();

    openTagEditor({ entry, triggerRef: { current: null } });
    await flush();

    expect(root()).toBe(first);
    expect(document.querySelectorAll(`#${ADDON_ID}-root`)).toHaveLength(1);
  });

  it('anchors the popover to the trigger when there is one', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      right: 40,
      bottom: 120,
      left: 20,
      width: 20,
      height: 20,
      x: 20,
      y: 100,
      toJSON: () => ({}),
    });

    openTagEditor({ entry, triggerRef: { current: trigger } });
    await flush();

    const positioner = root()?.firstElementChild as HTMLElement;
    expect(positioner.style.top).toBe('100px');
    expect(positioner.style.left).toBe('48px');

    trigger.remove();
  });
});
