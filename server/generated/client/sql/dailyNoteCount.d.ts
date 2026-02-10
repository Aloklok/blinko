import * as $runtime from "../runtime/client"

/**
 * @param int4
 */
export const dailyNoteCount: (int4: number) => $runtime.TypedSql<dailyNoteCount.Parameters, dailyNoteCount.Result>

export namespace dailyNoteCount {
  export type Parameters = [int4: number]
  export type Result = {
    date: string | null
    count: bigint | null
  }
}
