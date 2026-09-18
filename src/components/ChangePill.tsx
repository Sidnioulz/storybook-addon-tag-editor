import React from 'react';

import { styled } from 'storybook/theming';

const Glyph = styled.svg(({ theme }) => ({
  width: 14,
  height: 14,
  flexShrink: 0,
  color: theme.fgColor.accent,
}));

/**
 * The sidebar's change-detection marks: a plus for a newly declared tag, a dot for a changed one.
 */
export const ChangePill = ({ change }: { change: 'added' | 'modified' }) => (
  <Glyph viewBox="0 0 14 14" role="img" aria-label={change === 'added' ? 'Added' : 'Modified'}>
    <title>{change === 'added' ? 'Added' : 'Modified'}</title>
    {change === 'added' ? (
      <>
        <rect x="6" y="3.5" width="2" height="7" rx="1" fill="currentColor" />
        <rect x="3.5" y="6" width="7" height="2" rx="1" fill="currentColor" />
      </>
    ) : (
      <circle cx="7" cy="7" r="3" fill="currentColor" />
    )}
  </Glyph>
);
