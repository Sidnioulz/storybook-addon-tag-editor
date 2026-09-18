import type { API_HashEntry } from 'storybook/internal/types';
import { addons, types } from 'storybook/manager-api';

import { openTagEditor } from './components/TagEditorHost';
import { ADDON_ID, CONTEXT_MENU_ID } from './constants';

/**
 * Everything backed by a file the addon can edit. The one exclusion is the docs entry Storybook
 * synthesises for autodocs: it is generated from its component, so its tags belong there. Docs
 * entries written as MDX keep their own tags and stay editable.
 */
const hasEditableTags = (context: API_HashEntry) => {
  if (context.type === 'docs') {
    return !!(context.tags?.includes('attached-mdx') || context.tags?.includes('unattached-mdx'));
  }
  return context.type === 'component' || context.type === 'story';
};

addons.register(ADDON_ID, () => {
  addons.add(CONTEXT_MENU_ID, {
    type: types.experimental_CONTEXT_MENU,
    items: ({ context }) =>
      hasEditableTags(context)
        ? [
            {
              id: 'edit-tags',
              title: 'Edit tags',
              onClick: (_event, { triggerRef }) => openTagEditor({ entry: context, triggerRef }),
            },
          ]
        : [],
  });
});
