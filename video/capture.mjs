// Takes the film's picture frame by frame and gives the frames to ffmpeg.
//   node video/capture.mjs                     the whole film, to video/out/surfaces-launch.mp4
//   node video/capture.mjs --from 11 --to 18   a stretch of it, to video/out/part.mp4
//   node video/capture.mjs --stills 0,2.6,5    single moments, as PNGs and one sheet, to video/out/stills
// One frame at a time, with a breath between frames, and it stops if Chrome grows too large:
// this is meant to be kind to the machine, not fast.
import { execFileSync, spawn } from "node:child_process"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { openChrome, pause } from "./chrome.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, "out")
const option = (name, otherwise) => {
  const at = process.argv.indexOf(`--${name}`)
  return at === -1 ? otherwise : process.argv[at + 1]
}
const FPS = Number(option("fps", 60))
const BREATH = Number(option("breath", 12)) // ms of rest after each frame
const MOST_MB = Number(option("most", 3500)) // across all of Chrome's processes; it idles near 1300
const PAGE = option("page", "film.html")
// Density 2 draws each frame at 3840 x 2160 and scales it down: smoother edges on things seen in perspective, at four times the pixels.
const DENSITY = Number(option("density", 1))
const FRAME = { x: 0, y: 0, width: 1920, height: 1080 }

let chrome
const open = async () => {
  chrome = await openChrome()
  await chrome.size(1920, 1080, DENSITY)
  await chrome.goto(`${pathToFileURL(join(HERE, PAGE)).href}?capture`)
  await chrome.run("film.ready")
  return chrome.run("film.duration")
}
// The frame at second t: placed, given two turns of the page to settle, and photographed. A Chrome that stops answering is replaced.
const frameAt = async (t) => {
  for (let tries = 0; ; tries++) {
    try {
      await chrome.run(`film.seek(${t}); new Promise((done) => { const soon = setTimeout(done, 150); requestAnimationFrame(() => requestAnimationFrame(() => (clearTimeout(soon), done()))) })`)
      return await chrome.picture(FRAME)
    } catch (error) {
      if (tries === 2) throw error
      console.warn(`  frame at ${t.toFixed(3)}s failed (${error.message}); reopening Chrome`)
      await chrome.close().catch(() => {})
      await open()
    }
  }
}

const duration = await open()
try {
  const stills = option("stills")
  if (stills) {
    const dir = join(OUT, "stills")
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
    const moments = stills.split(",").map(Number)
    for (const [i, t] of moments.entries()) writeFileSync(join(dir, `still-${String(i).padStart(2, "0")}.png`), await frameAt(t))
    const across = Number(option("across", 3))
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", join(dir, "still-%02d.png"), "-vf", `scale=${Math.floor(1920 / across)}:-1:flags=lanczos,tile=${across}x${Math.ceil(moments.length / across)}`, "-frames:v", "1", join(dir, "sheet.png")])
    console.log(`${moments.length} stills and their sheet in video/out/stills (moments: ${moments.join(", ")})`)
  } else {
    const from = Number(option("from", 0))
    const to = Number(option("to", duration))
    const first = Math.round(from * FPS)
    const count = Math.round((to - from) * FPS)
    const whole = from === 0 && to === duration
    const file = join(OUT, option("out", whole ? "surfaces-launch.mp4" : "part.mp4"))
    const ffmpeg = spawn(
      "ffmpeg",
      [
        "-y", "-loglevel", "error",
        "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-",
        // What X and LinkedIn take without complaint: H.264, 4:2:0, tagged as the colours it is.
        "-vf", "scale=1920:1080:flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p",
        "-c:v", "libx264", "-preset", "slow", "-crf", option("crf", "14"), "-threads", option("threads", "4"),
        "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
        "-movflags", "+faststart", file,
      ],
      { stdio: ["pipe", "inherit", "inherit"] },
    )
    const encoded = new Promise((resolve, reject) => ffmpeg.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg stopped with ${code}`)))))
    const started = Date.now()
    for (let i = 0; i < count; i++) {
      const png = await frameAt((first + i) / FPS)
      if (!ffmpeg.stdin.write(png)) await new Promise((resolve) => ffmpeg.stdin.once("drain", resolve))
      if ((i + 1) % 60 === 0 || i + 1 === count) {
        const held = chrome.memory()
        console.log(`  ${i + 1}/${count} frames  ${((Date.now() - started) / 1000).toFixed(0)}s  Chrome holds ${held} MB`)
        if (held > MOST_MB) throw new Error(`Chrome holds ${held} MB, over the ${MOST_MB} MB allowed: stopped. Run the rest with --from ${((first + i + 1) / FPS).toFixed(3)}.`)
      }
      await pause(BREATH)
    }
    ffmpeg.stdin.end()
    await encoded
    console.log(`${file}  ${count} frames at ${FPS} fps`)
  }
} finally {
  await chrome.close().catch(() => {})
}
process.exit(0)
