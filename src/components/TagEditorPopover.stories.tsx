import React, { useRef } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import type { API_HashEntry } from 'storybook/internal/types';

import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { ThemeProvider, ensure, themes } from 'storybook/theming';

import { combineTags, DEFAULT_TAGS } from '../tag-model';
import type { TagDataResponse, TagEditorIO, TagLayer } from '../types';
import { TagEditorPopover } from './TagEditorPopover';

const PROJECT_TAGS = ['autodocs', 'design-reviewed'];
const LOCAL_TAGS = ['!autodocs', 'stable'];

const DEFAULT_LAYERS: TagLayer[] = [
  { source: 'defaults', tags: DEFAULT_TAGS },
  { source: 'preview', tags: PROJECT_TAGS },
];

const entryFor = (localTags: string[], layers: TagLayer[]) =>
  ({
    type: 'component',
    id: 'example-button',
    name: 'Button',
    depth: 1,
    parent: 'example',
    children: ['example-button--primary'],
    importPath: './src/stories/Button.stories.ts',
    tags: combineTags(...layers.flatMap((layer) => layer.tags), ...localTags),
  }) as unknown as API_HashEntry;

const response = (overrides: Partial<TagDataResponse> = {}): TagDataResponse => ({
  requestId: 'story',
  editable: true,
  localTags: LOCAL_TAGS,
  inheritedLayers: DEFAULT_LAYERS,
  ...overrides,
});

const io = (overrides: Partial<TagEditorIO> = {}): TagEditorIO => ({
  loadTagData: async () => response(),
  saveTags: async () => ({ requestId: 'story', ok: true }),
  loadKnownTags: async () => [...PROJECT_TAGS, ...DEFAULT_TAGS, 'experimental', 'stable'],
  ...overrides,
});

interface DemoProps {
  io: TagEditorIO;
  entry?: API_HashEntry;
  onClose: () => void;
}

const Demo = ({ io: demoIO, entry, onClose }: DemoProps) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <ThemeProvider theme={ensure(themes.light)}>
      <button ref={triggerRef} type="button" style={{ margin: 16 }}>
        Anchor
      </button>
      <TagEditorPopover
        entry={entry ?? entryFor(LOCAL_TAGS, DEFAULT_LAYERS)}
        triggerRef={triggerRef}
        io={demoIO}
        onClose={onClose}
      />
    </ThemeProvider>
  );
};

const meta: Meta<typeof Demo> = {
  title: 'Addon/Tag Editor',
  component: Demo,
  // The popover is fixed-positioned; a docs page would stack several copies.
  tags: ['!autodocs'],
  parameters: { layout: 'fullscreen' },
  args: { onClose: fn(), io: io() },
};

export default meta;
type Story = StoryObj<typeof Demo>;

export const Default: Story = {};

/**
 * One tag, inherited from a component and optionally redeclared on the entry, so each combination
 * of inherited and local value can be read off a single row.
 */
const inheritance = (inherited: 'foo' | '!foo', local: 'foo' | '!foo' | null): Story => {
  const layers: TagLayer[] = [
    { source: 'defaults', tags: DEFAULT_TAGS },
    { source: 'component', tags: [inherited] },
  ];
  const localTags = local ? [local] : [];
  return {
    args: {
      entry: entryFor(localTags, layers),
      io: io({
        loadTagData: async () => response({ localTags, inheritedLayers: layers }),
        loadKnownTags: async () => ['foo'],
      }),
    },
  };
};

/** Mixed checkbox, reads `foo`: the component supplies it. */
export const InheritedIncluded: Story = inheritance('foo', null);

/** Checked, reads `foo`: inherited and redeclared here, so inheritance no longer decides. */
export const InheritedIncludedRedeclared: Story = inheritance('foo', 'foo');

/** Checked, reads `!foo`: the entry excludes what the component includes. */
export const InheritedIncludedOverridden: Story = inheritance('foo', '!foo');

/** Mixed checkbox, reads `!foo`: the component excludes it. */
export const InheritedExcluded: Story = inheritance('!foo', null);

/** Checked, reads `!foo`: inherited exclusion, redeclared here. */
export const InheritedExcludedRedeclared: Story = inheritance('!foo', '!foo');

/** Checked, reads `foo`: the entry includes what the component excludes. */
export const InheritedExcludedOverridden: Story = inheritance('!foo', 'foo');

export const InheritedStatesAreMixed: Story = {
  ...inheritance('foo', null),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = await canvas.findByRole('checkbox', { name: /Declare foo/ });
    // `indeterminate` is a DOM property rather than an attribute, so wait for it to settle.
    await waitFor(() => expect(checkbox).toBePartiallyChecked());

    // Declaring it locally makes the row determinate.
    await userEvent.click(checkbox);
    await expect(await canvas.findByRole('checkbox', { name: /Stop declaring foo/ })).toBeChecked();
  },
};

export const ExcludingAnInheritedTag: Story = {
  ...inheritance('foo', null),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Add !foo tag' }));

    // The row now reads !foo, declared on the entry.
    await expect(await canvas.findByRole('checkbox', { name: /Stop declaring !foo/ })).toBeChecked();
    // It offers to put foo back. The button only becomes visible on hover, which a synthetic
    // pointer cannot trigger, so assert that it is there rather than that it is shown.
    await expect(canvas.getByRole('button', { name: 'Replace with foo tag' })).toBeInTheDocument();
  },
};

export const UnsavedChanges: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('checkbox', { name: /Declare experimental/ }));
    await expect(await canvas.findByText('1 unsaved change')).toBeInTheDocument();
  },
};

export const ReservedTagSearched: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(await canvas.findByPlaceholderText('Filter or add tags…'), 'play-fn');
    await expect(await canvas.findByText('This tag name is reserved and cannot be edited.')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  args: { io: io({ loadTagData: () => new Promise<TagDataResponse>(() => {}) }) },
};

export const LoadError: Story = {
  args: {
    io: io({
      loadTagData: async () => {
        throw new Error('No response from the Storybook server');
      },
    }),
  },
};

export const MdxWithoutMeta: Story = {
  args: {
    io: io({
      loadTagData: async () =>
        response({
          editable: false,
          localTags: [],
          reason: 'No <Meta> block found in this MDX file.',
        }),
    }),
  },
};

export const NotAnalyzable: Story = {
  args: {
    io: io({
      loadTagData: async () =>
        response({
          editable: false,
          localTags: [],
          reason: 'Tags of this file cannot be statically analyzed.',
        }),
    }),
  },
};

export const SaveError: Story = {
  args: {
    io: io({
      saveTags: async () => ({
        requestId: 'story',
        ok: false,
        error: 'EACCES: permission denied, open Button.stories.ts',
      }),
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('checkbox', { name: /Declare experimental/ }));
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(await canvas.findByText(/permission denied/)).toBeInTheDocument();
  },
};

export const SaveTimeout: Story = {
  args: {
    io: io({
      saveTags: async () => {
        throw new Error('No response from the Storybook server');
      },
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('checkbox', { name: /Declare experimental/ }));
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(await canvas.findByText(/No response/)).toBeInTheDocument();
  },
};

export const SavingClosesTheDialog: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('checkbox', { name: /Declare experimental/ }));
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(args.onClose).toHaveBeenCalled();
  },
};

export const AddingANewTag: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(await canvas.findByPlaceholderText('Filter or add tags…'), 'brand-new');
    await userEvent.click(await canvas.findByRole('button', { name: /Add brand-new tag/ }));

    await expect(await canvas.findByRole('checkbox', { name: /Stop declaring brand-new/ })).toBeChecked();
  },
};

export const ResettingChanges: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('checkbox', { name: /Declare experimental/ }));
    await expect(await canvas.findByText('1 unsaved change')).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));

    await expect(canvas.queryByText(/unsaved change/)).not.toBeInTheDocument();
    await expect(await canvas.findByRole('checkbox', { name: /Declare experimental/ })).not.toBeChecked();
  },
};

/** Removing a tag leaves an empty box in place rather than greying the row out. */
export const RemovingADeclaredTag: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = await canvas.findByRole('checkbox', { name: /Stop declaring stable/ });
    await userEvent.click(checkbox);

    const after = await canvas.findByRole('checkbox', { name: /Declare stable/ });
    await expect(after).not.toBeChecked();
    await expect(after).toBeEnabled();
    await expect(await canvas.findByText('1 unsaved change')).toBeInTheDocument();
  },
};

export const ClosingWithEscape: Story = {
  play: async ({ args }) => {
    await userEvent.keyboard('{Escape}');

    await expect(args.onClose).toHaveBeenCalled();
  },
};

export const DisabledRowsExplainWhy: Story = {
  ...MdxWithoutMeta,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = await canvas.findByRole('checkbox', { name: /Declare dev/ });

    await expect(checkbox).toBeDisabled();
    await expect(checkbox.closest('label')).toHaveAttribute('aria-disabled', 'true');
  },
};
