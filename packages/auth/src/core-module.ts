/**
 * The core "module": users, roles, groups, audit, system. Always on (not toggleable); its permissions are
 * seeded like any other module's. Plain French labels for non-technical staff.
 */
import { defineModule } from '@eec/modules-kit'

const p = (action: string, fr: string, en: string, dangerous = false) => ({
  action,
  label: { fr, en },
  dangerous,
})

export const coreModule = defineModule({
  id: 'core',
  label: { fr: 'Administration', en: 'Administration' },
  toggleable: false,
  flagDefault: true,
  scopedByGroup: true,
  permissions: [
    p('users-read', 'Voir les utilisateurs', 'View users'),
    p('users-invite', 'Inviter des utilisateurs', 'Invite users'),
    p('users-update', 'Modifier les utilisateurs', 'Edit users'),
    p('users-deactivate', 'Désactiver des comptes', 'Deactivate accounts', true),
    p('users-reset-link', 'Générer un lien de réinitialisation', 'Generate a reset link', true),
    p('roles-read', 'Voir les rôles', 'View roles'),
    p(
      'roles-manage',
      'Créer et modifier les rôles et leurs droits',
      'Create and edit roles and their rights',
      true,
    ),
    p('roles-assign', 'Attribuer des rôles aux utilisateurs', 'Assign roles to users', true),
    p('groups-read', 'Voir les groupes', 'View groups'),
    p('groups-manage', 'Créer et modifier les groupes', 'Create and edit groups'),
    p('audit-read', 'Lire le journal d’activité', 'Read the activity log'),
    p('audit-export', 'Exporter le journal d’activité', 'Export the activity log', true),
    p('system-outbox', 'Gérer la boîte d’envoi', 'Manage the outbox'),
    p('system-design', 'Voir le guide de design', 'View the design guide'),
  ],
})

/** System roles seeded on every environment. Super admin implicitly has everything. */
export const systemRoles = [
  {
    key: 'super-admin',
    fr: 'Super administrateur',
    en: 'Super admin',
    descFr: 'Accès à tout, y compris aux droits futurs.',
    descEn: 'Access to everything, including future rights.',
    grants: [] as string[],
  },
  {
    key: 'secretariat',
    fr: 'Secrétariat',
    en: 'Secretariat',
    descFr: 'Gère les membres, les contenus courants et la boîte d’envoi.',
    descEn: 'Manages members, everyday content and the outbox.',
    grants: [
      'core:users-read',
      'core:users-invite',
      'core:users-update',
      'core:users-reset-link',
      'core:groups-read',
      'core:system-outbox',
      'settings:read',
      'settings:edit',
    ],
  },
  {
    key: 'editeur',
    fr: 'Éditeur',
    en: 'Editor',
    descFr: 'Écrit et publie les contenus.',
    descEn: 'Writes and publishes content.',
    grants: ['core:groups-read'],
  },
  {
    key: 'responsable-groupe',
    fr: 'Responsable de groupe',
    en: 'Group leader',
    descFr: 'Gère un groupe précis (à attribuer avec le groupe).',
    descEn: 'Manages one specific group (grant it with the group).',
    grants: ['core:groups-read'],
  },
  {
    key: 'tresorier',
    fr: 'Trésorier',
    en: 'Treasurer',
    descFr: 'Suit les dons et les finances.',
    descEn: 'Follows gifts and finances.',
    grants: [],
  },
  {
    key: 'membre',
    fr: 'Membre',
    en: 'Member',
    descFr: 'Fidèle inscrit : accès à son espace personnel.',
    descEn: 'Registered member: access to their personal space.',
    grants: [],
  },
] as const
