// The film's sound effects, placed by the film's own cues (film.cues in film.js)
// and tuned to the music bed they sit in.
//   node video/sound.mjs --music video/music/c-lofi-keys.mp3 --bpm 92          writes video/out/sound.wav
//   node video/sound.mjs --music video/music/c-lofi-keys.mp3 --bpm 92 --mux    and lays both under video/out/surfaces-launch.mp4
//
// The language is measured, by spectrum and envelope, from a launch film whose
// sound works, after four attempts by rule of thumb had missed:
//  - Every effect there is a NOTE of the music's key, 390 to 1050 Hz, with the
//    timbre of a soft mallet: the note, its octave 7 to 10 dB down, its twelfth
//    about 20 dB down. Nothing is made of noise; there are no airy whooshes.
//  - Each is tiny: up in 4 to 8 ms, 20 dB down within 12 to 30 ms, then a faint
//    tail that is 40 dB down by about a sixth of a second.
//  - Nothing is bright: almost no energy above 5 kHz.
//  - A run of things arriving is one note repeated over a lower one, not a scale.
//    (Here every step is exactly the same note, and every wipe another: a pitch
//    that varied from step to step was heard as the beep changing its tone.)
//  - The mark lands on a soft chord that swells in a fifth of a second and rings
//    three seconds. No riser, no boom.
//  - Accents peak 12 to 16 dB under full scale; everything else 8 to 12 dB lower.
//  - Typing is a dull tick about 3 ms long, its energy round 1 kHz and falling
//    steeply above 1.5 kHz, on an even pulse of one every 60 ms whatever the
//    letters do (not one a key, and not jittered), some 16 dB under the accents.
import { execFileSync, spawnSync } from "node:child_process"
import { writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { openChrome } from "./chrome.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, "out")
const RATE = 48_000
const FRAME = 1 / 60
const option = (name) => {
  const at = process.argv.indexOf(`--${name}`)
  return at === -1 ? undefined : process.argv[at + 1]
}

// --- The cues, asked of the film itself -------------------------------------------------------
const chrome = await openChrome()
let cues
let duration
try {
  await chrome.goto(`${pathToFileURL(join(HERE, "film.html")).href}?capture`)
  await chrome.run("film.ready")
  ;({ cues, duration } = JSON.parse(await chrome.run("JSON.stringify({ cues: film.cues, duration: film.duration })")))
} finally {
  await chrome.close()
}

// --- The music: its key, how far it sits from concert pitch, and where its beats fall ------------
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
const listen = (file, rate) => {
  const raw = execFileSync("ffmpeg", ["-loglevel", "error", "-i", file, "-ac", "1", "-ar", String(rate), "-f", "f32le", "-"], { maxBuffer: 1 << 28 })
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength >> 2)
}
const keyOf = (file) => {
  const sound = listen(file, 11025)
  // How strongly each of the twelve notes is heard, with the whole scale shifted by `cents`.
  const heardAt = (cents, stride = 1) => {
    const heard = new Array(12).fill(0)
    for (let from = 0; from + 4096 <= sound.length; from += 4096 * stride) {
      for (let midi = 36; midi < 84; midi++) {
        const w = (2 * Math.PI * 440 * 2 ** ((midi - 69 + cents / 100) / 12)) / 11025
        let re = 0
        let im = 0
        for (let i = 0; i < 4096; i += 2) {
          const v = sound[from + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / 4096))
          re += v * Math.cos(w * i)
          im += v * Math.sin(w * i)
        }
        heard[midi % 12] += Math.sqrt(re * re + im * im)
      }
    }
    return heard
  }
  // Music made by a model need not be at concert pitch: the shift at which the notes stand out most is its tuning.
  let cents = 0
  let most = 0
  for (let c = -45; c <= 45; c += 15) {
    const heard = heardAt(c, 3)
    const sharp = Math.max(...heard) / heard.reduce((a, b) => a + b, 0)
    if (sharp > most) [most, cents] = [sharp, c]
  }
  const heard = heardAt(cents)
  const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
  const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
  const fit = (shape, tonic) => {
    const mean = (list) => list.reduce((a, b) => a + b, 0) / 12
    const [mh, ms] = [mean(heard), mean(shape)]
    let top = 0, h2 = 0, s2 = 0
    for (let i = 0; i < 12; i++) {
      const [h, sh] = [heard[(i + tonic) % 12] - mh, shape[i] - ms]
      top += h * sh
      h2 += h * h
      s2 += sh * sh
    }
    return top / Math.sqrt(h2 * s2)
  }
  let best = { fit: -2 }
  for (let tonic = 0; tonic < 12; tonic++) for (const [minor, shape] of [[false, MAJOR], [true, MINOR]]) if (fit(shape, tonic) > best.fit) best = { fit: fit(shape, tonic), tonic, minor }
  return { ...best, cents }
}
// The beat: how long one lasts and when the first falls, from how the low end of the music pulses.
const beatOf = (file) => {
  const sound = listen(file, 8000)
  const STEP = 80 // 10 ms
  let low = 0
  const level = []
  for (let i = 0; i + STEP <= sound.length; i += STEP) {
    let sum = 0
    for (let k = 0; k < STEP; k++) {
      low += 0.12 * (sound[i + k] - low)
      sum += low * low
    }
    level.push(Math.sqrt(sum / STEP))
  }
  const rise = level.map((v, i) => Math.max(0, v - (level[i - 1] ?? v)))
  // A pulse heard at 138 may be a 92 played in threes: where the tempo is known (--bpm), only tempos near it are tried.
  const known = Number(option("bpm"))
  let best = { score: -1 }
  for (let bpm = known ? known - 3 : 70; bpm <= (known ? known + 3 : 140); bpm += 0.25) {
    const beat = 6000 / bpm // in steps
    for (let phase = 0; phase < beat; phase += 1) {
      let score = 0
      let count = 0
      for (let at = phase; at < rise.length - 1; at += beat) {
        score += Math.max(rise[Math.floor(at)], rise[Math.floor(at) + 1])
        count++
      }
      if (score / count > best.score) best = { score: score / count, bpm, beat: beat / 100, first: phase / 100 }
    }
  }
  return best
}
const musicFile = option("music") && resolve(option("music"))
const key = musicFile ? keyOf(musicFile) : { tonic: 0, minor: true, cents: 0, fit: 0 }
const beat = musicFile ? beatOf(musicFile) : null
if (musicFile) console.log(`the music: ${NAMES[key.tonic]} ${key.minor ? "minor" : "major"} (fit ${key.fit.toFixed(2)}), ${key.cents} cents from concert pitch, ${beat.bpm} beats a minute`)
// A note of the music: `degree` counts up its five-note scale from the tonic nearest middle C, and may be negative. Any of them sits with any chord of the key.
const STEPS = key.minor ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9]
const note = (degree) => 261.63 * 2 ** ((key.tonic > 6 ? key.tonic - 12 : key.tonic) / 12 + (STEPS[((degree % 5) + 5) % 5] + 12 * Math.floor(degree / 5)) / 12 + key.cents / 1200)
// The tonic and its fifth, which no chord of the key quarrels with.
const TONIC = 0
const FIFTH = 3

// --- A little synthesiser ---------------------------------------------------------------------
const length = Math.ceil((duration + 0.2) * RATE)
const dry = [new Float32Array(length), new Float32Array(length)]
const samples = (seconds) => Math.max(1, Math.round(seconds * RATE))
const make = (seconds, at) => Float32Array.from({ length: samples(seconds) }, (_, i) => at(i / RATE, i / samples(seconds)))
// Lays a sound into the mix from second `at`, at a place between the speakers (-1 left, 1 right).
const lay = (at, sound, { gain = 1, pan = 0 } = {}) => {
  const from = Math.round(at * RATE)
  const angle = ((pan + 1) * Math.PI) / 4
  for (let i = 0; i < sound.length; i++) {
    const n = from + i
    if (n < 0 || n >= length) continue
    dry[0][n] += sound[i] * gain * Math.cos(angle)
    dry[1][n] += sound[i] * gain * Math.sin(angle)
  }
}
// The mallet's tone: the note, its octave about 8 dB down and dying sooner, its twelfth 20 dB down and gone almost at once.
const tone = (hz, t) => Math.sin(2 * Math.PI * hz * t) + 0.4 * Math.sin(2 * Math.PI * 2 * hz * t) * Math.exp(-t / 0.06) + 0.1 * Math.sin(2 * Math.PI * 3 * hz * t) * Math.exp(-t / 0.02)
// A tick with a pitch: up in 5 ms, 20 dB down in about 25, and a faint tail 40 dB down by a sixth of a second.
const tick = (hz) => make(0.3, (t) => tone(hz, t) * Math.min(1, t / 0.005) * (0.96 * Math.exp(-t / 0.0095) + 0.04 * Math.exp(-t / 0.1)))
// A key: three milliseconds of 1 kHz, dull and dry. Always the same.
const key_ = make(0.012, (t) => Math.sin(2 * Math.PI * 1000 * t) * Math.min(1, t / 0.0004) * Math.exp(-t / 0.0013))
// The same over a lower note, as a run of things arriving is sounded: the upper leads, the lower is felt.
const pair = (upper, lower) => {
  const [a, b] = [tick(upper), tick(lower)]
  return a.map((v, i) => v + 0.45 * b[i])
}
// A transition's note: a plain tone that comes up over a tenth of a second and fades over a quarter, with no edge and no overtones. Meant to be half noticed.
const soft = (hz) => make(0.9, (t) => Math.sin(2 * Math.PI * hz * t) * Math.sin((Math.PI / 2) * Math.min(1, t / 0.1)) ** 2 * Math.exp(-Math.max(0, t - 0.1) / 0.13))
// A low swell under a move of the lens: the tonic an octave down, its fifth and its octave, rising and falling with no edge, all under 400 Hz.
const swell = (seconds) => make(seconds, (t, p) => (Math.sin(2 * Math.PI * note(TONIC - 5) * t) + 0.5 * Math.sin(2 * Math.PI * note(FIFTH - 5) * t) + 0.25 * Math.sin(2 * Math.PI * note(TONIC) * t)) * Math.sin(Math.PI * p) ** 2)
// The chord the mark lands on: tonic and fifth over three octaves, each swelling in a fifth of a second and ringing three.
const chord = () => {
  const voices = [[TONIC - 5, 1], [FIFTH - 5, 0.7], [TONIC, 0.9], [FIFTH, 0.55], [TONIC + 5, 0.5], [TONIC + 10, 0.22]]
  return make(3.6, (t) => voices.reduce((sum, [degree, level], k) => sum + (Math.sin(2 * Math.PI * note(degree) * t + k) + 0.18 * Math.sin(4 * Math.PI * note(degree) * t)) * level, 0) * Math.sin((Math.PI / 2) * Math.min(1, t / 0.18)) ** 2 * (0.9 * Math.exp(-t / 0.36) + 0.1 * Math.exp(-t / 1.3)))
}

// --- The film, cue by cue ---------------------------------------------------------------------
// Levels as shares of the loudest thing, an accent: the measured film keeps its small sounds 8 to 12 dB under its accents.
const ACCENT = 1
const PLAIN = 0.55
const SMALL = 0.3
// One note for each kind of thing, never varied: a sound that changes pitch from one step to the next reads as a mistake.
const STEP_NOTE = 10 // the tonic, two octaves up
const WIPE_NOTE = 3 // the fifth just above middle C: low, so it sits inside the music
// Typing: an even pulse from the first key of a run to its last, a tick every 60 ms, each a shade louder or softer than the one before.
const keys = cues.filter((cue) => cue.kind === "key").map((cue) => cue.at)
const LEVELS = [1, 0.8, 0.92, 0.72, 0.96, 0.84]
for (let i = 0, from = 0; i < keys.length; i++) {
  if (i + 1 < keys.length && keys[i + 1] - keys[i] < 0.3) continue
  let n = 0
  for (let at = keys[from]; at <= keys[i] + 0.001; at += 0.06) lay(at + FRAME, key_, { gain: SMALL * 0.6 * LEVELS[n++ % LEVELS.length] })
  from = i + 1
}
for (const [n, cue] of cues.entries()) {
  const { at, kind, dur = 0.5 } = cue
  // Each lands a frame after its picture: a sound that is early reads as wrong sooner than one that is late.
  const on = at + FRAME
  // Transitions are the quietest things in the film, some 16 dB under an accent: louder ones were heard as abrupt, three times over.
  if (kind === "pull") lay(at - 0.1, swell(dur + 0.3), { gain: SMALL * 0.25 })
  else if (kind === "push") {
    lay(at - 0.1, swell(dur + 0.2), { gain: SMALL * 0.25 })
    lay(at + dur - 0.05, soft(note(WIPE_NOTE)), { gain: SMALL * 0.5 })
  } else if (kind === "chip") lay(on, pair(note(STEP_NOTE), note(FIFTH)), { gain: ACCENT })
  else if (kind === "menu") lay(at, soft(note(FIFTH)), { gain: SMALL * 0.4 })
  else if (kind === "step") {
    // The same sound every step, only quieter where they come fastest.
    const gap = Math.min(cues[n + 1]?.kind === "step" ? cues[n + 1].at - at : 1, cues[n - 1]?.kind === "step" ? at - cues[n - 1].at : 1)
    lay(on, pair(note(STEP_NOTE), note(FIFTH)), { gain: gap < 0.2 ? PLAIN * 0.8 : PLAIN * 1.2, pan: 0.25 })
  } else if (kind === "wipe") lay(at - 0.02, soft(note(WIPE_NOTE)), { gain: SMALL * 0.5, pan: cue.side === "right" ? 0.2 : cue.side === "left" ? -0.2 : 0 })
  else if (kind === "shrink") {
    lay(at - 0.1, swell(dur + 0.2), { gain: SMALL * 0.25 })
    lay(at + dur - 0.05, soft(note(WIPE_NOTE)), { gain: SMALL * 0.5 })
  } else if (kind === "end") lay(at + (cue.lands ?? 0.45), chord(), { gain: 0.2 })
}

// --- A small room round it, and out ------------------------------------------------------------
// Echoes of a sound, each later and duller than the last: `seconds` is how long they take to die, `dark` how much top they lose.
const room = (sound, delays, seconds, dark) => {
  const wet = new Float32Array(sound.length)
  for (const delay of delays) {
    const gap = Math.round(delay * RATE)
    const back = 10 ** ((-3 * delay) / seconds)
    const line = new Float32Array(sound.length)
    let low = 0
    for (let i = gap; i < sound.length; i++) {
      low += dark * (sound[i - gap] + back * line[i - gap] - low)
      line[i] = low
      wet[i] += low / delays.length
    }
  }
  return wet
}
const sides = [0, 1].map((ear) => {
  const near = room(dry[ear], ear ? [0.0313, 0.0353, 0.0423, 0.0461] : [0.0297, 0.0371, 0.0411, 0.0437], 0.35, 0.3)
  const late = Math.round(0.012 * RATE)
  return Float32Array.from({ length }, (_, i) => dry[ear][i] + 0.12 * (near[i - late] ?? 0))
})
// The loudest moment 2 dB under full scale; the mix below sets how that sits against the music.
let most = 0
for (const side of sides) for (const v of side) most = Math.max(most, Math.abs(v))
const lift = 10 ** (-2 / 20) / most
const wav = Buffer.alloc(44 + length * 4)
wav.write("RIFF", 0)
wav.writeUInt32LE(36 + length * 4, 4)
wav.write("WAVEfmt ", 8)
wav.writeUInt32LE(16, 16)
wav.writeUInt16LE(1, 20)
wav.writeUInt16LE(2, 22)
wav.writeUInt32LE(RATE, 24)
wav.writeUInt32LE(RATE * 4, 28)
wav.writeUInt16LE(4, 32)
wav.writeUInt16LE(16, 34)
wav.write("data", 36)
wav.writeUInt32LE(length * 4, 40)
for (let i = 0; i < length; i++) for (const ear of [0, 1]) wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sides[ear][i] * lift)) * 32767), 44 + i * 4 + ear * 2)
writeFileSync(join(OUT, "sound.wav"), wav)
console.log(`video/out/sound.wav  ${duration}s, ${cues.length} cues`)

if (process.argv.includes("--mux")) {
  const film = join(OUT, "surfaces-launch.mp4")
  const sounded = join(OUT, "surfaces-launch-sound.mp4")
  const loudnessOf = (args) => Number(spawnSync("ffmpeg", ["-hide_banner", "-nostats", ...args, "-f", "null", "-"], { encoding: "utf8" }).stderr.match(/I:\s+(-?[\d.]+) LUFS/g)?.at(-1)?.match(/-?[\d.]+/)?.[0])
  // The music is slid by less than a beat so that one of its beats falls where the mark lands: the one moment sound and picture must agree.
  const landing = cues.find((cue) => cue.kind === "end")
  const lands = landing ? landing.at + (landing.lands ?? 0.45) : 0
  const from = beat ? (((beat.first - lands) % beat.beat) + beat.beat) % beat.beat : 0
  // The bed's lowest octave is eased by 3 dB, which leaves the notes room: the measured film has no more below 120 Hz than in its middle.
  // The music leads and the effects sit in it: an accent peaks about 11 dB under full scale, some 5 dB over the mix's loudness, as measured. It enters at once and fades under the end card.
  const mix = musicFile
    ? `[1:a]volume=0.36[fx];[2:a]atrim=${from.toFixed(3)}:${(from + duration).toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.3,afade=t=out:st=${duration - 1.6}:d=1.6,bass=g=-3:f=110,volume=0.9[bed];[fx][bed]amix=inputs=2:normalize=0`
    : `[1:a]anull`
  const inputs = ["-i", join(OUT, "sound.wav"), ...(musicFile ? ["-i", musicFile] : [])]
  // One static lift toward -15 LUFS, never more than 9 dB, under a ceiling AAC cannot overshoot.
  const measured = loudnessOf(["-i", film, ...inputs, "-filter_complex", `${mix},ebur128[out]`, "-map", "[out]"])
  const lifted = Math.min(9, -15 - measured)
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", film, ...inputs, "-filter_complex", `${mix},volume=${lifted.toFixed(1)}dB,alimiter=limit=0.7:level=false[out]`, "-map", "0:v", "-map", "[out]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", sounded])
  console.log(`${sounded}\n  ${musicFile ? `music from ${from.toFixed(2)}s, a beat on the mark at ${lands.toFixed(2)}s` : "effects alone"}: measured ${measured} LUFS, lifted by ${lifted.toFixed(1)} dB`)
}
process.exit(0)
