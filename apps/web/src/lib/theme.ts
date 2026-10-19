/** Theme: system → light → dark, persisted per browser. The <head> script applies it before paint. */
export const THEME_KEY = 'eec-theme'
const order = ['system', 'light', 'dark'] as const
type Choice = (typeof order)[number]

/** Inline in <head> (as a string): no flash of the wrong theme. Storage access may throw. */
export const themeHeadScript = `(()=>{let c='system';try{c=localStorage.getItem('${THEME_KEY}')||'system'}catch(e){}const r=document.documentElement;r.dataset.themeChoice=c;if(c==='light'||c==='dark')r.dataset.theme=c;else r.removeAttribute('data-theme')})()`

function apply(choice: Choice) {
  const root = document.documentElement
  root.dataset.themeChoice = choice
  if (choice === 'system') root.removeAttribute('data-theme')
  else root.dataset.theme = choice
  try {
    localStorage.setItem(THEME_KEY, choice)
  } catch {
    // Private mode / blocked storage: the choice lasts for this page only.
  }
}

function label(button: HTMLElement, choice: Choice) {
  const text = button.dataset[`label${choice[0]?.toUpperCase()}${choice.slice(1)}`]
  if (text) button.setAttribute('aria-label', text)
}

export function initThemeToggles() {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]')) {
    const current = () => (document.documentElement.dataset.themeChoice ?? 'system') as Choice
    label(button, current())
    button.addEventListener('click', () => {
      const next = order[(order.indexOf(current()) + 1) % order.length] ?? 'system'
      apply(next)
      label(button, next)
    })
  }
}
