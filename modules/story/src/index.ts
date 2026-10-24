/** Public surface of the pages module: its manifest. */
import { defineModule } from '@eec/modules-kit'

export const storyModule = defineModule({
  id: 'story',
  label: { fr: 'Pages du site', en: 'Site pages' },
  toggleable: false,
  flagDefault: true,
  publicRoutes: true,
  permissions: [
    { action: 'read', label: { fr: 'Voir les textes des pages', en: 'View the page texts' } },
    {
      action: 'edit',
      label: {
        fr: 'Modifier les textes des pages et l’histoire',
        en: 'Edit page texts and the history',
      },
      description: {
        fr: 'Un texte modifié doit être publié de nouveau (par une personne autorisée) avant de remplacer le texte actuel du site.',
        en: 'An edited text must be published again (by someone allowed) before it replaces the site’s current text.',
      },
    },
    {
      action: 'publish',
      label: {
        fr: 'Publier les textes des pages et l’histoire',
        en: 'Publish page texts and the history',
      },
    },
    {
      action: 'council',
      label: { fr: 'Gérer Pasteurs et Conseil', en: 'Manage Pastors and Council' },
      description: {
        fr: 'Inclut l’enregistrement du consentement de chaque personne à voir son nom publié.',
        en: 'Includes recording each person’s consent to having their name published.',
      },
    },
  ],
  admin: {
    nav: [
      {
        group: 'parish',
        label: { fr: 'Pages du site', en: 'Site pages' },
        path: '/m/story',
        icon: 'files',
        order: 60,
        permission: 'story:read',
      },
    ],
  },
})
