export const ADDON_ID = 'storybook-addon-tag-editor';
export const CONTEXT_MENU_ID = `${ADDON_ID}/context-menu`;

export const EVENTS = {
  TAG_DATA_REQUEST: `${ADDON_ID}/tag-data-request`,
  TAG_DATA_RESPONSE: `${ADDON_ID}/tag-data-response`,
  SAVE_TAGS_REQUEST: `${ADDON_ID}/save-tags-request`,
  SAVE_TAGS_RESPONSE: `${ADDON_ID}/save-tags-response`,
} as const;
