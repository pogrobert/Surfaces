// Draws one page's link preview with Surfaces itself, the card X, LinkedIn,
// Slack and iMessage show when the page is shared: 1200x630, its title drawn
// in the site's own face. One page per run, so each render has a process of
// its own: `node scripts/preview.ts home`, then `studio`. Prints the picture's
// description, for og:image:alt.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { createBrand, describe, loadFont } from "@pogrobert/surfaces"
import { toJpeg } from "@pogrobert/surfaces/png"

const PAGES = {
  home: { file: "og.jpg", style: "stencil", shape: "grid", title: "Pictures for every page of your site, drawn from one colour." },
  studio: { file: "og-studio.jpg", style: "riso", shape: "discs", title: "Every style and every choice, with the code that makes it." },
} as const

const page = PAGES[process.argv[2] as keyof typeof PAGES]
if (!page) throw new Error(`Name a page: ${Object.keys(PAGES).join(" or ")}`)
const here = new URL("..", import.meta.url).pathname
const font = await loadFont(readFileSync(`${here}node_modules/@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-700-normal.woff2`))
// The brand the site itself would have: its own name, the Harbour blue its plate opens on.
const brand = createBrand({ name: "surfaces.pogrobert.com", color: "#0078bf", style: page.style, shape: page.shape, theme: "light" })
const scene = brand.og({ title: page.title, drawTitle: { font } })
mkdirSync(`${here}public`, { recursive: true })
writeFileSync(`${here}public/${page.file}`, await toJpeg(scene))
console.log(describe(scene, { title: page.title }))
