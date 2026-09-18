import { fileURLToPath } from 'node:url';

/** Load the built addon in this test Storybook. */
export function managerEntries(entry: string[] = []) {
  return [...entry, fileURLToPath(import.meta.resolve('../dist/manager.js'))];
}

export * from '../dist/preset.js';
