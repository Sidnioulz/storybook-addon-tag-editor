import React from 'react';

import { composeStories } from '@storybook/react-vite';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import * as stories from '../components/TagEditorPopover.stories';

const composed = composeStories(stories);

/**
 * Runs every story, including its play function, so the popover's behaviour is covered by the same
 * scenarios the Storybook UI shows.
 */
describe.each(Object.entries(composed))('%s', (_name, Story) => {
  it('renders and passes its play function', async () => {
    const { container } = render(<Story />);
    await Story.play?.({ canvasElement: container });

    expect(container).toBeTruthy();
  });
});
