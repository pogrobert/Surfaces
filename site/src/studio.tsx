import { StrictMode, useDeferredValue, useMemo, useState } from "react"
import { createRoot } from "react-dom/client"
import { createBrand } from "@pogrobert/surfaces"
import type { Grain, Mood, StyleName, Theme, Use } from "@pogrobert/surfaces"
import { Cover, Surface } from "@pogrobert/surfaces/react"
import { ABOUT, KINDS, NAME, SAMPLES, SIZES } from "./data.ts"
import { Copy, Picture } from "./parts.tsx"
import "./styles.css"

// The studio: every choice the library has, seen and made. Laid out as a desk:
// the styles in a list, one large picture, every choice beside it, and the
// code that makes it under it. On a phone the styles run in a row.
type Look = { name: string; color: string; style: StyleName; shape: string | null; mood: Mood | null; grain: Grain; theme: Theme; use: Use; title: string }

const brandOf = (look: Look) =>
  createBrand({ name: look.name, color: look.color, style: look.style, theme: look.theme, grain: look.grain, ...(look.shape ? { shape: look.shape } : null), ...(look.mood ? { mood: look.mood } : null) })

// The code that draws what is shown, with only the choices that aren't the default.
function snippet(look: Look) {
  const options: [string, string][] = [["name", look.name], ["color", look.color], ["style", look.style]]
  if (look.theme !== "light") options.push(["theme", look.theme])
  if (look.grain !== "natural") options.push(["grain", look.grain])
  if (look.shape) options.push(["shape", look.shape])
  if (look.mood) options.push(["mood", look.mood])
  const call = SIZES.find((size) => size.use === look.use)!.call
  return `const brand = createBrand({ ${options.map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(", ")} })\n${call}`
}

// A choice: a row of words, one pressed.
function Choice<T extends string | null>({ label, value, options, set }: { label: string; value: T; options: readonly (readonly [T, string])[]; set: (value: T) => void }) {
  return (
    <div className="grid gap-[7px]">
      <span className="text-[13px] text-quiet">{label}</span>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1">
        {options.map(([option, text]) => (
          <button
            key={String(option)}
            type="button"
            aria-pressed={option === value}
            onClick={() => set(option)}
            className="rounded-lg px-2.5 py-[5px] text-sm tint hover:tint-strong aria-pressed:bg-ink aria-pressed:text-paper"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

function Styles({ look, pick }: { look: Look; pick: (style: StyleName) => void }) {
  return (
    <aside aria-label="Styles" className="sticky top-4 grid max-h-[calc(100svh-32px)] gap-[18px] overflow-auto max-[1100px]:static max-[1100px]:-mx-4 max-[1100px]:flex max-[1100px]:max-h-none max-[1100px]:gap-5 max-[1100px]:overflow-x-auto max-[1100px]:px-4 max-[1100px]:pb-2">
      {KINDS.map(([kind, styles]) => (
        <div key={kind} className="max-[1100px]:flex max-[1100px]:flex-none max-[1100px]:items-start max-[1100px]:gap-1">
          <h3 className="mb-1 text-[12.5px] font-medium text-quiet max-[1100px]:mr-1 max-[1100px]:mb-0 max-[1100px]:rotate-180 max-[1100px]:self-stretch max-[1100px]:text-right max-[1100px]:[writing-mode:vertical-rl]">{kind}</h3>
          {styles.map((style) => (
            <button
              key={style}
              type="button"
              aria-pressed={style === look.style}
              onClick={() => pick(style)}
              className="grid w-full grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[7px] py-[3px] pr-2 pl-[3px] text-left text-body aria-pressed:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] aria-pressed:font-semibold aria-pressed:text-ink max-[1100px]:w-[86px] max-[1100px]:grid-cols-1 max-[1100px]:gap-[5px] max-[1100px]:p-1 max-[1100px]:text-[13px]"
            >
              {/* Each in the colour and theme chosen, so the list shows what a change of colour does to every style. */}
              <Picture input={{ ...createBrand({ name: look.name, color: look.color, style, theme: look.theme }).input("card", { title: "Surfaces", id: "list" }), width: 160, height: 120 }} className="aspect-[4/3] w-full rounded-[2px]" />
              {NAME(style)}
              <small className="font-mono text-xs text-quiet max-[1100px]:hidden">{ABOUT[style].shapes.length || ""}</small>
            </button>
          ))}
        </div>
      ))}
    </aside>
  )
}

function Shown({ look }: { look: Look }) {
  const brand = useMemo(() => brandOf(look), [look.name, look.color, look.style, look.theme, look.grain, look.shape, look.mood])
  const size = SIZES.find((entry) => entry.use === look.use)!
  // A banner is art alone; the rest are covers with their title on them.
  if (size.banner) return <Surface {...brand.input(look.use)} className="rounded-[3px]" />
  return <Cover brand={brand} use={look.use} title={look.title} id="studio" motion="none" className="rounded-[3px]" />
}

function Studio() {
  const [look, setLook] = useState<Look>({ name: SAMPLES[0].name, color: SAMPLES[0].color, style: "riso", shape: null, mood: null, grain: "natural", theme: "light", use: "post", title: "What we shipped in March" })
  const set = (change: Partial<Look>) => setLook((was) => ({ ...was, ...change }))
  const about = ABOUT[look.style]
  const code = snippet(look)
  // The large picture follows a little behind typing and dragging.
  const shown = useDeferredValue(look)

  return (
    <>
      <header className="flex items-center gap-[18px] border-b border-rule px-6 py-4 max-[640px]:px-4">
        <a href="/" className="font-bold">Surfaces</a>
        <span className="text-quiet">Studio</span>
        <nav className="ml-auto flex gap-[18px] text-sm text-body">
          <a href="#">Docs</a>
          <a href="#">GitHub</a>
        </nav>
      </header>
      <div className="grid grid-cols-[200px_minmax(0,1fr)_300px] items-start gap-8 p-6 max-[1100px]:grid-cols-1 max-[1100px]:gap-6 max-[1100px]:p-4">
        <Styles look={look} pick={(style) => set({ style, shape: null })} />
        <main className="grid gap-[18px]">
          <Shown look={shown} />
          <p className="max-w-[62ch] text-pretty text-body">
            <b className="font-semibold text-ink">{NAME(look.style)}.</b> {about.looks} Suits {about.suits[0]!.toLowerCase()}{about.suits.slice(1)}
          </p>
          <div className="relative rounded-[10px] py-3.5 pr-[72px] pl-4 font-mono text-[13px] leading-[1.6] wrap-anywhere whitespace-pre-wrap tint">
            {code}
            <Copy text={code} className="absolute top-2 right-2 rounded-[7px] bg-sheet px-[9px] py-[3px] font-sans text-[13px] shadow-[0_0_0_1px_var(--rule)]" />
          </div>
        </main>
        <aside className="sticky top-4 grid gap-[18px] max-[1100px]:static">
          <div className="grid gap-[7px]">
            <span className="text-[13px] text-quiet">Colour</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {SAMPLES.map((entry) => (
                <button
                  key={entry.name}
                  type="button"
                  title={entry.color}
                  aria-label={`Colour ${entry.color}`}
                  aria-pressed={look.color === entry.color}
                  onClick={() => set({ name: entry.name, color: entry.color })}
                  style={{ background: entry.color }}
                  className="size-[26px] rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)] aria-pressed:outline-2 aria-pressed:outline-offset-2 aria-pressed:outline-ink"
                />
              ))}
              <input type="color" title="Any colour" aria-label="Any colour" value={look.color} onChange={(event) => set({ color: event.target.value })} className="size-[30px] border-0 bg-transparent p-0" />
            </div>
          </div>
          {about.shapes.length ? (
            <Choice label="Shape" value={look.shape} options={[[null, "Any"], ...about.shapes.map((shape) => [shape, NAME(shape)] as const)]} set={(shape) => set({ shape })} />
          ) : (
            <div className="grid gap-[7px]">
              <span className="text-[13px] text-quiet">Shape</span>
              <p className="text-body">One form; the title's seed varies it.</p>
            </div>
          )}
          <Choice label="Mood" value={look.mood} options={[[null, "Either"], ["calm", "Calm"], ["bold", "Bold"]]} set={(mood) => set({ mood })} />
          <Choice label="Grain" value={look.grain} options={[["smooth", "Smooth"], ["natural", "Natural"], ["heavy", "Heavy"]]} set={(grain) => set({ grain })} />
          <Choice label="Theme" value={look.theme} options={[["light", "Light"], ["dark", "Dark"]]} set={(theme) => set({ theme })} />
          <Choice label="Size" value={look.use} options={SIZES.map((size) => [size.use, size.name] as const)} set={(use) => set({ use })} />
          <label className="grid gap-[7px]">
            <span className="text-[13px] text-quiet">Title</span>
            <input value={look.title} maxLength={90} onChange={(event) => set({ title: event.target.value })} className="w-full rounded-[9px] border border-rule bg-sheet px-[11px] py-2 text-sm" />
          </label>
        </aside>
      </div>
    </>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Studio />
  </StrictMode>
)
