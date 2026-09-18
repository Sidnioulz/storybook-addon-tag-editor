import type { Meta, StoryObj } from '@storybook/react-vite';
import { Header } from './Header';

const meta: Meta<typeof Header> = {
  title: 'Example/Header',
  component: Header,
  tags: ["blabla"],
  parameters: {
    // More on Story layout: https://storybook.js.org/docs/react/configure/story-layout
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof Header>;

export const LoggedIn: Story = {
  args: {
    user: {
      name: 'Jane Doe',
    },
  },

  tags: [
    "!test",
    "!manifest",
    "!autodocs",
    "!blabla",
    "design-reviewed",
    "!dev",
    "!experimental"
  ],
};

export const LoggedOut: Story = {};
