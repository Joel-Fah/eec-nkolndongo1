/** Public surface of the sermons module: its manifest. */
import { defineModule } from '@eec/modules-kit'

export const sermonsModule = defineModule({
  id: 'sermons',
  label: { fr: 'Prédications', en: 'Sermons' },
  toggleable: true,
  flagDefault: true,
  publicRoutes: true,
  permissions: [
    {
      action: 'read',
      label: {
        fr: 'Voir les prédications (brouillons compris)',
        en: 'View sermons (drafts included)',
      },
    },
    {
      action: 'edit',
      label: { fr: 'Écrire et modifier des prédications', en: 'Write and edit sermons' },
    },
    {
      action: 'publish',
      label: { fr: 'Publier et programmer des prédications', en: 'Publish and schedule sermons' },
    },
    {
      action: 'delete',
      label: { fr: 'Supprimer des prédications', en: 'Delete sermons' },
      description: {
        fr: 'Définitif. Préférez archiver.',
        en: 'Permanent. Archiving is usually better.',
      },
      dangerous: true,
    },
  ],
  admin: {
    nav: [
      {
        group: 'content',
        label: { fr: 'Prédications', en: 'Sermons' },
        path: '/m/sermons',
        icon: 'headphones',
        order: 15,
        permission: 'sermons:read',
      },
    ],
  },
})
