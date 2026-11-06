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
}

export type StyleName = keyof typeof STYLES
