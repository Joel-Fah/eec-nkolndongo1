/**
 * Dev only: removes accounts, links and audit rows created for tests (addresses ending @example.test), demo
 * roles/groups ("… Démo") and settings saved during walkthroughs. Refuses to run on any branch but `dev`.
 */
import { assertBranch, connectDirect } from '@eec/db/node'

assertBranch(['dev'])
const { db, close } = await connectDirect()
const q = (text: string) => db.$client.query(text)
await q('alter table user_roles disable trigger user_roles_guard_last_super_admin')
await q('delete from "user" where email like \'%@example.test\'')
await q('alter table user_roles enable trigger user_roles_guard_last_super_admin')
await q("delete from access_links where email like '%@example.test'")
await q(
  "delete from audit_log where summary_fr like '%example.test%' or entity_id like '%example.test%'",
)
await q("delete from rate_limit where key like 'signup:%' or key like 'inv%' or key like 'reset:%'")
// Demo artefacts from admin walkthroughs: roles/groups named "… Démo", settings saved during tests.
await q("delete from roles where not is_system and key like '%demo%'")
await q("delete from groups where key like '%demo%'")
await q('delete from settings')
await q("delete from content_versions where area = 'settings'")
await q("delete from audit_log where summary_fr like '%Démo%' or entity_type = 'settings'")
const { rows } = await q(
  'select (select count(*) from "user") users, (select count(*) from audit_log) audit',
)
console.log('dev test data cleaned:', rows[0])
await close()
