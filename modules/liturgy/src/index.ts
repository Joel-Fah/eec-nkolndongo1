/** Public surface of the liturgy module: its manifest. */
import { defineModule } from '@eec/modules-kit'

export const liturgyModule = defineModule({
  id: 'liturgy',
  label: { fr: 'Liturgie', en: 'Liturgy' },
  toggleable: true,
  flagDefault: true,
  publicRoutes: true,
  permissions: [
    { action: 'read', label: { fr: 'Voir la liturgie', en: 'View the liturgy' } },
    {
      action: 'edit',
      label: { fr: 'Préparer les dimanches et les versets', en: 'Prepare Sundays and verses' },
    },
    {
      action: 'publish',
      label: { fr: 'Publier les dimanches', en: 'Publish Sundays' },
      description: {
        fr: 'Les noms du prédicateur et du liturgiste ne sont publics que si la personne a accepté.',
        en: 'The preacher’s and liturgist’s names are public only if the person agreed.',
      },
    },
    {
      action: 'validate',
      label: {
        fr: 'Approuver les textes de l’année liturgique',
        en: 'Approve the liturgical year texts',
      },
    },
  ],
  admin: {
    nav: [
      {
        group: 'parish',
        label: { fr: 'Liturgie', en: 'Liturgy' },
        path: '/m/liturgy',
        icon: 'notebook',
        order: 30,
        permission: 'liturgy:read',
      },
    ],
  },
})
