/**
 * The rich-text editor (TipTap, decision 0028). Loaded lazily by the screens that edit text, so its weight
 * (~100 KB gzipped) never reaches the public site or the other admin pages. It produces the small JSON document
 * defined in `@eec/core` (`cleanDoc` runs again on the server); the toolbar offers only what that schema allows.
 */
import { Menu } from '@base-ui/react/menu'
import { useLocale } from '@eec/admin-kit'
import { type Doc, safeHref } from '@eec/core'
import type { IconName } from '@eec/ui/icons'
import { iconSvg } from '@eec/ui/icons'
import { Kbd, ShortcutTip } from '@eec/ui/react'
import { Extension, Node } from '@tiptap/core'
import Highlight from '@tiptap/extension-highlight'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import Placeholder from '@tiptap/extension-placeholder'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import TextAlign from '@tiptap/extension-text-align'
import { type Editor, EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useRef, useState } from 'react'
import { MediaPicker, type PickedMedia } from './MediaPicker.tsx'

/** A photo from the library: stored with its address and description, never a data URL. */
const LibraryImage = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      mediaId: { default: null },
      alt: { default: null },
      caption: { default: null },
      credit: { default: null },
      width: { default: null },
      height: { default: null },
    }
  },
  parseHTML: () => [{ tag: 'img[src]' }],
  renderHTML: ({ HTMLAttributes }) => [
    'img',
    { src: HTMLAttributes.src, alt: HTMLAttributes.alt ?? '' },
  ],
})

const MAX_INDENT = 4

/** Indentation for paragraphs and headings (list items nest with Tab instead). Stored as `indent` 0–4. */
const Indent = Extension.create({
  name: 'indent',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => Number(el.getAttribute('data-indent')) || 0,
            renderHTML: (a) =>
              a.indent
                ? {
                    'data-indent': a.indent,
                    style: `margin-inline-start:${Number(a.indent) * 1.5}rem`,
                  }
                : {},
          },
        },
      },
    ]
  },
})

type Props = {
  value: unknown
  onChange: (doc: Doc) => void
  placeholder: string
  /** Label for assistive technology, e.g. « Texte de l’actualité ». */
  label: string
}

const Glyph = ({ name }: { name: IconName }) => (
  <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: iconSvg(name, { size: 20 }) }} />
)

/** Lists nest with the list commands; other blocks move by one step (0–4). */
function shiftIndent(editor: Editor, delta: 1 | -1) {
  for (const item of ['taskItem', 'listItem'] as const) {
    if (editor.isActive(item)) {
      if (delta > 0) editor.chain().sinkListItem(item).run()
      else editor.chain().liftListItem(item).run()
      return
    }
  }
  editor
    .chain()
    .command(({ tr, state, dispatch }) => {
      const { from, to } = state.selection
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (node.type.name !== 'paragraph' && node.type.name !== 'heading') return
        const next = Math.max(0, Math.min(MAX_INDENT, Number(node.attrs.indent ?? 0) + delta))
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next })
      })
      if (dispatch) dispatch(tr)
      return true
    })
    .run()
}

export default function RichTextEditor({ value, onChange, placeholder, label }: Props) {
  const { t } = useLocale()
  const [picking, setPicking] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [href, setHref] = useState('')
  const [hrefError, setHrefError] = useState(false)
  const last = useRef<string>('')
  const wrap = useRef<HTMLDivElement>(null)
  const [full, setFull] = useState(false)
  const [holdHeight, setHoldHeight] = useState(0)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        horizontalRule: false,
        link: {
          openOnClick: false,
          autolink: false,
          protocols: [],
          HTMLAttributes: { rel: 'noopener noreferrer' },
        },
      }),
      LibraryImage,
      Highlight,
      Subscript,
      Superscript,
      Indent,
      TextAlign.configure({ types: ['paragraph', 'heading'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table,
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder }),
    ],
    content: (value as object) ?? { type: 'doc', content: [] },
    editorProps: {
      attributes: {
        class: 'rte-content prose-eec',
        'aria-label': label,
        role: 'textbox',
        'aria-multiline': 'true',
      },
    },
    onUpdate: ({ editor: e }) => {
      const json = e.getJSON() as Doc
      last.current = JSON.stringify(json)
      onChange(json)
    },
  })

  // A restored version (or another language tab) replaces the content from outside.
  useEffect(() => {
    if (!editor) return
    const next = JSON.stringify(value ?? { type: 'doc', content: [] })
    if (next !== last.current && next !== JSON.stringify(editor.getJSON())) {
      editor.commands.setContent((value as object) ?? { type: 'doc', content: [] }, {
        emitUpdate: false,
      })
      last.current = next
    }
  }, [value, editor])

  const state = useEditorState({
    editor,
    selector: (s) => ({
      bold: s.editor?.isActive('bold') ?? false,
      italic: s.editor?.isActive('italic') ?? false,
      underline: s.editor?.isActive('underline') ?? false,
      strike: s.editor?.isActive('strike') ?? false,
      highlight: s.editor?.isActive('highlight') ?? false,
      sub: s.editor?.isActive('subscript') ?? false,
      sup: s.editor?.isActive('superscript') ?? false,
      task: s.editor?.isActive('taskList') ?? false,
      inTable: s.editor?.isActive('table') ?? false,
      left: s.editor?.isActive({ textAlign: 'left' }) ?? false,
      center: s.editor?.isActive({ textAlign: 'center' }) ?? false,
      right: s.editor?.isActive({ textAlign: 'right' }) ?? false,
      justify: s.editor?.isActive({ textAlign: 'justify' }) ?? false,
      h2: s.editor?.isActive('heading', { level: 2 }) ?? false,
      h3: s.editor?.isActive('heading', { level: 3 }) ?? false,
      bullet: s.editor?.isActive('bulletList') ?? false,
      ordered: s.editor?.isActive('orderedList') ?? false,
      quote: s.editor?.isActive('blockquote') ?? false,
      link: s.editor?.isActive('link') ?? false,
      canUndo: s.editor?.can().undo() ?? false,
      canRedo: s.editor?.can().redo() ?? false,
      text: s.editor?.getText({ blockSeparator: ' ' }) ?? '',
    }),
  })
  /**
   * Full screen without losing anything: the same editor, restyled in place (nothing is remounted, so the cursor, the
   * undo history and the text stay). Entering reveals from the editor's own rectangle to the whole screen; leaving
   * fades back. Reduced motion: no animation. Esc leaves.
   */
  const toggleFull = () => {
    const el = wrap.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const first = el.getBoundingClientRect()
    if (!full) setHoldHeight(first.height)
    setFull((f) => !f)
    requestAnimationFrame(() => {
      if (reduce) return
      if (!full) {
        const r = Math.round(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0)
        el.animate(
          [
            {
              clipPath: `inset(${first.top}px ${window.innerWidth - first.right}px ${window.innerHeight - first.bottom}px ${first.left}px round ${r}px)`,
            },
            { clipPath: 'inset(0px 0px 0px 0px round 0px)' },
          ],
          { duration: 360, easing: 'cubic-bezier(.22,1,.36,1)' },
        )
      } else {
        el.animate(
          [
            { opacity: 0, transform: 'scale(1.015)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 240, easing: 'cubic-bezier(.22,1,.36,1)' },
        )
      }
    })
    queueMicrotask(() => editor?.commands.focus())
  }
  useEffect(() => {
    if (!full) return
    const root = document.documentElement
    root.setAttribute('data-rte-full', '')
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        !document.querySelector('[data-popup-open], [role="menu"], [role="dialog"]')
      )
        toggleFull()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      root.removeAttribute('data-rte-full')
      window.removeEventListener('keydown', onKey)
    }
    // biome-ignore lint/correctness/useExhaustiveDependencies: toggleFull is stable enough for one listener per mode
  }, [full])

  const plain = (state?.text ?? '').replace(/\s+/g, ' ').trim()
  const words = plain ? plain.split(' ').length : 0
  const chars = plain.length
  const noSpace = plain.replace(/\s/g, '').length
  if (!editor) return <div className="rte rte-loading" aria-hidden="true" />

  const run = (fn: () => void) => () => {
    fn()
    editor.commands.focus()
  }
  const btn = (
    name: IconName,
    label: string,
    active: boolean,
    action: () => void,
    disabled = false,
    shortcut?: string,
  ) => (
    <ShortcutTip key={name} label={label} shortcut={shortcut}>
      <button
        type="button"
        className="rte-btn"
        data-icon={name}
        aria-pressed={active}
        aria-label={label}
        disabled={disabled}
        onClick={run(action)}
      >
        <Glyph name={name} />
      </button>
    </ShortcutTip>
  )
  /** A group of related actions in one dropdown (headings, alignment): the button shows the current one. */
  const menu = (
    label: string,
    current: IconName,
    items: {
      icon: IconName
      label: string
      active: boolean
      shortcut?: string
      action: () => void
    }[],
  ) => (
    <Menu.Root>
      <ShortcutTip label={label}>
        <Menu.Trigger className="rte-btn rte-menu" aria-label={label} data-icon={current}>
          <Glyph name={current} />
          <span className="eec-chevron" aria-hidden="true" />
        </Menu.Trigger>
      </ShortcutTip>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="start" className="eec-positioner">
          <Menu.Popup className="eec-popover eec-popup">
            {items.map((it) => (
              <Menu.Item
                key={it.label}
                className="menu-item rte-menu-item"
                data-active={it.active ? '' : undefined}
                onClick={run(it.action)}
              >
                <Glyph name={it.icon} />
                <span className="grow">{it.label}</span>
                {it.shortcut && <Kbd shortcut={it.shortcut} />}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
  const applyLink = () => {
    const safe = safeHref(href.trim())
    if (!safe) {
      setHrefError(true)
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: safe }).run()
    setLinkOpen(false)
    setHref('')
    setHrefError(false)
  }
  const insertPhoto = (m: PickedMedia) => {
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'image',
        attrs: {
          src: m.src,
          mediaId: m.id,
          alt: m.alt,
          credit: m.credit,
          width: m.width,
          height: m.height,
        },
      })
      .run()
    setPicking(false)
  }

  return (
    <>
      {full && <div className="rte-hold" style={{ height: holdHeight }} aria-hidden="true" />}
      <div className="rte" data-full={full ? '' : undefined} ref={wrap}>
        <div className="rte-bar" role="toolbar" aria-label={t('content.editor.toolbar')}>
          <span className="rte-group">
            {btn(
              'undo',
              t('content.editor.undo'),
              false,
              () => editor.chain().undo().run(),
              !state?.canUndo,
              'Mod+Z',
            )}
            {btn(
              'redo',
              t('content.editor.redo'),
              false,
              () => editor.chain().redo().run(),
              !state?.canRedo,
              'Mod+Shift+Z',
            )}
          </span>
          <span className="rte-group">
            {menu(t('content.editor.headings'), state?.h3 ? 'heading3' : 'heading', [
              {
                icon: 'paragraph',
                label: t('content.editor.paragraph'),
                active: !state?.h2 && !state?.h3,
                shortcut: 'Mod+Alt+0',
                action: () => editor.chain().setParagraph().run(),
              },
              {
                icon: 'heading',
                label: t('content.editor.heading'),
                active: state?.h2 ?? false,
                shortcut: 'Mod+Alt+2',
                action: () => editor.chain().toggleHeading({ level: 2 }).run(),
              },
              {
                icon: 'heading3',
                label: t('content.editor.heading3'),
                active: state?.h3 ?? false,
                shortcut: 'Mod+Alt+3',
                action: () => editor.chain().toggleHeading({ level: 3 }).run(),
              },
            ])}
            {btn(
              'bold',
              t('content.editor.bold'),
              state?.bold ?? false,
              () => editor.chain().toggleBold().run(),
              false,
              'Mod+B',
            )}
            {btn(
              'italic',
              t('content.editor.italic'),
              state?.italic ?? false,
              () => editor.chain().toggleItalic().run(),
              false,
              'Mod+I',
            )}
            {btn(
              'underline',
              t('content.editor.underline'),
              state?.underline ?? false,
              () => editor.chain().toggleUnderline().run(),
              false,
              'Mod+U',
            )}
            {btn(
              'strike',
              t('content.editor.strike'),
              state?.strike ?? false,
              () => editor.chain().toggleStrike().run(),
              false,
              'Mod+Shift+S',
            )}
            {btn(
              'highlight',
              t('content.editor.highlight'),
              state?.highlight ?? false,
              () => editor.chain().toggleHighlight().run(),
              false,
              'Mod+Shift+H',
            )}
            {btn(
              'subscript',
              t('content.editor.subscript'),
              state?.sub ?? false,
              () => editor.chain().toggleSubscript().run(),
              false,
              'Mod+,',
            )}
            {btn(
              'superscript',
              t('content.editor.superscript'),
              state?.sup ?? false,
              () => editor.chain().toggleSuperscript().run(),
              false,
              'Mod+.',
            )}
          </span>
          <span className="rte-group">
            {menu(
              t('content.editor.alignments'),
              state?.center
                ? 'alignCenter'
                : state?.right
                  ? 'alignRight'
                  : state?.justify
                    ? 'alignJustify'
                    : 'alignLeft',
              [
                {
                  icon: 'alignLeft',
                  label: t('content.editor.align_left'),
                  active: state?.left ?? false,
                  shortcut: 'Mod+Shift+L',
                  action: () => editor.chain().setTextAlign('left').run(),
                },
                {
                  icon: 'alignCenter',
                  label: t('content.editor.align_center'),
                  active: state?.center ?? false,
                  shortcut: 'Mod+Shift+E',
                  action: () => editor.chain().setTextAlign('center').run(),
                },
                {
                  icon: 'alignRight',
                  label: t('content.editor.align_right'),
                  active: state?.right ?? false,
                  shortcut: 'Mod+Shift+R',
                  action: () => editor.chain().setTextAlign('right').run(),
                },
                {
                  icon: 'alignJustify',
                  label: t('content.editor.align_justify'),
                  active: state?.justify ?? false,
                  shortcut: 'Mod+Shift+J',
                  action: () => editor.chain().setTextAlign('justify').run(),
                },
              ],
            )}
            {btn(
              'listBullet',
              t('content.editor.bullets'),
              state?.bullet ?? false,
              () => editor.chain().toggleBulletList().run(),
              false,
              'Mod+Shift+8',
            )}
            {btn(
              'listNumber',
              t('content.editor.numbers'),
              state?.ordered ?? false,
              () => editor.chain().toggleOrderedList().run(),
              false,
              'Mod+Shift+7',
            )}
            {btn(
              'tasks',
              t('content.editor.tasks'),
              state?.task ?? false,
              () => editor.chain().toggleTaskList().run(),
              false,
              'Mod+Shift+9',
            )}
            {btn(
              'indentLess',
              t('content.editor.indent_less'),
              false,
              () => shiftIndent(editor, -1),
              false,
              'Shift+Tab',
            )}
            {btn(
              'indentMore',
              t('content.editor.indent_more'),
              false,
              () => shiftIndent(editor, 1),
              false,
              'Tab',
            )}
            {btn(
              'quote',
              t('content.editor.quote'),
              state?.quote ?? false,
              () => editor.chain().toggleBlockquote().run(),
              false,
              'Mod+Shift+B',
            )}
          </span>
          <span className="rte-group">
            <ShortcutTip label={t('content.editor.link')}>
              <button
                type="button"
                className="rte-btn"
                data-icon="link"
                aria-pressed={state?.link ?? false}
                aria-label={t('content.editor.link')}
                onClick={() => {
                  setHref((editor.getAttributes('link').href as string | undefined) ?? '')
                  setHrefError(false)
                  setLinkOpen((o) => !o)
                }}
              >
                <Glyph name="link" />
              </button>
            </ShortcutTip>
            {btn(
              'table',
              t('content.editor.table'),
              state?.inTable ?? false,
              () => editor.chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
              state?.inTable ?? false,
            )}
            {btn('photo', t('content.editor.photo'), false, () => setPicking(true))}
          </span>
          <span className="rte-gap" aria-hidden="true" />
          <span className="rte-group">
            {btn(
              full ? 'minimize' : 'maximize',
              t(full ? 'content.editor.exit_full' : 'content.editor.full'),
              full,
              toggleFull,
              false,
              full ? 'Esc' : undefined,
            )}
          </span>
        </div>
        {state?.inTable && (
          <div
            className="rte-bar rte-bar-table"
            role="toolbar"
            aria-label={t('content.editor.group_table')}
          >
            {btn('rowAdd', t('content.editor.row_add'), false, () =>
              editor.chain().addRowAfter().run(),
            )}
            {btn('colAdd', t('content.editor.col_add'), false, () =>
              editor.chain().addColumnAfter().run(),
            )}
            {btn('rowDel', t('content.editor.row_del'), false, () =>
              editor.chain().deleteRow().run(),
            )}
            {btn('colDel', t('content.editor.col_del'), false, () =>
              editor.chain().deleteColumn().run(),
            )}
            {btn('trash', t('content.editor.table_del'), false, () =>
              editor.chain().deleteTable().run(),
            )}
          </div>
        )}
        {linkOpen && (
          <form
            className="rte-link"
            onSubmit={(e) => {
              e.preventDefault()
              applyLink()
            }}
          >
            <label className="grid flex-1 gap-1 text-sm">
              <span>{t('content.editor.link_label')}</span>
              <input
                className="input"
                value={href}
                placeholder="https://"
                inputMode="url"
                onChange={(e) => setHref(e.target.value)}
                aria-invalid={hrefError}
              />
            </label>
            <button type="submit" className="btn btn-primary btn-sm">
              {t('content.editor.link_apply')}
            </button>
            {state?.link && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  editor.chain().focus().extendMarkRange('link').unsetLink().run()
                  setLinkOpen(false)
                }}
              >
                {t('content.editor.link_remove')}
              </button>
            )}
            {hrefError && (
              <p role="alert" className="w-full text-sm text-danger">
                {t('content.editor.link_invalid')}
              </p>
            )}
          </form>
        )}
        <div className="rte-scroll">
          <EditorContent editor={editor} />
        </div>
        <div className="rte-count" aria-live="off">
          <span>{t('content.editor.count_words', { n: String(words) })}</span>
          <span>{t('content.editor.count_chars', { n: String(chars) })}</span>
          <span>{t('content.editor.count_nospace', { n: String(noSpace) })}</span>
        </div>
        <MediaPicker open={picking} onClose={() => setPicking(false)} onPick={insertPhoto} />
      </div>
    </>
  )
}
