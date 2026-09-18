# Storybook Tag Editor

Edit [story tags](https://storybook.js.org/docs/writing-stories/tags) from the Storybook sidebar.

Adds an **Edit tags** entry to the context menu of component and docs entries. It opens a popover
that shows every tag affecting the entry — where each one comes from — and lets you add, remove and
negate tags. Changes are written back to the CSF file.

## Requirements

Built on the experimental sidebar context menu addon API from
[storybookjs/storybook#36316](https://github.com/storybookjs/storybook/pull/36316). Until that PR
ships in a stable release, a canary build of Storybook is required:

```jsonc
{
  "devDependencies": {
    "storybook": "https://pkg.pr.new/storybook@aa7e796",
    "@storybook/react-vite": "https://pkg.pr.new/@storybook/react-vite@aa7e796"
  }
}
```

Works in dev mode only; the sidebar context menu is not rendered in built Storybooks.

## Installation

```sh
pnpm add -D storybook-addon-tag-editor
```

```ts
// .storybook/main.ts
export default {
  addons: ['storybook-addon-tag-editor'],
};
```

## Usage

Hover a component, story or MDX docs entry in the sidebar, open its context menu (⋯) and pick
**Edit tags**. The one entry that does not offer it is the docs page Storybook synthesises for
autodocs: it is generated from its component, so its tags belong there.

Each row names the tag entry as it would be written: `foo`, or `!foo` where the tag is excluded.

The checkbox says where that entry comes from:

- **checked** — the entry declares the tag itself
- **mixed** — the tag is inherited; an icon on the right tells you from where (`preview`, the
  component a story or MDX page belongs to, or Storybook's `dev`/`test` defaults). Declaring it
  locally makes the row determinate and drops the icon, since inheritance no longer decides the
  value and the change mark now carries that meaning. Both marks share one column, so they line
  up down the list.
- **unchecked** — the tag is not applied; it is offered because the project uses it elsewhere, or
  because the entry has just stopped declaring it
- **checked and disabled** — it applies, but is attributable to nothing the editor can write, such
  as a tag every child story of a component declares

Rows keep the group they were in when the dialog opened, so editing one never makes it jump; they
settle into place the next time you open the editor. Anything disabled says why in a tooltip.

Storybook's own tags are treated by whether negating them means anything. Tags the indexer derives
from what a file contains (`play-fn`, `attached-mdx`, …) are left out entirely. Tags Storybook
applies itself (`dev`, `test`, `manifest`) stay editable and can be negated, but an entry can never
simply stop mentioning them: the row falls back to inheriting instead of disappearing.

Interactions:

- The checkbox declares the inherited value on the entry, or stops declaring it.
- The hover button (**Exclude** / **Include**) writes the opposite entry. On an inherited tag,
  clicking it again drops the local entry and returns the row to inheriting.
- The input filters tags; press Enter or click **Add tag** to create one. A leading `!` declares
  an exclusion.
- Changes are staged, marked with the sidebar's added and modified glyphs, and counted in the save
  bar. While there are unsaved changes the dialog is modal, so a stray click cannot discard them;
  clicking outside nudges the save button instead, unless reduced motion is preferred.
- **Save** rewrites the tags in the source file, then closes the dialog. CSF files go through
  `storybook/internal/csf-tools`; MDX files are parsed with remark and the `tags` attribute of
  `<Meta>` is spliced at the offsets remark reports, so the rest of the page is untouched.

## How it works

- `manager.tsx` registers an `experimental_CONTEXT_MENU` addon and renders the popover anchored to
  the menu trigger.
- `preset.ts` registers an `experimental_serverChannel` handler that reads and writes tag data:
  the entry's own tags, plus the inherited layers it resolves against. For an MDX page carrying
  `of={…}`, it follows that import to the stories file and adds its tags as a component layer.
- Inheritance is modelled as ordered layers, each with a source; later layers win. The popover
  reaches the server through a `TagEditorIO` interface, which the stories mock.
- Computed tags come from the story index; the popover fetches `index.json` to offer every tag
  already used in the project.

## Limitations

- Test entries and sidebar groups have no tags of their own and are not offered.
- Files whose tags are not a literal array of strings are read-only, in both CSF and MDX.
- An MDX page needs a `<Meta>` block; its `tags` attribute is created if absent.
- Saved CSF tag arrays are printed with double quotes; run your formatter if it prefers otherwise.
- The mixed checkbox state is applied to the DOM node by hand, because Storybook's `Form.Checkbox`
  styles `:indeterminate` but takes no such prop. A core change adding one is pending; once it
  ships, `TriStateCheckbox` can be dropped.

## Development

```sh
pnpm install
pnpm start   # builds the addon in watch mode and starts the demo Storybook
```

The `Addon/Tag Editor` stories render the popover with mocked data. They cover every combination of
inherited and locally declared value for one tag, the staged and reserved-name states, and the
loading, load-failure, save-failure and read-only cases.

The demo stories in `src/stories` exercise all tag layers: project tags (`autodocs`,
`design-reviewed`), tags declared on a component, negations, an unattached MDX page
(`Introduction.mdx`) and one attached to a component (`ButtonNotes.mdx`), whose rows show the
component's tags as inherited.
