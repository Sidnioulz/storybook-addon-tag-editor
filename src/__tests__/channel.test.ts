import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EVENTS } from '../constants';

type Handler = (payload: unknown) => void;

/** Minimal stand-in for the addons channel, recording what the addon emits. */
const createChannel = () => {
  const handlers = new Map<string, Set<Handler>>();
  return {
    emitted: [] as { event: string; payload: any }[],
    on(event: string, handler: Handler) {
      handlers.set(event, (handlers.get(event) ?? new Set()).add(handler));
    },
    off(event: string, handler: Handler) {
      handlers.get(event)?.delete(handler);
    },
    emit(event: string, payload: unknown) {
      this.emitted.push({ event, payload });
    },
    /** Deliver a server response back to the addon. */
    reply(event: string, payload: unknown) {
      handlers.get(event)?.forEach((handler) => handler(payload));
    },
    listenerCount(event: string) {
      return handlers.get(event)?.size ?? 0;
    },
    /** The request the addon sent, failing loudly if it sent none. */
    lastRequest() {
      const request = this.emitted.at(-1);
      if (!request) {
        throw new Error('the addon emitted no request');
      }
      return request;
    },
  };
};

let channel: ReturnType<typeof createChannel>;

vi.mock('storybook/manager-api', () => ({
  addons: { getChannel: () => channel },
}));

const { channelIO } = await import('../channel');

const target = { importPath: './Button.stories.ts' };

beforeEach(() => {
  channel = createChannel();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('loadTagData', () => {
  it('emits a request carrying the target and a request id', async () => {
    const pending = channelIO.loadTagData({ importPath: './a.stories.ts', exportName: 'Primary' });

    const request = channel.lastRequest();
    expect(request.event).toBe(EVENTS.TAG_DATA_REQUEST);
    expect(request.payload).toMatchObject({
      importPath: './a.stories.ts',
      exportName: 'Primary',
    });
    expect(request.payload.requestId).toEqual(expect.any(String));

    channel.reply(EVENTS.TAG_DATA_RESPONSE, {
      requestId: request.payload.requestId,
      editable: true,
      localTags: ['a'],
      inheritedLayers: [],
    });

    await expect(pending).resolves.toMatchObject({ editable: true, localTags: ['a'] });
  });

  it('ignores responses belonging to another request', async () => {
    const pending = channelIO.loadTagData(target);
    const { requestId } = channel.lastRequest().payload;

    channel.reply(EVENTS.TAG_DATA_RESPONSE, { requestId: 'someone-else', localTags: ['wrong'] });
    channel.reply(EVENTS.TAG_DATA_RESPONSE, { requestId, localTags: ['right'] });

    await expect(pending).resolves.toMatchObject({ localTags: ['right'] });
  });

  it('stops listening once it has an answer', async () => {
    const pending = channelIO.loadTagData(target);
    const { requestId } = channel.lastRequest().payload;
    expect(channel.listenerCount(EVENTS.TAG_DATA_RESPONSE)).toBe(1);

    channel.reply(EVENTS.TAG_DATA_RESPONSE, { requestId });
    await pending;

    expect(channel.listenerCount(EVENTS.TAG_DATA_RESPONSE)).toBe(0);
  });

  it('rejects when the server never answers', async () => {
    vi.useFakeTimers();
    const pending = channelIO.loadTagData(target);
    const assertion = expect(pending).rejects.toThrow('No response from the Storybook server');

    await vi.advanceTimersByTimeAsync(8000);
    await assertion;

    expect(channel.listenerCount(EVENTS.TAG_DATA_RESPONSE)).toBe(0);
  });
});

describe('saveTags', () => {
  it('sends the target and the new tags', async () => {
    const pending = channelIO.saveTags(target, ['a', '!b']);

    const request = channel.lastRequest();
    expect(request.event).toBe(EVENTS.SAVE_TAGS_REQUEST);
    expect(request.payload).toMatchObject({
      importPath: './Button.stories.ts',
      localTags: ['a', '!b'],
    });

    channel.reply(EVENTS.SAVE_TAGS_RESPONSE, { requestId: request.payload.requestId, ok: true });
    await expect(pending).resolves.toMatchObject({ ok: true });
  });
});

describe('loadKnownTags', () => {
  it('collects every tag in the index, without duplicates', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          entries: { a: { tags: ['one', 'two'] }, b: { tags: ['two'] }, c: {} },
        }),
      }),
    );

    await expect(channelIO.loadKnownTags()).resolves.toEqual(['one', 'two']);
  });

  it('returns nothing when the index cannot be read', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    await expect(channelIO.loadKnownTags()).resolves.toEqual([]);
  });
});
