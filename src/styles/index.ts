import { aquatint } from "./aquatint.ts"
import { chrome, glass } from "./chrome.ts"
import { ditherStyle as dither } from "./dither.ts"
import { endpaper } from "./endpaper.ts"
import { engraving } from "./engraving.ts"
import { flutedStyle as fluted } from "./fluted.ts"
import { halftone } from "./halftone.ts"
import { lineworkStyle as linework } from "./linework.ts"
import { marblingStyle as marbling } from "./marbling.ts"
import { mezzotintStyle as mezzotint } from "./mezzotint.ts"
import { moire } from "./moire.ts"
import { photocopyStyle as photocopy } from "./photocopy.ts"
import { riso } from "./riso.ts"
import { sfumato } from "./sfumato.ts"
import { screenprint } from "./screenprint.ts"
import { stencil } from "./stencil.ts"
import { strataStyle as strata } from "./strata.ts"
import { underpaint } from "./underpaint.ts"
import { papercut } from "./papercut.ts"
import { linocut } from "./linocut.ts"
import { typewriter } from "./typewriter.ts"
import { currents } from "./currents.ts"
import { weave } from "./weave.ts"
import { terrazzo } from "./terrazzo.ts"
import { dashes } from "./dashes.ts"
import { swatchbook } from "./swatchbook.ts"
import { patches } from "./patches.ts"
import { trails } from "./trails.ts"
import { prism } from "./prism.ts"

import type { StyleName } from "./names.ts"

// Every name in names.ts, and no other.
export const STYLES = {
  underpaint,
  halftone,
  endpaper,
  aquatint,
  mezzotint,
  sfumato,
  engraving,
  riso,
  moire,
  strata,
  marbling,
  linework,
  dither,
  fluted,
  photocopy,
  chrome,
  glass,
  stencil,
  screenprint,
  papercut,
  linocut,
  typewriter,
  currents,
  weave,
  terrazzo,
  dashes,
  swatchbook,
  patches,
  trails,
  prism,
} satisfies Record<StyleName, unknown>

// Every recipe, by its name. Only what draws needs this: the names, shapes
// and still styles are in names.ts, which carries no recipe.
export { STILL, STYLE_NAMES } from "./names.ts"
export type { StyleName } from "./names.ts"
