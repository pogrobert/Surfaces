// Written by scripts/style-entries.ts, which `pnpm build` runs; edit that instead.
// Surfaces with Swatchbook alone: the same functions as "@pogrobert/surfaces",
// drawing only swatchbook, so a page that uses it carries none of the other
// styles. A brand made here is in swatchbook without saying so.
import { createBrandWith } from "../brand.ts"
import type { Brand, BrandChoices } from "../brand.ts"
import { generateWith } from "../core/generate.ts"
import type { SurfaceInput } from "../core/generate.ts"
import type { Scene } from "../core/scene.ts"
import { surfaceHtmlWith } from "../html.ts"
import type { SurfaceHtmlOptions } from "../html.ts"
import { swatchbook } from "../styles/swatchbook.ts"

const recipes = { swatchbook }

/** Draws one swatchbook cover as a `Scene`, as `generate` from "@pogrobert/surfaces" does. Another style throws, naming the import that has it. */
export const generate = (input: SurfaceInput & { style: "swatchbook" }): Scene => generateWith(recipes, input)

/** A site's brand, in swatchbook: `createBrand({ name, color })`. Its covers draw with swatchbook alone. */
export const createBrand = (choices: BrandChoices & { style?: "swatchbook" }): Brand => createBrandWith(recipes, choices)

/** One exact swatchbook cover as HTML, with the page's own HTML in its areas, as <Surface> renders it. */
export const surfaceHtml = (options: SurfaceHtmlOptions & { style: "swatchbook" }): string => surfaceHtmlWith((input) => generateWith(recipes, input), options)

export * from "../shared.ts"
