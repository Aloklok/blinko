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
import { makeAutoObservable, makeObservable, observable, action, computed } from 'mobx';
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
      const res = await api.config.list.query();
      return res;
    }
  });

  setConfig = new PromiseState({
    function: async (data: any) => {
      await api.config.update.mutate(data);
      this.config.call();
    }
  })

  // [OPTIMISTIC UI] Keep track of locally created notes to prevent them from being overwritten by delayed server response
  optimisticIds = new Set<number>();

  blinkoList = new PromisePageState({
    key: 'blinkoList',
    onBeforeSetValue: (oldVal, newVal) => {
      if (!oldVal || !Array.isArray(oldVal)) return newVal;
      const newIds = new Set(newVal.map((n: any) => n.id));
      // Keep local optimistic items that are missing from server response
      const keptItems = oldVal.filter((n: any) => this.optimisticIds.has(n.id) && !newIds.has(n.id));
      return [...keptItems, ...newVal];
    },
    function: async (data) => {
      const res = await api.notes.list.mutate({ ...data, type: 0 });
      return res;
    }
  });

  noteOnlyList = new PromisePageState({
    key: 'noteOnlyList',
    onBeforeSetValue: (oldVal, newVal) => {
      if (!oldVal || !Array.isArray(oldVal)) return newVal;
      const newIds = new Set(newVal.map((n: any) => n.id));
      const keptItems = oldVal.filter((n: any) => this.optimisticIds.has(n.id) && !newIds.has(n.id));
      return [...keptItems, ...newVal];
    },
    function: async (data) => {
      const res = await api.notes.list.mutate({ ...data, type: 1 });
      return res;
    }
  });

  todoList = new PromisePageState({
    key: 'todoList',
    onBeforeSetValue: (oldVal, newVal) => {
      if (!oldVal || !Array.isArray(oldVal)) return newVal;
      const newIds = new Set(newVal.map((n: any) => n.id));
      const keptItems = oldVal.filter((n: any) => this.optimisticIds.has(n.id) && !newIds.has(n.id));
      return [...keptItems, ...newVal];
    },
    function: async (data) => {
      const res = await api.notes.list.mutate({ ...data, type: 2 });
      return res;
    }
  });

  archivedList = new PromisePageState({
    key: 'archivedList',
    function: async (data) => {
      const res = await api.notes.list.mutate({ ...data, isArchived: true });
      return res;
    }
  });

  trashList = new PromisePageState({
    key: 'trashList',
    function: async (data) => {
      const res = await api.notes.list.mutate({ ...data, isRecycle: true });
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
    onBeforeSetValue: (oldVal, newVal) => {
      if (!oldVal || !Array.isArray(oldVal)) return newVal;
      const newIds = new Set(newVal.map((n: any) => n.id));
      const keptItems = oldVal.filter((n: any) => this.optimisticIds.has(n.id) && !newIds.has(n.id));
      return [...keptItems, ...newVal];
    },
    function: async (data) => {
      try {
        const res = await api.notes.list.mutate({
          type: this.noteListFilterConfig.type == -1 ? void 0 : this.noteListFilterConfig.type,
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
      const res = await api.notes.dailyReviewNoteList.query();
      return res;
    }
  })

  tagList = new PromiseState({
    function: async () => {
      const res = await api.tags.list.query();
      const listTags = helper.buildHashTagTreeFromDb(res);
      let pathTags: string[] = [];
      listTags.forEach(node => {
        pathTags = pathTags.concat(helper.generateTagPaths(node));
      });
      return {
        listTags,
        pathTags,
        falttenTags: res
      };
    }
  });

  noteDetail = new PromiseState({
    function: async (data: { id: number }) => {
      const res = await api.notes.detail.mutate(data);
      return res as unknown as Note;
    }
  });

  todayNoteList = new PromiseState({
    onBeforeSetValue: (oldVal, newVal) => {
      if (!oldVal || !Array.isArray(oldVal)) return newVal;
      const newIds = new Set(newVal.map((n: any) => n.id));
      const keptItems = oldVal.filter((n: any) => this.optimisticIds.has(n.id) && !newIds.has(n.id));
      return [...keptItems, ...newVal];
    },
    function: async () => {
      const res = await api.notes.today.query();
      return res as unknown as Note[];
    }
  });

  resourceList = new PromisePageState({
    key: 'resourceList',
    function: async (data: { folder?: string, searchText?: string } & any) => {
      const res = await api.attachments.list.query({
        ...data,
      });
      return res;
    }
  });

  archiveNotes = new PromiseState({
    function: async (ids: number[]) => {
      await api.notes.updateMany.mutate({ ids, isArchived: true });
      this.refreshData();
    }
  });

  updateNotesType = new PromiseState({
    function: async (data: { ids: number[], type: number }) => {
      await api.notes.updateMany.mutate({ ...data });
      this.refreshData();
    }
  });

  deleteNotes = new PromiseState({
    function: async (ids: number[]) => {
      // Kill any active polling for these notes immediately
      ids.forEach(id => this.stopPolling(id));
      // Remove from local memory lists for instant dismissal UX
      this.removeLocalNote(ids);

      await api.notes.trashMany.mutate({ ids });
      RootStore.Get(ToastPlugin).success(i18n.t("delete-successfully"))
      this.refreshData();
    }
  });

  updateNotesTags = new PromiseState({
    function: async (data: { ids: number[], tag: string }) => {
      await api.tags.updateTagMany.mutate({ ...data });
      this.refreshData();
    }
  });

  createNote = new PromiseState({
    function: async (params: UpsertNoteParams) => {
      const res = await this.upsertNote.call(params);
      return res;
    }
  });

  restoreNote = new PromiseState({
    function: async (id: number) => {
      await api.notes.updateMany.mutate({ ids: [id], isRecycle: false });
      this.refreshData();
    }
  });

  updateNote = new PromiseState({
    function: async (params: UpsertNoteParams) => {
      return await this.upsertNote.call(params);
    }
  });

  permanentlyDeleteNote = new PromiseState({
    function: async (id: number) => {
      this.stopPolling(id);
      this.removeLocalNote(id);
      await api.notes.deleteMany.mutate({ ids: [id] });
      RootStore.Get(ToastPlugin).success(i18n.t("delete-successfully"))
      this.updateTicker++
    }
  });

  searchNotes = new PromiseState({
    function: async (data: any) => {
      await this._noteList.call(data);
    }
  });

  referenceSearchList = new PromisePageState({
    key: 'referenceSearchList',
    function: async (data: { searchText?: string } & any) => {
      const res = await api.notes.list.mutate({
        ...data,
      });
      return res;
    }
  });

  updateDBTask = new PromiseState({
    function: async (time: string) => {
      await api.task.upsertTask.mutate({ task: DBBAK_TASK_NAME, type: 'start', time });
    }
  });

  updateArchiveTask = new PromiseState({
    function: async (time: string) => {
      await api.task.upsertTask.mutate({ task: ARCHIVE_BLINKO_TASK_NAME, type: 'start', time });
    }
  });

  getNoteById(id: number) {
    return this.blinkoList.value?.find(i => i.id === id) ||
      this._noteList.value?.find(i => i.id === id) ||
      this.noteOnlyList.value?.find(i => i.id === id) ||
      this.todoList.value?.find(i => i.id === id) ||
      this.archivedList.value?.find(i => i.id === id);
  }

  generateAITitle = new PromiseState({
    function: async (noteId: number) => {
      // Implementation depends on server-side logic, usually a writing task
      // For now, mapping to a likely endpoint if exists or return null
      return null;
    }
  });

  curSelectedNote: Note | null = null;
  curSelectedNoteId: number | null = null;

  typeBeforeSearch: number = -1;

  updateTicker = 0;
  localUpdateTicker = 0;

  refreshData = _.debounce(async () => {
    // Fix: Clear multi-select state when refreshing data to avoid stale selections
    this.curMultiSelectIds = [];
    this.isMultiSelectMode = false;

    this.tagList.call()

    const currentPath = new URLSearchParams(window.location.search).get('path');

    // Use call() instead of resetAndCall() to achieve silent background refresh
    // and avoid the "No Data" loading flicker.
    if (currentPath === 'notes') {
      this.noteOnlyList.call({});
    } else if (currentPath === 'todo') {
      this.todoList.call({});
    } else if (currentPath === 'archived') {
      this.archivedList.call({});
    } else if (currentPath === 'trash') {
      this.trashList.call({});
    } else if (currentPath === 'all') {
      this.noteList.call({});
    } else {
      this.blinkoList.call({});
    }

    this.config.call()
    this.dailyReviewNoteList.call()
  }, 300)

  setNoteListFilter(config: Partial<typeof this.noteListFilterConfig>) {
    Object.assign(this.noteListFilterConfig, config)
    this.noteList.call({});
  }

  unshiftLocalNote(note: Note) {
    if (note.id) {
      this.optimisticIds.add(note.id);
      // Auto-cleanup optimistic ID after 30 seconds to prevent permanent ghost retention if sync actually failed
      setTimeout(() => {
        this.optimisticIds.delete(note.id!);
      }, 30000);
    }

    const unshiftToList = (list: Note[]) => {
      // Avoid duplicate insertion
      if (list.some(n => n.id === note.id)) return;
      list.unshift({ ...note });
    };

    if (this.blinkoList.value) unshiftToList(this.blinkoList.value);
    if (this.noteOnlyList.value) unshiftToList(this.noteOnlyList.value);
    if (this.noteList.value) unshiftToList(this.noteList.value);
    if (this._noteList.value) unshiftToList(this._noteList.value);
    // If it's a today note, add to today list
    const isToday = dayjs().isSame(dayjs(note.createdAt), 'day');
    if (isToday && this.todayNoteList.value) unshiftToList(this.todayNoteList.value);

    // Trigger local React sync
    this.localUpdateTicker++;
  }

  removeLocalNote(ids: number | number[]) {
    const idList = Array.isArray(ids) ? ids : [ids];
    const removeFromList = (list: Note[]) => {
      const initialLength = list.length;
      const filtered = list.filter(n => !idList.includes(n.id));
      if (filtered.length !== initialLength) {
        // We need to modify the array in-place or replace values while keeping observability
        // For PromisePageState value, replacing the entire array is fine if it's marked as observable
        return filtered;
      }
      return null;
    };

    const targetLists = [this.blinkoList, this.noteOnlyList, this.todoList, this.noteList, this.todayNoteList, this._noteList, this.trashList, this.archivedList];
    let changed = false;

    targetLists.forEach(ps => {
      if (ps.value) {
        const result = removeFromList(ps.value);
        if (result) {
          ps.value = result;
          changed = true;
        }
      }
    });

    if (changed) {
      this.localUpdateTicker++;
    }
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

      if ((!content || content.trim() === "") && !id) {
        console.warn("Attempting to create note with empty content", params);
      }

      eventBus.emit('editor:clear')

      const showToast = params.showToast ?? true;
      showToast && RootStore.Get(ToastPlugin).success(id ? i18n.t("update-successfully") : i18n.t("create-successfully"))

      if (id) {
        // Update existing note with reference replacement
        this.updateLocalNote(res as unknown as Note);
        // Refresh detail view if open
        if (this.curSelectedNote?.id === id) {
          const detail = await api.notes.detail.mutate({ id });
          this.curSelectedNote = detail as unknown as Note;
        }
      } else {
        // [INSTANT ADMISSION] For new notes, unshift directly into local lists
        this.unshiftLocalNote(res as unknown as Note);
      }

      // If refresh is true, we still trigger updateTicker to ensure background consistency,
      // but users won't see a loading flicker due to our improved refreshData (silent call).
      refresh && this.updateTicker++

      // [Feature] Smart Polling for AI Tags
      if (res && res.id && !id && this.config.value?.isUseAiPostProcessing) {
        this.startPolling(res.id, res.updatedAt);
      }

      return res
    }
  })

  updateLocalNote(note: Note) {
    const updateList = (list: Note[]) => {
      const index = list?.findIndex(i => i.id === note.id);
      if (index !== -1 && list) {
        // Replacement of reference to trigger React re-render via shallow equality check
        list[index] = { ...list[index], ...note };
      }
    }

    if (this.blinkoList.value) updateList(this.blinkoList.value);
    if (this.noteOnlyList.value) updateList(this.noteOnlyList.value);
    if (this.todoList.value) updateList(this.todoList.value);
    if (this.noteList.value) updateList(this.noteList.value);
    if (this.todayNoteList.value) updateList(this.todayNoteList.value);
    if (this._noteList.value) updateList(this._noteList.value);

    if (this.curSelectedNote?.id === note.id) {
      this.curSelectedNote = { ...this.curSelectedNote, ...note };
    }
    this.localUpdateTicker++;
    this.updateTicker++;
  }

  deleteNote = new PromiseState({
    function: async (id: number) => {
      // Stop polling and remove local item for instant feedback
      this.stopPolling(id);
      this.removeLocalNote(id);

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

    useEffect(() => {
      const path = searchParams.get('path');
      if (path === 'notes') {
        this.noteOnlyList.resetAndCall({});
      } else if (path === 'todo') {
        this.todoList.resetAndCall({});
      } else if (path === 'archived') {
        this.archivedList.resetAndCall({});
      } else if (path === 'trash') {
        this.trashList.resetAndCall({});
      } else if (path === 'all') {
        this.noteList.resetAndCall({});
      } else {
        this.blinkoList.resetAndCall({});
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
    makeObservable(this, {
      noteContent: observable,
      _isCreateMode: observable,
      isCreateMode: computed,
      searchText: observable,
      isSearchMode: observable,
      searchFilterType: observable,
      fullscreenEditorNoteId: observable,
      curMultiSelectIds: observable,
      isMultiSelectMode: observable,
      isMultSelectAll: computed,
      noteListFilterConfig: observable,
      settingsSearchText: observable,
      excludeEmbeddingTagId: observable,
      curSelectedNote: observable,
      curSelectedNoteId: observable,
      updateTicker: observable,
      localUpdateTicker: observable,

      // 以下是子 Store 实例，它们在构造时已自行处理响应性
      // 显式标记为 false 以避免 MobX 对其进行二次包装导致的 Proxy 损坏
      createContentStorage: false,
      createAttachmentsStorage: false,
      editContentStorage: false,
      editAttachmentsStorage: false,
      config: false,
      setConfig: false,
      blinkoList: false,
      noteOnlyList: false,
      todoList: false,
      archivedList: false,
      trashList: false,
      _noteList: false,
      noteList: computed,
      dailyReviewNoteList: false,
      tagList: false,
      noteDetail: false,
      todayNoteList: false,
      upsertNote: false,
      updateNote: false,
      deleteNote: false,
      updateNotesType: false,
      archiveNotes: false,
      deleteNotes: false,
      updateNotesTags: false,
      createNote: false,
      restoreNote: false,
      permanentlyDeleteNote: false,
      getNoteById: false,
      resourceList: false,
      referenceSearchList: false,
      updateDBTask: false,
      updateArchiveTask: false,
      searchNotes: false,
      generateAITitle: false,

      // Actions
      onMultiSelectNote: action,
      onMultiSelectAll: action,
      setNoteListFilter: action,
      setExcludeEmbeddingTagId: action,
      clear: action,
      useQuery: action
    })
  }

  use() {
    useEffect(() => {
      const handleSignout = () => {
        this.clear()
      }
      this.tagList.call()
      eventBus.on('user:signout', handleSignout)
      return () => {
        eventBus.off('user:signout', handleSignout)
      }
    }, [])

    useEffect(() => {
      if (this.updateTicker === 0) return
      this.refreshData()
    }, [this.updateTicker])
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
        // Replacement of reference to trigger React re-render via shallow equality check
        list[index] = { ...list[index], ...note };
      }
    };

    if (this.blinkoList.value) updateList(this.blinkoList.value);
    if (this.noteOnlyList.value) updateList(this.noteOnlyList.value);
    if (this.todoList.value) updateList(this.todoList.value);
    if (this.noteList.value) updateList(this.noteList.value);
    if (this.todayNoteList.value) updateList(this.todayNoteList.value);
    if (this._noteList.value) updateList(this._noteList.value);

    if (this.curSelectedNote?.id === note.id) {
      this.curSelectedNote = { ...this.curSelectedNote, ...note };
    }
    // Trigger local sync only for polling to avoid full server refresh
    this.localUpdateTicker++;
  }

  pollingMap = new Map<number, NodeJS.Timeout>();

  startPolling(noteId: number, initialUpdatedAt?: Date | string) {
    if (this.pollingMap.has(noteId)) return;

    let attempts = 0;
    const maxAttempts = 15; // Reset each time an update is found (total 30s timeout per stage)

    // Leading-edge notification to sync with UI rendering
    let lastNotifyTime = 0;
    const notifyUpdate = () => {
      const now = Date.now();
      // Only notify once every 15s for the same note to avoid multi-stage update spam
      if (now - lastNotifyTime > 15000) {
        RootStore.Get(ToastPlugin).success(i18n.t("ai-tags-updated") || "AI Content Updated");
        lastNotifyTime = now;
      }
    };

    // Initial baseline state
    const getLocalNote = () => {
      return this.blinkoList.value?.find(n => n.id === noteId) ||
        this.noteOnlyList.value?.find(n => n.id === noteId) ||
        this.noteList.value?.find(n => n.id === noteId) ||
        this.todayNoteList.value?.find(n => n.id === noteId);
    }

    let baseline = getLocalNote();
    let baselineTagCount = baseline?.tags?.length || 0;
    let baselineContentLength = baseline?.content?.length || 0;
    let baselineUpdatedAt = initialUpdatedAt ? (typeof initialUpdatedAt === 'string' ? initialUpdatedAt : initialUpdatedAt) : undefined;

    const timer = setInterval(async () => {
      attempts++;

      // Stop if user is editing or exceeded max attempts without any new change
      const isEditing = this.editContentStorage.list?.some(i => i.id === noteId);
      if (isEditing || attempts > maxAttempts) {
        this.stopPolling(noteId);
        return;
      }

      try {
        const freshNote = await api.notes.detail.mutate({ id: noteId }, { context: { skipBatch: true } });
        if (!freshNote) return;

        // [POLLLING SHIELD] If the note is moved to recycle bin, stop polling silently
        if (freshNote.isRecycle) {
          this.stopPolling(noteId);
          return;
        }

        const hasNewerTimestamp = baselineUpdatedAt ? dayjs(freshNote.updatedAt).isAfter(dayjs(baselineUpdatedAt)) : false;
        const hasContentChange = (freshNote.content?.length || 0) !== baselineContentLength;
        const hasTagChange = (freshNote.tags?.length || 0) !== baselineTagCount;

        if (hasNewerTimestamp || hasContentChange || hasTagChange) {
          if ((freshNote.tags?.length || 0) === 0) {
            RootStore.Get(ToastPlugin).success(i18n.t("no-ai-tags-generated") || "暂无 AI 标签生成");
          } else {
            notifyUpdate();
          }

          // Update local UI immediately with reference replacement
          this.updateLocalNote(freshNote as unknown as Note);

          // Reset polling state for next stage (e.g. comment found -> now wait for tags)
          attempts = 0;
          baselineContentLength = freshNote.content?.length || 0;
          baselineTagCount = freshNote.tags?.length || 0;
          baselineUpdatedAt = freshNote.updatedAt;

          notifyUpdate();

          // Ensure local persistent cache is updated
          db.putNotes([freshNote as unknown as Note]).catch(console.error);
        }
      } catch (e) {
        console.warn('Polling error during dynamic poll:', e);
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
    this.noteList.call({});
  }
}

export const showToast = true;
