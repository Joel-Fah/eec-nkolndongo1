/** Dev only: removes accounts, links and audit rows created for tests (addresses ending @example.test). */
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
const { rows } = await q(
  'select (select count(*) from "user") users, (select count(*) from audit_log) audit',
)
console.log('dev test data cleaned:', rows[0])
await close()
