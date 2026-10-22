/**
 * Services and times: each day's card shows at most two times; « Voir les N horaires » opens that day in a modal, and the
 * card morphs into the modal (and back when it closes) through the View Transitions API where the browser has it. Without
 * script every time is simply listed; with reduced motion the modal just opens.
 */
export function initDays() {
  const week = document.querySelector<HTMLElement>('[data-week]')
  const dlg = document.querySelector<HTMLDialogElement>('[data-day-dialog]')
  if (!week || !dlg || week.dataset.ready) return
  week.dataset.ready = '1'
  week.removeAttribute('data-nojs')
  week.setAttribute('data-js', '')
  const title = dlg.querySelector<HTMLElement>('[data-modal-title]')
  const list = dlg.querySelector<HTMLElement>('[data-modal-list]')
  let from: HTMLElement | null = null
  const morph = () =>
    !matchMedia('(prefers-reduced-motion: reduce)').matches && 'startViewTransition' in document

  const open = (card: HTMLElement) => {
    from = card
    if (title) {
      title.replaceChildren(
        ...[...(card.querySelector('[data-day-name]')?.childNodes ?? [])].map((n) =>
          n.cloneNode(true),
        ),
      )
    }
    if (list) {
      list.replaceChildren(
        ...[...card.querySelectorAll('.sc-slot')].map((li) => {
          const c = li.cloneNode(true) as HTMLElement
          c.classList.remove('sc-extra')
          return c
        }),
      )
    }
    const show = () => {
      card.style.viewTransitionName = ''
      dlg.style.viewTransitionName = 'sc-morph'
      dlg.showModal()
    }
    if (morph()) {
      card.style.viewTransitionName = 'sc-morph'
      ;(
        document as Document & { startViewTransition: (cb: () => void) => unknown }
      ).startViewTransition(show)
    } else dlg.showModal()
  }

  const close = () => {
    const card = from
    const hide = () => {
      dlg.close()
      dlg.style.viewTransitionName = ''
      if (card) card.style.viewTransitionName = 'sc-morph'
    }
    if (morph() && card) {
      const t = (
        document as Document & {
          startViewTransition: (cb: () => void) => { finished: Promise<void> }
        }
      ).startViewTransition(hide)
      void t.finished.finally(() => {
        card.style.viewTransitionName = ''
        card.querySelector<HTMLElement>('[data-more]')?.focus()
      })
    } else {
      dlg.close()
      card?.querySelector<HTMLElement>('[data-more]')?.focus()
    }
  }

  for (const b of week.querySelectorAll<HTMLButtonElement>('[data-more]')) {
    b.addEventListener('click', () => {
      const card = b.closest<HTMLElement>('[data-day]')
      if (card) open(card)
    })
  }
  dlg.querySelector('[data-day-close]')?.addEventListener('click', close)
  // Esc and a click on the backdrop close it the same way (so the card morphs back).
  dlg.addEventListener('cancel', (e) => {
    e.preventDefault()
    close()
  })
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) close()
  })
}
