/** Public surface of the contact module: its manifest. */
import { defineModule } from '@eec/modules-kit'

export const contactModule = defineModule({
  id: 'contact',
  label: { fr: 'Messages', en: 'Messages' },
  toggleable: true,
  flagDefault: true,
  publicRoutes: true,
  permissions: [
    { action: 'read', label: { fr: 'Lire les messages reçus', en: 'Read incoming messages' } },
    {
      action: 'read-sensitive',
      label: { fr: 'Lire les demandes de prière', en: 'Read prayer requests' },
      description: {
        fr: 'Les demandes de prière sont confidentielles : jamais exportées, conservées moins longtemps.',
        en: 'Prayer requests are confidential: never exported, kept for a shorter time.',
      },
      dangerous: true,
    },
    {
      action: 'handle',
      label: { fr: 'Traiter les messages', en: 'Handle messages' },
      description: {
        fr: 'Prendre en charge, changer l’état, ajouter des notes internes.',
        en: 'Take charge, change the status, add internal notes.',
      },
    },
    {
      action: 'delete',
      label: { fr: 'Supprimer un message', en: 'Delete a message' },
      dangerous: true,
    },
  ],
  admin: {
    nav: [
      {
        group: 'parish',
        label: { fr: 'Messages', en: 'Messages' },
        path: '/m/contact',
        icon: 'message',
        order: 70,
        permission: 'contact:read',
      },
    ],
  },
})
