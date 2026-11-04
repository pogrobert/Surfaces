// Checks, gently, that every moving style loops for free. Each cover is drawn
// as mount() and the React component draw it, as a stack of layers, in one
// headless Chrome at its normal frame rate, with nothing slowed and nothing
// pushed: a cover is jumped into its loop and watched for a second and a half.
// A loop that only moves finished layers costs the main thread nothing, so
// any work there, and above all any layout, means something is being drawn
// again on every frame.
//
//   pnpm bench:motion            every moving style
//   pnpm bench:motion halftone   one style
//
// Needs Google Chrome. The rest of the guarantee, that loops only move layers
// and only by transform and opacity, is in test/layers.test.ts and needs no
// browser at all. This never runs a browser flat out: a benchmark that heats
// the machine it runs on measures the wrong thing.
import { spawn } from "node:child_process"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { cpus, loadavg, tmpdir } from "node:os"
import { join } from "node:path"
import { catalog, generate, toHtml } from "../dist/index.js"
import type { StyleName } from "../dist/index.js"

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
// Main-thread time a loop may take, in milliseconds a second: the odd
// timer, never a frame's worth of work.
const MOST_MAIN_MS = 2
const SEEDS = ["bench-a", "bench-b"]
const WATCH_MS = 1500

if (!existsSync(CHROME)) {
  console.error(`No Chrome at ${CHROME}; set CHROME to its path.`)
  process.exit(1)
}
// On a machine already busy, the numbers say nothing; better to wait.
const [load] = loadavg()
if (load! > cpus().length) {
  console.error(`The machine is busy (load ${load!.toFixed(1)} on ${cpus().length} cores); try again when it is quieter.`)
  process.exit(1)
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const server = spawn(process.execPath, [new URL("./serve-sheet.ts", import.meta.url).pathname], {
  env: { ...process.env, PORT: "4188" },
  stdio: "ignore",
})
const port = 9600 + Math.floor(Math.random() * 300)
// A throwaway profile, removed when the run ends.
const profile = mkdtempSync(join(tmpdir(), "surfaces-bench-"))
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--window-size=1200,700",
    "--force-device-scale-factor=2",
    "about:blank",
  ],
  { stdio: "ignore" }
)

type Event = { name: string; ph: string; dur?: number }
let failed = 0
try {
  let target: { webSocketDebuggerUrl: string } | undefined
  for (let i = 0; i < 60 && !target; i++) {
    await wait(250)
    try {
      const list = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()) as { type: string; webSocketDebuggerUrl: string }[]
      target = list.find((item) => item.type === "page")
    } catch {}
  }
  if (!target) throw new Error("Chrome did not start")
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve) => socket.addEventListener("open", resolve))
  let next = 0
  const pending = new Map<number, (result: unknown) => void>()
  let events: Event[] = []
  let traced: (() => void) | null = null
  socket.addEventListener("message", (message) => {
    const data = JSON.parse(String(message.data))
    if (data.id && pending.has(data.id)) {
      pending.get(data.id)!(data.result)
      pending.delete(data.id)
    }
    if (data.method === "Tracing.dataCollected") events.push(...data.params.value)
    if (data.method === "Tracing.tracingComplete") traced?.()
  })
  const send = (method: string, params = {}) =>
    new Promise<unknown>((resolve) => {
      const id = ++next
      pending.set(id, resolve)
      socket.send(JSON.stringify({ id, method, params }))
    })
  await send("Page.enable")
  await send("Runtime.enable")

  const loops = (style: StyleName, seed: string) =>
    toHtml(generate({ style, seed, motion: "loop" })).includes("infinite")
  const asked = process.argv.slice(2) as StyleName[]
  const styles = (asked.length ? asked : catalog.map((entry) => entry.style)).filter((style) =>
    SEEDS.some((seed) => loops(style, seed))
  )
  for (const style of styles) {
    for (const seed of SEEDS) {
      if (!loops(style, seed)) continue
      // Twelve seconds in, past every arrival, and playing.
      await send("Page.navigate", { url: `http://localhost:4188/one.html?style=${style}&seed=${seed}&mode=layers&skip=12` })
      for (let i = 0; i < 40; i++) {
        await wait(100)
        const ready = (await send("Runtime.evaluate", { expression: "document.body?.dataset.ready ?? ''", returnByValue: true })) as {
          result?: { value?: string }
        }
        if (ready.result?.value) break
      }
      // The first frames draw every layer once, a heavy blur for a while.
      await wait(1200)
      events = []
      await send("Tracing.start", { categories: "devtools.timeline,disabled-by-default-devtools.timeline", transferMode: "ReportEvents" })
      await wait(WATCH_MS)
      const done = new Promise<void>((resolve) => (traced = resolve))
      await send("Tracing.end")
      await done
      const seconds = WATCH_MS / 1000
      const of = (names: string[]) =>
        events.filter((event) => names.includes(event.name)).reduce((total, event) => total + (event.dur ?? 0) / 1000, 0) / seconds
      const main = of(["UpdateLayoutTree", "Layout", "PrePaint", "Paint", "Layerize", "Commit"])
      const layouts = events.filter((event) => event.name === "Layout" && event.ph !== "E").length / seconds
      const pass = main <= MOST_MAIN_MS && layouts === 0
      if (!pass) failed++
      console.log(
        `${pass ? "ok  " : "FAIL"} ${style.padEnd(11)} ${seed.padEnd(8)} main thread ${main.toFixed(1).padStart(5)} ms/s, ${layouts.toFixed(0).padStart(3)} layouts/s`
      )
    }
  }
  socket.close()
} finally {
  chrome.kill()
  server.kill()
  await wait(500)
  rmSync(profile, { recursive: true, force: true })
}
console.log(failed ? `${failed} covers do work on every frame` : "Every moving style loops without drawing anything again")
process.exit(failed ? 1 : 0)
