/** Public surface of the departments module: its manifest. */
import { defineModule } from '@eec/modules-kit'

export const departmentsModule = defineModule({
  id: 'departments',
  label: { fr: 'Départements', en: 'Departments' },
  toggleable: true,
  flagDefault: true,
  scopedByGroup: true,
  publicRoutes: true,
  permissions: [
    {
      action: 'read',
      label: { fr: 'Voir les pages de départements', en: 'View department pages' },
    },
    {
      action: 'update',
      label: { fr: 'Modifier la page d’un département', en: 'Edit a department page' },
      description: {
        fr: 'Peut être donné pour un seul groupe : une responsable ne modifie que la page de son groupe.',
        en: 'Can be given for one group only: a leader edits just their own group’s page.',
      },
    },
    {
      action: 'publish',
      label: { fr: 'Publier la page d’un département', en: 'Publish a department page' },
    },
    {
      action: 'quiz',
      label: {
        fr: 'Modifier le questionnaire « Où est ta place ? »',
        en: 'Edit the “Where do you belong?” quiz',
      },
    },
  ],
  admin: {
    nav: [
      {
        group: 'parish',
        label: { fr: 'Départements', en: 'Departments' },
        path: '/m/departments',
        icon: 'department',
        order: 40,
        permission: 'departments:read',
      },
    ],
  },
})
