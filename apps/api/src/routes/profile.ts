/**
 * The member's own profile (decision 0047): optional details behind a `profile` consent, a private photo, the completeness that
 * drives the warnings, and the small « badge » the navbars read. Everything is the signed-in person's own; staff see age bands
 * and, at the photo's *staff* level, the picture (routes/members.ts). Audit lines never carry a value.
 */
import { type AppEnv, audit, fail, requireSelf } from '@eec/api-kit'
import {
  avatarSeed,
  type Completeness,
  emptyDetails,
  GENDERS,
  MARITAL,
  type ProfileDetails,
  profileCompleteness,
  validBirthDate,
} from '@eec/core'
import { schema } from '@eec/db'
import { zValidator } from '@hono/zod-validator'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { createPrivateStore, PHOTO_MAX_BYTES, sniffPhoto } from '../lib/private-store.ts'
import { policyVersion } from '../policy.ts'

const { profiles, consents, user, account, notifications } = schema
const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(new Date())
const text = (n: number) =>
  z
    .string()
    .trim()
    .max(n)
    .transform((s) => (s === '' ? null : s))
    .nullable()

const detailsBody = z
  .object({
    birthDate: z.string().nullable(),
    gender: z.enum(GENDERS).nullable(),
    neighbourhood: text(80),
    city: text(80),
    maritalStatus: z.enum(MARITAL).nullable(),
    profession: text(80),
  })
  .partial()
  .strict()

const CLEARED = {
  birthDate: null,
  gender: null,
  neighbourhood: null,
  city: null,
  maritalStatus: null,
  profession: null,
  photoKey: null,
  photoAsAvatar: false,
  photoUpdatedAt: null,
  // what the member said about their baptism and confirmation goes with the consent (the parish's own confirmation stays)
  baptised: null,
  confirmed: null,
}

type Db = Awaited<ReturnType<AppEnv['Variables']['deps']['db']>>
async function hasConsent(db: Db, userId: string) {
  const [row] = await db
    .select({ id: consents.id })
    .from(consents)
    .where(
      and(
        eq(consents.userId, userId),
        eq(consents.kind, 'profile'),
        sql`${consents.withdrawnAt} is null`,
      ),
    )
    .limit(1)
  return !!row
}

/** Everything the screens need to draw the profile; never the photo key. */
async function load(db: Db, userId: string) {
  const [row] = await db
    .select({
      birthDate: profiles.birthDate,
      gender: profiles.gender,
      neighbourhood: profiles.neighbourhood,
      city: profiles.city,
      maritalStatus: profiles.maritalStatus,
      profession: profiles.profession,
      photoKey: profiles.photoKey,
      photoAsAvatar: profiles.photoAsAvatar,
      photoUpdatedAt: profiles.photoUpdatedAt,
      baptised: profiles.baptised,
      confirmed: profiles.confirmed,
      createdAt: user.createdAt,
      // The picture Google gave at sign-in, if any: it counts as the person's photo until they choose another (decision 0047).
      image: user.image,
    })
    .from(profiles)
    .innerJoin(user, eq(user.id, profiles.userId))
    .where(eq(profiles.userId, userId))
  const consent = await hasConsent(db, userId)
  const details: ProfileDetails = row
    ? {
        birthDate: row.birthDate,
        gender: row.gender,
        neighbourhood: row.neighbourhood,
        city: row.city,
        maritalStatus: row.maritalStatus,
        profession: row.profession,
      }
    : emptyDetails()
  const hasPhoto = !!row?.photoKey || !!row?.image
  const completeness: Completeness = profileCompleteness(details, consent, hasPhoto)
  return { row, consent, details, hasPhoto, completeness }
}

export const profileRoutes = new Hono<AppEnv>()
  // What the navbars need, and nothing more. Anonymous visitors get `signedIn: false` (not a 401: no red line in the console).
  .get('/badge', async (c) => {
    c.header('cache-control', 'private, no-store')
    c.header('vary', 'Cookie')
    const actor = await c.var.deps.actor()
    if (actor?.principal.status !== 'active') return c.json({ signedIn: false })
    const db = await c.var.deps.db()
    const { row, completeness } = await load(db, actor.userId)
    // Unread member notifications, for the bell in the header (a plain count: nothing is computed here).
    const [unread] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, actor.userId),
          inArray(notifications.kind, [
            'waitlist_promoted',
            'policy_change',
            'group_announcement',
            'group_decision',
          ]),
          isNull(notifications.readAt),
          isNull(notifications.resolvedAt),
          isNull(notifications.dismissedAt),
        ),
      )
    // The groups I am in, so a group's public page can say « vous êtes membre » to me alone (nothing public).
    const mine = await db
      .select({ key: schema.groups.key })
      .from(schema.groupMembers)
      .innerJoin(schema.groups, eq(schema.groups.id, schema.groupMembers.groupId))
      .where(eq(schema.groupMembers.userId, actor.userId))
    return c.json({
      signedIn: true,
      groups: mine.map((g) => g.key),
      unread: unread?.n ?? 0,
      seed: avatarSeed(actor.userId),
      incomplete: !completeness.complete,
      // The photo shows in the navbar only if its owner chose it as their avatar; otherwise the generated avatar does (the default).
      photo:
        row?.photoAsAvatar && (row.photoKey || row.image)
          ? row.photoKey
            ? `/api/me/photo?v=${row.photoUpdatedAt?.getTime() ?? 0}`
            : (row.image ?? null)
          : null,
    })
  })
  .get('/profile', requireSelf(), async (c) => {
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    const db = await c.var.deps.db()
    const { row, consent, details, hasPhoto, completeness } = await load(db, actor.userId)
    const providers = await db
      .select({ p: account.providerId })
      .from(account)
      .where(eq(account.userId, actor.userId))
    c.header('cache-control', 'private, no-store')
    return c.json({
      // How this account signs in: Google, e-mail and password, or both.
      signIn: [
        ...new Set(
          providers.flatMap((x) =>
            x.p === 'google' ? ['google'] : x.p === 'credential' ? ['email'] : [],
          ),
        ),
      ],
      consent,
      details,
      photo: {
        has: hasPhoto,
        // Where it comes from: a picture the person uploaded, or the one Google gave (kept until they choose another).
        source: row?.photoKey ? 'upload' : row?.image ? 'google' : null,
        googleAvailable: !!row?.image,
        url: row?.photoKey
          ? `/api/me/photo?v=${row.photoUpdatedAt?.getTime() ?? 0}`
          : (row?.image ?? null),
        asAvatar: !!row?.photoAsAvatar,
      },
      // What the member said about their baptism and confirmation (decision 0050); not part of the completeness.
      sacrament: { baptised: row?.baptised ?? null, confirmed: row?.confirmed ?? null },
      completeness,
      seed: avatarSeed(actor.userId),
    })
  })
  // The optional consent: given, then details and photo can be saved; withdrawn, they are erased (the photo object too).
  .post(
    '/profile/consent',
    requireSelf(),
    zValidator('json', z.object({ granted: z.boolean() }).strict()),
    async (c) => {
      const actor = await c.var.deps.actor()
      if (!actor) return fail(c, 401, 'unauthenticated')
      const { granted } = c.req.valid('json')
      const db = await c.var.deps.db()
      if (granted) {
        if (!(await hasConsent(db, actor.userId)))
          await db.insert(consents).values({
            userId: actor.userId,
            kind: 'profile',
            policyVersion: await policyVersion(db),
          })
      } else {
        const [cur] = await db
          .select({ key: profiles.photoKey })
          .from(profiles)
          .where(eq(profiles.userId, actor.userId))
        await db
          .update(consents)
          .set({ withdrawnAt: new Date() })
          .where(
            and(
              eq(consents.userId, actor.userId),
              eq(consents.kind, 'profile'),
              sql`${consents.withdrawnAt} is null`,
            ),
          )
        await db.update(profiles).set(CLEARED).where(eq(profiles.userId, actor.userId))
        if (cur?.key)
          await createPrivateStore(c.env)
            .delete(cur.key)
            .catch(() => {})
      }
      await audit(c, {
        action: granted ? 'consent.grant' : 'consent.withdraw',
        entityType: 'account',
        entityId: actor.userId,
        summaryFr: granted
          ? 'Consentement au profil complet accordé'
          : 'Consentement au profil complet retiré (détails et photo effacés)',
        summaryEn: granted
          ? 'Full-profile consent given'
          : 'Full-profile consent withdrawn (details and photo erased)',
      })
      return c.json({ ok: true })
    },
  )
  .put('/profile', requireSelf(), zValidator('json', detailsBody), async (c) => {
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    const db = await c.var.deps.db()
    if (!(await hasConsent(db, actor.userId))) return fail(c, 403, 'consent_required')
    const body = c.req.valid('json')
    if (body.birthDate != null && !validBirthDate(body.birthDate, today()))
      return fail(c, 400, 'invalid')
    await db.update(profiles).set(body).where(eq(profiles.userId, actor.userId))
    // Which fields changed, never their values.
    await audit(c, {
      action: 'update',
      entityType: 'account',
      entityId: actor.userId,
      summaryFr: 'Détails du profil mis à jour par la personne',
      summaryEn: 'Profile details updated by their owner',
      diff: { fields: Object.keys(body) },
    })
    return c.json({ ok: true })
  })
  // The photo: one 512 px picture prepared in the browser; WebP or JPEG by its first bytes, 300 KB at most.
  .put('/photo', requireSelf(), async (c) => {
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    const db = await c.var.deps.db()
    // The body is read first: answering before reading an upload can break the connection for the next request.
    const form = await c.req.formData().catch(() => null)
    if (!(await hasConsent(db, actor.userId))) return fail(c, 403, 'consent_required')
    const file = form?.get('file')
    if (!(file instanceof File) || file.size === 0 || file.size > PHOTO_MAX_BYTES)
      return fail(c, 400, 'invalid')
    const bytes = new Uint8Array(await file.arrayBuffer())
    const kind = sniffPhoto(bytes)
    if (!kind) return fail(c, 400, 'invalid')
    const store = createPrivateStore(c.env)
    const key = `private/avatar/${actor.userId}/${crypto.randomUUID()}.${kind.ext}`
    await store.put(key, bytes.buffer as ArrayBuffer, kind.mime)
    const [cur] = await db
      .select({ key: profiles.photoKey })
      .from(profiles)
      .where(eq(profiles.userId, actor.userId))
    await db
      .update(profiles)
      .set({ photoKey: key, photoUpdatedAt: new Date() })
      .where(eq(profiles.userId, actor.userId))
    if (cur?.key) await store.delete(cur.key).catch(() => {})
    await audit(c, {
      action: 'update',
      entityType: 'account',
      entityId: actor.userId,
      summaryFr: 'Photo de profil ajoutée',
      summaryEn: 'Profile photo added',
    })
    return c.json({ ok: true })
  })
  // Deletes the uploaded picture (the Google one, if there is one, shows again); with no upload, it removes the Google one from the account.
  .delete('/photo', requireSelf(), async (c) => {
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    const db = await c.var.deps.db()
    const [cur] = await db
      .select({ key: profiles.photoKey })
      .from(profiles)
      .where(eq(profiles.userId, actor.userId))
    if (cur?.key) {
      await db
        .update(profiles)
        .set({ photoKey: null, photoUpdatedAt: null })
        .where(eq(profiles.userId, actor.userId))
      await createPrivateStore(c.env)
        .delete(cur.key)
        .catch(() => {})
    } else {
      await db.update(user).set({ image: null }).where(eq(user.id, actor.userId))
    }
    await db
      .update(profiles)
      .set({ photoAsAvatar: false })
      .where(and(eq(profiles.userId, actor.userId), sql`${profiles.photoKey} is null`))
    await audit(c, {
      action: 'delete',
      entityType: 'account',
      entityId: actor.userId,
      summaryFr: 'Photo de profil supprimée',
      summaryEn: 'Profile photo deleted',
    })
    return c.json({ ok: true })
  })
  // The member's choice: their photo as the avatar in the navbar, or the generated one (the default). The team sees an uploaded photo either way.
  .put(
    '/photo-avatar',
    requireSelf(),
    zValidator('json', z.object({ use: z.boolean() }).strict()),
    async (c) => {
      const actor = await c.var.deps.actor()
      if (!actor) return fail(c, 401, 'unauthenticated')
      const db = await c.var.deps.db()
      await db
        .update(profiles)
        .set({ photoAsAvatar: c.req.valid('json').use })
        .where(eq(profiles.userId, actor.userId))
      await audit(c, {
        action: 'update',
        entityType: 'account',
        entityId: actor.userId,
        summaryFr: 'Choix de l’avatar changé',
        summaryEn: 'Avatar choice changed',
        diff: { photoAsAvatar: c.req.valid('json').use },
      })
      return c.json({ ok: true })
    },
  )
  // Only the owner reads their own picture here. Never cached, never public.
  .get('/photo', requireSelf(), async (c) => {
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    const db = await c.var.deps.db()
    const [row] = await db
      .select({ key: profiles.photoKey })
      .from(profiles)
      .where(eq(profiles.userId, actor.userId))
    if (!row?.key) return fail(c, 404, 'not_found')
    return photoResponse(c.env, row.key)
  })

/** The bytes with every header that keeps them private. */
export async function photoResponse(env: AppEnv['Bindings'], key: string) {
  const res = await createPrivateStore(env).get(key)
  if (!res.ok)
    return new Response(null, { status: 404, headers: { 'cache-control': 'private, no-store' } })
  return new Response(res.body, {
    headers: {
      'content-type': key.endsWith('.webp') ? 'image/webp' : 'image/jpeg',
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      'cross-origin-resource-policy': 'same-origin',
      vary: 'Cookie',
    },
  })
}
