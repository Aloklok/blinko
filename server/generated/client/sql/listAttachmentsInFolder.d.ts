import * as $runtime from "../runtime/client"

/**
 * @param text
 * @param int4
 * @param text
 * @param int8
 * @param int8
 */
export const listAttachmentsInFolder: (text: string, int4: number, text: string, int8: number | bigint, int8: number | bigint) => $runtime.TypedSql<listAttachmentsInFolder.Parameters, listAttachmentsInFolder.Result>

export namespace listAttachmentsInFolder {
  export type Parameters = [text: string, int4: number, text: string, int8: number | bigint, int8: number | bigint]
  export type Result = {
    id: number | null
    path: string | null
    name: string | null
    size: $runtime.Decimal | null
    type: string | null
    isShare: boolean | null
    sharePassword: string | null
    noteId: number | null
    sortOrder: number | null
    createdAt: Date | null
    updatedAt: Date | null
    is_folder: boolean | null
    folder_name: string | null
  }
}
