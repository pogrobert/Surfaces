// An .ico holding PNG images, as every browser since 2009 reads one: a
// header, one entry for each size, then the PNGs as they are.
export function encodeIco(images: readonly { size: number; png: Uint8Array }[]): Uint8Array {
  const header = 6 + images.length * 16
  const total = header + images.reduce((sum, image) => sum + image.png.length, 0)
  const out = new Uint8Array(total)
  const view = new DataView(out.buffer)
  view.setUint16(2, 1, true)
  view.setUint16(4, images.length, true)
  let offset = header
  images.forEach(({ size, png }, index) => {
    const at = 6 + index * 16
    // A size of 256 is written as 0.
    out[at] = size >= 256 ? 0 : size
    out[at + 1] = size >= 256 ? 0 : size
    view.setUint16(at + 4, 1, true)
    view.setUint16(at + 6, 32, true)
    view.setUint32(at + 8, png.length, true)
    view.setUint32(at + 12, offset, true)
    out.set(png, offset)
    offset += png.length
  })
  return out
}
