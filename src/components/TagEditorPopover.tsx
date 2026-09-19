import type { RefObject } from 'react';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { ActionList, Button, Form, Popover } from 'storybook/internal/components';
import type { API_HashEntry } from 'storybook/internal/types';

import { AdminIcon } from '@storybook/icons';

import { keyframes, styled } from 'storybook/theming';

import {
  addTag,
  buildTagRows,
  invertTag,
  isReservedTag,
  isValidTag,
  oppositeOf,
  SOURCE_LABELS,
  toggleTag,
  type TagRow,
} from '../tag-model';
import type { TagDataResponse, TagEditorIO, TagValue } from '../types';
import { ChangePill } from './ChangePill';
import { TriStateCheckbox } from './TriStateCheckbox';

const WIDTH = 300;
const MAX_HEIGHT = 480;
const MARGIN = 8;

// Above the manager's own layers, so outside clicks land here rather than on the app behind.
const Backdrop = styled.div({
  position: 'fixed',
  inset: 0,
  zIndex: 9998,
});

const Positioner = styled.div({
  position: 'fixed',
  zIndex: 9999,
});

const Content = styled.div({
  display: 'flex',
  flexDirection: 'column',
  width: WIDTH,
  maxHeight: MAX_HEIGHT,
});

const SearchWrapper = styled.div(({ theme }) => ({
  padding: 8,
  borderBottom: `1px solid ${theme.appBorderColor}`,
}));

const ScrollArea = styled.div({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
});

const Scroller = styled.div({
  overflowY: 'auto',
  scrollbarWidth: 'thin',
  padding: '4px 0',
});

/** Hints that the list scrolls on under the save bar. */
const ScrollShadow = styled.div(({ theme }) => ({
  position: 'absolute',
  insetInline: 0,
  bottom: 0,
  height: 16,
  pointerEvents: 'none',
  background: `linear-gradient(to top, ${theme.background.content}, transparent)`,
}));

const Footer = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '8px 12px',
});

const FooterActions = styled.div({
  display: 'flex',
  gap: 6,
});

const MutedText = styled.span(({ theme }) => ({
  color: theme.textMutedColor,
}));

const Message = styled.div(({ theme }) => ({
  padding: '12px',
  color: theme.textMutedColor,
}));

const ErrorMessage = styled.div(({ theme }) => ({
  padding: '8px 12px',
  color: theme.color.negativeText,
}));

const TagName = styled.span(({ theme }) => ({
  fontFamily: theme.typography.fonts.mono,
  fontSize: theme.typography.size.s1,
}));

const Bang = styled.span(({ theme }) => ({
  fontWeight: theme.typography.weight.bold,
}));

/**
 * One slot for both marks, so they sit in the same column on every row. A pending change takes it
 * over from the inheritance mark: it is the more useful thing to show while editing.
 */
const MarkSlot = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: 20,
  height: 20,
});

/** Padded for a comfortable hover target without stretching the 32px rows. */
const InheritedMark = styled.span({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 20,
  height: 20,
  padding: 3,
  '& svg': { width: 14, height: 14 },
});

const shake = keyframes({
  '0%, 100%': { transform: 'translateX(0)' },
  '15%, 45%, 75%': { transform: 'translateX(-4px)' },
  '30%, 60%, 90%': { transform: 'translateX(4px)' },
});

const SaveButton = styled(Button)({
  '&[data-shaking]': {
    animation: `${shake} 400ms ease-in-out`,
  },
});

const prefersReducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const InvertLabel = styled.span({
  minWidth: 45,
});

/** Matches how the manager's own controls read when they cannot be used. */
const RowAction = styled(ActionList.Action)({
  '&[aria-disabled="true"]': {
    cursor: 'not-allowed',
    '& input:disabled': { cursor: 'not-allowed' },
  },
});

const usePopoverPosition = (triggerRef: RefObject<HTMLButtonElement | null>) => {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) {
      setPosition({ top: MARGIN, left: MARGIN });
      return;
    }
    let left = rect.right + MARGIN;
    if (left + WIDTH > window.innerWidth - MARGIN) {
      left = Math.max(MARGIN, window.innerWidth - WIDTH - MARGIN);
    }
    let top = rect.top;
    if (top + MAX_HEIGHT > window.innerHeight - MARGIN) {
      top = Math.max(MARGIN, window.innerHeight - MAX_HEIGHT - MARGIN);
    }
    setPosition({ top, left });
  }, [triggerRef]);
  return position;
};

const entryLabel = (tag: string, value: TagValue | undefined) => (value === 'excluded' ? `!${tag}` : tag);

interface TagRowItemProps {
  row: TagRow;
  onToggle: (row: TagRow) => void;
  onInvert: (row: TagRow) => void;
}

const TagRowItem = ({ row, onToggle, onInvert }: TagRowItemProps) => {
  const { tag, local, inherited, inheritedFrom, effective, derived, editable, changed } = row;
  const { disabledReason } = row;
  const targetId = `tag-editor-${tag}`;

  const excluded = effective === 'excluded';
  const label = entryLabel(tag, effective);

  // Checked means the entry declares this itself; mixed means an upstream layer decides it. An
  // empty box means it applies to nothing — including a tag the draft has just stopped declaring,
  // which stays in place until the next save rather than greying out or jumping down the list.
  const checked = local !== undefined || derived;
  const indeterminate = local === undefined && !derived && inherited !== undefined;

  const inheritedNote = inheritedFrom ? `Inherited through ${SOURCE_LABELS[inheritedFrom]}` : null;
  const showsInheritance = inheritedNote !== null && local === undefined;

  const resultLabel = entryLabel(tag, oppositeOf(row));
  const invertTooltip = local === undefined ? `Add ${resultLabel} tag` : `Replace with ${resultLabel} tag`;

  const checkboxLabel = derived
    ? `${label} is derived by Storybook and cannot be edited`
    : indeterminate
      ? `Declare ${label} on this entry, currently ${inheritedNote?.toLowerCase()}`
      : checked
        ? `Stop declaring ${label} on this entry`
        : `Declare ${label} on this entry`;

  return (
    <ActionList.HoverItem targetId={targetId}>
      <RowAction
        as="label"
        ariaLabel={false}
        tabIndex={-1}
        tooltip={disabledReason}
        aria-disabled={editable ? undefined : true}
      >
        <ActionList.Icon>
          <TriStateCheckbox
            checked={checked}
            indeterminate={indeterminate}
            disabled={!editable}
            onChange={() => onToggle(row)}
            data-tag={tag}
            aria-label={checkboxLabel}
          />
        </ActionList.Icon>
        <ActionList.Text>
          <TagName>
            {excluded && <Bang>!</Bang>}
            {tag}
          </TagName>
        </ActionList.Text>
      </RowAction>
      <MarkSlot>
        {changed ? (
          <ChangePill />
        ) : (
          // Dropped once the entry declares the tag: the change mark carries that meaning.
          showsInheritance && (
            <ActionList.Button
              ariaLabel={inheritedNote as string}
              tooltip={inheritedNote as string}
              tooltipPlacement="top"
              padding="none"
            >
              <InheritedMark>
                <AdminIcon />
              </InheritedMark>
            </ActionList.Button>
          )
        )}
      </MarkSlot>
      {editable && (
        <ActionList.Button
          data-target-id={targetId}
          ariaLabel={invertTooltip}
          tooltip={invertTooltip}
          onClick={() => onInvert(row)}
        >
          <InvertLabel>Invert</InvertLabel>
        </ActionList.Button>
      )}
    </ActionList.HoverItem>
  );
};

export interface TagEditorPopoverProps {
  entry: API_HashEntry;
  triggerRef: RefObject<HTMLButtonElement | null>;
  io: TagEditorIO;
  onClose: () => void;
}

export const TagEditorPopover = ({ entry, triggerRef, io, onClose }: TagEditorPopoverProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const position = usePopoverPosition(triggerRef);

  const importPath = 'importPath' in entry ? entry.importPath : undefined;
  const exportName = 'exportName' in entry ? entry.exportName : undefined;
  const computedTags = 'tags' in entry ? (entry.tags ?? []) : [];

  const target = useMemo(() => (importPath ? { importPath, exportName } : undefined), [importPath, exportName]);

  const [layers, setLayers] = useState<TagDataResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [knownTags, setKnownTags] = useState<string[]>([]);
  const [draft, setDraft] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const saveRef = useRef<HTMLButtonElement | null>(null);

  /**
   * Toggling the attribute by hand restarts the animation on repeated clicks, which re-rendering
   * with the same state would not do.
   */
  const shakeSaveButton = () => {
    const node = saveRef.current;
    if (!node || prefersReducedMotion()) {
      return;
    }
    node.removeAttribute('data-shaking');
    void node.offsetWidth;
    node.setAttribute('data-shaking', '');
  };

  useEffect(() => {
    if (!target) {
      setLoadError('This entry has no source file.');
      return;
    }
    io.loadTagData(target).then(
      (response) => {
        setLayers(response);
        setDraft(response.localTags);
        setSaved(response.localTags);
      },
      (error: Error) => setLoadError(error.message),
    );
  }, [io, target]);

  useEffect(() => {
    io.loadKnownTags().then(setKnownTags, () => {});
  }, [io]);

  // Focus the filter once open. Deferred so it wins over the closing context menu, which restores
  // focus to its trigger on unmount.
  useEffect(() => {
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, []);

  const editable = layers?.editable ?? false;
  const inheritedLayers = useMemo(() => layers?.inheritedLayers ?? [], [layers]);

  const rows = useMemo(
    () =>
      layers
        ? buildTagRows({
            draftLocalTags: draft,
            savedLocalTags: saved,
            inheritedLayers,
            computedTags,
            knownTags,
            editable,
            readOnlyReason: layers.reason,
          })
        : [],
    [layers, draft, saved, inheritedLayers, computedTags, knownTags, editable],
  );

  const dirtyCount = rows.filter((row) => row.changed).length;
  const isDirty = dirtyCount > 0;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    const onMouseDown = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      // With unsaved changes the dialog is modal: only Escape or its own buttons dismiss it, and
      // the click nudges the save button instead.
      if (isDirty) {
        shakeSaveButton();
      } else {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [onClose, isDirty]);

  const trimmedQuery = query.trim();
  const searchTerm = trimmedQuery.replace(/^!/, '');
  const visibleRows = searchTerm ? rows.filter((row) => row.tag.includes(searchTerm)) : rows;
  const appliedRows = visibleRows.filter((row) => row.savedEffective !== undefined);
  const availableRows = visibleRows.filter((row) => row.savedEffective === undefined);

  const queryIsReserved = trimmedQuery.length > 0 && isReservedTag(trimmedQuery);
  const canAddQuery =
    editable && trimmedQuery.length > 0 && isValidTag(trimmedQuery) && !rows.some((row) => row.tag === searchTerm);

  const onToggle = (row: TagRow) => setDraft((current) => toggleTag(current, row));
  const onInvert = (row: TagRow) => setDraft((current) => invertTag(current, row));
  const onAdd = () => {
    setDraft((current) => addTag(current, trimmedQuery));
    setQuery('');
  };

  const onSave = async () => {
    if (!target) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const response = await io.saveTags(target, draft);
      if (response.ok) {
        onClose();
      } else {
        setSaveError(response.error ?? 'Saving failed');
      }
    } catch (error) {
      setSaveError((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!position) {
    return null;
  }

  return (
    <>
      {/* Keeps an outside click from reaching the app behind; the document listener reacts. */}
      {isDirty && <Backdrop />}
      <Positioner ref={containerRef} style={{ top: position.top, left: position.left }}>
        <Popover
          hasChrome
          padding={0}
          role="dialog"
          aria-modal={isDirty || undefined}
          aria-label={`Tags for ${entry.name}`}
        >
          <Content>
            <SearchWrapper
              as="form"
              onSubmit={(event: React.FormEvent) => {
                event.preventDefault();
                if (canAddQuery) {
                  onAdd();
                }
              }}
              onKeyDown={(event: React.KeyboardEvent) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  if (canAddQuery) {
                    onAdd();
                  }
                }
              }}
            >
              <Form.Input
                ref={inputRef}
                placeholder="Filter or add tags…"
                value={query}
                size="100%"
                height={28}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
              />
            </SearchWrapper>
            {loadError && <ErrorMessage>{loadError}</ErrorMessage>}
            {!loadError && !layers && <Message>Loading tags…</Message>}
            {layers && !editable && <Message>{layers.reason ?? 'Tags of this entry cannot be edited.'}</Message>}
            {layers && (
              <ScrollArea>
                <Scroller>
                  {appliedRows.length > 0 && (
                    <ActionList>
                      {appliedRows.map((row) => (
                        <TagRowItem key={row.tag} row={row} onToggle={onToggle} onInvert={onInvert} />
                      ))}
                    </ActionList>
                  )}
                  {availableRows.length > 0 && (
                    <ActionList>
                      {availableRows.map((row) => (
                        <TagRowItem key={row.tag} row={row} onToggle={onToggle} onInvert={onInvert} />
                      ))}
                    </ActionList>
                  )}
                  {queryIsReserved && <Message>This tag name is reserved and cannot be edited.</Message>}
                  {canAddQuery && (
                    <ActionList>
                      <ActionList.Item>
                        <ActionList.Button ariaLabel={false} onClick={onAdd}>
                          <ActionList.Text>
                            Add <TagName>{trimmedQuery}</TagName> tag
                          </ActionList.Text>
                        </ActionList.Button>
                      </ActionList.Item>
                    </ActionList>
                  )}
                  {visibleRows.length === 0 && !canAddQuery && !queryIsReserved && <Message>No matching tags.</Message>}
                </Scroller>
                {editable && <ScrollShadow />}
              </ScrollArea>
            )}
            {saveError && <ErrorMessage>{saveError}</ErrorMessage>}
            {editable && (
              <Footer>
                <MutedText>{isDirty ? `${dirtyCount} unsaved change${dirtyCount === 1 ? '' : 's'}` : ''}</MutedText>
                <FooterActions>
                  {isDirty && (
                    <Button size="small" variant="ghost" onClick={() => setDraft(saved)}>
                      Reset
                    </Button>
                  )}
                  <SaveButton
                    size="small"
                    variant="solid"
                    disabled={!isDirty || saving}
                    onClick={onSave}
                    ref={saveRef}
                    onAnimationEnd={(event: React.AnimationEvent<HTMLButtonElement>) =>
                      event.currentTarget.removeAttribute('data-shaking')
                    }
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </SaveButton>
                </FooterActions>
              </Footer>
            )}
          </Content>
        </Popover>
      </Positioner>
    </>
  );
};
