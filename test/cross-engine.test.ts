import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const DIGEST = fileURLToPath(
  new URL("./support/engine-digest.js", import.meta.url)
)
// Safari's engine, shipped with every Mac.
const JSC =
  "/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc"

test(
  "JavaScriptCore computes the same bytes as V8",
  { skip: existsSync(JSC) ? false : "no jsc on this machine" },
  () => {
    // 24 seeds of every style on every run, 120 under test:full.
    const count = String(process.env.SURFACES_FULL === "1" ? 120 : 24)
    const v8 = execFileSync(process.execPath, [DIGEST, count], { encoding: "utf8" })
    const jsc = execFileSync(JSC, ["-m", DIGEST, "--", count], { encoding: "utf8" })
    assert.match(v8, /^\d+ covers/)
    assert.equal(jsc, v8)
  }
)
