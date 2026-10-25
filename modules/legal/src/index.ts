/** Public surface of the legal module: its manifest. */
import { defineModule } from '@eec/modules-kit'

export const legalModule = defineModule({
  id: 'legal',
  label: { fr: 'Documents légaux', en: 'Legal documents' },
  toggleable: false,
  flagDefault: true,
  publicRoutes: true,
  permissions: [
    { action: 'read', label: { fr: 'Voir les documents légaux', en: 'View legal documents' } },
    {
      action: 'update',
      label: { fr: 'Rédiger les documents légaux', en: 'Draft legal documents' },
      description: {
        fr: 'Crée une nouvelle version en brouillon et la modifie. Rien n’est public avant la publication.',
        en: 'Creates a new draft version and edits it. Nothing is public before publishing.',
      },
    },
    {
      action: 'publish',
      label: {
        fr: 'Publier une version d’un document légal',
        en: 'Publish a version of a legal document',
      },
      description: {
        fr: 'Publier une nouvelle politique de confidentialité avertit les membres dans Mon espace.',
        en: 'Publishing a new privacy policy notifies members in My space.',
      },
      dangerous: true,
    },
  ],
  admin: {
    nav: [
      {
        group: 'settings',
        label: { fr: 'Documents légaux', en: 'Legal documents' },
        path: '/m/legal',
        icon: 'audit',
        order: 30,
        permission: 'legal:read',
      },
    ],
  },
})
