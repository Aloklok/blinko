"use client";
import { useEffect } from 'react';
import { PromisePageState, PromiseState } from './standard/PromiseState';
import { Store } from './standard/base';
import { helper } from '@/lib/helper';
import { ToastPlugin } from './module/Toast/Toast';
import { RootStore } from './root';
import { eventBus } from '@/lib/event';
import { StorageListState } from './standard/StorageListState';
import i18n from '@/lib/i18n';
import { api } from '@/lib/trpc';
import { Attachment, NoteType, type Note } from '@shared/lib/types';
import { ARCHIVE_BLINKO_TASK_NAME, DBBAK_TASK_NAME } from '@shared/lib/sharedConstant';
import { makeAutoObservable } from 'mobx';
import { UserStore } from './user';
import { BaseStore } from './baseStore';
import { StorageState } from './standard/StorageState';
import _ from '@/lib/lodash';
import { useSearchParams, useLocation } from 'react-router-dom';
import { db } from '@/lib/db';
import dayjs from '@/lib/dayjs';

type filterType = {
  label: string;
  value: number;
}

export const FilterType: filterType[] = [
  { label: 'all', value: -1 },
  { label: 'note', value: 0 },
  { label: 'blinko', value: 1 },
];

type UpsertNoteParams = {
  id?: number,
  content?: string,
  type?: NoteType,
  isArchived?: boolean,
  isTop?: boolean,
  attachments?: Array<{ name: string, path: string, size?: number, type?: string }>,
  references?: number[],
  metadata?: any,
  date?: Date,
  refresh?: boolean
}


export class BlinkoStore extends Store {
  noteContent: string = '';
  // isCreateMode: boolean = true;
  _isCreateMode: boolean = true;
  get isCreateMode() {
    return this._isCreateMode
  }

  set isCreateMode(v: boolean) {
    this._isCreateMode = v
  }

  searchText: string = '';
  isSearchMode: boolean = false;
  searchFilterType: filterType = FilterType[0];
  fullscreenEditorNoteId: number | null = null;
  curMultiSelectIds: number[] = [];
  isMultiSelectMode: boolean = false;

  get isMultSelectAll() {
    return this.curMultiSelectIds.length === this.blinkoList.value?.length;
  }

  onMultiSelectNote(id: number) {
    if (this.curMultiSelectIds.includes(id)) {
      this.curMultiSelectIds = this.curMultiSelectIds.filter(i => i !== id);
    } else {
      this.curMultiSelectIds.push(id);
    }
  }

  onMultiSelectAll() {
    if (this.isMultSelectAll) {
      this.curMultiSelectIds = [];
    } else {
      this.curMultiSelectIds = this.blinkoList.value?.map(i => i.id!) || [];
    }
  }

  createContentStorage = new StorageState<{ content: string }>({
    key: 'createModeNote',
    default: { content: '' }
  });

  createAttachmentsStorage = new StorageListState<Attachment>({
    key: 'createModeAttachments'
  });

  editContentStorage = new StorageListState<{ content: string, id: number }>({
    key: 'editModeNotes'
  });

  editAttachmentsStorage = new StorageListState<Attachment & { id: number }>({
    key: 'editModeAttachments'
  });

  config = new PromiseState({
    function: async () => {
      const res = await api.user.config.query();
      return res;
    }
  });

  setConfig = new PromiseState({
    function: async (data: any) => {
      await api.user.setConfig.mutate(data);
      this.config.call();
    }
  })

  blinkoList = new PromisePageState({
    key: 'blinkoList',
    function: async (data) => {
      const res = await api.notes.list.query({ ...data, type: 0 });
      return res;
    }
  });

  noteOnlyList = new PromisePageState({
    key: 'noteOnlyList',
    function: async (data) => {
      const res = await api.notes.list.query({ ...data, type: 1 });
      return res;
    }
  });

  todoList = new PromisePageState({
    key: 'todoList',
    function: async (data) => {
      const res = await api.notes.list.query({ ...data, type: 2 });
      return res;
    }
  });

  archivedList = new PromisePageState({
    key: 'archivedList',
    function: async (data) => {
      const res = await api.notes.list.query({ ...data, isArchived: true });
      return res;
    }
  });

  trashList = new PromisePageState({
    key: 'trashList',
    function: async (data) => {
      const res = await api.notes.trashList.query({ ...data });
      return res;
    }
  });

  noteListFilterConfig: {
    tagId?: number | undefined,
    dateRange?: { from: Date, to: Date } | undefined,
    type: number,
    isArchived?: boolean | undefined,
    isOffline?: boolean | undefined,
    withLink?: boolean | undefined,
    withFile?: boolean | undefined,
    hasTodo?: boolean | undefined
  } = {
      type: -1
    }

  _noteList = new PromisePageState({
    key: 'noteList',
    function: async (data) => {
      try {
        const res = await api.notes.list.query({
          type: this.noteListFilterConfig.type == -1 ? undefined : this.noteListFilterConfig.type,
          tagId: this.noteListFilterConfig.tagId,
          startAt: this.noteListFilterConfig.dateRange?.from,
          endAt: this.noteListFilterConfig.dateRange?.to,
          isArchived: this.noteListFilterConfig.isArchived,
          isOffline: this.noteListFilterConfig.isOffline,
          searchText: this.searchText,
          withLink: this.noteListFilterConfig.withLink,
          withFile: this.noteListFilterConfig.withFile,
          hasTodo: this.noteListFilterConfig.hasTodo,
          ...data
        });
        return res;
      } catch (error) {
        console.error(error);
        return [];
      }
    }
  });

  get noteList() {
    if (this._noteList) {
      return this._noteList;
    }
    return new PromisePageState({
      key: 'noteList',
      function: async (data) => {
        return [];
      }
    })
  }

  dailyReviewNoteList = new PromiseState({
    function: async () => {
      const res = await api.notes.dailyReview.query();
      return res;
    }
  })

  tagList = new PromiseState({
    function: async () => {
      const res = await api.tags.list.query();
      return res;
    }
  });

  curSelectedNote: Note | null = null;
  curSelectedNoteId: number | null = null;

  typeBeforeSearch: number = -1;

  updateTicker = 0;

  refreshData = _.debounce(async () => {
    // Fix: Clear multi-select state when refreshing data to avoid stale selections
    this.curMultiSelectIds = [];
    this.isMultiSelectMode = false;

    this.tagList.call()

    const currentPath = new URLSearchParams(window.location.search).get('path');

    if (currentPath === 'notes') {
      this.noteOnlyList.resetAndCall({});
    } else if (currentPath === 'todo') {
      this.todoList.resetAndCall({});
    } else if (currentPath === 'archived') {
      this.archivedList.resetAndCall({});
    } else if (currentPath === 'trash') {
      this.trashList.resetAndCall({});
    } else if (currentPath === 'all') {
      this.noteList.resetAndCall({});
    } else {
      this.blinkoList.resetAndCall({});
    }

    this.config.call()
    this.dailyReviewNoteList.call()
  }, 300)

  setNoteListFilter(config: Partial<typeof this.noteListFilterConfig>) {
    Object.assign(this.noteListFilterConfig, config)
    this.noteList.resetAndCall({});
  }



  upsertNote = new PromiseState({
    eventKey: 'upsertNote',
    function: async (params: UpsertNoteParams) => {
      const { id, content, type, isArchived, isTop, attachments, references, metadata, date, refresh = true } = params
      const res = await api.notes.upsert.mutate({
        id,
        content,
        // @ts-ignore
        type,
        isArchived,
        isTop,
        attachments,
        references,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
        date
      });
      eventBus.emit('editor:clear')
      showToast && RootStore.Get(ToastPlugin).success(id ? i18n.t("update-successfully") : i18n.t("create-successfully"))

      if (id) {
        // Fix: Ensure all lists are updated to reflect the changes, especially for archive/top status
        this.updateLocalNote(res as unknown as Note);
        // Refresh detail view if open
        if (this.curSelectedNote?.id === id) {
          const detail = await api.notes.detail.mutate({ id });
          this.curSelectedNote = detail as unknown as Note;
        }
      }

      refresh && this.updateTicker++

      // [Feature] Smart Polling for AI Tags
      // If AI Post Processing is enabled, start polling for tags
      if (res && res.id && this.config.value?.isUseAiPostProcessing) {
        this.startPolling(res.id, res.updatedAt);
      }

      return res
    }
  })

  updateLocalNote(note: Note) {
    const updateList = (list: Note[]) => {
      const index = list?.findIndex(i => i.id === note.id);
      if (index !== -1 && list) {
        list[index] = { ...list[index], ...note };
      }
    }

    if (this.blinkoList.value) updateList(this.blinkoList.value);
    if (this.noteOnlyList.value) updateList(this.noteOnlyList.value);
    if (this.todoList.value) updateList(this.todoList.value);
    if (this.noteList.value) updateList(this.noteList.value);
    if (this.curSelectedNote?.id === note.id) {
      this.curSelectedNote = { ...this.curSelectedNote, ...note };
    }
  }

  deleteNote = new PromiseState({
    function: async (id: number) => {
      await api.notes.delete.mutate({ id });
      RootStore.Get(ToastPlugin).success(i18n.t("delete-successfully"))
      this.updateTicker++
    }
  })

  clear() {
    this.noteContent = ''
    this.createContentStorage.clear()
    this.createAttachmentsStorage.clear()
    this.editContentStorage.clear()
    this.editAttachmentsStorage.clear()
  }

  forceQuery: number = 0;

  useQuery() {
    const [searchParams] = useSearchParams();
    const location = useLocation();

    useEffect(() => {
      const type = searchParams.get('type')
      const tagId = searchParams.get('tagId')
      const startAt = searchParams.get('startAt')
      const endAt = searchParams.get('endAt')
      const isArchived = searchParams.get('isArchived')
      const isOffline = searchParams.get('isOffline')
      const withLink = searchParams.get('withLink')
      const withFile = searchParams.get('withFile')
      const hasTodo = searchParams.get('hasTodo')
      const searchText = searchParams.get('searchText')

      // reset filter
      this.noteListFilterConfig = {
        type: -1
      }
      this.searchText = ''

      if (type) {
        this.noteListFilterConfig.type = Number(type)
      }
      if (tagId) {
        this.noteListFilterConfig.tagId = Number(tagId)
      }
      if (startAt && endAt) {
        this.noteListFilterConfig.dateRange = {
          from: new Date(Number(startAt)),
          to: new Date(Number(endAt))
        }
      }
      if (isArchived) {
        this.noteListFilterConfig.isArchived = true
      }
      if (isOffline) {
        this.noteListFilterConfig.isOffline = true
      }
      if (withLink) {
        this.noteListFilterConfig.withLink = true
      }
      if (withFile) {
        this.noteListFilterConfig.withFile = true
      }
      if (hasTodo) {
        this.noteListFilterConfig.hasTodo = true
      }
      if (searchText) {
        this.searchText = searchText as string;
      } else {
        this.searchText = '';
      }
    }, [this.forceQuery, location.pathname, searchParams])
  }

  excludeEmbeddingTagId: number | null = null;

  setExcludeEmbeddingTagId(tagId: number | null) {
    this.excludeEmbeddingTagId = tagId;
  }

  settingsSearchText: string = '';

  constructor() {
    super()
    makeAutoObservable(this)
  }

  use() {
    useEffect(() => {
      const handleSignout = () => {
        this.clear()
      }
      eventBus.on('user:signout', handleSignout)
      return () => {
        eventBus.off('user:signout', handleSignout)
      }
    }, [])
  }

  removeCreateAttachments(file: { name: string, }) {
    this.createAttachmentsStorage.removeByFind(f => f.name === file.name);
    this.updateTicker++;
  }

  updateLocalList(note: Note) {
    // Helper to update a note in a specific list
    const updateList = (list: Note[]) => {
      const index = list.findIndex(n => n.id === note.id);
      if (index !== -1) {
        // In-place update using MobX
        list[index] = { ...list[index], ...note };
      }
    };

    if (this.blinkoList.value) updateList(this.blinkoList.value);
    if (this.noteOnlyList.value) updateList(this.noteOnlyList.value);
    if (this.todoList.value) updateList(this.todoList.value);
    if (this.noteList.value) updateList(this.noteList.value);
    if (this.curSelectedNote?.id === note.id) {
      this.curSelectedNote = { ...this.curSelectedNote, ...note };
    }
  }

  pollingMap = new Map<number, NodeJS.Timeout>();

  startPolling(noteId: number, initialUpdatedAt?: Date | string) {
    this.stopPolling(noteId);
    let attempts = 0;
    const maxAttempts = 15; // 30s total (2s interval)

    // Capture initial state from local store if possible
    const getLocalNote = () => {
      return this.blinkoList.value?.find(n => n.id === noteId) ||
        this.noteList.value?.find(n => n.id === noteId) ||
        this.todayNoteList.value?.find(n => n.id === noteId); // Also check today list
    }
    const localNote = getLocalNote();
    const initialTagCount = localNote?.tags?.length || 0;
    const initialContentLength = localNote?.content?.length || 0;

    const timer = setInterval(async () => {
      attempts++;

      // [Safety Guard] If user is editing this note (has local draft), stop polling immediately
      const isEditing = this.editContentStorage.list?.some(i => i.id === noteId);
      if (isEditing || attempts > maxAttempts) {
        this.stopPolling(noteId);
        return;
      }

      try {
        const freshNote = await api.notes.detail.mutate({ id: noteId }, { context: { skipBatch: true } });

        if (!freshNote) return;

        // Enhanced Polling Logic:
        // 1. Timestamp check (Standard)
        const hasNewerTimestamp = initialUpdatedAt ? dayjs(freshNote.updatedAt).isAfter(dayjs(initialUpdatedAt)) : false;

        // 2. Content check (Did AI append text?)
        const hasContentChange = (freshNote.content?.length || 0) !== initialContentLength;

        // 3. Tag check (Did AI add tags? - MOST CRITICAL)
        const currentTagCount = freshNote.tags?.length || 0;
        const hasTagChange = currentTagCount !== initialTagCount;

        // Combined Trigger
        if (hasNewerTimestamp || hasContentChange || hasTagChange) {
          // It's an update!
          this.updateLocalList(freshNote as unknown as Note);
          this.stopPolling(noteId); // Stop purely because we found AN update. 

          // Force a small delay then notify ensuring React renders
          setTimeout(() => {
            RootStore.Get(ToastPlugin).success(i18n.t("ai-tags-updated") || "AI Content Updated");
          }, 100);

          // Update local cache as well
          db.putNotes([freshNote as unknown as Note]).catch(console.error);
        }
      } catch (e) {
        // Ignore network errors during polling
        console.warn('Polling error:', e);
      }
    }, 2000);

    this.pollingMap.set(noteId, timer);
  }

  stopPolling(noteId: number) {
    if (this.pollingMap.has(noteId)) {
      clearInterval(this.pollingMap.get(noteId));
      this.pollingMap.delete(noteId);
    }
  }

  updateTagFilter(tagId: number) {
    this.noteListFilterConfig.tagId = tagId;
    this.noteListFilterConfig.type = -1
    this.noteList.resetAndCall({});
  }
}

export const showToast = true;
