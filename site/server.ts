// The Surfaces page: the page itself at /, with its wall drawn in, /wall for
// a shuffle of it, the library from /dist, and Atkinson Hyperlegible Next for
// the page's own type. Nothing here fetches anything from anywhere else.
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs"
import { createServer } from "node:http"
import { extname, join, normalize } from "node:path"
import { gzipSync } from "node:zlib"
import { toHtml } from "../src/render/layers.ts"
import { generate } from "../src/core/generate.ts"
import { tiles, wall } from "./wall.js"

const ROOT = new URL("..", import.meta.url).pathname
const PORT = Number(process.env.PORT ?? 4178)
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
}
const FONTS = join(ROOT, "node_modules/@fontsource-variable/atkinson-hyperlegible-next/files")

// The page with its wall in it, so it shows on the first paint
// instead of after the library loads in the browser. Drawn once: it is the
// same every time.
const FIRST_WALL = wall(tiles(0), generate, toHtml)
// Each wall asked for, kept: a shuffle or a site's look always draws the same.
const walls = new Map<string, { html: string; gzip: Uint8Array }>()
function wallFor(query: URLSearchParams) {
  const shuffle = Number(query.get("shuffle") ?? 0)
  const count = Number(query.get("count") ?? 60)
  const color = query.get("color")
  if (!Number.isInteger(shuffle) || shuffle < 0 || shuffle > 9999 || !Number.isInteger(count) || count < 1 || count > 240) return null
  if (color !== null && color !== "" && !/^#[0-9a-f]{6}$/i.test(color)) return null
  const key = JSON.stringify([shuffle, count, color])
  if (!walls.has(key)) {
    if (walls.size > 200) walls.clear()
    const html = wall(tiles(shuffle, count), generate, toHtml, { drawn: count, ...(color ? { color } : null) })
    walls.set(key, { html, gzip: gzipSync(html) })
  }
  return walls.get(key)!
}

const page = () =>
  readFileSync(join(ROOT, "site/index.html"), "utf8").replace(`<div class="wall" id="wall" aria-hidden="true"></div>`, `<div class="wall" id="wall" aria-hidden="true">${FIRST_WALL}</div>`)

createServer(async (request, response) => {
  const url = new URL(request.url!, "http://localhost")
  if (url.pathname === "/") {
    // The wall's grain is most of the page, and compresses to a fifth.
    const gzip = /\bgzip\b/.test(String(request.headers["accept-encoding"] ?? ""))
    response.writeHead(200, { "content-type": TYPES[".html"]!, ...(gzip ? { "content-encoding": "gzip" } : null) }).end(gzip ? gzipSync(page()) : page())
    return
  }
  if (url.pathname === "/wall") {
    // A shuffle of the wall, or the wall in a brand's colour, drawn here so
    // the page only swaps it in.
    const drawn = wallFor(url.searchParams)
    if (!drawn) {
      response.writeHead(400).end("Ask for /wall?shuffle=1&count=60, and color=#0078bf for a brand's colour")
      return
    }
    const gzip = /\bgzip\b/.test(String(request.headers["accept-encoding"] ?? ""))
    response.writeHead(200, { "content-type": TYPES[".html"]!, "cache-control": "public, max-age=86400", ...(gzip ? { "content-encoding": "gzip" } : null) }).end(gzip ? drawn.gzip : drawn.html)
    return
  }
  const path = normalize(decodeURIComponent(url.pathname))
  const file =
    path === "/next" ? join(ROOT, "site/next.html")
    : path === "/wall.js" ? join(ROOT, "site/wall.js")
    : path.startsWith("/dist/") ? join(ROOT, path)
    : path.startsWith("/fonts/") ? join(FONTS, path.slice(7))
    : ""
  if (!file || !(file.startsWith(join(ROOT, "dist")) || file.startsWith(FONTS) || file === join(ROOT, "site/next.html") || file === join(ROOT, "site/wall.js")) || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404).end("Not found")
    return
  }
  // A font never changes under its name, so a reader fetches it once.
  response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "text/plain", ...(file.startsWith(FONTS) ? { "cache-control": "public, max-age=31536000, immutable" } : null) })
  createReadStream(file).pipe(response)
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Surfaces at http://localhost:${PORT}`)
})
