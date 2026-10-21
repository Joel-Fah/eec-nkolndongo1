/** Public surface of the settings module: its manifest and the shared field definitions. */
import { defineModule } from '@eec/modules-kit'

export * from './fields.ts'

export const settingsModule = defineModule({
  id: 'settings',
  label: { fr: 'Paramètres', en: 'Settings' },
  // The parish's own details: always on.
  toggleable: false,
  flagDefault: true,
  publicRoutes: true,
  permissions: [
    { action: 'read', label: { fr: 'Voir les paramètres', en: 'View settings' } },
    {
      action: 'edit',
      label: { fr: 'Modifier les coordonnées et la saison', en: 'Edit details and season' },
      description: {
        fr: 'Coordonnées de la paroisse, réseaux, dates de la Fête des Moissons.',
        en: 'Parish details, social links, Harvest Festival dates.',
      },
    },
    {
      action: 'validate',
      label: {
        fr: 'Valider une information pour le public',
        en: 'Approve a detail for the public',
      },
      description: {
        fr: 'Une information n’apparaît sur le site qu’une fois validée.',
        en: 'A detail only appears on the site once approved.',
      },
      dangerous: true,
    },
    {
      action: 'flags',
      label: { fr: 'Activer ou désactiver des fonctionnalités', en: 'Turn features on or off' },
      dangerous: true,
    },
  ],
  admin: {
    nav: [
      {
        group: 'settings',
        label: { fr: 'Paramètres', en: 'Settings' },
        path: '/m/settings',
        icon: 'settings',
        order: 10,
        permission: 'settings:read',
      },
    ],
  },
})
