import { StrictMode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties, ReactNode } from "react"
import { createRoot } from "react-dom/client"
import type { Root } from "react-dom/client"
import { createBrand } from "@pogrobert/surfaces"
import { Surface } from "@pogrobert/surfaces/react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { INIT, NAME, ORDER, PROMPT, sample } from "./data.ts"
import { Code, CopyButton } from "./parts.tsx"
import "./styles.css"

// The main page: one plate, a picture the size of the window, stepping through
// the thirty styles, and under it only a paragraph, how to install, and the way
// to the studio. Everything you can choose is in the studio.
const SAY = "Pictures for every page of your site, drawn from one colour."
const SUB = "Post covers, link previews, headers. Thirty styles, each yours to tune."

// The window's shape, so the plate is drawn to it and not cropped from another.
function useWindow() {
  const read = () => ({ w: innerWidth, h: innerHeight })
  const [size, setSize] = useState(read)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const resize = () => (clearTimeout(timer), (timer = setTimeout(() => setSize(read()), 200)))
    addEventListener("resize", resize)
    return () => (clearTimeout(timer), removeEventListener("resize", resize))
  }, [])
  return size
}

// A stepper button, its key named in its tooltip.
function Step({ by, label, keyName, children }: { by: number; label: string; keyName: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} data-step={by}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {label} <Kbd>{keyName}</Kbd>
      </TooltipContent>
    </Tooltip>
  )
}

function Plate() {
  const [at, setAt] = useState(0)
  const step = (by: number) => setAt((i) => (i + by + ORDER.length) % ORDER.length)
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.target as Element).closest?.("input, textarea")) return
      if (event.key === "ArrowRight") step(1)
      if (event.key === "ArrowLeft") step(-1)
    }
    addEventListener("keydown", key)
    return () => removeEventListener("keydown", key)
  }, [])
  const view = useWindow()
  // On a narrow window the stepper can't stand over the art beside the
  // words, so the art stops short of it and it sits on the page below.
  const narrow = view.w <= 860
  const below = narrow ? 64 : 0
  const tall = Math.max(view.h * (narrow ? 0.86 : 1), 520) - below
  const height = Math.max(600, Math.min(2400, Math.round((2400 * tall) / Math.max(view.w, 1))))
  const style = ORDER[at]!
  const { areas, ...input } = useMemo(() => createBrand({ name: sample(at).name, color: sample(at).color, style }).input("post", { title: SAY, id: "home", text: "bottom-left" }), [at])
  const links = ["Studio", "Docs", "GitHub"]
  // The name and the links stand where a page's header does, in small boxes
  // of their own measured in pixels of the window, which the art keeps clear
  // and inks to read, as it does the words. A box is kept a twentieth of the
  // canvas at least and a fiftieth in from its edges, as the library asks.
  const share = (value: number, of: number, least = 0.02) => Math.max(least, value / of)
  const box = (x: number, y: number, w: number, h: number) => {
    const across = Math.min(share(w, view.w, 0.05), 0.96)
    return { x: Math.min(share(x, view.w), 0.98 - across), y: share(y, tall), w: across, h: share(h, tall, 0.05) }
  }
  const edge = narrow ? 16 : 24
  // The buttons by the words take their colours from the ink the art chose
  // for the words, solid in it or on a face of its opposite, so they read on
  // a dark plate as on a pale one, whatever the page's own theme.
  const words = useRef<HTMLDivElement>(null)
  const [ink, setInk] = useState({ on: "#121212", off: "#ffffff" })
  useLayoutEffect(() => {
    if (!words.current) return
    const seen = getComputedStyle(words.current).color
    // rgb() in 0 to 255, or color(srgb) in 0 to 1.
    const scale = seen.startsWith("color(") ? 255 : 1
    const [r = 0, g = 0, b = 0] = (seen.match(/[\d.]+/g) ?? []).map((n) => Number(n) * scale)
    const on = `rgb(${r} ${g} ${b})`
    const off = 0.2126 * r + 0.7152 * g + 0.0722 * b > 128 ? "#121212" : "#ffffff"
    setInk((was) => (was.on === on && was.off === off ? was : { on, off }))
  })

  return (
    <section className="relative h-svh min-h-[520px] max-[860px]:h-[86svh]">
      <Surface
        {...input}
        width={2400}
        height={height}
        css={{ position: "absolute", inset: 0, bottom: below, aspectRatio: "auto" }}
        areas={[
          {
            ...areas![0]!,
            content: (
              <div ref={words} className="grid justify-items-start" style={{ "--on": ink.on, "--off": ink.off } as CSSProperties}>
                <h1 className="text-[clamp(34px,5cqw,84px)] leading-[0.98] font-[680] tracking-[-0.035em] text-balance">{SAY}</h1>
                <p className="mt-[0.9em] text-[max(15px,1.2cqw)] leading-[1.35] font-medium tracking-[-0.005em] opacity-80">{SUB}</p>
                {/* What to do next, with the words that say why, as a hero has it. */}
                <div className="mt-6 flex flex-wrap gap-2.5">
                  <CopyButton text={PROMPT} size="lg" className="bg-(--on) px-4 text-(--off) hover:bg-(--on)/85">Copy prompt</CopyButton>
                  <Button variant="outline" size="lg" asChild className="border-(--on)/20 bg-(--off)/90 px-4 text-(--on) hover:bg-(--off) hover:text-(--on) dark:border-(--on)/20 dark:bg-(--off)/90 dark:hover:bg-(--off)">
                    <a href="/studio/">See all thirty in the studio</a>
                  </Button>
                </div>
              </div>
            ),
          },
          { box: box(edge, 14, 120, 40), content: <b className="flex h-full items-center text-[15px] tracking-[-0.01em]">Surfaces</b> },
          ...(narrow
            ? []
            : [
                {
                  box: box(view.w - edge - 250, 14, 250, 40),
                  content: (
                    <nav className="-mr-2.5 flex h-full w-full items-center justify-end gap-1">
                      {links.map((link) => (
                        <Button key={link} variant="ghost" asChild className="text-current opacity-85 hover:bg-current/10 hover:text-current hover:opacity-100">
                          <a href={link === "Studio" ? "/studio/" : "#"}>{link}</a>
                        </Button>
                      ))}
                    </nav>
                  ),
                },
              ]),
        ]}
      />
      <div
        className="absolute right-6 bottom-[22px] max-[860px]:right-4 max-[860px]:bottom-3 max-[860px]:left-4"
        onClick={(event) => {
          const by = (event.target as Element).closest<HTMLElement>("[data-step]")?.dataset.step
          if (by) step(Number(by))
        }}
      >
        {/* Over the art it wears the words' colours; below it, on a phone, the page's. */}
        <div
          className={`flex w-fit items-center gap-0.5 rounded-xl p-1 ring-1 ${narrow ? "bg-background ring-border" : "bg-(--off)/90 text-(--on) ring-(--on)/15 [&_button:hover]:bg-(--on)/10 [&_button:hover]:text-(--on)"}`}
          style={{ "--on": ink.on, "--off": ink.off } as CSSProperties}
        >
          <Step by={-1} label="The style before" keyName="←">
            <ChevronLeft />
          </Step>
          <span className="min-w-[132px] text-center font-mono text-[13px] whitespace-pre">{`${NAME(style)}  ${String(at + 1).padStart(2, "0")}/${ORDER.length}`}</span>
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
          <a href="#">Docs</a>
          <a href="#">GitHub</a>
          <a href="#">npm</a>
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
