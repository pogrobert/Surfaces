import { StrictMode, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties, ReactNode, RefObject } from "react"
import { createRoot } from "react-dom/client"
import type { Root } from "react-dom/client"
import { createBrand } from "@pogrobert/surfaces"
import type { StyleName } from "@pogrobert/surfaces"
import { Surface } from "@pogrobert/surfaces/react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { INIT, LINKS, NAME, ORDER, PROMPT, sample } from "./data.ts"
import { Code, CopyButton, GitHubMark, Mend, ThemeSwitch } from "./parts.tsx"
import { useTheme } from "@/lib/theme"
import { behind, DARK_INK, halo, LIGHT_INK } from "@/lib/behind"
import type { Behind } from "@/lib/behind"
import "./styles.css"

// The main page: one plate, a picture the size of the window, stepping through
// the thirty styles, and under it only a paragraph, how to install, and the way
// to the studio. Everything you can choose is in the studio.
const SAY = "Pictures for every page of your site, drawn from one colour."
const SUB = "Post covers, link previews, headers. Thirty styles, each yours to tune."
const round = (n: number) => Math.round(n / 4) * 4
// The shape a style shows on the plate where its seed's own pick is not the
// one to open the page with: Stencil opens it, on its grid of tiles.
const SHAPE: Partial<Record<StyleName, string>> = { stencil: "grid" }
// The seed a style draws from on the plate where the page's own would set its
// words badly: from "home", Marbling covers the whole plate and lays the words
// on a paper card; from "home-4" it lays a combed sheet across the top instead.
const SEED: Partial<Record<StyleName, string>> = { marbling: "home-4" }
// The styles that cover the whole plate rather than draw one thing on it.
// Those of large or soft forms run on under the words (OVER); those of fine
// lines or bold repeats, which would be noise under small text, keep room
// for the words and run round them.
const COVERS = new Set<StyleName>(["trails", "strata", "engraving", "currents", "moire", "endpaper", "sfumato", "underpaint", "marbling"])
const OVER = new Set<StyleName>(["marbling", "strata", "moire", "underpaint", "sfumato"])
// The styles whose art is too busy for a halo to carry the words: they get
// a plain ground of the art's own paper behind the text alone, like a label
// pasted on a marbled sheet, and no halo.
const LABEL = new Set<StyleName>(["marbling"])

// An element's own size, to the nearest 4px, so a change too small to see
// draws nothing again. The plate is measured, not the window: a phone's
// window grows and shrinks as its address bar hides on scroll, and the plate
// (sized in svh) does not.
function useSize(element: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  useLayoutEffect(() => {
    const target = element.current
    if (!target) return
    const read = (w: number, h: number) => setSize((was) => (was && was.w === round(w) && was.h === round(h) ? was : { w: round(w), h: round(h) }))
    const box = target.getBoundingClientRect()
    read(box.width, box.height)
    const watch = new ResizeObserver(([entry]) => entry && read(entry.contentRect.width, entry.contentRect.height))
    watch.observe(target)
    return () => watch.disconnect()
  }, [])
  return size
}

// A stepper button, its key named in its tooltip.
function Step({ by, label, keyName, children }: { by: number; label: string; keyName: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} data-step={by} className="transition-[scale] hover:bg-(--on)/10 hover:text-(--on) pointer-coarse:size-11">
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {label} <Kbd>{keyName}</Kbd>
      </TooltipContent>
    </Tooltip>
  )
}

function Words({ ink, studio, refer, color, shadow, shadowSmall }: { ink: { on: string; off: string }; studio: string; refer?: (element: HTMLDivElement | null) => void; color?: string; shadow?: string; shadowSmall?: string }) {
  return (
    <div ref={refer} className="grid justify-items-start" style={{ "--on": ink.on, "--off": ink.off, color, textShadow: shadow } as CSSProperties}>
      <h1 className="text-[clamp(34px,5cqw,84px)] leading-[0.98] font-[680] tracking-[-0.035em] text-balance">{SAY}</h1>
      <p className="mt-[0.9em] text-[clamp(15px,1.2cqw,24px)] leading-[1.35] font-medium tracking-[-0.005em] opacity-80" style={{ textShadow: shadowSmall }}>{SUB}</p>
      {/* What to do next, with the words that say why, as a hero has it. They
          change colour with the art, at once, never after it. */}
      <div className="mt-6 flex flex-wrap gap-2.5 [text-shadow:none]">
        <CopyButton text={PROMPT} size="lg" className="bg-(--on) px-4 text-(--off) transition-[scale] hover:bg-(--on)/85">Copy prompt</CopyButton>
        <Button variant="outline" size="lg" asChild className="border-(--on)/20 bg-(--off)/90 px-4 text-(--on) transition-[scale] hover:bg-(--off) hover:text-(--on) dark:border-(--on)/20 dark:bg-(--off)/90 dark:hover:bg-(--off)">
          <a href={studio}>See all thirty in the studio</a>
        </Button>
      </div>
    </div>
  )
}

function Plate() {
  const [at, setAt] = useState(0)
  // The counter moves at once; the picture follows as soon as it is drawn.
  const shown = useDeferredValue(at)
  const plate = useRef<HTMLElement>(null)
  const step = (by: number) => setAt((i) => (i + by + ORDER.length) % ORDER.length)
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return
      // A held key draws nothing more, and with a modifier an arrow is the
      // browser's (Alt or Cmd and ← is Back). Nor does a key step a plate
      // that has been scrolled away, or one typed into a field.
      if (event.repeat || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return
      if ((event.target as Element).closest?.("input, textarea, select, [contenteditable]")) return
      if ((plate.current?.getBoundingClientRect().bottom ?? 0) <= 0) return
      step(event.key === "ArrowRight" ? 1 : -1)
    }
    addEventListener("keydown", key)
    return () => removeEventListener("keydown", key)
  }, [])

  const size = useSize(plate)
  // The picture follows the reader's light or dark, and so does the ink the
  // buttons read from it.
  const { choice, dark } = useTheme()
  const w = size?.w ?? 1
  // On a narrow window the stepper can't stand over the art beside the
  // words, so the art stops short of it and it sits on the page below.
  const narrow = w < 860
  const below = narrow ? 64 : 0
  const tall = Math.max((size?.h ?? 1) - below, 1)
  // Drawn to the plate's own shape, however tall a phone makes it.
  const height = Math.max(600, Math.min(8192, Math.round((2400 * tall) / w)))
  const style = ORDER[shown]!
  const input = useMemo(() => {
    const { areas: _, ...rest } = createBrand({ name: sample(shown).name, color: sample(shown).color, style, theme: choice === "system" ? "auto" : choice, ...(SHAPE[style] ? { shape: SHAPE[style] } : null) }).input("post", { title: SAY, id: SEED[style] ?? "home", text: "bottom-left" })
    return rest
  }, [shown, choice])

  // Every box is measured in pixels of the plate and kept a twentieth of the
  // canvas at least and a fiftieth in from its edges, as the library asks.
  const share = (value: number, of: number, least = 0.02) => Math.max(least, value / of)
  // The words' room is as tall as the words are, so on a phone, a short
  // window or at a large zoom the art keeps clear of all of them, not of a
  // fixed share they spill out of. It hangs from the foot, below the header.
  // The words appear only once the plate is measured, so they are watched
  // from the moment their element arrives.
  const [words, setWords] = useState<HTMLDivElement | null>(null)
  const [wordsH, setWordsH] = useState(0)
  useLayoutEffect(() => {
    if (!words) return
    setWordsH(round(words.getBoundingClientRect().height))
    const watch = new ResizeObserver(([entry]) => entry && setWordsH(round(entry.contentRect.height)))
    watch.observe(words)
    return () => watch.disconnect()
  }, [words])
  const left = share(narrow ? 24 : 0.06 * w, w)
  const across = narrow ? 1 - 2 * left : 0.6
  const foot = narrow ? 1 - share(20, tall) : 0.9
  const room = Math.max(0.05, foot - share(70, tall))
  // On a wide window a style that draws one thing gets the whole left side
  // kept for the words, from under the header to the foot, so the thing takes
  // the right side, large, and is not pressed into the band above them. A
  // style that covers the whole plate keeps only as much as the words are
  // tall, so it runs over and round them instead of stopping in a hard edge
  // beside them. On a phone the art stands above the words either way.
  // A style that covers the whole plate runs on under the words, and they
  // are set over it with an ink and a halo read from the art behind them.
  const over = OVER.has(style)
  const fitted = narrow || COVERS.has(style)
  const high = fitted ? Math.min(room, Math.max(0.05, wordsH ? (wordsH + 8) / tall : 0.34)) : room
  const wordsBox = { x: left, y: foot - high, w: across, h: high }

  const [art, setArt] = useState<Behind>({ ink: DARK_INK, glow: LIGHT_INK, halo: 0.6 })
  // The text as drawn, its lines and not their room, for the scrim to follow.
  const [text, setText] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  useLayoutEffect(() => {
    if (!over || !words?.offsetParent) return setText(null)
    // Each line of text as drawn, and each button, together.
    const parts: DOMRect[] = []
    for (const node of words.querySelectorAll("h1, p")) {
      const range = document.createRange()
      range.selectNodeContents(node)
      parts.push(...Array.from(range.getClientRects()))
    }
    for (const button of words.querySelectorAll("[data-slot=button]")) parts.push(button.getBoundingClientRect())
    if (!parts.length) return
    const lines = { left: Math.min(...parts.map((r) => r.left)), top: Math.min(...parts.map((r) => r.top)), width: 0, height: 0 }
    lines.width = Math.max(...parts.map((r) => r.right)) - lines.left
    lines.height = Math.max(...parts.map((r) => r.bottom)) - lines.top
    const frame = (words.offsetParent as HTMLElement).offsetParent?.getBoundingClientRect() ?? (words.offsetParent as HTMLElement).getBoundingClientRect()
    const next = { x: Math.round(lines.left - frame.left), y: Math.round(lines.top - frame.top), w: Math.round(lines.width), h: Math.round(lines.height) }
    setText((was) => (was && was.x === next.x && was.y === next.y && was.w === next.w && was.h === next.h ? was : next))
  }, [over, words, shown, w, wordsH, art])
  useEffect(() => {
    if (!over || !size) return
    let gone = false
    const timer = setTimeout(() => {
      behind(input, w / tall, wordsBox, dark).then((read) => !gone && setArt(read), () => {})
    }, 60)
    return () => ((gone = true), clearTimeout(timer))
  }, [over, input, w, tall, wordsBox.x, wordsBox.y, wordsBox.w, wordsBox.h, dark])

  // The buttons and the stepper take their colours from the ink the art
  // chose for the words, solid in it or on a face of its opposite, so they
  // read on a dark plate as on a pale one, whatever the page's own theme.
  const [ink, setInk] = useState({ on: "#121212", off: "#ffffff" })
  useLayoutEffect(() => {
    if (!words) return
    const seen = getComputedStyle(words).color
    // rgb() in 0 to 255, or color(srgb) in 0 to 1.
    const scale = seen.startsWith("color(") ? 255 : 1
    const [r = 0, g = 0, b = 0] = (seen.match(/[\d.]+/g) ?? []).map((n) => Number(n) * scale)
    const on = `rgb(${r} ${g} ${b})`
    const off = 0.2126 * r + 0.7152 * g + 0.0722 * b > 128 ? "#121212" : "#ffffff"
    setInk((was) => (was.on === on && was.off === off ? was : { on, off }))
  }, [words, shown, height, w, wordsH, dark, art])

  // The studio opens on the style, shape and colour the plate shows.
  const studio = `/studio/?${new URLSearchParams({ style, ...(SHAPE[style] ? { shape: SHAPE[style] } : null), color: sample(shown).color })}`
  const links = [["Studio", studio], ["GitHub", LINKS.github]] as const
  const chip = "bg-(--off)/90 text-(--on) ring-1 ring-(--on)/15"
  return (
    <section ref={plate} className="relative h-svh min-h-[max(520px,25vw)] max-[860px]:h-[86svh]">
      {size && (
        <Mend
          retry={shown}
          fallback={
            // A style that fails to draw leaves the words on plain ground.
            <div className="absolute inset-0 tint" style={{ bottom: below }}>
              <div className="absolute" style={{ left: `${wordsBox.x * 100}%`, bottom: `${(1 - foot) * 100}%`, width: `${wordsBox.w * 100}%` }}>
                <Words ink={{ on: "var(--ink)", off: "var(--paper)" }} studio={studio} />
              </div>
            </div>
          }
        >
          <Surface
            {...input}
            width={2400}
            height={height}
            css={{ position: "absolute", inset: 0, bottom: below, aspectRatio: "auto" }}
            areas={
              over
                ? []
                : [
                    {
                      box: wordsBox,
                      // The words sit at the foot of their room, however tall it is.
                      content: (
                        <div className="flex h-full flex-col justify-end">
                          <Words ink={ink} studio={studio} refer={setWords} />
                        </div>
                      ),
                    },
                  ]
            }
          />
          {over && (
            <div className="pointer-events-none absolute inset-0 [container-type:inline-size]" style={{ bottom: below }}>
              {/* For art too busy for a halo, a plain ground of its own paper
                  behind the text alone, close round the lines, with no blur
                  and no rule round it. */}
              {LABEL.has(style) && text && (
                <div aria-hidden className="absolute rounded-[4px]" style={{ left: text.x - 32, top: text.y - 28, width: text.w + 64, height: text.h + 56, background: art.glow }} />
              )}
              <div className="pointer-events-auto absolute flex flex-col justify-end" style={{ left: `${wordsBox.x * 100}%`, top: `${wordsBox.y * 100}%`, width: `${wordsBox.w * 100}%`, height: `${wordsBox.h * 100}%` }}>
                <Words ink={ink} studio={studio} refer={setWords} color={art.ink} shadow={LABEL.has(style) ? "none" : halo(art)} shadowSmall={LABEL.has(style) ? "none" : halo(art, true)} />
              </div>
            </div>
          )}
        </Mend>
      )}
      {/* The name and the links, on small solid chips over the art, as the
          stepper is: they need no area of their own, so the art runs under
          them and lays no glow of ground behind them to keep them legible. */}
      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3.5 max-[860px]:p-3" style={{ "--on": ink.on, "--off": ink.off } as CSSProperties}>
        <a href="/" className={`pointer-events-auto rounded-[10px] px-3 py-1.5 text-[15px] font-bold tracking-[-0.01em] ${chip}`}>Surfaces</a>
        <nav className={`pointer-events-auto flex gap-0.5 rounded-[10px] p-0.5 ${chip}`}>
          {links.map(([name, href]) => (
            <Button key={name} variant="ghost" size="sm" asChild className="cursor-pointer text-current transition-[scale] hover:bg-(--on)/10 hover:text-current">
              <a href={href}>
                {name === "GitHub" && <GitHubMark />}
                {name}
              </a>
            </Button>
          ))}
          <span aria-hidden className="mx-0.5 my-1.5 w-px bg-(--on)/15" />
          <ThemeSwitch />
        </nav>
      </header>
      <div
        className="absolute right-6 bottom-[22px] max-[860px]:right-4 max-[860px]:bottom-3 max-[860px]:left-4"
        onClick={(event) => {
          const by = (event.target as Element).closest<HTMLElement>("[data-step]")?.dataset.step
          if (by) step(Number(by))
        }}
      >
        {/* Over the art it wears the words' colours; below it, on a phone, the page's. */}
        <div
          className={`flex w-fit items-center gap-0.5 rounded-xl p-1 ring-1 ${narrow ? "bg-background ring-border [--on:var(--ink)]" : "bg-(--off)/90 text-(--on) ring-(--on)/15"}`}
          style={narrow ? undefined : ({ "--on": ink.on, "--off": ink.off } as CSSProperties)}
        >
          <Step by={-1} label="The style before" keyName="←">
            <ChevronLeft />
          </Step>
          {/* As wide as the longest name, so the arrows never move under the pointer. */}
          <span className="w-[19ch] text-center font-mono text-[13px] whitespace-pre">{`${NAME(ORDER[at]!)}  ${String(at + 1).padStart(2, "0")}/${ORDER.length}`}</span>
          <Step by={1} label="The next style" keyName="→">
            <ChevronRight />
          </Step>
        </div>
      </div>
    </section>
  )
}

function Home() {
  return (
    <TooltipProvider delayDuration={300}>
      <Plate />
      <div className="mx-auto max-w-[1240px] px-6 pt-24 pb-[72px] max-[640px]:px-4">
        <p className="max-w-[54ch] text-[21px] leading-[1.42] tracking-[-0.008em] text-pretty text-body">
          <b className="font-semibold text-ink">Surfaces draws the pictures a site repeats</b>: the cover of each post, the preview of each link, the header of each profile. One colour in, one look out, and the same title always gets the same picture. The words stay yours, in your own type. No image model, no API key, nothing to pay.
        </p>
        <div className="mt-11 grid grid-cols-2 gap-x-10 gap-y-3.5 max-[860px]:grid-cols-1">
          <div>
            <p className="mb-2 text-body">Ask your coding agent.</p>
            <Code code={PROMPT} />
          </div>
          <div>
            <p className="mb-2 text-body">Or run it yourself.</p>
            <Code code={INIT} lang="bash" />
          </div>
        </div>
        <Button variant="link" asChild className="mt-7 h-auto px-0 text-[17px] font-semibold text-ink underline decoration-1 underline-offset-[5px]">
          <a href="/studio/">Every style and every choice, in the studio →</a>
        </Button>
        <footer className="mt-24 flex flex-wrap gap-x-[22px] gap-y-2 border-t border-rule pt-[18px] text-sm text-quiet">
          <span>Surfaces · MIT No Attribution</span>
          <a href="/studio/">Studio</a>
          <a href={LINKS.github}>GitHub</a>
          <a href={LINKS.npm}>npm</a>
        </footer>
      </div>
    </TooltipProvider>
  )
}

// Mounted once: a hot reload while editing renders into the same root.
const holder = document.getElementById("root") as HTMLElement & { root?: Root }
;(holder.root ??= createRoot(holder)).render(
  <StrictMode>
    <Home />
  </StrictMode>
)
