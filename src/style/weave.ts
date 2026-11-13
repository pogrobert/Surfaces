// Written by scripts/style-entries.ts, which `pnpm build` runs; edit that instead.
// Surfaces with Weave alone: the same functions as "@pogrobert/surfaces",
// drawing only weave, so a page that uses it carries none of the other
// styles. A brand made here is in weave without saying so.
import { createBrandWith } from "../brand.ts"
import type { Brand, BrandChoices } from "../brand.ts"
import { generateWith } from "../core/generate.ts"
import type { SurfaceInput } from "../core/generate.ts"
import type { Scene } from "../core/scene.ts"
import { surfaceHtmlWith } from "../html.ts"
import type { SurfaceHtmlOptions } from "../html.ts"
import { weave } from "../styles/weave.ts"

const recipes = { weave }

/** Draws one weave cover as a `Scene`, as `generate` from "@pogrobert/surfaces" does. Another style throws, naming the import that has it. */
export const generate = (input: SurfaceInput & { style: "weave" }): Scene => generateWith(recipes, input)

/** A site's brand, in weave: `createBrand({ name, color })`. Its covers draw with weave alone. */
export const createBrand = (choices: BrandChoices & { style?: "weave" }): Brand => createBrandWith(recipes, choices)

/** One exact weave cover as HTML, with the page's own HTML in its areas, as <Surface> renders it. */
export const surfaceHtml = (options: SurfaceHtmlOptions & { style: "weave" }): string => surfaceHtmlWith((input) => generateWith(recipes, input), options)

export * from "../shared.ts"
