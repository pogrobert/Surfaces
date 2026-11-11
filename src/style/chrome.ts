// Written by scripts/style-entries.ts, which `pnpm build` runs; edit that instead.
// Surfaces with Chrome alone: the same functions as "@pogrobert/surfaces",
// drawing only chrome, so a page that uses it carries none of the other
// styles. A brand made here is in chrome without saying so.
import { createBrandWith } from "../brand.ts"
import type { Brand, BrandChoices } from "../brand.ts"
import { generateWith } from "../core/generate.ts"
import type { SurfaceInput } from "../core/generate.ts"
import type { Scene } from "../core/scene.ts"
import { chrome } from "../styles/chrome.ts"

const recipes = { chrome }

/** Draws one chrome cover as a `Scene`, as `generate` from "@pogrobert/surfaces" does. Another style throws, naming the import that has it. */
export const generate = (input: SurfaceInput & { style: "chrome" }): Scene => generateWith(recipes, input)

/** A site's brand, in chrome: `createBrand({ name, color })`. Its covers draw with chrome alone. */
export const createBrand = (choices: BrandChoices & { style?: "chrome" }): Brand => createBrandWith(recipes, choices)

export * from "../shared.ts"
