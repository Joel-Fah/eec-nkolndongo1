# Data protection — Loi n°2024/017 du 23 décembre 2024 (Cameroun)

> Not legal advice. Have the final texts reviewed by someone competent before launch.
> The compliance grace period ended in June 2026 → we comply **from day one**.

## Principles we implement
| Obligation | Implementation |
|---|---|
| Lawfulness & explicit consent | Unticked consent checkboxes on every form; consent stored with timestamp + policy version |
| Minimisation | Each module's README lists the fields it stores and why; no optional field without a purpose |
| Retention & destruction | Retention per data type (table below); scheduled job deletes/anonymises expired data |
| Security & confidentiality | TLS everywhere, least-privilege roles, audit log, secrets in Cloudflare, Neon access restricted |
| Data subject rights | "Mon espace": view, edit, export (JSON), delete account; admin log of requests |
| Breach notification | Incident procedure in `docs/ops/` (notify APDP + affected people) |
| Non-discrimination | No collection of ethnic origin, region, political opinion |
| DPO | Council to designate a contact person for data questions |

## Initial retention proposals (to validate)
| Data | Retention |
|---|---|
| Contact form messages | 12 months after closure |
| Member account | While active; deleted 30 days after deletion request |
| Event registrations | 6 months after the event |
| Newsletter subscription | **Not built** (no domain yet): nothing is kept |
| Audit log | 24 months |
| Server logs | **Not kept by the site** (no application logs of visitors; Cloudflare's own logs are outside our control, to confirm) |

## Implemented in Phase 02 (2026-10)
- Consents stored per person with the policy version, the optional one withdrawable (Mon espace); the privacy page
  (FR/EN draft, `[À VALIDER]`) lists what is kept, why, who sees it, for how long and the rights.
- Mon espace: edit profile, view and withdraw consents, **download my data (JSON)**, **delete my account** (30-day
  grace, then purged by the daily retention job, which logs every run), sessions.
- Retention job (`apps/api/src/retention.ts`): sessions/links, outbox 90 days, audit 24 months, accounts past grace.
- Admin: member list and CSV export need `members:read` / `members:export`; the export is audited and defuses
  spreadsheet formulas. Dashboard numbers are aggregates.
- Media: photos have EXIF/GPS removed in the browser before upload; a photo of people needs the person's consent.
- Backups are encrypted (age); the private key is offline (decision 0022).

## Added in Phase 03a (2026-10)
- **Preacher and liturgist names** (module `liturgy`, per Sunday): display names typed by staff. They are public only
  when the « names consent » box is ticked, which records **who confirmed it and when**; unticking clears it. Names are
  never copied by « reprendre la semaine précédente » (consent was for one Sunday). Without consent they stay in the admin.
- **News, events, schedule, verses**: no personal data about parishioners. Staff names are kept only as `created_by` /
  `updated_by` (internal, audit log), never shown publicly.
- **Preview links** (news, events): signed, expiring after 3 days, `noindex`, no personal data in the link.
- Group leaders are scoped: a group-scoped role can edit only its own group's news and events.

## Added in Phase 03b (2026-10)
- **Contact messages** (module `contact`): name, email **or** phone, category, message, optional subject, status, assignee,
  internal notes, and the moment the visitor ticked the consent box (never pre-ticked). **No IP address is stored**: a
  salted hash is used only as a rate-limit key that expires within a day. Retention: 12 months after « handled » (at most 24
  after receipt).
- **Prayer requests** (category « Prière »): flagged sensitive, readable only with `contact:read-sensitive`, never exported,
  3 months after « handled » (at most 6 after receipt). Stated in the privacy policy.
- **People on department and council pages**: name, role, optional photo and term; **public only with a recorded consent**
  (who, when); withdrawal removes them at the next cache refresh (decision 0031).
- **Search**: queries are not stored and carry no user id; a hashed-address counter limits abuse for a day.
- **Guides**: the visitor's ticks stay in their own browser (`localStorage`); nothing is sent.
- **Quiz « Où est ta place ? »**: runs in the browser; nothing is sent or stored.
- **Legal documents**: every published version is kept (the record of what people agreed to); members are informed of a
  change and asked to accept again only when the purposes changed (decision 0033).
- **Giving**: no payment integration, no amounts, no donor data; only the parish's approved merchant details are shown.

## Added in Phase 04a (2026-10)
- **Visit counts** (decision 0038, **dormant until Joël enables it**): one data point per page view served by the Worker:
  day, page address, language, phone/desktop. **No cookie, no IP address, no user agent stored, no identifier**; two visits by
  one person cannot be linked. Skipped when the browser sends « do not track ». Kept 3 months at Cloudflare, shown to staff as
  aggregates. If Analytics Engine is not available on the free plan, nothing is counted and no other analytics is used.
- **Health check**: the daily check stores technical measures only (response time, storage used, backup age, outbox count),
  no personal data. Kept 90 days.
- **Content reviews** (« À valider », decision 0040): comments between staff about a text or figure, linked to the item, no
  visitor data. The audit log records that a correction was asked, never its text.
- **Contact form**: the minimum fill time now relies on a token signed by the server when the form is shown (it carries
  only the time and a signature, no identifier), instead of a time sent by the browser.

## Added in Phase 04b (2026-10)
- **Sermons** (module `sermons`, decision 0034): text, passages, a YouTube address and up to 4 links typed by staff. **The preacher's
  name is public only with a recorded consent** (who confirmed and when; unticking clears it; « reprendre depuis un dimanche » never
  copies the consent, decision 0031). A name without consent is never sent to the public API and cannot be used as a filter. The
  site **hosts no audio and loads nothing from the links**; the YouTube video loads only when a visitor presses play, from
  youtube-nocookie.com (YouTube then sees that visitor, under its own policy: stated in the privacy policy). The audit log records
  which fields changed, never the name or a link.

## Added in Phase 04c — event registrations (decision 0035, accepted)
- **Event registrations** (module `registrations`): name, **phone (required, with or without +237)**, optional WhatsApp number and
  e-mail, number of people, and optional questions chosen per form from a short list (group, short text, one or several choices,
  yes/no). **No sensitive question can be added**: the builder and the API refuse labels about health, origin, religion, politics
  or money. **Children** only through a parent or guardian (required, unticked box), as a **first name and an age band**.
  One unticked consent box per registration, stored with the time and the privacy-policy version (« +oral » when staff typed it
  for someone who agreed by phone). Forms are open to anyone or to members only.
- **Retention**: deleted 6 months after the event, at most 12 months after the form closed, by the daily job, which first writes
  anonymous totals per form (registered, waitlisted, cancelled, present: no name, no contact). The admin shows the days left and
  the deletion date on every form, in calm / warning (≤ 60 days) / critical (< 15 days) colours.
- **Access**: `read`, `edit`, `manage`, `export`, `delete` are separate permissions, group-scoped. The **CSV export is for the super
  admin and the secretariat only**, audited with the number of rows. The check-in view shows names, never phone numbers.
- **Waitlist**: a cancellation promotes the next person; the notice (first name + phone) goes to the outbox (deleted after 90 days).
- **Cancel link**: signed, expires two days after the event, shows only the first name and the activity. No IP address is stored;
  a salted hash is the rate-limit key only.
- The privacy policy needs a new version when this ships (decision 0033); members are informed.

## Added in Phase 04d — Fête des Moissons campaigns and the offline copy (decisions 0041, 0037)
- **Campaigns** (module `campaigns`): a goal, and **amounts received** entered by the treasurer with a date, an optional group and
  an internal note. **No donor is recorded** (no field for one; the form forbids names in the note). **Only validated totals are
  public**, as sums, never rows. Entering and validating are two different people (the API refuses validating one's own entry);
  editing a validated amount removes its validation; the audit log carries neither amount nor note. Retention: the totals are the
  parish's accounts of the festival and are kept with the campaign until staff delete it.
- **Offline copy** (service worker): public pages you read are kept **on your own device** (up to 40) so they open without network.
  Nothing private is kept: no admin, no Mon espace, no registration or cancel page, no search, no preview, no `/api` response.
  Clearing the site's data in the browser removes it. No push notification, no tracking.

## Added in Phase 04e — Sunday reports and the members' Moissons page (decisions 0043, 0042)
- **Sunday reports** (module `sundays`): three attendance counts (men, women, children) and offering lines (purpose, amount, optional
  group, optional campaign) per Sunday. **Aggregates only**: no name, no donor, no link to a member. The internal note must not name
  anyone. Entered by the secretariat (attendance) and the treasurer (offerings); group leaders see only their group's lines; the CSV
  export is for the super admin and the secretariat and is audited by row count. **Never public.** The audit log carries no figures.
  A Moissons offering linked to a campaign becomes an unvalidated campaign entry, public only as part of a validated total.
- **Moissons page for members**: shown only to signed-in members and only in season; visitors see no amounts. `private, no-store`,
  `noindex`, never kept by the offline copy.
- **Opening on Sunday**: a session cookie `eec-sun` (the day's date, expires that night) remembers that the visitor was already
  taken to « Ce dimanche » today. It holds no identifier.

## Added in Phase 04f — member profile, private photo and card (decision 0047)
- **Optional details** a signed-in member may add in « Mon espace »: birth date, gender, neighbourhood and city, marital status, profession.
  Purpose: to know and understand the congregation (age bands, where people live, skills). **No street address, no GPS, nothing sensitive
  beyond that list.** Behind a separate, unticked, withdrawable consent (`profile`) with the policy version; withdrawing erases the details.
  Staff see an **age band** (never the exact date), how the person signs in (Google or e-mail) and aggregates (groups under 5 people are not shown on their own). The CSV export of these
  columns is limited to the export permission and audited by row count.
- **Google for staff (0053):** a staff account can add Google from « Mon compte » (password asked again). Stored: the Google account id and the tokens Better Auth keeps for the sign-in; scopes openid, e-mail, profile only. Every link and removal is in the activity log. Removing it, or deleting the account, erases it.
- **Profile photo:** seen by the parish team who manage members (`members:read`), never public; the member decides whether it is also their avatar in the menu (otherwise a generated avatar). One 512 px WebP, metadata removed in the browser, served only by session-checked routes (`private, no-store`). A Google sign-in photo counts as the member's photo until they choose another. Deleted with the photo, the consent or the account.
- **Member card:** removed for now; it comes back with the communion card in the next phase.
- Retention: with the account, in « my data » and in the 30-day deletion.

## Explicitly out of scope until a decision record exists
Baptism/marriage registers, counselling/délivrance notes, health information, minors' data beyond
what a parent provides for a specific activity.

## Pages to ship
- Politique de confidentialité (draft in `docs/research/`, to rewrite)
- Mentions légales
- Cookie notice: none needed if we use no tracking cookies (only essential session cookies) — keep it that way.

## Groupes, demandes et annonces (décision 0049, Phase 05)
- **Ce qui est gardé** : l'appartenance à un groupe (`group_members`, avec la case « partager mon numéro avec les responsables » décochée par défaut), les demandes pour rejoindre (`group_requests` : qui, quel groupe, message du membre et de la décision, dates), les annonces d'un groupe (`announcements_items`).
- **Pourquoi** : que chaque responsable connaisse son groupe sans passer par le secrétariat ; prévenir les membres.
- **Qui voit quoi** : un responsable ne voit que son groupe (nom, avatar, arrivée, titre, numéro si partagé, tranche d'âge si ≥ 5 personnes) ; jamais l'e-mail ni la date de naissance. Le secrétariat voit tous les groupes. Rien n'est public.
- **Export** de la liste d'un groupe : droit dangereux `core:group-export`, limité au groupe, journalisé.
- **Conservation** : demande décidée effacée après 12 mois, demande en attente effacée après 6 mois, tout effacé avec le compte. Le motif d'un retrait reste dans le journal d'activité (24 mois), jamais montré au membre.

## Carte de Sainte-Cène (décision 0050, Phase 05)
- **Ce qui est gardé** : la carte (`communion_cards`), les visas mensuels, les excuses déclarées par le membre (sans motif), les cotisations reçues (registre), les montants attendus
  (barèmes), et, sur le profil, la déclaration « baptisé / confirmé » du membre (avec le consentement `profile`) et la confirmation de la paroisse (qui, quand).
- **Donnée sensible** : appartenance religieuse (baptême, confirmation, communiant). Accès : secrétariat et pasteur (émission, confirmation), Anciens (visa, registre), trésorier (barèmes, registre).
  Jamais publique. Le contrôle par QR ne montre que « valide / non valide », un prénom et l'initiale du nom.
- **Règles** : une carte est proposée par une personne et approuvée par une autre ; la suspension est du ressort du secrétariat, le retrait du pasteur (motif dans le journal seulement) ; le membre ne voit
  jamais un motif ni une dette.
- **Conservation** : tout est effacé avec le compte (cascade). La carte de papier reste la référence.
- **Sur l'appareil** : la dernière carte est gardée dans le navigateur (IndexedDB) pour s'ouvrir sans réseau ; effacée à la déconnexion, au bout de 45 jours ou à l'expiration.

## Registre des demandes sur les données (décision 0052, Phase 05)
- **Ce qui est gardé** : type de demande, nom de la personne, moyen de lui répondre (facultatif), canal, dates, issue en quelques mots (jamais les données), qui a traité.
- **Qui voit** : secrétariat (`rights:read` / `handle`) ; suppression : super administrateur. Le journal d'activité garde le type, jamais la personne.
- **Délai** : 30 jours (lecture prudente, **à confirmer** avec la loi). **Conservation** : 24 mois après la clôture (à confirmer).
- Le registre complet des traitements est dans `docs/legal/register.md` (Phase 05 : entrées ajoutées, le reste au Checkpoint L).

## Ce que ce document ne disait pas encore (corrigé 2026-10-27)
- **Notifications** dans le site (`notifications`, `notification_mutes`) : un type, un titre court, un lien ; gardées avec le compte.
- **Boîte d'envoi** (`mail_outbox`) : messages à transmettre à la main, effacés après 90 jours.
- **Sessions** : appareil et date de chaque connexion, visibles et fermables par la personne ; expirées effacées chaque jour.
- **Sauvegardes** : une copie chiffrée hebdomadaire de la base ; **une personne supprimée peut rester dans les dernières sauvegardes (jusqu'à 12 sauvegardes hebdomadaires)** : à dire dans la politique de confidentialité.
- **Groupes, demandes, annonces, carte de Sainte-Cène, demandes sur les données** : voir les sections ci-dessus.
- **Cadre légal** : voir `member-data-legal-notes.md` (lecture de sources secondaires, points à confirmer) et `questions-pour-un-juriste.md`.
