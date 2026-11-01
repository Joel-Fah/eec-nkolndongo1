/** Public surface of the rights module: its manifest and the rules shared with the screen. */
import { defineModule } from '@eec/modules-kit'

export const KINDS = ['access', 'rectification', 'erasure', 'objection', 'other'] as const
export const CHANNELS = ['phone', 'in_person', 'email', 'letter', 'site'] as const
export const STATUSES = ['received', 'in_progress', 'done', 'refused'] as const
/** The days to answer. TO CONFIRM against the text of Loi n°2024/017 (Checkpoint L): until then, the safer, shorter reading. */
export const DEADLINE_DAYS = 30

export const rightsModule = defineModule({
  id: 'rights',
  label: { fr: 'Demandes sur les données', en: 'Data requests' },
  toggleable: true,
  flagDefault: true,
  publicRoutes: false,
  permissions: [
    { action: 'read', label: { fr: 'Voir les demandes sur les données', en: 'See data requests' } },
    {
      action: 'handle',
      label: { fr: 'Noter et traiter une demande', en: 'Log and handle a request' },
      description: {
        fr: 'Accès, rectification, effacement ou opposition, reçus par téléphone, en personne ou par écrit.',
        en: 'Access, rectification, erasure or objection, received by phone, in person or in writing.',
      },
    },
    {
      action: 'delete',
      label: { fr: 'Supprimer une demande du registre', en: 'Delete a request from the log' },
      dangerous: true,
    },
  ],
  admin: {
    nav: [
      {
        group: 'members',
        label: { fr: 'Demandes sur les données', en: 'Data requests' },
        path: '/m/rights',
        icon: 'shield',
        order: 30,
        permission: 'rights:read',
      },
    ],
  },
})
