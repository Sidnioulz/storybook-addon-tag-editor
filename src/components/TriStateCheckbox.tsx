import type { InputHTMLAttributes } from 'react';
import React, { useLayoutEffect, useRef } from 'react';

import { Form } from 'storybook/internal/components';

import { styled } from 'storybook/theming';

const Contents = styled.span({ display: 'contents' });

export interface TriStateCheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  indeterminate?: boolean;
}

/**
 * Form.Checkbox with the mixed state applied to the DOM node.
 *
 * Storybook's Checkbox styles `:indeterminate` but takes no such prop yet, and the property has no
 * HTML attribute for React to set. Drop this for `<Form.Checkbox indeterminate />` once the core
 * change ships.
 */
export const TriStateCheckbox = ({ indeterminate = false, ...props }: TriStateCheckboxProps) => {
  const wrapperRef = useRef<HTMLSpanElement | null>(null);

  // Laid out rather than deferred: the property lands in the same commit as the render that
  // implies it, so the box never paints in the wrong state and readers never observe a stale one.
  useLayoutEffect(() => {
    const input = wrapperRef.current?.querySelector('input');
    if (input) {
      input.indeterminate = indeterminate;
    }
  });

  return (
    <Contents ref={wrapperRef}>
      <Form.Checkbox {...props} />
    </Contents>
  );
};
