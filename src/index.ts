import { definePreviewAddon } from 'storybook/internal/csf';

import addonAnnotations from './preview';

export { ADDON_ID, CONTEXT_MENU_ID, EVENTS } from './constants';
export type { SaveTagsRequest, SaveTagsResponse, TagDataRequest, TagDataResponse } from './types';

export default () => definePreviewAddon(addonAnnotations);
