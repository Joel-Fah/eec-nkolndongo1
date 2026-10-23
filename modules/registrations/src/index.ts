/** Public surface of the registrations module: its manifest. */
import { defineModule } from '@eec/modules-kit'

export const registrationsModule = defineModule({
  id: 'registrations',
  label: { fr: 'Inscriptions', en: 'Registrations' },
  toggleable: true,
  flagDefault: true,
  scopedByGroup: true,
  publicRoutes: true,
  permissions: [
    {
      action: 'read',
      label: {
        fr: 'Voir les formulaires et les inscrits (numéros compris)',
        en: 'See the forms and who registered (phone numbers included)',
      },
    },
    {
      action: 'edit',
      label: { fr: 'Créer et modifier un formulaire', en: 'Create and edit a form' },
    },
    {
      action: 'manage',
      label: {
        fr: 'Ajouter, annuler et pointer des inscrits',
        en: 'Add, cancel and check in people',
      },
    },
    {
      action: 'export',
      label: { fr: 'Exporter la liste des inscrits (CSV)', en: 'Export the list (CSV)' },
      dangerous: true,
    },
    {
      action: 'delete',
      label: {
        fr: 'Supprimer un formulaire ou une inscription',
        en: 'Delete a form or a registration',
      },
      dangerous: true,
    },
  ],
  admin: {
    nav: [
      {
        group: 'parish',
        label: { fr: 'Inscriptions', en: 'Registrations' },
        path: '/m/registrations',
        icon: 'checklist',
        order: 25,
        permission: 'registrations:read',
      },
    ],
  },
})
