import React from 'react';

import { styled } from 'storybook/theming';

const Glyph = styled.svg(({ theme }) => ({
  width: 14,
  height: 14,
  flexShrink: 0,
  color: theme.fgColor.accent,
}));

/**
 * The sidebar's change-detection mark. Every pending edit rewrites the entry's tags, so they all
 * read as a modification rather than distinguishing additions.
 */
export const ChangePill = () => (
  <Glyph viewBox="0 0 14 14" role="img" aria-label="Modified">
    <title>Modified</title>
    <circle cx="7" cy="7" r="3" fill="currentColor" />
  </Glyph>
);
