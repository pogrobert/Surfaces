import { catalog } from "@pogrobert/surfaces"
import type { CatalogEntry, StyleName, Use } from "@pogrobert/surfaces"

// Made-up sites, each with a colour of its own, so the range shows in colour too.
export const SAMPLES = [
  { name: "harbour.dev", color: "#0078bf" },
  { name: "fernhouse.co", color: "#00838a" },
  { name: "quietpages.org", color: "#3d5588" },
  { name: "ottoloop.fm", color: "#f15060" },
  { name: "pantry.app", color: "#ff6c2f" },
  { name: "longfield.press", color: "#00a95c" },
] as const
export const sample = (i: number) => SAMPLES[i % SAMPLES.length]!

// Every style, in the kinds the pages list them by.
export const KINDS: readonly (readonly [string, readonly StyleName[]])[] = [
  ["Printed", ["stencil", "screenprint", "riso", "linocut", "photocopy", "halftone", "dither", "typewriter"]],
  ["Engraved", ["engraving", "linework", "currents", "dashes", "moire", "mezzotint", "aquatint"]],
  ["Light", ["underpaint", "sfumato", "trails", "prism", "fluted", "chrome", "glass"]],
  ["Made", ["papercut", "weave", "terrazzo", "swatchbook"]],
  ["Pattern", ["marbling", "strata", "endpaper", "patches"]],
]
export const ORDER = KINDS.flatMap(([, styles]) => styles)
export const ABOUT = Object.fromEntries(catalog.map((entry) => [entry.style, entry])) as Record<StyleName, CatalogEntry>
export const NAME = (word: string) => word[0]!.toUpperCase() + word.slice(1)

// The sizes a brand draws, as the studio offers them.
export const SIZES: readonly { use: Use; name: string; w: number; h: number; call: string; banner?: true }[] = [
  { use: "post", name: "Post cover", w: 1600, h: 900, call: "brand.cover({ title })" },
  { use: "og", name: "Link preview", w: 1200, h: 630, call: "brand.og({ title })" },
  { use: "hero", name: "Page header", w: 2400, h: 1200, call: "brand.hero({ title })" },
  { use: "x", name: "X header", w: 1500, h: 500, call: 'brand.banner({ for: "x" })', banner: true },
  { use: "linkedin", name: "LinkedIn banner", w: 1584, h: 396, call: 'brand.banner({ for: "linkedin" })', banner: true },
  { use: "email", name: "Email header", w: 1200, h: 400, call: 'brand.banner({ for: "email" })', banner: true },
]

export const PROMPT = "Add @pogrobert/surfaces to this site: run npx @pogrobert/surfaces init, then follow its AGENTS.md."
export const INIT = "npx @pogrobert/surfaces init"

// Where the library itself is.
export const LINKS = {
  docs: "https://github.com/pogrobert/surfaces/blob/main/docs/api.md",
  github: "https://github.com/pogrobert/surfaces",
  npm: "https://www.npmjs.com/package/@pogrobert/surfaces",
} as const
