import * as $runtime from "../runtime/client"

/**
 * @param int4
 * @param timestamptz
 */
export const monthlyWordStats: (int4: number, timestamptz: Date) => $runtime.TypedSql<monthlyWordStats.Parameters, monthlyWordStats.Result>

export namespace monthlyWordStats {
  export type Parameters = [int4: number, timestamptz: Date]
  export type Result = {
    month: string | null
    count: bigint | null
  }
}
