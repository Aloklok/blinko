import * as $runtime from "../runtime/client"

/**
 * @param text
 */
export const getPgBossLastRun: (text: string) => $runtime.TypedSql<getPgBossLastRun.Parameters, getPgBossLastRun.Result>

export namespace getPgBossLastRun {
  export type Parameters = [text: string]
  export type Result = {
    completed_on: Date | null
  }
}
