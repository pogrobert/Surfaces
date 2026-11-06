// The studio at /, the directions board at /directions and the contact sheet
// at /sheet load /dist as modules,
// which a file:// page can't do.
import { createReadStream, existsSync, statSync } from "node:fs"
import { createServer } from "node:http"
import { extname, join, normalize } from "node:path"

const ROOT = new URL("..", import.meta.url).pathname
const PORT = Number(process.env.PORT ?? 4177)
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
}

createServer((request, response) => {
  const path = normalize(decodeURIComponent(request.url!.split("?")[0]!))
  const file = join(
    ROOT,
    path === "/"
      ? "scripts/studio.html"
      : path === "/directions"
        ? "scripts/directions.html"
        : path === "/sheet"
        ? "sheet/index.html"
          : path.startsWith("/dist/")
            ? path
            : `sheet${path}`
  )
  if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404).end("Not found")
    return
  }
  response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "text/plain" })
  createReadStream(file).pipe(response)
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Studio at http://localhost:${PORT}, directions at /directions, contact sheet at /sheet`)
})
