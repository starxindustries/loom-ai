import { marked } from "marked"
import sanitizeHtml from "sanitize-html"

marked.use({
  gfm: true,
  breaks: true,
})

const allowedTags = sanitizeHtml.defaults.allowedTags.concat([
  "img",
  "h1",
  "h2",
  "h3",
  "h4",
  "figure",
  "figcaption",
  "pre",
  "code",
  "blockquote",
  "hr",
])
const allowedAttributes: sanitizeHtml.IOptions["allowedAttributes"] = {
  ...sanitizeHtml.defaults.allowedAttributes,
  img: ["src", "alt", "title", "width", "height", "loading", "decoding"],
  a: ["href", "name", "target", "rel"],
  code: ["class"],
}

export async function markdownToHtml(markdown?: string | null): Promise<string> {
  if (!markdown) return ""
  const raw = await marked.parse(markdown)
  const clean = sanitizeHtml(raw as string, {
    allowedTags,
    allowedAttributes,
    allowedSchemes: ["http", "https", "mailto"],
  })
  return clean
}
