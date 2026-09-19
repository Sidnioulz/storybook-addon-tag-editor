import { fn } from 'storybook/test';

import preview from '../../.storybook/preview';
import { Button } from './Button';

const meta = preview.meta({
  title: 'Example/Button',
  component: Button,
  argTypes: {
    backgroundColor: { control: 'color' },
  },
  args: {
    onClick: fn(),
  },
  // '!autodocs' negates the project tag, so this component gets no generated docs page.
  tags: ['!autodocs', 'stable'],
});

export const Primary = meta.story({
  args: {
    primary: true,
    label: 'Button',
  },
});

export const Secondary = meta.story({
  args: {
    label: 'Button',
  },
});

export const Large = meta.story({
  args: {
    size: 'large',
    label: 'Button',
  },
});

export const Small = meta.story({
  args: {
    size: 'small',
    label: 'Button',
  },
});
