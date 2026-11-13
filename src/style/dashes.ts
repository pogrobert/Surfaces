// Written by scripts/style-entries.ts, which `pnpm build` runs; edit that instead.
// Surfaces with Dashes alone: the same functions as "@pogrobert/surfaces",
// drawing only dashes, so a page that uses it carries none of the other
// styles. A brand made here is in dashes without saying so.
import { createBrandWith } from "../brand.ts"
import type { Brand, BrandChoices } from "../brand.ts"
import { generateWith } from "../core/generate.ts"
import type { SurfaceInput } from "../core/generate.ts"
import type { Scene } from "../core/scene.ts"
import { surfaceHtmlWith } from "../html.ts"
import type { SurfaceHtmlOptions } from "../html.ts"
import { dashes } from "../styles/dashes.ts"

const recipes = { dashes }

/** Draws one dashes cover as a `Scene`, as `generate` from "@pogrobert/surfaces" does. Another style throws, naming the import that has it. */
export const generate = (input: SurfaceInput & { style: "dashes" }): Scene => generateWith(recipes, input)

/** A site's brand, in dashes: `createBrand({ name, color })`. Its covers draw with dashes alone. */
export const createBrand = (choices: BrandChoices & { style?: "dashes" }): Brand => createBrandWith(recipes, choices)

/** One exact dashes cover as HTML, with the page's own HTML in its areas, as <Surface> renders it. */
export const surfaceHtml = (options: SurfaceHtmlOptions & { style: "dashes" }): string => surfaceHtmlWith((input) => generateWith(recipes, input), options)

export * from "../shared.ts"
