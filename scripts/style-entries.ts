// Writes each style's own import, src/style/<style>.ts and its React one,
// src/style/<style>/react.ts: the same functions as the package's own,
// drawing that style alone, so a page that uses one style carries none of
// the others. Run by `pnpm build`; `--check` says whether they are current,
// as test/recipes.test.ts asks.
//
//   node scripts/style-entries.ts           write them
//   node scripts/style-entries.ts --check   exit 1 if any differs
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const list = fs.readFileSync(path.join(root, "src/styles/index.ts"), "utf8")

// Each recipe as styles/index.ts imports it: its module and its export name.
const recipes = new Map<string, { module: string; name: string }>()
for (const [, names, module] of list.matchAll(/^import \{ ([^}]+) \} from "\.\/([\w-]+)\.ts"$/gm)) {
  for (const part of names!.split(",")) {
    const [name, as] = part.trim().split(/\s+as\s+/)
    recipes.set(as ?? name!, { module: module!, name: name! })
  }
}
const block = fs.readFileSync(path.join(root, "src/styles/names.ts"), "utf8").match(/export const STYLE_NAMES = \[([\s\S]*?)\] as const/)?.[1] ?? ""
const order = [...block.matchAll(/"([\w-]+)"/g)].map((match) => match[1]!)
const styles = order.filter((style) => recipes.has(style))
if (styles.length !== 30 || styles.length !== new Set(order).size) throw new Error(`Expected every style in styles/index.ts; found ${styles.length}`)

const title = (style: string) => style[0]!.toUpperCase() + style.slice(1)
const HEAD = "// Written by scripts/style-entries.ts, which `pnpm build` runs; edit that instead.\n"

const entry = (style: string) => {
  const { module, name } = recipes.get(style)!
  const own = name === style ? name : `${name} as ${style}`
  return `${HEAD}// Surfaces with ${title(style)} alone: the same functions as "@pogrobert/surfaces",
// drawing only ${style}, so a page that uses it carries none of the other
// styles. A brand made here is in ${style} without saying so.
import { createBrandWith } from "../brand.ts"
import type { Brand, BrandChoices } from "../brand.ts"
import { generateWith } from "../core/generate.ts"
import type { SurfaceInput } from "../core/generate.ts"
import type { Scene } from "../core/scene.ts"
import { surfaceHtmlWith } from "../html.ts"
import type { SurfaceHtmlOptions } from "../html.ts"
import { ${own} } from "../styles/${module}.ts"

const recipes = { ${style} }

/** Draws one ${style} cover as a \`Scene\`, as \`generate\` from "@pogrobert/surfaces" does. Another style throws, naming the import that has it. */
export const generate = (input: SurfaceInput & { style: "${style}" }): Scene => generateWith(recipes, input)

/** A site's brand, in ${style}: \`createBrand({ name, color })\`. Its covers draw with ${style} alone. */
export const createBrand = (choices: BrandChoices & { style?: "${style}" }): Brand => createBrandWith(recipes, choices)

/** One exact ${style} cover as HTML, with the page's own HTML in its areas, as <Surface> renders it. */
export const surfaceHtml = (options: SurfaceHtmlOptions & { style: "${style}" }): string => surfaceHtmlWith((input) => generateWith(recipes, input), options)

export * from "../shared.ts"
`
}

const react = (style: string) => `${HEAD}// <Surface> and <Cover> drawing ${style} alone, as "@pogrobert/surfaces/react"
// does every style: give <Cover> a brand from "@pogrobert/surfaces/${style}".
import type { ReactElement } from "react"
import { drawCover, drawSurface } from "../../react.ts"
import type { CoverProps, SurfaceProps } from "../../react.ts"
import { generate } from "../${style}.ts"
import type { SurfaceInput } from "../../core/generate.ts"

export type { CoverProps, SurfaceArea, SurfaceProps } from "../../react.ts"

// Drawn as given: another style throws, naming the import that has it.
const draw = (input: SurfaceInput) => generate(input as SurfaceInput & { style: "${style}" })

/** The art of one ${style} cover, filling the element, with content in its areas. */
export function Surface(props: SurfaceProps): ReactElement {
  return drawSurface(draw, props)
}

/** A brand's cover with its title on it: \`<Cover brand={brand} title={post.title} />\`. */
export function Cover(props: CoverProps): ReactElement {
  return drawCover(Surface, props)
}
`

const files = new Map<string, string>()
for (const style of styles) {
  files.set(`src/style/${style}.ts`, entry(style))
  files.set(`src/style/${style}/react.ts`, react(style))
}

if (process.argv.includes("--check")) {
  const stale = [...files].filter(([file, text]) => !fs.existsSync(path.join(root, file)) || fs.readFileSync(path.join(root, file), "utf8") !== text)
  if (stale.length) {
    console.error(`Out of date: ${stale.map(([file]) => file).join(", ")}. Run node scripts/style-entries.ts`)
    process.exit(1)
  }
} else {
  for (const [file, text] of files) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), text)
  }
  console.log(`${files.size} style entries written`)
}
