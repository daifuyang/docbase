import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import StarterKit from '@tiptap/starter-kit'

// Shared TipTap extensions list for server-side HTML rendering and editor use.
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
