// Written by scripts/style-entries.ts, which `pnpm build` runs; edit that instead.
// Surfaces with Papercut alone: the same functions as "@pogrobert/surfaces",
// drawing only papercut, so a page that uses it carries none of the other
// styles. A brand made here is in papercut without saying so.
import { createBrandWith } from "../brand.ts"
import type { Brand, BrandChoices } from "../brand.ts"
import { generateWith } from "../core/generate.ts"
import type { SurfaceInput } from "../core/generate.ts"
import type { Scene } from "../core/scene.ts"
import { papercut } from "../styles/papercut.ts"

const recipes = { papercut }

/** Draws one papercut cover as a `Scene`, as `generate` from "@pogrobert/surfaces" does. Another style throws, naming the import that has it. */
export const generate = (input: SurfaceInput & { style: "papercut" }): Scene => generateWith(recipes, input)

/** A site's brand, in papercut: `createBrand({ name, color })`. Its covers draw with papercut alone. */
export const createBrand = (choices: BrandChoices & { style?: "papercut" }): Brand => createBrandWith(recipes, choices)

export * from "../shared.ts"
