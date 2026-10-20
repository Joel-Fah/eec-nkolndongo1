# Incident procedure — a leak, a lost device, a wrong publication

Stay calm, write down times, change nothing you do not understand. The goal: **stop it, understand it, tell the people
concerned, fix it, learn.**

## 1. Stop
- **A secret leaked** (in git, a screenshot, a chat): rotate it at once at its source (Google console, Neon, Cloudflare
  token, storage keys, `AUTH_SECRET`), update Cloudflare/GitHub secrets, redeploy. Rotating `AUTH_SECRET` signs everyone out.
- **A staff account is suspect:** Admin → Utilisateurs → deactivate it, then close its sessions. Check the activity log.
- **Wrong content is public:** archive it in the media library / unpublish it; the public cache follows within minutes.
- **Site under attack or misbehaving:** Cloudflare dashboard → roll back to the previous version.

## 2. Understand
The activity log (Admin → Journal d’activité) says who did what and when; the retention job and deploys are logged too.
Note what data could have been seen: names, emails, phones, consents, sign-in sessions. There are no payments, health or
pastoral records in this system.

## 3. Tell
Personal data concerned? Within 72 hours: tell the data-protection authority (APDP, contact to confirm) and the people
affected, plainly: what happened, what data, what we did, what they should do (for example change their password).
The Parish Council decides who speaks. Keep a short written record.

## 4. Fix and learn
Fix the cause, add a test or a check, update this file. Note it in `STATUS.md`.
