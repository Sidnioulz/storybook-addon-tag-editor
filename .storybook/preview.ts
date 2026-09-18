import type { Preview } from '@storybook/react-vite';

const preview: Preview = {
  // Project-level tags, shown as 'project' provenance in the tag editor.
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
};

export default preview;
