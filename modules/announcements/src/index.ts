/** Public surface of the announcements module: its manifest. */
import { defineModule } from '@eec/modules-kit'

export const announcementsModule = defineModule({
  id: 'announcements',
  label: { fr: 'Annonces de groupe', en: 'Group announcements' },
  toggleable: true,
  flagDefault: true,
  scopedByGroup: true,
  publicRoutes: false,
  permissions: [
    {
      action: 'read',
      label: { fr: 'Voir les annonces du groupe', en: 'See the group’s announcements' },
    },
    {
      action: 'edit',
      label: { fr: 'Écrire et modifier les annonces', en: 'Write and edit announcements' },
    },
    {
      action: 'publish',
      label: { fr: 'Publier une annonce aux membres', en: 'Publish an announcement to members' },
      description: {
        fr: 'Chaque membre du groupe reçoit une notification dans Mon espace.',
        en: 'Each member of the group gets a notification in Mon espace.',
      },
    },
  ],
  admin: {
    nav: [
      {
        group: 'parish',
        label: { fr: 'Annonces de groupe', en: 'Group announcements' },
        path: '/m/announcements',
        icon: 'megaphone',
        order: 75,
        permission: 'announcements:read',
      },
    ],
  },
})
