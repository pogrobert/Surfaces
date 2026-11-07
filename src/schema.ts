import { AREA_ART, AREA_SIZES, DETAILS, GRAINS, MOODS, MOTIONS, PLACES, THEMES } from "./core/intent.ts"
import { catalog } from "./catalog.ts"

// The input as a JSON Schema, built from the same lists the library checks
// against, so it can never say something the library doesn't. For agents and
// tools that read schemas; `validate` says the same things in words.
export const inputSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "SurfaceInput",
  description: "One cover. Same input, same bytes, forever.",
  type: "object",
  additionalProperties: false,
  required: ["style", "seed"],
  properties: {
    style: {
      enum: catalog.map((entry) => entry.style),
      description: "The look. See catalog for what each one looks like.",
    },
    seed: {
      type: ["string", "number"],
      description: "A stable name for one drawing. Use the page's slug.",
    },
    color: {
      type: "string",
      pattern: "^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$",
      description: "The brand colour, as hex.",
    },
    width: { type: "number", exclusiveMinimum: 0, description: "Output width in pixels; give height too. Default 1600." },
    height: { type: "number", exclusiveMinimum: 0, description: "Output height in pixels; give width too. Default 900." },
    areas: {
      type: "array",
      description: "Where content goes. With none, the art fills the canvas.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          place: { enum: [...PLACES] },
          size: { enum: [...AREA_SIZES], description: "Default md." },
          art: {
            enum: [...AREA_ART],
            description:
              "around (default): content sits on the art and reads; the art keeps clear, or behind a large centred area fades under it. behind: content covers the art.",
          },
          box: {
            type: "object",
            description: "An exact box in shares of the canvas, in place of place and size.",
            additionalProperties: false,
            required: ["x", "y", "w", "h"],
            properties: {
              x: { type: "number", minimum: 0.02, maximum: 0.98 },
              y: { type: "number", minimum: 0.02, maximum: 0.98 },
              w: { type: "number", minimum: 0.05 },
              h: { type: "number", minimum: 0.05 },
            },
          },
        },
      },
    },
    theme: { enum: [...THEMES, "auto"], description: "auto draws both and follows the reader." },
    mood: { enum: [...MOODS] },
    grain: { enum: [...GRAINS] },
    detail: { enum: [...DETAILS], description: "micro: a technical drawing's small print (crop marks, ruler, figure label) over the art." },
    motion: { enum: [...MOTIONS], description: "Default none. loop belongs on one hero, not on cards." },
    shape: { type: "string", description: "One of the style's shapes; see catalog." },
    title: { type: "string", maxLength: 160, description: "Words set into the art in the largest area it goes around, for images nothing else can set them on: link previews, files, email." },
    font: { type: "string", enum: ["sans", "serif"], description: "The face the title is set in. Default sans." },
    logo: {
      type: "object",
      required: ["image", "place"],
      properties: {
        image: { description: "An SVG file's text, or { data, type } for a PNG, JPEG or WebP." },
        dark: { description: "The one for a dark cover, for a logo a dark ground would lose." },
        place: { enum: [...PLACES] },
      },
      description: "The brand's own logo, drawn as it is in a small area the art keeps clear.",
    },
  },
} as const
