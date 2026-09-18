/** Where an inherited tag comes from. */
export type InheritanceSource = 'defaults' | 'preview' | 'component';

export type TagValue = 'included' | 'excluded';

/** One upstream source of tags. Layers apply in order; later layers win. */
export interface TagLayer {
  source: InheritanceSource;
  /** Raw tags, including negations. */
  tags: string[];
}

/** Which part of a source file an entry's own tags live on. */
export interface TagTarget {
  /** Import path of the entry, relative to the project root. */
  importPath: string;
  /** Export the story is declared as. Absent for components and docs pages. */
  exportName?: string;
}

/** Request the tag layers for an index entry. */
export interface TagDataRequest extends TagTarget {
  requestId: string;
}

export interface TagDataResponse {
  requestId: string;
  /** Whether the entry's own tags can be edited. */
  editable: boolean;
  /** Why the entry is not editable. */
  reason?: string;
  /** Raw tags the entry declares itself, including negations. */
  localTags: string[];
  /** Upstream layers in application order. */
  inheritedLayers: TagLayer[];
}

/** Replace the tags an entry declares itself. */
export interface SaveTagsRequest extends TagTarget {
  requestId: string;
  /** New raw tags, including negations. Empty removes the property. */
  localTags: string[];
}

export interface SaveTagsResponse {
  requestId: string;
  ok: boolean;
  error?: string;
}

/** Data access used by the popover. The manager wires it to the server channel; stories mock it. */
export interface TagEditorIO {
  loadTagData(target: TagTarget): Promise<TagDataResponse>;
  saveTags(target: TagTarget, localTags: string[]): Promise<SaveTagsResponse>;
  /** All tags used across the project, offered as additions. */
  loadKnownTags(): Promise<string[]>;
}
