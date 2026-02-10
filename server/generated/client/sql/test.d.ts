import * as $runtime from "../runtime/client"

/**
 */
export const test: () => $runtime.TypedSql<test.Parameters, test.Result>

export namespace test {
  export type Parameters = []
  export type Result = {
    result: number | null
  }
}
