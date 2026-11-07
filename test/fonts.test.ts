import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, test } from "node:test"
import { createBrand } from "../src/brand.ts"
import { main } from "../src/cli.ts"
import { generate } from "../src/core/generate.ts"
import type { TextLayer } from "../src/core/scene.ts"
import { outlinePath } from "../src/render/glyphs.ts"
import { toSvg } from "../src/render/svg.ts"
import { loadFont } from "../src/type/fontfile.ts"
import { METRICS } from "../src/type/metrics.ts"

// The bundled faces are built from these same files, so a font read from
// them has to measure as the bundled faces do.
const files = join(import.meta.dirname, "../node_modules/@fontsource")
const bytes = (path: string) => readFileSync(join(files, path))
const inter = await loadFont(bytes("inter/files/inter-latin-700-normal.woff2"))
const fraunces = await loadFont(bytes("fraunces/files/fraunces-latin-600-normal.woff2"))

const advances = (face: "sans" | "serif") =>
  new Map(METRICS[face].advances.split("|").map((entry) => entry.split(":").map((part) => parseInt(part, 36)) as [number, number]))

test("a WOFF2 measures as the bundled face built from it", () => {
  for (const [font, face] of [[inter, "sans"], [fraunces, "serif"]] as const) {
    const bundled = advances(face)
    for (const char of "AVWaghkmsy0123?&") {
      const code = char.codePointAt(0)!
      assert.ok(Math.abs(font.advance.get(code)! - bundled.get(code)!) <= 1, `${font.family} "${char}": ${font.advance.get(code)} against ${bundled.get(code)}`)
    }
    assert.ok(Math.abs(font.cap - METRICS[face].cap) <= 1, `${font.family} cap ${font.cap}`)
    assert.ok(Math.abs(font.descent - Math.abs(METRICS[face].descent)) <= 1, `${font.family} descent ${font.descent}`)
  }
  assert.equal(inter.family, "Inter")
  assert.equal(inter.weight, 700)
  assert.ok(inter.kern.size > 50, "Inter keeps its kerning")
})

test("a WOFF2's rebuilt outlines are the same as the WOFF's", async () => {
  // A WOFF keeps the glyph table as it is; a WOFF2 rebuilds it from seven
  // streams, so the two drawing alike checks the rebuilding. The packages
  // build the two from slightly different sources, whose overlaps are
  // merged differently, so many glyphs match point for point and every
  // letter's extent matches.
  const box = (contours: { x: number; y: number }[][]) => {
    const points = contours.flat()
    return [Math.min(...points.map((p) => p.x)), Math.min(...points.map((p) => p.y)), Math.max(...points.map((p) => p.x)), Math.max(...points.map((p) => p.y))]
  }
  for (const name of ["inter/files/inter-latin-400-normal", "fraunces/files/fraunces-latin-600-normal"]) {
    const woff = await loadFont(bytes(`${name}.woff`))
    const woff2 = await loadFont(bytes(`${name}.woff2`))
    // Accented letters are compound glyphs: a letter and its mark.
    for (const char of "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789éñÅç&@?") {
      const code = char.codePointAt(0)!
      assert.ok(woff.contours(code).length > 0, `${woff.family} "${char}" has outlines`)
      assert.deepEqual(box(woff2.contours(code)), box(woff.contours(code)), `${woff.family} "${char}"`)
      assert.equal(woff2.advance.get(code), woff.advance.get(code))
    }
    const codes = [...woff.advance.keys()]
    const same = codes.filter((code) => JSON.stringify(woff2.contours(code)) === JSON.stringify(woff.contours(code)))
    assert.ok(same.length > codes.length * 0.35, `${woff.family}: ${same.length} of ${codes.length} glyphs the same`)
    assert.equal(woff2.kern.size, woff.kern.size)
  }
})

test("a font says whether it is a serif, from its letters where it doesn't say", () => {
  assert.equal(inter.serif, false)
  // Fraunces leaves its classification empty.
  assert.equal(fraunces.serif, true)
})

test("drawTitle takes a font: the title is set in it and drawn from its outlines", () => {
  const brand = createBrand({ name: "acme.dev", color: "#635bff" })
  const scene = brand.og({ title: "How we cut our build times in half", drawTitle: { font: fraunces } })
  const title = scene.layers.find((layer): layer is TextLayer => layer.kind === "text")!
  assert.equal(title.font, fraunces.key)
  assert.ok(title.lines.every((line) => line.width > 0))
  assert.match(toSvg(scene), /font-family='"Fraunces", serif'/)
  // Rasterised, the title is the font's own outlines.
  const drawn = toSvg(scene, { target: "resvg", outlines: outlinePath })
  assert.doesNotMatch(drawn, /font-family='"Fraunces"/)
  assert.notEqual(drawn, toSvg(brand.og({ title: "How we cut our build times in half", drawTitle: true }), { target: "resvg", outlines: outlinePath }))
  // One font always names itself the same, so a scene is the same every build.
  assert.deepEqual(generate(brand.input("og", { title: "Notes", drawTitle: { font: fraunces } })), generate(brand.input("og", { title: "Notes", drawTitle: { font: fraunces } })))
})

test("what isn't a font it can use says what to give instead", async () => {
  const header = (tag: string) => new Uint8Array([...new TextEncoder().encode(tag), ...new Uint8Array(60)])
  await assert.rejects(loadFont(new TextEncoder().encode("<svg></svg> and more bytes")), /isn't a font file: expected a TTF, OTF, WOFF or WOFF2/)
  await assert.rejects(loadFont(header("OTTO")), /PostScript \(CFF\) outlines.*TTF, WOFF or WOFF2/)
  await assert.rejects(loadFont(header("ttcf")), /collection of fonts.*one face/)
  await assert.rejects(loadFont("public/fonts/Brand.woff2" as never), /font file's bytes/)
  const brand = createBrand({ name: "acme.dev", color: "#635bff" })
  assert.throws(() => brand.og({ title: "Notes", drawTitle: { font: "Inter" as never } }), /loadFont\(\)/)
})

// A Next.js site that loads its heading font from its own file.
const site = mkdtempSync(join(tmpdir(), "surfaces-fonts-"))
after(() => rmSync(site, { recursive: true, force: true }))
const write = (path: string, text: string | Uint8Array) => {
  mkdirSync(join(site, path, ".."), { recursive: true })
  writeFileSync(join(site, path), text)
}
write("package.json", JSON.stringify({ name: "acme-web", dependencies: { next: "16.0.0" } }))
write("tsconfig.json", "{}")
write("app/fonts/Fraunces-SemiBold.woff2", bytes("fraunces/files/fraunces-latin-600-normal.woff2"))
write("app/fonts/Inter-Regular.woff2", bytes("inter/files/inter-latin-400-normal.woff2"))
write(
  "app/fonts.ts",
  `import localFont from "next/font/local"
export const display = localFont({ src: "./fonts/Fraunces-SemiBold.woff2", variable: "--font-fraunces", weight: "600" })
export const text = localFont({ src: "./fonts/Inter-Regular.woff2", variable: "--font-inter" })
`
)
write(
  "app/layout.tsx",
  `export const metadata = { title: "Acme Bakery", openGraph: { url: "https://acmebakery.com" } }
export default function Layout({ children }) { return <html><body>{children}</body></html> }`
)
write("app/globals.css", ":root { --primary: #f59e0b; } h1 { font-family: var(--font-fraunces), serif; } body { font-family: var(--font-inter), sans-serif; }")

test("init finds the site's heading font and draws its link preview's title in it", async () => {
  const lines: string[] = []
  assert.equal(await main(["init"], site, (line) => lines.push(line)), 0, lines.join("\n"))
  const out = lines.join("\n")
  assert.match(out, /set in the site's own Fraunces 600, from app\/fonts\/Fraunces-SemiBold\.woff2/)
  const module = readFileSync(join(site, "app/surfaces.ts"), "utf8")
  assert.match(module, /export const titleFont = "app\/fonts\/Fraunces-SemiBold\.woff2"/)
  const image = readFileSync(join(site, "app/opengraph-image.tsx"), "utf8")
  assert.match(image, /import \{ brand, titleFont \} from "\.\/surfaces"/)
  assert.match(image, /loadFont\(await readFile\(join\(process\.cwd\(\), titleFont\)\)\)/)
  assert.match(image, /drawTitle: \{ font \}/)
})
