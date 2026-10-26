/** Public surface of the communion module: its manifest and the pure helpers shared with the screens. */
import { defineModule } from '@eec/modules-kit'

export const communionModule = defineModule({
  id: 'communion',
  label: { fr: 'Cartes de Sainte-Cène', en: 'Communion cards' },
  toggleable: true,
  flagDefault: true,
  publicRoutes: true,
  permissions: [
    {
      action: 'read',
      label: { fr: 'Voir les cartes de Sainte-Cène', en: 'See the Communion cards' },
    },
    {
      action: 'issue',
      label: {
        fr: 'Proposer une carte et confirmer le baptême',
        en: 'Propose a card and confirm baptism',
      },
      description: {
        fr: 'Une carte proposée devient valable quand une autre personne l’approuve.',
        en: 'A proposed card becomes valid when another person approves it.',
      },
    },
    {
      action: 'approve',
      label: {
        fr: 'Approuver, renouveler ou retirer une carte',
        en: 'Approve, renew or withdraw a card',
      },
      description: {
        fr: 'Deuxième personne de l’émission ; seule à pouvoir retirer une carte.',
        en: 'Second person of the issue; the only one who can withdraw a card.',
      },
      dangerous: true,
    },
    {
      action: 'suspend',
      label: { fr: 'Suspendre ou rétablir une carte', en: 'Suspend or restore a card' },
      dangerous: true,
    },
    {
      action: 'visa',
      label: { fr: 'Viser le mois sur la carte', en: 'Sign the month on a card' },
      description: {
        fr: 'Le visa des Anciens d’Église pour la Sainte-Cène du mois.',
        en: 'The Church Elders’ signature for the month’s Holy Supper.',
      },
    },
    {
      action: 'register-read',
      label: { fr: 'Lire le registre des cotisations', en: 'Read the contributions register' },
    },
    {
      action: 'register-write',
      label: { fr: 'Noter une cotisation reçue', en: 'Note a contribution received' },
    },
    {
      action: 'fees',
      label: {
        fr: 'Régler les cotisations attendues',
        en: 'Set the expected contributions',
      },
      description: {
        fr: 'Montants par tranche d’âge et par groupe. Jamais montrés comme une dette.',
        en: 'Amounts by age band and by group. Never shown as a debt.',
      },
    },
    {
      action: 'verify',
      label: { fr: 'Vérifier une carte (scanner)', en: 'Check a card (scanner)' },
    },
  ],
  admin: {
    nav: [
      {
        group: 'members',
        label: { fr: 'Cartes de Sainte-Cène', en: 'Communion cards' },
        path: '/m/communion',
        icon: 'church',
        order: 20,
        permission: 'communion:read',
      },
    ],
  },
})
