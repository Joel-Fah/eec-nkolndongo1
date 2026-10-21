/** Public surface of the media module: its manifest and the shared rules. */
import { defineModule } from '@eec/modules-kit'

export type { MediaVariant } from '@eec/db/schema'
export * from './rules.ts'

export const mediaModule = defineModule({
  id: 'media',
  label: { fr: 'Médiathèque', en: 'Media library' },
  toggleable: true,
  flagDefault: true,
  publicRoutes: true,
  permissions: [
    { action: 'read', label: { fr: 'Voir la médiathèque', en: 'View the media library' } },
    {
      action: 'upload',
      label: { fr: 'Ajouter des fichiers', en: 'Upload files' },
      description: {
        fr: 'Photos, audio et documents PDF.',
        en: 'Photos, audio and PDF documents.',
      },
    },
    {
      action: 'edit',
      label: { fr: 'Modifier les descriptions et crédits', en: 'Edit descriptions and credits' },
    },
    {
      action: 'delete',
      label: { fr: 'Supprimer des fichiers', en: 'Delete files' },
      description: {
        fr: 'Définitif. Un fichier utilisé ailleurs ne peut pas être supprimé.',
        en: 'Permanent. A file used elsewhere cannot be deleted.',
      },
      dangerous: true,
    },
  ],
  admin: {
    nav: [
      {
        group: 'content',
        label: { fr: 'Médiathèque', en: 'Media library' },
        path: '/m/media',
        icon: 'image',
        order: 20,
        permission: 'media:read',
      },
    ],
  },
})
