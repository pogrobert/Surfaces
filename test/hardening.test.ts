import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, test } from "node:test"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { createBrand } from "../src/brand.ts"
import { main } from "../src/cli.ts"
import { generate } from "../src/core/generate.ts"
import type { TextLayer } from "../src/core/scene.ts"
import { createHandler, signUrl } from "../src/http.ts"
import { toJpeg, toPng } from "../src/png.ts"
import { Cover } from "../src/react.ts"
import { loadFont } from "../src/type/fontfile.ts"

// What broke when we tried to break it, each kept broken no more.

const brand = createBrand({ name: "acme.dev", color: "#635bff" })

test("a title too long to draw is cut at a word, not refused", () => {
  const scene = brand.og({ title: `${"word ".repeat(60)}end`, drawTitle: true })
  const title = scene.layers.find((layer): layer is TextLayer => layer.kind === "text")!
  const text = title.lines.map((line) => line.text).join(" ")
  assert.ok(text.endsWith("word…"), text)
  assert.ok(text.length <= 160)
})

test("an unknown use says what the uses are, from the brand and from <Cover>", () => {
  assert.throws(() => brand.input("poster" as never, { title: "x" }), /Unknown use "poster"\. Use post, card, hero, og/)
  assert.throws(() => renderToString(createElement(Cover, { brand, title: "x", use: "poster" as never })), /Unknown use "poster"/)
  assert.throws(() => renderToString(createElement(Cover, { title: "x" } as never)), /<Cover> takes "brand"/)
  assert.throws(() => brand.og({}), /Give the link preview a "title"/)
})

test("no picture is drawn larger than a server can hold", async () => {
  const small = generate({ style: "riso", seed: "s", color: "#635bff", width: 64, height: 64 })
  // Refused before any memory is taken: this once ran the process out of it.
  await assert.rejects(toPng(small, { width: 100000 }), /more than a picture needs.*16 megapixels/)
  await assert.rejects(toPng(small, { width: 0 }), /"width" is how many pixels across/)
  await assert.rejects(toJpeg(small, { quality: 500 }), /"quality" runs from 1 to 100/)
  await assert.rejects(toJpeg({} as never), /Expected a scene/)
  assert.throws(() => generate({ style: "riso", seed: "s", color: "#635bff", width: 1e9, height: 1e9 }), /keep each side to 8192/)
  assert.throws(() => generate({ style: "riso", seed: "s", color: "#635bff", width: 4096, height: 16 }), /such as 4096 by 1024/)
  // A cover that follows the reader is two pictures, and a file is one.
  const follows = createBrand({ name: "a.dev", color: "#635bff", theme: "auto" })
  await assert.rejects(toJpeg(follows.cover({ title: "Hi" })), /A JPEG has one theme/)
  // A link preview and a header are files by nature, so a brand that follows
  // its reader hands them over in one theme, ready to export.
  assert.equal(follows.og({ title: "Hi" }).dark, undefined)
  assert.equal(follows.banner({ for: "x" }).dark, undefined)
  assert.notEqual(follows.cover({ title: "Hi" }).dark, undefined)
})

test("a cover is given only what a cover takes, and says where the rest belongs", () => {
  assert.throws(() => brand.cover({ title: "Hi", width: 800 } as never), /Unknown option "width" for a cover\..*brand\.input\("post"/)
  assert.throws(() => brand.cover({ title: "Hi", slug: "hi" } as never), /Unknown option "slug" for a cover\. Use "id"/)
  assert.throws(() => brand.cover({ titel: "Hi" } as never), /Unknown option "titel" for a cover\. Did you mean "title"\?/)
  assert.throws(() => brand.og({ title: "Hi", color: "#000" } as never), /That is the brand's own choice/)
  assert.throws(() => createBrand({ name: "a.dev", secondary: "#f00" } as never), /Unknown choice "secondary"\. A brand's second colour is "partner"/)
  assert.throws(() => createBrand({ name: "a.dev", style: "light-trails" as never }), /Unknown style "light-trails"\. Use "underpaint"/)
})

test("a font file cut short or damaged says so, whatever part is missing", async () => {
  const files = join(import.meta.dirname, "../node_modules/@fontsource/inter/files")
  for (const name of ["inter-latin-700-normal.woff2", "inter-latin-700-normal.woff"]) {
    const bytes = readFileSync(join(files, name))
    for (const length of [20, 100, 500, Math.floor(bytes.length / 2), bytes.length - 10]) {
      await assert.rejects(loadFont(bytes.subarray(0, length)), /damaged|cut short|isn't a font file/, `${name} cut to ${length}`)
    }
  }
})

test("a URL says each thing once, and its size in plain digits", async () => {
  const handler = createHandler({ brand })
  const status = async (url: string, given = handler) => {
    const response = await given(new Request(url))
    return `${response.status} ${response.status === 200 ? "" : await response.text()}`
  }
  assert.match(await status("http://x/og?title=a&title=b"), /^400 "title" is given more than once/)
  const open = createHandler({})
  assert.match(await status("http://x/cover?style=riso&seed=s&width=0x400&height=1000", open), /^400 "width" must be a whole number/)
  assert.match(await status("http://x/cover?style=riso&seed=s&width=1e3&height=1000", open), /^400 "width" must be a whole number/)
  const secret = "s3cret"
  const signed = createHandler({ brand, secret })
  const url = await signUrl("http://x/og?title=Hello", secret)
  assert.match(await status(url, signed), /^200/)
  assert.match(await status(`${url}&sig=again`, signed), /^403/)
})

const root = mkdtempSync(join(tmpdir(), "surfaces-odd-"))
after(() => rmSync(root, { recursive: true, force: true }))
const project = (name: string, files: Record<string, string>) => {
  const dir = join(root, name)
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  return dir
}
const run = async (dir: string, ...argv: string[]) => {
  const lines: string[] = []
  const code = await main(argv, dir, (line) => lines.push(line))
  return { code, out: lines.join("\n") }
}

test("the command line says what's wrong with an odd project or command, never a stack", async () => {
  const next = { "package.json": JSON.stringify({ name: "acme", dependencies: { next: "16" } }), "tsconfig.json": "{}" }
  const site = project("site", { ...next, "app/page.tsx": "export default () => null", "app/surfaces.ts": `export const look = { "name": "a.dev", "color": "#ff0000" }\n` })
  assert.match((await run(site, "init", "--nope")).out, /Unknown option "--nope"/)
  assert.match((await run(site, "check", "--use", "banner")).out, /Unknown use "banner"/)
  assert.match((await run(site, "check", "--brand", "elsewhere.ts")).out, /No brand module at elsewhere\.ts/)
  assert.match((await run(project("broken", { "package.json": "{ nope" }), "init", "--dry-run")).out, /package\.json isn't valid JSON/)
  assert.match((await run(project("look", { ...next, "app/surfaces.ts": "export const look = { this is not json }\n" }), "check")).out, /isn't plain data/)
  // A link back up the tree is left alone, not followed round.
  const loop = project("loop", { ...next, "app/page.tsx": "export default () => null" })
  symlinkSync(join(loop, "app"), join(loop, "app", "loop"))
  const { code, out } = await run(loop, "init", "--dry-run")
  assert.equal(code, 0, out)
  assert.match(out, /Read 1 files/)
})

test("the command runs when called through a link named for it, as an installed one is", () => {
  // npm links node_modules/.bin/surfaces to the program, so the name it is
  // called by is the command's and not the file's. Called that way it once
  // did nothing at all, and said nothing.
  const link = join(root, "surfaces")
  symlinkSync(join(import.meta.dirname, "../src/cli.ts"), link)
  const out = execFileSync(process.execPath, [link, "--help"], { encoding: "utf8" })
  assert.match(out, /^Usage: surfaces <command>/)
})
