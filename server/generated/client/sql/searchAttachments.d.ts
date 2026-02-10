import * as $runtime from "../runtime/client"

/**
 * @param int4
 * @param text
 * @param int8
 * @param int8
 */
export const searchAttachments: (int4: number, text: string, int8: number | bigint, int8: number | bigint) => $runtime.TypedSql<searchAttachments.Parameters, searchAttachments.Result>

export namespace searchAttachments {
  export type Parameters = [int4: number, text: string, int8: number | bigint, int8: number | bigint]
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
