import { toOklch } from "./color.ts"
import { titleOf } from "./scene.ts"
import type { Layer, Scene, Tone } from "./scene.ts"

// A cover in one plain sentence, for alt text where a cover is seen without
// its page: an OG image, a link preview, a gallery. It says the art is
// abstract, so no one listens for information in it, and then what it looks
// like in everyday words: no technique names, no positions. Read from the
// scene itself, so it is always true of the drawing.
//
//   describe(generate({ style: "riso", seed: "launch", color: "#635bff" }))
//   // "Abstract art: two overlapping indigo and amber circles."
//   describe(scene, { title: "How the new search works" })
//   // 'Abstract cover art for "How the new search works": two overlapping …'
//
// A cover under its page's own heading is decoration, and stays hidden from
// screen readers: label it only where it stands alone.

// Hue bands in OKLCH degrees, each named for the colour at its middle.
const HUES: readonly [number, string][] = [
  [12, "pink"],
  [35, "red"],
  [60, "orange"],
  [90, "amber"],
  [115, "yellow"],
  [135, "lime"],
  [165, "green"],
  [190, "teal"],
  [220, "cyan"],
  [250, "sky blue"],
  [268, "blue"],
  [290, "indigo"],
  [315, "violet"],
  [345, "magenta"],
  [360, "pink"],
]

// A colour's everyday name: its hue, or for a grey its lightness. With
// `shade`, a deep, pale or greyed colour says so.
export function colourName(color: string, shade = true) {
  const { l, c, h } = toOklch(color)
  if (c < 0.035) {
    if (l > 0.92) return "white"
    if (l > 0.72) return "light grey"
    if (l > 0.45) return "grey"
    if (l > 0.25) return "charcoal"
    return "black"
  }
  let name = HUES.find(([end]) => h < end)![1]
  if (l < 0.5 && (name === "orange" || name === "amber")) name = "brown"
  if (!shade) return name
  if (c < 0.07) return `muted ${name}`
  if (l < 0.35) return `deep ${name}`
  if (l > 0.86) return `pale ${name}`
  return name
}

// Styles printed in one ink, named by that ink alone.
const ONE_INK = new Set(["linework", "engraving", "photocopy", "moire", "mezzotint"])

// An ink near black or white reads as that, whatever faint hue it carries.
function inkName(color: string) {
  const { l, c } = toOklch(color)
  if (c < 0.07) return colourName(fromLightness(l))
  return colourName(color)
}
const fromLightness = (l: number) => {
  const t = Math.min(Math.max(l, 0), 1)
  const v = Math.round(t * t * t * 255)
  const hex = v.toString(16).padStart(2, "0")
  return `#${hex}${hex}${hex}`
}

// What each style draws, in the words anyone would use for it, given the
// names of its colours.
type Phrase = (shape: string | undefined, inks: string[]) => string

const both = (inks: string[]) => list(inks)
// "a" or "an", for a phrase that starts with a colour's name.
const a = (words: string) => `${/^[aeiou]/.test(words) ? "an" : "a"} ${words}`
const pick = (table: Record<string, string>, shape: string | undefined, otherwise: string) =>
  table[shape ?? ""] ?? otherwise

// A mark of tiles, as stencil and screenprint cut it.
const TILES = { grid: "four rounded tiles round a round gap", corner: "three rounded tiles and a quarter circle", halves: "two tall tiles, one rounded at the top and one at the foot", pair: "two tall tiles around a round gap", arch: "an arch", bars: "three stacked bars", steps: "three columns rising like steps" }

const ART: Record<string, Phrase> = {
  underpaint: (_, inks) => `soft pools of ${both(inks)} light`,
  halftone: (shape, inks) =>
    pick(
      {
        disc: `a round patch of ${both(inks)} dots`,
        bubble: `${both(inks)} dots gathered in round clusters`,
        leaf: `a leaf shape made of ${both(inks)} dots`,
      },
      shape,
      `a field of ${both(inks)} dots`
    ),
  endpaper: (shape, inks) =>
    `a pattern of small ${both(inks)} ${pick({ bubble: "bubbles", arch: "arches", leaf: "leaves", disc: "circles" }, shape, "shapes")}`,
  aquatint: (shape, inks) =>
    `a grainy ${both(inks)} ${pick(
      { orb: "sphere", ring: "ring", arch: "arch", beam: "beam of light" },
      shape,
      "shape"
    )}`,
  sfumato: (_, inks) => `a hazy blur of ${both(inks)}`,
  engraving: (shape, inks) =>
    `fine ${both(inks)} lines bending into ${pick({ orb: "a sphere", wave: "a wave", arc: "an arc", column: "a column", ripple: "ripples" }, shape, "a shape")}`,
  riso: (shape, inks) =>
    pick(
      {
        arches: `two overlapping ${both(inks)} arches`,
        bars: inks.length > 1 ? `${inks[0]} stripes and ${a(`${inks[1]} circle`)}` : `${both(inks)} stripes and a circle`,
        rise:
          inks.length > 1
            ? `a large ${inks[0]} curve rising from the edge, with ${a(`${inks[1]} circle`)}`
            : `a large ${both(inks)} curve rising from the edge`,
        sunset: inks.length > 1 ? `${a(`${inks[0]} sun`)} over ${inks[1]} stripes` : `${a(`${both(inks)} sun`)} over stripes`,
        trio: `three overlapping ${both(inks)} circles`,
      },
      shape,
      `two overlapping ${both(inks)} circles`
    ),
  moire: (_, inks) => `fine wavy ${both(inks)} lines`,
  strata: (shape, inks) =>
    pick(
      { pair: `two circles of jagged ${both(inks)} bands`, rise: `jagged ${both(inks)} bands rising from the edge` },
      shape,
      `a circle of jagged ${both(inks)} bands`
    ),
  mezzotint: (shape) =>
    `a still life of ${pick(
      {
        lemons: "two lemons",
        eggs: "three eggs",
        cherries: "cherries by a bowl",
        jug: "a jug and a lemon",
        vessels: "a bottle, a jar and a bowl",
        glass: "a glass of wine and cherries",
      },
      shape,
      "a pear"
    )} on a ledge, lit softly out of black`,
  marbling: (shape, inks) =>
    pick(
      {
        wavy: `marbled paper, ${both(inks)} ink drawn into waves`,
        stone: `marbled paper, ${both(inks)} ink in pebble-like spots`,
        swirl: `marbled paper, ${both(inks)} ink stirred into a spiral`,
      },
      shape,
      `marbled paper, ${both(inks)} ink combed into chevrons`
    ),
  linework: (shape, inks) =>
    `a thin ${both(inks)} line drawing of ${pick(
      {
        orbits: "crossing orbits",
        fan: "a fan of rays from one point",
        bars: "a row of upright bars",
        coil: "a coiled spring",
        contour: "contour lines round a peak",
        dial: "a dial with tick marks",
        globe: "a wireframe globe",
        spiral: "a spiral",
        lissajous: "looping curves",
        chart: "a wavy line on a grid",
      },
      shape,
      "curves"
    )}`,
  dither: (shape, inks) =>
    pick(
      {
        slope: `a pixelated ${both(inks)} gradient`,
        bloom: `a pixelated ${both(inks)} glow`,
        ring: `a pixelated ${both(inks)} ring`,
        waves: `pixelated ${both(inks)} waves`,
        screen: `pixelated ${both(inks)} stripes`,
      },
      shape,
      `a pixelated ${both(inks)} sphere`
    ),
  fluted: (shape, inks) =>
    `${both(inks)} light blurred behind ${pick({ arch: "an arched pane of ribbed glass", band: "a band of ribbed glass" }, shape, "a ribbed glass panel")}`,
  photocopy: (shape, inks) =>
    pick(
      {
        page: "a grainy photocopy of a page of text",
        arches: `two overlapping grainy ${both(inks)} arches`,
        bars: `grainy ${both(inks)} stripes and a circle`,
        rise: `a large grainy ${both(inks)} curve rising from the edge`,
      },
      shape,
      `two overlapping grainy ${both(inks)} circles`
    ),
  screenprint: (shape, inks) =>
    `${pick(
      TILES,
      shape,
      "a bold mark"
    )}, printed in ${both(inks)} ink that doesn't quite line up`,
  stencil: (shape, inks) =>
    `${pick(
      TILES,
      shape,
      "a stencilled shape"
    )}, filled with loose ${both(inks)} paint, on folded paper`,
  papercut: (shape, inks) =>
    `${pick({ rainbow: "arches", ripples: "rings", frames: "rounded squares", dunes: "long curving strips", hills: "hills under a sun" }, shape, "arches")} of cut ${both(inks)} paper, layered with soft shadows`,
  linocut: (shape, inks) =>
    `${pick({ landscape: "hills under a ringed sun", sprig: "a sprig of leaves", waves: "rows of waves", mark: "a large letter in a bordered block" }, shape, "a carved block")}, printed from lino in ${both(inks)} ink`,
  typewriter: (shape, inks) =>
    `${pick({ initial: "a large letter", sphere: "a sphere", page: "a typed page swelling into a round", columns: "a table of figures" }, shape, "a shape")} typed in ${both(inks)} characters`,
  currents: (shape, inks) =>
    `fine ${both(inks)} lines ${pick({ obstacle: "flowing round a solid disc", vortex: "whirling in to a still eye", confluence: "in two streams joining into one", field: "flowing across the whole picture" }, shape, "flowing like a current")}`,
  weave: (shape, inks) =>
    `${pick({ swatch: "a frayed swatch", fold: "a piece with a corner folded back", strap: "a woven strap", stack: "a pile of folded cloths" }, shape, "a piece")} of woven ${both(inks)} cloth`,
  terrazzo: (shape, inks) =>
    `${pick({ tile: "a terrazzo tile with a chipped corner", slab: "a slab of terrazzo", steps: "two stepped blocks of terrazzo", floor: "a terrazzo floor in panels" }, shape, "terrazzo")}, its chips ${both(inks)}`,
  dashes: (shape, inks) =>
    `${pick({ orb: "a lit sphere", cloud: "a cumulus cloud", hills: "two ranges of hills in mist", field: "a landscape of relief" }, shape, "a form")} drawn in short ${both(inks)} dashes`,
  swatchbook: (shape, inks) =>
    `${pick({ grid: "a grid of material swatches", fan: "a fanned deck of swatch cards", scatter: "a few swatches scattered on a table", strip: "a paint strip in steps" }, shape, "material swatches")} in ${both(inks)}`,
  patches: (shape, inks) =>
    `${pick({ cluster: "a cluster of soft shapes", disc: "soft shapes over a speckled disc", row: "a row of overlapping pills", pair: "a rounded square with a circle over its corner" }, shape, "soft shapes")}, each patterned in small ${both(inks)} marks`,
  trails: (shape, inks) =>
    `grey light trails ${pick({ sweep: "sweeping across the picture", orbit: "circling in tilted rings", bend: "bending round a corner", drift: "drifting one way" }, shape, "in a long exposure")}, one glowing ${both(inks)}`,
  prism: (shape, inks) =>
    `${pick({ ribbon: "a wide band of light flowing in an S", folds: "three bands of light laid in folds", ring: "a tilted ring of light", bars: "a row of upright bars of light" }, shape, "bands of light")}, ${both(inks)}, with colour fringes at the edges`,
  chrome: (shape, inks) =>
    `a shiny chrome ${pick({ ring: "ring", capsule: "capsule", arch: "arch" }, shape, "sphere")} reflecting ${both(inks)}`,
  glass: (shape, inks) =>
    `a glass ${pick({ ring: "ring", capsule: "capsule", arch: "arch" }, shape, "sphere")} glowing ${both(inks)}`,
}

// The inks a drawing actually uses, deepest search first.
function tonesIn(layers: readonly Layer[], found: Set<Tone>) {
  for (const layer of layers) {
    if (layer.kind === "pool") found.add(layer.tone)
    else if (layer.kind === "shapes") {
      if (layer.paint.type === "solid") found.add(layer.paint.tone)
      else for (const stop of layer.paint.stops) if (stop.opacity > 0) found.add(stop.tone)
    } else if (layer.kind === "stipple") {
      found.add(layer.tone)
      tonesIn(layer.layers, found)
    } else if ("layers" in layer) tonesIn(layer.layers, found)
  }
  return found
}

const list = (names: string[]) =>
  names.length < 3 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`

/**
 * Alt text for a cover seen without its page, such as `og:image:alt`: says
 * the art is abstract, then what it looks like in everyday words, and names
 * the page when given its `title` (a title drawn into the cover is named
 * without asking).
 */
export function describe(scene: Scene, { title }: { title?: string } = {}) {
  const phrase = ART[scene.style]
  if (!phrase) throw new Error(`No description for style "${scene.style}"`)
  const used = tonesIn(scene.layers, new Set())
  // The brand's ramp reads as one colour, named by its most colourful tone;
  // the partner, when it shows and is a different colour, as a second. The
  // ground, the title's colour and the palest wash are the page.
  const inks: string[] = []
  if (ONE_INK.has(scene.style)) inks.push(inkName(scene.palette.strong))
  else {
    // The body tone is the brand's own colour; the others lean off it.
    const brand = used.has("body")
      ? scene.palette.body
      : (["strong", "soft", "accent"] as const)
          .filter((tone) => used.has(tone))
          .map((tone) => scene.palette[tone])
          .sort((a, b) => toOklch(b).c - toOklch(a).c)[0]
    inks.push(colourName(brand ?? scene.palette.strong, false))
    if (used.has("partner")) {
      const partner = colourName(scene.palette.partner, false)
      if (!inks.includes(partner)) inks.push(partner)
    }
  }
  const what = phrase(scene.shape, inks)
  // A title drawn into the cover is part of what it shows, so it is named
  // without being asked for.
  const named = (title ?? titleOf(scene))?.trim()
  return named ? `Abstract cover art for "${named}": ${what}.` : `Abstract art: ${what}.`
}
