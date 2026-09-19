import type { RefObject } from 'react';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';

import type { API_HashEntry } from 'storybook/internal/types';

import { addons } from 'storybook/manager-api';
import { ThemeProvider, ensure, themes } from 'storybook/theming';

import { channelIO } from '../channel';
import { ADDON_ID } from '../constants';
import { TagEditorPopover } from './TagEditorPopover';

export interface OpenTagEditorOptions {
  entry: API_HashEntry;
  triggerRef: RefObject<HTMLButtonElement | null>;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

const getTheme = () => {
  const configured = addons.getConfig()?.theme;
  if (configured) {
    return ensure(configured);
  }
  const prefersDark = globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return ensure(prefersDark ? themes.dark : themes.light);
};

/** Render the tag editor popover in a standalone root, anchored to the context menu trigger. */
export const openTagEditor = (options: OpenTagEditorOptions) => {
  if (!container) {
    container = document.createElement('div');
    container.id = `${ADDON_ID}-root`;
  }
  // Re-attach rather than trusting the cached node: anything that clears the body would otherwise
  // leave the editor rendering into a detached element.
  if (!container.isConnected) {
    document.body.appendChild(container);
    root?.unmount();
    root = null;
  }
  root ??= createRoot(container);
  const close = () => root?.render(<></>);
  root.render(
    <ThemeProvider theme={getTheme()}>
      <TagEditorPopover
        key={`${options.entry.id}-${Date.now()}`}
        entry={options.entry}
        triggerRef={options.triggerRef}
        io={channelIO}
        onClose={close}
      />
    </ThemeProvider>,
  );
};
