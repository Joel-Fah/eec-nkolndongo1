/** Public surface of the news module: its manifest and shared constants. */
import { defineModule } from '@eec/modules-kit'

export const newsModule = defineModule({
  id: 'news',
  label: { fr: 'Actualités', en: 'News' },
  toggleable: true,
  flagDefault: true,
  scopedByGroup: true,
  publicRoutes: true,
  permissions: [
    {
      action: 'read',
      label: { fr: 'Voir les actualités (brouillons compris)', en: 'View news (drafts included)' },
    },
    {
      action: 'edit',
      label: { fr: 'Écrire et modifier des actualités', en: 'Write and edit news' },
      description: {
        fr: 'Peut aussi être donné pour un seul groupe (un département).',
        en: 'Can also be given for a single group (a department).',
      },
    },
    {
      action: 'publish',
      label: { fr: 'Publier et programmer des actualités', en: 'Publish and schedule news' },
    },
    {
      action: 'delete',
      label: { fr: 'Supprimer des actualités', en: 'Delete news' },
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
        label: { fr: 'Actualités', en: 'News' },
        path: '/m/news',
        icon: 'newspaper',
        order: 10,
        permission: 'news:read',
      },
    ],
  },
})
