/** Public surface of the schedule module: its manifest. */
import { defineModule } from '@eec/modules-kit'

export const scheduleModule = defineModule({
  id: 'schedule',
  label: { fr: 'Cultes et horaires', en: 'Services and times' },
  toggleable: true,
  flagDefault: true,
  publicRoutes: true,
  permissions: [
    { action: 'read', label: { fr: 'Voir les horaires', en: 'View the schedule' } },
    {
      action: 'update',
      label: { fr: 'Modifier les horaires', en: 'Edit the schedule' },
      description: {
        fr: 'Un horaire modifié doit être approuvé de nouveau avant d’apparaître sur le site.',
        en: 'An edited time must be approved again before it shows on the site.',
      },
    },
    {
      action: 'validate',
      label: { fr: 'Approuver les horaires', en: 'Approve the schedule' },
      description: {
        fr: 'Seuls les horaires approuvés sont publics.',
        en: 'Only approved times are public.',
      },
    },
  ],
  admin: {
    nav: [
      {
        group: 'parish',
        label: { fr: 'Cultes et horaires', en: 'Services and times' },
        path: '/m/schedule',
        icon: 'clock',
        order: 20,
        permission: 'schedule:read',
      },
    ],
  },
})
