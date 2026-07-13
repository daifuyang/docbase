import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Table from '@tiptap/extension-table'
import StarterKit from '@tiptap/starter-kit'
import {
  TableAggregateCommands,
  TableCellAggregate,
  TableHeaderAggregate,
  TableRowAggregate,
} from '~/components/editor/table-aggregate-attrs'

// Shared TipTap extensions list for server-side HTML rendering and editor use.
// Keep this list identical in shape between the editor and the render path so
// the persisted JSON round-trips through `generateHTML` without surprises.
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
  // Subtotal/aggregate tables. The three node-level wrappers preserve the
  // original extensions' defaults (colspan/rowspan/colwidth) while adding
  // the aggregate attributes; the commands extension drives the toolbar.
  Table.configure({
    resizable: false,
    HTMLAttributes: { class: 'doc-table' },
  }),
  TableRowAggregate,
  TableHeaderAggregate,
  TableCellAggregate,
  TableAggregateCommands,
]
