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
  sortBy: string;
  direction: string;
}

// Interface for note upsert parameters
interface UpsertNoteParams {
  /** Note content */
  content?: string | null;
  /** Whether the note is archived */
  isArchived?: boolean;
  /** Whether the note is in recycle bin */
  isRecycle?: boolean;
  /** Note type */
  type?: NoteType;
  /** Note ID */
  id?: number;
  /** List of attachments */
  attachments?: Attachment[];
  /** Whether to refresh the list after operation */
  refresh?: boolean;
  /** Whether the note is pinned to top */
  isTop?: boolean;
  /** Whether the note is publicly shared */
  isShare?: boolean;
  /** Whether to show toast notification */
  showToast?: boolean;
  /** List of referenced note IDs */
  references?: number[];
  /** Creation time */
  createdAt?: Date;
  /** Last update time */
  updatedAt?: Date;
  /** Metadata */
  metadata?: any;
}

interface OfflineNote extends Omit<Note, 'id' | 'references'> {
  id: number;
  isOffline: boolean;
  pendingSync: boolean;
  references: { toNoteId: number }[];
}

export class BlinkoStore implements Store {
  sid = 'BlinkoStore';
  noteContent = '';
  createContentStorage = new StorageState<{ content: string }>({
    key: 'createModeNote',
    default: { content: '' }
  });
  createAttachmentsStorage = new StorageListState<{ name: string, path: string, type: string, size: number }>({
    key: 'createModeAttachments',
  });
  editContentStorage = new StorageListState<{ content: string, id: number }>({
    key: 'editModeNotes'
  });
  editAttachmentsStorage = new StorageListState<{ name: string, path: string, type: string, size: number, id: number }>({
    key: 'editModeAttachments'
  });

  searchText: string = '';
  isCreateMode: boolean = true
  curSelectedNote: Note | null = null;
  curMultiSelectIds: number[] = [];
  isMultiSelectMode: boolean = false;
  fullscreenEditorNoteId: number | null = null;
  forceQuery: number = 0;
  allTagRouter = {
    title: 'total',
    href: '/?path=all',
    icon: ''
  }
  noteListFilterConfig = {
    isArchived: false as boolean | null,
    isRecycle: false,
    isShare: null as boolean | null,
    type: 0,
    tagId: null as number | null,
    withoutTag: false,
    withFile: false,
    withLink: false,
    isUseAiQuery: false,
    startDate: null as Date | null,
    endDate: null as Date | null,
    hasTodo: false
  }
  noteTypeDefault: NoteType = NoteType.BLINKO
  currentCommonFilter: filterType | null = null
  updateTicker = 0
  fullNoteList: Note[] = []

  size = new StorageState<number>({
    key: 'pageSize',
    default: 20
  });

  // For global search
  globalSearchTerm!: '';
  // Will be set to true when the global search modal is opened
  isGlobalSearchOpen!: false;
  // For search results presentation
  searchResults = {
    notes: [],
    resources: [],
    settings: []
  };

  offlineNoteStorage = new StorageListState<OfflineNote>({ key: 'offlineNotes' });

  get offlineNotes(): OfflineNote[] {
    return this.offlineNoteStorage.list;
  }

  get isOnline(): boolean {
    return RootStore.Get(BaseStore).isOnline;
  }

  private saveOfflineNote(note: OfflineNote) {
    this.offlineNoteStorage.push(note);
  }

  private removeOfflineNote(id: number) {
    const index = this.offlineNoteStorage.list?.findIndex(note => note.id === id);
    if (index !== -1) {
      this.offlineNoteStorage.remove(index);
    }
  }

  private async getFilteredNotes(params: {
    page: number;
    size: number;
    filterConfig: any;
    offlineFilter?: (note: OfflineNote) => boolean | undefined;
  }) {
    const { page, size, filterConfig, offlineFilter = () => true } = params;
    let notes: Note[] = [];

    if (this.isOnline) {
      const queryParams = {
        ...this.noteListFilterConfig,
        ...filterConfig,
        searchText: this.searchText,
        page,
        size
      };
      notes = await api.notes.list.mutate(queryParams, { context: { skipBatch: true } });

      // 异步持久化到本地，但不阻塞主线程渲染
      if (page === 1 && notes.length > 0) {
        db.putNotes(notes).catch(err => console.error('Failed to cache notes:', err));
      }

      if (this.offlineNotes.length > 0) {
        await this.syncOfflineNotes();
      }
    } else {
      // 离线模式：优先从 IndexedDB 获取
      const cachedNotes = await db.getAllNotes();
      if (cachedNotes.length > 0) {
        notes = cachedNotes;
      }
    }

    const filteredOfflineNotes = this.offlineNotes.filter(offlineFilter);
    const mergedNotes = [...filteredOfflineNotes, ...notes].map(i => ({ ...i, isExpand: false }));

    if (!this.isOnline) {
      const start = (page - 1) * size;
      const end = start + size;
      return mergedNotes.slice(start, end);
    }

    return mergedNotes;
  }

  upsertNote = new PromiseState({
    eventKey: 'upsertNote',
    function: async (params: UpsertNoteParams) => {
      console.log("upsertNote", params)
      const {
        content = null,
        isArchived,
        isRecycle,
        type,
        id,
        attachments = [],
        refresh = true,
        isTop,
        isShare,
        showToast = true,
        references = [],
        createdAt: inputCreatedAt,
        updatedAt: inputUpdatedAt,
        metadata
      } = params;

      if (!this.isOnline && !id) {
        const now = new Date();
        const offlineNote: OfflineNote = {
          id: now.getTime(),
          content: content || '',
          type,
          isArchived: !!isArchived,
          isRecycle: !!isRecycle,
          attachments: attachments || [],
          isTop: !!isTop,
          isShare: !!isShare,
          references: references.map(refId => ({ toNoteId: refId })),
          createdAt: now,
          updatedAt: now,
          isOffline: true,
          pendingSync: true,
          tags: [],
          metadata: metadata || {}
        };

        this.saveOfflineNote(offlineNote);
        showToast && RootStore.Get(ToastPlugin).success(i18n.t("create-successfully") + '-' + i18n.t("offline-status"));
        return offlineNote;
      }

      const res = await api.notes.upsert.mutate({
        content,
        type,
        isArchived,
        isRecycle,
        id,
        attachments,
        isTop,
        isShare,
        references,
        createdAt: inputCreatedAt ? new Date(inputCreatedAt) : undefined,
        updatedAt: inputUpdatedAt ? new Date(inputUpdatedAt) : undefined,
        metadata
      });
      eventBus.emit('editor:clear')
      showToast && RootStore.Get(ToastPlugin).success(id ? i18n.t("update-successfully") : i18n.t("create-successfully"))

      // 写透缓存 (Write-through)
      if (res) {
        db.putNotes([res]).catch(err => console.error('Failed to update local cache:', err));
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

  shareNote = new PromiseState({
    function: async (params: { id: number, isCancel: boolean, password?: string, expireAt?: Date }) => {
      const res = await api.notes.shareNote.mutate(params)
      RootStore.Get(ToastPlugin).success(i18n.t("operation-success"))
      this.updateTicker++
      return res
    }
  })

  deleteNotes = new PromiseState({
    function: async (ids: number[]) => {
      const res = await api.notes.deleteMany.mutate({ ids });
      RootStore.Get(ToastPlugin).success(i18n.t("operation-success"));

      // 同步从本地缓存中移除
      for (const id of ids) {
        db.deleteNote(id).catch(err => console.error('Failed to delete note from cache:', err));
      }

      this.updateTicker++;
      return res;
    }
  })

  internalShareNote = new PromiseState({
    function: async (params: { id: number, accountIds: number[], isCancel: boolean }) => {
      const res = await api.notes.internalShareNote.mutate(params)
      RootStore.Get(ToastPlugin).success(i18n.t("operation-success"))
      this.updateTicker++
      return res
    }
  })

  getInternalSharedUsers = new PromiseState({
    function: async (id: number) => {
      return await api.notes.getInternalSharedUsers.mutate({ id })
    }
  })

  async syncOfflineNotes() {
    if (!this.isOnline) return;

    const offlineNotes = [...this.offlineNotes];
    for (const note of offlineNotes) {
      if (note.pendingSync) {
        try {
          const { id, isOffline, pendingSync, references, ...noteData } = note;
          const onlineNote: UpsertNoteParams = {
            ...noteData,
            references: references.map(ref => ref.toNoteId),
            showToast: false
          };
          await this.upsertNote.call(onlineNote);
          this.removeOfflineNote(id);
        } catch (error) {
          console.error('Failed to sync offline note:', error);
        }
      }
    }
    this.updateTicker++;
  }

  blinkoList = new PromisePageState({
    function: async ({ page, size }) => {
      return this.getFilteredNotes({
        page,
        size,
        filterConfig: {
          type: NoteType.BLINKO,
          isArchived: false,
          isRecycle: false
        },
        offlineFilter: (note: OfflineNote) => {
          return Boolean(note.type === NoteType.BLINKO && !note.isArchived && !note.isRecycle);
        }
      });
    }
  })

  noteOnlyList = new PromisePageState({
    function: async ({ page, size }) => {
      return this.getFilteredNotes({
        page,
        size,
        filterConfig: {
          type: NoteType.NOTE,
          isArchived: false,
          isRecycle: false
        },
        offlineFilter: (note: OfflineNote) => {
          return Boolean(note.type === NoteType.NOTE && !note.isArchived && !note.isRecycle);
        }
      });
    }
  })

  todoList = new PromisePageState({
    function: async ({ page, size }) => {
      return this.getFilteredNotes({
        page,
        size,
        filterConfig: {
          type: NoteType.TODO,
          isArchived: false,
          isRecycle: false
        },
        offlineFilter: (note: OfflineNote) => {
          return Boolean(note.type === NoteType.TODO && !note.isArchived && !note.isRecycle);
        }
      });
    }
  })

  archivedList = new PromisePageState({
    function: async ({ page, size }) => {
      return this.getFilteredNotes({
        page,
        size,
        filterConfig: {
          isArchived: true,
          isRecycle: false
        },
        offlineFilter: (note: OfflineNote) => {
          return Boolean(note.isArchived && !note.isRecycle);
        }
      });
    }
  })

  trashList = new PromisePageState({
    function: async ({ page, size }) => {
      return this.getFilteredNotes({
        page,
        size,
        filterConfig: {
          isRecycle: true
        },
        offlineFilter: (note: OfflineNote) => {
          return Boolean(note.isRecycle);
        }
      });
    }
  })

  noteList = new PromisePageState({
    function: async ({ page, size, ...filterConfig }) => {
      return this.getFilteredNotes({
        page,
        size,
        filterConfig: {
          isArchived: false,
          ...filterConfig
        },
        offlineFilter: (note) => {
          // Exclude notes in recycle bin
          return !note.isRecycle;
        }
      });
    }
  })

  referenceSearchList = new PromisePageState({
    function: async ({ page, size, searchText }) => {
      return await api.notes.list.mutate({
        searchText
      }, { context: { skipBatch: true } })
    }
  })

  userList = new PromiseState({
    function: async () => {
      return await api.users.list.query()
    }
  })

  noteDetail = new PromiseState({
    function: async ({ id }) => {
      return await api.notes.detail.mutate({ id }, { context: { skipBatch: true } })
    }
  })

  dailyReviewNoteList = new PromiseState({
    function: async () => {
      return await api.notes.dailyReviewNoteList.query()
    }
  })

  randomReviewNoteList = new PromiseState({
    function: async ({ limit = 30 }) => {
      return await api.notes.randomNoteList.query({ limit })
    }
  })

  resourceList = new PromisePageState({
    function: async ({ page, size, searchText, folder }) => {
      return await api.attachments.list.query({ page, size, searchText, folder })
    }
  })

  tagList = new PromiseState({
    function: async () => {
      const falttenTags = await api.tags.list.query();
      const listTags = helper.buildHashTagTreeFromDb(falttenTags)
      console.log(falttenTags, 'listTags')
      let pathTags: string[] = [];
      listTags.forEach(node => {
        pathTags = pathTags.concat(helper.generateTagPaths(node));
      });
      return { falttenTags, listTags, pathTags }
    }
  })

  get showAi() {
    return true
  }

  config = new PromiseState({
    loadingLock: false,
    function: async () => {
      // 尝试从缓存获取快照以便立即回显
      const cachedConfig = localStorage.getItem('blinko_config_snapshot');
      if (cachedConfig && !this.config.value) {
        this.config.value = JSON.parse(cachedConfig);
      }

      const res = await api.config.list.query()
      // 更新快照
      localStorage.setItem('blinko_config_snapshot', JSON.stringify(res));
      return res
    }
  })

  task = new PromiseState({
    function: async () => {
      try {
        if (RootStore.Get(UserStore).role == 'superadmin') {
          return (await api.task.list.query()) ?? [];
        }
        return []
      } catch (error) {
        return []
      }
    }
  })

  updateDBTask = new PromiseState({
    function: async (isStart) => {
      if (isStart) {
        await api.task.upsertTask.mutate({ type: 'start', task: DBBAK_TASK_NAME })
      } else {
        await api.task.upsertTask.mutate({ type: 'stop', task: DBBAK_TASK_NAME })
      }
      await this.task.call()
    }
  })
  updateArchiveTask = new PromiseState({
    function: async (isStart) => {
      if (isStart) {
        await api.task.upsertTask.mutate({ type: 'start', task: ARCHIVE_BLINKO_TASK_NAME })
      } else {
        await api.task.upsertTask.mutate({ type: 'stop', task: ARCHIVE_BLINKO_TASK_NAME })
      }
      await this.task.call()
    }
  })


  get DBTask() {
    return this.task.value?.find(i => i.name == DBBAK_TASK_NAME)
  }

  get ArchiveTask() {
    return this.task.value?.find(i => i.name == ARCHIVE_BLINKO_TASK_NAME)
  }


  async onBottom() {
    const currentPath = new URLSearchParams(window.location.search).get('path');

    if (currentPath === 'notes') {
      await this.noteOnlyList.callNextPage({});
    } else if (currentPath === 'todo') {
      await this.todoList.callNextPage({});
    } else if (currentPath === 'archived') {
      await this.archivedList.callNextPage({});
    } else if (currentPath === 'trash') {
      await this.trashList.callNextPage({});
    } else if (currentPath === 'all') {
      this.noteList.resetAndCall({});
    } else {
      await this.blinkoList.callNextPage({});
    }
  }

  onMultiSelectNote(id: number) {
    if (this.curMultiSelectIds.includes(id)) {
      this.curMultiSelectIds = this.curMultiSelectIds.filter(item => item !== id);
    } else {
      this.curMultiSelectIds.push(id);
    }
    if (this.curMultiSelectIds.length == 0) {
      this.isMultiSelectMode = false
    }
  }

  onMultiSelectRest() {
    this.isMultiSelectMode = false
    this.curMultiSelectIds = []
    // Fix: Remove updateTicker++ to avoid unnecessary list refresh and duplicate display
    // this.updateTicker++
  }

  firstLoad() {
    this.tagList.call()
    this.config.call()
    this.dailyReviewNoteList.call()
    this.task.call()

    // 尝试预加载缓存数据以实现秒开
    this.loadFromCache()
  }

  async loadFromCache() {
    try {
      const cachedNotes = await db.getAllNotes();
      if (cachedNotes && cachedNotes.length > 0) {
        const sorted = _.orderBy(cachedNotes, [(n: any) => new Date(n.updatedAt)], ['desc']);
        const size = Number(this.size.value);

        // 注入 Blinko 列表
        if (this.blinkoList.value?.length === 0) {
          const blinkos = sorted.filter(n => n.type === NoteType.BLINKO && !n.isArchived && !n.isRecycle);
          this.blinkoList.setValue(blinkos.slice(0, size));
        }

        // 注入笔记列表
        if (this.noteOnlyList.value?.length === 0) {
          const notes = sorted.filter(n => n.type === NoteType.NOTE && !n.isArchived && !n.isRecycle);
          this.noteOnlyList.setValue(notes.slice(0, size));
        }

        // 注入待办列表
        if (this.todoList.value?.length === 0) {
          const todos = sorted.filter(n => n.type === NoteType.TODO && !n.isArchived && !n.isRecycle);
          this.todoList.setValue(todos.slice(0, size));
        }

        // 注入归档列表
        if (this.archivedList.value?.length === 0) {
          const archived = sorted.filter(n => n.isArchived && !n.isRecycle);
          this.archivedList.setValue(archived.slice(0, size));
        }

        // 注入全部列表 (All Notes)
        if (this.noteList.value?.length === 0) {
          const all = sorted.filter(n => !n.isArchived && !n.isRecycle);
          this.noteList.setValue(all.slice(0, size));
        }
      }
    } catch (err) {
      console.warn('Load from cache failed:', err);
    }
  }


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

  private clear() {
    this.createContentStorage.clear()
    this.editContentStorage.clear()
  }

  use() {
    useEffect(() => {
      if (RootStore.Get(UserStore).id) {
        console.log('firstLoad', RootStore.Get(UserStore).id)
        this.firstLoad()
      }
    }, [RootStore.Get(UserStore).id])

    useEffect(() => {
      if (this.updateTicker == 0) return
      console.log('updateTicker', this.updateTicker)
      this.refreshData()
    }, [this.updateTicker])
  }

  useQuery() {
    const [searchParams] = useSearchParams();
    const location = useLocation();
    useEffect(() => {
      const tagId = searchParams.get('tagId');
      if (tagId && Number(tagId) === this.noteListFilterConfig.tagId) {
        return;
      }

      const withoutTag = searchParams.get('withoutTag');
      const withFile = searchParams.get('withFile');
      const withLink = searchParams.get('withLink');
      const searchText = searchParams.get('searchText') || this.searchText;
      const hasTodo = searchParams.get('hasTodo');
      const path = searchParams.get('path');

      this.noteListFilterConfig.type = NoteType.BLINKO
      this.noteTypeDefault = NoteType.BLINKO
      this.noteListFilterConfig.tagId = null
      this.noteListFilterConfig.isArchived = false
      this.noteListFilterConfig.withoutTag = false
      this.noteListFilterConfig.withLink = false
      this.noteListFilterConfig.withFile = false
      this.noteListFilterConfig.isRecycle = false
      this.noteListFilterConfig.startDate = null
      this.noteListFilterConfig.endDate = null
      this.noteListFilterConfig.isShare = null
      this.noteListFilterConfig.hasTodo = false

      // Fix: Clear multi-select state when switching paths to avoid stale selections
      this.curMultiSelectIds = [];
      this.isMultiSelectMode = false;

      if (path == 'notes') {
        this.noteListFilterConfig.type = NoteType.NOTE
        this.noteOnlyList.resetAndCall({});
      } else if (path == 'todo') {
        this.noteListFilterConfig.type = NoteType.TODO
        this.todoList.resetAndCall({});
      } else if (path == 'all') {
        this.noteListFilterConfig.type = -1
        this.noteList.resetAndCall({});
      } else if (path == 'archived') {
        this.noteListFilterConfig.type = -1
        this.noteListFilterConfig.isArchived = true
        this.archivedList.resetAndCall({});
      } else if (path == 'trash') {
        this.noteListFilterConfig.type = -1
        this.noteListFilterConfig.isRecycle = true
        this.trashList.resetAndCall({});
      } else {
        this.blinkoList.resetAndCall({});
      }

      if (tagId) {
        this.noteListFilterConfig.tagId = Number(tagId) as number
      }
      if (withoutTag) {
        this.noteListFilterConfig.withoutTag = true
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
    makeAutoObservable(this)
    eventBus.on('user:signout', () => {
      this.clear()
    })
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

  startPolling(noteId: number) {
    this.stopPolling(noteId);
    let attempts = 0;
    const maxAttempts = 15; // 30s total (2s interval)

    const timer = setInterval(async () => {
      attempts++;

      // [Safety Guard] If user is editing this note (has local draft), stop polling immediately
      // to avoid overwriting their work with server data.
      const isEditing = this.editContentStorage.list?.some(i => i.id === noteId);
      if (isEditing || attempts > maxAttempts) {
        this.stopPolling(noteId);
        return;
      }

      try {
        const freshNote = await api.notes.detail.mutate({ id: noteId }, { context: { skipBatch: true } });

        // Check if tags have been generated (assuming 0 tags initially or just checking if any exist now)
        // We also check if the fresh note actually has tags. 
        if (freshNote && freshNote.tags && freshNote.tags.length > 0) {
          // If we previously had 0 tags, and now we have some, it's an update!
          // Or if we just want to ensure we get the latest AI tags.

          this.updateLocalList(freshNote as unknown as Note);
          this.stopPolling(noteId);
          RootStore.Get(ToastPlugin).success(i18n.t("ai-tags-updated") || "AI Tags Updated");

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
