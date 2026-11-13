// One headless Chrome page, driven over the DevTools protocol with nothing
// installed: enough to open a page, run a line in it and take its picture.
// One page at a time, by design: the film is drawn frame by frame, gently.
//
// It talks to Chrome over a pipe, not a WebSocket: a full frame's PNG is
// several MB, and Node's own WebSocket closes on a message that size.
import { execFileSync, spawn } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

export async function openChrome({ width = 1920, height = 1080 } = {}) {
  const profile = mkdtempSync(join(tmpdir(), "surfaces-film-"))
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--remote-debugging-pipe",
      `--user-data-dir=${profile}`,
      `--window-size=${width},${height}`,
      "--force-device-scale-factor=1",
      "--force-color-profile=srgb",
      "--hide-scrollbars",
      "--mute-audio",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--allow-file-access-from-files",
      // Drawn on the processor: the same picture every run, and a screenshot never waits on a graphics card.
      "--disable-gpu-compositing",
      "about:blank",
    ],
    // Chrome reads what it is asked on its fd 3 and answers on its fd 4, each message ending in a zero byte.
    { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] },
  )
  const [, , , ask, answer] = chrome.stdio
  let closed = false
  let last = 0
  const asked = new Map()
  const waiting = []
  const gone = new Promise((resolve) => chrome.on("exit", resolve)).then((code) => {
    closed = true
    for (const { reject } of asked.values()) reject(new Error(`Chrome closed (${code}).`))
    asked.clear()
  })

  let heard = []
  answer.on("data", (chunk) => {
    let from = 0
    for (let end = chunk.indexOf(0, from); end !== -1; end = chunk.indexOf(0, from)) {
      heard.push(chunk.subarray(from, end))
      const message = JSON.parse(Buffer.concat(heard).toString("utf8"))
      heard = []
      from = end + 1
      if (message.id) {
        const { resolve, reject } = asked.get(message.id) ?? {}
        asked.delete(message.id)
        if (message.error) reject?.(new Error(message.error.message))
        else resolve?.(message.result)
      } else {
        for (const waiter of waiting.filter((w) => w.method === message.method)) {
          waiting.splice(waiting.indexOf(waiter), 1)
          waiter.resolve(message.params)
        }
      }
    }
    if (from < chunk.length) heard.push(chunk.subarray(from))
  })
  let sessionId
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      if (closed) return reject(new Error("Chrome is closed."))
      asked.set(++last, { resolve, reject })
      ask.write(`${JSON.stringify({ id: last, method, params, ...(sessionId ? { sessionId } : {}) })}\0`)
    })
  const once = (method) => new Promise((resolve) => waiting.push({ method, resolve }))
  // A call Chrome leaves unanswered fails and says which, instead of waiting for ever.
  const within = (seconds, what, promise) => {
    let late
    const limit = new Promise((_, reject) => (late = setTimeout(() => reject(new Error(`Chrome did not ${what} in ${seconds}s.`)), seconds * 1000)))
    return Promise.race([promise, limit]).finally(() => clearTimeout(late))
  }

  const { targetInfos } = await within(90, "start", send("Target.getTargets"))
  const page = targetInfos.find((target) => target.type === "page")
  sessionId = (await send("Target.attachToTarget", { targetId: page.targetId, flatten: true })).sessionId
  await send("Page.enable")
  await send("Runtime.enable")
  // `density` 2 draws every CSS pixel as four: a picture twice the size, for sharper prints and for frames scaled down smooth.
  const size = (w, h, density = 1) => send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: density, mobile: false })
  await size(width, height)

  return {
    size,
    async goto(url) {
      const loaded = once("Page.loadEventFired")
      const went = await send("Page.navigate", { url })
      if (went.errorText) throw new Error(`Could not open ${url}: ${went.errorText}`)
      await within(60, `load ${url}`, loaded)
    },
    // Runs an expression in the page and gives back its value, a promise's too.
    async run(expression) {
      const result = await within(60, "run the page's code", send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }))
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
      return result.result.value
    },
    // A PNG of the page, or of one box of it.
    async picture(box) {
      const shot = await within(
        60,
        "take a picture",
        send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true, ...(box ? { clip: { ...box, scale: 1 } } : {}) }),
      )
      return Buffer.from(shot.data, "base64")
    },
    // What this Chrome holds in memory, in MB, across all its processes.
    memory() {
      const rows = execFileSync("ps", ["-axo", "rss=,command="], { encoding: "utf8", maxBuffer: 1 << 26 }).split("\n")
      const kb = rows.filter((row) => row.includes(profile)).reduce((sum, row) => sum + Number.parseInt(row, 10), 0)
      return Math.round(kb / 1024)
    },
    async close() {
      if (!closed) chrome.kill()
      await gone
      rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    },
  }
}

export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
