<div align="center">
  <h1>Storybook Addon - Tag Editor</h1>

  <p>
    This addon lets you edit <a href="https://storybook.js.org/docs/writing-stories/tags">tags</a> for a story, component or docs page from the Storybook <a href="https://storybook.js.org/docs/configure/user-interface/sidebar-and-urls">sidebar</a>. Open the context menu of a sidebar entry and pick <strong>Edit tags</strong>. A popover lets you add, remove or invert tags, and the addon writes your changes back to the source file.
  </p>

  <p>
    <img src="https://img.shields.io/badge/status-experimental-orange" alt="Status: Experimental" />
    <a href="https://github.com/Sidnioulz/storybook-addon-tag-editor/commits"><img src="https://img.shields.io/github/commit-activity/m/Sidnioulz/storybook-addon-tag-editor" alt="commit activity" /></a>
    <a href="https://github.com/Sidnioulz/storybook-addon-tag-editor/commits"><img src="https://img.shields.io/github/last-commit/Sidnioulz/storybook-addon-tag-editor" alt="last commit" /></a>
    <a href="https://github.com/Sidnioulz/storybook-addon-tag-editor/issues/"><img src="https://img.shields.io/github/issues/Sidnioulz/storybook-addon-tag-editor" alt="open issues" /></a>
    <a href="https://github.com/Sidnioulz/storybook-addon-tag-editor/actions/workflows/codeql.yml"><img src="https://github.com/Sidnioulz/storybook-addon-tag-editor/actions/workflows/codeql.yml/badge.svg?branch=main" alt="CodeQL status" /></a>
    <a href="https://github.com/Sidnioulz/storybook-addon-tag-editor/actions/workflows/build.yml"><img src="https://github.com/Sidnioulz/storybook-addon-tag-editor/actions/workflows/build.yml/badge.svg?branch=main" alt="build status" /></a>
    <a href="https://codecov.io/gh/Sidnioulz/storybook-addon-tag-editor"><img src="https://codecov.io/gh/Sidnioulz/storybook-addon-tag-editor/graph/badge.svg" alt="code coverage" /></a>
    <a href="https://github.com/Sidnioulz/storybook-addon-tag-editor/graphs/contributors"><img src="https://img.shields.io/github/contributors/Sidnioulz/storybook-addon-tag-editor" alt="contributors" /></a>
    <a href="https://github.com/Sidnioulz/storybook-addon-tag-editor/blob/main/CODE_OF_CONDUCT.md"><img src="https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg" alt="code of conduct: contributor covenant 2.1" /></a>
    <a href="https://github.com/Sidnioulz/storybook-addon-tag-editor/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Sidnioulz/storybook-addon-tag-editor.svg" alt="license" /></a>
    <a href="https://github.com/Sidnioulz/storybook-addon-tag-editor/network/members"><img src="https://img.shields.io/github/forks/Sidnioulz/storybook-addon-tag-editor" alt="forks" /></a>
    <a href="https://github.com/Sidnioulz/storybook-addon-tag-editor/stargazers"><img src="https://img.shields.io/github/stars/Sidnioulz/storybook-addon-tag-editor" alt="stars" /></a>
    <a href="https://github.com/sponsors/Sidnioulz"><img src="https://img.shields.io/badge/sponsor-30363D?logo=GitHub-Sponsors&logoColor=#EA4AAA" alt="sponsor this project" /></a>
  </p>
</div>

---

## 📔 Table of Contents

<!-- no toc -->

- [Table of Contents](#-table-of-contents)
- [Installation](#-installation)
- [Usage](#-usage)
- [Where Tags Come From](#-where-tags-come-from)
- [Limitations](#-limitations)
- [Contributing](#-contributing)
- [Support](#-support)
- [Contact](#-contact)
- [Acknowledgments](#-acknowledgments)

## 📦 Installation

This addon needs Storybook 11 and Node 22.12 or later.

> [!IMPORTANT]
> It also uses the sidebar context menu API from [storybook#36316](https://github.com/storybookjs/storybook/pull/36316), which is not released yet. Until it ships, you need a canary build of Storybook.

<!-- prettier-ignore -->
```jsonc
// package.json
{
  "devDependencies": {
    "storybook": "https://pkg.pr.new/storybook@aa7e796",
    "@storybook/react-vite": "https://pkg.pr.new/@storybook/react-vite@aa7e796"
  }
}
```

```sh
pnpm add -D storybook-addon-tag-editor
```

```sh
npm install -D storybook-addon-tag-editor
```

```sh
yarn add -D storybook-addon-tag-editor
```

Register the addon in `.storybook/main.ts`:

```ts
// .storybook/main.ts
import { defineMain } from '@storybook/react-vite/node';

export default defineMain({
  addons: ['storybook-addon-tag-editor'],
});
```

And in `.storybook/preview.ts`, alongside your other addons:

```ts
// .storybook/preview.ts
import { definePreview } from '@storybook/react-vite';
import tagEditor from 'storybook-addon-tag-editor';

export default definePreview({
  addons: [tagEditor()],
});
```

## 👀 Usage

Hover an entry in the sidebar, open its context menu, and pick **Edit tags**.

Autodocs pages do not offer the entry. Storybook generates them from their component, so edit the component instead.

### Reading a Row

Each row names the tag as it would be written in your file: `foo`, or `!foo` for an exclusion. The checkbox says where that entry comes from.

| Checkbox          | Meaning                                                                      |
| ----------------- | ---------------------------------------------------------------------------- |
| Checked           | The entry declares the tag itself.                                           |
| Mixed             | A parent layer supplies the tag. An icon on the right names the source.      |
| Empty             | The tag does not apply. It is listed because the project uses it elsewhere.  |
| Checked, disabled | The tag applies, but you cannot edit it here. The row says why in a tooltip. |

### Editing Tags

- The checkbox declares the tag on the entry, or stops declaring it.
- The **Exclude** and **Include** buttons write the opposite entry. On an inherited tag, clicking again drops the entry and returns the row to inheriting.
- The text field filters the list. Type a name and press Enter to add a tag. Start with `!` to add an exclusion.
- **Save** writes the tags to your source file and closes the popover.

Changes stay in the popover until you save. The editor marks them with the same glyphs the sidebar uses for new and modified entries, and counts them in the save bar. While changes are pending, clicking outside nudges the save button instead of closing the popover. Press `Escape` to leave without saving.

## 🧬 Where Tags Come From

Storybook resolves tags in layers. A tag declared on an entry overrides the layers above it, and `!tag` removes one.

| Source               | Where it comes from                                                            |
| -------------------- | ------------------------------------------------------------------------------ |
| `Storybook defaults` | The tags Storybook applies to everything: `dev`, `test`, `manifest`.           |
| `preview`            | The `tags` array in `.storybook/preview.ts`.                                   |
| `component`          | The CSF `meta` of a story, or the component an MDX page attaches to with `of`. |

The editor treats Storybook's own tags by whether negating them means anything. It hides tags the indexer derives from file contents, such as `play-fn` and `attached-mdx`, because you cannot change them by editing tags. It keeps `dev`, `test` and `manifest` editable, so you can negate them, but an entry can never simply stop mentioning them.

## 🐌 Limitations

### Dev Mode Only

Storybook renders the sidebar context menu in development only, so the addon does nothing in a built Storybook.

### Static Tags Only

The addon reads and writes tags with [`csf-tools`](https://github.com/storybookjs/storybook/tree/next/code/core/src/csf-tools) for CSF files and [remark](https://remark.js.org/) for MDX. Both need a literal array of strings. A file that computes its tags is read-only, and the editor says so.

An MDX page needs a `<Meta>` block. The addon creates the `tags` attribute if the block has none.

### Formatting

Saved CSF tag arrays print with double quotes. Run your formatter afterwards if it prefers otherwise. MDX edits only touch the `tags` attribute, so the rest of the page keeps its formatting.

## 👩🏽‍💻 Contributing

### Code of Conduct

Please read the [Code of Conduct](https://github.com/Sidnioulz/storybook-addon-tag-editor/blob/main/CODE_OF_CONDUCT.md) first.

### Developer Certificate of Origin

To ensure that contributors are legally allowed to share the content they contribute under the license terms of this project, contributors must adhere to the [Developer Certificate of Origin](https://developercertificate.org/) (DCO). All contributions made must be signed to satisfy the DCO. This is handled by a Pull Request check.

> By signing your commits, you attest to the following:
>
> 1. The contribution was created in whole or in part by you and you have the right to submit it under the open source license indicated in the file; or
> 2. The contribution is based upon previous work that, to the best of your knowledge, is covered under an appropriate open source license and you have the right under that license to submit that work with modifications, whether created in whole or in part by you, under the same open source license (unless you are permitted to submit under a different license), as indicated in the file; or
> 3. The contribution was provided directly to you by some other person who certified 1., 2. or 3. and you have not modified it.
> 4. You understand and agree that this project and the contribution are public and that a record of the contribution (including all personal information you submit with it, including your sign-off) is maintained indefinitely and may be redistributed consistent with this project or the open source license(s) involved.

### Getting Started

This project uses PNPM as a package manager, and needs Node 22.12 or later.

- See the [installation instructions for PNPM](https://pnpm.io/installation)
- Run `pnpm i`

### Useful commands

- `pnpm start` builds the addon in watch mode and starts the local Storybook
- `pnpm build` builds and packages the addon code
- `pnpm test` runs the test suite, `pnpm test:coverage` adds a coverage report
- `pnpm check` type-checks the source
- `pnpm lint` runs ESLint and Prettier

### Tests

Unit tests cover the tag model, the MDX reader and writer, the channel, the context menu rules and
the preset, which runs against real files in a temporary directory.

The stories double as component tests. `src/__tests__/TagEditorPopover.stories.test.tsx` composes
every story with [portable stories](https://storybook.js.org/docs/api/portable-stories/portable-stories-vitest)
and runs its play function under Vitest, so a scenario you can open in Storybook is also a test.
Add a story rather than a bespoke render when you cover new behaviour.

### Local Storybook

The demo stories are written as CSF factories, and cover each layer: project tags in
`.storybook/preview.ts`, tags on a component, tags on a story, negations, and two MDX pages.
`ButtonNotes.mdx` attaches to the Button component, so its rows show the component's tags as
inherited.

The `Addon/Tag Editor` stories render the popover against mocked data. They cover every combination of inherited and declared value for one tag, along with the loading, failure and read-only states.

### Migrating to a later Storybook version

If you want to migrate the addon to support the latest version of Storybook, you can check out the [addon migration guide](https://storybook.js.org/docs/addons/addon-migration-guide).

Dependabot skips `storybook` and `@storybook/*`, because both are pinned to a canary build. Bump them by hand when the context menu API lands in a release.

### Release System

This package auto-releases on pushes to `main` with [semantic-release](https://github.com/semantic-release/semantic-release). No changelog is maintained and the version number in `package.json` is not synchronised.

## 🆘 Support

Please [open an issue](https://github.com/Sidnioulz/storybook-addon-tag-editor/issues/new) for bug reports or code suggestions. Make sure to include a working Minimal Working Example for bug reports.

## ✉️ Contact

Steve Dodier-Lazaro · `@Frog` on the [Storybook Discord](https://discord.gg/storybook) - [LinkedIn](https://www.linkedin.com/in/stevedodierlazaro/)

Project Link: [https://github.com/Sidnioulz/storybook-addon-tag-editor](https://github.com/Sidnioulz/storybook-addon-tag-editor)

## 💛 Acknowledgments

### Thanks

- [Michael Shilman](https://github.com/shilman) for his help with addon internals
- All the contributors to the [Storybook addon kit](https://github.com/storybookjs/addon-kit)

### Built With

[![Dependabot](https://img.shields.io/badge/Dependabot-025E8C?logo=dependabot&logoColor=white)](https://github.com/dependabot)
[![ESLint](https://img.shields.io/badge/ESLint-4b32c3?logo=eslint&logoColor=white)](https://eslint.org/)
[![GitHub](https://img.shields.io/badge/GitHub-0d1117?logo=github&logoColor=white)](https://github.com/solutions/ci-cd)
[![Prettier](https://img.shields.io/badge/Prettier-f8bc45?logo=prettier&logoColor=black)](https://prettier.io/)
[![remark](https://img.shields.io/badge/remark-000000?logo=remark&logoColor=white)](https://remark.js.org/)
[![Semantic-Release](https://img.shields.io/badge/semantic--release-cccccc?logo=semantic-release&logoColor=black)](https://github.com/semantic-release/semantic-release)
[![Storybook](https://cdn.jsdelivr.net/gh/storybookjs/brand@main/badge/badge-storybook.svg)](https://storybook.js.org/)
[![tsup](https://img.shields.io/badge/tsup-fde047)](https://tsup.egoist.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Vitest-acd268?logo=vitest&logoColor=black)](https://vitest.dev/)
