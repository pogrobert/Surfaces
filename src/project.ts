import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
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
  // The site's DESIGN.md, when it keeps one, which says its brand outright.
  design: string
  // Its logo's SVG, relative to the root: one named for a logo before a
  // mark, and either before the icon a browser tab shows.
  logo?: string
  // The font files it loads, for drawing titles in its own type.
  fonts: FontFile[]
  // Every file read, relative to the root, for saying what was read.
  read: string[]
}

// A font file a site loads: its family as the site names it, its weight
// (a variable font's range), and the file, relative to the root.
export type FontFile = { family: string; weight: number | [number, number]; file: string }

const FONT_FILE = /\.(woff2|woff|ttf|otf)$/i
const FORMATS = ["woff2", "woff", "ttf", "otf"]
const unquote = (text: string) => text.trim().replace(/^["']|["']$/g, "")

// Fonts a stylesheet declares with @font-face. A url from the root is in the
// public folder; any other is beside the stylesheet.
function fontFaces(root: string, file: string, text: string, publicDir: string): FontFile[] {
  const found: FontFile[] = []
  for (const block of text.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const body = block[1]!
    if (/font-style\s*:\s*(italic|oblique)/.test(body)) continue
    const family = body.match(/font-family\s*:\s*([^;]+)/)?.[1]
    const weights = body.match(/font-weight\s*:\s*(\d+)(?:\s+(\d+))?/)
    const urls = [...body.matchAll(/url\(\s*["']?([^)"']+)["']?\s*\)/g)].map((match) => match[1]!.split(/[?#]/)[0]!).filter((url) => FONT_FILE.test(url))
    const url = urls.sort((a, b) => FORMATS.indexOf(a.split(".").pop()!.toLowerCase()) - FORMATS.indexOf(b.split(".").pop()!.toLowerCase()))[0]
    if (!family || !url || /^(https?:|data:)/.test(url)) continue
    const path = url.startsWith("/") ? join(root, publicDir, url) : join(dirname(file), url)
    if (!existsSync(path)) continue
    const weight: FontFile["weight"] = weights?.[2] ? [Number(weights[1]), Number(weights[2])] : Number(weights?.[1] ?? 400)
    found.push({ family: unquote(family), weight, file: relative(root, path) })
  }
  return found
}

// Fonts loaded in code: next/font/local's files, beside the code that names
// them, and @fontsource packages' files in node_modules.
function fontsLoaded(root: string, file: string, text: string): FontFile[] {
  const found: FontFile[] = []
  if (/["']next\/font\/local["']/.test(text)) {
    for (const call of text.matchAll(/localFont\s*\(\s*\{([\s\S]*?)\}\s*\)\s*(?:;|\n)/g)) {
      const body = call[1]!
      const family = body.match(/variable\s*:\s*["'`]--(?:font-)?([\w-]+)["'`]/)?.[1]
      for (const match of body.matchAll(/["'`]([^"'`]+\.(?:woff2|woff|ttf|otf))["'`]([^{}]{0,80})/gi)) {
        const path = join(dirname(file), match[1]!)
        if (!existsSync(path)) continue
        const weight = match[2]!.match(/weight\s*:\s*["'`](\d+)(?:\s+(\d+))?/)
        found.push({ family: family ?? match[1]!.split("/").pop()!.replace(FONT_FILE, ""), weight: weight?.[2] ? [Number(weight[1]), Number(weight[2])] : Number(weight?.[1] ?? 400), file: relative(root, path) })
      }
    }
  }
  for (const match of text.matchAll(/["']@fontsource(-variable)?\/([\w-]+)/g)) {
    const name = match[2]!
    const dir = join(root, "node_modules", `@fontsource${match[1] ?? ""}`, name, "files")
    if (!existsSync(dir)) continue
    for (const entry of readdirSync(dir)) {
      const parts = entry.match(new RegExp(`^${name}-latin-(\\d+|wght)-normal\\.woff2$`))
      if (parts) found.push({ family: name.replace(/-/g, " "), weight: parts[1] === "wght" ? [100, 900] : Number(parts[1]), file: relative(root, join(dir, entry)) })
    }
  }
  return found
}

const SKIP = new Set(["node_modules", ".git", ".next", ".nuxt", ".svelte-kit", ".astro", ".output", ".vercel", "dist", "build", "out", "coverage", "public", "vendor", ".turbo", ".cache"])
const STYLES = /\.(css|scss|sass|less)$/
const CONFIG = /^tailwind\.config\.(js|cjs|mjs|ts)$/
// The files that hold a site's shell: its root layout, document or page
// template, and the home page.
const SHELL = /^(layout|root|_document|_app|app|\+layout|index|Layout|BaseLayout|Base|landing|home|page|\+page)\.(tsx|jsx|ts|js|html|astro|svelte|vue)$/
// And the modules a site loads its fonts in, as next/font/local is.
const FONT_MODULE = /^(fonts?|typography)\.(tsx|jsx|ts|js|mjs)$/
const MOST_BYTES = 3_000_000

function walk(root: string, dir: string, found: string[], depth = 0) {
  if (depth > 6) return
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith(".")) continue
    const path = join(dir, name)
    // A link is left alone: it can lead back up the tree, or out of it.
    let stat
    try {
      stat = lstatSync(path)
    } catch {
      continue
    }
    if (stat.isSymbolicLink()) continue
    if (stat.isDirectory()) walk(root, path, found, depth + 1)
    else if (stat.size < 1_000_000 && (STYLES.test(name) || CONFIG.test(name) || SHELL.test(name) || FONT_MODULE.test(name))) found.push(path)
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

function packageOf(root: string): Record<string, any> {
  if (!existsSync(join(root, "package.json"))) return {}
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
    return pkg && typeof pkg === "object" && !Array.isArray(pkg) ? pkg : {}
  } catch (error) {
    throw new Error(`package.json isn't valid JSON (${(error as Error).message}); fix it, then run this again`)
  }
}

export function readProject(root: string): Project {
  const pkg = packageOf(root)
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
  const fonts: FontFile[] = []
  const publicDir = deps["@sveltejs/kit"] ? "static" : "public"
  // Shells first, the root layout before pages, so a site's own title and
  // fonts are read before a component's, and before stylesheets fill the
  // budget.
  const ORDER = ["root", "layout", "_document", "_app", "app", "+layout", "Layout", "BaseLayout", "Base", "index", "landing", "home", "page", "+page"]
  const rank = (file: string) => (STYLES.test(file) ? 100 : ORDER.indexOf(file.split("/").pop()!.split(".")[0]!)) + file.split("/").length / 100
  for (const file of files.sort((a, b) => rank(a) - rank(b))) {
    let text: string
    try {
      text = readFileSync(file, "utf8")
    } catch {
      // A file this user can't read says nothing of the site.
      continue
    }
    if (total + text.length > MOST_BYTES) continue
    total += text.length
    read.push(relative(root, file))
    fonts.push(...fontFaces(root, file, text, publicDir), ...fontsLoaded(root, file, text))
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
  const best = (file: string) => {
    const name = file.split("/").pop()!.toLowerCase()
    return name.startsWith("logo") || name.startsWith("wordmark") ? 0 : name.startsWith("brand") || name.includes("mark") ? 1 : 2
  }
  const logoFile = [...marks].sort((a, b) => best(a) - best(b) || a.split("/").length - b.split("/").length)[0]
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
  const design = ["DESIGN.md", "design.md", "docs/DESIGN.md"].map((file) => join(root, file)).find((file) => existsSync(file) && statSync(file).size < 1_000_000)
  if (design) read.push(relative(root, design))
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
    design: design ? readFileSync(design, "utf8") : "",
    ...(logoFile ? { logo: relative(root, logoFile) } : null),
    fonts: fonts.filter((font, index) => fonts.findIndex((other) => other.file === font.file) === index),
    read,
  }
}
