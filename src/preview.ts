import type { ProjectAnnotations, Renderer } from 'storybook/internal/types';

/**
 * The addon works in the manager and on the Storybook server, so it adds nothing to a rendered
 * story. These annotations exist so that it registers the same way as every other addon.
 */
const preview: ProjectAnnotations<Renderer> = {};

export default preview;
