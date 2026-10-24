/** Public surface of the campaigns module: its manifest. */
import { defineModule } from '@eec/modules-kit'

export const campaignsModule = defineModule({
  id: 'campaigns',
  label: { fr: 'Fête des Moissons', en: 'Harvest festival' },
  toggleable: true,
  flagDefault: true,
  scopedByGroup: true,
  publicRoutes: true,
  permissions: [
    {
      action: 'read',
      label: {
        fr: 'Voir les campagnes et les montants saisis',
        en: 'See campaigns and the amounts entered',
      },
    },
    {
      action: 'edit',
      label: { fr: 'Créer et modifier une campagne', en: 'Create and edit a campaign' },
    },
    {
      action: 'progress',
      label: { fr: 'Saisir les sommes reçues', en: 'Enter the amounts received' },
    },
    {
      action: 'validate',
      label: {
        fr: 'Valider les sommes (elles deviennent publiques dans le total)',
        en: 'Validate amounts (they become public in the total)',
      },
      dangerous: true,
    },
    {
      action: 'delete',
      label: { fr: 'Supprimer une campagne', en: 'Delete a campaign' },
      dangerous: true,
    },
  ],
  admin: {
    nav: [
      {
        group: 'parish',
        label: { fr: 'Fête des Moissons', en: 'Harvest festival' },
        path: '/m/campaigns',
        icon: 'gift',
        order: 28,
        permission: 'campaigns:read',
      },
    ],
  },
})
