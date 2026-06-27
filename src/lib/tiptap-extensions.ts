import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import StarterKit from '@tiptap/starter-kit'

// Shared TipTap extensions list. Both the read-time HTML renderer
// (src/lib/tiptap.server.ts) and the CLI Markdown→TipTap converter
// (src/cli/markdown.ts) import from here so they cannot drift apart.
export const extensions = [
  StarterKit.configure({
    codeBlock: { HTMLAttributes: { class: 'language-plain' } },
  }),
  Image.configure({ inline: false, allowBase64: false }),
  Link.configure({
    openOnClick: false,
    autolink: true,
    HTMLAttributes: { rel: 'nofollow noopener', target: '_blank' },
  }),
]
