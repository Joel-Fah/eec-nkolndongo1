/** Public surface of the members module: its manifest. */
import { defineModule } from '@eec/modules-kit'

export const membersModule = defineModule({
  id: 'members',
  label: { fr: 'Membres', en: 'Members' },
  // The parish's people: always on.
  toggleable: false,
  flagDefault: true,
  publicRoutes: false,
  permissions: [
    {
      action: 'read',
      label: { fr: 'Voir les membres et les chiffres', en: 'View members and headcount' },
      description: {
        fr: 'Liste, fiches (en lecture seule) et tableau de bord des effectifs.',
        en: 'List, read-only records and the headcount dashboard.',
      },
    },
    {
      action: 'export',
      label: { fr: 'Exporter la liste des membres', en: 'Export the member list' },
      description: {
        fr: 'Fichier CSV avec noms, adresses et téléphones. Chaque export est enregistré.',
        en: 'CSV file with names, addresses and phones. Every export is logged.',
      },
      dangerous: true,
    },
  ],
  admin: {
    nav: [
      {
        group: 'members',
        label: { fr: 'Membres', en: 'Members' },
        path: '/m/members',
        icon: 'couple',
        order: 10,
        permission: 'members:read',
      },
    ],
  },
})
