import sanitize from 'sanitize-html'

const ALLOWED_TAGS = [
  'p',
  'br',
  'hr',
  'h1',
  'h2',
  'h3',
  'h4',
  'strong',
  'em',
  'u',
  's',
  'code',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
  'colgroup',
  'col',
]

// Tables introduce structural attributes (colspan/rowspan/scope) and the
// data-* attributes we use to carry aggregate semantics into the rendered
// HTML. Allowing `scope` keeps `<th scope="col">` semantically meaningful.
const ALLOWED_ATTRS: sanitize.IOptions['allowedAttributes'] = {
  h1: ['id'],
  h2: ['id'],
  h3: ['id'],
  h4: ['id'],
  a: ['href', 'rel', 'target', 'title'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  code: ['class'],
  pre: ['class'],
  table: ['class'],
  thead: ['class'],
  tbody: ['class'],
  tfoot: ['class'],
  tr: ['class', 'data-row-kind'],
  th: ['colspan', 'rowspan', 'scope', 'class', 'data-col-agg'],
  td: ['colspan', 'rowspan', 'class', 'data-type', 'data-format', 'data-computed'],
  colgroup: ['class'],
  col: ['span', 'class'],
}

const ALLOWED_SCHEMES = ['http', 'https', 'mailto']

export function sanitizeHtml(dirty: string): string {
  return sanitize(dirty, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRS,
    allowedSchemes: ALLOWED_SCHEMES,
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowedClasses: {
      code: ['language-*'],
      pre: ['language-*'],
    },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          rel: 'nofollow noopener',
          target: '_blank',
        },
      }),
    },
  })
}
