import { addons } from 'storybook/manager-api';

import { EVENTS } from './constants';
import type { SaveTagsResponse, TagDataResponse, TagEditorIO, TagTarget } from './types';

interface WithRequestId {
  requestId: string;
}

const request = <TResponse extends WithRequestId>(
  requestEvent: string,
  responseEvent: string,
  payload: Record<string, unknown>,
  timeoutMs = 8000,
): Promise<TResponse> => {
  const channel = addons.getChannel();
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('No response from the Storybook server'));
    }, timeoutMs);
    const handler = (response: TResponse) => {
      if (response.requestId !== requestId) {
        return;
      }
      cleanup();
      resolve(response);
    };
    const cleanup = () => {
      clearTimeout(timer);
      channel.off(responseEvent, handler);
    };
    channel.on(responseEvent, handler);
    channel.emit(requestEvent, { ...payload, requestId });
  });
};

const requestTagData = (target: TagTarget) =>
  request<TagDataResponse>(EVENTS.TAG_DATA_REQUEST, EVENTS.TAG_DATA_RESPONSE, { ...target });

const saveTags = (target: TagTarget, localTags: string[]) =>
  request<SaveTagsResponse>(EVENTS.SAVE_TAGS_REQUEST, EVENTS.SAVE_TAGS_RESPONSE, {
    ...target,
    localTags,
  });

const loadKnownTags = async (): Promise<string[]> => {
  const response = await fetch('./index.json');
  if (!response.ok) {
    return [];
  }
  const index: { entries?: Record<string, { tags?: string[] }> } = await response.json();
  const tags = new Set<string>();
  Object.values(index.entries ?? {}).forEach((entry) => entry.tags?.forEach((tag) => tags.add(tag)));
  return [...tags];
};

/** TagEditorIO backed by the server channel and the story index. */
export const channelIO: TagEditorIO = {
  loadTagData: requestTagData,
  saveTags,
  loadKnownTags,
};
