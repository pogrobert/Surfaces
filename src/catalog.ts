import { STYLES } from "./styles/index.ts"
import type { StyleName } from "./styles/index.ts"

// Every style, said plainly, so a person or an agent can choose one by what it
// looks like. The shapes come from the style's
// own recipe, so this never drifts from what the library draws.
const ABOUT: Record<StyleName, { looks: string; suits: string }> = {
  underpaint: { looks: "An aura: pools of the brand's colour, its deeper and lighter shades and its partner hue, run together under grain.", suits: "Product launches, AI and software, any page that wants colour without a picture." },
  halftone: { looks: "A field of print dots that grow with the tone.", suits: "Editorial, print-flavoured covers." },
  endpaper: { looks: "A dense repeating pattern, like the paper inside a book's cover.", suits: "Quiet backgrounds and tiles." },
  aquatint: { looks: "One clear subject in grainy monochrome light.", suits: "Covers that need a single strong image." },
  sfumato: { looks: "A long-exposure blur of two colours, with glowing highlights.", suits: "Moody, atmospheric heroes." },
  engraving: { looks: "Fine parallel lines modelling one form, like a banknote.", suits: "Crisp, classic, technical covers." },
  riso: { looks: "A two-ink stencil print whose layers don't quite line up.", suits: "Playful, indie, print-flavoured covers." },
  moire: { looks: "Fine fringes of light breaking from a soft mass, in heavy grain.", suits: "Near-monochrome, cinematic covers." },
  strata: { looks: "Bands of colour like a horizon at dusk, cut to a disc.", suits: "Warm, graphic covers in two hues." },
  mezzotint: { looks: "A still life burnished out of a velvet-black plate: a pear, a jug or a glass on a lit ledge; on paper, a print with its plate mark.", suits: "Quiet, considered covers; dark in both themes." },
  marbling: { looks: "Marbled paper: inks floated and combed into veins, as a sheet, a disc, or a whole cover under paper labels.", suits: "Crafted, bookish covers in two hues." },
  linework: { looks: "Hairline diagrams in one ink on a near-plain ground.", suits: "Technical and product covers." },
  dither: { looks: "A smooth form in one ink through a pixel dither.", suits: "Retro, screen-flavoured covers." },
  fluted: { looks: "Soft colour behind a pane of ribbed glass.", suits: "Glossy, modern product covers." },
  photocopy: { looks: "Shapes or a page in toner, with a copier's streaks and specks.", suits: "Raw, zine-flavoured covers." },
  chrome: { looks: "A polished chrome object in a pool of the brand's light.", suits: "Bold, glossy heroes." },
  screenprint: { looks: "A bold mark of rounded tiles printed in two flat inks that don't quite line up, on folded paper.", suits: "Confident, graphic covers that read like a brand mark." },
  stencil: { looks: "Loose paint seen through a stencil of rounded tiles, on folded paper.", suits: "Warm, crafted covers with one bold mark." },
  glass: { looks: "A glass object showing the light behind it, bent and dimmed.", suits: "Soft, glossy heroes." },
}

export type CatalogEntry = {
  style: StyleName
  looks: string
  suits: string
  // The shapes it can be asked for by `shape`; empty when it has none.
  shapes: readonly string[]
}

export const catalog: readonly CatalogEntry[] = (Object.keys(STYLES) as StyleName[]).map((style) => ({
  style,
  ...ABOUT[style],
  shapes: (STYLES[style].shapes ?? []) as readonly string[],
}))
