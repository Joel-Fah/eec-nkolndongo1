/**
 * The rich-text editor (TipTap, decision 0028). Loaded lazily by the screens that edit text, so its weight
 * (~100 KB gzipped) never reaches the public site or the other admin pages. It produces the small JSON document
 * defined in `@eec/core` (`cleanDoc` runs again on the server); the toolbar offers only what that schema allows.
 */
import { useLocale } from '@eec/admin-kit'
import { type Doc, safeHref } from '@eec/core'
import type { IconName } from '@eec/ui/icons'
import { iconSvg } from '@eec/ui/icons'
import { Node } from '@tiptap/core'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
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

type Props = {
  value: unknown
  onChange: (doc: Doc) => void
  placeholder: string
  /** Label for assistive technology, e.g. « Texte de l’actualité ». */
  label: string
}

const Glyph = ({ name }: { name: IconName }) => (
  <span
    aria-hidden="true"
    // biome-ignore lint/security/noDangerouslySetInnerHtml: our own icon markup, no user data
    dangerouslySetInnerHTML={{ __html: iconSvg(name, { size: 20 }) }}
  />
)

export default function RichTextEditor({ value, onChange, placeholder, label }: Props) {
  const { t } = useLocale()
  const [picking, setPicking] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [href, setHref] = useState('')
  const [hrefError, setHrefError] = useState(false)
  const last = useRef<string>('')

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        strike: false,
        underline: false,
        horizontalRule: false,
        link: {
          openOnClick: false,
          autolink: false,
          protocols: [],
          HTMLAttributes: { rel: 'noopener noreferrer' },
        },
      }),
      LibraryImage,
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
      h2: s.editor?.isActive('heading', { level: 2 }) ?? false,
      bullet: s.editor?.isActive('bulletList') ?? false,
      ordered: s.editor?.isActive('orderedList') ?? false,
      quote: s.editor?.isActive('blockquote') ?? false,
      link: s.editor?.isActive('link') ?? false,
      canUndo: s.editor?.can().undo() ?? false,
      canRedo: s.editor?.can().redo() ?? false,
    }),
  })
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
  ) => (
    <button
      key={name}
      type="button"
      className="rte-btn"
      aria-pressed={active}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={run(action)}
    >
      <Glyph name={name} />
    </button>
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
    <div className="rte">
      <div className="rte-bar" role="toolbar" aria-label={t('content.editor.toolbar')}>
        {btn('bold', t('content.editor.bold'), state?.bold ?? false, () =>
          editor.chain().toggleBold().run(),
        )}
        {btn('italic', t('content.editor.italic'), state?.italic ?? false, () =>
          editor.chain().toggleItalic().run(),
        )}
        {btn('heading', t('content.editor.heading'), state?.h2 ?? false, () =>
          editor.chain().toggleHeading({ level: 2 }).run(),
        )}
        {btn('listBullet', t('content.editor.bullets'), state?.bullet ?? false, () =>
          editor.chain().toggleBulletList().run(),
        )}
        {btn('listNumber', t('content.editor.numbers'), state?.ordered ?? false, () =>
          editor.chain().toggleOrderedList().run(),
        )}
        {btn('quote', t('content.editor.quote'), state?.quote ?? false, () =>
          editor.chain().toggleBlockquote().run(),
        )}
        <button
          type="button"
          className="rte-btn"
          aria-pressed={state?.link ?? false}
          aria-label={t('content.editor.link')}
          title={t('content.editor.link')}
          onClick={() => {
            setHref((editor.getAttributes('link').href as string | undefined) ?? '')
            setHrefError(false)
            setLinkOpen((o) => !o)
          }}
        >
          <Glyph name="link" />
        </button>
        {btn('photo', t('content.editor.photo'), false, () => setPicking(true))}
        <span className="rte-gap" aria-hidden="true" />
        {btn(
          'undo',
          t('content.editor.undo'),
          false,
          () => editor.chain().undo().run(),
          !state?.canUndo,
        )}
        {btn(
          'redo',
          t('content.editor.redo'),
          false,
          () => editor.chain().redo().run(),
          !state?.canRedo,
        )}
      </div>
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
      <EditorContent editor={editor} />
      <MediaPicker open={picking} onClose={() => setPicking(false)} onPick={insertPhoto} />
    </div>
  )
}
