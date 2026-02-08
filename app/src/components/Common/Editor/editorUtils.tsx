import { helper } from "@/lib/helper"
import { Attachment } from "@shared/lib/types"
import { FileType } from "./type"
import { PromiseState } from "@/store/standard/PromiseState"
import { IsTagSelectVisible } from "../PopoverFloat/tagSelectPop"
import Vditor from "vditor"

export type ViewMode = "wysiwyg" | "sv" | "ir" | "raw"

export type ToolbarProps = {
  store: any;
  files: FileType[];
  openFileDialog: () => void;
  getInputProps: any;
  mode: 'create' | 'edit';
  isPc: boolean;
  canSend: boolean;
  isSendLoading?: boolean;
  onSend?: (args: any) => Promise<any>;
  onChange?: (content: string) => void;
}

export type UploadAction = {
  key: string;
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  showCondition?: boolean;
}

export const HandleFileType = (originFiles: Attachment[]): FileType[] => {
  if (originFiles?.length == 0) return []
  const res = originFiles?.map(file => {
    const extension = helper.getFileExtension(file.name)
    const previewType = helper.getFileType(file.type, file.name)

    // For existing files (path exists), we initialize PromiseState with the value 
    // to avoid triggering an unnecessary loading state in the UI.
    const uploadPromise = new PromiseState({
      function: async () => file.path,
      value: file.path || null,
      loadingLock: false
    })

    return {
      name: file.name,
      size: file.size,
      previewType,
      extension: extension ?? '',
      preview: file.path,
      uploadPromise,
      type: file.type,
      metadata: (file as any).metadata
    }
  })
  // We only call() if it's not already resolved to prevent state flicker
  res?.forEach(i => {
    if (!i.uploadPromise.value && i.preview) {
      i.uploadPromise.call()
    }
  })
  return res
}

export const getEditorElements = (mode: ViewMode, editor: Vditor) => {
  if (!editor) return
  switch (mode) {
    case 'sv':
      return editor.vditor.sv?.element
    case 'ir':
      return editor.vditor.ir?.element
    case 'wysiwyg':
      return editor.vditor.wysiwyg?.element
    default:
      return editor.vditor.wysiwyg?.element
  }
}

export const FocusEditorFixMobile = () => {
  try {
    requestAnimationFrame(() => {
      const editorElements = document.querySelectorAll('.vditor-ir .vditor-reset') as NodeListOf<HTMLElement>
      if (editorElements.length === 0) return

      if (editorElements.length > 0) {
        editorElements.forEach(editorElement => {
          editorElement.focus()
          const range = document.createRange()
          range.selectNodeContents(editorElement)
          range.collapse(false)
          const selection = window.getSelection()
          selection?.removeAllRanges()
          selection?.addRange(range)
        })
      }
    })
  } catch (error) {

  }
}