/**
 * `pnpm --filter @eec/modules grants:report` — writes docs/ops/release-phase-04.md: who holds which permission, straight from the code
 * (the manifests and `systemRoles`), so the list Joël works from can never drift. After decision 0048 the seed offers these grants by
 * itself; this page stays as the readable record and the list of permissions that no system role holds (a decision for Joël).
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { systemRoles } from '@eec/auth/core-module'
import { modules } from '../registry.ts'

const label = new Map<string, { fr: string; dangerous: boolean }>()
for (const m of modules)
  for (const p of m.permissions)
    label.set(`${m.id}:${p.action}`, { fr: p.label.fr, dangerous: p.dangerous ?? false })
const held = new Set(systemRoles.flatMap((r) => r.grants))
const line = (k: string) =>
  `- \`${k}\` — ${label.get(k)?.fr ?? '?'}${label.get(k)?.dangerous ? ' **(sensible)**' : ''}`

const out: string[] = [
  '# Droits des rôles : liste de contrôle (générée)',
  '',
  '_Générée par `pnpm --filter @eec/modules grants:report` à partir du code. Ne pas modifier à la main._',
  '',
  '**Depuis la décision 0048**, `pnpm db:seed` offre chaque droit de ces rôles **une seule fois** : un droit ajouté au code arrive sur chaque environnement au prochain seed, un droit retiré volontairement dans « Rôles » ne revient pas, un droit ajouté à la main n’est jamais touché. En attendant que 0048 soit en production, ces droits se donnent à la main dans **Rôles**.',
  '',
  '## Par rôle',
]
for (const r of systemRoles) {
  out.push('', `### ${r.fr} (\`${r.key}\`)`, '', r.descFr)
  out.push(
    '',
    ...(r.key === 'super-admin'
      ? ['Tous les droits, y compris les droits futurs (aucune case à cocher).']
      : r.grants.length
        ? r.grants.map(line)
        : ['Aucun droit d’administration (compte de membre).']),
  )
}
const orphan = [...label.keys()].filter((k) => !held.has(k))
out.push(
  '',
  '## Droits qu’aucun rôle système ne porte',
  '',
  'Seul le super administrateur les a. **Question pour Joël : lequel de ces droits doit être donné à quel rôle ?** (Un droit « sensible » est audité et se donne avec prudence.)',
  '',
  ...orphan.map(line),
  '',
)
writeFileSync(join(import.meta.dirname, '../../docs/ops/release-phase-04.md'), `${out.join('\n')}`)
console.log(
  `written: ${systemRoles.length} roles, ${held.size} grants, ${orphan.length} permissions held by no system role`,
)
