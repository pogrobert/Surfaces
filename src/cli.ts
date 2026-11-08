#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { createBrand, directions } from "./brand.ts"
import { hash } from "./core/random.ts"
import { STYLES } from "./styles/index.ts"
import type { Brand, BrandChoices } from "./brand.ts"
import { describe } from "./core/describe.ts"
import { generate } from "./core/generate.ts"
import { judge } from "./core/judge.ts"
import type { Scene, TextLayer } from "./core/scene.ts"
import { measure } from "./core/type.ts"
import { nearest, validate } from "./core/validate.ts"
import { readPage, USES } from "./page.ts"
import type { PageFacts, Use } from "./page.ts"
import { readProject } from "./project.ts"
import type { FontFile, Project } from "./project.ts"
import { rasterize } from "./raster.ts"
import { outlinePath } from "./render/glyphs.ts"
import { encodeJpeg } from "./render/jpeg.ts"
import { toSvg } from "./render/svg.ts"
import { loadFont } from "./type/fontfile.ts"
import type { TitleFont } from "./type/fontfile.ts"

// The command line, for a person or an agent in a project:
//
//   npx @pogrobert/surfaces init         reads the site, writes its brand, wires it in
//   npx @pogrobert/surfaces directions   a board of looks to choose from, as an image
//   npx @pogrobert/surfaces preview      the brand's covers as images, to look at
//   npx @pogrobert/surfaces check        whether they hold, said plainly
//
// Everything it does is a rule on the project's own files. Nothing is sent
// anywhere; images go in .surfaces/, which an agent can open and look at.

const HELP = `Usage: surfaces <command> [options]

  init         Read this site, choose its look, write the brand and wire it in
  directions   Draw a board of looks for this site, to choose from
  kit          Write the brand's link preview and headers into the public folder
  preview      Draw the brand's covers as images, to look at
  check        Say whether the brand's covers hold, and why not

Options
  --name <domain>     The brand's name (init and directions; default: the site's domain)
  --pick <n>          Take the nth direction (init; default 1, our pick)
  --title <text>      A title to draw (preview, check; repeatable)
  --use <use>         post, card, hero, og, x, linkedin or email (preview, check; default og)
  --brand <file>      The brand module (default: surfaces.ts beside the source)
  --out <path>        Where images go (default .surfaces/)
  --logo <file>       The logo kit sets on them (default: the site's logo SVG; none for none)
  --force             Let kit replace files that are there already
  --dry-run           Say what init or kit would write, and write nothing
`

type Args = { command: string; flags: Map<string, string[]> }

const OPTIONS = ["name", "pick", "title", "use", "brand", "out", "logo", "force", "dry-run"]

function parse(argv: string[]): Args {
  const [command = "help", ...rest] = argv
  const flags = new Map<string, string[]>()
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]!
    if (!arg.startsWith("--")) throw new Error(`Unexpected "${arg}". ${HELP}`)
    const name = arg.slice(2)
    if (!OPTIONS.includes(name)) throw new Error(`Unknown option "--${name}".${nearest(name, OPTIONS) || ` Options are ${OPTIONS.map((option) => `--${option}`).join(", ")}.`}`)
    const value = name === "dry-run" || name === "force" ? "true" : rest[++i]
    if (value === undefined) throw new Error(`"--${name}" needs a value`)
    flags.set(name, [...(flags.get(name) ?? []), value])
  }
  return { command, flags }
}

const one = (args: Args, name: string) => args.flags.get(name)?.at(-1)

// A use named on the command line, checked.
function useOf(value: string): Use {
  if (!(USES as readonly string[]).includes(value)) throw new Error(`Unknown use "${value}". Use ${USES.join(", ")}.${nearest(value, USES)}`)
  return value as Use
}
const OUT = ".surfaces"
const SAMPLES = ["How the new search works", "What we learned from ten thousand bookings", "Notes on shipping every day"]

// The look a brand module keeps, read as data so the CLI needs nothing of
// the project's own build to see it.
function readLook(file: string): BrandChoices {
  const text = readFileSync(file, "utf8")
  const literal = text.match(/export const look\s*=\s*(\{[\s\S]*?\})(?:\s*as const)?\s*\n/)?.[1]
  if (!literal) throw new Error(`${file} has no "export const look = { ... }"; run "surfaces init" to write one`)
  try {
    return JSON.parse(literal)
  } catch {
    // Hand-edited: unquoted keys, single quotes, a trailing comma.
    try {
      return JSON.parse(literal.replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":').replace(/'/g, '"').replace(/,\s*\}/g, "}"))
    } catch {
      throw new Error(`The look in ${file} isn't plain data; write it as JSON, or run "surfaces init --pick 1" to write it again`)
    }
  }
}

// The site's own font a brand module names, loaded, for drawing its titles.
async function readTitleFont(root: string, file: string) {
  const path = readFileSync(file, "utf8").match(/export const titleFont\s*=\s*["'`]([^"'`]+)["'`]/)?.[1]
  if (!path) return undefined
  if (!existsSync(join(root, path))) throw new Error(`${relative(root, file)} names titleFont "${path}", which isn't there; point it at the font file, or remove it for the bundled faces`)
  try {
    return await loadFont(readFileSync(join(root, path)))
  } catch (error) {
    throw new Error(`titleFont "${path}": ${(error as Error).message}`)
  }
}

function brandFile(project: Project, args: Args) {
  const given = one(args, "brand")
  if (given) {
    if (!existsSync(join(project.root, given))) throw new Error(`No brand module at ${given}; pass --brand <file> with the file init wrote, such as src/surfaces.ts`)
    return join(project.root, given)
  }
  const candidates = [join(project.source, "surfaces.ts"), "surfaces.ts", join(project.source, "surfaces.js"), "surfaces.js"]
  const found = candidates.map((file) => join(project.root, file)).find(existsSync)
  if (!found) throw new Error(`No brand module here; run "surfaces init" first, or pass --brand <file>`)
  return found
}

async function jpeg(scene: Scene, width = scene.output.w) {
  const image = await rasterize(toSvg(scene, { target: "resvg", outlines: outlinePath }), width)
  return encodeJpeg(image.pixels, image.width, image.height)
}

// Whether a use sets its title into the image: everywhere but a card, which
// has it beside.
const titled = (use: Use) => use !== "card"

const drawn = (brand: Brand, use: Use, title: string, font?: TitleFont) => {
  const light = brand.look.theme === "auto" ? createBrand({ name: brand.name, ...brand.look, theme: "light" }) : brand
  return generate(light.input(use, titled(use) ? { title, drawTitle: font ? { font } : true } : { title }))
}

// A heading family as one word to compare by: "Fraunces Variable", serif
// and var(--font-fraunces) are both "fraunces".
const familyKey = (family: string) =>
  (family.match(/var\(\s*--(?:font-)?([\w-]+)/)?.[1] ?? family.split(",")[0]!)
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/\s*variable$/, "")
    .replace(/[^a-z0-9]/g, "")

// The file of the face the site's headings are set in, when the site keeps
// one, so titles drawn into images are in its own type: the face nearest a
// title's weight, a static one before a variable one, which draws only its
// default, and only one that draws the alphabet.
async function titleFontOf(project: Project, facts: PageFacts, log: (line: string) => void) {
  const heading = facts.fonts?.heading ?? facts.fonts?.body
  const key = heading ? familyKey(heading) : ""
  const keys = new Set(project.fonts.map((font) => familyKey(font.family)))
  const matches = (font: FontFile) => {
    const own = familyKey(font.family)
    return key ? own === key || (own.length > 2 && key.length > 2 && (own.includes(key) || key.includes(own))) : keys.size === 1
  }
  const distance = (font: FontFile) => (typeof font.weight === "number" ? Math.abs(font.weight - 650) : 251)
  for (const candidate of project.fonts.filter(matches).sort((a, b) => distance(a) - distance(b))) {
    try {
      const font = await loadFont(readFileSync(join(project.root, candidate.file)))
      if (missingLetters(font)) continue
      log(`Titles drawn into images are set in the site's own ${font.family} ${font.weight}, from ${candidate.file}`)
      return candidate.file
    } catch (error) {
      log(`Not ${candidate.file} for titles: ${(error as Error).message}`)
    }
  }
  if (heading && /next\/font\/google/.test(project.html)) {
    log(`The site's headings come from Google Fonts through next/font, which keeps no file in the project, so titles drawn into images are set in the bundled sans or serif. To use its own, put the .woff2 or .ttf in public/fonts/ and set titleFont in the brand module to its path.`)
  }
  return undefined
}

const missingLetters = (font: TitleFont) => [..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"].some((char) => !font.advance.has(char.codePointAt(0)!))

// One line of type as a path, for labels on a board.
function label(text: string, x: number, y: number, size: number, fill: string, font: "sans" | "serif" = "sans") {
  const layer: TextLayer = { kind: "text", id: "label", font, size, tone: "ink", align: "start", lines: [{ text, x, y, width: measure(text, font) * size }] }
  return `<path d="${outlinePath(layer)}" fill="${fill}"/>`
}

// A scene as a nested SVG at x, y, w across.
function placed(scene: Scene, x: number, y: number, w: number) {
  const h = (w * scene.output.h) / scene.output.w
  const svg = toSvg(scene, { target: "resvg", outlines: outlinePath })
    .replace(/^<\?xml[^>]*>/, "")
    .replace(/^(<svg[^>]*?) width="[^"]*" height="[^"]*"/, "$1")
    .replace(/^<svg /, `<svg x="${x}" y="${y}" width="${w}" height="${h}" `)
  return { svg, h }
}

// Every direction as a row: its number, its look and why, a post's cover and
// a link preview with their titles.
async function board(options: Brand[], titles: string[]) {
  const W = 1360
  const pad = 24
  const cover = 560
  const og = 500
  const parts: string[] = []
  let y = pad
  for (const [index, brand] of options.entries()) {
    const head = `${index + 1}. ${brand.look.style}${index === 0 ? " (our pick)" : ""}`
    parts.push(label(head, pad, y + 24, 24, "#17171a"))
    const reason = (brand.why.find((line) => line.startsWith("style ")) ?? "").replace(/^style \w+: /, "")
    if (reason) parts.push(label(reason.length > 120 ? `${reason.slice(0, 117)}…` : reason, pad, y + 50, 15, "#6b6b72"))
    const top = y + 66
    const a = placed(drawn(brand, "post", titles[index % titles.length]!), pad, top, cover)
    const b = placed(drawn(brand, "og", titles[(index + 1) % titles.length]!), pad * 2 + cover, top, og)
    parts.push(a.svg, b.svg)
    y = top + Math.max(a.h, b.h) + pad * 1.5
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Math.ceil(y)}" viewBox="0 0 ${W} ${Math.ceil(y)}"><rect width="100%" height="100%" fill="#f5f4f1"/>${parts.join("")}</svg>`
  const image = await rasterize(svg, W)
  return encodeJpeg(image.pixels, image.width, image.height, 88)
}

function factsOf(project: Project): PageFacts {
  return readPage(project.html, project.css, project.design)
}

function nameOf(project: Project, args: Args) {
  const name = one(args, "name") ?? project.name
  if (!name) throw new Error(`No name for the brand: pass --name <domain>, such as --name acme.dev`)
  return name
}

async function writeBoard(root: string, args: Args, options: Brand[], log: (line: string) => void) {
  try {
    const file = join(root, one(args, "out") ?? OUT, "directions.jpg")
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, await board(options, SAMPLES))
    log(`Board of directions: ${relative(root, file)}`)
  } catch (error) {
    log(`No board drawn: ${(error as Error).message}`)
  }
}

const describeLook = (brand: Brand) => JSON.stringify({ name: brand.name, ...brand.look })

async function directionsCommand(root: string, args: Args, log: (line: string) => void) {
  const project = readProject(root)
  const options = directions({ name: nameOf(project, args), ...factsOf(project) })
  options.forEach((brand, index) => {
    log(`${index + 1}. ${describeLook(brand)}`)
    for (const reason of brand.why) log(`   ${reason}`)
  })
  await writeBoard(root, args, options, log)
  log(`Keep one with: surfaces init --pick <n>`)
}

async function previewCommand(root: string, args: Args, log: (line: string) => void) {
  const project = readProject(root)
  const file = brandFile(project, args)
  const brand = createBrand(readLook(file))
  const font = await readTitleFont(root, file)
  const use = useOf(one(args, "use") ?? "og")
  const titles = args.flags.get("title") ?? SAMPLES
  const out = join(root, one(args, "out") ?? OUT)
  mkdirSync(out, { recursive: true })
  for (const [index, title] of titles.entries()) {
    const scene = drawn(brand, use, title, font)
    const path = join(out, `${use}-${index + 1}.jpg`)
    writeFileSync(path, await jpeg(scene))
    log(`${relative(root, path)}  ${describe(scene, { title })}`)
  }
}

async function checkCommand(root: string, args: Args, log: (line: string) => void) {
  const project = readProject(root)
  const file = brandFile(project, args)
  const brand = createBrand(readLook(file))
  const font = await readTitleFont(root, file)
  const uses = (args.flags.get("use") ?? ["post", "og", "hero", "card"]).map(useOf)
  const titles = args.flags.get("title") ?? SAMPLES
  const themes = brand.look.theme === "auto" ? (["light", "dark"] as const) : [brand.look.theme]
  let failed = 0
  for (const theme of themes) {
    const themed = createBrand({ name: brand.name, ...brand.look, theme })
    for (const use of uses) {
      for (const title of titles) {
        const input = themed.input(use, titled(use) ? { title, drawTitle: font ? { font } : true } : { title })
        const scene = generate(input)
        const verdict = judge(scene)
        // A title set without some of its letters doesn't hold either.
        const warnings = validate(input).warnings
        const ok = verdict.ok && !warnings.length
        if (!ok) failed++
        log(JSON.stringify({ use, theme, title, ok, contrast: Number(verdict.contrast.toFixed(2)), coverage: Number(verdict.coverage.toFixed(3)), problems: verdict.problems, warnings }))
      }
    }
  }
  log(failed ? `${failed} cover${failed > 1 ? "s" : ""} don't hold; see "problems" and "warnings" above.` : `Every cover holds: content reads at 4.5:1 or better, every title is set whole, and no cover is blank or a wall.`)
  return failed ? 1 : 0
}

// The block a project's agent instructions carry, between markers so init can
// update it in place.
function agentBlock(module: string) {
  return `<!-- surfaces:start -->
## Covers and link previews (@pogrobert/surfaces)

- For pictures the site repeats: covers, link previews, docs, changelog and email headers, empty states, slides. A picture of one particular thing (a product, a person) is a photo or an image model's job.
- The brand is \`brand\`, exported from \`${module}\`. Change its look there; \`npx @pogrobert/surfaces directions\` draws others to choose from.
- The pictures are art; the words are the site's, in its own type. A cover is \`brand.cover({ title })\`, \`brand.card\`, \`brand.hero\`, \`brand.banner\`. React: \`<Cover brand={brand} title={title} />\` from \`@pogrobert/surfaces/react\` sets the title in the page's font where the art keeps room.
- Words over the art: \`text: "bottom-left"\` (or any place) keeps them room; \`scene.areas[0]\` is its box and \`ink\`. A link preview file is \`toJpeg(brand.og({ title, drawTitle: true }))\` from \`@pogrobert/surfaces/png\`; alt \`describe(scene, { title })\`. In the site's own font: \`drawTitle: { font: await loadFont(await readFile(titleFont)) }\`, where the brand module exports \`titleFont\`.
- \`id: post.slug\` keeps a cover's art when its title is edited. There are no seeds to choose.
- Look before shipping: \`npx @pogrobert/surfaces preview --title "..."\` writes images to .surfaces/; \`check\` says whether they hold. \`kit\` writes the preview and headers, with the site's logo.
- Everything else: node_modules/@pogrobert/surfaces/docs/api.md.
<!-- surfaces:end -->`
}

function withBlock(existing: string, block: string) {
  const marked = /<!-- surfaces:start -->[\s\S]*?<!-- surfaces:end -->/
  if (marked.test(existing)) return existing.replace(marked, block)
  return `${existing.replace(/\s*$/, "")}${existing.trim() ? "\n\n" : ""}${block}\n`
}

// The Next.js link preview for the whole site, from the App Router's own
// convention: the site's title, set into its brand.
function nextImage(fromApp: string, title: string, font: boolean) {
  if (!font) {
    return `import { toJpeg } from "@pogrobert/surfaces/png"
import { brand } from "${fromApp}"

// The site's link preview, drawn from its brand. A route of its own, such as
// a post, gets one the same way, with that page's title.
export const size = { width: 1200, height: 630 }
export const contentType = "image/jpeg"
export const alt = ${JSON.stringify(title)}

export default async function Image() {
  const jpeg = await toJpeg(brand.og({ title: alt, drawTitle: true }))
  return new Response(jpeg as BodyInit, { headers: { "content-type": contentType } })
}
`
  }
  return `import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { loadFont } from "@pogrobert/surfaces"
import { toJpeg } from "@pogrobert/surfaces/png"
import { brand, titleFont } from "${fromApp}"

// The site's link preview, drawn from its brand, its title in the site's own
// font. A route of its own, such as a post, gets one the same way, with that
// page's title.
export const size = { width: 1200, height: 630 }
export const contentType = "image/jpeg"
export const alt = ${JSON.stringify(title)}

export default async function Image() {
  const font = await loadFont(await readFile(join(process.cwd(), titleFont)))
  const jpeg = await toJpeg(brand.og({ title: alt, drawTitle: { font } }))
  return new Response(jpeg as BodyInit, { headers: { "content-type": contentType } })
}
`
}

const RECIPES: Record<string, string> = {
  "react-router": `A route module that returns the image, e.g. app/routes/og.$slug.ts:
  export async function loader({ params }) {
    const jpeg = await toJpeg(brand.og({ title: titleOf(params.slug), drawTitle: true }))
    return new Response(jpeg, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=31536000, immutable" } })
  }`,
  astro: `A static endpoint, e.g. src/pages/og/[slug].jpg.ts, with getStaticPaths from your collection:
  export async function GET({ props }) {
    return new Response(await toJpeg(brand.og({ title: props.title, drawTitle: true })), { headers: { "content-type": "image/jpeg" } })
  }`,
  sveltekit: `A server route, e.g. src/routes/og/[slug].jpg/+server.ts, prerendered:
  export const prerender = true
  export async function GET({ params }) {
    return new Response(await toJpeg(brand.og({ title: titleOf(params.slug), drawTitle: true })), { headers: { "content-type": "image/jpeg" } })
  }`,
  nuxt: `A server route, e.g. server/routes/og/[slug].jpg.ts:
  export default defineEventHandler(async (event) => {
    setHeader(event, "content-type", "image/jpeg")
    return await toJpeg(brand.og({ title: titleOf(getRouterParam(event, "slug")), drawTitle: true }))
  })`,
}

async function initCommand(root: string, args: Args, log: (line: string) => void) {
  const dry = Boolean(one(args, "dry-run"))
  const project = readProject(root)
  const name = nameOf(project, args)
  const facts = factsOf(project)
  log(`Read ${project.read.length} files (${project.framework}${project.typescript ? ", TypeScript" : ""}): ${project.read.slice(0, 6).join(", ")}${project.read.length > 6 ? ", ..." : ""}`)
  const options = directions({ name, ...facts })
  const pick = Number(one(args, "pick") ?? 1)
  if (!Number.isInteger(pick) || pick < 1 || pick > options.length) throw new Error(`"--pick" must be from 1 to ${options.length}`)
  const brand = options[pick - 1]!
  log(`Look: ${describeLook(brand)}`)
  for (const reason of brand.why) log(`  ${reason}`)

  const titleFont = await titleFontOf(project, facts, log)

  const writes: { path: string; text: string; skip?: string }[] = []
  const extension = project.typescript ? "ts" : "js"
  const module = join(project.source, `surfaces.${extension}`)
  const look = JSON.stringify({ name, ...brand.look }, null, 2)
  writes.push({
    path: module,
    text: `import { createBrand } from "@pogrobert/surfaces"

// This site's brand: every cover, link preview and header comes from it.
// Written by \`npx @pogrobert/surfaces init\`; change any choice here, or run
// \`npx @pogrobert/surfaces directions\` to see others.
export const look = ${look}${project.typescript ? " as const" : ""}

export const brand = createBrand(look)
${titleFont ? `
// The site's heading font, for titles drawn into images:
// drawTitle: { font: await loadFont(await readFile(titleFont)) }
export const titleFont = ${JSON.stringify(titleFont)}
` : ""}`,
  })
  for (const file of ["AGENTS.md", "CLAUDE.md"]) {
    const path = join(root, file)
    if (file === "CLAUDE.md" && !existsSync(path)) continue
    const existing = existsSync(path) ? readFileSync(path, "utf8") : ""
    // A CLAUDE.md that already points at AGENTS.md needs nothing of its own.
    if (file === "CLAUDE.md" && /AGENTS\.md/.test(existing) && !/surfaces:start/.test(existing)) continue
    writes.push({ path: file, text: withBlock(existing, agentBlock(module)) })
  }
  // The images preview and directions draw are for looking at, not keeping.
  const ignore = join(root, ".gitignore")
  if (existsSync(ignore) && !/^\/?\.surfaces\/?$/m.test(readFileSync(ignore, "utf8"))) {
    writes.push({ path: ".gitignore", text: `${readFileSync(ignore, "utf8").replace(/\s*$/, "")}\n.surfaces/\n` })
  }
  if (project.framework === "next" && project.app) {
    const path = join(project.app, `opengraph-image.${extension === "ts" ? "tsx" : "jsx"}`)
    const title = facts.words?.split(/[.·|–—-]/)[0]?.trim() || name
    const fromApp = relative(join(root, project.app), join(root, module)).replace(/\.(ts|js)$/, "").replace(/^(?!\.)/, "./")
    const taken = ["tsx", "ts", "jsx", "js", "png", "jpg"].some((ext) => existsSync(join(root, project.app!, `opengraph-image.${ext}`)))
    writes.push({ path, text: nextImage(fromApp, title, Boolean(titleFont)), ...(taken ? { skip: "the site has a link preview image already" } : null) })
  }

  for (const write of writes) {
    const path = join(root, write.path)
    const exists = existsSync(path)
    if (write.skip) {
      log(`Left ${write.path}: ${write.skip}`)
      continue
    }
    if (write.path === module && exists && !one(args, "pick")) {
      log(`Left ${write.path}: it is set up already; pass --pick <n> to take another direction`)
      continue
    }
    log(`${dry ? "Would write" : exists ? "Updated" : "Wrote"} ${write.path}`)
    if (!dry) {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, write.text)
    }
  }
  if (!dry) await writeBoard(root, args, options, log)

  log(`Next:`)
  log(`  npm install @pogrobert/surfaces @resvg/resvg-js`)
  if (project.framework === "next") log(`  In next.config, add serverExternalPackages: ["@resvg/resvg-js"], so Next leaves its native module alone.`)
  else if (RECIPES[project.framework]) log(`  Serve link previews from a route. ${RECIPES[project.framework]}`)
  if (titleFont && project.framework !== "next") log(`  For titles in the site's own font: const font = await loadFont(await readFile(titleFont)), then drawTitle: { font }.`)
  log(`  Look at the result: npx @pogrobert/surfaces preview --title "A real post title"`)
}

// Where the site's shell already says its link preview is, in a <meta> tag
// or the object a framework writes one as.
function previewOf(project: Project) {
  for (const chunk of project.html.match(/<meta\b[^>]*>|\{[^{}]*\}/g) ?? []) {
    if (!/og:image["'\s]/.test(chunk) || /og:image:/.test(chunk)) continue
    const content = chunk.match(/\bcontent\s*[:=]\s*["'`]([^"'`]+)["'`]/)?.[1]
    if (content) return content
  }
  return undefined
}

// A path a page links to, as the file in the public folder that serves it;
// nothing for one on another host.
function served(publicDir: string, url: string | undefined, name: string) {
  if (!url) return undefined
  const match = url.match(/^https?:\/\/(?:www\.)?([^/]+)(\/[^?#]*)/)
  if (match && name && match[1] !== name.replace(/^www\./, "")) return undefined
  const path = (match ? match[2]! : url).split(/[?#]/)[0]!
  return path.startsWith("/") ? join(publicDir, path.slice(1)) : undefined
}

// The pictures a site shows of itself that are art, not identity: its link
// preview and its headers. Never an icon: an icon is the brand's identity,
// and the site keeps the one it has.
async function kitCommand(root: string, args: Args, log: (line: string) => void) {
  const dry = Boolean(one(args, "dry-run"))
  const force = Boolean(one(args, "force"))
  const project = readProject(root)
  const file = brandFile(project, args)
  const brand = createBrand(readLook(file))
  const font = await readTitleFont(root, file)
  const publicDir = one(args, "out") ?? (project.framework === "sveltekit" ? "static" : "public")
  // The site's pictures are art with its logo; its words are its own, in its
  // own type. A title asked for is drawn in, for a preview that has to carry it.
  const title = one(args, "title")
  const pointed = previewOf(project)
  // The site's own pictures all carry one mark, as a studio's would; a
  // post's covers each draw their own.
  const shapes = (STYLES[brand.look.style].shapes ?? []) as readonly string[]
  const mark = brand.look.shape ?? (shapes.length ? shapes[hash(`${brand.name}/kit`) % shapes.length] : undefined)
  // Pictures have one theme; a brand that follows the reader shows its light side.
  // The site's own logo goes on its preview and headers, as it is.
  const chosen = one(args, "logo")
  const logoFile = chosen === "none" ? undefined : chosen ?? project.logo
  if (logoFile && !existsSync(join(root, logoFile))) throw new Error(`No logo at ${logoFile}: pass --logo <file.svg>, or --logo none`)
  const logo = logoFile ? readFileSync(join(root, logoFile), "utf8") : undefined
  if (logoFile) log(`Setting the logo from ${logoFile} (--logo <file> for another, --logo none for none)`)
  const flat = createBrand({ name: brand.name, ...brand.look, ...(mark ? { shape: mark } : null), theme: brand.look.theme === "dark" ? "dark" : "light", ...(logo ? { logo } : null) })
  const png = async (scene: Scene) => (await rasterize(toSvg(scene, { target: "resvg", outlines: outlinePath }), scene.output.w)).asPng()

  const og = served(publicDir, pointed, brand.name) ?? join(publicDir, "og.jpg")
  const assets: { path: string; what: string; make: () => Promise<Uint8Array> }[] = [
    { path: og, what: title ? `link preview, "${title}"` : "link preview", make: () => { const scene = title ? flat.og({ title, drawTitle: font ? { font } : true }) : flat.og({ id: "home", text: "none" }); return /\.png$/i.test(og) ? png(scene) : jpeg(scene) } },
    { path: join(publicDir, "x-header.jpg"), what: "X header", make: () => jpeg(flat.banner({ for: "x" })) },
    { path: join(publicDir, "linkedin-banner.jpg"), what: "LinkedIn banner", make: () => jpeg(flat.banner({ for: "linkedin" })) },
    { path: join(publicDir, "email-header.jpg"), what: "email header", make: () => jpeg(flat.banner({ for: "email" })) },
  ]
  let drewPng = false
  for (const asset of assets) {
    const path = join(root, asset.path)
    if (existsSync(path) && !force) {
      log(`Left ${asset.path}: it is there already (--force replaces it)`)
      continue
    }
    log(`${dry ? "Would write" : existsSync(path) ? "Replaced" : "Wrote"} ${asset.path}  ${asset.what}`)
    if (asset.path === og && /\.png$/i.test(og)) drewPng = true
    if (!dry) {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, await asset.make())
    }
  }
  if (drewPng) log(`The site's link preview is a PNG, about a megabyte with grain, which some chat apps won't show; og.jpg is a tenth of that: point og:image at it.`)
  if (!pointed) log(`In the <head>: <meta property="og:image" content="https://${brand.name}/${relative(join(root, publicDir), join(root, og))}">`)
}

export async function main(argv: string[], root = process.cwd(), log: (line: string) => void = console.log): Promise<number> {
  try {
    const args = parse(argv)
    switch (args.command) {
      case "init":
        await initCommand(root, args, log)
        return 0
      case "directions":
        await directionsCommand(root, args, log)
        return 0
      case "preview":
        await previewCommand(root, args, log)
        return 0
      case "kit":
        await kitCommand(root, args, log)
        return 0
      case "check":
        return await checkCommand(root, args, log)
      case "help":
      case "--help":
      case "-h":
        log(HELP)
        return 0
      default:
        log(`Unknown command "${args.command}".\n${HELP}`)
        return 1
    }
  } catch (error) {
    log((error as Error).message)
    return 1
  }
}

// Run when called as a program, not when imported by the tests.
if (process.argv[1] && /cli\.(ts|js)$/.test(process.argv[1])) {
  process.exitCode = await main(process.argv.slice(2))
}
