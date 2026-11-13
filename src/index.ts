// The public API, every style. See docs/api.md. A page that draws with one
// style alone can import it from "@pogrobert/surfaces/<style>" instead, the
// same functions carrying only that style.
export { generate } from "./core/generate.ts"
export { createBrand, directions } from "./brand.ts"
import { generate } from "./core/generate.ts"
import { surfaceHtmlWith } from "./html.ts"
import type { SurfaceHtmlOptions } from "./html.ts"

/** One exact cover as HTML, with the page's own HTML in its areas, as <Surface> renders it. */
export const surfaceHtml = (options: SurfaceHtmlOptions): string => surfaceHtmlWith(generate, options)
export * from "./shared.ts"
