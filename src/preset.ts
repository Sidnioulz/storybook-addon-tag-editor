import { readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import type { Channel } from 'storybook/internal/channels';
import { loadPreviewOrConfigFile } from 'storybook/internal/common';
import type { CsfObject } from 'storybook/internal/csf-tools';
import { readConfig, readCsf, writeCsf } from 'storybook/internal/csf-tools';
import type { Options } from 'storybook/internal/types';

import { EVENTS } from './constants';
import { findOfImportPath, readMdxTags, writeMdxTags } from './mdx-tags';
import { DEFAULT_TAGS } from './tag-model';
import type { SaveTagsRequest, TagDataRequest, TagLayer } from './types';

const CSF_EXTENSION = /\.[mc]?[jt]sx?$/;
const MDX_EXTENSION = /\.mdx$/;
const STORY_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

/** Resolve an index entry's import path, rejecting paths outside the project. */
const resolveInProject = (importPath: string): string | null => {
  const absolute = isAbsolute(importPath) ? importPath : resolve(process.cwd(), importPath);
  return relative(process.cwd(), absolute).startsWith('..') ? null : absolute;
};

const readMeta = async (fileName: string) => {
  const csf = (await readCsf(fileName, { makeTitle: (title?: string) => title ?? 'Untitled' })).parse();
  const objects = csf.objects();
  const meta = objects.find((object) => object.target.kind === 'meta');
  return { csf, meta, objects };
};

/** The object holding a story's own annotations, whichever CSF style declares it. */
const findStory = (objects: readonly CsfObject[], exportName: string) =>
  objects.find(
    (object) =>
      (object.target.kind === 'story' || object.target.kind === 'call-argument') &&
      'exportName' in object.target &&
      object.target.exportName === exportName,
  );

/**
 * Read the raw tags of a CSF object. Returns [] when the property is absent and null when it
 * cannot be statically evaluated.
 */
const getRawTags = (object: {
  get: (path: readonly string[]) => unknown;
  getValue: (path: readonly string[]) => unknown;
}): string[] | null => {
  if (object.get(['tags']) === undefined) {
    return [];
  }
  let value: unknown;
  try {
    value = object.getValue(['tags']);
  } catch {
    return null;
  }
  return Array.isArray(value) && value.every((tag) => typeof tag === 'string') ? (value as string[]) : null;
};

const getProjectTags = async (options: Options): Promise<string[]> => {
  try {
    const previewFile = loadPreviewOrConfigFile({ configDir: options.configDir });
    if (!previewFile) {
      return [];
    }
    const config = await readConfig(previewFile);
    return getRawTags(config) ?? [];
  } catch {
    return [];
  }
};

const isValidTagList = (tags: unknown): tags is string[] =>
  Array.isArray(tags) && tags.every((tag) => typeof tag === 'string' && /^!?[^\s!]+$/.test(tag));

/** Tags of the stories file an MDX page attaches to via `of={…}`, as a component layer. */
const getAttachedComponentTags = async (
  mdxFileName: string,
  esm: string[],
  ofIdentifier: string | undefined,
): Promise<string[] | undefined> => {
  if (!ofIdentifier) {
    return undefined;
  }
  const importPath = findOfImportPath(esm, ofIdentifier);
  if (!importPath?.startsWith('.')) {
    return undefined;
  }

  const base = resolve(dirname(mdxFileName), importPath);
  const candidates = [base, ...STORY_EXTENSIONS.map((extension) => base + extension)];
  for (const candidate of candidates) {
    if (!CSF_EXTENSION.test(candidate) || !resolveInProject(candidate)) {
      continue;
    }
    try {
      const { meta } = await readMeta(candidate);
      const tags = meta && getRawTags(meta);
      if (tags) {
        return tags;
      }
    } catch {
      // Try the next extension.
    }
  }
  return undefined;
};

export const experimental_serverChannel = async (channel: Channel, options: Options) => {
  channel.on(EVENTS.TAG_DATA_REQUEST, async ({ requestId, importPath, exportName }: TagDataRequest) => {
    const projectTags = await getProjectTags(options);
    const inheritedLayers: TagLayer[] = [
      { source: 'defaults', tags: DEFAULT_TAGS },
      { source: 'preview', tags: projectTags },
    ];

    const respond = (payload: Partial<Record<string, unknown>>, extraLayers: TagLayer[] = []) =>
      channel.emit(EVENTS.TAG_DATA_RESPONSE, {
        requestId,
        editable: false,
        localTags: [],
        inheritedLayers: [...inheritedLayers, ...extraLayers],
        ...payload,
      });

    const isCsf = typeof importPath === 'string' && CSF_EXTENSION.test(importPath);
    const isMdx = typeof importPath === 'string' && MDX_EXTENSION.test(importPath);
    if (!isCsf && !isMdx) {
      respond({ reason: 'Tags can only be edited in CSF and MDX files.' });
      return;
    }
    const fileName = resolveInProject(importPath);
    if (!fileName) {
      respond({ reason: 'File is outside the project.' });
      return;
    }

    try {
      if (isMdx) {
        const result = readMdxTags(await readFile(fileName, 'utf8'));
        if (!result.ok) {
          respond({ reason: result.reason });
          return;
        }
        const componentTags = await getAttachedComponentTags(fileName, result.esm, result.ofIdentifier);
        respond(
          { editable: true, localTags: result.tags },
          componentTags ? [{ source: 'component', tags: componentTags }] : [],
        );
        return;
      }

      const { meta, objects } = await readMeta(fileName);
      if (!meta) {
        respond({ reason: 'No meta (default export) found in the file.' });
        return;
      }
      const metaTags = getRawTags(meta);
      if (metaTags === null) {
        respond({ reason: 'Tags of this file cannot be statically analyzed.' });
        return;
      }

      if (exportName) {
        // A story's own tags sit on the story; the file's meta becomes another layer above it.
        const story = findStory(objects, exportName);
        if (!story) {
          respond({ reason: `Could not find the story exported as ${exportName}.` });
          return;
        }
        const localTags = getRawTags(story);
        if (localTags === null) {
          respond({ reason: 'Tags of this story cannot be statically analyzed.' });
          return;
        }
        respond({ editable: true, localTags }, [{ source: 'component', tags: metaTags }]);
        return;
      }

      respond({ editable: true, localTags: metaTags });
    } catch (error) {
      respond({ reason: `Could not parse file: ${(error as Error).message}` });
    }
  });

  channel.on(EVENTS.SAVE_TAGS_REQUEST, async ({ requestId, importPath, exportName, localTags }: SaveTagsRequest) => {
    const respond = (payload: { ok: boolean; error?: string }) =>
      channel.emit(EVENTS.SAVE_TAGS_RESPONSE, { requestId, ...payload });

    if (!isValidTagList(localTags)) {
      respond({ ok: false, error: 'Invalid tag list.' });
      return;
    }
    const isCsf = typeof importPath === 'string' && CSF_EXTENSION.test(importPath);
    const isMdx = typeof importPath === 'string' && MDX_EXTENSION.test(importPath);
    if (!isCsf && !isMdx) {
      respond({ ok: false, error: 'Tags can only be edited in CSF and MDX files.' });
      return;
    }
    const fileName = resolveInProject(importPath);
    if (!fileName) {
      respond({ ok: false, error: 'File is outside the project.' });
      return;
    }

    try {
      if (isMdx) {
        const result = writeMdxTags(await readFile(fileName, 'utf8'), localTags);
        if (!result.ok) {
          respond({ ok: false, error: result.reason });
          return;
        }
        await writeFile(fileName, result.source, 'utf8');
        respond({ ok: true });
        return;
      }

      const { csf, meta, objects } = await readMeta(fileName);
      const object = exportName ? findStory(objects, exportName) : meta;
      if (!object) {
        respond({
          ok: false,
          error: exportName
            ? `Could not find the story exported as ${exportName}.`
            : 'No meta (default export) found in the file.',
        });
        return;
      }
      const result = localTags.length ? object.set(['tags'], localTags) : object.remove(['tags']);
      if (!result.ok) {
        respond({ ok: false, error: result.diagnostic.message });
        return;
      }
      await writeCsf(csf, fileName);
      respond({ ok: true });
    } catch (error) {
      respond({ ok: false, error: (error as Error).message });
    }
  });

  return channel;
};
