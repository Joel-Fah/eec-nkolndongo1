/**
 * « Où est ta place ? »: three short questions in the browser, then one to three suggested groups with a line on why.
 * Nothing is sent or stored. Without JavaScript the section stays hidden and the filterable list does the job.
 * Text is set with textContent only.
 */
import { suggestDepartments } from '@eec/core/departments'

type Answer = { id: string; text: string; tags: string[] }
type Question = { id: string; text: string; answers: Answer[] }
type Group = { key: string; name: string; tagline: string; tags: string[]; href: string }

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string) => {
  const n = document.createElement(tag)
  n.className = cls
  if (text !== undefined) n.textContent = text
  return n
}

export function initQuiz() {
  const root = document.querySelector<HTMLElement>('[data-quiz]')
  if (!root || root.dataset.ready) return
  root.dataset.ready = '1'
  let questions: Question[] = []
  let groups: Group[] = []
  try {
    questions = JSON.parse(root.dataset.questions ?? '[]')
    groups = JSON.parse(root.dataset.groups ?? '[]')
  } catch {
    return
  }
  if (!questions.length || !groups.length) return
  const label = (k: string) => root.dataset[k] ?? ''
  const stage = root.querySelector<HTMLElement>('[data-quiz-stage]')
  if (!stage) return
  root.hidden = false
  let step = 0
  let chosen: string[][] = []

  const start = () => {
    step = 0
    chosen = []
    ask()
  }
  const ask = () => {
    const q = questions[step]
    if (!q) return result()
    const box = el('div', 'dq-step')
    box.append(
      el(
        'p',
        'dq-count',
        label('step')
          .replace('{n}', String(step + 1))
          .replace('{total}', String(questions.length)),
      ),
    )
    const h = el('h3', 'dq-q', q.text)
    h.tabIndex = -1
    box.append(h)
    const list = el('div', 'dq-answers')
    for (const a of q.answers) {
      const b = el('button', 'dq-answer', a.text)
      b.type = 'button'
      b.addEventListener('click', () => {
        chosen.push(a.tags)
        step += 1
        ask()
        stage.querySelector<HTMLElement>('.dq-q, .dq-result-t')?.focus()
      })
      list.append(b)
    }
    box.append(list)
    stage.replaceChildren(box)
  }
  const result = () => {
    const found = suggestDepartments(chosen, groups)
    const box = el('div', 'dq-step')
    const h = el('h3', 'dq-result-t', label(found.length ? 'result' : 'none'))
    h.tabIndex = -1
    box.append(h)
    const list = el('ul', 'dq-results')
    for (const f of found) {
      const g = groups.find((x) => x.key === f.key)
      if (!g) continue
      const li = el('li', 'dq-card')
      const a = el('a', 'dq-link', g.name)
      a.href = g.href
      li.append(a)
      if (g.tagline) li.append(el('p', 'dq-tagline', g.tagline))
      const tagNames = f.matched.map((t) => root.dataset[`tag_${t}`] ?? t).join(', ')
      li.append(el('p', 'dq-why', label('why').replace('{tags}', tagNames)))
      list.append(li)
    }
    box.append(list)
    const again = el('button', 'dq-again', label('again'))
    again.type = 'button'
    again.addEventListener('click', start)
    box.append(again)
    stage.replaceChildren(box)
  }

  const begin = root.querySelector<HTMLButtonElement>('[data-quiz-start]')
  begin?.addEventListener('click', () => {
    start()
    stage.querySelector<HTMLElement>('.dq-q')?.focus()
  })
}
