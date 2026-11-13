// Written by scripts/style-entries.ts, which `pnpm build` runs; edit that instead.
// Surfaces with Photocopy alone: the same functions as "@pogrobert/surfaces",
// drawing only photocopy, so a page that uses it carries none of the other
// styles. A brand made here is in photocopy without saying so.
import { createBrandWith } from "../brand.ts"
import type { Brand, BrandChoices } from "../brand.ts"
import { generateWith } from "../core/generate.ts"
import type { SurfaceInput } from "../core/generate.ts"
import type { Scene } from "../core/scene.ts"
import { surfaceHtmlWith } from "../html.ts"
import type { SurfaceHtmlOptions } from "../html.ts"
import { photocopyStyle as photocopy } from "../styles/photocopy.ts"

const recipes = { photocopy }

/** Draws one photocopy cover as a `Scene`, as `generate` from "@pogrobert/surfaces" does. Another style throws, naming the import that has it. */
export const generate = (input: SurfaceInput & { style: "photocopy" }): Scene => generateWith(recipes, input)

/** A site's brand, in photocopy: `createBrand({ name, color })`. Its covers draw with photocopy alone. */
export const createBrand = (choices: BrandChoices & { style?: "photocopy" }): Brand => createBrandWith(recipes, choices)

/** One exact photocopy cover as HTML, with the page's own HTML in its areas, as <Surface> renders it. */
export const surfaceHtml = (options: SurfaceHtmlOptions & { style: "photocopy" }): string => surfaceHtmlWith((input) => generateWith(recipes, input), options)

export * from "../shared.ts"
