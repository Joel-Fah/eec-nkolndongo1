/**
 * Members (admin side), mounted at /api/members next to the public sign-up routes:
 *   GET /list    search and filters (group, joined date, status)
 *   GET /stats   headcount: total, new this month, by group, a 12-month trend (aggregates only)
 *   GET /export  CSV (members:export, sensitive, audited)
 *   GET /detail/:id  a read-only record
 * Members are the people holding the « membre » role; team accounts are managed under Utilisateurs.
 */
import { type AppEnv, audit, fail, requirePermission } from '@eec/api-kit'
import { ageBand, type MemberAgeBand } from '@eec/core'
import { schema } from '@eec/db'
import { and, asc, desc, eq, gte, ilike, inArray, or, type SQL, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { csvCell } from './csv.ts'

const { user, profiles, consents, groupMembers, groups, userRoles, roles } = schema

const isMember = sql`exists (
  select 1 from ${userRoles} ur join ${roles} r on r.id = ur.role_id
  where ur.user_id = ${user.id} and r.key = 'membre'
)`

function where(q: Record<string, string | undefined>) {
  const w: SQL[] = [isMember]
  if (q.q) {
    const like = `%${q.q.trim()}%`
    const match = or(ilike(user.name, like), ilike(user.email, like), ilike(profiles.phone, like))
    if (match) w.push(match)
  }
  if (q.status && ['active', 'deactivated'].includes(q.status))
    w.push(eq(profiles.status, q.status as 'active' | 'deactivated'))
  if (q.since && /^\d{4}-\d{2}-\d{2}$/.test(q.since))
    w.push(gte(user.createdAt, new Date(`${q.since}T00:00:00Z`)))
  if (q.group)
    w.push(
      sql`exists (select 1 from ${groupMembers} gm join ${groups} g on g.id = gm.group_id where gm.user_id = ${user.id} and g.key = ${q.group})`,
    )
  return and(...w)
}

const base = {
  id: user.id,
  name: user.name,
  email: user.email,
  phone: profiles.phone,
  joinedAt: user.createdAt,
  status: profiles.status,
  deletionRequestedAt: profiles.deletionRequestedAt,
}
/** The optional details (decision 0047). They exist only while the member's consent does; staff get an age band, never the birth date. */
const detailCols = {
  birthDate: profiles.birthDate,
  gender: profiles.gender,
  neighbourhood: profiles.neighbourhood,
  city: profiles.city,
  maritalStatus: profiles.maritalStatus,
  profession: profiles.profession,
  photoKey: profiles.photoKey,
  photoLevel: profiles.photoLevel,
}
const todayLocal = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(new Date())
/** Strip the raw birth date and the photo key; say only whether staff may open the picture. */
function safe<T extends { birthDate: string | null; photoKey: string | null; photoLevel: string }>(
  r: T,
) {
  const { birthDate, photoKey, photoLevel, ...rest } = r
  return {
    ...rest,
    ageBand: ageBand(birthDate, todayLocal()),
    photo: !!photoKey && photoLevel === 'staff',
  }
}

async function groupsOf(db: Awaited<ReturnType<AppEnv['Variables']['deps']['db']>>, ids: string[]) {
  const map = new Map<string, { key: string; nameFr: string; nameEn: string | null }[]>()
  if (!ids.length) return map
  const rows = await db
    .select({
      userId: groupMembers.userId,
      key: groups.key,
      nameFr: groups.nameFr,
      nameEn: groups.nameEn,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(inArray(groupMembers.userId, ids))
    .orderBy(asc(groups.nameFr))
  for (const r of rows) map.set(r.userId, [...(map.get(r.userId) ?? []), r])
  return map
}

async function newsOf(db: Awaited<ReturnType<AppEnv['Variables']['deps']['db']>>, ids: string[]) {
  if (!ids.length) return new Set<string>()
  const rows = await db
    .select({ userId: consents.userId })
    .from(consents)
    .where(
      and(
        inArray(consents.userId, ids),
        eq(consents.kind, 'news'),
        sql`${consents.withdrawnAt} is null`,
      ),
    )
  return new Set(rows.map((r) => r.userId))
}

export const membersApi = new Hono<AppEnv>()
  .get('/list', requirePermission('members:read'), async (c) => {
    const db = await c.var.deps.db()
    const q = c.req.query()
    const limit = Math.min(Number(q.limit) || 50, 100)
    const offset = Math.max(0, Number(q.offset) || 0)
    const rows = await db
      .select({ ...base, ...detailCols })
      .from(user)
      .innerJoin(profiles, eq(profiles.userId, user.id))
      .where(where(q))
      .orderBy(desc(user.createdAt))
      .limit(limit + 1)
      .offset(offset)
    const page = rows.slice(0, limit)
    const ids = page.map((r) => r.id)
    const [g, news] = await Promise.all([groupsOf(db, ids), newsOf(db, ids)])
    return c.json({
      items: page.map((r) => ({ ...safe(r), groups: g.get(r.id) ?? [], news: news.has(r.id) })),
      more: rows.length > limit,
    })
  })

  // Aggregates only: no names, so anyone allowed to see the dashboard sees no personal data here.
  .get('/stats', requirePermission('members:read'), async (c) => {
    const db = await c.var.deps.db()
    const [total] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(user)
      .innerJoin(profiles, eq(profiles.userId, user.id))
      .where(and(isMember, eq(profiles.status, 'active')))
    const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
    const [fresh] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(user)
      .innerJoin(profiles, eq(profiles.userId, user.id))
      .where(and(isMember, gte(user.createdAt, monthStart)))
    const [news] = await db
      .select({ n: sql<number>`count(distinct ${consents.userId})::int` })
      .from(consents)
      .where(and(eq(consents.kind, 'news'), sql`${consents.withdrawnAt} is null`))
    // The same numbers one month earlier, so the dashboard can show where things are heading.
    const prevMonthStart = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - 1, 1),
    )
    const [totalBefore] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(user)
      .innerJoin(profiles, eq(profiles.userId, user.id))
      .where(and(isMember, sql`${user.createdAt} < ${monthStart}`))
    const [freshBefore] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(user)
      .innerJoin(profiles, eq(profiles.userId, user.id))
      .where(
        and(isMember, gte(user.createdAt, prevMonthStart), sql`${user.createdAt} < ${monthStart}`),
      )
    const [newsBefore] = await db
      .select({ n: sql<number>`count(distinct ${consents.userId})::int` })
      .from(consents)
      .where(
        and(
          eq(consents.kind, 'news'),
          sql`${consents.grantedAt} < ${monthStart}`,
          sql`(${consents.withdrawnAt} is null or ${consents.withdrawnAt} >= ${monthStart})`,
        ),
      )
    const byGroup = await db
      .select({
        key: groups.key,
        nameFr: groups.nameFr,
        nameEn: groups.nameEn,
        n: sql<number>`count(${groupMembers.userId})::int`,
      })
      .from(groups)
      .leftJoin(groupMembers, eq(groupMembers.groupId, groups.id))
      .where(eq(groups.isActive, true))
      .groupBy(groups.key, groups.nameFr, groups.nameEn)
      .orderBy(desc(sql`count(${groupMembers.userId})`), asc(groups.nameFr))
    // New members per month over the last 12 months (months without anyone count 0).
    const trendRows = await db.execute<{ month: string; n: number }>(sql`
      select to_char(m, 'YYYY-MM') as month, coalesce(count(u.id), 0)::int as n
      from generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') m
      left join ${user} u on date_trunc('month', u.created_at) = m
        and exists (select 1 from ${userRoles} ur join ${roles} r on r.id = ur.role_id where ur.user_id = u.id and r.key = 'membre')
      group by m order by m`)
    // Who they are, as counts only; a group of fewer than 5 people is never shown on its own (decision 0047).
    const detailRows = await db
      .select({ birthDate: profiles.birthDate, gender: profiles.gender, city: profiles.city })
      .from(profiles)
      .innerJoin(user, eq(user.id, profiles.userId))
      .where(and(isMember, eq(profiles.status, 'active')))
    const tally = <K extends string>(keys: (K | null)[]) => {
      const m = new Map<K, number>()
      for (const k of keys) if (k) m.set(k, (m.get(k) ?? 0) + 1)
      return [...m.entries()].map(([key, n]) => ({ key, n })).filter((x) => x.n >= 5)
    }
    const today = todayLocal()
    const people = {
      ageBands: tally<MemberAgeBand>(detailRows.map((r) => ageBand(r.birthDate, today))),
      genders: tally<string>(detailRows.map((r) => r.gender)),
      cities: tally<string>(detailRows.map((r) => r.city?.toLowerCase() ?? null)).sort(
        (a, b) => b.n - a.n,
      ),
      completed: detailRows.filter((r) => r.birthDate && r.gender && r.city).length,
    }
    return c.json({
      people,
      total: total?.n ?? 0,
      newThisMonth: fresh?.n ?? 0,
      newsSubscribers: news?.n ?? 0,
      previous: {
        total: totalBefore?.n ?? 0,
        newThisMonth: freshBefore?.n ?? 0,
        newsSubscribers: newsBefore?.n ?? 0,
      },
      byGroup,
      trend: trendRows.rows.map((r) => ({ month: r.month, n: Number(r.n) })),
    })
  })

  // Sensitive: names, addresses and phones leave the system. Permission members:export, every call audited.
  .get('/export', requirePermission('members:export'), async (c) => {
    const db = await c.var.deps.db()
    const q = c.req.query()
    const rows = await db
      .select({ ...base, ...detailCols })
      .from(user)
      .innerJoin(profiles, eq(profiles.userId, user.id))
      .where(where(q))
      .orderBy(asc(user.name))
      .limit(5000)
    const ids = rows.map((r) => r.id)
    const [g, news] = await Promise.all([groupsOf(db, ids), newsOf(db, ids)])
    const head = [
      'name',
      'email',
      'phone',
      'joined',
      'status',
      'groups',
      'news_consent',
      'age_band',
      'gender',
      'neighbourhood',
      'city',
      'marital_status',
      'profession',
    ]
    const lines = rows.map((r) =>
      [
        r.name,
        r.email,
        r.phone,
        r.joinedAt,
        r.status,
        (g.get(r.id) ?? []).map((x) => x.nameFr).join(' | '),
        news.has(r.id) ? 'yes' : 'no',
        ageBand(r.birthDate, todayLocal()),
        r.gender,
        r.neighbourhood,
        r.city,
        r.maritalStatus,
        r.profession,
      ]
        .map(csvCell)
        .join(','),
    )
    await audit(c, {
      action: 'export',
      entityType: 'members',
      summaryFr: `Export CSV de la liste des membres (${rows.length} personne(s))`,
      summaryEn: `Member list exported as CSV (${rows.length} person(s))`,
      diff: { filters: Object.keys(q), rows: rows.length },
    })
    return new Response(`﻿${[head.join(','), ...lines].join('\r\n')}\r\n`, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="membres-${new Date().toISOString().slice(0, 10)}.csv"`,
        'cache-control': 'private, no-store',
      },
    })
  })

  .get('/detail/:id', requirePermission('members:read'), async (c) => {
    const db = await c.var.deps.db()
    const id = c.req.param('id')
    const [row] = await db
      .select({
        ...base,
        ...detailCols,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        locale: profiles.locale,
        lastSeenAt: profiles.lastSeenAt,
      })
      .from(user)
      .innerJoin(profiles, eq(profiles.userId, user.id))
      .where(and(eq(user.id, id), isMember))
    if (!row) return fail(c, 404, 'not_found')
    const [g, cons] = await Promise.all([
      groupsOf(db, [id]),
      db
        .select({
          kind: consents.kind,
          policyVersion: consents.policyVersion,
          grantedAt: consents.grantedAt,
          withdrawnAt: consents.withdrawnAt,
        })
        .from(consents)
        .where(eq(consents.userId, id))
        .orderBy(desc(consents.grantedAt)),
    ])
    return c.json({ ...safe(row), groups: g.get(id) ?? [], consents: cons })
  })
