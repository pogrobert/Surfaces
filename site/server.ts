// The Surfaces page: the page itself at /, the library from /dist,
// Atkinson Hyperlegible Next for the page's own type, and /read, which
// fetches a public site for the page to read in the browser.
import { createReadStream, existsSync, statSync } from "node:fs"
import { createServer } from "node:http"
import { extname, join, normalize } from "node:path"
import { readSite } from "./read.ts"

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

createServer(async (request, response) => {
  const url = new URL(request.url!, "http://localhost")
  if (url.pathname === "/read") {
    try {
      const site = await readSite(url.searchParams.get("url") ?? "")
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(site))
    } catch (error) {
      const message = (error as Error).name === "TimeoutError" ? "The site took too long to answer" : (error as Error).message
      response.writeHead(422, { "content-type": "application/json" }).end(JSON.stringify({ error: message }))
    }
    return
  }
  const path = normalize(decodeURIComponent(url.pathname))
  const file =
    path === "/" ? join(ROOT, "site/index.html")
    : path === "/mockups" ? join(ROOT, "site/mockups.html")
    : path.startsWith("/dist/") ? join(ROOT, path)
    : path.startsWith("/fonts/") ? join(FONTS, path.slice(7))
    : ""
  if (!file || !(file.startsWith(join(ROOT, "dist")) || file.startsWith(FONTS) || file === join(ROOT, "site/index.html") || file === join(ROOT, "site/mockups.html")) || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404).end("Not found")
    return
  }
  // A font never changes under its name, so a reader fetches it once.
  response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "text/plain", ...(file.startsWith(FONTS) ? { "cache-control": "public, max-age=31536000, immutable" } : null) })
  createReadStream(file).pipe(response)
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Surfaces at http://localhost:${PORT}`)
})
