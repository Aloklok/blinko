import * as $runtime from "../runtime/client"

/**
 * @param int4
 * @param int8
 */
export const randomNotes: (int4: number, int8: number | bigint) => $runtime.TypedSql<randomNotes.Parameters, randomNotes.Result>

export namespace randomNotes {
  export type Parameters = [int4: number, int8: number | bigint]
  export type Result = {
    id: number
    type: number
    content: string
    isArchived: boolean
    isRecycle: boolean
    isShare: boolean
    isTop: boolean
    sharePassword: string
    metadata: $runtime.JsonValue | null
    createdAt: Date
    updatedAt: Date
    isReviewed: boolean
    accountId: number | null
    shareEncryptedUrl: string | null
    shareExpiryDate: Date | null
    shareMaxView: number | null
    shareViewCount: number | null
    sortOrder: number
  }
}
