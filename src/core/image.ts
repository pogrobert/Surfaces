// A caller's own photo, checked and carried as text. Only the bytes count, never
// a URL: a cover drawn from a URL changes whenever the file behind it does, and
// an SVG shown as an image can't load outside files anyway.

export type ImageInput = {
  data: Uint8Array
  type: "image/png" | "image/jpeg" | "image/webp"
  // Which part of the photo to keep when its shape differs from the cover's.
  focus?: "center" | "top" | "bottom" | "left" | "right"
}

// Large enough for any cover; past this the SVG gets heavy to inline.
export const MOST_IMAGE_BYTES = 4 * 1024 * 1024

const FOCUS = {
  center: "xMidYMid",
  top: "xMidYMin",
  bottom: "xMidYMax",
  left: "xMinYMid",
  right: "xMaxYMid",
} as const

function matches(data: Uint8Array, type: ImageInput["type"]) {
  const at = (i: number) => data[i]
  if (type === "image/png") {
    return at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47
  }
  if (type === "image/jpeg") return at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff
  // RIFF....WEBP
  return (
    at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 &&
    at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50
  )
}

const LETTERS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

// Base64 written out, so it is the same on every runtime and needs neither
// Buffer nor btoa.
function base64(data: Uint8Array) {
  let text = ""
  for (let i = 0; i < data.length; i += 3) {
    const a = data[i]!
    const b = data[i + 1]
    const c = data[i + 2]
    text += LETTERS[a >> 2]
    text += LETTERS[((a & 3) << 4) | ((b ?? 0) >> 4)]
    text += b === undefined ? "=" : LETTERS[((b & 15) << 2) | ((c ?? 0) >> 6)]
    text += c === undefined ? "=" : LETTERS[c & 63]
  }
  return text
}

// The most an SVG logo may weigh; a logo past it carries more than a mark.
export const MOST_LOGO_BYTES = 200 * 1024

// A logo as a data URL: an SVG file's own text, or a PNG, JPEG or WebP's
// bytes. Either way it is shown as an image, so nothing in it runs.
export function readLogo(logo: string | ImageInput) {
  if (typeof logo !== "string") return readImage(logo).href
  if (!/^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*(?:<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(logo)) {
    throw new Error(`Expected the logo as an SVG file's text, starting <svg, or { data, type } for a PNG, JPEG or WebP`)
  }
  const data = new TextEncoder().encode(logo)
  if (data.length > MOST_LOGO_BYTES) throw new Error(`Expected a logo under ${MOST_LOGO_BYTES / 1024} KB; simplify the SVG first`)
  return `data:image/svg+xml;base64,${base64(data)}`
}

export function readImage(image: ImageInput) {
  if (!(image.data instanceof Uint8Array)) {
    throw new Error("Expected the image as a Uint8Array of its file's bytes")
  }
  if (!["image/png", "image/jpeg", "image/webp"].includes(image.type)) {
    throw new Error(`Expected a PNG, JPEG or WebP image, got "${image.type}"`)
  }
  if (!matches(image.data, image.type)) {
    throw new Error(`The image's bytes are not a ${image.type.slice(6).toUpperCase()} file`)
  }
  if (image.data.length > MOST_IMAGE_BYTES) {
    throw new Error(
      `Expected an image under ${MOST_IMAGE_BYTES / 1024 / 1024} MB; scale it down first`
    )
  }
  const focus = image.focus ?? "center"
  if (!(focus in FOCUS)) throw new Error(`Unknown image focus "${focus}"`)
  return {
    href: `data:${image.type};base64,${base64(image.data)}`,
    fit: `${FOCUS[focus]} slice`,
  }
}
