import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { toOklch } from "./core/color.ts"

// A site as its files show it, for the CLI: its name, its framework, and the
// text readPage() reads a look from, gathered from where sites keep it. All
// of it is read from disk as text; nothing runs and nothing is fetched.

export const FRAMEWORKS = ["next", "astro", "sveltekit", "nuxt", "react-router", "vite", "static"] as const
export type Framework = (typeof FRAMEWORKS)[number]

export type Project = {
  root: string
  // A name for the brand: the site's domain when it says one, else the package's name.
  name?: string
  framework: Framework
  typescript: boolean
  // Where source lives: "src" when there is one, else "app", where React
  // Router and the Next.js App Router keep it, else the root.
  source: string
  // The App Router's folder, for a Next.js site.
  app?: string
  html: string
  css: string
  // Every file read, relative to the root, for saying what was read.
  read: string[]
}

const SKIP = new Set(["node_modules", ".git", ".next", ".nuxt", ".svelte-kit", ".astro", ".output", ".vercel", "dist", "build", "out", "coverage", "public", "vendor", ".turbo", ".cache"])
const STYLES = /\.(css|scss|sass|less)$/
const CONFIG = /^tailwind\.config\.(js|cjs|mjs|ts)$/
// The files that hold a site's shell: its root layout, document or page
// template, and the home page.
const SHELL = /^(layout|root|_document|_app|app|\+layout|index|Layout|BaseLayout|Base|landing|home|page|\+page)\.(tsx|jsx|ts|js|html|astro|svelte|vue)$/
const MOST_BYTES = 3_000_000

function walk(root: string, dir: string, found: string[], depth = 0) {
  if (depth > 6) return
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith(".")) continue
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) walk(root, path, found, depth + 1)
    else if (stat.size < 1_000_000 && (STYLES.test(name) || CONFIG.test(name) || SHELL.test(name))) found.push(path)
  }
}

const quoted = (source: string, key: string) =>
  [...source.matchAll(new RegExp(String.raw`\b${key}\s*[:=]\s*(?:\{\s*default\s*:\s*)?["'\`]([^"'\`\n]{3,200})["'\`]`, "g"))].map((match) => match[1]!)

// Faces loaded in code, which no stylesheet names: next/font and @fontsource.
function fontsInCode(source: string) {
  const names: string[] = []
  for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']next\/font\/google["']/g)) {
    for (const name of match[1]!.split(",")) names.push(name.trim().split(/\s+as\s+/)[0]!.replace(/_/g, " "))
  }
  for (const match of source.matchAll(/["']@fontsource(?:-variable)?\/([\w-]+)/g)) names.push(match[1]!.replace(/-/g, " "))
  return [...new Set(names.filter(Boolean))]
}

function frameworkOf(deps: Record<string, string>, root: string): Framework {
  if (deps.next) return "next"
  if (deps.astro) return "astro"
  if (deps["@sveltejs/kit"]) return "sveltekit"
  if (deps.nuxt) return "nuxt"
  if (deps["react-router"] || deps["@react-router/dev"] || deps["@remix-run/react"]) return "react-router"
  if (deps.vite) return "vite"
  return existsSync(join(root, "index.html")) ? "static" : "vite"
}

// The site's logo, wherever sites keep one: SVGs named for a logo, an icon or
// a mark, in the public folder and the usual asset folders.
const LOGO = /^(logo|favicon|icon|brand|mark|logomark|wordmark)[\w.-]*\.svg$/i
function logos(root: string) {
  const found: string[] = []
  const look = (dir: string, depth: number) => {
    if (depth > 3 || !existsSync(dir) || !statSync(dir).isDirectory()) return
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name.startsWith(".")) continue
      const path = join(dir, name)
      if (statSync(path).isDirectory()) look(path, depth + 1)
      else if (LOGO.test(name) && statSync(path).size < 200_000) found.push(path)
    }
  }
  for (const dir of ["public", "static", "assets", "src/assets", "app", "src/app", "src/lib", "."]) look(join(root, dir), dir === "." ? 3 : 0)
  return [...new Set(found)]
}

// A logo's own colour: the one its SVG fills most with, leaving out black,
// white and greys, which a logo uses for type and outlines.
function logoColour(files: string[]) {
  const counts = new Map<string, number>()
  for (const file of files) {
    for (const match of readFileSync(file, "utf8").matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
      const hex = match[1]!.length === 3 ? `#${[...match[1]!].map((d) => d + d).join("")}`.toLowerCase() : `#${match[1]!}`.toLowerCase()
      if (toOklch(hex).c < 0.06) continue
      counts.set(hex, (counts.get(hex) ?? 0) + 1)
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0]
}

export function readProject(root: string): Project {
  const pkg = existsSync(join(root, "package.json")) ? (JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as Record<string, any>) : {}
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  const files: string[] = []
  walk(root, root, files)
  let total = 0
  const html: string[] = []
  const css: string[] = []
  const read: string[] = []
  const titles: string[] = []
  const descriptions: string[] = []
  const faces: string[] = []
  // Shells first, the root layout before pages, so a site's own title and
  // fonts are read before a component's, and before stylesheets fill the
  // budget.
  const ORDER = ["root", "layout", "_document", "_app", "app", "+layout", "Layout", "BaseLayout", "Base", "index", "landing", "home", "page", "+page"]
  const rank = (file: string) => (STYLES.test(file) ? 100 : ORDER.indexOf(file.split("/").pop()!.split(".")[0]!)) + file.split("/").length / 100
  for (const file of files.sort((a, b) => rank(a) - rank(b))) {
    const text = readFileSync(file, "utf8")
    if (total + text.length > MOST_BYTES) continue
    total += text.length
    read.push(relative(root, file))
    if (STYLES.test(file) || CONFIG.test(file.split("/").pop()!)) css.push(text)
    else {
      html.push(text)
      titles.push(...quoted(text, "title"))
      descriptions.push(...quoted(text, "description"))
      faces.push(...fontsInCode(text))
    }
  }
  // Metadata written as code, as React Router's meta() and Next's metadata
  // are, made into the tags readPage() reads; and faces loaded in code into
  // rules it reads, the first for headings and the next for text.
  const meta = [
    titles[0] && `<title>${titles[0]}</title>`,
    descriptions[0] && `<meta name="description" content="${descriptions[0].replace(/"/g, "&quot;")}">`,
    pkg.description && !descriptions[0] && `<meta name="description" content="${String(pkg.description).replace(/"/g, "&quot;")}">`,
  ].filter(Boolean)
  const loaded = faces.length ? [`h1 { font-family: "${faces[0]}"; }`, faces[1] ? `body { font-family: "${faces[1]}"; }` : ""].join("\n") : ""
  // The logo's colour, named for the brand, so readPage() ranks it first.
  const marks = logos(root)
  const logo = logoColour(marks)
  read.push(...marks.map((file) => relative(root, file)))
  const homepage = typeof pkg.homepage === "string" ? pkg.homepage.match(/^https?:\/\/([^/]+)/)?.[1] : undefined
  // The domain the site's own shell names most, as its og:url, og:image or
  // canonical link do, leaving out the hosts every site links to.
  const hosts = new Map<string, number>()
  for (const match of html.join("\n").matchAll(/https?:\/\/(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi)) {
    const host = match[1]!.toLowerCase()
    if (/(googleapis|gstatic|github|google|facebook|twitter|x\.com|schema\.org|w3\.org|cloudflare|jsdelivr|unpkg|vercel\.app|localhost|example\.)/.test(host)) continue
    hosts.set(host, (hosts.get(host) ?? 0) + 1)
  }
  const domain = homepage ?? [...hosts].sort((a, b) => b[1] - a[1])[0]?.[0]
  const folder = (name: string) => existsSync(join(root, name)) && statSync(join(root, name)).isDirectory()
  const source = folder("src") ? "src" : folder("app") ? "app" : "."
  const app = ["src/app", "app"].find((dir) => existsSync(join(root, dir)) && statSync(join(root, dir)).isDirectory())
  const framework = frameworkOf(deps, root)
  return {
    root,
    ...(domain || pkg.name ? { name: domain ?? String(pkg.name).replace(/^@[^/]+\//, "") } : null),
    framework,
    typescript: existsSync(join(root, "tsconfig.json")),
    source,
    ...(framework === "next" && app ? { app } : null),
    html: [...meta, ...html].join("\n"),
    css: [logo ? `:root { --brand-logo: ${logo}; }` : "", loaded, ...css].join("\n"),
    read,
  }
}
