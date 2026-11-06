import assert from "node:assert/strict"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, test } from "node:test"
import { createBrand } from "../src/brand.ts"
import { main } from "../src/cli.ts"
import { createHandler, signUrl } from "../src/http.ts"
import { toJpeg } from "../src/png.ts"
import { generate } from "../src/core/generate.ts"

// A small Next.js site, as its files would be.
const site = mkdtempSync(join(tmpdir(), "surfaces-site-"))
after(() => rmSync(site, { recursive: true, force: true }))
const write = (path: string, text: string) => {
  mkdirSync(join(site, path, ".."), { recursive: true })
  writeFileSync(join(site, path), text)
}
write("package.json", JSON.stringify({ name: "acme-web", dependencies: { next: "16.0.0" } }))
write("tsconfig.json", "{}")
write(
  "app/layout.tsx",
  `import { Fraunces, Inter } from "next/font/google"
export const metadata = { title: "Acme Bakery", description: "Fresh bread for the neighbourhood, baked together with our community.", openGraph: { url: "https://acmebakery.com" } }
export default function Layout({ children }) { return <html><body>{children}</body></html> }`
)
write("app/globals.css", ":root { --background: #fffaf0; --foreground: #2b1d12; --primary: #f59e0b; }")
write("AGENTS.md", "# Acme\n\nRun the tests before pushing.\n")

const run = async (...argv: string[]) => {
  const lines: string[] = []
  const code = await main(argv, site, (line) => lines.push(line))
  return { code, out: lines.join("\n") }
}

test("init reads the site and writes its brand, its agents' rules and its link preview", async () => {
  const dry = await run("init", "--dry-run")
  assert.equal(dry.code, 0)
  assert.match(dry.out, /Would write app\/surfaces\.ts/)
  assert.ok(!existsSync(join(site, "app/surfaces.ts")))

  const { code, out } = await run("init")
  assert.equal(code, 0, out)
  assert.match(out, /Read \d+ files \(next, TypeScript\)/)
  const module = readFileSync(join(site, "app/surfaces.ts"), "utf8")
  const look = JSON.parse(module.match(/export const look = (\{[\s\S]*?\}) as const/)![1]!)
  assert.equal(look.name, "acmebakery.com")
  assert.equal(look.color, "#f59e0b")
  assert.equal(look.font, "serif")
  assert.equal(look.style, "stencil")
  const agents = readFileSync(join(site, "AGENTS.md"), "utf8")
  assert.match(agents, /^# Acme\n\nRun the tests before pushing\.\n\n<!-- surfaces:start -->/)
  assert.match(agents, /exported from `app\/surfaces\.ts`/)
  const image = readFileSync(join(site, "app/opengraph-image.tsx"), "utf8")
  assert.match(image, /import \{ brand \} from "\.\/surfaces"/)
  assert.match(image, /export const alt = "Acme Bakery"/)
  assert.ok(existsSync(join(site, ".surfaces/directions.jpg")))
})

test("init again leaves the brand, updates its block in place, and takes another direction when asked", async () => {
  const again = await run("init")
  assert.match(again.out, /Left app\/surfaces\.ts: it is set up already/)
  assert.match(again.out, /Left app\/opengraph-image\.tsx: the site has a link preview image already/)
  assert.equal(readFileSync(join(site, "AGENTS.md"), "utf8").match(/surfaces:start/g)!.length, 1)
  const before = readFileSync(join(site, "app/surfaces.ts"), "utf8")
  await run("init", "--pick", "2")
  assert.notEqual(readFileSync(join(site, "app/surfaces.ts"), "utf8"), before)
  assert.match((await run("init", "--pick", "9")).out, /"--pick" must be from 1 to 6/)
})

test("preview draws the brand's covers to look at, and check says whether they hold", async () => {
  const preview = await run("preview", "--title", "Sourdough, slowly")
  assert.equal(preview.code, 0, preview.out)
  assert.match(preview.out, /\.surfaces\/og-1\.jpg {2}Abstract cover art for "Sourdough, slowly"/)
  assert.deepEqual([...readFileSync(join(site, ".surfaces/og-1.jpg")).subarray(0, 2)], [0xff, 0xd8])
  const check = await run("check", "--use", "og", "--title", "Sourdough, slowly")
  assert.equal(check.code, 0, check.out)
  assert.match(check.out, /"ok":true/)
  assert.match(check.out, /Every cover holds/)
  const lost = await run("check", "--use", "og", "--title", "日本語")
  assert.equal(lost.code, 1)
  assert.match(lost.out, /can't draw/)
})

test("a wrong command or option says how to put it right", async () => {
  assert.match((await run("nope")).out, /Unknown command "nope"/)
  assert.match((await run("init", "stray")).out, /Unexpected "stray"/)
})

const brand = createBrand({ name: "acme.dev", color: "#635bff", style: "riso", theme: "light" })
const jpeg = (input: Parameters<typeof generate>[0]) => toJpeg(generate(input))

test("a brand's covers come from a URL that says only what each is about", async () => {
  const handle = createHandler({ brand, jpeg })
  const ok = await handle(new Request("https://acme.dev/og?title=Notes%20on%20shipping&format=jpeg"))
  assert.equal(ok.status, 200)
  assert.equal(ok.headers.get("content-type"), "image/jpeg")
  const svg = await (await handle(new Request("https://acme.dev/og?title=Notes&use=post"))).text()
  assert.match(svg, />Notes<\/tspan>/)
  const card = await (await handle(new Request("https://acme.dev/og?title=Notes&use=card"))).text()
  assert.doesNotMatch(card, /<text/)
  assert.match(await (await handle(new Request("https://acme.dev/og?style=riso"))).text(), /Unknown parameter "style"/)
})

test("with a secret, only signed URLs are drawn", async () => {
  const handle = createHandler({ brand, secret: "s3cret" })
  const unsigned = await handle(new Request("https://acme.dev/og?title=Hi"))
  assert.equal(unsigned.status, 403)
  const url = await signUrl("https://acme.dev/og?title=Hi&use=og", "s3cret")
  assert.equal((await handle(new Request(url))).status, 200)
  assert.equal((await handle(new Request(url.replace("title=Hi", "title=Pwned")))).status, 403)
  // The order of the parameters doesn't matter, only what they say.
  const sig = new URL(url).searchParams.get("sig")
  assert.equal((await handle(new Request(`https://acme.dev/og?use=og&title=Hi&sig=${sig}`))).status, 200)
})

test("a site's logo names its brand colour before its stylesheet does", async () => {
  const { readProject } = await import("../src/project.ts")
  const { readPage } = await import("../src/page.ts")
  const other = mkdtempSync(join(tmpdir(), "surfaces-logo-"))
  try {
    mkdirSync(join(other, "public"))
    writeFileSync(join(other, "package.json"), JSON.stringify({ name: "other" }))
    writeFileSync(join(other, "public/logo.svg"), `<svg><path fill="#7c3aed" d="M0 0h10v10z"/><path fill="#111111" d="M0 0h5v5z"/><circle fill="#7c3aed" r="3"/></svg>`)
    writeFileSync(join(other, "styles.css"), ":root { --primary: #f59e0b; }")
    const project = readProject(other)
    assert.ok(project.read.includes("public/logo.svg"))
    assert.equal(readPage(project.html, project.css).colors?.[0], "#7c3aed")
  } finally {
    rmSync(other, { recursive: true, force: true })
  }
})

test("kit writes the brand's link preview and headers, where the site points at them, and never an icon", async () => {
  // The site names its preview itself.
  write("app/layout.tsx", `${readFileSync(join(site, "app/layout.tsx"), "utf8")}\nexport const meta = [{ property: "og:image", content: "https://acmebakery.com/social/card.jpg" }]`)
  const dry = await run("kit", "--dry-run")
  assert.match(dry.out, /Would write public\/social\/card\.jpg {2}link preview/)
  assert.ok(!existsSync(join(site, "public/social/card.jpg")))
  const { code, out } = await run("kit")
  assert.equal(code, 0, out)
  for (const file of ["social/card.jpg", "x-header.jpg", "linkedin-banner.jpg", "email-header.jpg"]) {
    assert.ok(existsSync(join(site, "public", file)), file)
  }
  // An icon is the brand's own; kit draws none.
  for (const file of ["favicon.ico", "favicon.svg", "apple-touch-icon.png", "icon-192.png", "icon-512.png"]) {
    assert.ok(!existsSync(join(site, "public", file)), file)
  }
  assert.deepEqual([...readFileSync(join(site, "public/social/card.jpg")).subarray(0, 2)], [0xff, 0xd8])
  assert.doesNotMatch(out, /og:image/)
  // Again, it leaves what is there, unless forced.
  assert.match((await run("kit")).out, /Left public\/x-header\.jpg: it is there already/)
  assert.match((await run("kit", "--force")).out, /Replaced public\/x-header\.jpg/)
})
