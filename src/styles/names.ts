// The styles as plain data: their names, in the order every list gives them,
// the shapes each is judged with, and which are drawn still. Nothing here
// draws, so a page that checks or describes a cover, or draws with one style
// alone, carries none of the thirty recipes; test/recipes.test.ts holds this
// to what each recipe really has.

export const STYLE_NAMES = [
  "underpaint",
  "halftone",
  "endpaper",
  "aquatint",
  "mezzotint",
  "sfumato",
  "engraving",
  "riso",
  "moire",
  "strata",
  "marbling",
  "linework",
  "dither",
  "fluted",
  "photocopy",
  "chrome",
  "glass",
  "stencil",
  "screenprint",
  "papercut",
  "linocut",
  "typewriter",
  "currents",
  "weave",
  "terrazzo",
  "dashes",
  "swatchbook",
  "patches",
  "trails",
  "prism",
] as const

export type StyleName = (typeof STYLE_NAMES)[number]

/** Whether a string names a style. */
export const isStyle = (name: unknown): name is StyleName => (STYLE_NAMES as readonly unknown[]).includes(name)

// Each style's shapes, as `shape` takes them; none for a style with one form.
export const SHAPES: Readonly<Record<StyleName, readonly string[]>> = {
  underpaint: ["aura", "glow"],
  halftone: ["tile", "disc", "bubble", "leaf"],
  endpaper: ["bubble", "arch", "leaf", "disc"],
  aquatint: ["orb", "ring", "arch", "beam"],
  mezzotint: ["pear", "lemons", "eggs", "cherries", "jug", "vessels", "glass"],
  sfumato: [],
  engraving: ["orb", "wave", "arc", "column", "ripple"],
  riso: ["discs", "arches", "bars", "rise", "sunset", "trio"],
  moire: [],
  strata: ["disc", "pair", "rise"],
  marbling: ["combed", "wavy", "stone", "swirl"],
  linework: ["orbits", "fan", "bars", "coil", "contour", "dial", "globe", "spiral", "lissajous", "chart"],
  dither: ["orb", "slope", "bloom", "ring", "waves", "screen"],
  fluted: ["panel", "arch", "band"],
  photocopy: ["discs", "arches", "bars", "rise", "page"],
  chrome: ["orb", "ring", "capsule", "arch"],
  glass: ["orb", "ring", "capsule", "arch"],
  stencil: ["grid", "corner", "halves", "pair", "arch", "bars", "steps"],
  screenprint: ["grid", "corner", "halves", "pair", "arch", "bars", "steps"],
  papercut: ["rainbow", "ripples", "frames", "dunes", "hills"],
  linocut: ["landscape", "sprig", "waves", "mark"],
  typewriter: ["initial", "sphere", "page", "columns"],
  currents: ["obstacle", "vortex", "confluence", "field"],
  weave: ["swatch", "fold", "strap", "stack"],
  terrazzo: ["tile", "slab", "steps", "floor"],
  dashes: ["orb", "cloud", "hills", "field"],
  swatchbook: ["grid", "fan", "scatter", "strip"],
  patches: ["cluster", "disc", "row", "pair"],
  trails: ["sweep", "orbit", "bend", "drift"],
  prism: ["ribbon", "folds", "ring", "bars"],
}

// The styles that are drawn still: asked to move, they stay as they are. Said
// here so the catalog can tell a reader, a cover asked to move can say so, and
// a brand's hero never promises motion its style doesn't have. The tests hold
// this list to what the styles really do.
export const STILL: ReadonlySet<StyleName> = new Set<StyleName>([
  "screenprint",
  "linocut",
  "typewriter",
  "currents",
  "weave",
  "terrazzo",
  "dashes",
  "swatchbook",
  "patches",
  "trails",
  "prism",
])

// The styles that set a second hue beside the brand's, which a brand's
// \`partner\` recolours; the rest are one hue and ignore it, as Underpaint's
// glow does. The tests hold this to what the styles really draw.
export const PARTNERED: ReadonlySet<StyleName> = new Set<StyleName>([
  "underpaint",
  "sfumato",
  "riso",
  "strata",
  "marbling",
  "fluted",
  "chrome",
  "glass",
  "screenprint",
  "papercut",
  "currents",
  "weave",
  "terrazzo",
  "swatchbook",
  "patches",
  "prism",
])
