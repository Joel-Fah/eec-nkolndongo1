# Module `legal` — Documents légaux

**Purpose.** The privacy policy, the legal notice and the credits as **versioned** rich-text documents. A new version
starts as a draft (a copy of the latest), is edited, then published with a plain-words summary. A published version is
never edited. The credits page also lists the Pexels photographers from the media library.

**Data kept.** `legal_documents` (document key, version, label, FR/EN bodies, change summary, purpose-changed flag, who
published and when). **No personal data.**

**Members.** Publishing a new **privacy** version changes the policy version recorded with consents. Members see a gentle
« La politique a changé » notice in Mon espace with the summary; they are asked to accept again **only** when the purposes
changed (the « changement de finalité » box at publication).

**Rights.** `legal:read`, `legal:update` (draft), `legal:publish`.

**Retention.** Every published version is kept (the history is the record of what people agreed to).
