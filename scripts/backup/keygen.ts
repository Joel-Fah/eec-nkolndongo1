/**
 * `pnpm --filter @eec/scripts exec node backup/keygen.ts <path>` — makes the backup key pair.
 * The PRIVATE key is written to <path> (mode 600) and never printed; keep it offline, in two places. Only the
 * PUBLIC key (age1…) is printed: that one goes into BACKUP_AGE_RECIPIENT (.env.local and the GitHub secret).
 */
import { existsSync, writeFileSync } from 'node:fs'
import { generateIdentity, identityToRecipient } from 'age-encryption'

const path = process.argv[2]
if (!path) throw new Error('Usage: keygen.ts <path for the private key file, outside the repo>')
if (existsSync(path)) throw new Error(`${path} already exists: refusing to overwrite a key`)
const identity = await generateIdentity()
writeFileSync(path, `${identity}\n`, { mode: 0o600 })
console.log(`Private key written to ${path} (keep it offline; never commit it).`)
console.log(`Public key (BACKUP_AGE_RECIPIENT): ${await identityToRecipient(identity)}`)
