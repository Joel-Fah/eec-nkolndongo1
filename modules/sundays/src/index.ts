/** Public surface of the sundays module: its manifest (decision 0043). Nothing here is ever public. */
import { defineModule } from '@eec/modules-kit'

export const sundaysModule = defineModule({
  id: 'sundays',
  label: { fr: 'Bilan du dimanche', en: 'Sunday report' },
  toggleable: true,
  flagDefault: true,
  scopedByGroup: true,
  publicRoutes: false,
  permissions: [
    {
      action: 'read',
      label: { fr: 'Voir les bilans et les tendances', en: 'See the reports and trends' },
    },
    {
      action: 'attendance',
      label: {
        fr: 'Saisir les présences (hommes, femmes, enfants)',
        en: 'Enter attendance (men, women, children)',
      },
    },
    { action: 'offerings', label: { fr: 'Saisir les offrandes', en: 'Enter offerings' } },
    {
      action: 'propose',
      label: {
        fr: 'Proposer les chiffres du dimanche (à valider par le secrétariat ou la trésorerie)',
        en: 'Propose the Sunday figures (to be validated by the secretariat or the treasurer)',
      },
    },
    {
      action: 'close',
      label: { fr: 'Clôturer ou rouvrir un dimanche', en: 'Close or reopen a Sunday' },
    },
    {
      action: 'export',
      label: { fr: 'Exporter les bilans (CSV)', en: 'Export the reports (CSV)' },
      dangerous: true,
    },
  ],
  admin: {
    nav: [
      {
        group: 'parish',
        label: { fr: 'Bilan du dimanche', en: 'Sunday report' },
        path: '/m/sundays',
        icon: 'chart',
        order: 27,
        permission: 'sundays:read',
      },
    ],
  },
})
