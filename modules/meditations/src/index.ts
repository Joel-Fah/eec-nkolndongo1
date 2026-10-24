/** Public surface of the meditations module: its manifest. */
import { defineModule } from '@eec/modules-kit'

export const meditationsModule = defineModule({
  id: 'meditations',
  label: { fr: 'Méditations', en: 'Meditations' },
  toggleable: true,
  flagDefault: true,
  publicRoutes: true,
  permissions: [
    {
      action: 'read',
      label: { fr: 'Voir le programme de méditation', en: 'View the meditation programme' },
    },
    {
      action: 'edit',
      label: {
        fr: 'Modifier le programme et importer un calendrier',
        en: 'Edit the programme and import a calendar',
      },
    },
    {
      action: 'publish',
      label: { fr: 'Publier un programme', en: 'Publish a programme' },
      description: {
        fr: 'Un programme publié devient visible sur le site pour les jours qu’il couvre.',
        en: 'A published programme becomes visible on the site for the days it covers.',
      },
    },
    {
      action: 'delete',
      label: { fr: 'Supprimer un programme', en: 'Delete a programme' },
      dangerous: true,
    },
  ],
  admin: {
    nav: [
      {
        group: 'content',
        label: { fr: 'Méditations', en: 'Meditations' },
        path: '/m/meditations',
        icon: 'book',
        order: 16,
        permission: 'meditations:read',
      },
    ],
  },
})
