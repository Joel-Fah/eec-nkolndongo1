/** Public surface of the events module: its manifest. */
import { defineModule } from '@eec/modules-kit'

export const eventsModule = defineModule({
  id: 'events',
  label: { fr: 'Agenda', en: 'Calendar' },
  toggleable: true,
  flagDefault: true,
  scopedByGroup: true,
  publicRoutes: true,
  permissions: [
    {
      action: 'read',
      label: {
        fr: 'Voir l’agenda (brouillons compris)',
        en: 'View the calendar (drafts included)',
      },
    },
    {
      action: 'edit',
      label: { fr: 'Créer et modifier des événements', en: 'Create and edit events' },
      description: {
        fr: 'Peut aussi être donné pour un seul groupe (un département).',
        en: 'Can also be given for a single group (a department).',
      },
    },
    {
      action: 'publish',
      label: {
        fr: 'Publier, programmer et annuler des événements',
        en: 'Publish, schedule and cancel events',
      },
    },
    {
      action: 'delete',
      label: { fr: 'Supprimer des événements', en: 'Delete events' },
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
        group: 'parish',
        label: { fr: 'Agenda', en: 'Calendar' },
        path: '/m/events',
        icon: 'calendar',
        order: 10,
        permission: 'events:read',
      },
    ],
  },
})
