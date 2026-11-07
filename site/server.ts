// The Surfaces page: the page itself at /, with its wall's first rows drawn in,
// the library from /dist, Atkinson Hyperlegible Next for the page's own
// type, /read, which fetches a public site for the page to read in the
// browser, /suggest, sites whose names start with what is typed, and /icon,
// each suggested site's favicon.
import { lookup } from "node:dns/promises"
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs"
import { createServer } from "node:http"
import { extname, join, normalize } from "node:path"
import { gzipSync } from "node:zlib"
import { toHtml } from "../src/render/layers.ts"
import { generate } from "../src/core/generate.ts"
import { tiles, wall } from "./wall.js"
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

// The page with its wall's first rows in it, so they show on the first paint
// instead of after the library loads in the browser. Drawn once: they are
// the same every time.
const FIRST_WALL = wall(tiles(0), generate, toHtml)
// Each site's favicon, from DuckDuckGo's icon service, fetched here so the
// reader's browser tells no one else what was typed. Kept a while; a site
// with none is a 404, and the page shows its first letter instead.
// Each is kept as its fetch, so one already on its way is shared.
const icons = new Map<string, Promise<{ type: string; data: Uint8Array } | null>>()
function icon(domain: string) {
  if (!/^(?=.{3,100}$)[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(domain)) return Promise.resolve(null)
  const key = domain.toLowerCase()
  if (!icons.has(key)) {
    if (icons.size > 400) icons.clear()
    icons.set(
      key,
      fetch(`https://icons.duckduckgo.com/ip3/${key}.ico`, { signal: AbortSignal.timeout(2500) })
        .then(async (response) => {
          const type = response.headers.get("content-type") ?? ""
          const data = new Uint8Array(await response.arrayBuffer())
          return response.ok && /^image\//.test(type) && data.length < 100_000 ? { type, data } : null
        })
        .catch(() => null)
    )
  }
  return icons.get(key)!
}

const page = () =>
  readFileSync(join(ROOT, "site/index.html"), "utf8").replace(`<div class="wall" id="wall" aria-hidden="true"></div>`, `<div class="wall" id="wall" aria-hidden="true">${FIRST_WALL}</div>`)

// Sites for what is typed, from Clearbit's free company search, kept a while
// so typing back over a word asks nothing twice. The search knows companies,
// not every site, so the address typed, or a word under the usual endings,
// is suggested too when it is a real domain. A search that fails or takes too
// long suggests nothing; the address typed still works.
const suggested = new Map<string, { name: string; domain: string }[]>()
// Adult sites, which the search ranks high for common words and which have
// no place in a product's suggestions.
const ADULT = /porn|xxx|nsfw|hentai|escort|xhamster|xvideos|redtube|youporn|brazzers|stripchat|chaturbate|livejasmin|bongacams|camsoda|myfreecams|cam4\b|onlyfans|fansly|manyvids/i
const ENDINGS = ["com", "app", "io", "co", "dev", "ai", "so"]
// Whether a domain has an address, within a second.
const resolves = (domain: string) =>
  Promise.race([lookup(domain).then(() => true), new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1000))]).catch(() => false)

async function companies(query: string) {
  try {
    const response = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(2500) })
    const found = response.ok ? ((await response.json()) as { name?: unknown; domain?: unknown }[]) : []
    return found
      .filter((site) => typeof site.name === "string" && typeof site.domain === "string" && !ADULT.test(`${site.name} ${site.domain}`))
      .map((site) => ({ name: String(site.name), domain: String(site.domain) }))
  } catch {
    return []
  }
}

async function suggest(typed: string) {
  const query = typed.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").slice(0, 60)
  if (query.length < 2) return []
  if (suggested.has(query)) return suggested.get(query)!
  try {
    // An address as typed leads; a single word is tried under each ending.
    const typedDomain = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(query)
    const guesses = typedDomain ? [query] : /^[a-z0-9-]{2,40}$/.test(query) ? ENDINGS.map((ending) => `${query}.${ending}`) : []
    const [found, real] = await Promise.all([companies(query), Promise.all(guesses.map(async (domain) => ((await resolves(domain)) ? domain : null)))])
    const known = new Set(found.map((site) => site.domain))
    const domains = real.filter((domain): domain is string => Boolean(domain) && !known.has(domain!) && !ADULT.test(domain!)).map((domain) => ({ name: domain, domain }))
    const sites = (typedDomain ? [...domains, ...found] : [...found, ...domains]).slice(0, 6)
    if (suggested.size > 500) suggested.clear()
    suggested.set(query, sites)
    // Their icons start now, so they arrive with the list, not after it.
    for (const site of sites) void icon(site.domain)
    return sites
  } catch {
    return []
  }
}

createServer(async (request, response) => {
  const url = new URL(request.url!, "http://localhost")
  if (url.pathname === "/") {
    // The wall's grain is most of the page, and compresses to a fifth.
    const gzip = /\bgzip\b/.test(String(request.headers["accept-encoding"] ?? ""))
    response.writeHead(200, { "content-type": TYPES[".html"]!, ...(gzip ? { "content-encoding": "gzip" } : null) }).end(gzip ? gzipSync(page()) : page())
    return
  }
  if (url.pathname === "/suggest") {
    response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(await suggest(url.searchParams.get("q") ?? "")))
    return
  }
  if (url.pathname === "/icon") {
    const found = await icon(url.searchParams.get("domain") ?? "")
    if (!found) response.writeHead(404, { "cache-control": "public, max-age=86400" }).end()
    else response.writeHead(200, { "content-type": found.type, "cache-control": "public, max-age=86400" }).end(found.data)
    return
  }
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
