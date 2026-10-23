/**
 * A list of short entries typed one by one, like tags: Enter (or a comma) turns what is typed into a chip; a chip can be clicked
 * to edit it (Enter keeps, Escape cancels, empty removes) or deleted with its ×; Backspace on an empty field takes the last one
 * back. Duplicates are refused. `min` shows an error under the field while there are fewer entries.
 */
import { Icon } from '@eec/ui/react'
import { useRef, useState } from 'react'

export function TagInput({
  label,
  value,
  onChange,
  placeholder,
  hint,
  min = 0,
  max = 12,
  disabled,
  error,
  id,
}: {
  label: string
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  hint?: string
  min?: number
  max?: number
  disabled?: boolean
  error?: string
  id: string
}) {
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<number | null>(null)
  const [edit, setEdit] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const has = (v: string, except = -1) =>
    value.some((x, i) => i !== except && x.toLowerCase() === v.toLowerCase())
  const add = (raw: string) => {
    const parts = raw
      .split(/[\n,]/)
      .map((x) => x.trim())
      .filter(Boolean)
    const next = [...value]
    for (const p of parts)
      if (next.length < max && !next.some((x) => x.toLowerCase() === p.toLowerCase())) next.push(p)
    if (next.length !== value.length) onChange(next)
    setDraft('')
  }
  const commit = () => {
    if (editing === null) return
    const v = edit.trim()
    if (!v) onChange(value.filter((_, i) => i !== editing))
    else if (!has(v, editing)) onChange(value.map((x, i) => (i === editing ? v : x)))
    setEditing(null)
  }
  const short = value.length < min
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: a click on the empty part of the box only focuses the real input inside */}
      <div
        className="tag-box"
        data-invalid={error || short ? '' : undefined}
        onClick={() => input.current?.focus()}
      >
        {value.map((v, i) =>
          editing === i ? (
            <input
              // biome-ignore lint/a11y/noAutofocus: the chip was just clicked to be edited
              autoFocus
              key={`${v}-${i}`}
              className="tag-edit"
              aria-label={v}
              value={edit}
              size={Math.max(edit.length, 3)}
              onChange={(e) => setEdit(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commit()
                } else if (e.key === 'Escape') setEditing(null)
              }}
            />
          ) : (
            <span key={`${v}-${i}`} className="tag">
              <button
                type="button"
                className="tag-text"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation()
                  setEdit(v)
                  setEditing(i)
                }}
              >
                {v}
              </button>
              {!disabled && (
                <button
                  type="button"
                  className="tag-x"
                  aria-label={`× ${v}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onChange(value.filter((_, j) => j !== i))
                  }}
                >
                  <Icon name="close" size={16} />
                </button>
              )}
            </span>
          ),
        )}
        {!disabled && value.length < max && (
          <input
            ref={input}
            id={id}
            className="tag-new"
            value={draft}
            placeholder={value.length === 0 ? placeholder : ''}
            onChange={(e) => {
              const v = e.target.value
              if (v.includes(',')) add(v)
              else setDraft(v)
            }}
            onPaste={(e) => {
              const t = e.clipboardData.getData('text')
              if (/[\n,]/.test(t)) {
                e.preventDefault()
                add(t)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add(draft)
              } else if (e.key === 'Backspace' && draft === '' && value.length)
                onChange(value.slice(0, -1))
            }}
            onBlur={() => draft.trim() && add(draft)}
          />
        )}
      </div>
      {hint && !(error || short) && <p className="field-hint">{hint}</p>}
      {(error || short) && (
        <p className="field-error" role="alert">
          {error ?? hint}
        </p>
      )}
    </div>
  )
}
