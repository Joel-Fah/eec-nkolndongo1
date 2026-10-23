/** Public surface of the bulletin module: its manifest. */
import { defineModule } from '@eec/modules-kit'

export const bulletinModule = defineModule({
  id: 'bulletin',
  label: { fr: 'Bulletin', en: 'Bulletin' },
  toggleable: true,
  flagDefault: true,
  publicRoutes: true,
  permissions: [
    {
      action: 'read',
      label: {
        fr: 'Voir les bulletins (brouillons compris)',
        en: 'View bulletins (drafts included)',
      },
    },
    {
      action: 'edit',
      label: { fr: 'Composer et modifier le bulletin', en: 'Compose and edit the bulletin' },
    },
    { action: 'publish', label: { fr: 'Publier le bulletin', en: 'Publish the bulletin' } },
    {
      action: 'delete',
      label: { fr: 'Supprimer un bulletin', en: 'Delete a bulletin' },
      dangerous: true,
    },
  ],
  admin: {
    nav: [
      {
        group: 'content',
        label: { fr: 'Bulletin', en: 'Bulletin' },
        path: '/m/bulletin',
        icon: 'newspaper',
        order: 17,
        permission: 'bulletin:read',
      },
    ],
  },
})
