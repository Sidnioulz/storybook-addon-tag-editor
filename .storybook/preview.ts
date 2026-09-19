import addonDocs from '@storybook/addon-docs';
import { definePreview } from '@storybook/react-vite';

import tagEditor from '../src/index';

export default definePreview({
  // Registered the way a user would, but from source rather than the package name.
  addons: [tagEditor(), addonDocs()],
  // Project-level tags, shown as 'preview' provenance in the tag editor.
  // 'autodocs' generates a docs entry for every component unless negated.
  tags: ['autodocs', 'design-reviewed'],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },
});
