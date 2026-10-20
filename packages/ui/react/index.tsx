/**
 * React primitives for the admin: Base UI (a11y, focus, keyboard) + the shared stylesheet
 * (packages/ui/styles/components.css) — so they look identical to the public Astro primitives.
 * Strings come from the caller (packages/i18n); nothing is hard-coded here.
 */
import { Accordion } from '@base-ui/react/accordion'
import { Checkbox } from '@base-ui/react/checkbox'
import { Combobox } from '@base-ui/react/combobox'
import { Dialog } from '@base-ui/react/dialog'
import { Field } from '@base-ui/react/field'
import { Input } from '@base-ui/react/input'
import { Menu } from '@base-ui/react/menu'
import { Popover } from '@base-ui/react/popover'
import { Select } from '@base-ui/react/select'
import { Switch } from '@base-ui/react/switch'
import { Tabs } from '@base-ui/react/tabs'
import { Toast } from '@base-ui/react/toast'
import { Tooltip } from '@base-ui/react/tooltip'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

const cx = (...parts: (string | false | undefined | null)[]) => parts.filter(Boolean).join(' ')

/* ── Button ───────────────────────────────────────────────────────────── */
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  iconOnly?: boolean
}
export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  iconOnly,
  className,
  type = 'button',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      aria-busy={loading || undefined}
      className={cx(
        'btn',
        `btn-${variant}`,
        size !== 'md' && `btn-${size}`,
        iconOnly && 'btn-icon',
        className,
      )}
      {...rest}
    />
  )
}

/* ── Field: label + control + hint + error ────────────────────────────── */
export function TextField({
  label,
  placeholder,
  hint,
  error,
  textarea,
  className,
  ...rest
}: {
  label: string
  /** Required: an example of the expected answer (e.g. « marie@exemple.cm »), never a repeat of the label. */
  placeholder: string
  hint?: string
  error?: string
  textarea?: boolean
  className?: string
} & Record<string, unknown>) {
  return (
    <Field.Root invalid={!!error} className="field">
      <Field.Label className="field-label">{label}</Field.Label>
      {textarea ? (
        <Field.Control
          render={<textarea className={cx('textarea', className)} />}
          placeholder={placeholder}
          {...rest}
        />
      ) : (
        <Field.Control
          render={<Input className={cx('input', className)} />}
          placeholder={placeholder}
          {...rest}
        />
      )}
      {hint && <Field.Description className="field-hint">{hint}</Field.Description>}
      {error && (
        <Field.Error match className="field-error" role="alert">
          {error}
        </Field.Error>
      )}
    </Field.Root>
  )
}

/* ── Checkbox, switch ─────────────────────────────────────────────────── */
export function CheckboxField({ label, ...rest }: { label: string } & Record<string, unknown>) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: Base UI's Checkbox.Root renders the labelled control
    <label className="check-row">
      <Checkbox.Root className="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  )
}
export function SwitchField({ label, ...rest }: { label: string } & Record<string, unknown>) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: Base UI's Switch.Root renders the labelled control
    <label className="check-row">
      <Switch.Root className="switch" {...rest} />
      <span>{label}</span>
    </label>
  )
}

/* ── Select (Base UI — fully styled, never the browser default) ───────── */
export type Option = { value: string; label: string }
export function SelectField({
  label,
  options,
  placeholder,
  value,
  onValueChange,
}: {
  label: string
  options: Option[]
  placeholder?: string
  value?: string
  onValueChange?: (value: string | null) => void
}) {
  return (
    <div className="field">
      <span className="field-label" id={`sel-${label}`}>
        {label}
      </span>
      <Select.Root items={options} value={value} onValueChange={onValueChange}>
        <Select.Trigger className="select eec-select-trigger" aria-labelledby={`sel-${label}`}>
          <Select.Value placeholder={placeholder} />
          <span className="eec-chevron" aria-hidden="true" />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner sideOffset={6} className="eec-positioner">
            <Select.Popup className="eec-popover eec-popup">
              {options.map((o) => (
                <Select.Item key={o.value} value={o.value} className="menu-item">
                  <Select.ItemIndicator className="eec-check-icon" />
                  <Select.ItemText>{o.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </div>
  )
}

/* ── Combobox (searchable list) ───────────────────────────────────────── */
export function ComboboxField({
  label,
  options,
  placeholder,
  emptyText,
}: {
  label: string
  options: Option[]
  placeholder?: string
  emptyText: string
}) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <Combobox.Root items={options}>
        <Combobox.Input className="input" placeholder={placeholder} aria-label={label} />
        <Combobox.Portal>
          <Combobox.Positioner sideOffset={6} className="eec-positioner">
            <Combobox.Popup className="eec-popover eec-popup">
              <Combobox.Empty className="menu-item">{emptyText}</Combobox.Empty>
              <Combobox.List>
                {(o: Option) => (
                  <Combobox.Item key={o.value} value={o} className="menu-item">
                    {o.label}
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </div>
  )
}

/* ── Dialog / sheet ───────────────────────────────────────────────────── */
export function DialogBox({
  trigger,
  title,
  children,
  closeLabel,
  side,
}: {
  trigger: ReactNode
  title: string
  children?: ReactNode
  closeLabel: string
  side?: 'end' | 'start' | 'bottom'
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger render={trigger as never} />
      <Dialog.Portal>
        <Dialog.Backdrop className="eec-backdrop eec-overlay" />
        <Dialog.Popup
          className={cx(side ? 'sheet eec-sheet' : 'dialog eec-dialog')}
          data-side={side}
        >
          <div className="dialog-body">
            <Dialog.Title className="dialog-title">{title}</Dialog.Title>
            {children}
            <div className="dialog-actions">
              <Dialog.Close className="btn btn-secondary">{closeLabel}</Dialog.Close>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/* ── Menu, popover, tooltip ───────────────────────────────────────────── */
export function MenuButton({
  label,
  items,
  className = 'btn btn-secondary',
}: {
  label: ReactNode
  items: { id: string; label: string; onSelect?: () => void }[]
  className?: string
}) {
  return (
    <Menu.Root>
      <Menu.Trigger className={className}>
        {label}
        <span className="eec-chevron" aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="start" className="eec-positioner">
          <Menu.Popup className="eec-popover eec-popup">
            {items.map((item) => (
              <Menu.Item key={item.id} className="menu-item" onClick={item.onSelect}>
                {item.label}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
export function PopoverBox({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  return (
    <Popover.Root>
      <Popover.Trigger className="btn btn-secondary">{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} className="eec-positioner">
          <Popover.Popup className="eec-popover eec-popup">
            <div className="eec-popup-body">{children}</div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
export function TooltipTip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger render={children as never} />
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={8} className="eec-positioner">
            <Tooltip.Popup className="eec-tooltip">{text}</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}

/* ── Tabs, accordion ──────────────────────────────────────────────────── */
export function TabsBox({ tabs }: { tabs: { id: string; label: string; content: ReactNode }[] }) {
  return (
    <Tabs.Root defaultValue={tabs[0]?.id}>
      <Tabs.List className="tabs-list">
        <Tabs.Indicator className="tabs-indicator" />
        {tabs.map((t) => (
          <Tabs.Tab key={t.id} value={t.id} className="tab">
            {t.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {tabs.map((t) => (
        <Tabs.Panel key={t.id} value={t.id} className="tab-panel">
          {t.content}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  )
}
export function AccordionBox({ items }: { items: { id: string; title: string; body: string }[] }) {
  return (
    <Accordion.Root className="accordion">
      {items.map((i) => (
        <Accordion.Item key={i.id} value={i.id} className="accordion-item">
          <Accordion.Header>
            <Accordion.Trigger className="accordion-trigger">
              <span>{i.title}</span>
              <span className="eec-chevron" aria-hidden="true" />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel className="accordion-panel">{i.body}</Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  )
}

/* ── Toast ────────────────────────────────────────────────────────────── */
export const toastManager = Toast.createToastManager()
export function Toaster({ closeLabel }: { closeLabel: string }) {
  return (
    <Toast.Provider toastManager={toastManager}>
      <Toast.Portal>
        <Toast.Viewport className="toast-region">
          <ToastList closeLabel={closeLabel} />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  )
}
function ToastList({ closeLabel }: { closeLabel: string }) {
  const { toasts } = Toast.useToastManager()
  return toasts.map((toast) => (
    <Toast.Root
      key={toast.id}
      toast={toast}
      className="toast"
      data-tone={(toast.data as { tone?: string } | undefined)?.tone}
      style={{ '--toast-ms': `${toast.timeout ?? 5000}ms` } as React.CSSProperties}
    >
      <Toast.Content className="toast-text">
        <Toast.Title />
      </Toast.Content>
      {/* Undo / follow-up action, when the toast has one (actionProps). */}
      <Toast.Action className="btn btn-secondary btn-sm toast-action" />
      <span className="toast-close">
        <svg className="toast-ring" viewBox="0 0 36 36" aria-hidden="true">
          <circle cx="18" cy="18" r="16" pathLength="100" />
        </svg>
        <Toast.Close className="btn btn-ghost" aria-label={closeLabel}>
          <svg
            className="toast-close-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </Toast.Close>
      </span>
    </Toast.Root>
  ))
}

/* ── Surfaces ─────────────────────────────────────────────────────────── */
export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cx('card', className)} {...p} />
)
export const Badge = ({
  tone = 'primary',
  className,
  ...p
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: 'primary' | 'gold' | 'success' | 'warning' | 'danger' | 'info'
}) => <span className={cx('badge', tone !== 'primary' && `badge-${tone}`, className)} {...p} />
export const Skeleton = ({ className, ...p }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span aria-hidden="true" className={cx('skeleton', className)} {...p} />
)
export const Avatar = ({ initials, label }: { initials: string; label?: string }) =>
  label ? (
    <span className="avatar" role="img" aria-label={label}>
      {initials}
    </span>
  ) : (
    <span className="avatar" aria-hidden="true">
      {initials}
    </span>
  )
export function EmptyState({
  title,
  text,
  art,
  children,
}: {
  title: string
  text?: string
  art?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="empty">
      {art && <div className="empty-art">{art}</div>}
      <p className="empty-title">{title}</p>
      {text && <p className="empty-text">{text}</p>}
      <div className="mt-2 flex flex-wrap justify-center gap-3">{children}</div>
    </div>
  )
}
