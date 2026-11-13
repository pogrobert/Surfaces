// Written by scripts/style-entries.ts, which `pnpm build` runs; edit that instead.
// Surfaces with Sfumato alone: the same functions as "@pogrobert/surfaces",
// drawing only sfumato, so a page that uses it carries none of the other
// styles. A brand made here is in sfumato without saying so.
import { createBrandWith } from "../brand.ts"
import type { Brand, BrandChoices } from "../brand.ts"
import { generateWith } from "../core/generate.ts"
import type { SurfaceInput } from "../core/generate.ts"
import type { Scene } from "../core/scene.ts"
import { surfaceHtmlWith } from "../html.ts"
import type { SurfaceHtmlOptions } from "../html.ts"
import { sfumato } from "../styles/sfumato.ts"

const recipes = { sfumato }

/** Draws one sfumato cover as a `Scene`, as `generate` from "@pogrobert/surfaces" does. Another style throws, naming the import that has it. */
export const generate = (input: SurfaceInput & { style: "sfumato" }): Scene => generateWith(recipes, input)

/** A site's brand, in sfumato: `createBrand({ name, color })`. Its covers draw with sfumato alone. */
export const createBrand = (choices: BrandChoices & { style?: "sfumato" }): Brand => createBrandWith(recipes, choices)

/** One exact sfumato cover as HTML, with the page's own HTML in its areas, as <Surface> renders it. */
export const surfaceHtml = (options: SurfaceHtmlOptions & { style: "sfumato" }): string => surfaceHtmlWith((input) => generateWith(recipes, input), options)

export * from "../shared.ts"
