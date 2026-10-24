/** Public surface of the guides module: its manifest. */
import { defineModule } from '@eec/modules-kit'

export const guidesModule = defineModule({
  id: 'guides',
  label: { fr: 'Vie pratique', en: 'Practical life' },
  toggleable: true,
  flagDefault: true,
  publicRoutes: true,
  permissions: [
    { action: 'read', label: { fr: 'Voir les parcours', en: 'View the guides' } },
    { action: 'edit', label: { fr: 'Modifier les parcours', en: 'Edit the guides' } },
    {
      action: 'publish',
      label: { fr: 'Publier un parcours', en: 'Publish a guide' },
      description: {
        fr: 'Seul un parcours validé par le partenaire de contenu doit être publié.',
        en: 'Only a guide validated by the content partner should be published.',
      },
    },
    {
      action: 'delete',
      label: { fr: 'Supprimer un parcours', en: 'Delete a guide' },
      dangerous: true,
    },
  ],
  admin: {
    nav: [
      {
        group: 'parish',
        label: { fr: 'Vie pratique', en: 'Practical life' },
        path: '/m/guides',
        icon: 'careHands',
        order: 50,
        permission: 'guides:read',
      },
    ],
  },
})
