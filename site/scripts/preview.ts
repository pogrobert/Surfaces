// Draws one page's link preview with Surfaces itself, the card X, LinkedIn,
// Slack and iMessage show when the page is shared: 1200x630, its title drawn
// in the site's own face, its logo set on it. One page per run, so each render
// has a process of its own: `node scripts/preview.ts home`, then `studio`.
// Prints the picture's description, for og:image:alt.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { createBrand, describe, loadFont } from "@pogrobert/surfaces"
import { toJpeg } from "@pogrobert/surfaces/png"

const PAGES = {
  home: { file: "og.jpg", title: "Pictures for every page of your site, drawn from one colour." },
  studio: { file: "og-studio.jpg", title: "Every style and every choice, with the code that makes it." },
} as const

const page = PAGES[process.argv[2] as keyof typeof PAGES]
if (!page) throw new Error(`Name a page: ${Object.keys(PAGES).join(" or ")}`)
const here = new URL("..", import.meta.url).pathname
const font = await loadFont(readFileSync(`${here}node_modules/@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-700-normal.woff2`))
// The brand the site itself would have: its own name, the cream of its logo's
// sheets on a dark ground, as the logo's tile is, and the logo itself (the
// lockup, its text as outlines, one for each ground). Both pages are Riso
// discs; Riso prints two inks, and the second is a warm grey, so the pictures
// keep to the logo's two colours.
const logo = { light: readFileSync(`${here}scripts/lockup-light.svg`, "utf8"), dark: readFileSync(`${here}scripts/lockup-dark.svg`, "utf8") }
const brand = createBrand({ name: "surfaces.pogrobert.com", color: "#f1ead9", partner: "#8f897c", style: "riso", shape: "discs", theme: "dark", logo })
const scene = brand.og({ title: page.title, drawTitle: { font } })
mkdirSync(`${here}public`, { recursive: true })
writeFileSync(`${here}public/${page.file}`, await toJpeg(scene))
console.log(describe(scene, { title: page.title }))
